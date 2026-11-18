# -*- coding: utf-8 -*-
"""上游 LLM 瞬时故障的识别与文案脱敏（2026-11-18）。

事故形态（``.doclens/logs/debug_20261118.log`` 13:05:29）：MiniMax
``/anthropic`` 端点在 **SSE 流中**下发 error 事件，body::

    {"type": "error", "error": {"type": "api_error",
                                "message": "unknown error, 715 (1000)"}}

anthropic SDK 走 SSE error 分支抛 ``APIStatusError``，但 **HTTP 状态是
200**（流已开）——旧的两条判据（异常类名白名单 + ``status_code ∈ [500,600)``）
全不命中 → 主代理一次都不重试，38 条消息的会话在第 5 轮整轮报废。

修复契约：
1. ``is_retryable_llm_error`` 识别「上游业务码 / SSE 流中 error 事件」→
   走既有退避重试路径；
2. 不可重试的 4xx 仍不重试（认证/参数错误重试也没用）；
3. 用户可见文案脱敏——上游原文（英文占位符 + 网关码 + 业务码）不进
   转录气泡，替换为可读句子；原文只进日志。
"""
import asyncio
import json
import logging

import pytest

from planify.core.llm.retry_policy import is_retryable_llm_error, user_facing_llm_error
from planify.core.llm.upstream_errors import (
    PROVIDER_DEEPSEEK,
    PROVIDER_GENERIC,
    PROVIDER_GLM,
    PROVIDER_KIMI,
    PROVIDER_MINIMAX,
    detect_provider,
    extract_upstream_error_info,
    is_retryable_upstream_error,
)
from planify.streaming.runner import StreamingAgent


def _mark(e, provider):
    """在异常上贴 provider 标记（模拟 provider 层抛出点的行为）。"""
    from planify.core.llm.provider_context import mark_provider_error

    mark_provider_error(e, provider)
    return e


class _FakeAPIStatusError(Exception):
    """仿 anthropic.APIStatusError：携带 body / status_code / type 属性。"""

    def __init__(self, message, body=None, status_code=200):
        super().__init__(message)
        self.body = body
        self.status_code = status_code
        self.type = None
        if isinstance(body, dict):
            err = body.get("error")
            if isinstance(err, dict):
                self.type = err.get("type")


def _minimax_sse_error():
    """复刻事故现场：SSE 流中 error 事件（HTTP 200 + MiniMax 业务码）。"""
    body = {
        "type": "error",
        "error": {
            "type": "api_error",
            "message": "unknown error, 715 (1000)",
        },
    }
    return _FakeAPIStatusError(
        json.dumps(body), body=body, status_code=200
    )


class TestExtractInfo:
    def test_extracts_type_code_and_message(self):
        info = extract_upstream_error_info(
            _minimax_sse_error(), provider=PROVIDER_MINIMAX
        )
        assert info["error_type"] == "api_error"
        assert info["business_code"] == 1000
        assert "unknown error" in info["message"]
        assert info["http_status"] == 200
        assert info["provider"] == PROVIDER_MINIMAX

    def test_paren_code_only_extracted_for_minimax(self):
        """无 provider（generic）时不从 message 抠括号数字——防误伤。"""
        e = _FakeAPIStatusError(
            "x", body={"error": {"type": "api_error", "message": "unknown error, 715 (1000)"}}
        )
        info = extract_upstream_error_info(e)  # 不传 provider
        assert info["business_code"] is None
        # 显式 MiniMax 才抠
        info2 = extract_upstream_error_info(e, provider=PROVIDER_MINIMAX)
        assert info2["business_code"] == 1000

    def test_glm_code_string_coerced(self):
        """GLM 的 error.code 是字符串 "1308" → 归一成 int。"""
        e = _FakeAPIStatusError(
            "429", body={"error": {"type": "rate_limit_error", "code": "1308"}}, status_code=429
        )
        info = extract_upstream_error_info(e, provider=PROVIDER_GLM)
        assert info["business_code"] == 1308

    def test_body_as_json_string(self):
        e = _FakeAPIStatusError("boom", body=json.dumps({"error": {"type": "api_error"}}))
        info = extract_upstream_error_info(e)
        assert info["error_type"] == "api_error"

    def test_no_body_tolerated(self):
        info = extract_upstream_error_info(_FakeAPIStatusError("plain", body=None))
        assert info["error_type"] is None
        assert info["business_code"] is None


