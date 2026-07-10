"""POST /api/reindex —— 强制全量重建索引，SSE 流式返回进度。"""
import asyncio
import json
import logging
import os
import queue as _queue

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from doclens.index_manager import IndexManager
from doclens.web_v2.deps import get_index_manager

logger = logging.getLogger(__name__)
router = APIRouter()

_SSE_TIMEOUT_SECONDS = 600


@router.post("/reindex")
async def force_reindex(idx: IndexManager = Depends(get_index_manager)):
    """启动 force=True 全量重建，SSE 推送 progress / done / error 事件。"""
    q: _queue.Queue = _queue.Queue()
    loop = asyncio.get_event_loop()

    def on_progress(file_path: str, n: int):
        q.put_nowait({
            "event": "progress",
            "data": {"current_file": os.path.basename(file_path), "indexed_count": n},
        })

    def on_complete(success: bool, doc_count: int, failed_count: int):
        q.put_nowait({
            "event": "done",
            "data": {"success": success, "doc_count": doc_count, "failed_count": failed_count},
        })

    idx.trigger_background_reindex(force=True, on_progress=on_progress, on_complete=on_complete)

    async def event_stream():
        while True:
            try:
                item = await asyncio.wait_for(
                    loop.run_in_executor(None, q.get), timeout=_SSE_TIMEOUT_SECONDS
                )
            except asyncio.TimeoutError:
                yield {"event": "error", "data": json.dumps({"detail": "timeout"}, ensure_ascii=False)}
                break
            yield {"event": item["event"], "data": json.dumps(item["data"], ensure_ascii=False)}
            if item["event"] in ("done", "error"):
                break

    return EventSourceResponse(event_stream())
