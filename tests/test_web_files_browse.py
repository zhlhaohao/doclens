# -*- coding: utf-8 -*-
"""ADR-0049 整机浏览：绝对路径只读通道的 API 级回归。

直接 asyncio.run 调路由函数 + monkeypatch get_index_manager（与
tests/test_web_search_api_matrix.py 同模式）。覆盖：
- /files/list 绝对路径：条目 path 为绝对规范形、indexed/writable 恒 False、
  点文件可见（2026-10-26 修订：物理视图全放开）；
- /files/drives：返回盘符清单（X:/ 形态）；
- /files/attrs 绝对路径：外部只读语义；
- /preview 绝对路径：文本直读（writable=False）、二进制 422
  OUTSIDE_WORKDIR_PREVIEW、PDF 轻量标记、不存在 404；
- /preview/download 绝对路径：字节直读 + hash6 文件名；
- /preview/pdf 绝对路径：application/pdf 直读；
- 写端点（mkdir/create/delete/move/rename/upload）拒绝绝对路径 400。
"""
import asyncio
from pathlib import Path

import pytest

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager
from doclens.web_v2.api import files as files_api
from doclens.web_v2.api import preview as preview_api
from doclens.web_v2.api import preview_assets as preview_assets_api
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.models.files import (
    CreateFileRequest,
    MkdirRequest,
    MoveRequest,
    RenameRequest,
)


