"""GET /api/status -- 系统状态。"""
from fastapi import APIRouter, Depends

from doclens.index_manager import IndexManager
from doclens.web_v2.deps import get_config, get_index_manager, get_watcher, sync_snapshot

router = APIRouter()


@router.get("/status")
async def status(idx: IndexManager = Depends(get_index_manager)):
    # DB 轻量查询 + 进程内缓存（ADR-0018）：50 万语料全量 stat 要 90s+，
    # 缓存键 = DB 文档计数，索引变化才重算。
    indexed_docs = idx.indexed_doc_count()
    total_size, type_counts = idx.file_stats()
    watcher_obj = get_watcher()
    cfg = get_config()
    return {
        "indexed_docs": indexed_docs,
        "index_failed_count": idx.last_failed_count,
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
        # vision 处理状态（工单 09）：队列计数 + write_back 失败计数
        "vision": idx.vision_status(),
    }
