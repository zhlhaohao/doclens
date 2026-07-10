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


@pytest.mark.asyncio
async def test_status_includes_watcher_field(env_cortex_config, reset_deps, temp_workdir):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/status")
    body = res.json()
    assert "watcher" in body
    # watcher 未启动时应返回默认字典（包含 enabled 字段），而非 None
    assert isinstance(body["watcher"], dict)
    assert "enabled" in body["watcher"]
    assert "running" in body["watcher"]
    assert "reindexing" in body["watcher"]
    assert "changed_count" in body["watcher"]
    assert "last_reindex_at" in body["watcher"]
    assert "last_doc_count" in body["watcher"]
    assert "last_success" in body["watcher"]
    # 未启动时所有状态字段应为默认值
    assert body["watcher"]["running"] is False
    assert body["watcher"]["reindexing"] is False
    assert body["watcher"]["changed_count"] == 0
    assert body["watcher"]["last_reindex_at"] is None
    assert body["watcher"]["last_doc_count"] is None
    assert body["watcher"]["last_success"] is None
