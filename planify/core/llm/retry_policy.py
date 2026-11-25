# -*- coding: utf-8 -*-
"""LLM 调用失败的「是否值得退避重试」统一判定（2026-11-18）。

**为什么抽到这里**：判定口径此前散落两处且都漏：

1. 主代理 ``planify/streaming/runner.py::is_retryable_llm_error``——认
   SDK 原生 ``RateLimitError``/``APIConnectionError``/``APITimeoutError``
   与 5xx；但**不认 SSE 流中的 error 事件**（HTTP 状态 200，异常体带
   上游业务码，见 :mod:`planify.core.llm.upstream_errors`）→ 主代理
   一次都不重试，整轮报废。
2. 子代理 ``planify/subagent/runner.py::_chat_with_retry``——只看
   ``getattr(e, "retryable", False)``，**planify 归一异常之外的 SDK 原生
   异常一律判为不可重试**（2026-11-18 12:39 实测：bigmodel 429 被记为
   ``retryable=False``，4 次子代理派发全部瞬间失败）。

本模块是唯一判定点：主代理与子代理都从这里取，避免两处口径漂移。
"""
from __future__ import annotations

import logging

from .upstream_errors import is_retryable_upstream_error

logger = logging.getLogger(__name__)

#: SDK 原生异常类名白名单（瞬时类：限流 / 连接失败 / 超时）
RETRYABLE_EXCEPTION_NAMES = frozenset(
    {"RateLimitError", "APIConnectionError", "APITimeoutError"}
)


def is_retryable_llm_error(e: BaseException) -> bool:
    """LLM 调用是否值得退避重试（瞬时 429/网络抖动/上游瞬时故障）。

    两类来源都认：planify 归一异常（``LLMRateLimitError``/``LLMNetworkError``
    的 ``retryable=True``）与 SDK 原生异常（anthropic/openai SDK 经
    provider.astream 直穿的 RateLimitError / APIConnectionError / 5xx
    APIStatusError）。认证/上下文超限/4xx 参数错误一律不可重试。
    """
    # planify 归一异常
    if bool(getattr(e, "retryable", False)):
        return True
    # SDK 原生异常类名
    if type(e).__name__ in RETRYABLE_EXCEPTION_NAMES:
        return True
    # SDK 5xx 服务端错误（overloaded / internal）：status_code 属性判别
    status = getattr(e, "status_code", None)
    if isinstance(status, int) and 500 <= status < 600:
        return True
    # 上游业务码 / SSE 流中 error 事件（HTTP 200 也能带业务码）
    # provider 分表（2026-11-18）：GLM 1000=鉴权失败（不可重试）vs
    # MiniMax 1000=未知错误（可重试）——必须按 provider 隔离查表。
    # provider 来源：provider 层在抛出点贴的 _planify_provider 标记。
    try:
        from .provider_context import provider_of
        from .upstream_errors import is_retryable_upstream_error

        if is_retryable_upstream_error(e, provider=provider_of(e)):
            return True
    except Exception:  # noqa: BLE001 — 分类器自身异常不得阻断判定
        logger.debug("上游错误分类失败，按不可重试处理", exc_info=True)
    return False


def is_quota_exhausted_llm_error(e: BaseException) -> bool:
    """LLM 调用失败是否属「额度耗尽」（套餐窗口上限 / 余额不足，ADR-0061）。

    额度耗尽不重试、也不是配置错误——是兜底切换的触发信号之一。
    分类器自身异常按「不是」处理（宁可不切换，不可误切换）。
    """
    try:
        from .provider_context import provider_of
        from .upstream_errors import is_quota_exhausted_error

        return is_quota_exhausted_error(e, provider=provider_of(e))
    except Exception:  # noqa: BLE001
        logger.debug("额度耗尽分类失败，按非额度错误处理", exc_info=True)
        return False


def user_facing_llm_error(e: BaseException) -> str:
    """异常 → 用户可见文案（上游瞬时故障脱敏，其余原样）。"""
    try:
        from .provider_context import provider_of
        from .upstream_errors import friendly_upstream_error

        friendly = friendly_upstream_error(e, provider=provider_of(e))
        if friendly:
            return friendly
    except Exception:  # noqa: BLE001 — 脱敏失败不得影响错误收场
        logger.debug("上游错误脱敏失败，回退原文", exc_info=True)
    return str(e)
