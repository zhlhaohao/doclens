#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
流式类型定义

定义流式代理系统所需的核心类型：
- StreamEvent: 流式事件数据类
- EventEmitter: 事件发射器协议
- UserResponseWaiter: 用户响应等待器协议
- StreamingConfig: 流式配置
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable


class StreamEventType(Enum):
    """流式事件类型枚举"""

    TEXT = "text"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    ASK_USER = "ask_user"
    DONE = "done"
    ERROR = "error"
    HEARTBEAT = "heartbeat"


@dataclass
class StreamEvent:
    """
    流式事件数据类

    统一表示所有类型的流式事件。
    """

    event_type: StreamEventType
    data: Dict[str, Any] = field(default_factory=dict)

    # 便捷属性
    @property
    def type(self) -> str:
        """获取事件类型字符串"""
        return self.event_type.value

    def to_sse_dict(self) -> Dict[str, Any]:
        """
        转换为 SSE 事件字典格式。

        Returns:
            包含 type 和所有数据的字典
        """
        result = {"type": self.type}
        result.update(self.data)
        return result


@runtime_checkable
class EventEmitter(Protocol):
    """
    事件发射器协议

    定义如何发射流式事件。实现此协议的类可以将事件
    发送到不同的目标（SSE、WebSocket、内存队列等）。

    便捷方法（emit_text / emit_tool_call 等）自带默认实现——统一包成
    StreamEvent 后调 ``self.emit``。显式继承本协议的实现类只需实现
    ``emit()`` 一个方法；有特殊逻辑的便捷方法（如 CLI/TUI 的
    emit_ask_questions）按需覆盖。
    """

    async def emit(self, event: StreamEvent) -> None:
        """
        发射一个流式事件。

        Args:
            event: 要发射的事件
        """
        ...

    async def emit_text(self, content: str, is_end: bool = False) -> None:
        """
        发射文本事件的便捷方法。

        Args:
            content: 文本内容
            is_end: 是否为最后一个文本块
        """
        await self.emit(
            StreamEvent(
                event_type=StreamEventType.TEXT,
                data={"content": content, "is_end": is_end},
            )
        )

    async def emit_tool_call(
        self,
        tool_use_id: str,
        name: str,
        input_data: Dict[str, Any],
        is_complete: bool = False,
    ) -> None:
        """
        发射工具调用事件的便捷方法。

        Args:
            tool_use_id: 工具调用 ID
            name: 工具名称
            input_data: 输入参数
            is_complete: 参数是否完整
        """
        await self.emit(
            StreamEvent(
                event_type=StreamEventType.TOOL_CALL,
                data={
                    "tool_use_id": tool_use_id,
                    "name": name,
                    "input": input_data,
                    "is_complete": is_complete,
                },
            )
        )

    async def emit_tool_result(
        self,
        tool_use_id: str,
        name: str,
        output: str,
        is_error: bool = False,
    ) -> None:
        """
        发射工具结果事件的便捷方法。

        Args:
            tool_use_id: 工具调用 ID
            name: 工具名称
            output: 输出结果
            is_error: 是否为错误
        """
        await self.emit(
            StreamEvent(
                event_type=StreamEventType.TOOL_RESULT,
                data={
                    "tool_use_id": tool_use_id,
                    "name": name,
                    "output": output,
                    "is_error": is_error,
                },
            )
        )

    async def emit_ask_user(
        self,
        request_id: str,
        question: str,
        input_type: str = "text",
        options: Optional[List[Dict[str, str]]] = None,
        default: Optional[str] = None,
    ) -> None:
        """
        发射用户输入请求事件的便捷方法（旧 ask_user / user_confirm 工具用）。

        Args:
            request_id: 请求 ID
            question: 问题内容
            input_type: 输入类型
            options: 选项列表
            default: 默认值
        """
        data: Dict[str, Any] = {
            "request_id": request_id,
            "question": question,
            "input_type": input_type,
        }
        if options is not None:
            data["options"] = options
        if default is not None:
            data["default"] = default
        await self.emit(StreamEvent(event_type=StreamEventType.ASK_USER, data=data))

    async def emit_ask_questions(
        self,
        request_id: str,
        questions: List[Dict[str, Any]],
    ) -> None:
        """
        发射结构化问答请求（ask_user_question 工具的一等协议）。

        questions 为校验后的结构化数组（question/header/multiSelect/options），
        直接以数据结构传递——不再经旧 emit_ask_user 通道塞 JSON 字符串。

        Args:
            request_id: 请求 ID
            questions: 结构化问题数组（1-4 问，每问 2-4 选项）
        """
        await self.emit(
            StreamEvent(
                event_type=StreamEventType.ASK_USER,
                data={
                    "request_id": request_id,
                    "questions": questions,
                    "input_type": "questions",
                },
            )
        )

    async def emit_done(self, session_id: str, summary: Optional[str] = None) -> None:
        """
        发射完成事件。

        Args:
            session_id: 会话 ID
            summary: 执行摘要
        """
        data: Dict[str, Any] = {"session_id": session_id}
        if summary is not None:
            data["summary"] = summary
        await self.emit(StreamEvent(event_type=StreamEventType.DONE, data=data))

    async def emit_error(self, error: str, code: Optional[str] = None) -> None:
        """
        发射错误事件。

        Args:
            error: 错误信息
            code: 错误码
        """
        data: Dict[str, Any] = {"error": error}
        if code is not None:
            data["code"] = code
        await self.emit(StreamEvent(event_type=StreamEventType.ERROR, data=data))


