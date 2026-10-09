"""BackgroundManager 进程树击杀回归测试（2026-10-09，P0 修复）。

事故背景（与 2026-10-05 同类，发生在 background_run 通道）：旧 _exec 用
``subprocess.run(timeout=)``——Windows 上超时只 kill 直接子进程，孙进程持有
stdout 管道写端不退出时 communicate() 排空管道永久阻塞：任务永远停在
running、超时信号永不出现、_exec 线程悬挂——模型零反馈耗到死线（Kimi/
openJiuwen 案例的 PI 形态失败）。

修复后必须满足：
1. 常驻命令超时 → 任务转入 error 终态（不再是 running 挂死）；
2. 超时结果带秒数与行动指引（信号可被模型消费）；
3. 孙进程持管道时 _exec 线程仍正常收尾（通知可达、宽限窗口内完成）；
4. 超时残余输出保留（恢复线索，如「输出已写出」）；
5. 进程登记会话注册表：宿主「停止」可击杀后台任务的进程树；
6. 正常命令不回归（completed + 输出）。
"""

import time
from pathlib import Path

import pytest

from planify.tools import basic
from planify.managers.background_manager import (
    _EXEC_GRACE_SECONDS,
    RUNNING_PREFIX,
    BackgroundManager,
)

IS_WINDOWS = basic.platform.system() == "Windows"


def _sleeper_cmd() -> str:
    """常驻命令：shell 下再派生后台常驻孙进程（模拟挂死的服务器）。"""
    py = "python" if IS_WINDOWS else "python3"
    return (
        f'{py} -c "import time,sys; print(\'grandchild up\',flush=True); '
        f'time.sleep(120)" & {py} -c "import time; time.sleep(120)"'
    )


def _wait_terminal(bm: BackgroundManager, tid: str, deadline_s: float = 30) -> dict:
    """轮询等任务进入终态（completed/error），超时失败（挂死测试的核心断言）。"""
    t0 = time.monotonic()
    while time.monotonic() - t0 < deadline_s:
        with bm._tasks_lock:
            t = bm.tasks.get(tid)
        if t and t["status"] != "running":
            return t
        time.sleep(0.2)
    pytest.fail(f"task {tid} still running after {deadline_s}s — silent hang not fixed")


# -------------------- 超时 = 信号，不是挂死 --------------------


def test_timeout_produces_error_terminal_with_signal(tmp_path):
    """常驻命令超时：error 终态 + 秒数 + 行动指引（PI→openJiuwen 形态）。"""
    bm = BackgroundManager(tmp_path)
    ret = bm.run(_sleeper_cmd(), timeout=3)
    tid = ret.split(" ")[2]

    t = _wait_terminal(bm, tid)
    assert t["status"] == "error"
    result = t["result"]
    assert "Timeout (3s)" in result, result
    # 行动指引：引导修命令本身（自行退出/拆步骤/轮询产物文件）
    assert "exit on its own" in result


def test_timeout_residual_output_preserved(tmp_path):
    """超时保留残余输出——模型恢复的关键线索（GIMP 案例：输出已写出）。"""
    bm = BackgroundManager(tmp_path)
    py = "python" if IS_WINDOWS else "python3"
    ret = bm.run(
        f'{py} -c "import time,sys; print(\'work-done-marker\',flush=True); '
        f'time.sleep(120)"',
        timeout=3,
    )
    tid = ret.split(" ")[2]

    t = _wait_terminal(bm, tid)
    assert t["status"] == "error"
    assert "work-done-marker" in t["result"], t["result"]


def test_timeout_notification_reaches_queue(tmp_path):
    """超时终态的完成通知可达 drain/notifications（宿主轮转路径不缺信号）。"""
    bm = BackgroundManager(tmp_path)
    ret = bm.run("sleep 60" if not IS_WINDOWS else "ping -n 60 127.0.0.1", timeout=2)
    tid = ret.split(" ")[2]

    _wait_terminal(bm, tid)
    note = bm.notifications.get(timeout=10)
    assert note["task_id"] == tid
    assert note["status"] == "error"
    assert "Timeout (2s)" in note["result"]


