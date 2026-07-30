"""GET /api/pst/* —— PST 邮件列表分页与附件下载。

路径解析相对于 IndexManager.search_path，与 preview.py 同一套越权校验。
"""
import logging
import os
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse

from doclens.index_manager import IndexManager
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.api.preview import _safe_resolve
from doclens.web_v2.deps import get_index_manager
from doclens.web_v2.models.pst import PstEmailItem, PstEmailListResponse
from treesearch.parsers.pst_attachment_store import PstAttachmentStore

router = APIRouter()
logger = logging.getLogger(__name__)

# 单页上限（防御性，前端固定 50/页）
_MAX_PAGE_SIZE = 200


def _validate_pst_path(base: Path, path: str) -> None:
    """PST 路径校验：必须 .pst 后缀且不越权。"""
    if not path.lower().endswith(".pst"):
        raise CortexAPIError(400, "NOT_A_PST", f"非 PST 文件: {path}")
    _safe_resolve(base, path)  # 越权校验，不通过则抛 FILE_NOT_FOUND


def _pst_store(idx: IndexManager) -> PstAttachmentStore:
    return PstAttachmentStore(Path(idx.index_path).parent / "pst_attachments")


@router.get("/pst/emails", response_model=PstEmailListResponse)
async def list_pst_emails(
    path: str = Query(..., description="PST 相对路径"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=_MAX_PAGE_SIZE),
    idx: IndexManager = Depends(get_index_manager),
):
    """分页列出一个 PST 的邮件（日期倒序，无日期排尾）。"""
    from treesearch.fts import FTS5Index

    base = Path(idx.search_path)
    _validate_pst_path(base, path)

    abs_pst = os.path.abspath(os.path.join(idx.search_path, path))
    fts = FTS5Index(db_path=idx.index_path)
    try:
        total, rows = fts.list_email_meta(abs_pst, offset=offset, limit=limit)
    finally:
        fts.close()

    if total == 0:
        raise CortexAPIError(
            status=404,
            code="NOT_INDEXED",
            detail=f"PST 未索引或无邮件元数据：{path}。请先执行 cortex index。",
        )

    return PstEmailListResponse(
        path=path,
        total=total,
        offset=offset,
        limit=limit,
        emails=[
            PstEmailItem(
                entry_id=r["entry_id"],
                subject=r["subject"],
                sender=r["sender"],
                date=r["date"],
                folder=r["folder"],
            )
            for r in rows
        ],
    )


@router.get("/pst/attachment")
async def download_pst_attachment(
    path: str = Query(..., description="PST 相对路径"),
    entry: str = Query(..., description="邮件 entry_id"),
    file: str = Query(..., description="落盘文件名（清单中的 filename）"),
    idx: IndexManager = Depends(get_index_manager),
):
    """以附件形式下载邮件附件（索引时落盘的原始字节）。"""
    base = Path(idx.search_path)
    _validate_pst_path(base, path)

    rel_posix = path.replace(os.sep, "/")
    resolved = _pst_store(idx).resolve(rel_posix, entry, file)
    if resolved is None:
        raise CortexAPIError(404, "ATTACHMENT_NOT_FOUND", f"附件不存在: {file}")
    return FileResponse(
        path=str(resolved),
        filename=file,
        media_type="application/octet-stream",
    )
