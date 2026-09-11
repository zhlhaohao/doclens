"""Auth API 的请求/响应模型。

挑战-响应（2026-09-11，方案 C）：proof 字段 = HMAC-SHA256(nonce,
PBKDF2(PIN, salt, iterations))；携带 proof+nonce 的请求走无明文路径，
携带 password 的为兼容路径（环回/调试，前端已全部切挑战）。
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    password: Optional[str] = None          # 兼容路径：明文 PIN（环回/调试）
    proof: Optional[str] = None             # 挑战路径：HMAC(nonce, PBKDF2)
    nonce: Optional[str] = None


class ChallengeResponse(BaseModel):
    salt: str
    iterations: int
    nonce: str


class LoginResponse(BaseModel):
    ok: bool = True


class AuthStatusResponse(BaseModel):
    required: bool       # 闸门是否生效（host 非环回 且 已设密码）
    authenticated: bool  # 当前请求是否持有有效会话
    has_password: bool   # 是否已设密码（设置页 UI 用）


class PasswordUpdateRequest(BaseModel):
    old_password: Optional[str] = None      # 兼容路径：明文旧密码
    old_proof: Optional[str] = None         # 挑战路径：旧密码的 proof
    old_nonce: Optional[str] = None
    new_password: Optional[str] = None      # 兼容路径：明文新 PIN
    new_salt: Optional[str] = None          # 挑战路径：客户端自生成 salt
    new_hash: Optional[str] = None          # 挑战路径：PBKDF2(new_PIN, new_salt)


class PasswordClearRequest(BaseModel):
    password: Optional[str] = None          # 兼容路径
    proof: Optional[str] = None             # 挑战路径
    nonce: Optional[str] = None
