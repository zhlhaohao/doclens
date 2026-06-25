"""GET /api/status 测试。"""
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


def _init_and_reindex():
    """在非事件循环线程中初始化 IndexManager 并建索引。"""
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


@pytest.mark.asyncio
async def test_status_returns_index_info(env_cortex_config, reset_deps, temp_workdir):
    # 在子线程中完成索引初始化（TreeSearch.index 是同步的，不能在事件循环内调用）
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/status")

    assert res.status_code == 200
    body = res.json()
    assert body["indexed_docs"] >= 0
    assert "index_path" in body
    # file_types should contain extensions for doc1.md and doc2.py from temp_workdir.
    # .md is always indexed (no extra deps); .py requires tree-sitter languages.
    assert ".md" in body["file_types"]
    # total_size_bytes should be > 0 because temp_workdir's doc1.md has content.
    assert body["total_size_bytes"] > 0
