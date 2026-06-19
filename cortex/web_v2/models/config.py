"""Pydantic models for /api/config endpoints.

Values are always exchanged as strings (matching .env on-disk format).
Numeric / enum validation happens in IndexManager-backed validation on
the PUT path, not in these transport models.
"""
from typing import Optional

from pydantic import BaseModel, Field


class ConfigScope:
    """Scope constants for config read/write."""
    LOCAL = "local"
    GLOBAL = "global"


# Fields whose change requires restarting cortex gui to take effect.
# Must stay in sync with the `effect: "restart"` metadata in
# cortex/web_v2/frontend/src/views/settings-fields.ts
RESTART_FIELDS: frozenset[str] = frozenset({
    "PLANIFY_BASE_URL",
    "PLANIFY_API_KEY",
    "PLANIFY_MODEL_ID",
})


class ConfigResponse(BaseModel):
    """Response for GET /api/config?scope=..."""
    scope: str
    values: dict[str, str]        # env-var name -> current string value (may be "")
    exists: bool                  # False if the target .env file does not exist


class ConfigUpdateRequest(BaseModel):
    """Request body for PUT /api/config?scope=..."""
    values: dict[str, str] = Field(..., description="env-var name -> new string value")


class ConfigSaveResult(BaseModel):
    """Response for successful PUT."""
    ok: bool = True
    saved_path: str
    needs_restart: bool           # True if any changed field is in RESTART_FIELDS
    restart_fields: list[str]     # subset of changed fields that need restart


class ConfigValidationError(BaseModel):
    """Per-field validation error, returned with HTTP 400."""
    field: str
    error: str
