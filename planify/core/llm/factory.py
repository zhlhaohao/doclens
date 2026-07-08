"""LLM Provider 工厂。"""
from .anthropic_provider import AnthropicProvider
from .openai_compat_provider import OpenAICompatProvider
from .presets import resolve_provider_config


def create_provider(config: dict):
    """根据 config 创建 LLMProvider 实例。

    Args:
        config: 配置字典，必须含 planify_provider / planify_api_key / planify_model_id；
                custom 预设还须含 planify_base_url / planify_protocol。

    Returns:
        LLMProvider 实现（AnthropicProvider 或 OpenAICompatProvider，Task 9 引入后者）。
    """
    provider_name, base_url, model_id, protocol = resolve_provider_config(config)
    api_key = config.get("planify_api_key", "")

    if protocol == "anthropic":
        return AnthropicProvider(api_key=api_key, base_url=base_url, model=model_id)
    elif protocol == "openai_compat":
        return OpenAICompatProvider(api_key=api_key, base_url=base_url, model=model_id)
    else:
        raise ValueError(f"unknown protocol: {protocol}")
