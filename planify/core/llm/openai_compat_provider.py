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
from .types import (
    LLMResponse,
    StreamEvent,
    TextBlock,
    Tool,
    ToolUseBlock,
    normalize_thinking_depth,
)

if TYPE_CHECKING:
    from .trace import LLMTracer

_STOP_REASON_MAP = {
    "stop": "end_turn",
    "tool_calls": "tool_use",
    "length": "max_tokens",
}


def _cache_tokens_from_openai(u: Any) -> tuple[int, int]:
    """OpenAI 兼容端点的缓存字段 → (cache_read, cache_creation)。

    兼容四套字段名（各家网关的缓存口径不同），按优先级取：

    1. ``cache_read_input_tokens`` / ``cache_creation_input_tokens``：部分
       代理直接透传 Anthropic 风格字段。
    2. ``prompt_tokens_details.cached_tokens``：**MiniMax / 阿里云 / OpenAI
       官方**口径。MiniMax 文档明确：OpenAI 兼容端点用
       ``usage.prompt_tokens_details.cached_tokens`` 表示缓存命中 token 数，
       且 ``usage.prompt_tokens`` 是**总**输入 token 数。
    3. ``prompt_cache_hit_tokens``：DeepSeek 系（``prompt_tokens`` 同样是
       「命中 + 未命中」总数）。

    **cache_creation 恒为 0**：OpenAI 兼容端点只有「读缓存」概念，没有
    Anthropic 那种显式「写缓存」计数——未命中的 token 是本次新算的输入
    （计入 ``input_tokens``），把它再计成 cache_creation 会与 input 重复
    计数，破坏「总输入 = input + cache_read + cache_creation」的不变式。
    """
    explicit_read = getattr(u, "cache_read_input_tokens", 0) or 0
    explicit_creation = getattr(u, "cache_creation_input_tokens", 0) or 0
    if explicit_read or explicit_creation:
        return int(explicit_read), int(explicit_creation)

    details = getattr(u, "prompt_tokens_details", None)
    cached = getattr(details, "cached_tokens", None) if details is not None else None
    if cached:
        return int(cached), 0

    hit = getattr(u, "prompt_cache_hit_tokens", 0) or 0
    if hit:
        return int(hit), 0

    return 0, 0


def _usage_from_openai(u: Any) -> dict[str, int] | None:
    """OpenAI usage 对象 → 归一化四字段（None 输入返回 None）。

    归一化到 **Anthropic 契约**（与 AnthropicProvider._usage_from 同一语义）：

    - ``input_tokens`` = **未命中缓存的新增**输入 token 数
    - ``cache_read_input_tokens`` = 命中缓存的输入 token 数
    - ``cache_creation_input_tokens`` = 写入缓存的输入 token 数

    关键：OpenAI 兼容端的 ``prompt_tokens`` 是**总**输入（命中 + 未命中），
    与 Anthropic 的 ``input_tokens``（仅新增）语义不同。直接照搬会让
    上层「总输入 = input + cache_read + cache_creation」的口径把命中部分
    重复计一次——命中率被稀释、上下文占用虚高。故此处先减后归一，
    保持不变式 ``input + cache_read + cache_creation == prompt_tokens``。

    无缓存概念的端点（缓存字段皆缺）：``prompt_tokens`` 全是新增 token，
    减 0，语义与 Anthropic 一致。
    """
    if u is None:
        return None
    cache_read, cache_creation = _cache_tokens_from_openai(u)
    prompt_total = getattr(u, "prompt_tokens", 0) or 0
    # prompt_total 是「命中 + 未命中」总数 → 新增 = 总数 - 命中
    new_input = max(0, int(prompt_total) - cache_read)
    return {
        "input_tokens": new_input,
        "output_tokens": getattr(u, "completion_tokens", 0) or 0,
        "cache_read_input_tokens": cache_read,
        "cache_creation_input_tokens": cache_creation,
    }


