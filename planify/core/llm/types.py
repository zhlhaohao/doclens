"""LLMProvider 归一化数据类型。"""
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
    """归一化流式事件（后续 task 完善字段）。"""

    type: str
