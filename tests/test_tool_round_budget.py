# -*- coding: utf-8 -*-
"""工具轮次预算（防死循环熔断）三机制测试（2026-09-18）。

1) 纯轮询不计入预算：全 check_background 且 [running] 态的轮次不消耗
   max_tool_rounds——等待后台任务 ≠ 检索不收敛（长构建轮询误触熔断根因）；
2) 同参死循环早警：连续 3 轮工具签名完全相同 → 立即注入针对性提醒；
3) 软阈值文案感知后台：曾轮询过 [running] 时，软阈值提醒追加「后台仍在跑，
   不得声称失败」——防模型被「如实作答」逼成「构建出错」式误报。

沿 test_skill_body_cache_drift 模式：ScriptedProvider + StubEmitter 直驱
StreamingAgent，断言注入消息与预算行为。
"""
import asyncio
import copy
import json
from types import SimpleNamespace

from planify.streaming.runner import (
    _IDENTICAL_ROUNDS_LIMIT,
    _is_pure_poll_round,
    _round_signature,
    CONTEXT_MARKER,
)
from planify.streaming.types import StreamingConfig

REMINDER = "<system-reminder>"


def _ev(type_, **kw):
    d = dict(
        type=type_, block_index=None, block_type=None, tool_use_id=None,
        tool_name=None, text_delta=None, input_json_delta=None, stop_reason=None,
        usage=None,
    )
    d.update(kw)
    return SimpleNamespace(**d)


class ScriptedProvider:
    """按脚本逐次产出工具调用轮/文本终答；记录每次请求的 messages。"""

    def __init__(self, script):
        # script: [{"tools": [(name, input), ...]}, ..., {"text": "..."}]
        self.script = script
        self.records = []
        self._call = 0

    async def astream(self, *, messages, system, tools, max_tokens, tracer=None):
        self.records.append(copy.deepcopy(messages))
        step = self.script[min(self._call, len(self.script) - 1)]
        self._call += 1
        if "tools" in step:
            for i, (name, inp) in enumerate(step["tools"]):
                tid = f"tu_{self._call}_{i}"
                yield _ev("content_block_start", block_index=i, block_type="tool_use",
                          tool_use_id=tid, tool_name=name)
                yield _ev("content_block_delta", block_index=i,
                          input_json_delta=json.dumps(inp))
                yield _ev("content_block_stop", block_index=i)
            yield _ev("message_delta", stop_reason="tool_use")
            yield _ev("message_stop")
        else:
            yield _ev("content_block_start", block_index=0, block_type="text")
            yield _ev("content_block_delta", block_index=0, text_delta=step["text"])
            yield _ev("content_block_stop", block_index=0)
            yield _ev("message_delta", stop_reason="end_turn")
            yield _ev("message_stop")


class StubEmitter:
    def __init__(self):
        self.text_parts = []
        self._pending = {}

    async def emit_text(self, content, is_end=False):
        self.text_parts.append(content)

    async def emit_tool_call(self, tool_use_id, name, input_data, is_complete=False):
        if is_complete:
            self._pending[tool_use_id] = {"tool_use_id": tool_use_id, "name": name, "input": input_data}

    async def emit_tool_result(self, tool_use_id, name, output, is_error=False):
        pass

    async def emit_notice(self, message):
        pass

    async def emit_done(self, session_id, summary=None):
        pass

    async def emit_error(self, error, code=None):
        raise AssertionError(f"agent 运行出错: {error}")

    def get_full_text(self):
        return "".join(self.text_parts)


def _make_agent(provider, max_tool_rounds, tmp_path):
    from planify.streaming.runner import StreamingAgent

    handlers = {
        "check_background": lambda task_id="t": "[running] None",
        "grep": lambda **kw: "grep result",
    }
    tools = [
        {"name": n, "description": "test", "input_schema": {"type": "object", "properties": {}, "required": []}}
        for n in ("check_background", "grep")
    ]
    runtime = SimpleNamespace(
        config=SimpleNamespace(workdir=tmp_path, compact_transcript_dir=None, assets_dir=tmp_path / "assets"),
        replace_messages_in_place=lambda msgs: None,
    )
    return StreamingAgent(
        client=provider, model="mock", tools=tools, tool_handlers=handlers,
        emitter=StubEmitter(), runtime=runtime,
        config=StreamingConfig(
            compact_threshold=10**9, max_tool_rounds=max_tool_rounds,
            force_answer_rounds=None,
        ),
    )


def _reminder_texts(messages):
    """预算提醒消息（排除 head-context 注入——它同用 system-reminder 包装）。"""
    return [
        m["content"] for m in messages
        if m.get("role") == "user"
        and isinstance(m.get("content"), str)
        and REMINDER in m["content"]
        and CONTEXT_MARKER not in m["content"]
    ]


class TestPureHelpers:
    def test_pure_poll_detection(self):
        assert _is_pure_poll_round([("check_background", {}, "[running] None")]) is True
        # done 态不是等待（有结果可推进）
        assert _is_pure_poll_round([("check_background", {}, "[done] ok")]) is False
        # 混入其它工具不是纯轮询
        assert _is_pure_poll_round(
            [("check_background", {}, "[running] None"), ("grep", {}, "x")]
        ) is False
        assert _is_pure_poll_round([]) is False

    def test_signature_normalizes_key_order(self):
        a = _round_signature([("grep", {"b": 2, "a": 1}, "x")])
        b = _round_signature([("grep", {"a": 1, "b": 2}, "y")])
        assert a == b  # 输出不同不算同参；参数键序无关


