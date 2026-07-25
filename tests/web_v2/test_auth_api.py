"""/api/auth/* + 登录闸门中间件测试。

用 create_app(host="0.0.0.0") 模拟非环回绑定；deps.get_sessions_store 指向 tmp 库；
auth_credentials 的全局 .env 指向 tmp 目录；LOGIN_DELAY_S monkeypatch 为 0；
每个测试用独立的 LoginRateLimiter。
app 上额外注册 /api/probe 端点用于验证闸门行为（不依赖 IndexManager）。
"""
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from doclens.web_v2 import auth_credentials, deps
from doclens.web_v2.api import auth as auth_api
from doclens.web_v2.app import create_app
from doclens.web_v2.auth_gate import COOKIE_NAME
from doclens.web_v2.auth_rate_limit import MAX_FAILURES, LoginRateLimiter
from doclens.web_v2.sessions_store import SessionsStore

PASSWORD = "123456"


@pytest.fixture
def store(tmp_path: Path) -> SessionsStore:
    return SessionsStore(tmp_path / "sessions.db")


@pytest.fixture
def limiter() -> LoginRateLimiter:
    return LoginRateLimiter()


@pytest.fixture
def global_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """auth_credentials 的全局 .env 指向临时目录。"""
    d = tmp_path / "global"
    d.mkdir()
    monkeypatch.setattr(auth_credentials, "get_global_cortex_dir", lambda: d)
    return d


@pytest.fixture
def patched(
    store: SessionsStore,
    limiter: LoginRateLimiter,
    global_dir: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(deps, "get_sessions_store", lambda: store)
    monkeypatch.setattr(auth_api, "get_rate_limiter", lambda: limiter)
    monkeypatch.setattr(auth_api, "LOGIN_DELAY_S", 0)
    yield auth_credentials


def _make_app(host: str = "0.0.0.0"):
    app = create_app(host=host)

    @app.get("/api/probe")
    async def probe():
        return {"ok": True}

    return app


def _client(app) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _login(client: AsyncClient, password: str = PASSWORD):
    return await client.post("/api/auth/login", json={"password": password})


class TestGateOff:
    """闸门未生效的场景：一律免登录。"""

    @pytest.mark.asyncio
    async def test_loopback_never_gated_even_with_password(self, patched):
        patched.set_password(PASSWORD)
        app = _make_app(host="127.0.0.1")
        async with _client(app) as client:
            assert (await client.get("/api/probe")).status_code == 200

    @pytest.mark.asyncio
    async def test_non_loopback_without_password_not_gated(self, patched):
        app = _make_app(host="0.0.0.0")
        async with _client(app) as client:
            assert (await client.get("/api/probe")).status_code == 200
            res = await client.get("/api/auth/status")
            assert res.json() == {"required": False, "authenticated": True, "has_password": False}


class TestGateOn:
    @pytest.mark.asyncio
    async def test_api_requires_login(self, patched):
        patched.set_password(PASSWORD)
        app = _make_app()
        async with _client(app) as client:
            res = await client.get("/api/probe")
            assert res.status_code == 401
            assert res.json()["code"] == "UNAUTHORIZED"

    @pytest.mark.asyncio
    async def test_exempt_paths(self, patched):
        patched.set_password(PASSWORD)
        app = _make_app()
        async with _client(app) as client:
            assert (await client.get("/api/health")).status_code == 200
            res = await client.get("/api/auth/status")
            assert res.status_code == 200
            assert res.json() == {"required": True, "authenticated": False, "has_password": True}

    @pytest.mark.asyncio
    async def test_spa_fallback_not_gated(self, patched):
        """非 /api 路径（登录页本身）必须放行。"""
        patched.set_password(PASSWORD)
        app = _make_app()
        async with _client(app) as client:
            res = await client.get("/")
            assert res.status_code != 401

    @pytest.mark.asyncio
    async def test_login_success_sets_cookie_and_unlocks(self, patched):
        patched.set_password(PASSWORD)
        app = _make_app()
        async with _client(app) as client:
            res = await _login(client)
            assert res.status_code == 200
            cookie = res.headers["set-cookie"]
            assert COOKIE_NAME in cookie
            assert "HttpOnly" in cookie
            assert "samesite=strict" in cookie.lower()
            assert "Max-Age=86400" in cookie

            # 带 cookie 访问 → 200，且响应刷新 cookie（滑动续期）
            res = await client.get("/api/probe")
            assert res.status_code == 200
            assert COOKIE_NAME in res.headers.get("set-cookie", "")

            # status 显示已认证
            res = await client.get("/api/auth/status")
            assert res.json()["authenticated"] is True

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, patched):
        patched.set_password(PASSWORD)
        app = _make_app()
        async with _client(app) as client:
            res = await _login(client, "000000")
            assert res.status_code == 401
            assert res.json()["code"] == "INVALID_PASSWORD"

    @pytest.mark.asyncio
    async def test_rate_limit_locks_after_max_failures(self, patched):
        patched.set_password(PASSWORD)
        app = _make_app()
        async with _client(app) as client:
            for _ in range(MAX_FAILURES - 1):
                assert (await _login(client, "000000")).status_code == 401
            # 第 5 次失败触发锁定
            res = await _login(client, "000000")
            assert res.status_code == 429
            assert res.json()["code"] == "AUTH_LOCKED"
            assert res.json()["retry_after"] > 0
            # 锁定期间正确密码也 429
            res = await _login(client)
            assert res.status_code == 429

    @pytest.mark.asyncio
    async def test_logout_invalidates_session(self, patched):
        patched.set_password(PASSWORD)
        app = _make_app()
        async with _client(app) as client:
            await _login(client)
            assert (await client.get("/api/probe")).status_code == 200
            res = await client.post("/api/auth/logout")
            assert res.status_code == 200
            assert (await client.get("/api/probe")).status_code == 401


