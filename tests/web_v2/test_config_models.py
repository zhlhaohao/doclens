"""Tests for config request/response models."""
from cortex.web_v2.models.config import (
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
