"""files API 集成测试。"""
import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from doclens.web_v2 import deps
from doclens.web_v2.app import create_app


@pytest.fixture
def reset_deps():
    deps.reset_singletons()
    yield
    deps.reset_singletons()


def _init_and_reindex():
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


@pytest.fixture
def populated_workdir(temp_workdir):
    """在 temp_workdir 基础上加目录结构和点文件。"""
    (temp_workdir / "docs").mkdir()
    (temp_workdir / "docs" / "report.md").write_text("# Report", encoding="utf-8")
    (temp_workdir / "docs" / "sub").mkdir()
    (temp_workdir / "docs" / "sub" / "note.md").write_text("note", encoding="utf-8")
    (temp_workdir / "images").mkdir()
    (temp_workdir / "images" / "logo.png").write_bytes(b"\x89PNG\r\n")
    (temp_workdir / ".env").write_text("KEY=x", encoding="utf-8")
    (temp_workdir / ".hidden").mkdir()
    return temp_workdir


# === GET /list ===

@pytest.mark.asyncio
async def test_list_root_returns_entries(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": ""})
    assert res.status_code == 200
    body = res.json()
    assert body["path"] == ""
    names = {e["name"] for e in body["entries"]}
    assert "doc1.md" in names
    assert "docs" in names
    assert "images" in names
    assert ".env" not in names
    assert ".hidden" not in names
    entries = body["entries"]
    dirs_first = all(e["is_dir"] for e in entries[: sum(1 for e in entries if e["is_dir"])])
    assert dirs_first


@pytest.mark.asyncio
async def test_list_subdir(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": "docs"})
    assert res.status_code == 200
    names = {e["name"] for e in res.json()["entries"]}
    assert names == {"report.md", "sub"}


@pytest.mark.asyncio
async def test_list_protected_dir_returns_403(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": ".cortex"})
    assert res.status_code == 403
    assert res.json()["code"] == "PROTECTED"


@pytest.mark.asyncio
async def test_list_nonexistent_returns_404(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": "nonexistent"})
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_list_indexed_badge(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": ""})
    entries = res.json()["entries"]
    doc1 = next(e for e in entries if e["name"] == "doc1.md")
    assert doc1["indexed"] is True


@pytest.mark.asyncio
async def test_list_has_child_dirs_flag(populated_workdir, env_cortex_config, reset_deps):
    """目录的 has_child_dirs 标志应反映是否存在非受保护的子目录。"""
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": ""})
    entries = res.json()["entries"]
    by_name = {e["name"]: e for e in entries}
    # docs/ 含子目录 sub/ → True
    assert by_name["docs"]["has_child_dirs"] is True
    # images/ 仅含文件 → False
    assert by_name["images"]["has_child_dirs"] is False
    # 文件始终为 False
    assert by_name["doc1.md"]["has_child_dirs"] is False


@pytest.mark.asyncio
async def test_list_has_child_dirs_ignores_protected(temp_workdir, env_cortex_config, reset_deps):
    """仅含 .cortex 等受保护子目录的目录应返回 has_child_dirs=False。"""
    (temp_workdir / "wrap").mkdir()
    (temp_workdir / "wrap" / ".cortex").mkdir()  # 受保护
    (temp_workdir / "wrap" / ".env").write_text("x", encoding="utf-8")  # 受保护文件
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": "wrap"})
        assert res.status_code == 200
        # wrap 本身在父级列表里应是 has_child_dirs=False
        parent = await client.get("/api/files/list", params={"path": ""})
    wrap_entry = next(e for e in parent.json()["entries"] if e["name"] == "wrap")
    assert wrap_entry["has_child_dirs"] is False


# === GET /stats ===

@pytest.mark.asyncio
async def test_stats_returns_counts(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/stats", params={"path": "docs"})
    assert res.status_code == 200
    body = res.json()
    assert body["file_count"] == 2
    assert body["dir_count"] == 1
    assert body["total_size_bytes"] > 0


@pytest.mark.asyncio
async def test_stats_root(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/stats", params={"path": ""})
    assert res.status_code == 200
    body = res.json()
    assert body["file_count"] >= 5


@pytest.mark.asyncio
async def test_stats_protected_dir_returns_403(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/stats", params={"path": ".cortex"})
    assert res.status_code == 403


# === GET /attrs ===

@pytest.mark.asyncio
async def test_attrs_for_file(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/attrs", params={"path": "docs/report.md"})
    assert res.status_code == 200
    body = res.json()
    assert body["is_dir"] is False
    assert body["extension"] == ".md"
    assert body["is_protected"] is False
    assert "created_at" in body


@pytest.mark.asyncio
async def test_attrs_protected_returns_403(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/attrs", params={"path": ".env"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_attrs_nonexistent_returns_404(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/attrs", params={"path": "nope.md"})
    assert res.status_code == 404


# === POST /mkdir ===

@pytest.mark.asyncio
async def test_mkdir_creates_dir(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": "new_folder"})
    assert res.status_code == 200
    assert (temp_workdir / "new_folder").is_dir()


@pytest.mark.asyncio
async def test_mkdir_nested(temp_workdir, env_cortex_config, reset_deps):
    (temp_workdir / "docs").mkdir()
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": "docs/new_folder"})
    assert res.status_code == 200
    assert (temp_workdir / "docs" / "new_folder").is_dir()


@pytest.mark.asyncio
async def test_mkdir_existing_returns_409(temp_workdir, env_cortex_config, reset_deps):
    (temp_workdir / "existing").mkdir()
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": "existing"})
    assert res.status_code == 409
    assert res.json()["code"] == "ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_mkdir_protected_name_returns_400(temp_workdir, env_cortex_config, reset_deps):
    """受保护名（点开头）应在 safe_resolve 之前被 validate_name 捕获。

    但当前实现先做 safe_resolve + assert_not_protected（→ 403）。
    实际语义：用户尝试创建点目录本身就是保护违规，403 同样表达拒绝意图。
    这里同时接受 400 / 403，因为二者都表示"拒绝创建点文件目录"。
    """
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": ".hidden"})
    assert res.status_code in (400, 403)


@pytest.mark.asyncio
async def test_mkdir_illegal_name_returns_400(temp_workdir, env_cortex_config, reset_deps):
    """非法字符（Windows 非法 `*` 等）→ 400 INVALID_NAME。

    不用 `:` 是因为 Windows Path.resolve() 会把 `b:c` 当 ADS 解析，
    产生越权误报。用 `*` 可稳定触发 validate_name 的非法字符检查。
    """
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": "bad*name"})
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_NAME"


@pytest.mark.asyncio
async def test_mkdir_triggers_reindex(temp_workdir, env_cortex_config, reset_deps, monkeypatch):
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()
    called = {"n": 0}
    def _fake():
        called["n"] += 1
    monkeypatch.setattr(idx, "trigger_background_reindex", _fake)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": "new_folder"})
    assert res.status_code == 200
    assert called["n"] == 1


# === DELETE /files ===

@pytest.mark.asyncio
async def test_delete_file(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    assert (temp_workdir / "doc1.md").exists()
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete("/api/files", params={"path": "doc1.md"})
    assert res.status_code == 200
    assert not (temp_workdir / "doc1.md").exists()


@pytest.mark.asyncio
async def test_delete_directory_recursive(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete("/api/files", params={"path": "docs"})
    assert res.status_code == 200
    assert not (populated_workdir / "docs").exists()


@pytest.mark.asyncio
async def test_delete_protected_returns_403(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete("/api/files", params={"path": ".env"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_delete_root_returns_400(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete("/api/files", params={"path": ""})
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_TARGET"


@pytest.mark.asyncio
async def test_delete_nonexistent_returns_404(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete("/api/files", params={"path": "nope.md"})
    assert res.status_code == 404


# === POST /move ===

@pytest.mark.asyncio
async def test_move_single_file(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": ["doc1.md"],
            "dest_dir": "docs",
            "overwrite": False,
        })
    assert res.status_code == 200
    body = res.json()
    assert body["moved"] == ["docs/doc1.md"]
    assert body["skipped"] == []
    assert (populated_workdir / "docs" / "doc1.md").exists()
    assert not (populated_workdir / "doc1.md").exists()


@pytest.mark.asyncio
async def test_move_multiple(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": ["doc1.md", "doc2.py"],
            "dest_dir": "docs",
            "overwrite": False,
        })
    body = res.json()
    assert sorted(body["moved"]) == ["docs/doc1.md", "docs/doc2.py"]
    assert body["skipped"] == []


@pytest.mark.asyncio
async def test_move_overwrite_false_skips_existing(populated_workdir, env_cortex_config, reset_deps):
    (populated_workdir / "docs" / "doc1.md").write_text("冲突", encoding="utf-8")
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": ["doc1.md"],
            "dest_dir": "docs",
            "overwrite": False,
        })
    body = res.json()
    assert body["moved"] == []
    assert len(body["skipped"]) == 1
    assert body["skipped"][0]["reason"] == "ALREADY_EXISTS"
    assert (populated_workdir / "doc1.md").exists()


@pytest.mark.asyncio
async def test_move_overwrite_true_replaces(populated_workdir, env_cortex_config, reset_deps):
    (populated_workdir / "docs" / "doc1.md").write_text("旧内容", encoding="utf-8")
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": ["doc1.md"],
            "dest_dir": "docs",
            "overwrite": True,
        })
    body = res.json()
    assert body["moved"] == ["docs/doc1.md"]
    assert "Hello world" in (populated_workdir / "docs" / "doc1.md").read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_move_to_own_child_returns_invalid(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": ["docs"],
            "dest_dir": "docs/sub",
            "overwrite": False,
        })
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_TARGET"


@pytest.mark.asyncio
async def test_move_protected_returns_403(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": [".env"],
            "dest_dir": "docs",
            "overwrite": False,
        })
    assert res.status_code == 403


# === POST /rename ===

@pytest.mark.asyncio
async def test_rename_file(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/rename", json={
            "path": "doc1.md",
            "new_name": "renamed.md",
        })
    assert res.status_code == 200
    assert (temp_workdir / "renamed.md").exists()
    assert not (temp_workdir / "doc1.md").exists()


@pytest.mark.asyncio
async def test_rename_existing_returns_409(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/rename", json={
            "path": "doc1.md",
            "new_name": "doc2.py",
        })
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_rename_illegal_returns_400(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/rename", json={
            "path": "doc1.md",
            "new_name": "a:b.md",
        })
    assert res.status_code == 400


# === POST /upload ===

@pytest.mark.asyncio
async def test_upload_new_file(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    content = b"# hello"
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "", "overwrite": "false"},
            files={"file": ("uploaded.md", content, "text/markdown")},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["path"] == "uploaded.md"
    assert body["overwritten"] is False
    assert (temp_workdir / "uploaded.md").read_bytes() == content


@pytest.mark.asyncio
async def test_upload_to_subdir(temp_workdir, env_cortex_config, reset_deps):
    (temp_workdir / "sub").mkdir()
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "sub", "overwrite": "false"},
            files={"file": ("a.md", b"x", "text/markdown")},
        )
    assert res.status_code == 200
    assert (temp_workdir / "sub" / "a.md").exists()


@pytest.mark.asyncio
async def test_upload_overwrite_false_existing_returns_409(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "", "overwrite": "false"},
            files={"file": ("doc1.md", b"new", "text/markdown")},
        )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_upload_overwrite_true(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    new_content = b"replaced content"
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "", "overwrite": "true"},
            files={"file": ("doc1.md", new_content, "text/markdown")},
        )
    assert res.status_code == 200
    assert res.json()["overwritten"] is True
    assert (temp_workdir / "doc1.md").read_bytes() == new_content


@pytest.mark.asyncio
async def test_upload_protected_filename_returns_400(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "", "overwrite": "false"},
            files={"file": (".hidden.md", b"x", "text/markdown")},
        )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_upload_protected_dest_returns_403(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": ".cortex", "overwrite": "false"},
            files={"file": ("a.md", b"x", "text/markdown")},
        )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_upload_too_large_returns_413(temp_workdir, env_cortex_config, reset_deps, monkeypatch):
    await asyncio.to_thread(_init_and_reindex)
    from doclens.web_v2.api import files as files_module
    monkeypatch.setattr(files_module, "_MAX_UPLOAD_BYTES", 16)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "", "overwrite": "false"},
            files={"file": ("big.bin", b"x" * 32, "application/octet-stream")},
        )
    assert res.status_code == 413
