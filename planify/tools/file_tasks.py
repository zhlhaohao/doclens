"""文件任务工具

持久化文件任务系统的工具定义和处理器。
"""

from typing import List, Dict


def get_file_task_definitions() -> list:
    """
    获取文件任务系统的工具定义

    Returns:
        工具定义字典列表
    """
    return [
        {
            "name": "task_create",
            "description": "创建持久化文件任务",
            "input_schema": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string"},
                    "description": {"type": "string"}
                },
                "required": ["subject"]
            }
        },
        {
            "name": "task_get",
            "description": "根据 ID 获取任务详情",
            "input_schema": {
                "type": "object",
                "properties": {"task_id": {"type": "integer"}},
                "required": ["task_id"]
            }
        },
        {
            "name": "task_update",
            "description": "更新任务状态或依赖关系",
            "input_schema": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer"},
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "completed", "deleted"]
                    },
                    "add_blocked_by": {"type": "array", "items": {"type": "integer"}},
                    "add_blocks": {"type": "array", "items": {"type": "integer"}}
                },
                "required": ["task_id"]
            }
        },
        {
            "name": "task_list",
            "description": "列出所有任务",
            "input_schema": {"type": "object", "properties": {}},
        },
        {
            "name": "claim_task",
            "description": "从任务板认领任务",
            "input_schema": {
                "type": "object",
                "properties": {"task_id": {"type": "integer"}},
                "required": ["task_id"]
            }
        },
    ]


def get_file_task_handlers(task_mgr) -> dict:
    """
    获取文件任务系统的工具处理器

    Args:
        task_mgr: TaskManager 实例

    Returns:
        工具名称到处理器函数的字典
    """
    return {
        "task_create": lambda **kw: task_mgr.create(kw["subject"], kw.get("description", "")),
        "task_get": lambda **kw: task_mgr.get(kw["task_id"]),
        "task_update": lambda **kw: task_mgr.update(
            kw["task_id"],
            kw.get("status"),
            kw.get("add_blocked_by"),
            kw.get("add_blocks")
        ),
        "task_list": lambda **kw: task_mgr.list_all(),
        "claim_task": lambda **kw: task_mgr.claim(kw["task_id"], "lead"),
    }
