"""TaskManager - 持久化文件任务管理 (s07)

使用 JSON 文件存储的任务管理系统。

任务文件格式 (.tasks/task_N.json)：
    {
        "id": 1,
        "subject": "Task title",
        "description": "Task description",
        "status": "pending",  // pending/in_progress/completed/deleted
        "owner": "agent_name",  // 可选，任务认领者
        "blockedBy": [2, 3],  // 可选，阻塞此任务的任务 ID
        "blocks": [4]  // 可选，被此任务阻塞的任务 ID
    }

与 TodoManager (s03) 的区别：
- TodoManager: 内存中的短期待办列表
- TaskManager: 文件持久化的长期任务系统，支持依赖关系

关键洞察："Agent 可以创建、追踪和完成长期任务。"
"""

import json
import threading
from pathlib import Path
from typing import Optional


class TaskManager:
    """持久化任务管理器"""

    #: update_raw 的「不写入」哨兵（None 是合法值——「清空字段」）
    _UNSET = object()

    def __init__(self, tasks_dir: Path):
        """
        初始化任务目录

        Args:
            tasks_dir: 任务文件目录
        """
        tasks_dir.mkdir(exist_ok=True, parents=True)
        self.tasks_dir = tasks_dir
        # 写锁：调度器线程 / 验收线程池 / Bot 线程并发写同一 task 文件（§竞态）——
        # 无锁时 read-modify-write 会互相覆盖（verifying↔ready、failed↔pending）
        self._lock = threading.RLock()

    def _next_id(self) -> int:
        """获取下一个可用的任务 ID"""
        ids = [
            int(f.stem.split("_")[1])
            for f in self.tasks_dir.glob("task_*.json")
        ]
        return max(ids, default=0) + 1

    def _load(self, tid: int) -> dict:
        """加载指定 ID 的任务"""
        p = self.tasks_dir / f"task_{tid}.json"
        if not p.exists():
            raise ValueError(f"Task {tid} not found")
        return json.loads(p.read_text())

    def _save(self, task: dict):
        """保存任务到文件"""
        (self.tasks_dir / f"task_{task['id']}.json").write_text(
            json.dumps(task, indent=2)
        )

    def create(self, subject: str, description: str = "") -> str:
        """
        创建新任务

        Args:
            subject: 任务标题
            description: 任务描述（可选）

        Returns:
            JSON 格式的任务信息
        """
        task = {
            "id": self._next_id(),
            "subject": subject,
            "description": description,
            "status": "pending",
            "owner": None,
            "blockedBy": [],
            "blocks": []
        }
        self._save(task)
        return json.dumps(task, indent=2)

    def get(self, tid: int) -> str:
        """
        获取任务详情

        Args:
            tid: 任务 ID

        Returns:
            JSON 格式的任务信息
        """
        return json.dumps(self._load(tid), indent=2)

    def update(
        self,
        tid: int,
        status: str = None,
        add_blocked_by: list = None,
        add_blocks: list = None
    ) -> str:
        """
        更新任务状态或依赖关系

        任务完成时，自动解除其他任务对此任务的阻塞。

        Args:
            tid: 任务 ID
            status: 新状态（可选）
            add_blocked_by: 添加阻塞依赖（可选）
            add_blocks: 添加被阻塞的任务（可选）

        Returns:
            JSON 格式的更新后任务信息
        """
        task = self._load(tid)
        if status:
            task["status"] = status
            # 完成任务时，解除其他任务对此任务的阻塞
            if status == "completed":
                for f in self.tasks_dir.glob("task_*.json"):
                    t = json.loads(f.read_text())
                    if tid in t.get("blockedBy", []):
                        t["blockedBy"].remove(tid)
                        self._save(t)
            # 删除任务
            if status == "deleted":
                (self.tasks_dir / f"task_{tid}.json").unlink(missing_ok=True)
                return f"Task {tid} deleted"
        if add_blocked_by:
            task["blockedBy"] = list(set(task["blockedBy"] + add_blocked_by))
        if add_blocks:
            task["blocks"] = list(set(task["blocks"] + add_blocks))
        self._save(task)
        return json.dumps(task, indent=2)

    def list_all(self) -> str:
        """
        列出所有任务

        Returns:
            格式化的任务列表
        """
        tasks = [
            json.loads(f.read_text())
            for f in sorted(self.tasks_dir.glob("task_*.json"))
        ]
        if not tasks:
            return "No tasks."
        lines = []
        for t in tasks:
            m = {"pending": "[ ]", "in_progress": "[>]", "completed": "[x]"}.get(
                t["status"], "[?]"
            )
            owner = f" @{t['owner']}" if t.get("owner") else ""
            blocked = f" (blocked by: {t['blockedBy']})" if t.get("blockedBy") else ""
            lines.append(f"{m} #{t['id']}: {t['subject']}{owner}{blocked}")
        return "\n".join(lines)

    def claim(self, tid: int, owner: str) -> str:
        """
        认领任务

        将任务状态设置为 in_progress，并设置 owner。

        Args:
            tid: 任务 ID
            owner: 认领者名称

        Returns:
            操作结果信息
        """
        task = self._load(tid)
        task["owner"] = owner
        task["status"] = "in_progress"
        self._save(task)
        return f"Claimed task #{tid} for {owner}"

    # ---------------------------------------------------------------- DAG 扩展（ADR-0059）
    # 下列方法供 team/scheduler 使用：返回原始 dict 而非 JSON 字串。

    def list_all_raw(self) -> list:
        """全部任务的原始 dict 列表（含 DAG 步骤字段）。"""
        out = []
        for f in sorted(self.tasks_dir.glob("task_*.json")):
            try:
                out.append(json.loads(f.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue
        return out

    def get_raw(self, tid: int) -> Optional[dict]:
        """按 id 读原始 dict；不存在返回 None。"""
        p = self.tasks_dir / f"task_{tid}.json"
        if not p.exists():
            return None
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None

    def save_raw(self, task: dict) -> None:
        """整写回（scheduler 更新 DAG 步骤字段用）。加锁——见 __init__ 的竞态说明。"""
        with self._lock:
            self._save(task)

    def update_raw(self, tid: int, expect_status: Optional[str] = None, **changes) -> Optional[dict]:
        """原子读-改-写（加锁）。并发写 task 的唯一安全入口。

        `expect_status` 给定时是**条件更新**：task 当前 status 不等于它则**不写**、
        返回 None。用于「验收结果写回前 task 已被 pause/重派改变」的竞态防护
        （ADR-0060 §4）——调用方据此丢弃过期结果。

        返回更新后的 task（不存在或条件不满足返回 None）。changes 为 None 值时**不**
        写入该键（None 有时表示「清空」，由调用方用 sentinel 表达删除）。
        """
        with self._lock:
            task = self.get_raw(tid)
            if task is None:
                return None
            if expect_status is not None and task.get("status") != expect_status:
                return None
            for k, v in changes.items():
                if v is not self._UNSET:
                    task[k] = v
            self._save(task)
            return task
