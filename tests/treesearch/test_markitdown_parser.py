# -*- coding: utf-8 -*-
"""tests for treesearch.parsers.markitdown_parser (pptx slide-level image injection).

Verifies that:
1. pptx with image_store+rel_path extracts pictures and injects inline md
   into the correct slide node.
2. pptx without image_store still works (no image references emitted).
"""
import asyncio
import os
from pathlib import Path

from treesearch.parsers.image_store import ImageStore, doc_hash_for
from treesearch.parsers.markitdown_parser import markitdown_to_tree
from tests.conftest_image_fixtures import make_pptx_with_image


def _run(coro):
    return asyncio.run(coro)


def _collect_text(structure):
    """Recursively collect node text from a tree structure list."""
    out = []

    def walk(n):
        out.append(n.get("text") or "")
        for c in n.get("nodes") or []:
            walk(c)

    for n in structure:
        walk(n)
    return out


def test_pptx_extracts_image_into_slide_node(tmp_path: Path):
    """pptx with image_store: image md lands in some slide node's text,
    and the image file is written to disk at the expected path.
    """
    pptx_path = make_pptx_with_image(str(tmp_path / "s.pptx"))
    store = ImageStore(tmp_path / "images")
    result = _run(
        markitdown_to_tree(
            pptx_path,
            image_store=store,
            rel_path="s.pptx",
            if_add_node_text=True,
        )
    )
    all_text = _collect_text(result["structure"])
    assert any("/api/preview/asset?path=s.pptx&id=1" in t for t in all_text)
    assert (tmp_path / "images" / doc_hash_for("s.pptx") / "1.png").exists()


def test_pptx_strips_markitdown_internal_picture_refs(tmp_path: Path):
    """pptx with image_store: markitdown's internal ![...](PictureN.ext)
    references are stripped so no broken <img> renders in the browser,
    while our injected /api/preview/asset URL remains.
    """
    pptx_path = make_pptx_with_image(str(tmp_path / "s.pptx"))
    store = ImageStore(tmp_path / "images")
    result = _run(
        markitdown_to_tree(
            pptx_path,
            image_store=store,
            rel_path="s.pptx",
            if_add_node_text=True,
        )
    )
    all_text = _collect_text(result["structure"])
    # (a) our injected URL is present
    assert any("/api/preview/asset?path=s.pptx&id=1" in t for t in all_text)
    # (b) markitdown's broken Picture reference is stripped
    assert not any("](Picture" in t for t in all_text)


def test_pptx_without_image_store_still_works(tmp_path: Path):
    """pptx without image_store: no /api/preview/asset references emitted
    (backward compatible).
    """
    pptx_path = make_pptx_with_image(str(tmp_path / "s.pptx"))
    result = _run(markitdown_to_tree(pptx_path, if_add_node_text=True))
    assert not any(
        "/api/preview/asset" in t for t in _collect_text(result["structure"])
    )
