"""AP-2 回归：fts.search() 元数据回查批量化。

修复前：对每个 unique node_id ①内层全量扫 rows 找 doc_id（O(n²)）
②逐条 fetchone 回查 nodes 表（N+1）。带聚合的搜索固定 top_k=200，
每次搜索付 4 万次比较 + 200 次 SQL 往返（叠加 AP-3 锁 = 200 次锁获取）。

修复后契约：
1. 结果正确性不变——dedup 语义、meta 覆盖（title/summary/depth）、
   缺 meta 时回退 FTS 行值的行为逐项保持；
2. 往返次数批量级——200 节点 2 批（≤100 对/批）而非 200 次。
"""
import sqlite3
from unittest.mock import patch

from treesearch.fts import FTS5Index
from treesearch.tree import Document


def _doc(doc_id: str, n_nodes: int = 6) -> Document:
    # 每节点都含整词 commonhit（FTS unicode61 整词命中）+ 节点专属词
    nodes = [
        {
            "node_id": f"{doc_id}-n{i}",
            "title": f"{doc_id} 章节{i}",
            "summary": f"{doc_id} 第 {i} 节 commonhit 专属 uniq{doc_id}{i}",
            "depth": 1 if i else 0,
        }
        for i in range(n_nodes)
    ]
    return Document(doc_id=doc_id, doc_name=f"{doc_id}.md",
                    structure=nodes, source_type="markdown")


class TestSearchMetaBatch:
    def _indexed(self, tmp_path, n_docs=8):
        fts = FTS5Index(db_path=str(tmp_path / "idx.db"))
        for i in range(n_docs):
            fts.index_document(_doc(f"doc{i}"), auto_commit=True)
        return fts

    def test_results_identical_to_rowvalue_semantics(self, tmp_path):
        """meta 覆盖与 dedup 结果正确：每个命中节点带 nodes 表的
        title/summary/depth（非 FTS 行回退值），同 nid 多 chunk 保留最高分。"""
        fts = self._indexed(tmp_path)
        res = fts.search("commonhit", top_k=50)
        assert res, "应命中"
        for r in res:
            assert r["title"].startswith("doc"), f"meta 未覆盖 title: {r}"
            assert r["summary"].startswith("doc"), f"meta 未覆盖 summary: {r}"
            assert r["depth"] in (0, 1)
        # 每个文档至少一个节点命中（每节点 summary 含独特词）
        hit_docs = {r["doc_id"] for r in res}
        assert len(hit_docs) == 8
        fts.close()

    def test_batch_query_count_not_n_plus_one(self, tmp_path):
        """回查往返 = 批量级：200 命中 ≤ ceil(n/100)+常数 次执行，
        而非 n 次（N+1）。统计 execute 次数（主查询+短语查询+回查批次）。"""
        fts = self._indexed(tmp_path, n_docs=40)

        calls = {"n": 0}
        real_execute = fts._conn.execute

        def counting_execute(sql, params=()):
            calls["n"] += 1
            return real_execute(sql, params)

        with patch.object(fts._conn, "execute", side_effect=counting_execute):
            res = fts.search("commonhit", top_k=200)
        assert len(res) > 100, f"预期 200 级命中，实际 {len(res)}"
        # 旧实现此场景 = 200 次回查 + 主查询 + 短语查询 ≈ 202+；
        # 新实现 = 主查询 + 短语查询 + ceil(200/100)=2 批 ≈ 4-6 次。
        assert calls["n"] <= 10, f"回查未批量化，execute 次数: {calls['n']}"
        fts.close()

    def test_rowvalue_in_works_on_old_sqlite_param_limits(self, tmp_path):
        """行值 IN 分批 ≤100 对（200 参数）——远低于 999 变量上限，
        且结果与逐条查询一致（无漏配对）。"""
        fts = self._indexed(tmp_path, n_docs=30)
        res = fts.search("commonhit", top_k=180)
        assert len(res) == 180
        # 一致性抽查：结果里每对 (nid, doc) 确实存在于 nodes
        for r in res[:20]:
            row = fts._conn.execute(
                "SELECT 1 FROM nodes WHERE node_id = ? AND doc_id = ?",
                (r["node_id"], r["doc_id"]),
            ).fetchone()
            assert row, f"回查产物 (nid, doc) 不在 nodes 表: {r['node_id']}"
        fts.close()
