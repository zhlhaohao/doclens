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

from planify.core.llm.types import StreamEvent
from planify.streaming.runner import (
    _IDENTICAL_ROUNDS_LIMIT,
    _is_pure_poll_round,
    _round_signature,
    CONTEXT_MARKER,
)
from planify.streaming.types import StreamingConfig

REMINDER = "<system-reminder>"


def _ev(type_, **kw):
    """构造归一化 LLM 流事件——用真实 StreamEvent，避免手抄字段清单漂移。"""
    return StreamEvent(type=type_, **kw)


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

    async def emit_done(self, session_id, summary=None, reason=None):
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
            poll_backoff_initial_s=0.0,  # 关闭真实等待，保持既有用例速度
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

    def test_poll_backoff_delays_between_rounds(self, tmp_path, monkeypatch):
        """P3 热轮询止血：连续纯轮询轮间注入退避等待（5s→10s→20s 指数）。

        用假 sleep 记录退避时长（不真等），验证退避序列与非纯轮询清零。
        _make_agent 未注入 interrupt_event → 走 asyncio.sleep 分支。
        """
        import planify.streaming.runner as runner_mod

        sleeps: list[float] = []

        async def fake_sleep(delay):
            sleeps.append(delay)

        orig_sleep = runner_mod.asyncio.sleep
        runner_mod.asyncio.sleep = fake_sleep
        try:
            # 3 轮纯轮询 + 1 轮 grep（打断连续性）+ 终答
            script = [{"tools": [("check_background", {"task_id": "t"})]}] * 3
            script.append({"tools": [("grep", {"q": "x"})]})
            script.append({"text": "done"})
            provider = ScriptedProvider(script)
            agent = _make_agent(provider, max_tool_rounds=100, tmp_path=tmp_path)
            # 重新启用退避（_make_agent 注入 0 关闭了默认值）
            agent.config.poll_backoff_initial_s = 5.0
            agent.config.poll_backoff_max_s = 30.0
            messages = []
            asyncio.run(agent.run_stream(messages, "q", "s1"))
        finally:
            runner_mod.asyncio.sleep = orig_sleep

        # 第 1/2/3 次连续纯轮询后的退避：5s、10s、20s（指数）；
        # grep 轮打断连续性 → consecutive_poll_rounds 清零，此后无退避
        assert sleeps == [5.0, 10.0, 20.0]
        assert agent.emitter.get_full_text() == "done"

    def test_poll_backoff_with_interrupt_event_keeps_loop_alive(self, tmp_path):
        """回归（2026-10-10 GUI 挂起事故）：退避带 threading.Event 不得冻结事件循环。

        根因：旧实现把 ``interrupt_event.wait()``（threading.Event 的同步
        阻塞调用，无超时）作为参数传给 ``asyncio.wait_for``——参数求值
        先于调用，事件循环线程在 wait_for 生效前就被无限期阻塞。
        生产触发链：bash 超时 → 模型转 background_run → check_background
        纯轮询轮 → 下一轮循环顶退避 → ASGI 循环冻结 → SSE/HTTP 全无响应
        → _run_and_finalize 的 finally 落库永不执行 → 杀进程后轮次丢失。

        红判据（两重）：
        1. run_stream 跑在工作线程（自带事件循环），主线程 15s join 超时
           = 循环冻结、回合永不完成 → 红；
        2. 中断 set 后 agent 必须快速退出（循环顶检查点生效）——防把
           「冻结」误修成「不再等待但也不响应中断」。
        """
        import threading
        import time

        script = [{"tools": [("check_background", {"task_id": "t"})]}] * 3
        script.append({"text": "done"})
        provider = ScriptedProvider(script)
        agent = _make_agent(provider, max_tool_rounds=100, tmp_path=tmp_path)
        agent.config.poll_backoff_initial_s = 5.0
        agent.config.poll_backoff_max_s = 30.0

        ev = threading.Event()
        agent._interrupt_event = ev

        messages: list = []
        done_flag = threading.Event()

        def _run_round() -> None:
            asyncio.run(agent.run_stream(messages, "q", "s1"))
            done_flag.set()

        t = threading.Thread(target=_run_round, daemon=True)
        t.start()

        # 第 1 次纯轮询后的退避 5s 内，agent 线程应仍活着且未完成；
        # 稍后 set 中断 → 循环顶检查点退出，join 应快速成功。
        time.sleep(2.0)
        assert not done_flag.is_set(), "退避尚未到时，回合不应提前完成"

        t0 = time.monotonic()
        ev.set()  # 用户「停止」
        t.join(timeout=15.0)
        elapsed = time.monotonic() - t0

        assert not t.is_alive(), (
            "run_stream 线程 15s 未退出——事件循环在退避期间被同步 "
            "threading.Event.wait() 冻结（GUI 无响应 + 轮次不落库的根因）"
        )
        assert done_flag.is_set(), "线程退出但回合未正常收尾"
        assert elapsed < 10.0, (
            f"中断响应耗时 {elapsed:.1f}s——退避等待未让出控制权给中断"
        )

    def test_poll_backoff_wakes_on_bg_notification(self, tmp_path):
        """退避等待必须被后台完成通知提前唤醒（2026-10-23 事故）。

        事故链：bench 后台任务 17:28:14 就已完成，但主循环正卡在纯轮询
        退避/LLM 调用里，完成通知只能躺在队列等下次循环顶 drain——用户
        面对转圈，直到手动催问才知道早跑完了。

        红判据：退避 30s，通知在第 0.2s 到达 → 等待应远早于 30s 结束。
        """
        import threading
        import time
        from queue import Queue

        class FakeBgManager:
            def __init__(self):
                self.notifications = Queue()

            def has_running_tasks(self):
                return False

            def has_pending_notifications(self):
                return not self.notifications.empty()

            def drain(self):
                out = []
                while not self.notifications.empty():
                    out.append(self.notifications.get_nowait())
                return out

        # 单轮纯轮询：唤醒 → 循环顶 drain 注入完成通知 → 下一轮直接终答
        # （若还留一轮纯轮询，会再退避一次，测的就不是唤醒而是第二次等待）
        script = [{"tools": [("check_background", {"task_id": "t"})]},
                  {"text": "done"}]
        provider = ScriptedProvider(script)
        agent = _make_agent(provider, max_tool_rounds=100, tmp_path=tmp_path)
        bg = FakeBgManager()
        agent.bg_manager = bg
        agent.config.poll_backoff_initial_s = 30.0
        agent.config.poll_backoff_max_s = 30.0

        def _notify_soon():
            time.sleep(0.2)
            bg.notifications.put(
                {"task_id": "t", "status": "completed", "result": "bench done"}
            )

        threading.Thread(target=_notify_soon, daemon=True).start()

        messages: list = []
        t0 = time.monotonic()
        asyncio.run(agent.run_stream(messages, "q", "s1"))
        elapsed = time.monotonic() - t0

        assert elapsed < 5.0, (
            f"退避未响应后台完成通知（耗时 {elapsed:.1f}s，退避 30s）——"
            "完成通知会白等到退避结束才被感知"
        )
        # 通知在下一轮循环顶被注入历史（唤醒只探测不消费）
        assert any(
            isinstance(m.get("content"), str)
            and "<background-results>" in m["content"]
            and "bench done" in m["content"]
            for m in messages
        ), "唤醒后未在循环顶注入后台完成通知"

    def test_poll_backoff_disabled_by_zero(self):
        """initial=0 → 退避恒 0（关闭），既有行为不变。"""
        from planify.streaming.runner import _poll_backoff_s

        assert _poll_backoff_s(1, 0.0, 30.0) == 0.0
        assert _poll_backoff_s(5, 0.0, 30.0) == 0.0
        assert _poll_backoff_s(0, 5.0, 30.0) == 0.0

    def test_poll_backoff_caps_at_max(self):
        """退避指数增长但封顶 max_s。"""
        from planify.streaming.runner import _poll_backoff_s

        assert _poll_backoff_s(1, 5.0, 30.0) == 5.0
        assert _poll_backoff_s(2, 5.0, 30.0) == 10.0
        assert _poll_backoff_s(3, 5.0, 30.0) == 20.0
        assert _poll_backoff_s(4, 5.0, 30.0) == 30.0
        assert _poll_backoff_s(10, 5.0, 30.0) == 30.0

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


