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
    PRESET_SECRET_MASK,
    ActivateResult,
    Preset,
    PresetCreate,
    PresetListResponse,
    PresetUpdate,
    ProbeMaxTokensRequest,
    ProbeMaxTokensResult,
    ProbeVisionResult,
    ProbeTranslateRequest,
    ProbeTranslateResult,
)
from doclens.web_v2 import presets_store
from doclens.web_v2.probe_max_tokens import ProbeError, probe_max_tokens

logger = logging.getLogger(__name__)
router = APIRouter()

# 搜索预设字段 → .env 键映射（物化 kind=search 时用；None 字段跳过）
_SEARCH_FIELD_MAP: dict[str, str] = {
    "max_results": "CORTEX_MAX_RESULTS",
    "min_score_threshold": "CORTEX_MIN_SCORE_THRESHOLD",
    "max_span": "CORTEX_MAX_SPAN",
    "search_context_before": "CORTEX_SEARCH_CONTEXT_BEFORE",
    "search_context_after": "CORTEX_SEARCH_CONTEXT_AFTER",
    "weight_keyword_match": "CORTEX_WEIGHT_KEYWORD_MATCH",
    "weight_file_name_match": "CORTEX_WEIGHT_FILE_NAME_MATCH",
    "weight_fts_score": "CORTEX_WEIGHT_FTS_SCORE",
    "weight_title_match": "CORTEX_WEIGHT_TITLE_MATCH",
    "weight_proximity_match": "CORTEX_WEIGHT_PROXIMITY_MATCH",
}


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
            # vision 能力位（ADR-0034）：显式物化（含 False——未声明/False 都
            # 视为不支持）；预设删除该字段时留旧值无害（下次激活会覆盖）
            "CORTEX_LLM_VISION": "true" if preset.get("vision") else "false",
        }
        if preset.get("context_window"):
            updates["PLANIFY_CONTEXT_WINDOW"] = str(preset["context_window"])
        if preset.get("max_tokens"):
            updates["PLANIFY_MAX_TOKENS"] = str(preset["max_tokens"])
        return updates
    if kind == "search":
        updates = {"CORTEX_ACTIVE_SEARCH_PRESET": name}
        for src, dst in _SEARCH_FIELD_MAP.items():
            v = preset.get(src)
            if v is not None:
                updates[dst] = str(v)
        return updates
    if kind == "translate":
        # ADR-0039：翻译预设物化——激活键 + 服务/模型/envs JSON。
        # envs 含密钥写 .env（与 LLM 预设的 PLANIFY_API_KEY 同纪律）；
        # 翻译服务运行时读激活预设（translate_service._preset），不走 .env
        # 逐键展开（envs 键名随服务而异，逐键物化会产生未知数量的键）。
        import json as _json

        updates = {
            "CORTEX_ACTIVE_TRANSLATE_PRESET": name,
            "CORTEX_TRANSLATE_SERVICE": preset.get("translate_service") or "google",
            "CORTEX_TRANSLATE_MODEL": preset.get("model_id") or "",
            "CORTEX_TRANSLATE_ENVS": _json.dumps(
                preset.get("translate_envs") or {}, ensure_ascii=False
            ),
        }
        if preset.get("lang_default_out"):
            updates["CORTEX_TRANSLATE_LANG_OUT"] = str(preset["lang_default_out"])
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


@router.post("/presets/probe-max-tokens", response_model=ProbeMaxTokensResult)
def probe_max_tokens_endpoint(req: ProbeMaxTokensRequest):
    """二分探测服务端允许的 max_tokens 上限（同步函数 → FastAPI 线程池执行）。

    api_key 留空或传脱敏占位符时，从 preset_id 对应的预设取已存密钥。
    """
    api_key = req.api_key
    if not api_key or api_key == PRESET_SECRET_MASK:
        if not req.preset_id:
            raise CortexAPIError(400, "PROBE_KEY_REQUIRED", "未提供 API Key；编辑既有预设时请传 preset_id")
        raw = presets_store.get_preset_raw(req.preset_id)
        if raw is None:
            raise CortexAPIError(404, "PRESET_NOT_FOUND", f"预设不存在: {req.preset_id}")
        api_key = raw.get("api_key", "")
    try:
        answer, attempts = probe_max_tokens(
            req.protocol, req.base_url, req.model_id, api_key
        )
    except ProbeError as e:
        raise CortexAPIError(502, "PROBE_FAILED", str(e))
    return ProbeMaxTokensResult(max_tokens=answer, attempts=attempts)


