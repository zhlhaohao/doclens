"""LLM Provider 预设表与解析器。"""
from typing import Literal, TypedDict

ProtocolName = Literal["anthropic", "openai_compat"]


class PresetSpec(TypedDict):
    base_url: str | None
    protocol: ProtocolName


PROVIDER_PRESETS: dict[str, PresetSpec] = {
    "anthropic": {"base_url": None, "protocol": "anthropic"},
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "protocol": "openai_compat",
    },
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "protocol": "openai_compat",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "protocol": "openai_compat",
    },
    "glm": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4/",
        "protocol": "openai_compat",
    },
}


def resolve_provider_config(
    config: dict,
) -> tuple[str, str | None, str, str]:
    """从 config 字典解析出 (provider_name, base_url, model_id, protocol)。

    规则：
      1. provider_name 默认 "anthropic"
      2. 已知预设：未显式设置 base_url/protocol 时，使用 PROVIDER_PRESETS 默认
      3. custom 预设：必须显式提供 base_url 与 protocol
      4. 显式设置优先于预设默认

    Raises:
        ValueError: provider 未知 / custom 缺字段
    """
    provider_name = config.get("planify_provider") or "anthropic"

    if provider_name not in PROVIDER_PRESETS and provider_name != "custom":
        raise ValueError(f"unknown provider: {provider_name}")

    base_url = config.get("planify_base_url") or None
    protocol = config.get("planify_protocol") or None
    model_id = config.get("planify_model_id", "")

    if provider_name == "custom":
        if not base_url:
            raise ValueError("custom provider requires planify_base_url")
        if not protocol:
            raise ValueError("custom provider requires planify_protocol")
    else:
        preset = PROVIDER_PRESETS[provider_name]
        if not base_url:
            base_url = preset["base_url"]
        if not protocol:
            protocol = preset["protocol"]

    return provider_name, base_url, model_id, protocol  # type: ignore[return-value]