# -*- coding: utf-8 -*-
"""子代理轮次预算三机制测试。

改造前：for 循环硬编码 30 轮，跑满静默返回最后一轮文本（与正常完成的
摘要无差别——主代理把半截摘要当全量结论用，「只总结了前几章」即此形态）。

改造后（与 StreamingAgent 熔断同哲学：先劝后断、断了留话）：
1) max_rounds 参数化（默认 30，doclens 经 PLANIFY_MAX_SUBAGENT_ROUNDS 透传）；
2) 同参死循环早警：连续 3 轮工具签名完全相同 → 注入 <system-reminder> 提醒；
3) 软提醒：预算剩约 1/6 时注入一次收尾提醒；
4) 截断标记：跑满轮数仍未收尾 → 返回值带 [round-limit-reached] 前缀。

直驱 run_subagent（同步循环）：ScriptedClient 按脚本逐轮产出响应，
FakeTool 记录调用并回放结果。
"""

from planify.subagent.runner import (
    _IDENTICAL_ROUNDS_LIMIT,
    _soft_remind_round,
    _round_signature,
    run_subagent,
    ROUND_LIMIT_PREFIX,
)

REMINDER = "<system-reminder>"


class TestInjectionAckSwitch:
    """合成回执总开关（PLANIFY_INJECTION_ACK，core.config.injection_ack_enabled）。

    2026-10-25 清剿事故判例：合成 assistant 回执让请求以 assistant 结尾，
    thinking 模式端点（DeepSeek 等）按 prefill 处理 → 400。默认关；
    开关打开时（严格交替端点）两处预算提醒须恢复回执。
    """

    def _soft_script(self):
        # 8 轮预算 → 第 7 轮注入软提醒（第 8 轮请求携带）
        return [{"tools": [("bash", {"command": f"c{i}"})]} for i in range(8)]

    def test_default_no_ack_after_reminders(self, monkeypatch):
        monkeypatch.delenv("PLANIFY_INJECTION_ACK", raising=False)
        client = ScriptedClient(self._soft_script())
        _run(client, max_rounds=8)
        # 携带软提醒的请求里，末条必须是 user（提醒本体），无合成回执
        for r in client.records:
            contents = [m.get("content") for m in r if isinstance(m.get("content"), str)]
            if any("轮次预算即将用尽" in str(c) for c in contents):
                assert r[-1]["role"] == "user"
                assert not any(m.get("content") == "明白，我现在开始汇总。" for m in r)

    def test_ack_restored_when_enabled(self, monkeypatch):
        monkeypatch.setenv("PLANIFY_INJECTION_ACK", "1")
        client = ScriptedClient(self._soft_script())
        _run(client, max_rounds=8)
        seen = [
            m for r in client.records for m in r
            if m.get("content") == "明白，我现在开始汇总。"
        ]
        assert seen, "开关开启时软提醒后应恢复合成回执"
        # 回执紧跟提醒（同轮请求内提醒与回执成对出现）
        for r in client.records:
            texts = [m.get("content") for m in r]
            if "明白，我现在开始汇总。" in texts:
                i = texts.index("明白，我现在开始汇总。")
                assert isinstance(texts[i - 1], str) and "轮次预算即将用尽" in texts[i - 1]
                break


class FakeBlock:
    """仿 LLMResponse 内容块（text / tool_use 两形态）。"""

    def __init__(self, type_, **kw):
        self.type = type_
        for k, v in kw.items():
            setattr(self, k, v)


class FakeResp:
    def __init__(self, content, stop_reason):
        self.content = content
        self.stop_reason = stop_reason


class ScriptedClient:
    """按脚本逐次产出响应；记录每次请求的 messages。

    script 元素：{"tools": [(name, input), ...]} 或 {"text": "..."}；
    脚本耗尽后重复最后一个元素（模拟永不收尾的工具循环）。
    """

    def __init__(self, script):
        self.script = script
        self.records = []
        self._call = 0

    def chat(self, *, messages, system, tools, max_tokens, tracer=None):
        self.records.append([m.copy() for m in messages])
        step = self.script[min(self._call, len(self.script) - 1)]
        self._call += 1
        if "tools" in step:
            blocks = [
                FakeBlock("tool_use", id=f"tu_{self._call}_{i}", name=n, input=dict(inp))
                for i, (n, inp) in enumerate(step["tools"])
            ]
            return FakeResp(blocks, "tool_use")
        return FakeResp([FakeBlock("text", text=step["text"])], "end_turn")


def _tools():
    """四个基础工具的假 handler：bash 回显命令，read/write/edit 回显操作。"""
    def h(**kw):
        return f"ok: {kw}"
    return h


def _run(client, max_rounds=30):
    return run_subagent(
        "test prompt", "Explore", "unused-workdir", client, "test-model",
        run_bash=_tools(), run_read=_tools(), run_write=_tools(), run_edit=_tools(),
        max_rounds=max_rounds,
    )


