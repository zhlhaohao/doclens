"""usage 事件链路（2026-09-17 会话信息弹窗）：

- planify EventEmitter.emit_usage 默认实现 → StreamEvent(USAGE)
- ChatEventEmitter 收集最新 usage（含宿主注入的 context_window）并直推队列
"""
import asyncio

from planify.streaming.types import EventEmitter, StreamEvent, StreamEventType

from doclens.web_v2.api._chat_emitter import ChatEventEmitter
from doclens.web_v2.api._chat_events import KNOWN_EVENT_TYPES, usage_event


class _CaptureEmitter(EventEmitter):
    """只实现 emit() 的最小 emitter：验证协议便捷方法默认实现。"""

    def __init__(self):
        self.events: list[StreamEvent] = []

    async def emit(self, event: StreamEvent) -> None:
        self.events.append(event)


def test_emit_usage_default_impl_wraps_stream_event():
    cap = _CaptureEmitter()
    usage = {"input_tokens": 100, "output_tokens": 10,
             "cache_creation_input_tokens": 5, "cache_read_input_tokens": 20}
    asyncio.run(cap.emit_usage(usage))
    assert len(cap.events) == 1
    ev = cap.events[0]
    assert ev.event_type == StreamEventType.USAGE
    assert ev.data == usage
    # to_sse_dict 线格式：type 在外，字段平铺
    assert ev.to_sse_dict() == {"type": "usage", **usage}


def test_usage_event_known_type_and_shape():
    assert "usage" in KNOWN_EVENT_TYPES
    ev = usage_event({"input_tokens": 7}, context_window=200000)
    assert ev["type"] == "usage"
    assert ev["input_tokens"] == 7
    assert ev["context_window"] == 200000
    # 缺省字段补 0
    assert ev["cache_read_input_tokens"] == 0


def test_chat_emitter_collects_latest_usage_and_pushes():
    q: asyncio.Queue = asyncio.Queue()
    em = ChatEventEmitter(q, context_window=200000)
    first = {"input_tokens": 100, "output_tokens": 10,
             "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0}
    second = {"input_tokens": 300, "output_tokens": 20,
              "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0}

    async def go():
        await em.emit_usage(first)
        await em.emit_usage(second)

    asyncio.run(go())
    # self.usage 为最后一次调用（该轮峰值占用）
    assert em.usage is not None
    assert em.usage["input_tokens"] == 300
    assert em.usage["context_window"] == 200000
    # 队列两次入队，线格式与 usage_event 同构
    ev1 = q.get_nowait()
    ev2 = q.get_nowait()
    assert ev1["type"] == "usage" and ev1["input_tokens"] == 100
    assert ev2["type"] == "usage" and ev2["input_tokens"] == 300
