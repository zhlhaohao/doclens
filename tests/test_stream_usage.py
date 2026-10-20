"""流式路径 usage 观测测试（P0-2）。

覆盖三层：
1. Anthropic provider：message_start/message_delta 的 usage 透传到归一化事件；
2. OpenAI 兼容 provider：include_usage 尾 chunk（choices 为空）翻译成
   message_delta(usage=...)，DeepSeek 系 / MiniMax 系缓存字段归一；
3. StreamingAgent runner：累积 usage 并输出前缀命中率日志。

**归一化契约**（跨 provider 一致）：``input_tokens`` = 未命中缓存的新增输入，
``cache_read_input_tokens`` = 命中数，``cache_creation_input_tokens`` = 写缓存数；
不变式 ``input + cache_read + cache_creation == 端点上报的总输入``。
"""

import asyncio
import logging
from types import SimpleNamespace

from planify.core.llm.anthropic_provider import AnthropicProvider
from planify.core.llm.openai_compat_provider import (
    _StreamTranslator,
    _usage_from_openai,
)
from planify.streaming.runner import StreamingAgent
from planify.streaming.types import StreamingConfig


def _ns(**kw):
    return SimpleNamespace(**kw)


# ------------------------------------------------------- Anthropic 透传


def test_anthropic_message_start_carries_usage():
    event = _ns(
        type="message_start",
        message=_ns(
            usage=_ns(
                input_tokens=12,
                output_tokens=1,
                cache_creation_input_tokens=3150,
                cache_read_input_tokens=48210,
            )
        ),
    )
    out = AnthropicProvider._event_from_anthropic(event)
    assert out is not None and out.type == "message_start"
    assert out.usage == {
        "input_tokens": 12,
        "output_tokens": 1,
        "cache_creation_input_tokens": 3150,
        "cache_read_input_tokens": 48210,
    }


def test_anthropic_message_delta_carries_output_tokens():
    event = _ns(
        type="message_delta",
        delta=_ns(stop_reason="end_turn"),
        usage=_ns(output_tokens=406),
    )
    out = AnthropicProvider._event_from_anthropic(event)
    assert out is not None and out.stop_reason == "end_turn"
    assert out.usage is not None
    assert out.usage["output_tokens"] == 406
    assert out.usage["cache_read_input_tokens"] == 0


# ---------------------------------------------------- OpenAI 兼容端翻译


def test_openai_usage_only_chunk_becomes_message_delta():
    """DeepSeek 系（prompt_cache_hit_tokens）→ 归一到 Anthropic 契约。

    prompt_tokens 是「命中 + 未命中」总数（5000 = 4800 命中 + 200 新增），
    故 input_tokens 必须是 **新增** 200 而非 5000——否则上层
    「总输入 = input + cache_read + cache_creation」会把命中部分重复计一次。
    """
    translator = _StreamTranslator()
    translator.start()
    chunk = _ns(
        choices=[],
        usage=_ns(
            prompt_tokens=5000,
            completion_tokens=200,
            prompt_cache_hit_tokens=4800,
            prompt_cache_miss_tokens=200,
        ),
    )
    events = translator.feed(chunk)
    assert len(events) == 1
    assert events[0].type == "message_delta"
    assert events[0].usage == {
        "input_tokens": 200,
        "output_tokens": 200,
        "cache_read_input_tokens": 4800,
        "cache_creation_input_tokens": 0,
    }


def test_openai_minimax_cached_tokens_details_normalized():
    """MiniMax / OpenAI 官方口径：命中数在 prompt_tokens_details.cached_tokens。

    回归 2026-10-20 事故：MiniMax 端点只报 cached_tokens，不报
    prompt_cache_hit_tokens——旧实现读不到该字段，命中率恒显示 0%。
    """
    translator = _StreamTranslator()
    translator.start()
    chunk = _ns(
        choices=[],
        usage=_ns(
            prompt_tokens=20489,
            completion_tokens=64,
            prompt_tokens_details=_ns(cached_tokens=12438),
        ),
    )
    events = translator.feed(chunk)
    assert len(events) == 1
    assert events[0].usage == {
        "input_tokens": 20489 - 12438,  # 新增 = 总数 - 命中
        "output_tokens": 64,
        "cache_read_input_tokens": 12438,
        "cache_creation_input_tokens": 0,
    }
    # 不变式：归一后总输入 == 端点上报的 prompt_tokens（不重复计数）
    u = events[0].usage
    assert (
        u["input_tokens"] + u["cache_read_input_tokens"] + u["cache_creation_input_tokens"]
        == 20489
    )