# -------------------- 会话登记：宿主「停止」通路 --------------------


def test_bg_proc_registered_to_session(tmp_path):
    """后台任务进程登记到发起会话——kill_session_shell_procs 可击杀。"""
    from planify.skills.access_state import (
        reset_current_session_id,
        set_current_session_id,
    )

    bm = BackgroundManager(tmp_path)
    tok = set_current_session_id("sess-bg-stop")
    try:
        ret = bm.run(
            "sleep 120" if not IS_WINDOWS else "ping -n 120 127.0.0.1", timeout=110
        )
        tid = ret.split(" ")[2]
        # 等进程登记出现（线程启动 + Popen 完成）
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            with basic._session_procs_lock:
                registered = len(basic._session_procs.get("sess-bg-stop", ()))
            if registered:
                break
            time.sleep(0.1)
        assert registered, "bg proc not registered to session registry"

        killed = basic.kill_session_shell_procs("sess-bg-stop")
        assert killed >= 1
        # 进程被杀 → run_shell_with_tree_kill 的 communicate 返回 → 任务终态
        t = _wait_terminal(bm, tid)
        assert t["status"] in ("error", "completed")
    finally:
        basic.kill_session_shell_procs("sess-bg-stop")
        reset_current_session_id(tok)


def test_bg_proc_registered_under_empty_key_without_session(tmp_path):
    """无会话上下文（session_id=""）时登记兜底键——不留孤儿。"""
    bm = BackgroundManager(tmp_path)
    ret = bm.run("sleep 30" if not IS_WINDOWS else "ping -n 30 127.0.0.1", timeout=25)
    tid = ret.split(" ")[2]
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        with basic._session_procs_lock:
            registered = len(basic._session_procs.get("", ()))
        if registered:
            break
        time.sleep(0.1)
    assert registered, "bg proc should register under '' fallback key"
    basic.kill_session_shell_procs("")
    t = _wait_terminal(bm, tid)
    assert t["status"] in ("error", "completed")


# -------------------- 正常路径不回归 --------------------


def test_normal_completion_unchanged(tmp_path):
    bm = BackgroundManager(tmp_path)
    ret = bm.run("echo bg-normal-ok", timeout=30)
    tid = ret.split(" ")[2]

    t = _wait_terminal(bm, tid)
    assert t["status"] == "completed"
    assert "bg-normal-ok" in t["result"]


def test_error_path_still_works(tmp_path):
    """命令异常退出仍转 error（exit code 非零不影响——语义同旧实现）。"""
    bm = BackgroundManager(tmp_path)
    ret = bm.run("echo oops >&2; exit 3", timeout=30)
    tid = ret.split(" ")[2]

    t = _wait_terminal(bm, tid)
    # 旧实现 exit 3 → completed（subprocess.run 不查 returncode）；新实现
    # run_shell_with_tree_kill 同样不查 returncode——保持 completed + 输出
    assert t["status"] == "completed"
    assert "oops" in t["result"]


# -------------------- P1：失联自愈 --------------------


def test_lost_executor_self_heals_to_error(tmp_path):
    """执行线程失联（running 远超 timeout+宽限）：check() 就地转 error。

    纯轮询豁免（等待轮不计轮次预算）依赖 check() 返回终态收敛——本测试
    验证即使 _exec 线程彻底丢失，轮询也能拿到 error 信号而非无界 running。
    """
    bm = BackgroundManager(tmp_path)
    ret = bm.run("sleep 300" if not IS_WINDOWS else "ping -n 300 127.0.0.1", timeout=5)
    tid = ret.split(" ")[2]

    # 模拟执行线程失联：直接把 started_at 拨回 timeout+宽限+10s 之前
    with bm._tasks_lock:
        bm.tasks[tid]["started_at"] -= 5 + _EXEC_GRACE_SECONDS + 10

    out = bm.check(tid)
    # 失联自愈：不再返回 [running] 前缀，转 error 终态 + 行动指引
    assert not out.startswith(RUNNING_PREFIX)
    assert out.startswith("[error]")
    assert "exceeded its timeout" in out
    assert "timeout (5s)" in out
    # 任务字典同步转终态（remove/clear 可回收）
    with bm._tasks_lock:
        assert bm.tasks[tid]["status"] == "error"
    # 进程已死（超时击杀）——清理避免孤儿
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        with basic._session_procs_lock:
            if not basic._session_procs.get("", ()):
                break
        time.sleep(0.2)
    basic.kill_session_shell_procs("")


