"""GradioEventEmitter 工具事件收集测试。"""
import pytest

from planify.streaming.types import StreamEvent, StreamEventType
from doclens.web_v2.api._chat_emitter import GradioEventEmitter


@pytest.mark.asyncio
async def test_tool_call_and_result_collected_with_id_and_duration():
    emitter = GradioEventEmitter()
    await emitter.emit(StreamEvent(
        event_type=StreamEventType.TOOL_CALL,
        data={"tool_use_id": "t1", "name": "search", "input": {"query": "x"}, "is_complete": True},
    ))
    await emitter.emit(StreamEvent(
        event_type=StreamEventType.TOOL_RESULT,
        data={"tool_use_id": "t1", "name": "search", "output": "found 1", "is_error": False},
    ))
    assert len(emitter.tool_calls) == 1
    tc = emitter.tool_calls[0]
    assert tc["tool_use_id"] == "t1"
    assert tc["name"] == "search"
    assert tc["input"] == {"query": "x"}
    assert tc["output"] == "found 1"
    assert tc["is_error"] is False
    assert isinstance(tc["duration_ms"], int)
    assert "_t0" not in tc  # 内部字段不应残留


@pytest.mark.asyncio
async def test_tool_result_error_marked():
    emitter = GradioEventEmitter()
    await emitter.emit(StreamEvent(
        event_type=StreamEventType.TOOL_CALL,
        data={"tool_use_id": "t2", "name": "read_document", "input": {}, "is_complete": True},
    ))
    await emitter.emit(StreamEvent(
        event_type=StreamEventType.TOOL_RESULT,
        data={"tool_use_id": "t2", "name": "read_document", "output": "Error: boom", "is_error": True},
    ))
    assert emitter.tool_calls[0]["is_error"] is True
