"""会话级对话执行登记表（ADR-0028：断开续跑）。

SSE 消费端断开（关页 / 断网 / 切走）不再终止生成：agent task 从 SSE
生成器的生命周期中**脱钩**，由本登记表持有强引用直至跑完本轮并落库
（含展示层 message_ai 补写）。用户主动停止（POST /chat/stop）不受影响
——仍然立刻停止（chat_interrupt 的 request_stop 三层兜底）。

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


def try_register(session_id: str, task: asyncio.Task) -> bool:
    """原子注册：同会话已有活跃 task 则拒绝（返回 False，调用方应取消
    新 task 并以 409 拒绝请求）。注册成功同时挂 done_callback 自动注销
    （防异常路径漏注销导致会话永久 409）。"""
    with _lock:
        existing = _active.get(session_id)
        if existing is not None and not existing.done():
            return False
        _active[session_id] = task
    task.add_done_callback(lambda _t, sid=session_id: unregister(sid, _t))
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


def get_task(session_id: str) -> Optional[asyncio.Task]:
    """取该会话的活跃 task（测试/诊断用；消费方不得 cancel——停止一律走
    chat_interrupt.request_stop 的检查点语义，保证收尾落盘有序）。"""
    with _lock:
        return _active.get(session_id)


def clear_all() -> None:
    """清空登记表（仅供测试隔离；运行时勿用——不取消 task，只解除引用）。"""
    with _lock:
        _active.clear()