@pytest.fixture()
def idx(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """最小可用的 IndexManager stub：workdir = tmp_path/kb。"""
    kb = tmp_path / "kb"
    kb.mkdir()
    (kb / "inside.md").write_text("# inside", encoding="utf-8")

    mgr = IndexManager.__new__(IndexManager)
    mgr.search_path = str(kb)
    mgr.index_path = str(tmp_path / "index.db")
    mgr._config = CortexConfig()
    mgr._ts = None
    mgr._needs_reload = False
    mgr._building = False
    mgr._startup_audit_done = True
    mgr._last_failed_count = 0
    mgr._sync_image_version_expectation = lambda: None
    mgr._path_map = {}
    import threading
    mgr._build_cond = threading.Condition()
    mgr._reindex_lock = threading.Lock()

    monkeypatch.setattr(files_api, "get_index_manager", lambda: mgr)
    monkeypatch.setattr(preview_api, "get_index_manager", lambda: mgr)
    monkeypatch.setattr(preview_assets_api, "get_index_manager", lambda: mgr)
    return mgr


# ---------------------------------------------------------------------------
# 路径判定单源（files_browse）
# ---------------------------------------------------------------------------

def test_is_absolute_browse_path():
    from doclens.web_v2.api.files_browse import is_absolute_browse_path

    assert is_absolute_browse_path("D:/资料")
    assert is_absolute_browse_path("D:\\资料")
    assert is_absolute_browse_path("//server/share")
    assert not is_absolute_browse_path("a/b")
    assert not is_absolute_browse_path("")
    assert not is_absolute_browse_path("~drives")


def test_normalize_browse_path():
    from doclens.web_v2.api.files_browse import normalize_browse_path

    assert normalize_browse_path("D:\\a\\b") == "D:/a/b"
    assert normalize_browse_path("a/b") == "a/b"


# ---------------------------------------------------------------------------
# /files/list 绝对路径
# ---------------------------------------------------------------------------

def test_list_outside_dir(idx, tmp_path: Path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "x.md").write_text("x", encoding="utf-8")
    (outside / "sub").mkdir()
    (outside / ".hidden").write_text("h", encoding="utf-8")
    (outside / "$RECYCLE.BIN").mkdir()

    resp = asyncio.run(files_api.list_dir(path=str(outside).replace("\\", "/"), limit=200, offset=0, idx=idx))
    names = [e.name for e in resp.entries]
    # 2026-10-26（ADR-0049 修订）：点文件与 $ 系统目录**全部可见**——
    # 文件页 = 纯物理目录视图（用户决议完全放开）；目录在前排序
    assert names == ["$RECYCLE.BIN", "sub", ".hidden", "x.md"]
    x = next(e for e in resp.entries if e.name == "x.md")
    assert x.path == f"{str(outside).replace(chr(92), '/')}/x.md"
    assert x.indexed is False
    assert x.registered is False
    assert x.writable is False
    assert resp.path == str(outside).replace("\\", "/")


def test_list_outside_not_found(idx, tmp_path: Path):
    with pytest.raises(CortexAPIError) as ei:
        asyncio.run(files_api.list_dir(
            path=str(tmp_path / "nope").replace("\\", "/"), idx=idx))
    assert ei.value.status == 404


# ---------------------------------------------------------------------------
# /files/drives
# ---------------------------------------------------------------------------

def test_drives_endpoint_shape():
    resp = asyncio.run(files_api.list_drives())
    drives = resp["drives"]
    assert isinstance(drives, list)
    for d in drives:
        assert len(d) == 3 and d[1] == ":" and d[2] == "/"  # "X:/" 形态
    if drives:
        assert drives == sorted(drives)
    # home（快速跳转目标）：非空且正斜杠形态
    home = resp.get("home", "")
    if home:
        assert "/" in home and "\\" not in home


# ---------------------------------------------------------------------------
# /files/attrs 绝对路径
# ---------------------------------------------------------------------------

def test_attrs_outside_file(idx, tmp_path: Path):
    f = tmp_path / "outside" / "note.md"
    f.parent.mkdir()
    f.write_text("hello", encoding="utf-8")
    resp = asyncio.run(files_api.attrs(path=str(f).replace("\\", "/"), idx=idx))
    assert resp.name == "note.md"
    assert resp.writable is False
    assert resp.indexed is False
    assert resp.registered is False
    assert resp.path == str(f).replace("\\", "/")


# ---------------------------------------------------------------------------
# /preview 绝对路径
# ---------------------------------------------------------------------------

def test_preview_outside_text(idx, tmp_path: Path):
    f = tmp_path / "outside" / "code.py"
    f.parent.mkdir()
    f.write_text("print('hi')\n", encoding="utf-8")
    resp = preview_api.preview(path=str(f).replace("\\", "/"), idx=idx)
    assert resp.language == "python"
    assert resp.content == "print('hi')\n"
    assert resp.writable is False
    assert resp.synthesized is False


def test_preview_outside_binary_422(idx, tmp_path: Path):
    f = tmp_path / "outside" / "doc.docx"
    f.parent.mkdir()
    f.write_bytes(b"PK\x03\x04")
    with pytest.raises(CortexAPIError) as ei:
        preview_api.preview(path=str(f).replace("\\", "/"), idx=idx)
    assert ei.value.status == 422
    assert "OUTSIDE_WORKDIR_PREVIEW" in str(ei.value.detail) or \
        getattr(ei.value, "code", "") == "OUTSIDE_WORKDIR_PREVIEW"


def test_preview_outside_pdf_marker(idx, tmp_path: Path):
    f = tmp_path / "outside" / "paper.pdf"
    f.parent.mkdir()
    f.write_bytes(b"%PDF-1.4 fake")
    resp = preview_api.preview(path=str(f).replace("\\", "/"), idx=idx)
    assert resp.language == "pdf"
    assert resp.content == ""
    assert resp.writable is False
    assert resp.page_starts is None


def test_preview_outside_image_shows_original(idx, tmp_path: Path):
    """ADR-0049：外部图像原图直读（不依赖索引）——单行 md 内嵌 raw URL。"""
    f = tmp_path / "outside" / "photo.jpg"
    f.parent.mkdir()
    f.write_bytes(b"\xff\xd8\xff\xe0 fake jpeg")
    resp = preview_api.preview(path=str(f).replace("\\", "/"), idx=idx)
    assert resp.language == "markdown"
    assert "preview/raw?path=" in resp.content
    assert "![原图]" in resp.content
    assert resp.writable is False
    # raw URL 里的 path 参数是绝对路径（被 quote 过，但 quote safe='' 下
    # 盘符冒号被编码也仍可反查回来）
    assert resp.path == str(f).replace("\\", "/")


def test_preview_raw_outside_bytes(idx, tmp_path: Path):
    """外部图像字节端点：直读原图字节。"""
    from fastapi.responses import FileResponse

    f = tmp_path / "outside" / "pic.png"
    f.parent.mkdir()
    f.write_bytes(b"\x89PNG fake")
    resp = preview_assets_api.preview_raw(
        path=str(f).replace("\\", "/"), idx=idx)
    assert isinstance(resp, FileResponse)
    assert Path(str(resp.path)) == f


def test_preview_outside_pst_422(idx, tmp_path: Path):
    f = tmp_path / "outside" / "archive.pst"
    f.parent.mkdir()
    f.write_bytes(b"\x00" * 64)
    with pytest.raises(CortexAPIError) as ei:
        preview_api.preview(path=str(f).replace("\\", "/"), idx=idx)
    assert ei.value.status == 422


def test_preview_outside_missing_404(idx, tmp_path: Path):
    with pytest.raises(CortexAPIError) as ei:
        preview_api.preview(
            path=str(tmp_path / "gone.md").replace("\\", "/"), idx=idx)
    assert ei.value.status == 404


# ---------------------------------------------------------------------------
# /preview/download + /preview/pdf 绝对路径
# ---------------------------------------------------------------------------

def test_download_outside_file(idx, tmp_path: Path):
    from fastapi.responses import FileResponse

    f = tmp_path / "outside" / "take.txt"
    f.parent.mkdir()
    f.write_text("data", encoding="utf-8")
    resp = preview_assets_api.download(
        path=str(f).replace("\\", "/"), idx=idx)
    assert isinstance(resp, FileResponse)
    assert Path(str(resp.path)) == f
    # hash6 文件名后缀
    assert "_" in (resp.filename or "")
    parts = (resp.filename or "").rsplit("_", 1)
    assert len(parts[-1].split(".")[0]) == 6


def test_preview_pdf_outside_bytes(idx, tmp_path: Path):
    from fastapi.responses import FileResponse

    f = tmp_path / "outside" / "p.pdf"
    f.parent.mkdir()
    f.write_bytes(b"%PDF-1.4 bytes")
    resp = preview_assets_api.preview_pdf(
        path=str(f).replace("\\", "/"), idx=idx)
    assert isinstance(resp, FileResponse)
    assert Path(str(resp.path)) == f


# ---------------------------------------------------------------------------
# 写端点拒绝绝对路径（ADR-0049：浏览自由，写入以 workdir 为界）
# ---------------------------------------------------------------------------

def test_write_endpoints_reject_absolute(idx, tmp_path: Path):
    abs_path = str(tmp_path / "outside" / "x").replace("\\", "/")

    with pytest.raises(CortexAPIError) as e1:
        asyncio.run(files_api.mkdir(MkdirRequest(path=abs_path), idx=idx))
    assert e1.value.status == 400

    with pytest.raises(CortexAPIError) as e2:
        asyncio.run(files_api.create_file(CreateFileRequest(path=abs_path), idx=idx))
    assert e2.value.status == 400

    with pytest.raises(CortexAPIError) as e3:
        asyncio.run(files_api.delete(path=abs_path, idx=idx))
    assert e3.value.status == 400

    with pytest.raises(CortexAPIError) as e4:
        asyncio.run(files_api.move(
            MoveRequest(from_paths=[abs_path], dest_dir="."), idx=idx))
    assert e4.value.status == 400

    with pytest.raises(CortexAPIError) as e5:
        asyncio.run(files_api.rename(
            RenameRequest(path=abs_path, new_name="y"), idx=idx))
    assert e5.value.status == 400


def test_workdir_relative_still_works(idx, tmp_path: Path):
    """相对路径现状回归：list 根目录照常。"""
    resp = asyncio.run(files_api.list_dir(path="", limit=200, offset=0, idx=idx))
    names = [e.name for e in resp.entries]
    assert "inside.md" in names
    inside = next(e for e in resp.entries if e.name == "inside.md")
    assert inside.path == "inside.md"  # 相对形态不变
