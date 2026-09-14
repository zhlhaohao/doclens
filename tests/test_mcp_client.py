"""MCP client 测试（ADR-0014）：store CRUD/脱敏 + 结果归一 + 工具命名。

每个用例用独立临时目录隔离 mcp_servers.json，互不污染真实配置。
连接/管理器全链路测试见 test_mcp_client_e2e.py（stdio echo fixture）。
"""
from pathlib import Path

import pytest
from mcp.types import CallToolResult, TextContent

from doclens.mcp_client import (
    normalize_tool_result,
    tool_registered_name,
)
from doclens.web_v2 import mcp_servers_store


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    """把全局配置目录重定向到临时目录。"""
    monkeypatch.setattr(mcp_servers_store, "get_global_cortex_dir", lambda: Path(tmp_path))
    yield


def _stdio(**over):
    base = {
        "name": "echo",
        "transport": "stdio",
        "command": "python",
        "args": ["server.py"],
        "env": {"TOKEN": "secret1"},
    }
    base.update(over)
    return base


# ---------- store ----------

def test_create_masks_env_and_headers():
    s = mcp_servers_store.create_server(_stdio())
    assert s["env"] == {"TOKEN": "***"}
    raw = mcp_servers_store.get_server_raw(s["id"])
    assert raw["env"] == {"TOKEN": "secret1"}


def test_create_http_masks_headers():
    s = mcp_servers_store.create_server({
        "name": "h", "transport": "http", "url": "http://x/mcp",
        "headers": {"Authorization": "Bearer abc"},
    })
    assert s["headers"] == {"Authorization": "***"}


def test_name_unique_case_insensitive():
    mcp_servers_store.create_server(_stdio())
    with pytest.raises(mcp_servers_store.McpServerError, match="同名"):
        mcp_servers_store.create_server(_stdio(name="ECHO"))


def test_stdio_requires_command():
    with pytest.raises(mcp_servers_store.McpServerError, match="command"):
        mcp_servers_store.create_server({"name": "x", "transport": "stdio", "command": ""})


def test_http_requires_url():
    with pytest.raises(mcp_servers_store.McpServerError, match="url"):
        mcp_servers_store.create_server({"name": "x", "transport": "http"})


def test_update_mask_placeholder_keeps_original():
    s = mcp_servers_store.create_server(_stdio())
    mcp_servers_store.update_server(s["id"], {
        "env": {"TOKEN": "***", "EXTRA": "new"},
        "notes": "n",
    })
    raw = mcp_servers_store.get_server_raw(s["id"])
    assert raw["env"] == {"TOKEN": "secret1", "EXTRA": "new"}
    assert raw["notes"] == "n"


def test_update_renamed_conflict():
    a = mcp_servers_store.create_server(_stdio())
    mcp_servers_store.create_server(_stdio(name="other"))
    with pytest.raises(mcp_servers_store.McpServerError, match="同名"):
        mcp_servers_store.update_server(a["id"], {"name": "OTHER"})


def test_set_enabled_roundtrip():
    s = mcp_servers_store.create_server(_stdio())
    out = mcp_servers_store.set_enabled(s["id"], False)
    assert out["enabled"] is False
    assert mcp_servers_store.get_server_raw(s["id"])["enabled"] is False


def test_delete():
    s = mcp_servers_store.create_server(_stdio())
    assert mcp_servers_store.delete_server(s["id"]) is True
    assert mcp_servers_store.get_server(s["id"]) is None
    assert mcp_servers_store.delete_server(s["id"]) is False


def test_get_all_raw_unmasked():
    mcp_servers_store.create_server(_stdio())
    all_raw = mcp_servers_store.get_all_raw()
    assert all_raw[0]["env"] == {"TOKEN": "secret1"}


def test_corrupt_file_returns_empty():
    mcp_servers_store._servers_path().parent.mkdir(parents=True, exist_ok=True)
    mcp_servers_store._servers_path().write_text("not json", encoding="utf-8")
    assert mcp_servers_store.list_servers() == []


