# -*- coding: utf-8 -*-
"""工单 08：版本校验与重解读。

read_back 默认用 image_metadata 的全局期望版本（set_expected_version 设置）。
payload 版本不符 → 当无解读 → image_to_tree 占位入队重解读。
doclens 在 reindex 前经 IndexManager._sync_image_version_expectation 接线。
"""
import asyncio

import pytest
from PIL import Image

from treesearch.parsers import image_metadata
from treesearch.parsers.image_parser import image_to_tree


@pytest.fixture
def jpeg_path(tmp_path):
    p = tmp_path / "a.jpg"
    Image.new("RGB", (32, 32), (1, 2, 3)).save(str(p), "JPEG", quality=95)
    return str(p)


@pytest.fixture(autouse=True)
def _reset_expected_version():
    """隔离全局期望版本，避免跨测试污染。"""
    image_metadata.set_expected_version(None, None)
    yield
    image_metadata.set_expected_version(None, None)


def test_read_back_uses_global_expected_version(jpeg_path):
    image_metadata.write_back(jpeg_path, "md", model_tag="old", prompt_version="1")

    image_metadata.set_expected_version(model_tag="old", prompt_version="1")
    assert image_metadata.read_back(jpeg_path) is not None  # 版本一致 → 命中

    image_metadata.set_expected_version(model_tag="new", prompt_version="1")
    assert image_metadata.read_back(jpeg_path) is None  # model 不符 → None

    image_metadata.set_expected_version(model_tag="old", prompt_version="9")
    assert image_metadata.read_back(jpeg_path) is None  # prompt 不符 → None


def test_image_to_tree_reparse_on_version_mismatch(jpeg_path):
    """版本不符 → image_to_tree read_back 当无解读 → 占位入队（重解读）。"""
    image_metadata.write_back(jpeg_path, "# 旧标题", model_tag="old", prompt_version="1")

    image_metadata.set_expected_version(model_tag="new", prompt_version="1")
    result = asyncio.run(image_to_tree(jpeg_path))
    assert result.get("vision_pending") is True  # 版本不符 → 重解读

    image_metadata.set_expected_version(model_tag="old", prompt_version="1")
    result = asyncio.run(image_to_tree(jpeg_path))
    assert result.get("vision_pending") is None  # 版本一致 → 走闭环


def test_no_expected_version_skips_check(jpeg_path):
    """未设期望版本（默认 None）→ 不校验，有 payload 即用（兼容 04 行为）。"""
    image_metadata.write_back(jpeg_path, "# 标题", model_tag="whatever", prompt_version="x")
    # 全局为 None（fixture 重置）
    assert image_metadata.read_back(jpeg_path) is not None
    result = asyncio.run(image_to_tree(jpeg_path))
    assert result.get("vision_pending") is None


def test_index_manager_has_sync_wiring():
    """IndexManager 接线：定义了 _sync_image_version_expectation 并在 reindex 路径调用。"""
    import inspect
    from doclens import index_manager

    src = inspect.getsource(index_manager.IndexManager)
    assert "def _sync_image_version_expectation" in src
    assert "set_expected_version" in src
    # load_or_build_index + _reindex_internal 两处都调用
    assert src.count("self._sync_image_version_expectation()") >= 2
