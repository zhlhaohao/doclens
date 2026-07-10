# -*- coding: utf-8 -*-
"""ImageStore 单元测试。"""
from pathlib import Path

from treesearch.parsers.image_store import (
    ImagePart,
    ImageStore,
    doc_hash_for,
)


def _png_bytes(color: bytes = b"\xff\x00\x00") -> bytes:
    """生成一个 1x1 PNG（给定 RGB）。不同 color → 不同 sha256。"""
    import base64
    # 1x1 PNG 模板，IEND 前的 IDAT 用固定透明像素；这里用 base64 模板再替换不可行，
    # 改用最简方式：返回两段不同的合法 PNG（同尺寸不同色）。为测试稳定性，
    # 直接返回两段已知合法且不同的 PNG bytes。
    pngs = {
        b"\xff\x00\x00": base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
        ),
        b"\x00\xff\x00": base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAenqB0sAAAAASUVORK5CYII="
        ),
    }
    return pngs[color]


def test_extract_for_doc_writes_files_and_returns_refs(tmp_path: Path):
    store = ImageStore(tmp_path)
    blob = _png_bytes(b"\xff\x00\x00")
    parts = [ImagePart(blob=blob, ext="png", source_ref="rId1")]

    refs = store.extract_for_doc("doc/报告.docx", parts)

    assert "rId1" in refs
    ref = refs["rId1"]
    assert ref.seq == 1
    assert "/api/preview/asset?path=" in ref.inline_md and "id=1" in ref.inline_md
    dh = doc_hash_for("doc/报告.docx")
    assert (tmp_path / dh / "1.png").read_bytes() == blob
    meta_file = tmp_path / dh / "_meta.json"
    assert meta_file.exists()


def test_extract_for_doc_dedupes_same_blob(tmp_path: Path):
    store = ImageStore(tmp_path)
    blob = _png_bytes(b"\xff\x00\x00")
    # 同一 blob 被两个 rId 引用 → 只落一份文件，两个 source_ref 指向同一 seq
    parts = [
        ImagePart(blob=blob, ext="png", source_ref="rId1"),
        ImagePart(blob=blob, ext="png", source_ref="rId2"),
    ]

    refs = store.extract_for_doc("a.docx", parts)

    assert refs["rId1"].seq == refs["rId2"].seq == 1
    dh = doc_hash_for("a.docx")
    assert list((tmp_path / dh).glob("*.png")) == [(tmp_path / dh / "1.png")]


def test_resolve_returns_path_and_media_type(tmp_path: Path):
    store = ImageStore(tmp_path)
    blob = _png_bytes(b"\x00\xff\x00")
    store.extract_for_doc("a.docx", [ImagePart(blob, "png", "rId1")])

    dh = doc_hash_for("a.docx")
    resolved = store.resolve(dh, 1)
    assert resolved is not None
    path, media = resolved
    assert path.name == "1.png" and media == "image/png"


def test_resolve_missing_returns_none(tmp_path: Path):
    store = ImageStore(tmp_path)
    assert store.resolve(doc_hash_for("a.docx"), 99) is None


def test_purge_doc_removes_dir(tmp_path: Path):
    store = ImageStore(tmp_path)
    store.extract_for_doc("a.docx", [ImagePart(_png_bytes(), "png", "rId1")])
    dh = doc_hash_for("a.docx")
    assert (tmp_path / dh).exists()
    store.purge_doc("a.docx")
    assert not (tmp_path / dh).exists()


def test_purge_all_clears_root(tmp_path: Path):
    store = ImageStore(tmp_path)
    store.extract_for_doc("a.docx", [ImagePart(_png_bytes(), "png", "rId1")])
    store.extract_for_doc("b.docx", [ImagePart(_png_bytes(b"\x00\xff\x00"), "png", "rId1")])
    dh_a = doc_hash_for("a.docx")
    dh_b = doc_hash_for("b.docx")
    assert (tmp_path / dh_a).exists()
    assert (tmp_path / dh_b).exists()
    store.purge_all()
    assert not (tmp_path / dh_a).exists()
    assert not (tmp_path / dh_b).exists()
    assert tmp_path.exists()  # root 自身保留
