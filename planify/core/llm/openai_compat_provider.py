"""OpenAI 兼容 Provider。"""
from __future__ import annotations

import json
from typing import Any, Iterator

from openai import OpenAI

from .tool_translator import (
    ToolCallMapper,
    messages_anthropic_to_openai,
    tools_anthropic_to_openai,
)
from .types import LLMResponse, StreamEvent, TextBlock, Tool, ToolUseBlock


class OpenAICompatProvider:
    """LLMProvider 的 OpenAI Chat Completions 实现。

    内部把 Anthropic 风格的 tools/messages 转成 OpenAI 风格，
    把响应转回 Anthropic 风格 ToolUseBlock / TextBlock。
    """

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
        self.model = model
        self.base_url = base_url
        self.api_key = api_key

    def chat(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> LLMResponse:
        # 每次调用创建新 mapper，避免跨请求 ID 状态泄漏
        mapper = ToolCallMapper()
        openai_messages = [{"role": "system", "content": system}] if system else []
        openai_messages.extend(messages_anthropic_to_openai(messages, mapper))
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": openai_messages,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = tools_anthropic_to_openai(tools)

        response = self._client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        message = choice.message
        content_blocks: list[TextBlock | ToolUseBlock] = []

        if message.content:
            content_blocks.append(TextBlock(text=message.content))

        if getattr(message, "tool_calls", None):
            for tc in message.tool_calls:
                internal_id = mapper.register(tc.id)
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except (json.JSONDecodeError, TypeError):
                    args = {}
                content_blocks.append(
                    ToolUseBlock(id=internal_id, name=tc.function.name, input=args)
                )

        # 映射 finish_reason
        stop_reason_map = {
            "stop": "end_turn",
            "tool_calls": "tool_use",
            "length": "max_tokens",
        }
        stop_reason = stop_reason_map.get(choice.finish_reason or "", "end_turn")

        return LLMResponse(
            content=content_blocks,
            stop_reason=stop_reason,
            model=response.model,
            usage={
                "input_tokens": getattr(response.usage, "prompt_tokens", 0) if response.usage else 0,
                "output_tokens": getattr(response.usage, "completion_tokens", 0) if response.usage else 0,
            },
        )

    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> Iterator[StreamEvent]:
        openai_messages = [{"role": "system", "content": system}] if system else []
        # stream 内部不持有跨调用状态
        mapper = ToolCallMapper()
        openai_messages.extend(messages_anthropic_to_openai(messages, mapper))
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": openai_messages,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if tools:
            kwargs["tools"] = tools_anthropic_to_openai(tools)

        # 累积 input_json_delta 用于 tool_call
        json_deltas: dict[int, list[str]] = {}  # tool_call index -> partial JSON fragments
        tool_call_ids: dict[int, str] = {}      # tool_call index -> openai id
        tool_call_names: dict[int, str] = {}    # tool_call index -> function name
        text_started = False
        tool_started = False

        yield StreamEvent(type="message_start")

        for chunk in self._client.chat.completions.create(**kwargs):
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            if getattr(delta, "content", None):
                if not text_started:
                    yield StreamEvent(type="content_block_start", block_index=0)
                    text_started = True
                yield StreamEvent(
                    type="content_block_delta",
                    text_delta=delta.content,
                    block_index=0,
                )

            if getattr(delta, "tool_calls", None):
                for tc in delta.tool_calls:
                    idx = tc.index
                    if tc.id:
                        tool_call_ids[idx] = tc.id
                        tool_call_names[idx] = tc.function.name  # type: ignore[union-attr]
                        if not tool_started:
                            yield StreamEvent(
                                type="content_block_start",
                                block_index=1,
                            )
                            tool_started = True
                    if tc.function and tc.function.arguments:
                        json_deltas.setdefault(idx, []).append(tc.function.arguments)
                        yield StreamEvent(
                            type="content_block_delta",
                            input_json_delta=tc.function.arguments,
                            block_index=1,
                        )

            if choice.finish_reason:
                if text_started:
                    yield StreamEvent(type="content_block_stop", block_index=0)
                if tool_started:
                    # 关闭 tool_use block（input_json_delta 已在前面 yield）
                    yield StreamEvent(type="content_block_stop", block_index=1)
                stop_reason_map = {
                    "stop": "end_turn",
                    "tool_calls": "tool_use",
                    "length": "max_tokens",
                }
                mapped = stop_reason_map.get(choice.finish_reason, "end_turn")
                yield StreamEvent(type="message_delta", stop_reason=mapped)

        yield StreamEvent(type="message_stop")

    def count_tokens(self, text: str) -> int:
        return len(text) // 4