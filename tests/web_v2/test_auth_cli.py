"""`cortex auth reset` CLI 测试。"""
from argparse import Namespace
from pathlib import Path

import pytest

from doclens.cortex_cli import _cli_auth_reset
from doclens.web_v2 import auth_credentials
from doclens.web_v2.sessions_store import SessionsStore


@pytest.fixture
def global_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """把 auth_credentials 的全局目录（.env 所在）指向临时目录。"""
    d = tmp_path / "global"
    d.mkdir()
    monkeypatch.setattr(auth_credentials, "get_global_cortex_dir", lambda: d)
    return d


def test_reset_without_env_is_noop(global_dir: Path, env_cortex_config, capsys):
    _cli_auth_reset(Namespace(), None, None)
    assert "已清除访问密码，吊销 0 个登录会话" in capsys.readouterr().out


def test_reset_clears_password_and_sessions(
    global_dir: Path, temp_workdir: Path, env_cortex_config, capsys
):
    auth_credentials.set_password("123456")
    sessions_db = temp_workdir / ".cortex" / "sessions.db"
    sessions_db.parent.mkdir(parents=True, exist_ok=True)
    store = SessionsStore(sessions_db)
    store.create_auth_session()
    store.create_auth_session()

    _cli_auth_reset(Namespace(), None, None)
    out = capsys.readouterr().out
    assert "已清除访问密码，吊销 2 个登录会话" in out

    assert auth_credentials.has_password() is False
    assert SessionsStore(sessions_db).revoke_all_auth_sessions() == 0


def test_reset_idempotent(global_dir: Path, temp_workdir: Path, env_cortex_config, capsys):
    auth_credentials.set_password("123456")
    sessions_db = temp_workdir / ".cortex" / "sessions.db"
    sessions_db.parent.mkdir(parents=True, exist_ok=True)
    SessionsStore(sessions_db).create_auth_session()
    _cli_auth_reset(Namespace(), None, None)
    capsys.readouterr()
    # 第二次 reset：已无密码/会话，不报错
    _cli_auth_reset(Namespace(), None, None)
    assert "已清除访问密码，吊销 0 个登录会话" in capsys.readouterr().out
