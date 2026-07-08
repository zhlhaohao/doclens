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
        "planify_provider": "anthropic",
        "planify_api_key": "sk-test",
        "planify_model_id": "claude-opus-4-6",
    }
    name, base_url, model, proto = resolve_provider_config(cfg)
    assert name == "anthropic"
    assert proto == "anthropic"
    assert model == "claude-opus-4-6"


def test_resolve_known_preset_deepseek():
    cfg = {
        "planify_provider": "deepseek",
        "planify_api_key": "sk-ds",
        "planify_model_id": "deepseek-chat",
    }
    _, base_url, _, proto = resolve_provider_config(cfg)
    assert proto == "openai_compat"
    assert base_url == "https://api.deepseek.com/v1"


def test_resolve_explicit_override_takes_precedence():
    cfg = {
        "planify_provider": "deepseek",
        "planify_base_url": "https://my-proxy.example.com/v1",
        "planify_protocol": "anthropic",
        "planify_api_key": "sk-x",
        "planify_model_id": "deepseek-chat",
    }
    _, base_url, _, proto = resolve_provider_config(cfg)
    assert base_url == "https://my-proxy.example.com/v1"
    assert proto == "anthropic"


def test_resolve_custom_requires_base_url():
    cfg = {
        "planify_provider": "custom",
        "planify_protocol": "openai_compat",
        "planify_api_key": "k",
        "planify_model_id": "m",
    }
    with pytest.raises(ValueError, match="base_url"):
        resolve_provider_config(cfg)


def test_resolve_custom_requires_protocol():
    cfg = {
        "planify_provider": "custom",
        "planify_base_url": "https://x/v1",
        "planify_api_key": "k",
        "planify_model_id": "m",
    }
    with pytest.raises(ValueError, match="protocol"):
        resolve_provider_config(cfg)


def test_resolve_custom_full():
    cfg = {
        "planify_provider": "custom",
        "planify_base_url": "https://x/v1",
        "planify_protocol": "openai_compat",
        "planify_api_key": "k",
        "planify_model_id": "m",
    }
    name, base_url, model, proto = resolve_provider_config(cfg)
    assert name == "custom"
    assert base_url == "https://x/v1"
    assert proto == "openai_compat"
    assert model == "m"


def test_resolve_unknown_provider_raises():
    cfg = {
        "planify_provider": "nonsense",
        "planify_api_key": "k",
        "planify_model_id": "m",
    }
    with pytest.raises(ValueError, match="unknown provider"):
        resolve_provider_config(cfg)


def test_resolve_default_provider_is_anthropic():
    cfg = {
        "planify_api_key": "k",
        "planify_model_id": "claude-opus-4-6",
    }
    name, _, _, proto = resolve_provider_config(cfg)
    assert name == "anthropic"
    assert proto == "anthropic"