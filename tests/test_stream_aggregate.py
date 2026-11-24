"""纯同步流式聚合器（planify/streaming/aggregate.py，ADR-0060 §3）。

lead 的 async 路径与 Bot 的同步线程共用同一聚合核：partial tool_use JSON 分块
拼装、stop_reason 兜底、usage 同键取最大。
"""

from planify.core.llm.types import StreamEvent
from planify.streaming.aggregate import StreamAggregator, aggregate_stream


def _events_text_then_tool():
    return [
        StreamEvent(type="content_block_start", block_index=0, block_type="text"),
        StreamEvent(type="content_block_delta", block_index=0, text_delta="Hel"),
        StreamEvent(type="content_block_delta", block_index=0, text_delta="lo"),
        StreamEvent(type="content_block_stop", block_index=0),
        StreamEvent(type="content_block_start", block_index=1, block_type="tool_use",
                    tool_use_id="t1", tool_name="write_file"),
        StreamEvent(type="content_block_delta", block_index=1, input_json_delta='{"path": '),
        StreamEvent(type="content_block_delta", block_index=1, input_json_delta='"r.md", "content": "x"}'),
        StreamEvent(type="content_block_stop", block_index=1),
        StreamEvent(type="message_delta", stop_reason="tool_use"),
        StreamEvent(type="message_stop"),
    ]


class TestAggregate:
    def test_text_and_partial_tool_json(self):
        stop, blocks, usage, text = aggregate_stream(_events_text_then_tool())
        assert stop == "tool_use"
        assert text == "Hello"
        assert {"type": "text", "text": "Hello"} in blocks
        tool = next(b for b in blocks if b["type"] == "tool_use")
        assert tool["name"] == "write_file" and tool["input"] == {"path": "r.md", "content": "x"}

    def test_stop_reason_fallback_when_no_message_delta(self):
        """provider 不发 message_delta 时按 tool_use 块推导——否则 runner 提前跳出 WORK。"""
        events = [e for e in _events_text_then_tool() if e.type != "message_delta"]
        stop, blocks, _, _ = aggregate_stream(events)
        assert stop == "tool_use"

    def test_usage_max_wins(self):
        events = [
            StreamEvent(type="message_start", usage={"input_tokens": 100, "cache_read_input_tokens": 40}),
            StreamEvent(type="message_delta", usage={"output_tokens": 7, "cache_read_input_tokens": 0}),
            StreamEvent(type="message_stop"),
        ]
        _, _, usage, _ = aggregate_stream(events)
        assert usage["input_tokens"] == 100
        assert usage["output_tokens"] == 7
        assert usage["cache_read_input_tokens"] == 40  # 0 不覆盖

    def test_callbacks_fire_in_order(self):
        seen = []
        agg = StreamAggregator(
            on_text=lambda t: seen.append(("text", t)),
            on_tool_start=lambda tid, name: seen.append(("start", name)),
            on_tool_complete=lambda tid, name, inp: seen.append(("done", inp)),
        )
        for e in _events_text_then_tool():
            agg.feed(e)
        assert ("text", "Hel") in seen and ("text", "lo") in seen
        assert ("start", "write_file") in seen
        assert ("done", {"path": "r.md", "content": "x"}) in seen
        # text 先于工具完成
        assert seen.index(("text", "Hel")) < seen.index(("done", {"path": "r.md", "content": "x"}))

    def test_tool_input_parse_error_preserved(self):
        events = [
            StreamEvent(type="content_block_start", block_index=0, block_type="tool_use",
                        tool_use_id="t1", tool_name="f"),
            StreamEvent(type="content_block_delta", block_index=0, input_json_delta="{bad"),
            StreamEvent(type="content_block_stop", block_index=0),
        ]
        _, blocks, _, _ = aggregate_stream(events)
        assert "_parse_error" in blocks[0]["input"]
