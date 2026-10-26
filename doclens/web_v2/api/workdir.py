"""工作目录热切换 API（ADR-0043）。

- ``POST /api/workdir/switch``：同步阻塞执行切换（先建后换 + 全局切换锁）；
  成功时为**新目录**续发登录 cookie（登录续发，ADR-0043），切换成功后
  前端整页 reload，旧目录 token 不再可用。
- ``GET /api/workdir/recent``：最近工作目录清单（机器级，读时过滤不存在目录）。

切换窗口期间，其余 API（status/health 除外）由 swap_gate 中间件 503。
"""
import asyncio
import logging
import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from doclens.web_v2 import auth_credentials, deps
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.auth_gate import (
    COOKIE_MAX_AGE,
    COOKIE_NAME,
    SESSION_TTL_HOURS,
    gate_enabled_for_client,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class WorkdirSwitchRequest(BaseModel):
    path: str = Field(..., min_length=1, description="目标工作目录绝对路径")


class WorkdirSwitchResponse(BaseModel):
    ok: bool = True
    workdir: str
    doc_count: int
    changed: bool


@router.post("/workdir/precheck")
async def precheck_workdir(body: WorkdirSwitchRequest):
    """切换前轻量探测（ADR-0049 files 页「设为工作目录」链路）：

    检查目标目录是否已有索引库（<数据目录>/index.db 存在）。首次切往
    未建索引的大目录会触发后台全量索引（分钟级），前端据此先弹确认框
    提醒用户。**只读探测，无副作用、不进切换窗口**——目录不存在同
    switch 的切前校验口径返回 400，让用户在弹确认框前就知道目标非法。
    """
    from doclens.config import data_dirname

    def _work() -> dict:
        target = body.path.strip().strip('"')
        if not os.path.isdir(target):
            raise CortexAPIError(400, "WORKDIR_INVALID", f"目录不存在: {target}")
        index_path = os.path.join(target, data_dirname(), "index.db")
        return {
            "has_index": os.path.exists(index_path),
            "index_path": index_path,
        }

    return await asyncio.to_thread(_work)


@router.post("/workdir/switch", response_model=WorkdirSwitchResponse)
async def switch_workdir(request: Request, body: WorkdirSwitchRequest):
    """同步执行工作目录热切换（ADR-0043）。

    切换期间其余 API 503；本端点自身阻塞至切换完成（含新目录索引审计）。
    登录闸门生效时：成功后为新目录签发新 token（Set-Cookie）——旧目录
    sessions.db 与新目录隔离，不续发则 reload 后被强制重登。
    """
    try:
        result = await asyncio.to_thread(deps.swap_workdir, body.path)
    except ValueError as e:
        raise CortexAPIError(400, "WORKDIR_INVALID", str(e))
    except RuntimeError as e:
        msg = str(e)
        if "切换进行中" in msg:
            raise CortexAPIError(409, "WORKDIR_SWAP_IN_PROGRESS", msg)
        raise CortexAPIError(500, "WORKDIR_SWAP_FAILED", msg)

    response = JSONResponse(content=WorkdirSwitchResponse(
        workdir=result["workdir"],
        doc_count=result["doc_count"],
        changed=result["changed"],
    ).model_dump())

    # 登录续发（ADR-0043）：闸门生效且本次已持有效旧 token 时，为新目录
    # 签发新 token。changed=False（同目录静默成功）不续发——token 本就有效。
    if result["changed"]:
        client_ip = request.client.host if request.client else None
        if gate_enabled_for_client(client_ip, auth_credentials.has_password()):
            old_token = request.cookies.get(COOKIE_NAME)
            if old_token:
                new_token = deps.get_sessions_store().create_auth_session(
                    ttl_hours=SESSION_TTL_HOURS
                )
                response.set_cookie(
                    COOKIE_NAME, new_token,
                    max_age=COOKIE_MAX_AGE, httponly=True, samesite="strict",
                )
    return response


@router.get("/workdir/recent")
async def recent_workdirs():
    """最近工作目录清单（倒序，已过滤不存在目录）。"""
    from doclens.web_v2.workdir_store import list_recent
    return {"items": list_recent()}


@router.get("/workdir/orphans")
async def orphan_tasks():
    """当前活跃后台任务计数（切换确认对话框的警告数据源）。

    统计：在途 AI 生成（chat_runner）+ 后台 shell 任务 + teammate。
    """
    from doclens.web_v2 import chat_runner

    generating = chat_runner.active_count()

    return {"generating": generating}
