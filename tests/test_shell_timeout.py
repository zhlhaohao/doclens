"""shell 工具超时配置契约（2026-09-18）：

- ``PLANIFY_SHELL_TIMEOUT`` 可调（默认 120 秒；非法/非正回落默认）；
- bash（Windows/Unix 两分支）与 powershell 统一消费同一配置；
- 超时文案带实际秒数 + 引导模型改用 background_run / check_background
  （而非反复重试同步命令）。
"""
import pytest

from planify.tools.basic import _find_bash_path, _shell_timeout, _timeout_message, run_bash


class TestShellTimeoutEnv:
    def test_default_120(self, monkeypatch):
        monkeypatch.delenv("PLANIFY_SHELL_TIMEOUT", raising=False)
        assert _shell_timeout() == 120

    @pytest.mark.parametrize("raw", ["300", " 60 ", "1"])
    def test_valid_env(self, monkeypatch, raw):
        monkeypatch.setenv("PLANIFY_SHELL_TIMEOUT", raw)
        assert _shell_timeout() == int(raw)

    @pytest.mark.parametrize("raw", ["", "abc", "12.5", "0", "-30"])
    def test_invalid_falls_back(self, monkeypatch, raw):
        monkeypatch.setenv("PLANIFY_SHELL_TIMEOUT", raw)
        assert _shell_timeout() == 120


class TestTimeoutMessage:
    def test_contains_seconds_and_background_guidance(self, monkeypatch):
        monkeypatch.setenv("PLANIFY_SHELL_TIMEOUT", "90")
        msg = _timeout_message()
        assert msg.startswith("Error: Timeout (90s)")
        assert "background_run" in msg
        assert "check_background" in msg


@pytest.mark.skipif(_find_bash_path() is None, reason="无 Git Bash（Windows 回退分支另行覆盖）")
class TestRunBashTimeoutPath:
    def test_timeout_returns_guidance(self, tmp_path, monkeypatch):
        """e2e：超时秒数来自 env（1s），命令 sleep 3 必超——返回引导文案。"""
        monkeypatch.setenv("PLANIFY_SHELL_TIMEOUT", "1")
        out = run_bash("sleep 3", tmp_path)
        assert out.startswith("Error: Timeout (1s)")
        assert "background_run" in out