def test_openai_explicit_anthropic_style_cache_fields_pass_through():
    """代理直传 Anthropic 风格缓存字段时原样透传。"""
    out = _usage_from_openai(
        _ns(
            prompt_tokens=1000,
            completion_tokens=10,
            cache_read_input_tokens=700,
            cache_creation_input_tokens=0,
        )
    )
    assert out == {
        "input_tokens": 300,
        "output_tokens": 10,
        "cache_read_input_tokens": 700,
        "cache_creation_input_tokens": 0,
    }


def test_openai_no_cache_endpoint_reports_full_input():
    """无缓存概念的端点：prompt_tokens 全是新增，缓存字段为 0。"""
    out = _usage_from_openai(_ns(prompt_tokens=500, completion_tokens=20))
    assert out == {
        "input_tokens": 500,
        "output_tokens": 20,
        "cache_read_input_tokens": 0,
        "cache_creation_input_tokens": 0,
    }


def test_openai_finish_chunk_merges_usage_and_stop_reason():
    translator = _StreamTranslator()
    translator.start()
    text_chunk = _ns(
        choices=[_ns(delta=_ns(content="hi", tool_calls=None), finish_reason=None)],
        usage=None,
    )
    translator.feed(text_chunk)
    finish_chunk = _ns(
        choices=[_ns(delta=_ns(content=None, tool_calls=None), finish_reason="stop")],
        usage=_ns(prompt_tokens=100, completion_tokens=5),
    )
    events = translator.feed(finish_chunk)
    deltas = [e for e in events if e.type == "message_delta"]
    assert len(deltas) == 1
    assert deltas[0].stop_reason == "end_turn"
    assert deltas[0].usage is not None
    assert deltas[0].usage["input_tokens"] == 100
    # 无缓存概念的端点缓存字段为 0
    assert deltas[0].usage["cache_read_input_tokens"] == 0


def test_usage_from_openai_none_passthrough():
    assert _usage_from_openai(None) is None


# --------------------------------------------------------- runner 日志


