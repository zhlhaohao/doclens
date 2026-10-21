"""GET/PUT /api/config — read/write .env for a given scope."""
import logging
from typing import Literal

from fastapi import APIRouter, Query

from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.config_store import (
    KNOWN_KEYS,
    copy_env_file,
    mask_secret_values,
    read_env_values,
    reset_env_to_example,
    resolve_env_path,
    strip_unchanged_secrets,
    write_env_values,
)
from doclens.web_v2.config_validator import validate_values
from doclens.web_v2.models.config import (
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
    return ConfigResponse(scope=scope, values=mask_secret_values(values), exists=exists)


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
    # 跳过未改动的密钥占位符（前端保存时会把 GET 返回的 "***" 原样回传）
    updates = strip_unchanged_secrets(req.values)

    # 1. Validate
    errors = validate_values(updates)
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
        k for k, v in updates.items()
        if (current_values.get(k, "") != v)
    )
    restart_fields = [f for f in changed_fields if f in RESTART_FIELDS]

    # 3. Write
    try:
        write_env_values(path, updates)
    except PermissionError as e:
        raise CortexAPIError(403, "WRITE_FORBIDDEN", f"无法写入 {path}: {e}")

    # 4. Hot-reload in-memory singletons
    from doclens.web_v2.deps import reload_config
    reload_config()

    # 4.5 外部访问门禁热生效（ADR-0021）：guard 每次 os.getenv 惰性读，
    # .env 落盘不自动反映到进程环境——显式同步该键（空串 = 删除回落默认 ask）
    if "PLANIFY_OUTSIDE_WORKDIR" in updates:
        v = updates["PLANIFY_OUTSIDE_WORKDIR"].strip().lower()
        import os as _os
        if v:
            _os.environ["PLANIFY_OUTSIDE_WORKDIR"] = v
        else:
            _os.environ.pop("PLANIFY_OUTSIDE_WORKDIR", None)
        logger.info("guard mode hot-applied: %r", v or "ask(default)")
    # 4.6 长期记忆开关热生效（ADR-0042，同 4.5 模式）：memory_disabled()/
    # memory_guidance() 每次构造 agent 现读进程 env——显式同步该键；
    # "false" 是开关的「开」值，删除键与写 false 等价于启用
    if "CORTEX_MEMORY_DISABLE" in updates:
        v = updates["CORTEX_MEMORY_DISABLE"].strip().lower()
        import os as _os
        if v in ("", "false", "0", "no"):
            _os.environ.pop("CORTEX_MEMORY_DISABLE", None)
        else:
            _os.environ["CORTEX_MEMORY_DISABLE"] = v
        logger.info("memory toggle hot-applied: %r", v or "enabled(default)")

    # 4.6 对话提问模式热生效（ADR-0033）：ask 模式与门禁同理经 os.getenv
    # 惰性读（工具调用时取值）——显式同步该键
    # （空串 = 删除回落默认 interactive）
    if "PLANIFY_ASK_MODE" in updates:
        v = updates["PLANIFY_ASK_MODE"].strip().lower()
        import os as _os
        if v:
            _os.environ["PLANIFY_ASK_MODE"] = v
        else:
            _os.environ.pop("PLANIFY_ASK_MODE", None)
        logger.info("ask mode hot-applied: %r", v or "interactive(default)")

    # 4.7 shell 超时热生效：_shell_timeout() 每次工具调用现读 os.getenv
    # （bash/powershell/background_run 三通道统一）——.env 落盘不自动反映
    # 到进程环境，显式同步该键（空串 = 删除回落默认 120）
    if "PLANIFY_SHELL_TIMEOUT" in updates:
        v = updates["PLANIFY_SHELL_TIMEOUT"].strip()
        import os as _os
        if v:
            _os.environ["PLANIFY_SHELL_TIMEOUT"] = v
        else:
            _os.environ.pop("PLANIFY_SHELL_TIMEOUT", None)
        logger.info("shell timeout hot-applied: %rs", v or "120(default)")

    # 4.8 AI 轮次预算热生效（主循环软上限 + 子代理上限）：无键级手动同步——
    # 上方 reload_config() 已做两件事：① load_dotenv(override=True) 把 .env
    # 刷新进 os.environ（子代理包装闭包每次调用现读 env）；② apply_config →
    # AgentRuntime.update_llm_config 推 planify_max_tool_rounds 进
    # RuntimeConfig（chat 每请求 tool_round_limit_kwargs(runtime.config) 现读）。
    # 此处仅记日志便于观察。
    _round_keys = {"PLANIFY_MAX_TOOL_ROUNDS", "PLANIFY_MAX_SUBAGENT_ROUNDS"}
    if _round_keys & set(updates):
        logger.info(
            "round budget hot-applied: %s",
            {k: updates[k] for k in _round_keys & set(updates)},
        )

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
    """Copy global .env to {cwd} local .env (dirname follows mode: .cortex / .doclens).

    Used by the empty-state banner in <settings-view> when the local .env
    does not exist. Returns 404 if the global .env doesn't exist either.
    """
    global_path = resolve_env_path("global")
    local_path = resolve_env_path("local")
    if not global_path.exists():
        raise CortexAPIError(404, "GLOBAL_ENV_MISSING", f"全局 .env 不存在: {global_path}")
    # 走 config_store 的唯一写入口（AP-34）：进程级锁 + tmp + os.replace。
    # 直接 copyfile 会与并发保存互相截断，且绕过统一写入纪律。
    copy_env_file(global_path, local_path)
    logger.info("copied global env -> %s", local_path)
    return {"ok": True, "saved_path": str(local_path)}


@router.post("/config/reset-default", response_model=ConfigResponse)
async def reset_default(scope: Scope = Query("global")):
    """把 .env 重置为包内 .env.example 默认模板，保留用户已有的 PLANIFY_API_KEY。

    用于设置页「恢复默认」：产出带注释与默认值的规范配置（而非清空）。
    返回重置后的全部 KNOWN_KEYS 值，供前端刷新表单。
    """
    path = resolve_env_path(scope)
    try:
        reset_env_to_example(path)
    except PermissionError as e:
        raise CortexAPIError(403, "WRITE_FORBIDDEN", f"无法写入 {path}: {e}")
    from doclens.web_v2.deps import reload_config
    reload_config()
    values, exists = read_env_values(path, KNOWN_KEYS)
    logger.info("config reset to defaults: scope=%s path=%s", scope, path)
    return ConfigResponse(scope=scope, values=mask_secret_values(values), exists=exists)
