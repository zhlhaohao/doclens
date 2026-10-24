"""grep 双引擎分流测试：文本 → rg 目录扫描，二进制 → SQLite REGEXP 子集。

背景：like_search(use_regex=True) 的 REGEXP 是逐行 Python UDF，全表扫在
百万节点级是分钟~十分钟级（51 万文档实测卡死对话流）。统一双引擎后：

- 文本腿：rg 单进程递归扫描（原生并行，同规模数十秒），覆盖磁盘所有
  文本文件（含未索引的）——不再依赖「DB 有结果就短路」
- 二进制腿：rg 搜不了 pdf/docx 磁盘原文，解析文本只在索引库——走
  REGEXP 限定二进制子集扫描，与 rg 文本结果并集
- rg 不可用：整体降级为 REGEXP 全量扫描（受规模护栏约束）
"""
import sqlite3
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from doclens.ripgrep import (
    _binary_doc_ids,
    _nodes_total_count,
    rg_search_root_hits,
    _targets_to_rg_globs,
    rg_fallback_search,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    from doclens import ripgrep

    ripgrep._binary_doc_ids_cache.clear()
    yield
    ripgrep._binary_doc_ids_cache.clear()


class TestRgSearchRootHits:
    def test_directory_scan_finds_matches(self, tmp_path):
        (tmp_path / "a.txt").write_text("hello alpha\nbye", encoding="utf-8")
        (tmp_path / "sub").mkdir()
        (tmp_path / "sub" / "b.txt").write_text(
            "nope\nhello beta", encoding="utf-8"
        )
        hits, status = rg_search_root_hits("hello", str(tmp_path), use_regex=False)
        assert status == "ok", status  # AP-46：状态是枚举，不是布尔
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
        hits, _ = rg_search_root_hits("hello", str(tmp_path), use_regex=False)
        assert list(hits) == [str(tmp_path / "ok.txt")]

    def test_gitignore_respected_without_git(self, tmp_path):
        """非 git 目录也尊重 .gitignore（--no-require-git，与索引链路口径一致）。"""
        (tmp_path / ".gitignore").write_text("ignored.md\n", encoding="utf-8")
        (tmp_path / "ignored.md").write_text("needle-hidden", encoding="utf-8")
        (tmp_path / "ok.md").write_text("needle-visible", encoding="utf-8")
        assert not (tmp_path / ".git").exists()
        hits, _ = rg_search_root_hits("needle", str(tmp_path), use_regex=False)
        assert list(hits) == [str(tmp_path / "ok.md")]

    def test_regex_mode(self, tmp_path):
        (tmp_path / "r.txt").write_text("foo123bar\nfoo45bar", encoding="utf-8")
        hits, _ = rg_search_root_hits(r"foo\d{3}", str(tmp_path), use_regex=True)
        assert list(hits) == [str(tmp_path / "r.txt")]
        assert hits[str(tmp_path / "r.txt")] == [1]

    def test_include_globs_scope_to_target_dir(self, tmp_path):
        """include_globs 把扫描收敛到目标目录（相对根前缀语义）。"""
        (tmp_path / "科技").mkdir()
        (tmp_path / "other").mkdir()
        (tmp_path / "科技" / "a.md").write_text("needle", encoding="utf-8")
        (tmp_path / "other" / "b.md").write_text("needle", encoding="utf-8")
        hits, _ = rg_search_root_hits(
            "needle", str(tmp_path), use_regex=False,
            include_globs=["科技/**", "科技"],
        )
        assert list(hits) == [str(tmp_path / "科技" / "a.md")]


class TestTargetsToRgGlobs:
    def test_dir_target_gets_recursive_glob(self):
        assert _targets_to_rg_globs(["科技"]) == ["科技/**", "科技"]

    def test_file_target_exact(self):
        assert _targets_to_rg_globs(["科技/a.md"]) == ["科技/a.md/**", "科技/a.md"]

    def test_backslash_and_trailing_slash_normalized(self):
        assert _targets_to_rg_globs(["科技\\sub\\", "  /x  "]) == [
            "科技/sub/**", "科技/sub", "/x/**", "/x",
        ]


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
                use_regex=False,
                pre_hits={str(doc): [2]},
                window_words=(200, 600),
            )
        mock_rg.assert_not_called()
        assert len(results) == 1
        doc_id, node, matched, _, _, _ = results[0]
        assert doc_id == "dsid_x"  # normpath 反查命中 doc_id
        assert node["line_start"] == 1  # 词窗起点行号（短文窗口覆盖首行）
        assert "needle here" in node["text"]
        assert matched == 1

    def test_unknown_path_synthesizes_by_basename(self, tmp_path):
        """path_map 外的命中文件（未索引）按 basename 合成 doc_id。"""
        doc = tmp_path / "wild.txt"
        doc.write_text("needle", encoding="utf-8")
        results = rg_fallback_search(
            "needle", {}, {}, ["needle"], use_regex=False,
            pre_hits={str(doc): [1]}, window_words=(200, 600),
        )
        assert results[0][0] == "wild"  # basename（无扩展名）兜底

    def test_window_words_word_budget(self, tmp_path):
        """window_words 词预算：合成节点文本按词截取。

        文件 60 行 × 5 词；window_words=(200, 250) 两窗都超过对应侧的
        词量，应覆盖文件头尾。
        """
        doc = tmp_path / "code.txt"
        lines = [f"line {i} padding padding padding" for i in range(60)]
        lines[30] = "the NEEDLE line with context"
        doc.write_text("\n".join(lines), encoding="utf-8")

        results = rg_fallback_search(
            "NEEDLE", {}, {}, ["NEEDLE"],
            use_regex=False, pre_hits={str(doc): [31]},
            window_words=(200, 250),
        )
        assert len(results) == 1
        node = results[0][1]
        assert node["line_start"] == 1  # 前窗按词覆盖文件头；语义=词窗起始行而非首个命中行
        assert node["text"].startswith("line 0")  # 前窗按词覆盖文件头
        assert "NEEDLE" in node["text"]
        assert node["text"].rstrip().endswith("padding")  # 后窗到文件尾

        # 小词预算：窗口收窄到命中行附近
        results_narrow = rg_fallback_search(
            "NEEDLE", {}, {}, ["NEEDLE"],
            use_regex=False, pre_hits={str(doc): [31]},
            window_words=(10, 10),
        )
        text_narrow = results_narrow[0][1]["text"]
        assert "NEEDLE" in text_narrow
        assert not text_narrow.startswith("line 0")  # 前窗只有 10 词，盖不到文件头

    def test_stale_shadow_md_excluded_from_rg(self, tmp_path):
        """历史遗留 shadow md（._*.md）被排除 glob 跳过，不进 rg 结果。"""
        (tmp_path / "._legacy.pdf.md").write_text(
            "needle-in-stale-shadow", encoding="utf-8"
        )
        (tmp_path / "ok.txt").write_text("needle-fresh", encoding="utf-8")
        hits, _ = rg_search_root_hits("needle", str(tmp_path), use_regex=False)
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


