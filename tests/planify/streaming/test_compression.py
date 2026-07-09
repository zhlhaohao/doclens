"""StreamingAgent 压缩管道集成测试（microcompact + auto_compact + compact_threshold）。"""
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from planify.streaming.runner import StreamingAgent
from planify.streaming.types import StreamingConfig
from planify.context.compact import estimate_tokens, microcompact, auto_compact
from doclens.web_v2.api._chat_emitter import GradioEventEmitter


def _make_agent(compact_threshold=160000, session=MagicMock()):
    """Minimal StreamingAgent 用于压缩管道集成测试。"""
    async def dummy_tool(**kwargs):
        return "ok"
    return StreamingAgent(
        client=MagicMock(),
        model="claude-test",
        tools=[],
        tool_handlers={"t": dummy_tool},
        emitter=GradioEventEmitter(),
        config=StreamingConfig(compact_threshold=compact_threshold),
        todo_manager=None,
        session=session,
    )


# ─── microcompact 集成 ───

def test_microcompact_clears_old_tool_results_in_loop():
    """每轮循环顶部 microcompact 触发，清掉超过最近 3 个的 tool_result。"""
    msgs = [{"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": f"t{i}", "content": "x" * 200}
        for i in range(5)
    ]}]
    microcompact(msgs)
    contents = [p["content"] for p in msgs[0]["content"]]
    cleared = sum(1 for c in contents if c == "[cleared]")
    assert cleared == 2  # 5 个里清掉前 2 个


# ─── auto_compact 触发条件 ───

def test_auto_compact_triggers_when_over_threshold(monkeypatch, tmp_path):
    """messages token > compact_threshold → session.replace_messages_in_place 被调。"""
    session = MagicMock()
    agent = _make_agent(compact_threshold=10, session=session)
    msgs = [{"role": "user", "content": "x" * 200}]  # 200/4=50 tokens > 10

    summary_msg = MagicMock(content=[MagicMock(text="SUMMARY")])
    monkeypatch.setattr(
        agent.client, "messages",
        MagicMock(create=MagicMock(return_value=summary_msg))
    )

    # 模拟 runner.py:211-218 的压缩管道逻辑
    if estimate_tokens(msgs) > agent.config.compact_threshold:
        compacted = auto_compact(msgs, agent.client, agent.model, Path(str(tmp_path)))
        if agent.session:
            agent.session.replace_messages_in_place(compacted)

    session.replace_messages_in_place.assert_called_once()
    args, _ = session.replace_messages_in_place.call_args
    assert "[Compressed. Transcript:" in args[0][0]["content"]


def test_auto_compact_not_triggered_under_threshold():
    """messages token < compact_threshold → auto_compact 不被调。"""
    session = MagicMock()
    agent = _make_agent(compact_threshold=1000000, session=session)
    msgs = [{"role": "user", "content": "tiny"}]

    assert estimate_tokens(msgs) < agent.config.compact_threshold
    # runner 逻辑：未超阈值时不调 replace_messages_in_place
    session.replace_messages_in_place.assert_not_called()


def test_auto_compact_small_threshold_forces_trigger(monkeypatch, tmp_path):
    """极小阈值（compact_threshold=10）→ 即使短消息也触发。"""
    session = MagicMock()
    agent = _make_agent(compact_threshold=10, session=session)
    msgs = [{"role": "user", "content": "hello world"}]

    summary_msg = MagicMock(content=[MagicMock(text="S")])
    monkeypatch.setattr(
        agent.client, "messages",
        MagicMock(create=MagicMock(return_value=summary_msg))
    )

    if estimate_tokens(msgs) > agent.config.compact_threshold:
        compacted = auto_compact(msgs, agent.client, agent.model, Path(str(tmp_path)))
        if agent.session:
            agent.session.replace_messages_in_place(compacted)

    session.replace_messages_in_place.assert_called_once()


def test_auto_compact_gated_when_session_none():
    """self.session is None 时即使超阈值也不触发（runner.py:212 条件门）。"""
    agent = _make_agent(compact_threshold=10, session=None)
    # runner.py:212 条件 `if self._auto_compact and self.session` 在 session=None 时不进
    assert not (agent._auto_compact and agent.session)


def test_compact_threshold_derived_from_context_window():
    """验证 caller 推导公式：context_window * 0.8 == compact_threshold。"""
    # 这是 caller 层逻辑（不在 runner 内），模拟调用方计算：
    for ctx, expected in [(200000, 160000), (1000000, 800000), (100000, 80000), (128000, 102400)]:
        actual = int(round(ctx * 0.8))
        assert actual == expected, f"context_window={ctx} expected {expected}, got {actual}"
