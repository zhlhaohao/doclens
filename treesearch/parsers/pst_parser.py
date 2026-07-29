# -*- coding: utf-8 -*-
"""PST (Outlook 邮件数据文件) parser for TreeSearch.

架构：Go sidecar（treesearch/_bin/pst-extract.exe，go-pst 库）把 PST 解包为流式
JSONL（每行一封邮件，附件提取到临时目录），本模块逐行消费并建树。

索引粒度：**每封邮件一个文档**（打破 1 文件 = 1 文档惯例）。派生文档的
``source_path`` = ``<pst绝对路径>#<entry_id>``；索引器据此做级联删除与
增量替换（PST hash 变化 → 全量重建该 PST 的全部邮件文档）。

仅邮件（IPM.Note 等）进索引；联系人/日历/任务由 sidecar 跳过。

附件（ADR-0003，2026-07-29）：**全部** ≤100MB 的附件（不限类型）落盘到
``pst_attachments/<doc_hash>/<entry_id>/`` 供预览下载；白名单文档类附件
额外解析为文本并入正文（ADR-0002 的附件并入逻辑不变）。

正文（ADR-0003）：``body_html`` 存在时优先转写为 Markdown（保持标题/列表/
表格结构），无 HTML 或转写失败时退回纯文本。

每棵树附带 ``email_meta``（主题/发件人/日期/文件夹/附件清单），索引器写入
``pst_email_meta`` 表供邮件列表分页查询。
"""
import asyncio
import json
import logging
import os
import queue
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from .email_html_md import email_html_to_md
from .html_parser import _extract_html_structure

logger = logging.getLogger(__name__)

# 参与解析并入正文的附件类型（其余只落盘供下载）。白名单语义同 ADR-0002。
ATTACHMENT_PARSE_EXTS = ("pdf", "docx", "doc", "xlsx", "pptx", "csv", "txt", "md", "html")

# 单个附件解析文本并入正文时的字符上限
ATTACHMENT_TEXT_MAX_CHARS = 200_000

# 附件落盘大小上限（ADR-0003：100MB，超限只记文件名）
ATTACHMENT_STORE_MAX_BYTES = 100 * 1024 * 1024

# sidecar 输出队列上限（背压：sidecar 快、消费慢时防止内存膨胀）
_QUEUE_MAXSIZE = 32


class PstExtractNotFoundError(RuntimeError):
    """pst-extract sidecar 不存在时抛出。"""


def _find_sidecar() -> str:
    """定位 pst-extract 可执行文件。

    优先环境变量 ``TREESEARCH_PST_EXTRACT``；否则取 treesearch 包内 ``_bin/``
    目录（与 doclens 定位 .env.example 的模式一致，editable / wheel 安装皆可用）。
    """
    env = os.environ.get("TREESEARCH_PST_EXTRACT")
    if env and os.path.isfile(env):
        return env
    exe_name = "pst-extract.exe" if os.name == "nt" else "pst-extract"
    # treesearch/parsers/pst_parser.py → 上两级 = treesearch 包根 → _bin/
    exe = Path(__file__).resolve().parent.parent / "_bin" / exe_name
    if exe.is_file():
        return str(exe)
    raise PstExtractNotFoundError(
        f"pst-extract sidecar not found at {exe}; "
        "build via: cd tools/pst-extract && go build -o ../../treesearch/_bin/pst-extract.exe . ; "
        "or set TREESEARCH_PST_EXTRACT"
    )


def _format_size(size: int) -> str:
    if size >= 1024 * 1024:
        return f"{size / 1024 / 1024:.1f} MB"
    if size >= 1024:
        return f"{size / 1024:.0f} KB"
    return f"{size} B"


def _strip_root_prefix(folder: str) -> str:
    """去掉 sidecar 输出的 ROOT_FOLDER/ 前缀，取最后一级作为显示名。"""
    parts = [p for p in folder.split("/") if p and p != "ROOT_FOLDER"]
    return parts[-1] if parts else folder


