"""GET /api/sessions/{id} 的 context_window 契约测试（2026-09-18）。

分母实时化：detail 携带 runtime.config 现读的 planify_context_window（与
压缩决策同源）——配置热更后旧会话的会话信息弹窗不再停滞 usage 历史快照。
沿 test_manual_compact_api 模式：端点直调 + monkeypatch 桩，不起 TestClient。
"""
import asyncio
import json
from datetime import datetime, timezone

import pytest

from doclens.web_v2.api import sessions as sessions_api
from doclens.web_v2.sessions_store import (
    SessionItem,
    SessionsStore,
    SessionSummary,
    SessionType,
)


def _make_store(tmp_path, sid="s1"):
    store = SessionsStore(tmp_path / "sessions.db")
    now = datetime.now(timezone.utc)
    store.create(SessionSummary(
        id=sid, type=SessionType.CHAT, title="t", preview="",
        created_at=now, updated_at=now, message_count=0,
    ))
    store.append_item(SessionItem(
        session_id=sid, seq=0, kind="usage",
        payload=json.dumps({"input_tokens": 100, "cache_read_input_tokens": 0,
                            "cache_creation_input_tokens": 0,
                            "context_window": 200000}),  # 历史快照（旧窗口）
    ))
    return store


def _patch_agent(monkeypatch, window):
    from types import SimpleNamespace

    fake = SimpleNamespace(
        runtime=SimpleNamespace(config=SimpleNamespace(
            planify_context_window=window,
        ))
    )
    monkeypatch.setattr(
        "doclens.web_v2.deps.get_agent_if_ready", lambda: fake
    )


class TestDetailContextWindow:
    def test_live_window_overrides_snapshot(self, tmp_path, monkeypatch):
        store = _make_store(tmp_path)
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
        _patch_agent(monkeypatch, window=100000)  # 热更后的实时值
        resp = asyncio.run(sessions_api.get_session("s1"))
        assert resp.context_window == 100000
        # usage 快照仍在 items 里（不可变历史），只是不再是分母权威
        assert json.loads(resp.items[0]["payload"])["context_window"] == 200000

    def test_agent_absent_falls_back_zero(self, tmp_path, monkeypatch):
        store = _make_store(tmp_path)
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
        monkeypatch.setattr(
            "doclens.web_v2.deps.get_agent_if_ready", lambda: None
        )
        resp = asyncio.run(sessions_api.get_session("s1"))
        assert resp.context_window == 0  # 前端回落历史快照

    def test_agent_read_error_does_not_break_detail(self, tmp_path, monkeypatch):
        store = _make_store(tmp_path)
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)

        def boom():
            raise RuntimeError("agent not ready")

        monkeypatch.setattr("doclens.web_v2.deps.get_agent_if_ready", boom)
        resp = asyncio.run(sessions_api.get_session("s1"))
        assert resp.context_window == 0
        assert len(resp.items) == 1  # 主数据不受展示字段影响
