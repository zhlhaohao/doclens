# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Markitdown-based parser for TreeSearch.

Uses Microsoft's ``markitdown`` library to convert documents to Markdown,
then feeds the result into the existing ``md_to_tree`` pipeline.

Requires optional dependency: ``pip install markitdown``
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Extensions handled by markitdown
MARKITDOWN_EXTENSIONS = {".pptx"}

# ---------------------------------------------------------------------------
# Monkey-patch: python-pptx AutoShape.shape_type raises NotImplementedError
# for unrecognized shape types (e.g. SmartArt, connectors, ink).  Returning
# None instead lets markitdown skip those shapes gracefully while still
# extracting text from shapes that have a text_frame.
# ---------------------------------------------------------------------------
def _patch_pptx_shape_type():
    try:
        from pptx.shapes.autoshape import Shape
    except ImportError:
        return

    _orig = Shape.shape_type.fget  # type: ignore[attr-defined]

    @property  # type: ignore[misc]
    def _safe_shape_type(self):
        try:
            return _orig(self)
        except NotImplementedError:
            return None

    Shape.shape_type = _safe_shape_type  # type: ignore[assignment]


_patch_pptx_shape_type()


async def markitdown_to_tree(
    file_path: str,
    *,
    model: Optional[str] = None,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict:
    """Build a tree index from a document via markitdown.

    Converts the document to Markdown using ``markitdown``, then delegates
    to ``md_to_tree`` for structure extraction.

    Returns:
        {'doc_name': str, 'structure': list, 'source_path': str}
    """
    try:
        from markitdown import MarkItDown
    except ImportError:
        raise ImportError(
            "Markitdown support requires 'markitdown'. "
            "Install with: pip install markitdown"
        )

    doc_name = os.path.splitext(os.path.basename(file_path))[0]
    logger.debug("Parsing with markitdown: %s", file_path)

    md = MarkItDown()
    result = md.convert(file_path)
    md_content = result.text_content

    if not md_content or not md_content.strip():
        logger.warning("markitdown returned empty content for: %s", file_path)
        md_content = ""

    from ..indexer import md_to_tree

    tree_result = await md_to_tree(
        md_content=md_content,
        model=model,
        if_add_node_summary=if_add_node_summary,
        summary_chars_threshold=summary_chars_threshold,
        if_add_doc_description=if_add_doc_description,
        if_add_node_text=if_add_node_text,
        if_add_node_id=if_add_node_id,
        **kwargs,
    )
    tree_result["doc_name"] = doc_name
    tree_result["source_path"] = os.path.abspath(file_path)
    tree_result["source_type"] = "pptx"

    # PPTX 特殊处理：将扁平的 slide 节点包裹在文档根节点下，形成两层结构
    # markitdown 输出每个 slide 为 # 标题，md_to_tree 将其作为顶层节点
    # 需要聚合为一个根节点 → 多个子节点（每页一个）的层次结构
    structure = tree_result.get("structure", [])
    if len(structure) > 1:
        # 计算整体行号范围
        min_line = min(
            (n.get("line_start", 0) for n in structure if n.get("line_start") is not None),
            default=0,
        )
        max_line = max(
            (n.get("line_end", 0) for n in structure if n.get("line_end") is not None),
            default=0,
        )
        root_node = {
            "title": doc_name,
            "node_id": "0",
            "text": "",
            "line_start": min_line,
            "line_end": max_line,
            "nodes": structure,
        }
        tree_result["structure"] = [root_node]

    return tree_result
