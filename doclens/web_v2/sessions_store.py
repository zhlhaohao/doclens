"""SQLite 持久化历史会话存储 + 登录会话（auth_sessions）。

Schema:
    sessions(id, type, title, preview, created_at, updated_at, message_count, starred)
    session_items(id, session_id, seq, kind, payload, created_at)
    rewind_snapshots(id, session_id, anchor_seq, payload, created_at)  -- ADR-0027
    auth_sessions(token, created_at, expires_at)   -- Web 登录会话（24h 滑动过期）

WAL 模式；session_items 通过外键 ON DELETE CASCADE 跟随 sessions 删除。
"""
from __future__ import annotations

import contextlib
import json
import secrets
import sqlite3
import threading
import ulid as _ulid
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from contextlib import AbstractContextManager
from typing import Iterator, Optional

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


# ---------------------------------------------------------------------------
# 回放原语（get_chat_history 拆分后的公共件，AP-7）
# ---------------------------------------------------------------------------

def _append_paired(history: list[dict], role: str, content) -> None:
    """追加一条回放消息，并处理连续同角色。

    user/user 补 assistant 填充（中断轮「只有 message_user 没有 AI 回复」的
    400 防护）；assistant/assistant 放行——压缩边界后摘要确认紧跟 LLM 响应是
    真实请求形态，插填充反而使回放与真实请求前缀分叉（ADR-0026）。
    """
    if history and history[-1]["role"] == role == "user":
        history.append({"role": "assistant", "content": "(interrupted)"})
    history.append({"role": role, "content": content})


def _clear_marked_content(role: str, content, cleared_ids: set[str]):
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


def _replay_tool_trace(payload: dict, history: list[dict], cleared_ids: set[str]) -> None:
    """tool_trace → assistant(tool_use) + user(tool_result) 成对回放（旧轮兜底）。"""
    tu_id = payload.get("tool_use_id", "")
    if not tu_id:
        return
    _append_paired(history, "assistant", [{
        "type": "tool_use",
        "id": tu_id,
        "name": payload.get("name", ""),
        "input": payload.get("input") or {},
    }])
    _append_paired(history, "user", [{
        "type": "tool_result",
        "tool_use_id": tu_id,
        "content": (
            "[cleared]" if tu_id in cleared_ids else str(payload.get("output", ""))
        ),
        "is_error": bool(payload.get("is_error", False)),
    }])


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

#: 每会话回退快照的环形上限（AP-21：docstring 与 SQL 曾各写一次 100）
REWIND_SNAPSHOT_RING_MAX = 100
#: 会话标题长度上限（AP-21：Pydantic 校验 / API 截断 / 复制截断曾各写 200）。
#: 定义在此而非 models/session.py——models 已从本模块 import SessionType，
#: 反向 import 会成环。
SESSION_TITLE_MAX = 1000


class _SessionDB:
    """连接原语 + schema 迁移（四个协作类共享）。

    无业务语义：只管「怎么连、连上后补齐表结构」。每方法新开连接的成本与
    事务粒度问题见 AP-8，不属本次重组范围。
    """

    def __init__(self, db_path: Path | str):
        self._db_path = str(db_path)
        self._lock = threading.RLock()
        self._init_schema()

    @contextlib.contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        """打开一条连接并**保证关闭**（AP-44）。

        `sqlite3.Connection` 的上下文管理器只 commit/rollback，**不关闭**——
        全库 32 处 `with self._conn() as conn` 原本都把句柄留给 GC。WAL 下
        残留 `-wal/-shm` 句柄随请求增长，长驻进程表现为句柄与内存缓慢上涨。

        语义与 `with conn:` 保持一致：正常退出 commit，异常 rollback 后上抛，
        两条路径都 close。
        """
        conn = sqlite3.connect(self._db_path)
        try:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA foreign_keys=ON;")
            conn.row_factory = sqlite3.Row
            try:
                yield conn
            except BaseException:
                conn.rollback()
                raise
            conn.commit()
        finally:
            conn.close()

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


class _StorePart:
    """协作类公共基类：连接与锁取自共享的 `_SessionDB`。

    拆分前提（AP-7）：四个协作类必须共用**同一个** `_SessionDB` 实例，
    否则各自持一把 RLock，跨域写（会话落库 vs token 续期）不再互斥。
    """

    def __init__(self, db: "_SessionDB"):
        self._db = db

    @property
    def _lock(self) -> "threading.RLock":
        return self._db._lock

    def _conn(self) -> "AbstractContextManager[sqlite3.Connection]":
        """共享连接的上下文管理器（进入即开、退出必关，AP-44）。"""
        return self._db._conn()


class _AuthSessionStore(_StorePart):
    """登录会话（auth_sessions 表）：token 签发 / 校验 / 续期 / 清理。

    与对话归档彻底解耦——鉴权热路径（每个 HTTP 请求一次校验）不再与
    会话写入共享同一个类（AP-7），改动 token 策略不必读对话代码。
    """

    def create_auth_session(self, ttl_hours: int) -> str:
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
        ttl_hours: int,
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

