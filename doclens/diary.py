"""日记领域逻辑：年度 Markdown 的片段/成品小节读写（ADR-0007）。

纯文件操作模块，不依赖 FastAPI；web API 层（api/diary.py）与
DiaryWorker（diary_worker.py）共用。

存储结构：
    日记/
      2026.md                # 一年一个文件
      images/
        2026-08-01/          # 图片按日子目录
          183012-c3d4.webp   # 压缩后（1600px/q80），不保留原图

年度 md 结构：

    # 2026 日记

    ## 2026-08-01 星期六
    <!-- diary:raw -->

    - 09:15 文字片段 <!-- fid:091500-a1b2 -->
    - 18:30 ![备注](images/2026-08-01/183012-c3d4.webp) <!-- fid:183012-c3d4 -->

片段态 = 小节头部含 <!-- diary:raw -->；成品态 = 无标记（AI 已重写）。
状态即队列：raw 标记本身就是待总结信号，无需额外数据库表。
"""
from __future__ import annotations

import io
import re
import threading
import uuid
from dataclasses import dataclass, field
from datetime import date as date_type
from pathlib import Path

DIARY_DIRNAME = "日记"
RAW_MARKER = "<!-- diary:raw -->"

# 图片压缩参数（ADR-0007：不保留原图）
IMAGE_MAX_EDGE = 1600
IMAGE_WEBP_QUALITY = 80

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_HEADING_RE = re.compile(r"^## (\d{4}-\d{2}-\d{2})", re.M)
_FRAGMENT_RE = re.compile(
    r"(?ms)^- (\d{2}:\d{2}) (.*?)<!--\s*fid:([\w-]+)\s*-->[^\S\n]*$"
)
_IMAGE_RE = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)")

# 模块级写锁：API 并发写入与 Worker 重写小节互斥
_FILE_LOCK = threading.RLock()

_WEEKDAYS_CN = ("星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日")


@dataclass(frozen=True)
class Fragment:
    """一条片段：文字或图片（可带备注）。"""

    fid: str
    time: str  # HH:MM
    kind: str  # "text" | "photo"
    text: str  # 文字内容，或图片备注
    image: str | None = None  # 相对年度 md 的路径 images/<date>/<file>


@dataclass(frozen=True)
class DayEntry:
    """某一天的小节。state: raw（片段态）/ summarized（成品态）/ empty（无记录）。"""

    date: str
    state: str
    fragments: tuple[Fragment, ...] = ()
    content: str = ""  # summarized 时的成品正文


# ---------------------------------------------------------------- 路径与校验


def validate_date(date_str: str) -> None:
    """校验 YYYY-MM-DD 格式；非法抛 ValueError。"""
    if not _DATE_RE.match(date_str):
        raise ValueError(f"非法日期格式: {date_str!r}（应为 YYYY-MM-DD）")
    date_type.fromisoformat(date_str)  # 进一步校验 2 月 30 日之类


def diary_dir(workdir: Path) -> Path:
    return workdir / DIARY_DIRNAME


def year_path(workdir: Path, year: int) -> Path:
    return diary_dir(workdir) / f"{year}.md"


def image_dir(workdir: Path, date_str: str) -> Path:
    return diary_dir(workdir) / "images" / date_str


def new_fid(hhmmss: str) -> str:
    return f"{hhmmss}-{uuid.uuid4().hex[:4]}"


# ---------------------------------------------------------------- 文件读写


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _ensure_year_file(path: Path, year: int) -> str:
    if path.exists():
        return _read(path)
    return f"# {year} 日记\n"


def _find_section(content: str, date_str: str) -> tuple[int, int] | None:
    """返回 (小节内容起始, 小节结束) 的字符区间；无该日小节返回 None。

    小节 = 从 `## {date}` 标题行下一行起，到下一个 `## ` 标题或文件尾。
    """
    for m in _HEADING_RE.finditer(content):
        if m.group(1) == date_str:
            body_start = content.index("\n", m.start()) + 1
            nxt = _HEADING_RE.search(content, body_start)
            return (body_start, nxt.start() if nxt else len(content))
    return None


def _is_raw(section_body: str) -> bool:
    return RAW_MARKER in section_body


