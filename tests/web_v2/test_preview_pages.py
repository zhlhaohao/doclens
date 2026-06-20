"""_extract_pages 单元测试。"""
import pytest

from cortex.web_v2.api.preview import _extract_pages
from cortex.web_v2.models.preview import PageMarker


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