# ---------- normalize_tool_result ----------

def test_normalize_multi_text_joins():
    r = CallToolResult(content=[
        TextContent(type="text", text="a"),
        TextContent(type="text", text="b"),
    ])
    assert normalize_tool_result(r) == "a\n\nb"


def test_normalize_is_error_prefix():
    r = CallToolResult(content=[TextContent(type="text", text="boom")], is_error=True)
    assert normalize_tool_result(r) == "Error: boom"


def test_normalize_empty_error_has_fallback_text():
    r = CallToolResult(content=[], is_error=True)
    assert normalize_tool_result(r) == "Error: MCP tool error"


def test_normalize_structured_only_when_no_text():
    r = CallToolResult(
        content=[],
        structured_content={"result": 42},
    )
    assert '"result"' in normalize_tool_result(r)


def test_normalize_structured_skipped_when_text_present():
    """SDK 2.0 自动生成的 structuredContent 与文本重复——有文本就不附加。"""
    r = CallToolResult(
        content=[TextContent(type="text", text="hello")],
        structured_content={"result": "hello"},
    )
    assert normalize_tool_result(r) == "hello"


def test_normalize_truncates_long_output():
    r = CallToolResult(content=[TextContent(type="text", text="x" * 40000)])
    out = normalize_tool_result(r)
    assert len(out) < 40000
    assert "已截断" in out


# ---------- naming ----------

def test_tool_registered_name():
    assert tool_registered_name("ctx", "query-docs") == "mcp__ctx__query-docs"


# ---------- reconcile 脏标记（日志刷屏修复） ----------


def _make_manager_with_sync_counter(monkeypatch):
    """McpClientManager + _sync_runtime_tools 调用计数。"""
    from doclens.mcp_client import McpClientManager, _ServerConnection

    mgr = McpClientManager()
    calls = []
    monkeypatch.setattr(mgr, "_sync_runtime_tools", lambda: calls.append(1))
    return mgr, calls, _ServerConnection


def test_reconcile_no_change_no_sync(monkeypatch):
    """无配置变化时不同步工具表（修复前每轮轮询刷一条 INFO 日志）。"""
    import asyncio

    mgr, calls, _ = _make_manager_with_sync_counter(monkeypatch)
    monkeypatch.setattr(mcp_servers_store, "get_all_raw", lambda: [])
    for _ in range(5):
        asyncio.run(mgr._reconcile_once())  # noqa: SLF001
    assert calls == []


def test_reconcile_disabled_first_seen_no_sync(monkeypatch):
    """首次见到 disabled server（不建连接只补壳）：工具表未变，不同步。"""
    import asyncio

    mgr, calls, _ = _make_manager_with_sync_counter(monkeypatch)
    cfg = {"id": "srv1", "name": "echo", "transport": "stdio",
           "command": "python", "enabled": False}
    monkeypatch.setattr(mcp_servers_store, "get_all_raw", lambda: [dict(cfg)])
    asyncio.run(mgr._reconcile_once())  # noqa: SLF001
    asyncio.run(mgr._reconcile_once())  # noqa: SLF001
    assert calls == []
    assert mgr._connections["srv1"].status == "disabled"  # noqa: SLF001


def test_reconcile_reap_triggers_sync(monkeypatch):
    """配置删除 → 收割连接 → 同步一次（工具表真变了）。"""
    import asyncio

    mgr, calls, conn_cls = _make_manager_with_sync_counter(monkeypatch)
    cfg = {"id": "srv1", "name": "echo", "transport": "stdio", "command": "python"}
    mgr._connections["srv1"] = conn_cls(cfg)  # noqa: SLF001
    monkeypatch.setattr(mcp_servers_store, "get_all_raw", lambda: [])
    asyncio.run(mgr._reconcile_once())  # noqa: SLF001
    assert len(calls) == 1
    assert mgr._connections == {}  # noqa: SLF001
    # 第二轮无变化 → 不再同步
    asyncio.run(mgr._reconcile_once())  # noqa: SLF001
    assert len(calls) == 1

