"""GET /api/status -- 系统状态。"""
import os

from fastapi import APIRouter, Depends

from doclens.index_manager import IndexManager
from doclens.web_v2.deps import get_config, get_index_manager, get_watcher, sync_snapshot

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
    cfg = get_config()
    return {
        "indexed_docs": len(docs),
        "index_path": str(idx.index_path),
        "workdir": str(idx.search_path),
        "total_size_bytes": total_size,
        "file_types": type_counts,
        # 当前 AI 模型 id（用于前端展示「{model} 思考中」），可能为空
        # （用户未设置 PLANIFY_MODEL_ID 时不展示模型名前缀）
        "model_name": cfg.planify_model_id or "",
        "watcher": {
            "enabled": cfg.watch_enabled,
            **(watcher_obj.status() if watcher_obj is not None else {
                "running": False,
                "reindexing": False,
                "changed_count": 0,
                "last_reindex_at": None,
                "last_doc_count": None,
                "last_success": None,
            }),
        },
        # Git 同步快照（ADR-0006）；None = 同步循环未注册（配置关闭）
        "sync": sync_snapshot(),
    }
