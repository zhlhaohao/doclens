"""LLMProvider 归一化数据类型。"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

# ---- 思考深度档位（宿主全局配置 → Provider 请求参数）----
# auto（默认）：不干预——不发任何思考参数，兼容一切端点（含不支持思考的模型）。
# off：显式不思考——OpenAI 兼容端 reasoning_effort="none"（best-effort），
#      Anthropic 兼容端 thinking={"type": "disabled"}（部分恒思考模型会 400，
#      由用户显式报错可见，逃生档 = auto）。
# low/medium/high：开思考并控制深度——
#      OpenAI 兼容端顶层 reasoning_effort 直传（low/medium/high 是全行业最大
#      公约数；xhigh/max 等端点私有超档值不进全局枚举）；
#      Anthropic 兼容端双发 thinking={"type": "enabled", "budget_tokens": N}
#      + output_config={"effort": 同名}——真 Anthropic 吃 budget（精确控制），
#      DeepSeek/MiniMax 忽略 budget 只认 effort（双发各方各取所需，
#      2026-10 四家官方文档核实）。budget 叠加进 max_tokens（思考 token 计在
#      max_tokens 内，直接覆盖会挤占可见输出）。
THINKING_DEPTHS = ("auto", "off", "low", "medium", "high")

# low/medium/high → Anthropic thinking.budget_tokens
THINKING_BUDGET_TOKENS = {"low": 2048, "medium": 8192, "high": 16384}

# max_tokens 公共上限（思考 budget 叠加后钳制用）：GLM /anthropic 硬限
# ≤131072（超限 400 code 1210）；Anthropic 官方上限更高，取行业公约数。
MAX_OUTPUT_TOKENS_CEILING = 131072


def normalize_thinking_depth(value: Any) -> str:
    """归一化思考深度档位：None/空串/未知值 → "auto"（不干预，向后兼容）。"""
    v = (value or "auto").strip().lower() if isinstance(value, str) else "auto"
    return v if v in THINKING_DEPTHS else "auto"



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
      - block_type: content_block_start 时区分 "text" / "tool_use" / "thinking"
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
    # 思考流增量（reasoning_content / reasoning 字段被动透传，2026-10-05）
    thinking_delta: str | None = None
    stop_reason: str | None = None
    block_index: int | None = None
    block_type: Literal["text", "tool_use", "thinking"] | None = None
    tool_use_id: str | None = None
    tool_name: str | None = None
    usage: dict[str, int] | None = None
