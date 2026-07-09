"""验证 _execute_tools 不截断：LLM 与前端都拿到完整 tool output。"""
import pytest

from planify.streaming.runner import StreamingAgent
from planify.streaming.types import StreamingConfig
from doclens.web_v2.api._chat_emitter import GradioEventEmitter


LONG_OUTPUT = "x" * 10181  # 远超原默认 5000 截断阈值


@pytest.mark.asyncio
async def test_execute_tools_does_not_truncate_output():
    """10181 字符的工具输出应原样抵达：emitter（→ SSE → 前端）和 messages（→ LLM）。"""

    async def long_tool(**kwargs):
        return LONG_OUTPUT

    emitter = GradioEventEmitter()
    agent = StreamingAgent(
        client=None,  # _execute_tools 不调用 client
        model="claude-test",
        tools=[],
        tool_handlers={"long_tool": long_tool},
        emitter=emitter,
        config=StreamingConfig(),
        todo_manager=None,
        logger_instance=None,
    )

    messages = [
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": [
            {"type": "tool_use", "id": "t1", "name": "long_tool", "input": {}},
        ]},
    ]
    await agent._execute_tools(messages)

    # 前端 SSE 路径：emitter.tool_calls 收到全版
    assert len(emitter.tool_calls) == 1
    assert emitter.tool_calls[0]["output"] == LONG_OUTPUT
    assert "truncated" not in emitter.tool_calls[0]["output"]

    # LLM 上下文路径：messages 追加的 user 消息 content 收到全版
    assert messages[-1]["role"] == "user"
    tool_results = messages[-1]["content"]
    assert isinstance(tool_results, list)
    assert tool_results[0]["content"] == LONG_OUTPUT
    assert "truncated" not in tool_results[0]["content"]


@pytest.mark.asyncio
async def test_execute_tools_short_output_unchanged():
    """短输出原样通过。"""
    async def short_tool(**kwargs):
        return "ok"

    emitter = GradioEventEmitter()
    agent = StreamingAgent(
        client=None, model="claude-test", tools=[],
        tool_handlers={"short_tool": short_tool},
        emitter=emitter, config=StreamingConfig(),
    )
    messages = [
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": [
            {"type": "tool_use", "id": "t1", "name": "short_tool", "input": {}},
        ]},
    ]
    await agent._execute_tools(messages)
    assert emitter.tool_calls[0]["output"] == "ok"
    assert messages[-1]["content"][0]["content"] == "ok"
