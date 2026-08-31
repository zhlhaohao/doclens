"""Chat SSE 专用 EventEmitter — 收集流式事件并直推 SSE 队列。

双职责：
1. 积累（tool_calls 配对回填、正文 text_parts、pending_asks）——供
   chat.py 完成后的参考资料策展与原始轮次落库使用；
2. 运输（emit 即 asyncio.Queue.put_nowait）——与 StreamingAgent 跑在
   同一个 ASGI 事件循环上，事件发生处直接入队，天然保序，
   无需旧版的「生成线程 + _feed 轮询 diff」桥接。

token 不实时推（缓冲到 done 后整体推策展文本）——与旧版一致的
展示取舍：正文要过参考资料策展重写，边流边推会造成内容跳变。

ask_user_question 事件（input_type="questions"）收集到 pending_asks
并直推 SSE "ask" 事件；其余 ask_user 形态（旧工具）在 GUI 工具集中
已被过滤，正常不会到达这里，到达时记录告警。
"""

import logging
import time
from typing import Any, Dict, List, Optional

from planify.streaming.types import StreamEvent, StreamEventType

logger = logging.getLogger(__name__)


class ChatEventEmitter:
    """收集 + 直推：emit 在事件循环上被 await 调用，put_nowait 安全。"""

    def __init__(self, queue: Optional[Any] = None):
        # queue: asyncio.Queue，属主与 emit 调用方同为 ASGI 主 loop
        self.queue = queue
        self.text_parts: list[str] = []
        self.tool_calls: list[dict] = []
        self.pending_asks: list[dict] = []
        self.done: bool = False
        self.error: Optional[str] = None

    def _push(self, ev: dict) -> None:
        """事件直达 SSE 队列（emit 处同步入队，顺序与发生顺序一致）。"""
        if self.queue is not None:
            self.queue.put_nowait(ev)

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
                call = {
                    "tool_use_id": event.data.get("tool_use_id", ""),
                    "name": event.data.get("name", ""),
                    "input": event.data.get("input", {}),
                    "_t0": time.monotonic(),
                }
                self.tool_calls.append(call)
                self._push({
                    "type": "tool_call",
                    "tool_use_id": call["tool_use_id"],
                    "name": call["name"],
                    "input": call["input"],
                })

        elif event.event_type == StreamEventType.TOOL_RESULT:
            tool_use_id = event.data.get("tool_use_id", "")
            name = event.data.get("name", "")
            output = event.data.get("output", "")
            is_error = event.data.get("is_error", False)

            def _fill(tc: dict) -> int:
                duration_ms = int((time.monotonic() - tc.pop("_t0", time.monotonic())) * 1000)
                tc["tool_use_id"] = tool_use_id
                tc["output"] = output
                tc["is_error"] = is_error
                tc["duration_ms"] = duration_ms
                return duration_ms

            # 优先按 tool_use_id 匹配未回填的调用
            matched = False
            for tc in reversed(self.tool_calls):
                if tc.get("tool_use_id") == tool_use_id and tool_use_id and "output" not in tc:
                    duration_ms = _fill(tc)
                    matched = True
                    break
            if not matched:
                # 降级：按 name 匹配未回填的调用
                for tc in reversed(self.tool_calls):
                    if tc.get("name") == name and "output" not in tc:
                        duration_ms = _fill(tc)
                        matched = True
                        break
            if not matched:
                # 没找到对应调用，单独记录
                self.tool_calls.append({
                    "tool_use_id": tool_use_id, "name": name,
                    "output": output, "is_error": is_error,
                })
                duration_ms = None

            self._push({
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "name": name,
                "output": output,
                "is_error": is_error,
                "duration_ms": duration_ms,
            })

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
        # 结构化问答（input_type="questions"）：question 携带 JSON 化的 questions
        if input_type == "questions":
            ask_ev = {
                "request_id": request_id,
                "question": question,
            }
            self.pending_asks.append(ask_ev)
            self._push({
                "type": "ask",
                "request_id": request_id,
                "questions_json": question,
            })
            return
        # 旧工具形态不应出现在 GUI（工具集已过滤），兜底告警不吞细节
        logger.warning("legacy ask_user not supported in SSE mode: %s", question)

    async def emit_done(self, session_id: str, summary: Optional[str] = None) -> None:
        await self.emit(StreamEvent(event_type=StreamEventType.DONE, data={"session_id": session_id}))

    async def emit_error(self, error: str, code: Optional[str] = None) -> None:
        await self.emit(StreamEvent(event_type=StreamEventType.ERROR, data={"error": error, "code": code}))
