"""套餐额度（Plan Quota）异步查询（2026-10-27）。

按预设 ``base_url`` 子串识别供应商体系（遵守 ADR-0011「预设不含
provider」），异步调各供应商额度接口，归一为两类展示数据：

- 窗口限额（Coding Plan 订阅）：5 小时窗口 + 每周窗口的已用百分比
  （GLM 国内/Z.AI、Kimi、MiniMax-general；Kimi 新会员无周窗口则省略）
- 账户余额（按量付费）：DeepSeek ``GET /user/balance``

移植自 llm-quota.py（GLM/Kimi/MiniMax 解析逻辑），改为纯异步 httpx。
密钥由调用方（/api/presets/{id}/quota 端点）从预设存储回源传入，
本模块不接触预设存储。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

TIMEOUT = 15.0


class QuotaProbeError(Exception):
    """额度查询失败（网络/HTTP/解析）。消息面向用户可读。"""


@dataclass(frozen=True)
class QuotaWindow:
    """一个窗口限额：label 如「5 小时」「每周」，percentage 为已用百分比。"""

    label: str
    percentage: float
    next_reset_ms: Optional[int] = None


@dataclass(frozen=True)
class QuotaInfo:
    """单个预设的额度查询结果。

    kind = "windows"：windows 列表非空（1~2 个窗口）
    kind = "balance"：balances 为 [(币种, 总额)]，is_available=False 表示余额不足
    kind = "none"：接口正常但无套餐额度（非订阅 key 等）
    provider = None 表示 base_url 不识别（前端据此保持静态元信息行）。
    """

    kind: str  # "windows" | "balance" | "none"
    provider: Optional[str] = None  # "glm" | "kimi" | "minimax" | "deepseek" | None
    windows: tuple[QuotaWindow, ...] = ()
    balances: tuple[tuple[str, str], ...] = ()  # (currency, total_balance)
    is_available: bool = True


@dataclass(frozen=True)
class _Endpoint:
    key: str
    provider: str  # "glm" | "kimi" | "minimax" | "deepseek"
    url: str
    auth_mode: str  # "raw"（GLM 直接放 key）/ "bearer"
    base_url_hint: str


_ENDPOINTS: tuple[_Endpoint, ...] = (
    _Endpoint(
        key="glm-cn",
        provider="glm",
        url="https://open.bigmodel.cn/api/monitor/usage/quota/limit",
        auth_mode="raw",
        base_url_hint="open.bigmodel.cn",
    ),
    _Endpoint(
        key="glm-zai",
        provider="glm",
        url="https://api.z.ai/api/monitor/usage/quota/limit",
        auth_mode="raw",
        base_url_hint="api.z.ai",
    ),
    _Endpoint(
        key="kimi",
        provider="kimi",
        url="https://api.kimi.com/coding/v1/usages",
        auth_mode="bearer",
        base_url_hint="api.kimi.com",
    ),
    _Endpoint(
        key="minimax",
        provider="minimax",
        url="https://www.minimaxi.com/v1/token_plan/remains",
        auth_mode="bearer",
        base_url_hint="minimaxi.com",
    ),
    _Endpoint(
        key="deepseek",
        provider="deepseek",
        url="https://api.deepseek.com/user/balance",
        auth_mode="bearer",
        base_url_hint="deepseek.com",
    ),
)


def detect_endpoint(base_url: str) -> Optional[_Endpoint]:
    """按 base_url 子串识别供应商端点；未知返回 None。"""
    low = (base_url or "").lower()
    for ep in _ENDPOINTS:
        if ep.base_url_hint in low:
            return ep
    return None


def supports_quota(base_url: str) -> bool:
    """该 base_url 是否有可查询的套餐额度体系。"""
    return detect_endpoint(base_url) is not None


# ---------------------------------------------------------------------------
# 解析辅助（移植自 llm-quota.py）
# ---------------------------------------------------------------------------


def _to_float(v: object) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _to_int(v: object) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        return int(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _iso_to_ms(s: object) -> Optional[int]:
    """ISO8601（如 2026-07-22T12:58:50Z）→ 毫秒时间戳。"""
    if not s or not isinstance(s, str):
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except (ValueError, TypeError):
        return None


def _window_label(duration: Optional[int], time_unit: object) -> str:
    """Kimi 窗口 (duration, timeUnit) → 可读标签。"""
    if duration is None:
        return "滚动额度"
    tu = str(time_unit or "").replace("TIME_UNIT_", "").lower()
    if tu == "minute" and duration % 60 == 0:
        return f"{duration // 60} 小时"
    if tu == "second" and duration % 3600 == 0:
        return f"{duration // 3600} 小时"
    unit_cn = {"minute": "分钟", "hour": "小时", "second": "秒", "day": "天"}.get(tu, tu)
    return f"{duration} {unit_cn}"


def _window_hours(duration: Optional[int], time_unit: object) -> Optional[float]:
    """窗口时长换算为小时（识别 5h 窗口用）。"""
    if duration is None:
        return None
    tu = str(time_unit or "").replace("TIME_UNIT_", "").lower()
    if tu == "hour":
        return float(duration)
    if tu == "minute":
        return duration / 60.0
    if tu == "second":
        return duration / 3600.0
    if tu == "day":
        return float(duration) * 24.0
    return None


# ---------------------------------------------------------------------------
# 各 provider 解析
# ---------------------------------------------------------------------------


def _parse_glm(payload: dict) -> QuotaInfo:
    """GLM Coding Plan：TOKENS_LIMIT(unit=3,number=5)=5h；(unit=6,number=1)=每周。
    TIME_LIMIT（每月 MCP）不展示（Q9 决议）。"""
    data = payload.get("data") or {}
    windows: list[QuotaWindow] = []
    for item in data.get("limits") or []:
        if not isinstance(item, dict):
            continue
        if str(item.get("type") or "") != "TOKENS_LIMIT":
            continue
        unit, number = _to_int(item.get("unit")), _to_int(item.get("number"))
        if unit == 3 and number == 5:
            label = "5 小时"
        elif unit == 6 and number == 1:
            label = "每周"
        else:
            continue
        windows.append(
            QuotaWindow(
                label=label,
                percentage=float(item.get("percentage") or 0),
                next_reset_ms=_to_int(item.get("nextResetTime")),
            )
        )
    if not windows:
        return QuotaInfo(kind="none")
    windows.sort(key=lambda w: 0 if w.label == "5 小时" else 1)
    return QuotaInfo(kind="windows", windows=tuple(windows))


def _parse_kimi(payload: dict) -> QuotaInfo:
    """Kimi Code（实验性接口）：usage=每周（老会员）；limits[]=滚动窗口。
    新会员无每周额度——按实际返回渲染，缺哪个省哪个（Q13）。"""
    windows: list[QuotaWindow] = []

    # 5h 窗口：limits[] 里按时长识别（≈5 小时）
    for item in payload.get("limits") or []:
        if not isinstance(item, dict):
            continue
        window = item.get("window") or {}
        detail = item.get("detail") or {}
        hours = _window_hours(_to_int(window.get("duration")), window.get("timeUnit"))
        if hours is None or abs(hours - 5.0) > 0.01:
            continue
        total = _to_float(detail.get("limit"))
        used = _to_float(detail.get("used"))
        pct = used / total * 100.0 if (total and used is not None) else 0.0
        windows.append(
            QuotaWindow(
                label=_window_label(_to_int(window.get("duration")), window.get("timeUnit")),
                percentage=pct,
                next_reset_ms=_iso_to_ms(detail.get("resetTime")),
            )
        )
        break  # 取第一个 5h 窗口

    # 每周额度：usage 字段（老会员；新会员无此字段/为空）
    usage = payload.get("usage")
    if isinstance(usage, dict):
        total = _to_float(usage.get("limit"))
        used = _to_float(usage.get("used"))
        if total is not None or used is not None:
            pct = used / total * 100.0 if (total and used is not None) else 0.0
            windows.append(
                QuotaWindow(
                    label="每周",
                    percentage=pct,
                    next_reset_ms=_iso_to_ms(usage.get("resetTime")),
                )
            )

    if not windows:
        return QuotaInfo(kind="none")
    return QuotaInfo(kind="windows", windows=tuple(windows))


def _parse_minimax(payload: dict) -> QuotaInfo:
    """MiniMax Token Plan：model_remains[] 按模型分组，只取 general（Q10）。
    接口给的是「剩余百分比」，转成已用。"""
    base = payload.get("base_resp") or {}
    status = base.get("status_code")
    if status not in (0, None, "0"):
        raise QuotaProbeError(f"接口报错：{base.get('status_msg') or status}")

    for item in payload.get("model_remains") or []:
        if not isinstance(item, dict):
            continue
        if str(item.get("model_name") or "") != "general":
            continue
        windows: list[QuotaWindow] = []
        pct_5h = _to_float(item.get("current_interval_remaining_percent"))
        if pct_5h is not None:
            windows.append(
                QuotaWindow(
                    label="5 小时",
                    percentage=max(0.0, 100.0 - pct_5h),
                    next_reset_ms=_to_int(item.get("end_time")),
                )
            )
        pct_w = _to_float(item.get("current_weekly_remaining_percent"))
        if pct_w is not None:
            windows.append(
                QuotaWindow(
                    label="每周",
                    percentage=max(0.0, 100.0 - pct_w),
                    next_reset_ms=_to_int(item.get("weekly_end_time")),
                )
            )
        if windows:
            return QuotaInfo(kind="windows", windows=tuple(windows))
        return QuotaInfo(kind="none")
    return QuotaInfo(kind="none")


def _parse_deepseek(payload: dict) -> QuotaInfo:
    """DeepSeek GET /user/balance：is_available + balance_infos[]。"""
    infos = payload.get("balance_infos") or []
    balances = tuple(
        (str(i.get("currency") or ""), str(i.get("total_balance") or "0"))
        for i in infos
        if isinstance(i, dict)
    )
    if not balances:
        return QuotaInfo(kind="none")
    return QuotaInfo(
        kind="balance",
        balances=balances,
        is_available=bool(payload.get("is_available", True)),
    )


_PARSERS = {
    "glm": _parse_glm,
    "kimi": _parse_kimi,
    "minimax": _parse_minimax,
    "deepseek": _parse_deepseek,
}


# ---------------------------------------------------------------------------
# 查询入口
# ---------------------------------------------------------------------------


async def fetch_quota(base_url: str, api_key: str, timeout: float = TIMEOUT) -> QuotaInfo:
    """按 base_url 识别供应商并异步查询额度。

    base_url 不识别 → QuotaInfo(kind="none")（调用方据此保持静态行）。
    网络/HTTP/解析失败 → 抛 QuotaProbeError。
    """
    endpoint = detect_endpoint(base_url)
    if endpoint is None:
        return QuotaInfo(kind="none")
    if not api_key:
        raise QuotaProbeError("预设未配置 API Key")

    auth = f"Bearer {api_key}" if endpoint.auth_mode == "bearer" else api_key
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                endpoint.url,
                headers={
                    "Authorization": auth,
                    "Accept": "application/json",
                    "User-Agent": "doclens-quota/1.0",
                },
            )
    except httpx.TimeoutException:
        raise QuotaProbeError(f"请求超时（{timeout:.0f}s）") from None
    except httpx.HTTPError as e:
        raise QuotaProbeError(f"网络请求失败：{e}") from None

    if resp.status_code == 401:
        hint = (
            "GLM 认证不带 Bearer"
            if endpoint.auth_mode == "raw"
            else "该体系需要 Bearer 认证"
        )
        raise QuotaProbeError(f"认证失败 (401，{hint})，或 Key 非该体系订阅 Key")
    if resp.status_code != 200:
        raise QuotaProbeError(f"HTTP {resp.status_code}")

    try:
        payload = resp.json()
    except ValueError:
        raise QuotaProbeError("返回内容不是合法 JSON") from None

    try:
        info = _PARSERS[endpoint.provider](payload)
    except QuotaProbeError:
        raise
    except Exception as e:  # noqa: BLE001
        raise QuotaProbeError(f"响应解析失败：{e}") from None
    return QuotaInfo(
        kind=info.kind,
        provider=endpoint.provider,
        windows=info.windows,
        balances=info.balances,
        is_available=info.is_available,
    )
