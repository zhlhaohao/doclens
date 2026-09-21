"""OpenAI 兼容 Provider。

内部把 Anthropic 风格的 tools/messages 转成 OpenAI 风格，
把响应转回 Anthropic 风格 ToolUseBlock / TextBlock。
同步 chat/stream 与异步 achat/astream 共享翻译逻辑（_StreamTranslator /
_response_to_llm）；async 客户端惰性初始化（同步-only 调用方零开销）。
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any, AsyncIterator, Iterator, Optional

from openai import AsyncOpenAI, OpenAI

from .tool_translator import (
    messages_anthropic_to_openai,
    tools_anthropic_to_openai,
)
from .types import LLMResponse, StreamEvent, TextBlock, Tool, ToolUseBlock

if TYPE_CHECKING:
    from .trace import LLMTracer

_STOP_REASON_MAP = {
    "stop": "end_turn",
    "tool_calls": "tool_use",
    "length": "max_tokens",
}


def _usage_from_openai(u: Any) -> dict[str, int] | None:
    """OpenAI usage 对象 → 归一化四字段（None 输入返回 None）。

    DeepSeek 系缓存字段 prompt_cache_hit_tokens / prompt_cache_miss_tokens
    归一到 cache_read / cache_creation；无缓存概念的端点两字段为 0。
    """
    if u is None:
        return None
    return {
        "input_tokens": getattr(u, "prompt_tokens", 0) or 0,
        "output_tokens": getattr(u, "completion_tokens", 0) or 0,
        "cache_read_input_tokens": getattr(u, "prompt_cache_hit_tokens", 0) or 0,
        "cache_creation_input_tokens": getattr(u, "prompt_cache_miss_tokens", 0) or 0,
    }


class _StreamTranslator:
    """OpenAI stream chunk → 归一化 StreamEvent 的状态机（同步/异步壳共用）。

    OpenAI 的 tool_call.index 用 0/1/2... 标识同一轮里的并行工具；
    Anthropic 风格：text 占用 block 0，tool_use 从 block 1 起递增。
    用 idx+1 给每个并行工具独立 block，避免：
      1) 多个工具 JSON 拼接成一坨非法 JSON → ToolCallState.get_complete_input
         退回 {"raw": "..."} → handler 收到 raw=... 参数报错；
      2) 后续 content_block_stop 只关 block 1，漏关其他并行工具。
    """

    def __init__(self) -> None:
        self._tool_started: set[int] = set()  # 已发 start 事件的 tool_call idx
        self._text_started = False

    def start(self) -> StreamEvent:
        return StreamEvent(type="message_start")

    def feed(self, chunk: Any) -> list[StreamEvent]:
        """处理一个 chunk，返回该 chunk 产生的归一化事件。"""
        events: list[StreamEvent] = []
        usage = _usage_from_openai(getattr(chunk, "usage", None))
        if not chunk.choices:
            # stream_options.include_usage 的尾 chunk：choices 为空、只带 usage
            # （此前直接丢弃，命中率无法观测）
            if usage:
                events.append(StreamEvent(type="message_delta", usage=usage))
            return events
        choice = chunk.choices[0]
        delta = choice.delta

        if getattr(delta, "content", None):
            if not self._text_started:
                events.append(StreamEvent(
                    type="content_block_start",
                    block_index=0,
                    block_type="text",
                ))
                self._text_started = True
            events.append(StreamEvent(
                type="content_block_delta",
                text_delta=delta.content,
                block_index=0,
            ))

        if getattr(delta, "tool_calls", None):
            for tc in delta.tool_calls:
                idx = tc.index
                block_index = idx + 1
                if tc.id and idx not in self._tool_started:
                    events.append(StreamEvent(
                        type="content_block_start",
                        block_index=block_index,
                        block_type="tool_use",
                        tool_use_id=tc.id,
                        tool_name=tc.function.name,  # type: ignore[union-attr]
                    ))
                    self._tool_started.add(idx)
                if tc.function and tc.function.arguments:
                    events.append(StreamEvent(
                        type="content_block_delta",
                        input_json_delta=tc.function.arguments,
                        block_index=block_index,
                    ))

        if choice.finish_reason:
            if self._text_started:
                events.append(StreamEvent(type="content_block_stop", block_index=0))
            for idx in self._tool_started:
                events.append(StreamEvent(type="content_block_stop", block_index=idx + 1))
            events.append(StreamEvent(
                type="message_delta",
                stop_reason=_STOP_REASON_MAP.get(choice.finish_reason, "end_turn"),
                usage=usage,
            ))
        return events

    def finish(self) -> StreamEvent:
        return StreamEvent(type="message_stop")


class _StreamTraceAccumulator:
    """流式 chunk → 原生风格响应（供 LLM trace 落盘）。

    与 _StreamTranslator（归一化事件）并行消费同一批 chunk：translator
    服务运行时事件流，本器只在 tracer 开启时还原原生 ChatCompletion 形态
    （content 拼接 / tool_calls 按 index 聚合 / 尾 chunk usage）。
    """

    def __init__(self) -> None:
        self._id = ""
        self._model = ""
        self._content_parts: list[str] = []
        self._tool_calls: dict[int, dict] = {}  # index → {id, name, arguments}
        self._finish_reason: Any = None
        self._usage: Any = None

    def feed(self, chunk: Any) -> None:
        if getattr(chunk, "id", None):
            self._id = chunk.id
        if getattr(chunk, "model", None):
            self._model = chunk.model
        if getattr(chunk, "usage", None) is not None:
            self._usage = chunk.usage
        if not chunk.choices:
            return  # include_usage 尾 chunk
        choice = chunk.choices[0]
        delta = choice.delta
        if getattr(delta, "content", None):
            self._content_parts.append(delta.content)
        for tc in getattr(delta, "tool_calls", None) or []:
            slot = self._tool_calls.setdefault(
                tc.index, {"id": "", "name": "", "arguments": ""}
            )
            if tc.id:
                slot["id"] = tc.id
            if tc.function is not None:
                if tc.function.name:
                    slot["name"] = tc.function.name
                if tc.function.arguments:
                    slot["arguments"] += tc.function.arguments
        if choice.finish_reason:
            self._finish_reason = choice.finish_reason

    def dump(self) -> dict:
        """聚合为原生 ChatCompletion 风格 dict（usage 留原对象交 tracer 序列化）。"""
        message: dict[str, Any] = {
            "role": "assistant",
            "content": "".join(self._content_parts) or None,
        }
        if self._tool_calls:
            message["tool_calls"] = [
                {
                    "index": i,
                    "id": slot["id"],
                    "type": "function",
                    "function": {
                        "name": slot["name"],
                        "arguments": slot["arguments"],
                    },
                }
                for i, slot in sorted(self._tool_calls.items())
            ]
        return {
            "id": self._id,
            "model": self._model,
            "choices": [
                {
                    "index": 0,
                    "finish_reason": self._finish_reason,
                    "message": message,
                }
            ],
            "usage": self._usage,
            "stream_aggregated": True,
        }


class OpenAICompatProvider:
    """LLMProvider 的 OpenAI Chat Completions 实现。"""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str | None,
        model: str,
    ) -> None:
        kwargs: dict[str, Any] = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self._client = OpenAI(**kwargs)
        self._aclient: AsyncOpenAI | None = None
        self.model = model
        self.base_url = base_url
        self.api_key = api_key

    def _ensure_async_client(self) -> AsyncOpenAI:
        """惰性创建 async 客户端（参数与同步版一致，连接池独立）。"""
        if self._aclient is None:
            kwargs: dict[str, Any] = {"api_key": self.api_key}
            if self.base_url:
                kwargs["base_url"] = self.base_url
            self._aclient = AsyncOpenAI(**kwargs)
        return self._aclient

    def _request_kwargs(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int,
        stream: bool = False,
        server_tools: Optional[list] = None,
    ) -> dict[str, Any]:
        """chat/stream/achat/astream 共用的请求参数（含 Anthropic→OpenAI 翻译）。

        server_tools（Anthropic 服务端工具，如 web_search_20250305）在
        OpenAI 兼容格式无对应物——显式抛错让调用方（web_search 等）回落
        自有通路，而非静默丢工具产生错误结果。
        """
        if server_tools:
            raise ValueError(
                "server_tools not supported on OpenAI-compatible endpoints"
            )
        openai_messages = [{"role": "system", "content": system}] if system else []
        openai_messages.extend(messages_anthropic_to_openai(messages))
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": openai_messages,
            "max_tokens": max_tokens,
        }
        if stream:
            kwargs["stream"] = True
            # 尾 chunk 带 usage（prompt/completion tokens；DeepSeek 系含缓存命中
            # 字段），供 runner 观测前缀缓存命中率
            kwargs["stream_options"] = {"include_usage": True}
        if tools:
            kwargs["tools"] = tools_anthropic_to_openai(tools)
        return kwargs

    def chat(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
        tracer: Optional["LLMTracer"] = None,
        server_tools: Optional[list] = None,
    ) -> LLMResponse:
        kwargs = self._request_kwargs(messages, system, tools, max_tokens, server_tools=server_tools)
        turn = tracer.trace_request(kwargs) if tracer else None
        try:
            response = self._client.chat.completions.create(**kwargs)
        except Exception as e:
            if tracer:
                tracer.trace_error(turn, e)
            raise
        if tracer:
            tracer.trace_response(turn, response)
        return self._response_to_llm(response)

    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
        tracer: Optional["LLMTracer"] = None,
        server_tools: Optional[list] = None,
    ) -> Iterator[StreamEvent]:
        kwargs = self._request_kwargs(messages, system, tools, max_tokens, stream=True, server_tools=server_tools)
        turn = tracer.trace_request(kwargs) if tracer else None
        accumulator = _StreamTraceAccumulator() if tracer else None
        translator = _StreamTranslator()
        yield translator.start()
        done = False
        try:
            for chunk in self._client.chat.completions.create(**kwargs):
                if accumulator:
                    accumulator.feed(chunk)
                for event in translator.feed(chunk):
                    yield event
        except BaseException as e:  # 含 GeneratorExit（调用方中断生成器）
            if tracer and not done:
                tracer.trace_error(turn, e)
            raise
        # 调用方（runner）在 message_stop（finish）即中断消费——答节必须在
        # yield 它之前落盘；done 先置位，break 触发的 GeneratorExit 不算异常
        if tracer and accumulator:
            tracer.trace_response(turn, accumulator.dump())
        done = True
        yield translator.finish()

    async def achat(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
        tracer: Optional["LLMTracer"] = None,
        server_tools: Optional[list] = None,
    ) -> LLMResponse:
        kwargs = self._request_kwargs(messages, system, tools, max_tokens, server_tools=server_tools)
        turn = tracer.trace_request(kwargs) if tracer else None
        try:
            response = await self._ensure_async_client().chat.completions.create(**kwargs)
        except Exception as e:
            if tracer:
                tracer.trace_error(turn, e)
            raise
        if tracer:
            tracer.trace_response(turn, response)
        return self._response_to_llm(response)

    async def astream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
        tracer: Optional["LLMTracer"] = None,
        server_tools: Optional[list] = None,
    ) -> AsyncIterator[StreamEvent]:
        kwargs = self._request_kwargs(messages, system, tools, max_tokens, stream=True, server_tools=server_tools)
        turn = tracer.trace_request(kwargs) if tracer else None
        accumulator = _StreamTraceAccumulator() if tracer else None
        translator = _StreamTranslator()
        yield translator.start()
        done = False
        try:
            stream = await self._ensure_async_client().chat.completions.create(**kwargs)
            async for chunk in stream:
                if accumulator:
                    accumulator.feed(chunk)
                for event in translator.feed(chunk):
                    yield event
        except BaseException as e:  # 含 GeneratorExit（aclose 中断生成器）
            if tracer and not done:
                tracer.trace_error(turn, e)
            raise
        # 调用方（runner）在 message_stop（finish）即中断消费——答节必须在
        # yield 它之前落盘；done 先置位，break 触发的 GeneratorExit 不算异常
        if tracer and accumulator:
            tracer.trace_response(turn, accumulator.dump())
        done = True
        yield translator.finish()

    def count_tokens(self, text: str) -> int:
        return len(text) // 4

    @staticmethod
    def _response_to_llm(response: Any) -> LLMResponse:
        """SDK 响应 → 归一化 LLMResponse（chat/achat 共用）。"""
        choice = response.choices[0]
        message = choice.message
        content_blocks: list[TextBlock | ToolUseBlock] = []

        if message.content:
            content_blocks.append(TextBlock(text=message.content))

        if getattr(message, "tool_calls", None):
            for tc in message.tool_calls:
                # 直接使用模型生成的 call_xxx 作为 block id，避免 round-trip 映射
                # 断裂导致下一轮 chat/stream 无法回传 tool_result（参见 tool_translator 注释）。
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except (json.JSONDecodeError, TypeError):
                    args = {}
                content_blocks.append(
                    ToolUseBlock(id=tc.id, name=tc.function.name, input=args)
                )

        stop_reason = _STOP_REASON_MAP.get(choice.finish_reason or "", "end_turn")

        return LLMResponse(
            content=content_blocks,
            stop_reason=stop_reason,
            model=response.model,
            usage={
                "input_tokens": getattr(response.usage, "prompt_tokens", 0) if response.usage else 0,
                "output_tokens": getattr(response.usage, "completion_tokens", 0) if response.usage else 0,
            },
        )
