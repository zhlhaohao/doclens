"""GET /api/preview —— 文件预览。

路径解析相对于 IndexManager.search_path，防止越权访问。
"""
import hashlib
import logging
import os
import re
from pathlib import Path

from fastapi import APIRouter, Body, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse

from doclens.config import data_dirname
from doclens.index_manager import IndexManager
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.deps import get_index_manager
from treesearch.parsers.image_store import ImageStore, doc_hash_for, _EXT_TO_MEDIA
from treesearch.parsers.image_parser import IMAGE_EXTENSIONS
from doclens.web_v2.models.preview import (
    PreviewResponse,
    PreviewSaveRequest,
    PreviewSaveResponse,
    PreviewUploadResponse,
)
from doclens.web_v2.preview_synthesizer import render_tree_to_md

router = APIRouter()

# 这些后缀的文件磁盘 utf-8 读取会出乱码；改为从 DB 合成 md 预览
# （.mhtml/.mht 是 MIME 打包文本，原始预览无意义，同样走合成）
BINARY_PREVIEW_EXTS = frozenset({
    ".pdf", ".docx", ".pptx",
    ".xlsx", ".xlsm", ".xltx", ".xltm",
    ".csv", ".mhtml", ".mht",
}) | IMAGE_EXTENSIONS


def _compute_writable(full: Path, search_path: Path) -> bool:
    """判断文件是否可在 PUT /api/preview 中写入。

    用于 GET（响应 writable 字段）和 PUT（写前检查），保持两端判断一致。
    """
    if not full.exists() or not full.is_file():
        return False
    if full.suffix.lower() in BINARY_PREVIEW_EXTS:
        return False
    # PST 物理文件：预览是合成的邮件目录页，写回会毁掉 GB 级二进制
    if full.suffix.lower() == ".pst":
        return False
    # 数据目录内部不让用户改索引（开发 .cortex / 发行版 .doclens）
    try:
        full.relative_to(search_path / data_dirname())
        return False
    except ValueError:
        pass
    return os.access(full, os.W_OK)

_LANGUAGE_MAP = {
    ".py": "python", ".md": "markdown", ".txt": "text",
    ".js": "javascript", ".ts": "typescript", ".tsx": "tsx",
    ".html": "html", ".css": "css", ".json": "json",
    ".go": "go", ".rs": "rust", ".java": "java",
    ".c": "c", ".cpp": "cpp",
}


def _safe_resolve(base: Path, requested: str) -> Path:
    """安全解析路径，禁止 .. 越权。"""
    base_abs = base.resolve()
    candidate = (base_abs / requested).resolve()
    try:
        candidate.relative_to(base_abs)
    except ValueError:
        raise CortexAPIError(404, "FILE_NOT_FOUND", "路径越权")
    return candidate


def _resolve_path(base: Path, requested: str, idx: IndexManager) -> tuple[Path, str]:
    """解析文档路径：先直接拼（相对 workdir），失败则用 path_map 按文件名/endswith 反查。

    AI 偶发只给文件名（如 ``深海生物新物种发现.md``，无目录前缀），直接拼 workdir 找不到；
    path_map 的 mapped_path 是绝对路径，endswith(filename) 可反查出完整相对路径。

    Returns:
        (full_path, resolved_rel_path) —— full_path 是绝对路径，resolved_rel_path 是
        相对 workdir 的路径（用于二进制合成等下游）；若直接拼就命中，resolved_rel_path=requested。
    """
    candidate = _safe_resolve(base, requested)
    if candidate.exists() and candidate.is_file():
        return candidate, requested
    rel = _lookup_rel_via_path_map(base, requested, idx)
    if rel is not None:
        full = _safe_resolve(base, rel)
        if full.exists() and full.is_file():
            return full, rel
    raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {requested}")


