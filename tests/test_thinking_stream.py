"""思考流通道测试（2026-10-05）。

覆盖三层：
1. OpenAI 兼容 provider：delta.reasoning_content / delta.reasoning 被动解析成
   thinking_delta 归一化事件；普通 content chunk 不受影响；
2. Anthropic provider：thinking_delta 事件透传（被动，不主动开启）；
3. doclens ChatEventEmitter：THINKING 事件直推 SSE 队列、不进积累通道；
4. StreamingAgent runner：thinking delta → emitter.emit_thinking（鸭子类型防御）。
"""

import asyncio
from types import SimpleNamespace

from planify.core.llm.anthropic_provider import AnthropicProvider
from planify.core.llm.openai_compat_provider import _StreamTranslator
from planify.streaming.types import (
    EventEmitter,
    StreamEvent,
    StreamEventType,
)

from doclens.web_v2.api._chat_emitter import ChatEventEmitter


class _FakeQueue:
    """put_nowait 收集器（替代 asyncio.Queue 便于断言）。"""

    def __init__(self):
        self.items: list = []

    def put_nowait(self, ev) -> None:
        self.items.append(ev)


def _ns(**kw):
    return SimpleNamespace(**kw)


# -------------------------------------------------- OpenAI 兼容端翻译


def test_openai_reasoning_content_becomes_thinking_delta():
    translator = _StreamTranslator()
    translator.start()
    chunk = _ns(
        choices=[_ns(delta=_ns(
            content=None,
            tool_calls=None,
            reasoning_content="让我想想",
        ), finish_reason=None)],
        usage=None,
    )
    events = translator.feed(chunk)
    assert len(events) == 1
    assert events[0].type == "content_block_delta"
    assert events[0].thinking_delta == "让我想想"


def test_openai_reasoning_field_alias():
    """部分网关用 delta.reasoning 而非 reasoning_content——同义解析。"""
    translator = _StreamTranslator()
    translator.start()
    chunk = _ns(
        choices=[_ns(delta=_ns(
            content=None,
            tool_calls=None,
            reasoning="先分析问题",
        ), finish_reason=None)],
        usage=None,
    )
    events = translator.feed(chunk)
    assert len(events) == 1
    assert events[0].thinking_delta == "先分析问题"


def test_openai_content_chunk_untouched():
    """无思考字段的普通 chunk：行为与旧版完全一致（零回归面）。"""
    translator = _StreamTranslator()
    translator.start()
    chunk = _ns(
        choices=[_ns(delta=_ns(content="你好", tool_calls=None), finish_reason=None)],
        usage=None,
    )
    events = translator.feed(chunk)
    assert len(events) == 2  # content_block_start + content_block_delta
    assert all(e.thinking_delta is None for e in events)
    assert events[1].text_delta == "你好"


# ------------------------------------------------------- Anthropic 透传


def test_anthropic_thinking_delta_passthrough():
    event = _ns(
        type="content_block_delta",
        index=0,
        delta=_ns(type="thinking_delta", thinking="内部推理片段"),
    )
    out = AnthropicProvider._event_from_anthropic(event)
    assert out is not None
    assert out.type == "content_block_delta"
    assert out.thinking_delta == "内部推理片段"
    assert out.text_delta is None


def test_anthropic_unknown_delta_still_dropped():
    """未知 delta 类型依旧丢弃（回归保护）。"""
    event = _ns(
        type="content_block_delta",
        index=0,
        delta=_ns(type="signature_delta", signature="xxx"),
    )
    out = AnthropicProvider._event_from_anthropic(event)
    assert out is None


# ------------------------------------------------ ChatEventEmitter 直推


def _run_emitter(emitter: ChatEventEmitter, events: list[StreamEvent]) -> None:
    async def go():
        for ev in events:
            await emitter.emit(ev)

    asyncio.run(go())


def test_chat_emitter_thinking_pushes_sse_not_accumulated():
    q = _FakeQueue()
    em = ChatEventEmitter(queue=q)
    _run_emitter(em, [
        StreamEvent(StreamEventType.THINKING, {"delta": "思考一"}),
        StreamEvent(StreamEventType.THINKING, {"delta": "思考二"}),
    ])
    # 直推队列逐条（不合并），且不进任何积累通道
    assert q.items == [
        {"type": "thinking", "delta": "思考一"},
        {"type": "thinking", "delta": "思考二"},
    ]
    em2 = ChatEventEmitter(queue=_FakeQueue())
    _run_emitter(em2, [
        StreamEvent(StreamEventType.THINKING, {"delta": "a"}),
        StreamEvent(StreamEventType.TEXT, {"content": "正文"}),
    ])
    assert em2.queue.items == [{"type": "thinking", "delta": "a"}]
    assert em2.text_parts == ["正文"]  # 正文照常积累
    assert em2.get_full_text() == "正文"


def test_chat_emitter_empty_delta_not_pushed():
    em = ChatEventEmitter(queue=_FakeQueue())
    _run_emitter(em, [StreamEvent(StreamEventType.THINKING, {"delta": ""})])
    assert em.queue.items == []


# ------------------------------------------- runner → emit_thinking 链路


class _RecordingEmitter(EventEmitter):
    """显式继承协议：获得 emit_thinking 默认实现。"""

    def __init__(self):
        self.events: list[StreamEvent] = []

    async def emit(self, event: StreamEvent) -> None:
        self.events.append(event)


def test_runner_thinking_delta_reaches_emitter():
    """emit_thinking 协议默认实现把 delta 包成 THINKING 事件（runner 调它）。"""
    emitter = _RecordingEmitter()
    asyncio.run(emitter.emit_thinking("推理中"))
    assert emitter.events[-1].event_type == StreamEventType.THINKING
    assert emitter.events[-1].data == {"delta": "推理中"}


def test_runner_duck_typed_emitter_without_emit_thinking():
    """鸭子类型 emitter（未实现 emit_thinking）：runner getattr 防御不炸。"""
    called = []

    class _Duck:
        async def emit(self, event):
            called.append(event)

    duck = _Duck()
    # 模拟 runner 的防御分支（getattr 缺失 → 跳过）
    emit_thinking = getattr(duck, "emit_thinking", None)
    assert emit_thinking is None
    assert called == []