class TestRoundLimitMarker:
    """机制④：跑满轮数 → 截断标记前缀。"""

    def test_round_limit_marker_on_exhaustion(self):
        # 每轮参数不同（避开同参检测），跑满 5 轮仍不收尾
        client = ScriptedClient([
            {"tools": [("bash", {"command": f"cmd{i}"})]} for i in range(5)
        ])
        out = _run(client, max_rounds=5)
        assert out.startswith(ROUND_LIMIT_PREFIX)
        assert "5 轮" in out

    def test_normal_finish_no_marker(self):
        client = ScriptedClient([
            {"tools": [("bash", {"command": "ls"})]},
            {"text": "任务完成摘要。"},
        ])
        out = _run(client, max_rounds=10)
        assert out == "任务完成摘要。"
        assert ROUND_LIMIT_PREFIX not in out


class TestIdenticalRoundDetection:
    """机制②：连续同参调用 → 死循环提醒注入。"""

    def test_identical_signature_injects_reminder(self):
        # 连续同参 bash 调用；第 3 轮触发提醒后脚本给文本收尾
        client = ScriptedClient([
            {"tools": [("bash", {"command": "same"})]},  # 1
            {"tools": [("bash", {"command": "same"})]},  # 2
            {"tools": [("bash", {"command": "same"})]},  # 3 → 提醒（continue，不执行工具）
            {"text": "调整后的总结。"},                    # 4
        ])
        out = _run(client, max_rounds=10)
        assert out == "调整后的总结。"
        # 提醒在工具执行前注入：第 3 轮请求的 messages 已含 system-reminder
        reminders = [
            m for r in client.records for m in r
            if isinstance(m.get("content"), str) and REMINDER in m["content"]
        ]
        assert reminders, "应注入 <system-reminder> 死循环提醒"

    def test_different_params_no_reminder(self):
        client = ScriptedClient([
            {"tools": [("bash", {"command": "a"})]},
            {"tools": [("bash", {"command": "b"})]},
            {"tools": [("bash", {"command": "c"})]},
            {"text": "done"},
        ])
        out = _run(client, max_rounds=10)
        assert out == "done"
        reminders = [
            m for r in client.records for m in r
            if isinstance(m.get("content"), str) and REMINDER in m["content"]
        ]
        assert not reminders, "参数每轮不同，不应触发死循环提醒"

    def test_identical_limit_constant(self):
        assert _IDENTICAL_ROUNDS_LIMIT == 3


class TestSoftRemind:
    """机制③：预算将尽 → 收尾提醒一次。"""

    def test_soft_remind_round_math(self):
        # 剩约 1/6：30 → 第 25 轮提醒；12 → 第 10 轮；6 → 第 5 轮
        assert _soft_remind_round(30) == 25
        assert _soft_remind_round(12) == 10
        assert _soft_remind_round(6) == 5
        assert _soft_remind_round(1) == 1  # 极小预算也有合法值

    def test_soft_reminder_injected_once(self):
        # 8 轮预算：公式给出生效轮号；脚本在提醒后仍持续调工具（验证只注入一次）
        remind_at = _soft_remind_round(8)
        script = [{"tools": [("bash", {"command": f"c{i}"})]} for i in range(8)]
        client = ScriptedClient(script)
        _run(client, max_rounds=8)
        soft_texts = [
            m["content"]
            for r in client.records for m in r
            if isinstance(m.get("content"), str)
            and "轮次预算即将用尽" in m["content"]
        ]
        # 首次注入位置：提醒在第 remind_at 轮的 LLM 响应后注入，故首次
        # 出现在第 remind_at+1 轮的请求里（0-based 索引 = remind_at）；
        # 注入后留在历史里、后续请求自然携带（与 StreamingAgent 同行为）
        first_idx = next(
            i for i, r in enumerate(client.records)
            if any(
                isinstance(m.get("content"), str) and "轮次预算即将用尽" in m["content"]
                for m in r
            )
        )
        assert first_idx == remind_at
        assert soft_texts, "应注入软提醒"
        # 注入动作只发生一次：首次出现后，历史中的提醒条数不再增长
        count_in_first = sum(
            1 for m in client.records[first_idx]
            if isinstance(m.get("content"), str) and "轮次预算即将用尽" in m["content"]
        )
        count_in_last = sum(
            1 for m in client.records[-1]
            if isinstance(m.get("content"), str) and "轮次预算即将用尽" in m["content"]
        )
        assert count_in_first == count_in_last == 1


class TestSignature:
    """签名函数：同参同签名、异参异签名（与 StreamingAgent 同构）。"""

    def test_signature_semantics(self):
        a = _round_signature([("bash", {"command": "x", "flag": True})])
        b = _round_signature([("bash", {"flag": True, "command": "x"})])  # 键序无关
        c = _round_signature([("bash", {"command": "y"})])
        assert a == b
        assert a != c
        assert _round_signature([]) == ()