def _lookup_rel_via_path_map(base: Path, requested: str, idx: IndexManager) -> str | None:
    """用 path_map 按文件名/endswith 反查相对 workdir 的路径（不检查文件存在）。

    用于：纯文件名（无目录）→ 反查完整相对路径；binary 文件可能不在磁盘但已在 DB 索引，
    不能用存在性判断，所以本函数只反查路径。
    """
    for mapped in idx.path_map.values():
        if mapped == requested or mapped.endswith("/" + requested) \
                or mapped.endswith("\\" + requested) or mapped.endswith(requested):
            try:
                return str(Path(mapped).resolve().relative_to(base.resolve())).replace("\\", "/")
            except ValueError:
                return requested
    return None


def _build_download_filename(rel_path: str, full: Path) -> str:
    """下载文件名 = 原始文件名 + '_' + sha256(rel_path)[:6] + 后缀。"""
    h = hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:6]
    return f"{full.stem}_{h}{full.suffix}"


@router.get("/preview/download")
async def download(
    path: str = Query(..., description="相对路径"),
    idx: IndexManager = Depends(get_index_manager),
):
    """以附件形式下载原始文件，文件名带相对路径 hash 防冲突。"""
    base = Path(idx.search_path)
    full, resolved_rel = _resolve_path(base, path, idx)
    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {path}")
    download_name = _build_download_filename(resolved_rel, full)
    return FileResponse(
        path=str(full),
        filename=download_name,
        media_type="application/octet-stream",
    )


@router.get("/preview/asset")
async def preview_asset(
    path: str = Query(..., description="文档相对路径"),
    id: int = Query(..., ge=1, description="图片序号（1-indexed）"),
    idx: IndexManager = Depends(get_index_manager),
):
    """返回文档内某张图片的字节流。

    path 经越权校验（必须在 search_path 内）；图片从
    ``<index_path>.parent/images/<doc_hash>/<seq>.<ext>`` 读取。
    """
    base = Path(idx.search_path)
    _safe_resolve(base, path)  # 越权校验，不通过则抛 FILE_NOT_FOUND

    images_root = Path(idx.index_path).parent / "images"
    store = ImageStore(images_root)
    resolved = store.resolve(doc_hash_for(path), id)
    if resolved is None:
        raise CortexAPIError(404, "IMAGE_NOT_FOUND", f"图片不存在: {path} #{id}")
    file_path, media_type = resolved
    return FileResponse(path=str(file_path), media_type=media_type)


@router.get("/preview/raw")
async def preview_raw(
    path: str = Query(..., description="图像文件相对路径"),
    idx: IndexManager = Depends(get_index_manager),
):
    """直接返回独立图像文件的字节流（供图像预览顶部嵌入原图）。

    仅限图像扩展名（IMAGE_EXTENSIONS）；path 经越权校验。
    """
    base = Path(idx.search_path)
    full, _resolved_rel = _resolve_path(base, path, idx)
    ext = full.suffix.lower()
    if ext not in IMAGE_EXTENSIONS:
        raise CortexAPIError(400, "NOT_AN_IMAGE", f"非图像文件: {path}")
    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {path}")
    media_type = _EXT_TO_MEDIA.get(ext.lstrip("."), "application/octet-stream")
    return FileResponse(path=str(full), media_type=media_type)


