# -*- coding: utf-8 -*-
"""全库搜索 /api/search + /api/grep API 级测试矩阵（e2e-search-test-plan §3.1 A/B）。

不起 TestClient——直接 asyncio.run 调路由函数 + monkeypatch get_index_manager，
与 tests/test_manual_compact_api.py 同模式。

语料 = tests/fixtures/e2e_search/语料 复制到 tmp_path 后真建索引。
"""
import asyncio
import shutil
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures" / "e2e_search" / "语料"


def _make_kb(tmp_path: Path) -> Path:
    kb = tmp_path / "kb"
    shutil.copytree(FIXTURES, kb)
    return kb


def _build_index(kb: Path, db_path: Path):
    from treesearch import TreeSearch, TreeSearchConfig, set_config

    set_config(TreeSearchConfig())
    ts = TreeSearch(db_path=str(db_path))
    ts.index(str(kb), return_documents=False)


@pytest.fixture()
def idx(tmp_path: Path, monkeypatch):
    """真索引 + 真 IndexManager（绕过 __init__，手工补属性）。"""
    from doclens.web_v2.api import search as search_api
    from doclens.index_manager import IndexManager
    from doclens.config import CortexConfig
    import threading

    kb = _make_kb(tmp_path)
    db = tmp_path / "idx" / "index.db"
    db.parent.mkdir()
    _build_index(kb, db)

    mgr = IndexManager.__new__(IndexManager)
    mgr.search_path = str(kb)
    mgr.index_path = str(db)
    mgr._config = CortexConfig()
    mgr._ts = None
    mgr._needs_reload = False
    mgr._building = False
    mgr._build_cond = threading.Condition()
    mgr._startup_audit_done = True
    mgr._last_failed_count = 0
    mgr._sync_image_version_expectation = lambda: None
    mgr._path_map = {}
    mgr._reindex_lock = threading.Lock()
    mgr.build_path_map()

    monkeypatch.setattr(search_api, "get_index_manager", lambda: mgr)
    yield mgr
    if mgr._ts is not None:
        try:
            mgr._ts.close()
        except Exception:
            pass


def _search(idx, **payload):
    from doclens.web_v2.api import search as search_api
    from doclens.web_v2.models.search import SearchRequest

    return asyncio.run(search_api.search(SearchRequest(**payload), idx))


def _grep(idx, **payload):
    from doclens.web_v2.api import grep as grep_api
    from doclens.web_v2.models.search import GrepRequest

    return asyncio.run(grep_api.grep(GrepRequest(**payload), idx))


