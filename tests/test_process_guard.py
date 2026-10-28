"""process_guard 自伤守卫测试。

覆盖 2026-10-28 事故的全部命令形态 + 正常操作不误伤。

身份模拟：monkeypatch process_guard._identity_pids / _identity_names
返回固定集合（不依赖真实进程拓扑，测试可移植）。
"""

import os

import pytest

from planify.tools import process_guard as pg
from planify.tools.basic import run_bash, run_powershell


ME = 33888
ANCESTORS = {100, 200}  # 模拟父链（pwsh → shell）
IDENTITY_PIDS = {ME, 100, 200}
IDENTITY_NAMES = {"python.exe", "python", "doclens.exe", "doclens", "pwsh.exe", "pwsh"}


@pytest.fixture(autouse=True)
def fixed_identity(monkeypatch):
    monkeypatch.setattr(pg, "_identity_pids", lambda: set(IDENTITY_PIDS))
    monkeypatch.setattr(pg, "_identity_names", lambda: set(IDENTITY_NAMES))
    # 文案里引用 os.getpid() 展示自身 PID——统一成 ME 便于断言
    monkeypatch.setattr(pg.os, "getpid", lambda: ME)
    monkeypatch.setattr(pg, "sys_executable", lambda: "C:/x/python.exe")


def allows(command):
    return pg.check_kill_command(command) is None


def blocks(command):
    msg = pg.check_kill_command(command)
    assert msg is not None, f"应拦截: {command}"
    return msg


# ---- 事故形态（必须全部拦截） ----


class TestAccidentForms:
    def test_stop_process_self(self):
        msg = blocks("Stop-Process -Id 33888 -Force")
        assert "33888" in msg

    def test_stop_process_ancestor(self):
        msg = blocks("Stop-Process -Id 100 -Force")
        assert "100" in msg

    def test_gitbash_task_pid(self):
        # Git Bash 双斜杠变体（事故第一次尝试）
        blocks("task //PID 33888 //F")

    def test_taskkill_pid_self(self):
        blocks("taskkill /PID 33888 /F")

    def test_taskkill_by_name(self):
        msg = blocks("taskkill /IM python.exe /F")
        assert "python" in msg

    def test_stop_process_name(self):
        msg = blocks("Stop-Process -Name python")
        assert "python" in msg

    def test_unix_kill_self(self):
        blocks("kill -9 33888")

    def test_kill_multiple_pids_including_self(self):
        blocks("kill 1234 33888")

    def test_piped_stop_process(self):
        # 管道投喂：无法核对目标 → 保守拒
        blocks("Get-Process python | Stop-Process -Force")

    def test_kill_command_substitution(self):
        blocks("kill $(pgrep -f doclens)")

    def test_pkill_f(self):
        # 按命令行模式杀，无法静态核对
        blocks("pkill -f doclens")

    def test_pkill_python(self):
        msg = blocks("pkill python")
        assert "python" in msg

    def test_stop_process_no_target(self):
        # 有语义无目标（读管道变体）→ 保守拒
        blocks("Get-Process x | Where-Object {$_.Id -gt 1} | Stop-Process")


# ---- 正常操作（必须放行） ----


class TestNormalOps:
    def test_kill_unrelated_pid(self):
        assert allows("kill -9 4242")

    def test_taskkill_unrelated(self):
        assert allows("taskkill /PID 4242 /F /T")

    def test_taskkill_notepad(self):
        assert allows("taskkill /IM notepad.exe /F")

    def test_stop_process_other(self):
        assert allows("Stop-Process -Id 5555")

    def test_no_kill_semantics(self):
        # 裸词 kill 不算语义（防 git commit -m "kill bug" 误伤）
        assert allows('git commit -m "kill the bug"')
        assert allows("echo skill killed the process")
        assert allows("ls -la")
        assert allows("")

    def test_killall_unrelated(self):
        assert allows("pkill -9 chrome")


# ---- 工具层集成（真实通道走到守卫） ----


class TestToolIntegration:
    def test_run_bash_blocked(self, tmp_path, monkeypatch):
        # run_bash 拦截发生在 spawn 之前——直接断言文案（身份用真实 getpid）
        real_getpid = os.getpid
        monkeypatch.setattr(pg.os, "getpid", lambda: real_getpid())
        msg = run_bash(f"kill -9 {real_getpid()}", tmp_path)
        assert msg.startswith("Error: 拒绝执行")
        assert str(real_getpid()) in msg

    def test_run_powershell_blocked(self, tmp_path):
        msg = run_powershell(f"Stop-Process -Id {os.getpid()} -Force", tmp_path)
        assert msg.startswith("Error: 拒绝执行")

    def test_run_bash_allows_normal(self, tmp_path):
        ret = run_bash("echo ok-process-guard", tmp_path)
        assert "ok-process-guard" in ret

    def test_background_manager_blocked(self, tmp_path):
        from planify.managers.background_manager import BackgroundManager

        bm = BackgroundManager(tmp_path)
        ret = bm.run(f"kill -9 {os.getpid()}")
        assert ret.startswith("Error: 拒绝执行")
        assert bm.tasks == {}, "拦截命令不得创建后台任务"


# ---- 文案质量：含身份与改法指引 ----


class TestMessageQuality:
    def test_self_message_has_pid_and_guidance(self):
        msg = blocks(f"Stop-Process -Id {ME} -Force")
        assert str(ME) in msg
        assert "重启" in msg or "核对" in msg
