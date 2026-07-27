"""访问密码凭证：哈希存全局 .env（CORTEX_WEB_PASSWORD_HASH）。

存储格式：``iterations$salt_hex$hash_hex``。
- 全局共享（~/.cortex/.env，发行版 ~/.doclens/.env），不随工作目录；
- 直接读写文件（dotenv_values / write_env_values），每次调用都是最新值，
  无需 reload_config 即可生效（登录闸门逐请求判定）；
- 写 .env 复用 config_store.write_env_values，保留无关键/注释/顺序。
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from dotenv import dotenv_values

from doclens.config import get_global_cortex_dir
from doclens.web_v2.auth_password import (
    PBKDF2_ITERATIONS,
    hash_password,
    validate_pin_format,
    verify_password,
)
from doclens.web_v2.config_store import write_env_values

ENV_KEY = "CORTEX_WEB_PASSWORD_HASH"


def _env_path() -> Path:
    return get_global_cortex_dir() / ".env"


def _read_stored() -> Optional[tuple[int, str, str]]:
    """读取 (iterations, salt_hex, hash_hex)；未设置或格式损坏返回 None。"""
    path = _env_path()
    if not path.exists():
        return None
    raw = dotenv_values(str(path)).get(ENV_KEY) or ""
    parts = raw.split("$")
    if len(parts) != 3:
        return None
    try:
        iterations = int(parts[0])
    except ValueError:
        return None
    return iterations, parts[1], parts[2]


def has_password() -> bool:
    return _read_stored() is not None


def set_password(pin: str) -> None:
    """设置/覆盖密码（写全局 .env）。格式非法抛 ValueError。"""
    if not validate_pin_format(pin):
        raise ValueError("密码必须是 6 位数字")
    salt_hex, hash_hex = hash_password(pin)
    write_env_values(_env_path(), {ENV_KEY: f"{PBKDF2_ITERATIONS}${salt_hex}${hash_hex}"})


def verify(pin: str) -> bool:
    """校验 PIN；未设置密码时恒 False。"""
    stored = _read_stored()
    if stored is None:
        return False
    iterations, salt_hex, hash_hex = stored
    return verify_password(pin, salt_hex, hash_hex, iterations)


def clear_password() -> None:
    """清除密码（从 .env 删除该键）。文件不存在时为幂等 no-op。"""
    if not _env_path().exists():
        return
    write_env_values(_env_path(), {ENV_KEY: ""})
