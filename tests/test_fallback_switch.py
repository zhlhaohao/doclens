# -*- coding: utf-8 -*-
"""兜底模型切换——planify runner 机制层（ADR-0061）。

框架只出机制：切换触发判定 → 问 resolver → 修补消息 → 换 provider →
告知。谁做候选、怎么排序、怎么预检全在宿主 resolver（doclens 侧另有
测试）。本文件覆盖：

1. 未注入 resolver：行为与旧版逐字节一致（不切换、按原错误收场）；
2. 额度耗尽 → 问 resolver → 切到候选 → 同一请求重发成功；
3. 瞬时错误：先退避重试（不切），耗尽后才切；
4. 配置类错误（401）：不切换；
5. 中途切换：半截文本补进历史 + <model-switch> 提示；
6. 全部候选耗尽：按原错误收场 + failed 通知带候选报告；
7. 回合内只向下不切回：切到 B 后 B 再失败 → 问 resolver 要 C；
8. notice 协议三阶段（searching / switched / failed）。
"""
import asyncio
import json
import logging
from types import SimpleNamespace

import pytest

from planify.core.llm.provider_context import mark_provider_error
from planify.core.llm.upstream_errors import PROVIDER_GLM
from planify.streaming.runner import (
    MODEL_SWITCH_TAG,
    StreamingAgent,
    fallback_trigger_reason,
)
from planify.streaming.types import (
    FALLBACK_PHASE_FAILED,
    FALLBACK_PHASE_SEARCHING,
    FALLBACK_PHASE_SWITCHED,
    FallbackCandidate,
    StreamingConfig,
)


def _glm_quota_error(code="1308"):
    """GLM 5h 上限：429 rate_limit_error + 业务码（provider 已贴标）。"""

    class E(Exception):
        def __init__(self):
            super().__init__("429 rate_limit_error")
            self.body = {"error": {"type": "rate_limit_error", "code": code}}
            self.status_code = 429
            self.type = "rate_limit_error"

    e = E()
    mark_provider_error(e, PROVIDER_GLM)
    return e


def _auth_error():
    class E(Exception):
        def __init__(self):
            super().__init__("401 invalid api key")
            self.body = {"error": {"type": "authentication_error"}}
            self.status_code = 401
            self.type = "authentication_error"

    return E()


def _overloaded_error():
    """5xx 瞬时类（无业务码）。"""

    class E(Exception):
        def __init__(self):
            super().__init__("503 overloaded")
            self.status_code = 503

    return E()


class _ScriptedProvider:
    """按脚本响应的假 provider：每步 fail / text / partial_then_fail。"""

    def __init__(self, script, name="A"):
        self.script = script
        self.calls = 0
        self.name = name

    def _ev(self, **kw):
        base = dict(
            usage=None, block_index=None, block_type=None,
            tool_use_id=None, tool_name=None, text_delta=None,
            thinking_delta=None, input_json_delta=None, stop_reason=None,
        )
        base.update(kw)
        return SimpleNamespace(**base)

    async def astream(self, **kw):
        self.calls += 1
        step = self.script[min(self.calls - 1, len(self.script) - 1)]
        if "fail" in step:
            raise step["fail"]
        if step.get("partial"):
            yield self._ev(type="content_block_delta", block_index=0,
                           text_delta=step["partial"])
            raise step["then_fail"]
        yield self._ev(type="content_block_delta", block_index=0,
                       text_delta=step.get("text", ""))
        yield self._ev(type="content_block_delta", block_index=0,
                       block_type="text")
        yield self._ev(type="message_delta", stop_reason="end_turn")
        yield self._ev(type="message_stop")


class _Emitter:
    def __init__(self):
        self.texts = []
        self.errors = []
        self.notices = []
        self.dones = []

    async def emit_text(self, text, is_end=False):
        self.texts.append(text)

    async def emit_thinking(self, delta):
        pass

    async def emit_tool_call(self, tool_use_id, name, input_data, is_complete=False):
        pass

    async def emit_tool_result(self, tool_use_id, name, output, is_error=False):
        pass

    async def emit_done(self, session_id, summary=None, reason=None):
        self.dones.append(reason)

    async def emit_error(self, error, code=None):
        self.errors.append(str(error))

    async def emit_usage(self, usage):
        pass

    async def emit_notice(self, detail, level="info", **kw):
        self.notices.append({"detail": detail, "level": level, **kw})


