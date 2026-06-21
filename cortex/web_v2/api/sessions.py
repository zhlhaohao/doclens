"""GET/POST/PATCH/DELETE /api/sessions。"""
import threading
from datetime import datetime, timezone
from itertools import chain
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query
import ulid as _ulid

from cortex.web_v2.api.errors import CortexAPIError
from cortex.web_v2.models.session import (
    SessionAppendRequest,
    SessionCreateRequest,
    SessionCreatedResponse,
    SessionDetailResponse,
    SessionListResponse,
)
from cortex.web_v2.sessions_store import SessionItem, SessionSummary, SessionType, SessionsStore

router = APIRouter()

_store: Optional[SessionsStore] = None
_store_lock = threading.RLock()


def _get_store() -> SessionsStore:
    """全局单例 SessionsStore。

    sessions.db 与 index.db 放在同一个 .cortex/ 目录下，跟随当前工作目录，
    保证不同工作目录的会话相互隔离。
    """
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                from cortex.web_v2.deps import get_index_manager
                idx = get_index_manager()
                db_path = Path(idx.index_path).parent / "sessions.db"
                db_path.parent.mkdir(parents=True, exist_ok=True)
                _store = SessionsStore(db_path)
    return _store


@router.post("/sessions", response_model=SessionCreatedResponse)
async def create_session(req: SessionCreateRequest):
    store = _get_store()
    now = datetime.now(timezone.utc)
    sid = str(_ulid.new())
    summary = SessionSummary(
        id=sid, type=req.type, title=req.title, preview=req.preview,
        created_at=now, updated_at=now, message_count=0,
    )
    store.create(summary)
    return SessionCreatedResponse(id=sid, type=req.type, title=req.title, preview=req.preview)


@router.post("/sessions/find-or-create", response_model=SessionCreatedResponse)
async def find_or_create_session(req: SessionCreateRequest):
    """按 (type, title) 原子地查找或新建会话。

    主要服务于 search 历史：相同关键词只保留一条记录，重复搜索时刷新 updated_at 置顶。
    chat 等需要保留每条消息的场景仍应使用 POST /sessions + PATCH /sessions/{id}。
    """
    store = _get_store()
    summary = store.find_or_create(req.type, req.title, req.preview)
    return SessionCreatedResponse(
        id=summary.id, type=summary.type, title=summary.title, preview=summary.preview,
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
        items.sort(key=lambda s: s.updated_at, reverse=True)
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
    return SessionDetailResponse(
        **summary.model_dump(mode="json"),
        items=[{"kind": i.kind, "payload": i.payload, "seq": i.seq} for i in items],
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


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    store.delete(session_id)
    return {"ok": True}


@router.delete("/sessions")
async def clear_sessions(
    type: Optional[SessionType] = Query(default=None, description="按类型清空；不传则清空全部"),
):
    """批量删除会话。type=None 清全部。"""
    store = _get_store()
    deleted = store.delete_by_type(type)
    return {"ok": True, "deleted_count": deleted}