class StreamTranslator:
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

        # 思考流被动接收（2026-10-05）：DeepSeek/glm 系网关把内部推理放在
        # delta.reasoning_content（OpenAI SDK 未建模为属性，getattr 动态取）；
        # 部分网关用 delta.reasoning。只透传不请求——服务端不发就无事发生。
        reasoning = getattr(delta, "reasoning_content", None) or getattr(
            delta, "reasoning", None
        )
        if reasoning:
            events.append(StreamEvent(
                type="content_block_delta",
                thinking_delta=reasoning,
                block_index=-1,
            ))

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


# 兼容别名（AP-22 公共化）
_StreamTranslator = StreamTranslator


class _StreamTraceAccumulator:
    """流式 chunk → 原生风格响应（供 LLM trace 落盘）。

    与 StreamTranslator（归一化事件）并行消费同一批 chunk：translator
    服务运行时事件流，本器只在 tracer 开启时还原原生 ChatCompletion 形态
    （content 拼接 / tool_calls 按 index 聚合 / 尾 chunk usage）。
    reasoning_content 同步累积（原生侧本就有该字段，思考可见利于排障）。
    """

    def __init__(self) -> None:
        self._id = ""
        self._model = ""
        self._content_parts: list[str] = []
        self._reasoning_parts: list[str] = []
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
        reasoning = getattr(delta, "reasoning_content", None) or getattr(
            delta, "reasoning", None
        )
        if reasoning:
            self._reasoning_parts.append(reasoning)
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
        if self._reasoning_parts:
            message["reasoning_content"] = "".join(self._reasoning_parts)
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
        thinking_depth: str = "auto",
    ) -> None:
        kwargs: dict[str, Any] = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self._client = OpenAI(**kwargs)
        self._aclient: AsyncOpenAI | None = None
        self.model = model
        self.base_url = base_url
        self.api_key = api_key
        self.thinking_depth = normalize_thinking_depth(thinking_depth)

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
        thinking_depth: Optional[str] = None,
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
        # 思考深度（auto = 不发参，保持现状；off → "none" best-effort——
        # 部分端点不支持该值会 400，显式报错可见，逃生档 = auto）。
        # thinking_depth 参数 = 每调用级覆盖（None = 用构造档位）。
        depth = normalize_thinking_depth(
            self.thinking_depth if thinking_depth is None else thinking_depth
        )
        if depth != "auto":
            kwargs["reasoning_effort"] = (
                "none" if depth == "off" else depth
            )
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
        thinking_depth: Optional[str] = None,
    ) -> LLMResponse:
        kwargs = self._request_kwargs(messages, system, tools, max_tokens, server_tools=server_tools, thinking_depth=thinking_depth)
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
        thinking_depth: Optional[str] = None,
    ) -> Iterator[StreamEvent]:
        kwargs = self._request_kwargs(messages, system, tools, max_tokens, stream=True, server_tools=server_tools, thinking_depth=thinking_depth)
        turn = tracer.trace_request(kwargs) if tracer else None
        accumulator = _StreamTraceAccumulator() if tracer else None
        translator = StreamTranslator()
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
        thinking_depth: Optional[str] = None,
    ) -> LLMResponse:
        kwargs = self._request_kwargs(messages, system, tools, max_tokens, server_tools=server_tools, thinking_depth=thinking_depth)
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
        thinking_depth: Optional[str] = None,
    ) -> AsyncIterator[StreamEvent]:
        kwargs = self._request_kwargs(messages, system, tools, max_tokens, stream=True, server_tools=server_tools, thinking_depth=thinking_depth)
        turn = tracer.trace_request(kwargs) if tracer else None
        accumulator = _StreamTraceAccumulator() if tracer else None
        translator = StreamTranslator()
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

        # 非流式路径与流式路径共用同一套归一化（含缓存字段）——
        # 否则 chat/achat 的 usage 与 astream 的 usage 口径分叉。
        usage = _usage_from_openai(response.usage) or {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_read_input_tokens": 0,
            "cache_creation_input_tokens": 0,
        }

        return LLMResponse(
            content=content_blocks,
            stop_reason=stop_reason,
            model=response.model,
            usage=usage,
        )
