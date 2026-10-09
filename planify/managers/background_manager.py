"""BackgroundManager - 后台任务管理 (s08)

在线程中执行长时间运行的命令，不阻塞主循环。

执行语义与同步 shell 工具完全一致（2026-10-09 起）：统一经
``run_shell_with_tree_kill`` 执行——超时击杀**整个进程树**（Windows 孙进程
持有 stdout 管道写端时也能正常收尾），进程登记进会话级注册表（宿主
「停止」可立即击杀）。超时不是静默失败：任务转入 error 终态，返回带
残余输出与行动指引的超时信号——harness 供信号，模型供恢复。

工作流程：
1. run(command) -> 启动后台线程，返回任务 ID
2. 线程执行命令，完成后发送通知到队列
3. 主循环每轮调用 drain() 获取完成通知

通知格式：
    {"task_id": "abc123", "status": "completed", "result": "..."}

关键洞察："Agent 可以同时做多件事。"
"""

import logging
import os
import platform
import threading
import time
import uuid
from pathlib import Path
from queue import Queue
from typing import Dict, List

from ..skills.access_state import (
    get_current_session_id,
    reset_current_session_id,
    set_current_session_id,
)
from ..tools.basic import (
    _audit_snippet,
    _build_shell_argv,
    _find_bash_path,
    _find_windows_shell,
    _is_dangerous,
    _shell_timeout,
    run_shell_with_tree_kill,
)

logger = logging.getLogger(__name__)

#: check_background「仍在运行」回复的前缀——streaming runner 的纯轮询识别
#: 契约（等待轮不计入轮次预算）依赖此常量判断，输出文案其余部分可自由演化
RUNNING_PREFIX = "[running]"

#: timeout 归一化：非法/非正回落默认；上限 1 小时——超过即事实无超时，
#: 挂起会静默耗尽预算（PI 形态失败：全程零信号耗到死线）。缺省值与同步
#: shell 统一：读同一 PLANIFY_SHELL_TIMEOUT（同步超时文案引导模型转
#: background_run，两条通道的预算必须一致，否则引导本身是坑）
_BG_TIMEOUT_DEFAULT = 120
_BG_TIMEOUT_MAX = 3600

#: 执行线程收尾宽限（秒）：超时后杀树（taskkill ≤15s）+ 二次排空（≤15s），
#: 超过 timeout + 本宽限仍 running = 执行线程失联，check() 自愈转 error
_EXEC_GRACE_SECONDS = 45


def _normalize_bg_timeout(t) -> int:
    """后台任务 timeout 归一化：非法/非正回落同步缺省，上限 3600。"""
    try:
        t = int(t)
    except (TypeError, ValueError):
        # None（未传）/ 非数字：与同步 shell 同源——读 PLANIFY_SHELL_TIMEOUT
        return _shell_timeout()
    if t <= 0:
        return _shell_timeout()
    return min(t, _BG_TIMEOUT_MAX)


def _bg_timeout_message(tid: str, timeout: int, residual_output: str = "") -> str:
    """后台任务超时信号：秒数 + 残余输出 + 行动指引。

    超时是 harness 给模型的可用反馈，不是静默失败——同步 shell 超时文案
    引导改走后台；后台超时则引导改命令（加 nohup/服务自退、拆步骤、缩
    timeout 短失败快），残余输出随信号返回（模型可据此诊断，如 GIMP
    挂起案例中「输出已写出」正是恢复线索）。
    """
    msg = (
        f"Error: Timeout ({timeout}s) in background task {tid}. "
        "The whole process tree was killed. If the command is expected to "
        "run long, fix the command itself: make it exit on its own "
        "(e.g. add a quit/exit step), split it into shorter steps, or "
        "poll a file it writes instead of waiting for the process."
    )
    if residual_output:
        snippet = residual_output[:2000]
        msg += (
            f"\n\nPartial output before timeout (may contain the reason, "
            f"e.g. work already written to disk):\n{snippet}"
        )
    return msg


