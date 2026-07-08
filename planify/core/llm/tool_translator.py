"""Anthropic <-> OpenAI 兼容协议 工具调用转译。"""
from __future__ import annotations

import json
import uuid
from typing import Any, Iterator

from .types import Tool


class ToolCallMapper:
    """维护 openai_id <-> internal_id（toolu_xxx）映射。"""

    def __init__(self) -> None:
        self._openai_to_internal: dict[str, str] = {}
        self._internal_to_openai: dict[str, str] = {}

    def register(self, openai_id: str) -> str:
        """登记 openai_id，返回 internal toolu_xxx；重复返回相同 internal。"""
        if openai_id in self._openai_to_internal:
            return self._openai_to_internal[openai_id]
        internal = f"toolu_{uuid.uuid4().hex[:24]}"
        self._openai_to_internal[openai_id] = internal
        self._internal_to_openai[internal] = openai_id
        return internal

    def to_openai(self, internal_id: str) -> str | None:
        return self._internal_to_openai.get(internal_id)


def tools_anthropic_to_openai(tools: list[Tool]) -> list[dict]:
    """把 Tool 列表转为 OpenAI tools 格式。"""
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.input_schema,
            },
        }
        for t in tools
    ]


def messages_anthropic_to_openai(
    messages: list[dict], mapper: ToolCallMapper
) -> list[dict]:
    """把 Anthropic 风格 messages（含 tool_use / tool_result 块）转成 OpenAI 风格。

    转换规则：
      - assistant + tool_use blocks  -> assistant + tool_calls
      - user + tool_result blocks    -> 一条或多条 role=tool
      - 普通 user/assistant 文本     -> role=user/assistant with string content
    """
    out: list[dict] = []
    for msg in messages:
        role = msg["role"]
        content = msg.get("content")
        if isinstance(content, str) or content is None:
            out.append({"role": role, "content": content or ""})
            continue

        if role == "assistant":
            text_parts: list[str] = []
            tool_calls: list[dict] = []
            for block in content:
                btype = block.get("type")
                if btype == "text":
                    text_parts.append(block.get("text", ""))
                elif btype == "tool_use":
                    internal_id = block["id"]
                    openai_id = mapper.to_openai(internal_id) or mapper.register(
                        # 若 internal_id 不在 mapper 中（异常路径），回退为新生成
                        internal_id.replace("toolu_", "call_")
                    )
                    tool_calls.append({
                        "id": openai_id,
                        "type": "function",
                        "function": {
                            "name": block["name"],
                            "arguments": json.dumps(block.get("input", {}), ensure_ascii=False),
                        },
                    })
            asst: dict[str, Any] = {"role": "assistant", "content": "".join(text_parts)}
            if tool_calls:
                asst["tool_calls"] = tool_calls
            out.append(asst)
        elif role == "user":
            for block in content:
                if block.get("type") == "tool_result":
                    internal_id = block["tool_use_id"]
                    openai_id = mapper.to_openai(internal_id)
                    if not openai_id:
                        # 内部 ID 未注册（极端情况），跳过
                        continue
                    out.append({
                        "role": "tool",
                        "tool_call_id": openai_id,
                        "content": str(block.get("content", "")),
                    })
                else:
                    out.append({"role": "user", "content": str(block)})
        else:
            out.append({"role": role, "content": str(content)})
    return out


def accumulate_input_json_delta(deltas: list[str]) -> dict | None:
    """把流式 input_json_delta 累积并解析为 dict；失败返回 None。"""
    joined = "".join(deltas)
    if not joined.strip():
        return None
    try:
        return json.loads(joined)
    except json.JSONDecodeError:
        return None