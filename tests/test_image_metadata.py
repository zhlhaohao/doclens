# -*- coding: utf-8 -*-
"""image_metadata deep module 单元测试（工单 02，JPEG）。

prior art：tests/test_diary_worker.py（worker + 索引交互形态）。
seam：image_metadata 模块公开接口（read_back / write_back / content_fingerprint）。
只测外部行为，不测 EXIF 内部编码结构。
"""
import hashlib

import pytest
from PIL import Image

from treesearch.parsers import image_metadata as im

MD = "# 标题\n\n这是解读正文，含中文与 English。"


@pytest.fixture
def jpeg_path(tmp_path):
    p = tmp_path / "img.jpg"
    Image.new("RGB", (32, 32), (10, 20, 30)).save(str(p), "JPEG", quality=95)
    return str(p)


def _pixels_md5(path):
    with Image.open(path) as img:
        return hashlib.md5(img.convert("RGB").tobytes()).hexdigest()


def test_round_trip(jpeg_path):
    ok = im.write_back(jpeg_path, MD, model_tag="qwen-vl-max", prompt_version="1")
    assert ok is True
    payload = im.read_back(jpeg_path)
    assert payload is not None
    assert payload["markdown"] == MD
    assert payload["model_tag"] == "qwen-vl-max"
    assert payload["prompt_version"] == "1"


def test_read_back_none_when_no_metadata(jpeg_path):
    assert im.read_back(jpeg_path) is None


def test_content_fingerprint_stable_across_writeback(jpeg_path):
    before = im.content_fingerprint(jpeg_path)
    im.write_back(jpeg_path, MD, model_tag="m", prompt_version="1")
    after = im.content_fingerprint(jpeg_path)
    assert before == after


def test_pixels_unchanged_by_writeback(jpeg_path):
    before = _pixels_md5(jpeg_path)
    im.write_back(jpeg_path, MD, model_tag="m", prompt_version="1")
    assert _pixels_md5(jpeg_path) == before


def test_version_mismatch_returns_none(jpeg_path):
    im.write_back(jpeg_path, MD, model_tag="old", prompt_version="1")
    assert im.read_back(jpeg_path, model_tag="new") is None
    assert im.read_back(jpeg_path, prompt_version="2") is None
    assert im.read_back(jpeg_path, model_tag="old", prompt_version="1") is not None


def test_existing_exif_preserved(jpeg_path):
    import piexif

    zeroth = {0x010E: b"original description"}  # ImageDescription
    piexif.insert(piexif.dump({"0th": zeroth}), jpeg_path)

    assert im.write_back(jpeg_path, MD, model_tag="m", prompt_version="1") is True

    d = piexif.load(jpeg_path)
    assert d["0th"].get(0x010E) == b"original description"  # 原字段保留
    payload = im.read_back(jpeg_path)
    assert payload is not None and payload["markdown"] == MD


def test_writeback_failure_returns_false(tmp_path):
    bad = str(tmp_path / "nope.jpg")  # 不存在的文件
    assert im.write_back(bad, MD, model_tag="m", prompt_version="1") is False


def test_fingerprint_differs_for_different_images(tmp_path):
    a = tmp_path / "a.jpg"
    b = tmp_path / "b.jpg"
    Image.new("RGB", (32, 32), (1, 2, 3)).save(str(a), "JPEG")
    Image.new("RGB", (32, 32), (9, 8, 7)).save(str(b), "JPEG")
    assert im.content_fingerprint(str(a)) != im.content_fingerprint(str(b))


def test_format_constants():
    assert im.INTERPRETED_IMAGE_EXTS == frozenset({".jpg", ".jpeg", ".png", ".webp"})
    assert ".gif" in im.ALL_IMAGE_EXTS  # gif 在全集但不在解读集
    assert ".gif" not in im.INTERPRETED_IMAGE_EXTS
