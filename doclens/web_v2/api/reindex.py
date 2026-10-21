"""POST /api/reindex —— 强制全量重建索引，SSE 流式返回进度。

重建在后台线程进行（`IndexManager.trigger_background_reindex`），本端点只是
一个观察窗口：**断流/超时不代表重建失败**（AP-48）。因此长时间无进度事件时
发 ``heartbeat`` 而非 ``error``，前端据此刻度判断「仍在进行」。
"""
import asyncio
import json
import logging
import os
import time

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from doclens.index_manager import IndexManager
from doclens.web_v2.deps import get_index_manager

logger = logging.getLogger(__name__)
router = APIRouter()

#: 静默多久发一次 heartbeat。原为 600s 超时且超时即判失败——大库重建（模块
#: 自述分钟级）常在进度间隙里被误报「重建失败」，而索引其实还在写（AP-48）。
_HEARTBEAT_SECONDS = 30.0


@router.post("/reindex")
async def force_reindex(idx: IndexManager = Depends(get_index_manager)):
    """启动 force=True 全量重建，SSE 推送 progress / heartbeat / done 事件。"""
    loop = asyncio.get_running_loop()
    q: asyncio.Queue = asyncio.Queue()
    started_at = time.monotonic()
    # 最近一次已索引计数（heartbeat 用；回调在重建线程，只读 int 无竞态风险）
    indexed_so_far = [0]

    def _emit(item: dict) -> None:
        """从重建线程投递事件（线程安全）。消费端已断开时静默丢弃。"""
        try:
            loop.call_soon_threadsafe(q.put_nowait, item)
        except RuntimeError as e:  # loop 已关闭（客户端早已断开 + 应用停机）
            logger.debug("reindex event dropped (loop gone?): %s", e)

    def on_progress(file_path: str, n: int):
        indexed_so_far[0] = n
        _emit({
            "event": "progress",
            "data": {
                "current_file": os.path.basename(file_path),
                "indexed_count": n,
                "sub_label": None,  # 文件完成，清空子进度
            },
        })

    def on_sub_progress(file_path: str, parsed_count: int, indexed_count: int):
        """流式 parser（如 PST）解析期间上报子进度（已解析邮件数）。"""
        _emit({
            "event": "progress",
            "data": {
                "current_file": os.path.basename(file_path),
                "indexed_count": indexed_count,
                "sub_label": f"已解析 {parsed_count} 封邮件",
            },
        })

    def on_complete(success: bool, doc_count: int, failed_count: int, indexed_files: int = 0):
        _emit({
            "event": "done",
            "data": {"success": success, "doc_count": doc_count, "failed_count": failed_count, "indexed_files": indexed_files},
        })

    idx.trigger_background_reindex(
        force=True, on_progress=on_progress, on_complete=on_complete,
        on_sub_progress=on_sub_progress,
    )

    async def event_stream():
        # 不用 run_in_executor(q.get)：wait_for 超时只会取消 future，阻塞在
        # 线程池里的 q.get 永远不返回——每超时一次泄漏一个执行器线程。
        while True:
            try:
                item = await asyncio.wait_for(q.get(), timeout=_HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                # 长时间无事件 ≠ 失败：重建仍在后台写库，只是这一段时间没有
                # 文件完成。发心跳让前端保持「进行中」，绝不发 error（AP-48）。
                yield {
                    "event": "heartbeat",
                    "data": json.dumps(
                        {
                            "indexed_count": indexed_so_far[0],
                            "elapsed_sec": int(time.monotonic() - started_at),
                        },
                        ensure_ascii=False,
                    ),
                }
                continue
            except asyncio.CancelledError:
                # 客户端断开（关弹窗 / 断网）：观察窗口结束，重建继续跑。
                logger.info("reindex SSE client disconnected; background job continues")
                raise
            yield {"event": item["event"], "data": json.dumps(item["data"], ensure_ascii=False)}
            if item["event"] in ("done", "error"):
                break

    return EventSourceResponse(event_stream())