class TestRetryableClassification:
    def test_sse_error_event_retryable(self):
        """事故形态：HTTP 200 但带 MiniMax 业务码 → 必须判可重试。"""
        e = _minimax_sse_error()
        assert is_retryable_upstream_error(e, provider=PROVIDER_MINIMAX)
        # provider 标记贴上后，retry_policy 自动按 provider 分表
        assert is_retryable_llm_error(_mark(e, PROVIDER_MINIMAX))

    def test_auth_error_not_retryable(self):
        body = {"error": {"type": "authentication_error", "message": "invalid key"}}
        e = _FakeAPIStatusError("401", body=body, status_code=401)
        assert not is_retryable_upstream_error(e)
        assert not is_retryable_llm_error(e)

    def test_invalid_request_not_retryable(self):
        body = {"error": {"type": "invalid_request_error", "message": "bad param"}}
        e = _FakeAPIStatusError("400", body=body, status_code=400)
        assert not is_retryable_upstream_error(e)

    def test_5xx_still_retryable(self):
        e = _FakeAPIStatusError("500", body=None, status_code=503)
        assert is_retryable_llm_error(e)

    def test_retryable_business_codes(self):
        for code in (1000, 1001, 1002, 1024, 1033, 2064, 2066):
            body = {"error": {"type": "api_error", "message": f"unknown error, 715 ({code})"}}
            e = _FakeAPIStatusError("x", body=body, status_code=200)
            assert is_retryable_upstream_error(e, provider=PROVIDER_MINIMAX), (
                f"MiniMax 业务码 {code} 应可重试"
            )

    def test_non_retryable_business_code(self):
        """MiniMax 业务码 1008（余额不足）重试无用 → 不可重试。"""
        body = {"error": {"type": "api_error", "message": "insufficient balance (1008)"}}
        e = _FakeAPIStatusError("x", body=body, status_code=200)
        assert not is_retryable_upstream_error(e, provider=PROVIDER_MINIMAX)


