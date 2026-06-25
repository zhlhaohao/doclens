"""_extract_pages 单元测试。"""
import pytest

from doclens.web_v2.api.preview import _extract_pages
from doclens.web_v2.models.preview import PageMarker


# ---------------------------------------------------------------------------
# PDF 分支
# ---------------------------------------------------------------------------


def test_extract_pages_pdf_basic():
    """PDF: 多个 [PAGE N] 标记被剥除，pages 按顺序生成，line_start 指向清洗后行号。"""
    md = "[PAGE 1]\nA\nB\n[PAGE 2]\nC"
    pages, cleaned = _extract_pages([], "pdf", md)

    assert pages is not None
    assert len(pages) == 2
    assert pages[0] == PageMarker(label="第 1 页", line_start=1)
    # A,B 在 cleaned-line 1,2；C 在 cleaned-line 3
    assert pages[1] == PageMarker(label="第 2 页", line_start=3)
    assert "[PAGE" not in cleaned
    assert cleaned == "A\nB\nC"


def test_extract_pages_pdf_no_markers_returns_single_page():
    """PDF: 无任何 [PAGE N] 标记 → 整篇当一页，content 不变。"""
    md = "Just some text\nwithout markers"
    pages, cleaned = _extract_pages([], "pdf", md)

    assert pages == [PageMarker(label="第 1 页", line_start=1)]
    assert cleaned == md


def test_extract_pages_pdf_marker_not_at_start_includes_leading():
    """PDF: 标记前有内容（理论不该发生但兜底）→ 内容归入第 1 页。"""
    md = "Intro\n[PAGE 1]\nA"
    pages, cleaned = _extract_pages([], "pdf", md)

    assert pages is not None
    assert pages[0].line_start == 1
    assert "Intro" in cleaned
    assert "[PAGE" not in cleaned


def test_extract_pages_pdf_uses_counter_not_marker_number():
    """PDF: label 用出现顺序计数，不用 marker 里的数字（防跳号）。"""
    md = "[PAGE 5]\nA\n[PAGE 99]\nB"
    pages, _ = _extract_pages([], "pdf", md)

    assert pages[0].label == "第 1 页"
    assert pages[1].label == "第 2 页"


# ---------------------------------------------------------------------------
# 不支持的类型
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "source_type",
    ["markdown", "code", "csv", "docx", "text", "json", "html"],
)
def test_extract_pages_unsupported_types_return_none(source_type):
    """非 pdf/pptx/excel → pages=None，content 不变。"""
    pages, cleaned = _extract_pages([], source_type, "some content")

    assert pages is None
    assert cleaned == "some content"


# ---------------------------------------------------------------------------
# PPTX 分支
# ---------------------------------------------------------------------------


def test_extract_pages_pptx_with_slides():
    """PPTX: 每个 slide 子节点 → 一个 page，label 含标题。"""
    structure = [{
        "title": "doc.pptx",
        "line_start": 1,
        "nodes": [
            {"title": "Intro", "line_start": 2, "nodes": []},
            {"title": "Method", "line_start": 10, "nodes": []},
        ],
    }]
    pages, cleaned = _extract_pages(structure, "pptx", "md content")

    assert pages is not None
    assert len(pages) == 2
    assert pages[0] == PageMarker(label="幻灯片 1 · Intro", line_start=2)
    assert pages[1] == PageMarker(label="幻灯片 2 · Method", line_start=10)
    assert cleaned == "md content"  # pptx 不改 content


def test_extract_pages_pptx_empty_slides_returns_none():
    """PPTX: root.nodes 为空 → None。"""
    structure = [{"title": "empty.pptx", "line_start": 1, "nodes": []}]
    pages, cleaned = _extract_pages(structure, "pptx", "md")

    assert pages is None
    assert cleaned == "md"


def test_extract_pages_pptx_no_structure_returns_none():
    """PPTX: structure 为空 → None。"""
    pages, cleaned = _extract_pages([], "pptx", "md")

    assert pages is None
    assert cleaned == "md"


def test_extract_pages_pptx_slide_without_title():
    """PPTX: slide 无 title → label 只有序号（不带 ·）。"""
    structure = [{
        "title": "doc.pptx",
        "nodes": [{"title": "", "line_start": 2}],
    }]
    pages, _ = _extract_pages(structure, "pptx", "md")

    assert pages is not None
    assert pages[0].label == "幻灯片 1"


# ---------------------------------------------------------------------------
# Excel 分支
# ---------------------------------------------------------------------------


def test_extract_pages_excel_with_sheets():
    """XLSX: 每个 sheet 顶层节点 → 一个 page。"""
    structure = [
        {"title": "Sales", "line_start": 1, "nodes": []},
        {"title": "Inventory", "line_start": 50, "nodes": []},
    ]
    pages, cleaned = _extract_pages(structure, "excel", "md content")

    assert pages is not None
    assert len(pages) == 2
    assert pages[0] == PageMarker(label="工作表 1 · Sales", line_start=1)
    assert pages[1] == PageMarker(label="工作表 2 · Inventory", line_start=50)
    assert cleaned == "md content"


def test_extract_pages_excel_empty_returns_none():
    """XLSX: structure 空 → None。"""
    pages, cleaned = _extract_pages([], "excel", "md")

    assert pages is None
    assert cleaned == "md"


def test_extract_pages_excel_sheet_without_title():
    """XLSX: sheet 无 title → label 只有序号。"""
    structure = [{"title": "", "line_start": 1}]
    pages, _ = _extract_pages(structure, "excel", "md")

    assert pages is not None
    assert pages[0].label == "工作表 1"