def _parse_fragments(section_body: str) -> tuple[Fragment, ...]:
    fragments: list[Fragment] = []
    for m in _FRAGMENT_RE.finditer(section_body):
        hhmm, fid = m.group(1), m.group(3)
        # 去掉写入时给续行加的两空格缩进
        payload = "\n".join(
            ln[2:] if ln.startswith("  ") else ln for ln in m.group(2).strip().split("\n")
        ).strip()
        img = _IMAGE_RE.match(payload)
        if img:
            caption = img.group(1).strip()
            fragments.append(
                Fragment(fid=fid, time=hhmm, kind="photo", text=caption, image=img.group(2))
            )
        else:
            fragments.append(Fragment(fid=fid, time=hhmm, kind="text", text=payload))
    return tuple(fragments)


def _drop_empty_raw_sections(content: str) -> str:
    """删除「零片段片段态」小节（标题 + raw 标记但无任何片段）。

    删光某天的片段后若留下空小节，find_pending_raw 会把它列入待总结队列，
    worker 就会对空内容发起 AI 调用。空小节没有信息，直接移除。
    """
    matches = list(_HEADING_RE.finditer(content))
    drop_spans: list[tuple[int, int]] = []
    for i, m in enumerate(matches):
        body_start = content.index("\n", m.start()) + 1
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        body = content[body_start:body_end]
        if _is_raw(body) and not _parse_fragments(body):
            drop_spans.append((m.start(), body_end))
    for start, end in reversed(drop_spans):
        content = content[:start] + content[end:]
    content = re.sub(r"\n{3,}", "\n\n", content)
    return content.rstrip("\n") + "\n"


def _weekday_cn(d: date_type) -> str:
    return _WEEKDAYS_CN[d.weekday()]


def _format_fragment_line(hhmm: str, payload: str, fid: str) -> str:
    """多行内容以两空格缩进续行（Markdown 列表续行，解析端正则兼容）。"""
    lines = payload.split("\n")
    first = f"- {hhmm} {lines[0]} <!-- fid:{fid} -->"
    if len(lines) == 1:
        return first
    # fid 注释须在该条片段的末行（解析正则以此定界），多行时把 fid 挪到末行
    body = "\n".join(["- " + hhmm + " " + lines[0]] + ["  " + ln for ln in lines[1:]])
    return body + f" <!-- fid:{fid} -->"


# ---------------------------------------------------------------- 公开操作


def get_day(workdir: Path, date_str: str) -> DayEntry:
    """读取某日小节。无文件/无小节 → empty。"""
    validate_date(date_str)
    path = year_path(workdir, int(date_str[:4]))
    if not path.exists():
        return DayEntry(date=date_str, state="empty")
    with _FILE_LOCK:
        content = _read(path)
    bounds = _find_section(content, date_str)
    if bounds is None:
        return DayEntry(date=date_str, state="empty")
    body = content[bounds[0] : bounds[1]].strip()
    if _is_raw(body):
        return DayEntry(date=date_str, state="raw", fragments=_parse_fragments(body))
    return DayEntry(date=date_str, state="summarized", content=body)


def append_text(workdir: Path, date_str: str, hhmm: str, hhmmss: str, text: str) -> Fragment:
    """追加文字片段。片段不存在的小节会自动创建并标记片段态。"""
    validate_date(date_str)
    if not text.strip():
        raise ValueError("片段内容为空")
    fid = new_fid(hhmmss)
    line = _format_fragment_line(hhmm, text.strip(), fid)
    with _FILE_LOCK:
        _append_line(workdir, date_str, line)
    return Fragment(fid=fid, time=hhmm, kind="text", text=text.strip())


def append_photo(
    workdir: Path, date_str: str, hhmm: str, hhmmss: str, rel_image: str, caption: str
) -> Fragment:
    """追加图片片段（图片文件须已落盘，见 save_photo）。"""
    validate_date(date_str)
    fid = new_fid(hhmmss)
    alt = caption.strip() or "照片"
    line = _format_fragment_line(hhmm, f"![{alt}]({rel_image})", fid)
    with _FILE_LOCK:
        _append_line(workdir, date_str, line)
    return Fragment(fid=fid, time=hhmm, kind="photo", text=alt, image=rel_image)


def _append_line(workdir: Path, date_str: str, line: str) -> None:
    year = int(date_str[:4])
    path = year_path(workdir, year)
    content = _ensure_year_file(path, year)
    bounds = _find_section(content, date_str)
    if bounds is None:
        d = date_type.fromisoformat(date_str)
        section = f"\n## {date_str} {_weekday_cn(d)}\n{RAW_MARKER}\n\n{line}\n"
        content = content.rstrip("\n") + "\n" + section
    else:
        body = content[bounds[0] : bounds[1]]
        insert_at = bounds[0] + len(body.rstrip("\n"))
        content = content[:insert_at] + "\n" + line + "\n" + content[insert_at:]
    _write(path, content)


