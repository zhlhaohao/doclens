# -*- coding: utf-8 -*-
"""LLM HTTP 客户端超时（PLANIFY_LLM_TIMEOUT_*）。

**为什么必须有显式超时**：SDK 默认 ``read=600s``，且 read 是「两次收到
字节之间的最大间隔」——端点只要发 SSE keepalive/不关闭连接，读超时永不
触发（2026-10-23 实测：插话汇报调用 200 OK 之后静默 11.6 分钟才收尾，
整轮对话被单个 LLM 调用钉死）。

口径：
- ``read``：流式响应的**空闲**上限（两字节间隔），不是总时长——正常长
  回答持续吐 delta/thinking 不受影响；值过小会误杀「服务端缓冲后一次性
  吐」的网关，故默认 300s。
- ``connect`` / ``write`` / ``pool``：连接与写请求，短超时快速失败。

配置走 planify 自己的命名空间（``PLANIFY_*``），非法值回落默认并告警。
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

#: 默认超时（秒）。read=300 覆盖「长思考首字节 / 大回答中途停顿」的常见
#: 上限，同时把「永久静默」从 600s+ 提前到 5 分钟内暴露。
DEFAULT_CONNECT_TIMEOUT = 10.0
DEFAULT_READ_TIMEOUT = 300.0
DEFAULT_WRITE_TIMEOUT = 60.0
DEFAULT_POOL_TIMEOUT = 10.0

_ENV_KEYS = {
    "connect": ("PLANIFY_LLM_TIMEOUT_CONNECT", DEFAULT_CONNECT_TIMEOUT),
    "read": ("PLANIFY_LLM_TIMEOUT_READ", DEFAULT_READ_TIMEOUT),
    "write": ("PLANIFY_LLM_TIMEOUT_WRITE", DEFAULT_WRITE_TIMEOUT),
    "pool": ("PLANIFY_LLM_TIMEOUT_POOL", DEFAULT_POOL_TIMEOUT),
}


def _env_float(name: str, default: float) -> float:
    raw = (os.getenv(name, "") or "").strip()
    if not raw:
        return default
    try:
        val = float(raw)
    except ValueError:
        logger.warning("%s=%r 非法（应为正数秒），回落默认 %.0fs", name, raw, default)
        return default
    if val <= 0:
        logger.warning("%s=%r 非正数，回落默认 %.0fs", name, raw, default)
        return default
    return val


def resolve_http_timeout() -> dict[str, float]:
    """解析超时字典（{connect, read, write, pool}，秒）。"""
    return {k: _env_float(env, dflt) for k, (env, dflt) in _ENV_KEYS.items()}


def build_httpx_timeout(httpx_module: Any) -> Optional[Any]:
    """构造 httpx.Timeout；模块不支持 Timeout 时返回 None（不设超时）。

    Anthropic SDK ≥1.4 用 httpx2、旧版用 httpx——两代 ``Timeout`` 构造
    签名一致（关键字 connect/read/write/pool），这里按传入模块自适应。
    """
    timeout_cls = getattr(httpx_module, "Timeout", None)
    if timeout_cls is None:
        return None
    kwargs = resolve_http_timeout()
    try:
        return timeout_cls(**kwargs)
    except Exception as e:  # noqa: BLE001
        logger.warning("构造 httpx.Timeout 失败（%s），回落 SDK 默认超时", e)
        return None
