"""WatchBroker 广播节流（AP-5 快照风暴防护）回归测试。

- 同事件类型在节流窗口内只入队第一次，后续被丢弃。
- immediate=True 跳过节流，状态机边沿事件必到。
- 不同事件类型独立节流，互不影响。
"""
import asyncio
import time

from doclens.web_v2 import watch_broker
from doclens.web_v2.watch_broker import WatchBroker


def _make_broker_with_client() -> tuple[WatchBroker, asyncio.Queue]:
    """构造绑定到真实 loop 的 broker + 一个客户端队列。"""
    broker = WatchBroker()
    loop = asyncio.new_event_loop()
    broker.bind(loop)
    q = broker.subscribe()
    return broker, q, loop


def _drain_loop(loop: asyncio.AbstractEventLoop) -> None:
    """让 call_soon_threadsafe 排队的回调跑完。"""
    loop.run_until_complete(asyncio.sleep(0))


def test_broadcast_throttled_within_window():
    broker, q, loop = _make_broker_with_client()
    try:
        # 窗口内连发 5 次 status——只有第 1 次入队
        for i in range(5):
            broker.broadcast("status", {"seq": i})
        _drain_loop(loop)
        assert q.qsize() == 1
        assert q.get_nowait()["data"]["seq"] == 0
    finally:
        loop.close()


def test_broadcast_immediate_bypasses_throttle():
    broker, q, loop = _make_broker_with_client()
    try:
        broker.broadcast("status", {"seq": 0})
        # 窗口内 immediate=True 必到
        broker.broadcast("status", {"seq": 1}, immediate=True)
        broker.broadcast("status", {"seq": 2}, immediate=True)
        _drain_loop(loop)
        assert q.qsize() == 3
        assert [q.get_nowait()["data"]["seq"] for _ in range(3)] == [0, 1, 2]
    finally:
        loop.close()


def test_throttle_window_expires():
    broker, q, loop = _make_broker_with_client()
    # 缩短节流窗口避免 sleep 拖慢测试
    original = watch_broker._THROTTLE_SEC
    watch_broker._THROTTLE_SEC = 0.05
    try:
        broker.broadcast("status", {"seq": 0})
        broker.broadcast("status", {"seq": 1})  # 被节流
        time.sleep(0.08)  # 跨过窗口
        broker.broadcast("status", {"seq": 2})  # 窗口外，应到
        _drain_loop(loop)
        assert q.qsize() == 2
        assert [q.get_nowait()["data"]["seq"] for _ in range(2)] == [0, 2]
    finally:
        watch_broker._THROTTLE_SEC = original
        loop.close()


def test_throttle_per_event_type():
    """status 与 reindexed 独立节流，互不影响。"""
    broker, q, loop = _make_broker_with_client()
    try:
        broker.broadcast("status", {"seq": 0})
        broker.broadcast("reindexed", {"seq": 0})  # 不同事件类型，不被节流
        broker.broadcast("status", {"seq": 1})     # status 窗口内，被节流
        _drain_loop(loop)
        assert q.qsize() == 2
        events = [q.get_nowait() for _ in range(2)]
        assert [(e["event"], e["data"]["seq"]) for e in events] == [
            ("status", 0), ("reindexed", 0),
        ]
    finally:
        loop.close()
