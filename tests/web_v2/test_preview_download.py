"""GET /api/preview/download 测试。"""
import hashlib

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2 import deps
from cortex.web_v2.app import create_app


@pytest.fixture
def reset_deps():
    """每个测试前后重置 deps 单例，避免 search_path 跨测试污染。"""
    deps.reset_singletons()
    yield
    deps.reset_singletons()


@pytest.mark.asyncio
async def test_download_returns_file_bytes(temp_workdir, env_cortex_config, reset_deps):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview/download", params={"path": "doc1.md"})
    assert res.status_code == 200
    assert b"Hello world from doc1." in res.content
    # 强制附件下载
    assert "attachment" in res.headers.get("content-disposition", "")


@pytest.mark.asyncio
async def test_download_filename_has_hash_suffix(temp_workdir, env_cortex_config, reset_deps):
    """文件名格式应为 {stem}_{sha256(rel_path)[:6]}{suffix}。"""
    rel_path = "doc1.md"
    expected_hash = hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:6]
    expected_name = f"doc1_{expected_hash}.md"

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview/download", params={"path": rel_path})
    cd = res.headers.get("content-disposition", "")
    assert expected_name in cd


@pytest.mark.asyncio
async def test_download_404_for_missing_file(temp_workdir, env_cortex_config, reset_deps):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/preview/download", params={"path": "nonexistent.md"}
        )
    assert res.status_code == 404
    assert res.json()["code"] == "FILE_NOT_FOUND"


@pytest.mark.asyncio
async def test_download_path_traversal_blocked(env_cortex_config, reset_deps):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/preview/download",
            params={"path": "../../../etc/passwd"},
        )
    assert res.status_code == 404
    assert res.json()["code"] == "FILE_NOT_FOUND"


@pytest.mark.asyncio
async def test_download_serves_original_binary_file(
    temp_workdir, env_cortex_config, reset_deps
):
    """对二进制后缀（如 .pdf）应直接下载原始文件字节，而非合成 md。"""
    pdf_bytes = b"%PDF-1.4 fake pdf bytes"
    (temp_workdir / "sample.pdf").write_bytes(pdf_bytes)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/preview/download", params={"path": "sample.pdf"}
        )
    assert res.status_code == 200
    assert res.content == pdf_bytes
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd
    # 文件名后缀保留 .pdf
    assert ".pdf" in cd
