"""协议工具

关闭和计划审批协议的工具定义和处理器。
"""

import json
import uuid
from typing import Dict, Any


# 关闭请求追踪: request_id -> {target, status}
shutdown_requests: Dict[str, Dict[str, str]] = {}

# 计划审批追踪: request_id -> {from, status, feedback}
plan_requests: Dict[str, Dict[str, Any]] = {}


def handle_shutdown_request(teammate: str, bus) -> str:
    """
    向队友发送关闭请求

    Args:
        teammate: 队友名称
        bus: 息息总线实例

    Returns:
        请求确认信息
    """
    req_id = str(uuid.uuid4())[:8]
    shutdown_requests[req_id] = {"target": teammate, "status": "pending"}
    bus.send(
        "lead",
        teammate,
        "Please shut down.",
        "shutdown_request",
        {"request_id": req_id}
    )
    return f"Shutdown request {req_id} sent to '{teammate}'"


def handle_plan_review(
    request_id: str,
    approve: bool,
    bus,
    feedback: str = ""
) -> str:
    """
    审批队友的计划

    Args:
        request_id: 请求 ID
        approve: 是否批准
        feedback: 反馈信息
        bus: 息息总线实例

    Returns:
        审批结果
    """
    req = plan_requests.get(request_id)
    if not req:
        return f"Error: Unknown plan request_id '{request_id}'"
    req["status"] = "approved" if approve else "rejected"
    req["feedback"] = feedback
    bus.send(
        req["from"],
        req["from"],
        feedback,
        "plan_approval_response",
        {
            "request_id": request_id,
            "approve": approve,
            "feedback": feedback
        }
    )
    return f"Plan {req['status']} for '{req['from']}'"


def get_protocol_definitions(valid_msg_types: list) -> list:
    """
    获取协议工具的定义

    Args:
        valid_msg_types: 有效的消息类型列表

    Returns:
        工具定义字典列表
    """
    return [
        {
            "name": "shutdown_request",
            "description": "请求队友关闭",
            "input_schema": {
                "type": "object",
                "properties": {"teammate": {"type": "string"}},
                "required": ["teammate"]
            }
        },
        {
            "name": "plan_approval",
            "description": "批准或拒绝队友的计划",
            "input_schema": {
                "type": "object",
                "properties": {
                    "request_id": {"type": "string"},
                    "approve": {"type": "boolean"},
                    "feedback": {"type": "string"}
                },
                "required": ["request_id", "approve"]
            }
        },
        {
            "name": "idle",
            "description": "进入空闲状态",
            "input_schema": {"type": "object", "properties": {}},
        },
    ]


def get_protocol_handlers(bus):
    """
    获取协议工具的处理器

    Args:
        bus: 息息总线实例

    Returns:
        工具名称到处理器函数的字典
    """
    return {
        "shutdown_request": lambda **kw: handle_shutdown_request(kw["teammate"], bus),
        "plan_approval": lambda **kw: handle_plan_review(
            kw["request_id"], kw["approve"], kw.get("feedback", ""), bus
        ),
        "idle": lambda **kw: "Lead does not idle.",
    }
