# -*- coding: utf-8 -*-
"""AP-47：搜索候选池只有一个真源（`top_k_docs`），且调用方不再传死参数。

原状：`IndexManager.search(query, max_results=...)` 的 `max_results` 被引擎
`search(**kwargs)` 静默吞掉，真实候选池恒为 `config.top_k_docs`（默认 100）；
web 端点却按 `_MAX_FETCH = 1000` 宣称「1000 候选完整过滤排序」，`total`
因此系统性偏低且无从察觉。
"""
import inspect

import pytest

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager


@pytest.fixture()
def kb_env(tmp_path, monkeypatch):
    """8 篇同关键词文档的知识库（每篇 1 个命中节点）。"""
    kb = tmp_path / "kb"
    kb.mkdir()
    for i in range(8):
        (kb / f"d{i}.md").write_text(
            f"# 文档{i}\n\n麒麟 内容 {i}\n", encoding="utf-8"
        )
    monkeypatch.setenv("CORTEX_SEARCH_PATH", str(kb))
    monkeypatch.setenv("CORTEX_INDEX_PATH", str(tmp_path / "idx" / "index.db"))
    monkeypatch.setenv("CORTEX_TOP_K_DOCS", "100")
    cfg = CortexConfig()
    idx = IndexManager(cfg)
    idx.reindex(force=True)
    return idx, tmp_path


class TestSignature:
    def test_no_dead_max_results_param(self):
        """形参必须是 top_k_docs（候选池），不能是死参数 max_results。"""
        params = inspect.signature(IndexManager.search).parameters
        assert "top_k_docs" in params
        assert "max_results" not in params

    def test_top_k_docs_property_exposes_config(self):
        cfg = CortexConfig()
        idx = IndexManager(cfg)
        assert idx.top_k_docs == cfg.top_k_docs


class TestTopKDocsActuallyWires:
    def test_small_pool_limits_documents(self, kb_env):
        idx, _ = kb_env
        nodes, docs = idx.search("麒麟", top_k_docs=3)
        assert len(docs) == 3
        assert len(nodes) == 3

    def test_larger_pool_returns_more(self, kb_env):
        idx, _ = kb_env
        _, docs_small = idx.search("麒麟", top_k_docs=2)
        _, docs_big = idx.search("麒麟", top_k_docs=8)
        assert len(docs_small) == 2
        assert len(docs_big) == 8

    def test_none_falls_back_to_config(self, kb_env):
        idx, _ = kb_env
        # 配置 100 > 库里 8 篇 → 全返回（证明 None 走配置而非 0/None）
        _, docs = idx.search("麒麟")
        assert len(docs) == 8

    def test_pool_clamped_to_at_least_one(self, kb_env):
        idx, _ = kb_env
        _, docs = idx.search("麒麟", top_k_docs=0)
        assert len(docs) == 1


class TestNoDeadArgumentAtCallSites:
    def test_all_callers_dropped_max_results(self):
        """5 个调用点都不得再传 max_results（它曾经是静默无效的假开关）。"""
        import pathlib

        root = pathlib.Path(__file__).resolve().parents[1] / "doclens"
        offenders = []
        for path in root.rglob("*.py"):
            text = path.read_text(encoding="utf-8", errors="replace")
            for line in text.splitlines():
                if ".search(" in line and "max_results=" in line and "like_search" not in line:
                    offenders.append(f"{path.relative_to(root)}: {line.strip()}")
        assert offenders == []


class TestWebApiHonestPool:
    def _fake_idx(self, doc_count: int, pool: int):
        from types import SimpleNamespace

        cfg = CortexConfig()
        return SimpleNamespace(
            search_path="/kb",
            index_path="/kb/.cortex/index.db",
            path_map={},
            top_k_docs=pool,
            max_results=cfg.max_results,
            max_nodes_per_doc=cfg.max_nodes_per_doc,
            max_span=cfg.max_span,
            min_score_threshold=cfg.min_score_threshold,
            rg_context_before=cfg.rg_context_before,
            rg_context_after=cfg.rg_context_after,
            scoring_weights={
                "keyword_match_ratio": cfg.weight_keyword_match,
                "file_name_match": cfg.weight_file_name_match,
                "fts_score": cfg.weight_fts_score,
                "title_match": cfg.weight_title_match,
                "proximity_match": cfg.weight_proximity_match,
            },
            search=lambda q: (
                [],
                [{"doc_id": f"d{i}", "structure": []} for i in range(doc_count)],
            ),
            like_search=lambda q, max_results=50: [],
        )

    def test_note_when_pool_saturated(self):
        from doclens.web_v2.api import search as search_api

        _, _, notes = search_api._do_search(self._fake_idx(100, 100), "麒麟")
        assert notes and "候选池已满" in notes[0]
        assert "100" in notes[0]

    def test_no_note_when_pool_not_saturated(self):
        from doclens.web_v2.api import search as search_api

        _, _, notes = search_api._do_search(self._fake_idx(12, 100), "麒麟")
        assert notes == []

    def test_engine_failure_surfaces_error_note(self):
        """引擎异常时结果为空但 notes 说明原因（与 grep 端点契约对齐）。"""
        from doclens.web_v2.api import search as search_api
        from doclens.web_v2.models.search import SearchRequest

        fake = self._fake_idx(0, 100)

        def boom(q):
            raise RuntimeError("index db locked")

        fake.search = boom
        req = SearchRequest(query="麒麟")
        import asyncio

        resp = asyncio.run(search_api.search(req, idx=fake))
        assert resp.groups == []
        assert resp.notes and "index db locked" in resp.notes[0]
