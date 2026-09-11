# -*- coding: utf-8 -*-
"""搜索全惰性化（ADR-0019）测试。

覆盖：
- 双路径对照：同查询物化路径 vs 惰性路径 flat_nodes 的 doc_id 集合一致
- 惰性契约：lazy_search 实例搜索后 self.documents 保持为空（永不物化）
- 通配路由：*foo* 查询 SQL 路由（structure_json LIKE 单段扫）+ 载入后精扫
- 边界：无命中 → 空结果 shape；DB 不存在 → ValueError
- route_docs_by_pattern：LIKE 通配符（% _ \）字面转义、全召回
"""
import pytest


def _make_corpus(corpus_dir):
    """确定性语料：每个查询词的命中文档数 ≤ top_k_docs(3)，双路径集合可断言。

    - 磁锚 × 3 个 md；蓝鲸引擎 × 2 个 md；quantum × 2 个 code 文件
    - 其余为不含目标词的干扰文档
    """
    for i in range(1, 4):
        (corpus_dir / f"hit_anchor{i:03d}.md").write_text(
            f"# 磁锚文档 {i}\n\n## 磁锚 章节\n\n磁锚 磁锚 检索实验内容 {i}\n",
            encoding="utf-8",
        )
    for i in range(1, 3):
        (corpus_dir / f"hit_whale{i:03d}.md").write_text(
            f"# 蓝鲸文档 {i}\n\n## 引擎 章节\n\n蓝鲸引擎 实验 {i}\n",
            encoding="utf-8",
        )
    (corpus_dir / "code_a.py").write_text(
        "def quantum_anchor():\n    return 'quantum value'\n", encoding="utf-8",
    )
    (corpus_dir / "code_b.py").write_text(
        "class Engine:\n    def search(self):\n        return 'quantum result'\n",
        encoding="utf-8",
    )
    for i in range(10):
        (corpus_dir / f"filler{i:03d}.md").write_text(
            f"# 干扰文档 {i}\n\n普通内容，不含任何目标词。{i}\n", encoding="utf-8",
        )


def _build_index(corpus_dir, db_path):
    from treesearch import TreeSearch, set_config, TreeSearchConfig

    set_config(TreeSearchConfig())
    ts = TreeSearch(db_path=str(db_path))
    ts.index(str(corpus_dir), return_documents=False)


class TestDualPathEquivalence:
    """同一查询，物化路径与惰性路径命中集合一致（ADR-0019 验收 ①）。"""

    QUERIES = [
        "磁锚",                # 纯 CJK，命中 3 md
        "quantum",             # 英文 + code 文件（走 grep prefilter 判定）
        "*磁锚*",              # 通配 → 正则路由（SQL LIKE + 载入精扫）
        "蓝鲸*",               # 前缀通配 → FTS 表达式路由
    ]

    def test_flat_nodes_doc_id_sets_match(self, tmp_path):
        from treesearch import TreeSearch

        corpus = tmp_path / "corpus"
        corpus.mkdir()
        _make_corpus(corpus)
        db = tmp_path / "idx" / "index.db"
        db.parent.mkdir()
        _build_index(corpus, db)

        ts_mat = TreeSearch(db_path=str(db))                 # 物化（旧行为）
        ts_lazy = TreeSearch(db_path=str(db), lazy_search=True)

        for q in self.QUERIES:
            r_mat = ts_mat.search(q)
            r_lazy = ts_lazy.search(q)
            ids_mat = {n["doc_id"] for n in r_mat["flat_nodes"]}
            ids_lazy = {n["doc_id"] for n in r_lazy["flat_nodes"]}
            assert ids_mat, f"物化路径应命中：{q!r}"
            assert ids_mat == ids_lazy, (
                f"双路径命中集合不一致：{q!r}\n  物化={ids_mat}\n  惰性={ids_lazy}"
            )

    def test_flat_mode_explicit_match(self, tmp_path):
        """显式 flat 模式（走 standard routing 路径的 prescored 分支）集合一致。"""
        from treesearch import TreeSearch

        corpus = tmp_path / "corpus"
        corpus.mkdir()
        _make_corpus(corpus)
        db = tmp_path / "idx" / "index.db"
        db.parent.mkdir()
        _build_index(corpus, db)

        ts_mat = TreeSearch(db_path=str(db))
        ts_lazy = TreeSearch(db_path=str(db), lazy_search=True)
        for q in ("磁锚", "quantum"):
            ids_mat = {n["doc_id"] for n in ts_mat.search(q, search_mode="flat")["flat_nodes"]}
            ids_lazy = {n["doc_id"] for n in ts_lazy.search(q, search_mode="flat")["flat_nodes"]}
            assert ids_mat, f"物化路径应命中：{q!r}"
            assert ids_mat == ids_lazy, f"flat 双路径不一致：{q!r}"

    def test_no_hit_returns_empty_shape(self, tmp_path):
        from treesearch import TreeSearch

        corpus = tmp_path / "corpus"
        corpus.mkdir()
        _make_corpus(corpus)
        db = tmp_path / "idx" / "index.db"
        db.parent.mkdir()
        _build_index(corpus, db)

        # 单 token 无匹配词（中文句子会被分词成多词 OR，误命中干扰文档）
        r = TreeSearch(db_path=str(db), lazy_search=True).search("zznonexistent")
        assert r["flat_nodes"] == []
        assert r["documents"] == []
        assert r["mode"] in ("flat", "tree")


