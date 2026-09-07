"""Pydantic models for /api/mcp（ADR-0014 MCP client）。

一条 MCP 服务器配置 = 命名的外部工具源连接档案：
- ``stdio``：本地子进程（command/args/env/cwd）
- ``http``：Streamable HTTP 端点（url/headers，现行标准）
- ``sse``：旧版 HTTP+SSE 端点（url/headers，已废弃但存量不少）

含密钥（env 值 / headers 值）：明文存储，GET 脱敏，更新传 ``***`` 表示未改动。
name 全局唯一且为工具前缀来源（``mcp__<name>__<tool>``），限 ASCII 字母数字与连字符。
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field

McpTransport = Literal["stdio", "http", "sse"]

# 密钥脱敏占位（与 preset.PRESET_SECRET_MASK 同义，独立声明避免循环依赖）
MCP_SECRET_MASK = "***"

# 单服务器工具数上限（防失控 server 撑爆 AI 上下文）
MCP_MAX_TOOLS_PER_SERVER = 64

# name 合法字符：ASCII 字母数字 + 连字符 + 下划线（作为工具前缀需保守）
_NAME_PATTERN = r"^[A-Za-z0-9_-]+$"


class McpServerBase(BaseModel):
    """服务器配置公共字段。"""

    name: str = Field(
        ...,
        pattern=_NAME_PATTERN,
        min_length=1,
        max_length=32,
        description="服务器名（全局唯一，= 工具前缀 mcp__<name>__*，限字母数字连字符下划线）",
    )
    transport: McpTransport
    enabled: bool = True
    # stdio 侧
    command: str = Field(default="", description="启动命令（仅 stdio）")
    args: list[str] = Field(default_factory=list, description="命令参数（仅 stdio）")
    env: dict[str, str] = Field(
        default_factory=dict, description="子进程环境变量（仅 stdio；值明文存储，GET 脱敏）"
    )
    cwd: str = Field(default="", description="子进程工作目录（仅 stdio，可选）")
    # http / sse 侧
    url: str = Field(default="", description="服务器端点 URL（仅 http / sse）")
    headers: dict[str, str] = Field(
        default_factory=dict, description="HTTP 请求头（仅 http / sse；值明文存储，GET 脱敏）"
    )
    # 公共
    timeout: int = Field(default=30, ge=1, le=600, description="工具调用超时（秒）")
    notes: str = Field(default="", max_length=500, description="用户备注")


class McpServerCreate(McpServerBase):
    """创建请求体（name 必填且唯一）。"""


class McpServerUpdate(BaseModel):
    """更新请求体：所有字段可选，仅提供要改的字段（``exclude_unset`` 语义）。

    ``env`` / ``headers`` 的值传 ``***`` 表示该项未改动；整个字段不传 = 不改，
    传空 dict = 清空。
    """

    model_config = {"extra": "forbid"}

    name: Optional[str] = None
    transport: Optional[McpTransport] = None
    enabled: Optional[bool] = None
    command: Optional[str] = None
    args: Optional[list[str]] = None
    env: Optional[dict[str, str]] = None
    cwd: Optional[str] = None
    url: Optional[str] = None
    headers: Optional[dict[str, str]] = None
    timeout: Optional[int] = Field(default=None, ge=1, le=600)
    notes: Optional[str] = None


class McpServer(McpServerBase):
    """完整服务器配置（含 id）；密钥字段由 store 脱敏后再交给前端。"""

    id: str


class McpServerStatus(BaseModel):
    """服务器运行状态（reconcile 后轮询）。"""

    server_id: str
    status: Literal["disabled", "connecting", "ok", "failed"]
    tool_count: int = 0
    error: Optional[str] = None


class McpServerWithStatus(McpServer):
    """列表项 = 配置（脱敏）+ 运行状态合一。"""

    runtime: McpServerStatus


class McpServerListResponse(BaseModel):
    servers: list[McpServerWithStatus]


class McpServerEnabledPatch(BaseModel):
    """启用位开关请求体。"""

    enabled: bool


class McpToolInfo(BaseModel):
    """服务器暴露的单个工具（list_tools 拉取结果摘要）。"""

    name: str
    description: str = ""
    # 注册进 AI 工具表的最终名字（mcp__<server>__<tool>）
    registered_name: str


class McpToolsResponse(BaseModel):
    tools: list[McpToolInfo]
    truncated: bool = False
