"""登录挑战（challenge-response）——明文 PIN 不上线（2026-09-11 决议，方案 C）。

协议：
1. ``GET /api/auth/challenge`` → ``{ salt, iterations, nonce }``
   salt/iterations 来自存储哈希（本就公开无害）；nonce 一次性 + TTL。
2. 客户端 ``proof = HMAC-SHA256(nonce, PBKDF2(PIN, salt, iterations))``。
3. ``POST /api/auth/login { proof, nonce }``；服务端对存储哈希做同型 HMAC
   比对（常数时间）。

安全边界（如实，ADR 记录）：抓包者拿到 ``HMAC(nonce, x)``——nonce 一次性
故不可重放；还原 PIN 需离线爆破 PBKDF2（10^6 × 100k 迭代）。会话 Cookie
仍走明文 HTTP，可被同网段窃听者劫持——本机制只消灭「PIN 明文被抓」。
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import time

#: nonce 有效期（秒）：取挑战到提交登录的正常间隔留足余量
NONCE_TTL_S = 120
#: 单 IP 未决 nonce 上限（防挑战端点被刷内存）
_MAX_PENDING_PER_IP = 8

# nonce → (expires_at, ip)；模块级单例（GUI 单进程模型足够）
_pending: dict[str, tuple[float, str]] = {}
_last_gc = 0.0


def _gc() -> None:
    """惰性清理过期 nonce（每次发挑战时顺带扫一遍）。"""
    global _last_gc
    now = time.monotonic()
    if now - _last_gc < NONCE_TTL_S:
        return
    _last_gc = now
    for n in [n for n, (exp, _) in _pending.items() if exp <= now]:
        _pending.pop(n, None)


def issue_nonce(ip: str) -> str:
    """签发一次性 nonce（记录来源 IP + TTL；超量先淘汰最老的）。"""
    _gc()
    mine = [n for n, (_, owner) in _pending.items() if owner == ip]
    if len(mine) >= _MAX_PENDING_PER_IP:
        oldest = min(mine, key=lambda n: _pending[n][0])
        _pending.pop(oldest, None)
    nonce = secrets.token_hex(16)
    _pending[nonce] = (time.monotonic() + NONCE_TTL_S, ip)
    return nonce


def consume_nonce(nonce: str, ip: str) -> bool:
    """消费 nonce（一次性）：存在、未过期、来源 IP 一致才有效。"""
    entry = _pending.get(nonce)
    if entry is None:
        return False
    _pending.pop(nonce, None)
    exp, owner = entry
    return exp > time.monotonic() and owner == ip


def compute_proof(nonce: str, pbkdf2_hex: str) -> str:
    """proof = HMAC-SHA256(nonce, PBKDF2 输出)。客户端与服务端共用此式。"""
    return hmac.new(
        nonce.encode("utf-8"), bytes.fromhex(pbkdf2_hex), hashlib.sha256
    ).hexdigest()


def verify_proof(nonce: str, stored_hash_hex: str, proof: str) -> bool:
    """常数时间比对提交的 proof 与服务端按存储哈希算出的期望值。"""
    expected = compute_proof(nonce, stored_hash_hex)
    return hmac.compare_digest(expected, proof or "")
