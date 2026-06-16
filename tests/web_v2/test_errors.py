"""CortexAPIError 异常处理器测试。"""
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.api.errors import CortexAPIError, register_error_handlers


def _build_app() -> FastAPI:
    app = FastAPI()

    @app.get("/raise")
    async def _raise():
        raise CortexAPIError(status=404, code="TEST_NOT_FOUND", detail="thing missing")

    register_error_handlers(app)
    return app


@pytest.mark.asyncio
async def test_cortex_api_error_returns_json():
    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/raise")
    assert res.status_code == 404
    body = res.json()
    assert body["code"] == "TEST_NOT_FOUND"
    assert body["detail"] == "thing missing"
