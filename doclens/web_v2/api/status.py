"""GET /api/status -- 系统状态。"""
import os

from fastapi import APIRouter, Depends

from doclens.index_manager import IndexManager
from doclens.web_v2.deps import get_config, get_index_manager, get_watcher

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
    watcher_obj = get_watcher()
    return {
        "indexed_docs": len(docs),
        "index_path": str(idx.index_path),
        "total_size_bytes": total_size,
        "file_types": type_counts,
        "watcher": {
            "enabled": get_config().watch_enabled,
            **(watcher_obj.status() if watcher_obj is not None else {
                "running": False,
                "reindexing": False,
                "changed_count": 0,
                "last_reindex_at": None,
                "last_doc_count": None,
                "last_success": None,
            }),
        },
    }
