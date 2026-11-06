# -*- coding: utf-8 -*-
"""docx 合并单元格（gridSpan）不重复渲染的回归测试。

背景：``table.rows[i].cells`` 会把一个 ``w:gridSpan=3`` 的单元格在行内
展开成 3 个**内容相同**的 cell，导致预览里合并单元格的内容重复 3 次
修复：``_table_to_text`` 直接遍历底层 ``<w:tr>/<w:tc>``，按 gridSpan
补空列。
"""

import pytest

docx = pytest.importorskip("docx", reason="python-docx not installed")

from docx.oxml.ns import qn  # noqa: E402

from treesearch.parsers.docx_parser import table_to_markdown  # noqa: E402


@pytest.fixture()
def spanned_docx(tmp_path):
    """构造含 gridSpan=3 合并单元格的表格。"""
    doc = docx.Document()
    table = doc.add_table(rows=2, cols=4)
    table.rows[0].cells[0].text = "标签"
    merged = table.rows[0].cells[1].merge(table.rows[0].cells[3])
    merged.text = "合并内容"
    table.rows[1].cells[0].text = "a"
    table.rows[1].cells[1].text = "b"
    table.rows[1].cells[2].text = "c"
    table.rows[1].cells[3].text = "d"
    fp = tmp_path / "span.docx"
    doc.save(str(fp))
    return str(fp)


def test_merged_cell_not_duplicated(spanned_docx):
    from docx import Document

    md = table_to_markdown(Document(spanned_docx).tables[0])
    assert md.count("合并内容") == 1, f"合并单元格内容被重复渲染:\n{md}"
    assert md.count("标签") == 1


def test_row_widths_uniform(spanned_docx):
    from docx import Document

    md = table_to_markdown(Document(spanned_docx).tables[0])
    widths = {len(line.split("|")) for line in md.splitlines() if line.startswith("|")}
    assert len(widths) == 1, f"各行列数不一致: {widths}"


def test_gridspan_written_as_empty_cells(spanned_docx):
    from docx import Document

    md = table_to_markdown(Document(spanned_docx).tables[0])
    header = md.splitlines()[0]
    assert header.count("|") == 5  # 4 列 + 首尾两个竖线
    assert "合并内容" in header


def test_vmerge_continuation_not_duplicated(tmp_path):
    """vMerge 续行单元格不重复前一行内容。"""
    from docx import Document

    doc = Document()
    table = doc.add_table(rows=2, cols=2)
    table.rows[0].cells[0].text = "标题"
    table.rows[0].cells[1].text = "值"
    table.rows[1].cells[0].text = "续行"
    table.rows[1].cells[1].text = "值2"
    fp = tmp_path / "vmerge.docx"
    doc.save(str(fp))

    md = table_to_markdown(Document(str(fp)).tables[0])
    assert md.count("标题") == 1
    assert "续行" in md
