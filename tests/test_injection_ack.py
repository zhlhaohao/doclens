# -*- coding: utf-8 -*-
"""注入消息的合成回执开关（StreamingConfig.injection_ack）。

背景（2026-10-21）：后台结果 / 收件箱通知以 user 消息插进历史后，旧实现
再补一条固定 assistant 回执，导致请求以 assistant 结尾。thinking 模式端点
（DeepSeek / GLM 等）把这种请求当 prefill，要求回传 thinking 块——本框架
有意丢弃 thinking 块，于是 400。现改为默认不补回执（只留 user 通知），
保留开关供坚持 user/assistant 严格交替的端点开启。

沿 test_tool_round_budget 模式：ScriptedProvider + StubEmitter 直驱
StreamingAgent，断言发往 LLM 的请求尾部角色。
"""
import asyncio
import copy
import json

from planify.core.llm.types import StreamEvent
from planify.streaming.runner import StreamingAgent
from planify.streaming.types import StreamingConfig


def _ev(type_, **kw):
    return StreamEvent(type=type_, **kw)


class ScriptedProvider:
    """单轮文本终答；记录每次请求的 messages。"""

    def __init__(self):
        self.records = []

    async def astream(self, *, messages, system, tools, max_tokens, tracer=None):
        self.records.append(copy.deepcopy(messages))
        yield _ev("content_block_start", block_index=0, block_type="text")
        yield _ev("content_block_delta", block_index=0, text_delta="ok")
        yield _ev("content_block_stop", block_index=0)
        yield _ev("message_delta", stop_reason="end_turn")
        yield _ev("message_stop")


class StubEmitter:
    async def emit_text(self, content, is_end=False):
        pass

    async def emit_tool_call(self, *a, **kw):
        pass

    async def emit_tool_result(self, *a, **kw):
        pass

    async def emit_notice(self, message):
        pass

    async def emit_done(self, session_id, summary=None, reason=None):
        pass

    async def emit_error(self, error, code=None):
        raise AssertionError(f"agent 运行出错: {error}")


class StubBgManager:
    """drain 只在首轮返回一条完成通知，之后为空（模拟后台任务回执）。"""

    def __init__(self):
        self._drained = False

    def drain(self):
        if self._drained:
            return []
        self._drained = True
        return [{"task_id": "t1", "status": "completed", "result": "rc=0"}]

    def has_running_tasks(self):
        return False


class StubBus:
    def __init__(self, inbox=None):
        self._inbox = inbox or []
        self._read = False

    def read_inbox(self, who):
        if self._read:
            return []
        self._read = True
        return self._inbox


def _make_agent(tmp_path, injection_ack, bg_manager=None, bus=None):
    from types import SimpleNamespace

    runtime = SimpleNamespace(
        config=SimpleNamespace(
            workdir=tmp_path,
            compact_transcript_dir=None,
            assets_dir=tmp_path / "assets",
        ),
        replace_messages_in_place=lambda msgs: None,
    )
    return StreamingAgent(
        client=ScriptedProvider(),
        model="mock",
        tools=[],
        tool_handlers={},
        emitter=StubEmitter(),
        runtime=runtime,
        bg_manager=bg_manager,
        bus=bus,
        config=StreamingConfig(
            compact_threshold=10**9,
            poll_backoff_initial_s=0.0,
            injection_ack=injection_ack,
        ),
    )


def _run(agent):
    messages = []
    asyncio.run(agent.run_stream(messages, "go", "s1"))
    return messages, agent.client.records[0]


def test_background_notice_appends_no_ack_by_default(tmp_path):
    """默认关闭：请求以 user 通知结尾（不再有 assistant prefill）。"""
    _, request = _run(_make_agent(tmp_path, injection_ack=False, bg_manager=StubBgManager()))
    last = request[-1]
    assert last["role"] == "user"
    assert "<background-results>" in last["content"]
    assert not any(
        m["role"] == "assistant" and m["content"] == "Noted background results."
        for m in request
    )


def test_background_notice_appends_ack_when_enabled(tmp_path):
    """开关开启：恢复旧的严格交替结构（user 通知 + 合成 assistant 回执）。"""
    messages, request = _run(
        _make_agent(tmp_path, injection_ack=True, bg_manager=StubBgManager())
    )
    ack_idx = next(
        i for i, m in enumerate(messages) if m.get("content") == "Noted background results."
    )
    assert messages[ack_idx - 1]["role"] == "user"
    assert "<background-results>" in messages[ack_idx - 1]["content"]
    assert messages[ack_idx]["role"] == "assistant"


def test_inbox_notice_follows_same_switch(tmp_path):
    """收件箱通知同受开关控制（两处注入同源）。"""
    inbox = [{"from": "t", "content": "hi"}]

    _, request_off = _run(
        _make_agent(tmp_path, injection_ack=False, bus=StubBus(inbox))
    )
    assert request_off[-1]["role"] == "user"
    assert "<inbox>" in request_off[-1]["content"]

    messages_on, _ = _run(
        _make_agent(tmp_path, injection_ack=True, bus=StubBus(inbox))
    )
    assert any(
        m.get("content") == "Noted inbox messages." for m in messages_on
    )
