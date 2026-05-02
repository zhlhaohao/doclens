#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SSE 事件发射器

实现 EventEmitter 协议，将事件格式化为 SSE 格式并通过异步生成器输出。
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    pass  # 用于类型检查时的导入

from .types import StreamEvent, StreamEventType, EventEmitter
from .waiter import get_global_waiter

logger = logging.getLogger(__name__)


class SSEEmitter(EventEmitter):
    """
    SSE 事件发射器

    将事件放入异步队列，支持通过异步生成器消费事件。
    线程安全，支持从不同线程添加事件。
    """

    def __init__(self, heartbeat_interval: float = 30.0):
        """
        初始化 SSE 发射器。

        Args:
            heartbeat_interval: 心跳间隔（秒），0 表示禁用
        """
        self._queue: asyncio.Queue[Optional[StreamEvent]] = asyncio.Queue()
        self._heartbeat_interval = heartbeat_interval
        self._closed = False
        self._lock = asyncio.Lock()

    async def emit(self, event: StreamEvent) -> None:
        """
        发射一个流式事件。

        Args:
            event: 要发射的事件
        """
        if self._closed:
            logger.warning(f"SSEEmitter 已关闭，忽略事件: {event.type}")
            return

        await self._queue.put(event)

        # 记录事件
        event_summary = event.to_sse_dict()
        if event.event_type == StreamEventType.TEXT:
            logger.debug(f"[SSE] 发射文本事件: {event.data.get('content', '')[:50]}...")
        elif event.event_type == StreamEventType.TOOL_CALL:
            logger.info(f"[SSE] 发射工具调用事件: {event.data.get('name', 'unknown')}")
        elif event.event_type == StreamEventType.TOOL_RESULT:
            logger.info(f"[SSE] 发射工具结果事件: {event.data.get('name', 'unknown')}")
        elif event.event_type == StreamEventType.ASK_USER:
            logger.info(f"[SSE] 发射用户输入请求: {event.data.get('request_id', 'unknown')}")
        elif event.event_type == StreamEventType.ERROR:
            logger.error(f"[SSE] 发射错误事件: {event.data.get('error', 'unknown')}")
        elif event.event_type == StreamEventType.DONE:
            logger.info("[SSE] 发射完成事件")

    async def emit_text(self, content: str, is_end: bool = False) -> None:
        """发射文本事件"""
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
        """发射工具调用事件"""
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
        """发射工具结果事件"""
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
        """发射用户输入请求事件"""
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

    async def emit_done(self, session_id: str, summary: Optional[str] = None) -> None:
        """发射完成事件"""
        data: Dict[str, Any] = {"session_id": session_id}
        if summary is not None:
            data["summary"] = summary

        await self.emit(StreamEvent(event_type=StreamEventType.DONE, data=data))

    async def emit_error(self, error: str, code: Optional[str] = None) -> None:
        """发射错误事件"""
        data: Dict[str, Any] = {"error": error}
        if code is not None:
            data["code"] = code

        await self.emit(StreamEvent(event_type=StreamEventType.ERROR, data=data))

    async def emit_heartbeat(self) -> None:
        """发射心跳事件"""
        await self.emit(StreamEvent(event_type=StreamEventType.HEARTBEAT))

    def close(self) -> None:
        """关闭发射器，停止事件流"""
        self._closed = True
        # 放入 None 作为结束信号
        self._queue.put_nowait(None)

    async def event_stream(self) -> Any:
        """
        生成 SSE 事件流的异步生成器。

        Yields:
            格式化的 SSE 事件字符串
        """
        last_event_time = asyncio.get_event_loop().time()

        while True:
            try:
                # 计算等待时间
                wait_time = (
                    self._heartbeat_interval
                    if self._heartbeat_interval > 0 and not self._closed
                    else None
                )

                # 尝试获取事件
                if wait_time:
                    elapsed = asyncio.get_event_loop().time() - last_event_time
                    remaining = max(0, wait_time - elapsed)

                    try:
                        event = await asyncio.wait_for(
                            self._queue.get(), timeout=remaining
                        )
                    except asyncio.TimeoutError:
                        # 发送心跳
                        if not self._closed:
                            yield f": heartbeat\n\n"
                            last_event_time = asyncio.get_event_loop().time()
                        continue
                else:
                    event = await self._queue.get()

                # None 表示流结束
                if event is None:
                    logger.debug("[SSE] 事件流结束")
                    break

                # 格式化并输出事件
                event_data = event.to_sse_dict()
                json_str = json.dumps(event_data, ensure_ascii=False)
                yield f"data: {json_str}\n\n"
                last_event_time = asyncio.get_event_loop().time()

                # 如果是完成或错误事件，结束流
                if event.event_type in (StreamEventType.DONE, StreamEventType.ERROR):
                    logger.debug(f"[SSE] 终止事件: {event.type}")
                    break

            except asyncio.CancelledError:
                logger.debug("[SSE] 事件流被取消")
                break
            except Exception as e:
                logger.exception(f"[SSE] 事件流异常: {e}")
                break