class TestNodesTotalCount:
    def test_count_from_db(self, tmp_path):
        db = tmp_path / "index.db"
        con = sqlite3.connect(db)
        con.execute("CREATE TABLE nodes (node_id TEXT)")
        con.executemany("INSERT INTO nodes VALUES (?)", [("",)] * 7)
        con.commit()
        con.close()
        idx = SimpleNamespace(index_path=db)
        assert _nodes_total_count(idx) == 7

    def test_missing_db_returns_zero(self, tmp_path):
        assert _nodes_total_count(
            SimpleNamespace(index_path=tmp_path / "missing.db")
        ) == 0


class TestExecuteGrepDualEngine:
    """execute_grep_search 双引擎分流 + notes 透出（不完整必须显式告知）。"""

    def _idx(self, tmp_path: Path) -> SimpleNamespace:
        return SimpleNamespace(
            index_path=tmp_path / "index.db", search_path=tmp_path,
            path_map={}, 
            search_context_before=200, search_context_after=600,
            grep_score_threshold=0.0, grep_max_results=50,
        )

    def test_rg_timeout_yields_note(self, tmp_path):
        from doclens.ripgrep import execute_grep_search

        idx = self._idx(tmp_path)
        with patch("doclens.ripgrep.rg_search_root_hits",
                   return_value=({}, "timeout")):
            result = execute_grep_search(idx, "whatever")
        assert any("超时" in n for n in result.notes)

    def test_binary_subset_over_limit_yields_note(self, tmp_path):
        """二进制子集节点数超护栏：放弃 REGEXP 扫描并注明（不卡死）。"""
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
        idx = self._idx(tmp_path)
        idx.index_path = db
        with patch("doclens.ripgrep.rg_search_root_hits", return_value=({}, False)), \
             patch("doclens.ripgrep.REGEXP_SKIP_NODES_THRESHOLD", 3):
            result = execute_grep_search(idx, "needle")
        assert any("二进制" in n for n in result.notes)

    def test_no_notes_when_healthy(self, tmp_path):
        from doclens.ripgrep import execute_grep_search

        idx = self._idx(tmp_path)
        with patch("doclens.ripgrep.rg_search_root_hits", return_value=({}, False)):
            result = execute_grep_search(idx, "whatever")
        assert result.notes == []

    def test_rg_unavailable_degrades_to_regexp(self, tmp_path):
        """rg 不可用：文本腿降级为 REGEXP 全量扫描（小库），仍出结果。"""
        from doclens.ripgrep import execute_grep_search

        db = tmp_path / "index.db"
        from treesearch.fts import FTS5Index
        from treesearch.tree import Document, assign_node_ids

        fts = FTS5Index(db_path=str(db))
        structure = [{"title": "t", "text": "needle in indexed text"}]
        assign_node_ids(structure)
        fts.index_document(
            Document(doc_id="d1", doc_name="d1", structure=structure,
                     source_type="text"),
        )
        fts.close()
        idx = self._idx(tmp_path)
        idx.index_path = db
        with patch("doclens.ripgrep.rg_available", return_value=False), \
             patch("doclens.ripgrep.rg_search_root_hits",
                   side_effect=AssertionError("rg 不可用时不应目录扫描")):
            result = execute_grep_search(idx, "needle")
        assert {c[0] for c in result.content_results} == {"d1"}

    def test_rg_unavailable_large_corpus_notes_incomplete(self, tmp_path):
        """rg 不可用 + 索引超护栏：注明不完整而非卡死。"""
        from doclens.ripgrep import execute_grep_search

        db = tmp_path / "index.db"
        con = sqlite3.connect(db)
        con.execute("CREATE TABLE nodes (node_id TEXT, doc_id TEXT)")
        con.executemany("INSERT INTO nodes VALUES (?, ?)", [("", "d1")] * 10)
        con.execute(
            "CREATE TABLE documents (doc_id TEXT PRIMARY KEY, source_path TEXT)"
        )
        con.execute("INSERT INTO documents VALUES ('d1', ?)", (r"C:\kb\a.md",))
        con.commit()
        con.close()
        idx = self._idx(tmp_path)
        idx.index_path = db
        with patch("doclens.ripgrep.rg_available", return_value=False), \
             patch("doclens.ripgrep.REGEXP_SKIP_NODES_THRESHOLD", 5):
            result = execute_grep_search(idx, "needle")
        assert any("rg 不可用" in n for n in result.notes)

    def test_unindexed_text_file_found_via_rg(self, tmp_path):
        """双引擎统一路径：小库也走 rg 扫盘，未索引文本文件必须被搜到。"""
        from doclens.ripgrep import execute_grep_search

        db = tmp_path / "index.db"
        from treesearch.fts import FTS5Index
        from treesearch.tree import Document, assign_node_ids

        fts = FTS5Index(db_path=str(db))
        structure = [{"title": "t", "text": "needle in indexed doc"}]
        assign_node_ids(structure)
        fts.index_document(
            Document(doc_id="d_idx", doc_name="d_idx", structure=structure,
                     source_type="text"),
        )
        fts.close()

        (tmp_path / "untracked.md").write_text(
            "needle in unindexed file", encoding="utf-8"
        )
        idx = self._idx(tmp_path)
        idx.index_path = db
        result = execute_grep_search(idx, "needle")
        nodes = {c[1].get("source_path", c[0]) for c in result.content_results}
        assert any(str(p).endswith("untracked.md") for p in nodes)

    def test_allowed_targets_scope_rg_scan(self, tmp_path):
        """allowed_targets：rg 扫描收敛到目标目录，其他目录不被搜。"""
        from doclens.ripgrep import execute_grep_search

        (tmp_path / "科技").mkdir()
        (tmp_path / "other").mkdir()
        (tmp_path / "科技" / "a.md").write_text("needle", encoding="utf-8")
        (tmp_path / "other" / "b.md").write_text("needle", encoding="utf-8")

        idx = self._idx(tmp_path)
        result = execute_grep_search(
            idx, "needle", allowed={"nonexistent"}, allowed_targets=["科技"],
        )
        nodes = [c[1].get("source_path", "") for c in result.content_results]
        assert nodes and all(str(p).endswith("a.md") for p in nodes)