@router.get("/preview", response_model=PreviewResponse)
async def preview(
    path: str = Query(..., description="相对路径"),
    start_line: int = Query(default=0, ge=0),
    end_line: int = Query(default=0, ge=0),
    idx: IndexManager = Depends(get_index_manager),
):
    base = Path(idx.search_path)
    # PST 派生路径（"<pst>#<entry_id>"，非真实文件）：直接从 DB 合成 md，
    # 并附附件清单（含下载 URL，ADR-0003）
    if "#" in path and path.split("#", 1)[0].lower().endswith(".pst"):
        resp = _synthesize_binary_preview(idx, path)
        atts = _pst_email_attachments(idx, path)
        if atts is not None:
            resp = resp.model_copy(update={"attachments": atts})
        return resp
    # PST 物理文件：GB 级二进制，绝不能 read_text（会把事件循环拖死）——
    # 合成邮件目录页（总数 + 前 N 封主题列表）
    if path.lower().endswith(".pst"):
        return _synthesize_pst_overview(idx, path)
    # 二进制文档：走 DB 合成 md 路径（不能依赖磁盘存在性——可能已索引但文件移走；
    # 也不能直接 _resolve_path 因为它对不存在文件抛 FILE_NOT_FOUND，绕过 NOT_INDEXED 语义）
    if path.lower().endswith(tuple(BINARY_PREVIEW_EXTS)):
        candidate = _safe_resolve(base, path)
        if candidate.exists() and candidate.is_file():
            return _synthesize_binary_preview(idx, path)
        rel = _lookup_rel_via_path_map(base, path, idx)
        if rel is not None:
            return _synthesize_binary_preview(idx, rel)
        # 既不在磁盘也不在 path_map → 走合成（合成内部查 DB，未索引返回 NOT_INDEXED）
        return _synthesize_binary_preview(idx, path)

    full, resolved_rel = _resolve_path(base, path, idx)

    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {path}")

    try:
        text = full.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        raise CortexAPIError(500, "INTERNAL_ERROR", f"读取失败: {e}") from e

    lines = text.split("\n")
    if start_line > 0 or end_line > 0:
        s = max(0, start_line - 1)
        e = end_line if end_line > 0 else len(lines)
        content = "\n".join(lines[s:e])
        line_range = (s + 1, e)
    else:
        content = text
        line_range = None

    return PreviewResponse(
        path=resolved_rel,
        language=_LANGUAGE_MAP.get(full.suffix.lower(), "text"),
        content=content,
        line_range=line_range,
        highlights=[],
        writable=_compute_writable(full, base),
    )


# PST 目录页列出的邮件主题上限（超出只显示总数）
_PST_OVERVIEW_LIST_LIMIT = 200


def _pst_email_attachments(idx: IndexManager, derived_path: str):
    """取 PST 派生邮件（<pst_rel>#<entry_id>）的附件清单，附下载 URL。

    Returns:
        list[PstAttachmentInfo]；pst_email_meta 无记录（旧索引）返回 None。
    """
    from urllib.parse import quote

    from doclens.web_v2.models.pst import PstAttachmentInfo
    from treesearch.fts import FTS5Index

    pst_rel, sep, entry_id = derived_path.partition("#")
    if not sep:
        return None
    abs_pst = os.path.abspath(os.path.join(idx.search_path, pst_rel))
    fts = FTS5Index(db_path=idx.index_path)
    try:
        atts = fts.get_email_attachments_by_entry(abs_pst, entry_id)
    finally:
        fts.close()
    if atts is None:
        return None

    out = []
    for a in atts:
        stored = bool(a.get("stored")) and bool(a.get("filename"))
        url = None
        if stored:
            url = (
                f"/api/pst/attachment?path={quote(pst_rel, safe='')}"
                f"&entry={quote(entry_id, safe='')}"
                f"&file={quote(a['filename'], safe='')}"
            )
        out.append(PstAttachmentInfo(
            name=a.get("name") or "unnamed",
            size=a.get("size") or 0,
            stored=stored,
            download_url=url,
        ))
    return out

# MAPI 主题可能带 \x01 等控制字符（go-pst 原样返回），展示前清除
_SUBJECT_CONTROL_CHARS = re.compile(r"[\x00-\x1f]")


def _clean_subject(name: str) -> str:
    cleaned = _SUBJECT_CONTROL_CHARS.sub("", name or "").strip()
    return cleaned or "(无主题)"


def _synthesize_pst_overview(idx: IndexManager, rel_path: str) -> PreviewResponse:
    """PST 物理文件的预览：合成邮件目录页（总数 + 前 N 封主题）。"""
    from treesearch.fts import FTS5Index

    abs_path = os.path.abspath(os.path.join(idx.search_path, rel_path))
    prefix = abs_path + "#"
    fts = FTS5Index(db_path=idx.index_path)
    try:
        total = fts.count_docs_with_source_prefix(prefix)
        names = fts.list_doc_names_by_source_prefix(prefix, _PST_OVERVIEW_LIST_LIMIT)
    finally:
        fts.close()

    if total == 0:
        raise CortexAPIError(
            status=404,
            code="NOT_INDEXED",
            detail=f"文件未索引，无法预览：{rel_path}。请先执行 cortex index。",
        )

    name = os.path.basename(rel_path)
    lines = [
        f"# {name}",
        "",
        f"Outlook 邮件数据文件，共 **{total}** 封邮件已索引。",
        "",
        "每封邮件是独立文档（路径形如 `<文件名>#<邮件ID>`），"
        "可直接搜索发件人、主题、正文与白名单附件内容。",
        "",
    ]
    if names:
        shown = len(names)
        heading = f"## 邮件主题（前 {shown} 封）" if total > shown else "## 邮件主题"
        lines.append(heading)
        lines.append("")
        lines.extend(f"- {_clean_subject(n)}" for n in names)

    return PreviewResponse(
        path=rel_path,
        language="markdown",
        content="\n".join(lines),
        line_range=None,
        highlights=[],
        writable=False,
    )


