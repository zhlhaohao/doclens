# -*- coding: utf-8 -*-
"""工单 04：读回闭环（JPEG）—— tracer bullet 主干。

seam：image_parser.image_to_tree（read_back 命中则建树不 pending）+ 闭环
（write_back 产出能被 image_to_tree 消费 → 不入队）。
间接验证 vision_worker._replace_placeholder 的 write_back 集成（write_back 产出可被读回）。
"""
import asyncio

import pytest
from PIL import Image

from treesearch.parsers import image_metadata
from treesearch.parsers.image_parser import PLACEHOLDER_TEXT, image_to_tree


@pytest.fixture
def jpeg_path(tmp_path):
    p = tmp_path / "a.jpg"
    Image.new("RGB", (32, 32), (1, 2, 3)).save(str(p), "JPEG", quality=95)
    return str(p)


def _titles(result):
    return [n.get("title", "") or "" for n in result.get("structure", [])]


def test_placeholder_when_no_metadata(jpeg_path):
    """无解读元数据 → 占位节点 + vision_pending（入队）。"""
    result = asyncio.run(image_to_tree(jpeg_path))
    assert result.get("vision_pending") is True
    assert result["doc_name"] == "a"


def test_readback_hit_no_pending(jpeg_path):
    """有解读元数据 → 用解读建树、不设 vision_pending（不入队）。"""
    image_metadata.write_back(jpeg_path, "# 解读标题\n\n解读正文", model_tag="m", prompt_version="1")
    result = asyncio.run(image_to_tree(jpeg_path))
    assert result.get("vision_pending") is None  # 不入队
    assert any("解读标题" in t for t in _titles(result))
    assert PLACEHOLDER_TEXT not in str(result.get("structure", []))


def test_writeback_readback_loop(jpeg_path):
    """闭环：worker 写回解读 → image_to_tree read_back 命中 → 建树不 pending。"""
    md = "# 闭环标题\n\n这是 vision 解读结果。"
    image_metadata.write_back(jpeg_path, md, model_tag="m", prompt_version="1")
    result = asyncio.run(image_to_tree(jpeg_path))
    assert result.get("vision_pending") is None
    assert any("闭环标题" in t for t in _titles(result))


def test_readback_only_jpeg_uses_payload(tmp_path):
    """非 JPEG（如 PNG，工单 05/06 未实现 read_back 载体）→ 仍占位入队。"""
    p = tmp_path / "a.png"
    Image.new("RGB", (32, 32)).save(str(p), "PNG")
    result = asyncio.run(image_to_tree(str(p)))
    # PNG 的 read_back 当前返回 None（工单 05 实现）→ 占位入队
    assert result.get("vision_pending") is True
