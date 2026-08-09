"""LLM Provider 工厂。"""
from .anthropic_provider import AnthropicProvider
from .openai_compat_provider import OpenAICompatProvider
from .presets import resolve_provider_config


def create_provider(config: dict):
    """根据 config 创建 LLMProvider 实例。

    Args:
        config: 配置字典，含 ``api_key`` / ``model_id``；可选 ``base_url`` / ``protocol``
                （``protocol`` 默认 ``"anthropic"``，``base_url`` 默认 None 用 SDK 端点）。

    Returns:
        LLMProvider 实现（AnthropicProvider 或 OpenAICompatProvider）。
    """
    base_url, model_id, protocol = resolve_provider_config(config)
    api_key = config.get("api_key", "")
    if protocol == "anthropic":
        return AnthropicProvider(api_key=api_key, base_url=base_url, model=model_id)
    elif protocol == "openai_compat":
        return OpenAICompatProvider(api_key=api_key, base_url=base_url, model=model_id)
    raise ValueError(f"unknown protocol: {protocol}")
