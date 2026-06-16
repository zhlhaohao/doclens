"""Chat SSE 专用 EventEmitter — 收集流式文本供 /api/chat SSE 端点消费。

从旧 cortex/web/emitter.py 内联而来，移除对 Gradio 的依赖。
"""

import logging
from typing import Any, Dict, List, Optional

from planify.streaming.types import StreamEvent, StreamEventType

logger = logging.getLogger(__name__)


class GradioEventEmitter:
    """
    收集流式事件到缓冲区，供 chat SSE generator 读取。

    不直接打印，而是将文本增量和工具信息追加到内部缓冲区。
    chat.py 的生成器函数定时读取缓冲区内容来产出 SSE token。
    """

    def __init__(self):
        self.text_parts: list[str] = []
        self.tool_calls: list[dict] = []
        self.done: bool = False
        self.error: Optional[str] = None

    def get_full_text(self) -> str:
        """获取当前累积的全部文本"""
        return "".join(self.text_parts)

    def get_display_text(self) -> str:
        """获取带工具调用标注的完整显示文本"""
        parts = []
        text = self.get_full_text()
        if text:
            parts.append(text)
        for tc in self.tool_calls:
            name = tc.get("name", "")
            if tc.get("output"):
                output = tc["output"]
                if len(output) > 300:
                    output = output[:300] + "..."
                parts.append(f"\n\n**🔧 {name}**\n```\n{output}\n```")
        return "".join(parts)

    async def emit(self, event: StreamEvent) -> None:
        if event.event_type == StreamEventType.TEXT:
            content = event.data.get("content", "")
            if content:
                self.text_parts.append(content)

        elif event.event_type == StreamEventType.TOOL_CALL:
            if event.data.get("is_complete", False):
                self.tool_calls.append({
                    "name": event.data.get("name", ""),
                    "input": event.data.get("input", {}),
                })

        elif event.event_type == StreamEventType.TOOL_RESULT:
            name = event.data.get("name", "")
            output = event.data.get("output", "")
            is_error = event.data.get("is_error", False)
            # 更新最后一个同名工具调用的输出
            for tc in reversed(self.tool_calls):
                if tc["name"] == name and "output" not in tc:
                    tc["output"] = output
                    break
            else:
                # 没找到对应工具调用，单独记录
                self.tool_calls.append({"name": name, "output": output, "is_error": is_error})

        elif event.event_type == StreamEventType.DONE:
            self.done = True

        elif event.event_type == StreamEventType.ERROR:
            self.error = event.data.get("error", "未知错误")
            self.done = True

    # ---- EventEmitter 协议便捷方法 ----

    async def emit_text(self, content: str, is_end: bool = False) -> None:
        await self.emit(StreamEvent(
            event_type=StreamEventType.TEXT,
            data={"content": content, "is_end": is_end},
        ))

    async def emit_tool_call(
        self,
        tool_use_id: str,
        name: str,
        input_data: Dict[str, Any],
        is_complete: bool = False,
    ) -> None:
        await self.emit(StreamEvent(
            event_type=StreamEventType.TOOL_CALL,
            data={
                "tool_use_id": tool_use_id,
                "name": name,
                "input": input_data,
                "is_complete": is_complete,
            },
        ))

    async def emit_tool_result(
        self,
        tool_use_id: str,
        name: str,
        output: str,
        is_error: bool = False,
    ) -> None:
        await self.emit(StreamEvent(
            event_type=StreamEventType.TOOL_RESULT,
            data={
                "tool_use_id": tool_use_id,
                "name": name,
                "output": output,
                "is_error": is_error,
            },
        ))

    async def emit_ask_user(
        self,
        request_id: str,
        question: str,
        input_type: str = "text",
        options: Optional[List[Dict[str, str]]] = None,
        default: Optional[str] = None,
    ) -> None:
        # SSE 模式暂不支持 ask_user，记录日志
        logger.warning("ask_user not supported in SSE mode: %s", question)

    async def emit_done(self, session_id: str, summary: Optional[str] = None) -> None:
        await self.emit(StreamEvent(event_type=StreamEventType.DONE, data={"session_id": session_id}))

    async def emit_error(self, error: str, code: Optional[str] = None) -> None:
        await self.emit(StreamEvent(event_type=StreamEventType.ERROR, data={"error": error, "code": code}))
