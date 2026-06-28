"""POST /api/grep 测试。"""
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
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


@pytest.mark.asyncio
async def test_grep_returns_results_with_grep_source(env_cortex_config, reset_deps, temp_workdir):
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/grep", json={"pattern": "hello"})

    assert res.status_code == 200
    body = res.json()
    assert body["query"] == "hello"
    assert body["source"] == "grep"
    assert isinstance(body["results"], list)
    assert body["total"] == len(body["results"]) + body["offset"]
    for r in body["results"]:
        assert r["kind"] in ("content", "path")
        assert r["path"]  # 非空


@pytest.mark.asyncio
async def test_grep_rejects_empty_pattern(env_cortex_config, reset_deps):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/grep", json={"pattern": ""})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_grep_no_match_returns_empty(env_cortex_config, reset_deps, temp_workdir):
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/grep", json={"pattern": "zzz_no_such_xyz"})

    body = res.json()
    assert body["total"] == 0
    assert body["results"] == []
    assert body["source"] == "grep"


@pytest.mark.asyncio
async def test_grep_offset_slices_second_page(temp_workdir, env_cortex_config, reset_deps):
    # 造多个含相同词的文件，验证 offset 分页：第二页与第一页不重叠。
    # （grep 引擎对结果有自身的去重/封顶，total 不一定等于文件数；用小 limit 稳健验证。）
    for i in range(25):
        (temp_workdir / f"grep_match_{i:02d}.md").write_text(
            f"# Doc {i}\n\nThis file has grepfoo token number {i}.\n", encoding="utf-8"
        )
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res1 = await client.post("/api/grep", json={"pattern": "grepfoo", "limit": 5, "offset": 0})
        res2 = await client.post("/api/grep", json={"pattern": "grepfoo", "limit": 5, "offset": 5})

    b1, b2 = res1.json(), res2.json()
    assert b1["total"] == b2["total"]  # 同一查询 total 一致
    assert b1["total"] > 5, "需要足够结果分两页"
    assert len(b1["results"]) == 5
    assert b2["offset"] == 5
    p1 = {r["path"] for r in b1["results"]}
    p2 = {r["path"] for r in b2["results"]}
    assert p1.isdisjoint(p2)
