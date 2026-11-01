# -*- coding: utf-8 -*-
"""主代理 LLM 调用瞬时 429/5xx 退避重试测试（2026-11-01 P2 修复）。

事故形态（debug_20261027.log:698）：tools=68 轮的长任务在循环 #66 撞
Kimi "engine is currently overloaded" 429——anthropic SDK 内建 2 次重试
耗尽后异常直穿 run_stream 的 except，emit_error 收场，68 轮成果整轮报废。
子代理早有 _chat_with_retry，主代理 StreamingAgent 缺同构机制。

修复契约：
1. retryable 异常（429 RateLimitError / APIConnectionError / 5xx）在
   **未发射任何字节**前按指数退避重试（默认 4 次尝试）；
2. 重试成功 → 正常产出，不丢轮；
3. 非retryable（如 401）不重试立即上抛；
4. 已发射字节后（首文本已 emit_text）不重试——防正文重复。
"""
import asyncio
import logging
from types import SimpleNamespace

import pytest

from planify.streaming.runner import StreamingAgent, is_retryable_llm_error
from planify.streaming.types import StreamingConfig


class _FakeRateLimitError(Exception):
    """仿 anthropic.RateLimitError（SDK 类名判别路径）。"""

    def __init__(self, msg="429 overloaded"):
        super().__init__(msg)


_FakeRateLimitError.__name__ = "RateLimitError"


class _FakeAuthError(Exception):
    pass


_FakeAuthError.__name__ = "AuthenticationError"


class _ScriptedProvider:
    """按脚本逐次产出 astream 行为（astream 为真 async 生成器函数，
    与真实 provider 同形——异常在迭代首个事件时抛出，而非调用时）。

    事件对象用 SimpleNamespace（runner 按鸭子类型读字段，同
    tests/test_stream_usage._UsageProvider 约定）。
    script 元素：{"fail": exc} 或 {"text": "..."}（流式事件后结束）。
    """

    def __init__(self, script):
        self.script = script
        self.calls = 0

    def _ev(self, **kw):
        base = dict(
            usage=None, block_index=None, block_type=None, tool_use_id=None,
            tool_name=None, text_delta=None, thinking_delta=None,
            input_json_delta=None, stop_reason=None,
        )
        base.update(kw)
        return SimpleNamespace(**base)

    async def astream(self, **kw):
        self.calls += 1
        step = self.script[min(self.calls - 1, len(self.script) - 1)]
        if "fail" in step:
            raise step["fail"]
        yield self._ev(type="content_block_delta", block_index=0,
                       text_delta=step.get("text", ""))
        yield self._ev(type="message_delta", stop_reason="end_turn")
        yield self._ev(type="message_stop")


class _CountingEmitter:
    """记 emit_text 次数的空 emitter。"""

    def __init__(self):
        self.texts = []
        self.errors = []
        self.usages = []

    async def emit_text(self, text, is_end=False):
        self.texts.append(text)

    async def emit_thinking(self, delta):
        pass

    async def emit_tool_call(self, tool_use_id, name, input_data, is_complete=False):
        pass

    async def emit_tool_result(self, tool_use_id, name, output, is_error=False):
        pass

    async def emit_done(self, session_id, summary=None, reason=None):
        pass

    async def emit_error(self, error, code=None):
        self.errors.append(str(error))

    async def emit_usage(self, usage):
        self.usages.append(usage)


def _make_agent(provider, emitter=None):
    tmp = SimpleNamespace(
        config=SimpleNamespace(workdir=".", assets_dir=None),
        skill_access_state=None,
    )
    return StreamingAgent(
        client=provider,
        model="mock",
        tools=[],
        tool_handlers={},
        emitter=emitter or _CountingEmitter(),
        config=StreamingConfig(compact_threshold=10**9),
        skills_loader=None,
        runtime=tmp,
    )


class TestRetryableClassification:
    def test_sdk_rate_limit_retryable(self):
        assert is_retryable_llm_error(_FakeRateLimitError())

    def test_sdk_5xx_retryable(self):
        e = _FakeAuthError()
        e.status_code = 503
        assert is_retryable_llm_error(e)

    def test_auth_not_retryable(self):
        assert not is_retryable_llm_error(_FakeAuthError())

    def test_4xx_not_retryable(self):
        e = _FakeAuthError()
        e.status_code = 400
        assert not is_retryable_llm_error(e)

    def test_planify_retryable_flag(self):
        from planify.core.llm.errors import LLMNetworkError

        assert is_retryable_llm_error(LLMNetworkError("x"))


class Test429Retry:
    def test_transient_429_retried_then_success(self, monkeypatch, caplog):
        """前两次 429、第三次成功 → 正常产出，不 emit_error。"""
        monkeypatch.setattr(asyncio, "sleep", lambda s: _instant_sleep(s))
        provider = _ScriptedProvider([
            {"fail": _FakeRateLimitError()},
            {"fail": _FakeRateLimitError()},
            {"text": "成功了"},
        ])
        emitter = _CountingEmitter()
        sa = _make_agent(provider, emitter)
        with caplog.at_level(logging.INFO, logger="planify.streaming.runner"):
            asyncio.run(sa.run_stream([], "问题", "sid"))
        assert provider.calls == 3, "两次 429 后第三次应成功"
        assert "".join(emitter.texts).startswith("成功了")
        assert not emitter.errors
        warns = [r.getMessage() for r in caplog.records if "可重试失败" in r.getMessage()]
        assert len(warns) == 2, f"应有两条退避 WARNING，实际: {warns}"

    def test_non_retryable_raises_immediately(self, caplog):
        provider = _ScriptedProvider([{"fail": _FakeAuthError()}])
        emitter = _CountingEmitter()
        sa = _make_agent(provider, emitter)
        with caplog.at_level(logging.INFO, logger="planify.streaming.runner"):
            asyncio.run(sa.run_stream([], "问题", "sid"))
        assert provider.calls == 1, "401 不应重试"
        assert emitter.errors, "非重试异常应 emit_error 收场"

    def test_exhausted_retries_fail_round(self, monkeypatch):
        monkeypatch.setattr(asyncio, "sleep", lambda s: _instant_sleep(s))
        provider = _ScriptedProvider([{"fail": _FakeRateLimitError("持续过载")}])
        emitter = _CountingEmitter()
        sa = _make_agent(provider, emitter)
        asyncio.run(sa.run_stream([], "问题", "sid"))
        assert provider.calls == 4, "默认 4 次尝试全耗尽"
        assert emitter.errors


async def _instant_sleep(s):
    """测试内 sleep 立即返回（退避不真等）。"""
    return None


def _instant_sleep_sync(s):
    return None
