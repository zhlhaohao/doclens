# -*- coding: utf-8 -*-
"""AnthropicProvider.astream 的确定性收尾测试。

背景（2026-11-06 日志审计）：unraisable 每天 ~40 次，
全是 ``Response.aiter_raw`` / ``BoundAsyncStream.__aiter__`` +
``ValueError: async generator already executing``，且总出现在「上一轮流结束、
下一轮请求开始」的间隙。根因是 SDK 的 ``AsyncMessageStream._iterator``
（``__stream__`` async generator）只被 ``stream.close()`` 关掉了它持有的
httpx Response，迭代器本身留给 GC 终结器；GC 若在另一协程仍驱动该链时动手，
解释器就抛该 ValueError。

修复两条：
1. 退出时先 ``await _iterator.aclose()``，让 httpx ``aiter_raw`` 的 finally
   在事件循环内正常走完 ``await stream.aclose()``；
2. ``message_stop`` 记 trace 改读快照，不再 ``get_final_message()``
   （后者 ``until_done()`` 会重入同一个迭代器）。
"""
import asyncio
from types import SimpleNamespace

import pytest

from planify.core.llm.anthropic_provider import AnthropicProvider


class _FakeIterator:
    """模拟 SDK 的 ``__stream__`` async generator。"""

    def __init__(self, events):
        self._events = list(events)
        self.closed = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._events:
            raise StopAsyncIteration
        return self._events.pop(0)

    async def aclose(self):
        self.closed += 1


class _FakeStream:
    """模拟 anthropic ``AsyncMessageStream``（含私有 ``_iterator``）。"""

    def __init__(self, events, snapshot=None):
        self._iterator = _FakeIterator(events)
        self._snapshot = snapshot
        self.get_final_calls = 0
        self.close_calls = 0

    def __aiter__(self):
        return self._iterator

    @property
    def current_message_snapshot(self):
        if self._snapshot is None:
            raise AssertionError("snapshot not ready")
        return self._snapshot

    async def get_final_message(self):
        self.get_final_calls += 1
        async for _ in self:
            pass
        return self._snapshot

    def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        self.close_calls += 1
        return False


class _FakeStreamCM:
    def __init__(self, stream):
        self._stream = stream

    async def __aenter__(self):
        return self._stream

    async def __aexit__(self, *exc):
        return await self._stream.__aexit__(*exc)


class _FakeClient:
    def __init__(self, stream):
        self._stream = stream
        self.messages = SimpleNamespace(stream=lambda **kw: _FakeStreamCM(self._stream))


def _provider_with(stream):
    prov = AnthropicProvider(api_key="k", base_url="http://t.local", model="m")
    prov._ensure_async_client = lambda: _FakeClient(stream)  # type: ignore[method-assign]
    return prov


def _events():
    """message_start / delta / message_stop（provider 归一化只看 type 等字段）。"""
    return [
        SimpleNamespace(
            type="message_start", block_index=None, block_type=None,
            text_delta=None, thinking_delta=None, input_json_delta=None,
            tool_use_id=None, tool_name=None, stop_reason=None, usage=None,
        ),
        SimpleNamespace(
            type="content_block_delta", block_index=0, block_type=None,
            text_delta="hi", thinking_delta=None, input_json_delta=None,
            tool_use_id=None, tool_name=None, stop_reason=None, usage=None,
        ),
        SimpleNamespace(
            type="message_stop", block_index=None, block_type=None,
            text_delta=None, thinking_delta=None, input_json_delta=None,
            tool_use_id=None, tool_name=None, stop_reason="end_turn", usage=None,
        ),
    ]


def _consume(prov):
    """模拟 runner：message_stop 时 break。"""

    async def run():
        got = []
        async for ev in prov.astream(
            messages=[{"role": "user", "content": "hi"}], system="s", tools=[]
        ):
            got.append(ev)
            if getattr(ev, "type", None) == "message_stop":
                break
        return got

    return asyncio.run(run())


def test_iterator_closed_on_break():
    """runner 在 message_stop break 后，SDK 迭代器必须被显式关闭。"""
    stream = _FakeStream(_events(), snapshot={"ok": True})
    _consume(_provider_with(stream))
    assert stream._iterator.closed == 1, "未显式 aclose → 只能等 GC 终结器"
    assert stream.close_calls == 1


def test_iterator_closed_without_tracer():
    """无 tracer 路径同样要关（tracer 不是收尾条件）。"""
    stream = _FakeStream(_events(), snapshot=None)
    _consume(_provider_with(stream))
    assert stream._iterator.closed == 1


def test_no_iterator_double_close_on_full_consumption():
    """流自然读完也不重复关闭（aclose 幂等，只调用一次）。"""
    stream = _FakeStream(_events(), snapshot={"ok": True})

    async def run():
        async for _ in _provider_with(stream).astream(
            messages=[{"role": "user", "content": "hi"}], system="s", tools=[]
        ):
            pass

    asyncio.run(run())
    assert stream._iterator.closed == 1


class _RecordingTracer:
    def __init__(self):
        self.responses = []
        self.errors = []

    def trace_request(self, kwargs):
        return 1

    def trace_response(self, turn, native):
        self.responses.append(native)

    def trace_error(self, turn, err):
        self.errors.append(err)


def test_trace_uses_snapshot_without_reentering_iterator():
    """message_stop 记 trace 不得重入迭代器（get_final_message 会重入）。"""
    snapshot = {"usage": {"output_tokens": 5}}
    stream = _FakeStream(_events(), snapshot=snapshot)
    tracer = _RecordingTracer()

    async def run():
        async for ev in _provider_with(stream).astream(
            messages=[{"role": "user", "content": "hi"}], system="s", tools=[],
            tracer=tracer,
        ):
            if getattr(ev, "type", None) == "message_stop":
                break

    asyncio.run(run())
    assert stream.get_final_calls == 0, "不应重入 until_done"
    assert tracer.responses == [snapshot]
    assert tracer.errors == []


def test_trace_falls_back_when_snapshot_missing():
    """快照不可用时退回 get_final_message（保持 trace 不丢数据）。"""
    stream = _FakeStream(_events(), snapshot=None)
    tracer = _RecordingTracer()

    async def run():
        async for ev in _provider_with(stream).astream(
            messages=[{"role": "user", "content": "hi"}], system="s", tools=[],
            tracer=tracer,
        ):
            if getattr(ev, "type", None) == "message_stop":
                break

    asyncio.run(run())
    assert stream.get_final_calls == 1
    assert len(tracer.responses) == 1


class TestCloseHelper:
    """共享收尾工具（planify.core.llm.stream_close）的边界行为。"""

    def test_no_iterator_is_noop(self):
        from planify.core.llm.stream_close import close_sdk_stream_iterator

        asyncio.run(close_sdk_stream_iterator(object()))  # 不抛

    def test_idempotent(self):
        from planify.core.llm.stream_close import close_sdk_stream_iterator

        it = _FakeIterator([])
        asyncio.run(close_sdk_stream_iterator(SimpleNamespace(_iterator=it)))
        asyncio.run(close_sdk_stream_iterator(SimpleNamespace(_iterator=it)))
        assert it.closed == 2  # aclose 幂等，不会抛

    def test_already_executing_swallowed(self):
        """迭代器正在执行（aclose 抛 ValueError）时不得向上冒泡。"""
        from planify.core.llm.stream_close import close_sdk_stream_iterator

        class _Busy:
            async def aclose(self):
                raise ValueError("async generator already executing")

        asyncio.run(close_sdk_stream_iterator(SimpleNamespace(_iterator=_Busy())))