def _synthesize_binary_preview(idx: IndexManager, rel_path: str) -> PreviewResponse:
    """从 DB 读 structure_json → 合成 md → 返回 language=markdown。"""
    from treesearch.fts import FTS5Index

    abs_path = os.path.abspath(os.path.join(idx.search_path, rel_path))
    fts = FTS5Index(db_path=idx.index_path)
    try:
        doc = fts.load_document_by_source_path(abs_path)
        # 防御性双查：部分历史索引可能用相对路径存
        if doc is None:
            doc = fts.load_document_by_source_path(rel_path)
    finally:
        fts.close()

    if doc is None:
        raise CortexAPIError(
            status=404,
            code="NOT_INDEXED",
            detail=f"文件未索引，无法预览：{rel_path}。请先执行 cortex index。",
        )

    md_content, line_map = render_tree_to_md(doc.structure, doc.source_type)
    pages, cleaned_md = _extract_pages(doc.structure, doc.source_type, md_content)
    # 图像文件：顶部嵌入原图（经 /api/preview/raw 服务源文件），下方为视觉解析结果
    if doc.source_type == "image":
        from urllib.parse import quote

        raw_url = f"/api/preview/raw?path={quote(rel_path, safe='')}"
        cleaned_md = f"![原图]({raw_url})\n\n{cleaned_md}"
    # pdf 分支 _extract_pdf_pages 会剥除 [PAGE N] 标记并重排行号，
    # 导致 line_map（基于原始 md 行号）失真；此时丢弃映射，避免误导。
    # docx/xlsx/csv 分支 cleaned_md == md_content，line_map 仍然有效。
    final_line_map = None if doc.source_type == "pdf" else {
        str(k): v for k, v in line_map.items()
    }
    return PreviewResponse(
        path=rel_path,
        language="markdown",
        content=cleaned_md,
        line_range=None,
        highlights=[],
        writable=False,  # 合成预览不可写
        pages=pages,
        line_map=final_line_map,
    )


# 5MB 上限（防御性，避免 OOM）
_MAX_SAVE_BYTES = 5 * 1024 * 1024


@router.put("/preview", response_model=PreviewSaveResponse)
async def save_preview(
    path: str = Query(..., description="相对路径"),
    body: PreviewSaveRequest = Body(...),
    idx: IndexManager = Depends(get_index_manager),
):
    base = Path(idx.search_path)
    full = _safe_resolve(base, path)

    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {path}")
    if not _compute_writable(full, base):
        raise CortexAPIError(403, "NOT_WRITABLE", f"该文件不可编辑: {path}")

    encoded = body.content.encode("utf-8")
    if len(encoded) > _MAX_SAVE_BYTES:
        raise CortexAPIError(413, "CONTENT_TOO_LARGE", f"content 超过 {_MAX_SAVE_BYTES // 1024 // 1024}MB 上限")

    try:
        full.write_bytes(encoded)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"写入失败: {e}") from e

    # 触发后台增量重索引（不阻塞响应）
    try:
        idx.trigger_background_reindex()
    except Exception as e:
        # 索引失败不阻断保存成功
        logging.getLogger(__name__).warning("Save reindex failed: %s", e)

    return PreviewSaveResponse(
        path=path,
        content=body.content,
        bytes_written=len(encoded),
        reindex_triggered=True,
    )


