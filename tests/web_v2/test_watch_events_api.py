"""WatchBroker 单元测试 + watch SSE 事件生成器测试。

注：POST /api/watch/events 的 HTTP 流式响应在 httpx ASGITransport 下不便断言
（无限流），故端点的核心逻辑通过直接驱动 `_watch_event_generator` 验证；端点
本身的 200/content-type 由 GET 既有测试与 E2E 手测覆盖。
"""
import asyncio
import contextlib
import json as _json

import pytest

from doclens.web_v2.watch_broker import WatchBroker, get_watch_broker


@pytest.fixture
def reset_deps():
    from doclens.web_v2 import deps
    deps.reset_singletons()
    yield
    deps.reset_singletons()


# ----------------------------- WatchBroker 单测 -----------------------------

def test_broker_recent_changes_capped_at_max():
    """record_change 超过 _RECENT_MAX 时淘汰最旧（deque maxlen 行为）。"""
    b = WatchBroker()
    for i in range(40):
        b.record_change(f"p{i}.md", f"p{i}.md", float(i))
    changes = b.recent_changes()
    assert len(changes) == 30
    # 前 10 条被淘汰，最旧保留 p10，最新 p39
    assert changes[0]["path"] == "p10.md"
    assert changes[-1]["path"] == "p39.md"


@pytest.mark.asyncio
async def test_broker_broadcast_reaches_subscribers():
    """broadcast 经 call_soon_threadsafe 把事件投递到所有订阅队列。"""
    b = WatchBroker()
    b.bind(asyncio.get_running_loop())
    q1 = b.subscribe()
    q2 = b.subscribe()
    try:
        b.broadcast("status", {"enabled": True})
        item1 = await asyncio.wait_for(q1.get(), timeout=1.0)
        item2 = await asyncio.wait_for(q2.get(), timeout=1.0)
        assert item1["event"] == "status"
        assert item1["data"]["enabled"] is True
        assert item2 == item1
    finally:
        b.unsubscribe(q1)
        b.unsubscribe(q2)


@pytest.mark.asyncio
async def test_broker_unsubscribe_stops_delivery():
    """unsubscribe 后，broadcast 不再向该队列投递。"""
    b = WatchBroker()
    b.bind(asyncio.get_running_loop())
    q = b.subscribe()
    b.unsubscribe(q)
    b.broadcast("status", {"x": 1})
    # 让 loop 跑一会，确认没有入队
    await asyncio.sleep(0.05)
    assert q.empty()


@pytest.mark.asyncio
async def test_broker_broadcast_noop_without_loop():
    """未 bind loop 时 broadcast 静默返回（不抛错）。"""
    b = WatchBroker()
    q = b.subscribe()
    try:
        b.broadcast("status", {"x": 1})  # 不应抛异常
        await asyncio.sleep(0.02)
        assert q.empty()
    finally:
        b.unsubscribe(q)


# ----------------------------- SSE 事件生成器测试 -----------------------------

@pytest.mark.asyncio
async def test_watch_event_generator_initial_then_broadcast(
    env_cortex_config, reset_deps, temp_workdir
):
    """生成器：先订阅→首推 status 快照；之后 broker 广播的事件被转发。"""
    from doclens.web_v2.api.watch import _watch_event_generator

    broker = get_watch_broker()
    broker.bind(asyncio.get_running_loop())

    gen = _watch_event_generator(broker)
    try:
        # 1. 首推 status 快照（含 watcher + recent_changes）
        first = await asyncio.wait_for(gen.__anext__(), timeout=2.0)
        assert first["event"] == "status"
        payload = _json.loads(first["data"])
        assert "watcher" in payload
        assert "recent_changes" in payload

        # 2. 广播 reindexed，生成器应转发
        broker.broadcast("reindexed", {
            "success": True, "doc_count": 7, "failed_count": 0,
        })
        second = await asyncio.wait_for(gen.__anext__(), timeout=2.0)
        assert second["event"] == "reindexed"
        assert _json.loads(second["data"])["doc_count"] == 7
    finally:
        # 关闭生成器：触发 finally → unsubscribe，避免队列泄漏
        with contextlib.suppress(StopAsyncIteration, RuntimeError):
            await gen.aclose()
