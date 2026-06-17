"""POST /api/search 测试。"""
import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2 import deps
from cortex.web_v2.app import create_app


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
async def test_search_returns_results(env_cortex_config, reset_deps, temp_workdir):
    # 在子线程中完成索引初始化（TreeSearch.index 是同步的，不能在事件循环内调用）
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": "hello"})

    assert res.status_code == 200
    body = res.json()
    assert "results" in body
    assert isinstance(body["results"], list)
    assert body["query"] == "hello"
    assert body["total"] == len(body["results"])
    assert body["elapsed_ms"] >= 0


@pytest.mark.asyncio
async def test_search_rejects_empty_query(env_cortex_config, reset_deps):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": ""})
    assert res.status_code == 422  # Pydantic 校验失败


@pytest.mark.asyncio
async def test_search_path_can_be_previewed(env_cortex_config, reset_deps, temp_workdir):
    """搜索返回的 path 必须能被 /api/preview 解析为真实文件。

    Regression: 早期版本 path 仅取 doc_name（无扩展名/子目录），
    导致点击卡片后预览 404。
    """
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": "hello"})
        assert res.status_code == 200
        body = res.json()
        assert body["results"], "应至少返回一条结果"

        for r in body["results"]:
            path = r["path"]
            # path 必须带扩展名（doc1.md 而不是 doc1），否则 preview 会 404
            assert "." in path, f"path 缺少扩展名: {path!r}"
            preview = await client.get("/api/preview", params={"path": path})
            assert preview.status_code == 200, (
                f"preview 失败 path={path!r} status={preview.status_code} body={preview.text}"
            )
            assert preview.json()["content"], f"preview 内容为空 path={path!r}"
