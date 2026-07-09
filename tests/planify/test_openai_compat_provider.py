"""OpenAICompatProvider 测试（respx mock）。"""
import json

import httpx
import pytest
import respx

from planify.core.llm.openai_compat_provider import OpenAICompatProvider
from planify.core.llm.types import TextBlock, Tool, ToolUseBlock


@pytest.fixture
def provider():
    return OpenAICompatProvider(
        api_key="sk-ds",
        base_url="https://api.deepseek.com/v1",
        model="deepseek-chat",
    )


def _mock_chat_completion(content_text=None, tool_calls=None, finish_reason="stop"):
    msg: dict = {"role": "assistant", "content": content_text}
    if tool_calls:
        msg["tool_calls"] = tool_calls
    return {
        "id": "cmpl-1",
        "model": "deepseek-chat",
        "choices": [
            {
                "index": 0,
                "message": msg,
                "finish_reason": finish_reason,
            }
        ],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5},
    }


@respx.mock
def test_chat_text_response(provider):
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(
            200, json=_mock_chat_completion(content_text="hello")
        )
    )
    resp = provider.chat(messages=[{"role": "user", "content": "hi"}], system="sys", tools=[])
    assert len(resp.content) == 1
    assert resp.content[0] == TextBlock(text="hello")
    assert resp.stop_reason == "end_turn"


@respx.mock
def test_chat_tool_call_response(provider):
    tool_calls = [
        {
            "id": "call_abc",
            "type": "function",
            "function": {
                "name": "read",
                "arguments": json.dumps({"path": "/a"}),
            },
        }
    ]
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json=_mock_chat_completion(
                content_text="calling read",
                tool_calls=tool_calls,
                finish_reason="tool_calls",
            ),
        )
    )
    resp = provider.chat(
        messages=[],
        system="",
        tools=[Tool(name="read", description="Read", input_schema={"type": "object"})],
    )
    blocks = resp.content
    assert any(isinstance(b, ToolUseBlock) and b.name == "read" for b in blocks)
    assert resp.stop_reason == "tool_use"


@respx.mock
def test_chat_invalid_tool_arguments_dont_crash(provider):
    tool_calls = [
        {
            "id": "call_bad",
            "type": "function",
            "function": {"name": "read", "arguments": "{not valid"},
        }
    ]
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json=_mock_chat_completion(tool_calls=tool_calls, finish_reason="tool_calls"),
        )
    )
    resp = provider.chat(messages=[], system="", tools=[])
    # 即使 arguments 无法解析也应不崩；input 为空 dict
    tool_block = next(b for b in resp.content if isinstance(b, ToolUseBlock))
    assert tool_block.name == "read"
    assert tool_block.input == {}


def test_count_tokens_estimate(provider):
    assert provider.count_tokens("abcdefgh") == 2