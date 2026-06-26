# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: DOCX parser for TreeSearch.

Requires optional dependency: ``pip install python-docx``
Extracts paragraphs and headings from DOCX and builds tree structure.
"""
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def _escape_md_cell(s: str) -> str:
    """转义 md table 单元格：``|`` → ``\\|``，换行 → 空格，回车删除。

    与 csv/xlsx 在 preview_synthesizer._escape_md_cell 的口径一致。
    """
    return s.replace("|", "\\|").replace("\n", " ").replace("\r", "")


def _table_to_text(table) -> str:
    """Convert a docx Table to a GitHub-flavored markdown table string.

    首行视为 header，输出形如::

        | h1 | h2 |
        | --- | --- |
        | v1 | v2 |

    这样前端 ``<md-viewer>`` 才能识别为真正的表格（缺 separator 行只会被
    当成软换行段落）。单元格里的 ``|`` 转义为 ``\\|``，换行替换为空格。
    """
    rows = []
    ncols = 0
    for row in table.rows:
        cells = [_escape_md_cell(cell.text.strip()) for cell in row.cells]
        ncols = max(ncols, len(cells))
        rows.append("| " + " | ".join(cells) + " |")
    if not rows or ncols == 0:
        return ""
    separator = "| " + " | ".join(["---"] * ncols) + " |"
    return "\n".join([rows[0], separator, *rows[1:]])


def _extract_docx_headings(docx_path: str) -> tuple[list[dict], list[str]]:
    """Extract headings and text from a DOCX file.

    Iterates document body elements in order so that tables are
    interleaved with paragraphs at the correct position.

    Returns:
        (headings, lines) where headings is a list of
        {'title': str, 'line_num': int, 'level': int}
    """
    try:
        from docx import Document as DocxDocument
        from docx.oxml.ns import qn
        from docx.table import Table
        from docx.text.paragraph import Paragraph
    except ImportError:
        raise ImportError(
            "DOCX support requires 'python-docx'. Install with: pip install python-docx"
        )

    doc = DocxDocument(docx_path)
    lines = []
    headings = []

    for child in doc.element.body:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

        if tag == "p":
            para = Paragraph(child, doc)
            text = para.text.strip()
            line_num = len(lines) + 1
            lines.append(text)

            style_name = (para.style.name if para.style else "") or ""
            style_name = style_name.lower()
            if style_name.startswith("heading"):
                try:
                    level = int(style_name.split()[-1])
                except (ValueError, IndexError):
                    level = 1
                if text:
                    headings.append({
                        "title": text,
                        "line_num": line_num,
                        "level": level,
                    })

        elif tag == "tbl":
            table = Table(child, doc)
            table_text = _table_to_text(table)
            if table_text.strip():
                line_num = len(lines) + 1
                lines.append(table_text)

    return headings, lines


async def docx_to_tree(
    docx_path: str,
    *,
    model: Optional[str] = None,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict:
    """Build a tree index from a DOCX file.

    Extracts headings via ``python-docx`` paragraph styles. If no headings
    are found, falls back to ``text_to_tree`` with plain text content.

    Returns:
        {'doc_name': str, 'structure': list, 'source_path': str}
    """
    doc_name = os.path.splitext(os.path.basename(docx_path))[0]
    logger.debug("Parsing DOCX: %s", docx_path)

    headings, lines = _extract_docx_headings(docx_path)

    if not headings:
        # No DOCX headings found, fall back to text_to_tree.
        # 用 \n\n 分段（过滤空段），让 text_to_tree 和下游 preview 都能正确识别段落边界。
        text_content = "\n\n".join(ln for ln in lines if ln.strip())
        from ..indexer import text_to_tree
        result = await text_to_tree(
            text_content=text_content,
            model=model,
            if_add_node_summary=if_add_node_summary,
            summary_chars_threshold=summary_chars_threshold,
            if_add_doc_description=if_add_doc_description,
            if_add_node_text=if_add_node_text,
            if_add_node_id=if_add_node_id,
            **kwargs,
        )
        result["doc_name"] = doc_name
        result["source_path"] = os.path.abspath(docx_path)
        return result

    # Build nodes from headings
    from ..indexer import _build_tree, _finalize_tree

    nodes = []
    for i, hd in enumerate(headings):
        start = hd["line_num"] - 1
        end = headings[i + 1]["line_num"] - 1 if i + 1 < len(headings) else len(lines)
        # 用 \n\n 分隔非空段落，保留 docx 段落结构。
        # 否则 preview synthesizer 输出单 \n，CommonMark 渲染会把多段合并成一段。
        # 表格项作为整体参与连接（内部保持单 \n），与相邻段落正确分段。
        paragraphs = [ln for ln in lines[start:end] if ln.strip()]
        text = "\n\n".join(paragraphs).strip()
        nodes.append({
            "title": hd["title"],
            "line_num": hd["line_num"],
            "line_start": hd["line_num"],
            "line_end": end,
            "level": hd["level"],
            "text": text,
        })

    tree = _build_tree(nodes)

    return _finalize_tree(
        tree, doc_name,
        source_path=os.path.abspath(docx_path),
        source_type="docx",
        if_add_node_id=if_add_node_id,
        if_add_node_summary=if_add_node_summary,
        summary_chars_threshold=summary_chars_threshold,
        if_add_node_text=if_add_node_text,
        if_add_doc_description=if_add_doc_description,
    )
