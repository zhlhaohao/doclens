# -*- coding: utf-8 -*-
"""工单 06：WebP 支持（XMP ancillary 载体，复用 03/04/05 机制）。"""
import asyncio
import hashlib

import pytest
from PIL import Image

from treesearch.parsers import image_metadata
from treesearch.parsers.image_parser import image_to_tree

MD = "# WebP 解读\n\n正文中文 hello。<含特殊字符>"


@pytest.fixture
def webp_path(tmp_path):
    p = tmp_path / "a.webp"
    Image.new("RGB", (32, 32), (1, 2, 3)).save(str(p), "WEBP", lossless=True)
    return str(p)


def _pixels_md5(path):
    with Image.open(path) as img:
        return hashlib.md5(img.convert("RGB").tobytes()).hexdigest()


def test_webp_round_trip(webp_path):
    assert image_metadata.write_back(webp_path, MD, model_tag="m", prompt_version="1") is True
    p = image_metadata.read_back(webp_path)
    assert p is not None and p["markdown"] == MD and p["model_tag"] == "m"


def test_webp_read_none_when_no_metadata(webp_path):
    assert image_metadata.read_back(webp_path) is None


def test_webp_fingerprint_stable(webp_path):
    before = image_metadata.content_fingerprint(webp_path)
    image_metadata.write_back(webp_path, MD, model_tag="m", prompt_version="1")
    assert image_metadata.content_fingerprint(webp_path) == before


def test_webp_pixels_unchanged(webp_path):
    before = _pixels_md5(webp_path)
    image_metadata.write_back(webp_path, MD, model_tag="m", prompt_version="1")
    assert _pixels_md5(webp_path) == before


def test_webp_version_mismatch(webp_path):
    image_metadata.write_back(webp_path, MD, model_tag="old", prompt_version="1")
    assert image_metadata.read_back(webp_path, model_tag="new") is None
    assert image_metadata.read_back(webp_path, model_tag="old", prompt_version="1") is not None


def test_webp_readback_loop_via_image_to_tree(webp_path):
    image_metadata.write_back(webp_path, "# WebP 标题\n\n内容", model_tag="m", prompt_version="1")
    result = asyncio.run(image_to_tree(webp_path))
    assert result.get("vision_pending") is None
    titles = [n.get("title", "") or "" for n in result.get("structure", [])]
    assert any("WebP 标题" in t for t in titles)
