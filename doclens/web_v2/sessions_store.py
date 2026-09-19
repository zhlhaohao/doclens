"""SQLite 持久化历史会话存储 + 登录会话（auth_sessions）。

Schema:
    sessions(id, type, title, preview, created_at, updated_at, message_count, starred)
    session_items(id, session_id, seq, kind, payload, created_at)
    rewind_snapshots(id, session_id, anchor_seq, payload, created_at)  -- ADR-0027
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


def _sanitize_tool_pairing(history: list[dict]) -> list[dict]:
    """剥除孤儿 tool_result 并维持角色交替（存量污染数据修复）。

    背景：旧版 raw_messages 落库因轮起点下标偏移（run_stream 头部注入
    context 消息对后移了历史），每轮多带了上一轮末尾的 2 条消息；当上一轮
    以工具链收尾时漏进的恰是 [user(tool_result), assistant(text)]，其
    tool_result 的 assistant tool_use 父消息在窗口之外——回放即产生孤儿
    tool_result，OpenAI 兼容后端（DeepSeek 等）直接 400：
    "messages with role 'tool' must be a response to a preceeding message
    with 'tool_calls'"。

    规则：user 消息中的 tool_result block 仅当其 tool_use_id 出现在紧邻的
    前一条 assistant 消息的 tool_use 集合中时保留，其余剥除；剥空的消息
    整条丢弃。连续同角色处置（与 get_chat_history._append 同款）：user/user
    相邻补 "(interrupted)" 填充（中断轮 400 防护）；assistant/assistant
    放行——压缩边界后摘要确认（"Understood."）紧跟 LLM 响应是真实请求
    形态，插填充反而使回放与真实请求前缀分叉（ADR-0026）。合法配对
    消息逐字节不动（前缀缓存）。
    """
    out: list[dict] = []
    for m in history:
        role = m.get("role")
        content = m.get("content")
        if role == "user" and isinstance(content, list):
            valid_ids: set = set()
            if out and out[-1].get("role") == "assistant":
                prev_content = out[-1].get("content")
                if isinstance(prev_content, list):
                    valid_ids = {
                        b.get("id")
                        for b in prev_content
                        if isinstance(b, dict) and b.get("type") == "tool_use"
                    }
            blocks = [
                b
                for b in content
                if not (isinstance(b, dict) and b.get("type") == "tool_result")
                or b.get("tool_use_id") in valid_ids
            ]
            if content and not blocks:
                continue  # 整条都是孤儿 tool_result → 丢弃
            if len(blocks) != len(content):
                m = {**m, "content": blocks}
        if out and m.get("role") == "user" and out[-1].get("role") == "user":
            out.append({"role": "assistant", "content": "(interrupted)"})
        out.append(m)
    return out


class SessionSummary(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    mode: Optional[str] = None  # search: 'keyword' | 'grep'；chat: 'skill'（技能会话，提取式引文策展）；其余 None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    starred: bool = False  # 加星即置顶 + 删除保护（2026-09-17）


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
    message_count INTEGER NOT NULL DEFAULT 0,
    starred      INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS rewind_snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    anchor_seq  INTEGER NOT NULL,
    payload     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rewind_snap_session
    ON rewind_snapshots(session_id, anchor_seq);

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
                # 迁移：加星功能（2026-09-17）补 starred 列
                if "starred" not in cols:
                    conn.execute(
                        "ALTER TABLE sessions ADD COLUMN starred INTEGER NOT NULL DEFAULT 0"
                    )
                # 迁移：mode='skill' 上线前的存量技能会话——首条 message_user
                # （按 seq 最小）以「[调用技能:」开头的 chat 会话补 mode。
                # 幂等：已有非空 mode 或首条不匹配的不会被更新；新库无数据 no-op
                conn.execute(
                    """
                    UPDATE sessions SET mode = 'skill'
                    WHERE type = 'chat' AND (mode IS NULL OR mode = '')
                      AND id IN (
                          SELECT session_id FROM (
                              SELECT session_id,
                                     json_extract(payload, '$.content') AS content,
                                     ROW_NUMBER() OVER (
                                         PARTITION BY session_id ORDER BY seq
                                     ) AS rn
                              FROM session_items WHERE kind = 'message_user'
                          )
                          WHERE rn = 1 AND content LIKE '[调用技能:%'
                      )
                    """
                )

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
                """SELECT id, type, title, preview, mode, created_at, updated_at,
                          message_count, starred
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
                    starred=bool(row["starred"]),
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

    def update_title(self, session_id: str, title: str) -> None:
        """人工改名（2026-09-17）：仅更新 title，**不**刷新 updated_at——
        历史列表按 updated_at 排序，改名是元数据修正，不应把会话顶到最前。"""
        with self._lock, self._conn() as conn:
            conn.execute(
                "UPDATE sessions SET title = ? WHERE id = ?",
                (title, session_id),
            )

    def set_starred(self, session_id: str, starred: bool) -> None:
        """加星/取消加星（2026-09-17）：仅更新 starred，**不**刷新 updated_at——
        置顶效果由 list() 的排序键（starred DESC, updated_at DESC）承担，
        加星顺序不打乱组内时间序。"""
        with self._lock, self._conn() as conn:
            conn.execute(
                "UPDATE sessions SET starred = ? WHERE id = ?",
                (1 if starred else 0, session_id),
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

    def append_raw_messages(self, session_id: str, messages: list[dict]) -> None:
        """追加一轮的原始消息序列（按 runner 轮内真实累积结构逐字节保存）。

        与 tool_trace 的拆对重建不同：单条 assistant 含全部 text/tool_use block、
        单条 user 含全部 tool_result——多工具/文本交错轮的回放与真实请求
        逐字节一致，跨轮前缀缓存不被结构差异打断。get_chat_history 对含
        本条目的轮优先回放 raw_messages，tool_trace/message_ai_raw 退为
        展示层与旧会话兜底。

        seq 按 MAX(seq) 续排；调用方在本轮 message_user 落库后调用即可。
        """
        if not messages:
            return
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT COALESCE(MAX(seq), -1) FROM session_items
                   WHERE session_id = ?""",
                (session_id,),
            ).fetchone()
            conn.execute(
                """INSERT INTO session_items
                   (session_id, seq, kind, payload, created_at)
                   VALUES (?, ?, 'raw_messages', ?, ?)""",
                (session_id, row[0] + 1,
                 json.dumps({"messages": messages}, ensure_ascii=False, default=str),
                 now),
            )

    def append_usage(self, session_id: str, usage: dict) -> None:
        """落库一轮的 token 用量（kind='usage'，2026-09-17），seq 按 MAX 续排。

        payload 含 input/output/cache_creation/cache_read 四字段 +
        context_window（宿主注入）；回放（get_chat_history）对未知 kind
        天然跳过，不进 LLM 上下文。
        """
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT COALESCE(MAX(seq), -1) FROM session_items
                   WHERE session_id = ?""",
                (session_id,),
            ).fetchone()
            conn.execute(
                """INSERT INTO session_items
                   (session_id, seq, kind, payload, created_at)
                   VALUES (?, ?, 'usage', ?, ?)""",
                (session_id, row[0] + 1,
                 json.dumps(usage, ensure_ascii=False), now),
            )

    def append_compacted(self, session_id: str, messages: list[dict], pre_tokens: int) -> None:
        """落库一次上下文压缩（kind='compacted'，ADR-0026 压缩即事实），seq 按 MAX 续排。

        payload 与 raw_messages 同构（{"messages": [...]}）另加 pre_tokens
        （压缩前估算）与 post_tokens（压缩后消息负载估算——直接调
        planify.context.compact.estimate_tokens 保持同式（ASCII ÷4 /
        非ASCII ≈1 token/字符），仅消息部分、不含 system prompt 与工具表，
        前端在「压缩晚于最近一次调用」时作为上下文占用的估算显示，下轮
        对话实测覆盖）。回放
        （get_chat_history）遇到本条目即**清空此前全部历史**再拼接
        messages——截断标记与压缩内容二合一；同会话多个边界只最后一个
        生效。调用方须在本轮 append_raw_messages 之前调用（回放顺序：
        compacted → 本轮 raw_messages）。
        """
        from planify.context.compact import estimate_tokens

        post_tokens = estimate_tokens(messages)
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT COALESCE(MAX(seq), -1) FROM session_items
                   WHERE session_id = ?""",
                (session_id,),
            ).fetchone()
            conn.execute(
                """INSERT INTO session_items
                   (session_id, seq, kind, payload, created_at)
                   VALUES (?, ?, 'compacted', ?, ?)""",
                (session_id, row[0] + 1,
                 json.dumps({"messages": messages,
                             "pre_tokens": pre_tokens,
                             "post_tokens": post_tokens},
                            ensure_ascii=False, default=str), now),
            )

    def append_microcompact(self, session_id: str, cleared_tool_use_ids: list[str]) -> None:
        """落库一轮微压缩（kind='microcompact'，ADR-0026），seq 按 MAX 续排。

        payload 存本轮实际清理的 tool_use_id 清单；回放按 id 把已回放消息
        中对应 tool_result 的内容替换为 "[cleared]"——重放与真实请求逐字节
        一致（80%–100% 阈值窗口内跨轮前缀不再分叉）。目标 id 不在回放
        历史（已被压缩边界清掉 / 本轮 raw 已是清理后内容）时为幂等 no-op。
        """
        if not cleared_tool_use_ids:
            return
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT COALESCE(MAX(seq), -1) FROM session_items
                   WHERE session_id = ?""",
                (session_id,),
            ).fetchone()
            conn.execute(
                """INSERT INTO session_items
                   (session_id, seq, kind, payload, created_at)
                   VALUES (?, ?, 'microcompact', ?, ?)""",
                (session_id, row[0] + 1,
                 json.dumps({"cleared_tool_use_ids": list(cleared_tool_use_ids)},
                            ensure_ascii=False), now),
            )

    # ---- 回退（ADR-0027：回退即事实）----

    def append_rewound(
        self,
        session_id: str,
        point_seq: int,
        files_restored: Optional[list] = None,
        files_deleted: Optional[list] = None,
    ) -> None:
        """落一条回退边界（kind='rewound'，截断投影标记），seq 按 MAX 续排。

        payload 记锚点（point_seq = 被回退到的 message_user 的 seq）+ 文件
        恢复结果摘要（审计用，回放不消费）。get_chat_history 回放经
        project_live_items 投影：死段 = 全部回退边界区间 [point, boundary]
        的并集（含锚点本身），其中条目（compacted / microcompact /
        skill_context / usage 等）全部不可见。
        """
        payload = {
            "point_seq": point_seq,
            "files_restored": files_restored or [],
            "files_deleted": files_deleted or [],
        }
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT COALESCE(MAX(seq), -1) FROM session_items
                   WHERE session_id = ?""",
                (session_id,),
            ).fetchone()
            conn.execute(
                """INSERT INTO session_items
                   (session_id, seq, kind, payload, created_at)
                   VALUES (?, ?, 'rewound', ?, ?)""",
                (session_id, row[0] + 1,
                 json.dumps(payload, ensure_ascii=False), now),
            )

    def append_rewind_snapshot(
        self, session_id: str, anchor_seq: int, tracked_backups: dict
    ) -> list:
        """落一条文件快照（轮次开始时调用），环形上限 100 条/会话。

        tracked_backups: {路径: {"backup_file_name": str|None, "version": int}}
        （None = 该时点文件不存在）。超上限删最旧，返回被驱逐快照的 payload
        列表——调用方据此清理孤儿备份文件（文件内容备份在
        ``.cortex/rewind/{session_id}/``，不归本库管）。
        """
        payload = json.dumps({"tracked_file_backups": tracked_backups},
                             ensure_ascii=False)
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._conn() as conn:
            conn.execute(
                """INSERT INTO rewind_snapshots
                   (session_id, anchor_seq, payload, created_at)
                   VALUES (?, ?, ?, ?)""",
                (session_id, anchor_seq, payload, now),
            )
            rows = conn.execute(
                """SELECT id, payload FROM rewind_snapshots
                   WHERE session_id = ? ORDER BY id DESC LIMIT -1 OFFSET 100""",
                (session_id,),
            ).fetchall()
            evicted = []
            for r in rows:
                conn.execute(
                    "DELETE FROM rewind_snapshots WHERE id = ?", (r["id"],)
                )
                try:
                    evicted.append(json.loads(r["payload"]))
                except (json.JSONDecodeError, TypeError):
                    continue
            return evicted

    def backfill_rewind_snapshot(self, session_id: str, path: str, entry: dict) -> bool:
        """把写前备份条目回填进**最新**快照（track_edit 通路，ADR-0027）。

        语义对齐 Claude Code 的 fileHistoryTrackEdit：本轮轮首快照先落库，
        写工具动手前的改前备份回填进该快照——锚点时点状态由此可恢复。
        最新快照已含该路径则跳过（幂等）；无任何快照返回 False（调用方
        应先建快照或放弃追踪）。
        """
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT id, payload FROM rewind_snapshots
                   WHERE session_id = ? ORDER BY id DESC LIMIT 1""",
                (session_id,),
            ).fetchone()
            if row is None:
                return False
            try:
                p = json.loads(row["payload"])
            except (json.JSONDecodeError, TypeError):
                p = {}
            backups = p.get("tracked_file_backups") if isinstance(p, dict) else None
            if not isinstance(backups, dict):
                backups = {}
            if path in backups:
                return True
            backups[path] = entry
            conn.execute(
                "UPDATE rewind_snapshots SET payload = ? WHERE id = ?",
                (json.dumps({"tracked_file_backups": backups},
                            ensure_ascii=False), row["id"]),
            )
            return True

    def list_rewind_snapshots(self, session_id: str) -> list:
        """全部文件快照（id 升序）：[{id, anchor_seq, tracked_file_backups, created_at}]。"""
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                """SELECT id, anchor_seq, payload, created_at
                   FROM rewind_snapshots WHERE session_id = ? ORDER BY id ASC""",
                (session_id,),
            ).fetchall()
        out = []
        for r in rows:
            try:
                p = json.loads(r["payload"])
            except (json.JSONDecodeError, TypeError):
                p = {}
            out.append({
                "id": r["id"],
                "anchor_seq": r["anchor_seq"],
                "tracked_file_backups": p.get("tracked_file_backups", {}),
                "created_at": r["created_at"],
            })
        return out

    def last_message_user_seq(self, session_id: str) -> Optional[int]:
        """最新一条 message_user 的 seq（chat.py 轮首快照的锚点）。"""
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT MAX(seq) FROM session_items
                   WHERE session_id = ? AND kind = 'message_user'""",
                (session_id,),
            ).fetchone()
        return row[0] if row and row[0] is not None else None

    def rewind_boundaries(self, session_id: str) -> list:
        """全部回退边界（seq 升序）：[(point_seq, boundary_seq)]。

        投影与展示层共用：死段 = 全部闭区间 [point, boundary] 的并集
        （project_live_items）；展示层每个边界各渲染一个折叠条。
        """
        items = self.get_detail(session_id)
        out = []
        for it in items:
            if it.kind != "rewound":
                continue
            try:
                p = json.loads(it.payload)
            except (json.JSONDecodeError, TypeError):
                continue
            if isinstance(p, dict) and isinstance(p.get("point_seq"), int):
                out.append((p["point_seq"], it.seq))
        return out

    def is_live_anchor(self, session_id: str, seq: int) -> bool:
        """seq 是否为一条**活** message_user（回退锚点校验：死段内不可再回退）。"""
        items = self.get_detail(session_id)
        target = next((it for it in items if it.seq == seq), None)
        if target is None or target.kind != "message_user":
            return False
        return any(it.seq == seq for it in self.project_live_items(items))

    def count_live_messages(self, session_id: str) -> int:
        """可见时间线的消息条数（message_user + message_ai，死段不计）——
        回退后 message_count 的重算口径（ADR-0027）。"""
        items = self.project_live_items(self.get_detail(session_id))
        return sum(1 for it in items if it.kind in ("message_user", "message_ai"))

    @staticmethod
    def project_live_items(items: list) -> list:
        """回退边界投影：死段 = **全部**回退边界区间的并集，滤掉死段条目。

        单条边界 i 的死段 = [point_i, boundary_i]（闭区间——锚点消息本身
        回填输入框，也算死）。多条边界取并集而非「最后一个生效」：在新对话
        里再次回退到更早锚点时，旧边界的死段必须继续压住——例如边界
        (0,4) 后新对话 5、6，再回退到 5，新边界 (5,7) 只盖 5..7，0..4
        靠旧边界仍死。无边界原样返回。
        """
        intervals = []
        for it in items:
            if it.kind == "rewound":
                try:
                    p = json.loads(it.payload)
                except (json.JSONDecodeError, TypeError):
                    continue
                if isinstance(p, dict) and isinstance(p.get("point_seq"), int):
                    intervals.append((p["point_seq"], it.seq))
        if not intervals:
            return items

        def _dead(seq: int) -> bool:
            return any(lo <= seq <= hi for lo, hi in intervals)

        return [it for it in items if not _dead(it.seq)]

    def upsert_skill_contexts(
        self,
        session_id: str,
        contexts: list[tuple[str, str]],
    ) -> int:
        """持久化 run_stream 注入的 skill body（<loaded-skill> 消息对）。

        动机（prompt 前缀缓存）：web 路径每轮从 DB 重建历史，注入消息若只在
        内存追加，skill body 每轮漂到当轮末尾 → 漂移点之后的全部前缀缓存失效。落库后回放
        出现在首次注入位置，跨轮请求变为纯尾部追加。

        - 按 (session_id, name) 幂等：同名条目已存在则跳过（内容变化原地 UPDATE——技能正文被编辑
          后回放与 runner 注入保持一致）；**压缩边界感知**——仅统计最后一个
          compacted 条目之后的 skill_context（边界前的条目回放已丢弃，视为
          不存在，压缩后同名技能以新 seq 重插，见 ADR-0026）；
        - 新条目插入到当前尾部条目（本轮 message_user，由前端在发送时写入）
          之前，复现 run_stream「注入在历史末尾、user query 之前」的内存位置。

        Args:
            contexts: (skill_name, 完整消息内容) 列表，按注入顺序；调用方须在本轮的
                append_chat_turn_raw 之前调用（此时尾部条目是本轮 message_user）。
        Returns: 新插入的条目数。
        """
        if not contexts:
            return 0
        with self._lock, self._conn() as conn:
            # 压缩边界感知（ADR-0026）：边界（kind='compacted'）之前的旧
            # skill_context 条目在回放中已被截断投影丢弃，但对下面的去重
            # 而言"仍存在"——若不排除，压缩后同名技能永远匹配旧条目而跳过
            # 插入，skill body 每轮漂到当轮末尾（前缀缓存漂移修复失效）。
            # 存在性只统计边界之后的条目；无 compacted 会话 boundary=-1，
            # 行为与历史版本一致。
            boundary_row = conn.execute(
                """SELECT COALESCE(MAX(seq), -1) FROM session_items
                   WHERE session_id = ? AND kind = 'compacted'""",
                (session_id,),
            ).fetchone()
            boundary = boundary_row[0]
            rows = conn.execute(
                """SELECT seq, payload FROM session_items
                   WHERE session_id = ? AND kind = 'skill_context' AND seq > ?""",
                (session_id, boundary),
            ).fetchall()
            existing: dict[str, tuple[int, str]] = {}
            for r in rows:
                try:
                    p = json.loads(r["payload"])
                except (json.JSONDecodeError, TypeError):
                    continue
                if isinstance(p, dict):
                    existing[p.get("name", "")] = (r["seq"], p.get("content", ""))

            fresh: list[tuple[str, str]] = []
            for name, content in contexts:
                if name in existing:
                    seq, old_content = existing[name]
                    if old_content != content:
                        conn.execute(
                            """UPDATE session_items SET payload = ?
                               WHERE session_id = ? AND kind = 'skill_context'
                                 AND seq = ?""",
                            (json.dumps({"name": name, "content": content},
                                        ensure_ascii=False), session_id, seq),
                        )
                    continue
                fresh.append((name, content))
            if not fresh:
                return 0

            row = conn.execute(
                """SELECT COALESCE(MAX(seq), -1) FROM session_items
                   WHERE session_id = ?""",
                (session_id,),
            ).fetchone()
            tail_seq = row[0]
            k = len(fresh)
            # 尾部条目（本轮 message_user）后移 k 位，新条目占据它之前的位置
            conn.execute(
                """UPDATE session_items SET seq = seq + ?
                   WHERE session_id = ? AND seq >= ?""",
                (k, session_id, tail_seq),
            )
            now = datetime.now(timezone.utc).isoformat()
            for i, (name, content) in enumerate(fresh):
                conn.execute(
                    """INSERT INTO session_items
                       (session_id, seq, kind, payload, created_at)
                       VALUES (?, ?, 'skill_context', ?, ?)""",
                    (session_id, tail_seq + i,
                     json.dumps({"name": name, "content": content},
                                ensure_ascii=False), now),
                )
            return k

    def delete(self, session_id: str) -> bool:
        """删除单个会话；加星会话受保护（2026-09-17），拒绝删除并返回 False。"""
        with self._lock, self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM sessions WHERE id = ? AND starred = 0", (session_id,),
            )
            return cur.rowcount > 0

    def delete_by_type(self, type_: Optional[SessionType]) -> tuple[int, int]:
        """批量删除某 type 的全部未加星会话。type_=None 时清空所有类型。

        session_items 通过 FK ON DELETE CASCADE 自动级联删除。
        加星会话（2026-09-17）受保护跳过；返回 (deleted, skipped_starred)。
        """
        with self._lock, self._conn() as conn:
            if type_ is None:
                skipped = conn.execute(
                    "SELECT COUNT(*) FROM sessions WHERE starred = 1",
                ).fetchone()[0]
                cur = conn.execute("DELETE FROM sessions WHERE starred = 0")
            else:
                skipped = conn.execute(
                    "SELECT COUNT(*) FROM sessions WHERE type = ? AND starred = 1",
                    (type_.value,),
                ).fetchone()[0]
                cur = conn.execute(
                    "DELETE FROM sessions WHERE type = ? AND starred = 0",
                    (type_.value,),
                )
            return cur.rowcount, skipped

    # ---- 读取 ----

    def list(self, type_: SessionType, limit: int = 50, offset: int = 0) -> list[SessionSummary]:
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                """SELECT id, type, title, preview, mode, created_at, updated_at,
                          message_count, starred
                   FROM sessions
                   WHERE type = ?
                   ORDER BY starred DESC, datetime(updated_at) DESC
                   LIMIT ? OFFSET ?""",
                (type_.value, limit, offset),
            ).fetchall()
        return [self._row_to_summary(r) for r in rows]

    def get(self, session_id: str) -> Optional[SessionSummary]:
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT id, type, title, preview, mode, created_at, updated_at,
                          message_count, starred
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
        - raw_messages → 本轮原始消息序列原样拼接（runner 真实累积结构，
          跨轮前缀缓存友好的关键）；含 raw_messages 的轮忽略其
          tool_trace / message_ai_raw / message_ai（展示层冗余副本）；
        - compacted → **压缩边界（截断投影，ADR-0026）**：清空此前全部
          回放（含本轮 message_user / skill_context——摘要覆盖全部历史），
          再拼接压缩后消息序列；同会话多个边界只最后一个生效；含
          compacted 的轮同样抑制 tool_trace/message_ai_raw 兜底（压缩
          中断轮 raw 为空时不得"复活"压缩前的旧工具链）；
        - microcompact → 微压缩重放（ADR-0026）：预扫描收集边界之后的
          cleared_tool_use_ids，回放中对已回放 tool_result 按 id 替换
          "[cleared]"——与 runner 真实请求逐字节一致；目标不存在时幂等 no-op；
        - tool_trace → assistant(tool_use) + user(tool_result) 成对回放
          （无 raw_messages 的旧轮兜底）；
        - skill_context → run_stream 注入的 skill body 原样回放（见
          upsert_skill_contexts）；
        - message_ai_raw（模型原始输出）优先于 message_ai（策展展示文本）；
        - rewound → 回退边界（截断投影，ADR-0027）：死段 = 全部回退边界
          区间 [point, boundary] 的并集（含锚点本身）；死段条目（含其中的
          压缩边界/微压缩/skill_context）全部不可见——死段内的 compacted
          不得清空活前缀；
        - 旧会话无 raw/tool_trace/compacted 条目时行为与之前一致。

        Returns:
            [{"role": "user"|"assistant", "content": str | list}, ...]，按 seq 升序。
        """
        items = self.project_live_items(self.get_detail(session_id))
        # 预扫描：最后一个压缩边界 + 边界之后的微压缩清理 id 并集。
        # 遇新边界清空已收集 ids——更早的清理目标已被截断投影丢弃。
        last_compacted_seq = -1
        cleared_ids: set[str] = set()
        for it in items:
            if it.kind == "compacted":
                last_compacted_seq = it.seq
                cleared_ids.clear()
            elif it.kind == "microcompact":
                try:
                    p = json.loads(it.payload)
                except (json.JSONDecodeError, TypeError):
                    continue
                if isinstance(p, dict):
                    ids = p.get("cleared_tool_use_ids")
                    if isinstance(ids, list):
                        cleared_ids.update(
                            i for i in ids if isinstance(i, str)
                        )

        # 按轮分组：message_user 是一轮的起点（前端在发送时写入，同轮的
        # tool_trace / message_ai_raw / message_ai 都排在它之后）
        turns: list[list[SessionItem]] = []
        for it in items:
            if it.kind == "message_user" or not turns:
                turns.append([it])
            else:
                turns[-1].append(it)

        history: list[dict] = []

        def _apply_cleared(role: str, content):
            """微压缩重放：被清理 id 的 tool_result 内容替换 "[cleared]"。"""
            if role != "user" or not isinstance(content, list) or not cleared_ids:
                return content
            return [
                {**b, "content": "[cleared]"}
                if isinstance(b, dict)
                and b.get("type") == "tool_result"
                and b.get("tool_use_id") in cleared_ids
                else b
                for b in content
            ]

        def _append(role: str, content) -> None:
            # 连续同角色：user/user 补 assistant 填充（中断轮「只有
            # message_user 没有 AI 回复」的 400 防护）；assistant/assistant
            # 放行——压缩边界后摘要确认紧跟 LLM 响应是真实请求形态，
            # 插填充反而使回放与真实请求前缀分叉（ADR-0026）。
            if history and history[-1]["role"] == role == "user":
                history.append({"role": "assistant", "content": "(interrupted)"})
            history.append({"role": role, "content": content})

        for turn in turns:
            # 含 raw_messages 的轮：原始结构原样回放，tool_trace/AI 文本忽略
            has_raw_messages = any(it.kind == "raw_messages" for it in turn)
            # 含 compacted 的轮：压缩边界（截断投影）。轮内更早的
            # message_user / skill_context 已被摘要覆盖（compacted 分支清空）；
            # 压缩轮的 tool_trace / message_ai_raw 是压缩前的旧数据，即使
            # raw 为空（压缩后立刻中断）也不得兜底复活（ADR-0026）。
            has_compacted = any(it.kind == "compacted" for it in turn)
            suppress_fallback = has_raw_messages or has_compacted
            ai_emitted = False
            ai_display_fallback = ""
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
                elif it.kind == "raw_messages":
                    for rm in payload.get("messages", []):
                        if not isinstance(rm, dict):
                            continue
                        r, c = rm.get("role"), rm.get("content")
                        if r in ("user", "assistant") and c:
                            _append(r, _apply_cleared(r, c))
                elif it.kind == "compacted":
                    # 截断投影：清空此前全部回放再拼压缩后消息序列
                    # （payload 与 raw_messages 同构）
                    history.clear()
                    for rm in payload.get("messages", []):
                        if not isinstance(rm, dict):
                            continue
                        r, c = rm.get("role"), rm.get("content")
                        if r in ("user", "assistant") and c:
                            _append(r, c)
                elif it.kind == "microcompact":
                    # 预扫描已按 id 重放（_apply_cleared），无逐条回放动作
                    continue
                elif it.kind == "tool_trace":
                    if suppress_fallback:
                        continue
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
                        "content": (
                            "[cleared]"
                            if tu_id in cleared_ids
                            else str(payload.get("output", ""))
                        ),
                        "is_error": bool(payload.get("is_error", False)),
                    }])
                elif it.kind == "skill_context":
                    # run_stream 注入的 skill body（见 upsert_skill_contexts）：
                    # 原样回放在首次注入位置，跨轮请求前缀稳定（缓存友好）
                    content = payload.get("content", "")
                    if content:
                        _append("user", content)
                        _append("assistant", "Noted.")
                elif it.kind == "message_ai_raw":
                    if suppress_fallback:
                        continue
                    # raw 按 seq 位置回放（旧逻辑推迟到轮末，会把 seq 位置
                    # 介于其间的 skill_context 挤到 AI 文本之前，破坏前缀）
                    content = payload.get("content", "")
                    if content and not ai_emitted:
                        _append("assistant", content)
                        ai_emitted = True
                elif it.kind == "message_ai":
                    # 策展展示文本只做兜底：raw 无论 seq 先后都优先（与旧逻辑一致）；
                    # 无 raw 时在轮末回放（legacy 会话无 skill_context，位置无影响）
                    content = payload.get("content", "")
                    if content and not ai_display_fallback:
                        ai_display_fallback = content
            if not ai_emitted and not suppress_fallback and ai_display_fallback:
                _append("assistant", ai_display_fallback)
        return _sanitize_tool_pairing(history)

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
            starred=bool(row["starred"]),
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