async def _parse_attachment_text(tmp_path: str, **kwargs) -> str:
    """用现有 parser 解析附件临时文件，返回拍平的纯文本。"""
    from .registry import get_parser
    from ..tree import flatten_tree

    ext = os.path.splitext(tmp_path)[1].lower()
    parser_fn = get_parser(ext)
    if parser_fn is None:
        return ""
    tree = await parser_fn(
        tmp_path,
        if_add_node_summary=False,
        if_add_doc_description=False,
        if_add_node_text=True,
        if_add_node_id=True,
    )
    texts = []
    for node in flatten_tree(tree.get("structure", [])):
        title = (node.get("title") or "").strip()
        text = (node.get("text") or "").strip()
        if title and text and title != text:
            texts.append(f"{title}\n{text}")
        elif text:
            texts.append(text)
        elif title:
            texts.append(title)
    return "\n\n".join(texts)


def _email_body_text(email: dict) -> str:
    """优先纯文本正文；为空则从 HTML 正文提取文本。"""
    body = (email.get("body") or "").strip()
    if body:
        return body
    html = (email.get("body_html") or "").strip()
    if html:
        try:
            _, plain_text = _extract_html_structure(html)
            return plain_text.strip()
        except Exception as e:
            logger.debug("HTML body extraction failed: %s", e)
    return ""


def _email_body_markdown(email: dict) -> str:
    """邮件正文 → Markdown（ADR-0003）：body_html 优先转写，退回纯文本。"""
    html = (email.get("body_html") or "").strip()
    if html:
        md = email_html_to_md(html)
        if md:
            return md
    return _email_body_text(email)


def _build_email_text(email: dict, attachment_sections: list[tuple[str, str]]) -> str:
    """组装邮件文档正文：头部块 + 正文 + 附件章节。"""
    header_lines = []
    from_part = email.get("from_name") or ""
    from_addr = email.get("from_addr") or ""
    if from_part or from_addr:
        header_lines.append(f"发件人: {from_part} <{from_addr}>" if from_addr and from_addr not in from_part else f"发件人: {from_part or from_addr}")
    if email.get("to"):
        header_lines.append(f"收件人: {email['to']}")
    if email.get("cc"):
        header_lines.append(f"抄送: {email['cc']}")
    if email.get("date"):
        header_lines.append(f"日期: {email['date']}")
    if email.get("folder"):
        header_lines.append(f"文件夹: {_strip_root_prefix(email['folder'])}")

    attachments = email.get("attachments") or []
    if attachments:
        att_list = "; ".join(
            f"{a.get('name') or 'unnamed'} ({_format_size(a.get('size') or 0)})"
            for a in attachments
        )
        header_lines.append(f"附件: {att_list}")

    parts = ["\n".join(header_lines)] if header_lines else []
    body = _email_body_markdown(email)
    if body:
        parts.append(body)
    for name, text in attachment_sections:
        parts.append(f"## 附件: {name}\n\n{text}")
    return "\n\n".join(parts)


def _email_to_tree(email: dict, attachment_sections: list[tuple[str, str]],
                   source_path: str, **kwargs) -> dict:
    """把一封邮件建成单节点树文档。"""
    from ..indexer import _build_tree, _finalize_tree

    # MAPI 主题可能带 \x01 等控制字符（go-pst 原样返回），建树前清除
    subject = re.sub(r"[\x00-\x1f]", "", email.get("subject") or "").strip() or "(无主题)"
    text = _build_email_text(email, attachment_sections)
    lines = text.count("\n") + 1
    node = {
        "title": subject,
        "line_num": 1,
        "line_start": 1,
        "line_end": lines,
        "level": 1,
        "text": text,
    }
    tree = _build_tree([node])
    return _finalize_tree(
        tree, subject,
        source_path=source_path,
        source_type="pst",
        if_add_node_id=kwargs.get("if_add_node_id", True),
        if_add_node_summary=kwargs.get("if_add_node_summary", False),
        summary_chars_threshold=kwargs.get("summary_chars_threshold", 600),
        if_add_node_text=kwargs.get("if_add_node_text", True),
        if_add_doc_description=False,
    )


