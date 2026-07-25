"""登录闸门判定与常量。

生效条件（产品决策）：最终生效 host 非环回 且 已设置访问密码。
与 doclens/mcp_server.py 的 _LOOPBACK_HOSTS 语义保持一致。
"""
from __future__ import annotations

LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})

COOKIE_NAME = "cortex_auth"
COOKIE_MAX_AGE = 24 * 3600  # 秒，与 SESSION_TTL_HOURS 对应
SESSION_TTL_HOURS = 24


def is_loopback(host: str) -> bool:
    """判断绑定地址是否环回。0.0.0.0 / :: 非环回（绑定全网卡即暴露 LAN）。"""
    return host in LOOPBACK_HOSTS


def gate_enabled(host: str, has_password: bool) -> bool:
    """登录闸门是否生效：非环回 host 且已设置密码。逐请求调用以支持运行时设/清密码。"""
    return not is_loopback(host) and has_password
