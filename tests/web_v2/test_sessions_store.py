"""sessions_store.py SQLite CRUD 测试。"""
from datetime import datetime, timezone

import pytest

from doclens.web_v2.sessions_store import (
    SessionItem,
    SessionSummary,
    SessionType,
    SessionsStore,
)


@pytest.fixture
def store(tmp_path):
    return SessionsStore(tmp_path / "sessions.db")


def _make_summary(**over) -> SessionSummary:
    base = dict(
        id="01JTEST0000000000000000001",
        type=SessionType.CHAT,
        title="测试会话",
        preview="预览文本",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        message_count=0,
    )
    base.update(over)
    return SessionSummary(**base)


def test_create_and_get_session(store):
    s = _make_summary()
    store.create(s)
    got = store.get(s.id)
    assert got is not None
    assert got.title == "测试会话"
    assert got.type == SessionType.CHAT


def test_list_sessions_ordered_by_updated_desc(store):
    a = _make_summary(id="01JAAA", title="A", updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    b = _make_summary(id="01JBBB", title="B", updated_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    store.create(a)
    store.create(b)
    listed = store.list(SessionType.CHAT, limit=10)
    assert [x.id for x in listed] == ["01JBBB", "01JAAA"]


def test_list_sessions_filter_by_type(store):
    store.create(_make_summary(id="01JC", type=SessionType.CHAT))
    store.create(_make_summary(id="01JS", type=SessionType.SEARCH))
    chats = store.list(SessionType.CHAT, limit=10)
    assert [x.id for x in chats] == ["01JC"]


def test_append_items_and_get_detail(store):
    s = _make_summary()
    store.create(s)
    items = [
        SessionItem(session_id=s.id, seq=0, kind="message_user", payload='{"content":"hi"}'),
        SessionItem(session_id=s.id, seq=1, kind="message_ai", payload='{"content":"hello"}'),
    ]
    for it in items:
        store.append_item(it)
    store.update_count_and_time(s.id, message_count=2)
    detail = store.get_detail(s.id)
    assert detail is not None
    assert len(detail) == 2
    assert detail[0].kind == "message_user"


def test_delete_session_cascades_items(store):
    s = _make_summary()
    store.create(s)
    store.append_item(SessionItem(session_id=s.id, seq=0, kind="message_user", payload="{}"))
    store.delete(s.id)
    assert store.get(s.id) is None
    assert store.get_detail(s.id) == []


# ---------------------------------------------------------------------------
# mode 列（grep 历史标记）测试
# ---------------------------------------------------------------------------


def test_find_or_create_distinguishes_modes(store):
    """同 title 不同 mode → 两条独立记录。"""
    kw = store.find_or_create(SessionType.SEARCH, "foo", "p", mode="keyword")
    gp = store.find_or_create(SessionType.SEARCH, "foo", "p", mode="grep")
    assert kw.id != gp.id


def test_find_or_create_dedup_same_mode(store):
    """同 title 同 mode → 复用同一条记录。"""
    a = store.find_or_create(SessionType.SEARCH, "foo", "p", mode="grep")
    b = store.find_or_create(SessionType.SEARCH, "foo", "p2", mode="grep")
    assert a.id == b.id


def test_find_or_create_persists_and_reads_mode(store):
    created = store.find_or_create(SessionType.SEARCH, "foo", "p", mode="grep")
    items = store.list(SessionType.SEARCH)
    assert items and items[0].mode == "grep"
    got = store.get(created.id)
    assert got is not None and got.mode == "grep"


def test_legacy_db_migration_adds_mode_column(tmp_path):
    """旧库 sessions 表无 mode 列时，SessionsStore 初始化应自动补列且不报错。"""
    import sqlite3

    db = tmp_path / "sessions.db"
    # 模拟旧库：手动建一个不含 mode 列的 sessions 表并写入一条记录
    conn = sqlite3.connect(db)
    conn.execute(
        "CREATE TABLE sessions (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, "
        "preview TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, "
        "message_count INTEGER NOT NULL DEFAULT 0)"
    )
    conn.execute(
        "INSERT INTO sessions (id, type, title, preview, created_at, updated_at, message_count) "
        "VALUES ('old1', 'search', 'foo', 'p', '2026-01-01T00:00:00', '2026-01-01T00:00:00', 0)"
    )
    conn.commit()
    conn.close()

    # 重新打开 → 触发迁移
    store = SessionsStore(db)
    items = store.list(SessionType.SEARCH)
    assert items and items[0].mode is None  # 旧记录无 mode
    # 迁移后写入新记录可带 mode
    new = store.find_or_create(SessionType.SEARCH, "bar", "p", mode="grep")
    assert new.mode == "grep"


def test_message_ai_payload_with_tool_calls_roundtrips(temp_workdir):
    """message_ai 的 payload 含 tool_calls 时，append_item + get_detail 透传无损。"""
    from datetime import datetime
    from doclens.web_v2.sessions_store import SessionsStore, SessionItem, SessionSummary, SessionType
    import json

    store = SessionsStore(temp_workdir / "s.db")
    summary = SessionSummary(
        id="s1", type=SessionType.CHAT, title="t", preview="p",
        created_at=datetime.utcnow(), updated_at=datetime.utcnow(), message_count=0,
    )
    store.create(summary)
    payload = json.dumps({
        "content": "answer",
        "tool_calls": [
            {"tool_use_id": "t1", "name": "search", "input": {"q": "x"},
             "output": "ok", "is_error": False, "duration_ms": 50},
        ],
    })
    store.append_item(SessionItem(session_id="s1", seq=1, kind="message_ai", payload=payload))

    items = store.get_detail("s1")
    assert len(items) == 1
    parsed = json.loads(items[0].payload)
    assert parsed["content"] == "answer"
    assert parsed["tool_calls"][0]["name"] == "search"
    assert parsed["tool_calls"][0]["duration_ms"] == 50

    # get_chat_history 只取 content，不崩、不丢
    history = store.get_chat_history("s1")
    assert history == [{"role": "assistant", "content": "answer"}]

