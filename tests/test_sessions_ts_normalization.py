"""sessions 时间戳归一回归测试。

背景（BUG）：sessions 表混存 aware（POST /api/sessions 写入）与 naive
（旧 find_or_create / update_count_and_time 写入）两种 ISO 时间戳，
GET /api/sessions（无 type 过滤）在 Python 侧合并排序时 naive/aware
直接比较抛 TypeError → 500。

修复契约：
1. 读取侧：所有行解析统一经 _parse_db_ts → aware UTC（存量混合数据兼容）；
2. 写入侧：find_or_create / update_count_and_time / append_chat_turn_raw /
   append_item 一律写 aware UTC（杜绝新增 naive）。
"""
from datetime import datetime, timedelta, timezone

import pytest

from doclens.web_v2.sessions_store import (
    SessionItem,
    SessionSummary,
    SessionType,
    SessionsStore,
    _parse_db_ts,
)


@pytest.fixture()
def store(tmp_path):
    return SessionsStore(tmp_path / "sessions.db")


def _aware(days_ago: float = 0.0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days_ago)


def _insert_raw(store: SessionsStore, sid: str, updated_iso: str,
                type_: SessionType = SessionType.SEARCH) -> None:
    """绕过 API 直接写库，模拟历史遗留的任意格式行。"""
    with store._conn() as conn:
        conn.execute(
            """INSERT INTO sessions
               (id, type, title, preview, mode, created_at, updated_at, message_count)
               VALUES (?, ?, 'legacy', '', NULL, ?, ?, 0)""",
            (sid, type_.value, updated_iso, updated_iso),
        )


class TestParseDbTs:
    def test_naive_treated_as_utc(self):
        dt = _parse_db_ts("2026-08-31T08:00:00")
        assert dt.tzinfo is not None
        assert dt.utcoffset() == timedelta(0)

    def test_aware_passthrough(self):
        src = datetime(2026, 8, 31, 8, 0, tzinfo=timezone.utc)
        assert _parse_db_ts(src.isoformat()) == src

    def test_naive_value_preserved(self):
        """归一只补 tzinfo，不移动时间轴上的绝对时刻。"""
        assert _parse_db_ts("2026-08-31T08:00:00").replace(tzinfo=None) == \
            datetime(2026, 8, 31, 8, 0)


class TestReadNormalization:
    def test_list_mixed_rows_all_aware(self, store):
        """aware 行 + 遗留 naive 行混存，list() 输出全部 aware → 可安全排序。"""
        store.create(SessionSummary(
            id="aware1", type=SessionType.SEARCH, title="q", preview="",
            created_at=_aware(), updated_at=_aware(),
        ))
        _insert_raw(store, "naive1", "2026-08-01T00:00:00")

        summaries = store.list(SessionType.SEARCH)
        assert len(summaries) == 2
        # 修复前的 500 就炸在下面这行（naive vs aware 比较）
        ordered = sorted(summaries, key=lambda s: s.updated_at, reverse=True)
        assert all(s.updated_at.tzinfo is not None for s in ordered)
        assert ordered[0].id == "aware1"

    def test_get_detail_normalizes_naive_item_ts(self, store):
        store.create(SessionSummary(
            id="s1", type=SessionType.CHAT, title="t", preview="",
            created_at=_aware(), updated_at=_aware(),
        ))
        with store._conn() as conn:
            conn.execute(
                """INSERT INTO session_items (session_id, seq, kind, payload, created_at)
                   VALUES ('s1', 0, 'message_user', '{}', '2026-08-01T00:00:00')""",
            )
        items = store.get_detail("s1")
        assert items[0].created_at is not None
        assert items[0].created_at.tzinfo is not None


class TestWriteAware:
    def test_find_or_create_writes_aware(self, store):
        store.find_or_create(SessionType.SEARCH, "量子", "p", "keyword")
        summary = store.get(store.list(SessionType.SEARCH)[0].id)
        assert summary is not None
        assert summary.created_at.tzinfo is not None
        assert summary.updated_at.tzinfo is not None

    def test_update_count_and_time_writes_aware(self, store):
        sid = "u1"
        _insert_raw(store, sid, "2026-08-01T00:00:00", SessionType.CHAT)
        store.update_count_and_time(sid, 3)
        summary = store.get(sid)
        assert summary is not None
        assert summary.updated_at.tzinfo is not None
        assert summary.message_count == 3

    def test_append_chat_turn_raw_writes_aware(self, store):
        sid = "c1"
        _insert_raw(store, sid, "2026-08-01T00:00:00", SessionType.CHAT)
        store.append_chat_turn_raw(sid, [
            {"tool_use_id": "tu", "name": "search_kb", "input": {},
             "output": "o", "is_error": False},
        ], "raw text")
        items = store.get_detail(sid)
        assert all(it.created_at is not None and it.created_at.tzinfo is not None
                   for it in items)

    def test_append_item_normalizes_naive_input(self, store):
        store.create(SessionSummary(
            id="s1", type=SessionType.CHAT, title="t", preview="",
            created_at=_aware(), updated_at=_aware(),
        ))
        naive = datetime(2026, 8, 31, 8, 0)
        store.append_item(SessionItem(
            session_id="s1", seq=0, kind="message_user", payload="{}",
            created_at=naive,
        ))
        (item,) = store.get_detail("s1")
        assert item.created_at is not None
        assert item.created_at.tzinfo is not None


@pytest.mark.asyncio
async def test_list_sessions_endpoint_merge_path(store, monkeypatch):
    """端到端复现原 500 路径：list_sessions(type=None) 合并两 type 后排序。"""
    import doclens.web_v2.api.sessions as api_sessions

    store.create(SessionSummary(
        id="chat-aware", type=SessionType.CHAT, title="t", preview="",
        created_at=_aware(), updated_at=_aware(),
    ))
    _insert_raw(store, "search-naive", "2026-08-01T00:00:00", SessionType.SEARCH)
    monkeypatch.setattr(api_sessions, "_get_store", lambda: store)

    resp = await api_sessions.list_sessions(type=None, limit=10, offset=0)
    assert resp.returned == 2
    ids = {s.id for s in resp.sessions}
    assert ids == {"chat-aware", "search-naive"}
