"""sessions_store.py SQLite CRUD 测试。"""
from datetime import datetime, timezone

import pytest

from cortex.web_v2.sessions_store import (
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
