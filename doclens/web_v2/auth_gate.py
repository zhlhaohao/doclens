"""登录闸门判定与常量。

生效条件（2026-07-29 调整）：请求来源 IP 非环回 且 已设置访问密码。
按 TCP 连接的真实来源 IP（``request.client.host``）判定，而非绑定地址——
这样即使绑定 ``0.0.0.0`` 暴露 LAN，本机环回访问仍免登录，仅 LAN 来源需密码。

安全要点：必须用 peer IP，**不可**用 ``Host`` header / ``request.url.hostname``
判定——后者由客户端发送、可被伪造，LAN 用户伪造 ``Host: 127.0.0.1`` 即可绕过密码。
"""
from __future__ import annotations

import ipaddress

COOKIE_NAME = "cortex_auth"
COOKIE_MAX_AGE = 24 * 3600  # 秒，与 SESSION_TTL_HOURS 对应
SESSION_TTL_HOURS = 24


def is_loopback_ip(ip: str | None) -> bool:
    """请求来源 IP 是否环回（IPv4 ``127.0.0.0/8`` 或 IPv6 ``::1``）。

    ``None`` / 无法解析时按**非环回**处理（保守：未知来源不放过）。
    """
    if not ip:
        return False
    try:
        return ipaddress.ip_address(ip).is_loopback
    except ValueError:
        return False


def gate_enabled_for_client(client_ip: str | None, has_password: bool) -> bool:
    """登录闸门是否生效：来源 IP 非环回 且 已设置密码。

    逐请求调用以支持运行时设/清密码即时生效。
    """
    return not is_loopback_ip(client_ip) and has_password
