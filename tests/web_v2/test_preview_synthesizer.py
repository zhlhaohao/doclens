"""preview_synthesizer 与 FTS5Index.load_document_by_source_path 的单测。"""
import pytest

from treesearch.fts import FTS5Index
from treesearch.tree import Document


@pytest.fixture
def fts_index(tmp_path):
    """构造内存映射到临时文件的 FTS5Index。"""
    db_path = str(tmp_path / "test.db")
    fts = FTS5Index(db_path=db_path)
    yield fts
    fts.close()


def _make_doc(source_path: str, source_type: str = "csv") -> Document:
    return Document(
        doc_id="doc1",
        doc_name="sample",
        structure=[{
            "title": "sample",
            "node_id": "root",
            "text": "Columns: a, b",
            "line_start": 1,
            "line_end": 1,
            "nodes": [],
        }],
        source_type=source_type,
        metadata={"source_path": source_path},
    )


def test_load_document_by_source_path_hits(fts_index):
    doc = _make_doc(source_path="/abs/path/sample.csv", source_type="csv")
    fts_index.index_document(doc)

    found = fts_index.load_document_by_source_path("/abs/path/sample.csv")
    assert found is not None
    assert found.doc_id == "doc1"
    assert found.source_type == "csv"
    assert found.structure[0]["title"] == "sample"


def test_load_document_by_source_path_miss_returns_none(fts_index):
    doc = _make_doc(source_path="/abs/path/sample.csv")
    fts_index.index_document(doc)

    assert fts_index.load_document_by_source_path("/not/indexed.csv") is None


def test_load_document_by_source_path_empty_structure(fts_index):
    """structure_json 为空字符串时应返回空 structure 而不是抛 JSONDecodeError。"""
    fts_index._conn.execute(
        "INSERT INTO documents (doc_id, doc_name, source_path, source_type, structure_json) "
        "VALUES (?, ?, ?, ?, ?)",
        ("d2", "empty", "/abs/empty.pdf", "pdf", ""),
    )
    fts_index._conn.commit()
    found = fts_index.load_document_by_source_path("/abs/empty.pdf")
    assert found is not None
    assert found.structure == []


from doclens.web_v2.preview_synthesizer import render_tree_to_md


def test_render_pdf_simple_node():
    structure = [{
        "title": "Introduction",
        "node_id": "intro",
        "text": "Welcome to the document.",
        "line_start": 1,
        "line_end": 1,
        "nodes": [],
    }]
    md = render_tree_to_md(structure, source_type="pdf")
    lines = md.split("\n")
    assert lines[0] == "# Introduction"
    assert "Welcome to the document." in md


def test_render_docx_nested_headings():
    structure = [{
        "title": "Chapter",
        "node_id": "ch",
        "text": "",
        "line_start": 1,
        "line_end": 1,
        "nodes": [
            {
                "title": "Section",
                "node_id": "sec",
                "text": "Section body",
                "line_start": 5,
                "line_end": 5,
                "nodes": [],
            },
        ],
    }]
    md = render_tree_to_md(structure, source_type="docx")
    lines = md.split("\n")
    assert lines[0] == "# Chapter"
    # line_start=5 → Section heading 出现在第 5 行（1-indexed），即 lines[4]
    assert lines[4] == "## Section"
    assert "Section body" in md


def test_render_heading_level_capped_at_h6():
    """7 层嵌套时最深节点用 ######（不能更多）。"""
    def nest(depth):
        if depth == 0:
            return {"title": "deep", "node_id": "d", "text": "x",
                    "line_start": 1, "line_end": 1, "nodes": []}
        return {"title": f"L{depth}", "node_id": f"n{depth}", "text": "",
                "line_start": 1, "line_end": 1, "nodes": [nest(depth - 1)]}

    structure = [nest(6)]
    md = render_tree_to_md(structure, source_type="pdf")
    # 深度 6（0-indexed）对应 level=7，cap 到 6
    assert "###### deep" in md
    assert "#######" not in md  # 不应有 7 个 #


def test_render_node_missing_line_start_defaults_to_1():
    """line_start=None 时不报错，heading 从第 1 行开始。"""
    structure = [{"title": "x", "node_id": "x", "text": "y", "nodes": []}]
    md = render_tree_to_md(structure, source_type="pdf")
    assert md.split("\n")[0] == "# x"


def test_render_xlsx_to_md_table():
    """xlsx 单节点 text 自带 header + 所有数据行。"""
    structure = [{
        "title": "Sheet1 (2 rows)",
        "node_id": "s1",
        "text": "Columns: a, b\na: 1; b: 2\na: 3; b: 4",
        "line_start": 1,
        "line_end": 3,
        "nodes": [],
    }]
    md = render_tree_to_md(structure, source_type="excel")
    lines = md.split("\n")
    assert lines[0] == "# Sheet1 (2 rows)"
    # 第 2 行起应是空行 + 表头 + 分隔 + 数据
    assert "| a | b |" in md
    assert "| --- | --- |" in md
    assert "| 1 | 2 |" in md
    assert "| 3 | 4 |" in md


def test_render_csv_aggregates_children():
    """csv 根节点 text 只有 header，数据在 level-2 子节点。"""
    structure = [{
        "title": "data",
        "node_id": "root",
        "text": "Columns: a, b",
        "line_start": 1,
        "line_end": 1,
        "nodes": [
            {"title": "r1", "node_id": "r1", "text": "a: 1; b: 2",
             "line_start": 2, "line_end": 2, "nodes": []},
            {"title": "r2", "node_id": "r2", "text": "a: 3; b: 4",
             "line_start": 3, "line_end": 3, "nodes": []},
        ],
    }]
    md = render_tree_to_md(structure, source_type="csv")
    # table 聚合后，子节点不应再单独输出 ## r1 / ## r2
    assert "## r1" not in md
    assert "## r2" not in md
    # 数据行应在 table 内
    assert "| a | b |" in md
    assert "| 1 | 2 |" in md
    assert "| 3 | 4 |" in md


def test_render_table_falls_back_to_paragraph_when_not_columns():
    """text 不以 Columns: 开头时退化为段落，不抛错。"""
    structure = [{
        "title": "weird",
        "node_id": "w",
        "text": "just some text\nsecond line",
        "line_start": 1,
        "line_end": 2,
        "nodes": [],
    }]
    md = render_tree_to_md(structure, source_type="excel")
    # 不应出现 table 分隔符
    assert "|" not in md.split("\n")[2]
    assert "just some text" in md
    assert "second line" in md


def test_render_table_escapes_pipe_in_cell():
    """cell 含 | 时转义为 \\|，避免破坏 table 结构。"""
    structure = [{
        "title": "s",
        "node_id": "s",
        "text": "Columns: a\na: 1|2",
        "line_start": 1,
        "line_end": 2,
        "nodes": [],
    }]
    md = render_tree_to_md(structure, source_type="excel")
    assert "| 1\\|2 |" in md