class TestTurnExitGuard:
    """回合退出护栏（2026-10-24「假通知」事故）。

    模型在后台任务 running 时产出纯文字终答 → 注入 <background-guard>
    纠正消息拉回循环（最多 1 次）；无运行中任务或模型坚持终答则放行。
    FakeBgManager 与 test_poll_backoff_wakes_on_bg_notification 同构，
    补 has_running_tasks / 无 drain 状态。
    """

    class _FakeBg:
        def __init__(self, running: bool):
            from queue import Queue

            self._running = running
            self.notifications = Queue()

        def has_running_tasks(self):
            return self._running

        def has_pending_notifications(self):
            return not self.notifications.empty()

        def drain(self):
            return []

    def test_text_final_with_running_bg_gets_pulled_back(self, tmp_path):
        """running 后台 + 纯文字终答 → 注入纠正消息，回合被拉回循环。

        红判据：ScriptedProvider 第 2 步起全部是文本——若护栏生效，
        纠正后模型仍产文本但第 2 次放行（限 1 次）；messages 中应出现
        恰好 1 条 <background-guard> 注入。
        """
        script = [
            {"tools": [("check_background", {"task_id": "t"})]},
            {"text": "我先结束回合，等通知唤醒。"},
            {"text": "任务仍在跑，我继续轮询。"},
        ]
        provider = ScriptedProvider(script)
        agent = _make_agent(provider, max_tool_rounds=100, tmp_path=tmp_path)
        agent.bg_manager = self._FakeBg(running=True)
        messages = []
        asyncio.run(agent.run_stream(messages, "q", "s1"))
        guards = [
            m["content"] for m in messages
            if m.get("role") == "user"
            and isinstance(m.get("content"), str)
            and "<background-guard>" in m["content"]
        ]
        assert len(guards) == 1, "护栏未注入或未限次"
        assert "check_background" in guards[0]
        # 第二次文本终答被放行（不再纠正）
        assert agent.emitter.get_full_text().endswith("任务仍在跑，我继续轮询。")

    def test_text_final_without_bg_not_affected(self, tmp_path):
        """无后台任务时护栏零介入——正常终答，无注入。"""
        script = [{"text": "直接回答"}]
        provider = ScriptedProvider(script)
        agent = _make_agent(provider, max_tool_rounds=100, tmp_path=tmp_path)
        agent.bg_manager = self._FakeBg(running=False)
        messages = []
        asyncio.run(agent.run_stream(messages, "q", "s1"))
        assert not any(
            isinstance(m.get("content"), str)
            and "<background-guard>" in m["content"]
            for m in messages
        )
        assert agent.emitter.get_full_text() == "直接回答"

    def test_bg_finished_before_final_answer_not_guarded(self, tmp_path):
        """后台已转终态（completed/error）→ 不拦截终答（护栏只看 running）。"""
        from planify.managers.background_manager import BackgroundManager

        mgr = BackgroundManager(tmp_path)
        mgr.tasks["t"] = {
            "status": "completed", "command": "x",
            "result": "ok", "started_at": 0.0,
        }
        script = [{"text": "结果已拿到，终答。"}]
        provider = ScriptedProvider(script)
        agent = _make_agent(provider, max_tool_rounds=100, tmp_path=tmp_path)
        agent.bg_manager = mgr
        messages = []
        asyncio.run(agent.run_stream(messages, "q", "s1"))
        assert not any(
            isinstance(m.get("content"), str)
            and "<background-guard>" in m["content"]
            for m in messages
        )


