"""GET /api/watch/status 测试。"""
import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from doclens.web_v2 import deps
from doclens.web_v2.app import create_app


@pytest.fixture
def reset_deps():
    deps.reset_singletons()
    yield
    deps.reset_singletons()


def _init():
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


@pytest.mark.asyncio
async def test_watch_status_no_watcher(env_cortex_config, reset_deps, temp_workdir):
    """watcher 未启动时返回 watcher:null。"""
    await asyncio.to_thread(_init)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/watch/status")
    assert res.status_code == 200
    body = res.json()
    assert body["enabled"] is True
    assert body["watcher"] is None


@pytest.mark.asyncio
async def test_watch_status_with_watcher_running(env_cortex_config, reset_deps, temp_workdir):
    """start_watcher 后返回 watcher 快照，running=true。"""
    await asyncio.to_thread(_init)
    deps.start_watcher()
    try:
        app = create_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/watch/status")
        body = res.json()
        assert body["watcher"] is not None
        assert body["watcher"]["running"] is True
        assert "changed_count" in body["watcher"]
        assert "last_reindex_at" in body["watcher"]
    finally:
        deps.stop_watcher()
