"""Auth API 的请求/响应模型。"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    ok: bool = True


class AuthStatusResponse(BaseModel):
    required: bool       # 闸门是否生效（host 非环回 且 已设密码）
    authenticated: bool  # 当前请求是否持有有效会话
    has_password: bool   # 是否已设密码（设置页 UI 用）


class PasswordUpdateRequest(BaseModel):
    old_password: Optional[str] = None
    new_password: str


class PasswordClearRequest(BaseModel):
    password: str
