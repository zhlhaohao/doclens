"""POST /api/chat (SSE) 测试。"""
import json

import pytest
from httpx import ASGITransport, AsyncClient

from doclens.web_v2.app import create_app


@pytest.mark.asyncio
async def test_chat_returns_sse_stream(env_cortex_config, temp_workdir, monkeypatch):
    """用 mock agent 验证 SSE 格式（不真实调用 LLM）。"""
    from doclens.web_v2 import deps

    class _FakeAgent:
        def __init__(self):
            self.session = type("S", (), {"session_id": "test"})()

    async def _fake_stream(message, session_id):
        for text in ["Hello", " ", "world"]:
            yield {"type": "token", "text": text}

    monkeypatch.setattr(deps, "get_agent", lambda: _FakeAgent())
    import doclens.web_v2.api.chat as chat_mod
    monkeypatch.setattr(chat_mod, "_stream_agent_response", _fake_stream)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/chat",
            json={"message": "hi", "session_id": "test"},
        )
    assert res.status_code == 200
    # 解析 SSE：data: {...}
    lines = [l for l in res.text.split("\n") if l.startswith("data:")]
    assert len(lines) >= 2  # 至少 2 个 chunk + done
    payloads = [json.loads(l[5:].strip()) for l in lines]
    assert "text" in payloads[0]


@pytest.mark.asyncio
async def test_chat_emits_tool_call_and_result_events(env_cortex_config, temp_workdir, monkeypatch):
    """验证 chat.py 把结构化事件转成 tool_call/tool_result SSE。"""
    from doclens.web_v2 import deps

    class _FakeAgent:
        def __init__(self):
            self.session = type("S", (), {"session_id": "test"})()

    async def _fake_stream(message, session_id):
        yield {"type": "tool_call", "tool_use_id": "t1", "name": "search", "input": {"query": "x"}}
        yield {"type": "tool_result", "tool_use_id": "t1", "name": "search",
               "output": "found 1", "is_error": False, "duration_ms": 120}
        yield {"type": "token", "text": "answer"}

    monkeypatch.setattr(deps, "get_agent", lambda: _FakeAgent())
    import doclens.web_v2.api.chat as chat_mod
    monkeypatch.setattr(chat_mod, "_stream_agent_response", _fake_stream)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/chat", json={"message": "hi", "session_id": "test"})

    assert res.status_code == 200
    # 解析 SSE：按空行切块，提取 event/data（sse-starlette 使用 \r\n 行尾，先归一化）
    events = []
    for block in res.text.replace("\r\n", "\n").split("\n\n"):
        ev_type, data = None, ""
        for line in block.split("\n"):
            if line.startswith("event:"):
                ev_type = line[6:].strip()
            elif line.startswith("data:"):
                data += line[5:].strip()
        if ev_type:
            events.append((ev_type, json.loads(data) if data else {}))

    types = [e[0] for e in events]
    assert "tool_call" in types
    assert "tool_result" in types

    call_ev = next(e[1] for e in events if e[0] == "tool_call")
    assert call_ev["name"] == "search"
    assert call_ev["input"] == {"query": "x"}
    assert call_ev["is_complete"] is True

    result_ev = next(e[1] for e in events if e[0] == "tool_result")
    assert result_ev["output"] == "found 1"
    assert result_ev["is_error"] is False
    assert result_ev["duration_ms"] == 120


def _parse_sse_events(text: str) -> list[tuple[str, dict]]:
    """解析 SSE 文本为 [(event_type, payload), ...]（sse-starlette 用 \\r\\n，先归一化）。"""
    events: list[tuple[str, dict]] = []
    for block in text.replace("\r\n", "\n").split("\n\n"):
        ev_type, data = None, ""
        for line in block.split("\n"):
            if line.startswith("event:"):
                ev_type = line[6:].strip()
            elif line.startswith("data:"):
                data += line[5:].strip()
        if ev_type:
            events.append((ev_type, json.loads(data) if data else {}))
    return events


@pytest.mark.asyncio
async def test_chat_serializes_references_event(env_cortex_config, temp_workdir, monkeypatch):
    """references 事件 → event:references SSE，items 原样透传给前端。"""
    from doclens.web_v2 import deps

    class _FakeAgent:
        def __init__(self):
            self.session = type("S", (), {"session_id": "test"})()

    async def _fake_stream(message, session_id):
        yield {"type": "references", "items": [{"path": "a/b.md"}, {"path": "c/d.md"}]}

    monkeypatch.setattr(deps, "get_agent", lambda: _FakeAgent())
    import doclens.web_v2.api.chat as chat_mod
    monkeypatch.setattr(chat_mod, "_stream_agent_response", _fake_stream)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/chat", json={"message": "hi", "session_id": "test"})

    assert res.status_code == 200
    events = _parse_sse_events(res.text)
    assert "references" in [e[0] for e in events]
    ref_ev = next(e[1] for e in events if e[0] == "references")
    assert ref_ev == {"items": [{"path": "a/b.md"}, {"path": "c/d.md"}]}