def test_runtime_config_carries_tool_round_budget():
    """doclens→planify 透传契约：RuntimeConfig 必须携带 planify_max_tool_rounds。

    agent_integration 构造 RuntimeConfig 时传入，StreamingConfig 装配经
    tool_round_limit_kwargs 读取——曾断链（RuntimeConfig 无该字段，getattr
    恒落兜底 15）致 PLANIFY_MAX_TOOL_ROUNDS env 调节无效（2026-09-21 修复）。
    """
    from dataclasses import replace
    from pathlib import Path

    from planify.core.runtime import RuntimeConfig

    from doclens.agent_prompt import tool_round_limit_kwargs

    rc = RuntimeConfig(
        workdir=Path.cwd(),
        model_id="m",
        api_key="k",
        planify_max_tool_rounds=20,
    )
    kwargs = tool_round_limit_kwargs(rc)
    # 配置值 = 硬阈值；软阈值 = 硬 × 70% 向下取整（2026-10-23 语义反转）
    assert kwargs["max_tool_rounds"] == 14
    assert kwargs["force_answer_rounds"] == 20

    # 非整除场景：向下取整（5 → 3，不是四舍五入的 4）
    kwargs5 = tool_round_limit_kwargs(replace(rc, planify_max_tool_rounds=5))
    assert kwargs5["max_tool_rounds"] == 3
    assert kwargs5["force_answer_rounds"] == 5

    # 0 = 不限（软/硬阈值都注入 None）
    kwargs0 = tool_round_limit_kwargs(replace(rc, planify_max_tool_rounds=0))
    assert kwargs0["max_tool_rounds"] is None
    assert kwargs0["force_answer_rounds"] is None