class _Resolver:
    """假 resolver：按序返回候选；耗尽返回 None。记录每次调用参数。"""

    def __init__(self, candidates, last_report=None):
        self.candidates = list(candidates)
        self.calls = []
        self.last_report = last_report

    async def resolve(self, *, current_model_id, tried, reason):
        self.calls.append(
            {"current": current_model_id, "tried": list(tried), "reason": reason}
        )
        if not self.candidates:
            return None
        return self.candidates.pop(0)


def _agent(provider, resolver=None, base_label=None):
    tmp = SimpleNamespace(
        config=SimpleNamespace(workdir=".", assets_dir=None),
        skill_access_state=None,
    )
    emitter = _Emitter()
    agent = StreamingAgent(
        client=provider,
        model=provider.name,
        tools=[],
        tool_handlers={},
        emitter=emitter,
        config=StreamingConfig(compact_threshold=10**9),
        skills_loader=None,
        runtime=tmp,
        fallback_resolver=resolver,
        fallback_base_label=base_label,
    )
    return agent, emitter


def _run(agent):
    asyncio.run(agent.run_stream([], "问题", "sid"))


@pytest.fixture(autouse=True)
def _instant_sleep(monkeypatch):
    async def _no_sleep(s):
        return None

    monkeypatch.setattr(asyncio, "sleep", _no_sleep)


class TestTriggerReason:
    def test_quota_error(self):
        assert fallback_trigger_reason(_glm_quota_error()) == "quota"

    def test_transient(self):
        assert fallback_trigger_reason(_overloaded_error()) == "transient"

    def test_config_error_not_triggered(self):
        assert fallback_trigger_reason(_auth_error()) is None

    def test_plain_exception(self):
        assert fallback_trigger_reason(ValueError("boom")) is None


class TestNoResolver:
    """未注入 resolver：旧版行为——额度耗尽不重试、不切换、原样收场。"""

    def test_quota_error_fails_fast_without_retry(self):
        provider = _ScriptedProvider([{"fail": _glm_quota_error()}])
        agent, emitter = _agent(provider)
        _run(agent)
        # 额度耗尽不走退避重试：仅 1 次调用（旧版会空转 4 次）
        assert provider.calls == 1
        assert len(emitter.errors) == 1
        assert "额度" in emitter.errors[0]
        assert "未配置兜底" in emitter.errors[0]


