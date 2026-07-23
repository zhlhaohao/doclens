"""create_mcp_server 工具注册与 kb_tools 委派测试。"""
from pathlib import Path

from doclens import mcp_server


class _FakeIdx:
    """最小 IndexManager 替身。"""

    max_results = 10


async def test_create_mcp_server_registers_search_and_read(tmp_path: Path):
    mcp = mcp_server.create_mcp_server(_FakeIdx(), workdir=tmp_path)
    names = sorted(t.name for t in await mcp.list_tools())
    assert "search_kb" in names
    assert "read_document" in names


async def test_search_kb_delegates_to_kb_tools(monkeypatch, tmp_path: Path):
    captured: dict = {}

    def spy_search(idx, workdir, *, query, max_results=None):
        captured.update(idx=idx, workdir=workdir, query=query, max_results=max_results)
        return "SENTINEL_SEARCH"

    monkeypatch.setattr(mcp_server, "_handle_search_kb", spy_search)

    idx = _FakeIdx()
    mcp = mcp_server.create_mcp_server(idx, workdir=tmp_path)
    content, _structured = await mcp.call_tool("search_kb", {"query": "量子", "max_results": 5})

    assert captured["idx"] is idx
    assert captured["workdir"] == tmp_path
    assert captured["query"] == "量子"
    assert captured["max_results"] == 5
    assert content[0].text == "SENTINEL_SEARCH"


async def test_read_document_delegates_to_kb_tools(monkeypatch, tmp_path: Path):
    captured: dict = {}

    def spy_read(idx, workdir, *, path, section=None, start_line=None, end_line=None):
        # _handle_read_document 仍保留 start_line/end_line（CLI 在用），
        # 但 MCP tool 不暴露这俩参数 → 永远走 handler 默认 None。
        captured.update(path=path, section=section, start_line=start_line, end_line=end_line)
        return "SENTINEL_READ"

    monkeypatch.setattr(mcp_server, "_handle_read_document", spy_read)

    mcp = mcp_server.create_mcp_server(_FakeIdx(), workdir=tmp_path)
    content, _structured = await mcp.call_tool(
        "read_document", {"path": "a.md", "section": "Intro"}
    )

    assert captured["path"] == "a.md"
    assert captured["section"] == "Intro"
    # MCP 层不传行号 → handler 收到默认 None
    assert captured["start_line"] is None
    assert captured["end_line"] is None
    assert content[0].text == "SENTINEL_READ"


async def test_read_document_schema_excludes_line_params(tmp_path: Path):
    """read_document 只暴露 path + section，不暴露 start_line / end_line。"""
    mcp = mcp_server.create_mcp_server(_FakeIdx(), workdir=tmp_path)
    tools = {t.name: t for t in await mcp.list_tools()}
    props = tools["read_document"].inputSchema["properties"]
    assert set(props.keys()) == {"path", "section"}


async def test_search_kb_runs_handler_off_event_loop(monkeypatch, tmp_path: Path):
    """回归：sync handler（含 TreeSearch 的 get_running_loop 守卫）必须在
    worker 线程执行，而非 MCP server 的事件循环线程。

    真实 bug：FastMCP 1.28 把 sync tool 直接在事件循环线程跑，导致
    TreeSearch.search 抛 'Event loop is already running'。修法是 async + to_thread。
    """
    import asyncio as _asyncio

    def spy_search(idx, workdir, *, query, max_results=None):
        try:
            _asyncio.get_running_loop()
            return "RAN_IN_LOOP"  # 事件循环线程 —— 错误
        except RuntimeError:
            return "OK_NO_LOOP"  # worker 线程 —— 正确

    monkeypatch.setattr(mcp_server, "_handle_search_kb", spy_search)
    mcp = mcp_server.create_mcp_server(_FakeIdx(), workdir=tmp_path)
    content, _structured = await mcp.call_tool("search_kb", {"query": "x"})
    assert content[0].text == "OK_NO_LOOP"
