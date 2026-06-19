"""/api/sessions CRUD 测试。"""
from datetime import datetime, timezone
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.app import create_app
from cortex.web_v2.sessions_store import SessionType, SessionsStore


@pytest.fixture
def patched_store(monkeypatch, tmp_path):
    """用临时 db 替换全局 store。"""
    store = SessionsStore(tmp_path / "sessions.db")
    import cortex.web_v2.api.sessions as mod
    monkeypatch.setattr(mod, "_get_store", lambda: store)
    return store


@pytest.mark.asyncio
async def test_create_session_returns_id(patched_store):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/sessions", json={
            "type": "chat",
            "title": "test chat",
            "preview": "hello",
        })
    assert res.status_code == 200
    body = res.json()
    assert "id" in body
    assert body["title"] == "test chat"


@pytest.mark.asyncio
async def test_list_sessions_filter_by_type(patched_store):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/sessions", json={"type": "chat", "title": "c1", "preview": "p"})
        await client.post("/api/sessions", json={"type": "search", "title": "s1", "preview": "p"})
        res = await client.get("/api/sessions", params={"type": "chat"})
    assert res.status_code == 200
    body = res.json()
    assert len(body["sessions"]) == 1
    assert body["returned"] == 1
    assert body["sessions"][0]["title"] == "c1"


@pytest.mark.asyncio
async def test_delete_session(patched_store):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_res = await client.post("/api/sessions", json={
            "type": "chat", "title": "to-delete", "preview": "p",
        })
        sid = create_res.json()["id"]
        del_res = await client.delete(f"/api/sessions/{sid}")
    assert del_res.status_code == 200
    assert del_res.json()["ok"] is True


@pytest.mark.asyncio
async def test_clear_sessions_by_type(patched_store):
    """DELETE /sessions?type=search 清空 search 类型，不影响 chat。"""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 建两个 search + 一个 chat 会话
        s1 = await client.post("/api/sessions", json={"type": "search", "title": "s1"})
        s2 = await client.post("/api/sessions", json={"type": "search", "title": "s2"})
        c1 = await client.post("/api/sessions", json={"type": "chat", "title": "c1"})
        assert s1.status_code == 200 and s2.status_code == 200 and c1.status_code == 200

        # 清空 search
        res = await client.delete("/api/sessions", params={"type": "search"})
        assert res.status_code == 200
        body = res.json()
        assert body["ok"] is True
        assert body["deleted_count"] == 2

        # search 应空，chat 不变
        after_s = await client.get("/api/sessions", params={"type": "search"})
        assert after_s.json()["returned"] == 0
        after_c = await client.get("/api/sessions", params={"type": "chat"})
        assert after_c.json()["returned"] == 1


@pytest.mark.asyncio
async def test_clear_sessions_all_when_no_type(patched_store):
    """DELETE /sessions（不带 type）清空所有。"""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/sessions", json={"type": "search", "title": "s"})
        await client.post("/api/sessions", json={"type": "chat", "title": "c"})

        res = await client.delete("/api/sessions")
        assert res.status_code == 200
        assert res.json()["deleted_count"] == 2

        all_list = await client.get("/api/sessions")
        assert all_list.json()["returned"] == 0


@pytest.mark.asyncio
async def test_sessions_db_follows_workdir(temp_workdir, env_cortex_config, monkeypatch):
    """sessions.db 必须跟随工作目录（与 index.db 同目录），不能写到全局 ~/.cortex/。

    防止回归：之前 _get_store 用 get_global_cortex_dir() 导致不同工作目录的
    会话互相串扰。修复后应与 IndexManager.index_path 同目录。
    """
    import asyncio
    from cortex.web_v2 import deps
    import cortex.web_v2.api.sessions as sessions_mod
    deps.reset_singletons()
    monkeypatch.setattr(sessions_mod, "_store", None)

    try:
        # _get_store 内部会触发 IndexManager.load_or_build_index（同步阻塞），
        # 必须丢到子线程跑避免 pytest-asyncio 事件循环冲突。
        store = await asyncio.to_thread(sessions_mod._get_store)

        # 期望路径：{temp_workdir}/.cortex/sessions.db（与 index.db 同目录）
        expected_path = temp_workdir / ".cortex" / "sessions.db"
        assert Path(store._db_path).resolve() == expected_path.resolve(), (
            f"sessions.db 路径错误：期望 {expected_path}，实际 {store._db_path}"
        )
    finally:
        deps.reset_singletons()