class TestPasswordManagement:
    @pytest.mark.asyncio
    async def test_set_password_first_time(self, patched):
        """首次设置无需旧密码（环回场景，闸门未生效）。"""
        app = _make_app(host="127.0.0.1")
        async with _client(app) as client:
            res = await client.put("/api/auth/password", json={"new_password": PASSWORD})
            assert res.status_code == 200
            assert patched.has_password() is True

    @pytest.mark.asyncio
    async def test_set_password_invalid_format(self, patched):
        app = _make_app(host="127.0.0.1")
        async with _client(app) as client:
            res = await client.put("/api/auth/password", json={"new_password": "12345"})
            assert res.status_code == 400
            assert res.json()["code"] == "INVALID_PASSWORD_FORMAT"

    @pytest.mark.asyncio
    async def test_change_password_requires_old(self, patched):
        patched.set_password(PASSWORD)
        app = _make_app()
        async with _client(app) as client:
            await _login(client)
            # 缺旧密码
            res = await client.put("/api/auth/password", json={"new_password": "222222"})
            assert res.status_code == 401
            # 旧密码错误
            res = await client.put(
                "/api/auth/password",
                json={"old_password": "000000", "new_password": "222222"},
            )
            assert res.status_code == 401
            assert res.json()["code"] == "INVALID_PASSWORD"

    @pytest.mark.asyncio
    async def test_change_password_revokes_other_sessions(self, patched):
        """改密后：其他设备会话被吊销，操作者重签新会话不掉线。"""
        patched.set_password(PASSWORD)
        app = _make_app()
        async with _client(app) as operator, _client(app) as other:
            await _login(operator)
            await _login(other)
            assert (await other.get("/api/probe")).status_code == 200

            res = await operator.put(
                "/api/auth/password",
                json={"old_password": PASSWORD, "new_password": "222222"},
            )
            assert res.status_code == 200
            assert patched.verify("222222") is True

            # 操作者拿到新 cookie，不掉线
            assert (await operator.get("/api/probe")).status_code == 200
            # 其他设备旧会话被吊销
            assert (await other.get("/api/probe")).status_code == 401

    @pytest.mark.asyncio
    async def test_change_password_requires_session_when_gated(self, patched):
        patched.set_password(PASSWORD)
        app = _make_app()
        async with _client(app) as client:
            res = await client.put(
                "/api/auth/password",
                json={"old_password": PASSWORD, "new_password": "222222"},
            )
            assert res.status_code == 401
            assert res.json()["code"] == "UNAUTHORIZED"

    @pytest.mark.asyncio
    async def test_clear_password(self, patched):
        patched.set_password(PASSWORD)
        app = _make_app()
        async with _client(app) as client:
            await _login(client)
            # 密码错误
            res = await client.request(
                "DELETE", "/api/auth/password", json={"password": "000000"}
            )
            assert res.status_code == 401
            # 正确清除
            res = await client.request(
                "DELETE", "/api/auth/password", json={"password": PASSWORD}
            )
            assert res.status_code == 200
            assert patched.has_password() is False
            # 闸门关闭：免登录
            assert (await client.get("/api/probe")).status_code == 200

    @pytest.mark.asyncio
    async def test_clear_password_when_none_set(self, patched):
        app = _make_app(host="127.0.0.1")
        async with _client(app) as client:
            res = await client.request(
                "DELETE", "/api/auth/password", json={"password": PASSWORD}
            )
            assert res.status_code == 400
            assert res.json()["code"] == "NO_PASSWORD_SET"
