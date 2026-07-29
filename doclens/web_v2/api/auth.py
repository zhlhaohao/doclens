"""/api/auth/* — 登录、登出、状态查询、密码管理。

整段被 auth_middleware 豁免（否则登录接口自身也被闸门挡住），
因此除 login/status 外的端点在 handler 内做细粒度鉴权：
闸门生效时必须持有效会话；闸门未生效时（环回/未设密码）开放，
以便用户在环回页面上首次设置密码。

存储：密码哈希在全局 .env（auth_credentials），登录会话在 sessions.db
（SessionsStore.auth_sessions）。
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from doclens.web_v2 import auth_credentials, deps
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.auth_gate import (
    COOKIE_MAX_AGE,
    COOKIE_NAME,
    SESSION_TTL_HOURS,
    gate_enabled_for_client,
)
from doclens.web_v2.auth_password import validate_pin_format
from doclens.web_v2.auth_rate_limit import LOGIN_DELAY_S, get_rate_limiter
from doclens.web_v2.models.auth import (
    AuthStatusResponse,
    LoginRequest,
    LoginResponse,
    PasswordClearRequest,
    PasswordUpdateRequest,
)

router = APIRouter()


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _set_auth_cookie(response: JSONResponse, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="strict",
    )


def _clear_auth_cookie(response: JSONResponse) -> None:
    response.set_cookie(COOKIE_NAME, "", max_age=0, httponly=True, samesite="strict")


def _gate_on(request: Request) -> bool:
    client_ip = request.client.host if request.client else None
    return gate_enabled_for_client(client_ip, auth_credentials.has_password())


def _require_session_if_enabled(request: Request) -> None:
    """闸门生效时必须持有效会话（login/status 除外）。"""
    if _gate_on(request):
        token = request.cookies.get(COOKIE_NAME)
        store = deps.get_sessions_store()
        if not token or not store.validate_auth_session(token, touch=False):
            raise CortexAPIError(401, "UNAUTHORIZED", "需要登录")


@router.get("/auth/status", response_model=AuthStatusResponse)
async def auth_status(request: Request):
    """开放端点：前端启动时探测是否需要登录。"""
    required = _gate_on(request)
    authenticated = False
    token = request.cookies.get(COOKIE_NAME)
    if required and token:
        store = deps.get_sessions_store()
        authenticated = store.validate_auth_session(token, touch=True, ttl_hours=SESSION_TTL_HOURS)
    elif not required:
        # 闸门未生效时视为已认证（前端直接进主界面）
        authenticated = True
    return AuthStatusResponse(
        required=required,
        authenticated=authenticated,
        has_password=auth_credentials.has_password(),
    )


@router.post("/auth/login", response_model=LoginResponse)
async def login(request: Request, body: LoginRequest):
    """验证密码并签发会话 cookie。按来源 IP 限速 + 统一人为延时。"""
    ip = _client_ip(request)
    limiter = get_rate_limiter()

    locked = limiter.check(ip)
    if locked > 0:
        raise CortexAPIError(
            429, "AUTH_LOCKED", f"失败次数过多，请 {locked} 秒后再试",
            extra={"retry_after": locked},
        )

    await asyncio.sleep(LOGIN_DELAY_S)  # 成功/失败统一延时，拖慢在线爆破

    if not auth_credentials.verify(body.password):
        locked = limiter.record_failure(ip)
        if locked > 0:
            raise CortexAPIError(
                429, "AUTH_LOCKED", f"失败次数过多，请 {locked} 秒后再试",
                extra={"retry_after": locked},
            )
        raise CortexAPIError(401, "INVALID_PASSWORD", "密码错误")

    limiter.record_success(ip)
    token = deps.get_sessions_store().create_auth_session(ttl_hours=SESSION_TTL_HOURS)
    response = JSONResponse(content=LoginResponse().model_dump())
    _set_auth_cookie(response, token)
    return response


@router.post("/auth/logout", response_model=LoginResponse)
async def logout(request: Request):
    _require_session_if_enabled(request)
    token = request.cookies.get(COOKIE_NAME)
    if token:
        deps.get_sessions_store().delete_auth_session(token)
    response = JSONResponse(content=LoginResponse().model_dump())
    _clear_auth_cookie(response)
    return response


@router.put("/auth/password", response_model=LoginResponse)
async def update_password(request: Request, body: PasswordUpdateRequest):
    """设置/修改密码。

    已设密码时必须验证旧密码（计入限速器）；成功后吊销全部会话，
    并为当前操作者重签新会话（本人不掉线，其余设备全部重新登录）。
    """
    _require_session_if_enabled(request)

    if not validate_pin_format(body.new_password):
        raise CortexAPIError(400, "INVALID_PASSWORD_FORMAT", "密码必须是 6 位数字")

    if auth_credentials.has_password():
        if not body.old_password or not auth_credentials.verify(body.old_password):
            locked = get_rate_limiter().record_failure(_client_ip(request))
            if locked > 0:
                raise CortexAPIError(
                    429, "AUTH_LOCKED", f"失败次数过多，请 {locked} 秒后再试",
                    extra={"retry_after": locked},
                )
            raise CortexAPIError(401, "INVALID_PASSWORD", "旧密码错误")

    auth_credentials.set_password(body.new_password)
    store = deps.get_sessions_store()
    store.revoke_all_auth_sessions()
    get_rate_limiter().record_success(_client_ip(request))

    # 为当前操作者重签新会话
    token = store.create_auth_session(ttl_hours=SESSION_TTL_HOURS)
    response = JSONResponse(content=LoginResponse().model_dump())
    _set_auth_cookie(response, token)
    return response


@router.delete("/auth/password", response_model=LoginResponse)
async def clear_password(request: Request, body: PasswordClearRequest):
    """清除密码（须验证当前密码）。清除后闸门关闭、会话全部吊销。"""
    _require_session_if_enabled(request)

    if not auth_credentials.has_password():
        raise CortexAPIError(400, "NO_PASSWORD_SET", "尚未设置密码")
    if not auth_credentials.verify(body.password):
        raise CortexAPIError(401, "INVALID_PASSWORD", "密码错误")

    auth_credentials.clear_password()
    deps.get_sessions_store().revoke_all_auth_sessions()
    response = JSONResponse(content=LoginResponse().model_dump())
    _clear_auth_cookie(response)
    return response
