"""Tests for config_validator: validates a values dict against CortexConfig."""
import pytest

from doclens.web_v2.config_validator import validate_values, ValidationErrors


def _ok(**overrides):
    base = {
        "PLANIFY_API_KEY": "sk-test",
        "PLANIFY_BASE_URL": "https://api.example.com",
        "PLANIFY_MODEL_ID": "claude-opus-4-6",
        "PLANIFY_PROVIDER": "anthropic",
        "PLANIFY_PROTOCOL": "anthropic",
    }
    base.update(overrides)
    return base


def test_validate_accepts_known_good_values():
    errors = validate_values({
        "CORTEX_MAX_RESULTS": "20",
        "CORTEX_WEIGHT_KEYWORD_MATCH": "3.0",
        "PLANIFY_API_KEY": "sk-test",
    })
    assert errors.fields == []


def test_validate_rejects_non_numeric_for_int_field():
    errors = validate_values({"CORTEX_MAX_RESULTS": "not-a-number"})
    assert any("CORTEX_MAX_RESULTS" in f.field for f in errors.fields)


def test_validate_rejects_value_out_of_range_implied_by_pydantic():
    """Pydantic itself doesn't enforce range; this test only verifies that
    a type mismatch (float string for int) is caught."""
    errors = validate_values({"CORTEX_MAX_RESULTS": "3.5"})
    assert any("CORTEX_MAX_RESULTS" in f.field for f in errors.fields)


def test_validate_collects_multiple_errors():
    errors = validate_values({
        "CORTEX_MAX_RESULTS": "abc",
        "CORTEX_MIN_PROXIMITY_SCORE": "not-int",
        "UNKNOWN_KEY": "x",
    })
    assert len(errors.fields) >= 3


def test_validate_rejects_unknown_key():
    errors = validate_values({"SOMETHING_UNEXPECTED": "x"})
    assert any("SOMETHING_UNEXPECTED" in f.field for f in errors.fields)


def test_validate_skips_empty_string_for_optional_number_field():
    """空字符串 = 删除/未设置（write_env_values 的 unset_key 语义），
    不应被当作无效 number 校验失败。

    回归：global .env 里未填的可选 weight 字段（FILE_NAME_MATCH 等）会被
    getConfig 返回为 ""，保存时全部发送，validator 把 "" 解析为 number
    失败 → 全局配置保存报「4 个字段校验失败」。
    """
    errors = validate_values({
        "CORTEX_WEIGHT_FILE_NAME_MATCH": "",
        "CORTEX_WEIGHT_FTS_SCORE": "",
        "CORTEX_WEIGHT_TITLE_MATCH": "",
        "CORTEX_WEIGHT_PROXIMITY_MATCH": "",
        "CORTEX_WEIGHT_KEYWORD_MATCH": "0.5",  # 有值，正常校验
    })
    assert errors.fields == []


def test_anthropic_provider_minimal_ok():
    """anthropic + base_url 空 + protocol=anthropic 应通过（用 SDK 默认）。"""
    values = _ok()
    del values["PLANIFY_BASE_URL"]
    values["PLANIFY_BASE_URL"] = ""
    errors = validate_values(values)
    assert errors.fields == []


def test_known_preset_openai_compat_ok():
    """已知预设 + openai_compat + base_url https 应通过。"""
    values = _ok(
        PLANIFY_PROVIDER="deepseek",
        PLANIFY_PROTOCOL="openai_compat",
        PLANIFY_BASE_URL="https://api.deepseek.com/v1",
    )
    errors = validate_values(values)
    assert errors.fields == []


def test_custom_requires_base_url():
    """provider=custom 但 base_url 空应失败。"""
    values = _ok(
        PLANIFY_PROVIDER="custom",
        PLANIFY_PROTOCOL="openai_compat",
        PLANIFY_BASE_URL="",
    )
    errors = validate_values(values)
    field_names = [f.field for f in errors.fields]
    assert "PLANIFY_BASE_URL" in field_names


def test_custom_requires_protocol():
    """provider=custom 但 protocol 空应失败。"""
    values = _ok(
        PLANIFY_PROVIDER="custom",
        PLANIFY_PROTOCOL="",
        PLANIFY_BASE_URL="https://x/v1",
    )
    errors = validate_values(values)
    field_names = [f.field for f in errors.fields]
    assert "PLANIFY_PROTOCOL" in field_names


def test_openai_compat_requires_http_url():
    """protocol=openai_compat 但 base_url 不是 http(s) 应失败。"""
    values = _ok(
        PLANIFY_PROVIDER="custom",
        PLANIFY_PROTOCOL="openai_compat",
        PLANIFY_BASE_URL="ftp://x/v1",
    )
    errors = validate_values(values)
    field_names = [f.field for f in errors.fields]
    assert "PLANIFY_BASE_URL" in field_names


def test_unknown_provider_rejected():
    """未知 provider 名应失败。"""
    values = _ok(PLANIFY_PROVIDER="bogus-provider")
    errors = validate_values(values)
    field_names = [f.field for f in errors.fields]
    assert "PLANIFY_PROVIDER" in field_names
