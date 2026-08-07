"""AI 对话中断注册表 —— 把「停止」从 HTTP 请求路由到正在运行的生成线程。

每次 ``POST /api/chat`` 启动生成线程时，按 ``session_id`` 登记一个
``threading.Event``；``POST /api/chat/stop``（或 SSE 客户端断开）通过同一
``session_id`` 查表 ``set()``，通知 ``StreamingAgent`` 在下一个流式检查点中断
（见 ``planify/streaming/runner.py`` 的 ``interrupt_event`` 检查）。

设计要点：
- 注册表属主是 ASGI 事件循环所在进程，生成线程与停止端点跨线程读写 → 加锁。
- ``unregister`` 仅当表里是**同一个** event 才删：避免「停 → 迅速重发」竞态里，
  旧线程收尾时误删掉新线程刚登记的新事件，导致新流再也无法被停止。
- ``request_stop`` 命中与否都安全：未命中（流已结束 / 不存在）= no-op，
  让前端可以 fire-and-forget 而无需关心时序。
"""
import threading

__all__ = ["register_interrupt", "unregister_interrupt", "request_stop"]

_lock = threading.Lock()
_interrupts: dict[str, threading.Event] = {}


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


def request_stop(session_id: str) -> bool:
    """请求中断 ``session_id`` 对应的生成。

    Returns:
        True 表示命中活跃流并已发出中断信号；False 表示无活跃流（no-op）。
    """
    with _lock:
        ev = _interrupts.get(session_id)
    if ev is None:
        return False
    ev.set()
    return True