def _produce_jsonl(proc: subprocess.Popen, q: "queue.Queue") -> None:
    """生产者线程：逐行读取 sidecar stdout，JSON 解析后放入队列。

    任何单行异常都必须被吞掉并记录——若本线程崩溃退出，finally 仍会
    put(None) 让消费者正常收尾，但副作用是 sidecar 可能阻塞在 stdout
    管道写入上永不退出（死锁）。因此异常路径必须可见、行数必须可审计。
    """
    n_lines = 0
    try:
        for raw in proc.stdout:
            n_lines += 1
            raw = raw.strip()
            if not raw:
                continue
            try:
                # 先显式解码（replace 容错）再 json.loads(str)：
                # json.loads(bytes) 遇非法 UTF-8 抛 UnicodeDecodeError，
                # 它不属于 JSONDecodeError，静默漏捕会让线程直接崩溃。
                q.put(json.loads(raw.decode("utf-8", errors="replace")))
            except Exception as e:
                logger.warning(
                    "pst-extract: bad JSONL line %d skipped: %s", n_lines, e
                )
    except Exception:
        logger.exception("pst-extract: producer thread crashed after %d lines", n_lines)
    finally:
        logger.info("pst-extract: stdout EOF after %d lines", n_lines)
        q.put(None)


def _drain_stderr(proc: subprocess.Popen, sink: list) -> None:
    """收集 sidecar stderr（progress/warn），保留尾部供错误诊断。"""
    try:
        for raw in proc.stderr:
            line = raw.decode("utf-8", errors="replace").rstrip()
            if line:
                logger.debug("pst-extract: %s", line)
                sink.append(line)
                if len(sink) > 20:
                    del sink[:10]
    except Exception:
        pass


# MAPI 主题可能带 \x01 等控制字符（go-pst 原样返回），入库前清除
_SUBJECT_CONTROL_CHARS = re.compile(r"[\x00-\x1f]")


def _clean_subject(raw: str) -> str:
    return _SUBJECT_CONTROL_CHARS.sub("", raw or "").strip() or "(无主题)"


def _sender_display(email: dict) -> str:
    from_part = email.get("from_name") or ""
    from_addr = email.get("from_addr") or ""
    if from_addr and from_addr not in from_part:
        return f"{from_part} <{from_addr}>" if from_part else from_addr
    return from_part or from_addr