class _RewindSnapshotStore(_StorePart):
    """回退文件快照（rewind_snapshots 表，ADR-0027 回退即事实）。

    只管快照行的存取与环形驱逐；回退边界投影（rewound 条目）属回放逻辑，
    留在主存储（`SessionsStore.project_live_items`）。
    """

    def append_rewind_snapshot(
        self, session_id: str, anchor_seq: int, tracked_backups: dict
    ) -> tuple:
        """落一条文件快照（轮次开始时调用），环形上限 REWIND_SNAPSHOT_RING_MAX 条/会话。

        tracked_backups: {路径: {"backup_file_name": str|None, "version": int}}
        （None = 该时点文件不存在）。超上限删最旧，返回 ``(被驱逐快照的
        payload 列表, 幸存快照引用的全部备份文件名集合)``——驱逐清单供
        调用方清孤儿备份文件，幸存引用集合免掉为同一目的的第二次全量
        查询（文件内容备份在 ``.cortex/rewind/{session_id}/``，不归本库管）。
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
                   WHERE session_id = ? ORDER BY id DESC LIMIT -1 OFFSET ?""",
                (session_id, REWIND_SNAPSHOT_RING_MAX),
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
            survivors = conn.execute(
                """SELECT payload FROM rewind_snapshots
                   WHERE session_id = ?""",
                (session_id,),
            ).fetchall()
            referenced = set()
            for r in survivors:
                try:
                    p = json.loads(r["payload"])
                except (json.JSONDecodeError, TypeError):
                    continue
                for entry in p.get("tracked_file_backups", {}).values():
                    name = entry.get("backup_file_name")
                    if name:
                        referenced.add(name)
            return evicted, referenced

    def latest_rewind_snapshot(self, session_id: str) -> Optional[dict]:
        """最新一条文件快照（无则 None）：{anchor_seq, tracked_file_backups}。

        写前备份路径（``_track``）的快照读取入口——每条新快照都全量继承
        前一路径集（begin_turn 结转 + backfill 只写最新），「每路径最新
        条目」恒等于最新一条快照的内容，无需全量读归并（全量归并只留给
        低频的恢复规划）。
        """
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT anchor_seq, payload FROM rewind_snapshots
                   WHERE session_id = ? ORDER BY id DESC LIMIT 1""",
                (session_id,),
            ).fetchone()
        if row is None:
            return None
        try:
            p = json.loads(row["payload"])
        except (json.JSONDecodeError, TypeError):
            p = {}
        return {
            "anchor_seq": row["anchor_seq"],
            "tracked_file_backups": p.get("tracked_file_backups", {}),
        }

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

    def shift_anchors(
        self,
        session_id: str,
        from_seq: int,
        delta: int,
        conn: Optional[sqlite3.Connection] = None,
    ) -> int:
        """坐标重映射（AP-30）：``session_items.seq`` 整体后移后同步快照锚点。

        ``anchor_seq`` 是 ``message_user`` 的 seq 外键。任何重排 seq 的写路径
        都必须连带调用本方法，否则回退会找不到目标快照而静默降级。

        Args:
            from_seq: 被后移区间的最小 seq（与重排 SQL 的 ``WHERE seq >= ?`` 同值）。
            delta: 位移量。
            conn: 复用调用方连接——**必须**与自己那条重排 SQL 处于同一事务，
                否则两者可能只成功一半。``None`` 时独立事务（仅供外部核对用）。
        """
        if delta == 0:
            return 0

        def _run(c: sqlite3.Connection) -> int:
            return c.execute(
                """UPDATE rewind_snapshots SET anchor_seq = anchor_seq + ?
                   WHERE session_id = ? AND anchor_seq >= ?""",
                (delta, session_id, from_seq),
            ).rowcount

        if conn is not None:
            return _run(conn)
        with self._lock, self._conn() as own:
            return _run(own)

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

class _SessionPortability(_StorePart):
    """单会话全保真导出 / 导入（ADR-0038 跨实例记忆转移）。

    自带格式版本与结构校验，与实时读写互不感知——改导出格式不必触碰
    会话落库路径。
    """

    EXPORT_FORMAT_VERSION = 1  # 结构演进时 +1，导入端按已知版本分支向后兼容

    # 截断导出的标题后缀（与 duplicate 的「(副本)」同属可区分快照命名）
    _UPTO_TITLE_TMPL = "{title}（导出至 {count} 条消息）"

    def export_session(
        self, session_id: str, upto_seq: Optional[int] = None
    ) -> Optional[dict]:
        """单会话全保真导出（ADR-0038）——sessions 行 + **全部**
        session_items 原始行（含死段、compacted/rewound 边界、usage、
        skill_context；raw payload 字符串原样透传，不做 JSON 重排）。

        不导 rewind_snapshots（引用 .cortex/rewind/ 机器本地文件备份）
        与 auth_sessions。会话不存在返回 None。

        ``upto_seq`` 非空 = **截断导出（导出到此为止）**：只导 seq ≤ 锚点
        的条目（锚点为一条活 message_user，调用方校验），产物是**新 id 的
        独立快照**而非源会话本体（见 ``_truncate_snapshot``）；空 = 原全量
        导出，语义与 ADR-0038 完全一致。
        """
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT id, type, title, preview, mode, created_at,
                          updated_at, message_count, starred
                   FROM sessions WHERE id = ?""",
                (session_id,),
            ).fetchone()
            if row is None:
                return None
            sql = (
                "SELECT seq, kind, payload, created_at FROM session_items "
                "WHERE session_id = ?"
            )
            params: list = [session_id]
            if upto_seq is not None:
                sql += " AND seq <= ?"
                params.append(upto_seq)
            items = conn.execute(sql + " ORDER BY seq ASC", params).fetchall()
        session = dict(row)
        rows = [dict(i) for i in items]
        if upto_seq is not None:
            session = self._truncate_snapshot(session, rows, upto_seq)
        return {
            "format": self.EXPORT_FORMAT_VERSION,
            "session": session,
            "items": rows,
        }

    @staticmethod
    def _truncate_snapshot(session: dict, rows: list, upto_seq: int) -> dict:
        """截断导出 = 独立快照（2026-10-29）。

        与全量导出的本质差别：后者是「同一会话的转移」（同 id，导入端
        同 id 跳过），前者是「在锚点处切一段的派生会话」——沿用同 id 会
        被导入端当重复静默跳过（同实例导入即完全失效），因此换新 id +
        标题后缀；message_count 按截断后的**活投影**重算，updated_at 取
        锚点条目时间（快照点），starred 不继承（同 duplicate）。
        """
        live = SessionsStore.project_live_items([
            SessionItem(
                session_id=session["id"], seq=r["seq"], kind=r["kind"],
                payload=r["payload"], created_at=None,
            )
            for r in rows
        ])
        count = sum(
            1 for it in live if it.kind in ("message_user", "message_ai")
        )
        anchor = next((r for r in rows if r["seq"] == upto_seq), None)
        return {
            **session,
            "id": str(_ulid.new()),
            "title": _SessionPortability._UPTO_TITLE_TMPL.format(
                title=session["title"], count=count
            )[:SESSION_TITLE_MAX],
            "message_count": count,
            "updated_at": anchor["created_at"] if anchor else session["updated_at"],
            "starred": 0,
        }

    @staticmethod
    def _validate_import(data: dict) -> tuple[str, dict, list]:
        """导入结构校验（不语义校验，ADR-0038）：版本号 / session 必填
        字段 / items 字段类型。失败抛 ValueError（API 层转 400）。

        Returns:
            (session_id, session_row, item_rows)——可直接落库的原始行。
        """
        if not isinstance(data, dict):
            raise ValueError("文件根必须是 JSON 对象")
        fmt = data.get("format")
        if fmt != _SessionPortability.EXPORT_FORMAT_VERSION:
            raise ValueError(
                f"文件版本不支持（format={fmt!r}，本机支持 "
                f"{_SessionPortability.EXPORT_FORMAT_VERSION}）"
            )
        s = data.get("session")
        if not isinstance(s, dict):
            raise ValueError("缺少 session 字段")
        for field in ("id", "type", "title", "created_at", "updated_at"):
            if not isinstance(s.get(field), str) or not s[field]:
                raise ValueError(f"session.{field} 缺失或非字符串")
        if s["type"] not in (t.value for t in SessionType):
            raise ValueError(f"session.type 非法：{s['type']!r}")
        items = data.get("items")
        if not isinstance(items, list):
            raise ValueError("缺少 items 字段或非数组")
        for i, it in enumerate(items):
            if not isinstance(it, dict):
                raise ValueError(f"items[{i}] 非对象")
            if not isinstance(it.get("kind"), str) or not it["kind"]:
                raise ValueError(f"items[{i}].kind 缺失或非字符串")
            if not isinstance(it.get("payload"), str):
                raise ValueError(f"items[{i}].payload 缺失或非字符串")
            try:
                json.loads(it["payload"])
            except (json.JSONDecodeError, TypeError):
                raise ValueError(f"items[{i}].payload 不是合法 JSON")
        # 落库行：补齐可空列默认值，seq 用文件原值（保序）
        session_row = {
            "id": s["id"],
            "type": s["type"],
            "title": s["title"],
            "preview": s.get("preview") or "",
            "mode": s.get("mode"),
            "created_at": s["created_at"],
            "updated_at": s["updated_at"],
            "message_count": s.get("message_count") or 0,
            "starred": 1 if s.get("starred") else 0,
        }
        item_rows = [
            {
                "seq": it.get("seq") if isinstance(it.get("seq"), int) else i + 1,
                "kind": it["kind"],
                "payload": it["payload"],
                "created_at": it.get("created_at") or s["created_at"],
            }
            for i, it in enumerate(items)
        ]
        return s["id"], session_row, item_rows

    # 导入目录切换提示轮（ADR-0038 后续）：历史工具轨迹里的绝对路径指向
    # 源机器工作目录，续聊时模型会沿用旧路径写文件。导入时在末尾追加一轮
    # user（目录已改，注意相对路径/旧绝对路径作废）+ ai（明白）的合成对话，
    # 进入 LLM 回放上下文纠正后续行为。此轮是宿主侧事实声明，非用户真话，
    # 文案带固定前缀标记。
    _DIR_SWITCH_USER_TMPL = (
        "[系统提示] 本会话由其他工作目录导入。当前工作目录已改为：{workdir}。"
        "此前对话中的绝对路径均指向旧工作目录，已全部作废——后续所有文件"
        "操作（read_file/write_file/edit_file/bash 等）一律以当前工作目录"
        "为基准使用相对路径；如需引用旧对话中提到的文件，请在当前目录下"
        "重新确认其对应位置后再操作。"
    )
    _DIR_SWITCH_AI_REPLY = (
        "明白。已切换到新工作目录 {workdir}，旧对话中的绝对路径不再有效，"
        "后续文件操作全部以当前目录为基准使用相对路径，引用旧文件时会先"
        "在当前目录重新确认位置。"
    )

    def _dir_switch_rows(
        self,
        session_row: dict,
        item_rows: list,
        workdir: Optional[str],
    ) -> list:
        """构造导入目录切换提示轮的 session_items 行（锁内调用）。

        追加条件：workdir 非空、会话为 chat 类型——search 会话无 LLM
        续聊语义，不追加。seq 在文件原 items 的 MAX(seq) 之上续排，
        created_at 取导入时刻（这轮是导入动作产生的，非源会话时序）。

        Returns:
            行列表（通常 2 条）；不满足条件返回 []。
        """
        wd = (workdir or "").strip()
        if not wd or session_row.get("type") != SessionType.CHAT.value:
            return []
        max_seq = max((r["seq"] for r in item_rows), default=-1)
        now = datetime.now(timezone.utc).isoformat()
        user_payload = json.dumps(
            {"content": self._DIR_SWITCH_USER_TMPL.format(workdir=wd)},
            ensure_ascii=False,
        )
        ai_payload = json.dumps(
            {
                "content": self._DIR_SWITCH_AI_REPLY.format(workdir=wd),
                "tool_calls": [],
                "references": [],
            },
            ensure_ascii=False,
        )
        return [
            {
                "seq": max_seq + 1,
                "kind": "message_user",
                "payload": user_payload,
                "created_at": now,
            },
            {
                "seq": max_seq + 2,
                "kind": "message_ai",
                "payload": ai_payload,
                "created_at": now,
            },
        ]

    def import_session(self, data: dict, workdir: Optional[str] = None) -> bool:
        """导入单个会话（ADR-0038）——结构校验后原样写入，时间戳保留
        源值（导入时刻不顶到最前）。

        workdir 非空且会话为 chat 类型时，末尾追加一轮目录切换提示对话
        （message_user + message_ai，见 _DIR_SWITCH_USER_TMPL），message_count
        相应 +2——把「目录已改」的事实注入续聊回放，防模型沿用导出文件里
        的旧绝对路径继续写旧目录。

        Returns:
            是否新导入；同 id 已存在 → False（跳过，幂等防双份）。
        Raises:
            ValueError: 结构校验失败（调用方转 400，整体不部分导入）。
        """
        session_id, session_row, item_rows = self._validate_import(data)
        with self._lock, self._conn() as conn:
            row = conn.execute(
                "SELECT 1 FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
            if row is not None:
                return False
            extra_rows = self._dir_switch_rows(
                session_row, item_rows, workdir
            )
            if extra_rows:
                session_row["message_count"] = (
                    session_row.get("message_count") or 0
                ) + len(extra_rows)
            conn.execute(
                """INSERT INTO sessions
                   (id, type, title, preview, mode, created_at, updated_at,
                    message_count, starred)
                   VALUES (:id, :type, :title, :preview, :mode, :created_at,
                           :updated_at, :message_count, :starred)""",
                session_row,
            )
            conn.executemany(
                """INSERT INTO session_items
                   (session_id, seq, kind, payload, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                [
                    (session_id, r["seq"], r["kind"], r["payload"], r["created_at"])
                    for r in item_rows + extra_rows
                ],
            )
            return True


class SessionsStore(_StorePart):
    """线程安全的 SQLite 历史会话存储（门面）。

    职责已按域拆给三个协作类（AP-7），本类保留对话本身的写入/读取/回放，
    并把 auth_sessions / rewind_snapshots / 导入导出转委托——对外 API 与
    拆分前逐字一致：

    - `_AuthSessionStore`    登录 token 生命周期
    - `_RewindSnapshotStore` 回退文件快照
    - `_SessionPortability`  导出 / 导入

    三者与门面共享同一个 `_SessionDB`（同锁、同连接口径）。
    """

    EXPORT_FORMAT_VERSION = _SessionPortability.EXPORT_FORMAT_VERSION

    def __init__(self, db_path: Path | str):
        super().__init__(_SessionDB(db_path))
        self._auth = _AuthSessionStore(self._db)
        self._snapshots = _RewindSnapshotStore(self._db)
        self._portability = _SessionPortability(self._db)

    @property
    def _db_path(self) -> str:
        """兼容旧属性（拆分前是实例字段）。"""
        return self._db._db_path

    # ---- 写入 ----

    def _append_item(self, session_id: str, kind: str, payload: dict) -> None:
        """session_items 追加一条（锁内事务 MAX(seq)+1 续排）。

        各 ``append_*``（kind 签名固定、payload dict 形态）的公共落库路径，
        seq 分配与 payload 序列化约定收敛在此单一实现。
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
                   VALUES (?, ?, ?, ?, ?)""",
                (session_id, row[0] + 1, kind,
                 json.dumps(payload, ensure_ascii=False, default=str), now),
            )

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
        """加星/取消加星（2026-09-17；2026-10-28 调整）：加星时刷新 updated_at，
        使该会话在星标组内按加星时间排名第一；取消加星仅清 starred，
        时间戳保持（下次列表中按时间自然回落）。置顶效果仍由 list() 的
        排序键（starred DESC, updated_at DESC）承担。"""
        with self._lock, self._conn() as conn:
            conn.execute(
                """UPDATE sessions
                   SET starred = ?,
                       updated_at = CASE WHEN ? THEN ? ELSE updated_at END
                   WHERE id = ?""",
                (1 if starred else 0, starred,
                 datetime.now(timezone.utc).isoformat(), session_id),
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

    def ensure_message_user(
        self, session_id: str, content: str, images: Optional[list] = None
    ) -> bool:
        """确保本轮 message_user 已落库（ADR-0028 统一后端落库）。

        新前端不再前置写入（后端是唯一生产者）；老前端已写的末尾同内容
        条目幂等跳过，防双写。回放轮次分组与回退快照锚点都依赖它在库。

        images（ADR-0034 对话图片）：非空时 payload 平级携带
        ``[{"data": b64, "media_type": str}, …]``；无图消息 payload 与旧
        格式逐字节相同（无 images 键）。

        Returns:
            是否新写入。
        """
        payload: dict = {"content": content}
        if images:
            payload["images"] = images
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT kind, payload FROM session_items
                   WHERE session_id = ? ORDER BY seq DESC LIMIT 1""",
                (session_id,),
            ).fetchone()
            if row is not None and row["kind"] == "message_user":
                try:
                    p = json.loads(row["payload"])
                except (json.JSONDecodeError, TypeError):
                    p = {}
                if isinstance(p, dict) and p.get("content") == content:
                    # 带图判重：旧条目无 images 键视同 []（老前端/无图路径幂等不变）
                    if (p.get("images") or []) == (images or []):
                        return False
        # RLock 内嵌调用 _append_item：查-判与插-入之间无并发写入
        self._append_item(session_id, "message_user", payload)
        return True

    def append_message_ai(
        self, session_id: str, content: str, tool_calls: list
    ) -> None:
        """统一后端落库的展示层 AI 条目（ADR-0028）：seq 按 MAX 续排。

        payload 与历史前端写入同构：content（策展文本）+ tool_calls
        （emitter 积累形态，含 duration_ms，未完成对由调用方过滤）+
        references（恒 []——references SSE 事件后端本无产生点，历史前端
        写入也恒为空，等价）。调用方负责 message_count 刷新。
        """
        self._append_item(session_id, "message_ai", {
            "content": content, "tool_calls": tool_calls, "references": [],
        })

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
        self._append_item(session_id, "raw_messages", {"messages": messages})

    def append_usage(self, session_id: str, usage: dict) -> None:
        """落库一轮的 token 用量（kind='usage'，2026-09-17），seq 按 MAX 续排。

        payload 含 input/output/cache_creation/cache_read 四字段 +
        context_window（宿主注入）；回放（get_chat_history）对未知 kind
        天然跳过，不进 LLM 上下文。
        """
        self.append_usages(session_id, [usage])

    def append_usages(self, session_id: str, usages: list) -> None:
        """批量落库多轮 token 用量（单连接单事务，seq 连续续排）——
        轮末收尾一次调用取代逐条 append_usage（每条独立连接+MAX(seq)
        点查 + fsync，一轮工具循环 10+ 次调用即 10+ 次事务开销）。"""
        if not usages:
            return
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT COALESCE(MAX(seq), -1) FROM session_items
                   WHERE session_id = ?""",
                (session_id,),
            ).fetchone()
            base = row[0]
            conn.executemany(
                """INSERT INTO session_items
                   (session_id, seq, kind, payload, created_at)
                   VALUES (?, ?, 'usage', ?, ?)""",
                [
                    (session_id, base + i,
                     json.dumps(u, ensure_ascii=False, default=str), now)
                    for i, u in enumerate(usages, start=1)
                ],
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

        self._append_item(session_id, "compacted", {
            "messages": messages,
            "pre_tokens": pre_tokens,
            "post_tokens": estimate_tokens(messages),
        })

    def append_microcompact(self, session_id: str, cleared_tool_use_ids: list[str]) -> None:
        """落库一轮微压缩（kind='microcompact'，ADR-0026），seq 按 MAX 续排。

        payload 存本轮实际清理的 tool_use_id 清单；回放按 id 把已回放消息
        中对应 tool_result 的内容替换为 "[cleared]"——重放与真实请求逐字节
        一致（80%–100% 阈值窗口内跨轮前缀不再分叉）。目标 id 不在回放
        历史（已被压缩边界清掉 / 本轮 raw 已是清理后内容）时为幂等 no-op。
        """
        if not cleared_tool_use_ids:
            return
        self._append_item(
            session_id, "microcompact",
            {"cleared_tool_use_ids": list(cleared_tool_use_ids)},
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
        self._append_item(session_id, "rewound", {
            "point_seq": point_seq,
            "files_restored": files_restored or [],
            "files_deleted": files_deleted or [],
        })

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
        return self._rewound_intervals(self.get_detail(session_id))

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

    # ---- 删除对话对（2026-10-29：清理无用轮次）----

    # 轮内出现的**历史级边界**条目：与具体轮强绑定之外还改变全局回放语义，
    # 删除轮次时必须保留（拒绝删除），否则死段/截断事实被悄悄改写。
    _BOUNDARY_KINDS = ("compacted", "rewound")

    def delete_turn(self, session_id: str, anchor_seq: int) -> Optional[dict]:
        """删除一处**对话对**（该 user 消息起、到下一处 user 消息前的整轮）。

        动机：长会话里无用轮次会一直占上下文，用户要在气泡上直接清掉。
        删除粒度是整轮（message_user + raw_messages / tool_trace /
        message_ai_raw / message_ai / usage / microcompact），不是单条
        消息——留下一半会让回放把 user 与 assistant 拆散，语义断裂。

        - 锚点须为**活** message_user（死段内/非 user 条目 → ValueError）；
        - 轮范围 = [锚点之前紧邻的 skill_context…（本轮注入）] 起，到
          下一条 message_user（不含）或会话末尾止；
        - 范围内含 compacted / rewound 边界 → ValueError（拒绝，不静默
          改写回放事实：该用回退/压缩而不是删轮）；
        - 删除后 message_count 按活投影重算并刷新 updated_at；
        - rewind_snapshots 不删（引用机器本地文件备份）：被删锚点的快照
          随锚点失效而不可达，会话删除时级联清理。

        Returns:
            {"deleted_items": int, "message_count": int}；会话不存在 None。
        Raises:
            ValueError: 锚点无效 / 范围含历史级边界（调用方转 400）。
        """
        with self._lock, self._conn() as conn:
            row = conn.execute(
                "SELECT 1 FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
            if row is None:
                return None
            rows = conn.execute(
                """SELECT seq, kind, payload FROM session_items
                   WHERE session_id = ? ORDER BY seq ASC""",
                (session_id,),
            ).fetchall()
            # payload 必须带上：活投影要解析 rewound 边界 payload 才能算出死段
            items = [
                SessionItem(
                    session_id=session_id, seq=r["seq"], kind=r["kind"],
                    payload=r["payload"], created_at=None,
                )
                for r in rows
            ]
            live_seqs = {it.seq for it in self.project_live_items(items)}
            idx = next(
                (i for i, it in enumerate(items) if it.seq == anchor_seq), None
            )
            if idx is None or items[idx].kind != "message_user":
                raise ValueError("删除锚点无效（须为用户消息）")
            if anchor_seq not in live_seqs:
                raise ValueError("该消息已不在当前时间线（不可删除）")
            # 向前吞并本轮注入的 skill_context（upsert_skill_contexts 紧跟
            # 在 message_user 之前；留着会变成无主注入污染后续上下文）
            start = idx
            while start > 0 and items[start - 1].kind == "skill_context":
                start -= 1
            end = next(
                (
                    i for i, it in enumerate(items)
                    if it.seq > anchor_seq and it.kind == "message_user"
                ),
                len(items),
            )
            doomed = items[start:end]
            boundary = next(
                (it for it in doomed if it.kind in self._BOUNDARY_KINDS), None
            )
            if boundary is not None:
                raise ValueError(
                    "该轮范围内含压缩/回退边界，无法删除"
                    "（请改用回退或重新压缩）"
                )
            conn.executemany(
                "DELETE FROM session_items WHERE session_id = ? AND seq = ?",
                [(session_id, it.seq) for it in doomed],
            )
            remaining = items[:start] + items[end:]
            count = sum(
                1
                for it in self.project_live_items(remaining)
                if it.kind in ("message_user", "message_ai")
            )
            conn.execute(
                """UPDATE sessions SET message_count = ?, updated_at = ?
                   WHERE id = ?""",
                (count, datetime.now(timezone.utc).isoformat(), session_id),
            )
        return {"deleted_items": len(doomed), "message_count": count}

    @staticmethod
    def _rewound_intervals(items: list) -> list:
        """解析全部回退边界为 (point_seq, boundary_seq) 区间（seq 升序）。

        rewind_boundaries（API 投影）与 project_live_items（回放投影）共用
        的单一解析实现——坏 payload 容错跳过，死段语义只此一处维护。
        """
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

    @staticmethod
    def project_live_items(items: list) -> list:
        """回退边界投影：死段 = **全部**回退边界区间的并集，滤掉死段条目。

        单条边界 i 的死段 = [point_i, boundary_i]（闭区间——锚点消息本身
        回填输入框，也算死）。多条边界取并集而非「最后一个生效」：在新对话
        里再次回退到更早锚点时，旧边界的死段必须继续压住——例如边界
        (0,4) 后新对话 5、6，再回退到 5，新边界 (5,7) 只盖 5..7，0..4
        靠旧边界仍死。无边界原样返回。
        """
        intervals = SessionsStore._rewound_intervals(items)
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
            # 坐标变更必须连带重映射（AP-30）：rewind_snapshots.anchor_seq 是
            # message_user 的 seq 外键，不同步则回退找不到目标快照，会静默
            # 落回「首次改前」版本并误报 restored。同一事务内完成。
            self._snapshots.shift_anchors(session_id, tail_seq, k, conn=conn)
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
    def duplicate(self, session_id: str) -> Optional[SessionSummary]:
        """孪生复制（2026-10-10）：新 id 复制 sessions 行 + **全部**
        session_items（含死段、compacted/rewound 边界、usage、skill_context、
        raw_messages——回放/展示/压缩信息聚合与源逐字节一致，继续对话时跨轮
        前缀缓存不被结构差异打断）。

        - 新标题 = 源标题 + " (副本)"；starred 不继承（孪生默认可删，源仍受保护）；
          mode/type/message_count 原样保留；
        - created_at/updated_at 取当前时刻（孪生是新会话，历史列表按
          updated_at 排序自然置顶）；
        - rewind_snapshots 不复制（引用 .cortex/rewind/{源 id}/ 机器本地
          文件备份，指向源目录即错）——孪生无历史快照可回退，属预期降级。
        - 生成中的会话允许复制（末轮 raw_messages 可能未落库，可接受——
          同导出端点的宽容口径，ADR-0038）。

        会话不存在返回 None。
        """
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        new_id = str(_ulid.new())
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT type, title, preview, mode, message_count
                   FROM sessions WHERE id = ?""",
                (session_id,),
            ).fetchone()
            if row is None:
                return None
            copy_title = f"{row['title']} (副本)"[:SESSION_TITLE_MAX]  # 与创建/改名同源（AP-21）
            conn.execute(
                """INSERT INTO sessions
                   (id, type, title, preview, mode, created_at, updated_at,
                    message_count, starred)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)""",
                (
                    new_id, row["type"], copy_title, row["preview"],
                    row["mode"], now_iso, now_iso, row["message_count"],
                ),
            )
            conn.execute(
                """INSERT INTO session_items (session_id, seq, kind, payload, created_at)
                   SELECT ?, seq, kind, payload, created_at
                   FROM session_items WHERE session_id = ?""",
                (new_id, session_id),
            )
        return SessionSummary(
            id=new_id, type=SessionType(row["type"]),
            title=copy_title, preview=row["preview"],
            mode=row["mode"], created_at=now, updated_at=now,
            message_count=row["message_count"], starred=False,
        )

    def delete(self, session_id: str) -> bool:
        """删除单个会话；加星会话受保护（2026-09-17），拒绝删除并返回 False。"""
        with self._lock, self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM sessions WHERE id = ? AND starred = 0", (session_id,),
            )
            return cur.rowcount > 0

    def delete_by_type(
        self, type_: Optional[SessionType]
    ) -> tuple[int, int, list]:
        """批量删除某 type 的全部未加星会话。type_=None 时清空所有类型。

        session_items 通过 FK ON DELETE CASCADE 自动级联删除。
        加星会话（2026-09-17）受保护跳过；返回
        ``(deleted_count, skipped_starred, 被删会话 id 列表)``——id 列表供
        调用方做删除后级联清理（回退备份目录等），取代「删前快照全量 id
        再逐个复查」的预测式（有竞态窗口且要靠魔法 limit 绕过分页）。
        """
        with self._lock, self._conn() as conn:
            if type_ is None:
                skipped = conn.execute(
                    "SELECT COUNT(*) FROM sessions WHERE starred = 1",
                ).fetchone()[0]
                ids = [
                    r[0] for r in conn.execute(
                        "SELECT id FROM sessions WHERE starred = 0"
                    ).fetchall()
                ]
                cur = conn.execute("DELETE FROM sessions WHERE starred = 0")
            else:
                skipped = conn.execute(
                    "SELECT COUNT(*) FROM sessions WHERE type = ? AND starred = 1",
                    (type_.value,),
                ).fetchone()[0]
                ids = [
                    r[0] for r in conn.execute(
                        "SELECT id FROM sessions WHERE type = ? AND starred = 0",
                        (type_.value,),
                    ).fetchall()
                ]
                cur = conn.execute(
                    "DELETE FROM sessions WHERE type = ? AND starred = 0",
                    (type_.value,),
                )
            return cur.rowcount, skipped, ids

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
        turns = self._group_turns(items)
        cleared_ids = self._scan_cleared_ids(items)
        return _sanitize_tool_pairing(self._replay_turns(turns, cleared_ids))

    @staticmethod
    def _scan_cleared_ids(items: list[SessionItem]) -> set[str]:
        """预扫描微压缩清理目标：只认**最后一个**压缩边界之后的 microcompact。

        压缩边界之前的清理目标已被截断投影丢弃，收集它们没有意义——遇新
        边界即清空已收集集合（ADR-0026 回放口径）。
        """
        cleared_ids: set[str] = set()
        for it in items:
            if it.kind == "compacted":
                cleared_ids.clear()
            elif it.kind == "microcompact":
                try:
                    p = json.loads(it.payload)
                except (json.JSONDecodeError, TypeError):
                    continue
                if isinstance(p, dict):
                    ids = p.get("cleared_tool_use_ids")
                    if isinstance(ids, list):
                        cleared_ids.update(i for i in ids if isinstance(i, str))
        return cleared_ids

    @staticmethod
    def _group_turns(items: list[SessionItem]) -> list[list[SessionItem]]:
        """按轮分组：message_user 是一轮起点，其后条目归入同一轮。"""
        turns: list[list[SessionItem]] = []
        for it in items:
            if it.kind == "message_user" or not turns:
                turns.append([it])
            else:
                turns[-1].append(it)
        return turns

    def _replay_turns(
        self, turns: list[list[SessionItem]], cleared_ids: set[str]
    ) -> list[dict]:
        """把分好组的条目回放为 LLM messages（规则见 get_chat_history docstring）。"""
        history: list[dict] = []
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
                    self._replay_user(payload, history)
                elif it.kind == "raw_messages":
                    self._replay_raw(payload, history, cleared_ids)
                elif it.kind == "compacted":
                    # 截断投影：清空此前全部回放再拼压缩后消息序列
                    # （payload 与 raw_messages 同构）
                    history.clear()
                    self._replay_raw(payload, history, set())
                elif it.kind == "microcompact":
                    # 预扫描已按 id 重放（_apply_cleared），无逐条回放动作
                    continue
                elif it.kind == "tool_trace":
                    if not suppress_fallback:
                        _replay_tool_trace(payload, history, cleared_ids)
                elif it.kind == "skill_context":
                    # run_stream 注入的 skill body（见 upsert_skill_contexts）：
                    # 原样回放在首次注入位置，跨轮请求前缀稳定（缓存友好）
                    content = payload.get("content", "")
                    if content:
                        _append_paired(history, "user", content)
                        _append_paired(history, "assistant", "Noted.")
                elif it.kind == "message_ai_raw":
                    if suppress_fallback:
                        continue
                    # raw 按 seq 位置回放（旧逻辑推迟到轮末，会把 seq 位置
                    # 介于其间的 skill_context 挤到 AI 文本之前，破坏前缀）
                    content = payload.get("content", "")
                    if content and not ai_emitted:
                        _append_paired(history, "assistant", content)
                        ai_emitted = True
                elif it.kind == "message_ai":
                    # 策展展示文本只做兜底：raw 无论 seq 先后都优先（与旧逻辑一致）；
                    # 无 raw 时在轮末回放（legacy 会话无 skill_context，位置无影响）
                    content = payload.get("content", "")
                    if content and not ai_display_fallback:
                        ai_display_fallback = content
            if not ai_emitted and not suppress_fallback and ai_display_fallback:
                _append_paired(history, "assistant", ai_display_fallback)
        return history

    @staticmethod
    def _replay_user(payload: dict, history: list[dict]) -> None:
        """message_user 回放；images 非空时组装 [image×N, text] 块数组。"""
        content = payload.get("content", "")
        if not content:
            return
        # 对话图片（ADR-0034）：images 平级数组非空时组装为 Anthropic 块数组
        # [image×N, text]（OpenAI-compat 由 provider 翻译）；无图保持纯字符串
        # （与历史逐字节一致）
        images = payload.get("images")
        if isinstance(images, list) and images:
            blocks = [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": img.get("media_type", "application/octet-stream"),
                        "data": img.get("data", ""),
                    },
                }
                for img in images
                if isinstance(img, dict) and img.get("data")
            ]
            blocks.append({"type": "text", "text": content})
            _append_paired(history, "user", blocks)
        else:
            _append_paired(history, "user", content)

    @staticmethod
    def _replay_raw(payload: dict, history: list[dict], cleared_ids: set[str]) -> None:
        """raw_messages / compacted 的 messages 数组逐条回放。"""
        for rm in payload.get("messages", []):
            if not isinstance(rm, dict):
                continue
            role, content = rm.get("role"), rm.get("content")
            if role in ("user", "assistant") and content:
                _append_paired(history, role, _clear_marked_content(role, content, cleared_ids))

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

    # ---- 委托：回退文件快照（_RewindSnapshotStore）----

    def append_rewind_snapshot(self, session_id: str, anchor_seq: int, tracked_backups: dict) -> tuple:
        return self._snapshots.append_rewind_snapshot(session_id, anchor_seq, tracked_backups)

    def latest_rewind_snapshot(self, session_id: str) -> Optional[dict]:
        return self._snapshots.latest_rewind_snapshot(session_id)

    def backfill_rewind_snapshot(self, session_id: str, path: str, entry: dict) -> bool:
        return self._snapshots.backfill_rewind_snapshot(session_id, path, entry)

    def shift_rewind_anchors(
        self, session_id: str, from_seq: int, delta: int,
        conn: Optional[sqlite3.Connection] = None,
    ) -> int:
        return self._snapshots.shift_anchors(session_id, from_seq, delta, conn=conn)

    def list_rewind_snapshots(self, session_id: str) -> list:
        return self._snapshots.list_rewind_snapshots(session_id)

    # ---- 委托：导出 / 导入（_SessionPortability）----

    def export_session(
        self, session_id: str, upto_seq: Optional[int] = None
    ) -> Optional[dict]:
        return self._portability.export_session(session_id, upto_seq)

    def import_session(self, data: dict, workdir: Optional[str] = None) -> bool:
        return self._portability.import_session(data, workdir)

    # ---- 委托：登录会话（_AuthSessionStore）----

    def create_auth_session(self, ttl_hours: int) -> str:
        return self._auth.create_auth_session(ttl_hours)

    def validate_auth_session(
        self,
        token: str,
        *,
        touch: bool = True,
        ttl_hours: int,
        now: Optional[datetime] = None,
    ) -> bool:
        return self._auth.validate_auth_session(
            token, touch=touch, ttl_hours=ttl_hours, now=now
        )

    def delete_auth_session(self, token: str) -> None:
        return self._auth.delete_auth_session(token)

    def revoke_all_auth_sessions(self) -> int:
        return self._auth.revoke_all_auth_sessions()

    def purge_expired_auth_sessions(self) -> int:
        return self._auth.purge_expired_auth_sessions()
