"""SQLite 持久化历史会话存储。

Schema:
    sessions(id, type, title, preview, created_at, updated_at, message_count)
    session_items(id, session_id, seq, kind, payload, created_at)

WAL 模式；session_items 通过外键 ON DELETE CASCADE 跟随 sessions 删除。
"""
from __future__ import annotations

import json
import sqlite3
import threading
import ulid as _ulid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import BaseModel


class SessionType(str, Enum):
    SEARCH = "search"
    CHAT = "chat"


class SessionSummary(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class SessionItem(BaseModel):
    session_id: str
    seq: int
    kind: str  # message_user / message_ai / result
    payload: str  # JSON 字符串
    created_at: Optional[datetime] = None


_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    type         TEXT NOT NULL,
    title        TEXT NOT NULL,
    preview      TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_type_updated
    ON sessions(type, updated_at DESC);

CREATE TABLE IF NOT EXISTS session_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,
    kind        TEXT NOT NULL,
    payload     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_session ON session_items(session_id, seq);
"""


class SessionsStore:
    """线程安全的 SQLite 历史会话存储。"""

    def __init__(self, db_path: Path | str):
        self._db_path = str(db_path)
        self._lock = threading.RLock()
        self._init_schema()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._lock:
            with self._conn() as conn:
                conn.executescript(_SCHEMA)

    # ---- 写入 ----

    def create(self, s: SessionSummary) -> None:
        with self._lock, self._conn() as conn:
            conn.execute(
                """INSERT INTO sessions
                   (id, type, title, preview, created_at, updated_at, message_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    s.id, s.type.value, s.title, s.preview,
                    s.created_at.isoformat(), s.updated_at.isoformat(), s.message_count,
                ),
            )

    def find_or_create(
        self,
        type_: SessionType,
        title: str,
        preview: str = "",
    ) -> SessionSummary:
        """按 (type, title) 原子地查找会话；命中则刷新 updated_at（并更新 preview），
        未命中则新建。整个过程持锁，避免并发条件下的重复创建。

        主要服务于 search 历史：相同关键词只保留一条记录，重复搜索时只置顶。
        """
        now = datetime.utcnow()
        now_iso = now.isoformat()
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT id, type, title, preview, created_at, updated_at, message_count
                   FROM sessions
                   WHERE type = ? AND title = ?
                   ORDER BY datetime(updated_at) DESC
                   LIMIT 1""",
                (type_.value, title),
            ).fetchone()
            if row is not None:
                conn.execute(
                    """UPDATE sessions SET updated_at = ?, preview = ? WHERE id = ?""",
                    (now_iso, preview, row["id"]),
                )
                return SessionSummary(
                    id=row["id"],
                    type=SessionType(row["type"]),
                    title=row["title"],
                    preview=preview,
                    created_at=datetime.fromisoformat(row["created_at"]),
                    updated_at=now,
                    message_count=row["message_count"],
                )
            sid = str(_ulid.new())
            conn.execute(
                """INSERT INTO sessions
                   (id, type, title, preview, created_at, updated_at, message_count)
                   VALUES (?, ?, ?, ?, ?, ?, 0)""",
                (sid, type_.value, title, preview, now_iso, now_iso),
            )
            return SessionSummary(
                id=sid, type=type_, title=title, preview=preview,
                created_at=now, updated_at=now, message_count=0,
            )

    def append_item(self, item: SessionItem) -> None:
        now = (item.created_at or datetime.utcnow()).isoformat()
        with self._lock, self._conn() as conn:
            conn.execute(
                """INSERT INTO session_items (session_id, seq, kind, payload, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (item.session_id, item.seq, item.kind, item.payload, now),
            )

    def update_count_and_time(self, session_id: str, message_count: int) -> None:
        with self._lock, self._conn() as conn:
            conn.execute(
                """UPDATE sessions
                   SET message_count = ?, updated_at = ?
                   WHERE id = ?""",
                (message_count, datetime.utcnow().isoformat(), session_id),
            )

    def delete(self, session_id: str) -> None:
        with self._lock, self._conn() as conn:
            conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

    def delete_by_type(self, type_: Optional[SessionType]) -> int:
        """批量删除某 type 的全部会话。type_=None 时清空所有。返回删除条数。

        session_items 通过 FK ON DELETE CASCADE 自动级联删除。
        """
        with self._lock, self._conn() as conn:
            if type_ is None:
                cur = conn.execute("DELETE FROM sessions")
            else:
                cur = conn.execute("DELETE FROM sessions WHERE type = ?", (type_.value,))
            return cur.rowcount

    # ---- 读取 ----

    def list(self, type_: SessionType, limit: int = 50, offset: int = 0) -> list[SessionSummary]:
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                """SELECT id, type, title, preview, created_at, updated_at, message_count
                   FROM sessions
                   WHERE type = ?
                   ORDER BY datetime(updated_at) DESC
                   LIMIT ? OFFSET ?""",
                (type_.value, limit, offset),
            ).fetchall()
        return [self._row_to_summary(r) for r in rows]

    def get(self, session_id: str) -> Optional[SessionSummary]:
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT id, type, title, preview, created_at, updated_at, message_count
                   FROM sessions WHERE id = ?""",
                (session_id,),
            ).fetchone()
        return self._row_to_summary(row) if row else None

    def get_detail(self, session_id: str) -> list[SessionItem]:
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                """SELECT session_id, seq, kind, payload, created_at
                   FROM session_items WHERE session_id = ?
                   ORDER BY seq ASC""",
                (session_id,),
            ).fetchall()
        return [
            SessionItem(
                session_id=r["session_id"], seq=r["seq"], kind=r["kind"],
                payload=r["payload"], created_at=datetime.fromisoformat(r["created_at"]),
            )
            for r in rows
        ]

    @staticmethod
    def _row_to_summary(row: sqlite3.Row) -> SessionSummary:
        return SessionSummary(
            id=row["id"],
            type=SessionType(row["type"]),
            title=row["title"],
            preview=row["preview"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            message_count=row["message_count"],
        )
