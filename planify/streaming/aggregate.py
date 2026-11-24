"""纯同步流式聚合器（ADR-0060 §3）——lead（async）与 Bot（同步线程）共用的
单一聚合真相源。

输入是归一化 ``StreamEvent`` 序列（provider 的 ``stream`` / ``astream`` 归一化
输出），输出 ``(stop_reason, blocks, usage, current_text)``。事件副作用经三个可选
回调暴露（text 增量 / 工具开始 / 工具完成 / thinking 增量），调用方决定怎么发
（lead → emitter；Bot → TeamEventBus；测试 → 无回调）。

**同步**：lead 的 async 路径（``StreamingAgent._astream_once``）在它自己的
``async for`` 里逐事件喂给聚合器——await 只发生在事件获取上，聚合本身是纯计算。
Bot 在 ``threading.Thread`` 里直接 ``for event in provider.stream(...)`` 喂。
"""

from __future__ import annotations

from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from ..core.llm.types import StreamEvent
from .types import ToolCallState

OnText = Callable[[str], None]
OnThinking = Callable[[str], None]
OnToolStart = Callable[[str, str], None]
OnToolComplete = Callable[[str, str, Dict[str, Any]], None]


class StreamAggregator:
    """逐事件累积，产出与 lead ``_astream_once`` 同构的 blocks / stop_reason / usage。"""

    def __init__(
        self,
        on_text: Optional[OnText] = None,
        on_thinking: Optional[OnThinking] = None,
        on_tool_start: Optional[OnToolStart] = None,
        on_tool_complete: Optional[OnToolComplete] = None,
        assistant_content: Optional[List[Any]] = None,
        block_text_parts: Optional[Dict[int, List[str]]] = None,
        block_tool_states: Optional[Dict[int, ToolCallState]] = None,
        call_usage: Optional[Dict[str, int]] = None,
    ):
        self.on_text = on_text
        self.on_thinking = on_thinking
        self.on_tool_start = on_tool_start
        self.on_tool_complete = on_tool_complete
        # 外部可注入收集器（lead 的 429 重试复用同一批容器）
        self.assistant_content = assistant_content if assistant_content is not None else []
        self.block_text_parts = block_text_parts if block_text_parts is not None else {}
        self.block_tool_states = block_tool_states if block_tool_states is not None else {}
        self.call_usage = call_usage if call_usage is not None else {}
        self.stop_reason = "end_turn"
        self.current_text = ""

    def feed(self, event: StreamEvent) -> bool:
        """消费一个事件；返回 False 表示应停止迭代（message_stop）。"""
        if event.usage:
            for k, v in event.usage.items():
                # 同键取最大：message_start 带输入/缓存字段，message_delta 带
                # output_tokens；字段单调不减，避免 0 值覆盖缓存计数
                if v and v > self.call_usage.get(k, 0):
                    self.call_usage[k] = v

        etype = event.type
        if etype == "content_block_start":
            index = event.block_index
            if index is None:
                return True
            if event.block_type == "text":
                self.block_text_parts.setdefault(index, [])
            elif event.block_type == "tool_use":
                state = ToolCallState(tool_use_id=event.tool_use_id or "", name=event.tool_name or "")
                self.block_tool_states[index] = state
                if self.on_tool_start is not None:
                    self.on_tool_start(state.tool_use_id, state.name)

        elif etype == "content_block_delta":
            index = event.block_index
            if index is None:
                return True
            if event.text_delta:
                self.current_text += event.text_delta
                self.block_text_parts.setdefault(index, []).append(event.text_delta)
                if self.on_text is not None:
                    self.on_text(event.text_delta)
            elif event.thinking_delta:
                if self.on_thinking is not None:
                    self.on_thinking(event.thinking_delta)
            elif event.input_json_delta:
                if index in self.block_tool_states:
                    self.block_tool_states[index].append_chunk(event.input_json_delta)

        elif etype == "content_block_stop":
            index = event.block_index
            if index is None:
                return True
            if index in self.block_tool_states:
                state = self.block_tool_states[index]
                complete_input = state.get_complete_input()
                if self.on_tool_complete is not None:
                    self.on_tool_complete(state.tool_use_id, state.name, complete_input)
                self.assistant_content.append({
                    "type": "tool_use", "id": state.tool_use_id,
                    "name": state.name, "input": complete_input,
                })
            elif index in self.block_text_parts:
                text = "".join(self.block_text_parts[index])
                if text:
                    self.assistant_content.append({"type": "text", "text": text})

        elif etype == "message_delta":
            if event.stop_reason:
                self.stop_reason = event.stop_reason

        elif etype == "message_stop":
            return False
        return True

    def finish(self) -> Tuple[str, List[Any], Dict[str, int], str]:
        """返回 (stop_reason, blocks, usage, current_text)。

        stop_reason 兜底：provider 未发 message_delta 时按「是否产出 tool_use 块」
        推导——否则 runner 会把工具调用误判为「模型已说完」提前跳出 WORK 循环。
        """
        if self.stop_reason == "end_turn" and any(
            isinstance(b, dict) and b.get("type") == "tool_use" for b in self.assistant_content
        ):
            self.stop_reason = "tool_use"
        return self.stop_reason, self.assistant_content, self.call_usage, self.current_text


def aggregate_stream(
    events: Iterable[StreamEvent],
    **callbacks,
) -> Tuple[str, List[Any], Dict[str, int], str]:
    """便捷入口：喂完整序列，返回 ``(stop_reason, blocks, usage, current_text)``。"""
    agg = StreamAggregator(**callbacks)
    for event in events:
        if not agg.feed(event):
            break
    return agg.finish()
