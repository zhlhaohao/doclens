"""LLM 追踪（LLM Trace）落盘测试。

覆盖：开关门控、md 骨架（问/答节/触发源摘要）、轮次自增与跨 tracer 续接、
图像 base64 占位（Anthropic / OpenAI 两形态）、fence 转义、异常节、
并发追加完整性、目录覆盖。
"""

import threading
from types import SimpleNamespace

from planify.core.llm.trace import (
    _fenced_json,
    _redact_images,
    _trigger_summary,
    LLMTracer,
)

_ON = {"PLANIFY_LLM_TRACE": "1"}


def _ns(**kw):
    return SimpleNamespace(**kw)


def _make(tmp_path, session_key=None, label="main", env=None, **kw):
    return LLMTracer.create(
        label=label,
        session_key=session_key,
        workdir=tmp_path,
        env={**_ON, **(env or {})},
        **kw,
    )


# ------------------------------------------------------------- 开关门控


def test_create_disabled_by_default(tmp_path):
    assert LLMTracer.create(label="main", workdir=tmp_path, env={}) is None
    for off in ("0", "false", "off", "", "yes-but-not-quite"):
        assert (
            LLMTracer.create(label="main", workdir=tmp_path, env={"PLANIFY_LLM_TRACE": off})
            is None
        )


def test_create_enabled_writes_under_planify(tmp_path):
    tracer = _make(tmp_path)
    assert tracer is not None
    assert tracer.trace_dir == tmp_path / ".planify" / "llm_trace"
    assert tracer.trace_dir.is_dir()


def test_create_dir_override(tmp_path):
    override = tmp_path / "elsewhere"
    tracer = _make(tmp_path, env={"PLANIFY_LLM_TRACE_DIR": str(override)})
    assert tracer is not None
    assert tracer.trace_dir == override


# ------------------------------------------------------------- md 骨架


def test_request_response_sections(tmp_path):
    tracer = _make(tmp_path, session_key="s-123")
    kwargs = {
        "model": "claude-opus-4-6",
        "max_tokens": 8000,
        "system": [{"type": "text", "text": "sys", "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": "什么是 doclens？"}],
        "tools": [{"name": "bash"}, {"name": "read_file"}],
    }
    turn = tracer.trace_request(kwargs)
    assert turn == 1
    tracer.trace_response(
        turn,
        {
            "id": "msg_1",
            "usage": {
                "input_tokens": 12,
                "cache_read_input_tokens": 48210,
                "cache_creation_input_tokens": 3150,
                "output_tokens": 406,
            },
        },
    )
    text = tracer._path.read_text(encoding="utf-8")
    assert "# LLM Trace" in text
    assert "## 轮 1 · 问" in text
    assert "## 轮 1 · 答" in text
    assert "模型: claude-opus-4-6 · max_tokens: 8000 · 工具: 2 个" in text
    assert "触发源[main]: (user) 什么是 doclens？" in text
    # 实发请求体原样（含 cache_control 断点）
    assert '"cache_control"' in text
    assert '"ephemeral"' in text
    # 实收响应 usage 原样
    assert '"cache_read_input_tokens": 48210' in text
    assert "耗时" in text
    # 文件名 = 日期-会话键
    assert tracer._path.name.endswith("-s-123.md")


def test_turn_increments_and_resumes_across_tracers(tmp_path):
    t1 = _make(tmp_path, session_key="s-abc")
    t1.trace_request({"model": "m", "messages": [{"role": "user", "content": "q1"}]})
    t1.trace_request({"model": "m", "messages": [{"role": "user", "content": "q2"}]})
    # 新 tracer（模拟下一次用户输入/新进程）同会话键：文件复用 + 轮次续接
    t2 = _make(tmp_path, session_key="s-abc")
    assert t2 is not None and t2._path == t1._path
    assert t2.trace_request({"model": "m", "messages": []}) == 3
    text = t2._path.read_text(encoding="utf-8")
    assert "## 轮 3 · 问" in text


def test_no_session_key_timestamp_named(tmp_path):
    t1 = _make(tmp_path, label="cli")
    t2 = _make(tmp_path, label="cli")
    # 时间戳命名（到秒）：同一秒内创建会撞同名（追加同文件，可接受），
    # 但不应抛错且轮次续接语义不破坏
    assert t1._path.name.endswith("-cli.md")
    assert t2 is not None


