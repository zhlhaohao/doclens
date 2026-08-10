"""LLM 配置解析（provider 概念已废弃，ADR-0009）。

原先的 ``PROVIDER_PRESETS`` 供应商表与 ``provider_name`` 参数已移除——选 SDK
client 仅由 ``protocol`` 决定（见 ``factory.create_provider``）。保留
``resolve_provider_config`` 同名函数向后兼容，但不再依赖 provider_name。
"""
from typing import Optional


def resolve_provider_config(
    config: dict,
) -> tuple[Optional[str], str, str]:
    """从 config 字典解析出 ``(base_url, model_id, protocol)``。

    - ``protocol`` 默认 ``"anthropic"``；``base_url`` 默认 ``None``（用 SDK 自带端点）。
    - 显式 ``base_url`` 优先于 SDK 默认（兼容代理 / 本地模型服务）。

    Raises:
        ValueError: ``protocol`` 既非 ``"anthropic"`` 也非 ``"openai_compat"``。
    """
    base_url = config.get("base_url") or None
    model_id = config.get("model_id", "")
    protocol = config.get("protocol") or "anthropic"
    if protocol not in ("anthropic", "openai_compat"):
        raise ValueError(f"unknown protocol: {protocol}")
    return base_url, model_id, protocol
