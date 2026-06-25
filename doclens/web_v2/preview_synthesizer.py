"""把 treesearch Document.structure 合成为 markdown 字符串。

供 /api/preview 在二进制文档（pdf/docx/xlsx/csv）场景下使用：
DB 里已存结构化树，本模块把它拍平为 md 字符串，复用前端 <md-viewer> 渲染。
"""
import re
from typing import Any, Iterable

# 后缀 → 渲染分支的 source_type 判断键
_TABLE_SOURCE_TYPES = frozenset({"csv", "excel"})

_COLS_RE = re.compile(r"^Columns:\s*(.+)$")


def render_tree_to_md(structure: Any, source_type: str) -> str:
    """把 Document.structure（list 或 dict）合成为 markdown 字符串。

    Args:
        structure: treesearch 的树结构根节点列表（或单根 dict）。
        source_type: Document.source_type，决定节点 text 走段落还是 table。

    Returns:
        markdown 源字符串。每个 heading 所在行 == 该节点的 line_start
        （通过填白行对齐），便于前端 <md-viewer> 的 data-source-line 定位。
    """
    out: list[str] = []
    roots: Iterable[dict]
    if isinstance(structure, dict):
        roots = [structure]
    elif isinstance(structure, list):
        roots = structure
    else:
        return ""
    for root in roots:
        _emit_node(out, root, depth=0, source_type=source_type)
    return "\n".join(out)


def _emit_node(out: list[str], node: dict, depth: int, source_type: str) -> None:
    """DFS 把单个节点输出为 heading + body。"""
    line_start = node.get("line_start") or 1
    title = node.get("title", "") or ""
    text = node.get("text") or ""
    children = node.get("nodes") or []

    # 行号对齐：填白让 heading 出现在第 line_start 行（1-indexed）
    while len(out) + 1 < line_start:
        out.append("")

    level = min(depth + 1, 6)  # md 只有 h1-h6
    out.append("#" * level + " " + title)

    # csv 根节点：聚合子节点，table 块负责，短路递归避免重复 heading
    if source_type == "csv" and children and text.lstrip().startswith("Columns:"):
        _emit_table_block(out, text, children, source_type)
        return

    if source_type in _TABLE_SOURCE_TYPES:
        _emit_table_block(out, text, children, source_type)
    elif text:
        out.append("")
        out.extend(text.split("\n"))
        out.append("")

    for child in children:
        _emit_node(out, child, depth + 1, source_type=source_type)


def _emit_table_block(
    out: list[str],
    text: str,
    children: list[dict],
    source_type: str,
) -> None:
    """csv/xlsx: text 解析为 md table。

    - xlsx: text 自带 header + 所有数据行（单节点自包含）
    - csv:  text 只有 header，数据在 level-2 子节点 text 里，需聚合
    """
    body_lines = text.split("\n") if text else []

    # csv 根节点聚合所有子节点 text
    if source_type == "csv" and children:
        body_lines = body_lines + [
            line
            for c in children
            for line in (c.get("text") or "").split("\n")
            if line.strip()
        ]

    if not body_lines or not body_lines[0].strip():
        return

    m = _COLS_RE.match(body_lines[0].strip())
    if not m:
        # 退化兜底：text 不匹配 Columns 模式 → 段落输出，不阻塞渲染
        out.append("")
        out.extend(body_lines)
        out.append("")
        return

    headers = [h.strip() for h in m.group(1).split(",") if h.strip()]
    out.append("")
    out.append("| " + " | ".join(headers) + " |")
    out.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for row_line in body_lines[1:]:
        if not row_line.strip():
            continue
        cells = _parse_kv_row(row_line)
        out.append("| " + " | ".join(_escape_md_cell(cells.get(h, "")) for h in headers) + " |")
    out.append("")


def _parse_kv_row(line: str) -> dict[str, str]:
    """把 'h: v; h: v' 解析成 dict；缺失列留空。

    例：'a: 1; b: 2' → {'a': '1', 'b': '2'}
    """
    result: dict[str, str] = {}
    for pair in line.split(";"):
        if ":" not in pair:
            continue
        k, v = pair.split(":", 1)
        result[k.strip()] = v.strip()
    return result


def _escape_md_cell(s: str) -> str:
    """md table 单元格转义：| → \\|，换行 → 空格，回车删除。"""
    return s.replace("|", "\\|").replace("\n", " ").replace("\r", "")
