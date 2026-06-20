"""POST /api/preview/upload 测试。"""
import asyncio
import hashlib

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2 import deps
from cortex.web_v2.app import create_app
from cortex.web_v2.api.preview import _parse_upload_filename


@pytest.fixture
def reset_deps():
    """每个测试前后重置 deps 单例，避免 search_path 跨测试污染。"""
    deps.reset_singletons()
    yield
    deps.reset_singletons()


# ---------------------------------------------------------------------------
# 单元测试：_parse_upload_filename
# ---------------------------------------------------------------------------


def test_parse_upload_filename_basic():
    """{stem}_{hash6}{suffix} 正常解析。"""
    result = _parse_upload_filename("doc1_a1b2c3.md")
    assert result == ("doc1", "a1b2c3", ".md")


def test_parse_upload_filename_stem_contains_underscore():
    """stem 内部含下划线时按最后一段 _(6hex) 切分。"""
    result = _parse_upload_filename("my_file_name_a1b2c3.py")
    assert result == ("my_file_name", "a1b2c3", ".py")


def test_parse_upload_filename_stem_contains_dot():
    """stem 内部含点（无后缀歧义）按最后一个 . 作后缀切分。"""
    result = _parse_upload_filename("config.local_a1b2c3.json")
    assert result == ("config.local", "a1b2c3", ".json")


def test_parse_upload_filename_rejects_no_hash():
    """无 _{6hex} 段 → None。"""
    assert _parse_upload_filename("plain.md") is None


def test_parse_upload_filename_rejects_uppercase_hash():
    """大写 hex → None（下载端始终是小写）。"""
    assert _parse_upload_filename("doc1_A1B2C3.md") is None


def test_parse_upload_filename_rejects_short_hash():
    """hash 不足 6 位 → None。"""
    assert _parse_upload_filename("doc1_abc.md") is None


def test_parse_upload_filename_rejects_long_hash():
    """hash 超过 6 位（且第 7 位是 hex）→ None（必须恰好 6 位）。"""
    assert _parse_upload_filename("doc1_a1b2c3d.md") is None


def test_parse_upload_filename_rejects_no_suffix():
    """无后缀 → None。"""
    assert _parse_upload_filename("doc1_a1b2c3") is None


def test_parse_upload_filename_rejects_double_extension():
    """复合后缀（.tar.gz）→ None（不在本次支持范围）。"""
    assert _parse_upload_filename("archive_a1b2c3.tar.gz") is None
