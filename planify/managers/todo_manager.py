"""TodoManager - 结构化任务状态跟踪 (s03)

追踪 agent 工作进度的状态管理器。

职责：
- 管理待办事项列表（最多 20 项）
- 验证任务状态（pending/in_progress/completed）
- 确保同一时间只有一个任务处于 in_progress 状态
- 渲染可读的任务列表输出

关键洞察："Agent 可以追踪自己的进度 —— 而且我可以看到它。"
"""

from typing import List, Dict, Any


class TodoManager:
    """
    待办事项管理器

    职责：
    - 管理待办事项列表（最多 20 项）
    - 验证任务状态（pending/in_progress/completed）
    - 确保同一时间只有一个任务处于 in_progress 状态
    - 渲染可读的任务列表输出

    关键洞察："Agent 可以追踪自己的进度 —— 而且我可以看到它。"
    """

    def __init__(self):
        """初始化空的待办事项列表。"""
        self.items: List[Dict[str, str]] = []

    def update(self, items: List[Dict[str, Any]]) -> str:
        """
        更新待办事项列表

        验证并更新整个待办列表，确保数据一致性。

        Args:
            items: 待办事项列表，每项包含：
                - content: 任务内容（必填）
                - status: 状态 pending/in_progress/completed（必填）
                - activeForm: 进行中时的进行时描述（必填）

        Returns:
            渲染后的任务列表字符串

        Raises:
            ValueError: 如果验证失败（缺少字段、状态无效、多个 in_progress 等）
        """
        validated, ip = [], 0
        for i, item in enumerate(items):
            content = str(item.get("content", "")).strip()
            status = str(item.get("status", "pending")).lower()
            af = str(item.get("activeForm", "")).strip()
            if not content:
                raise ValueError(f"Item {i}: content required")
            if status not in ("pending", "in_progress", "completed"):
                raise ValueError(f"Item {i}: invalid status '{status}'")
            if not af:
                raise ValueError(f"Item {i}: activeForm required")
            if status == "in_progress":
                ip += 1
            validated.append({"content": content, "status": status, "activeForm": af})
        if len(validated) > 20:
            raise ValueError("Max 20 todos")
        if ip > 1:
            raise ValueError("Only one in_progress allowed")
        self.items = validated
        return self.render()

    def render(self) -> str:
        """
        渲染待办列表为可读字符串

        格式示例：
            [x] 已完成的任务
            [>] 进行中的任务 <- doing
            [ ] 待处理的任务

            (1/3 completed)

        Returns:
            格式化的任务列表字符串
        """
        if not self.items:
            return "No todos."
        lines = []
        for item in self.items:
            m = {"completed": "[x]", "in_progress": "[>]", "pending": "[ ]"}.get(
                item["status"], "[?]"
            )
            suffix = f" <- {item['activeForm']}" if item["status"] == "in_progress" else ""
            lines.append(f"{m} {item['content']}{suffix}")
        done = sum(1 for t in self.items if t["status"] == "completed")
        lines.append(f"\n({done}/{len(self.items)} completed)")
        return "\n".join(lines)

    def has_open_items(self) -> bool:
        """
        检查是否有未完成的任务

        用于判断是否需要发送提醒（s03 的 nag 机制）。
        """
        return any(item.get("status") != "completed" for item in self.items)
