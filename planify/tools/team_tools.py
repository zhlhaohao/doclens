"""团队协作工具

团队协作所需的工具定义和处理器。
"""

from typing import List, Dict


def get_team_tools_definitions(valid_msg_types: list) -> list:
    """
    获取团队协作的工具定义

    Args:
        valid_msg_types: 有效的消息类型列表

    Returns:
        工具定义字典列表
    """
    return [
        {
            "name": "spawn_teammate",
            "description": "启动持久的自主队友",
            "input_schema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "prompt": {"type": "string"}
                },
                "required": ["name", "role", "prompt"]
            }
        },
        {
            "name": "list_teammates",
            "description": "列出所有队友",
            "input_schema": {"type": "object", "properties": {}},
        },
        {
            "name": "send_message",
            "description": "向队友发送消息",
            "input_schema": {
                "type": "object",
                "properties": {
                    "to": {"type": "string"},
                    "content": {"type": "string"},
                    "msg_type": {
                        "type": "string",
                        "enum": valid_msg_types
                    }
                },
                "required": ["to", "content"]
            }
        },
        {
            "name": "read_inbox",
            "description": "读取并清空 lead 的收件箱",
            "input_schema": {"type": "object", "properties": {}},
        },
        {
            "name": "broadcast",
            "description": "向所有队友发送消息",
            "input_schema": {
                "type": "object",
                "properties": {"content": {"type": "string"}},
                "required": ["content"]
            }
        },
    ]


def get_team_tools_handlers(team_mgr, bus):
    """
    获取团队协作的工具处理器

    Args:
        team_mgr: TeammateManager 实例
        bus: MessageBus 实例

    Returns:
        工具名称到处理器函数的字典
    """
    import json
    return {
        "spawn_teammate": lambda **kw: team_mgr.spawn(kw["name"], kw["role"], kw["prompt"]),
        "list_teammates": lambda **kw: team_mgr.list_all(),
        "send_message": lambda **kw: bus.send(
            "lead", kw["to"], kw["content"], kw.get("msg_type", "message")
        ),
        "read_inbox": lambda **kw: json.dumps(bus.read_inbox("lead"), indent=2),
        "broadcast": lambda **kw: bus.broadcast("lead", kw["content"], team_mgr.member_names()),
    }