class TestGLMAndDeepSeekCompatibility:
    """跨端点兼容（2026-11-18 复核）：
    - GLM（bigmodel，anthropic 协议）：429 rate_limit_error + 业务码 1308
      必须重试——事故里子代理路径被判 retryable=False 直接放弃；
    - DeepSeek（openai_compat 协议，openai SDK）：限流 / 5xx 覆盖；
    - 误伤检查：message 里带括号数字的普通错误不得被当业务码。
    """

    def _anthropic_err(self, body, status_code):
        return _FakeAPIStatusError("x", body=body, status_code=status_code)

    def _openai_err(self, body, status_code):
        class E(Exception):
            def __init__(self):
                super().__init__("x")
                self.body = body
                self.status_code = status_code
                self.code = body.get("code") if isinstance(body, dict) else None
                self.type = body.get("type") if isinstance(body, dict) else None

        return E()

    def test_glm_rate_limit_retryable(self):
        """GLM 429 rate_limit_error（事故子代理路径）必须重试。"""
        e = self._anthropic_err(
            {"type": "error", "error": {"type": "rate_limit_error", "code": "1308",
                                        "message": "[1308][已达到 5 小时的使用上限]"}},
            429,
        )
        assert is_retryable_upstream_error(e, provider=PROVIDER_GLM)
        assert is_retryable_llm_error(_mark(e, PROVIDER_GLM))

    def test_glm_auth_not_retryable(self):
        e = self._anthropic_err(
            {"error": {"type": "authentication_error", "message": "invalid key"}}, 401
        )
        assert not is_retryable_upstream_error(e)

    def test_glm_1000_is_auth_not_minimax_unknown(self):
        """GLM 1000 = 身份验证失败（不可重试），与 MiniMax 1000 同号不同义。"""
        e = self._anthropic_err({"error": {"code": "1000", "message": "身份验证失败"}}, 401)
        assert not is_retryable_upstream_error(e, provider=PROVIDER_GLM)

    def test_glm_balance_not_retryable(self):
        """GLM 402 欠费（HTTP 4xx）→ 不可重试。"""
        e = self._anthropic_err(
            {"error": {"type": "api_error", "message": "insufficient balance (1008)"}}, 402
        )
        assert not is_retryable_upstream_error(e)

    def test_deepseek_rate_limit_body_retryable(self):
        e = self._openai_err({"error": {"type": "rate_limit", "message": "too many requests"}}, 429)
        assert is_retryable_upstream_error(e, provider=PROVIDER_DEEPSEEK)
        assert is_retryable_llm_error(_mark(e, PROVIDER_DEEPSEEK))

    def test_deepseek_invalid_request_not_retryable(self):
        e = self._openai_err({"error": {"type": "invalid_request_error"}}, 400)
        assert not is_retryable_upstream_error(e)

    def test_kimi_engine_overloaded_retryable(self):
        """Kimi engine_overloaded_error（429 节点过载）→ 重试。"""
        e = self._openai_err({"error": {"type": "engine_overloaded_error"}}, 429)
        assert is_retryable_upstream_error(e, provider=PROVIDER_KIMI)

    def test_kimi_quota_not_retryable(self):
        """Kimi exceeded_current_quota_error（额度不足）→ 不重试。"""
        e = self._openai_err({"error": {"type": "exceeded_current_quota_error"}}, 429)
        assert not is_retryable_upstream_error(e, provider=PROVIDER_KIMI)

    def test_plain_message_with_parens_not_misclassified(self):
        """普通错误 message 里带括号数字（如 (1234)）不得被当业务码。"""
        assert not is_retryable_llm_error(ValueError("解析失败：共 3 个文件 (1234)"))
        assert not is_retryable_llm_error(RuntimeError("渲染超时 (2000)"))

    def test_generic_no_provider_does_not_use_minimax_table(self):
        """无 provider 时不得按 MiniMax 码表判（防止 GLM 1000 被误放）。"""
        e = _FakeAPIStatusError(
            "x", body={"error": {"code": "1000", "message": "身份验证失败"}}, status_code=401
        )
        # 不传 provider → 不查 MiniMax 表，走 error.type / HTTP 状态码
        assert not is_retryable_upstream_error(e)

    def test_subagent_retries_glm_rate_limit(self):
        """子代理 _chat_with_retry 对 GLM 429 必须退避重试（旧代码不重试）。"""
        from planify.subagent.runner import _chat_with_retry
        import time as _time

        calls = {"n": 0}

        class C:
            def chat(self, **kw):
                calls["n"] += 1
                if calls["n"] < 2:
                    raise _FakeAPIStatusError(
                        "429",
                        {"error": {"type": "rate_limit_error", "code": "1308"}},
                        429,
                    )
                return "ok"

        orig = _time.sleep
        _time.sleep = lambda s: None
        try:
            out = _chat_with_retry(C(), [], "sys", [], 100, None,
                                   agent_type="general-purpose", round_no=1)
        finally:
            _time.sleep = orig
        assert out == "ok"
        assert calls["n"] == 2, "GLM 429 应退避重试一次"


