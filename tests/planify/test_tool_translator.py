"""tool_translator 单元测试。"""
import pytest

from planify.core.llm.tool_translator import (
    ToolCallMapper,
    accumulate_input_json_delta,
    messages_anthropic_to_openai,
    tools_anthropic_to_openai,
)
from planify.core.llm.types import Tool


def test_tools_anthropic_to_openai():
    tools = [
        Tool(name="read", description="Read file", input_schema={"type": "object", "properties": {"path": {"type": "string"}}})
    ]
    out = tools_anthropic_to_openai(tools)
    assert out[0]["type"] == "function"
    fn = out[0]["function"]
    assert fn["name"] == "read"
    assert fn["description"] == "Read file"
    assert fn["parameters"] == {"type": "object", "properties": {"path": {"type": "string"}}}


def test_mapper_register_and_lookup():
    m = ToolCallMapper()
    internal = m.register("call_abc")
    assert internal.startswith("toolu_")
    assert m.to_openai(internal) == "call_abc"
    # 重复注册同一外部 ID 返回相同 internal
    assert m.register("call_abc") == internal


def test_messages_with_tool_use_and_tool_result():
    m = ToolCallMapper()
    internal_id = m.register("call_x")
    messages = [
        {"role": "user", "content": "do it"},
        {
            "role": "assistant",
            "content": [
                {"type": "text", "text": "ok"},
                {"type": "tool_use", "id": internal_id, "name": "read", "input": {"path": "/a"}},
            ],
        },
        {
            "role": "user",
            "content": [
                {"type": "tool_result", "tool_use_id": internal_id, "content": "file content"},
            ],
        },
    ]
    out = messages_anthropic_to_openai(messages, m)
    # assistant 转 assistant + tool_calls
    asst = out[1]
    assert asst["role"] == "assistant"
    assert asst["tool_calls"][0]["id"] == "call_x"
    assert asst["tool_calls"][0]["function"]["name"] == "read"
    import json
    assert json.loads(asst["tool_calls"][0]["function"]["arguments"]) == {"path": "/a"}
    # tool_result 转 role=tool
    tool_msg = out[2]
    assert tool_msg["role"] == "tool"
    assert tool_msg["tool_call_id"] == "call_x"
    assert tool_msg["content"] == "file content"


def test_accumulate_input_json_delta_valid():
    parsed = accumulate_input_json_delta(['{"path"', ':', ' "/a"}'])
    assert parsed == {"path": "/a"}


def test_accumulate_input_json_delta_invalid_returns_none():
    assert accumulate_input_json_delta(["{not valid"]) is None


def test_accumulate_input_json_delta_empty():
    assert accumulate_input_json_delta(["", "", ""]) is None