"""Web /api/search 与 CLI cortex search 的对齐守护测试。

任一端分叉（数量、顺序、score 语义）会立即失败。
这是"Web 搜索对齐 CLI"诉求的核心保障。
"""
import asyncio
import os

import pytest
from httpx import ASGITransport, AsyncClient

from doclens.scoring import tokenize_query
from doclens.scoring_pipeline import score_and_rank
from doclens.web_v2 import deps
from doclens.web_v2.app import create_app


@pytest.fixture
def reset_deps():
    """每个测试前后重置 deps 单例，避免 search_path 跨测试污染。"""
    deps.reset_singletons()
    yield
    deps.reset_singletons()


def _init_and_reindex():
    """在非事件循环线程中初始化 IndexManager 并建索引。

    TreeSearch.index 是同步阻塞调用，不能直接在 pytest-asyncio 事件循环里运行，
    否则会卡住（SQLite lock / thread affinity）。调用方需用 asyncio.to_thread 包装。
    """
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


def _cli_ground_truth(idx, query: str, limit: int = 20):
    """模拟 CLI cortex search 的 ground truth：idx.search + score_and_rank。

    与 cortex/web_v2/api/search.py::_do_search 完全相同的调用顺序：
      1. idx.search(query, max_results=limit)
      2. tokenize_query → fallback split
      3. score_and_rank
    返回前 limit 条 (abs_path, line_start, composite_score) tuple，以及 source。
    """
    # 严格对齐 _do_search：max_results 必须传 limit（不是 idx.max_results），
    # 否则 FTS 召回窗口不同会导致 top-N 分叉
    nodes, docs = idx.search(query, max_results=limit)
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]
    result = score_and_rank(nodes, docs, query, query_words, idx)

    truth = []
    if result.source == "fts":
        # fts 分支：result.results = [(composite, (doc_id, node, matched, prox, fts))]
        for composite, (doc_id, node, _m, _p, _f) in result.results[:limit]:
            abs_path = idx.path_map.get(doc_id, doc_id)
            truth.append((abs_path, node.get("line_start"), round(composite, 4)))
    elif result.source == "like":
        # like 分支：result.like_raw = list[dict]，CLI 给固定分 0.5、line=None
        for item in (result.like_raw or [])[:limit]:
            doc_key = item.get("doc_name", "") or item.get("doc_id", "")
            abs_path = idx.path_map.get(doc_key, doc_key)
            truth.append((abs_path, None, 0.5))
    elif result.source == "ripgrep":
        # ripgrep 分支：result.results = [(doc_id, node, matched, prox, fts)]
        for doc_id, node, _m, _p, _f in result.results[:limit]:
            abs_path = idx.path_map.get(doc_id, doc_id)
            truth.append((abs_path, node.get("line_start"), 0.0))
    return truth, result.source


@pytest.mark.asyncio
async def test_web_search_matches_cli_top_20(temp_workdir, env_cortex_config, reset_deps):
    """Web /api/search 的前 20 条 (path, line, score) 必须与 CLI 完全一致。

    守护点：
      1. source 必须一致（都走 fts / like / ripgrep 同一条路径）
      2. 结果数量必须一致
      3. 前 N 条 (abs_path, line_start, composite_score) 顺序必须完全一致
      4. score 都在 [0, 1] 区间（composite 归一化语义，sanity check）
    """
    # 准备多个 md 文件让搜索有足够命中
    (temp_workdir / "健康.md").write_text(
        "# 健康指南\n\n肠道健康很重要。健康饮食。身心健康。", encoding="utf-8"
    )
    (temp_workdir / "运动.md").write_text(
        "# 运动健康\n\n运动促进健康。", encoding="utf-8"
    )
    await asyncio.to_thread(_init_and_reindex)

    idx = deps.get_index_manager()

    # CLI ground truth —— TreeSearch.search 检测运行中的事件循环会拒绝，
    # 必须丢到子线程执行（与 _do_search 的 asyncio.to_thread 对齐）
    truth, truth_source = await asyncio.to_thread(_cli_ground_truth, idx, "健康", 20)

    # Web API
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": "健康", "limit": 20})
    assert res.status_code == 200
    body = res.json()

    # 守护点 1: source 必须一致
    assert body["source"] == truth_source, (
        f"source 不一致: web={body['source']} vs cli={truth_source}"
    )

    # 守护点 2: 数量必须一致
    web_results = body["results"]
    assert len(web_results) == len(truth), (
        f"结果数不一致: web={len(web_results)} vs cli={len(truth)}"
    )

    # 守护点 3: 前 N 条 (abs_path, line, score) 必须完全一致
    for i, (exp_abs, exp_line, exp_score) in enumerate(truth):
        web_path = web_results[i]["path"]
        web_line = web_results[i]["line"]
        web_score = web_results[i]["score"]
        # web 返回相对 search_path 的路径；拼回绝对路径比较
        web_abs = os.path.join(idx.search_path, web_path)
        assert os.path.normpath(web_abs) == os.path.normpath(exp_abs), (
            f"[{i}] path 不一致: web={web_path} (abs={web_abs}) vs cli={exp_abs}"
        )
        assert web_line == exp_line, (
            f"[{i}] line 不一致: web={web_line} vs cli={exp_line}"
        )
        assert abs(web_score - exp_score) < 1e-6, (
            f"[{i}] score 不一致: web={web_score} vs cli={exp_score}"
        )

    # 守护点 4: score 都在 [0, 1] 范围 sanity check
    for r in web_results:
        assert 0.0 <= r["score"] <= 1.0, (
            f"score 越界 [0,1]: {r['score']} (path={r['path']})"
        )


@pytest.mark.asyncio
async def test_web_search_source_matches_cli_when_fts_empty(
    temp_workdir, env_cortex_config, reset_deps
):
    """FTS 无结果时，Web 与 CLI 必须走同一条降级路径（source 一致）。

    守护点：
      1. source 必须一致（ LIKE / ripgrep 同一条路径）
      2. 降级结果数量必须一致
    """
    # 不创建任何命中文件，让 query 命中 0 条（temp_workdir 自带 doc1/doc2/data.csv
    # 不会匹配下面的 query）
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    query = "zzz绝对不存在的罕见关键字xyz"
    truth, truth_source = await asyncio.to_thread(_cli_ground_truth, idx, query, 20)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": query, "limit": 20})
    assert res.status_code == 200
    body = res.json()

    # 守护点 1: 降级路径必须一致
    assert body["source"] == truth_source, (
        f"降级路径不一致: web={body['source']} vs cli={truth_source}"
    )

    # 守护点 2: 降级结果数量必须一致
    assert len(body["results"]) == len(truth), (
        f"降级结果数不一致: web={len(body['results'])} vs cli={len(truth)}"
    )
