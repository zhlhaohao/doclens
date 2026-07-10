"""GET /api/watch/status -- 轻量文件监控状态（零文档遍历开销，供前端轮询）。"""
from fastapi import APIRouter

from doclens.web_v2.deps import get_config, get_watcher

router = APIRouter()


@router.get("/watch/status")
async def watch_status():
    enabled = get_config().watch_enabled
    watcher = get_watcher()
    return {
        "enabled": enabled,
        "watcher": watcher.status() if watcher is not None else None,
    }
