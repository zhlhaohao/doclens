"""团队 API（ADR-0060）：Bot 列表 / Bot 会话（读、发消息、暂停、删实体）/ DAG 操作。

隔离规则集中在本文件（§3）：Bot 会话的读写都校验 `bot.leased_by == 当前 session_id`，
否则 409。Bot 会话的 detail 走本文件的专用端点，不复用 `/api/sessions/{id}`——
但响应含与 lead detail 等价的恢复协议字段（generating + last_persisted_seq）。

planify 不 import doclens：本文件是宿主，经 `agent.team_hub` 访问 TeamHub，
经 `bootstrap_team` 注入的 session_sink 把 Bot 线程的事件落进 sessions.db。
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sse_starlette import EventSourceResponse

from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.sessions_store import SessionItem, SessionType

router = APIRouter()
logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ 依赖

def _hub():
    from doclens.web_v2 import deps
    ag = deps.get_agent_if_ready()
    hub = getattr(ag, "team_hub", None) if ag else None
    if hub is None:
        raise CortexAPIError(503, "TEAM_NOT_READY", "团队功能尚未就绪")
    return hub


def _store():
    from doclens.web_v2 import deps
    return deps.get_sessions_store()


def require_bot(scope: str, name: str):
    """隔离校验（§3）：Bot 必须被当前会话租借。"""
    hub = _hub()
    bot = hub.registry.get(name)
    if bot is None:
        raise CortexAPIError(404, "BOT_NOT_FOUND", f"Bot '{name}' 不存在")
    holder = bot.get("leased_by")
    if holder != scope:
        from doclens.web_v2.sessions_store import SessionSummary  # noqa: F401
        title = holder or "空闲"
        raise CortexAPIError(409, "BOT_LEASED", f"Bot '{name}' 正被会话 {title} 占用")
    return hub, bot


# ------------------------------------------------------------------ Bot 会话落库 sink

def make_session_sink():
    """Bot 线程 → sessions.db 的落库回调（ADR-0060 §3）。

    在 Bot 线程执行（同步），store 每次新建连接 + RLock，跨线程安全。
    每个事件：按事件类型取/建 bot 会话（task 维度或纯对话维度），append_item 落库，
    然后经 TeamEventBus 通知观看者（先存后发）。父会话已删则 append_item 内部静默。
    """
    def _sink(scope: str, bot_name: str, event: dict) -> None:
        store = _store()
        etype = event.get("type")
        hub = _hub()
        # 任务维度：Bot 当前持有的 task（从事件推断——sink 事件带 task_id 时按它，
        # 否则按该 Bot 在 scope 内的在跑任务）
        task_id = event.get("task_id")
        sid = store.find_or_create_bot_session(bot_name, scope, task_id=task_id)
        if etype == "message_ai":
            kind, payload = "message_ai", json.dumps({"text": event["text"], "references": []}, ensure_ascii=False)
        elif etype == "tool_step":
            kind = "tool_calls"
            payload = json.dumps({"calls": [{"name": event["name"], "input": event["input"],
                                             "output": event["output"], "status": "done"}]}, ensure_ascii=False)
        elif etype == "bot_notice":
            kind = "bot_notice"
            payload = json.dumps({"notice_type": event["notice_type"], "text": event["text"]}, ensure_ascii=False)
        else:
            return
        seq = store.append_item_auto_seq(sid, kind, payload)
        if seq is None:
            return  # 父会话已删
        # 通知观看者（先存后发）
        if etype != "bot_notice":
            hub.events.publish(scope, bot_name, {"type": "persisted", "kind": kind, "seq": seq})

    return _sink


# ------------------------------------------------------------------ Bot 列表

class BotCreateRequest(BaseModel):
    session_id: str
    name: str
    role: str


@router.post("/team/bots")
async def create_bot(req: BotCreateRequest):
    """新建或租借 Bot（ADR-0060 §2 团队页直达——不经 lead）。

    复用 BotRegistry.spawn 语义：不存在 → 创建；shutdown → 复活；空闲（无租约）
    → 本会话租借；被其他会话租借 → 409。授予本会话租约后不起线程——用户开口
    （/send）才起，避免白耗一次 LLM 调用。名字/角色校验由 registry 负责
    （BotRegistryError 直接透传给用户看）。
    """
    hub = _hub()
    await _ensure_scope(hub, req.session_id)
    from planify.team.bot_registry import BotRegistryError

    def _run():
        try:
            bot = hub.registry.spawn(req.name.strip(), req.role, req.session_id)
        except BotRegistryError as e:
            raise CortexAPIError(400, "BOT_INVALID", str(e))
        return {"ok": True, "name": bot["name"], "role": bot["role"], "spawned": bot.get("_spawned", False)}

    return await asyncio.to_thread(_run)


@router.get("/team/roles")
async def list_roles():
    """预制角色清单（ADR-0058：内置唯一来源）——团队页新建 Bot 下拉用。
    不含 default（spawn 不指定角色时的兜底，不给用户选）。"""
    hub = _hub()
    out = []
    for rid in hub.roles.ids():
        if rid == "default":
            continue
        r = hub.roles.get(rid)
        out.append({"id": rid, "name": r.text(r.name), "description": r.text(r.description)[:160]})
    return {"roles": out}


@router.get("/team/bots")
async def list_bots(session_id: str = Query("", description="当前会话；空 = 只列实体不查任务")):
    """全部 Bot 实体（全局），标注租约 / 状态 / 记忆摘要 / 当前任务。
    session_id 为空时跳过 scope 恢复（团队页空态也能看到全部 Bot）。"""
    hub = _hub()
    if session_id:
        await _ensure_scope(hub, session_id)
    out = []
    for b in hub.registry.list_all():
        name = b["name"]
        task = None
        sc = hub.try_scope(session_id) if session_id else None
        if sc is not None and b.get("leased_by") == session_id:
            from planify.team import dag as D
            for d in D.read_all_dags(sc.dags_dir):
                for st in d["steps"].values():
                    if st.get("assignee") == name and st["status"] in (D.STEP_IN_PROGRESS, D.STEP_VERIFYING):
                        task = {"dag_id": d["id"], "step_id": st.get("task_id"), "subject": st.get("subject") or ""}
        mem = hub.registry.read_memory(name)
        out.append({
            "name": name, "role": b["role"], "status": b["status"],
            "leased_by": b.get("leased_by"), "created_by": b.get("created_by"),
            "alive": hub.runner.is_alive(session_id, name) if hub.runner else False,
            "memory_summary": mem[:120],
            "task": task,
        })
    return {"bots": out}


def _held_task_id(hub, scope: str, name: str) -> Optional[int]:
    """会话归属口径（与 runner sink 一致）：线程当前持有的 task；线程不在时退回
    scope 内该 Bot 在跑步骤的 task（recover 后线程未起、任务已派的窗口）。"""
    if hub.runner is not None:
        t = hub.runner.held_task(scope, name)
        if t is not None:
            return t
    sc = hub.try_scope(scope)
    if sc is None:
        return None
    from planify.team import dag as D
    for d in D.read_all_dags(sc.dags_dir):
        for st in d["steps"].values():
            if st.get("assignee") == name and st["status"] in (D.STEP_IN_PROGRESS, D.STEP_VERIFYING):
                return st.get("task_id")
    return None


async def _ensure_scope(hub, scope_id: str):
    """首次访问该会话的团队数据时惰性建立 scope（ADR-0059 §11e：reclaim 租约 +
    recover DAG）。hub.scope() 会同步跑 recover_scope + 可能起调度线程，故 to_thread；
    已建立后 try_scope 命中、零开销。"""
    if hub.try_scope(scope_id) is not None:
        return
    await asyncio.to_thread(hub.scope, scope_id)


# ------------------------------------------------------------------ Bot 会话读

@router.get("/team/bots/{name}/session")
async def bot_session(name: str, session_id: str = Query(...)):
    """Bot 会话 detail（§3）：含 generating + last_persisted_seq（恢复协议）。"""
    hub = _hub()
    await _ensure_scope(hub, session_id)
    hub, bot = require_bot(session_id, name)
    store = _store()
    sid = store.find_bot_session(name, session_id)
    if sid is None:
        return {"bot_session_id": None, "generating": bool(hub.runner and hub.runner.is_alive(session_id, name)),
                "items": [], "last_persisted_seq": 0}
    items = store.get_detail(sid)
    meta = store.get_bot_session_meta(sid) or {}
    return {
        "bot_session_id": sid,
        "generating": bool(hub.runner and hub.runner.is_alive(session_id, name)),
        "last_persisted_seq": meta.get("last_persisted_seq", 0),
        "items": [{"seq": it.seq, "kind": it.kind, "payload": it.payload} for it in items],
    }


# ------------------------------------------------------------------ Bot 会话实时流（SSE）

@router.get("/team/bots/{name}/stream")
async def bot_stream(name: str, session_id: str = Query(...)):
    hub = _hub()
    await _ensure_scope(hub, session_id)
    hub, bot = require_bot(session_id, name)

    async def event_stream():
        q = hub.events.subscribe(session_id, name)
        try:
            snap = hub.events.snapshot(session_id, name)
            store = _store()
            sid = store.find_bot_session(name, session_id)
            meta = store.get_bot_session_meta(sid) if sid else None
            yield {"event": "snapshot", "data": json.dumps({
                "text_so_far": snap["text_so_far"],
                "last_persisted_seq": (meta or {}).get("last_persisted_seq", 0),
                "generating": bool(hub.runner and hub.runner.is_alive(session_id, name)),
            }, ensure_ascii=False)}
            while True:
                try:
                    item = await asyncio.wait_for(q.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # 心跳：Bot 不在跑且队列空时告诉前端，但不主动断（Bot 可能复活）
                    if hub.runner and not hub.runner.is_alive(session_id, name):
                        yield {"event": "status", "data": json.dumps({"alive": False})}
                    else:
                        yield {"event": "ping", "data": "{}"}
                    continue
                t = item.get("type")
                yield {"event": t, "data": json.dumps({k: v for k, v in item.items() if k != "type"}, ensure_ascii=False)}
        finally:
            hub.events.unsubscribe(session_id, name, q)

    return EventSourceResponse(event_stream())


# ------------------------------------------------------------------ 用户对 Bot 说话

class BotSendRequest(BaseModel):
    session_id: str
    text: str


@router.post("/team/bots/{name}/send")
async def bot_send(name: str, req: BotSendRequest):
    """用户对 Bot 说话（§3）：线程活着 → 写收件箱；shutdown → runner.start 复活。

    用户的 message_user 由本端点（API 线程）落库——Bot 线程不落用户消息，避免双写。
    """
    hub = _hub()
    await _ensure_scope(hub, req.session_id)
    hub, bot = require_bot(req.session_id, name)
    store = _store()
    # 会话归属：Bot 当前持有任务 → 该 task 的会话；否则纯对话会话（按 bot,parent 复用）
    task_id = _held_task_id(hub, req.session_id, name)
    sid = store.find_or_create_bot_session(name, req.session_id, task_id=task_id)
    store.append_item_auto_seq(sid, "message_user", json.dumps({"text": req.text}, ensure_ascii=False))
    if hub.runner is not None and hub.runner.is_alive(req.session_id, name):
        sc = hub.scope(req.session_id)
        sc.bus.send("user", name, req.text, msg_type="user_message")
        return {"ok": True, "mode": "inbox", "bot_session_id": sid}
    if hub.runner is not None:
        hub.runner.start(req.session_id, name, req.text)
        return {"ok": True, "mode": "revived", "bot_session_id": sid}
    raise CortexAPIError(503, "RUNNER_NOT_READY", "Bot 运行器未就绪")


# ------------------------------------------------------------------ Bot 暂停

class BotStopRequest(BaseModel):
    session_id: str


@router.post("/team/bots/{name}/stop")
async def bot_stop(name: str, req: BotStopRequest):
    """Bot 级「暂停」= 该 Bot 持有任务所属的 DAG 暂停（§4）；无任务只 shutdown 线程。"""
    hub = _hub()
    await _ensure_scope(hub, req.session_id)
    hub, bot = require_bot(req.session_id, name)
    sc = hub.try_scope(req.session_id)
    dag_ids = []
    if sc is not None:
        from planify.team import dag as D
        for d in D.read_all_dags(sc.dags_dir):
            if d["status"] != D.DAG_ACTIVE:
                continue
            for st in d["steps"].values():
                if st.get("assignee") == name and st["status"] in (D.STEP_IN_PROGRESS, D.STEP_VERIFYING):
                    dag_ids.append(d["id"])
    paused = 0
    if dag_ids and hub.scheduler is not None:
        paused = hub.scheduler.pause_scope(req.session_id, dag_ids=dag_ids)
    if hub.runner is not None:
        hub.runner.shutdown_bot(req.session_id, name)
    return {"ok": True, "dags_paused": paused}


# ------------------------------------------------------------------ 删实体

@router.post("/team/bots/{name}/delete")
async def bot_delete(name: str, session_id: str = Query(...)):
    """删实体：实体 + 记忆 + **本会话**的 bot 会话行；其他会话的历史留痕保留不可读。"""
    hub = _hub()
    await _ensure_scope(hub, session_id)
    hub, bot = require_bot(session_id, name)
    if hub.runner is not None:
        hub.runner.shutdown_bot(session_id, name)
    store = _store()
    removed = store.delete_bot_sessions_for_bot(name, session_id)
    ok = hub.registry.delete(name, session_id)
    return {"ok": ok, "bot_sessions_deleted": removed}


# ------------------------------------------------------------------ DAG

@router.get("/team/dags")
async def list_dags(session_id: str = Query(...)):
    """当前 scope 的 DAG + 步骤 + 验收（5s 轮询，不监听文件事件，§11g）。"""
    hub = _hub()
    await _ensure_scope(hub, session_id)
    sc = hub.try_scope(session_id)
    if sc is None:
        return {"dags": []}
    from planify.team import dag as D
    out = []
    for d in D.read_all_dags(sc.dags_dir):
        out.append({
            "id": d["id"], "name": d["name"], "status": d["status"],
            "output_dir": d["output_dir"], "stall_reason": d.get("stall_reason"),
            "failed_step": d.get("failed_step"), "llm_calls": d.get("llm_calls", 0),
            "steps": [
                {"step_id": sid, "subject": st.get("subject"), "assignee": st.get("assignee"),
                 "status": st["status"], "task_id": st.get("task_id"),
                 "interrupted": st.get("interrupted", False),
                 "deliverables": st.get("deliverables") or d["plan"]["steps"][i].get("deliverables", []),
                 "fix_rounds": st.get("fix_rounds", 0)}
                for i, (sid, st) in enumerate(d["steps"].items())
            ],
            "plan": d["plan"],
        })
    return {"dags": out}


class DagActionRequest(BaseModel):
    session_id: str
    step_id: Optional[str] = None  # retry 用


@router.post("/team/dags/{dag_id}/{action}")
async def dag_action(dag_id: int, action: str, req: DagActionRequest):
    """计划卡 / DAG 操作栏直调（§1）：复用 plan_tools handler，一律 to_thread 包裹
    （handler 是同步函数，hub.scope() 可能同步跑 recover_scope + ensure_started）。
    contextvar 经 copy_context 穿透 to_thread。replan 不在此——它是自然语言活，
    前端预填 chat 输入框（lead 调 group_plan_replan）。"""
    if action not in ("start", "pause", "resume", "cancel", "retry"):
        raise CortexAPIError(400, "UNKNOWN_ACTION", f"未知操作 {action}")
    hub = _hub()
    await _ensure_scope(hub, req.session_id)
    from planify.skills.access_state import set_current_session_id, reset_current_session_id
    from planify.team.plan_tools import make_plan_tools
    from doclens.web_v2 import deps
    ag = deps.get_agent_if_ready()
    _defs, handlers = make_plan_tools(lambda: hub, ag.workdir if ag else None)

    def _run() -> Dict[str, Any]:
        tok = set_current_session_id(req.session_id)
        try:
            if action == "start":
                return json.loads(handlers["group_plan_start"](dag_id))
            if action == "resume":
                return json.loads(handlers["group_plan_resume"](dag_id))
            if action == "cancel":
                return json.loads(handlers["group_plan_cancel"](dag_id))
            if action == "pause":
                n = hub.scheduler.pause_scope(req.session_id, dag_ids=[dag_id]) if hub.scheduler else 0
                return {"ok": True, "dags_paused": n}
            if action == "retry":
                if not req.step_id:
                    raise CortexAPIError(400, "STEP_REQUIRED", "retry 需要 step_id")
                return json.loads(handlers["group_plan_retry"](dag_id, req.step_id))
        finally:
            reset_current_session_id(tok)
        raise CortexAPIError(400, "UNKNOWN_ACTION", action)

    return await asyncio.to_thread(_run)
