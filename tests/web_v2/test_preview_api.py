"""GET /api/preview 测试。"""
import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.app import create_app


@pytest.mark.asyncio
async def test_preview_returns_file_content(temp_workdir, env_cortex_config):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "doc1.md"})
    assert res.status_code == 200
    body = res.json()
    assert "Hello world" in body["content"]
    assert body["path"] == "doc1.md"


@pytest.mark.asyncio
async def test_preview_404_for_missing_file(temp_workdir, env_cortex_config):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "nonexistent.md"})
    assert res.status_code == 404
    assert res.json()["code"] == "FILE_NOT_FOUND"
