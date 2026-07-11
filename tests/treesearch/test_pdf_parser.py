# -*- coding: utf-8 -*-
"""PDF 图片提取单元测试（fitz 后端 + 页面级锚定 + 降级）。"""
import asyncio
import io
from pathlib import Path

import pytest

from treesearch.parsers.image_store import ImageStore, doc_hash_for
from treesearch.parsers.pdf_parser import (
    _extract_pdf_page_images,
    extract_pdf_text,
    pdf_to_tree,
)
from tests.conftest_image_fixtures import make_pdf_with_image


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def _collect_text(structure):
    out = []

    def walk(n):
        out.append(n.get("text") or "")
        for c in n.get("nodes") or []:
            walk(c)

    for n in structure:
        walk(n)
    return out


def test_extract_pdf_page_images_returns_per_page(tmp_path: Path):
    pdf = make_pdf_with_image(str(tmp_path / "s.pdf"))
    page_parts = _extract_pdf_page_images(pdf)
    assert len(page_parts) >= 1
    # 第 1 页有 1 张图
    assert len(page_parts[0]) == 1
    part = page_parts[0][0]
    assert part.ext in ("png", "jpeg", "jpg")
    assert part.source_ref == "page0:0"
    assert len(part.blob) > 0


def test_pdf_to_tree_extracts_image_into_text(tmp_path: Path):
    pdf = make_pdf_with_image(str(tmp_path / "s.pdf"))
    store = ImageStore(tmp_path / "images")
    result = _run(pdf_to_tree(
        pdf, image_store=store, rel_path="s.pdf", if_add_node_text=True,
    ))
    all_text = _collect_text(result["structure"])
    assert any("/api/preview/asset?path=s.pdf&id=1" in t for t in all_text), (
        "PDF 节点 text 缺少图片引用"
    )
    # 图片落盘
    assert (tmp_path / "images" / doc_hash_for("s.pdf") / "1.png").exists() or \
           list((tmp_path / "images" / doc_hash_for("s.pdf")).glob("1.*"))


def test_pdf_to_tree_without_image_store_still_works(tmp_path: Path):
    """向后兼容：不传 image_store 时无图片引用，文字功能正常。"""
    pdf = make_pdf_with_image(str(tmp_path / "s.pdf"))
    result = _run(pdf_to_tree(pdf, if_add_node_text=True))
    all_text = _collect_text(result["structure"])
    assert not any("/api/preview/asset" in t for t in all_text)
    # 文字仍在（fixture 使用 ASCII 文字）
    assert any("Title" in t or "image" in t.lower() for t in all_text)


def test_pdf_to_tree_degrades_without_fitz(tmp_path: Path, monkeypatch):
    """fitz 不可用时降级：文字预览正常，无图片，不抛异常。"""
    pdf = make_pdf_with_image(str(tmp_path / "s.pdf"))
    store = ImageStore(tmp_path / "images")

    # 让 pdf_parser 内的 `import fitz` 抛 ImportError
    import builtins

    real_import = builtins.__import__

    def _fake_import(name, *args, **kwargs):
        if name == "fitz":
            raise ImportError("simulated: no fitz")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", _fake_import)

    result = _run(pdf_to_tree(
        pdf, image_store=store, rel_path="s.pdf", if_add_node_text=True,
    ))
    all_text = _collect_text(result["structure"])
    assert not any("/api/preview/asset" in t for t in all_text)  # 无图片
    assert any("Title" in t or "image" in t.lower() for t in all_text)  # 文字正常


def test_extract_pdf_text_injects_image_md_for_image_only_page(tmp_path: Path):
    """纯图页（无文字层）也要保留并注入图片 md。"""
    # 构造一个只有图、没有可提取文字的 PDF 页：用 fitz 直接插一张图
    import fitz
    from tests.conftest_image_fixtures import PNG_FITZ

    pdf = str(tmp_path / "imgonly.pdf")
    doc = fitz.open()
    page = doc.new_page()
    page.insert_image(fitz.Rect(0, 0, 200, 200), stream=io.BytesIO(PNG_FITZ))
    doc.save(pdf)
    doc.close()

    # extract_pdf_text 不传 page_image_mds → pdfplumber 提不到文字 → 历史行为是空串
    text_no_img = extract_pdf_text(pdf)
    # 传 page_image_mds（模拟一张图）→ 该页块必须出现（不能因无文字被丢）
    text_with_img = extract_pdf_text(pdf, page_image_mds=["![图片 1](/api/preview/asset?path=x.pdf&id=1)"])
    assert "[PAGE 1]" in text_with_img, "纯图页块被丢弃（page_text 为空时不该跳过）"
    assert "/api/preview/asset?path=x.pdf&id=1" in text_with_img
    assert "/api/preview/asset" not in text_no_img  # 不传则无注入