def test_trace_error_section(tmp_path):
    tracer = _make(tmp_path, session_key="s-err")
    turn = tracer.trace_request({"model": "m", "messages": []})
    tracer.trace_error(turn, ValueError("boom"))
    text = tracer._path.read_text(encoding="utf-8")
    assert "## 轮 1 · 答" in text
    assert "异常/中断" in text
    assert '"type": "ValueError"' in text
    assert "boom" in text


# ------------------------------------------------------------- 脱敏 / 转义


def test_redact_images_anthropic_and_openai():
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": "A" * 1000,
                        },
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": "data:image/jpeg;base64," + "B" * 500},
                    },
                    {"type": "text", "text": "看这张图"},
                ],
            }
        ]
    }
    out = _redact_images(payload)
    blocks = out["messages"][0]["content"]
    assert blocks[0]["source"]["data"] == "[base64 略，1000 字符]"
    assert blocks[0]["source"]["media_type"] == "image/png"
    assert blocks[1]["image_url"]["url"] == "data:image/jpeg;base64,[略，500 字符]"
    # 文本不动 + 入参不被修改（不可变纪律）
    assert blocks[2]["text"] == "看这张图"
    assert payload["messages"][0]["content"][0]["source"]["data"] == "A" * 1000


def test_fence_escapes_backticks_in_payload():
    block = _fenced_json({"content": "```python\nprint('hi')\n```"})
    # 内容含 ``` 时 fence 加长，JSON 块不被裂开
    assert block.startswith("````json")
    assert block.rstrip().endswith("````")
    plain = _fenced_json({"content": "普通"})
    assert plain.startswith("```json")


def test_trigger_summary_variants():
    # 用户纯文本 → 截断摘要
    s = _trigger_summary([{"role": "user", "content": "你好" * 100}])
    assert s.startswith("(user) ") and s.endswith("…") and len(s) < 120
    # Anthropic 工具结果混合
    s = _trigger_summary(
        [
            {"role": "assistant", "content": []},
            {
                "role": "user",
                "content": [
                    {"type": "tool_result", "tool_use_id": "t1", "content": "ok"},
                    {"type": "tool_result", "tool_use_id": "t2", "content": "fine"},
                    {"type": "text", "text": "继续"},
                ],
            },
        ]
    )
    assert "[工具结果×2]" in s and "继续" in s
    # OpenAI 风格 role=tool
    s = _trigger_summary([{"role": "tool", "content": "result text"}])
    assert s.startswith("(tool) ")
    # 空输入
    assert _trigger_summary(None) == "(无消息)"


# ------------------------------------------------------------- 并发追加


def test_concurrent_appends_keep_sections_intact(tmp_path):
    tracers = [_make(tmp_path, session_key="s-cc") for _ in range(4)]
    threads = []
    for i, tr in enumerate(tracers):
        def worker(t=tr, idx=i):
            for _ in range(10):
                turn = t.trace_request({"model": "m", "messages": []})
                t.trace_response(turn, {"idx": idx})

        th = threading.Thread(target=worker)
        threads.append(th)
        th.start()
    for th in threads:
        th.join()
    text = tracers[0]._path.read_text(encoding="utf-8")
    # 40 问 + 40 答，标题行全部完整（无交错撕裂的半行）
    assert text.count("· 问 ·") == 40
    assert text.count("· 答 ·") == 40
    for line in text.splitlines():
        if line.startswith("## 轮"):
            assert line.endswith("）") or "· 问 ·" in line


# ------------------------------------------------------------- jsonable


def test_jsonable_handles_pydantic_like_objects():
    class FakeModel:
        def model_dump(self):
            return {"id": "x", "n": 1}

    from planify.core.llm.trace import _jsonable

    out = _jsonable({"resp": FakeModel(), "pair": (1, 2)})
    assert out["resp"] == {"id": "x", "n": 1}
    assert out["pair"] == [1, 2]


# ------------------------------------------------- provider 接线（mock SDK）


