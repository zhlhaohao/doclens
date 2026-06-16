"""app.py /api/health 端点测试。"""
import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.app import create_app


@pytest.mark.asyncio
async def test_health_returns_ok():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert "version" in body
