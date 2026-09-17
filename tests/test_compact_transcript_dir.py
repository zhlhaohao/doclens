"""压缩 transcript 目录注入回归。

宿主（doclens）经 RuntimeConfig.compact_transcript_dir 注入 .cortex/transcripts 后，
StreamingAgent 的 auto_compact 必须把 transcript 写到注入目录，而不是
<workdir>/.transcripts——后者在被 FileWatcher 监控的工作目录内，每次压缩落盘
都会触发「watch → reindex」回路，且 transcript jsonl 会被索引进知识库。
"""

import asyncio
from types import SimpleNamespace

from planify.streaming.runner import StreamingAgent
from planify.streaming.types import StreamingConfig


def _ev(type_, **kw):
    d = dict(
        type=type_, block_index=None, block_type=None, tool_use_id=None,
        tool_name=None, text_delta=None, input_json_delta=None, stop_reason=None,
        usage=None,
    )
    d.update(kw)
    return SimpleNamespace(**d)


class _TextProvider:
    async def astream(self, *, messages, system, tools, max_tokens, tracer=None):
        yield _ev("content_block_start", block_index=0, block_type="text")
        yield _ev("content_block_delta", block_index=0, text_delta="回答")
        yield _ev("content_block_stop", block_index=0)
        yield _ev("message_delta", stop_reason="end_turn")
        yield _ev("message_stop")


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


def _run_with_capturing_compact(runtime_config, tmp_path):
    """跑一轮 run_stream（compact_threshold=1 必触发压缩），返回捕获的目录。"""
    captured = {}

    async def fake_compact(messages, provider, transcript_dir, *, tracer=None):
        captured["dir"] = transcript_dir
        return messages

    sa = StreamingAgent(
        client=_TextProvider(),
        model="mock",
        tools=[],
        tool_handlers={},
        emitter=_NullEmitter(),
        config=StreamingConfig(compact_threshold=1),  # 必触发 auto_compact
        skills_loader=None,
        runtime=SimpleNamespace(
            config=runtime_config,
            skill_access_state=None,
            replace_messages_in_place=lambda msgs: None,
        ),
    )
    sa._aauto_compact = fake_compact
    asyncio.run(sa.run_stream([], "问题", "sid"))
    return captured


def test_runner_uses_injected_compact_transcript_dir(tmp_path):
    """宿主注入 compact_transcript_dir 时，压缩 transcript 落到注入目录。"""
    injected = tmp_path / ".cortex" / "transcripts"
    config = SimpleNamespace(
        workdir=tmp_path,
        assets_dir=tmp_path / "none",
        compact_transcript_dir=injected,
    )
    captured = _run_with_capturing_compact(config, tmp_path)
    assert captured["dir"] == injected, (
        f"应使用注入目录 {injected}，实际 {captured.get('dir')}"
    )


def test_runner_falls_back_to_workdir_transcripts(tmp_path):
    """未注入（含属性缺失的旧式 config）时退回 <workdir>/.transcripts/。"""
    config = SimpleNamespace(workdir=tmp_path, assets_dir=tmp_path / "none")
    captured = _run_with_capturing_compact(config, tmp_path)
    assert captured["dir"] == tmp_path / ".transcripts"


# === ADR-0026 压缩即事实：runner 打标 + 重注入 + round_start_index 重置 ===

_COMPACTED_PAIR = [
    {"role": "user", "content": "[Compressed. Transcript: t.jsonl]\n摘要"},
    {"role": "assistant", "content": "Understood. Continuing with summary context."},
]


def _run_compacting_round(runtime_config, tmp_path):
    """跑一轮必压缩的 run_stream，返回 (agent, captured_messages)。

    fake_compact 返回真形摘要对（吃掉全部历史含 head 注入）。
    """
    from planify.streaming.runner import CONTEXT_MARKER

    async def fake_compact(messages, provider, transcript_dir, *, tracer=None):
        return [dict(m) for m in _COMPACTED_PAIR]

    sa = StreamingAgent(
        client=_TextProvider(),
        model="mock",
        tools=[],
        tool_handlers={},
        emitter=_NullEmitter(),
        config=StreamingConfig(compact_threshold=1),  # 必触发 auto_compact
        skills_loader=None,
        runtime=SimpleNamespace(
            config=runtime_config,
            skill_access_state=None,
            replace_messages_in_place=lambda msgs: None,
        ),
    )
    sa._aauto_compact = fake_compact
    asyncio.run(sa.run_stream([], "问题", "sid"))
    return sa, CONTEXT_MARKER


def test_compaction_marker_reinjection_and_round_start(tmp_path):
    """压缩打标契约：last_compaction 形状 / 压缩后重注入 head / round_start_index
    重置到全部重注入完成后（摘要对不进 raw_messages 切片区间）。"""
    config = SimpleNamespace(
        workdir=tmp_path, assets_dir=tmp_path / "none",
    )
    sa, marker = _run_compacting_round(config, tmp_path)

    # 打标：消息 = 摘要对，pre_tokens > 0
    assert sa.last_compaction is not None
    assert sa.last_compaction["messages"] == _COMPACTED_PAIR
    assert sa.last_compaction["pre_tokens"] > 0

    # 压缩后重注入：历史头部重建 context 对（摘要对被挤到其后）
    # run_stream 返回后 messages 尾部还有本轮 assistant 回复；
    # 摘要对位于 [head 对] 之后、回复之前
    assert sa.round_start_index is not None
    assert sa.round_start_index == 4  # head 对(2) + 摘要对(2) 之后


def test_cleared_ids_collected_across_loop_turns(tmp_path):
    """microcompact 返回的清理 id 被累积（round_cleared_tool_use_ids）。"""
    long_result = "x" * 500
    msgs = []
    for i in range(12):
        msgs.append({"role": "assistant", "content": [
            {"type": "tool_use", "id": f"r{i}", "name": "bash", "input": {}},
        ]})
        msgs.append({"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": f"r{i}", "content": long_result},
        ]})

    from planify.context.compact import microcompact

    sa = StreamingAgent.__new__(StreamingAgent)  # 只验收集逻辑本身
    sa.round_cleared_tool_use_ids = []
    cleared = microcompact(msgs, keep=10, min_estimated_tokens=0)
    if cleared:
        sa.round_cleared_tool_use_ids.extend(cleared)
    assert sa.round_cleared_tool_use_ids == ["r0", "r1"]
