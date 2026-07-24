"""watch 事件 fan-out 桥 + 近期文件变化缓冲。

FileWatcher / IndexManager 的事件全部产生自**后台线程**（watchdog observer /
reindex daemon），而 SSE 客户端跑在 asyncio 事件循环上。本模块把后台线程产生
的事件安全地分发给所有 SSE 客户端，并维护一份有界的「近期文件变化」列表供
状态快照与对话框展示。

线程模型：
- `subscribe / unsubscribe` 在 loop 线程上调用（SSE 端点请求生命周期内）。
- `broadcast / record_change` 在后台线程上调用（FileWatcher 回调）。
- `broadcast` 先在锁内拷贝客户端集合，再用 `loop.call_soon_threadsafe` 在
  loop 线程上执行 `queue.put_nowait` —— 这是跨线程入队 asyncio.Queue 的唯一
  安全方式（参考 api/chat.py 的 call_soon_threadsafe 手法）。
"""
import asyncio
import logging
import threading
from collections import deque
from typing import Any

logger = logging.getLogger(__name__)

_RECENT_MAX = 30


class WatchBroker:
    """单例：fan-out SSE 事件 + 近期文件变化环形缓冲。"""

    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._clients: set[asyncio.Queue] = set()
        # 保护 _clients：后台线程读 copy / loop 线程增删
        self._lock = threading.Lock()
        self._recent: deque[dict[str, Any]] = deque(maxlen=_RECENT_MAX)

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        """绑定事件循环（lifespan startup 阶段调用，主 loop 线程上）。"""
        self._loop = loop

    def subscribe(self) -> asyncio.Queue:
        """注册一个 SSE 客户端，返回它的专属队列。"""
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._clients.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        """注销客户端（SSE 连接断开时调用，防队列泄漏）。"""
        with self._lock:
            self._clients.discard(q)

    def record_change(self, rel_path: str, name: str, ts: float) -> None:
        """追加一条近期文件变化（deque 自动淘汰最旧）。不广播。"""
        self._recent.append({"path": rel_path, "name": name, "ts": ts})

    def recent_changes(self) -> list[dict[str, Any]]:
        """返回近期变化的浅拷贝（最旧→最新）。"""
        return list(self._recent)

    def broadcast(self, event: str, data: dict[str, Any]) -> None:
        """向所有客户端广播一个事件（线程安全，可从后台线程调用）。"""
        loop = self._loop
        if loop is None:
            return
        with self._lock:
            clients = list(self._clients)
        if not clients:
            return
        item = {"event": event, "data": data}
        for q in clients:
            try:
                loop.call_soon_threadsafe(q.put_nowait, item)
            except RuntimeError as exc:
                # loop 已关闭等：静默丢弃（客户端即将断开）
                logger.debug("watch broadcast dropped (loop gone?): %s", exc)
            except Exception as exc:  # noqa: BLE001
                logger.warning("watch broadcast failed: %s", exc)


_broker = WatchBroker()


def get_watch_broker() -> WatchBroker:
    """获取进程级 WatchBroker 单例。"""
    return _broker