def test_openai_astream_traces_request_and_aggregated_response(tmp_path):
    """OpenAI-compat 流式路径：kwargs 进问节、聚合原生响应进答节。"""
    import asyncio
    from types import SimpleNamespace

    from planify.core.llm.openai_compat_provider import OpenAICompatProvider

    usage = _ns(prompt_tokens=100, completion_tokens=2,
                prompt_cache_hit_tokens=80, prompt_cache_miss_tokens=20)
    usage.model_dump = lambda: {
        "prompt_tokens": 100, "completion_tokens": 2,
        "prompt_cache_hit_tokens": 80, "prompt_cache_miss_tokens": 20,
    }
    chunks = [
        _ns(id="cmpl-1", model="qwen-max", usage=None,
            choices=[_ns(delta=_ns(content="你", tool_calls=None), finish_reason=None)]),
        _ns(id="cmpl-1", model="qwen-max", usage=None,
            choices=[_ns(delta=_ns(content="好", tool_calls=None), finish_reason="stop")]),
        _ns(id="cmpl-1", model="qwen-max", usage=usage, choices=[]),
    ]

    class _AsyncIter:
        def __init__(self, items):
            self._items = items

        def __aiter__(self):
            return self

        async def __anext__(self):
            if not self._items:
                raise StopAsyncIteration
            return self._items.pop(0)

    class _AsyncCompletions:
        async def create(self, **kw):
            return _AsyncIter(list(chunks))

    provider = OpenAICompatProvider(api_key="k", base_url="http://x", model="qwen-max")
    provider._aclient = _ns(chat=_ns(completions=_AsyncCompletions()))
    tracer = _make(tmp_path, session_key="s-openai")

    async def run():
        out = []
        async for ev in provider.astream(
            messages=[{"role": "user", "content": "hi"}],
            system="sys",
            tools=[],
            max_tokens=64,
            tracer=tracer,
        ):
            out.append(ev.type)
        return out

    asyncio.run(run())
    text = tracer._path.read_text(encoding="utf-8")
    assert "## 轮 1 · 问" in text
    assert "## 轮 1 · 答" in text
    # 问节 = OpenAI 风格实发 kwargs（system 并入 messages）
    assert '"role": "system"' in text
    assert '"stream_options"' in text
    # 答节 = 聚合还原的原生形态 + 尾 chunk usage
    assert '"stream_aggregated": true' in text
    assert '"content": "你好"' in text
    assert '"prompt_tokens": 100' in text


def test_openai_astream_break_at_message_stop_still_traces(tmp_path):
    """runner 在 message_stop 即 break（真实消费行为）：答节已落且不误记异常节。"""
    import asyncio

    from planify.core.llm.openai_compat_provider import OpenAICompatProvider

    usage = _ns(prompt_tokens=50, completion_tokens=1)
    usage.model_dump = lambda: {"prompt_tokens": 50, "completion_tokens": 1}
    chunks = [
        _ns(id="cmpl-2", model="qwen", usage=None,
            choices=[_ns(delta=_ns(content="ok", tool_calls=None), finish_reason="stop")]),
        _ns(id="cmpl-2", model="qwen", usage=usage, choices=[]),
    ]

    class _AsyncIter:
        def __init__(self, items):
            self._items = items

        def __aiter__(self):
            return self

        async def __anext__(self):
            if not self._items:
                raise StopAsyncIteration
            return self._items.pop(0)

    class _AsyncCompletions:
        async def create(self, **kw):
            return _AsyncIter(list(chunks))

    provider = OpenAICompatProvider(api_key="k", base_url="http://x", model="qwen")
    provider._aclient = _ns(chat=_ns(completions=_AsyncCompletions()))
    tracer = _make(tmp_path, session_key="s-break")

    async def run():
        agen = provider.astream(
            messages=[{"role": "user", "content": "q"}],
            system="",
            tools=[],
            max_tokens=16,
            tracer=tracer,
        )
        async for ev in agen:
            if ev.type == "message_stop":
                break  # runner 的真实行为
        await agen.aclose()

    asyncio.run(run())
    text = tracer._path.read_text(encoding="utf-8")
    assert "## 轮 1 · 问" in text
    assert "## 轮 1 · 答" in text
    assert "异常/中断" not in text


