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


# ---------------------------------------------------------------------------
# 单元测试：_resolve_upload_target
# ---------------------------------------------------------------------------


def _init_and_reindex():
    """在非事件循环线程中初始化 IndexManager 并建索引。"""
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


@pytest.mark.asyncio
async def test_resolve_upload_target_matches_indexed_doc(temp_workdir, env_cortex_config, reset_deps):
    """已索引文件 stem+hash 双因素匹配 → 返回相对路径。"""
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    rel_path = "doc1.md"
    expected_hash = hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:6]

    from cortex.web_v2.api.preview import _resolve_upload_target, _HashCollisionError
    result = _resolve_upload_target(idx, "doc1", expected_hash)
    assert result == rel_path


@pytest.mark.asyncio
async def test_resolve_upload_target_no_match_returns_none(
    temp_workdir, env_cortex_config, reset_deps
):
    """hash 不在索引中 → 返回 None。"""
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    from cortex.web_v2.api.preview import _resolve_upload_target
    assert _resolve_upload_target(idx, "doc1", "deadbe") is None


@pytest.mark.asyncio
async def test_resolve_upload_target_stem_mismatch_returns_none(
    temp_workdir, env_cortex_config, reset_deps
):
    """hash 匹配但 stem 不一致 → 返回 None（双因素校验）。"""
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    rel_path = "doc1.md"
    expected_hash = hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:6]

    from cortex.web_v2.api.preview import _resolve_upload_target
    # hash 对但 stem 错
    assert _resolve_upload_target(idx, "wrong_stem", expected_hash) is None


@pytest.mark.asyncio
async def test_resolve_upload_target_collision_raises(
    temp_workdir, env_cortex_config, reset_deps, monkeypatch
):
    """多个文档命中同一 (stem, hash6) → 抛 _HashCollisionError。"""
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    # 构造 collision：让 idx.documents 返回两条同 rel_path 的文档。
    # IndexManager.documents 是 @property，无法直接 setattr；
    # 但它读取 idx._ts.documents（普通实例属性），patch 它即可。
    real_docs = list(idx.documents)
    # 找到 doc1.md 对应的文档（real_docs 顺序不保证），复制一份产生碰撞
    target = next(
        d for d in real_docs
        if d.metadata.get("source_path", "").endswith("doc1.md")
    )
    fake_doc = type(target)(
        doc_id=target.doc_id + "_dup",
        doc_name=target.doc_name,
        structure=target.structure,
        doc_description=target.doc_description,
        metadata=target.metadata,
        source_type=target.source_type,
    )
    monkeypatch.setattr(idx._ts, "documents", real_docs + [fake_doc])

    rel_path = "doc1.md"
    expected_hash = hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:6]

    from cortex.web_v2.api.preview import _resolve_upload_target, _HashCollisionError
    with pytest.raises(_HashCollisionError):
        _resolve_upload_target(idx, "doc1", expected_hash)
