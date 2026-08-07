# -*- coding: utf-8 -*-
"""工单 07：格式范围收缩 —— gif/bmp/tiff/tif 不再作为图像处理。"""
from treesearch.parsers import SOURCE_TYPE_MAP, get_parser
from treesearch.parsers.image_parser import IMAGE_EXTENSIONS


def test_image_extensions_shrunk_to_four():
    assert IMAGE_EXTENSIONS == frozenset({".jpg", ".jpeg", ".png", ".webp"})
    for ext in (".gif", ".bmp", ".tiff", ".tif"):
        assert ext not in IMAGE_EXTENSIONS


def test_gif_bmp_tiff_not_registered_as_image():
    """gif/bmp/tiff 不注册 image parser、source_type 非 image。"""
    for ext in (".gif", ".bmp", ".tiff", ".tif"):
        assert get_parser(ext) is None
        assert SOURCE_TYPE_MAP.get(ext, "text") != "image"


def test_four_formats_still_image():
    """jpg/jpeg/png/webp 仍是 image parser。"""
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        assert get_parser(ext) is not None
        assert SOURCE_TYPE_MAP.get(ext) == "image"