class TestSwitchSuccess:
    def test_quota_switches_and_resumes(self):
        a = _ScriptedProvider([{"fail": _glm_quota_error()}], name="A")
        b = _ScriptedProvider([{"text": "B 的回答"}], name="B")
        resolver = _Resolver([FallbackCandidate(provider=b, model_id="B", label="B")])
        agent, emitter = _agent(a, resolver)
        _run(agent)

        assert a.calls == 1, "额度耗尽不退避，直接切换"
        assert b.calls == 1
        assert "".join(emitter.texts) == "B 的回答"
        assert not emitter.errors
        assert agent.model == "B"
        assert agent.provider is b
        assert agent.fallback_switches == [("A", "B", "quota")]

    def test_resolver_receives_context(self):
        a = _ScriptedProvider([{"fail": _glm_quota_error()}], name="A")
        b = _ScriptedProvider([{"text": "ok"}], name="B")
        resolver = _Resolver([FallbackCandidate(provider=b, model_id="B", label="B")])
        agent, _ = _agent(a, resolver)
        _run(agent)
        assert resolver.calls == [{"current": "A", "tried": [], "reason": "quota"}]

    def test_notices_three_phases(self):
        a = _ScriptedProvider([{"fail": _glm_quota_error()}], name="A")
        b = _ScriptedProvider([{"text": "ok"}], name="B")
        resolver = _Resolver([FallbackCandidate(provider=b, model_id="B", label="B")])
        agent, emitter = _agent(a, resolver)
        _run(agent)
        phases = [n.get("fallback_phase") for n in emitter.notices]
        assert phases == [FALLBACK_PHASE_SEARCHING, FALLBACK_PHASE_SWITCHED]
        switched = emitter.notices[1]
        assert switched["fallback_from"] == "A"
        assert switched["fallback_to"] == "B"
        assert switched["fallback_reason"] == "quota"

    def test_transient_retries_before_switch(self):
        """瞬时错误先退避重试（4 次），耗尽后才切换。"""
        a = _ScriptedProvider([{"fail": _overloaded_error()}], name="A")
        b = _ScriptedProvider([{"text": "ok"}], name="B")
        resolver = _Resolver([FallbackCandidate(provider=b, model_id="B", label="B")])
        agent, emitter = _agent(a, resolver)
        _run(agent)
        assert a.calls == 4, "瞬时错误先走完 4 次退避"
        assert resolver.calls[0]["reason"] == "transient"
        assert b.calls == 1
        assert not emitter.errors

    def test_auth_error_never_switches(self):
        a = _ScriptedProvider([{"fail": _auth_error()}], name="A")
        b = _ScriptedProvider([{"text": "ok"}], name="B")
        resolver = _Resolver([FallbackCandidate(provider=b, model_id="B", label="B")])
        agent, emitter = _agent(a, resolver)
        _run(agent)
        assert resolver.calls == []
        assert b.calls == 0
        assert emitter.errors
        assert "兜底" not in emitter.errors[0], "配置错误不附带兜底语境"

    def test_chained_switch_goes_down_only(self):
        """A 耗尽 → B；B 耗尽 → C（不回头找 A）。"""
        a = _ScriptedProvider([{"fail": _glm_quota_error()}], name="A")
        b = _ScriptedProvider([{"fail": _glm_quota_error()}], name="B")
        c = _ScriptedProvider([{"text": "C 的回答"}], name="C")
        resolver = _Resolver([
            FallbackCandidate(provider=b, model_id="B", label="B"),
            FallbackCandidate(provider=c, model_id="C", label="C"),
        ])
        agent, emitter = _agent(a, resolver)
        _run(agent)
        assert resolver.calls[1] == {"current": "B", "tried": ["B"], "reason": "quota"}
        assert "".join(emitter.texts) == "C 的回答"
        assert agent.fallback_switches == [("A", "B", "quota"), ("B", "C", "quota")]

    def test_injected_base_label_used_as_from(self):
        """宿主注入 fallback_base_label：from 用注入名而非裸 model_id。

        2026-11-25 实测事故：from 落的是 model_id「glm-5.4」，宿主前端拿预设名
        比对「激活预设是否已换」恒不等 → 下一条消息的提醒框永远不弹。
        """
        a = _ScriptedProvider([{"fail": _glm_quota_error()}], name="glm-5.4")
        b = _ScriptedProvider([{"text": "ok"}], name="glm-5.4")
        resolver = _Resolver([
            FallbackCandidate(provider=b, model_id="glm-5.4", label="账号B · glm-5.4"),
        ])
        agent, emitter = _agent(a, resolver, base_label="主账号 · glm-5.4")
        _run(agent)
        assert agent.fallback_switches == [("主账号 · glm-5.4", "账号B · glm-5.4", "quota")]
        notices = [e for e in emitter.notices if e.get("fallback_phase") == FALLBACK_PHASE_SWITCHED]
        assert notices and notices[0]["fallback_from"] == "主账号 · glm-5.4"

    def test_base_label_not_stale_across_rounds(self):
        """复用实例（CLI/TUI）跨轮：上轮切到的兜底不得被当成本轮「从谁切走」。"""
        a = _ScriptedProvider([{"fail": _glm_quota_error()}], name="A")
        b = _ScriptedProvider([{"text": "ok"}], name="B")
        resolver = _Resolver([FallbackCandidate(provider=b, model_id="B", label="B")])
        agent, _ = _agent(a, resolver, base_label="主模型A · A")
        _run(agent)
        assert agent.model == "B" and agent._fallback_label == "B"
        # 第二轮（脚本最后一步复用：B 持续返回 ok）：轮首回到主模型标签，
        # 上轮切到的 B 不得残留为本轮「从谁切走」
        asyncio.run(agent.run_stream([], "第二问", "sid"))
        assert agent._fallback_label == "主模型A · A"
        assert agent.fallback_switches == []


