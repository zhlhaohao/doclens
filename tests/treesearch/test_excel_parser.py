"""tests for treesearch.parsers.excel_parser."""
from pathlib import Path

import pytest

from treesearch.parsers.excel_parser import _extract_excel_data


def _write_xlsx_with_title_row(path: Path) -> None:
    """生成一份「row1 标题行 + row2 真实表头 + row3+ 数据」的 xlsx。

    模拟真实场景：广东网络研发中心通信录第一行是合并单元格标题。
    """
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "通讯录"
    # Row 1: 标题（仅 A1 有值，其余 None，模拟合并单元格）
    ws.append(["2025年某通讯录", None, None, None, None, None, None])
    # Row 2: 真实表头
    ws.append(["序号", "团队", "姓名", "联系方式", "邮箱", "职位", "备注"])
    # Row 3+: 数据
    ws.append([1, "部门领导", "潘桂新", "18602031776", "pangx6@chinaunicom.cn", "部门总经理", None])
    ws.append([2, "创新业务研发室", "罗东宏", "18602035668", "luodonghong@chinaunicom.cn", "高专", None])
    ws.append([3, "网络产品室", "余锦才", "18620011932", "yujc19@chinaunicom.cn", "高专", None])
    wb.save(str(path))
    wb.close()


def test_extract_skips_title_row_and_uses_row2_as_headers(tmp_path: Path):
    """标题行模式：row1 仅 1 个非空、row2 有多个非空 → 用 row2 当 header。"""
    xlsx_path = tmp_path / "roster.xlsx"
    _write_xlsx_with_title_row(xlsx_path)

    nodes = _extract_excel_data(str(xlsx_path))

    assert len(nodes) == 1
    node = nodes[0]
    # 真实表头应来自 row 2
    text_lines = node["text"].split("\n")
    assert text_lines[0] == (
        "Columns: 序号, 团队, 姓名, 联系方式, 邮箱, 职位, 备注"
    )
    # 数据行应包含全部 3 行（而非被压缩到 1 列）
    data_lines = text_lines[1:]
    assert len(data_lines) == 3
    # 第一条数据应正确映射到对应列
    assert "序号: 1" in data_lines[0]
    assert "姓名: 潘桂新" in data_lines[0]
    assert "联系方式: 18602031776" in data_lines[0]
    assert "职位: 部门总经理" in data_lines[0]


def _write_xlsx_without_title_row(path: Path) -> None:
    """生成一份 row1 就是真实表头的 xlsx（防回归）。"""
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    # Row 1: 真实表头（多列非空，末尾可有 None）
    ws.append(["序号", "职位", "姓名", "电话", "邮箱", None, "序号", "科室"])
    # Row 2+: 数据
    ws.append([1, "部门总经理", "潘桂新", "18602031776", "pangx6@chinaunicom.cn", None, 1, "创新业务研发室"])
    ws.append([2, "部门副总经理", "马晨", "18602030993", "machen2@chinaunicom.cn", None, 2, "行业支撑室"])
    wb.save(str(path))
    wb.close()


def test_extract_does_not_skip_header_when_no_title_row(tmp_path: Path):
    """防回归：row1 有多个非空 cell（真实表头）→ 不应误判为标题行。"""
    xlsx_path = tmp_path / "plain.xlsx"
    _write_xlsx_without_title_row(xlsx_path)

    nodes = _extract_excel_data(str(xlsx_path))

    assert len(nodes) == 1
    node = nodes[0]
    text_lines = node["text"].split("\n")
    # Columns 行应来自 row 1
    assert text_lines[0] == (
        "Columns: 序号, 职位, 姓名, 电话, 邮箱, 序号, 科室"
    )
    # 两条数据行都在
    data_lines = text_lines[1:]
    assert len(data_lines) == 2
    assert "序号: 1" in data_lines[0]
    assert "姓名: 潘桂新" in data_lines[0]
