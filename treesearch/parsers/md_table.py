# -*- coding: utf-8 -*-
"""md table 校验与归一化（parser 产出的公共后处理）。

背景（2026-11-09）：docx 解析出的 md table 出现 header 列数与内容行列数
不一致，GFM 渲染按 header/separator 列数截断，多出的列整个丢失。该缺陷
不只可能在 docx 一个 parser 出现（anydoc / markitdown / pdf / email 等
都会在节点 text 里产出 md table），与其逐个 parser 打补丁，不如在
**所有 parser 产出的汇合点**（indexer 的 parser dispatch 之后）做一次
统一校验 + 归一化。

只处理节点 ``text`` 中的 GitHub-flavored markdown table 块：
- 校验（``validate_md_tables``）：header / separator / 每个内容行的
  列数是否一致，返回问题清单（不修改内容）；
- 归一化（``normalize_md_tables``）：把每个 table 块的所有行 pad 到
  该块的统一列数（取最大列数），保证 GFM 不丢列。修不动的内容原样保留，
  永不抛异常——这是渲染质量兜底，不是解析错误。

口径说明：
- 一个「table 块」= 连续的、以 ``|`` 开头（允许行首空白）的行。GFM 表格
  的第 2 行须为 separator（``---``），无 separator 的连续竖线行不是合法
  表格，但同样纳入列数对齐（渲染器对裸 ``|`` 行有列表化倾向，对齐无害）；
- ``\\|`` 视为单元格内容而非列分隔符（与各 parser 的转义口径一致）；
- 列数统计用「未转义管道符数 + 1」，即 ``| a | b |`` → 2 列。行首行尾
  竖线缺失（``a | b``）时按内部管道符数 + 1 计。
"""
from __future__ import annotations

import re

# 行首可选空白 + | 开头（行尾竖线可有可无，宽松匹配）
_TABLE_LINE_RE = re.compile(r"^\s*\|")

# separator 行：单元格内只含 -、:、空白（GFM 对齐标记）
_SEPARATOR_CELL_RE = re.compile(r"^:?-+:?$")


def _split_cells(line: str) -> list[str]:
    """把 md table 行拆成单元格列表（``\\|`` 不拆分）。

    ``| a | b |`` → ['a', 'b']；``| a | b``（尾竖线缺失）→ ['a', 'b']；
    ``a | b |``（首竖线缺失）→ ['a', 'b']。
    """
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|") and not s.endswith("\\|"):
        s = s[:-1]
    cells: list[str] = []
    buf: list[str] = []
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == "\\" and i + 1 < len(s) and s[i + 1] == "|":
            buf.append("\\|")
            i += 2
            continue
        if ch == "|":
            cells.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    cells.append("".join(buf))
    return cells


def _join_cells(cells: list[str]) -> str:
    return "| " + " | ".join(c.strip() for c in cells) + " |"


def _is_separator_row(cells: list[str]) -> bool:
    """全部单元格都是 ``---``/``:--:`` 形态 → separator 行。"""
    return bool(cells) and all(
        _SEPARATOR_CELL_RE.match(c.strip()) for c in cells if c.strip() != ""
    ) and any(c.strip() for c in cells)


def _iter_table_blocks(text: str):
    """产出 (block_start, block_end_exclusive, rows) —— 连续 table 行块。

    rows 为该块每行拆出的单元格列表。
    """
    lines = text.split("\n")
    i = 0
    n = len(lines)
    while i < n:
        if _TABLE_LINE_RE.match(lines[i]):
            start = i
            rows: list[list[str]] = []
            while i < n and _TABLE_LINE_RE.match(lines[i]):
                rows.append(_split_cells(lines[i]))
                i += 1
            yield start, i, rows
        else:
            i += 1


def validate_md_tables(text: str) -> list[dict]:
    """校验 text 中所有 md table 的列数一致性，返回问题清单（不改内容）。

    每个问题：``{'line': 1-based 行号, 'table_cols': int, 'row_cols': int,
    'preview': str}``。无问题返回空列表。

    注意：这是**诊断**接口（预览/测试/审计用）；索引主链路用
    :func:`normalize_md_tables` 直接归一化。
    """
    issues: list[dict] = []
    lines = text.split("\n")
    for start, end, rows in _iter_table_blocks(text):
        cols = max(len(r) for r in rows)
        # 优先以 header（首行）列数为基准报告；header 本身若异常窄，
        # 报最大列。header 与内容行都可能超宽，以「多数行」无意义，
        # 直接以 header 为基准（GFM 渲染截断的真实口径）。
        base = len(rows[0])
        if cols == base:
            continue
        for idx, r in enumerate(rows):
            if len(r) != base:
                issues.append({
                    "line": start + idx + 1,
                    "table_cols": base,
                    "row_cols": len(r),
                    "preview": lines[start + idx][:60],
                })
    return issues


def normalize_md_tables(text: str) -> str:
    """归一化 text 中的 md table：块内所有行 pad 到统一列数。

    - 统一列数 = 块内最大列数（含 header / separator / 内容行）；
    - pad 出的单元格为空字符串；已有内容**永不删减**；
    - 非 table 文本原样保留；异常安全（任何内部错误返回原文）。

    若块内含 separator 行（合法 GFM 表格），separator 也补齐到统一列数。
    """
    try:
        if "|" not in text:
            return text
        lines = text.split("\n")
        out: list[str] = []
        i = 0
        n = len(lines)
        while i < n:
            if _TABLE_LINE_RE.match(lines[i]):
                start = i
                while i < n and _TABLE_LINE_RE.match(lines[i]):
                    i += 1
                block_lines = lines[start:i]
                rows = [_split_cells(ln) for ln in block_lines]
                ncols = max(len(r) for r in rows)
                rebuilt: list[str] = []
                for ln, r in zip(block_lines, rows):
                    if _is_separator_row(r):
                        # separator 行按统一列数重建
                        rebuilt.append("| " + " | ".join(["---"] * ncols) + " |")
                    else:
                        padded = r + [""] * (ncols - len(r))
                        rebuilt.append(_join_cells(padded))
                out.extend(rebuilt)
            else:
                out.append(lines[i])
                i += 1
        return "\n".join(out)
    except Exception:  # pragma: no cover - 兜底：永不因表格处理失败丢内容
        return text


def normalize_tree_tables(structure) -> None:
    """对树结构内所有节点的 ``text`` 做 md table 归一化（原地修改）。

    供 indexer 在 parser dispatch 之后统一调用，覆盖所有 parser 产出。
    """
    from ..tree import flatten_tree

    if not structure:
        return
    for node in flatten_tree(structure):
        text = node.get("text")
        if isinstance(text, str) and "|" in text:
            node["text"] = normalize_md_tables(text)
