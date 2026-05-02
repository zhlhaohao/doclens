"""BackgroundManager - 后台任务管理 (s08)

在线程中执行长时间运行的命令，不阻塞主循环。

工作流程：
1. run(command) -> 启动后台线程，返回任务 ID
2. 线程执行命令，完成后发送通知到队列
3. 主循环每轮调用 drain() 获取完成通知

通知格式：
    {"task_id": "abc123", "status": "completed", "result": "..."}

关键洞察："Agent 可以同时做多件事。"
"""

import os
import platform
import shutil
import subprocess
import threading
import uuid
from pathlib import Path
from queue import Queue
from typing import Dict, List

from ..tools.basic import _find_bash_path


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

    def run(self, command: str, timeout: int = 120) -> str:
        """
        启动后台任务

        Args:
            command: 要执行的 shell 命令
            timeout: 超时时间（秒）

        Returns:
            启动确认信息，包含任务 ID
        """
        tid = str(uuid.uuid4())[:8]
        with self._tasks_lock:
            self.tasks[tid] = {"status": "running", "command": command, "result": None}
        threading.Thread(target=self._exec, args=(tid, command, timeout), daemon=True).start()
        return f"Background task {tid} started: {command[:80]}"

    def _exec(self, tid: str, command: str, timeout: int):
        """
        在后台执行命令（内部方法）

        Args:
            tid: 任务 ID
            command: 要执行的命令
            timeout: 超时时间
        """
        try:
            # 检测 Windows 环境并使用 bash 包装命令
            if platform.system() == "Windows":
                bash_path = _find_bash_path()
                if bash_path:
                    r = subprocess.run(
                        [bash_path, "-c", command],
                        shell=False, cwd=str(self.workdir),
                        capture_output=True, text=True, timeout=timeout
                    )
                else:
                    # 没有 bash，回退到 cmd.exe（可能失败）
                    r = subprocess.run(
                        command, shell=True, cwd=str(self.workdir),
                        capture_output=True, text=True, timeout=timeout
                    )
            else:
                # Unix 环境直接使用 shell
                r = subprocess.run(
                    command, shell=True, cwd=str(self.workdir),
                    capture_output=True, text=True, timeout=timeout
                )
            output = (r.stdout + r.stderr).strip()[:50000]
            with self._tasks_lock:
                if tid in self.tasks:
                    self.tasks[tid].update({"status": "completed", "result": output or "(no output)"})
        except Exception as e:
            with self._tasks_lock:
                if tid in self.tasks:
                    self.tasks[tid].update({"status": "error", "result": str(e)})
        # 发送完成通知
        self.notifications.put({
            "task_id": tid,
            "status": self.tasks[tid]["status"] if tid in self.tasks else "error",
            "result": self.tasks[tid]["result"][:500] if tid in self.tasks else "Unknown error"
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
                return f"[{t['status']}] {t.get('result', '(running)')}" if t else f"Unknown: {tid}"
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
