"""后台 worker 线程的生命周期原语（AP-43）。

常见错误：``stop()`` 里 ``join(timeout)`` 超时后无条件把 ``_thread`` 置 None
并 ``_running = False``——线程其实还在跑（在途视觉调用 5-60s、git push 120s
必然超时），随后 ``start()`` 又会起第二条线程：新旧消费者并存，旧线程把
产物写回旧 ``index_path``、两条 MCP loop 并发改同一张连接表。

本模块只做两件小事，四个 worker（vision / diary / git_sync / translate）
与 mcp_client 共用，避免每个类各写一份判断：

- ``join_thread(thread, timeout)``：join 后报告线程**是否真的退出**；
- ``WorkerStopState``：把「停止中」这个第三态显式化（running / stopping / stopped），
  ``start()`` 在 stopping 态必须拒绝，而不是当已停止。
"""
from __future__ import annotations

import logging
import threading
from typing import Optional

logger = logging.getLogger(__name__)


def join_thread(thread: Optional[threading.Thread], timeout: float) -> bool:
    """join ``thread`` 至多 ``timeout`` 秒。

    Returns:
        True = 线程不存在或已确认退出；False = 仍在运行（超时）。
    """
    if thread is None:
        return True
    thread.join(timeout)
    return not thread.is_alive()


class WorkerStopState:
    """worker 线程的三态（供 status 上报与 start 拒绝）。

    只保护 ``thread`` 引用与 ``stopping`` 标志；``_running`` 等业务状态的锁
    仍由各 worker 自己的 ``_state_lock`` 负责（本类不接管）。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._stopping = False

    @property
    def stopping(self) -> bool:
        with self._lock:
            return self._stopping

    def begin(self) -> None:
        with self._lock:
            self._stopping = True

    def clear(self) -> None:
        with self._lock:
            self._stopping = False

    def can_start(self, name: str, thread: Optional[threading.Thread]) -> bool:
        """``start()`` 的前置判定。

        Returns:
            True = 允许启动（线程已退出或从未启动）；False = 拒绝（仍在运行 /
            停止中）——调用方直接返回 False，不得新建线程。
        """
        if thread is None or not thread.is_alive():
            return True
        if self.stopping:
            logger.warning("%s 正在停止中（旧线程未退出），拒绝启动第二条线程", name)
        else:
            logger.info("%s 已在运行，跳过重复启动", name)
        return False
