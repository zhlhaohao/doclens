"""GET/POST/PATCH/DELETE /api/sessions。"""
import json
from datetime import datetime, timezone
from itertools import chain
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, File, Query, Request, UploadFile
from fastapi.responses import Response
import ulid as _ulid

from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.models.session import (
    SessionAppendRequest,
    SessionCreateRequest,
    SessionCreatedResponse,
    SessionDetailResponse,
    SessionListResponse,
    SessionRenameRequest,
    SessionRewindRequest,
    SessionStarRequest,
)
from doclens.web_v2.sessions_store import (
    SESSION_TITLE_MAX,
    SessionItem,
    SessionSummary,
    SessionType,
    SessionsStore,
)
from doclens.web_v2.tmp_workspace import cleanup_all_tmp, cleanup_session_tmp
from planify.tools.guard import grant_clear_all, grant_session_clear

router = APIRouter()


def _get_store() -> SessionsStore:
    """全局单例 SessionsStore（委托 deps 统一管理，避免多份单例）。"""
    from doclens.web_v2.deps import get_sessions_store
    return get_sessions_store()


def _get_workdir() -> Path:
    """知识库根目录（临时工作区 .cortex/tmp/ 的父目录）。"""
    from doclens.web_v2.deps import get_index_manager
    return Path(get_index_manager().search_path)


@router.post("/sessions", response_model=SessionCreatedResponse)
async def create_session(req: SessionCreateRequest):
    store = _get_store()
    now = datetime.now(timezone.utc)
    sid = str(_ulid.new())
    summary = SessionSummary(
        id=sid, type=req.type, title=req.title, preview=req.preview,
        mode=req.mode, created_at=now, updated_at=now, message_count=0,
    )
    store.create(summary)
    return SessionCreatedResponse(id=sid, type=req.type, title=req.title, preview=req.preview, mode=req.mode)


@router.post("/sessions/find-or-create", response_model=SessionCreatedResponse)
async def find_or_create_session(req: SessionCreateRequest):
    """按 (type, title) 原子地查找或新建会话。

    主要服务于 search 历史：相同关键词只保留一条记录，重复搜索时刷新 updated_at 置顶。
    chat 等需要保留每条消息的场景仍应使用 POST /sessions + PATCH /sessions/{id}。
    """
    store = _get_store()
    summary = store.find_or_create(req.type, req.title, req.preview, req.mode)
    return SessionCreatedResponse(
        id=summary.id, type=summary.type, title=summary.title,
        preview=summary.preview, mode=summary.mode,
    )


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    type: Optional[SessionType] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    store = _get_store()
    if type is None:
        # Fetch each type with offset=0; paginate after merge to avoid double-offset.
        items = list(chain(
            store.list(SessionType.SEARCH, limit=limit + offset),
            store.list(SessionType.CHAT, limit=limit + offset),
        ))
        items.sort(key=lambda s: (s.starred, s.updated_at), reverse=True)
        items = items[offset:offset + limit]
    else:
        items = store.list(type, limit, offset)
    return SessionListResponse(
        sessions=[s.model_dump(mode="json") for s in items],
        returned=len(items),
    )


# ---- 会话库备份/恢复（ADR-0047）----


@router.get("/sessions/backups")
async def list_session_backups():
    """备份清单（新→旧）+ 损坏库残留（供控制面板「会话备份」对话框）。

    GET /sessions/{session_id} 路由在前且 session_id 无模式约束，本端点
    需在其之前注册——见文件内路由顺序（FastAPI 按注册序匹配）。
    """
    from doclens.web_v2.deps import sessions_db_path
    from doclens.web_v2 import session_backup

    db_path = sessions_db_path()
    backups = session_backup.list_backups(db_path)
    corrupt = session_backup.list_corrupt_files(db_path)
    # 当前库会话数（对比展示用；库打不开时不阻断清单——恢复正是解法）
    session_count = None
    try:
        store = _get_store()
        session_count = len(store.list(SessionType.CHAT, limit=10000)) + len(
            store.list(SessionType.SEARCH, limit=10000)
        )
    except Exception:  # noqa: BLE001
        pass
    # 各备份内的会话数：逐份打开只读计数（十几 MB × ≤10 份，秒级）
    for b in backups:
        b["session_count"] = _count_sessions_in_backup(db_path, b["file"])
    return {"ok": True, "backups": backups, "corrupt_files": corrupt,
            "current_session_count": session_count}


