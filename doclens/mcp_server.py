"""doclens MCP server —— 把 KB 检索暴露为 MCP 工具（Streamable HTTP）。

TUI / GUI 在进程内后台线程启动此 server，复用同一 IndexManager 单例，
与 FileWatcher 实时索引共享同一份索引数据。

工具面（与 Agent 现用 kb_tools 三件套对齐，去掉 manage_kb）：
  - search_kb(query, max_results)
  - read_document(path, section, start_line, end_line)
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from pathlib import Path
from typing import Optional

import uvicorn
from mcp.server.mcpserver import MCPServer

from doclens.index_manager import IndexManager
from doclens.kb_tools import _handle_read_document, _handle_search_kb

logger = logging.getLogger(__name__)

# MCP Streamable HTTP 约定路径。
MCP_PATH = "/mcp"

# 仅这些地址允许无 token 启动（本机回环）。
_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})

# 启动就绪轮询上限（秒）。端口占用等 bind 错误会在此窗口内暴露。
_STARTUP_TIMEOUT = 5.0


class McpServerHandle:
    """后台 MCP HTTP server 句柄。stop() 用于优雅关停。"""

    def __init__(self, url: str, thread: threading.Thread, server: uvicorn.Server):
        self.url = url
        self._thread = thread
        self._server = server

    @property
    def port(self) -> int:
        return self._server.config.port

    @property
    def host(self) -> str:
        return self._server.config.host

    def stop(self, timeout: float = 5.0) -> None:
        """设置 should_exit 并 join 后台线程。幂等。"""
        server = self._server
        if server is not None:
            server.should_exit = True
        thread = self._thread
        if thread is not None and thread.is_alive():
            thread.join(timeout=timeout)


def create_mcp_server(idx_manager: IndexManager, workdir: Path) -> MCPServer:
    """构建 MCPServer 实例，注册 search_kb / read_document 工具。

    工具实现直接委派给 kb_tools 的同步 handler（MCPServer 自动丢进 threadpool
    执行），与 CLI `search_kb` 子命令、Agent tool-use 走完全相同的代码路径。

    注：mcp 2.0 起 FastMCP 改名为 MCPServer（import 路径 mcp.server.fastmcp
    → mcp.server.mcpserver），@tool() / streamable_http_app() 签名不变。
    """
    mcp = MCPServer("doclens-kb")

    @mcp.tool()
    async def search_kb(query: str, max_results: Optional[int] = None) -> str:
        """在知识库索引中搜索相关文档片段，返回带层次结构的搜索结果。

        支持中英文混合查询。当用户的提问与知识库内容相关时使用此工具。
        """
        # 必须丢进 worker 线程：sync handler 链路（_handle_search_kb →
        # IndexManager.search → TreeSearch.search）含 asyncio.get_running_loop()
        # 守卫，在事件循环线程里会抛 "Event loop is already running"。
        return await asyncio.to_thread(
            _handle_search_kb,
            idx_manager,
            workdir,
            query=query,
            max_results=max_results,
        )

    @mcp.tool()
    async def read_document(path: str, section: Optional[str] = None) -> str:
        """读取知识库文档的完整或部分内容（支持 md/pdf/docx/pptx/xlsx/html 等）。

        path 从 search_kb 结果中获取；section 传单个章节标题（不要拼层级路径）。
        """
        return await asyncio.to_thread(
            _handle_read_document,
            idx_manager,
            workdir,
            path=path,
            section=section,
        )

    return mcp


def assert_mcp_host_safe(host: str, token: Optional[str]) -> None:
    """非环回地址必须配 token，否则拒绝启动。

    MCP server 暴露的是 KB 检索（可能含敏感文档）。环回地址仅本机可访问，
    可不鉴权；一旦绑定到网卡地址（LAN 可达），必须带 bearer token。
    """
    if host not in _LOOPBACK_HOSTS and not token:
        raise ValueError(
            f"MCP server 绑定非环回地址 {host} 但未设置 CORTEX_MCP_TOKEN；"
            "出于安全考虑拒绝启动。请设置 token 或改回 127.0.0.1。"
        )


def _run_uvicorn(server: uvicorn.Server) -> None:
    """后台线程入口：新建独立事件循环跑 server.serve()。

    uvicorn 的 capture_signals() 在非主线程自动跳过 signal 注册，故可安全
    在后台线程运行；外部通过 server.should_exit 触发优雅退出。
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(server.serve())
    except Exception:  # noqa: BLE001
        logger.exception("MCP server serve() 异常退出")
    finally:
        try:
            loop.close()
        except Exception:  # noqa: BLE001
            pass


def _display_host(host: str) -> str:
    """0.0.0.0 等通配地址在给用户的 URL 里换成 127.0.0.1（可直连）。"""
    if host in ("0.0.0.0", "::"):
        return "127.0.0.1"
    return host


def mcp_startup_message(handle: McpServerHandle, config) -> str:
    """构造给用户的启动提示文案。

    安全约束：绝不输出 token 值本身，只提示客户端需要配 bearer token。
    """
    line = f"MCP server: {handle.url}"
    if config.mcp_token:
        line += "  (需 bearer token: 见 CORTEX_MCP_TOKEN)"
    return line


def start_mcp_server(
    idx_manager: IndexManager,
    workdir: Path,
    config,
) -> Optional[McpServerHandle]:
    """在后台线程启动 MCP HTTP server。

    失败一律返回 None（不抛穿），由调用方决定是否提示用户：
      - config.mcp_enabled=False：静默跳过。
      - 非环回地址未配 token：记 warning 后跳过。
      - 端口占用/启动异常：记 exception 后跳过。

    成功返回 McpServerHandle（含 url、stop()）。
    """
    if not config.mcp_enabled:
        logger.info("MCP server disabled by config (mcp_enabled=False)")
        return None

    try:
        assert_mcp_host_safe(config.mcp_host, config.mcp_token)
    except ValueError as exc:
        logger.warning("MCP server 未启动: %s", exc)
        return None

    try:
        app = create_mcp_server(idx_manager, workdir).streamable_http_app()
        uv_config = uvicorn.Config(
            app,
            host=config.mcp_host,
            port=config.mcp_port,
            log_level="warning",
        )
        server = uvicorn.Server(uv_config)
        thread = threading.Thread(
            target=_run_uvicorn, args=(server,), daemon=True, name="doclens-mcp"
        )
        thread.start()

        # 轮询就绪：bind 失败时 startup() 抛异常、started 保持 False、线程退出。
        deadline = time.time() + _STARTUP_TIMEOUT
        while time.time() < deadline and not server.started:
            if not thread.is_alive():
                logger.error("MCP server 线程提前退出（端口 %s 可能被占用）", config.mcp_port)
                return None
            time.sleep(0.05)
        if not server.started:
            logger.warning("MCP server 启动超时（%ss）", _STARTUP_TIMEOUT)
            server.should_exit = True
            return None

        url = f"http://{_display_host(config.mcp_host)}:{config.mcp_port}{MCP_PATH}"
        logger.info("MCP server 已启动: %s", url)
        return McpServerHandle(url=url, thread=thread, server=server)
    except Exception:  # noqa: BLE001
        logger.exception("MCP server 启动失败")
        return None
