"""POST /api/reindex SSE 测试。"""
import asyncio
import threading

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
    return deps.get_index_manager()


@pytest.mark.asyncio
async def test_reindex_streams_progress_then_done(env_cortex_config, reset_deps, temp_workdir, monkeypatch):
    await asyncio.to_thread(_init)
    idx = deps.get_index_manager()

    captured = {}

    def fake_trigger(force=False, on_progress=None, on_complete=None):
        captured["force"] = force

        def _bg():
            # 模拟后台进度 + 完成
            if on_progress:
                on_progress("/tmp/a.md", 1)
                on_progress("/tmp/b.md", 2)
            if on_complete:
                on_complete(True, 2, 0)

        threading.Thread(target=_bg, daemon=True).start()
        return None

    monkeypatch.setattr(idx, "trigger_background_reindex", fake_trigger)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/reindex")

    assert res.status_code == 200
    assert captured["force"] is True  # force=True 透传
    body = res.text
    assert "progress" in body
    assert "done" in body
    assert "current_file" in body
    assert "doc_count" in body


@pytest.mark.asyncio
async def test_reindex_streams_error_on_failure(env_cortex_config, reset_deps, temp_workdir, monkeypatch):
    await asyncio.to_thread(_init)
    idx = deps.get_index_manager()

    def fake_trigger(force=False, on_progress=None, on_complete=None):
        def _bg():
            if on_complete:
                on_complete(False, 0, 0)
        threading.Thread(target=_bg, daemon=True).start()
        return None

    monkeypatch.setattr(idx, "trigger_background_reindex", fake_trigger)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/reindex")

    assert res.status_code == 200
    assert "done" in res.text
    assert '"success": false' in res.text
