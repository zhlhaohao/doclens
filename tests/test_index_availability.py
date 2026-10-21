# -*- coding: utf-8 -*-
"""索引库「不可读」不得伪装成「空库」（AP-45）。

原实现：`has_indexed_docs()` 吞异常返回 False → `search()` 直接 `return [], []`；
`like_search()` 以 `indexed_doc_count() == 0` 判空（index_probe 同样吞异常返回 0）。
于是索引库损坏/被锁时，Web 搜索与 AI 的 search_kb 都返回「没有匹配」——
用户与模型都会得出「知识库里没有这段内容」的错误结论。
"""
import asyncio
import sqlite3
from types import SimpleNamespace

import pytest

from doclens.index_manager import IndexManager, IndexUnavailable


class _BrokenFTS:
    """构造即抛——模拟 index.db 损坏 / 被其他进程独占。"""

    def __init__(self, db_path=None, **kw):
        raise sqlite3.DatabaseError("database disk image is malformed")


@pytest.fixture()
def idx(tmp_path, monkeypatch):
    from doclens.config import CortexConfig

    cfg = CortexConfig(
        search_path=str(tmp_path),
        index_path=str(tmp_path / ".cortex" / "index.db"),
    )
    mgr = IndexManager(cfg)
    mgr.load_or_build_index = lambda *a, **k: None  # 不真建库
    return mgr


@pytest.fixture()
def broken_fts(monkeypatch):
    import treesearch.fts as fts_mod

    monkeypatch.setattr(fts_mod, "FTS5Index", _BrokenFTS)


class TestAvailabilityProbe:
    def test_distinguishes_three_states(self, idx, broken_fts):
        assert idx.index_availability() == "unavailable"
        # fail-soft 的旧口径仍是 False（目录页/状态页要用）
        assert idx.has_indexed_docs() is False

    def test_empty_library_reports_empty(self, idx, monkeypatch):
        import treesearch.fts as fts_mod

        class _Empty:
            def __init__(self, db_path=None, **kw):
                pass

            def has_documents(self):
                return False

            def close(self):
                pass

        monkeypatch.setattr(fts_mod, "FTS5Index", _Empty)
        assert idx.index_availability() == "empty"


class TestSearchRaises:
    def test_search_raises_on_unavailable(self, idx, broken_fts):
        with pytest.raises(IndexUnavailable, match="索引库不可用"):
            idx.search("anything")

    def test_like_search_raises_on_unavailable(self, idx, broken_fts):
        with pytest.raises(IndexUnavailable):
            idx.like_search("anything")

    def test_empty_library_still_returns_empty(self, idx, monkeypatch):
        import treesearch.fts as fts_mod

        class _Empty:
            def __init__(self, db_path=None, **kw):
                pass

            def has_documents(self):
                return False

            def close(self):
                pass

        monkeypatch.setattr(fts_mod, "FTS5Index", _Empty)
        assert idx.search("q") == ([], [])
        assert idx.like_search("q") == []


class TestWebEndpointContract:
    """search 端点必须与 grep 对齐填 `error`（前端据它区分空结果与故障）。"""

    def _resp(self, idx, monkeypatch, broken):
        from doclens.web_v2.api import search as search_api
        from doclens.web_v2.models.search import SearchRequest

        if broken:
            monkeypatch.setattr(
                search_api, "_do_search",
                lambda *a, **k: (_ for _ in ()).throw(
                    IndexUnavailable("索引库不可用: x")
                ),
            )
        req = SearchRequest(query="q")
        return asyncio.run(search_api.search(req, idx=idx))

    def test_error_filled_on_unavailable(self, idx, monkeypatch):
        resp = self._resp(idx, monkeypatch, broken=True)
        assert resp.groups == []
        assert resp.error and "索引库不可用" in resp.error

    def test_generic_failure_also_reported(self, idx, monkeypatch):
        from doclens.web_v2.api import search as search_api
        from doclens.web_v2.models.search import SearchRequest

        monkeypatch.setattr(
            search_api, "_do_search",
            lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")),
        )
        resp = asyncio.run(search_api.search(SearchRequest(query="q"), idx=idx))
        assert resp.error and "boom" in resp.error

    def test_ok_path_has_no_error(self, idx, monkeypatch):
        from doclens.scoring_pipeline import ScoreResult
        from doclens.web_v2.api import search as search_api
        from doclens.web_v2.models.search import SearchRequest

        monkeypatch.setattr(
            search_api, "_do_search",
            lambda *a, **k: (ScoreResult(results=[], like_raw=[], source="fts"), []),
        )
        resp = asyncio.run(search_api.search(SearchRequest(query="q"), idx=idx))
        assert resp.error is None


class TestKbToolsContract:
    """search_kb 的不可用分支文案必须与「空库」区分（AI 会转述给用户）。"""

    def test_unavailable_message(self, idx, monkeypatch):
        from doclens import kb_tools

        monkeypatch.setattr(idx, "index_availability", lambda: "unavailable")
        msg = kb_tools.handle_search_kb(idx, None, query="q")
        assert "索引库不可用" in msg
        assert "未就绪或为空" not in msg

    def test_empty_message(self, idx, monkeypatch):
        from doclens import kb_tools

        monkeypatch.setattr(idx, "index_availability", lambda: "empty")
        msg = kb_tools.handle_search_kb(idx, None, query="q")
        assert "未就绪或为空" in msg

    def test_source_has_both_branches(self):
        import inspect

        from doclens import kb_tools

        src = inspect.getsource(kb_tools.handle_search_kb)
        assert "索引库不可用" in src
        assert "知识库索引未就绪或为空" in src
