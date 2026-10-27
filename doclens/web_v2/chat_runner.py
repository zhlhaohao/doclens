"""会话级对话执行登记表（ADR-0028：断开续跑）。

SSE 消费端断开（关页 / 断网 / 切走）不再终止生成：agent task 从 SSE
生成器的生命周期中**脱钩**，由本登记表持有强引用直至跑完本轮并落库
（含展示层 message_ai 补写）。用户主动停止（POST /chat/stop）不受影响
——仍然立刻停止（request_stop 的 Event + hook，加 ADR-0035 的 task.cancel）。

职责：
- 强引用持有 agent_task（防 asyncio 只持弱引用被 GC）；
- 「会话生成中」判定：POST /chat 预检 409（防同会话两轮交错写库）、
  GET /api/sessions/{id} 的 generating 字段（前端恢复态展示）；
- 原子注册（try_register）：并发两会话请求只有一个能注册成功。

与 chat_interrupt 的分工：interrupt registry 管「停止信号」（threading
Event + hook），本表管「执行体生命周期」（asyncio Task）——两者注册/
注销时机不同步（断开后 interrupt 仍随 agent 存活），故分表维护。
"""
from __future__ import annotations

import asyncio
import logging
import threading
from typing import Dict, Optional

logger = logging.getLogger(__name__)

_lock = threading.Lock()
# session_id -> 正在生成的 agent task（asyncio.Task，跑在同一事件循环上）
_active: Dict[str, asyncio.Task] = {}
# session_id -> ChatEventEmitter（断开续跑期的 trace 快照源，2026-10-27）。
# 生命周期与 task 同步：注册时挂入，done_callback 一并摘除。
_emitters: Dict[str, object] = {}


def try_register(session_id: str, task: asyncio.Task, emitter=None) -> bool:
    """原子注册：同会话已有活跃 task 则拒绝（返回 False，调用方应取消
    新 task 并以 409 拒绝请求）。注册成功同时挂 done_callback 自动注销
    （防异常路径漏注销导致会话永久 409）。

    emitter（可选）：本轮的 ChatEventEmitter——断开续跑期间前端可经
    GET /api/chat/trace 拉取实时 tool_calls 快照，消除「后台跑了几轮、
    前端 pane 静止」的事件真空（2026-10-27 插话事故）。
    """
    with _lock:
        existing = _active.get(session_id)
        if existing is not None and not existing.done():
            return False
        _active[session_id] = task
        if emitter is not None:
            _emitters[session_id] = emitter

    def _cleanup(_t, sid=session_id):
        unregister(sid, _t)
        with _lock:
            _emitters.pop(sid, None)

    task.add_done_callback(_cleanup)
    return True


def unregister(session_id: str, task: asyncio.Task) -> None:
    """注销（仅当登记的就是这个 task 才移除——防串号覆盖后来的注册）。"""
    with _lock:
        if _active.get(session_id) is task:
            del _active[session_id]


def is_running(session_id: Optional[str]) -> bool:
    """该会话是否有正在生成的对话轮（409 预检 / generating 字段）。"""
    if not session_id:
        return False
    with _lock:
        task = _active.get(session_id)
        return task is not None and not task.done()


def active_count() -> int:
    """当前在途生成总数（ADR-0043 工作目录热切换确认对话框的警告数据源）。"""
    with _lock:
        return sum(1 for t in _active.values() if not t.done())


def get_task(session_id: str) -> Optional[asyncio.Task]:
    """取该会话的活跃 task（/chat/stop 取消路径，ADR-0035）。

    停止端点持有本表 task 引用并 cancel——「取消禁令」已解除（原注释
    禁止消费方 cancel，2026-10-05 起停止语义升级为「信号 + 取消」：
    检查点覆盖不到静默期，cancel 是唯一可靠手段；收尾落库全在
    _run_and_finalize 的 finally，cancel 不丢收尾）。测试/诊断消费方
    仍不得 cancel——停止一律走 /chat/stop 端点。
    """
    with _lock:
        return _active.get(session_id)


def get_trace_snapshot(session_id: str) -> list:
    """该会话生成中的实时 tool_calls 快照（GET /api/chat/trace 数据源）。

    断开续跑（ADR-0028）期间 SSE 无人消费，事件真空导致前端思考 pane
    停留在断开前的最后一步——本快照供前端重进/重连会话时补齐
    （含 running 态：无 output 的调用对补 status=running）。
    非生成中返回 []（前端走 detail 回放路径）。
    """
    with _lock:
        emitter = _emitters.get(session_id)
    if emitter is None:
        return []
    calls = getattr(emitter, "tool_calls", None) or []
    out = []
    for tc in calls:
        item = {
            "tool_use_id": tc.get("tool_use_id", ""),
            "name": tc.get("name", ""),
            "input": tc.get("input", {}),
            "output": tc.get("output", ""),
            "is_error": tc.get("is_error", False),
            "duration_ms": tc.get("duration_ms"),
        }
        if "output" not in tc:
            item["status"] = "running"
        out.append(item)
    return out


def clear_all() -> None:
    """清空登记表（仅供测试隔离；运行时勿用——不取消 task，只解除引用）。"""
    with _lock:
        _active.clear()
