"""AnthropicProvider 测试（respx mock 拦截 httpx）。"""
import json

import httpx
import pytest
import respx

from planify.core.llm.anthropic_provider import AnthropicProvider
from planify.core.llm.types import TextBlock, Tool, ToolUseBlock


@pytest.fixture
def provider():
    return AnthropicProvider(
        api_key="sk-test",
        base_url="https://api.example.com",
        model="claude-opus-4-6",
    )


def _mock_anthropic_response(content_blocks, stop_reason="end_turn"):
    return {
        "id": "msg_01",
        "model": "claude-opus-4-6",
        "stop_reason": stop_reason,
        "content": content_blocks,
        "usage": {"input_tokens": 10, "output_tokens": 5},
    }


@respx.mock
def test_chat_text_response(provider):
    respx.post("https://api.example.com/v1/messages").mock(
        return_value=httpx.Response(
            200,
            json=_mock_anthropic_response(
                [{"type": "text", "text": "hello"}],
                stop_reason="end_turn",
            ),
        )
    )
    resp = provider.chat(
        messages=[{"role": "user", "content": "hi"}],
        system="sys",
        tools=[],
    )
    assert len(resp.content) == 1
    assert resp.content[0] == TextBlock(text="hello")
    assert resp.stop_reason == "end_turn"


@respx.mock
def test_chat_tool_use_response(provider):
    respx.post("https://api.example.com/v1/messages").mock(
        return_value=httpx.Response(
            200,
            json=_mock_anthropic_response(
                [
                    {"type": "text", "text": "calling read"},
                    {
                        "type": "tool_use",
                        "id": "toolu_1",
                        "name": "read",
                        "input": {"path": "/a"},
                    },
                ],
                stop_reason="tool_use",
            ),
        )
    )
    resp = provider.chat(messages=[], system="", tools=[
        Tool(name="read", description="Read", input_schema={"type": "object"})
    ])
    blocks = resp.content
    assert any(isinstance(b, ToolUseBlock) and b.id == "toolu_1" for b in blocks)
    assert resp.stop_reason == "tool_use"


@respx.mock
def test_chat_error_status_raises(provider):
    respx.post("https://api.example.com/v1/messages").mock(
        return_value=httpx.Response(401, json={"error": "unauthorized"})
    )
    with pytest.raises(Exception):  # 后续 task 会替换为具体 LLMError
        provider.chat(messages=[], system="", tools=[])


@respx.mock
def test_stream_yields_normalized_events(provider):
    events_raw = [
        {"type": "message_start", "message": {"id": "m1"}},
        {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
        {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "hello"}},
        {"type": "content_block_stop", "index": 0},
        {"type": "message_delta", "delta": {"stop_reason": "end_turn"}},
        {"type": "message_stop"},
    ]
    # Anthropic SSE format requires both "event:" and "data:" lines per SSE spec.
    # The SDK's MessageStream accumulator also requires usage tokens on message_start
    # and message_delta to build a snapshot, otherwise it raises mid-stream.
    sse_chunks = []
    for i, e in enumerate(events_raw):
        # Inject minimal usage so the SDK's snapshot accumulator is happy.
        if e["type"] == "message_start":
            e["message"]["content"] = []
            e["message"]["usage"] = {"input_tokens": 10, "output_tokens": 0}
        if e["type"] == "message_delta":
            e["usage"] = {"output_tokens": 5}
        sse_chunks.append(f"event: {e['type']}")
        sse_chunks.append(f"data: {json.dumps(e)}")
        sse_chunks.append("")
    sse_body = "\n".join(sse_chunks)
    respx.post("https://api.example.com/v1/messages").mock(
        return_value=httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            content=sse_body.encode(),
        )
    )
    out = list(provider.stream(messages=[], system="", tools=[]))
    types = [e.type for e in out]
    assert "message_start" in types
    assert "content_block_delta" in types
    delta = next(e for e in out if e.type == "content_block_delta")
    assert delta.text_delta == "hello"


def test_count_tokens_estimate(provider):
    assert provider.count_tokens("abcdefgh") == 2  # 8/4
    assert provider.count_tokens("") == 0