_UPLOAD_FILENAME_RE = re.compile(
    # 可选的 " (N)" 容忍浏览器下载去重后缀（Chrome/Edge: file (1).ext）
    r"^(?P<stem>.+)_(?P<hash>[a-f0-9]{6})(?: \(\d+\))?(?P<suffix>\.[^./\\]+)$"
)


# PDF [PAGE N] 标记正则（与 treesearch.parsers.pdf_parser._RE_PAGE_MARKER 同模式，
# 但本模块内独立定义避免跨模块耦合）
_RE_PDF_PAGE_MARKER = re.compile(r"^\[PAGE\s+(\d+)\]$")


def _extract_pages(
    structure: list,
    source_type: str,
    md_content: str,
):
    """从合成 md + structure 抽取分页信息。

    Args:
        structure: treesearch Document.structure（root 节点列表）
        source_type: Document.source_type（"pdf" / "pptx" / "excel" / ...）
        md_content: render_tree_to_md 的输出

    Returns:
        (pages, cleaned_md):
        - pages: list[PageMarker] 或 None（不支持的类型或空 structure）
        - cleaned_md: pdf 分支为剥除 [PAGE N] 后的 md；其他分支原样返回 md_content
    """
    if source_type == "pdf":
        return _extract_pdf_pages(md_content)
    if source_type == "pptx":
        return _extract_pptx_pages(structure), md_content
    if source_type == "excel":
        return _extract_excel_pages(structure), md_content
    return None, md_content


def _extract_pptx_pages(structure: list):
    """PPTX: 返回 pages 或 None。content 由 _extract_pages 原样返回。"""
    from doclens.web_v2.models.preview import PageMarker

    root = structure[0] if structure else None
    slides = (root.get("nodes", []) if root else []) or []
    if not slides:
        return None

    pages = []
    for i, slide in enumerate(slides):
        title = (slide.get("title") or "").strip()
        label = f"幻灯片 {i + 1}" + (f" · {title}" if title else "")
        line_start = slide.get("line_start") or 1
        pages.append(PageMarker(label=label, line_start=line_start))
    return pages


_RE_XLSX_ROW_SUFFIX = re.compile(r"\s*\(\d+\s*rows?\)\s*$")


def _extract_excel_pages(structure: list):
    """Excel: 返回 pages 或 None。content 由 _extract_pages 原样返回。"""
    from doclens.web_v2.models.preview import PageMarker

    if not structure:
        return None

    pages = []
    for i, sheet in enumerate(structure):
        # excel_parser 把 title 存为 "{sheet_name} ({row_count} rows)"；
        # 卡片标签只需要 sheet 名，剥掉行数后缀。
        name = _RE_XLSX_ROW_SUFFIX.sub("", (sheet.get("title") or "")).strip()
        label = f"工作表 {i + 1}" + (f" · {name}" if name else "")
        line_start = sheet.get("line_start") or 1
        pages.append(PageMarker(label=label, line_start=line_start))
    return pages


def _extract_pdf_pages(md_content: str):
    """PDF 分支：剥除 [PAGE N] 标记 + 按 counter 生成 pages。"""
    from doclens.web_v2.models.preview import PageMarker

    pages: list = []
    cleaned_lines: list[str] = []

    for line in md_content.split("\n"):
        if _RE_PDF_PAGE_MARKER.match(line.strip()):
            if not pages:
                # 第一个 marker → page 1 起始 = cleaned-line 1
                pages.append(PageMarker(label="第 1 页", line_start=1))
            else:
                # 后续 marker → page N 起始 = 下一 cleaned-line
                pages.append(
                    PageMarker(
                        label=f"第 {len(pages) + 1} 页",
                        line_start=len(cleaned_lines) + 1,
                    )
                )
            # 不写入 cleaned_lines
        else:
            cleaned_lines.append(line)

    if not pages:
        # 无 marker → 整篇当一页
        pages = [PageMarker(label="第 1 页", line_start=1)]

    return pages, "\n".join(cleaned_lines)