class TestMidStreamSwitch:
    def test_partial_text_repaired_into_history(self):
        """端到端：A 流出半截后耗尽 → B 完整重答，用户看到半截 + 完整。"""
        a = _ScriptedProvider(
            [{"partial": "半截回答…", "then_fail": _glm_quota_error()}], name="A"
        )
        b = _ScriptedProvider([{"text": "完整回答"}], name="B")
        resolver = _Resolver([FallbackCandidate(provider=b, model_id="B", label="B")])
        agent, emitter = _agent(a, resolver)
        _run(agent)
        assert "".join(emitter.texts) == "半截回答…完整回答"
        assert not emitter.errors

    def test_mid_stream_switch_appends_switch_message(self, monkeypatch):
        """直接观测 _try_fallback_switch 对 messages 的修补。"""
        a = _ScriptedProvider([{"text": "x"}], name="A")
        agent, _ = _agent(a)
        agent._streamed_text = "半截回答…"
        b = _ScriptedProvider([{"text": "ok"}], name="B")
        agent.fallback_resolver = _Resolver(
            [FallbackCandidate(provider=b, model_id="B", label="B")]
        )
        messages = [{"role": "user", "content": "问"}]

        async def go():
            return await agent._try_fallback_switch(
                messages=messages, reason="quota", emitted=True, error=None
            )

        assert asyncio.run(go()) is True
        assert messages[-2] == {
            "role": "assistant",
            "content": [{"type": "text", "text": "半截回答…"}],
        }
        assert messages[-1]["role"] == "user"
        assert MODEL_SWITCH_TAG in messages[-1]["content"]
        assert agent._streamed_text == "", "半截缓存取后清空"

    def test_clean_switch_does_not_touch_messages(self):
        a = _ScriptedProvider([{"text": "x"}], name="A")
        agent, _ = _agent(a)
        b = _ScriptedProvider([{"text": "ok"}], name="B")
        agent.fallback_resolver = _Resolver(
            [FallbackCandidate(provider=b, model_id="B", label="B")]
        )
        messages = [{"role": "user", "content": "问"}]

        async def go():
            return await agent._try_fallback_switch(
                messages=messages, reason="quota", emitted=False, error=None
            )

        assert asyncio.run(go()) is True
        assert len(messages) == 1, "未流出内容时不修补历史"


class TestAllExhausted:
    def test_raises_original_with_failed_notice(self):
        a = _ScriptedProvider([{"fail": _glm_quota_error()}], name="A")
        resolver = _Resolver(
            [], last_report=[{"label": "B", "reason": "额度耗尽"},
                             {"label": "C", "reason": "试调失败"}]
        )
        agent, emitter = _agent(a, resolver)
        _run(agent)
        assert emitter.errors
        assert "兜底模型均不可用" in emitter.errors[0]
        failed = [n for n in emitter.notices if n.get("fallback_phase") == FALLBACK_PHASE_FAILED]
        assert len(failed) == 1
        assert failed[0]["fallback_report"] == [
            {"label": "B", "reason": "额度耗尽"},
            {"label": "C", "reason": "试调失败"},
        ]

    def test_resolver_exception_treated_as_no_candidate(self):
        class _Boom:
            async def resolve(self, **kw):
                raise RuntimeError("resolver 坏了")

        a = _ScriptedProvider([{"fail": _glm_quota_error()}], name="A")
        agent, emitter = _agent(a, _Boom())
        _run(agent)
        assert emitter.errors
        phases = [n.get("fallback_phase") for n in emitter.notices]
        assert FALLBACK_PHASE_FAILED in phases


class TestOldEmitterCompat:
    def test_old_emitter_without_new_kwargs_still_gets_notice(self):
        """旧宿主 emitter 的 emit_notice 不认 fallback_* kwargs → 退化为普通 notice。"""

        class _OldEmitter(_Emitter):
            async def emit_notice(self, detail, level="info"):
                self.notices.append({"detail": detail, "level": level})

        a = _ScriptedProvider([{"fail": _glm_quota_error()}], name="A")
        b = _ScriptedProvider([{"text": "ok"}], name="B")
        resolver = _Resolver([FallbackCandidate(provider=b, model_id="B", label="B")])
        tmp = SimpleNamespace(config=SimpleNamespace(workdir=".", assets_dir=None))
        agent = StreamingAgent(
            client=a, model="A", tools=[], tool_handlers={},
            emitter=_OldEmitter(), config=StreamingConfig(compact_threshold=10**9),
            skills_loader=None, runtime=tmp, fallback_resolver=resolver,
        )
        _run(agent)
        assert [n["detail"] for n in agent.emitter.notices] == [
            "主模型不可用，正在寻找可用的兜底模型…",
            "已切换到兜底模型 B",
        ]
