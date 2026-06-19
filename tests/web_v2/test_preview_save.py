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
