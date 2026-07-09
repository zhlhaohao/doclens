"""factory.create_provider 测试。"""
from unittest.mock import MagicMock

import pytest

from planify.core.llm import factory
from planify.core.llm.anthropic_provider import AnthropicProvider


def test_create_provider_anthropic(monkeypatch):
    captured = {}

    def fake_ctor(*, api_key, base_url, model):
        captured["api_key"] = api_key
        captured["base_url"] = base_url
        captured["model"] = model
        return MagicMock(spec=AnthropicProvider)

    monkeypatch.setattr(factory, "AnthropicProvider", fake_ctor)
    provider = factory.create_provider({
        "provider_name": "anthropic",
        "api_key": "sk-test",
        "model_id": "claude-opus-4-6",
    })
    assert captured["api_key"] == "sk-test"
    assert captured["model"] == "claude-opus-4-6"


def test_create_provider_deepseek(monkeypatch):
    captured = {}

    def fake_ctor(*, api_key, base_url, model):
        captured["base_url"] = base_url
        captured["model"] = model
        return MagicMock()

    monkeypatch.setattr(factory, "OpenAICompatProvider", fake_ctor)
    factory.create_provider({
        "provider_name": "deepseek",
        "api_key": "sk-ds",
        "model_id": "deepseek-chat",
    })
    assert captured["base_url"] == "https://api.deepseek.com/v1"
    assert captured["model"] == "deepseek-chat"


def test_create_provider_custom_missing_url(monkeypatch):
    monkeypatch.setattr(factory, "AnthropicProvider", lambda **kw: MagicMock())
    with pytest.raises(ValueError):
        factory.create_provider({
            "provider_name": "custom",
            "protocol": "openai_compat",
            "api_key": "k",
            "model_id": "m",
        })
