# -*- coding: utf-8 -*-
"""PST (Outlook 邮件数据文件) parser for TreeSearch.

架构：Go sidecar（treesearch/_bin/pst-extract.exe，go-pst 库）把 PST 解包为流式
JSONL（每行一封邮件，附件提取到临时目录），本模块逐行消费并建树。

索引粒度：**每封邮件一个文档**（打破 1 文件 = 1 文档惯例）。派生文档的
``source_path`` = ``<pst绝对路径>#<entry_id>``；索引器据此做级联删除与
增量替换（PST hash 变化 → 全量重建该 PST 的全部邮件文档）。

仅邮件（IPM.Note 等）进索引；联系人/日历/任务由 sidecar 跳过。

附件（ADR-0005，2026-07-29）：**全部** ≤100MB 的附件（不限类型）落盘到
``pst_attachments/<doc_hash>/<entry_id>/`` 供预览下载；白名单文档类附件
额外解析为文本并入正文（ADR-0002 的附件并入逻辑不变）。

正文（ADR-0005）：``body_html`` 存在时优先转写为 Markdown（保持标题/列表/
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
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from .email_html_md import email_html_to_md
from .html_parser import _extract_html_structure

logger = logging.getLogger(__name__)

# 参与解析并入正文的附件类型（其余只落盘供下载）。白名单语义同 ADR-0002。
ATTACHMENT_PARSE_EXTS = ("pdf", "docx", "doc", "xlsx", "pptx", "csv", "txt", "md", "html")

# 单个附件解析文本并入正文时的字符上限
ATTACHMENT_TEXT_MAX_CHARS = 200_000

# 附件落盘大小上限（ADR-0005：100MB，超限只记文件名）
ATTACHMENT_STORE_MAX_BYTES = 100 * 1024 * 1024

# sidecar 输出队列上限（背压：sidecar 快、消费慢时防止内存膨胀）
_QUEUE_MAXSIZE = 32

# 单个附件解析超时（秒）：pdf/docx 等 parser 虽声明 async def 但内部同步阻塞
# （pdfplumber/fitz/openpyxl），遇到构造恶劣的附件会卡死。超时即放弃该附件、
# 记 failed、继续下一封邮件，避免一个坏附件拖死整个 PST 解析（ADR: PST 卡死修复）。
_ATTACHMENT_PARSE_TIMEOUT_S = 60

# 消费者循环进度日志间隔（每 N 封邮件打一次 info），让长时间 PST 解析可观测。
_PROGRESS_LOG_INTERVAL = 100

# 消费者进度日志的时间兜底（秒）：sidecar 慢或崩溃前可能很久不到 _PROGRESS_LOG_INTERVAL，
# 按时间额外打一次，避免长时间无日志让用户误判卡死。
_PROGRESS_LOG_SECS = 30

# 附件解析独立线程池：与 indexer 主并发池隔离。卡死的附件解析线程不阻塞
# 主事件循环；max_workers=2 下最坏泄漏 2 个线程、吞吐降级，但主流程不卡死。
# ThreadPoolExecutor 超时后无法强杀线程（Python 限制），权衡优于 ProcessPoolExecutor
# （可杀进程但序列化/开销大）。
_ATTACHMENT_POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pst-att")


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


def _parse_attachment_sync(tmp_path: str) -> dict:
    """同步包装：在 executor 线程的独立事件循环里跑 async parser。

    pdf_to_tree / docx_to_tree 等声明 ``async def`` 但内部是同步阻塞调用
    （pdfplumber/fitz/openpyxl），在主事件循环里直接 ``await`` 会阻塞循环。
    放到独立线程跑 ``asyncio.run`` → 不阻塞主循环；外层再加超时即可兜底坏附件。
    无对应 parser 返回 ``{}``（等价原 ``parser_fn is None`` 的空结果）。
    """
    from .registry import get_parser

    ext = os.path.splitext(tmp_path)[1].lower()
    parser_fn = get_parser(ext)
    if parser_fn is None:
        return {}
    return asyncio.run(parser_fn(
        tmp_path,
        if_add_node_summary=False,
        if_add_doc_description=False,
        if_add_node_text=True,
        if_add_node_id=True,
    ))


async def _parse_attachment_text(tmp_path: str, **kwargs) -> str:
    """用现有 parser 解析附件临时文件，返回拍平的纯文本。

    解析在独立线程池执行 + 单附件超时（``_ATTACHMENT_PARSE_TIMEOUT_S``），
    避免一个坏附件卡死整个 PST 解析。超时抛 ``asyncio.TimeoutError``，
    由上层 ``pst_to_trees`` 消费者循环捕获并记 ``failed_attachments``。
    """
    from ..tree import flatten_tree

    loop = asyncio.get_running_loop()
    try:
        tree = await asyncio.wait_for(
            loop.run_in_executor(_ATTACHMENT_POOL, _parse_attachment_sync, tmp_path),
            timeout=_ATTACHMENT_PARSE_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "Attachment parse timed out (%ds), skipped: %s",
            _ATTACHMENT_PARSE_TIMEOUT_S, tmp_path,
        )
        raise
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


def _decode_mime_words(value: str) -> str:
    """解码 RFC2047 encoded-word（=?utf-8?B?...?=），失败时原样返回。"""
    from email.header import decode_header, make_header

    try:
        return str(make_header(decode_header(value or "")))
    except Exception:
        return value or ""


# 头转储内嵌原始邮件正文的字符上限（剥掉 base64 后仍防爆）
_EMBEDDED_BODY_MAX_CHARS = 50_000


def _extract_rfc822_content(source: str) -> tuple[list[str], list[str]]:
    """解析内嵌的 RFC822 报文，返回 (正文文本段列表, 附件文件名列表)。

    text/plain 直接解码；text/html 经 email_html_to_md 转写；
    附件/图片只记文件名（base64 内容不入库）。
    """
    from email import message_from_string

    texts: list[str] = []
    att_names: list[str] = []
    try:
        msg = message_from_string(source)
    except Exception:
        return texts, att_names
    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        filename = part.get_filename()
        if filename:
            att_names.append(_decode_mime_words(filename))
            continue
        ctype = part.get_content_type()
        if ctype not in ("text/plain", "text/html"):
            continue
        try:
            data = part.get_payload(decode=True)
        except Exception:
            data = None
        if not data:
            continue
        charset = part.get_content_charset() or "utf-8"
        raw = data.decode(charset, errors="replace")
        if ctype == "text/html":
            md = email_html_to_md(raw)
            if md and md.strip():
                texts.append(md.strip())
        else:
            if raw.strip():
                texts.append(raw.strip())
    return texts, att_names


# RFC822 头行（如 "Received: from ..."；空值头如 "Subject:" 也算——冒号后直接行尾）
_RFC822_HEADER_RE = re.compile(r"^[A-Za-z][A-Za-z0-9-]*:(?:[ \t]|$)")

# 头转储前允许的系统提示行数（如"未处理该邮件，因为它包含一个无效的收件人。"）
_HEADER_DUMP_NOTICE_MAX_LINES = 5

# 地址列表展示上限（超出折叠为"等 N 个"）
_ADDR_LIST_MAX = 20


def _format_addr_list(raw_value: str) -> str:
    """解码并折叠超长地址列表：解码 encoded-word，>20 个时截断为"等 N 个"。"""
    from email.utils import getaddresses

    decoded = _decode_mime_words(raw_value)
    pairs = getaddresses([decoded])
    addrs = []
    for name, addr in pairs:
        if not addr and not name:
            continue
        addrs.append(f"{name} <{addr}>" if name and addr and name not in addr else (addr or name))
    if len(addrs) > _ADDR_LIST_MAX:
        return ", ".join(addrs[:_ADDR_LIST_MAX]) + f" 等 {len(addrs)} 个"
    return ", ".join(addrs) if addrs else decoded


def _reformat_header_dump(body: str) -> Optional[str]:
    """"邮件头转储"正文 → 可读重排；非头转储返回 None。

    部分邮件（如 Outlook 对"无效收件人"消息生成的系统报告）的 PR_BODY /
    PR_HTML 不是正常正文，而是原始邮件的 RFC822 转储：Received 链 +
    未解码 encoded-word 的 From/To，甚至带完整 MIME 源码（multipart +
    base64 图片）。直接展示不可读，这里解析、解码并重组：

    - 头块解码重排（地址列表折叠、转发链压缩为"N 跳"）
    - 带 payload 时按 RFC822 解析内嵌报文，提取 text/html 正文，
      base64 附件只列文件名

    解析按"逻辑块"进行：空行只作分隔（HTML 转写常在每个头行间插空行），
    空白/Tab 开头的行折叠进上一块。要求首个头块前的提示块 ≤5 块。
    """
    # 归并为逻辑块：忽略空行，折叠延续行
    blocks: list[str] = []
    for line in (body or "").split("\n"):
        line = line.rstrip("\r")
        if not line.strip():
            continue
        if line[:1] in (" ", "\t") and blocks:
            blocks[-1] += " " + line.strip()
        else:
            blocks.append(line.strip())

    start = next((i for i, b in enumerate(blocks) if _RFC822_HEADER_RE.match(b)), None)
    if start is None or start > _HEADER_DUMP_NOTICE_MAX_LINES:
        return None
    # 头块 = start 起连续的头行块；其后的非头行块为 payload
    end = start
    while end < len(blocks) and _RFC822_HEADER_RE.match(blocks[end]):
        end += 1
    header_blocks = blocks[start:end]
    payload_blocks = blocks[end:]

    headers = [(b.partition(":")[0], b.partition(":")[2].strip()) for b in header_blocks]
    names = {n.lower() for n, _ in headers}
    if "from" not in names or ("received" not in names and "to" not in names):
        return None

    notice = "\n".join(blocks[:start])
    parts: list[str] = [notice] if notice else []

    n_received = sum(1 for n, _ in headers if n.lower() == "received")
    head_lines: list[str] = []
    emitted: set[str] = set()
    for name, value in headers:
        key = name.lower()
        if key in emitted or key in ("received", "content-type", "content-transfer-encoding", "mime-version"):
            continue
        emitted.add(key)
        if key in ("to", "cc", "bcc"):
            head_lines.append(f"{name}: {_format_addr_list(value)}")
        else:
            head_lines.append(f"{name}: {_decode_mime_words(value)}")
    if n_received:
        head_lines.append(f"邮件转发记录: {n_received} 跳（已省略）")
    parts.append("## 原始邮件头\n\n" + "\n".join(head_lines))

    # 带 payload：按 RFC822 解析内嵌报文，提取正文，附件只列名。
    # 优先取原文切片（保留空行 = MIME part 头/体分隔）；块重建会把
    # part 头与 base64 体之间插入空行、毁掉 MIME 结构导致 base64 泄漏。
    # 原文头部不连续时（HTML 转写产物）退回块拼接（"\n" 连接，避免插空行）。
    if payload_blocks:
        raw_lines = (body or "").split("\n")
        raw_start = next(
            (i for i, l in enumerate(raw_lines) if _RFC822_HEADER_RE.match(l)), None
        )
        source = None
        if raw_start is not None:
            j = raw_start
            while j < len(raw_lines):
                l = raw_lines[j].rstrip("\r")
                if _RFC822_HEADER_RE.match(l) or l[:1] in (" ", "\t"):
                    j += 1
                else:
                    break
            # 停在空行或 EOF → 原文头部连续， verbatim 切片可用
            if j >= len(raw_lines) or not raw_lines[j].strip():
                source = "\n".join(raw_lines[raw_start:])
        if source is None:
            source = "\n".join(header_blocks) + "\n\n" + "\n".join(payload_blocks)
        texts, att_names = _extract_rfc822_content(source)
        if att_names:
            parts.append("原始邮件附件: " + ", ".join(att_names) + "（内容已省略）")
        if texts:
            embedded = "\n\n".join(texts)
            if len(embedded) > _EMBEDDED_BODY_MAX_CHARS:
                embedded = embedded[:_EMBEDDED_BODY_MAX_CHARS] + "\n\n[内容已截断]"
            parts.append("## 原始邮件正文\n\n" + embedded)
    return "\n\n".join(parts)


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
    """邮件正文 → Markdown（ADR-0005）：body_html 优先转写，退回纯文本。

    Outlook 系统报告类邮件（如"无效收件人"报告）的 body / body_html
    都是原始邮件头转储、无真实正文——先按纯文本形态识别并可读化重排；
    否则 HTML 转写只会原样搬运未解码的天书头部。
    """
    body = (email.get("body") or "").strip()
    html = (email.get("body_html") or "").strip()

    # 检测材料：body 优先，否则 html 剥标签后的纯文本
    plain_source = body
    if not plain_source and html:
        try:
            _, plain_source = _extract_html_structure(html)
            plain_source = plain_source.strip()
        except Exception as e:
            logger.debug("HTML body extraction failed: %s", e)
            plain_source = ""
    reformatted = _reformat_header_dump(plain_source)
    if reformatted is not None:
        return reformatted

    if html:
        md = email_html_to_md(html)
        if md:
            # 兜底：body 与剥标签文本都未命中时，再对转写结果检测一次
            # （HTML 内换行结构可能让剥标签文本丢失行首特征）
            return _reformat_header_dump(md) or md
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
    """收集 sidecar stderr（progress/warn），保留尾部供错误诊断。

    sidecar 的 ``progress:`` / ``done:`` 行提到 INFO——长时间 PST 解析中它是 sidecar
    唯一的进度信号，降级到 debug 会让用户完全看不到 sidecar 在干什么（"卡死"感来源之一）。
    """
    try:
        for raw in proc.stderr:
            line = raw.decode("utf-8", errors="replace").rstrip()
            if not line:
                continue
            if line.startswith(("progress:", "done:")):
                logger.info("pst-extract: %s", line)
            else:
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
    sub_progress_callback=None,
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

    processed = 0
    last_progress_log = time.monotonic()
    try:
        while True:
            email = await loop.run_in_executor(None, q.get)
            if email is None:
                break
            processed += 1
            now = time.monotonic()
            # 按计数或时间间隔（_PROGRESS_LOG_SECS）打进度：sidecar 慢或崩溃前可能很久
            # 不到 _PROGRESS_LOG_INTERVAL，纯按计数会长时间无日志 → 用户误判卡死。
            if processed % _PROGRESS_LOG_INTERVAL == 0 or now - last_progress_log > _PROGRESS_LOG_SECS:
                logger.info(
                    "pst-extract progress %s: %d emails (att ok=%d fail=%d)",
                    os.path.basename(pst_path), processed,
                    parsed_attachments, failed_attachments,
                )
                last_progress_log = now
                if sub_progress_callback:
                    try:
                        sub_progress_callback(processed)
                    except Exception:  # noqa: BLE001
                        logger.debug("sub_progress_callback error", exc_info=True)
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
                except asyncio.TimeoutError:
                    # 超时已在 _parse_attachment_text 记 warning，这里仅计数
                    failed_attachments += 1
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
            if trees:
                # sidecar 中途崩溃（如 go-pst panic / 资源耗尽）：已解析的邮件仍入库，
                # 不让一个崩溃的 sidecar 把整封 PST 的成果清零（部分成功优于 0 文档）；
                # 缺失邮件由增量索引下次补齐。
                logger.warning(
                    "pst-extract crashed (code %s) — returning %d partial email(s) "
                    "(att ok=%d fail=%d). tail: %s",
                    ret, len(trees), parsed_attachments, failed_attachments, tail,
                )
            else:
                raise RuntimeError(
                    f"pst-extract exited with code {ret}, 0 emails parsed: {tail}"
                )
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
