# -*- coding: utf-8 -*-
"""AP-45：检索链路必须区分「空库」与「索引库读不了」。

原状：`has_indexed_docs()` / `indexed_doc_count()` 在 DB 故障时分别返回
False / 0，`search()` 据此直接 `return [], []`。于是索引库损坏或锁冲突在
界面上与「知识库里没有这段内容」完全同形——AI 会据此给出「未收录」的
错误结论。同构的 grep 端点早已填 `error` 字段，两者契约不一致。

修复：新增判定类探测 `index_probe.has_documents_checked`，DB 不可读时抛
`IndexProbeError`；`search`/`like_search` 用它；web 端点把异常转成
200 + `error`，`kb_tools` 转成「不能据此认为未收录」的明确文案。
"""
import sqlite3
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens import index_probe
from doclens.index_probe import IndexProbeError, has_documents_checked


class TestProbeThreeStates:
    def test_empty_db_is_false_not_error(self, tmp_path: Path):
        """空库是合法状态——返回 False，不抛。"""
        from treesearch.fts import FTS5Index

        db = tmp_path / "index.db"
        fts = FTS5Index(db_path=str(db))  # 建表
        fts.close()
        assert has_documents_checked(str(db)) is False

    def test_garbage_file_raises(self, tmp_path: Path):
        """非 SQLite 内容 → 抛 IndexProbeError（不是 False）。"""
        db = tmp_path / "index.db"
        db.write_bytes(b"this is not a sqlite database" * 100)
        with pytest.raises(IndexProbeError):
            has_documents_checked(str(db))

    def test_error_is_not_a_subclass_of_nothing_useful(self):
        """异常必须可被单独捕获（区别于通用 Exception 的粗粒度处理）。"""
        assert issubclass(IndexProbeError, RuntimeError)

    def test_soft_probe_keeps_fail_soft_semantics(self, tmp_path: Path):
        """展示类探测保持 fail-soft（目录页不能因瞬时锁 500）。"""
        db = tmp_path / "index.db"
        db.write_bytes(b"garbage" * 100)
        assert index_probe.indexed_doc_count(str(db)) == 0
        assert index_probe.is_path_indexed(str(db), "/x/y.md") is False


def _idx_with_garbage_db(tmp_path: Path):
    """IndexManager 替身：库文件存在但不可读，`_ts` 就绪。

    `search` / `like_search` 绑定真实的未绑定方法——本测试要验证的正是
    这两个方法内部的探测语义，替身实现会让断言失去意义。
    """
    from doclens.index_manager import IndexManager

    db = tmp_path / "index.db"
    db.write_bytes(b"garbage" * 100)
    idx = SimpleNamespace(
        index_path=str(db),
        search_path=str(tmp_path),
        _ts=object(),
        load_or_build_index=lambda: None,
        top_k_docs=100,
        max_results=50,
    )
    idx.search = lambda q, **kw: IndexManager.search(idx, q, **kw)
    idx.like_search = lambda q, **kw: IndexManager.like_search(idx, q, **kw)
    return idx


class TestSearchRaisesInsteadOfEmpty:
    def test_search_propagates_probe_error(self, tmp_path):
        from doclens.index_manager import IndexManager

        idx = _idx_with_garbage_db(tmp_path)
        with pytest.raises(IndexProbeError):
            idx.search("任意查询")

    def test_like_search_propagates_probe_error(self, tmp_path):
        from doclens.index_manager import IndexManager

        idx = _idx_with_garbage_db(tmp_path)
        with pytest.raises(IndexProbeError):
            idx.like_search("任意查询")


class TestWebEndpointReportsError:
    def _call(self, idx):
        import asyncio

        from doclens.web_v2.api import search as search_api
        from doclens.web_v2.models.search import SearchRequest

        return asyncio.run(search_api.search(SearchRequest(query="麒麟"), idx=idx))

    def test_error_field_filled_on_probe_failure(self, tmp_path):
        resp = self._call(_idx_with_garbage_db(tmp_path))
        assert resp.groups == []
        assert resp.error, "索引不可读必须在 error 字段体现，不能只回空结果"
        assert "不可读" in resp.error
        assert resp.notes, "notes 也要给出原因"

    def test_contract_matches_grep_endpoint(self, tmp_path):
        """与 /api/grep 同契约：200 + error 非空（前端据此区分「无结果」与「出错」）。"""
        from doclens.web_v2.models.search import GroupedSearchResponse

        assert "error" in GroupedSearchResponse.model_fields

    def test_normal_empty_result_has_no_error(self, tmp_path):
        """健康空库仍返回「干净的空结果」（无 error）——不能把空库也报成故障。"""
        from treesearch.fts import FTS5Index

        db = tmp_path / "index.db"
        fts = FTS5Index(db_path=str(db))
        fts.close()
        idx = SimpleNamespace(
            index_path=str(db), search_path=str(tmp_path), _ts=object(),
            load_or_build_index=lambda: None, top_k_docs=100,
        )
        # 走真实 IndexManager.search（空库 → 空结果，无异常）
        from doclens.index_manager import IndexManager

        nodes, docs = IndexManager.search(idx, "麒麟")
        assert (nodes, docs) == ([], [])


class TestKbToolsReportsClearly:
    def test_tool_text_warns_against_no_hit_conclusion(self, tmp_path, monkeypatch):
        """工具层：模型看到的必须是「索引不可读」，不能是「未找到」。"""
        from doclens import kb_tools

        idx = _idx_with_garbage_db(tmp_path)
        idx.ts = idx._ts           # 绕过 `ts is None` 的建库分支
        idx.has_indexed_docs = lambda: True
        idx.min_score_threshold = 0.3
        idx.search_context_before = 200
        idx.search_context_after = 600
        idx.max_context_chars_per_result = 2000
        idx.max_total_chars = 20000
        idx.resolve_doc_path = lambda doc_id: doc_id
        idx.path_map = {}

        out = kb_tools.handle_search_kb(idx, tmp_path, query="麒麟")
        assert "索引库暂时不可读" in out
        assert "不能" in out and "未收录" in out
        assert "未找到" not in out
