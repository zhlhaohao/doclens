"""GUI 路径集成：deps.start_mcp_server 真起 server 并可被 MCP 客户端访问。"""
import socket

import pytest
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamable_http_client

from doclens.web_v2 import deps


def _free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


@pytest.fixture
def mcp_port(monkeypatch: pytest.MonkeyPatch) -> int:
    port = _free_port()
    monkeypatch.setenv("CORTEX_MCP_ENABLED", "true")
    monkeypatch.setenv("CORTEX_MCP_PORT", str(port))
    monkeypatch.setenv("CORTEX_MCP_HOST", "127.0.0.1")
    monkeypatch.delenv("CORTEX_MCP_TOKEN", raising=False)
    return port


async def test_deps_start_mcp_server_serves_tools(
    mcp_port: int, temp_workdir, env_cortex_config
):
    """deps.start_mcp_server（lifespan 调用的同一函数）真起 server，
    MCP 客户端 list_tools 能看到 search_kb / read_document。"""
    deps.reset_singletons()
    started = await deps.start_mcp_server()
    assert started is True
    try:
        url = f"http://127.0.0.1:{mcp_port}/mcp"
        async with streamable_http_client(url) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                resp = await session.list_tools()
                names = sorted(t.name for t in resp.tools)
        assert "search_kb" in names
        assert "read_document" in names
    finally:
        deps.stop_mcp_server()
        deps.reset_singletons()


async def test_deps_start_mcp_server_disabled(monkeypatch: pytest.MonkeyPatch):
    """mcp_enabled=False 时返回 False 且不起 server。"""
    monkeypatch.setenv("CORTEX_MCP_ENABLED", "false")
    deps.reset_singletons()
    started = await deps.start_mcp_server()
    assert started is False
    deps.reset_singletons()
