"""POST/GET/PUT/DELETE /api/presets — 模型预设 CRUD + 一键切换（ADR-0009）。

切换（activate）= 把预设全部字段物化写进 global .env + 写激活预设 id 键 +
``reload_config()``。运行时照旧只读 .env（CortexConfig / planify /
vision_worker 读取链路零改动）。

视觉预设的 protocol 直接写原值（``openai_compat`` / ``anthropic``）——
``write_env_values`` 的空串语义是"删除键"，写空串会把 ``VISION_PROTOCOL``
从 .env 删掉，故不再做 openai_compat→空串转换。``vision_worker`` 对
``openai_compat`` 与空都走 OpenAI 兼容分支，行为一致。
"""
import logging

from fastapi import APIRouter

from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.config_store import resolve_env_path, write_env_values
from doclens.web_v2.models.preset import (
    ActivateResult,
    Preset,
    PresetCreate,
    PresetListResponse,
    PresetUpdate,
)
from doclens.web_v2 import presets_store

logger = logging.getLogger(__name__)
router = APIRouter()


def _materialize(preset: dict) -> dict:
    """把预设字段映射为 .env key→value（用于物化写 global .env）。"""
    kind = preset.get("kind")
    proto = preset.get("protocol", "")
    name = preset.get("name", "")
    if kind == "llm":
        updates = {
            "PLANIFY_PROTOCOL": proto,
            "PLANIFY_BASE_URL": preset.get("base_url", ""),
            "PLANIFY_API_KEY": preset.get("api_key", ""),
            "PLANIFY_MODEL_ID": preset.get("model_id", ""),
            "CORTEX_ACTIVE_LLM_PRESET": name,
        }
        if preset.get("context_window"):
            updates["PLANIFY_CONTEXT_WINDOW"] = str(preset["context_window"])
        return updates
    # vision：协议直接写原值（openai_compat / anthropic）
    return {
        "VISION_PROTOCOL": proto,
        "VISION_BASE_URL": preset.get("base_url", ""),
        "VISION_API_KEY": preset.get("api_key", ""),
        "VISION_MODEL": preset.get("model_id", ""),
        "CORTEX_ACTIVE_VISION_PRESET": name,
    }


@router.get("/presets", response_model=PresetListResponse)
async def list_presets(kind: str | None = None):
    """列出预设（可选 ?kind=llm|vision 过滤）。密钥脱敏。"""
    presets = presets_store.list_presets(kind)
    return PresetListResponse(presets=[Preset(**p) for p in presets])


@router.post("/presets", response_model=Preset, status_code=201)
async def create_preset(req: PresetCreate):
    try:
        created = presets_store.create_preset(req.model_dump())
    except presets_store.PresetError as e:
        raise CortexAPIError(409, "PRESET_CONFLICT", str(e))
    return Preset(**created)


@router.put("/presets/{preset_id}", response_model=Preset)
async def update_preset(preset_id: str, req: PresetUpdate):
    updates = req.model_dump(exclude_unset=True)
    try:
        updated = presets_store.update_preset(preset_id, updates)
    except presets_store.PresetError as e:
        msg = str(e)
        status = 404 if msg.startswith("预设不存在") else 409
        raise CortexAPIError(status, "PRESET_NOT_FOUND" if status == 404 else "PRESET_CONFLICT", msg)
    return Preset(**updated)


@router.delete("/presets/{preset_id}")
async def delete_preset(preset_id: str):
    deleted = presets_store.delete_preset(preset_id)
    if not deleted:
        raise CortexAPIError(404, "PRESET_NOT_FOUND", f"预设不存在: {preset_id}")
    return {"ok": True}


@router.post("/presets/{preset_id}/activate", response_model=ActivateResult)
async def activate_preset(preset_id: str):
    """切换预设：物化进 global .env + 写激活 id + reload_config + 清 local 残留。"""
    raw = presets_store.get_preset_raw(preset_id)
    if raw is None:
        raise CortexAPIError(404, "PRESET_NOT_FOUND", f"预设不存在: {preset_id}")

    updates = _materialize(raw)
    # local config 已禁用（store scope 恒 global）：模型配置统一写 global；
    # 并清 local .env 中对应键的残留（空串=删除），避免 local 覆盖 global 致切换失效。
    try:
        write_env_values(resolve_env_path("global"), updates)
    except PermissionError as e:
        raise CortexAPIError(403, "WRITE_FORBIDDEN", f"无法写入 global .env: {e}")
    local_path = resolve_env_path("local")
    if local_path.exists():
        try:
            write_env_values(local_path, {k: "" for k in updates})
        except PermissionError as e:
            raise CortexAPIError(403, "WRITE_FORBIDDEN", f"无法清理 local .env: {e}")

    from doclens.web_v2.deps import reload_config
    reload_config()

    masked = presets_store.get_preset(preset_id)
    note = (
        "视觉模型已切换，已解析的图像将在下次启动时自动重新解析。"
        if raw.get("kind") == "vision"
        else None
    )
    logger.info("preset activated: id=%s kind=%s name=%s", preset_id, raw.get("kind"), raw.get("name"))
    return ActivateResult(preset=Preset(**masked), note=note)
