"""SQLite 持久化历史会话存储 + 登录会话（auth_sessions）。

Schema:
    sessions(id, type, title, preview, created_at, updated_at, message_count)
    session_items(id, session_id, seq, kind, payload, created_at)
    auth_sessions(token, created_at, expires_at)   -- Web 登录会话（24h 滑动过期）

WAL 模式；session_items 通过外键 ON DELETE CASCADE 跟随 sessions 删除。
"""
from __future__ import annotations

import json
import secrets
import sqlite3
import threading
import ulid as _ulid
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import BaseModel


def _parse_db_ts(value: str) -> datetime:
    """DB 时间戳 → aware UTC。

    历史数据混存两种格式（POST /api/sessions 写 aware，旧 find_or_create/
    update_count_and_time 写 naive），naive/aware 直接比较会抛 TypeError
    （GET /api/sessions 合并排序 500 的根因）。此处统一归一：naive 视为
    UTC 补 tzinfo，aware 原样返回。
    """
    dt = datetime.fromisoformat(value)
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class SessionType(str, Enum):
    SEARCH = "search"
    CHAT = "chat"


class SessionSummary(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    mode: Optional[str] = None  # 搜索模式：'keyword' | 'grep'（chat 为 None）
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
    mode         TEXT,
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

CREATE TABLE IF NOT EXISTS auth_sessions (
    token      TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);
"""

# 登录会话滑动续期节流阈值：剩余有效期超过该值时不写库（避免每个 API 请求都写 SQLite）
_AUTH_TOUCH_REFRESH_THRESHOLD = timedelta(hours=23)


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
                # 迁移：旧库 sessions 表无 mode 列时补上（新库 _SCHEMA 已含）
                cols = {row[1] for row in conn.execute("PRAGMA table_info(sessions)")}
                if "mode" not in cols:
                    conn.execute("ALTER TABLE sessions ADD COLUMN mode TEXT")

    # ---- 写入 ----

    def create(self, s: SessionSummary) -> None:
        with self._lock, self._conn() as conn:
            conn.execute(
                """INSERT INTO sessions
                   (id, type, title, preview, mode, created_at, updated_at, message_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    s.id, s.type.value, s.title, s.preview, s.mode,
                    s.created_at.isoformat(), s.updated_at.isoformat(), s.message_count,
                ),
            )

    def find_or_create(
        self,
        type_: SessionType,
        title: str,
        preview: str = "",
        mode: Optional[str] = None,
    ) -> SessionSummary:
        """按 (type, title, mode) 原子地查找会话；命中则刷新 updated_at（并更新 preview），
        未命中则新建。整个过程持锁，避免并发条件下的重复创建。

        主要服务于 search 历史：相同关键词只保留一条记录，重复搜索时只置顶。
        mode 仅对 search 有意义；旧记录与 chat 的 mode 为 NULL，COALESCE 视作 'keyword'，
        使 keyword 与 NULL 不互相误并、grep 与 keyword 不合并。
        """
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT id, type, title, preview, mode, created_at, updated_at, message_count
                   FROM sessions
                   WHERE type = ? AND title = ?
                     AND COALESCE(mode, 'keyword') = COALESCE(?, 'keyword')
                   ORDER BY datetime(updated_at) DESC
                   LIMIT 1""",
                (type_.value, title, mode),
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
                    mode=row["mode"],
                    created_at=_parse_db_ts(row["created_at"]),
                    updated_at=now,
                    message_count=row["message_count"],
                )
            sid = str(_ulid.new())
            conn.execute(
                """INSERT INTO sessions
                   (id, type, title, preview, mode, created_at, updated_at, message_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0)""",
                (sid, type_.value, title, preview, mode, now_iso, now_iso),
            )
            return SessionSummary(
                id=sid, type=type_, title=title, preview=preview, mode=mode,
                created_at=now, updated_at=now, message_count=0,
            )

    def append_item(self, item: SessionItem) -> None:
        # 调用方未显式传时间时取当前 aware UTC；传入 naive 一并归一，
        # 保证库内 session_items.created_at 全为 aware 格式
        ts = item.created_at or datetime.now(timezone.utc)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        now = ts.isoformat()
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
                (message_count, datetime.now(timezone.utc).isoformat(), session_id),
            )

    def append_chat_turn_raw(
        self,
        session_id: str,
        tool_traces: list[dict],
        raw_text: str,
    ) -> None:
        """追加一轮对话的原始数据，供 LLM 上下文回放（与展示层条目分离）。

        - 每个已完成的工具调用写一条 tool_trace（input+output 成对，未完成的
          调用由调用方过滤，不落库）；
        - 模型原始输出写一条 message_ai_raw（未策展文本；策展仅作用于展示层
          的 message_ai，由前端写入）。

        seq 在同一事务内按 MAX(seq) 续排，与前端 PATCH 写入无冲突。
        """
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._conn() as conn:
            row = conn.execute(
                "SELECT COALESCE(MAX(seq), -1) FROM session_items WHERE session_id = ?",
                (session_id,),
            ).fetchone()
            seq = row[0]
            for tc in tool_traces:
                seq += 1
                conn.execute(
                    """INSERT INTO session_items (session_id, seq, kind, payload, created_at)
                       VALUES (?, ?, 'tool_trace', ?, ?)""",
                    (session_id, seq, json.dumps(tc, ensure_ascii=False), now),
                )
            if raw_text:
                seq += 1
                conn.execute(
                    """INSERT INTO session_items (session_id, seq, kind, payload, created_at)
                       VALUES (?, ?, 'message_ai_raw', ?, ?)""",
                    (session_id, seq, json.dumps({"content": raw_text}, ensure_ascii=False), now),
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
                """SELECT id, type, title, preview, mode, created_at, updated_at, message_count
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
                """SELECT id, type, title, preview, mode, created_at, updated_at, message_count
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
                payload=r["payload"], created_at=_parse_db_ts(r["created_at"]),
            )
            for r in rows
        ]

    def get_chat_history(self, session_id: str) -> list[dict]:
        """返回会话对话历史，适配 LLM 上下文格式（Anthropic messages）。

        回放规则：
        - message_user → user 文本消息（每轮开头，由前端在发送时写入）；
        - tool_trace → assistant(tool_use) + user(tool_result) 成对回放，
          恢复模型实际见过的工具链（prefix 缓存友好的关键）；
        - message_ai_raw（模型原始输出）优先于 message_ai（策展展示文本）；
        - 旧会话无 raw/tool_trace 条目时行为与之前一致。

        Returns:
            [{"role": "user"|"assistant", "content": str | list}, ...]，按 seq 升序。
        """
        # 按轮分组：message_user 是一轮的起点（前端在发送时写入，同轮的
        # tool_trace / message_ai_raw / message_ai 都排在它之后）
        turns: list[list[SessionItem]] = []
        for it in self.get_detail(session_id):
            if it.kind == "message_user" or not turns:
                turns.append([it])
            else:
                turns[-1].append(it)

        history: list[dict] = []

        def _append(role: str, content) -> None:
            # Anthropic 要求 role 严格交替；同角色相邻时补一条最小填充消息，
            # 避免中断轮（只有 message_user 没有 AI 回复）导致 400
            if history and history[-1]["role"] == role:
                filler = "user" if role == "assistant" else "assistant"
                history.append({"role": filler, "content": "(interrupted)"})
            history.append({"role": role, "content": content})

        for turn in turns:
            ai_raw = ""
            ai_display = ""
            for it in turn:
                try:
                    payload = json.loads(it.payload)
                except (json.JSONDecodeError, TypeError):
                    continue
                if not isinstance(payload, dict):
                    continue
                if it.kind == "message_user":
                    content = payload.get("content", "")
                    if content:
                        _append("user", content)
                elif it.kind == "tool_trace":
                    tu_id = payload.get("tool_use_id", "")
                    if not tu_id:
                        continue
                    _append("assistant", [{
                        "type": "tool_use",
                        "id": tu_id,
                        "name": payload.get("name", ""),
                        "input": payload.get("input") or {},
                    }])
                    _append("user", [{
                        "type": "tool_result",
                        "tool_use_id": tu_id,
                        "content": str(payload.get("output", "")),
                        "is_error": bool(payload.get("is_error", False)),
                    }])
                elif it.kind == "message_ai_raw":
                    ai_raw = payload.get("content", "") or ai_raw
                elif it.kind == "message_ai":
                    ai_display = payload.get("content", "") or ai_display
            final = ai_raw or ai_display
            if final:
                _append("assistant", final)
        return history

    @staticmethod
    def _row_to_summary(row: sqlite3.Row) -> SessionSummary:
        return SessionSummary(
            id=row["id"],
            type=SessionType(row["type"]),
            title=row["title"],
            preview=row["preview"],
            mode=row["mode"],
            created_at=_parse_db_ts(row["created_at"]),
            updated_at=_parse_db_ts(row["updated_at"]),
            message_count=row["message_count"],
        )

    # ---- 登录会话（auth_sessions）----

    def create_auth_session(self, ttl_hours: int = 24) -> str:
        """签发登录会话，返回 token。"""
        token = secrets.token_urlsafe(32)
        now = datetime.utcnow()
        expires = now + timedelta(hours=ttl_hours)
        with self._lock, self._conn() as conn:
            conn.execute(
                "INSERT INTO auth_sessions (token, created_at, expires_at) VALUES (?, ?, ?)",
                (token, now.isoformat(), expires.isoformat()),
            )
        self.purge_expired_auth_sessions()
        return token

    def validate_auth_session(
        self,
        token: str,
        *,
        touch: bool = True,
        ttl_hours: int = 24,
        now: Optional[datetime] = None,
    ) -> bool:
        """校验登录会话存在且未过期。

        touch=True 时滑动续期：剩余有效期不足阈值才把 expires_at 顺延为
        now + ttl（节流，避免每个请求都写库）。now 可注入以便测试。
        """
        now = now or datetime.utcnow()
        with self._lock, self._conn() as conn:
            row = conn.execute(
                "SELECT expires_at FROM auth_sessions WHERE token = ?", (token,)
            ).fetchone()
            if row is None:
                return False
            expires = datetime.fromisoformat(row["expires_at"])
            if expires <= now:
                conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
                return False
            if touch and expires - now < _AUTH_TOUCH_REFRESH_THRESHOLD:
                new_expires = now + timedelta(hours=ttl_hours)
                conn.execute(
                    "UPDATE auth_sessions SET expires_at = ? WHERE token = ?",
                    (new_expires.isoformat(), token),
                )
            return True

    def delete_auth_session(self, token: str) -> None:
        with self._lock, self._conn() as conn:
            conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))

    def revoke_all_auth_sessions(self) -> int:
        """吊销全部登录会话，返回删除条数。"""
        with self._lock, self._conn() as conn:
            cur = conn.execute("DELETE FROM auth_sessions")
            return cur.rowcount

    def purge_expired_auth_sessions(self) -> int:
        """清理已过期登录会话，返回删除条数。"""
        now = datetime.utcnow().isoformat()
        with self._lock, self._conn() as conn:
            cur = conn.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (now,))
            return cur.rowcount
