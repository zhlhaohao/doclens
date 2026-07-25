"""登录防爆破限速器（内存态，按来源 IP 计数，重启清零）。

6 位数字 PIN 仅 100 万种组合，不限速会被局域网脚本在线爆破。
不解析 X-Forwarded-For（LAN 直连场景，防伪造）；反向代理后会连坐，属已知取舍。
"""
from __future__ import annotations

import threading
import time

MAX_FAILURES = 5
LOCK_SECONDS = 300
LOGIN_DELAY_S = 0.3  # 登录接口统一人为延时（成功/失败一致），测试中 monkeypatch 为 0


class LoginRateLimiter:
    """{ip: (fail_count, locked_until_epoch)} 内存计数器。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: dict[str, tuple[int, float]] = {}

    def check(self, ip: str) -> int:
        """返回剩余锁定秒数；0 表示未锁定（不清除已有失败计数）。"""
        now = time.monotonic()
        with self._lock:
            entry = self._state.get(ip)
            if entry is None:
                return 0
            _, locked_until = entry
            if locked_until <= 0:
                return 0  # 只有失败计数、未锁定
            remaining = int(locked_until - now)
            if remaining > 0:
                return remaining
            # 锁已过期：清零重来
            self._state.pop(ip, None)
            return 0

    def record_failure(self, ip: str) -> int:
        """记录一次失败；达阈值则置锁。返回剩余锁定秒数（0 = 未锁）。"""
        now = time.monotonic()
        with self._lock:
            fails, locked_until = self._state.get(ip, (0, 0.0))
            fails += 1
            if fails >= MAX_FAILURES:
                locked_until = now + LOCK_SECONDS
                fails = 0
            self._state[ip] = (fails, locked_until)
            remaining = int(locked_until - now)
            return remaining if remaining > 0 else 0

    def record_success(self, ip: str) -> None:
        """登录成功：清除该 IP 的失败计数。"""
        with self._lock:
            self._state.pop(ip, None)


_limiter: LoginRateLimiter | None = None
_limiter_lock = threading.Lock()


def get_rate_limiter() -> LoginRateLimiter:
    """进程级单例。"""
    global _limiter
    if _limiter is None:
        with _limiter_lock:
            if _limiter is None:
                _limiter = LoginRateLimiter()
    return _limiter
