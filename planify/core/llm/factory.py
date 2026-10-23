"""LLM Provider 工厂。"""
from .anthropic_provider import AnthropicProvider
from .openai_compat_provider import OpenAICompatProvider
from .presets import resolve_provider_config


def create_provider(config: dict):
    """根据 config 创建 LLMProvider 实例。

    Args:
        config: 配置字典，含 ``api_key`` / ``model_id``；可选 ``base_url`` / ``protocol``
                （``protocol`` 默认 ``"anthropic"``，``base_url`` 默认 None 用 SDK 端点）；
                可选 ``thinking_depth``（思考深度档位，见 types.THINKING_DEPTHS，
                缺省 "auto" = 不发思考参数）。

    Returns:
        LLMProvider 实现（AnthropicProvider 或 OpenAICompatProvider）。
    """
    base_url, model_id, protocol = resolve_provider_config(config)
    api_key = config.get("api_key", "")
    thinking_depth = config.get("thinking_depth") or "auto"
    if protocol == "anthropic":
        return AnthropicProvider(
            api_key=api_key, base_url=base_url, model=model_id,
            thinking_depth=thinking_depth,
        )
    elif protocol == "openai_compat":
        return OpenAICompatProvider(
            api_key=api_key, base_url=base_url, model=model_id,
            thinking_depth=thinking_depth,
        )
    raise ValueError(f"unknown protocol: {protocol}")
