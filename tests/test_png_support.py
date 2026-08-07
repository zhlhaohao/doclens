# -*- coding: utf-8 -*-
"""工单 05：PNG 支持（image_metadata 加 PNG 载体 + 闭环复用 03/04 机制）。

PNG 用 Pillow PngInfo iTXt（UTF-8）。Windows 资源管理器不读 PNG 元数据（已知接受），
但 doclens 自读自写闭环 + 可移植成立。content_fingerprint 像素 hash 已通用。
"""
import asyncio
import hashlib

import pytest
from PIL import Image

from treesearch.parsers import image_metadata
from treesearch.parsers.image_parser import image_to_tree

MD = "# PNG 解读\n\n正文中文 hello。"


@pytest.fixture
def png_path(tmp_path):
    p = tmp_path / "a.png"
    Image.new("RGB", (32, 32), (1, 2, 3)).save(str(p), "PNG")
    return str(p)


def _pixels_md5(path):
    with Image.open(path) as img:
        return hashlib.md5(img.convert("RGB").tobytes()).hexdigest()


def test_png_round_trip(png_path):
    assert image_metadata.write_back(png_path, MD, model_tag="m", prompt_version="1") is True
    p = image_metadata.read_back(png_path)
    assert p is not None
    assert p["markdown"] == MD
    assert p["model_tag"] == "m" and p["prompt_version"] == "1"


def test_png_read_none_when_no_metadata(png_path):
    assert image_metadata.read_back(png_path) is None


def test_png_fingerprint_stable(png_path):
    before = image_metadata.content_fingerprint(png_path)
    image_metadata.write_back(png_path, MD, model_tag="m", prompt_version="1")
    assert image_metadata.content_fingerprint(png_path) == before


def test_png_pixels_unchanged(png_path):
    before = _pixels_md5(png_path)
    image_metadata.write_back(png_path, MD, model_tag="m", prompt_version="1")
    assert _pixels_md5(png_path) == before


def test_png_version_mismatch(png_path):
    image_metadata.write_back(png_path, MD, model_tag="old", prompt_version="1")
    assert image_metadata.read_back(png_path, model_tag="new") is None
    assert image_metadata.read_back(png_path, model_tag="old", prompt_version="1") is not None


def test_png_readback_loop_via_image_to_tree(png_path):
    """PNG 经 image_parser 闭环：write_back 后 image_to_tree read_back 命中 → 不 pending。"""
    image_metadata.write_back(png_path, "# PNG 标题\n\n内容", model_tag="m", prompt_version="1")
    result = asyncio.run(image_to_tree(png_path))
    assert result.get("vision_pending") is None
    titles = [n.get("title", "") or "" for n in result.get("structure", [])]
    assert any("PNG 标题" in t for t in titles)