# ===========================================================================
# A. /api/search 核心矩阵
# ===========================================================================
class TestSearchMatrix:
    def test_a1_cjk_hit_all_formats(self, idx):
        r = _search(idx, query="麒麟", limit=50)
        paths = {g.path for g in r.groups}
        for expect in ("书.epub", "幻灯.pptx", "杂记.md", "报表.xlsx", "纪要.docx"):
            assert expect in paths, f"{expect} missing in {paths}"
        for g in r.groups:
            for m in g.matches:
                for s, e in m.spans:
                    assert "麒麟" in m.text[s:e]

    def test_a2_case_insensitive(self, idx):
        r = _search(idx, query="kirin", limit=50)
        paths = {g.path for g in r.groups}
        for expect in ("纪要.docx", "幻灯.pptx", "书.epub"):
            assert expect in paths
        for g in r.groups:
            for m in g.matches:
                for s, e in m.spans:
                    assert m.text[s:e].lower() == "kirin"

    def test_a2b_spans_case_aligned(self, idx):
        r = _search(idx, query="KIRin", limit=50)
        for g in r.groups:
            for m in g.matches:
                for s, e in m.spans:
                    assert m.text[s:e].lower() == "kirin"

    def test_a3_multi_word_or(self, idx):
        r = _search(idx, query="麒麟 kirin", limit=50)
        assert set(r.query_words) >= {"麒麟", "kirin"}
        assert r.total >= 10

    def test_a4_phrase_mode_accepted(self, idx):
        r1 = _search(idx, query="麒麟 计划", mode="phrase")
        r2 = _search(idx, query="麒麟 计划", mode="keyword")
        assert r1.total == r2.total

    def test_a5_prefix(self, idx):
        r = _search(idx, query="kir*", limit=50)
        assert r.total >= 1

    def test_a6_wildcard_contains(self, idx):
        r = _search(idx, query="*kirin*", limit=50)
        assert r.total >= 1

    def test_a7_pagination(self, idx):
        r1 = _search(idx, query="麒麟", limit=10, offset=0)
        r2 = _search(idx, query="麒麟", limit=10, offset=10)
        p1 = {g.path for g in r1.groups}
        p2 = {g.path for g in r2.groups}
        assert not (p1 & p2)
        assert r1.total >= 25
        assert r2.offset == 10

    def test_a8_offset_overflow_returns_empty_page(self, idx):
        """BUG-F7 已修：越界返回空页（不再回显最后一页）。"""
        r = _search(idx, query="麒麟", limit=10, offset=999)
        assert r.groups == []
        assert r.total >= 25
        assert r.offset == 999

    def test_a9_matches_per_file_cap(self, idx, tmp_path):
        lines = ["# 大量命中", ""]
        lines += [f"行 {i} 麒麟命中行" for i in range(1, 61)]
        kb2 = tmp_path / "kb2"
        kb2.mkdir()
        (kb2 / "big.md").write_text("\n".join(lines), encoding="utf-8")
        from treesearch import TreeSearch, TreeSearchConfig, set_config

        set_config(TreeSearchConfig())
        ts = TreeSearch(db_path=str(tmp_path / "idx2" / "index.db"))
        ts.index(str(kb2), return_documents=False)
        from doclens.web_v2.api import search as search_api
        from doclens.web_v2.models.search import SearchRequest
        from types import SimpleNamespace

        def _search2(q, max_results=1000):
            res = ts.search(query=q, max_results=max_results,
                            max_nodes_per_doc=10, top_k_docs=5)
            return res.get("flat_nodes", []), res.get("documents", [])

        fake = SimpleNamespace(
            search_path=str(kb2), index_path=str(tmp_path / "idx2" / "index.db"),
            path_map={"big": str(kb2 / "big.md")},
            search=_search2,
            like_search=lambda q, max_results=50: [],
        )
        from doclens.config import CortexConfig
        cfg = CortexConfig()
        for name in ("max_results", "max_nodes_per_doc", "top_k_docs", "max_span",
                     "min_score_threshold"):
            setattr(fake, name, getattr(cfg, name))
        fake.scoring_weights = {
            "keyword_match_ratio": cfg.weight_keyword_match,
            "file_name_match": cfg.weight_file_name_match,
            "fts_score": cfg.weight_fts_score,
            "title_match": cfg.weight_title_match,
            "proximity_match": cfg.weight_proximity_match,
        }
        r = asyncio.run(search_api.search(SearchRequest(query="麒麟", limit=10), fake))
        assert r.groups
        g = r.groups[0]
        assert len(g.matches) == 50
        assert g.total_matches == 60
        assert g.truncated is True

    def test_a10_long_line_truncated(self, idx):
        r = _search(idx, query="麒麟", limit=50)
        g = next(g for g in r.groups if g.path == "杂记.md")
        long_rows = [m for m in g.matches if len(m.text) >= 200]
        assert long_rows
        for m in long_rows:
            assert m.text.startswith("…") or m.text.endswith("…") or len(m.text) <= 202

    def test_a11_no_result(self, idx):
        r = _search(idx, query="绝不存在的词xyzzy", limit=10)
        assert r.groups == []
        assert r.error is None

    def test_a12_blank_query_rejected(self, idx):
        """BUG-F2 已修：纯空白 query 422 拒绝（不再 LIKE '% %' 随机命中）。"""
        from pydantic import ValidationError
        from doclens.web_v2.models.search import SearchRequest

        with pytest.raises(ValidationError):
            SearchRequest(query=" ")

    def test_a13_special_chars_no_500(self, idx):
        for q in ('"quoted"', "(paren)", "a+b*c?", "[bracket]", "模|式", "AND", "NEAR("):
            r = _search(idx, query=q, limit=10)
            assert r is not None
            assert r.error is None

    def test_a14_single_cjk_char(self, idx):
        r = _search(idx, query="麒", limit=10)
        assert r.error is None

    def test_a18_fields_complete(self, idx):
        r = _search(idx, query="kirin", limit=10)
        assert isinstance(r.elapsed_ms, int)
        assert r.notes == []
        assert r.source in ("fts", "like", "ripgrep")

    def test_a19_ordering(self, idx):
        r = _search(idx, query="麒麟", limit=50)
        scores = [g.best_score for g in r.groups]
        assert scores == sorted(scores, reverse=True)
        for g in r.groups:
            lines = [m.line for m in g.matches if m.line is not None]
            assert lines == sorted(lines)

    def test_a21_limit_bounds(self, idx):
        from pydantic import ValidationError
        from doclens.web_v2.models.search import SearchRequest

        with pytest.raises(ValidationError):
            SearchRequest(query="x", limit=0)
        with pytest.raises(ValidationError):
            SearchRequest(query="x", limit=101)
        SearchRequest(query="x", limit=1)

    def test_a22_query_length_bounds(self, idx):
        from pydantic import ValidationError
        from doclens.web_v2.models.search import SearchRequest

        SearchRequest(query="x" * 500)
        with pytest.raises(ValidationError):
            SearchRequest(query="x" * 501)

    def test_a15_like_fallback(self, idx):
        r = _search(idx, query="filler", limit=50)
        assert r.source in ("fts", "like", "ripgrep")
        assert r.groups


