"""SessionsStore.get_chat_history 回放测试：原始输出优先 + tool 链回放。"""
import json
from datetime import datetime, timezone

import pytest

from doclens.web_v2.sessions_store import (
    SessionItem,
    SessionSummary,
    SessionType,
    SessionsStore,
)


@pytest.fixture()
def store(tmp_path):
    return SessionsStore(tmp_path / "sessions.db")


def _create_session(store: SessionsStore, sid: str = "s1") -> None:
    now = datetime.now(timezone.utc)
    store.create(SessionSummary(
        id=sid, type=SessionType.CHAT, title="t", preview="",
        created_at=now, updated_at=now, message_count=0,
    ))


def _append(store: SessionsStore, sid: str, kind: str, payload: dict, seq: int) -> None:
    store.append_item(SessionItem(
        session_id=sid, seq=seq, kind=kind, payload=json.dumps(payload, ensure_ascii=False),
    ))


class TestGetChatHistory:
    def test_legacy_user_ai_roundtrip(self, store):
        """旧会话（无 raw/tool_trace）行为不变。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        _append(store, "s1", "message_ai", {"content": "a1"}, 1)
        _append(store, "s1", "message_user", {"content": "q2"}, 2)
        _append(store, "s1", "message_ai", {"content": "a2"}, 3)
        history = store.get_chat_history("s1")
        assert history == [
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "a1"},
            {"role": "user", "content": "q2"},
            {"role": "assistant", "content": "a2"},
        ]

    def test_tool_trace_replayed_as_anthropic_pairs(self, store):
        """tool_trace 回放为 assistant(tool_use) + user(tool_result) 成对消息。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "查一下"}, 0)
        store.append_chat_turn_raw("s1", [
            {"tool_use_id": "tu1", "name": "search_kb", "input": {"q": "x"},
             "output": "结果正文", "is_error": False},
            {"tool_use_id": "tu2", "name": "read_document", "input": {"path": "a.md"},
             "output": "文档内容", "is_error": False},
        ], "原始回答")
        history = store.get_chat_history("s1")
        assert history[0] == {"role": "user", "content": "查一下"}
        assert history[1] == {"role": "assistant", "content": [
            {"type": "tool_use", "id": "tu1", "name": "search_kb", "input": {"q": "x"}},
        ]}
        assert history[2] == {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "tu1",
             "content": "结果正文", "is_error": False},
        ]}
        assert history[3]["content"][0]["id"] == "tu2"
        assert history[5] == {"role": "assistant", "content": "原始回答"}
        # role 严格交替
        roles = [m["role"] for m in history]
        assert roles == ["user", "assistant", "user", "assistant", "user", "assistant"]

    def test_raw_preferred_over_curated_display(self, store):
        """同轮有 message_ai_raw 与 message_ai（策展）时，上下文用原始输出。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        store.append_chat_turn_raw("s1", [], "模型原始输出")
        _append(store, "s1", "message_ai", {"content": "策展后展示文本"}, 2)
        history = store.get_chat_history("s1")
        assert history[-1] == {"role": "assistant", "content": "模型原始输出"}

    def test_display_fallback_when_no_raw(self, store):
        """没有 raw（旧数据 / 写 raw 失败）时回退到 message_ai 展示文本。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        _append(store, "s1", "message_ai", {"content": "展示文本"}, 1)
        history = store.get_chat_history("s1")
        assert history[-1] == {"role": "assistant", "content": "展示文本"}

    def test_alternation_guard_for_interrupted_turn(self, store):
        """中断轮只有 message_user：相邻 user 之间补填充消息，避免 400。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        _append(store, "s1", "message_user", {"content": "q2"}, 1)
        _append(store, "s1", "message_ai", {"content": "a2"}, 2)
        history = store.get_chat_history("s1")
        roles = [m["role"] for m in history]
        assert all(a != b for a, b in zip(roles, roles[1:]))

    def test_invalid_tool_trace_skipped(self, store):
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        # 缺 tool_use_id 的 trace 直接跳过
        _append(store, "s1", "tool_trace", {"name": "x", "output": "o"}, 1)
        _append(store, "s1", "message_ai", {"content": "a"}, 2)
        history = store.get_chat_history("s1")
        assert [m["role"] for m in history] == ["user", "assistant"]

    def test_raw_seq_continues_after_frontend_items(self, store):
        """append_chat_turn_raw 的 seq 接续已有条目，不与前端写入冲突。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        _append(store, "s1", "message_ai", {"content": "a1"}, 1)
        store.append_chat_turn_raw("s1", [], "raw1")
        _append(store, "s1", "message_user", {"content": "q2"}, 3)
        store.append_chat_turn_raw("s1", [], "raw2")
        items = store.get_detail("s1")
        seqs = [it.seq for it in items]
        assert seqs == sorted(seqs) and len(set(seqs)) == len(seqs)
        history = store.get_chat_history("s1")
        assert history == [
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "raw1"},
            {"role": "user", "content": "q2"},
            {"role": "assistant", "content": "raw2"},
        ]
