# -*- coding: utf-8 -*-
"""删除会话前停续跑 agent（2026-11-01 P1 修复）的回归测试。

事故形态（debug_20261023.log 三会话实证）：断开续跑（ADR-0028）放生的
agent task 仍持有 session_key，用户删会话后 agent 收尾 6 段持久化逐条撞
FK FOREIGN KEY constraint failed——整轮回答/usage/raw messages 静默丢失。

修复：DELETE /sessions/{id} 与批量 DELETE /sessions 在删行前先走
_stop_orphan_agent（与 /chat/stop 同构：request_stop 信号 + task.cancel）。

直接 asyncio.run 调端点函数 + monkeypatch 桩（同 test_session_duplicate
约定，不起 TestClient）。
"""
import asyncio

import pytest

from doclens.web_v2.api import sessions as sessions_api
from doclens.web_v2.sessions_store import (
    SessionSummary,
    SessionType,
    SessionsStore,
)


@pytest.fixture()
def store(tmp_path):
    return SessionsStore(tmp_path / "sessions.db")


def _create(store, sid="s1", *, title="t", starred=False):
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    store.create(SessionSummary(
        id=sid, type=SessionType.CHAT, title=title, preview="",
        created_at=now, updated_at=now, message_count=0,
        starred=starred,
    ))


class _FakeTask:
    """可观察 cancel 的假 task（足够 _stop_orphan_agent 消费）。"""

    def __init__(self):
        self.cancelled = False
        self._done = False

    def done(self):
        return self._done

    def cancel(self):
        self.cancelled = True
        self._done = True

    def __await__(self):
        async def _noop():
            return None
        return _noop().__await__()


class TestDeleteStopsOrphanAgent:
    def test_delete_requests_stop_and_cancels_task(self, store, monkeypatch):
        """在跑 agent 存在时，删行前必须 request_stop + task.cancel。"""
        _create(store, "s1")
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
        monkeypatch.setattr(sessions_api, "cleanup_session_tmp", lambda *a, **k: None)
        monkeypatch.setattr(sessions_api, "grant_session_clear", lambda *a, **k: None)

        stopped = []
        task = _FakeTask()

        import doclens.web_v2.chat_runner as chat_runner
        import doclens.web_v2.chat_interrupt as chat_interrupt

        monkeypatch.setattr(
            chat_interrupt, "request_stop", lambda sid: stopped.append(sid) or True
        )
        monkeypatch.setattr(chat_runner, "get_task", lambda sid: task)

        from doclens.web_v2.deps import get_rewind_tracker

        class _FakeTracker:
            def purge(self, sid):
                pass
        monkeypatch.setattr(
            "doclens.web_v2.deps.get_rewind_tracker", lambda: _FakeTracker()
        )

        result = asyncio.run(sessions_api.delete_session("s1"))
        assert result == {"ok": True}
        assert stopped == ["s1"], "删行前必须先发 request_stop 信号"
        assert task.cancelled, "断开续跑 task 必须被 cancel"
        assert store.get("s1") is None, "会话行应已删除"

    def test_delete_without_agent_still_works(self, store, monkeypatch):
        """无在跑 agent（常态）：直接删行，不因停agent路径报错。"""
        _create(store, "s2")
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
        monkeypatch.setattr(sessions_api, "cleanup_session_tmp", lambda *a, **k: None)
        monkeypatch.setattr(sessions_api, "grant_session_clear", lambda *a, **k: None)

        import doclens.web_v2.chat_interrupt as chat_interrupt

        monkeypatch.setattr(
            chat_interrupt, "request_stop", lambda sid: False
        )

        from doclens.web_v2 import chat_runner

        monkeypatch.setattr(chat_runner, "get_task", lambda sid: None)

        class _FakeTracker:
            def purge(self, sid):
                pass
        monkeypatch.setattr(
            "doclens.web_v2.deps.get_rewind_tracker", lambda: _FakeTracker()
        )

        result = asyncio.run(sessions_api.delete_session("s2"))
        assert result == {"ok": True}
        assert store.get("s2") is None

    def test_delete_missing_session_404(self, store, monkeypatch):
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
        with pytest.raises(Exception) as ei:
            asyncio.run(sessions_api.delete_session("nope"))
        assert "SESSION_NOT_FOUND" in str(ei.value) or "404" in str(ei.value)


class TestClearSessionsStopsAgents:
    def test_clear_stops_running_agents_first(self, store, monkeypatch):
        """批量删除：在跑 agent 先停（防 FK 丢数据），删行照常。"""
        _create(store, "a1")
        _create(store, "a2")
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
        monkeypatch.setattr(sessions_api, "cleanup_all_tmp", lambda *a, **k: None)
        monkeypatch.setattr(
            "planify.tools.guard.grant_clear_all", lambda: None
        )

        from doclens.web_v2 import chat_runner
        from doclens.web_v2 import chat_interrupt as chat_interrupt

        monkeypatch.setattr(chat_runner, "running_sessions", lambda: ["a1"])
        task = _FakeTask()
        monkeypatch.setattr(chat_runner, "get_task", lambda sid: task)
        monkeypatch.setattr(
            chat_interrupt, "request_stop", lambda sid: True
        )

        class _FakeTracker:
            def purge(self, sid):
                pass
        monkeypatch.setattr(
            "doclens.web_v2.deps.get_rewind_tracker", lambda: _FakeTracker()
        )

        result = asyncio.run(sessions_api.clear_sessions(None))
        assert result["deleted_count"] == 2
        assert task.cancelled, "批量删除也必须先停续跑 agent"


class TestRunningSessionsSnapshot:
    def test_running_sessions_lists_active_only(self, monkeypatch):
        from doclens.web_v2 import chat_runner

        live = _FakeTask()   # 未 done
        gone = _FakeTask()
        gone.cancel()        # done=True，不应出现

        monkeypatch.setattr(
            chat_runner, "_active",
            {"s-live": live, "s-gone": gone},
        )
        # 直接调用模块内函数（绕过 monkeypatch 的模块属性替换语义）
        with chat_runner._lock:
            pass
        # running_sessions 读取 _active（模块级）——monkeypatch.setattr 对
        # 模块变量生效，函数内通过闭包全局名访问，故此处可用
        result = chat_runner.running_sessions()
        assert result == ["s-live"]
