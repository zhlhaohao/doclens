"""TeamEventBus（planify/team/events.py，ADR-0060 §3）。

Bot 线程 publish → asyncio 侧扇出；text_delta 50ms 合并由 asyncio task 驱动；
队列满丢最旧；unbind 清订阅者。
"""

import asyncio

import pytest

from planify.team.events import TeamEventBus


@pytest.mark.asyncio
async def test_non_text_events_delivered():
    bus = TeamEventBus()
    bus.bind(asyncio.get_running_loop())
    q = bus.subscribe("S1", "alice")
    bus.publish("S1", "alice", {"type": "tool_call", "name": "write_file"})
    ev = await asyncio.wait_for(q.get(), 1)
    assert ev["type"] == "tool_call" and ev["bot"] == "alice"
    bus.unbind()


@pytest.mark.asyncio
async def test_text_delta_merged_within_window():
    bus = TeamEventBus()
    bus.bind(asyncio.get_running_loop())
    q = bus.subscribe("S1", "alice")
    for ch in "Hello":
        bus.publish("S1", "alice", {"type": "text_delta", "text": ch})
    ev = await asyncio.wait_for(q.get(), 1)
    assert ev["type"] == "text_delta" and ev["text"] == "Hello"  # 合并成一条
    bus.unbind()


@pytest.mark.asyncio
async def test_queue_overflow_drops_oldest():
    bus = TeamEventBus()
    bus.bind(asyncio.get_running_loop())
    q = bus.subscribe("S1", "alice")
    for i in range(300):  # 超 256 容量
        bus.publish("S1", "alice", {"type": "tool_call", "n": i})
    await asyncio.sleep(0.05)  # 让 call_soon_threadsafe 回调跑完
    assert q.qsize() == 256
    first = q.get_nowait()
    assert first["n"] >= 44  # 最旧的被丢
    bus.unbind()


@pytest.mark.asyncio
async def test_snapshot_accumulates_current_text():
    bus = TeamEventBus()
    bus.bind(asyncio.get_running_loop())
    bus.subscribe("S1", "alice")
    bus.publish("S1", "alice", {"type": "text_delta", "text": "part1"})
    bus.publish("S1", "alice", {"type": "text_delta", "text": "part2"})
    assert bus.snapshot("S1", "alice")["text_so_far"] == "part1part2"
    bus.publish("S1", "alice", {"type": "round_end"})
    assert bus.snapshot("S1", "alice")["text_so_far"] == ""
    bus.unbind()


@pytest.mark.asyncio
async def test_isolated_per_bot_and_scope():
    bus = TeamEventBus()
    bus.bind(asyncio.get_running_loop())
    qa = bus.subscribe("S1", "alice")
    qb = bus.subscribe("S1", "bob")
    qother = bus.subscribe("S2", "alice")
    bus.publish("S1", "alice", {"type": "tool_call", "name": "x"})
    ev = await asyncio.wait_for(qa.get(), 1)
    assert ev["bot"] == "alice"
    assert qb.empty() and qother.empty()
    bus.unbind()


@pytest.mark.asyncio
async def test_unbind_clears_subscribers():
    bus = TeamEventBus()
    bus.bind(asyncio.get_running_loop())
    q = bus.subscribe("S1", "alice")
    bus.unbind()
    bus.publish("S1", "alice", {"type": "tool_call"})
    await asyncio.sleep(0.05)
    assert q.empty()


@pytest.mark.asyncio
async def test_lazy_bind_on_subscribe():
    """宿主 lifespan 拿不到 hub 时（agent 后台装配），首次 subscribe 惰性绑定。"""
    bus = TeamEventBus()
    q = bus.subscribe("S1", "alice")  # 未 bind
    bus.publish("S1", "alice", {"type": "tool_call"})
    ev = await asyncio.wait_for(q.get(), 1)
    assert ev["type"] == "tool_call"
    bus.unbind()


@pytest.mark.asyncio
async def test_bind_idempotent_same_loop():
    bus = TeamEventBus()
    loop = asyncio.get_running_loop()
    bus.bind(loop)
    t1 = bus._flusher
    bus.bind(loop)
    assert bus._flusher is t1  # 同 loop 不重复合并 task
    bus.unbind()
