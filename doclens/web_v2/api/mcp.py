"""GET/POST/PUT/PATCH/DELETE /api/mcp/servers — MCP client 配置 CRUD（ADR-0014）。

配置存机器级 ``mcp_servers.json``（密钥 GET 脱敏）；写操作**不阻塞**——
保存即返回，McpClientManager 后台 reconcile（diff 重连/收割），状态经
GET 附带的 runtime 字段轮询。进行中对话持旧工具快照跑到本轮结束。
"""
import logging

from fastapi import APIRouter

from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2 import mcp_servers_store
from doclens.web_v2.models.mcp_server import (
    McpServer,
    McpServerCreate,
    McpServerEnabledPatch,
    McpServerListResponse,
    McpServerUpdate,
    McpServerWithStatus,
    McpToolsResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _runtime_status_map() -> dict:
    """McpClientManager 状态快照 → {server_id: status dict}。"""
    from doclens.mcp_client import get_mcp_client_manager

    return {s["server_id"]: s for s in get_mcp_client_manager().status_snapshot()}


def _with_status(server: dict, runtime_map: dict) -> McpServerWithStatus:
    rt = runtime_map.get(server["id"]) or {
        "server_id": server["id"], "status": "disabled", "tool_count": 0, "error": None,
    }
    return McpServerWithStatus(**server, runtime=rt)


@router.get("/mcp/servers", response_model=McpServerListResponse)
async def list_servers():
    """列出全部服务器配置（脱敏）+ 各自运行状态。"""
    servers = mcp_servers_store.list_servers()
    runtime_map = _runtime_status_map()
    return McpServerListResponse(
        servers=[_with_status(s, runtime_map) for s in servers]
    )


@router.post("/mcp/servers", response_model=McpServerWithStatus, status_code=201)
async def create_server(req: McpServerCreate):
    """新建服务器配置。保存即返回；连接由后台 reconcile 异步建立。"""
    try:
        created = mcp_servers_store.create_server(req.model_dump())
    except mcp_servers_store.McpServerError as e:
        raise CortexAPIError(409, "MCP_SERVER_CONFLICT", str(e))
    return _with_status(created, _runtime_status_map())


@router.put("/mcp/servers/{server_id}", response_model=McpServerWithStatus)
async def update_server(server_id: str, req: McpServerUpdate):
    """更新配置（env/headers 值传 *** = 保留原值）。改连接参数会触发重连。"""
    updates = req.model_dump(exclude_unset=True)
    try:
        updated = mcp_servers_store.update_server(server_id, updates)
    except mcp_servers_store.McpServerError as e:
        msg = str(e)
        status = 404 if msg.startswith("服务器不存在") else 409
        code = "MCP_SERVER_NOT_FOUND" if status == 404 else "MCP_SERVER_CONFLICT"
        raise CortexAPIError(status, code, msg)
    return _with_status(updated, _runtime_status_map())


@router.patch("/mcp/servers/{server_id}/enabled", response_model=McpServerWithStatus)
async def set_enabled(server_id: str, req: McpServerEnabledPatch):
    """切换启用位：停用即收割会话下架工具；启用即异步重连。"""
    try:
        updated = mcp_servers_store.set_enabled(server_id, req.enabled)
    except mcp_servers_store.McpServerError as e:
        raise CortexAPIError(404, "MCP_SERVER_NOT_FOUND", str(e))
    return _with_status(updated, _runtime_status_map())


@router.delete("/mcp/servers/{server_id}")
async def delete_server(server_id: str):
    """删除配置并收割其会话（后台 reconcile 执行）。"""
    deleted = mcp_servers_store.delete_server(server_id)
    if not deleted:
        raise CortexAPIError(404, "MCP_SERVER_NOT_FOUND", f"服务器不存在: {server_id}")
    return {"ok": True}


@router.get("/mcp/servers/{server_id}/tools", response_model=McpToolsResponse)
async def list_server_tools(server_id: str):
    """该服务器当前已拉取的工具清单（含注册名）。仅 ok 状态有内容。"""
    from doclens.mcp_client import get_mcp_client_manager

    if mcp_servers_store.get_server(server_id) is None:
        raise CortexAPIError(404, "MCP_SERVER_NOT_FOUND", f"服务器不存在: {server_id}")
    from doclens.web_v2.models.mcp_server import MCP_MAX_TOOLS_PER_SERVER

    tools = get_mcp_client_manager().server_tools(server_id) or []
    return McpToolsResponse(
        tools=tools,
        truncated=len(tools) >= MCP_MAX_TOOLS_PER_SERVER,
    )


@router.post("/mcp/servers/{server_id}/reconnect")
async def reconnect_server(server_id: str):
    """手动重连（failed 状态用；收割后下轮 reconcile 自动重建）。"""
    from doclens.mcp_client import get_mcp_client_manager

    if mcp_servers_store.get_server(server_id) is None:
        raise CortexAPIError(404, "MCP_SERVER_NOT_FOUND", f"服务器不存在: {server_id}")
    ok = get_mcp_client_manager().reconnect(server_id)
    return {"ok": ok}
