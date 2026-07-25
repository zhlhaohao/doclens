"""auth_credentials 测试：密码哈希读写全局 .env。"""
from pathlib import Path

import pytest

from doclens.web_v2 import auth_credentials
from doclens.web_v2.auth_credentials import ENV_KEY


@pytest.fixture
def global_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """把全局目录指向临时目录（.env 在其下）。"""
    d = tmp_path / "global"
    d.mkdir()
    monkeypatch.setattr(auth_credentials, "get_global_cortex_dir", lambda: d)
    return d


def _env_text(d: Path) -> str:
    p = d / ".env"
    return p.read_text(encoding="utf-8") if p.exists() else ""


class TestPasswordLifecycle:
    def test_no_password_initially(self, global_dir):
        assert auth_credentials.has_password() is False
        assert auth_credentials.verify("123456") is False

    def test_set_writes_hash_to_env(self, global_dir):
        auth_credentials.set_password("123456")
        assert auth_credentials.has_password() is True
        text = _env_text(global_dir)
        assert ENV_KEY in text
        # 存的是哈希而不是明文
        assert "123456" not in text
        # 格式：iterations$salt$hash
        value = [l for l in text.splitlines() if l.startswith(ENV_KEY)][0].split("=", 1)[1]
        parts = value.split("$")
        assert len(parts) == 3
        assert parts[0].isdigit()

    def test_verify_roundtrip(self, global_dir):
        auth_credentials.set_password("123456")
        assert auth_credentials.verify("123456") is True
        assert auth_credentials.verify("000000") is False

    def test_set_invalid_format_raises(self, global_dir):
        with pytest.raises(ValueError):
            auth_credentials.set_password("12345")
        assert auth_credentials.has_password() is False

    def test_overwrite_password(self, global_dir):
        auth_credentials.set_password("111111")
        auth_credentials.set_password("222222")
        assert auth_credentials.verify("111111") is False
        assert auth_credentials.verify("222222") is True

    def test_clear_password(self, global_dir):
        auth_credentials.set_password("123456")
        auth_credentials.clear_password()
        assert auth_credentials.has_password() is False
        assert ENV_KEY not in _env_text(global_dir)

    def test_clear_idempotent_without_env(self, global_dir):
        auth_credentials.clear_password()  # .env 不存在也不报错
        assert auth_credentials.has_password() is False

    def test_preserves_other_env_keys(self, global_dir):
        (global_dir / ".env").write_text(
            "# 注释\nCORTEX_WEB_PORT=7860\n", encoding="utf-8"
        )
        auth_credentials.set_password("123456")
        text = _env_text(global_dir)
        assert "CORTEX_WEB_PORT=7860" in text
        assert "# 注释" in text
        auth_credentials.clear_password()
        text = _env_text(global_dir)
        assert "CORTEX_WEB_PORT=7860" in text

    def test_corrupt_value_treated_as_unset(self, global_dir):
        (global_dir / ".env").write_text(f"{ENV_KEY}=garbage\n", encoding="utf-8")
        assert auth_credentials.has_password() is False
        assert auth_credentials.verify("123456") is False