@router.post("/presets/probe-vision", response_model=ProbeVisionResult)
def probe_vision_endpoint(req: ProbeMaxTokensRequest):
    """行为学探测模型是否支持视觉（ADR-0034 增补；同步函数 → 线程池执行）。

    请求体复用 ProbeMaxTokensRequest 形态；api_key 留空/占位时回退
    preset_id 已存密钥。supported = True 支持（模型读出图中密码串）/
    False 不支持（API 报错或静默吞图——按报错判定测不出的关键类）。
    """
    from doclens.web_v2.probe_vision import ProbeError as VisionProbeError, probe_vision

    api_key = req.api_key
    if not api_key or api_key == PRESET_SECRET_MASK:
        if not req.preset_id:
            raise CortexAPIError(400, "PROBE_KEY_REQUIRED", "未提供 API Key；编辑既有预设时请传 preset_id")
        raw = presets_store.get_preset_raw(req.preset_id)
        if raw is None:
            raise CortexAPIError(404, "PRESET_NOT_FOUND", f"预设不存在: {req.preset_id}")
        api_key = raw.get("api_key", "")
    try:
        supported = probe_vision(req.protocol, req.base_url, req.model_id, api_key)
    except VisionProbeError as e:
        raise CortexAPIError(502, "PROBE_FAILED", str(e))
    return ProbeVisionResult(supported=supported)


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


@router.post("/presets/probe-translate", response_model=ProbeTranslateResult)
def probe_translate_endpoint(req: ProbeTranslateRequest):
    """翻译服务连通性探测（ADR-0039）：当前表单服务 + envs 翻一句固定文本。

    envs 值为 ***（脱敏占位）时回退 preset_id 已存值（编辑既有预设场景）；
    成功返回示例译文，失败（网络/密钥/服务不可用）走 502 PROBE_FAILED。
    """
    envs = dict(req.envs or {})
    if req.preset_id:
        raw = presets_store.get_preset_raw(req.preset_id)
        if raw is None:
            raise CortexAPIError(404, "PRESET_NOT_FOUND", f"预设不存在: {req.preset_id}")
        stored = raw.get("translate_envs") or {}
        for k, v in list(envs.items()):
            if not v or v == PRESET_SECRET_MASK:
                if k in stored:
                    envs[k] = stored[k]
                else:
                    envs.pop(k, None)
        # 表单未带出的键也一并注入（服务需要而表单没填的默认键走类默认）
        for k, v in stored.items():
            envs.setdefault(k, v)

    def _probe() -> str:
        # 翻译缓存 DB 惰性初始化（与 translate_service._ensure_engine 同一
        # 落位：<workdir>/.cortex/translate_cache.db）
        from doclens.config import data_dirname
        from doclens.vendor_pdf2zh.cache import init_db
        import os as _os

        init_db(_os.path.join(_os.getcwd(), data_dirname(), "translate_cache.db"))

        from doclens.vendor_pdf2zh.translator import BaseTranslator

        # 递归收集全部子类（OpenAI 族是孙类——继承 OpenAITranslator）
        def _all_subclasses(cls):
            for sub in cls.__subclasses__():
                yield sub
                yield from _all_subclasses(sub)

        for translator_cls in _all_subclasses(BaseTranslator):
            if translator_cls.name == req.translate_service:
                t = translator_cls("en", "zh", None, envs=envs)
                return t.translate("Hello, this is a connectivity test.")
        raise CortexAPIError(400, "BAD_SERVICE", f"未知的翻译服务: {req.translate_service}")

    try:
        # def 端点 → FastAPI 线程池执行；探测文本极短，正常几秒内返回
        translation = _probe()
        return ProbeTranslateResult(translation=translation, service=req.translate_service)
    except CortexAPIError:
        raise
    except Exception as e:  # noqa: BLE001
        raise CortexAPIError(502, "PROBE_FAILED", f"探测失败: {e}")
