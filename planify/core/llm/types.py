"""LLMProvider 归一化数据类型。"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


@dataclass(frozen=True)
class TextBlock:
    """纯文本块。"""

    text: str
    type: Literal["text"] = "text"


@dataclass(frozen=True)
class ToolUseBlock:
    """模型请求调用工具的块。"""

    id: str
    name: str
    input: dict[str, Any]
    type: Literal["tool_use"] = "tool_use"


@dataclass(frozen=True)
class ToolResultBlock:
    """工具调用结果。"""

    tool_use_id: str
    content: str
    is_error: bool = False
    type: Literal["tool_result"] = "tool_result"


ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock


@dataclass(frozen=True)
class Tool:
    """工具定义（Anthropic 风格 JSON Schema）。"""

    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass(frozen=True)
class LLMResponse:
    """Provider 归一化响应。"""

    content: list[ContentBlock]
    stop_reason: Literal["end_turn", "tool_use", "max_tokens", "error"]
    model: str
    usage: dict[str, int]


@dataclass(frozen=True)
class StreamEvent:
    """归一化流式事件。

    为支持 streaming 端的事件处理，新增以下可选字段：
      - block_type: content_block_start 时区分 "text" / "tool_use"
      - tool_use_id: tool_use block 的 id（在 content_block_start 时填充）
      - tool_name: tool_use block 的 name（在 content_block_start 时填充）
      - usage: token 用量（Anthropic: message_start 带全量四字段、message_delta
        带 output_tokens；OpenAI 兼容: include_usage 尾 chunk 归一化后挂在
        message_delta）。键归一化为 input_tokens / output_tokens /
        cache_read_input_tokens / cache_creation_input_tokens。
    """

    type: Literal[
        "message_start",
        "content_block_start",
        "content_block_delta",
        "content_block_stop",
        "message_delta",
        "message_stop",
    ]
    # 可选字段
    text_delta: str | None = None
    input_json_delta: str | None = None
    stop_reason: str | None = None
    block_index: int | None = None
    block_type: Literal["text", "tool_use"] | None = None
    tool_use_id: str | None = None
    tool_name: str | None = None
    usage: dict[str, int] | None = None
