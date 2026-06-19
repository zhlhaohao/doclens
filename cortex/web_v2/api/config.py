"""GET/PUT /api/config — read/write .env for a given scope."""
import logging
from typing import Literal

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from cortex.web_v2.api.errors import CortexAPIError
from cortex.web_v2.config_store import (
    KNOWN_KEYS,
    read_env_values,
    resolve_env_path,
    write_env_values,
)
from cortex.web_v2.config_validator import validate_values
from cortex.web_v2.models.config import (
    ConfigResponse,
    ConfigSaveResult,
    ConfigUpdateRequest,
    RESTART_FIELDS,
)

logger = logging.getLogger(__name__)
router = APIRouter()

Scope = Literal["local", "global"]


@router.get("/config", response_model=ConfigResponse)
async def get_config(scope: Scope = Query(...)):
    try:
        path = resolve_env_path(scope)
    except ValueError as e:
        raise CortexAPIError(400, "INVALID_SCOPE", str(e))
    values, exists = read_env_values(path, KNOWN_KEYS)
    return ConfigResponse(scope=scope, values=values, exists=exists)


@router.put("/config", response_model=ConfigSaveResult)
async def put_config(
    req: ConfigUpdateRequest,
    scope: Scope = Query(...),
):
    try:
        path = resolve_env_path(scope)
    except ValueError as e:
        raise CortexAPIError(400, "INVALID_SCOPE", str(e))

    # 1. Validate
    errors = validate_values(req.values)
    if errors.fields:
        return JSONResponse(
            status_code=400,
            content={
                "code": "VALIDATION_FAILED",
                "fields": [f.model_dump() for f in errors.fields],
            },
        )

    # 2. Diff against current to compute needs_restart
    current_values, _ = read_env_values(path, KNOWN_KEYS)
    changed_fields = [
        k for k, v in req.values.items()
        if (current_values.get(k, "") != v)
    ]
    restart_fields = [f for f in changed_fields if f in RESTART_FIELDS]

    # 3. Write
    try:
        write_env_values(path, req.values)
    except PermissionError as e:
        raise CortexAPIError(403, "WRITE_FORBIDDEN", f"无法写入 {path}: {e}")

    logger.info(
        "config saved: scope=%s path=%s restart=%s", scope, path, restart_fields
    )
    return ConfigSaveResult(
        ok=True,
        saved_path=str(path),
        needs_restart=bool(restart_fields),
        restart_fields=restart_fields,
    )
