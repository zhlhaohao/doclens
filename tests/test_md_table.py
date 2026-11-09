# -*- coding: utf-8 -*-
"""md_table 校验/归一化测试（parser 产出公共后处理）。

背景：docx 解析出的 md table header 列数与内容行不一致，GFM 渲染按
header 列数截断丢列。其他 parser（anydoc/markitdown/pdf/email）同样可能
产出不一致表格，故在 indexer 汇合点统一做 ``normalize_tree_tables``。
"""
import pytest

from treesearch.parsers.md_table import (
    normalize_md_tables,
    normalize_tree_tables,
    validate_md_tables,
)


# ---------------------------------------------------------------------------
# _split_cells / 转义口径
# ---------------------------------------------------------------------------

def test_split_cells_basic():
    from treesearch.parsers.md_table import _split_cells
    assert _split_cells("| a | b |") == [" a ", " b "]
    assert _split_cells("| a | b") == [" a ", " b"]
    assert _split_cells("a | b |") == ["a ", " b "]


def test_split_cells_escaped_pipe_is_content():
    from treesearch.parsers.md_table import _split_cells
    # \| 是单元格内容，不是列分隔符
    assert len(_split_cells(r"| a\|b | c |")) == 2
    assert _split_cells(r"| a\|b | c |")[0] == r" a\|b "


# ---------------------------------------------------------------------------
# normalize_md_tables
# ---------------------------------------------------------------------------

def test_row_wider_than_header_gets_padded():
    """核心缺陷回归：内容行 4 列 > header 2 列 → 全块 pad 到 4 列。"""
    text = "| h1 | h2 |\n| --- | --- |\n| a | b | c | d |"
    out = normalize_md_tables(text)
    lines = out.split("\n")
    assert all(ln.count(" | ") == lines[0].count(" | ") for ln in lines)
    assert lines[1].count("---") == 4  # separator 扩到 4 列
    assert "c" in lines[2] and "d" in lines[2]  # 内容不丢


def test_header_wider_than_rows_gets_padded():
    """反向：header 3 列 > 内容行 2 列 → 内容行补空单元格。"""
    text = "| h1 | h2 | h3 |\n| --- | --- | --- |\n| a | b |"
    out = normalize_md_tables(text)
    lines = out.split("\n")
    assert lines[2] == "| a | b |  |"


def test_already_aligned_untouched():
    text = "| h1 | h2 |\n| --- | --- |\n| a | b |\n| c | d |"
    assert normalize_md_tables(text) == text


def test_no_table_text_untouched():
    text = "普通段落\n\n没有竖线的内容"
    assert normalize_md_tables(text) == text


def test_escaped_pipe_not_split_in_normalize():
    """转义竖线不参与列数统计，不影响对齐。"""
    text = "| h1 | h2 |\n| --- | --- |\n| a\\|b | c |"
    out = normalize_md_tables(text)
    lines = out.split("\n")
    assert len(lines) == 3
    assert r"a\|b" in lines[2]


def test_multiple_blocks_independent():
    """多个 table 块各自独立归一化，互不影响列数。"""
    text = (
        "段落一\n\n"
        "| a | b |\n| --- | --- |\n| 1 | 2 | 3 |\n\n"
        "段落二\n\n"
        "| x | y | z |\n| --- | --- | --- |\n| 1 | 2 |\n"
    )
    out = normalize_md_tables(text)
    blocks = [ln for ln in out.split("\n") if ln.startswith("|")]
    assert len(blocks) == 6
    # 块 1 → 3 列
    assert blocks[1].count("---") == 3
    # 块 2 → 3 列（本来一致）
    assert blocks[4].count("---") == 3
    assert blocks[5] == "| 1 | 2 |  |"


def test_nested_content_never_dropped():
    """已有内容永不删减：超宽行的单元格全部保留。"""
    text = "| h |\n| --- |\n| a | b | c |"
    out = normalize_md_tables(text)
    for token in ("a", "b", "c"):
        assert token in out


def test_leading_whitespace_rows_included():
    """行首有缩进的竖线行也纳入 table 块（宽松匹配）。"""
    text = "  | h1 | h2 |\n  | --- | --- |\n  | a | b | c |"
    out = normalize_md_tables(text)
    assert out.split("\n")[1].count("---") == 3


# ---------------------------------------------------------------------------
# validate_md_tables（诊断接口）
# ---------------------------------------------------------------------------

def test_validate_reports_mismatch():
    text = "| h1 | h2 |\n| --- | --- |\n| a | b | c |"
    issues = validate_md_tables(text)
    assert len(issues) == 1
    assert issues[0]["line"] == 3
    assert issues[0]["table_cols"] == 2
    assert issues[0]["row_cols"] == 3


def test_validate_clean_table_no_issues():
    text = "| h1 | h2 |\n| --- | --- |\n| a | b |"
    assert validate_md_tables(text) == []


# ---------------------------------------------------------------------------
# normalize_tree_tables（indexer 汇合点入口）
# ---------------------------------------------------------------------------

def test_normalize_tree_walks_all_nodes():
    structure = [{
        "title": "root",
        "nodes": [
            {"title": "n1", "text": "| h1 | h2 |\n| --- | --- |\n| a | b | c |", "nodes": []},
            {"title": "n2", "text": "无表格", "nodes": []},
        ],
    }]
    normalize_tree_tables(structure)
    leaf = structure[0]["nodes"][0]
    assert leaf["text"].split("\n")[1].count("---") == 3


def test_normalize_tree_none_and_empty_safe():
    assert normalize_tree_tables(None) is None
    assert normalize_tree_tables([]) is None


@pytest.mark.parametrize("bad", [None, 123, object()])
def test_node_text_non_string_ignored(bad):
    structure = [{"title": "n", "text": bad, "nodes": []}]
    normalize_tree_tables(structure)  # 不抛异常
    assert structure[0]["text"] is bad
