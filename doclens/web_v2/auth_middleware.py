"""登录闸门 HTTP 中间件：校验 cookie 会话 + 滑动续期。

只拦截 /api/*（静态资源与 SPA fallback 放行，否则浏览器连登录页都加载不到）；
豁免 /api/health 与 /api/auth/*（后者在 handler 内做细粒度鉴权）。
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from doclens.web_v2 import deps
from doclens.web_v2.auth_credentials import has_password
from doclens.web_v2.auth_gate import COOKIE_MAX_AGE, COOKIE_NAME, SESSION_TTL_HOURS, gate_enabled

_EXEMPT_PATHS = frozenset({"/api/health"})
_EXEMPT_PREFIXES = ("/api/auth",)


def _set_auth_cookie(response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="strict",
    )


def register_auth_middleware(app: FastAPI) -> None:
    """注册登录闸门中间件（应在 router 注册前调用）。"""

    @app.middleware("http")
    async def auth_gate(request: Request, call_next):
        path = request.url.path
        # 1) 只拦 /api/*；静态资源、SPA fallback、sw.js、manifest 一律放行
        if not path.startswith("/api/"):
            return await call_next(request)
        # 2) 豁免路径
        if path in _EXEMPT_PATHS or path.startswith(_EXEMPT_PREFIXES):
            return await call_next(request)
        # 3) 生效条件（逐请求判定：host 非环回 且 已设密码）
        host = getattr(request.app.state, "auth_host", "127.0.0.1")
        if not gate_enabled(host, has_password()):
            return await call_next(request)
        # 4) 校验 cookie 会话（touch 滑动续期）
        token = request.cookies.get(COOKIE_NAME)
        store = deps.get_sessions_store()
        if not token or not store.validate_auth_session(token, touch=True, ttl_hours=SESSION_TTL_HOURS):
            return JSONResponse(
                status_code=401,
                content={"code": "UNAUTHORIZED", "detail": "需要登录"},
            )
        # 5) 放行并刷新 cookie（Max-Age 重置 24h，与 DB 滑动续期配合）
        response = await call_next(request)
        _set_auth_cookie(response, token)
        return response
