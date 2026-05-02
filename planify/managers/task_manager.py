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
from pathlib import Path


class TaskManager:
    """持久化任务管理器"""

    def __init__(self, tasks_dir: Path):
        """
        初始化任务目录

        Args:
            tasks_dir: 任务文件目录
        """
        tasks_dir.mkdir(exist_ok=True, parents=True)
        self.tasks_dir = tasks_dir

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
