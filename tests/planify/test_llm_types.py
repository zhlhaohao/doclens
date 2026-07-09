"""LLMProvider 归一化数据类测试。"""
from dataclasses import FrozenInstanceError

import pytest

from planify.core.llm.types import (
    LLMResponse,
    TextBlock,
    Tool,
    ToolResultBlock,
    ToolUseBlock,
)


def test_text_block_is_immutable():
    block = TextBlock(text="hello")
    with pytest.raises(FrozenInstanceError):
        block.text = "world"  # type: ignore[misc]


def test_tool_use_block_is_immutable():
    block = ToolUseBlock(id="toolu_1", name="read", input={"path": "/a"})
    with pytest.raises(FrozenInstanceError):
        block.name = "write"  # type: ignore[misc]


def test_tool_result_block_default_is_error_false():
    block = ToolResultBlock(tool_use_id="toolu_1", content="ok")
    assert block.is_error is False


def test_tool_immutable():
    tool = Tool(name="read", description="Read file", input_schema={"type": "object"})
    with pytest.raises(FrozenInstanceError):
        tool.name = "write"  # type: ignore[misc]


def test_llm_response_holds_blocks_and_stop_reason():
    resp = LLMResponse(
        content=[TextBlock(text="hi"), ToolUseBlock(id="t1", name="x", input={})],
        stop_reason="tool_use",
        model="claude-opus-4-6",
        usage={"input_tokens": 10, "output_tokens": 5},
    )
    assert len(resp.content) == 2
    assert resp.stop_reason == "tool_use"
    assert resp.model == "claude-opus-4-6"
    assert resp.usage["input_tokens"] == 10


def test_llm_response_is_immutable():
    resp = LLMResponse(
        content=[TextBlock(text="x")],
        stop_reason="end_turn",
        model="m",
        usage={},
    )
    with pytest.raises(FrozenInstanceError):
        resp.stop_reason = "max_tokens"  # type: ignore[misc]