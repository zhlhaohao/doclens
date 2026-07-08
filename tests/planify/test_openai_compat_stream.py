"""OpenAICompatProvider.stream 测试。"""
import json

import httpx
import pytest
import respx

from planify.core.llm.openai_compat_provider import OpenAICompatProvider


@pytest.fixture
def provider():
    return OpenAICompatProvider(
        api_key="sk-ds",
        base_url="https://api.deepseek.com/v1",
        model="deepseek-chat",
    )


def _sse(data_obj):
    return f"data: {json.dumps(data_obj)}\n\n"


@respx.mock
def test_stream_text(provider):
    chunks = [
        {"id": "cmpl-1", "model": "deepseek-chat", "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {"content": "hello"}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {"content": " world"}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]},
    ]
    sse = "".join(_sse(c) for c in chunks) + "data: [DONE]\n\n"
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/event-stream"}, content=sse.encode())
    )
    out = list(provider.stream(messages=[{"role": "user", "content": "hi"}], system="", tools=[]))
    deltas = [e.text_delta for e in out if e.type == "content_block_delta" and e.text_delta]
    assert "".join(deltas) == "hello world"
    # 末尾应出现 message_stop
    assert any(e.type == "message_stop" for e in out)
    # stop_reason
    md = next((e for e in out if e.type == "message_delta"), None)
    assert md is not None and md.stop_reason == "end_turn"


@respx.mock
def test_stream_tool_call(provider):
    chunks = [
        {"id": "cmpl-2", "choices": [{"index": 0, "delta": {"role": "assistant", "tool_calls": [
            {"index": 0, "id": "call_xyz", "type": "function", "function": {"name": "read", "arguments": ""}}
        ]}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {"tool_calls": [
            {"index": 0, "function": {"arguments": '{"path"'}}
        ]}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {"tool_calls": [
            {"index": 0, "function": {"arguments": ':"/a"}'}}
        ]}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {}, "finish_reason": "tool_calls"}]},
    ]
    sse = "".join(_sse(c) for c in chunks) + "data: [DONE]\n\n"
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/event-stream"}, content=sse.encode())
    )
    out = list(provider.stream(messages=[], system="", tools=[]))
    # 应有 content_block_start + content_block_delta(input_json_delta) + content_block_stop
    types = [e.type for e in out]
    assert "content_block_start" in types
    assert "content_block_stop" in types
    deltas = [e.input_json_delta for e in out if e.type == "content_block_delta" and e.input_json_delta]
    assert "".join(deltas) == '{"path":"/a"}'
    md = next(e for e in out if e.type == "message_delta")
    assert md.stop_reason == "tool_use"