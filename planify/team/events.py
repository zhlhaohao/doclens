"""Bot 事件总线（ADR-0060 §3）：Bot 线程 → SSE 观看者的跨线程扇出桥。

线程模型：
- **publish / snapshot**：Bot 线程（同步）调用，只往内存 buffer / 队列写，**不知道
  asyncio 的存在**——runner 只见一个 ``publish(scope, bot, event)`` 方法。
- **subscribe / unsubscribe**：宿主 asyncio 侧（SSE 端点）调用，返回每 Bot 的
  ``asyncio.Queue(maxsize=256)``。``text_delta`` 的 50ms 合并由 asyncio 侧常驻
  task 驱动（Bot 线程不能起定时器）。
- **bind(loop)**：宿主 lifespan startup 注入事件循环；**unbind**：``shutdown_team``
  的最后一步（Bot 线程 join 之后）——提前 unbind 会丢 Bot finally 的末轮落库事件。

与 ``doclens.watch_broker`` 的关系：`call_soon_threadsafe` 手法同构，但语义全新
——WatchBroker 是无分组、无上限、按事件类型节流的**广播**；这里是 per-bot 分组、
有界丢最旧、按时间窗口合并的**定向扇出**。
"""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("planify.team.events")

_QUEUE_MAX = 256
_FLUSH_INTERVAL = 0.05  # text_delta 合并窗口（50ms）

Key = Tuple[str, str]  # (scope, bot_name)


class _Subscription:
    """一个 Bot 的订阅者集合 + 待发 text 缓冲。"""

    def __init__(self) -> None:
        self.clients: set[asyncio.Queue] = set()
        self.pending_text = ""
        self.last_seq = 0  # sink 落库水位（last_persisted_seq）


class TeamEventBus:
    """per-bot 事件扇出。线程安全：publish 在 Bot 线程，subscribe 在 loop 线程。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subs: Dict[Key, _Subscription] = {}
        self._texts: Dict[Key, str] = {}  # 当前轮已累积正文（snapshot 用）
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._flusher: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------ 生命周期

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        """绑定事件循环并起合并 task（宿主 lifespan startup）。"""
        self._loop = loop
        if self._flusher is None or self._flusher.done():
            self._flusher = loop.create_task(self._flush_loop())

    def unbind(self) -> None:
        """清空订阅者并停合并 task（shutdown_team 的最后一步）。"""
        with self._lock:
            self._subs.clear()
            self._texts.clear()
        if self._flusher is not None:
            self._flusher.cancel()
            self._flusher = None
        self._loop = None

    async def _flush_loop(self) -> None:
        while True:
            await asyncio.sleep(_FLUSH_INTERVAL)
            try:
                self._flush_text()
            except Exception:  # noqa: BLE001
                logger.exception("[events] flush failed")

    def _flush_text(self) -> None:
        with self._lock:
            ready = [(k, s.pending_text) for k, s in self._subs.items() if s.pending_text]
            for key, _ in ready:
                self._subs[key].pending_text = ""
        for key, text in ready:
            self._broadcast(key, {"type": "text_delta", "text": text})

    # ------------------------------------------------------------------ 发布（Bot 线程）

    def publish(self, scope: str, bot: str, event: Dict[str, Any]) -> None:
        """Bot 线程调用。text_delta 进缓冲由合并 task 发出；其余事件直发。"""
        etype = event.get("type")
        key = (scope, bot)
        if etype == "text_delta":
            with self._lock:
                sub = self._subs.setdefault(key, _Subscription())
                sub.pending_text += event.get("text") or ""
                self._texts[key] = self._texts.get(key, "") + (event.get("text") or "")
                return
        if etype == "round_end":
            # 轮末：清当前轮正文 + flush 残余缓冲（终态消息由 sink 落库，观看者
            # 靠 detail 替换 live 气泡）
            self._flush_text()
            with self._lock:
                self._texts[key] = ""
        self._broadcast(key, event)

    def _broadcast(self, key: Key, event: Dict[str, Any]) -> None:
        loop = self._loop
        if loop is None:
            return
        with self._lock:
            clients = list(self._subs.get(key).clients) if key in self._subs else []
        if not clients:
            return
        item = {"bot": key[1], **event}
        for q in clients:
            def _put(q=q):
                if q.full():
                    try:
                        q.get_nowait()  # 丢最旧——观看者要的是最新进度
                    except asyncio.QueueEmpty:
                        pass
                try:
                    q.put_nowait(item)
                except asyncio.QueueFull:
                    pass
            try:
                loop.call_soon_threadsafe(_put)
            except RuntimeError:
                logger.debug("[events] loop gone, drop %s", item.get("type"))

    # ------------------------------------------------------------------ 订阅（loop 线程）

    def subscribe(self, scope: str, bot: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=_QUEUE_MAX)
        with self._lock:
            self._subs.setdefault((scope, bot), _Subscription()).clients.add(q)
        return q

    def unsubscribe(self, scope: str, bot: str, q: asyncio.Queue) -> None:
        with self._lock:
            sub = self._subs.get((scope, bot))
            if sub is not None:
                sub.clients.discard(q)
                if not sub.clients:
                    self._subs.pop((scope, bot), None)

    # ------------------------------------------------------------------ 快照

    def snapshot(self, scope: str, bot: str) -> Dict[str, Any]:
        """订阅时取：当前轮已累积正文（补齐在飞轮）。"""
        with self._lock:
            return {"text_so_far": self._texts.get((scope, bot), "")}
