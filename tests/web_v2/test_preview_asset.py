# -*- coding: utf-8 -*-
"""GET /api/preview/asset —— 图片资源端点测试。

fixture 构造一个含已索引图片的 app + IndexManager，验证端点能正确读回图片字节、
拒绝越权路径、拒绝非数字 id、对不存在的图片返回 404。
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager
from doclens.web_v2 import deps
from doclens.web_v2.app import create_app
from tests.conftest_image_fixtures import make_docx_with_image


@pytest.fixture
def client_with_docx_image(tmp_path: Path):
    """构造一个含已索引图片的 app + IndexManager。

    make_docx_with_image 生成含 1 张 PNG 的 docx；load_or_build_index() 索引时
    indexer 把图片落盘到 ``<index_path>.parent/images/<doc_hash>/1.png``。
    """
    workdir = tmp_path / "kb"
    workdir.mkdir()
    doc_rel = "报告.docx"
    make_docx_with_image(str(workdir / doc_rel))

    deps.reset_singletons()
    cfg = CortexConfig(
        search_path=str(workdir),
        index_path=str(workdir / ".cortex" / "index.db"),
    )
    mgr = IndexManager(cfg)
    mgr.load_or_build_index()
    deps._idx_manager = mgr  # 注入单例供 DI 使用

    app = create_app()
    client = TestClient(app)
    yield client, doc_rel
    deps.reset_singletons()


def test_asset_returns_image_bytes(client_with_docx_image):
    """已索引的图片应返回 200 + image/* Content-Type + 非空字节。"""
    client, rel = client_with_docx_image
    r = client.get("/api/preview/asset", params={"path": rel, "id": 1})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/")
    assert len(r.content) > 0


def test_asset_rejects_traversal(client_with_docx_image):
    """path 含 ../ 越权应被 _safe_resolve 拦截，返回 404 FILE_NOT_FOUND。"""
    client, _ = client_with_docx_image
    r = client.get(
        "/api/preview/asset",
        params={"path": "../../etc/passwd", "id": 1},
    )
    assert r.status_code == 404


def test_asset_rejects_non_numeric_id(client_with_docx_image):
    """id 非数字（如 ../../x）应被 Query(..., ge=1) 拦截，返回 422。"""
    client, rel = client_with_docx_image
    r = client.get(
        "/api/preview/asset",
        params={"path": rel, "id": "../../x"},
    )
    assert r.status_code in (400, 422)


def test_asset_missing_returns_404(client_with_docx_image):
    """id=999 图片不存在应返回 404 IMAGE_NOT_FOUND。"""
    client, rel = client_with_docx_image
    r = client.get("/api/preview/asset", params={"path": rel, "id": 999})
    assert r.status_code == 404
