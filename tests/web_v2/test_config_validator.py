"""Tests for config_validator: validates a values dict against CortexConfig."""
from doclens.web_v2.config_validator import validate_values, ValidationErrors


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