class BackgroundManager:
    """后台任务管理器（线程安全）"""

    def __init__(self, workdir: Path):
        """
        初始化任务字典和通知队列

        Args:
            workdir: 命令执行的工作目录
        """
        self.workdir = workdir
        self._tasks_lock = threading.RLock()
        self.tasks: Dict[str, Dict[str, str]] = {}  # task_id -> {status, command, result}
        self.notifications: Queue = Queue()  # 完成通知队列（Queue 本身是线程安全的）

    def run(self, command: str, timeout: int = None) -> str:
        """
        启动后台任务

        Args:
            command: 要执行的 shell 命令
            timeout: 超时时间（秒）。None = 与同步 shell 同源
                （PLANIFY_SHELL_TIMEOUT，默认 120）；显式值经归一化
                （非正回落同源缺省，上限 3600）

        Returns:
            启动确认信息，包含任务 ID
        """
        tid = str(uuid.uuid4())[:8]
        # timeout 归一化（P2）：防负数/字符串/巨值造成事实无超时
        timeout = _normalize_bg_timeout(timeout)
        # 审计：后台命令与同步 shell 工具同口径（call/result INFO 落盘），
        # task ID 串联两行；结果在 _exec 完成时记录
        logger.info(
            "[audit][background] call | task=%s | cwd=%s | command=%s",
            tid, self.workdir, command,
        )
        # 危险命令过滤：与同步 bash/powershell 同一清单——后台不是绕行通道
        # （此前 _exec 不查，模型可把被拦命令改走 background_run 执行）。
        # 拦截时不建任务不启线程，直接返回错误（与同步工具行为一致），
        # 审计仍完整（call + result status=blocked）。
        if _is_dangerous(command):
            logger.info(
                "[audit][background] result | task=%s | status=blocked | %s",
                tid, "Error: Dangerous command blocked",
            )
            return "Error: Dangerous command blocked"
        with self._tasks_lock:
            self.tasks[tid] = {
                "status": "running",
                "command": command,
                "result": None,
                "started_at": time.monotonic(),
                "timeout": timeout,
            }
        # 捕获发起线程的会话上下文（线程不继承 contextvar）：使 _exec 里
        # 的进程登记落到正确会话键下，宿主「停止」可击杀后台任务的进程树
        session_id = get_current_session_id()
        threading.Thread(
            target=self._exec, args=(tid, command, timeout, session_id), daemon=True
        ).start()
        return f"Background task {tid} started: {command[:80]}"

    def _build_argv(self, command: str) -> list:
        """构建命令行参数（shell=False 形态），与同步 shell 工具同口径。"""
        if platform.system() == "Windows":
            bash_path = _find_bash_path()
            if bash_path:
                return [bash_path, "-c", command]
            # 没有 Git Bash，回退 Windows 原生 shell（pwsh → powershell → cmd）
            shell = _find_windows_shell()
            if shell:
                exe_path, kind = shell
                return _build_shell_argv(exe_path, kind, command)
            # 防御性兜底（_find_windows_shell 的 cmd 分支必然命中）
            return [os.environ.get("COMSPEC", "cmd.exe"), "/c", command]
        # Unix 环境直接使用 shell
        return ["sh", "-c", command]

    def _exec(self, tid: str, command: str, timeout: int, session_id: str = ""):
        """
        在后台执行命令（内部方法）

        经 ``run_shell_with_tree_kill`` 执行——超时击杀整树（含持有管道
        写端的孙进程）、进程登记会话注册表、超时保留残余输出并转为
        error 终态（超时是信号，不是静默挂起）。

        Args:
            tid: 任务 ID
            command: 要执行的命令
            timeout: 超时时间
            session_id: 发起会话 ID（进程登记键；空串登记在 "" 兜底键下）
        """
        # 线程不继承父线程 contextvar：显式恢复会话上下文
        token = set_current_session_id(session_id)
        try:
            text, timed_out = run_shell_with_tree_kill(
                self._build_argv(command), self.workdir, timeout
            )
            if timed_out:
                result = _bg_timeout_message(tid, timeout, text)
                with self._tasks_lock:
                    if tid in self.tasks:
                        self.tasks[tid].update({"status": "error", "result": result})
            else:
                output = text[:50000]
                with self._tasks_lock:
                    if tid in self.tasks:
                        self.tasks[tid].update(
                            {"status": "completed", "result": output or "(no output)"}
                        )
        except Exception as e:
            with self._tasks_lock:
                if tid in self.tasks:
                    self.tasks[tid].update({"status": "error", "result": str(e)})
        finally:
            reset_current_session_id(token)
        # 发送完成通知
        status = self.tasks[tid]["status"] if tid in self.tasks else "error"
        result = self.tasks[tid]["result"] if tid in self.tasks else "Unknown error"
        # 审计：完成/超时/异常统一在此落盘（_exec 的唯一汇聚出口）
        logger.info(
            "[audit][background] result | task=%s | status=%s | %s",
            tid, status, _audit_snippet(result or "(no output)"),
        )
        self.notifications.put({
            "task_id": tid,
            "status": status,
            "result": result[:500] if tid in self.tasks else "Unknown error"
        })

    def check(self, tid: str = None) -> str:
        """
        检查任务状态

        Args:
            tid: 任务 ID（可选，不提供则列出所有任务）

        Returns:
            任务状态信息
        """
        with self._tasks_lock:
            if tid:
                t = self.tasks.get(tid)
                if not t:
                    return f"Unknown: {tid}"
                if t["status"] == "running":
                    # 失联自愈（P1）：超时 + 收尾宽限仍 running = 执行线程
                    # 已丢（线程被杀/极端调度/未知路径未置终态）——就地转
                    # error 终态，打破纯轮询豁免下的无界等待。注意锁内只
                    # 改状态，文案在锁外渲染。
                    elapsed = time.monotonic() - t.get("started_at", 0.0)
                    budget = t.get("timeout") or _shell_timeout()
                    if elapsed > budget + _EXEC_GRACE_SECONDS:
                        t.update(
                            {
                                "status": "error",
                                "result": (
                                    f"Error: task {tid} exceeded its timeout "
                                    f"({budget}s) by {elapsed - budget:.0f}s "
                                    "without reaching a terminal state — "
                                    "the executor thread appears lost. "
                                    "Treat it as timed out: the process tree "
                                    "was killed or is unreachable. Do not "
                                    "wait further; rerun with a corrected "
                                    "command or check artifacts on disk."
                                ),
                            }
                        )
                        logger.warning(
                            "[background] task=%s 失联自愈：running %.0fs "
                            "超出 timeout(%ds)+宽限(%ds)，转 error",
                            tid, elapsed, budget, _EXEC_GRACE_SECONDS,
                        )
                        # 落到锁外统一渲染终态
                    else:
                        # running 态无 result（初始化为 None）——渲染等待指引
                        # 而非字面 "None"：耗时 + 完成会有通知 + 等待≠失败
                        # （与 runner 轮次预算三机制同口径，防模型把等待误
                        # 报成构建出错）。前缀 RUNNING_PREFIX 是 runner 纯
                        # 轮询识别的契约（见上）。
                        return (
                            f"{RUNNING_PREFIX} still running, {elapsed:.0f}s elapsed "
                            f"(command: {t['command'][:60]}). This is NOT a failure. "
                            "You will receive a completion notification; if the user "
                            "is waiting, tell them it is still running, or poll again "
                            "with check_background in a little while."
                        )
                return f"[{t['status']}] {t.get('result') or '(no result)'}"
            return "\n".join(
                f"{k}: [{v['status']}] {v['command'][:60]}"
                for k, v in self.tasks.items()
            ) or "No bg tasks."

    def drain(self) -> List[Dict[str, str]]:
        """
        获取并清空所有完成通知

        在主循环每轮开始时调用，获取已完成任务的通知。

        Returns:
            通知列表
        """
        notifs = []
        while not self.notifications.empty():
            notifs.append(self.notifications.get_nowait())
        return notifs

    def remove(self, tid: str) -> bool:
        """
        移除已完成的任务记录

        Args:
            tid: 任务 ID

        Returns:
            是否成功移除
        """
        with self._tasks_lock:
            if tid in self.tasks and self.tasks[tid]["status"] in ("completed", "error"):
                del self.tasks[tid]
                return True
            return False

    def clear(self) -> int:
        """
        清除所有已完成的任务记录

        Returns:
            清除的任务数量
        """
        count = 0
        with self._tasks_lock:
            to_remove = [
                tid for tid, task in self.tasks.items()
                if task["status"] in ("completed", "error")
            ]
            for tid in to_remove:
                del self.tasks[tid]
                count += 1
        return count

    def __len__(self) -> int:
        """返回活跃任务数量"""
        with self._tasks_lock:
            return len(self.tasks)
