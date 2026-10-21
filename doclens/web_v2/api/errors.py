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

    # 索引初始化失败（AP-36）：这是"当前不可用但可重试"，不是业务错误，
    # 也不是代码 bug——503 + 明确原因，前端据此提示稍后重试而非报错。
    # 延迟 import：deps 是重量级装配模块，errors 不应在导入期拉起它。
    from doclens.web_v2.deps import IndexInitError, idx_init_retry_after

    @app.exception_handler(IndexInitError)
    async def _handle_index_init_error(_: Request, exc: IndexInitError):
        return JSONResponse(
            status_code=503,
            content={
                "code": "INDEX_INIT_FAILED",
                "detail": str(exc),
                "retry_after": idx_init_retry_after(),
            },
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception):
        # 运行中会话库损坏（ADR-0047）：DatabaseError 触发自动恢复（换库文件
        # + 丢单例），本请求 503——前端提示稍后重试；恢复完成经 SSE 广播。
        import sqlite3

        if isinstance(exc, sqlite3.DatabaseError):
            try:
                from doclens.web_v2 import deps
                from doclens.web_v2 import session_backup

                db_path = deps.sessions_db_path()
                restored = session_backup.restore_latest(db_path)
                if restored is not None:
                    deps.invalidate_sessions_store()
                    deps.broadcast_sessions_restored(restored, auto=True)
                    logger.warning(
                        "sessions.db runtime corruption auto-restored from %s",
                        restored["restored_from"],
                    )
                    return JSONResponse(
                        status_code=503,
                        content={
                            "code": "SESSION_DB_RESTORING",
                            "detail": "会话库损坏，已从最新备份恢复，请重试本操作",
                            "restored_from": restored["restored_from"],
                        },
                    )
            except Exception:  # noqa: BLE001 — 恢复失败回落到 500 通用路径
                logger.exception("sessions.db runtime auto-restore failed")
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