def test_anthropic_chat_traces_request_and_native_response(tmp_path):
    """Anthropic 非流式路径：cache_control 断点进问节、原生响应进答节。"""
    from types import SimpleNamespace

    from planify.core.llm.anthropic_provider import AnthropicProvider

    native = _ns(
        id="msg_9",
        model="claude-opus-4-6",
        stop_reason="end_turn",
        content=[_ns(type="text", text="答")],
        usage=_ns(input_tokens=10, output_tokens=3,
                  cache_creation_input_tokens=0, cache_read_input_tokens=90),
    )
    # pydantic 模型走 model_dump；SimpleNamespace 无此方法 → _jsonable 兜底 str()
    # 为让 usage 可断言，构造 model_dump 方法
    native.model_dump = lambda: {
        "id": "msg_9", "model": "claude-opus-4-6", "stop_reason": "end_turn",
        "usage": {"input_tokens": 10, "output_tokens": 3,
                  "cache_creation_input_tokens": 0, "cache_read_input_tokens": 90},
    }

    class _Completions:
        def create(self, **kw):
            return native

    provider = AnthropicProvider.__new__(AnthropicProvider)
    provider.model = "claude-opus-4-6"
    provider._client = _ns(messages=_ns(create=_Completions().create))
    tracer = _make(tmp_path, session_key="s-anthropic")

    resp = provider.chat(
        messages=[{"role": "user", "content": "q"}],
        system="sys",
        tools=[],
        max_tokens=64,
        tracer=tracer,
    )
    assert resp.stop_reason == "end_turn"
    text = tracer._path.read_text(encoding="utf-8")
    assert "## 轮 1 · 问" in text
    assert "## 轮 1 · 答" in text
    # 问节含缓存断点（实发请求体真相）
    assert '"cache_control"' in text
    # 答节原生响应 usage
    assert '"cache_read_input_tokens": 90' in text


# --------------------------------------------- StreamingAgent 全链路（tracer 开）


def test_streaming_agent_end_to_end_with_tracer(tmp_path):
    """runner → provider.astream → tracer 全链路：一次 run_stream 落一轮问/答。"""
    import asyncio

    from planify.streaming.runner import StreamingAgent
    from planify.streaming.types import StreamingConfig

    captured = {}

    class _Provider:
        async def astream(self, *, messages, system, tools, max_tokens, tracer=None):
            captured["tracer"] = tracer
            captured["messages"] = list(messages)
            # 模拟真实 provider 的 trace 钩子（实发 kwargs 进、原生响应出）
            turn = tracer.trace_request(
                {"model": "mock", "max_tokens": max_tokens, "system": system,
                 "messages": list(messages), "tools": []}
            ) if tracer else None
            yield _ns(type="message_start", usage=None)
            yield _ns(type="content_block_start", block_index=0, block_type="text",
                      usage=None, tool_use_id=None, tool_name=None,
                      text_delta=None, input_json_delta=None, stop_reason=None)
            yield _ns(type="content_block_delta", block_index=0, text_delta="回答",
                      usage=None, block_type=None, tool_use_id=None, tool_name=None,
                      input_json_delta=None, stop_reason=None)
            yield _ns(type="content_block_stop", block_index=0, usage=None,
                      block_type=None, tool_use_id=None, tool_name=None,
                      text_delta=None, input_json_delta=None, stop_reason=None)
            yield _ns(type="message_delta", stop_reason="end_turn",
                      usage={"input_tokens": 5, "output_tokens": 2,
                             "cache_creation_input_tokens": 0, "cache_read_input_tokens": 95},
                      block_index=None, block_type=None, tool_use_id=None, tool_name=None,
                      text_delta=None, input_json_delta=None)
            # 真实 provider 语义：答节在 yield message_stop 之前落盘
            # （runner 在 message_stop 即 break，之后的代码不执行）
            if tracer:
                tracer.trace_response(turn, {"id": "m1", "usage": {
                    "input_tokens": 5, "cache_read_input_tokens": 95}})
            yield _ns(type="message_stop", usage=None,
                      block_index=None, block_type=None, tool_use_id=None, tool_name=None,
                      text_delta=None, input_json_delta=None, stop_reason=None)

    class _Emitter:
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

    tracer = _make(tmp_path, session_key="s-e2e")
    sa = StreamingAgent(
        client=_Provider(),
        model="mock",
        tools=[],
        tool_handlers={},
        emitter=_Emitter(),
        config=StreamingConfig(compact_threshold=10**9),
        skills_loader=None,
        tracer=tracer,
        runtime=SimpleNamespace(
            config=SimpleNamespace(workdir=tmp_path, assets_dir=tmp_path / "none"),
            skill_access_state=None,
        ),
    )
    asyncio.run(sa.run_stream([], "问题", "sid"))

    assert captured["tracer"] is tracer
    text = tracer._path.read_text(encoding="utf-8")
    assert "## 轮 1 · 问" in text
    assert "## 轮 1 · 答" in text
    assert "触发源[main]: (user) 问题" in text
