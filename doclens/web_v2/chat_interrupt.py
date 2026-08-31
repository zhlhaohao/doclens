"""AI 对话中断注册表 —— 把「停止」从 HTTP 请求路由到正在运行的生成任务。

每次 ``POST /api/chat`` 开始生成时，按 ``session_id`` 登记一个
``threading.Event``；``POST /api/chat/stop``（或 SSE 客户端断开）通过同一
``session_id`` 查表 ``set()``，通知 ``StreamingAgent`` 在下一个检查点中断
（见 ``planify/streaming/runner.py`` 的 ``interrupt_event`` 检查）。

中断 hook：除 Event 外还可按 session 登记回调（如唤醒该会话挂起的
ask 等待）——Event 检查点覆盖不到工具挂起期间，hook 补上这个缺口：
``request_stop`` 时逐个调用，把 ``waiter`` 上悬置的 request 一并唤醒。

设计要点：
- 注册表属主是 ASGI 事件循环所在进程，多请求/停止端点跨协程读写 → 加锁。
- ``unregister`` 仅当表里是**同一个** event 才删：避免「停 → 迅速重发」竞态里，
  旧请求收尾时误删掉新请求刚登记的新事件，导致新流再也无法被停止。
- ``request_stop`` 命中与否都安全：未命中（流已结束 / 不存在）= no-op，
  让前端可以 fire-and-forget 而无需关心时序。
- hook 抛错不阻断停止流程（逐个 try/except 记日志）。
"""
import logging
import threading
from typing import Callable

__all__ = [
    "register_interrupt",
    "unregister_interrupt",
    "register_interrupt_hook",
    "unregister_interrupt_hook",
    "request_stop",
]

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_interrupts: dict[str, threading.Event] = {}
_interrupt_hooks: dict[str, set[Callable[[], None]]] = {}


def register_interrupt(session_id: str) -> threading.Event:
    """为 ``session_id`` 登记一个新的中断事件并返回。

    last-write-wins：若该 session 已有条目（理论上不会，UI 单会话单流）则覆盖。
    """
    ev = threading.Event()
    with _lock:
        _interrupts[session_id] = ev
    return ev


def unregister_interrupt(session_id: str, event: threading.Event) -> None:
    """摘除 ``session_id`` 的中断事件；仅当表里正是同一个 event 才删（防竞态误删）。"""
    with _lock:
        if _interrupts.get(session_id) is event:
            _interrupts.pop(session_id, None)


def register_interrupt_hook(session_id: str, hook: Callable[[], None]) -> None:
    """登记会话级中断回调（``request_stop`` 时调用，如唤醒挂起的 ask 等待）。"""
    with _lock:
        _interrupt_hooks.setdefault(session_id, set()).add(hook)


def unregister_interrupt_hook(session_id: str, hook: Callable[[], None]) -> None:
    """摘除会话级中断回调（请求收尾时调用，防止旧 hook 误触发/泄漏）。"""
    with _lock:
        hooks = _interrupt_hooks.get(session_id)
        if hooks is not None:
            hooks.discard(hook)
            if not hooks:
                _interrupt_hooks.pop(session_id, None)


def request_stop(session_id: str) -> bool:
    """请求中断 ``session_id`` 对应的生成：set Event + 调用全部中断 hook。

    Returns:
        True 表示命中活跃流并已发出中断信号；False 表示无活跃流
        （hook 仍会执行——ask 悬置而流已收尾的窗口期也能被唤醒）。
    """
    with _lock:
        ev = _interrupts.get(session_id)
        hooks = list(_interrupt_hooks.get(session_id, ()))
    if ev is not None:
        ev.set()
    for hook in hooks:
        try:
            hook()
        except Exception:  # noqa: BLE001
            logger.exception("[chat_interrupt] 中断 hook 执行失败，跳过")
    return ev is not None
