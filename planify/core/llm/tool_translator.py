"""Anthropic <-> OpenAI 兼容协议 工具调用转译。"""
from __future__ import annotations

import json
import uuid
from typing import Any, Iterator, Optional

from .types import Tool


class ToolCallMapper:
    """维护 openai_id <-> internal_id（toolu_xxx）映射。

    保留以兼容历史用法（外部可能仍 import）。round-trip 当前直接透传
    block["id"]（不再回查 mapper），避免 mapper 每次 chat/stream 调用
    重建导致的 tool_result 丢失 + 工具调用无限循环 bug。
    """

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
    messages: list[dict], mapper: Optional[ToolCallMapper] = None,
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
                    # 关键：runner 已在 content_block_stop 把模型生成的 tool_use_id
                    # （OpenAI 风格 call_xxx 或 Anthropic 风格 toolu_xxx）原样写入
                    # block["id"]。直接复用，**不要**走 mapper——mapper 每次
                    # chat/stream 调用都重建，回查 to_openai 必然 None，回退
                    # register() 会生成新的内部 id，导致：
                    #   1) 工具调用 id 每次轮换，模型识别不到自己的调用；
                    #   2) 后续 tool_result.tool_use_id 查不到对应映射被丢弃。
                    # 两者叠加 → 模型永远看不到工具执行结果 → 无限循环重试同一工具。
                    openai_id = block["id"]
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
            # tool_result → 独立 role=tool 消息（保持块顺序，OpenAI 协议强制要求）；
            # 其余块聚合为一条 user 消息：含 image 时 content 为 OpenAI 多模态数组
            # （image_url + text），纯文本时保持字符串（对话主链路行为不变）。
            rest: list[dict[str, Any]] = []
            for block in content:
                btype = block.get("type")
                if btype == "tool_result":
                    # 同上：tool_use_id 原样回传给 OpenAI，保证与 assistant
                    # tool_calls[i].id 完全一致（OpenAI 协议强制要求）。
                    out.append({
                        "role": "tool",
                        "tool_call_id": block["tool_use_id"],
                        "content": str(block.get("content", "")),
                    })
                elif btype == "image":
                    # Anthropic base64 image block → OpenAI image_url（data URL）。
                    # vision 调用（doclens.vision_client）经此翻译统一走 provider。
                    source = block.get("source") or {}
                    if source.get("type") == "base64":
                        rest.append({
                            "type": "image_url",
                            "image_url": {"url": "data:{};base64,{}".format(
                                source.get("media_type", "application/octet-stream"),
                                source.get("data", ""),
                            )},
                        })
                    else:
                        rest.append({"type": "text", "text": str(block)})
                elif btype == "text":
                    rest.append({"type": "text", "text": block.get("text", "")})
                else:
                    rest.append({"type": "text", "text": str(block)})
            if rest:
                if len(rest) == 1 and rest[0]["type"] == "text":
                    out.append({"role": "user", "content": rest[0]["text"]})
                else:
                    out.append({"role": "user", "content": rest})
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