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
        """单次非流式调用。

        大 max_tokens 兜底：anthropic SDK 对预估耗时 >10 分钟的非流式请求
        在客户端直接抛 ValueError("Streaming is required ...")，请求根本
        没发出去。此时降级为流式聚合，对外仍表现为一次性返回。
        """
        tools_payload = self._tools_with_cache_breakpoint(tools)
        kwargs: dict[str, Any] = {
            "model": self.model,
            "system": self._system_blocks(system),
            "messages": self._mark_cache_tail(messages),
            "tools": tools_payload,
            "max_tokens": max_tokens,
        }
        try:
            response = self._client.messages.create(**kwargs)
        except ValueError as e:
            if "Streaming is required" not in str(e):
                raise
            with self._client.messages.stream(**kwargs) as stream:
                response = stream.get_final_message()
        content = [
            b
            for b in (self._block_from_anthropic(x) for x in response.content)
            if b is not None
        ]
        return LLMResponse(
            content=content,
            stop_reason=response.stop_reason or "end_turn",
            model=response.model,
            usage={
                "input_tokens": getattr(response.usage, "input_tokens", 0),
                "output_tokens": getattr(response.usage, "output_tokens", 0),
                "cache_creation_input_tokens": getattr(
                    response.usage, "cache_creation_input_tokens", 0
                ),
                "cache_read_input_tokens": getattr(
                    response.usage, "cache_read_input_tokens", 0
                ),
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
            system=self._system_blocks(system),
            messages=self._mark_cache_tail(messages),
            tools=self._tools_with_cache_breakpoint(tools),
            max_tokens=max_tokens,
        ) as stream:
            for event in stream:
                normalized = self._event_from_anthropic(event)
                if normalized is not None:
                    yield normalized

    def count_tokens(self, text: str) -> int:
        """粗估 token 数（每 4 字符 1 token）。"""
        return len(text) // 4

    # ---------- prompt caching ----------

    _EPHEMERAL = {"type": "ephemeral"}

    @classmethod
    def _system_blocks(cls, system: str) -> list[dict]:
        """system 转 block 形式并打 ephemeral 断点（显式启用 prompt caching）。"""
        if not system:
            return []
        return [{"type": "text", "text": system, "cache_control": dict(cls._EPHEMERAL)}]

    @classmethod
    def _tools_with_cache_breakpoint(cls, tools: list[Tool]) -> list[dict]:
        """工具表整体稳定，在最后一个工具上打断点以缓存整个 tools 前缀。"""
        payload = [cls._tool_to_anthropic(t) for t in tools]
        if payload:
            payload[-1]["cache_control"] = dict(cls._EPHEMERAL)
        return payload

    @classmethod
    def _mark_cache_tail(cls, messages: list[dict]) -> list[dict]:
        """在最后一条 user 消息的最后一个 content block 上打 ephemeral 断点。

        返回拷贝，不修改传入的历史（cache_control 不随历史回传，每轮重打）。
        该断点把断点之前的全部前缀（历史 + 工具结果）写入/复用缓存，
        下一轮请求的前缀与之相同即可整段命中。
        """
        out = list(messages)
        for i in range(len(out) - 1, -1, -1):
            msg = out[i]
            if msg.get("role") != "user":
                continue
            content = msg.get("content")
            if isinstance(content, str):
                if not content:
                    break
                out[i] = {
                    **msg,
                    "content": [
                        {"type": "text", "text": content, "cache_control": dict(cls._EPHEMERAL)}
                    ],
                }
            elif isinstance(content, list) and content:
                blocks = [dict(b) if isinstance(b, dict) else b for b in content]
                last = blocks[-1]
                if isinstance(last, dict):
                    last = {**last, "cache_control": dict(cls._EPHEMERAL)}
                    blocks[-1] = last
                    out[i] = {**msg, "content": blocks}
            break
        return out

    # ---------- 转换工具 ----------

    @staticmethod
    def _tool_to_anthropic(tool: Tool) -> dict:
        return {
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.input_schema,
        }

    @staticmethod
    def _block_from_anthropic(block: Any) -> TextBlock | ToolUseBlock | ToolResultBlock | None:
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
        if btype in ("thinking", "redacted_thinking"):
            # 思考块不是对外文本：丢弃。否则 str(block) 的 repr
            # （ThinkingBlock(signature=..., thinking='...')）会泄漏进正文
            return None
        # 未知类型降级为文本
        return TextBlock(text=str(block))

    @staticmethod
    def _event_from_anthropic(event: Any) -> StreamEvent | None:
        etype = getattr(event, "type", None)
        if etype == "message_start":
            return StreamEvent(type="message_start")
        if etype == "content_block_start":
            block = getattr(event, "content_block", None)
            block_type = getattr(block, "type", None) if block else None
            tool_use_id = (
                getattr(block, "id", None)
                if block and block_type == "tool_use"
                else None
            )
            tool_name = (
                getattr(block, "name", None)
                if block and block_type == "tool_use"
                else None
            )
            return StreamEvent(
                type="content_block_start",
                block_index=getattr(event, "index", None),
                block_type=block_type,
                tool_use_id=tool_use_id,
                tool_name=tool_name,
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
