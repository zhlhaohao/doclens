"""MCP client 管理器全链路 e2e（ADR-0014）：stdio echo fixture。

真实拉起子进程 server（tests/fixtures/mcp_echo_server_fixture.py），验证：
连接 → list_tools → 工具注入 runtime → 跨线程调用 → 停用下架 → 删除收割。
Windows 上 stdio 子进程握手较慢，用例超时放宽。
"""
import sys
import time
from pathlib import Path

import pytest

from doclens.web_v2 import mcp_servers_store

FIXTURE = Path(__file__).parent / "fixtures" / "mcp_echo_server_fixture.py"


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    monkeypatch.setattr(mcp_servers_store, "get_global_cortex_dir", lambda: Path(tmp_path))
    yield


class _FakeRuntime:
    """最小 runtime 替身：只承载 tools / tool_handlers（chat 现读的字段）。"""

    def __init__(self):
        self.tools = [{"name": "bash", "description": "x", "input_schema": {}}]
        self.tool_handlers = {"bash": lambda **kw: "ok"}


def _wait_status(mgr, server_id, want, timeout=30.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        for s in mgr.status_snapshot():
            if s["server_id"] == server_id and s["status"] == want:
                return s
        time.sleep(0.3)
    return None


@pytest.fixture
def manager():
    from doclens.mcp_client import McpClientManager

    mgr = McpClientManager()
    mgr.start(runtime=_FakeRuntime())
    yield mgr
    mgr.stop()



def test_stdio_full_lifecycle(manager):
    created = mcp_servers_store.create_server({
        "name": "echo",
        "transport": "stdio",
        "command": sys.executable,
        "args": ["-X", "utf8", str(FIXTURE)],
        "env": {},
        "timeout": 15,
    })
    sid = created["id"]

    # 连接成功 + 工具注入
    snap = _wait_status(manager, sid, "ok")
    assert snap is not None, manager.status_snapshot()
    assert snap["tool_count"] == 1

    rt = manager._runtime
    names = [t["name"] for t in rt.tools]
    assert "bash" in names  # 原有工具不受影响
    assert "mcp__echo__echo" in names
    tool_def = next(t for t in rt.tools if t["name"] == "mcp__echo__echo")
    assert "来自 MCP server: echo" in tool_def["description"]
    assert "text" in tool_def["input_schema"].get("properties", {})

    # server_tools 清单带注册名
    info = manager.server_tools(sid)
    assert info and info[0]["registered_name"] == "mcp__echo__echo"

    # 跨线程调用（模拟 uvicorn 请求 loop 上的同步 handler）
    result = rt.tool_handlers["mcp__echo__echo"](text="你好 MCP")
    assert result == "你好 MCP"

    # 停用 → 工具下架
    mcp_servers_store.set_enabled(sid, False)
    deadline = time.time() + 15
    while time.time() < deadline and "mcp__echo__echo" in [t["name"] for t in rt.tools]:
        time.sleep(0.3)
    assert "mcp__echo__echo" not in [t["name"] for t in rt.tools]

    # 删除 → 状态消失
    mcp_servers_store.delete_server(sid)
    deadline = time.time() + 15
    while time.time() < deadline and any(
        s["server_id"] == sid for s in manager.status_snapshot()
    ):
        time.sleep(0.3)
    assert not any(s["server_id"] == sid for s in manager.status_snapshot())



def test_failed_server_does_not_block(manager):
    """坏命令的 server 降级 failed，不阻塞其他工具。"""
    bad = mcp_servers_store.create_server({
        "name": "bad", "transport": "stdio",
        "command": "definitely_not_exist_cmd_xyz",
    })
    snap = _wait_status(manager, bad["id"], "failed", timeout=30)
    assert snap is not None
    assert snap["error"]
    assert "bash" in [t["name"] for t in manager._runtime.tools]
