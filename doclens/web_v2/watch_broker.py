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

节流语义（AP-5 快照风暴防护）：
- `broadcast` 默认按事件类型节流（`_THROTTLE_SEC` 窗口内同事件至多入队一次），
  防止文件变更风暴（git checkout / 批量同步）时按原始事件粒度触发全量
  watch_snapshot() 广播，塞爆客户端队列。
- `broadcast(..., immediate=True)` 跳过节流——用于 reindex 完成、git 同步
  完成等用户明确等待的"终态"事件，不能因为节流被吞。
"""
import asyncio
import logging
import threading
import time
from collections import deque
from typing import Any

logger = logging.getLogger(__name__)

_RECENT_MAX = 30
# 广播节流窗口：窗口内同事件类型至多入队一次（AP-5）
_THROTTLE_SEC = 0.2


class WatchBroker:
    """单例：fan-out SSE 事件 + 近期文件变化环形缓冲。"""

    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._clients: set[asyncio.Queue] = set()
        # 保护 _clients + _last_broadcast_at：后台线程读写
        self._lock = threading.Lock()
        self._recent: deque[dict[str, Any]] = deque(maxlen=_RECENT_MAX)
        # 事件类型 → 上次实际入队的单调时钟（节流状态）
        self._last_broadcast_at: dict[str, float] = {}

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

    def broadcast(self, event: str, data: dict[str, Any], *, immediate: bool = False) -> None:
        """向所有客户端广播一个事件（线程安全，可从后台线程调用）。

        immediate=False（默认）：按事件类型节流——_THROTTLE_SEC 窗口内同事件
        类型只入队第一次，后续直接丢弃。watch_snapshot 是全量状态，丢弃中间
        帧不丢信息（客户端最终看到的仍是最新态）。
        immediate=True：跳过节流——终态事件（reindexed、git sync 完成）必须到。
        """
        loop = self._loop
        if loop is None:
            return
        now = time.monotonic()
        with self._lock:
            if not immediate:
                last = self._last_broadcast_at.get(event, 0.0)
                if now - last < _THROTTLE_SEC:
                    return
                self._last_broadcast_at[event] = now
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
