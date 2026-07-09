"""预设表与解析器测试。"""
import pytest

from planify.core.llm.presets import (
    PROVIDER_PRESETS,
    resolve_provider_config,
)


def test_known_presets_have_base_url_and_protocol():
    for name in ["anthropic", "openrouter", "qwen", "deepseek", "glm"]:
        spec = PROVIDER_PRESETS[name]
        assert spec["protocol"] in ("anthropic", "openai_compat")
    # anthropic 可有可无 base_url（用 SDK 默认）
    assert "protocol" in PROVIDER_PRESETS["anthropic"]


def test_custom_not_in_presets():
    assert "custom" not in PROVIDER_PRESETS


def test_resolve_known_preset_anthropic():
    cfg = {
        "provider_name": "anthropic",
        "api_key": "sk-test",
        "model_id": "claude-opus-4-6",
    }
    name, base_url, model, proto = resolve_provider_config(cfg)
    assert name == "anthropic"
    assert proto == "anthropic"
    assert model == "claude-opus-4-6"


def test_resolve_known_preset_deepseek():
    cfg = {
        "provider_name": "deepseek",
        "api_key": "sk-ds",
        "model_id": "deepseek-chat",
    }
    _, base_url, _, proto = resolve_provider_config(cfg)
    assert proto == "openai_compat"
    assert base_url == "https://api.deepseek.com/v1"


def test_resolve_explicit_override_takes_precedence():
    cfg = {
        "provider_name": "deepseek",
        "base_url": "https://my-proxy.example.com/v1",
        "protocol": "anthropic",
        "api_key": "sk-x",
        "model_id": "deepseek-chat",
    }
    _, base_url, _, proto = resolve_provider_config(cfg)
    assert base_url == "https://my-proxy.example.com/v1"
    assert proto == "anthropic"


def test_resolve_custom_requires_base_url():
    cfg = {
        "provider_name": "custom",
        "protocol": "openai_compat",
        "api_key": "k",
        "model_id": "m",
    }
    with pytest.raises(ValueError, match="base_url"):
        resolve_provider_config(cfg)


def test_resolve_custom_requires_protocol():
    cfg = {
        "provider_name": "custom",
        "base_url": "https://x/v1",
        "api_key": "k",
        "model_id": "m",
    }
    with pytest.raises(ValueError, match="protocol"):
        resolve_provider_config(cfg)


def test_resolve_custom_full():
    cfg = {
        "provider_name": "custom",
        "base_url": "https://x/v1",
        "protocol": "openai_compat",
        "api_key": "k",
        "model_id": "m",
    }
    name, base_url, model, proto = resolve_provider_config(cfg)
    assert name == "custom"
    assert base_url == "https://x/v1"
    assert proto == "openai_compat"
    assert model == "m"


def test_resolve_unknown_provider_raises():
    cfg = {
        "provider_name": "nonsense",
        "api_key": "k",
        "model_id": "m",
    }
    with pytest.raises(ValueError, match="unknown provider"):
        resolve_provider_config(cfg)


def test_resolve_default_provider_is_anthropic():
    cfg = {
        "api_key": "k",
        "model_id": "claude-opus-4-6",
    }
    name, _, _, proto = resolve_provider_config(cfg)
    assert name == "anthropic"
    assert proto == "anthropic"