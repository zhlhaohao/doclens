#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用户交互工具

定义 ask_user 和 user_confirm 工具，支持代理与用户交互。
这些工具需要运行时绑定事件发射器和响应等待器。
"""

import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def get_user_interaction_tools() -> List[Dict[str, Any]]:
    """
    获取用户交互工具定义。

    Returns:
        工具定义列表
    """
    return [
        {
            "name": "ask_user",
            "description": (
                "向用户提问并等待响应。适用于需要用户输入或确认的场景。"
                "支持文本输入、确认（是/否）和选择（从选项中选择）三种模式。"
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "要问用户的问题",
                    },
                    "input_type": {
                        "type": "string",
                        "enum": ["text", "confirm", "select"],
                        "description": "输入类型：text-文本输入, confirm-确认(是/否), select-从选项中选择",
                    },
                    "options": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string", "description": "显示文本"},
                                "value": {"type": "string", "description": "选项值"},
                            },
                            "required": ["label", "value"],
                        },
                        "description": "选项列表（仅 input_type=select 时使用）",
                    },
                    "default": {
                        "type": "string",
                        "description": "默认值（仅 input_type=text 时使用）",
                    },
                },
                "required": ["question"],
            },
        },
        {
            "name": "user_confirm",
            "description": (
                "请求用户确认某个操作。简化版的 ask_user，专门用于确认场景。"
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "要确认的消息",
                    },
                    "default_yes": {
                        "type": "boolean",
                        "description": "默认是否为是",
                    },
                },
                "required": ["message"],
            },
        },
    ]


def bind_user_interaction_handlers(
    tool_handlers: Dict[str, Any],
    emitter: Any,
    waiter: Any,
) -> None:
    """
    绑定用户交互工具处理器到已存在的工具处理器字典。

    此函数在运行时调用，用于将 ask_user 和 user_confirm 的处理器
    绑定到工具系统中。

    Args:
        tool_handlers: 现有的工具处理器字典（将被修改）
        emitter: 事件发射器实例
        waiter: 响应等待器实例
    """

    async def handle_ask_user(**kwargs) -> str:
        """
        处理 ask_user 工具调用。

        Args:
            **kwargs: 工具参数

        Returns:
            用户响应结果
        """
        import asyncio
        import uuid

        question = kwargs.get("question", "")
        input_type = kwargs.get("input_type", "text")
        options = kwargs.get("options")
        default = kwargs.get("default")

        # 生成请求 ID
        request_id = f"req_{uuid.uuid4().hex[:8]}"

        # 创建等待请求
        await waiter.create_request(request_id)

        # 发射 ask_user 事件
        await emitter.emit_ask_user(
            request_id=request_id,
            question=question,
            input_type=input_type,
            options=options,
            default=default,
        )

        logger.info(f"[ask_user] 等待用户响应: {request_id}, 问题: {question[:50]}...")

        try:
            # 等待用户响应
            response = await waiter.wait_for_response(request_id, timeout=300.0)

            # 根据输入类型处理响应
            if input_type == "confirm":
                confirmed = response.get("confirmed", False)
                result = "用户确认: 是" if confirmed else "用户确认: 否"
            elif input_type == "select":
                selected = response.get("selected", "")
                result = f"用户选择: {selected}"
            else:
                text = response.get("response", "")
                result = f"用户回复: {text}"

            logger.info(f"[ask_user] 收到响应: {request_id}, 结果: {result}")
            return result

        except TimeoutError:
            error_msg = f"等待用户响应超时 (request_id: {request_id})"
            logger.warning(f"[ask_user] {error_msg}")
            return error_msg
        except Exception as e:
            error_msg = f"等待用户响应异常: {e}"
            logger.exception(f"[ask_user] {error_msg}")
            return error_msg

    async def handle_user_confirm(**kwargs) -> str:
        """
        处理 user_confirm 工具调用。

        Args:
            **kwargs: 工具参数

        Returns:
            确认结果
        """
        import asyncio
        import uuid

        message = kwargs.get("message", "是否确认?")
        default_yes = kwargs.get("default_yes", False)

        # 生成请求 ID
        request_id = f"req_{uuid.uuid4().hex[:8]}"

        # 创建等待请求
        await waiter.create_request(request_id)

        # 发射 ask_user 事件（使用 confirm 类型）
        await emitter.emit_ask_user(
            request_id=request_id,
            question=message,
            input_type="confirm",
        )

        logger.info(f"[user_confirm] 等待用户确认: {request_id}")

        try:
            # 等待用户响应
            response = await waiter.wait_for_response(request_id, timeout=300.0)

            confirmed = response.get("confirmed", default_yes)
            result = "用户确认: 是" if confirmed else "用户确认: 否"

            logger.info(f"[user_confirm] 收到确认: {request_id}, 结果: {result}")
            return result

        except TimeoutError:
            # 超时使用默认值
            result = f"用户未响应，使用默认值: {'是' if default_yes else '否'}"
            logger.warning(f"[user_confirm] 超时: {request_id}, {result}")
            return result
        except Exception as e:
            error_msg = f"等待用户确认异常: {e}"
            logger.exception(f"[user_confirm] {error_msg}")
            return error_msg

    # 绑定处理器到工具字典
    tool_handlers["ask_user"] = handle_ask_user
    tool_handlers["user_confirm"] = handle_user_confirm
