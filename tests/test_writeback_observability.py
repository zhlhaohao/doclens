# -*- coding: utf-8 -*-
"""工单 09：write_back 降级（失败计数）+ 可观测（vision_status）。

降级（失败不抛、不影响其他图）已在 02/04 实现；本工单补失败计数 + status 暴露。
前端状态栏渲染（Lit）留作后续（本测试覆盖后端数据源）。
"""
import inspect

import pytest
from PIL import Image

from treesearch.parsers import image_metadata


@pytest.fixture(autouse=True)
def _reset_failures():
    image_metadata.reset_writeback_failures()
    yield
    image_metadata.reset_writeback_failures()


def test_writeback_failure_counted(tmp_path):
    """write_back 失败（不存在的文件）→ False 不抛 + 计数 +1。"""
    assert image_metadata.writeback_failure_count() == 0
    assert image_metadata.write_back(str(tmp_path / "nope.jpg"), "md", model_tag="m", prompt_version="1") is False
    assert image_metadata.writeback_failure_count() == 1
    image_metadata.write_back(str(tmp_path / "nope2.jpg"), "md", model_tag="m", prompt_version="1")
    assert image_metadata.writeback_failure_count() == 2


def test_writeback_success_not_counted(tmp_path):
    """write_back 成功不计入失败计数。"""
    p = tmp_path / "a.jpg"
    Image.new("RGB", (32, 32)).save(str(p), "JPEG")
    assert image_metadata.write_back(str(p), "md", model_tag="m", prompt_version="1") is True
    assert image_metadata.writeback_failure_count() == 0


def test_index_manager_has_vision_status():
    """IndexManager 暴露 vision_status（队列计数 + 失败计数）。"""
    from doclens import index_manager
    src = inspect.getsource(index_manager.IndexManager)
    assert "def vision_status" in src
    assert "vision_counts" in src
    assert "writeback_failures" in src


def test_status_api_exposes_vision_field():
    """status API 返回 vision 字段。"""
    from doclens.web_v2.api import status as status_api
    src = inspect.getsource(status_api)
    assert "vision" in src and "vision_status" in src
