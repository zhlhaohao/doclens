"""Tests for config request/response models."""
from doclens.web_v2.models.config import (
    ConfigScope,
    ConfigResponse,
    ConfigUpdateRequest,
    ConfigSaveResult,
)


def test_config_scope_values():
    assert ConfigScope.LOCAL == "local"
    assert ConfigScope.GLOBAL == "global"


def test_config_response_carries_values_and_exists_flag():
    resp = ConfigResponse(
        scope="local",
        values={"CORTEX_MAX_RESULTS": "20", "PLANIFY_API_KEY": ""},
        exists=True,
    )
    assert resp.scope == "local"
    assert resp.values["CORTEX_MAX_RESULTS"] == "20"
    assert resp.exists is True


def test_config_update_request_accepts_arbitrary_string_values():
    req = ConfigUpdateRequest(
        values={
            "CORTEX_MAX_RESULTS": "50",
            "PLANIFY_API_KEY": "sk-new",
        }
    )
    assert req.values["CORTEX_MAX_RESULTS"] == "50"


def test_config_save_result_reports_needs_restart_with_field_list():
    result = ConfigSaveResult(
        ok=True,
        saved_path="/tmp/.cortex/.env",
        needs_restart=True,
        restart_fields=["PLANIFY_API_KEY"],
    )
    assert result.needs_restart is True
    assert "PLANIFY_API_KEY" in result.restart_fields


# ---------------------------------------------------------------------------
# CortexConfig fields: planify_provider / planify_protocol (LLM Provider switching)
# ---------------------------------------------------------------------------
import pytest  # noqa: E402

from doclens.config import CortexConfig  # noqa: E402


def test_cortex_config_default_provider_is_anthropic(monkeypatch):
    # 清除可能影响测试的环境变量
    for k in ["PLANIFY_PROVIDER", "PLANIFY_PROTOCOL", "PLANIFY_API_KEY",
              "PLANIFY_BASE_URL", "PLANIFY_MODEL_ID"]:
        monkeypatch.delenv(k, raising=False)
    cfg = CortexConfig()
    assert cfg.planify_provider == "anthropic"
    assert cfg.planify_protocol is None


def test_cortex_config_provider_from_env(monkeypatch):
    monkeypatch.setenv("PLANIFY_PROVIDER", "deepseek")
    monkeypatch.setenv("PLANIFY_PROTOCOL", "openai_compat")
    cfg = CortexConfig()
    assert cfg.planify_provider == "deepseek"
    assert cfg.planify_protocol == "openai_compat"