class TestBgCheckOutput:
    """check_background 的 running 态输出契约（与 runner 轮询识别联动）。"""

    def _mgr(self, tmp_path):
        from planify.managers.background_manager import BackgroundManager

        return BackgroundManager(tmp_path)

    def test_running_renders_guidance_not_none(self, tmp_path):
        """running 态不渲染字面 None——耗时 + 等待指引（旧缺陷：get 默认值
        是死代码，result 键存在且为 None 时输出 '[running] None'）。"""
        import time

        mgr = self._mgr(tmp_path)
        mgr.tasks["t1"] = {
            "status": "running", "command": "npm run build",
            "result": None, "started_at": time.monotonic() - 45,
        }
        out = mgr.check("t1")
        assert out.startswith("[running]")  # runner 纯轮询识别契约
        assert "None" not in out
        assert "45s elapsed" in out
        assert "npm run build" in out
        assert "NOT a failure" in out

    def test_completed_renders_result(self, tmp_path):
        mgr = self._mgr(tmp_path)
        mgr.tasks["t1"] = {"status": "completed", "command": "x",
                           "result": "build ok", "started_at": 0.0}
        assert mgr.check("t1") == "[completed] build ok"

    def test_unknown_tid(self, tmp_path):
        mgr = self._mgr(tmp_path)
        assert mgr.check("nope") == "Unknown: nope"

    def test_running_output_matches_pure_poll_detector(self, tmp_path):
        """联动契约：新 running 文案仍被 runner 纯轮询识别命中。"""
        import time

        mgr = self._mgr(tmp_path)
        mgr.tasks["t1"] = {"status": "running", "command": "x",
                           "result": None, "started_at": time.monotonic()}
        assert _is_pure_poll_round(
            [("check_background", {"task_id": "t1"}, mgr.check("t1"))]
        )


class TestBudgetMechanisms:
    def test_poll_rounds_do_not_consume_budget(self, tmp_path):
        """纯轮询 4 轮（> max_tool_rounds=2）不触发任何提醒，正常终答。"""
        script = [{"tools": [("check_background", {"task_id": "8df2f14e"})]}] * 4
        script.append({"text": "任务仍在运行，稍后再查。"})
        provider = ScriptedProvider(script)
        agent = _make_agent(provider, max_tool_rounds=2, tmp_path=tmp_path)
        messages = []
        asyncio.run(agent.run_stream(messages, "查构建", "s1"))
        assert _reminder_texts(messages) == []
        assert agent.emitter.get_full_text() == "任务仍在运行，稍后再查。"

    def test_identical_rounds_early_warning(self, tmp_path):
        """连续 3 轮同参 grep（远低于软阈值）→ 注入死循环针对性提醒。"""
        script = [{"tools": [("grep", {"q": "same"})]}] * _IDENTICAL_ROUNDS_LIMIT
        script.append({"text": "done"})
        provider = ScriptedProvider(script)
        agent = _make_agent(provider, max_tool_rounds=100, tmp_path=tmp_path)
        messages = []
        asyncio.run(agent.run_stream(messages, "q", "s1"))
        reminders = _reminder_texts(messages)
        assert len(reminders) == 1
        assert "identical arguments" in reminders[0]
        assert "do NOT repeat" in reminders[0]

    def test_identical_reset_by_change(self, tmp_path):
        """同参 2 轮（<3）后换参数 → 计数重置，不注入。"""
        script = [
            {"tools": [("grep", {"q": "a"})]},
            {"tools": [("grep", {"q": "a"})]},
            {"tools": [("grep", {"q": "b"})]},
            {"text": "done"},
        ]
        provider = ScriptedProvider(script)
        agent = _make_agent(provider, max_tool_rounds=100, tmp_path=tmp_path)
        messages = []
        asyncio.run(agent.run_stream(messages, "q", "s1"))
        assert _reminder_texts(messages) == []

    def test_soft_threshold_bg_aware_copy(self, tmp_path):
        """先轮询（[running]）再真实检索超软阈值 → 提醒追加后台指引。"""
        script = [{"tools": [("check_background", {"task_id": "t"})]}]
        script += [{"tools": [("grep", {"q": f"q{i}"})]} for i in range(3)]  # 计数 3 > 2
        script.append({"text": "done"})
        provider = ScriptedProvider(script)
        agent = _make_agent(provider, max_tool_rounds=2, tmp_path=tmp_path)
        messages = []
        asyncio.run(agent.run_stream(messages, "q", "s1"))
        reminders = _reminder_texts(messages)
        assert len(reminders) == 1
        assert "without converging" in reminders[0]
        assert "background task may still be running" in reminders[0]
        assert "do not claim it failed" in reminders[0]

    def test_soft_threshold_plain_without_bg(self, tmp_path):
        """无轮询历史 → 软阈值提醒保持通用文案（无后台段）。"""
        script = [{"tools": [("grep", {"q": f"q{i}"})]} for i in range(3)]
        script.append({"text": "done"})
        provider = ScriptedProvider(script)
        agent = _make_agent(provider, max_tool_rounds=2, tmp_path=tmp_path)
        messages = []
        asyncio.run(agent.run_stream(messages, "q", "s1"))
        reminders = _reminder_texts(messages)
        assert len(reminders) == 1
        assert "background task" not in reminders[0]
