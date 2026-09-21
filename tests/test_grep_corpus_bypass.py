"""grep 大语料旁路（方案 C）测试：百万节点级跳过 SQLite REGEXP 直通 rg。

背景：like_search(use_regex=True) 的 REGEXP 是逐行 Python UDF，nodes 表
百万行级（51 万文档实测 118.8 万节点）全表扫是分钟~十分钟级，单次 grep
即可卡死对话流（2026-09-14 实测）；rg 递归扫同规模目录 10-30s。

二进制文档（pdf/docx 等）分流：rg 搜不了磁盘原文（shadow md 机制已废弃），
解析文本只在索引库——走 REGEXP 限定二进制子集扫描，与 rg 文本结果并集。
"""
import sqlite3
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from doclens.ripgrep import (
    _binary_doc_ids,
    _nodes_count_bypass,
    _rg_search_root_hits,
    rg_fallback_search,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    from doclens import ripgrep

    ripgrep._nodes_count_cache.clear()
    ripgrep._binary_doc_ids_cache.clear()
    yield
    ripgrep._nodes_count_cache.clear()
    ripgrep._binary_doc_ids_cache.clear()


def _fake_idx(tmp_path: Path, rows: int) -> SimpleNamespace:
    """带 nodes 表的假索引（rows 行，COUNT 真实返回）。"""
    db = tmp_path / "index.db"
    con = sqlite3.connect(db)
    con.execute("CREATE TABLE nodes (node_id TEXT)")
    con.executemany("INSERT INTO nodes VALUES (?)", [("",)] * rows)
    con.commit()
    con.close()
    return SimpleNamespace(index_path=db, search_path=tmp_path)


class TestNodesCountBypass:
    def test_over_threshold_bypasses(self, tmp_path):
        # 阈值缩小到 5（测试规模）；生产用 REGEXP_SKIP_NODES_THRESHOLD（十万级）
        idx = _fake_idx(tmp_path, rows=10)
        assert _nodes_count_bypass(idx, threshold=5) is True

    def test_under_threshold_keeps_old_path(self, tmp_path):
        idx = _fake_idx(tmp_path, rows=3)
        assert _nodes_count_bypass(idx, threshold=5) is False

    def test_count_cached_within_ttl(self, tmp_path):
        idx = _fake_idx(tmp_path, rows=10)
        with patch("doclens.ripgrep.logger") as mock_logger:
            _nodes_count_bypass(idx, threshold=5)
            _nodes_count_bypass(idx, threshold=5)  # 第二次走缓存
        assert mock_logger.info.call_count == 1  # 只有一条跳过日志

    def test_count_failure_treated_as_small(self, tmp_path):
        idx = SimpleNamespace(index_path=tmp_path / "missing.db")
        assert _nodes_count_bypass(idx) is False


class TestRgSearchRootHits:
    def test_directory_scan_finds_matches(self, tmp_path):
        (tmp_path / "a.txt").write_text("hello alpha\nbye", encoding="utf-8")
        (tmp_path / "sub").mkdir()
        (tmp_path / "sub" / "b.txt").write_text(
            "nope\nhello beta", encoding="utf-8"
        )
        hits, timed_out = _rg_search_root_hits("hello", str(tmp_path), use_regex=False)
        assert timed_out is False
        files = {Path(p).name for p in hits}
        assert files == {"a.txt", "b.txt"}
        # 行号 1-based
        assert hits[str(tmp_path / "sub" / "b.txt")] == [2]

    def test_data_dirs_excluded(self, tmp_path):
        (tmp_path / ".cortex").mkdir()
        (tmp_path / ".cortex" / "index.db").write_text(
            "hello-secret", encoding="utf-8"
        )
        (tmp_path / "ok.txt").write_text("hello-public", encoding="utf-8")
        hits, _ = _rg_search_root_hits("hello", str(tmp_path), use_regex=False)
        assert list(hits) == [str(tmp_path / "ok.txt")]

    def test_regex_mode(self, tmp_path):
        (tmp_path / "r.txt").write_text("foo123bar\nfoo45bar", encoding="utf-8")
        hits, _ = _rg_search_root_hits(r"foo\d{3}", str(tmp_path), use_regex=True)
        assert list(hits) == [str(tmp_path / "r.txt")]
        assert hits[str(tmp_path / "r.txt")] == [1]


class TestRgFallbackWithPreHits:
    def test_pre_hits_bypasses_per_file_scan(self, tmp_path):
        """pre_hits 模式：不构建逐文件 rg_paths，直接消费目录扫描结果。"""
        doc = tmp_path / "d1.txt"
        doc.write_text("l1\nneedle here\nl3", encoding="utf-8")
        path_map = {"dsid_x": str(doc)}

        with patch(
            "doclens.ripgrep.build_rg_paths",
            side_effect=AssertionError("逐文件路径构建不应被调用"),
        ), patch("treesearch.ripgrep.rg_search") as mock_rg:
            results = rg_fallback_search(
                "needle", path_map, {}, ["needle"],
                context_before=1, context_after=1, use_regex=False,
                pre_hits={str(doc): [2]},
            )
        mock_rg.assert_not_called()
        assert len(results) == 1
        doc_id, node, matched, _, _ = results[0]
        assert doc_id == "dsid_x"  # normpath 反查命中 doc_id
        assert node["line_start"] == 2
        assert "needle here" in node["text"]
        assert matched == 1

    def test_unknown_path_synthesizes_by_basename(self, tmp_path):
        """path_map 外的命中文件（未索引）按 basename 合成 doc_id。"""
        doc = tmp_path / "wild.txt"
        doc.write_text("needle", encoding="utf-8")
        results = rg_fallback_search(
            "needle", {}, {}, ["needle"], use_regex=False,
            pre_hits={str(doc): [1]},
        )
        assert results[0][0] == "wild"  # basename（无扩展名）兜底

    def test_window_words_overrides_line_context(self, tmp_path):
        """window_words 词预算替代 ±行窗口：合成节点文本按词截取。

        行窗口（±2 行）在代码类文件上远小于词预算对应的文本量。文件
        60 行 × 5 词；window_words=(200, 250) 两窗都超过对应侧的词量，
        应覆盖文件头尾（旧行为只有 ±2 行）。
        """
        doc = tmp_path / "code.txt"
        lines = [f"line {i} padding padding padding" for i in range(60)]
        lines[30] = "the NEEDLE line with context"
        doc.write_text("\n".join(lines), encoding="utf-8")

        results = rg_fallback_search(
            "NEEDLE", {}, {}, ["NEEDLE"], context_before=2, context_after=2,
            use_regex=False, pre_hits={str(doc): [31]},
            window_words=(200, 250),
        )
        assert len(results) == 1
        node = results[0][1]
        assert node["line_start"] == 31
        assert node["text"].startswith("line 0")  # 前窗按词覆盖文件头
        assert "NEEDLE" in node["text"]
        assert node["text"].rstrip().endswith("padding")  # 后窗到文件尾

        # 不传 window_words：旧行为（±2 行窗口）
        results_old = rg_fallback_search(
            "NEEDLE", {}, {}, ["NEEDLE"], context_before=2, context_after=2,
            use_regex=False, pre_hits={str(doc): [31]},
        )
        assert results_old[0][1]["text"].startswith("line 28")

    def test_stale_shadow_md_excluded_from_rg(self, tmp_path):
        """历史遗留 shadow md（._*.md）被排除 glob 跳过，不进 rg 结果。"""
        (tmp_path / "._legacy.pdf.md").write_text(
            "needle-in-stale-shadow", encoding="utf-8"
        )
        (tmp_path / "ok.txt").write_text("needle-fresh", encoding="utf-8")
        hits, _ = _rg_search_root_hits("needle", str(tmp_path), use_regex=False)
        assert list(hits) == [str(tmp_path / "ok.txt")]


class TestBinaryDocIds:
    def _idx_with_docs(self, tmp_path: Path, docs: dict) -> SimpleNamespace:
        db = tmp_path / "index.db"
        con = sqlite3.connect(db)
        con.execute(
            "CREATE TABLE documents (doc_id TEXT PRIMARY KEY, source_path TEXT)"
        )
        con.executemany(
            "INSERT INTO documents VALUES (?, ?)", list(docs.items())
        )
        con.commit()
        con.close()
        return SimpleNamespace(index_path=db, search_path=tmp_path)

    def test_binary_docs_collected(self, tmp_path):
        idx = self._idx_with_docs(tmp_path, {
            "d_txt": r"C:\kb\a.txt", "d_md": r"C:\kb\b.md",
            "d_pdf": r"C:\kb\c.pdf", "d_docx": r"C:\kb\d.docx",
            "d_xlsx": r"C:\kb\e.xlsx",
        })
        assert _binary_doc_ids(idx) == {"d_pdf", "d_docx", "d_xlsx"}

    def test_no_binary_returns_empty(self, tmp_path):
        idx = self._idx_with_docs(tmp_path, {"d1": "a.txt", "d2": "b.md"})
        assert _binary_doc_ids(idx) == set()

    def test_missing_db_returns_empty(self, tmp_path):
        idx = SimpleNamespace(index_path=tmp_path / "missing.db")
        assert _binary_doc_ids(idx) == set()


class TestExecuteGrepNotes:
    """execute_grep_search 的 notes 透出（结果不完整性必须显式告知）。"""

    def _bypass_idx(self, tmp_path: Path) -> SimpleNamespace:
        return SimpleNamespace(
            index_path=tmp_path / "index.db", search_path=tmp_path,
            path_map={}, rg_context_before=2, rg_context_after=2,
            search_context_before=200, search_context_after=600,
        )

    def test_rg_timeout_yields_note(self, tmp_path):
        from doclens.ripgrep import execute_grep_search

        idx = self._bypass_idx(tmp_path)
        with patch("doclens.ripgrep._nodes_count_bypass", return_value=True), patch(
            "doclens.ripgrep._rg_search_root_hits", return_value=({}, True)
        ):
            result = execute_grep_search(idx, "whatever")
        assert any("超时" in n for n in result.notes)

    def test_binary_subset_over_limit_yields_note(self, tmp_path):
        """二进制子集节点数超护栏：放弃 REGEXP 兜底并注明（不卡死）。"""
        from doclens.ripgrep import execute_grep_search

        db = tmp_path / "index.db"
        con = sqlite3.connect(db)
        con.execute("CREATE TABLE nodes (node_id TEXT, doc_id TEXT)")
        con.executemany("INSERT INTO nodes VALUES (?, ?)", [("", "d_pdf")] * 5)
        con.execute(
            "CREATE TABLE documents (doc_id TEXT PRIMARY KEY, source_path TEXT)"
        )
        con.execute("INSERT INTO documents VALUES ('d_pdf', ?)", (r"C:\kb\a.pdf",))
        con.commit()
        con.close()
        idx = self._bypass_idx(tmp_path)
        idx.index_path = db
        with patch("doclens.ripgrep._nodes_count_bypass", return_value=True), patch(
            "doclens.ripgrep._rg_search_root_hits", return_value=({}, False)
        ), patch("doclens.ripgrep.REGEXP_SKIP_NODES_THRESHOLD", 3):
            result = execute_grep_search(idx, "needle")
        assert any("二进制" in n for n in result.notes)

    def test_no_notes_when_healthy(self, tmp_path):
        from doclens.ripgrep import execute_grep_search

        idx = self._bypass_idx(tmp_path)
        with patch("doclens.ripgrep._nodes_count_bypass", return_value=True), patch(
            "doclens.ripgrep._rg_search_root_hits", return_value=({}, False)
        ):
            result = execute_grep_search(idx, "whatever")
        assert result.notes == []


class TestPseudoIdCollision:
    """_rg_fallback_path_map 伪 doc_id 撞名：同名未索引文件都须进入 rg 范围。"""

    def test_same_basename_files_both_searched(self, tmp_path):
        import os

        from doclens.ripgrep import _rg_fallback_path_map

        (tmp_path / "a").mkdir()
        (tmp_path / "b").mkdir()
        f1 = tmp_path / "a" / "readme.md"
        f2 = tmp_path / "b" / "readme.md"
        f1.write_text("needle", encoding="utf-8")
        f2.write_text("needle", encoding="utf-8")
        idx = SimpleNamespace(search_path=tmp_path, allowed_source_types=None)
        merged = _rg_fallback_path_map(idx, {})
        vals = {os.path.abspath(v) for v in merged.values()}
        assert os.path.abspath(str(f1)) in vals
        assert os.path.abspath(str(f2)) in vals


class TestRgFallbackSourceTypes:
    """rg 兜底磁盘发现不受 allowed_source_types 收缩。

    grep 承诺「搜索所有文件（包括未索引的）」——被类型配置排除的代码文件
    （如 .kt，source_type=code 默认未启用）不索引，但 rg 纯文本搜索应能
    搜到；与大语料目录扫描（_rg_search_root_hits 直扫磁盘）口径一致。
    """

    def test_code_file_outside_source_types_still_searched(self, tmp_path):
        import os

        from doclens.ripgrep import _rg_fallback_path_map
        from treesearch import TreeSearchConfig, set_config
        from treesearch.config import get_config

        original = get_config()
        try:
            # 全局也注入类型过滤（模拟生产：doclens set_config 透传），
            # 两侧都不应把 .kt 挡在 rg 兜底之外
            set_config(TreeSearchConfig(allowed_source_types=["markdown"]))
            kt = tmp_path / "SplashActivity.kt"
            kt.write_text("const val SPLASH_DURATION_MS = 1200L", encoding="utf-8")
            (tmp_path / "note.md").write_text("hello", encoding="utf-8")
            idx = SimpleNamespace(search_path=tmp_path, allowed_source_types=["markdown"])
            merged = _rg_fallback_path_map(idx, {})
            vals = {os.path.abspath(v) for v in merged.values()}
            assert os.path.abspath(str(kt)) in vals
            assert os.path.abspath(str(tmp_path / "note.md")) in vals
        finally:
            set_config(original)


class TestLikeSearchDocSubset:
    """treesearch like_search 的 doc_ids 子集过滤（REGEXP 兜底的目标收敛）。"""

    @pytest.fixture()
    def fts(self, tmp_path):
        from treesearch.fts import FTS5Index
        from treesearch.tree import Document, assign_node_ids

        idx = FTS5Index(db_path=tmp_path / "i.db")
        for doc_id, text in (
            ("doc_bin", "alpha needle inside pdf"),
            ("doc_txt", "needle inside txt"),
            ("doc_other", "nothing here"),
        ):
            structure = [{"title": "t", "text": text}]
            assign_node_ids(structure)
            idx.index_document(
                Document(
                    doc_id=doc_id, doc_name=doc_id, structure=structure,
                    source_type="text",
                ),
            )
        idx.close()
        return FTS5Index(db_path=tmp_path / "i.db")  # 重开（模拟生产只读使用）

    def test_subset_limits_results(self, fts):
        try:
            hits = fts.like_search("needle", use_regex=True, doc_ids={"doc_bin"})
            assert {h["doc_id"] for h in hits} == {"doc_bin"}
        finally:
            fts.close()

    def test_subset_empty_returns_nothing(self, fts):
        try:
            assert fts.like_search("needle", use_regex=True, doc_ids=set()) == []
        finally:
            fts.close()

    def test_none_scans_all(self, fts):
        try:
            hits = fts.like_search("needle", use_regex=True)
            assert {h["doc_id"] for h in hits} == {"doc_bin", "doc_txt"}
        finally:
            fts.close()