def _parse_upload_filename(filename: str):
    """解析上传文件名 → (stem, hash6, suffix)。

    格式：{stem}_{hash6}[ (N)]{suffix}，其中 hash6 必须是 6 位小写十六进制。
    可选的 " (N)" 是浏览器下载重名时自动添加的去重后缀，解析时容忍并忽略。

    Returns:
        (stem, hash6, suffix) 元组；不匹配返回 None。
    """
    m = _UPLOAD_FILENAME_RE.match(filename)
    if not m:
        return None
    return (m.group("stem"), m.group("hash"), m.group("suffix"))


class _HashCollisionError(Exception):
    """多个索引文档命中同一 (stem, hash6) 时抛出。"""


def _resolve_upload_target(idx, stem: str, hash6: str):
    """遍历索引文档，按 (stem, sha256(rel_path)[:6]) 双因素匹配。

    - IndexManager.documents[*].metadata["source_path"] 存的是绝对路径，
      需先转相对 search_path 的 POSIX 路径再算 hash
    - 命中 0 → None
    - 命中 1 → 相对路径字符串
    - 命中 ≥2 → raise _HashCollisionError
    """
    base = Path(idx.search_path)
    matches = []
    for doc in idx.documents:
        abs_path = doc.metadata.get("source_path", "")
        if not abs_path:
            continue
        try:
            rel = os.path.relpath(abs_path, base).replace(os.sep, "/")
        except ValueError:
            # Windows 跨盘符 relpath 会抛 ValueError
            continue
        if Path(rel).stem != stem:
            continue
        h = hashlib.sha256(rel.encode("utf-8")).hexdigest()[:6]
        if h == hash6:
            matches.append(rel)
    if len(matches) == 0:
        return None
    if len(matches) > 1:
        raise _HashCollisionError(
            f"hash+stem 命中多个文件：{matches}"
        )
    return matches[0]


# 50MB 上限（防御性，避免 OOM；允许二进制大文件）
_MAX_UPLOAD_BYTES = 50 * 1024 * 1024


@router.post("/preview/upload", response_model=PreviewUploadResponse)
async def upload(
    file: UploadFile = File(..., description="要上传的文件"),
    idx: IndexManager = Depends(get_index_manager),
):
    """上传文件，按文件名 hash 反查目标路径并覆盖原文件。"""
    # 1. 解析文件名
    parsed = _parse_upload_filename(file.filename or "")
    if parsed is None:
        raise CortexAPIError(
            400, "BAD_FILENAME",
            "文件名不符合 {stem}_{hash6}{suffix} 格式",
        )
    stem, hash6, _suffix = parsed

    # 2. 反查目标相对路径
    try:
        rel = _resolve_upload_target(idx, stem, hash6)
    except _HashCollisionError as e:
        raise CortexAPIError(409, "HASH_COLLISION", str(e)) from e
    if rel is None:
        raise CortexAPIError(
            404, "NOT_INDEXED",
            f"hash+stem 在索引中找不到匹配：{file.filename}",
        )

    # 3. 越权与可写性检查
    base = Path(idx.search_path)
    full = _safe_resolve(base, rel)
    # 显式拒绝数据目录子目录（开发 .cortex / 发行版 .doclens）
    try:
        full.relative_to(base / data_dirname())
        raise CortexAPIError(403, "NOT_WRITABLE", "禁止覆盖索引元数据")
    except ValueError:
        pass

    # 4. 读字节 + 大小检查
    data = await file.read(_MAX_UPLOAD_BYTES + 1)
    if len(data) > _MAX_UPLOAD_BYTES:
        raise CortexAPIError(
            413, "CONTENT_TOO_LARGE",
            f"文件超过 {_MAX_UPLOAD_BYTES // 1024 // 1024}MB 上限",
        )

    # 5. 写盘
    try:
        full.write_bytes(data)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"写入失败: {e}") from e

    # 6. 触发后台重索引（不阻塞响应）
    try:
        idx.trigger_background_reindex()
    except Exception as e:
        logging.getLogger(__name__).warning("Upload reindex failed: %s", e)

    return PreviewUploadResponse(
        path=rel,
        bytes_written=len(data),
        reindex_triggered=True,
    )
