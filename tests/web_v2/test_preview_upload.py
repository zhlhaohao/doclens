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
# 浏览器去重后缀 " (N)" 兼容（download 重名时 Chrome/Edge 自动添加）
# ---------------------------------------------------------------------------


def test_parse_upload_filename_tolerates_browser_dup_suffix_single_digit():
    """浏览器去重后缀 ' (1)' 应被容忍：hash+suffix 正确解析。"""
    result = _parse_upload_filename("doc1_a1b2c3 (1).md")
    assert result == ("doc1", "a1b2c3", ".md")


def test_parse_upload_filename_tolerates_browser_dup_suffix_multi_digit():
    """多位数去重后缀 ' (10)' 也应被容忍。"""
    result = _parse_upload_filename("doc1_a1b2c3 (10).md")
    assert result == ("doc1", "a1b2c3", ".md")


def test_parse_upload_filename_tolerates_dup_with_unicode_stem():
    """用户场景：中文 stem + 去重后缀。"""
    result = _parse_upload_filename(
        "量子计算与人工智能报告2025-2026_63cae7 (1).docx"
    )
    assert result == (
        "量子计算与人工智能报告2025-2026",
        "63cae7",
        ".docx",
    )


def test_parse_upload_filename_no_dup_still_works():
    """无去重后缀的常规文件名仍正常解析（回归）。"""
    result = _parse_upload_filename("doc1_a1b2c3.md")
    assert result == ("doc1", "a1b2c3", ".md")


def test_parse_upload_filename_rejects_dup_without_space():
    """'(1)' 缺少前导空格 → None（不是浏览器标准格式）。"""
    assert _parse_upload_filename("doc1_a1b2c3(1).md") is None


def test_parse_upload_filename_rejects_dup_without_parens():
    """' 1' 缺少括号 → None（不是浏览器标准格式）。"""
    assert _parse_upload_filename("doc1_a1b2c3 1.md") is None


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


# ---------------------------------------------------------------------------
# 集成测试：POST /api/preview/upload
# ---------------------------------------------------------------------------


def _hash_for(rel_path: str) -> str:
    return hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:6]


@pytest.mark.asyncio
async def test_upload_overwrites_markdown_file(temp_workdir, env_cortex_config, reset_deps):
    """正常上传覆盖 markdown：磁盘内容被替换，响应 200。"""
    await asyncio.to_thread(_init_and_reindex)

    h = _hash_for("doc1.md")
    new_content = b"# Overwritten by upload test"

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": (f"doc1_{h}.md", new_content, "text/markdown")},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["path"] == "doc1.md"
    assert body["bytes_written"] == len(new_content)
    assert body["reindex_triggered"] is True
    # 磁盘内容确实被覆盖
    assert (temp_workdir / "doc1.md").read_bytes() == new_content


@pytest.mark.asyncio
async def test_upload_overwrites_binary_file(temp_workdir, env_cortex_config, reset_deps):
    """正常上传覆盖二进制（.pdf）：字节完全一致。"""
    # 准备一个 pdf + 索引
    original_pdf = b"%PDF-1.4 original"
    (temp_workdir / "sample.pdf").write_bytes(original_pdf)
    await asyncio.to_thread(_init_and_reindex)

    h = _hash_for("sample.pdf")
    new_pdf = b"%PDF-1.4 replaced bytes"

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": (f"sample_{h}.pdf", new_pdf, "application/pdf")},
        )
    assert res.status_code == 200
    assert (temp_workdir / "sample.pdf").read_bytes() == new_pdf


@pytest.mark.asyncio
async def test_upload_bad_filename_returns_400(temp_workdir, env_cortex_config, reset_deps):
    """文件名不符合格式 → 400 BAD_FILENAME。"""
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": ("plain.md", b"hello", "text/markdown")},
        )
    assert res.status_code == 400
    assert res.json()["code"] == "BAD_FILENAME"


@pytest.mark.asyncio
async def test_upload_not_indexed_returns_404(temp_workdir, env_cortex_config, reset_deps):
    """hash+stem 在索引中找不到 → 404 NOT_INDEXED。"""
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": ("doc1_deadbe.md", b"x", "text/markdown")},
        )
    assert res.status_code == 404
    assert res.json()["code"] == "NOT_INDEXED"


@pytest.mark.asyncio
async def test_upload_too_large_returns_413(temp_workdir, env_cortex_config, reset_deps, monkeypatch):
    """超过大小上限 → 413。"""
    await asyncio.to_thread(_init_and_reindex)
    # monkeypatch 缩小上限避免造大文件
    from cortex.web_v2.api import preview as preview_api_module
    monkeypatch.setattr(preview_api_module, "_MAX_UPLOAD_BYTES", 16)

    h = _hash_for("doc1.md")
    big = b"x" * 32

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": (f"doc1_{h}.md", big, "text/markdown")},
        )
    assert res.status_code == 413
    assert res.json()["code"] == "CONTENT_TOO_LARGE"


@pytest.mark.asyncio
async def test_upload_rejects_dotcortex_target(
    temp_workdir, env_cortex_config, reset_deps, monkeypatch
):
    """解析出的相对路径落入 .cortex/ → 403 NOT_WRITABLE。

    .cortex/ 在 DEFAULT_IGNORE_DIRS 中，正常 reindex 不会索引它。
    这里通过 monkeypatch 注入一条伪造的 Document 记录（source_path 指向
    .cortex/internal.md），模拟"万一有记录落入该目录"的防御场景。
    """
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    # 在 .cortex 下造一个物理文件（用于后续 _safe_resolve / write_bytes 检查）
    cortex_dir = temp_workdir / ".cortex"
    cortex_dir.mkdir(exist_ok=True)
    (cortex_dir / "internal.md").write_text("# internal", encoding="utf-8")

    # 注入伪造 Document：让 _resolve_upload_target 能匹配到 .cortex/internal.md
    from treesearch.tree import Document
    abs_internal = str((cortex_dir / "internal.md").resolve())
    fake_doc = Document(
        doc_id="_cortex_internal",
        doc_name="internal.md",
        structure=[],
        doc_description="",
        metadata={"source_path": abs_internal},
        source_type="markdown",
    )
    real_docs = list(idx.documents)
    monkeypatch.setattr(idx._ts, "documents", real_docs + [fake_doc])

    # 计算 .cortex/internal.md 的 hash
    rel = ".cortex/internal.md"
    h = _hash_for(rel)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": (f"internal_{h}.md", b"hacked", "text/markdown")},
        )
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_WRITABLE"
