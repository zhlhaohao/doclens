# -*- coding: utf-8 -*-
"""sessions_store 连接必须关闭（AP-44）。

`sqlite3.Connection` 的上下文管理器只 commit/rollback，**不关闭**；全库
32 处 `with self._conn() as conn` 原本都把句柄留给 GC。WAL 下残留
`-wal/-shm` 句柄随请求增长，长驻进程表现为句柄与内存缓慢上涨。
"""
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

import pytest

from doclens.web_v2.sessions_store import (
    SessionSummary,
    SessionType,
    SessionsStore,
)

_NOW = datetime.now(timezone.utc)


@pytest.fixture()
def store(tmp_path) -> SessionsStore:
    return SessionsStore(tmp_path / "sessions.db")


def _create(store, sid="s1"):
    store.create(SessionSummary(
        id=sid, type=SessionType.CHAT, title="t", preview="",
        created_at=_NOW, updated_at=_NOW, message_count=0,
    ))


class _Tracked:
    """记录所有创建过的连接（并保留弱引用以便判定是否已关闭）。"""

    def __init__(self):
        self.created: list[sqlite3.Connection] = []
        self._real = sqlite3.connect

    def __call__(self, *a, **kw):
        conn = self._real(*a, **kw)
        self.created.append(conn)
        return conn

    @staticmethod
    def closed_after(conn) -> bool:
        try:
            conn.execute("SELECT 1")
        except sqlite3.ProgrammingError:
            return True
        return False


class TestConnectionClosed:
    def test_conn_context_closes(self, store, monkeypatch):
        tracked = _Tracked()
        monkeypatch.setattr(sqlite3, "connect", tracked)
        with store._conn() as conn:
            assert conn.execute("SELECT 1").fetchone()[0] == 1
        assert len(tracked.created) == 1
        assert _Tracked.closed_after(tracked.created[0]) is True

    def test_read_method_closes(self, store, monkeypatch):
        _create(store)
        tracked = _Tracked()
        monkeypatch.setattr(sqlite3, "connect", tracked)
        store.get("s1")
        store.list(SessionType.CHAT)
        assert tracked.created, "至少开过一次连接"
        assert all(_Tracked.closed_after(c) for c in tracked.created)

    def test_write_method_closes(self, store, monkeypatch):
        _create(store)
        tracked = _Tracked()
        monkeypatch.setattr(sqlite3, "connect", tracked)
        store.ensure_message_user("s1", "hi")
        store.append_message_ai("s1", "yo", [])
        store.count_live_messages("s1")
        assert all(_Tracked.closed_after(c) for c in tracked.created)

    def test_closed_on_exception(self, store, monkeypatch):
        """异常路径也必须关闭（原实现连 close 都没有，谈不上路径区分）。"""
        _create(store)
        tracked = _Tracked()
        monkeypatch.setattr(sqlite3, "connect", tracked)
        with pytest.raises(sqlite3.OperationalError):
            with store._conn() as conn:
                conn.execute("INSERT INTO no_such_table VALUES (1)")
        assert all(_Tracked.closed_after(c) for c in tracked.created)

    def test_commit_semantics_preserved(self, store, monkeypatch):
        """正常退出要 commit（`with conn` 的原语义不能丢）。"""
        _create(store)
        store.append_message_ai("s1", "persisted", [])
        # 新连接读取：能看到刚提交的写入
        with store._conn() as conn:
            rows = conn.execute(
                "SELECT COUNT(*) FROM session_items WHERE session_id='s1'"
            ).fetchone()[0]
        assert rows == 1

    def test_rollback_on_error(self, store):
        _create(store)
        with pytest.raises(sqlite3.OperationalError):
            with store._conn() as conn:
                conn.execute(
                    "INSERT INTO session_items (session_id, seq, kind, payload, created_at)"
                    " VALUES ('s1', 99, 'x', '{}', 'now')"
                )
                conn.execute("INSERT INTO no_such_table VALUES (1)")
        with store._conn() as conn:
            n = conn.execute(
                "SELECT COUNT(*) FROM session_items WHERE seq=99"
            ).fetchone()[0]
        assert n == 0, "异常路径必须回滚"

    def test_concurrent_methods_do_not_leak(self, store, monkeypatch):
        """并发调用后所有连接均已关闭（句柄不随请求增长）。"""
        _create(store)
        tracked = _Tracked()
        monkeypatch.setattr(sqlite3, "connect", tracked)
        errors = []

        def work(i):
            try:
                store.ensure_message_user("s1", f"q{i}")
                store.list(SessionType.CHAT)
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)

        threads = [threading.Thread(target=work, args=(i,)) for i in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(10)

        assert errors == [], errors[:3]
        assert all(_Tracked.closed_after(c) for c in tracked.created)
