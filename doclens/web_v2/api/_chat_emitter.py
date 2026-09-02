"""Chat SSE 专用 EventEmitter — 收集流式事件并直推 SSE 队列。

双职责：
1. 积累（tool_calls 配对回填、正文 text_parts）——供 chat.py 完成后的
   参考资料策展与原始轮次落库使用；
2. 运输（emit 即 asyncio.Queue.put_nowait）——与 StreamingAgent 跑在
   同一个 ASGI 事件循环上，事件发生处直接入队，天然保序，
   无需旧版的「生成线程 + _feed 轮询 diff」桥接。

token 不实时推（缓冲到 done 后整体推策展文本）——与旧版一致的
展示取舍：正文要过参考资料策展重写，边流边推会造成内容跳变。

推送的事件字典一律经 ``_chat_events`` 构造函数生成（字段名单一真相源）。

ask_user_question 结构化问答经一等协议 ``emit_ask_questions`` 到达：
questions 为结构化数组直推 SSE "ask" 事件（前端免二次 JSON.parse）。
悬置 ask 的中断唤醒由 waiter.interrupt_session 负责（会话维度索引在
waiter 侧），emitter 不再维护 pending_asks 影子表。
旧 ask_user 形态（旧工具）在 GUI 工具集中已被过滤，正常不会到达这里，
到达时记录告警。
"""

import logging
import time
from typing import Any, Dict, List, Optional

from planify.streaming.types import EventEmitter, StreamEvent, StreamEventType

from ._chat_events import ask_event, tool_call_event, tool_result_event

logger = logging.getLogger(__name__)


class ChatEventEmitter(EventEmitter):
    """收集 + 直推：emit 在事件循环上被 await 调用，put_nowait 安全。

    协议的便捷方法（emit_text/emit_tool_call/emit_tool_result/emit_done/
    emit_error）用 EventEmitter 默认实现（包 StreamEvent 走 self.emit）；
    只保留三个真实定制：emit（积累+直推）、emit_ask_questions（直推
    ask_event）、emit_ask_user（legacy 告警）。
    """

    def __init__(self, queue: Optional[Any] = None):
        # queue: asyncio.Queue，属主与 emit 调用方同为 ASGI 主 loop
        self.queue = queue
        self.text_parts: list[str] = []
        self.tool_calls: list[dict] = []
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
                # 线格式与 StreamEvent.data 同构（to_sse_dict 等价形态，
                # 经共享构造函数成形）
                self._push(
                    tool_call_event(
                        tool_use_id=call["tool_use_id"],
                        name=call["name"],
                        input_data=call["input"],
                        is_complete=True,
                    )
                )

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

            self._push(
                tool_result_event(
                    tool_use_id=tool_use_id,
                    name=name,
                    output=output,
                    is_error=is_error,
                    duration_ms=duration_ms,
                )
            )

        elif event.event_type == StreamEventType.DONE:
            self.done = True

        elif event.event_type == StreamEventType.ERROR:
            self.error = event.data.get("error", "未知错误")
            self.done = True

    # ---- EventEmitter 协议定制（其余便捷方法用协议默认实现） ----

    async def emit_ask_questions(
        self,
        request_id: str,
        questions: List[Dict[str, Any]],
    ) -> None:
        """结构化问答（ask_user_question 一等协议）：questions 数组直推。"""
        self._push(ask_event(request_id, questions))

    async def emit_ask_user(
        self,
        request_id: str,
        question: str,
        input_type: str = "text",
        options: Optional[List[Dict[str, str]]] = None,
        default: Optional[str] = None,
    ) -> None:
        # 旧工具形态不应出现在 GUI（工具集已过滤），兜底告警不吞细节。
        # （ask_user_question 已迁一等协议 emit_ask_questions，不再走此通道）
        logger.warning("legacy ask_user not supported in SSE mode: %s", question)
