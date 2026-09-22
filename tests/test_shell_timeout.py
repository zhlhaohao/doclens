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


class TestShellAuditLog:
    """审计契约：bash/powershell 的 call/result 以 INFO 落盘（供审计），
    换行压平、超长截断；危险拦截同样有 call + result 记录。"""

    def test_call_and_result_logged_info(self, tmp_path, caplog):
        import logging
        with caplog.at_level(logging.INFO, logger="planify.tools.basic"):
            out = run_bash("echo audit-test", tmp_path)
        assert "audit-test" in out
        calls = [r for r in caplog.records if r.getMessage().startswith("[audit][bash] call")]
        results = [r for r in caplog.records if r.getMessage().startswith("[audit][bash] result")]
        assert len(calls) == 1 and "echo audit-test" in calls[0].getMessage()
        assert calls[0].levelname == "INFO"
        assert len(results) == 1 and "audit-test" in results[0].getMessage()
        assert results[0].levelname == "INFO"

    def test_multiline_result_flattened(self, tmp_path, caplog):
        import logging
        with caplog.at_level(logging.INFO, logger="planify.tools.basic"):
            run_bash("echo line1 && echo line2", tmp_path)
        results = [r for r in caplog.records if r.getMessage().startswith("[audit][bash] result")]
        assert len(results) == 1
        msg = results[0].getMessage()
        assert "\nline2" not in msg, "日志记录内不得有真实换行"
        assert "line1" in msg and "line2" in msg

    def test_dangerous_block_still_audited(self, tmp_path, caplog):
        import logging
        with caplog.at_level(logging.INFO, logger="planify.tools.basic"):
            out = run_bash("rm -rf /", tmp_path)
        assert "Dangerous" in out
        results = [r for r in caplog.records if r.getMessage().startswith("[audit][bash] result")]
        assert len(results) == 1 and "Dangerous" in results[0].getMessage()


class TestBackgroundAuditLog:
    """审计契约：后台命令（BackgroundManager）与同步 shell 同口径——
    call/result INFO 落盘，task ID 串联，完成/异常统一汇聚出口。"""

    def test_bg_call_and_result_logged(self, tmp_path, caplog):
        import logging
        from planify.managers.background_manager import BackgroundManager
        with caplog.at_level(logging.INFO, logger="planify.managers.background_manager"):
            bm = BackgroundManager(tmp_path)
            bm.run("echo bg-audit")
            note = bm.notifications.get(timeout=10)
        assert note["status"] == "completed"
        calls = [r for r in caplog.records if r.getMessage().startswith("[audit][background] call")]
        results = [r for r in caplog.records if r.getMessage().startswith("[audit][background] result")]
        assert len(calls) == 1 and "echo bg-audit" in calls[0].getMessage()
        assert len(results) == 1
        msg = results[0].getMessage()
        assert "status=completed" in msg and "bg-audit" in msg
        # task ID 两行串联
        tid = calls[0].getMessage().split("task=")[1].split(" ")[0]
        assert f"task={tid}" in msg

    def test_bg_error_path_audited(self, tmp_path, caplog):
        import logging
        from planify.managers.background_manager import BackgroundManager
        with caplog.at_level(logging.INFO, logger="planify.managers.background_manager"):
            bm = BackgroundManager(tmp_path)
            bm.run("exit 3", timeout=10)
            bm.notifications.get(timeout=10)
        results = [r for r in caplog.records if r.getMessage().startswith("[audit][background] result")]
        assert len(results) == 1

    def test_bg_dangerous_blocked_same_as_sync(self, tmp_path, caplog):
        """后台命令接入同一危险过滤：拦截返回同步工具同款文案，不建任务，
        审计完整（call + result status=blocked）。"""
        import logging
        from planify.managers.background_manager import BackgroundManager
        with caplog.at_level(logging.INFO, logger="planify.managers.background_manager"):
            bm = BackgroundManager(tmp_path)
            ret = bm.run("sudo rm -rf /")
        assert ret == "Error: Dangerous command blocked"
        assert bm.tasks == {}, "危险命令不得创建后台任务"
        results = [r for r in caplog.records if r.getMessage().startswith("[audit][background] result")]
        assert len(results) == 1 and "status=blocked" in results[0].getMessage()
