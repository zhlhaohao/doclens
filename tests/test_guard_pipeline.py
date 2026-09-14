"""外部访问门禁（ADR-0021）管道层集成测试。

直接驱动 StreamingAgent._execute_tools（绕过 LLM），验证 GUI 主链路闭环：
tool_use（外部路径）→ classify confirm → emit_ask_questions（guard 标志）→
waiter 回灌允许/拒绝 → 记账/拦截 → handler 放行/拒绝。
"""

import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from planify.skills.access_state import (
    reset_current_session_id,
    set_current_session_id,
)
from planify.streaming.runner import StreamingAgent
from planify.tools.basic import make_basic_tools
from planify.tools.guard import (
    DENY_LABEL,
    GRANT_LABEL,
    grant_clear_all,
)


@pytest.fixture(autouse=True)
def _clean_ledger():
    grant_clear_all()
    yield
    grant_clear_all()


class _RecordingEmitter:
    """记录 ask / tool_result 事件的最小 emitter。"""

    def __init__(self):
        self.asks = []
        self.results = []

    async def emit_ask_questions(self, request_id, questions):
        self.asks.append((request_id, questions))

    async def emit_tool_result(self, tool_use_id, name, output, is_error=False):
        self.results.append((tool_use_id, name, output, is_error))


class _AutoWaiter:
    """emit 后立刻回灌固定答案的 waiter。"""

    def __init__(self, grant: bool):
        selected = [GRANT_LABEL] if grant else [DENY_LABEL]
        self._response = {"answers": [{"selected": selected}]}

    async def create_request(self, request_id, session_id=""):
        return request_id

    async def wait_for_response(self, request_id, timeout=None):
        return self._response


def _make_agent(workdir: Path, handlers: dict, emitter, waiter) -> StreamingAgent:
    cfg = SimpleNamespace(workdir=str(workdir))
    return StreamingAgent(
        client=None,
        model="test-model",
        tools=[],
        tool_handlers=handlers,
        emitter=emitter,
        config=cfg,
        waiter=waiter,
    )


def _tool_use_message(name: str, input_data: dict) -> list:
    return [{
        "role": "assistant",
        "content": [{
            "type": "tool_use", "id": "t1", "name": name, "input": input_data,
        }],
    }]


def _run(agent, messages) -> list:
    """驱动 _execute_tools，返回其追加到 messages 的 tool_result 块。"""
    asyncio.run(agent._execute_tools(messages))  # noqa: SLF001 —— 集成测试直驱管道层
    return messages[-1]["content"]


@pytest.fixture
def outside_dir(tmp_path_factory) -> Path:
    """workdir 之外的独立临时目录（授权后可真实写入）。"""
    return tmp_path_factory.mktemp("outside")


def test_pipeline_grant_flow(tmp_path, outside_dir):
    """允许路径：guard 卡片（guard=True）→ 记账 → write_file 真实写入。"""
    handlers = make_basic_tools(tmp_path, guard_enabled=True)
    emitter = _RecordingEmitter()
    agent = _make_agent(tmp_path, handlers, emitter, _AutoWaiter(grant=True))

    target = outside_dir / "w.md"
    messages = _tool_use_message(
        "write_file", {"path": str(target), "content": "hello"}
    )
    token = set_current_session_id("pipe1")
    try:
        results = _run(agent, messages)
    finally:
        reset_current_session_id(token)

    # 弹过一张 guard 卡片，载荷带 guard 标志
    assert len(emitter.asks) == 1
    _rid, questions = emitter.asks[0]
    assert questions[0]["guard"] is True
    assert questions[0]["header"] == "外部访问"

    # 工具真实执行且成功
    assert target.read_text(encoding="utf-8") == "hello"
    assert results[0]["content"].startswith("Wrote")
    assert results[0]["is_error"] is False


def test_pipeline_deny_flow(tmp_path, outside_dir):
    """拒绝路径：返回 Error 门禁消息，文件未写入，handler 未执行。"""
    handlers = make_basic_tools(tmp_path, guard_enabled=True)
    emitter = _RecordingEmitter()
    agent = _make_agent(tmp_path, handlers, emitter, _AutoWaiter(grant=False))

    target = outside_dir / "denied.md"
    messages = _tool_use_message(
        "write_file", {"path": str(target), "content": "nope"}
    )
    token = set_current_session_id("pipe2")
    try:
        results = _run(agent, messages)
    finally:
        reset_current_session_id(token)

    assert not target.exists()
    assert results[0]["content"].startswith("Error: 外部访问门禁")
    assert results[0]["is_error"] is True


def test_pipeline_grant_is_session_scoped(tmp_path, outside_dir):
    """确认记账后会话内同目录免再问（第二次不再弹卡片）。"""
    handlers = make_basic_tools(tmp_path, guard_enabled=True)
    emitter = _RecordingEmitter()
    agent = _make_agent(tmp_path, handlers, emitter, _AutoWaiter(grant=True))

    token = set_current_session_id("pipe3")
    try:
        first = _tool_use_message(
            "write_file", {"path": str(outside_dir / "a.md"), "content": "1"}
        )
        _run(agent, first)
        second = _tool_use_message(
            "write_file", {"path": str(outside_dir / "b.md"), "content": "2"}
        )
        _run(agent, second)
    finally:
        reset_current_session_id(token)

    # 只有第一次弹卡片
    assert len(emitter.asks) == 1
    assert (outside_dir / "a.md").read_text(encoding="utf-8") == "1"
    assert (outside_dir / "b.md").read_text(encoding="utf-8") == "2"


def test_pipeline_inside_workdir_no_card(tmp_path):
    """workdir 内路径：不弹卡片直接执行。"""
    handlers = make_basic_tools(tmp_path, guard_enabled=True)
    emitter = _RecordingEmitter()
    agent = _make_agent(tmp_path, handlers, emitter, _AutoWaiter(grant=True))

    messages = _tool_use_message(
        "write_file", {"path": "inner.md", "content": "x"}
    )
    _run(agent, messages)

    assert emitter.asks == []
    assert (tmp_path / "inner.md").read_text(encoding="utf-8") == "x"


def test_registry_gui_mode_wiring(tmp_path):
    """gui_mode registry：shell handler 已包装（子代理拿到的是门禁版）。"""
    from planify.tools.registry import build_tool_registry

    _tools, handlers = build_tool_registry(workdir=tmp_path, gui_mode=True)
    assert handlers["bash"].__name__ == "_guarded"
    out = handlers["bash"](command=f"type {tmp_path.parent / 'nope' / 'x.txt'}")
    assert out.startswith("Error: 外部访问门禁")
    assert "无用户交互渠道" in out


def test_registry_non_gui_mode_unchanged(tmp_path):
    """非 gui_mode（TUI/CLI 链路）：bash 不包装，保持旧行为。"""
    from planify.tools.registry import build_tool_registry

    _tools, handlers = build_tool_registry(workdir=tmp_path, gui_mode=False)
    assert handlers["bash"].__name__ != "_guarded"
