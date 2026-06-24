"""Cortex Web API 统一错误处理。

约定所有业务错误抛 CortexAPIError，由 FastAPI exception_handler 转换为
JSON 响应：{"code": "...", "detail": "...", ...extra}。
"""
from typing import Any, Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class CortexAPIError(Exception):
    """业务级 API 错误，含 HTTP status、错误码、人类可读详情，以及可选的额外字段。"""

    def __init__(
        self,
        status: int,
        code: str,
        detail: str,
        extra: Optional[dict[str, Any]] = None,
    ):
        self.status = status
        self.code = code
        self.detail = detail
        self.extra = extra or {}
        super().__init__(f"[{code}] {detail}")


def register_error_handlers(app: FastAPI) -> None:
    """在 FastAPI app 上注册统一错误处理器。"""

    @app.exception_handler(CortexAPIError)
    async def _handle_cortex_error(_: Request, exc: CortexAPIError):
        content = {"code": exc.code, "detail": exc.detail}
        if exc.extra:
            content.update(exc.extra)
        return JSONResponse(status_code=exc.status, content=content)

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, exc: Exception):
        # 真实生产可在这里记 traceback_id 并写日志
        return JSONResponse(
            status_code=500,
            content={"code": "INTERNAL_ERROR", "detail": str(exc) or "内部错误"},
        )
