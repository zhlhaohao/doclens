# -*- coding: utf-8 -*-
"""变更检测流式化（ADR-0020）测试。

覆盖：
- 流式原语：iter_index_meta（键集分页/批边界）、filter_known_source_paths
  （跨 500 分块）、iter_resolve_paths（与 resolve_paths 同过滤、不去重）
- has_changed_files 场景等价：未变更/修改/删除/新增/failed 在册/
  不支持扩展名/max_files 溢出（保守 True）
"""
import pytest


# ---------------------------------------------------------------------------
# treesearch 流式原语
# ---------------------------------------------------------------------------

class TestIterIndexMeta:
    def test_yields_all_rows_in_order(self, tmp_path):
        from treesearch.fts import FTS5Index

        fts = FTS5Index(db_path=str(tmp_path / "idx.db"))
        try:
            meta = {f"/docs/f{i:03d}.md": f"hash{i}" for i in range(7)}
            fts.set_index_meta_batch(meta)
            pairs = list(fts.iter_index_meta(batch_size=3))
            assert pairs == sorted(meta.items())
        finally:
            fts.close()

    def test_batch_size_one_boundary(self, tmp_path):
        """batch_size=1 逐行分页不丢不重。"""
        from treesearch.fts import FTS5Index

        fts = FTS5Index(db_path=str(tmp_path / "idx.db"))
        try:
            fts.set_index_meta_batch({"/a.md": "h1", "/b.md": "h2", "/c.md": "h3"})
            pairs = list(fts.iter_index_meta(batch_size=1))
            assert [p[0] for p in pairs] == ["/a.md", "/b.md", "/c.md"]
        finally:
            fts.close()

    def test_empty_table(self, tmp_path):
        from treesearch.fts import FTS5Index

        fts = FTS5Index(db_path=str(tmp_path / "idx.db"))
        try:
            assert list(fts.iter_index_meta()) == []
        finally:
            fts.close()


class TestFilterKnownSourcePaths:
    def test_subset_and_chunking(self, tmp_path):
        """>500 条跨分块探测，结果正确。"""
        from treesearch.fts import FTS5Index

        fts = FTS5Index(db_path=str(tmp_path / "idx.db"))
        try:
            known = {f"/k/{i}.md" for i in range(600)}
            fts.set_index_meta_batch({p: "h" for p in known})
            probe = list(known) + ["/unknown/1.md", "/unknown/2.md"]
            result = fts.filter_known_source_paths(probe)
            assert result == known
        finally:
            fts.close()


class TestIterResolvePaths:
    def test_same_filters_as_resolve_paths(self, tmp_path):
        from treesearch.pathutil import resolve_paths, iter_resolve_paths

        (tmp_path / ".git").mkdir()
        (tmp_path / ".git" / "ignored.md").write_text("x", encoding="utf-8")
        (tmp_path / "sub").mkdir()
        (tmp_path / "a.md").write_text("x", encoding="utf-8")
        (tmp_path / "sub" / "b.md").write_text("x", encoding="utf-8")
        (tmp_path / "c.bin").write_text("x", encoding="utf-8")  # 不支持扩展名

        exts = {".md"}
        listed = resolve_paths([str(tmp_path)], allowed_extensions=exts)
        streamed = list(iter_resolve_paths([str(tmp_path)], allowed_extensions=exts))
        assert sorted(streamed) == sorted(listed)
        # .git 被忽略、.bin 被扩展名过滤
        assert all(".git" not in p for p in streamed)
        assert all(not p.endswith(".bin") for p in streamed)

    def test_no_dedup_across_patterns(self, tmp_path):
        """不去重是文档化行为——同一路径两个 pattern 产出两次。"""
        from treesearch.pathutil import iter_resolve_paths

        f = tmp_path / "a.md"
        f.write_text("x", encoding="utf-8")
        out = list(iter_resolve_paths([str(f), str(f)]))
        assert len(out) == 2


