"""SessionConfig 字段迁移测试。"""
from planify.core.session import SessionConfig


def test_session_config_new_fields():
    cfg = SessionConfig(
        workdir=".",  # type: ignore[arg-type]
        model_id="claude-opus-4-6",
        api_key="sk-test",
        base_url="https://x",
        provider_name="deepseek",
        protocol="openai_compat",
    )
    assert cfg.api_key == "sk-test"
    assert cfg.provider_name == "deepseek"
    assert cfg.protocol == "openai_compat"


def test_session_config_defaults():
    cfg = SessionConfig(
        workdir=".",  # type: ignore[arg-type]
        model_id="m",
        api_key="k",
    )
    assert cfg.provider_name == "anthropic"
    assert cfg.protocol == "anthropic"
    assert cfg.base_url is None