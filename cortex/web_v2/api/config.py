"""GET/PUT /api/config — read/write .env for a given scope."""
import logging
import shutil
from typing import Literal

from fastapi import APIRouter, Query

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
    """Read all known .env keys for the given scope.

    Returns every key in KNOWN_KEYS; missing keys are returned as empty
    strings. ``exists`` indicates whether the .env file is on disk.
    """
    path = resolve_env_path(scope)
    values, exists = read_env_values(path, KNOWN_KEYS)
    return ConfigResponse(scope=scope, values=values, exists=exists)


@router.put("/config", response_model=ConfigSaveResult)
async def put_config(
    req: ConfigUpdateRequest,
    scope: Scope = Query(...),
):
    """Write the supplied values to the .env at the given scope.

    Values are strings; empty string deletes the key. Returns which fields
    require a cortex gui restart to take effect.
    """
    path = resolve_env_path(scope)

    # 1. Validate
    errors = validate_values(req.values)
    if errors.fields:
        raise CortexAPIError(
            status=400,
            code="VALIDATION_FAILED",
            detail=f"{len(errors.fields)} 个字段校验失败",
            extra={"fields": [f.model_dump() for f in errors.fields]},
        )

    # 2. Diff against current to compute needs_restart
    current_values, _ = read_env_values(path, KNOWN_KEYS)
    changed_fields = sorted(
        k for k, v in req.values.items()
        if (current_values.get(k, "") != v)
    )
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


@router.post("/config/copy-from-global")
async def copy_from_global():
    """Copy ~/.cortex/.env to {cwd}/.cortex/.env.

    Used by the empty-state banner in <settings-view> when the local .env
    does not exist. Returns 404 if the global .env doesn't exist either.
    """
    global_path = resolve_env_path("global")
    local_path = resolve_env_path("local")
    if not global_path.exists():
        raise CortexAPIError(404, "GLOBAL_ENV_MISSING", f"全局 .env 不存在: {global_path}")
    local_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(str(global_path), str(local_path))
    logger.info("copied global env -> %s", local_path)
    return {"ok": True, "saved_path": str(local_path)}
