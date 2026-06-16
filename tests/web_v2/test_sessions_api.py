"""/api/sessions CRUD 测试。"""
from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.app import create_app
from cortex.web_v2.sessions_store import SessionType, SessionsStore


@pytest.fixture
def patched_store(monkeypatch, tmp_path):
    """用临时 db 替换全局 store。"""
    store = SessionsStore(tmp_path / "sessions.db")
    import cortex.web_v2.api.sessions as mod
    monkeypatch.setattr(mod, "_get_store", lambda: store)
    return store


@pytest.mark.asyncio
async def test_create_session_returns_id(patched_store):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/sessions", json={
            "type": "chat",
            "title": "test chat",
            "preview": "hello",
        })
    assert res.status_code == 200
    body = res.json()
    assert "id" in body
    assert body["title"] == "test chat"


@pytest.mark.asyncio
async def test_list_sessions_filter_by_type(patched_store):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/sessions", json={"type": "chat", "title": "c1", "preview": "p"})
        await client.post("/api/sessions", json={"type": "search", "title": "s1", "preview": "p"})
        res = await client.get("/api/sessions", params={"type": "chat"})
    assert res.status_code == 200
    body = res.json()
    assert len(body["sessions"]) == 1
    assert body["sessions"][0]["title"] == "c1"


@pytest.mark.asyncio
async def test_delete_session(patched_store):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_res = await client.post("/api/sessions", json={
            "type": "chat", "title": "to-delete", "preview": "p",
        })
        sid = create_res.json()["id"]
        del_res = await client.delete(f"/api/sessions/{sid}")
    assert del_res.status_code == 200
    assert del_res.json()["ok"] is True