class TestUserFacingMessage:
    def test_upstream_error_sanitized(self):
        msg = user_facing_llm_error(_minimax_sse_error())
        assert "unknown error" not in msg
        assert "715" not in msg and "1000" not in msg
        assert "重试" in msg

    def test_non_upstream_error_kept(self):
        body = {"error": {"type": "authentication_error", "message": "invalid api key"}}
        e = _FakeAPIStatusError("401 invalid api key", body=body, status_code=401)
        assert user_facing_llm_error(e) == "401 invalid api key"


class TestStreamingAgentSanitization:
    def test_emit_error_uses_friendly_text(self):
        """主代理收场时 emit_error 的文案必须是脱敏后的可读句。"""
        agent = StreamingAgent.__new__(StreamingAgent)
        agent.logger = logging.getLogger("planify.streaming.runner")

        msg = StreamingAgent._user_facing_error(_minimax_sse_error())
        assert "unknown error" not in msg
        assert "715" not in msg and "1000" not in msg
        assert "重试" in msg


class TestSubagentRetryPolicy:
    """子代理路径共用同一判定口径（2026-11-18）。

    事故形态（debug_20261118.log 12:39）：bigmodel 429 被子代理路径记为
    ``retryable=False``，4 次派发全部瞬间失败——因为旧代码只看
    ``getattr(e, "retryable", False)``，认不出 SDK 原生 RateLimitError。
    """

    def test_sdk_rate_limit_now_retryable_in_subagent(self):
        from planify.subagent.runner import _chat_with_retry

        class _RateLimitError(Exception):
            pass

        _RateLimitError.__name__ = "RateLimitError"

        calls = {"n": 0}

        class _Client:
            def chat(self, **kw):
                calls["n"] += 1
                if calls["n"] < 2:
                    raise _RateLimitError("429")
                return "ok"

        import time as _time

        orig_sleep = _time.sleep
        _time.sleep = lambda s: None
        try:
            out = _chat_with_retry(
                _Client(), [], "sys", [], 100, None,
                agent_type="general-purpose", round_no=1,
            )
        finally:
            _time.sleep = orig_sleep
        assert out == "ok"
        assert calls["n"] == 2, "429 应退避重试一次"

    def test_upstream_sse_error_retryable_in_subagent(self):
        from planify.subagent.runner import _chat_with_retry

        calls = {"n": 0}

        class _Client:
            def chat(self, **kw):
                calls["n"] += 1
                if calls["n"] < 2:
                    raise _minimax_sse_error()
                return "ok"

        import time as _time

        orig_sleep = _time.sleep
        _time.sleep = lambda s: None
        try:
            out = _chat_with_retry(
                _Client(), [], "sys", [], 100, None,
                agent_type="general-purpose", round_no=1,
            )
        finally:
            _time.sleep = orig_sleep
        assert out == "ok"
        assert calls["n"] == 2, "上游 SSE 错误应退避重试一次"


class TestProviderDetection:
    """provider 识别（按 base_url / model）。"""

    def test_minimax_by_url(self):
        assert detect_provider("https://api.minimaxi.com/anthropic") == PROVIDER_MINIMAX
        assert detect_provider("https://api.minimax.chat/anthropic") == PROVIDER_MINIMAX

    def test_minimax_by_model(self):
        assert detect_provider(None, "MiniMax-M3.1-Flash") == PROVIDER_MINIMAX

    def test_glm_by_url_and_model(self):
        assert detect_provider("https://open.bigmodel.cn/api/anthropic") == PROVIDER_GLM
        assert detect_provider(None, "glm-4.6") == PROVIDER_GLM

    def test_deepseek(self):
        assert detect_provider("https://api.deepseek.com/v1") == PROVIDER_DEEPSEEK
        assert detect_provider(None, "deepseek-chat") == PROVIDER_DEEPSEEK

    def test_kimi(self):
        assert detect_provider("https://api.moonshot.cn/v1") == PROVIDER_KIMI
        assert detect_provider(None, "kimi-k2") == PROVIDER_KIMI

    def test_unknown_is_generic(self):
        assert detect_provider("https://api.example.com/v1", "some-model") == PROVIDER_GENERIC
        assert detect_provider(None, None) == PROVIDER_GENERIC


