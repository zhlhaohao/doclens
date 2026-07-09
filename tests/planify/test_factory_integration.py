"""factory + OpenAICompatProvider 端到端集成测试。"""
import httpx
import pytest
import respx

from planify.core.llm import create_provider


def test_factory_creates_anthropic_provider():
    p = create_provider({
        "provider_name": "anthropic",
        "api_key": "sk-a",
        "model_id": "claude-opus-4-6",
    })
    assert p.__class__.__name__ == "AnthropicProvider"


@respx.mock
def test_factory_creates_openai_compat_provider_for_deepseek():
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "cmpl",
                "model": "deepseek-chat",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": "ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
            },
        )
    )
    p = create_provider({
        "provider_name": "deepseek",
        "api_key": "sk-ds",
        "model_id": "deepseek-chat",
    })
    assert p.__class__.__name__ == "OpenAICompatProvider"
    resp = p.chat(messages=[{"role": "user", "content": "hi"}], system="", tools=[])
    assert resp.content[0].text == "ok"


def test_factory_custom_with_anthropic_protocol():
    p = create_provider({
        "provider_name": "custom",
        "base_url": "https://anthropic-proxy.example.com",
        "protocol": "anthropic",
        "api_key": "sk-x",
        "model_id": "custom-model",
    })
    assert p.__class__.__name__ == "AnthropicProvider"