def _count_sessions_in_backup(db_path, backup_file: str) -> Optional[int]:
    """打开备份文件统计 sessions 行数（只读；打不开返回 None）。"""
    import sqlite3

    from doclens.web_v2.session_backup import backup_dir

    p = backup_dir(db_path) / backup_file
    try:
        conn = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
        try:
            row = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()
            return int(row[0]) if row else 0
        finally:
            conn.close()
    except sqlite3.Error:
        return None


@router.post("/sessions/backups/{backup_file}/restore")
async def restore_session_backup(backup_file: str):
    """人工恢复：用指定备份整体替换 sessions.db（ADR-0047）。

    互斥：任一会话生成中（chat_runner 非空）→ 409——恢复换库文件，
    在途生成落库会写到已换掉的旧句柄/被换后的新库，撕裂不可控。
    """
    from doclens.web_v2 import chat_runner
    from doclens.web_v2 import session_backup
    from doclens.web_v2.deps import (
        broadcast_sessions_restored,
        invalidate_sessions_store,
        sessions_db_path,
    )

    if chat_runner.active_count() > 0:
        raise CortexAPIError(
            409, "SESSION_STREAMING", "有对话生成中，请等待完成后再恢复备份"
        )
    db_path = sessions_db_path()
    try:
        info = session_backup.restore_backup(db_path, backup_file)
    except FileNotFoundError as e:
        raise CortexAPIError(404, "BACKUP_NOT_FOUND", str(e))
    except RuntimeError as e:
        raise CortexAPIError(502, "RESTORE_FAILED", str(e))
    # 恢复换掉了库文件：丢弃旧单例，下次请求按新库重建
    invalidate_sessions_store()
    broadcast_sessions_restored(info, auto=False)
    return {"ok": True, **info}