class _UsageProvider:
    """产出带 usage 的事件流：message_start 全量 + message_delta output。"""

    def __init__(self):
        self._called = False

    async def astream(self, *, messages, system, tools, max_tokens, tracer=None):
        yield _ns(
            type="message_start", usage={
                "input_tokens": 100,
                "output_tokens": 1,
                "cache_creation_input_tokens": 500,
                "cache_read_input_tokens": 9400,
            },
            block_index=None, block_type=None, tool_use_id=None, tool_name=None,
            text_delta=None, input_json_delta=None, stop_reason=None,
        )
        yield _ns(
            type="content_block_start", block_index=0, block_type="text",
            usage=None, tool_use_id=None, tool_name=None,
            text_delta=None, input_json_delta=None, stop_reason=None,
        )
        yield _ns(
            type="content_block_delta", block_index=0, text_delta="回答",
            usage=None, block_type=None, tool_use_id=None, tool_name=None,
            input_json_delta=None, stop_reason=None,
        )
        yield _ns(
            type="content_block_stop", block_index=0, usage=None,
            block_type=None, tool_use_id=None, tool_name=None,
            text_delta=None, input_json_delta=None, stop_reason=None,
        )
        yield _ns(
            type="message_delta", stop_reason="end_turn",
            usage={"input_tokens": 0, "output_tokens": 42,
                   "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0},
            block_index=None, block_type=None, tool_use_id=None, tool_name=None,
            text_delta=None, input_json_delta=None,
        )
        yield _ns(
            type="message_stop", usage=None,
            block_index=None, block_type=None, tool_use_id=None, tool_name=None,
            text_delta=None, input_json_delta=None, stop_reason=None,
        )


class _NullEmitter:
    async def emit_text(self, content, is_end=False):
        pass

    async def emit_tool_call(self, tool_use_id, name, input_data, is_complete=False):
        pass

    async def emit_tool_result(self, tool_use_id, name, output, is_error=False):
        pass

    async def emit_done(self, session_id, summary=None):
        pass

    async def emit_error(self, error, code=None):
        raise AssertionError(error)

    async def emit_usage(self, usage):
        pass


def test_runner_logs_cache_hit_ratio(tmp_path, caplog):
    sa = StreamingAgent(
        client=_UsageProvider(),
        model="mock",
        tools=[],
        tool_handlers={},
        emitter=_NullEmitter(),
        config=StreamingConfig(compact_threshold=10**9),
        skills_loader=None,
        runtime=SimpleNamespace(
            config=SimpleNamespace(workdir=tmp_path, assets_dir=tmp_path / "none"),
            skill_access_state=None,
        ),
    )
    with caplog.at_level(logging.INFO, logger="planify.streaming.runner"):
        asyncio.run(sa.run_stream([], "问题", "sid"))

    usage_logs = [r.getMessage() for r in caplog.records if "usage:" in r.getMessage()]
    assert len(usage_logs) == 1, f"应有一条 usage 日志，实际: {usage_logs}"
    msg = usage_logs[0]
    # message_start 的缓存字段不被 message_delta 的 0 值覆盖；output 取 42
    assert "input=100" in msg
    assert "cache_read=9400" in msg
    assert "cache_creation=500" in msg
    assert "output=42" in msg
    # 命中率 = 9400 / (100 + 9400 + 500) = 94%
    assert "前缀命中率 94%" in msg


def test_runner_reports_nonzero_hit_rate_for_minimax_shaped_usage(tmp_path, caplog):
    """端到端回归（2026-10-20 事故）：MiniMax 口径 usage 经 provider →
    runner 后，命中率必须非 0。

    事故形态：MiniMax 只报 ``prompt_tokens_details.cached_tokens``，旧实现
    只认 ``prompt_cache_hit_tokens`` → cache_read 恒 0 → 命中率恒 0%，
    而服务端其实在正常命中（实测 60–86%）。
    """
    from planify.core.llm.openai_compat_provider import OpenAICompatProvider

    class _AsyncCompletions:
        async def create(self, **kw):
            usage = _ns(
                prompt_tokens=20489,
                completion_tokens=64,
                prompt_tokens_details=_ns(cached_tokens=12438),
            )

            async def _gen():
                yield _ns(
                    id="c1", model="m", usage=None,
                    choices=[_ns(delta=_ns(content="答", tool_calls=None),
                                 finish_reason="stop")],
                )
                yield _ns(id="c1", model="m", usage=usage, choices=[])

            return _gen()

    provider = OpenAICompatProvider(api_key="k", base_url="http://x", model="m")
    provider._aclient = _ns(chat=_ns(completions=_AsyncCompletions()))

    sa = StreamingAgent(
        client=provider,
        model="m",
        tools=[],
        tool_handlers={},
        emitter=_NullEmitter(),
        config=StreamingConfig(compact_threshold=10**9),
        skills_loader=None,
        runtime=SimpleNamespace(
            config=SimpleNamespace(workdir=tmp_path, assets_dir=tmp_path / "none"),
            skill_access_state=None,
        ),
    )
    with caplog.at_level(logging.INFO, logger="planify.streaming.runner"):
        asyncio.run(sa.run_stream([{"role": "user", "content": "问题"}], "问题", "sid"))

    usage_logs = [r.getMessage() for r in caplog.records if "usage:" in r.getMessage()]
    assert len(usage_logs) == 1, f"应有一条 usage 日志，实际: {usage_logs}"
    msg = usage_logs[0]
    assert "cache_read=12438" in msg
    # 命中率 = 12438 / 20489 = 60%
    assert "前缀命中率 60%" in msg
