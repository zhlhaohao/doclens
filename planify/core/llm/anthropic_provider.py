"""Anthropic 原生 Provider。

包装 anthropic SDK，事件/响应直通归一化。
"""
from __future__ import annotations

import json
from typing import Any, Iterator

import httpx
from anthropic import Anthropic

from .types import LLMResponse, StreamEvent, TextBlock, Tool, ToolResultBlock, ToolUseBlock


class AnthropicProvider:
    """LLMProvider 的 Anthropic 实现。"""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str | None,
        model: str,
    ) -> None:
        # 禁用 SSL 验证以适配自签名证书环境（与旧 init_anthropic_client 一致）
        http_client = httpx.Client(verify=False)
        kwargs: dict[str, Any] = {"api_key": api_key, "http_client": http_client}
        if base_url:
            kwargs["base_url"] = base_url
        self._client = Anthropic(**kwargs)
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
        """单次非流式调用。"""
        response = self._client.messages.create(
            model=self.model,
            system=system,
            messages=messages,
            tools=[self._tool_to_anthropic(t) for t in tools],
            max_tokens=max_tokens,
        )
        content = [self._block_from_anthropic(b) for b in response.content]
        return LLMResponse(
            content=content,
            stop_reason=response.stop_reason or "end_turn",
            model=response.model,
            usage={
                "input_tokens": getattr(response.usage, "input_tokens", 0),
                "output_tokens": getattr(response.usage, "output_tokens", 0),
            },
        )

    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> Iterator[StreamEvent]:
        """流式调用。Anthropic 事件格式与归一化事件语义接近，直接转换。"""
        with self._client.messages.stream(
            model=self.model,
            system=system,
            messages=messages,
            tools=[self._tool_to_anthropic(t) for t in tools],
            max_tokens=max_tokens,
        ) as stream:
            for event in stream:
                normalized = self._event_from_anthropic(event)
                if normalized is not None:
                    yield normalized

    def count_tokens(self, text: str) -> int:
        """粗估 token 数（每 4 字符 1 token）。"""
        return len(text) // 4

    # ---------- 转换工具 ----------

    @staticmethod
    def _tool_to_anthropic(tool: Tool) -> dict:
        return {
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.input_schema,
        }

    @staticmethod
    def _block_from_anthropic(block: Any) -> TextBlock | ToolUseBlock | ToolResultBlock:
        btype = getattr(block, "type", None)
        if btype == "text":
            return TextBlock(text=getattr(block, "text", ""))
        if btype == "tool_use":
            return ToolUseBlock(
                id=getattr(block, "id", ""),
                name=getattr(block, "name", ""),
                input=dict(getattr(block, "input", {}) or {}),
            )
        if btype == "tool_result":
            return ToolResultBlock(
                tool_use_id=getattr(block, "tool_use_id", ""),
                content=str(getattr(block, "content", "")),
                is_error=bool(getattr(block, "is_error", False)),
            )
        # 未知类型降级为文本
        return TextBlock(text=str(block))

    @staticmethod
    def _event_from_anthropic(event: Any) -> StreamEvent | None:
        etype = getattr(event, "type", None)
        if etype == "message_start":
            return StreamEvent(type="message_start")
        if etype == "content_block_start":
            return StreamEvent(
                type="content_block_start",
                block_index=getattr(event, "index", None),
            )
        if etype == "content_block_delta":
            delta = getattr(event, "delta", None)
            dtype = getattr(delta, "type", None) if delta else None
            if dtype == "text_delta":
                return StreamEvent(
                    type="content_block_delta",
                    text_delta=getattr(delta, "text", ""),
                    block_index=getattr(event, "index", None),
                )
            if dtype == "input_json_delta":
                return StreamEvent(
                    type="content_block_delta",
                    input_json_delta=getattr(delta, "partial_json", ""),
                    block_index=getattr(event, "index", None),
                )
            return None
        if etype == "content_block_stop":
            return StreamEvent(
                type="content_block_stop",
                block_index=getattr(event, "index", None),
            )
        if etype == "message_delta":
            delta = getattr(event, "delta", None)
            stop_reason = getattr(delta, "stop_reason", None) if delta else None
            return StreamEvent(type="message_delta", stop_reason=stop_reason)
        if etype == "message_stop":
            return StreamEvent(type="message_stop")
        return None
