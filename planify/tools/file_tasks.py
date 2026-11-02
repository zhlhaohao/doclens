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


def _task_update_handler(task_mgr, **kw):
    """task_update 工具入口：空更新守卫（2026-11-02）。

    背景：模型死循环事故——连续 8 次调用 task_update 只传 task_id，
    status/add_blocked_by/add_blocks 全缺。底层 TaskManager.update 在全
    None 时静默 save + 返回任务 JSON（对编程调用方合法的 no-op 语义），
    模型收到"成功"响应以为更新生效，但任务状态从未变化；模型的下一次
    调用仍是同参（缺 status）→ 同参死循环提醒被无视 → 框架层无法自愈。

    修复：handler 层把"全 None"识别为模型错误，返回可行动 Error 文本
    （提示哪个参数缺失、应传什么），让模型下次调用时主动补字段——
    self-healing 而非框架硬熔断。底层 TaskManager.update 语义不动
    （编程调用方仍可享受 no-op 便利）。
    """
    status = kw.get("status")
    add_blocked_by = kw.get("add_blocked_by")
    add_blocks = kw.get("add_blocks")
    if status is None and add_blocked_by is None and add_blocks is None:
        return (
            "Error: task_update 未指定任何更新字段——status / add_blocked_by / "
            "add_blocks 至少要传一个。常见用法：标记完成请传 "
            "status=\"completed\"；标记开始请传 status=\"in_progress\"。"
            "本次调用未对任务做任何修改。"
        )
    return task_mgr.update(kw["task_id"], status, add_blocked_by, add_blocks)


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
        "task_update": lambda **kw: _task_update_handler(task_mgr, **kw),
        "task_list": lambda **kw: task_mgr.list_all(),
        "claim_task": lambda **kw: task_mgr.claim(kw["task_id"], "lead"),
    }
