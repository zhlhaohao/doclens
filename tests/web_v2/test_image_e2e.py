# -*- coding: utf-8 -*-
"""E2E integration test: docx/pptx 图片预览全链路 + force 重建稳定性。

通过 TestClient（无真实服务器）驱动完整后端管线：
  build_index → ImageStore 落盘 → /api/preview 合成 md → /api/preview/asset 读字节

覆盖 Task 1-5 的协同工作：
  - docx 段落级图片提取 + 锚定到 node text（Task 2）
  - pptx slide 图片提取 + markitdown Picture 残留清理（Task 3）
  - /api/preview/asset 端点读回真实图片字节（Task 5）
  - force=True 重建后图片路径稳定（Task 4: purge_all + 重提）

真实管线证明：不使用任何 mock；端点返回的字节来自 build_index 实际落盘的 PNG。
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager
from doclens.web_v2 import deps
from doclens.web_v2.app import create_app
from tests.conftest_image_fixtures import make_docx_with_image, make_pptx_with_image
from treesearch.parsers.image_store import doc_hash_for

# 合成 md 中图片内联语法的锚点
_IMG_MARK = "![图片 1]"
_ASSET_URL_FRAGMENT = "/api/preview/asset"
# markitdown 原始破损图片语法残渣（Task 3 的 re.sub 应已清除）
_MARKITDOWN_PICTURE_RESIDUE = "](Picture"


@pytest.fixture
def e2e_env(tmp_path: Path):
    """构造含 docx + pptx 图片的临时 KB，索引后注入 deps 单例。

    make_docx_with_image / make_pptx_with_image 各嵌入 1 张 PNG；
    load_or_build_index() 索引时 indexer 调用 ImageStore.extract_for_doc
    把图片落盘到 ``<index_path>.parent/images/<doc_hash>/<seq>.<ext>``。

    Yields:
        (client, mgr, docx_rel, pptx_rel, images_root)
    """
    workdir = tmp_path / "kb"
    workdir.mkdir()
    docx_rel = "报告.docx"
    pptx_rel = "演示.pptx"
    make_docx_with_image(str(workdir / docx_rel))
    make_pptx_with_image(str(workdir / pptx_rel))

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
    images_root = Path(mgr.index_path).parent / "images"
    yield client, mgr, docx_rel, pptx_rel, images_root
    deps.reset_singletons()


# ---------------------------------------------------------------------------
# docx 全链路
# ---------------------------------------------------------------------------

def test_docx_preview_contains_image_markdown(e2e_env):
    """docx 预览合成的 md 必须包含 ![图片 1](/api/preview/asset?...) 内联语法。"""
    client, _mgr, docx_rel, _pptx_rel, _root = e2e_env
    r = client.get("/api/preview", params={"path": docx_rel})
    assert r.status_code == 200
    body = r.json()
    assert body["language"] == "markdown"
    content = body["content"]
    assert _IMG_MARK in content, "docx 合成 md 缺少图片内联语法 ![图片 1]"
    assert _ASSET_URL_FRAGMENT in content, "docx 合成 md 缺少 asset 端点 URL"


def test_docx_asset_returns_real_image_bytes(e2e_env):
    """docx 图片端点返回 200 + image/* Content-Type + 非空字节。

    真实管线证明：先断言 PNG 已落盘，再断言端点读回的字节非空。
    """
    client, _mgr, docx_rel, _pptx_rel, images_root = e2e_env
    img_file = images_root / doc_hash_for(docx_rel) / "1.png"
    assert img_file.exists(), f"docx 图片未落盘: {img_file}"

    r = client.get("/api/preview/asset", params={"path": docx_rel, "id": 1})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/")
    assert len(r.content) > 0


# ---------------------------------------------------------------------------
# pptx 全链路
# ---------------------------------------------------------------------------

def test_pptx_preview_contains_image_markdown(e2e_env):
    """pptx 预览合成的 md 必须包含 ![图片 1](/api/preview/asset?...) 内联语法。"""
    client, _mgr, _docx_rel, pptx_rel, _root = e2e_env
    r = client.get("/api/preview", params={"path": pptx_rel})
    assert r.status_code == 200
    content = r.json()["content"]
    assert _IMG_MARK in content, "pptx 合成 md 缺少图片内联语法 ![图片 1]"
    assert _ASSET_URL_FRAGMENT in content, "pptx 合成 md 缺少 asset 端点 URL"


def test_pptx_preview_no_markitdown_picture_residue(e2e_env):
    """pptx 合成 md 不得残留 markitdown 的 ](Picture 破损语法（Task 3 清理）。"""
    client, _mgr, _docx_rel, pptx_rel, _root = e2e_env
    r = client.get("/api/preview", params={"path": pptx_rel})
    assert r.status_code == 200
    content = r.json()["content"]
    assert _MARKITDOWN_PICTURE_RESIDUE not in content, (
        "pptx md 残留 markitdown 破损图片语法 ](Picture"
    )


def test_pptx_asset_returns_real_image_bytes(e2e_env):
    """pptx 图片端点返回 200 + image/* Content-Type + 非空字节。"""
    client, _mgr, _docx_rel, pptx_rel, images_root = e2e_env
    img_file = images_root / doc_hash_for(pptx_rel) / "1.png"
    assert img_file.exists(), f"pptx 图片未落盘: {img_file}"

    r = client.get("/api/preview/asset", params={"path": pptx_rel, "id": 1})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/")
    assert len(r.content) > 0


# ---------------------------------------------------------------------------
# force 重建稳定性（Task 4: purge_all + 重提）
# ---------------------------------------------------------------------------

def test_force_rebuild_preserves_images(e2e_env):
    """force=True 全量重建（purge_all + 重提）后，docx/pptx 图片端点仍返回 200 + 字节。

    doc_hash = sha256(rel_path)[:12] 仅依赖相对路径，与索引内容无关，
    因此重建后图片落盘路径不变，端点仍可读回同一张图片。
    """
    client, mgr, docx_rel, pptx_rel, _root = e2e_env

    # 重建前：取基线字节
    before_docx = client.get(
        "/api/preview/asset", params={"path": docx_rel, "id": 1}
    )
    before_pptx = client.get(
        "/api/preview/asset", params={"path": pptx_rel, "id": 1}
    )
    assert before_docx.status_code == 200
    assert before_pptx.status_code == 200

    # force 全量重建：build_index(force=True) 先 purge_all 清空 images/，再重索引重提
    mgr.reindex(force=True)

    # 重建后：图片仍可访问，字节与基线一致（同一张 PNG 重提，内容不变）
    after_docx = client.get(
        "/api/preview/asset", params={"path": docx_rel, "id": 1}
    )
    after_pptx = client.get(
        "/api/preview/asset", params={"path": pptx_rel, "id": 1}
    )
    assert after_docx.status_code == 200
    assert after_pptx.status_code == 200
    assert after_docx.headers["content-type"].startswith("image/")
    assert after_pptx.headers["content-type"].startswith("image/")
    assert len(after_docx.content) > 0
    assert len(after_pptx.content) > 0
    assert after_docx.content == before_docx.content, (
        "docx 图片字节在 force 重建后不一致"
    )
    assert after_pptx.content == before_pptx.content, (
        "pptx 图片字节在 force 重建后不一致"
    )
