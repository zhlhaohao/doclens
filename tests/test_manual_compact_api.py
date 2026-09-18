# -*- coding: utf-8 -*-
"""手动压缩端点 POST /api/sessions/{id}/compact（ADR-0026 手动入口）测试。

端点函数为依赖注入风格（_get_store + deps.get_agent + planify aauto_compact
均为调用期解析），直接 asyncio.run 调用 + monkeypatch 注入桩，不起 TestClient。
"""
import asyncio
import json
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from doclens.web_v2.api import sessions as sessions_api
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.chat_interrupt import register_interrupt, unregister_interrupt
from doclens.web_v2.sessions_store import SessionSummary, SessionType, SessionsStore


@pytest.fixture()
def store(tmp_path):
    return SessionsStore(tmp_path / "sessions.db")


def _create(store, sid="s1", type_=SessionType.CHAT):
    now = datetime.now(timezone.utc)
    store.create(SessionSummary(
        id=sid, type=type_, title="t", preview="",
        created_at=now, updated_at=now, message_count=0,
    ))


class _FakeAgent:
    def __init__(self, tmp_path):
        self.runtime = SimpleNamespace(
            config=SimpleNamespace(
                workdir=tmp_path, compact_transcript_dir=None,
            ),
            client=SimpleNamespace(),  # aauto_compact 被替换，client 不被真用
        )


def _patch(monkeypatch, store, tmp_path, compacted=None, captured=None):
    monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
    monkeypatch.setattr(
        "doclens.web_v2.deps.get_agent", lambda: _FakeAgent(tmp_path)
    )

    async def fake_aauto(
        messages, provider, transcript_dir, *, tracer=None,
        summary_input_budget=None, summary_max_tokens=None,
    ):
        if captured is not None:
            captured["transcript_dir"] = transcript_dir
            captured["messages_in"] = list(messages)
        return compacted or [
            {"role": "user", "content": "[Compressed. Transcript: t]\n摘要"},
            {"role": "assistant", "content": "Understood."},
        ]

    monkeypatch.setattr("planify.context.compact.aauto_compact", fake_aauto)


def _seed_chat_history(store, sid="s1"):
    from doclens.web_v2.sessions_store import SessionItem
    now = datetime.now(timezone.utc).isoformat()
    with store._lock, store._conn() as conn:
        conn.execute(
            "INSERT INTO session_items (session_id, seq, kind, payload, created_at)"
            " VALUES (?, ?, 'message_user', ?, ?)",
            (sid, 0, json.dumps({"content": "问题" * 50}), now),
        )
        conn.execute(
            "INSERT INTO session_items (session_id, seq, kind, payload, created_at)"
            " VALUES (?, ?, 'message_ai_raw', ?, ?)",
            (sid, 1, json.dumps({"content": "回答" * 50}), now),
        )


class TestManualCompact:
    def test_404_unknown_session(self, store, monkeypatch, tmp_path):
        _patch(monkeypatch, store, tmp_path)
        with pytest.raises(CortexAPIError) as e:
            asyncio.run(sessions_api.compact_session("nope"))
        assert e.value.status == 404

    def test_400_not_chat_session(self, store, monkeypatch, tmp_path):
        _create(store, type_=SessionType.SEARCH)
        _patch(monkeypatch, store, tmp_path)
        with pytest.raises(CortexAPIError) as e:
            asyncio.run(sessions_api.compact_session("s1"))
        assert e.value.code == "NOT_CHAT_SESSION"

    def test_409_while_streaming(self, store, monkeypatch, tmp_path):
        _create(store)
        _seed_chat_history(store)
        _patch(monkeypatch, store, tmp_path)
        ev = register_interrupt("s1")
        try:
            with pytest.raises(CortexAPIError) as e:
                asyncio.run(sessions_api.compact_session("s1"))
            assert e.value.status == 409
        finally:
            unregister_interrupt("s1", ev)

    def test_400_history_too_short(self, store, monkeypatch, tmp_path):
        _create(store)
        _patch(monkeypatch, store, tmp_path)
        with pytest.raises(CortexAPIError) as e:
            asyncio.run(sessions_api.compact_session("s1"))
        assert e.value.code == "NOTHING_TO_COMPACT"

    def test_compact_ok_appends_boundary_and_replays(self, store, monkeypatch, tmp_path):
        """正常链路：摘要落库 compacted 条目，回放截断投影，返回前后 token。"""
        _create(store)
        _seed_chat_history(store)
        captured = {}
        _patch(monkeypatch, store, tmp_path, captured=captured)

        result = asyncio.run(sessions_api.compact_session("s1"))

        assert result["ok"] is True
        assert result["pre_tokens"] > result["post_tokens"]
        # transcript 目录：无注入时退回 <workdir>/.transcripts
        assert captured["transcript_dir"] == tmp_path / ".transcripts"
        # 落库验证
        items = store.get_detail("s1")
        compacted = [it for it in items if it.kind == "compacted"]
        assert len(compacted) == 1
        payload = json.loads(compacted[0].payload)
        assert payload["messages"][0]["content"].startswith("[Compressed.")
        assert payload["pre_tokens"] == result["pre_tokens"]
        # 压缩后估算（前端「压缩晚于最近调用」时显示的占用量）
        assert payload["post_tokens"] == result["post_tokens"]
        # 回放：截断投影（旧 message_user/message_ai_raw 不再出现）
        history = store.get_chat_history("s1")
        assert history == payload["messages"]

    def test_compact_502_on_llm_failure(self, store, monkeypatch, tmp_path):
        _create(store)
        _seed_chat_history(store)
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
        monkeypatch.setattr(
            "doclens.web_v2.deps.get_agent", lambda: _FakeAgent(tmp_path)
        )

        async def boom(messages, provider, transcript_dir, *, tracer=None,
                       summary_input_budget=None, summary_max_tokens=None):
            raise RuntimeError("api down")

        monkeypatch.setattr("planify.context.compact.aauto_compact", boom)
        with pytest.raises(CortexAPIError) as e:
            asyncio.run(sessions_api.compact_session("s1"))
        assert e.value.status == 502
        # 失败不落任何 compacted 条目
        assert not [it for it in store.get_detail("s1") if it.kind == "compacted"]
