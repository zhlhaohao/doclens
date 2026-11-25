# -*- coding: utf-8 -*-
"""上游 LLM 错误分类与用户可见文案脱敏（2026-11-18）。

事故形态（``.doclens/logs/debug_20261118.log``，2026-11-18 13:05:29）：
MiniMax ``/anthropic`` 端点在 **SSE 流中**下发 error 事件，body 为::

    {"type": "error", "error": {"type": "api_error",
                                "message": "unknown error, 715 (1000)"}}

anthropic SDK 走 ``_streaming.py`` 的 SSE error 分支抛 ``APIStatusError``，
但 HTTP 状态是 **200**（流已开）——于是
``planify.streaming.runner.is_retryable_llm_error`` 的两条判据
（异常类名白名单 + ``status_code ∈ [500,600)``）**全不命中** →
``retryable=False`` → 主代理一次都不重试，整轮直接报废。

本模块提供两件事：

1. :func:`is_retryable_upstream_error` —— 识别「上游瞬时抖动」，让主代理
   走既有的退避重试路径（``runner._stream_llm_call``）；
2. :func:`friendly_upstream_error` —— 把上游原文（英文占位符 + 网关码 +
   业务码）换成用户可读文案；原始细节只进日志（``logger.exception``），
   不再透传到转录气泡（MiniMax 官方客户端 issue #420 同款问题）。

**provider 分表（2026-11-18 复核补）**：数字业务码各家**同号不同义**——
GLM ``1000`` = 身份验证失败（不可重试），MiniMax ``1000`` = 未知错误（可重试）。
所以业务码表必须按 provider 隔离：

- :data:`PROVIDER_MINIMAX` / :data:`PROVIDER_GLM` / :data:`PROVIDER_DEEPSEEK`
  / :data:`PROVIDER_KIMI` / :data:`PROVIDER_GENERIC`（未识别，保守兜底）；
- 识别依据：调用方传入的 ``base_url`` / ``model``（
  ``planify/core/llm/provider_context.py``）；
- 业务码只在**已识别的 provider** 下查表；未识别时**不抠 message 里的
  括号数字当业务码**（防普通中文消息 ``(1234)`` 被误判）；
- ``error.type`` 层面的判定（``rate_limit_error`` / ``engine_overloaded_error``
  / ``server_error`` …）跨 provider 通用，不依赖业务码。
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# provider 标识
# ---------------------------------------------------------------------------

PROVIDER_MINIMAX = "minimax"
PROVIDER_GLM = "glm"
PROVIDER_DEEPSEEK = "deepseek"
PROVIDER_KIMI = "kimi"
PROVIDER_GENERIC = "generic"

# ---------------------------------------------------------------------------
# 各家业务码表（官方文档，2026-11-18 采集）
# ---------------------------------------------------------------------------

#: MiniMax（https://platform.minimax.io/docs/api-reference/errorcode）
#: 业务码形态：message 里嵌 ``(1000)`` 括号，或 body.error.code
_MINIMAX_RETRYABLE = frozenset(
    {
        1000,  # unknown error / 系统默认错误
        1001,  # 请求超时
        1002,  # 频率超限
        1024,  # internal error
        1033,  # 系统错误 / mysql failed
        2064,  # 集群高负载
        2066,  # 处理超时
    }
)
#: 额度耗尽业务码（余额不足 / 用量超限 / 套餐不支持）——由兜底切换接手。
_MINIMAX_QUOTA_EXHAUSTED = frozenset(
    {
        1008,  # 余额不足
        2053,  # 额度不足
        2056,  # 用量超限（等 5 小时窗口）
        2061,  # 套餐不支持该模型
        2067,  # 用量超限且未开自动扣费
        2068,  # 套餐不支持该模型
    }
)
_MINIMAX_NON_RETRYABLE = frozenset(
    {
        1004,  # 未授权 / token 不匹配
        1026,  # 输入内容涉敏
        1027,  # 输出内容涉敏
        1039,  # token 限制
        1041,  # 连接数限制
        1042,  # 非法字符超限
        2013,  # 参数错误
        2022,  # 模型不存在
        2049,  # 无效 API Key
        2069,  # 模型已下线
    }
)

#: GLM / 智谱（https://docs.bigmodel.cn/cn/faq/api-code）
#: 业务码形态：body.error.code 为**字符串**（"1001" / "1308"…）。
#: 与 MiniMax 同号不同义：GLM 1000=身份验证失败（不可重试）。
_GLM_RETRYABLE = frozenset(
    {
        1200,  # API 调用失败（500）
        1230,  # API 调用流程出错（500）
        1234,  # 网络错误（500）
        1302,  # 速率限制（429）
        1305,  # 该模型当前访问量过大（429）
        # 1308/1310/1316-1321（5h/周使用上限）已移出重试表——归「额度耗尽」
        # （见 _GLM_QUOTA_EXHAUSTED）：窗口重置前重试无用，退避空转只会
        # 推迟兜底切换（ADR-0061）。
    }
)
#: 额度耗尽业务码：套餐窗口上限 / 余额不足——窗口重置前重试无用。
#: 这些码同时不属于「瞬时」也不属于「配置错误」：由兜底切换接手。
_GLM_QUOTA_EXHAUSTED = frozenset(
    {
        1113,  # 账户欠费（429）
        1308,  # 使用上限，限额将重置（429）
        1310,  # 每周/每月使用上限，限额将重置（429）
        1316,  # 5 小时上限，主账号余额不足（429）
        1317,  # 7 天上限，主账号余额不足（429）
        1318,  # 5 小时上限 + 子账号月上限（429）
        1319,  # 7 天上限 + 子账号月上限（429）
        1320,  # 5 小时上限 + 企业级月上限（429）
        1321,  # 7 天时上限 + 企业级月上限（429）
    }
)
_GLM_NON_RETRYABLE = frozenset(
    {
        1000,  # 身份验证失败（401）
        1001,  # Header 未收到 Authentication（401）
        1003,  # Authentication Token 过期（401）
        1005,  # 需要二次认证（401）
        1210,  # 参数有误（400）
        1211,  # 模型不存在（400）
        1212,  # 当前模型不支持该调用方式（400）
        1213,  # 未正常接收到参数（400）
        1214,  # 参数非法（400）
        1215,  # 两参数不能同时设置（400）
        1220,  # 无权访问该 API（403）
        1221,  # API 已下线（400）
        1222,  # API 不存在（400）
        1261,  # Prompt 超长（400）
        1301,  # 内容不安全 / 敏感（400）
        1309,  # GLM Coding Plan 套餐到期（429）
        1311,  # 订阅套餐未开放该模型（429）
        1313,  # 不符合公平使用策略被限（429）
        1314,  # 企业套餐失效（429）
        1315,  # API Key 限企业编程套餐场景（429）
    }
)

#: DeepSeek / Kimi：无独立数字业务码——走 HTTP 状态码 + error.type。
#: 这两家**不查业务码表**（空表 + 不从 message 抠括号数字）。

_PROVIDER_TABLES: Dict[str, Dict[str, frozenset]] = {
    PROVIDER_MINIMAX: {
        "retryable": _MINIMAX_RETRYABLE,
        "quota_exhausted": _MINIMAX_QUOTA_EXHAUSTED,
        "non_retryable": _MINIMAX_NON_RETRYABLE,
    },
    PROVIDER_GLM: {
        "retryable": _GLM_RETRYABLE,
        "quota_exhausted": _GLM_QUOTA_EXHAUSTED,
        "non_retryable": _GLM_NON_RETRYABLE,
    },
    PROVIDER_DEEPSEEK: {
        "retryable": frozenset(),
        "quota_exhausted": frozenset(),
        "non_retryable": frozenset(),
    },
    PROVIDER_KIMI: {
        "retryable": frozenset(),
        "quota_exhausted": frozenset(),
        "non_retryable": frozenset(),
    },
    PROVIDER_GENERIC: {
        "retryable": frozenset(),
        "quota_exhausted": frozenset(),
        "non_retryable": frozenset(),
    },
}

#: 额度耗尽 error.type（跨 provider 通用）：套餐窗口上限 / 余额不足。
QUOTA_EXHAUSTED_ERROR_TYPES = frozenset(
    {
        "exceeded_current_quota_error",  # Kimi / OpenAI
        "insufficient_quota",  # OpenAI
        "insufficient_user_quota",  # 部分网关
        "quota_exceeded",  # 部分网关
        "insufficient_balance",  # 部分网关（MiniMax anthropic 端点曾见）
        "credit_error",  # 部分网关
    }
)

#: 哪些 provider 允许从 message 里抠 ``(1000)`` 括号数字当业务码
#: （MiniMax 独有写法；其它家的 message 里括号数字是普通文本，不能当码）。
_PROVIDERS_WITH_PAREN_CODE = frozenset({PROVIDER_MINIMAX})

# ---------------------------------------------------------------------------
# error.type 判定（跨 provider 通用）
# ---------------------------------------------------------------------------

#: 瞬时故障 error.type（重试能解决）。
#: 覆盖：anthropic / openai 兼容网关的具体限流与服务端类型。
RETRYABLE_ERROR_TYPES = frozenset(
    {
        "overloaded_error",
        "timeout_error",
        "server_error",
        "internal_server_error",
        "service_unavailable",
        "rate_limit_error",
        "rate_limit",
        "rate_limit_exceeded",
        # Kimi / Moonshot（https://platform.kimi.com/docs/api/errors）
        "engine_overloaded_error",
        "rate_limit_reached_error",
        "server_unavailable",
    }
)

#: 笼统 type ``api_error``：**只在 HTTP 200 时算瞬时**。
#:
#: 理由：``api_error`` 是占位符，GLM 402 欠费 / 401 鉴权也用它——放进
#: 瞬时表会把「重试无用」的 4xx 误判为可重试。但 HTTP **200** 意味着
#: 请求已被接受、错误发生在**流中途**（MiniMax 事故形态：200 OK 后
#: SSE 下发 error 事件），此时属服务端故障，重试合理。
STREAM_MIDWAY_ERROR_TYPES = frozenset({"api_error"})

#: 不可重试 error.type（重试无用——鉴权 / 参数 / 额度 / 内容审查）。
NON_RETRYABLE_ERROR_TYPES = frozenset(
    {
        "authentication_error",
        "invalid_request_error",
        "invalid_authentication_error",
        "incorrect_api_key_error",
        "permission_denied_error",
        "resource_not_found_error",
        "content_filter",
        "exceeded_current_quota_error",
        "client_closed_request",
    }
)

#: MiniMax 业务码写法：``unknown error, 715 (1000)`` → 1000
_BUSINESS_CODE_RE = re.compile(r"\((\d{3,4})\)")

#: 用户可见文案（不含任何原始错误码/英文占位符）
FRIENDLY_UPSTREAM_ERROR = "模型服务暂时不可用，请稍后重试。"
#: 额度耗尽的用户可见文案（ADR-0061）：不是「稍后重试」能解决的
FRIENDLY_QUOTA_EXHAUSTED_ERROR = "模型套餐额度已用完（5 小时 / 每周上限或余额不足）。"


# ---------------------------------------------------------------------------
# provider 识别
# ---------------------------------------------------------------------------


def detect_provider(
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """按 base_url / model 推断 provider（用于选业务码表）。

    未识别返回 :data:`PROVIDER_GENERIC`（保守：不查业务码表，只走
    error.type / HTTP 状态码）。
    """
    u = (base_url or "").lower()
    m = (model or "").lower()
    if (
        any(k in u for k in ("minimaxi.com", "minimax.cn", "minimax.io", "minimax.chat"))
        or "minimax" in m
    ):
        return PROVIDER_MINIMAX
    if any(k in u for k in ("bigmodel.cn", "zhipu")) or m.startswith("glm"):
        return PROVIDER_GLM
    if "deepseek" in u or "deepseek" in m:
        return PROVIDER_DEEPSEEK
    if any(k in u for k in ("moonshot.cn", "moonshot.ai", "kimi.com", "kimi.ai")) or "kimi" in m:
        return PROVIDER_KIMI
    return PROVIDER_GENERIC


# ---------------------------------------------------------------------------
# 错误信息抽取
# ---------------------------------------------------------------------------


def _body_dict(exc: BaseException) -> Dict[str, Any]:
    """异常携带的响应 body（dict 或 JSON 字符串）→ dict；取不到返回 {}。"""
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        return body
    if isinstance(body, (bytes, bytearray)):
        try:
            body = body.decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            return {}
    if isinstance(body, str) and body.strip():
        try:
            parsed = json.loads(body)
        except Exception:  # noqa: BLE001
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _coerce_code(value: Any) -> Optional[int]:
    """业务码统一成 int（GLM 是字符串 "1308"，MiniMax 可能是 int）。"""
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        s = value.strip()
        if s.isdigit():
            try:
                return int(s)
            except ValueError:
                return None
    return None


def extract_upstream_error_info(
    exc: BaseException,
    *,
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    """抽取上游错误的关键字段。

    Args:
        provider: 已识别的 provider（见 :func:`detect_provider`）。决定
            是否从 message 抠括号数字当业务码——只对 MiniMax 启用。

    Returns:
        ``{"error_type": str|None, "business_code": int|None,
        "message": str, "http_status": int|None, "provider": str}``
    """
    prov = provider or PROVIDER_GENERIC
    body = _body_dict(exc)
    raw_error = body.get("error")
    err: Dict[str, Any] = raw_error if isinstance(raw_error, dict) else {}

    error_type = err.get("type") or getattr(exc, "type", None) or body.get("type")
    message = err.get("message") or body.get("message") or str(exc)

    # 业务码：先看结构化字段（GLM 的 error.code / MiniMax 的 body.error.code），
    # 再（仅 MiniMax）从 message 抠括号数字。
    business_code: Optional[int] = None
    for candidate in (err.get("code"), body.get("code")):
        business_code = _coerce_code(candidate)
        if business_code is not None:
            break
    if business_code is None and prov in _PROVIDERS_WITH_PAREN_CODE:
        m = _BUSINESS_CODE_RE.search(str(message))
        if m:
            business_code = _coerce_code(m.group(1))

    status = getattr(exc, "status_code", None)
    return {
        "error_type": str(error_type) if error_type else None,
        "business_code": business_code,
        "message": str(message),
        "http_status": status if isinstance(status, int) else None,
        "provider": prov,
    }


# ---------------------------------------------------------------------------
# 判定
# ---------------------------------------------------------------------------


def is_retryable_upstream_error(
    exc: BaseException,
    *,
    provider: Optional[str] = None,
) -> bool:
    """上游错误是否属「重试能解决」的瞬时故障。

    判据优先级：

    1. **error.type**（最具体）：命中 :data:`NON_RETRYABLE_ERROR_TYPES`
       → False（鉴权 / 参数 / 内容审查——即便 HTTP 429 也不重试）；
       命中 :data:`QUOTA_EXHAUSTED_ERROR_TYPES` → False（额度耗尽，
       ADR-0061，归兜底切换）；命中 :data:`RETRYABLE_ERROR_TYPES` → True。
       **例外**：已识别 provider 的额度耗尽**业务码**先于 RETRYABLE type
       判（GLM 把 5h/周上限与真限流都装在 ``rate_limit_error`` 下）。
    2. **业务码**（仅已识别 provider 且命中其码表时）：
       ``non_retryable`` 档直接 False；``retryable`` 档直接 True。
       不同 provider 同号不同义，所以只在已识别 provider 下查表。
    3. **HTTP 状态码**：
       - 200（流中途错）→ 配合 :data:`STREAM_MIDWAY_ERROR_TYPES`
         （``api_error``）判为瞬时——MiniMax 事故形态；
       - 429 → True（限流退避）；
       - 401/402/403/404/409/413/422 等「重试无用」的 4xx → False
         （笼统的 ``api_error`` type 不能盖过 4xx——否则 402 欠费会被
         当瞬时故障空转）；
       - 5xx → True。
    """
    info = extract_upstream_error_info(exc, provider=provider)
    prov = info["provider"]
    status = info["http_status"]

    # 1. error.type（最具体）
    etype = info["error_type"]
    if etype in NON_RETRYABLE_ERROR_TYPES:
        return False
    # 额度耗尽（ADR-0061）：窗口重置前重试无用——不进重试路径，由兜底
    # 切换接手。须先于 RETRYABLE 判定（部分网关用笼统 type）与 HTTP 429
    # 兜底（额度错误多以 429 下发）。
    if etype in QUOTA_EXHAUSTED_ERROR_TYPES:
        return False
    # 额度耗尽**业务码**也须先于笼统的 RETRYABLE type：GLM 把 5h/周上限
    # （1308/1310）与真限流（1302）都装在 ``rate_limit_error`` type 下发，
    # 对 GLM 而言业务码比 type 更具体——不先查码，1308 会被 type 放行重试。
    code = info["business_code"]
    if code is not None:
        table = _PROVIDER_TABLES.get(prov, _PROVIDER_TABLES[PROVIDER_GENERIC])
        if code in table["quota_exhausted"]:
            return False
    if etype in RETRYABLE_ERROR_TYPES:
        return True

    # 2. 业务码（provider 分表）
    if code is not None:
        table = _PROVIDER_TABLES.get(prov, _PROVIDER_TABLES[PROVIDER_GENERIC])
        if code in table["non_retryable"]:
            return False
        if code in table["retryable"]:
            return True

    # 3. HTTP 状态码兜底
    if isinstance(status, int):
        if status == 429:
            return True
        if status in (401, 402, 403, 404, 409, 413, 422):
            return False
        if 500 <= status < 600:
            return True
        # 流中途错（请求已被接受，错误发生在响应体里）
        if 200 <= status < 300 and etype in STREAM_MIDWAY_ERROR_TYPES:
            return True
    return False


def is_quota_exhausted_error(
    exc: BaseException,
    *,
    provider: Optional[str] = None,
) -> bool:
    """上游错误是否属「额度耗尽」——套餐窗口上限 / 余额不足（ADR-0061）。

    与 :func:`is_retryable_upstream_error` 的关系：额度耗尽**不可重试**
    （窗口重置前退避无用），但也**不是配置错误**——由兜底切换接手。
    ``exceeded_current_quota_error`` 同时在不可重试表里（对重试判定
    不可重试是对的），本函数先于那张表命中它。

    判据优先级：
    1. **error.type** 命中 :data:`QUOTA_EXHAUSTED_ERROR_TYPES` → True；
    2. **业务码**（已识别 provider）命中 ``quota_exhausted`` 档 → True；
    3. **HTTP 402**（Payment Required——余额不足的通用状态码）→ True。
    """
    info = extract_upstream_error_info(exc, provider=provider)
    prov = info["provider"]

    # 1. error.type（最具体）
    if info["error_type"] in QUOTA_EXHAUSTED_ERROR_TYPES:
        return True

    # 2. 业务码（provider 分表）
    code = info["business_code"]
    if code is not None:
        table = _PROVIDER_TABLES.get(prov, _PROVIDER_TABLES[PROVIDER_GENERIC])
        if code in table["quota_exhausted"]:
            return True

    # 3. HTTP 402
    status = info["http_status"]
    if isinstance(status, int) and status == 402:
        return True
    return False


def friendly_upstream_error(
    exc: BaseException,
    *,
    provider: Optional[str] = None,
) -> str:
    """用户可见文案；非「上游瞬时故障 / 额度耗尽」返回空串（调用方按原样处理）。

    技术细节（上游原文 + 网关码 + 业务码）不进这条文案——由调用方的
    ``logger.exception`` 落进日志，转录气泡只留可读文案。
    """
    if is_quota_exhausted_error(exc, provider=provider):
        return FRIENDLY_QUOTA_EXHAUSTED_ERROR
    if not is_retryable_upstream_error(exc, provider=provider):
        return ""
    return FRIENDLY_UPSTREAM_ERROR