@runtime_checkable
class UserResponseWaiter(Protocol):
    """
    用户响应等待器协议

    定义如何等待用户通过 Web 界面提交的响应。
    """

    async def wait_for_response(
        self,
        request_id: str,
        timeout: float = 300.0,
    ) -> Dict[str, Any]:
        """
        等待用户响应。

        Args:
            request_id: 请求 ID
            timeout: 超时时间（秒），默认 5 分钟

        Returns:
            用户响应数据

        Raises:
            TimeoutError: 等待超时
        """
        ...

    def submit_response(self, request_id: str, response: Dict[str, Any]) -> bool:
        """
        提交用户响应。

        Args:
            request_id: 请求 ID
            response: 响应数据

        Returns:
            是否成功提交（如果 request_id 不存在则返回 False）
        """
        ...


@dataclass
class StreamingConfig:
    """
    流式代理配置

    包含流式代理运行所需的所有配置参数。
    """

    # 模型配置
    model_id: str = "claude-sonnet-4-6"
    max_tokens: int = 8000

    # 上下文配置（阈值由 caller 传入 = model.context_window × 0.8；此处为硬编码兜底）
    compact_threshold: int = 160000

    # 超时配置
    user_response_timeout: float = 300.0  # 5 分钟
    tool_execution_timeout: float = 120.0  # 2 分钟

    # 心跳配置
    heartbeat_interval: float = 30.0  # 30 秒

    # 输出配置
    truncate_tool_output: int = 5000  # 工具输出截断长度


@dataclass
class ToolCallState:
    """
    工具调用状态

    用于跟踪增量工具调用参数的累积状态。
    """

    tool_use_id: str
    name: str
    input_json_chunks: List[str] = field(default_factory=list)

    def append_chunk(self, chunk: str) -> None:
        """追加 JSON 片段"""
        self.input_json_chunks.append(chunk)

    def get_complete_input(self) -> Dict[str, Any]:
        """获取完整的输入参数。

        Returns:
            解析后的参数字典。流式累积失败时返回 ``{"_parse_error": <raw>}``
            而非 ``{}``——后者会丢失调试信息，前者会让 handler 在收到未知
            kwarg 时明确报错（而不是默默接收 ``raw=...`` 然后语义错乱）。
        """
        import json

        full_json = "".join(self.input_json_chunks)
        if not full_json:
            return {}
        try:
            return json.loads(full_json)
        except json.JSONDecodeError:
            return {"_parse_error": full_json}
