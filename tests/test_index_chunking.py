# -*- coding: utf-8 -*-
"""分块索引（ADR-0018）测试。

覆盖：
- 配置链路：TREESEARCH_INDEX_CHUNK_SIZE env → TreeSearchConfig / CortexConfig / IndexManager
- 分块语义：小 chunk 多块落库、0=不分块、块边界（恰好整除/余 1）
- 断点续扫：首块入库后模拟中断，重跑自动跳过已完成文件
- return_documents=False：不物化返回值，IndexStats 计数正确
- 等价性：分块与不分块产出的索引内容一致（同一文档集可搜）
"""
import asyncio

import pytest


# ---------------------------------------------------------------------------
# 配置链路
# ---------------------------------------------------------------------------

class TestConfigPlumbing:
    def test_treesearch_default_chunk_size(self):
        from treesearch.config import TreeSearchConfig
        cfg = TreeSearchConfig()
        assert cfg.index_chunk_size == 500

    def test_treesearch_env_override(self, monkeypatch):
        from treesearch.config import TreeSearchConfig
        monkeypatch.setenv("TREESEARCH_INDEX_CHUNK_SIZE", "7")
        cfg = TreeSearchConfig.from_env()
        assert cfg.index_chunk_size == 7

    def test_treesearch_env_zero_means_disabled(self, monkeypatch):
        """0 = 不分块（旧行为）——与 max_dir_files 的 0=不设限有意相反。"""
        from treesearch.config import TreeSearchConfig
        monkeypatch.setenv("TREESEARCH_INDEX_CHUNK_SIZE", "0")
        cfg = TreeSearchConfig.from_env()
        assert cfg.index_chunk_size == 0

    def test_treesearch_env_invalid_ignored(self, monkeypatch):
        from treesearch.config import TreeSearchConfig
        monkeypatch.setenv("TREESEARCH_INDEX_CHUNK_SIZE", "garbage")
        cfg = TreeSearchConfig.from_env()
        assert cfg.index_chunk_size == 500

    def test_doclens_config_field(self, monkeypatch):
        from doclens.config import CortexConfig
        monkeypatch.setenv("TREESEARCH_INDEX_CHUNK_SIZE", "123")
        cfg = CortexConfig()
        assert cfg.treesearch_index_chunk_size == 123
        assert CortexConfig().treesearch_index_chunk_size == 123  # env 未设时默认

    def test_doclens_default_500(self, monkeypatch):
        from doclens.config import CortexConfig
        monkeypatch.delenv("TREESEARCH_INDEX_CHUNK_SIZE", raising=False)
        assert CortexConfig().treesearch_index_chunk_size == 500

    def test_index_manager_property(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        monkeypatch.setenv("TREESEARCH_INDEX_CHUNK_SIZE", "42")
        from doclens.config import CortexConfig
        from doclens.index_manager import IndexManager
        idx = IndexManager(CortexConfig())
        assert idx.index_chunk_size == 42
        ts_cfg = idx._ts_config()
        assert ts_cfg.index_chunk_size == 42


# ---------------------------------------------------------------------------
# 分块语义（真实索引）
# ---------------------------------------------------------------------------

def _make_files(tmp_path, n: int):
    for i in range(n):
        (tmp_path / f"d{i:03d}.md").write_text(
            f"# 文档 {i}\n\n磁锚 检索 内容 {i}\n", encoding="utf-8")


class TestChunkedIndexing:
    def test_small_chunk_all_indexed(self, tmp_path):
        """chunk=3 × 10 文件 → 4 块全部落库，可搜索。"""
        from treesearch.indexer import build_index

        _make_files(tmp_path, 10)
        result = asyncio.run(build_index(
            [str(tmp_path)], output_dir=str(tmp_path / "idx"),
            index_chunk_size=3, return_documents=False,
        ))
        stats = result.stats
        assert stats.indexed_files == 10
        assert stats.failed_files == 0
        # 不物化：返回列表为空
        assert list(result) == []

        from treesearch.fts import FTS5Index
        fts = FTS5Index(db_path=str(tmp_path / "idx" / "index.db"))
        try:
            assert fts.get_stats()["document_count"] == 10
        finally:
            fts.close()

    def test_chunk_boundary_exact_multiple(self, tmp_path):
        """10 文件 chunk=5 → 恰好 2 块，无空尾块异常。"""
        from treesearch.indexer import build_index

        _make_files(tmp_path, 10)
        result = asyncio.run(build_index(
            [str(tmp_path)], output_dir=str(tmp_path / "idx"),
            index_chunk_size=5, return_documents=False,
        ))
        assert result.stats.indexed_files == 10

    def test_chunk_boundary_remainder_one(self, tmp_path):
        """11 文件 chunk=5 → 3 块（5+5+1），尾块 1 个文件不丢。"""
        from treesearch.indexer import build_index

        _make_files(tmp_path, 11)
        result = asyncio.run(build_index(
            [str(tmp_path)], output_dir=str(tmp_path / "idx"),
            index_chunk_size=5, return_documents=False,
        ))
        assert result.stats.indexed_files == 11
        from treesearch.fts import FTS5Index
        fts = FTS5Index(db_path=str(tmp_path / "idx" / "index.db"))
        try:
            assert fts.get_stats()["document_count"] == 11
        finally:
            fts.close()

    def test_chunk_zero_disables_chunking(self, tmp_path):
        """0 = 不分块：仍能完成（等价旧行为，小语料下无差别）。"""
        from treesearch.indexer import build_index

        _make_files(tmp_path, 6)
        result = asyncio.run(build_index(
            [str(tmp_path)], output_dir=str(tmp_path / "idx"),
            index_chunk_size=0, return_documents=False,
        ))
        assert result.stats.indexed_files == 6

    def test_return_documents_true_materializes(self, tmp_path):
        """默认 return_documents=True：返回列表携带全部 Document（兼容旧契约）。"""
        from treesearch.indexer import build_index

        _make_files(tmp_path, 4)
        result = asyncio.run(build_index(
            [str(tmp_path)], output_dir=str(tmp_path / "idx"),
            index_chunk_size=2,
        ))
        assert len(result) == 4
        assert result.stats.indexed_files == 4

    def test_search_equivalent_chunked_vs_whole(self, tmp_path, tmp_path_factory):
        """分块与不分块产出的索引，搜索命中集合一致。"""
        from treesearch.indexer import build_index
        from treesearch.fts import FTS5Index

        dir_a = tmp_path / "a"
        dir_b = tmp_path / "b"
        dir_a.mkdir()
        dir_b.mkdir()
        _make_files(dir_a, 9)
        for f in sorted(dir_a.iterdir()):
            f.write_text(f.read_text(encoding="utf-8"), encoding="utf-8")
            (dir_b / f.name).write_text(f.read_text(encoding="utf-8"), encoding="utf-8")

        asyncio.run(build_index([str(dir_a)], output_dir=str(tmp_path / "ia"),
                                index_chunk_size=2, return_documents=False))
        asyncio.run(build_index([str(dir_b)], output_dir=str(tmp_path / "ib"),
                                index_chunk_size=0, return_documents=False))

        fts_a = FTS5Index(db_path=str(tmp_path / "ia" / "index.db"))
        fts_b = FTS5Index(db_path=str(tmp_path / "ib" / "index.db"))
        try:
            ra = fts_a.search("磁锚", top_k=20)
            rb = fts_b.search("磁锚", top_k=20)
            titles_a = {r["title"] for r in ra}
            titles_b = {r["title"] for r in rb}
            assert len(ra) == len(rb) == 9
            assert titles_a == titles_b
        finally:
            fts_a.close()
            fts_b.close()


# ---------------------------------------------------------------------------
# 断点续扫：块粒度恢复
# ---------------------------------------------------------------------------

class TestResumeAfterInterrupt:
    def test_resume_skips_committed_chunk(self, tmp_path, tmp_path_factory, monkeypatch):
        """首块落库后中断（模拟），重跑自动跳过已完成文件（指纹机制）。"""
        from treesearch.indexer import build_index

        # 语料目录与 db 目录分离：db 落在语料内会被二次遍历发现（total_files 多 1）
        corpus = tmp_path / "corpus"
        corpus.mkdir()
        db_dir = tmp_path_factory.mktemp("idx")
        db_path = str(db_dir / "index.db")

        _make_files(corpus, 7)

        # 第一次：chunk=3，只让它跑一块就"中断"——用异常打断 gather 后的块循环
        class _Boom(Exception):
            pass

        import treesearch.indexer as idx_mod

        orig_gather = asyncio.gather

        call_count = {"n": 0}

        async def _gather_once(*aws, **kw):
            call_count["n"] += 1
            if call_count["n"] >= 2:  # 第二块开跑前中断
                raise _Boom("simulated crash after chunk 1")
            return await orig_gather(*aws, **kw)

        monkeypatch.setattr(idx_mod.asyncio, "gather", _gather_once)
        with pytest.raises(_Boom):
            asyncio.run(build_index(
                [str(corpus)], db_path=db_path,
                index_chunk_size=3, return_documents=False,
            ))
        monkeypatch.undo()

        # 断言：第一块 3 个文件已持久化
        from treesearch.fts import FTS5Index
        fts = FTS5Index(db_path=db_path)
        try:
            assert fts.get_stats()["document_count"] == 3
        finally:
            fts.close()

        # 第二次：正常跑完，全部 7 个入库（前 3 个走 skipped 增量跳过）
        result = asyncio.run(build_index(
            [str(corpus)], db_path=db_path,
            index_chunk_size=3, return_documents=False,
        ))
        stats = result.stats
        assert stats.indexed_files == 4  # 只补了后 4 个
        assert stats.skipped_files == 3  # 前 3 个被指纹跳过
        fts = FTS5Index(db_path=db_path)
        try:
            assert fts.get_stats()["document_count"] == 7
        finally:
            fts.close()

    def test_resume_return_documents_false_no_full_load(self, tmp_path):
        """续扫 + return_documents=False：skipped 文件不触发全量 load（内存契约）。

        监控 FTS5Index.load_all_documents 调用——不物化路径下不应被调用。
        """
        from treesearch.indexer import build_index
        import treesearch.fts as fts_mod

        _make_files(tmp_path, 5)
        asyncio.run(build_index(
            [str(tmp_path)], output_dir=str(tmp_path / "idx"),
            index_chunk_size=5, return_documents=False,
        ))

        calls = {"n": 0}
        orig = fts_mod.FTS5Index.load_all_documents

        def _spy(self):
            calls["n"] += 1
            return orig(self)

        fts_mod.FTS5Index.load_all_documents = _spy
        try:
            result = asyncio.run(build_index(
                [str(tmp_path)], output_dir=str(tmp_path / "idx"),
                index_chunk_size=5, return_documents=False,
            ))
        finally:
            fts_mod.FTS5Index.load_all_documents = orig
        assert result.stats.skipped_files == 5
        assert calls["n"] == 0  # 全量 load 未发生


# ---------------------------------------------------------------------------
# TreeSearch 层接线
# ---------------------------------------------------------------------------

class TestTreeSearchWiring:
    def test_aindex_return_documents_false(self, tmp_path):
        from treesearch import TreeSearch, set_config, TreeSearchConfig

        _make_files(tmp_path, 3)
        set_config(TreeSearchConfig(index_chunk_size=2))
        ts = TreeSearch(db_path=str(tmp_path / "ts.db"))
        ts.index(str(tmp_path), return_documents=False)
        # 不物化：documents 为空，但 stats 可用
        assert ts.documents == []
        stats = ts.get_index_stats()
        assert stats is not None and stats.indexed_files == 3

    def test_aindex_default_materializes(self, tmp_path):
        from treesearch import TreeSearch, set_config, TreeSearchConfig

        _make_files(tmp_path, 3)
        set_config(TreeSearchConfig(index_chunk_size=2))
        ts = TreeSearch(db_path=str(tmp_path / "ts.db"))
        ts.index(str(tmp_path))
        assert len(ts.documents) == 3  # 默认物化（兼容旧用法）