async def pst_to_trees(
    pst_path: str,
    *,
    model: Optional[str] = None,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    pst_attachment_store=None,
    rel_path: str = "",
    **kwargs,
) -> dict:
    """解析 PST，返回 ``{"multi_docs": [tree, ...]}``（每封邮件一个树）。

    与普通 parser 的返回值约定不同——索引器对 multi_docs 特殊处理，
    为每个树建一个 Document（source_path = ``<pst>#<entry_id>``）。

    Args:
        pst_attachment_store: PstAttachmentStore 实例（索引器经 kwargs 传入）；
            为 None 时附件不持久化（兼容直接调用/测试），白名单附件解析后即删。
        rel_path: PST 相对 search_path 的 POSIX 路径（附件落盘目录命名依据）。
    """
    abs_pst = os.path.abspath(pst_path)
    sidecar = _find_sidecar()
    tmp_dir = tempfile.mkdtemp(prefix="pst_att_")
    logger.info("Parsing PST via sidecar: %s (attachments tmp: %s)", pst_path, tmp_dir)

    cmd = [
        sidecar,
        "--pst", abs_pst,
        "--tmp-dir", tmp_dir,
        # "*" = 全部类型附件都提取（落盘供下载）；白名单只控制"解析并入正文"
        "--attachment-exts", "*",
        "--max-attachment-bytes", str(ATTACHMENT_STORE_MAX_BYTES),
    ]
    # Windows 下用 Popen + 生产者线程读管道（对事件循环实现无要求）
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=1024 * 256,
    )
    q: "queue.Queue" = queue.Queue(maxsize=_QUEUE_MAXSIZE)
    loop = asyncio.get_running_loop()
    producer = loop.run_in_executor(None, _produce_jsonl, proc, q)
    stderr_tail: list = []
    stderr_reader = loop.run_in_executor(None, _drain_stderr, proc, stderr_tail)

    trees: list[dict] = []
    parsed_attachments = 0
    failed_attachments = 0
    stored_attachments = 0
    build_kwargs = dict(
        if_add_node_summary=if_add_node_summary,
        summary_chars_threshold=summary_chars_threshold,
        if_add_node_text=if_add_node_text,
        if_add_node_id=if_add_node_id,
    )

    try:
        while True:
            email = await loop.run_in_executor(None, q.get)
            if email is None:
                break
            entry_id = email.get("entry_id")
            source_path = f"{abs_pst}#{entry_id}"
            raw_atts = email.get("attachments") or []

            # 1) 附件全量落盘（≤100MB 且 sidecar 已提取的）；白名单随后从
            #    落盘位置解析并入正文。无 store 时退回旧行为（解析后即删）。
            extracted = [(a.get("path") or "", a.get("name") or "unnamed")
                         for a in raw_atts if a.get("path")]
            stored: list = []
            if pst_attachment_store is not None and rel_path:
                stored = pst_attachment_store.store_for_email(
                    rel_path, str(entry_id), extracted
                )
                stored_attachments += sum(1 for s in stored if s is not None)
                email_dir = pst_attachment_store.email_dir_for(rel_path, str(entry_id))

            attachment_sections: list[tuple[str, str]] = []
            for idx_att, (tmp_path, name) in enumerate(extracted):
                ext = os.path.splitext(name)[1].lower().lstrip(".")
                if ext not in ATTACHMENT_PARSE_EXTS:
                    continue
                # 优先从落盘位置解析；未落盘（无 store）则从临时文件解析
                if stored and stored[idx_att] is not None:
                    parse_from = str(email_dir / stored[idx_att].filename)
                    cleanup = False
                else:
                    parse_from = tmp_path
                    cleanup = pst_attachment_store is None
                try:
                    text = await _parse_attachment_text(parse_from)
                    if text:
                        if len(text) > ATTACHMENT_TEXT_MAX_CHARS:
                            text = text[:ATTACHMENT_TEXT_MAX_CHARS] + "\n\n[附件内容已截断]"
                        attachment_sections.append((name, text))
                        parsed_attachments += 1
                except Exception as e:
                    failed_attachments += 1
                    logger.warning("Attachment parse failed (%s): %s", name, e)
                finally:
                    if cleanup:
                        try:
                            os.remove(tmp_path)
                        except OSError:
                            pass
            # 无 store 时清理未参与解析的临时文件（有 store 时已 move 走）
            if pst_attachment_store is None:
                for tmp_path, _name in extracted:
                    try:
                        os.remove(tmp_path)
                    except OSError:
                        pass

            # 2) 邮件元数据（索引器写入 pst_email_meta 表，供列表分页查询）
            stored_by_name: dict[str, list] = {}
            for s in stored:
                if s is not None:
                    stored_by_name.setdefault(s.name, []).append(s)
            meta_atts = []
            for a in raw_atts:
                name = a.get("name") or "unnamed"
                cand = stored_by_name.get(name) or []
                s = cand.pop(0) if cand else None
                meta_atts.append({
                    "name": name,
                    "size": a.get("size") or 0,
                    "stored": s is not None,
                    "filename": s.filename if s else None,
                })
            email_meta = {
                "entry_id": str(entry_id),
                "subject": _clean_subject(email.get("subject") or ""),
                "sender": _sender_display(email),
                "date": email.get("date") or "",
                "folder": _strip_root_prefix(email.get("folder") or ""),
                "attachments": meta_atts,
            }

            try:
                tree = _email_to_tree(email, attachment_sections, source_path, **build_kwargs)
                tree["email_meta"] = email_meta
                trees.append(tree)
            except Exception as e:
                logger.warning("Failed to build tree for email %s: %s", entry_id, e)

        try:
            ret = proc.wait(timeout=120)
        except subprocess.TimeoutExpired:
            proc.kill()
            tail = "\n".join(stderr_tail[-5:])
            raise RuntimeError(
                f"pst-extract did not exit within 120s after EOF (killed): {tail}"
            )
        if ret != 0:
            tail = "\n".join(stderr_tail[-5:])
            raise RuntimeError(f"pst-extract exited with code {ret}: {tail}")
    finally:
        await producer
        await stderr_reader
        if proc.poll() is None:
            proc.kill()
        shutil.rmtree(tmp_dir, ignore_errors=True)

    logger.info(
        "PST parsed: %s -> %d email docs (attachments parsed=%d failed=%d stored=%d)",
        pst_path, len(trees), parsed_attachments, failed_attachments, stored_attachments,
    )
    return {
        "multi_docs": trees,
        "doc_name": os.path.splitext(os.path.basename(pst_path))[0],
        "source_path": abs_pst,
        "source_type": "pst",
    }
