# -*- coding: utf-8 -*-
"""PST (Outlook 邮件数据文件) parser for TreeSearch.

架构：Go sidecar（bin/pst-extract.exe，go-pst 库）把 PST 解包为流式
JSONL（每行一封邮件，白名单附件提取到临时目录），本模块逐行消费并建树。

索引粒度：**每封邮件一个文档**（打破 1 文件 = 1 文档惯例）。派生文档的
``source_path`` = ``<pst绝对路径>#<entry_id>``；索引器据此做级联删除与
增量替换（PST hash 变化 → 全量重建该 PST 的全部邮件文档）。

仅邮件（IPM.Note 等）进索引；联系人/日历/任务由 sidecar 跳过。
附件内容并入所属邮件正文（不产出独立文档、不持久落盘）。
"""
import asyncio
import json
import logging
import os
import queue
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from .html_parser import _extract_html_structure

logger = logging.getLogger(__name__)

# 参与解析的附件类型（其余只记文件名）。与 sidecar 的 --attachment-exts 保持一致。
ATTACHMENT_PARSE_EXTS = ("pdf", "docx", "doc", "xlsx", "pptx", "csv", "txt", "md", "html")

# 单个附件解析文本并入正文时的字符上限
ATTACHMENT_TEXT_MAX_CHARS = 200_000

# sidecar 输出队列上限（背压：sidecar 快、消费慢时防止内存膨胀）
_QUEUE_MAXSIZE = 32


class PstExtractNotFoundError(RuntimeError):
    """pst-extract sidecar 不存在时抛出。"""


def _find_sidecar() -> str:
    """定位 pst-extract 可执行文件。

    优先环境变量 ``TREESEARCH_PST_EXTRACT``；否则取仓库根 bin/ 目录
    （treesearch/parsers/pst_parser.py → 上两级为仓库根）。
    """
    env = os.environ.get("TREESEARCH_PST_EXTRACT")
    if env and os.path.isfile(env):
        return env
    repo_root = Path(__file__).resolve().parents[2]
    exe = repo_root / "bin" / ("pst-extract.exe" if os.name == "nt" else "pst-extract")
    if exe.is_file():
        return str(exe)
    raise PstExtractNotFoundError(
        f"pst-extract sidecar not found at {exe}; "
        "build it via tools/pst-extract (go build) or set TREESEARCH_PST_EXTRACT"
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
    body = _email_body_text(email)
    if body:
        parts.append(body)
    for name, text in attachment_sections:
        parts.append(f"## 附件: {name}\n\n{text}")
    return "\n\n".join(parts)


def _email_to_tree(email: dict, attachment_sections: list[tuple[str, str]],
                   source_path: str, **kwargs) -> dict:
    """把一封邮件建成单节点树文档。"""
    from ..indexer import _build_tree, _finalize_tree

    subject = (email.get("subject") or "").strip() or "(无主题)"
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


async def pst_to_trees(
    pst_path: str,
    *,
    model: Optional[str] = None,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict:
    """解析 PST，返回 ``{"multi_docs": [tree, ...]}``（每封邮件一个树）。

    与普通 parser 的返回值约定不同——索引器对 multi_docs 特殊处理，
    为每个树建一个 Document（source_path = ``<pst>#<entry_id>``）。
    """
    abs_pst = os.path.abspath(pst_path)
    sidecar = _find_sidecar()
    tmp_dir = tempfile.mkdtemp(prefix="pst_att_")
    logger.info("Parsing PST via sidecar: %s (attachments tmp: %s)", pst_path, tmp_dir)

    cmd = [
        sidecar,
        "--pst", abs_pst,
        "--tmp-dir", tmp_dir,
        "--attachment-exts", ",".join(ATTACHMENT_PARSE_EXTS),
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

            attachment_sections: list[tuple[str, str]] = []
            for att in (email.get("attachments") or []):
                tmp_path = att.get("path") or ""
                name = att.get("name") or "unnamed"
                if not tmp_path:
                    continue
                try:
                    text = await _parse_attachment_text(tmp_path)
                    if text:
                        if len(text) > ATTACHMENT_TEXT_MAX_CHARS:
                            text = text[:ATTACHMENT_TEXT_MAX_CHARS] + "\n\n[附件内容已截断]"
                        attachment_sections.append((name, text))
                        parsed_attachments += 1
                except Exception as e:
                    failed_attachments += 1
                    logger.warning("Attachment parse failed (%s): %s", name, e)
                finally:
                    try:
                        os.remove(tmp_path)
                    except OSError:
                        pass

            try:
                trees.append(_email_to_tree(email, attachment_sections, source_path, **build_kwargs))
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
        "PST parsed: %s -> %d email docs (attachments parsed=%d failed=%d)",
        pst_path, len(trees), parsed_attachments, failed_attachments,
    )
    return {
        "multi_docs": trees,
        "doc_name": os.path.splitext(os.path.basename(pst_path))[0],
        "source_path": abs_pst,
        "source_type": "pst",
    }
