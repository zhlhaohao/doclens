"""OpenAI 兼容 Provider。"""
from __future__ import annotations

import json
from typing import Any, Iterator

from openai import OpenAI

from .tool_translator import (
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
        openai_messages = [{"role": "system", "content": system}] if system else []
        openai_messages.extend(messages_anthropic_to_openai(messages))
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
                # 直接使用模型生成的 call_xxx 作为 block id，避免 round-trip 映射
                # 断裂导致下一轮 chat/stream 无法回传 tool_result（参见 tool_translator 注释）。
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except (json.JSONDecodeError, TypeError):
                    args = {}
                content_blocks.append(
                    ToolUseBlock(id=tc.id, name=tc.function.name, input=args)
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
        openai_messages.extend(messages_anthropic_to_openai(messages))
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
        tool_started: set[int] = set()          # 已发 start 事件的 tool_call idx
        text_started = False

        yield StreamEvent(type="message_start")

        for chunk in self._client.chat.completions.create(**kwargs):
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            if getattr(delta, "content", None):
                if not text_started:
                    yield StreamEvent(
                        type="content_block_start",
                        block_index=0,
                        block_type="text",
                    )
                    text_started = True
                yield StreamEvent(
                    type="content_block_delta",
                    text_delta=delta.content,
                    block_index=0,
                )

            if getattr(delta, "tool_calls", None):
                for tc in delta.tool_calls:
                    idx = tc.index
                    # OpenAI 的 tool_call.index 用 0/1/2... 标识同一轮里的并行工具。
                    # Anthropic 风格：text 占用 block 0，tool_use 从 block 1 起递增。
                    # 用 idx+1 给每个并行工具独立 block，避免：
                    #   1) 多个工具 JSON 拼接成一坨非法 JSON → ToolCallState.get_complete_input
                    #      退回 {"raw": "..."} → handler 收到 raw=... 参数报错；
                    #   2) 后续 content_block_stop 只关 block 1，漏关其他并行工具。
                    block_index = idx + 1
                    if tc.id:
                        tool_call_ids[idx] = tc.id
                        tool_call_names[idx] = tc.function.name  # type: ignore[union-attr]
                        if idx not in tool_started:
                            yield StreamEvent(
                                type="content_block_start",
                                block_index=block_index,
                                block_type="tool_use",
                                tool_use_id=tc.id,
                                tool_name=tc.function.name,  # type: ignore[union-attr]
                            )
                            tool_started.add(idx)
                    if tc.function and tc.function.arguments:
                        json_deltas.setdefault(idx, []).append(tc.function.arguments)
                        yield StreamEvent(
                            type="content_block_delta",
                            input_json_delta=tc.function.arguments,
                            block_index=block_index,
                        )

            if choice.finish_reason:
                if text_started:
                    yield StreamEvent(type="content_block_stop", block_index=0)
                for idx in tool_started:
                    yield StreamEvent(type="content_block_stop", block_index=idx + 1)
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