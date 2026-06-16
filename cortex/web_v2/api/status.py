"""GET /api/status -- 系统状态。"""
import os

from fastapi import APIRouter, Depends

from cortex.index_manager import IndexManager
from cortex.web_v2.deps import get_index_manager

router = APIRouter()


@router.get("/status")
async def status(idx: IndexManager = Depends(get_index_manager)):
    docs = idx.documents or []
    total_size = 0
    type_counts: dict[str, int] = {}
    for doc in docs:
        meta = getattr(doc, "metadata", None) or {}
        src = meta.get("source_path", "")
        # file_size is not populated by treesearch; compute at query time.
        try:
            size = os.path.getsize(src) if src else 0
        except OSError:
            size = 0
        total_size += size
        ext = os.path.splitext(src)[1].lower() if src else ""
        if ext:
            type_counts[ext] = type_counts.get(ext, 0) + 1
    return {
        "indexed_docs": len(docs),
        "index_path": str(idx.index_path),
        "total_size_bytes": total_size,
        "file_types": type_counts,
    }