class QueueEmitter(EventEmitter):
    """
    队列发射器

    简化版发射器，只将事件放入队列，不处理 SSE 格式化。
    适用于内部事件传递或测试。
    """

    def __init__(self):
        """初始化队列发射器"""
        self._queue: asyncio.Queue[StreamEvent] = asyncio.Queue()

    async def emit(self, event: StreamEvent) -> None:
        """发射事件到队列"""
        await self._queue.put(event)

    async def emit_text(self, content: str, is_end: bool = False) -> None:
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

    async def emit_done(self, session_id: str, summary: Optional[str] = None) -> None:
        data: Dict[str, Any] = {"session_id": session_id}
        if summary is not None:
            data["summary"] = summary
        await self.emit(StreamEvent(event_type=StreamEventType.DONE, data=data))

    async def emit_error(self, error: str, code: Optional[str] = None) -> None:
        data: Dict[str, Any] = {"error": error}
        if code is not None:
            data["code"] = code
        await self.emit(StreamEvent(event_type=StreamEventType.ERROR, data=data))

    def get_queue(self) -> asyncio.Queue[StreamEvent]:
        """获取内部队列"""
        return self._queue


class CLIEventEmitter(EventEmitter):
    """
    CLI 事件发射器

    同步版本的事件发射器，直接打印到终端（带颜色）。
    处理 ask_user 事件时同步获取用户输入。
    """

    def __init__(self, colors: Any = None, waiter: Any = None, interrupt_event: Any = None):
        """
        初始化 CLI 事件发射器。

        Args:
            colors: 颜色配置对象（需要 USER, TOOL_CALL, TOOL_RESULT, ASSISTANT, RESET 属性）
            waiter: 用户响应等待器，默认使用全局单例
            interrupt_event: 中断事件（用于判断是否被中断）
        """
        self.colors = colors or self._default_colors()
        self.waiter = waiter or get_global_waiter()
        self.interrupt_event = interrupt_event
        self._current_text_line = ""

    @staticmethod
    def _default_colors() -> Any:
        """创建默认颜色配置"""
        return type(
            "Colors",
            (),
            {
                "USER": "\033[36m",
                "TOOL_CALL": "\033[33m",
                "TOOL_RESULT": "\033[32m",
                "ASSISTANT": "\033[94m",
                "RESET": "\033[0m",
                "BOLD": "\033[1m",
            },
        )()

    async def emit(self, event: StreamEvent) -> None:
        """
        处理所有事件类型。

        Args:
            event: 要发射的事件
        """
        if event.event_type == StreamEventType.TEXT:
            self._print_text(event.data.get("content", ""))
        elif event.event_type == StreamEventType.TOOL_CALL:
            self._print_tool_call(
                event.data.get("name", ""),
                event.data.get("input", {}),
                event.data.get("is_complete", False),
            )
        elif event.event_type == StreamEventType.TOOL_RESULT:
            self._print_tool_result(
                event.data.get("name", ""),
                event.data.get("output", ""),
                event.data.get("is_error", False),
            )
        elif event.event_type == StreamEventType.ASK_USER:
            self._handle_ask_user(
                event.data.get("request_id", ""),
                event.data.get("question", ""),
                event.data.get("input_type", "text"),
                event.data.get("options"),
            )
        elif event.event_type == StreamEventType.DONE:
            # 检查是否被中断
            if self.interrupt_event and self.interrupt_event.is_set():
                print(f"\n{self.colors.ASSISTANT}[已中断]{self.colors.RESET}")
            else:
                print(f"\n{self.colors.ASSISTANT}[完成]{self.colors.RESET}")
        elif event.event_type == StreamEventType.ERROR:
            print(
                f"\n{self.colors.TOOL_RESULT}错误: {event.data.get('error', '')}{self.colors.RESET}"
            )

    def _print_text(self, content: str) -> None:
        """打印文本（流式）"""
        print(content, end="", flush=True)
        self._current_text_line += content

    def _print_tool_call(self, name: str, input_data: Dict, is_complete: bool) -> None:
        """打印工具调用"""
        # 文本块结束后换行
        if self._current_text_line:
            print()  # 换行
            self._current_text_line = ""

        if is_complete and input_data:
            args_str = json.dumps(input_data, ensure_ascii=False, indent=2)
            # 将转义的换行符替换为真实换行，让代码更易读
            args_str = args_str.replace("\\n", "\n")
            lines = args_str.split("\n")
            if len(lines) > 10:
                args_str = "\n".join(lines[:10]) + "\n  ..."
            print(
                f"\n{self.colors.TOOL_CALL}{self.colors.BOLD}Tool:{self.colors.RESET} "
                f"{self.colors.TOOL_CALL}{name}({args_str}){self.colors.RESET}\n"
            )

    def _print_tool_result(self, name: str, output: str, is_error: bool) -> None:
        """打印工具结果"""
        lines = output.split("\n")
        if len(lines) > 10:
            output = "\n".join(lines[:10]) + "\n  ..."
        color = self.colors.TOOL_RESULT if not is_error else self.colors.TOOL_CALL
        print(f"{color}{output}{self.colors.RESET}\n")

    def _handle_ask_user(
        self,
        request_id: str,
        question: str,
        input_type: str,
        options: Any,
    ) -> None:
        """
        处理用户输入请求（同步）。

        Args:
            request_id: 请求 ID
            question: 问题内容
            input_type: 输入类型
            options: 选项列表
        """
        print(f"\n{self.colors.USER}{self.colors.BOLD}问题:{self.colors.RESET} {question}")

        if input_type == "confirm":
            response = input("确认? (y/n) > ").strip().lower()
            confirmed = response in ("y", "yes", "是")
            self.waiter.submit_response(request_id, {"confirmed": confirmed})
        elif input_type == "select" and options:
            print("选项:")
            for i, opt in enumerate(options):
                label = opt.get("label", opt.get("value", ""))
                print(f"  {i + 1}. {label}")
            choice = input("选择 > ").strip()
            if choice.isdigit() and 1 <= int(choice) <= len(options):
                selected = options[int(choice) - 1].get("value", choice)
            else:
                selected = choice
            self.waiter.submit_response(request_id, {"selected": selected})
        else:
            response = input("输入 > ")
            self.waiter.submit_response(request_id, {"response": response})

    # 实现 EventEmitter 协议的便捷方法
    async def emit_text(self, content: str, is_end: bool = False) -> None:
        """发射文本事件"""
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
        """发射工具调用事件"""
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
        """发射工具结果事件"""
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
        """发射用户输入请求事件"""
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

    async def emit_done(self, session_id: str, summary: Optional[str] = None) -> None:
        """发射完成事件"""
        data: Dict[str, Any] = {"session_id": session_id}
        if summary is not None:
            data["summary"] = summary
        await self.emit(StreamEvent(event_type=StreamEventType.DONE, data=data))

    async def emit_error(self, error: str, code: Optional[str] = None) -> None:
        """发射错误事件"""
        data: Dict[str, Any] = {"error": error}
        if code is not None:
            data["code"] = code
        await self.emit(StreamEvent(event_type=StreamEventType.ERROR, data=data))
