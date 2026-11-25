"""工具参数 JSON 解析失败（_parse_error）必须转成可自愈的 tool_result，
不能原样传给 handler（TypeError → 用户看到「工具一直失败」）。
2026-11-25 真机：MiniMax 连续 4 次 group_plan 全 TypeError。
"""

import json

import pytest

from planify.streaming.aggregate import aggregate_stream
from planify.core.llm.types import StreamEvent


def test_parse_error_marker_preserved():
    events = [
        StreamEvent(type="content_block_start", block_index=0, block_type="tool_use",
                    tool_use_id="t1", tool_name="group_plan"),
        StreamEvent(type="content_block_delta", block_index=0, input_json_delta='{"plan": {"steps": [{"step_id": "s1"'),
        StreamEvent(type="content_block_stop", block_index=0),
        StreamEvent(type="message_stop"),
    ]
    _, blocks, _, _ = aggregate_stream(events)
    assert "_parse_error" in blocks[0]["input"]
    assert "step_id" in blocks[0]["input"]["_parse_error"]


@pytest.mark.asyncio
async def test_run_handler_returns_recoverable_error():
    from planify.streaming.runner import StreamingAgent
    from planify.core.llm.types import LLMResponse
    from planify.streaming.types import StreamingConfig

    class FakeProvider:
        async def achat(self, **kw):
            return LLMResponse(content=[])
        def chat(self, **kw):
            return LLMResponse(content=[])

    called = {"n": 0}
    def _handler(**kw):
        called["n"] += 1
        return "should not be called"

    class _Emitter:
        async def emit_text(self, *a, **k): pass
        async def emit_tool_call(self, *a, **k): pass
        async def emit_thinking(self, *a, **k): pass
        async def emit_stream_end(self, *a, **k): pass
        async def emit_done(self, *a, **k): pass
        async def emit_compact(self, *a, **k): pass
        async def emit_error(self, *a, **k): pass
        async def emit_usage(self, *a, **k): pass
        async def emit_toast(self, *a, **k): pass
        async def emit_tool_result(self, *a, **k): pass
        async def emit_compact(self, *a, **k): pass

    ag = StreamingAgent(FakeProvider(), "fake-model", [{"name": "group_plan", "description": "x", "input_schema": {}}],
                        {"group_plan": _handler}, _Emitter(), StreamingConfig())
    # _run_handler 是 _execute_tools 的嵌套函数——直接喂一条带 _parse_error 的 assistant 消息
    broken_json = "{\"plan\": {\"steps\": [{\"step_id\": \"s1\"}"  # 截断的非法 JSON
    ag._last_assistant_blocks = [
        {"type": "tool_use", "id": "t1", "name": "group_plan",
         "input": {"_parse_error": broken_json}}
    ]
    result = await ag._execute_tools([{"role": "assistant", "content": ag._last_assistant_blocks}])
    assert result is not None
    _, _, out = result[0]
    assert "不是合法 JSON" in out
    assert called["n"] == 0  # handler 没被调用