def remove_fragment(workdir: Path, date_str: str, fid: str) -> bool:
    """按 fid 删除一条片段（含续行）。找不到返回 False。"""
    validate_date(date_str)
    path = year_path(workdir, int(date_str[:4]))
    if not path.exists():
        return False
    pattern = re.compile(
        r"(?ms)^- \d{2}:\d{2} .*?<!--\s*fid:" + re.escape(fid) + r"\s*-->[^\S\n]*$\n?"
    )
    with _FILE_LOCK:
        content = _read(path)
        new_content, n = pattern.subn("", content)
        if n == 0:
            return False
        # 清理删除后可能产生的连续空行
        new_content = re.sub(r"\n{3,}", "\n\n", new_content)
        # 删光片段后移除空小节，避免空 raw 小节进入待总结队列
        new_content = _drop_empty_raw_sections(new_content)
        _write(path, new_content)
    return True


def rewrite_day(workdir: Path, date_str: str, new_body: str) -> bool:
    """AI 总结：用成品正文整体替换当日小节（移除 raw 标记）。

    仅当小节仍处于片段态时才执行（防双设备/重入重复总结）；
    否则返回 False，调用方放弃本轮总结。
    """
    validate_date(date_str)
    path = year_path(workdir, int(date_str[:4]))
    if not path.exists():
        return False
    with _FILE_LOCK:
        content = _read(path)
        bounds = _find_section(content, date_str)
        if bounds is None:
            return False
        body = content[bounds[0] : bounds[1]]
        if not _is_raw(body):
            return False
        content = content[: bounds[0]] + "\n" + new_body.strip() + "\n\n" + content[bounds[1] :]
        content = re.sub(r"\n{3,}", "\n\n", content)
        _write(path, content)
    return True


def list_month_dates(workdir: Path, month: str) -> list[str]:
    """该月有内容（任意状态）的日期列表，升序。month 格式 YYYY-MM。"""
    if not re.match(r"^\d{4}-\d{2}$", month):
        raise ValueError(f"非法月份格式: {month!r}（应为 YYYY-MM）")
    path = year_path(workdir, int(month[:4]))
    if not path.exists():
        return []
    with _FILE_LOCK:
        content = _read(path)
    return sorted(m.group(1) for m in _HEADING_RE.finditer(content) if m.group(1).startswith(month))


def find_pending_raw(workdir: Path, today: date_type) -> list[str]:
    """扫描当年与去年文件，返回日期 < today 且仍为片段态的小节日期，升序。

    扫两个年度文件即覆盖全部待总结日：片段只可能来自 app 运行过的日子，
    跨年边界（12-31 的片段在 1-1 总结）由去年文件兜底。
    """
    pending: list[str] = []
    today_str = today.isoformat()
    for year in (today.year - 1, today.year):
        path = year_path(workdir, year)
        if not path.exists():
            continue
        with _FILE_LOCK:
            content = _read(path)
        for m in _HEADING_RE.finditer(content):
            date_str = m.group(1)
            if date_str >= today_str:
                continue
            body_start = content.index("\n", m.start()) + 1
            nxt = _HEADING_RE.search(content, body_start)
            body = content[body_start : nxt.start() if nxt else len(content)]
            # 零片段的空小节不总结（旧版本遗留 / 防御性判断）
            if _is_raw(body) and _parse_fragments(body):
                pending.append(date_str)
    return sorted(pending)


# ---------------------------------------------------------------- 图片


def compress_photo(data: bytes, max_edge: int = IMAGE_MAX_EDGE, quality: int = IMAGE_WEBP_QUALITY) -> bytes:
    """压缩照片：EXIF 方向校正 + 最长边缩放 + WebP。不保留原图（ADR-0007）。"""
    from PIL import Image, ImageOps

    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    img.thumbnail((max_edge, max_edge), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=quality)
    return buf.getvalue()


def save_photo(workdir: Path, date_str: str, hhmmss: str, data: bytes) -> str:
    """压缩并落盘照片，返回相对年度 md 的引用路径 images/<date>/<file>。"""
    validate_date(date_str)
    compressed = compress_photo(data)
    filename = f"{hhmmss}-{uuid.uuid4().hex[:4]}.webp"
    target_dir = image_dir(workdir, date_str)
    target_dir.mkdir(parents=True, exist_ok=True)
    (target_dir / filename).write_bytes(compressed)
    return f"images/{date_str}/{filename}"
