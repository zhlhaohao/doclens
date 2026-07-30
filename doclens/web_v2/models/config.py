"""Pydantic models for /api/config endpoints.

Values are always exchanged as strings (matching .env on-disk format).
Numeric / enum validation happens in IndexManager-backed validation on
the PUT path, not in these transport models.
"""
from pydantic import BaseModel, Field


class ConfigScope:
    """Scope constants for config read/write."""
    LOCAL = "local"
    GLOBAL = "global"


# 改动后需重启 cortex gui 才生效的字段（host/port 在 uvicorn/MCP 启动时绑定，
# 无法 hot-reload）。需与 settings-fields.ts 的 effect:"restart" 保持一致。
RESTART_FIELDS: frozenset[str] = frozenset({
    "CORTEX_WEB_HOST", "CORTEX_WEB_PORT", "CORTEX_MCP_ENABLED", "CORTEX_MCP_HOST", "CORTEX_MCP_PORT",
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
