"""Bot 会话存储（ADR-0060 §3/§5）：三列归属、按 task 复用、级联删除、FK 静默。"""

import json
from datetime import datetime, timezone

from doclens.web_v2.sessions_store import SessionItem, SessionType, SessionsStore


def _store(tmp_path):
    return SessionsStore(tmp_path / "s.db")


def _mk_chat(store, sid="P1"):
    from doclens.web_v2.sessions_store import SessionSummary
    now = datetime.now(timezone.utc)
    store.create(SessionSummary(id=sid, type=SessionType.CHAT, title="t", preview="", created_at=now, updated_at=now))
    return sid


class TestBotSessionStore:
    def test_reuse_by_task(self, tmp_path):
        store = _store(tmp_path)
        parent = _mk_chat(store)
        s1 = store.find_or_create_bot_session("alice", parent, task_id=7)
        s2 = store.find_or_create_bot_session("alice", parent, task_id=7)
        assert s1 == s2  # 同 task 复用
        s3 = store.find_or_create_bot_session("alice", parent, task_id=8)
        assert s3 != s1
        meta = store.get_bot_session_meta(s1)
        assert meta["bot_name"] == "alice" and meta["task_id"] == "7" and meta["parent_session_id"] == parent

    def test_chat_session_reuses_latest(self, tmp_path):
        store = _store(tmp_path)
        parent = _mk_chat(store)
        a = store.find_or_create_bot_session("alice", parent, task_id=None)
        b = store.find_or_create_bot_session("alice", parent, task_id=None)
        assert a == b
        # 有 task 的会话不影响纯对话复用
        store.find_or_create_bot_session("alice", parent, task_id=9)
        c = store.find_or_create_bot_session("alice", parent, task_id=None)
        assert c == a

    def test_bot_sessions_hidden_from_chat_list(self, tmp_path):
        store = _store(tmp_path)
        parent = _mk_chat(store)
        store.find_or_create_bot_session("alice", parent, task_id=None)
        assert len(store.list(SessionType.CHAT)) == 1  # 只有父会话
        assert store.list(SessionType.BOT) is not None

    def test_cascade_delete_bot_sessions(self, tmp_path):
        store = _store(tmp_path)
        parent = _mk_chat(store)
        sid = store.find_or_create_bot_session("alice", parent, task_id=None)
        store.append_item(SessionItem(session_id=sid, seq=1, kind="message_user",
                                      payload=json.dumps({"text": "hi"})))
        assert store.delete_bot_sessions_of(parent) == 1
        assert store.get_detail(sid) == []

    def test_delete_only_current_parents_bot_sessions(self, tmp_path):
        store = _store(tmp_path)
        p1 = _mk_chat(store, "P1")
        p2 = _mk_chat(store, "P2")
        a = store.find_or_create_bot_session("alice", p1, task_id=None)
        b = store.find_or_create_bot_session("alice", p2, task_id=None)
        store.delete_bot_sessions_for_bot("alice", p1)
        assert store.get_detail(a) == []
        assert store.get_bot_session_meta(b) is not None  # 其他会话的留痕保留

    def test_append_after_parent_deleted_is_silent(self, tmp_path):
        store = _store(tmp_path)
        parent = _mk_chat(store)
        sid = store.find_or_create_bot_session("alice", parent, task_id=None)
        store.delete_bot_sessions_of(parent)  # 父会话级联删除后 Bot 线程才落库
        store.append_item(SessionItem(session_id=sid, seq=99, kind="message_ai",
                                      payload=json.dumps({"text": "late"})))  # 不抛 FK
        assert store.get_detail(sid) == []

    def test_next_seq_monotonic(self, tmp_path):
        store = _store(tmp_path)
        parent = _mk_chat(store)
        sid = store.find_or_create_bot_session("alice", parent, task_id=None)
        assert store.next_seq(sid) == 1
        store.append_item(SessionItem(session_id=sid, seq=1, kind="message_ai", payload="{}"))
        assert store.next_seq(sid) == 2
        assert store.get_bot_session_meta(sid)["last_persisted_seq"] == 1

    def test_find_latest_prefers_newest_regardless_of_task(self, tmp_path):
        """覆盖层打开时取最新会话（task 会话晚于纯对话创建时命中 task 会话）。"""
        import time
        store = _store(tmp_path)
        parent = _mk_chat(store)
        chat_sid = store.find_or_create_bot_session("alice", parent, task_id=None)
        time.sleep(0.05)  # created_at 是 ISO 字串，需保证严格递增
        task_sid = store.find_or_create_bot_session("alice", parent, task_id=3)
        assert store.find_bot_session("alice", parent) == task_sid
        assert chat_sid != task_sid
