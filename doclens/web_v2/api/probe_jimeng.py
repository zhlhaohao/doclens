"""即梦配置测试（/api/config/probe-jimeng，2026-10-28 增补）。

设置页「即梦文生图」区块的测试按钮：用表单当前值（未保存也可测——
key 为 *** 占位时回退已保存值）真实调一次 Ark 生成小图，验证
key 有效性 + 模型可用性 + 端点连通。探测图落数据目录 tmp（不进知识库、
不写元数据——测试产物非知识）。
"""
from __future__ import annotations

import logging
import time

from pydantic import BaseModel

from fastapi import APIRouter

from doclens.jimeng.client import JimengError, call_ark_generations
from doclens.web_v2.config_store import read_env_values, resolve_env_path

logger = logging.getLogger(__name__)


class ProbeJimengRequest(BaseModel):
    """POST /api/config/probe-jimeng 请求体。

    api_key 为空或 *** 时回退全局 .env 已保存值（探测未保存的表单值
    属于常见需求；占位符 = 用户未改动密钥字段）。
    """

    api_key: str = ""
    model: str = ""


class ProbeJimengResult(BaseModel):
    ok: bool
    message: str
    model: str


router = APIRouter()

# 探测提示词：便宜快速的连通性验证（1 张小图）
# size 用 2K 档位：Seedream 4.0 的像素下限 1280x720（921600 像素），
# 旧式小尺寸（如 512x512）会 400 InvalidParameter
_PROBE_PROMPT = "一张简单的蓝色圆形图标，纯色背景，正方形构图"
_PROBE_SIZE = "2K"


@router.post("/config/probe-jimeng", response_model=ProbeJimengResult)
async def probe_jimeng(req: ProbeJimengRequest):
    # 密钥解析：表单值（非占位）> 已保存全局 .env > 报未配置
    api_key = (req.api_key or "").strip()
    model = (req.model or "").strip() or "doubao-seedream-4-0"
    if not api_key or api_key == "***":
        path = resolve_env_path("global")
        saved, _ = read_env_values(path, {"JIMENG_API_KEY", "JIMENG_MODEL"})
        api_key = (saved.get("JIMENG_API_KEY") or "").strip()
        if not model or model == "doubao-seedream-4-0":
            model = (saved.get("JIMENG_MODEL") or "").strip() or model

    if not api_key:
        return ProbeJimengResult(
            ok=False, message="未配置 API Key（请先填写或保存）", model=model
        )

    started = time.time()
    try:
        urls = call_ark_generations(
            api_key,
            _PROBE_PROMPT,
            model,
            size=_PROBE_SIZE,
            timeout=60.0,
        )
    except JimengError as e:
        logger.info("probe-jimeng failed: model=%s err=%s", model, e)
        return ProbeJimengResult(ok=False, message=str(e), model=model)

    elapsed = time.time() - started
    # 连通即成功：不下载落盘（探测产物非知识；下载属生成链路，e2e 已覆盖）
    return ProbeJimengResult(
        ok=True,
        message=f"生成成功（{len(urls)} 张，耗时 {elapsed:.1f}s）",
        model=model,
    )
