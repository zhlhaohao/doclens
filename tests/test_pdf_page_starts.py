# -*- coding: utf-8 -*-
"""PDF 页表（page_starts，ADR-0031）单测。

覆盖：
- _compute_page_starts 的两种页标记形态 / 单页 / 无标记
- fts 持久化 roundtrip（documents.page_starts 列 + load 回填）
- 行号体系对齐：text_to_tree 节点 line_start 与页表同文本体系
"""
import asyncio

import pytest

from treesearch.indexer import _preprocess_text, text_to_tree
from treesearch.parsers.pdf_parser import _compute_page_starts


class TestComputePageStarts:
    def test_marker_form(self):
        """heading 路径：[PAGE N] 正文标记行 → 页起始行号。"""
        text = "\n".join([
            "[PAGE 1]",
            "第一页正文",
            "",
            "[PAGE 2]",
            "第二页正文",
        ])
        assert _compute_page_starts(text) == [1, 4]

    def test_heading_form(self):
        """page-fallback 路径：[PAGE N] 已转 ## Page N 标题行。

        前导空行归第 1 页（starts[0] 恒为 1，即使 Page 1 标记在第 2 行）。
        """
        text = "\n".join([
            "",
            "## Page 1",
            "第一页正文",
            "## Page 2",
            "第二页正文",
        ])
        assert _compute_page_starts(text) == [1, 4]

    def test_single_page(self):
        """单页 PDF：页表 = [1]（存在标记即返回）。"""
        assert _compute_page_starts("[PAGE 1]\n正文") == [1]

    def test_no_marker(self):
        """无任何页标记 → None。"""
        assert _compute_page_starts("普通文本\n无标记") is None
        assert _compute_page_starts("") is None

    def test_leading_content_belongs_to_page1(self):
        """首个标记前有前导内容：归第 1 页（页表仅 [1]）。"""
        text = "\n".join([
            "封面导语",
            "[PAGE 1]",
            "正文",
        ])
        assert _compute_page_starts(text) == [1]

    def test_page_number_gap(self):
        """断号页（纯图页无标记）：与其后首个有标记页共享起始行——
        其前行归前页、其后行归后页，二分两侧都正确。"""
        text = "\n".join([
            "[PAGE 1]",
            "第一页正文",
            "[PAGE 3]",
            "第三页正文",
        ])
        assert _compute_page_starts(text) == [1, 3, 3]


class TestLineNumberAlignment:
    def test_page_starts_align_with_node_line_start(self):
        """页表行号须与 text_to_tree 节点 line_start 同体系。

        用 heading 检测认可的数字层级标题（_detect_headings 不识别
        markdown #，仅 md_to_tree 路径识别——页表不依赖树形态，标记行
        保留在最终文本即可）。断言：节点 line_start 二分页表所得页号
        与其所在 [PAGE N] 块一致。
        """
        final_text = "\n".join([
            "[PAGE 1]",
            "1. 概述",
            "第一页内容",
            "",
            "[PAGE 2]",
            "2. 方法",
            "第二页内容",
        ])
        assert _preprocess_text(final_text) == final_text  # 幂等前提
        page_starts = _compute_page_starts(final_text)
        assert page_starts == [1, 5]

        result = asyncio.run(text_to_tree(
            text_content=final_text, if_add_node_summary=False,
        ))

        def walk(nodes, out):
            for n in nodes:
                out.append((n.get("title"), n.get("line_start")))
                walk(n.get("nodes") or [], out)

        flat: list = []
        walk(result["structure"], flat)
        by_title = dict(flat)
        assert by_title["1. 概述"] == 2  # 页 1 区间 [1, 5)
        assert by_title["2. 方法"] == 6  # 页 2 区间 [5, ∞)

        # 二分换算（前端同款逻辑）：节点起始行 → 页号
        def line_to_page(line: int) -> int:
            lo, hi = 0, len(page_starts) - 1
            while lo < hi:
                mid = (lo + hi + 1) // 2
                if page_starts[mid] <= line:
                    lo = mid
                else:
                    hi = mid - 1
            return lo + 1

        assert line_to_page(by_title["1. 概述"]) == 1
        assert line_to_page(by_title["2. 方法"]) == 2


class TestFtsPersistence:
    def test_roundtrip(self, tmp_path):
        """documents.page_starts 列写入 → load_document_by_source_path 回填。"""
        from treesearch.fts import FTS5Index
        from treesearch.tree import Document

        fts = FTS5Index(db_path=str(tmp_path / "index.db"))
        try:
            doc = Document(
                doc_id="d1",
                doc_name="样本",
                structure=[{"title": "样本", "node_id": "0", "text": "", "nodes": []}],
                source_type="pdf",
                metadata={"source_path": "/tmp/样本.pdf"},
                page_starts=[1, 40, 88],
            )
            fts.save_document(doc)

            loaded = fts.load_document_by_source_path("/tmp/样本.pdf")
            assert loaded is not None
            assert loaded.page_starts == [1, 40, 88]

            # 非 PDF / 未写入 → None
            doc2 = Document(
                doc_id="d2",
                doc_name="md",
                structure=[{"title": "md", "node_id": "0", "text": "", "nodes": []}],
                source_type="markdown",
                metadata={"source_path": "/tmp/a.md"},
            )
            fts.save_document(doc2)
            assert fts.load_document_by_source_path("/tmp/a.md").page_starts is None
        finally:
            fts.close()

    def test_legacy_column_migration(self, tmp_path):
        """存量库（无 page_starts 列）打开时自动 ALTER 补列。"""
        import sqlite3

        from treesearch.fts import FTS5Index

        db = tmp_path / "legacy.db"
        conn = sqlite3.connect(str(db))
        conn.execute(
            "CREATE TABLE documents ("
            "doc_id TEXT PRIMARY KEY, doc_name TEXT DEFAULT '',"
            "doc_description TEXT DEFAULT '', source_path TEXT DEFAULT '',"
            "source_type TEXT DEFAULT '', structure_json TEXT DEFAULT '',"
            "node_count INTEGER DEFAULT 0, index_hash TEXT)"
        )
        conn.commit()
        conn.close()

        fts = FTS5Index(db_path=str(db))  # 打开即迁移
        try:
            cols = {
                r[1] for r in fts._conn.execute("PRAGMA table_info(documents)")
            }
            assert "page_starts" in cols
        finally:
            fts.close()


@pytest.mark.parametrize("bad", ["not json", "[]", '{"a":1}'])
def test_decode_page_starts_invalid(bad):
    from treesearch.fts import _decode_page_starts

    assert _decode_page_starts(bad) is None
    assert _decode_page_starts("") is None
    assert _decode_page_starts(None) is None
    assert _decode_page_starts("[1,2]") == [1, 2]
