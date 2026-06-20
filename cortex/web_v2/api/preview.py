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

from cortex.index_manager import IndexManager
from cortex.web_v2.api.errors import CortexAPIError
from cortex.web_v2.deps import get_index_manager
from cortex.web_v2.models.preview import (
    PreviewResponse,
    PreviewSaveRequest,
    PreviewSaveResponse,
    PreviewUploadResponse,
)
from cortex.web_v2.preview_synthesizer import render_tree_to_md

router = APIRouter()

# 这些后缀的文件磁盘 utf-8 读取会出乱码；改为从 DB 合成 md 预览
BINARY_PREVIEW_EXTS = frozenset({
    ".pdf", ".docx", ".pptx",
    ".xlsx", ".xlsm", ".xltx", ".xltm",
    ".csv",
})


def _compute_writable(full: Path, search_path: Path) -> bool:
    """判断文件是否可在 PUT /api/preview 中写入。

    用于 GET（响应 writable 字段）和 PUT（写前检查），保持两端判断一致。
    """
    if not full.exists() or not full.is_file():
        return False
    if full.suffix.lower() in BINARY_PREVIEW_EXTS:
        return False
    # .cortex/ 内部不让用户改索引
    try:
        full.relative_to(search_path / ".cortex")
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
    full = _safe_resolve(base, path)
    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {path}")
    download_name = _build_download_filename(path, full)
    return FileResponse(
        path=str(full),
        filename=download_name,
        media_type="application/octet-stream",
    )


@router.get("/preview", response_model=PreviewResponse)
async def preview(
    path: str = Query(..., description="相对路径"),
    start_line: int = Query(default=0, ge=0),
    end_line: int = Query(default=0, ge=0),
    idx: IndexManager = Depends(get_index_manager),
):
    base = Path(idx.search_path)
    full = _safe_resolve(base, path)

    # 二进制文档：走 DB 合成 md 路径
    if full.suffix.lower() in BINARY_PREVIEW_EXTS:
        return _synthesize_binary_preview(idx, path)

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
        path=path,
        language=_LANGUAGE_MAP.get(full.suffix.lower(), "text"),
        content=content,
        line_range=line_range,
        highlights=[],
        writable=_compute_writable(full, base),
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

    md_content = render_tree_to_md(doc.structure, doc.source_type)
    pages, cleaned_md = _extract_pages(doc.structure, doc.source_type, md_content)
    return PreviewResponse(
        path=rel_path,
        language="markdown",
        content=cleaned_md,
        line_range=None,
        highlights=[],
        writable=False,  # 合成预览不可写
        pages=pages,
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
    from cortex.web_v2.models.preview import PageMarker

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


def _extract_excel_pages(structure: list):
    """Excel: 返回 pages 或 None。content 由 _extract_pages 原样返回。"""
    from cortex.web_v2.models.preview import PageMarker

    if not structure:
        return None

    pages = []
    for i, sheet in enumerate(structure):
        name = (sheet.get("title") or "").strip()
        label = f"工作表 {i + 1}" + (f" · {name}" if name else "")
        line_start = sheet.get("line_start") or 1
        pages.append(PageMarker(label=label, line_start=line_start))
    return pages


def _extract_pdf_pages(md_content: str):
    """PDF 分支：剥除 [PAGE N] 标记 + 按 counter 生成 pages。"""
    from cortex.web_v2.models.preview import PageMarker

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
    # 显式拒绝 .cortex/ 子目录
    try:
        full.relative_to(base / ".cortex")
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
