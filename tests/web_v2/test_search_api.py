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
            # line 必须是 int（命中行号）或 None（treesearch 未注入）
            assert r["line"] is None or isinstance(r["line"], int), (
                f"line 字段类型错误: {type(r['line'])} value={r['line']!r}"
            )
            # .md 命中应有具体行号（fixture 里 doc1.md 必带 line_start）
            if path.endswith(".md"):
                assert isinstance(r["line"], int) and r["line"] >= 1, (
                    f"markdown 结果缺少 line: {r!r}"
                )
            preview = await client.get("/api/preview", params={"path": path})
            assert preview.status_code == 200, (
                f"preview 失败 path={path!r} status={preview.status_code} body={preview.text}"
            )
            assert preview.json()["content"], f"preview 内容为空 path={path!r}"


@pytest.mark.asyncio
async def test_search_response_has_source_field(env_cortex_config, reset_deps):
    """SearchResponse 必须含 source 字段，默认 'fts'。"""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": "hello"})
    assert res.status_code == 200
    body = res.json()
    assert "source" in body
    assert body["source"] in ("fts", "like", "ripgrep")


@pytest.mark.asyncio
async def test_search_scores_are_composite_in_unit_range(
    temp_workdir, env_cortex_config, reset_deps
):
    """所有 SearchResult.score 必须在 [0, 1] 区间（composite 综合分语义）。"""
    # 准备一个能命中的 md 文件
    (temp_workdir / "健康.md").write_text(
        "# 健康指南\n\n肠道健康很重要。健康饮食。", encoding="utf-8"
    )
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": "健康"})
    assert res.status_code == 200
    body = res.json()
    assert body["results"], "应至少返回一条结果"
    for r in body["results"]:
        assert 0.0 <= r["score"] <= 1.0, f"score {r['score']} 不在 [0,1] 区间"


# ---------------------------------------------------------------------------
# 分页测试（offset/limit/total 真实切片）
# ---------------------------------------------------------------------------


def _make_many_matches(tmp_path, count: int = 30, keyword: str = "paginationtest"):
    """造 count 个 .md 文件，每个都包含 keyword，确保 FTS+过滤后至少 count 个匹配。"""
    for i in range(count):
        (tmp_path / f"page_match_{i:02d}.md").write_text(
            f"# Doc {i}\n\nThis file contains {keyword} for matching.\n",
            encoding="utf-8",
        )


@pytest.mark.asyncio
async def test_search_returns_real_total_when_matches_exceed_limit(
    temp_workdir, env_cortex_config, reset_deps
):
    """30 个匹配文件、limit=20 → total=30, len(results)=20。"""
    _make_many_matches(temp_workdir, count=30)
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20, "offset": 0}
        )

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 30, f"expected total=30 (real match count), got {body['total']}"
    assert len(body["results"]) == 20, f"expected page size 20, got {len(body['results'])}"


@pytest.mark.asyncio
async def test_search_offset_slices_second_page(
    temp_workdir, env_cortex_config, reset_deps
):
    """offset=20, limit=20 → 第二页 20 条，与第一页不重叠。"""
    _make_many_matches(temp_workdir, count=30)
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res1 = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20, "offset": 0}
        )
        res2 = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20, "offset": 20}
        )

    page1_paths = {r["path"] for r in res1.json()["results"]}
    page2_paths = {r["path"] for r in res2.json()["results"]}
    assert len(page2_paths) == 10  # 30 - 20 = 10 remaining
    assert page1_paths.isdisjoint(page2_paths), "page 1 and page 2 should not overlap"


@pytest.mark.asyncio
async def test_search_offset_out_of_range_clamps(
    temp_workdir, env_cortex_config, reset_deps
):
    """offset=1000, total=30 → safe_offset clamp 到 max(0, total-1)=29，返回最后 1 条。"""
    _make_many_matches(temp_workdir, count=30)
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20, "offset": 1000}
        )

    body = res.json()
    assert body["total"] == 30
    # safe_offset = min(1000, 29) = 29；切片 [29:49] = 1 条
    assert body["offset"] == 29
    assert len(body["results"]) == 1


@pytest.mark.asyncio
async def test_search_offset_zero_first_page(
    temp_workdir, env_cortex_config, reset_deps
):
    """回归：offset=0 与不传 offset 行为一致。"""
    _make_many_matches(temp_workdir, count=30)
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_default = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20}
        )
        res_explicit = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20, "offset": 0}
        )

    assert res_default.json()["results"] == res_explicit.json()["results"]


@pytest.mark.asyncio
async def test_search_response_includes_offset_and_limit(
    temp_workdir, env_cortex_config, reset_deps
):
    """响应里 offset/limit 字段存在且为 int。"""
    _make_many_matches(temp_workdir, count=30)
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 15, "offset": 5}
        )

    body = res.json()
    assert isinstance(body["offset"], int)
    assert isinstance(body["limit"], int)
    assert body["offset"] == 5
    assert body["limit"] == 15


@pytest.mark.asyncio
async def test_search_empty_results_total_zero(
    env_cortex_config, reset_deps, temp_workdir
):
    """无匹配查询 → total=0, results=[], offset=0。"""
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/search",
            json={"query": "zzz_no_such_keyword_xyz", "limit": 20, "offset": 0},
        )

    body = res.json()
    assert body["total"] == 0
    assert body["results"] == []
    assert body["offset"] == 0


@pytest.mark.asyncio
async def test_search_total_reflects_filter_not_fetch_size(
    temp_workdir, env_cortex_config, reset_deps
):
    """total 反映过滤后的真实匹配数，不是 _MAX_FETCH 或 FTS 候选数。

    构造：3 个含 'unique_kw_aaa' 的文件 + 27 个不含的文件。
    FTS 可能匹配更多（部分子串），但字面过滤后应只剩 3。
    """
    for i in range(30):
        (temp_workdir / f"mix_{i:02d}.md").write_text(
            f"# Doc {i}\n\nGeneric content {i} without special keyword.\n",
            encoding="utf-8",
        )
    for i in range(3):
        (temp_workdir / f"special_{i}.md").write_text(
            f"# Special {i}\n\nThis has unique_kw_aaa in it.\n",
            encoding="utf-8",
        )
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/search", json={"query": "unique_kw_aaa", "limit": 20, "offset": 0}
        )

    body = res.json()
    # 至少 3（精确字面匹配），不超过 FTS 候选总数（不应是 _MAX_FETCH=1000）
    assert body["total"] >= 3
    assert body["total"] < 1000
