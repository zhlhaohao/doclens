"""流式路径 usage 观测测试（P0-2）。

覆盖三层：
1. Anthropic provider：message_start/message_delta 的 usage 透传到归一化事件；
2. OpenAI 兼容 provider：include_usage 尾 chunk（choices 为空）翻译成
   message_delta(usage=...)，DeepSeek 系缓存字段归一；
3. StreamingAgent runner：累积 usage 并输出前缀命中率日志。
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
        "input_tokens": 5000,
        "output_tokens": 200,
        "cache_read_input_tokens": 4800,
        "cache_creation_input_tokens": 200,
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

    async def astream(self, *, messages, system, tools, max_tokens):
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
