"""Cortex Web API 统一错误处理。

约定所有业务错误抛 CortexAPIError，由 FastAPI exception_handler 转换为
JSON 响应：{"code": "...", "detail": "...", ...extra}。

未捕获异常（AP-35）：写带 traceback 的 error 日志并回传短 traceback_id，
响应体只给通用文案——异常文本可能含路径/SQL 片段，不能直接发给 LAN 客户端。
"""
import logging
import secrets
from typing import Any, Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

#: 未捕获异常的通用文案（前端 toast 兜底展示；具体原因查日志的 traceback_id）
INTERNAL_ERROR_DETAIL = "内部错误，详情见后端日志"


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
    async def _handle_unexpected(request: Request, exc: Exception):
        # traceback_id 是日志与用户反馈之间的唯一关联键：前端把它显示出来，
        # 用户报障时可直接在日志里 grep 到完整堆栈（AP-35）。
        traceback_id = secrets.token_hex(4)
        logger.exception(
            "unhandled API error [%s] %s %s",
            traceback_id,
            request.method,
            request.url.path,
        )
        return JSONResponse(
            status_code=500,
            content={
                "code": "INTERNAL_ERROR",
                "detail": INTERNAL_ERROR_DETAIL,
                "traceback_id": traceback_id,
            },
        )
