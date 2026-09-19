"""GET/POST/PATCH/DELETE /api/sessions。"""
from datetime import datetime, timezone
from itertools import chain
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query
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
from doclens.web_v2.sessions_store import SessionItem, SessionSummary, SessionType, SessionsStore
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


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(session_id: str):
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    items = store.get_detail(session_id)
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


@router.patch("/sessions/{session_id}")
async def append_session(session_id: str, req: SessionAppendRequest):
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    existing = store.get_detail(session_id)
    next_seq = (existing[-1].seq + 1) if existing else 0
    for idx, item in enumerate(req.items):
        store.append_item(SessionItem(
            session_id=session_id,
            seq=next_seq + idx,
            kind=item["kind"],
            payload=item.get("payload", "{}"),
        ))
    new_count = req.message_count if req.message_count is not None else (summary.message_count + len(req.items))
    store.update_count_and_time(session_id, new_count)
    return {"ok": True, "id": session_id, "message_count": new_count}


@router.patch("/sessions/{session_id}/title")
async def rename_session(session_id: str, req: SessionRenameRequest):
    """人工改名（2026-09-17）。strip 后为空 → 400；超 60 字符截断
    （与 chat-view 创建时的 slice(0, 60) 对齐）；不刷新 updated_at。"""
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    title = req.title.strip()[:60]
    if not title:
        raise CortexAPIError(400, "TITLE_EMPTY", "标题不能为空")
    store.update_title(session_id, title)
    return {"ok": True, "id": session_id, "title": title}


@router.patch("/sessions/{session_id}/star")
async def star_session(session_id: str, req: SessionStarRequest):
    """加星/取消加星（2026-09-17）：加星即置顶（排序键 starred DESC）+
    删除保护；与改名同理不刷新 updated_at，避免打乱组内时间序。"""
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    store.set_starred(session_id, req.starred)
    return {"ok": True, "id": session_id, "starred": req.starred}


@router.post("/sessions/{session_id}/compact")
async def compact_session(session_id: str):
    """手动压缩会话历史（ADR-0026 压缩即事实的手动入口，2026-09-17）。

    全量摘要落库为 compacted 条目（回放截断投影，下轮起 LLM 上下文从摘要
    开始）；原文双备份在 DB 条目（展示层不受影响）与 .transcripts/ 文件。
    - 仅 chat 会话；流式生成中 409（与 run_stream 的历史 mutate 互斥）；
    - 历史过短 400（无摘要意义，白付一次 LLM 调用）。
    """
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    if summary.type is not SessionType.CHAT:
        raise CortexAPIError(400, "NOT_CHAT_SESSION", "仅对话会话支持压缩")
    from doclens.web_v2.chat_interrupt import is_streaming
    if is_streaming(session_id):
        raise CortexAPIError(409, "SESSION_STREAMING", "对话生成中，请等待完成后再压缩")

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
            tracer=LLMTracer.create(label="compact", session_key=session_id),
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
    }


@router.get("/sessions/{session_id}/rewind/preview")
async def rewind_preview(session_id: str, point_seq: int = Query(..., description="锚点 message_user 的 seq")):
    """回退预览（ADR-0027，只读不写盘）：锚点校验 + 文件三态处置清单。

    供确认框展示「将恢复 / 将删除 / 无法恢复」清单；死段消息计数由前端
    从 detail items 自行计算（前端本就持有全量条目与 seq）。
    """
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    if summary.type is not SessionType.CHAT:
        raise CortexAPIError(400, "NOT_CHAT_SESSION", "仅对话会话支持回退")
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
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    if summary.type is not SessionType.CHAT:
        raise CortexAPIError(400, "NOT_CHAT_SESSION", "仅对话会话支持回退")
    from doclens.web_v2.chat_interrupt import is_streaming
    if is_streaming(session_id):
        raise CortexAPIError(409, "SESSION_STREAMING", "对话生成中，请等待完成后再回退")
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
    # 删前快照 chat 会话 id——删后 list 只剩幸存者，被删者的备份目录要靠
    # 这份清单级联清理（ADR-0027）
    chat_ids_before = (
        [s.id for s in store.list(SessionType.CHAT, limit=1000000)]
        if type is None or type == SessionType.CHAT
        else []
    )
    deleted, skipped_starred = store.delete_by_type(type)
    # 涉及聊天会话时清空 AI 临时工作区（仅 chat 会话会产生 tmp 文件）
    if type is None or type == SessionType.CHAT:
        cleanup_all_tmp(_get_workdir())
        grant_clear_all()
        # 级联清改前备份（ADR-0027）：只清确实已删除的会话——加星幸存者不动
        from doclens.web_v2.deps import get_rewind_tracker
        tracker = get_rewind_tracker()
        for sid in chat_ids_before:
            if store.get(sid) is None:
                tracker.purge(sid)
    return {"ok": True, "deleted_count": deleted, "skipped_starred": skipped_starred}
