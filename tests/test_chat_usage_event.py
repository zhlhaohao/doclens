"""usage 事件链路（2026-09-17 会话信息弹窗）：

- planify EventEmitter.emit_usage 默认实现 → StreamEvent(USAGE)
- ChatEventEmitter 逐条收集全量 usage（含宿主注入的 context_window）并直推队列
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


def test_chat_emitter_collects_all_usages_and_pushes():
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
    # 逐条全量收集（工具循环的中间调用也进累计，弹窗与 trace 同口径）；
    # 末条即该轮峰值占用
    assert len(em.usages) == 2
    assert em.usages[0]["input_tokens"] == 100
    assert em.usages[-1]["input_tokens"] == 300
    assert em.usages[-1]["context_window"] == 200000
    # 队列两次入队，线格式与 usage_event 同构
    ev1 = q.get_nowait()
    ev2 = q.get_nowait()
    assert ev1["type"] == "usage" and ev1["input_tokens"] == 100
    assert ev2["type"] == "usage" and ev2["input_tokens"] == 300


def test_emit_notice_default_impl_wraps_stream_event():
    """协议默认实现：emit_notice 包 StreamEvent(NOTICE)，detail/level 平铺。"""
    cap = _CaptureEmitter()
    asyncio.run(cap.emit_notice("上下文已达约 160K tokens，已自动压缩会话历史"))
    assert len(cap.events) == 1
    ev = cap.events[0]
    assert ev.event_type == StreamEventType.NOTICE
    assert ev.data["detail"].startswith("上下文已达约")
    assert ev.data["level"] == "info"


def test_chat_emitter_notice_becomes_toast_and_not_persisted():
    """NOTICE → toast 直推队列（前端 toast 通道零改动复用）；
    不进任何积累通道（text/tool_calls/usages 均不受影响）。"""
    q: asyncio.Queue = asyncio.Queue()
    em = ChatEventEmitter(q, context_window=200000)

    async def go():
        await em.emit_notice("已自动压缩会话历史")

    asyncio.run(go())
    ev = q.get_nowait()
    assert ev == {"type": "toast", "level": "info", "detail": "已自动压缩会话历史"}
    # 纯通知：不污染任何积累状态
    assert em.text_parts == []
    assert em.tool_calls == []
    assert em.usages == []