class TestRgFallbackSourceTypes:
    """rg 兜底磁盘发现不受 allowed_source_types 收缩。

    grep 承诺「搜索所有文件（包括未索引的）」——被类型配置排除的代码文件
    （如 .kt，source_type=code 默认未启用）不索引，但 rg 纯文本搜索应能
    搜到；与 rg 目录扫描（rg_search_root_hits 直扫磁盘）口径一致。
    """

    def test_code_file_outside_source_types_still_searched(self, tmp_path):
        import os

        from doclens.ripgrep import execute_grep_search, _rg_fallback_path_map
        from treesearch import TreeSearchConfig, set_config
        from treesearch.config import get_config

        original = get_config()
        try:
            # 全局也注入类型过滤（模拟生产：doclens set_config 透传），
            # rg 目录扫描与磁盘发现都不应把 .kt 挡在 rg 之外
            set_config(TreeSearchConfig(allowed_source_types=["markdown"]))
            kt = tmp_path / "SplashActivity.kt"
            kt.write_text("const val SPLASH_DURATION_MS = 1200L", encoding="utf-8")
            (tmp_path / "note.md").write_text("hello", encoding="utf-8")
            idx = SimpleNamespace(
                search_path=tmp_path, allowed_source_types=["markdown"],
                index_path=tmp_path / "index.db", path_map={},
                
                search_context_before=200, search_context_after=600,
                grep_score_threshold=0.0, grep_max_results=50,
            )
            merged = _rg_fallback_path_map(idx, {})
            vals = {os.path.abspath(v) for v in merged.values()}
            assert os.path.abspath(str(kt)) in vals
            assert os.path.abspath(str(tmp_path / "note.md")) in vals

            result = execute_grep_search(idx, "SPLASH_DURATION_MS")
            nodes = [c[1].get("source_path", "") for c in result.content_results]
            assert any(str(p).endswith("SplashActivity.kt") for p in nodes)
        finally:
            set_config(original)


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


