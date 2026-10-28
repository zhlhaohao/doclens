# -*- coding: utf-8 -*-
"""孪生复制 SessionsStore.duplicate + POST /api/sessions/{id}/duplicate 测试。

端点函数为依赖注入风格（_get_store 调用期解析），直接 asyncio.run 调用
+ monkeypatch 注入桩（同 test_manual_compact_api 的约定，不起 TestClient）。
"""
import asyncio
import json
from datetime import datetime, timezone

import pytest

from doclens.web_v2.api import sessions as sessions_api
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.sessions_store import (
    SessionItem,
    SessionSummary,
    SessionType,
    SessionsStore,
)


@pytest.fixture()
def store(tmp_path):
    return SessionsStore(tmp_path / "sessions.db")


def _create(store, sid="s1", *, title="t", starred=False,
            type_=SessionType.CHAT):
    now = datetime.now(timezone.utc)
    store.create(SessionSummary(
        id=sid, type=type_, title=title, preview="",
        created_at=now, updated_at=now, message_count=0,
        starred=starred,
    ))


def _append(store, sid, kind, payload, seq):
    store.append_item(SessionItem(
        session_id=sid, seq=seq, kind=kind,
        payload=json.dumps(payload, ensure_ascii=False),
    ))


class TestDuplicateStore:
    def test_full_items_copy(self, store):
        """全部条目（含死段/边界/usage）逐字节复制，seq 不变。"""
        _create(store, "s1")
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        store.append_chat_turn_raw("s1", [
            {"tool_use_id": "tu1", "name": "bash", "input": {}, "output": "o",
             "is_error": False},
        ], "a1")
        store.append_rewound("s1", 0, [], [])
        store.append_usage("s1", {"input": 1, "output": 2})
        twin = store.duplicate("s1")
        assert twin is not None
        src = store.get_detail("s1")
        dst = store.get_detail(twin.id)
        assert len(src) == len(dst) > 0
        for a, b in zip(src, dst):
            assert a.seq == b.seq
            assert a.kind == b.kind
            assert a.payload == b.payload

    def test_replay_identical(self, store):
        """孪生回放与源逐字节一致——继续对话上下文不打折。"""
        _create(store, "s1")
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "tu1", "name": "t", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "tu1", "content": "r"},
            ]},
            {"role": "assistant", "content": "done"},
        ])
        twin = store.duplicate("s1")
        assert store.get_chat_history(twin.id) == store.get_chat_history("s1")

    def test_metadata(self, store):
        """标题加后缀、新 id、starred 不继承、mode/message_count 保留、置顶排序。"""
        _create(store, "s1", title="调研")
        store.update_count_and_time("s1", 6)
        # 手工补 mode（create 不带 mode 字段，走 find_or_create 路径太重）
        with store._lock, store._conn() as conn:
            conn.execute("UPDATE sessions SET mode='skill' WHERE id='s1'")
        twin = store.duplicate("s1")
        store.set_starred("s1", True)  # 加星在复制后 → 刷新 updated_at 晚于孪生
        assert twin.id != "s1"
        assert twin.title == "调研 (副本)"
        assert twin.starred is False
        assert twin.message_count == 6
        got = store.get(twin.id)
        assert got.mode == "skill"
        assert store.get("s1").starred is True  # 源完整保留
        # 排序：加星源仍置顶（starred 优先）；孪生在非加星组内以最新
        # updated_at 排首
        sessions = store.list(SessionType.CHAT)
        assert sessions[0].id == "s1"
        assert sessions[1].id == twin.id

    def test_starred_not_inherited_but_source_kept(self, store):
        """加星源复制后仍受保护；孪生可直接删除。"""
        _create(store, "s1")
        store.set_starred("s1", True)
        twin = store.duplicate("s1")
        assert store.delete("s1") is False  # 源保护不变
        assert store.delete(twin.id) is True

    def test_rewind_snapshots_not_copied(self, store):
        """快照引用源会话的机器本地备份目录，孪生不复制（预期降级）。"""
        _create(store, "s1")
        store.append_rewind_snapshot("s1", 0, {})
        twin = store.duplicate("s1")
        assert store.list_rewind_snapshots("s1") != []
        assert store.list_rewind_snapshots(twin.id) == []

    def test_missing_session(self, store):
        assert store.duplicate("NOPE") is None


class TestDuplicateEndpoint:
    def _patch(self, monkeypatch, store):
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)

    def test_ok(self, store, monkeypatch):
        _create(store, "s1", title="t")
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        self._patch(monkeypatch, store)
        res = asyncio.run(sessions_api.duplicate_session("s1"))
        assert res.id != "s1"
        assert res.title == "t (副本)"
        assert res.type == SessionType.CHAT
        assert store.get_detail(res.id)

    def test_404(self, store, monkeypatch):
        self._patch(monkeypatch, store)
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(sessions_api.duplicate_session("NOPE"))
        assert ei.value.status == 404
