"""shell 工具进程树击杀与会话级登记测试（2026-10-05 事故回归）。

事故：模型误跑 ``playwright run-server``（常驻服务器永不退出）。
subprocess.run(timeout=) 超时只杀直接子进程 sh.exe，孙进程 node.exe
持有 stdout 管道写端 → communicate() 排空管道永久阻塞 → 工具线程挂死、
「停止」无效（中断检查点在 LLM 流式循环，永远到不了）。

修复后必须满足：
1. 超时击杀**整个进程树**（孙进程也死），工具立即返回 timeout 文案；
2. ``kill_session_shell_procs`` 只杀指定会话的进程（会话隔离）；
3. 正常命令输出不受影响。
"""

import time
from pathlib import Path

import pytest

from planify.tools import basic
from planify.tools.basic import kill_session_shell_procs, run_bash

IS_WINDOWS = basic.platform.system() == "Windows"


def _start_sleeper_cmd() -> str:
    """常驻命令：bash -c 下再派生一个后台常驻孙进程（模拟 run-server）。"""
    if IS_WINDOWS:
        # sh.exe → python 孙进程持管道常驻
        return (
            "python -c \"import time,sys; print('grandchild up',flush=True); "
            "time.sleep(120)\" & python -c \"import time; time.sleep(120)\""
        )
    return (
        "python3 -c \"import time,sys; print('grandchild up',flush=True); "
        "time.sleep(120)\" & python3 -c \"import time; time.sleep(120)\""
    )


# -------------------- 超时杀进程树 --------------------


def test_timeout_kills_tree_and_returns(tmp_path, monkeypatch):
    """孙进程持管道时，超时必须杀净整树并立即返回（核心回归）。"""
    monkeypatch.setenv("PLANIFY_SHELL_TIMEOUT", "5")
    t0 = time.monotonic()
    out = run_bash(_start_sleeper_cmd(), tmp_path)
    elapsed = time.monotonic() - t0
    assert out.startswith("Error: Timeout"), out
    # 杀树 + 排空必须在超时后短暂窗口内完成（旧实现会永久挂起，测试超时失败）
    assert elapsed < 30, f"timeout kill took {elapsed:.1f}s — tree kill not working"


def test_timeout_returns_promptly_no_grandchild(tmp_path, monkeypatch):
    """超时返回后，孙进程确已被杀（不残留孤儿常驻进程）。"""
    import subprocess as sp
    import sys

    marker = "doclens-treekill-orphan-test-9f3a"
    grandchild = (
        f'"{sys.executable}" -c "import time; print(\'up\',flush=True); '
        f"time.sleep(120)  # {marker}\""
    )
    cmd = f"{grandchild} & {grandchild}"
    monkeypatch.setenv("PLANIFY_SHELL_TIMEOUT", "5")
    run_bash(cmd, tmp_path)
    time.sleep(1.5)  # 给 taskkill 完成时间

    if IS_WINDOWS:
        # powershell 不一定在 PATH（pytest 环境），优先 Windows PowerShell 绝对路径
        ps = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
        if not Path(ps).exists():
            ps = "powershell"
        r = sp.run(
            [ps, "-NoProfile", "-Command",
             "(Get-CimInstance Win32_Process | "
             f"Where-Object {{$_.CommandLine -match '{marker}'}}).Count"],
            capture_output=True, text=True, timeout=30,
        )
        count = r.stdout.strip() or "0"
        assert count == "0", f"orphan grandchild remains: {count} procs"
    else:
        r = sp.run(["pgrep", "-f", marker], capture_output=True, text=True)
        assert r.returncode != 0, "orphan grandchild remains"


# -------------------- 会话级登记与击杀 --------------------


def test_kill_session_shell_procs_isolated(tmp_path, monkeypatch):
    """kill 只击杀目标会话的进程，另一会话的在跑进程不受影响。"""
    from planify.skills.access_state import set_current_session_id, reset_current_session_id

    monkeypatch.setenv("PLANIFY_SHELL_TIMEOUT", "120")

    # 直接用低层 API 起两个长命令并登记到各自会话
    shell = ["cmd", "/c", "ping -n 120 127.0.0.1"] if IS_WINDOWS \
        else ["sh", "-c", "sleep 120"]
    tok_a = set_current_session_id("sess-A")
    p_a = basic.subprocess.Popen(shell, stdout=basic.subprocess.PIPE,
                                 stderr=basic.subprocess.PIPE)
    basic._register_session_proc(p_a)
    reset_current_session_id(tok_a)

    tok_b = set_current_session_id("sess-B")
    p_b = basic.subprocess.Popen(shell, stdout=basic.subprocess.PIPE,
                                 stderr=basic.subprocess.PIPE)
    basic._register_session_proc(p_b)
    reset_current_session_id(tok_b)

    try:
        assert p_a.poll() is None and p_b.poll() is None
        killed = kill_session_shell_procs("sess-A")
        assert killed == 1
        # A 死（taskkill 异步，给宽限），B 活
        deadline = time.monotonic() + 10
        while p_a.poll() is None and time.monotonic() < deadline:
            time.sleep(0.2)
        assert p_a.poll() is not None, "session-A proc should be killed"
        time.sleep(1.0)
        assert p_b.poll() is None, "session-B proc must survive"
        # 登记表已清 A
        with basic._session_procs_lock:
            assert "sess-A" not in basic._session_procs
            assert "sess-B" in basic._session_procs
    finally:
        kill_session_shell_procs("sess-B")


def test_registry_cleanup_after_normal_exit(tmp_path):
    """正常退出的命令自动摘除登记（不留陈旧 Popen）。"""
    from planify.skills.access_state import set_current_session_id, reset_current_session_id

    tok = set_current_session_id("sess-clean")
    try:
        out = run_bash("echo hello-tree-kill", tmp_path)
        assert "hello-tree-kill" in out
        with basic._session_procs_lock:
            assert "sess-clean" not in basic._session_procs
    finally:
        reset_current_session_id(tok)


# -------------------- 正常路径不回归 --------------------


def test_normal_command_still_works(tmp_path):
    out = run_bash("echo normal-ok", tmp_path)
    assert "normal-ok" in out


def test_timeout_message_mentions_background(tmp_path, monkeypatch):
    monkeypatch.setenv("PLANIFY_SHELL_TIMEOUT", "3")
    cmd = "ping -n 60 127.0.0.1 > /dev/null" if not IS_WINDOWS else "ping -n 60 127.0.0.1 >NUL"
    out = run_bash(cmd, tmp_path)
    assert "Timeout" in out and "background_run" in out