class TestLikeSearchDocSubset:
    """treesearch like_search 的 doc_ids 子集过滤（REGEXP 子集扫描的目标收敛）。"""

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


class TestBinaryProfileCacheInvalidation:
    """AP-12：reindex 后二进制文档画像缓存必须失效（否则静默漏结果）。"""

    def _make_idx(self, tmp_path):
        """最小假 idx：真 SQLite 库 + documents 表。"""
        import sqlite3
        from types import SimpleNamespace

        db = tmp_path / "index.db"
        conn = sqlite3.connect(str(db))
        conn.executescript(
            """
            CREATE TABLE documents (doc_id TEXT PRIMARY KEY, source_path TEXT);
            CREATE TABLE nodes (doc_id TEXT, text TEXT);
            """
        )
        conn.execute("INSERT INTO documents VALUES ('d1', 'a.pdf')")
        conn.execute("INSERT INTO nodes VALUES ('d1', 'x')")
        conn.commit()
        conn.close()
        return SimpleNamespace(index_path=str(db)), db

    def test_cache_reused_within_ttl(self, tmp_path):
        from doclens import ripgrep

        idx, _db = self._make_idx(tmp_path)
        first = ripgrep._binary_doc_profile(idx)
        assert first[0] == {"d1"}
        second = ripgrep._binary_doc_profile(idx)  # 命中缓存
        assert second[0] == first[0]

    def test_index_change_invalidates_without_hook(self, tmp_path):
        """跨进程 reindex 场景：文件 mtime/size 变即失效（版本戳兜底）。"""
        import sqlite3
        import time

        from doclens import ripgrep

        idx, db = self._make_idx(tmp_path)
        assert ripgrep._binary_doc_profile(idx)[0] == {"d1"}
        time.sleep(0.01)  # 确保 mtime 可区分
        conn = sqlite3.connect(str(db))
        conn.execute("INSERT INTO documents VALUES ('d2', 'b.docx')")
        conn.execute("INSERT INTO nodes VALUES ('d2', 'y')")
        conn.commit()
        conn.close()
        assert ripgrep._binary_doc_profile(idx)[0] == {"d1", "d2"}

    def test_explicit_invalidate(self, tmp_path):
        from doclens import ripgrep

        idx, _db = self._make_idx(tmp_path)
        ripgrep._binary_doc_profile(idx)
        assert str(idx.index_path) in ripgrep._binary_doc_ids_cache
        ripgrep.invalidate_binary_doc_profile(idx.index_path)
        assert str(idx.index_path) not in ripgrep._binary_doc_ids_cache

    def test_index_manager_build_path_map_clears_cache(self, tmp_path):
        """宿主接线：IndexManager.build_path_map 会清画像缓存。"""
        from doclens import ripgrep
        from doclens.config import CortexConfig
        from doclens.index_manager import IndexManager

        idx, db = self._make_idx(tmp_path)
        mgr = IndexManager.__new__(IndexManager)
        mgr._config = CortexConfig()
        mgr.search_path = str(tmp_path)
        mgr.index_path = str(db)
        # 预热缓存
        ripgrep._binary_doc_profile(idx)
        assert str(db) in ripgrep._binary_doc_ids_cache
        mgr.build_path_map()
        assert str(db) not in ripgrep._binary_doc_ids_cache
