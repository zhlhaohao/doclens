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
        ...

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
        ...

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
        ...

    async def emit_ask_user(
        self,
        request_id: str,
        question: str,
        input_type: str = "text",
        options: Optional[List[Dict[str, str]]] = None,
        default: Optional[str] = None,
    ) -> None:
        """
        发射用户输入请求事件的便捷方法。

        Args:
            request_id: 请求 ID
            question: 问题内容
            input_type: 输入类型
            options: 选项列表
            default: 默认值
        """
        ...

    async def emit_done(self, session_id: str, summary: Optional[str] = None) -> None:
        """
        发射完成事件。

        Args:
            session_id: 会话 ID
            summary: 执行摘要
        """
        ...

    async def emit_error(self, error: str, code: Optional[str] = None) -> None:
        """
        发射错误事件。

        Args:
            error: 错误信息
            code: 错误码
        """
        ...


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

    # 上下文配置
    token_threshold: int = 100000

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
        """
        获取完整的输入参数。

        Returns:
            解析后的参数字典
        """
        import json

        full_json = "".join(self.input_json_chunks)
        try:
            return json.loads(full_json) if full_json else {}
        except json.JSONDecodeError:
            return {"raw": full_json}
