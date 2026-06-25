"""Validate a {env_var: value} dict against the CortexConfig schema.

We construct a CortexConfig with the supplied values (via env injection) and
catch pydantic ValidationError, mapping each error to (field, message).
Unknown keys are reported separately.
"""
from __future__ import annotations

import os

from pydantic import ValidationError

from doclens.config import CortexConfig
from doclens.web_v2.config_store import KNOWN_KEYS
from doclens.web_v2.models.config import ConfigValidationError


# Build mapping from pydantic field names to env var names
# This is needed because pydantic ValidationError uses field names,
# but our API uses env var names (e.g., "max_results" vs "CORTEX_MAX_RESULTS")
_FIELD_TO_ENV: dict[str, str] = {}
for field_name, field_info in CortexConfig.model_fields.items():
    # Use alias if available, otherwise construct from env_prefix
    if hasattr(field_info, 'alias') and field_info.alias:
        env_name = field_info.alias
    else:
        env_name = f"CORTEX_{field_name.upper()}"
    _FIELD_TO_ENV[field_name] = env_name


class ValidationErrors(Exception):
    """Aggregated per-field validation errors."""

    def __init__(self, fields: list[ConfigValidationError]) -> None:
        self.fields = fields
        super().__init__("; ".join(f"{f.field}: {f.error}" for f in fields))


def validate_values(values: dict[str, str]) -> ValidationErrors:
    """Return ValidationErrors (possibly empty) for the given values dict.

    Two sources of error:
    1. Unknown key (not in KNOWN_KEYS)
    2. pydantic ValidationError when constructing CortexConfig with these values
       (covers type mismatches like non-numeric strings for int fields)
    """
    errors: list[ConfigValidationError] = []

    # 1. Unknown keys
    for key in values:
        if key not in KNOWN_KEYS:
            errors.append(ConfigValidationError(
                field=key,
                error=f"未知的配置项: {key}",
            ))

    # 2. Type validation via CortexConfig
    # CortexConfig uses env_prefix="CORTEX_" and several aliases (PLANIFY_*,
    # TREESEARCH_*). The cleanest cross-cutting validation is to construct it
    # inside a modified environment.
    env_backup = dict(os.environ)
    try:
        # Clear our known keys from env first so only `values` apply
        for key in KNOWN_KEYS:
            os.environ.pop(key, None)
        for key, value in values.items():
            if key in KNOWN_KEYS:
                os.environ[key] = value
        try:
            CortexConfig(_env_file=None)
        except ValidationError as ve:
            for err in ve.errors():
                # err["loc"] is a tuple like ("max_results",) or ("planify_api_key",)
                # We map it back to env var name for user-facing errors
                loc_parts = err.get("loc", ())
                if loc_parts:
                    field_name = str(loc_parts[0])  # First part is the field name
                    # Map to env var name
                    env_name = _FIELD_TO_ENV.get(field_name, field_name)
                    msg = err.get("msg", "invalid")
                    errors.append(ConfigValidationError(field=env_name, error=msg))
    finally:
        # Restore env
        os.environ.clear()
        os.environ.update(env_backup)

    return ValidationErrors(fields=errors)