class TestLazyContract:
    def test_lazy_never_materializes(self, tmp_path):
        """惰性实例搜索后 documents 仍为空——内存契约 O(top-k)。"""
        from treesearch import TreeSearch

        corpus = tmp_path / "corpus"
        corpus.mkdir()
        _make_corpus(corpus)
        db = tmp_path / "idx" / "index.db"
        db.parent.mkdir()
        _build_index(corpus, db)

        ts = TreeSearch(db_path=str(db), lazy_search=True)
        r = ts.search("磁锚")
        assert r["flat_nodes"], "应命中"
        assert ts.documents == []  # 永不物化

    def test_lazy_requires_existing_db(self, tmp_path):
        from treesearch import TreeSearch

        ts = TreeSearch(db_path=str(tmp_path / "nonexistent.db"), lazy_search=True)
        with pytest.raises(ValueError, match="lazy_search"):
            ts.search("anything")

    def test_default_is_materializing(self, tmp_path):
        """默认 lazy_search=False：旧行为（自愈物化）不受影响。"""
        from treesearch import TreeSearch

        corpus = tmp_path / "corpus"
        corpus.mkdir()
        _make_corpus(corpus)
        db = tmp_path / "idx" / "index.db"
        db.parent.mkdir()
        _build_index(corpus, db)

        ts = TreeSearch(db_path=str(db))
        r = ts.search("磁锚")
        assert r["flat_nodes"]
        assert len(ts.documents) > 0  # 物化路径保持


class TestRouteDocsByPattern:
    """FTS5Index.route_docs_by_pattern：LIKE 转义与全召回。"""

    def _build(self, tmp_path):
        corpus = tmp_path / "corpus"
        corpus.mkdir()
        (corpus / "pct.md").write_text("# pct\n\n折扣 a%b 五折\n", encoding="utf-8")
        (corpus / "mix.md").write_text("# mix\n\n中间字符 axb 与 a_b\n", encoding="utf-8")
        (corpus / "plain.md").write_text("# plain\n\n普通内容 axb\n", encoding="utf-8")
        db = tmp_path / "idx" / "index.db"
        db.parent.mkdir()
        _build_index(corpus, db)
        return db

    def test_percent_is_literal(self, tmp_path):
        from treesearch.fts import FTS5Index

        db = self._build(tmp_path)
        fts = FTS5Index(db_path=str(db))
        try:
            routed = fts.route_docs_by_pattern("a%b", top_k=10)
        finally:
            fts.close()
        # % 被转义为字面量：只命中含 "a%b" 的 pct 文档，不命中 axb
        assert len(routed) == 1

    def test_underscore_is_literal(self, tmp_path):
        from treesearch.fts import FTS5Index

        db = self._build(tmp_path)
        fts = FTS5Index(db_path=str(db))
        try:
            routed = fts.route_docs_by_pattern("a_b", top_k=10)
        finally:
            fts.close()
        # _ 被转义为字面量：只命中 mix（字面 a_b），不命中 axb 系
        assert len(routed) == 1

    def test_full_recall_via_deep_body(self, tmp_path):
        """匹配在正文深处（超出 summary 截断）也能召回——structure_json 全召回。"""
        from treesearch.fts import FTS5Index

        corpus = tmp_path / "corpus"
        corpus.mkdir()
        deep = "前置铺垫。" * 300 + "深埋目标词磁锚在此"
        (corpus / "deep.md").write_text(f"# deep\n\n{deep}\n", encoding="utf-8")
        (corpus / "other.md").write_text("# other\n\n无关\n", encoding="utf-8")
        db = tmp_path / "idx" / "index.db"
        db.parent.mkdir()
        _build_index(corpus, db)

        fts = FTS5Index(db_path=str(db))
        try:
            routed = fts.route_docs_by_pattern("深埋目标词", top_k=10)
        finally:
            fts.close()
        assert len(routed) == 1
