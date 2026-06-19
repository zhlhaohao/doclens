"""GET /api/preview —— 文件预览。

路径解析相对于 IndexManager.search_path，防止越权访问。
"""
import logging
import os
from pathlib import Path

from fastapi import APIRouter, Body, Depends, Query

from cortex.index_manager import IndexManager
from cortex.web_v2.api.errors import CortexAPIError
from cortex.web_v2.deps import get_index_manager
from cortex.web_v2.models.preview import (
    PreviewResponse,
    PreviewSaveRequest,
    PreviewSaveResponse,
)
from cortex.web_v2.preview_synthesizer import render_tree_to_md

router = APIRouter()

# 这些后缀的文件磁盘 utf-8 读取会出乱码；改为从 DB 合成 md 预览
BINARY_PREVIEW_EXTS = frozenset({
    ".pdf", ".docx",
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
    return PreviewResponse(
        path=rel_path,
        language="markdown",
        content=md_content,
        line_range=None,
        highlights=[],
        writable=False,  # 合成预览不可写
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
