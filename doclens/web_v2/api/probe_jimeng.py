"""即梦配置测试与余额查询（/api/config/probe-jimeng、jimeng-balance）。

设置页「即梦文生图」区块：
- 测试按钮（POST probe-jimeng）：用表单当前值（未保存也可测——
  key 为 *** 占位时回退已保存值）真实调一次 Ark 生成小图，验证
  key 有效性 + 模型可用性 + 端点连通。探测图落数据目录 tmp（不进知识库、
  不写元数据——测试产物非知识）。
- 余额显示（GET jimeng-balance，2026-10-28 增补）：火山方舟无 Bearer
  查余额接口，账户余额走费用中心 QueryBalanceAcct（火山引擎 V4 签名，
  需 Access Key / Secret Key——与推理 Bearer Key 是两套凭证）。密钥
  从全局 .env 回源，不出后端。
"""
from __future__ import annotations

import logging
import time

from pydantic import BaseModel

from fastapi import APIRouter

from doclens.jimeng.client import JimengError, call_ark_generations
from doclens.web_v2.api.errors import CortexAPIError
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


# ---------------------------------------------------------------------------
# 余额查询（GET /api/config/jimeng-balance）
# ---------------------------------------------------------------------------


class JimengBalanceResult(BaseModel):
    """GET /api/config/jimeng-balance 响应。

    kind = "balance"：balances 有效（元，人民币）
    kind = "no_credentials"：未配置 AK/SK（前端显示配置引导）
    查询失败 → 502 BALANCE_FAILED（前端显示可重试）。
    """

    kind: str  # "balance" | "no_credentials"
    available: float | None = None
    cash: float | None = None
    credit_limit: float | None = None
    frozen: float | None = None
    arrears: float | None = None


@router.get("/config/jimeng-balance", response_model=JimengBalanceResult)
async def jimeng_balance():
    """查询火山引擎账户余额（费用中心 QueryBalanceAcct，V4 签名）。

    火山方舟无 Bearer 查余额接口——余额在费用中心，需要 Access Key /
    Secret Key（JIMENG_ACCESS_KEY / JIMENG_SECRET_KEY，全局 .env），
    与推理用的 Bearer API Key 是两套凭证。密钥不出后端。
    """
    from doclens.jimeng.ark_balance import ArkBalanceError, fetch_ark_balance

    path = resolve_env_path("global")
    saved, _ = read_env_values(
        path, {"JIMENG_ACCESS_KEY", "JIMENG_SECRET_KEY"}
    )
    ak = (saved.get("JIMENG_ACCESS_KEY") or "").strip()
    sk = (saved.get("JIMENG_SECRET_KEY") or "").strip()
    if not ak or not sk:
        return JimengBalanceResult(kind="no_credentials")

    try:
        bal = await fetch_ark_balance(ak, sk)
    except ArkBalanceError as e:
        logger.info("jimeng-balance failed: %s", e)
        raise CortexAPIError(502, "BALANCE_FAILED", str(e))
    return JimengBalanceResult(
        kind="balance",
        available=bal.available,
        cash=bal.cash,
        credit_limit=bal.credit_limit,
        frozen=bal.frozen,
        arrears=bal.arrears,
    )
