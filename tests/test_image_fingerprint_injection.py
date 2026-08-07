# -*- coding: utf-8 -*-
"""工单 03：file_hash 注入内容指纹口径（JPEG）。

seam：_file_hash_with_salts（图像走 content_fingerprint，其余走原 stat/content）。
只测外部行为（hash 是否稳定/敏感），不测 _file_hash_with_salts 内部分流实现。
"""
import pytest
from PIL import Image

from treesearch.indexer import _file_hash_with_salts
from treesearch.parsers import image_metadata


@pytest.fixture
def jpeg_path(tmp_path):
    p = tmp_path / "a.jpg"
    Image.new("RGB", (32, 32), (1, 2, 3)).save(str(p), "JPEG", quality=95)
    return str(p)


def test_jpeg_hash_stable_across_writeback(jpeg_path):
    """图像写回元数据后 file_hash 不变 → 增量 reindex 不重解析（死循环消除）。"""
    before = _file_hash_with_salts(jpeg_path)
    image_metadata.write_back(jpeg_path, "解读内容", model_tag="m", prompt_version="1")
    after = _file_hash_with_salts(jpeg_path)
    assert before == after
    assert ":image:" in after  # 走图像指纹口径


def test_non_image_hash_not_image_mode(tmp_path):
    """非图像文件不受图像分流影响，仍走 stat/content 口径。"""
    txt = tmp_path / "a.txt"
    txt.write_text("hello")
    h = _file_hash_with_salts(str(txt))
    assert ":image:" not in h


def test_non_image_hash_sensitive_to_content(tmp_path):
    """非图像文件 size 变 → hash 变（stat 口径对 size 敏感）。"""
    txt = tmp_path / "a.txt"
    txt.write_text("hello")
    h1 = _file_hash_with_salts(str(txt))
    txt.write_text("hello world")  # size 变
    h2 = _file_hash_with_salts(str(txt))
    assert h1 != h2


def test_jpeg_hash_differs_for_different_images(tmp_path):
    a = tmp_path / "a.jpg"
    b = tmp_path / "b.jpg"
    Image.new("RGB", (32, 32), (1, 2, 3)).save(str(a), "JPEG")
    Image.new("RGB", (32, 32), (9, 8, 7)).save(str(b), "JPEG")
    assert _file_hash_with_salts(str(a)) != _file_hash_with_salts(str(b))


def test_core_reindex_loop_unchanged():
    """acceptance：indexer 核心循环未被改动 —— reindex 主循环仍直接调 _file_hash_with_salts。
    本测试钉住「调用点符号不变」这一事实，回归保护。"""
    import inspect

    from treesearch import indexer

    src = inspect.getsource(indexer)
    # reindex 主循环里算 hash 的那行（见 indexer.py 约 1662 行）
    assert "_file_hash_with_salts(abs_fp)" in src
