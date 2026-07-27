"""6 位数字访问密码的哈希与校验（纯函数，无状态）。

仅使用标准库：pbkdf2_hmac + secrets 盐 + hmac.compare_digest 恒定时间比较。
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets

PASSWORD_PATTERN = re.compile(r"^[0-9]{6}$")  # 仅 ASCII 数字（\d 会匹配全角数字）
PBKDF2_ITERATIONS = 100_000
_SALT_BYTES = 16
_ALGO = "sha256"


def validate_pin_format(pin: str) -> bool:
    """密码必须是 6 位纯数字。"""
    return bool(PASSWORD_PATTERN.match(pin))


def hash_password(pin: str) -> tuple[str, str]:
    """对 PIN 生成 (salt_hex, hash_hex)。格式非法抛 ValueError。"""
    if not validate_pin_format(pin):
        raise ValueError("密码必须是 6 位数字")
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(_ALGO, pin.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return salt.hex(), digest.hex()


def verify_password(pin: str, salt_hex: str, hash_hex: str, iterations: int = PBKDF2_ITERATIONS) -> bool:
    """恒定时间校验 PIN 是否匹配存储的盐+哈希。"""
    try:
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac(_ALGO, pin.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(digest, expected)
