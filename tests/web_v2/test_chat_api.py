"""POST /api/chat (SSE) 测试。"""
import json

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.app import create_app


@pytest.mark.asyncio
async def test_chat_returns_sse_stream(env_cortex_config, temp_workdir, monkeypatch):
    """用 mock agent 验证 SSE 格式（不真实调用 LLM）。"""
    from cortex.web_v2 import deps

    class _FakeAgent:
        def __init__(self):
            self.session = type("S", (), {"session_id": "test"})()

    async def _fake_stream(message, session_id):
        for chunk in ["Hello", " ", "world"]:
            yield chunk

    monkeypatch.setattr(deps, "get_agent", lambda: _FakeAgent())
    import cortex.web_v2.api.chat as chat_mod
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
