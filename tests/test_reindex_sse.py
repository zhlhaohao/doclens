# -*- coding: utf-8 -*-
"""AP-48：reindex SSE 的静默期不得判失败。

原实现 `asyncio.wait_for(run_in_executor(None, q.get), 600)`：
- 超时直接向前端发 `error` 并 break —— 大库重建常在进度间隙里被误报「重建失败」，
  而索引其实还在后台写；
- `wait_for` 超时只取消 future，阻塞在线程池里的 `q.get` 永不返回 —— 每超时一次
  泄漏一个执行器线程。

修复：asyncio.Queue + `call_soon_threadsafe`（无执行器线程），静默期发 `heartbeat`
并继续等；客户端断开只结束观察窗口，后台重建照旧继续。
"""
import asyncio
import json
from types import SimpleNamespace

import pytest

from doclens.web_v2.api import reindex as reindex_api


class _CapturedSSE:
    """捕获端点返回的 SSE 生成器（不启动真 ASGI 服务）。"""

    def __init__(self):
        self.gen = None


@pytest.fixture()
def capture(monkeypatch):
    cap = _CapturedSSE()

    class _Fake:
        def __init__(self, gen):
            cap.gen = gen

    monkeypatch.setattr(reindex_api, "EventSourceResponse", _Fake)
    return cap


def _fake_idx(events=None, *, emit=None):
    """构造替身 IndexManager；trigger 时按 emit 回调推事件。"""
    calls = {}

    def trigger_background_reindex(**kwargs):
        calls.update(kwargs)
        if emit is not None:
            emit(kwargs)
        return None

    return SimpleNamespace(
        trigger_background_reindex=trigger_background_reindex, calls=calls
    )


def _events(gen, n: int) -> list[dict]:
    out = []

    async def take():
        async for item in gen:
            out.append(item)
            if len(out) >= n:
                break

    asyncio.run(asyncio.wait_for(take(), timeout=5))
    return out


class TestHeartbeatInsteadOfFailure:
    def test_silent_period_emits_heartbeat_not_error(self, capture, monkeypatch):
        """无进度事件时发 heartbeat 并继续，绝不发 error 后 break。"""
        monkeypatch.setattr(reindex_api, "_HEARTBEAT_SECONDS", 0.02)
        idx = _fake_idx()

        asyncio.run(reindex_api.force_reindex(idx=idx))
        events = _events(capture.gen, 2)

        assert [e["event"] for e in events] == ["heartbeat", "heartbeat"]
        for e in events:
            data = json.loads(e["data"])
            assert data["indexed_count"] == 0
            assert data["elapsed_sec"] >= 0

    def test_progress_then_silence_keeps_streaming(self, capture, monkeypatch):
        """收到 progress 后静默 → 仍是 heartbeat（不是 done/error）。"""
        monkeypatch.setattr(reindex_api, "_HEARTBEAT_SECONDS", 0.02)

        def emit(kwargs):
            kwargs["on_progress"]("D:/kb/a.md", 7)

        idx = _fake_idx(emit=emit)
        asyncio.run(reindex_api.force_reindex(idx=idx))
        events = _events(capture.gen, 2)

        assert events[0]["event"] == "progress"
        assert json.loads(events[0]["data"])["indexed_count"] == 7
        assert events[1]["event"] == "heartbeat"
        assert json.loads(events[1]["data"])["indexed_count"] == 7

    def test_heartbeat_reports_elapsed_time(self, capture, monkeypatch):
        monkeypatch.setattr(reindex_api, "_HEARTBEAT_SECONDS", 0.05)
        idx = _fake_idx()
        asyncio.run(reindex_api.force_reindex(idx=idx))
        events = _events(capture.gen, 1)
        assert json.loads(events[0]["data"])["elapsed_sec"] >= 0


class TestNormalTermination:
    def test_done_ends_stream(self, capture, monkeypatch):
        monkeypatch.setattr(reindex_api, "_HEARTBEAT_SECONDS", 0.02)

        def emit(kwargs):
            kwargs["on_complete"](True, 42, 0, 42)

        idx = _fake_idx(emit=emit)
        asyncio.run(reindex_api.force_reindex(idx=idx))
        events = _events(capture.gen, 5)

        assert events[-1]["event"] == "done"
        data = json.loads(events[-1]["data"])
        assert (data["success"], data["doc_count"]) == (True, 42)


class TestDisconnect:
    def test_client_disconnect_does_not_cancel_reindex(self, capture, monkeypatch):
        """观察窗口被取消时后台任务不受影响（本来就是后台线程）。"""
        monkeypatch.setattr(reindex_api, "_HEARTBEAT_SECONDS", 0.02)
        idx = _fake_idx()
        asyncio.run(reindex_api.force_reindex(idx=idx))
        gen = capture.gen

        async def consume_then_close():
            first = await gen.__anext__()      # 拿到一条心跳，生成器挂起在 q.get()
            assert first["event"] == "heartbeat"
            await gen.aclose()                 # 模拟客户端断开

        asyncio.run(consume_then_close())
        assert idx.calls["force"] is True, "触发参数不应受断流影响"


class TestNoExecutorLeak:
    def test_no_thread_pool_growth_on_silence(self, capture, monkeypatch):
        """静默期不再走 run_in_executor —— 线程数不随等待时间增长。"""
        import threading

        monkeypatch.setattr(reindex_api, "_HEARTBEAT_SECONDS", 0.01)
        idx = _fake_idx()
        asyncio.run(reindex_api.force_reindex(idx=idx))

        before = threading.active_count()
        _events(capture.gen, 5)
        after = threading.active_count()
        assert after - before <= 1, f"线程数从 {before} 涨到 {after}（执行器线程泄漏）"
