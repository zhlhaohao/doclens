"""start_mcp_server 守卫逻辑与失败隔离测试。"""
import socket
from pathlib import Path
from types import SimpleNamespace

import pytest
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamable_http_client

from doclens import mcp_server


class _FakeIdx:
    max_results = 10


def _config(**overrides) -> SimpleNamespace:
    base = dict(mcp_enabled=True, mcp_host="127.0.0.1", mcp_port=7880, mcp_token=None)
    base.update(overrides)
    return SimpleNamespace(**base)


# ---- 守卫逻辑 ----


def test_assert_host_safe_rejects_non_loopback_without_token():
    with pytest.raises(ValueError):
        mcp_server.assert_mcp_host_safe("0.0.0.0", None)


def test_assert_host_safe_allows_loopback_without_token():
    # 不抛异常即通过
    mcp_server.assert_mcp_host_safe("127.0.0.1", None)


def test_assert_host_safe_allows_non_loopback_with_token():
    mcp_server.assert_mcp_host_safe("0.0.0.0", "secret")


# ---- start_mcp_server 失败隔离 ----


def test_start_returns_none_when_disabled(tmp_path: Path):
    handle = mcp_server.start_mcp_server(_FakeIdx(), tmp_path, _config(mcp_enabled=False))
    assert handle is None


def test_start_returns_none_when_non_loopback_without_token(tmp_path: Path):
    handle = mcp_server.start_mcp_server(
        _FakeIdx(), tmp_path, _config(mcp_host="0.0.0.0", mcp_token=None)
    )
    assert handle is None


# ---- 启动提示文案（绝不能泄漏 token 值） ----


def test_startup_message_includes_url():
    handle = SimpleNamespace(url="http://127.0.0.1:8001/mcp")
    msg = mcp_server.mcp_startup_message(handle, _config(mcp_token=None))
    assert "http://127.0.0.1:8001/mcp" in msg


def test_startup_message_never_leaks_token_value():
    handle = SimpleNamespace(url="http://127.0.0.1:8001/mcp")
    msg = mcp_server.mcp_startup_message(handle, _config(mcp_token="supersecret-value"))
    assert "supersecret-value" not in msg
    assert "token" in msg.lower()


# ---- 集成：真起 server，用 MCP 客户端 list_tools ----


def _free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


async def _wait_until_listening(host: str, port: int, timeout: float = 5.0) -> None:
    import time

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.2):
                return
        except OSError:
            time.sleep(0.05)
    raise TimeoutError(f"server on {host}:{port} 未在 {timeout}s 内就绪")


async def test_start_serves_tools_over_http(tmp_path: Path):
    port = _free_port()
    cfg = _config(mcp_port=port)
    handle = mcp_server.start_mcp_server(_FakeIdx(), tmp_path, cfg)
    assert handle is not None
    try:
        assert handle.url == f"http://127.0.0.1:{port}/mcp"
        await _wait_until_listening("127.0.0.1", port)
        async with streamable_http_client(handle.url) as (read, write, _getsessionid):
            async with ClientSession(read, write) as session:
                await session.initialize()
                resp = await session.list_tools()
                names = sorted(t.name for t in resp.tools)
        assert "search_kb" in names
        assert "read_document" in names
    finally:
        handle.stop()