# 导入 body 上限：对话图片 base64 膨胀 ~33%，50MB 已宽裕（ADR-0038）
_IMPORT_MAX_BYTES = 50 * 1024 * 1024


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(session_id: str, meta_only: bool = False):
    """会话详情。``?meta_only=true`` 只回元数据（items 置空）——断开续跑
    的轮询等只需 generating/计数的调用方用，省全量条目传输。"""
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    items = [] if meta_only else store.get_detail(session_id)
    # 实时上下文窗口（与压缩决策同源：runtime.config 现读）。agent 未装配
    # 或读取异常时为 0，前端回落 usage 历史快照。
    window = 0
    try:
        from doclens.web_v2.deps import get_agent_if_ready

        agent = get_agent_if_ready()
        if agent is not None:
            window = int(
                getattr(agent.runtime.config, "planify_context_window", 0) or 0
            )
    except Exception:  # noqa: BLE001 — 展示字段，不影响 detail 主数据
        pass
    # 生成中标志（断开续跑恢复态，ADR-0028）
    from doclens.web_v2 import chat_runner
    generating = chat_runner.is_running(session_id)
    return SessionDetailResponse(
        generating=generating,
        **summary.model_dump(mode="json"),
        # created_at 供前端压缩信息聚合取「最近压缩时间」（ADR-0026）；
        # 条目级时间戳此前未透传，新增字段对旧前端无感
        items=[
            {
                "kind": i.kind,
                "payload": i.payload,
                "seq": i.seq,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in items
        ],
        context_window=window,
    )


@router.patch("/sessions/{session_id}", deprecated=True)
async def append_session(session_id: str, req: SessionAppendRequest):
    """追加 items 到会话末尾 + 更新 message_count（**遗留端点，已弃用**）。

    历史用途：展示层条目由前端落库（发送前写 message_user、流结束后写
    message_ai）。自 071d5169「展示层落库统一到后端」起，chat 路径由
    `ensure_message_user` / `append_chat_turn_raw` / `append_message_ai`
    独占写入，前端不再调用本端点；保留它只为兼容缓存了旧 bundle 的
    WebView 容器，新代码不要用。

    payload 契约（2026-10-29 收紧）：接受 JSON 字符串（旧调用形态）或
    任意可序列化对象（自动 dumps）；缺 kind / payload 非法 JSON → 400
    （此前会一路穿到 SQLite 绑定层抛 InterfaceError → 500）。
    """
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    normalized = [_normalize_append_item(it, i) for i, it in enumerate(req.items)]
    existing = store.get_detail(session_id)
    next_seq = (existing[-1].seq + 1) if existing else 0
    for idx, (kind, payload) in enumerate(normalized):
        store.append_item(SessionItem(
            session_id=session_id,
            seq=next_seq + idx,
            kind=kind,
            payload=payload,
        ))
    new_count = req.message_count if req.message_count is not None else (summary.message_count + len(req.items))
    store.update_count_and_time(session_id, new_count)
    return {"ok": True, "id": session_id, "message_count": new_count}


def _normalize_append_item(item: dict, idx: int) -> tuple[str, str]:
    """单条 item 校验 + payload 归一为 JSON 字符串（失败 → 400，不 500）。

    session_items.payload 是 TEXT 列且下游一律 ``json.loads``，故这里
    统一产出合法 JSON 字符串：字符串入参校验可通过解析，其余类型 dumps。
    """
    if not isinstance(item, dict):
        raise CortexAPIError(400, "INVALID_ITEM", f"items[{idx}] 必须是对象")
    kind = item.get("kind")
    if not isinstance(kind, str) or not kind.strip():
        raise CortexAPIError(400, "INVALID_ITEM", f"items[{idx}].kind 缺失或非字符串")
    payload = item.get("payload", "{}")
    if payload is None:
        payload = "{}"
    if isinstance(payload, str):
        try:
            json.loads(payload)
        except (json.JSONDecodeError, TypeError):
            raise CortexAPIError(
                400, "INVALID_ITEM", f"items[{idx}].payload 不是合法 JSON 字符串"
            ) from None
        return kind, payload
    try:
        return kind, json.dumps(payload, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        raise CortexAPIError(
            400, "INVALID_ITEM", f"items[{idx}].payload 无法序列化为 JSON"
        ) from None


@router.patch("/sessions/{session_id}/title")
async def rename_session(session_id: str, req: SessionRenameRequest):
    """人工改名（2026-09-17）。strip 后为空 → 400；超 SESSION_TITLE_MAX（1000）截断
    （与创建/复制同源，AP-21）；不刷新 updated_at。"""
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    title = req.title.strip()[:SESSION_TITLE_MAX]
    if not title:
        raise CortexAPIError(400, "TITLE_EMPTY", "标题不能为空")
    store.update_title(session_id, title)
    return {"ok": True, "id": session_id, "title": title}


@router.patch("/sessions/{session_id}/star")
async def star_session(session_id: str, req: SessionStarRequest):
    """加星/取消加星：加星即置顶（starred DESC, updated_at DESC）+ 刷新
    updated_at（星标组内按加星时间排第一）+ 删除保护。"""
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    store.set_starred(session_id, req.starred)
    return {"ok": True, "id": session_id, "starred": req.starred}


def _require_chat_session(
    store: SessionsStore, session_id: str, action: str, *, busy: bool = False
) -> SessionSummary:
    """chat 会话端点的前置守卫：存在 → 类型 → （可选）生成中互斥。

    compact / rewind 系端点共用（校验口径调整只改此处）；``busy=True``
    额外做「生成中 409」互斥——判定源与 POST /chat 预检、detail.generating
    同用 chat_runner.is_running（ADR-0028 执行体登记表是「生成中」的
    唯一权威，避免 interrupt/registry 双表漂移）。
    """
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    if summary.type is not SessionType.CHAT:
        raise CortexAPIError(400, "NOT_CHAT_SESSION", f"仅对话会话支持{action}")
    if busy:
        from doclens.web_v2 import chat_runner

        if chat_runner.is_running(session_id):
            raise CortexAPIError(
                409, "SESSION_STREAMING", f"对话生成中，请等待完成后再{action}"
            )
    return summary


@router.post("/sessions/{session_id}/compact")
async def compact_session(session_id: str):
    """手动压缩会话历史（ADR-0026 压缩即事实的手动入口，2026-09-17）。

    全量摘要落库为 compacted 条目（回放截断投影，下轮起 LLM 上下文从摘要
    开始）；原文双备份在 DB 条目（展示层不受影响）与 .transcripts/ 文件。
    - 仅 chat 会话；流式生成中 409（与 run_stream 的历史 mutate 互斥）；
    - 历史过短 400（无摘要意义，白付一次 LLM 调用）。
    """
    store = _get_store()
    _require_chat_session(store, session_id, "压缩", busy=True)

    history = store.get_chat_history(session_id)
    if len(history) < 2:
        raise CortexAPIError(400, "NOTHING_TO_COMPACT", "会话历史太短，无需压缩")

    from planify.context.compact import (
        aauto_compact,
        estimate_tokens,
        summary_input_budget,
    )
    from doclens.web_v2.deps import get_agent

    runtime = get_agent().runtime
    transcript_dir = (
        getattr(runtime.config, "compact_transcript_dir", None)
        or Path(runtime.config.workdir) / ".transcripts"
    )
    # getattr 防御旧配置对象缺字段
    window = getattr(runtime.config, "planify_context_window", None)
    out_cap_cfg = getattr(runtime.config, "planify_max_tokens", None)
    pre_tokens = estimate_tokens(history)
    try:
        from planify.core.llm import LLMTracer
        compacted = await aauto_compact(
            history, runtime.client, transcript_dir,
            # workdir 显式传：trace 落 {workdir}/.planify/（gitignore 覆盖
            # 范围），不随进程 cwd 漂移
            tracer=LLMTracer.create(
                label="compact", session_key=session_id,
                workdir=runtime.config.workdir,
            ),
            # 摘要输入预算随窗口声明放大（输出预留随输出上限联动）
            summary_input_budget=summary_input_budget(window, out_cap_cfg),
            # 大输出模型跟随 PLANIFY_MAX_TOKENS 放开摘要上限（下限 10000 兜底）
            summary_max_tokens=out_cap_cfg,
        )
    except CortexAPIError:
        raise
    except Exception as e:  # noqa: BLE001
        raise CortexAPIError(
            502, "COMPACT_FAILED", f"压缩失败（LLM 摘要调用出错）: {e}"
        ) from e
    store.append_compacted(session_id, compacted, pre_tokens)
    return {
        "ok": True,
        "id": session_id,
        "pre_tokens": pre_tokens,
        "post_tokens": estimate_tokens(compacted),
        # 人审核用可读转录（2026-10-10）：摘要对 + 骨架对逐块渲染
        "compacted_text": _render_compacted_text(compacted),
    }


def _render_compacted_text(messages: list[dict]) -> str:
    """压缩产物消息 → 可读文本（前端 copy 按钮拷贝供人审核）。

    逐消息渲染「角色: 正文」；content 为块列表时拼 text 块。与
    planify._render_for_summary 的瘦身转录不同——这里是**压缩后**落库
    的最终内容（通常 2~4 条），全量原样，不截断。
    """
    lines: list[str] = []
    for m in messages:
        role = {"user": "用户", "assistant": "助手"}.get(m.get("role"), str(m.get("role")))
        c = m.get("content")
        if isinstance(c, str):
            body = c
        elif isinstance(c, list):
            body = "\n".join(
                b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text"
            )
        else:
            body = str(c or "")
        if body.strip():
            lines.append(f"{role}: {body}")
    return "\n\n".join(lines)


@router.get("/sessions/{session_id}/rewind/preview")
async def rewind_preview(session_id: str, point_seq: int = Query(..., description="锚点 message_user 的 seq")):
    """回退预览（ADR-0027，只读不写盘）：锚点校验 + 文件三态处置清单。

    供确认框展示「将恢复 / 将删除 / 无法恢复」清单；死段消息计数由前端
    从 detail items 自行计算（前端本就持有全量条目与 seq）。
    """
    store = _get_store()
    _require_chat_session(store, session_id, "回退")
    if not store.is_live_anchor(session_id, point_seq):
        raise CortexAPIError(400, "INVALID_ANCHOR", "回退锚点无效（须为可见的用户消息）")

    from doclens.web_v2.deps import get_rewind_tracker

    files = get_rewind_tracker().preview(session_id, point_seq)
    return {
        "ok": True,
        "id": session_id,
        "point_seq": point_seq,
        "files": files,
    }


@router.post("/sessions/{session_id}/rewind")
async def rewind_session(session_id: str, req: SessionRewindRequest):
    """执行回退（ADR-0027：回退即事实）。

    时序：文件恢复（可选，best-effort 逐文件容错）→ 落 rewound 边界条目
    → 重算 message_count（可见时间线口径）。前端随后重拉 detail 渲染折叠
    条，并把锚点消息内容回填输入框。流式生成中 409（本轮快照未固化）。
    """
    store = _get_store()
    _require_chat_session(store, session_id, "回退", busy=True)
    if not store.is_live_anchor(session_id, req.point_seq):
        raise CortexAPIError(400, "INVALID_ANCHOR", "回退锚点无效（须为可见的用户消息）")

    from doclens.web_v2.deps import get_rewind_tracker

    if req.restore_files:
        files = get_rewind_tracker().restore(session_id, req.point_seq)
    else:
        files = {"restored": [], "deleted": [], "skipped": [], "failed": []}
    store.append_rewound(
        session_id, req.point_seq, files["restored"], files["deleted"]
    )
    message_count = store.count_live_messages(session_id)
    store.update_count_and_time(session_id, message_count)
    return {
        "ok": True,
        "id": session_id,
        "point_seq": req.point_seq,
        "files": files,
        "message_count": message_count,
    }


@router.delete("/sessions/{session_id}/turns/{point_seq}")
async def delete_turn(session_id: str, point_seq: int):
    """删除一处对话对（2026-10-29）：该 user 消息起、到下一处 user 消息前的
    整轮（含工具轨迹 / raw_messages / AI 回复），用于清理无用轮次、压缩
    上下文长度。

    粒度是**整轮**而非单条消息——只删一半会让回放把 user 与 assistant 拆散。
    锚点须为活用户消息；范围内含压缩/回退边界时拒绝（400），该类事实只能
    用回退或重新压缩处理。流式生成中 409（本轮快照未固化）。
    """
    store = _get_store()
    _require_chat_session(store, session_id, "删除", busy=True)
    try:
        res = store.delete_turn(session_id, point_seq)
    except ValueError as e:
        raise CortexAPIError(400, "INVALID_ANCHOR", str(e)) from e
    if res is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    return {"ok": True, "id": session_id, "point_seq": point_seq, **res}


@router.post("/sessions/{session_id}/duplicate", response_model=SessionCreatedResponse)
async def duplicate_session(session_id: str):
    """孪生复制（2026-10-10）：原会话完整保留，新会话继承全部条目继续干活。

    复制含死段与压缩/回退边界的全量 session_items（回放逐字节一致）；
    标题加 "(副本)" 后缀，starred 不继承，rewind 快照不复制（引用源会话
    的机器本地文件备份）。生成中允许复制（末轮 raw 可能未落库，与导出
    同口径）。"""
    store = _get_store()
    summary = store.duplicate(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    return SessionCreatedResponse(
        id=summary.id, type=summary.type, title=summary.title,
        preview=summary.preview, mode=summary.mode,
    )


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    if summary.starred:
        raise CortexAPIError(409, "SESSION_STARRED", "加星会话受保护，请先取消加星再删除")
    store.delete(session_id)
    # 顺带清理该会话的 AI 临时工作区（.cortex/tmp/<session_id>/）
    cleanup_session_tmp(_get_workdir(), session_id)
    # 清理外部访问门禁的会话目录授权账本（ADR-0021，内存态）
    grant_session_clear(session_id)
    # 级联清改前备份目录（ADR-0027；DB 快照行随 FK CASCADE 自理）
    from doclens.web_v2.deps import get_rewind_tracker
    get_rewind_tracker().purge(session_id)
    return {"ok": True}


@router.delete("/sessions")
async def clear_sessions(
    type: Optional[SessionType] = Query(default=None, description="按类型清空；不传则清空全部"),
):
    """批量删除会话。type=None 清全部。加星会话受保护跳过（2026-09-17）。"""
    store = _get_store()
    deleted, skipped_starred, deleted_ids = store.delete_by_type(type)
    # 涉及聊天会话时清空 AI 临时工作区（仅 chat 会话会产生 tmp 文件）
    if type is None or type == SessionType.CHAT:
        cleanup_all_tmp(_get_workdir())
        grant_clear_all()
        # 级联清改前备份（ADR-0027）：delete_by_type 返回的是真实被删 id
        # 清单（加星幸存者天然不在内）
        from doclens.web_v2.deps import get_rewind_tracker
        tracker = get_rewind_tracker()
        for sid in deleted_ids:
            tracker.purge(sid)
    return {"ok": True, "deleted_count": deleted, "skipped_starred": skipped_starred}


# ---- 导出/导入（ADR-0038：全保真单会话 JSON，跨实例记忆转移）----

@router.get("/sessions/{session_id}/export")
async def export_session(
    session_id: str,
    upto_seq: Optional[int] = None,
):
    """导出单会话为全保真 JSON 文件（浏览器直接下载）。

    attachment 文件名 = 标题 slug + 日期；id 保留在 JSON 内。纯读操作，
    生成中不限制（最多末轮 raw_messages 未落库，可接受——ADR-0038）。

    ``upto_seq`` 非空 = **导出到此为止**（2026-10-29）：只导锚点及之前的
    条目，产物是**新 id 的独立快照**（标题带「导出至 N 条消息」后缀），
    用于长会话只转移前段上下文、避免导入后上下文过长。锚点须为活
    message_user（与回退锚点同口径），无效 → 400。
    """
    store = _get_store()
    if upto_seq is not None:
        _require_chat_session(store, session_id, "截断导出")
        if not store.is_live_anchor(session_id, upto_seq):
            raise CortexAPIError(
                400, "INVALID_ANCHOR", "导出锚点无效（须为可见的用户消息）"
            )
    data = store.export_session(session_id, upto_seq)
    if data is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    title = data["session"]["title"]
    # 文件名 slug：保留字母/数字/中日韩文字/连字符，其余折叠为连字符
    # （标题可能含路径分隔符等文件名非法字符）；空标题退 "session"。
    slug = "".join(
        c if (c.isalnum() or c == "-") else "-"
        for c in title
    )
    slug = "-".join(p for p in slug.split("-") if p) or "session"
    filename = f"{slug}-{datetime.now(timezone.utc):%Y%m%d}.json"
    content = json.dumps(data, ensure_ascii=False)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        },
    )


def _parse_export_payload(raw: bytes) -> dict:
    """导入体预检：50MB 上限 → JSON 解析 → 根必须是对象（ADR-0038）。"""
    if len(raw) > _IMPORT_MAX_BYTES:
        raise CortexAPIError(413, "IMPORT_TOO_LARGE", "导入文件超过 50MB 上限")
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise CortexAPIError(400, "IMPORT_INVALID", "文件不是合法 JSON")
    if not isinstance(data, dict):
        raise CortexAPIError(400, "IMPORT_INVALID", "文件根必须是 JSON 对象")
    return data


def _import_payload(data: dict, as_copy: bool = False) -> bool:
    """结构校验 + 写入；ValueError → 400（不部分导入）。返回是否新导入。

    ``as_copy``（2026-10-29）：同 id 已存在时改导为新 id 副本而非跳过。
    """
    store = _get_store()
    try:
        return store.import_session(data, str(_get_workdir()), as_copy)
    except ValueError as e:
        raise CortexAPIError(400, "IMPORT_INVALID", str(e))


@router.post("/sessions/import")
async def import_session(request: Request, as_copy: bool = False):
    """导入会话（单文件单会话，ADR-0038）。同 id 已存在 → 跳过；结构校验
    失败 → 400 整体拒绝（不部分导入）。

    ``as_copy=true``（2026-10-29）：已存在时不跳过，改导为新 id 副本
    （标题带「（导入副本）」）——前端在 skipped 后二次确认走这条路径。

    body 上限 50MB（超限 413）——raw bytes 先验长度再解析，防超大
    body 进 JSON 解析器。
    """
    raw = await request.body()
    data = _parse_export_payload(raw)
    imported = _import_payload(data, as_copy)
    return {
        "ok": True,
        "imported": 1 if imported else 0,
        "skipped": 0 if imported else 1,
    }


@router.post("/sessions/import/upload")
async def import_session_upload(
    file: UploadFile = File(...), as_copy: bool = False
):
    """WebView 容器内的导入入口（pickAndUploadFiles 原生直传，ADR-0038）。

    X5 内核不弹 `<input type="file">` 选择器、H5 也拿不到所选文件字节，
    因此原生把文件 multipart 直传到本端点（upload_bridge.md）。语义与
    POST /sessions/import 完全一致，只是入口形态不同。

    响应兼容原生上传回调契约（upload_bridge.md §2.2）：原生只把服务端
    返回的 path/bytes_written/overwritten 透传给 H5，故借用 `path` 字段
    回报导入结果（"imported" / "skipped"），H5 据此给精确提示。
    """
    name = file.filename or ""
    if Path(name).suffix.lower() != ".json":
        raise CortexAPIError(
            400, "INVALID_TYPE", f"仅支持会话导出 JSON 文件: {name or '(无文件名)'}"
        )
    raw = await file.read(_IMPORT_MAX_BYTES + 1)  # +1 用于判定超限
    data = _parse_export_payload(raw)
    imported = _import_payload(data, as_copy)
    return {
        "ok": True,
        "imported": 1 if imported else 0,
        "skipped": 0 if imported else 1,
        "path": "imported" if imported else "skipped",
        "bytes_written": len(raw),
        "overwritten": False,
    }
