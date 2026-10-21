# -*- coding: utf-8 -*-
"""中间件洋葱顺序（AP-33）：auth 必须在外层，401 优先于 swap 503。

Starlette ``add_middleware`` 是 ``user_middleware.insert(0, ...)``——**后注册者
在最外层、先执行**。原实现按「后注册 = 内层」的注释顺序注册，实际相反：
切换窗口内未登录 LAN 客户端拿到 503（响应体还带目标目录 target），
401 永不出现。
"""
import pytest

from doclens.web_v2 import auth_credentials, deps


@pytest.fixture()
def gate_on(tmp_path, monkeypatch):
    """闸门生效（已设密码）+ TestClient 来源非环回（"testclient"）。"""
    monkeypatch.setattr(auth_credentials, "_env_path", lambda: tmp_path / ".env")
    auth_credentials.set_password("123456")
    yield
    auth_credentials.clear_password()


class _FakeStore:
    def __init__(self, valid: bool):
        self._valid = valid

    def validate_auth_session(self, token, *, touch=True, ttl_hours, now=None):
        return self._valid


def _client(monkeypatch, *, swapping: bool, session_valid: bool | None):
    from fastapi.testclient import TestClient

    from doclens.web_v2.app import create_app

    monkeypatch.setattr(
        deps, "_swap_state",
        deps._SwapState(swapping=swapping, target="D:/next-kb" if swapping else None),
    )
    if session_valid is not None:
        monkeypatch.setattr(deps, "get_sessions_store", lambda: _FakeStore(session_valid))
    return TestClient(create_app())


def test_unauthenticated_beats_swap_window(gate_on, monkeypatch):
    """未登录 + 切换中 → 401（不是 503，也不得泄露 target）。"""
    c = _client(monkeypatch, swapping=True, session_valid=False)
    r = c.get("/api/search")
    assert r.status_code == 401, r.text
    assert r.json()["code"] == "UNAUTHORIZED"
    assert "next-kb" not in r.text


def test_authenticated_still_sees_swap_503(gate_on, monkeypatch):
    """已登录 + 切换中 → 503（swap 闸门仍在，只是退到 auth 内层）。"""
    c = _client(monkeypatch, swapping=True, session_valid=True)
    r = c.get("/api/search", cookies={"cortex_auth": "tok"})
    assert r.status_code == 503, r.text
    assert r.json()["code"] == "WORKDIR_SWAPPING"


def test_registration_puts_auth_outermost(monkeypatch):
    """结构不变量：user_middleware[0] 是最外层（Starlette 反向包装），必须是 auth。"""
    from doclens.web_v2.app import create_app

    app = create_app()
    names = [m.kwargs["dispatch"].__name__ for m in app.user_middleware]
    assert names[:2] == ["auth_gate", "swap_gate"], names
