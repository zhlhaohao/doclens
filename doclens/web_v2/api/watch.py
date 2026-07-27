"""GET /api/watch/status -- 轻量文件监控状态（一次性读取）；
POST /api/watch/events -- SSE 事件流（替代前端轮询，状态变化实时下发）。
"""
import asyncio
import json
import logging

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from doclens.web_v2.deps import watch_snapshot
from doclens.web_v2.watch_broker import get_watch_broker

logger = logging.getLogger(__name__)
router = APIRouter()

# 长连接 keep-alive：无显式心跳时长连接会被代理/uvicorn 超时切断
_SSE_PING_SECONDS = 15


@router.get("/watch/status")
async def watch_status():
    """一次性状态读取（供 settings 等一次性场景 / SSE 降级 fallback）。"""
    return watch_snapshot()


@router.post("/watch/events")
async def watch_events():
    """SSE 推送 watch 状态变化：连接首推一份 status 快照（含近期变化历史），
    之后每次文件变化/reindex 开始/reindex 完成都广播 status；reindex 完成时
    额外推一个 reindexed 事件触发前端 toast。"""
    return EventSourceResponse(_watch_event_generator(get_watch_broker()), ping=_SSE_PING_SECONDS)


async def _watch_event_generator(broker):
    """SSE 事件生成器（抽出便于单测）：先订阅→首推 status 快照→转发 broker 广播。

    订阅在首推之前完成，避免「快照读取与订阅之间」的广播丢失。"""
    q = broker.subscribe()
    try:
        # 首推：当前态 + 近期变化历史，客户端一连接就有内容
        yield {"event": "status", "data": json.dumps(watch_snapshot(), ensure_ascii=False)}
        while True:
            # 无事件时阻塞；ping 保活，客户端断开时抛 CancelledError → finally 注销
            item = await q.get()
            yield {
                "event": item["event"],
                "data": json.dumps(item["data"], ensure_ascii=False),
            }
    except asyncio.CancelledError:
        raise
    finally:
        broker.unsubscribe(q)
