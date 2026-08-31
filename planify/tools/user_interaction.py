#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用户交互工具

定义 ask_user / user_confirm / ask_user_question 工具，支持代理与用户交互。
这些工具需要运行时绑定事件发射器和响应等待器。

ask_user_question 复制 Claude Code AskUserQuestion 的结构化问答方案：
1-4 个问题一次打包、每问 2-4 个选项（label + description）、单选/多选、
推荐项首位约定。GUI（web SSE）链路真实交互；旧 ask_user 保留给 TUI/CLI。
"""

import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# 结构化问答常量（与 AskUserQuestion 原版对齐）
ASK_MAX_QUESTIONS = 4
ASK_MIN_QUESTIONS = 1
ASK_MAX_OPTIONS = 4
ASK_MIN_OPTIONS = 2
ASK_MAX_HEADER_CHARS = 12
ASK_TIMEOUT_SECONDS = 300.0
# input_type 判别值：旧协议 emit_ask_user(question, input_type, options, default)
# 以此标记 question 字段携带 JSON 序列化的 questions 数组
ASK_INPUT_TYPE_QUESTIONS = "questions"


def get_ask_user_question_tool() -> Dict[str, Any]:
    """
    获取 ask_user_question 工具定义（英文 schema，贴近 Anthropic 原版）。

    Returns:
        工具定义
    """
    return {
        "name": "ask_user_question",
        "description": (
            "Use this tool ONLY when you are blocked on a decision that is "
            "genually the user's to make: one you cannot resolve from the "
            "request, the code, or sensible defaults. Package 1-4 related "
            "questions into a single call to minimize interruptions. For each "
            "question provide 2-4 mutually exclusive options (or multi-select "
            "when choices are not exclusive) with a short label and a "
            "description of consequences. If you recommend a specific option, "
            "put it FIRST and prefix its label with '(Recommended)'. The "
            "frontend always offers a free-text 'Other' fallback per question."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "questions": {
                    "type": "array",
                    "minItems": ASK_MIN_QUESTIONS,
                    "maxItems": ASK_MAX_QUESTIONS,
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": {
                                "type": "string",
                                "description": (
                                    "The complete question. Clear, specific, "
                                    "ending with a question mark."
                                ),
                            },
                            "header": {
                                "type": "string",
                                "description": (
                                    "Very short label displayed as a chip "
                                    "(max 12 characters)."
                                ),
                            },
                            "multiSelect": {
                                "type": "boolean",
                                "description": (
                                    "true = allow multiple answers (checkboxes); "
                                    "false = single choice (radio)."
                                ),
                            },
                            "options": {
                                "type": "array",
                                "minItems": ASK_MIN_OPTIONS,
                                "maxItems": ASK_MAX_OPTIONS,
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "label": {
                                            "type": "string",
                                            "description": "Concise option label (1-5 words).",
                                        },
                                        "description": {
                                            "type": "string",
                                            "description": (
                                                "Why choose this / what happens if chosen."
                                            ),
                                        },
                                    },
                                    "required": ["label", "description"],
                                },
                            },
                        },
                        "required": ["question", "header", "options"],
                    },
                },
            },
            "required": ["questions"],
        },
    }


def validate_ask_questions(questions: Any) -> List[Dict[str, Any]]:
    """
    校验 ask_user_question 的 questions 入参。

    Args:
        questions: 模型产出的 questions 数组

    Returns:
        清洗后的 questions 列表

    Raises:
        ValueError: 校验失败（含具体原因）
    """
    if not isinstance(questions, list) or not (
        ASK_MIN_QUESTIONS <= len(questions) <= ASK_MAX_QUESTIONS
    ):
        raise ValueError(
            f"questions must be a list of {ASK_MIN_QUESTIONS}-{ASK_MAX_QUESTIONS} items"
        )

    cleaned: List[Dict[str, Any]] = []
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            raise ValueError(f"questions[{i}] must be an object")

        question_text = str(q.get("question", "")).strip()
        if not question_text:
            raise ValueError(f"questions[{i}].question must be a non-empty string")

        header = str(q.get("header", "")).strip()
        if len(header) > ASK_MAX_HEADER_CHARS:
            raise ValueError(
                f"questions[{i}].header must be at most {ASK_MAX_HEADER_CHARS} characters"
            )

        options = q.get("options")
        if not isinstance(options, list) or not (
            ASK_MIN_OPTIONS <= len(options) <= ASK_MAX_OPTIONS
        ):
            raise ValueError(
                f"questions[{i}].options must be a list of "
                f"{ASK_MIN_OPTIONS}-{ASK_MAX_OPTIONS} items"
            )

        cleaned_options: List[Dict[str, str]] = []
        for j, opt in enumerate(options):
            if not isinstance(opt, dict):
                raise ValueError(f"questions[{i}].options[{j}] must be an object")
            label = str(opt.get("label", "")).strip()
            description = str(opt.get("description", "")).strip()
            if not label or not description:
                raise ValueError(
                    f"questions[{i}].options[{j}] requires non-empty label and description"
                )
            cleaned_options.append({"label": label, "description": description})

        multi_select = bool(q.get("multiSelect", False))

        cleaned.append(
            {
                "question": question_text,
                "header": header,
                "multiSelect": multi_select,
                "options": cleaned_options,
            }
        )

    return cleaned



def get_user_interaction_tools(include_ask_question: bool = False) -> List[Dict[str, Any]]:
    """
    获取用户交互工具定义。

    Args:
        include_ask_question: 是否包含 ask_user_question（GUI 专用，
            TUI/CLI 默认 False 继续用旧工具）

    Returns:
        工具定义列表
    """
    tools_list = [
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

    if include_ask_question:
        tools_list.append(get_ask_user_question_tool())

    return tools_list


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

            # 中断传播：停止生成时 waiter 主动唤醒，返回中断说明（agent 在
            # 下一个检查点退出，不再干等 300s 超时）
            if response.get("interrupted"):
                logger.info(f"[ask_user] 等待被中断: {request_id}")
                return "用户中断了本次提问（生成已停止）"

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

            if response.get("interrupted"):
                logger.info(f"[user_confirm] 等待被中断: {request_id}")
                return "用户中断了本次确认（生成已停止）"

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


def bind_ask_user_question_handler(
    tool_handlers: Dict[str, Any],
    emitter: Any,
    waiter: Any,
) -> None:
    """
    绑定 ask_user_question 处理器（GUI 结构化问答）。

    事件经旧协议 emit_ask_user 传递：input_type="questions" 作为判别标记，
    question 字段携带 JSON 序列化的 questions 数组。响应经 waiter 回传，
    以结构化 JSON 作为 tool_result 回填给模型。

    Args:
        tool_handlers: 工具处理器字典（将被修改）
        emitter: 事件发射器实例（需实现 emit_ask_user）
        waiter: 响应等待器实例
    """
    import uuid

    async def handle_ask_user_question(**kwargs) -> str:
        """
        处理 ask_user_question 工具调用。

        Args:
            **kwargs: 工具参数（questions 数组）

        Returns:
            结构化 JSON 答案（或错误/超时说明）
        """
        raw_questions = kwargs.get("questions")

        # 入参校验：违规直接以错误字符串回填，模型可自行纠正后重试
        try:
            questions = validate_ask_questions(raw_questions)
        except ValueError as e:
            error_msg = f"Error: invalid ask_user_question input: {e}"
            logger.warning("[ask_user_question] %s", error_msg)
            return error_msg

        request_id = f"req_{uuid.uuid4().hex[:8]}"
        await waiter.create_request(request_id)

        # 旧协议传递：question 字段携带 JSON 化的 questions
        await emitter.emit_ask_user(
            request_id=request_id,
            question=json.dumps(
                {"questions": questions}, ensure_ascii=False
            ),
            input_type=ASK_INPUT_TYPE_QUESTIONS,
        )

        logger.info(
            "[ask_user_question] 等待用户响应: %s, %d 个问题",
            request_id, len(questions),
        )

        try:
            response = await waiter.wait_for_response(
                request_id, timeout=ASK_TIMEOUT_SECONDS
            )
            if response.get("interrupted"):
                # 停止生成时 waiter 主动唤醒：返回中断说明，agent 在下一个
                # 检查点退出——修复「ask 挂起期间点停止无效、干等 300s」缺口
                result = json.dumps(
                    {"error": "interrupted", "request_id": request_id},
                    ensure_ascii=False,
                )
                logger.info("[ask_user_question] 等待被中断: %s", request_id)
                return result
            answers = response.get("answers")
            if not isinstance(answers, list):
                # 响应结构异常：原样回传，让模型看到真实数据
                answers = [{"raw": answers}] if answers is not None else []

            result = json.dumps(
                {"answers": answers, "request_id": request_id},
                ensure_ascii=False,
            )
            logger.info("[ask_user_question] 收到响应: %s", request_id)
            return result

        except TimeoutError:
            result = json.dumps(
                {"error": "timeout", "request_id": request_id},
                ensure_ascii=False,
            )
            logger.warning("[ask_user_question] 等待超时: %s", request_id)
            return result
        except Exception as e:  # noqa: BLE001
            error_msg = f"Error: ask_user_question failed: {e}"
            logger.exception("[ask_user_question] %s", error_msg)
            return error_msg

    tool_handlers["ask_user_question"] = handle_ask_user_question