def test_running_within_grace_still_polls(tmp_path):
    """宽限内（正常执行中）check() 仍返回 [running] 等待指引——不自愈误伤。"""
    from planify.managers.background_manager import RUNNING_PREFIX

    bm = BackgroundManager(tmp_path)
    ret = bm.run("sleep 30" if not IS_WINDOWS else "ping -n 30 127.0.0.1", timeout=60)
    tid = ret.split(" ")[2]
    try:
        out = bm.check(tid)
        assert out.startswith(RUNNING_PREFIX)
        assert "NOT a failure" in out
    finally:
        with bm._tasks_lock:
            bm.tasks[tid]["started_at"] -= 60 + _EXEC_GRACE_SECONDS + 10
        bm.check(tid)  # 触发自愈转终态
        basic.kill_session_shell_procs("")


# -------------------- P2：timeout 归一化 --------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        (None, 120),          # 缺省（与同步 shell 同源）
        ("", 120),            # 空字符串（API 传空）
        ("abc", 120),         # 非数字
        (0, 120),             # 非正
        (-5, 120),            # 负数
        (30, 30),             # 合法值直通
        ("300", 300),         # 数字字符串直通
        (99999, 3600),        # 超上限钳制（事实无超时 → 1 小时封顶）
    ],
)
def test_timeout_normalized(raw, expected):
    from planify.managers.background_manager import _normalize_bg_timeout

    assert _normalize_bg_timeout(raw) == expected


def test_bg_default_follows_shell_timeout_env(monkeypatch):
    """统一性契约：后台缺省与同步 shell 同源读 PLANIFY_SHELL_TIMEOUT。

    同步超时文案引导模型「转 background_run」——若两通道预算不同源，
    用户调大 env 后引导本身会把模型送进更短的预算，引导变坑。
    """
    from planify.managers.background_manager import _normalize_bg_timeout
    from planify.tools.basic import _shell_timeout

    monkeypatch.setenv("PLANIFY_SHELL_TIMEOUT", "300")
    # 同步缺省、后台缺省、API 未传 timeout 三处一致
    assert _shell_timeout() == 300
    assert _normalize_bg_timeout(None) == 300
    assert _normalize_bg_timeout("") == 300
    # 显式合法值不受 env 影响（模型按任务自主指定）
    assert _normalize_bg_timeout(60) == 60


def test_run_clamps_timeout_and_records(tmp_path):
    """run() 接受归一化后的 timeout 并记录进任务字典（自愈判定依据）。"""
    bm = BackgroundManager(tmp_path)
    ret = bm.run("echo clamp-test", timeout=99999)
    tid = ret.split(" ")[2]
    t = _wait_terminal(bm, tid)
    assert t["status"] == "completed"
    assert t["timeout"] == 3600


# -------------------- P2：同步 shell 超时附带残余输出 --------------------


def test_sync_timeout_message_carries_residual_output(tmp_path, monkeypatch):
    """同步 shell 超时：残余输出随超时信号返回（GIMP 案例恢复线索）。"""
    monkeypatch.setenv("PLANIFY_SHELL_TIMEOUT", "3")
    py = "python" if IS_WINDOWS else "python3"
    out = basic.run_bash(
        f'{py} -c "import time,sys; print(\'residual-marker-xyz\',flush=True); '
        f'time.sleep(60)"',
        tmp_path,
    )
    assert out.startswith("Error: Timeout (3s)")
    assert "background_run" in out
    assert "residual-marker-xyz" in out, "残余输出必须随超时信号返回"
    assert "Partial output before timeout" in out
