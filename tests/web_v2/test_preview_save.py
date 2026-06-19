"""PUT /api/preview + GET writable 字段测试。"""
import os
import stat
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2 import deps
from cortex.web_v2.api.preview import _compute_writable
from cortex.web_v2.app import create_app
from cortex.web_v2.models.preview import (
    PreviewResponse,
    PreviewSaveRequest,
    PreviewSaveResponse,
)


@pytest.fixture
def reset_deps():
    deps.reset_singletons()
    yield
    deps.reset_singletons()


@pytest.mark.asyncio
async def test_get_preview_includes_writable_true_for_md(
    temp_workdir, env_cortex_config, reset_deps
):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "doc1.md"})
    assert res.status_code == 200
    body = res.json()
    assert body["writable"] is True


@pytest.mark.asyncio
async def test_get_preview_includes_writable_false_for_csv(
    temp_workdir, env_cortex_config, reset_deps
):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "data.csv"})
    assert res.status_code == 200
    body = res.json()
    assert body["writable"] is False


def test_preview_response_has_writable_field():
    resp = PreviewResponse(path="x.md", content="hi", writable=True)
    assert resp.writable is True


def test_preview_response_writable_defaults_false():
    resp = PreviewResponse(path="x.md", content="hi")
    assert resp.writable is False


def test_save_request_serializes_content():
    req = PreviewSaveRequest(content="hello\nworld")
    assert req.content == "hello\nworld"


def test_save_response_has_required_fields():
    resp = PreviewSaveResponse(
        path="x.md",
        content="abc",
        bytes_written=3,
        reindex_triggered=True,
    )
    assert resp.path == "x.md"
    assert resp.content == "abc"
    assert resp.bytes_written == 3
    assert resp.reindex_triggered is True


def test_compute_writable_true_for_normal_md(tmp_path: Path, monkeypatch):
    f = tmp_path / "doc.md"
    f.write_text("hi", encoding="utf-8")
    assert _compute_writable(f, search_path=tmp_path) is True


def test_compute_writable_false_for_binary_ext(tmp_path: Path, monkeypatch):
    f = tmp_path / "doc.pdf"
    f.write_text("fake", encoding="utf-8")
    assert _compute_writable(f, search_path=tmp_path) is False


def test_compute_writable_false_inside_cortex_dir(tmp_path: Path, monkeypatch):
    cortex = tmp_path / ".cortex"
    cortex.mkdir()
    f = cortex / "config.env"
    f.write_text("X=1", encoding="utf-8")
    assert _compute_writable(f, search_path=tmp_path) is False


def test_compute_writable_false_for_readonly_file(tmp_path: Path, monkeypatch):
    f = tmp_path / "ro.md"
    f.write_text("hi", encoding="utf-8")
    os.chmod(f, stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
    try:
        assert _compute_writable(f, search_path=tmp_path) is False
    finally:
        os.chmod(f, stat.S_IRUSR | stat.S_IWUSR)


def test_compute_writable_false_for_missing_file(tmp_path: Path, monkeypatch):
    f = tmp_path / "missing.md"
    assert _compute_writable(f, search_path=tmp_path) is False


# ---------------------------------------------------------------------------
# PUT /api/preview (Task 4) — 集成测试
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_put_overwrites_file_content(
    temp_workdir, env_cortex_config, reset_deps
):
    target = temp_workdir / "doc1.md"
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/preview",
            params={"path": "doc1.md"},
            json={"content": "## new content"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["path"] == "doc1.md"
    assert body["content"] == "## new content"
    assert body["bytes_written"] == len("## new content".encode("utf-8"))
    assert body["reindex_triggered"] is True
    # 磁盘文件实际写入
    assert target.read_text(encoding="utf-8") == "## new content"


@pytest.mark.asyncio
async def test_put_rejects_binary_extension(
    temp_workdir, env_cortex_config, reset_deps
):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/preview",
            params={"path": "data.csv"},
            json={"content": "x"},
        )
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_WRITABLE"


@pytest.mark.asyncio
async def test_put_rejects_path_traversal(
    env_cortex_config, reset_deps
):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/preview",
            params={"path": "../../../etc/passwd"},
            json={"content": "x"},
        )
    # _safe_resolve 抛 FILE_NOT_FOUND（按现有约定）
    assert res.status_code == 404
    assert res.json()["code"] == "FILE_NOT_FOUND"


@pytest.mark.asyncio
async def test_put_rejects_nonexistent_file(
    temp_workdir, env_cortex_config, reset_deps
):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/preview",
            params={"path": "ghost.md"},
            json={"content": "x"},
        )
    assert res.status_code == 404
    assert res.json()["code"] == "FILE_NOT_FOUND"


@pytest.mark.asyncio
async def test_put_rejects_readonly_file(
    temp_workdir, env_cortex_config, reset_deps
):
    target = temp_workdir / "doc1.md"
    os.chmod(target, stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
    try:
        app = create_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.put(
                "/api/preview",
                params={"path": "doc1.md"},
                json={"content": "x"},
            )
        assert res.status_code == 403
        assert res.json()["code"] == "NOT_WRITABLE"
    finally:
        os.chmod(target, stat.S_IRUSR | stat.S_IWUSR)


@pytest.mark.asyncio
async def test_put_rejects_oversized_content(
    temp_workdir, env_cortex_config, reset_deps
):
    big = "x" * (6 * 1024 * 1024)  # 6MB
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/preview",
            params={"path": "doc1.md"},
            json={"content": big},
        )
    assert res.status_code == 413
    assert res.json()["code"] == "CONTENT_TOO_LARGE"