# ===========================================================================
# B. /api/grep 矩阵
# ===========================================================================
class TestGrepMatrix:
    def test_b1_regex_text_files(self, idx):
        r = _grep(idx, pattern=r"kirin_\w+", limit=50)
        assert r.source == "grep"
        paths = {Path(g.path).name for g in r.groups}
        assert "kirin_util.py" in paths
        g = next(g for g in r.groups if g.path.endswith("kirin_util.py"))
        assert g.kind == "content"
        assert [m.line for m in g.matches] == [4, 9]

    def test_b2_binary_regexp_leg(self, idx):
        r = _grep(idx, pattern="麒麟", limit=50)
        names = {Path(g.path).name for g in r.groups}
        assert {"纪要.docx", "报表.xlsx", "书.epub"} <= names

    def test_b3_cjk_regex(self, idx):
        r = _grep(idx, pattern=r"kirin.{0,10}jump", limit=10)
        names = {Path(g.path).name for g in r.groups}
        assert "report.pdf" in names

    def test_b4_invalid_regex_no_500(self, idx):
        r = _grep(idx, pattern="a[b", limit=10)
        assert r.error is None

    def test_b5_rg_missing_fallback(self, idx, monkeypatch):
        from doclens.web_v2.api import grep as grep_api
        from doclens import ripgrep as _rg
        import treesearch.ripgrep as _tsr
        monkeypatch.setattr(_rg, "rg_available", lambda: False, raising=True)
        monkeypatch.setattr(_tsr, "rg_available", lambda: False, raising=True)
        from doclens.web_v2.models.search import GrepRequest

        r = asyncio.run(grep_api.grep(GrepRequest(pattern="kirin", limit=10), idx))
        assert r.error is None
        assert r.source == "grep"
        names = {Path(g.path).name for g in r.groups}
        assert "纪要.docx" in names

    def test_b6_grep_pagination(self, idx):
        r = _grep(idx, pattern="麒麟", limit=5, offset=0)
        assert len(r.groups) <= 5
        assert r.total >= 30

    def test_b7_path_group(self, idx):
        r = _grep(idx, pattern=r"code.kirin_util", limit=10)
        kinds = {g.kind for g in r.groups}
        assert kinds
        for g in r.groups:
            if g.kind == "path":
                assert g.matches[0].line is None
                assert "路径匹配" in g.matches[0].text

    def test_b8_unindexed_file_included(self, idx):
        r = _grep(idx, pattern="KIRIN_normalize", limit=10)
        names = {Path(g.path).name for g in r.groups}
        assert "kirin_util.py" in names

    def test_b10_notes_field(self, idx):
        r = _grep(idx, pattern="kirin", limit=10)
        assert isinstance(r.notes, list)


class TestSearchGrepPathConsistency:
    def test_grep_paths_are_relative(self, idx):
        """BUG-G1 已修：grep 返回相对路径（rg 合成节点绝对路径兜底相对化）。"""
        r = _grep(idx, pattern="kirin", limit=50)
        for g in r.groups:
            assert not Path(g.path).is_absolute(), (
                f"grep 返回绝对路径: {g.path}（BUG-G1 回归）"
            )
