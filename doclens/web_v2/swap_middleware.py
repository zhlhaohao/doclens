"""切换窗口中间件（ADR-0043）：工作目录热切换期间其余 API 一律 503。

只拦 /api/*；豁免 /api/health、/api/status、/api/workdir/*（查询/触发切换
本身）、/api/auth/*（登录闸门链路）与 watch SSE 通道（/api/watch/*，
切换完成广播依赖它存活——断流则前端遮罩永远等不到解锁事件）。
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from doclens.web_v2 import deps

_EXEMPT_PREFIXES = (
    "/api/health",
    "/api/status",
    "/api/workdir",
    "/api/auth",
    "/api/watch",
)


def register_swap_middleware(app: FastAPI) -> None:
    """注册切换窗口中间件（应在 auth 中间件之后、router 注册前调用）。

    注册顺序注意：FastAPI 中间件后注册者先执行（洋葱外层）。本中间件
    要在 auth 之后注册 → 成为内层 → 请求先过 auth（401 优先）再过 swap
    503——未登录用户永远先看到 401，语义正确。
    """

    @app.middleware("http")
    async def swap_gate(request: Request, call_next):
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)
        if path.startswith(_EXEMPT_PREFIXES):
            return await call_next(request)
        if not deps.is_swapping():
            return await call_next(request)
        status = deps.swap_status()
        return JSONResponse(
            status_code=503,
            content={
                "code": "WORKDIR_SWAPPING",
                "detail": f"正在切换工作目录到 {status.get('target') or '?'}，请稍候",
                "target": status.get("target"),
            },
        )