# ---------------------------------------------------------------------------
# has_changed_files 场景等价（真实 IndexManager）
# ---------------------------------------------------------------------------

@pytest.fixture()
def env(tmp_path, monkeypatch):
    """迷你知识库 + 已建索引：返回 (IndexManager, corpus_dir)。"""
    corpus = tmp_path / "kb"
    corpus.mkdir()
    (corpus / "a.md").write_text("# 甲\n\n磁锚 内容 甲\n", encoding="utf-8")
    (corpus / "b.md").write_text("# 乙\n\n磁锚 内容 乙\n", encoding="utf-8")
    monkeypatch.chdir(corpus)

    from doclens.config import CortexConfig
    from doclens.index_manager import IndexManager

    idx = IndexManager(CortexConfig())
    assert idx.load_or_build_index()
    return idx, corpus


class TestHasChangedFilesScenarios:
    def test_unchanged_false(self, env):
        idx, _ = env
        assert idx.has_changed_files() is False

    def test_modified_true(self, env):
        idx, corpus = env
        assert idx.has_changed_files() is False
        (corpus / "a.md").write_text("# 甲 改\n\n磁锚 内容 变了\n", encoding="utf-8")
        assert idx.has_changed_files() is True

    def test_deleted_true(self, env):
        idx, corpus = env
        (corpus / "b.md").unlink()
        assert idx.has_changed_files() is True

    def test_new_file_true(self, env):
        idx, corpus = env
        (corpus / "c.md").write_text("# 丙\n\n新增\n", encoding="utf-8")
        assert idx.has_changed_files() is True

    def test_new_unsupported_ext_false(self, env):
        """不支持扩展名的新文件不算新增（supported_exts 白名单语义）。"""
        idx, corpus = env
        (corpus / "data.bin").write_bytes(b"\x00\x01")
        assert idx.has_changed_files() is False

    def test_new_file_in_failed_files_false(self, env):
        """failed_files 在册的新文件不算新增（连败跳过语义）。"""
        import os
        idx, corpus = env
        f = corpus / "d.md"
        f.write_text("# 丁\n\n失败者\n", encoding="utf-8")
        from treesearch.fts import FTS5Index
        fts = FTS5Index(db_path=idx.index_path)
        try:
            fts.upsert_failed_file(os.path.abspath(str(f)), "simulated parse error")
            fts.commit()  # upsert_failed_file 由调用方负责提交
        finally:
            fts.close()
        assert idx.has_changed_files() is False

    def test_max_files_overflow_conservative_true(self, tmp_path, monkeypatch):
        """walk 超 max_dir_files 上限 → 抛异常 → 保守返回 True。

        判别式设计：cap=2、2 个已索引 + 第 3 个 failed 在册——若非溢出，
        第三文件不算新增（failed 在册），True 只能来自溢出保守路径。
        """
        corpus = tmp_path / "kb2"
        corpus.mkdir()
        for i in range(2):
            (corpus / f"f{i}.md").write_text(f"# {i}\n", encoding="utf-8")
        monkeypatch.chdir(corpus)
        monkeypatch.setenv("TREESEARCH_MAX_DIR_FILES", "2")

        from doclens.config import CortexConfig
        from doclens.index_manager import IndexManager

        idx = IndexManager(CortexConfig())
        assert idx.load_or_build_index()
        assert idx.has_changed_files() is False  # 基线：cap 内无变化

        import os
        f = corpus / "f2.md"
        f.write_text("# 2\n", encoding="utf-8")
        from treesearch.fts import FTS5Index
        fts = FTS5Index(db_path=idx.index_path)
        try:
            fts.upsert_failed_file(os.path.abspath(str(f)), "simulated parse error")
            fts.commit()
        finally:
            fts.close()
        assert idx.has_changed_files() is True  # walk 计 3 > cap 2 → 保守 True