class TestProviderMarking:
    """provider 标记注入与读取（provider_context）。"""

    def test_mark_and_read(self):
        from planify.core.llm.provider_context import mark_provider_error, provider_of

        e = ValueError("x")
        assert provider_of(e) is None
        mark_provider_error(e, PROVIDER_GLM)
        assert provider_of(e) == PROVIDER_GLM

    def test_mark_is_idempotent_first_wins(self):
        """内层已标的 provider 不被外层覆盖。"""
        from planify.core.llm.provider_context import mark_provider_error, provider_of

        e = ValueError("x")
        mark_provider_error(e, PROVIDER_GLM)
        mark_provider_error(e, PROVIDER_MINIMAX)
        assert provider_of(e) == PROVIDER_GLM

    def test_generic_not_marked(self):
        from planify.core.llm.provider_context import mark_provider_error, provider_of

        e = ValueError("x")
        mark_provider_error(e, PROVIDER_GENERIC)
        assert provider_of(e) is None

    def test_provider_detected_from_real_provider(self):
        """真实 provider 实例能算出自己的 provider（注入链路端到端）。"""
        from planify.core.llm.anthropic_provider import AnthropicProvider

        p = AnthropicProvider(
            api_key="k", base_url="https://open.bigmodel.cn/api/anthropic",
            model="glm-4.6",
        )
        assert p._provider() == PROVIDER_GLM


class TestMainAgentRetriesUpstreamError:
    """主代理遇上游 SSE error → 退避重试（事故形态复现）。"""

    def _provider(self, script):
        from types import SimpleNamespace

        class _ScriptedProvider:
            def __init__(self):
                self.script = script
                self.calls = 0

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
                yield self._ev(type="content_block_delta", block_index=0,
                               text_delta=step.get("text", ""))
                yield self._ev(type="message_delta", stop_reason="end_turn")
                yield self._ev(type="message_stop")

        return _ScriptedProvider()

    def _agent(self, provider):
        from types import SimpleNamespace

        from planify.streaming.types import StreamingConfig

        class _Emitter:
            def __init__(self):
                self.texts = []
                self.errors = []

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
                pass

        tmp = SimpleNamespace(
            config=SimpleNamespace(workdir=".", assets_dir=None),
            skill_access_state=None,
        )
        emitter = _Emitter()
        agent = StreamingAgent(
            client=provider,
            model="mock",
            tools=[],
            tool_handlers={},
            emitter=emitter,
            config=StreamingConfig(compact_threshold=10**9),
            skills_loader=None,
            runtime=tmp,
        )
        return agent, emitter

    def test_upstream_error_retried_then_success(self, monkeypatch):
        async def _instant_sleep(s):
            return None

        monkeypatch.setattr(asyncio, "sleep", _instant_sleep)
        provider = self._provider(
            [{"fail": _minimax_sse_error()}, {"text": "成功了"}]
        )
        agent, emitter = self._agent(provider)
        asyncio.run(agent.run_stream([], "问题", "sid"))
        assert provider.calls == 2, "上游瞬时故障应退避重试一次"
        assert "".join(emitter.texts).startswith("成功了")
        assert not emitter.errors

    def test_exhausted_upstream_retries_fail_with_friendly_text(self, monkeypatch):
        async def _instant_sleep(s):
            return None

        monkeypatch.setattr(asyncio, "sleep", _instant_sleep)
        provider = self._provider([{"fail": _minimax_sse_error()}])
        agent, emitter = self._agent(provider)
        asyncio.run(agent.run_stream([], "问题", "sid"))
        assert provider.calls == 4, "默认 4 次尝试全耗尽"
        assert emitter.errors
        assert "unknown error" not in emitter.errors[0]
        assert "715" not in emitter.errors[0] and "1000" not in emitter.errors[0]
