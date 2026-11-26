"""精简基础提示词变体（ADR-0064）——框架侧行为守护。

三件事：
1. 变体文本：剔除对话助手专属段、保留工具使用规则与环境信息；
2. 默认路径零变化：``base_prompt="default"`` 时系统提示词与头部注入与此前逐字相同；
3. minimal 路径：头部不注技能清单 / agent.md，临时文件目录随 ``scratch_dir``。
"""

import copy
from pathlib import Path
from types import SimpleNamespace

import pytest

from planify.prompts import (
    BASE_PROMPT_VARIANTS,
    build_minimal_system_prompt,
    build_system_prompt,
)
from planify.core.llm.types import StreamEvent
from planify.streaming.runner import CONTEXT_MARKER, StreamingAgent
from planify.streaming.types import StreamingConfig


def _ev(type_, **kw):
    return StreamEvent(type=type_, **kw)


class _TextProvider:
    """每次调用直接返回一段文本结束；记录收到的 system。"""

    def __init__(self):
        self.systems = []

    async def astream(self, *, messages, system, tools, max_tokens, tracer=None):
        self.systems.append(system)
        yield _ev("content_block_start", block_index=0, block_type="text")
        yield _ev("content_block_delta", block_index=0, text_delta="ok")
        yield _ev("content_block_stop", block_index=0)
        yield _ev("message_delta", stop_reason="end_turn")
        yield _ev("message_stop")


class _Emitter:
    async def emit_text(self, content, is_end=False):
        pass

    async def emit_done(self, session_id, summary=None):
        pass

    async def emit_notice(self, message, level="info", **kw):
        pass


class _Skills:
    def descriptions(self):
        return "demo-skill: 演示技能"

    def load(self, name):
        return "SKILL BODY" if name == "demo-skill" else f"Error: unknown {name}"


def _runtime(tmp_path: Path):
    config = SimpleNamespace(workdir=tmp_path, assets_dir=tmp_path / "assets")
    return SimpleNamespace(
        config=config,
        skill_access_state=SimpleNamespace(loaded_names=lambda sid: []),
        replace_messages_in_place=lambda msgs: None,
    )


def _agent(provider, tmp_path: Path, **kw):
    return StreamingAgent(
        client=provider,
        model="mock",
        tools=[],
        tool_handlers={},
        emitter=_Emitter(),
        config=StreamingConfig(compact_threshold=10**9),
        runtime=_runtime(tmp_path),
        **kw,
    )


# ---------- 1. 变体文本 ----------

def test_variants_closed_set():
    assert BASE_PROMPT_VARIANTS == ("default", "minimal")


@pytest.mark.parametrize("section", [
    "TaskCreate", "ask_user_question", "TodoWrite",
    "# Tone and style", "# Doing tasks", "# Task Guide", "Use task for subagent delegation",
])
def test_minimal_drops_assistant_only_sections(section):
    assert section not in build_minimal_system_prompt(".", None)


@pytest.mark.parametrize("section", [
    "# Using your tools", "# Environment", "# Working Directory Guard",
    "# Output efficiency", "read_file", "edit_file", "write_file",
    "# Skill vs Tool priority", "load_skill",   # 技能按需加载（ADR-0065）
])
def test_minimal_keeps_tool_rules_and_environment(section):
    assert section in build_minimal_system_prompt(".", None)


def test_minimal_appends_extra_prompt():
    assert "\nEXTRA\n" in build_minimal_system_prompt(".", "EXTRA")


def test_default_prompt_untouched():
    """默认变体仍是对话助手全量提示词（回归锁）。"""
    p = build_system_prompt(".", "streaming")
    assert "TaskCreate" in p and "load_skill" in p and "ask_user_question" in p


# ---------- 2. 默认路径零变化 ----------

def test_default_variant_matches_legacy_prompt(tmp_path: Path):
    sa = _agent(_TextProvider(), tmp_path)
    assert sa.base_prompt == "default"
    assert sa.get_system_prompt() == build_system_prompt(str(tmp_path), "streaming", None)


def test_unknown_variant_falls_back_to_default(tmp_path: Path):
    sa = _agent(_TextProvider(), tmp_path, base_prompt="bogus")
    assert sa.base_prompt == "default"


def test_default_head_context_still_has_skills_and_default_tmp(tmp_path: Path):
    import asyncio

    provider = _TextProvider()
    sa = _agent(provider, tmp_path, skills_loader=_Skills())
    history = []
    asyncio.run(sa.run_stream(history, "hi", "sess-1"))
    ctx = next(m["content"] for m in history if CONTEXT_MARKER in str(m.get("content", "")))
    assert "demo-skill" in ctx                      # 技能清单仍注入
    assert "/tmp/sess-1" in ctx                      # 默认临时目录（数据目录名由框架决定）
    assert "sess-1/tmp/" not in ctx


# ---------- 3. minimal 路径 ----------

def test_minimal_agent_uses_minimal_prompt_and_skips_agent_md(tmp_path: Path):
    import asyncio

    provider = _TextProvider()
    sa = _agent(
        provider, tmp_path,
        base_prompt="minimal",
        skills_loader=_Skills(),       # 清单照常注入（宿主按白名单过滤的 loader）
        system_prompt_extra="EMPLOYEE_RULES",
    )
    history = []
    asyncio.run(sa.run_stream(history, "hi", "sess-2"))

    sys_prompt = provider.systems[0]
    assert "TaskCreate" not in sys_prompt and "ask_user_question" not in sys_prompt
    assert "EMPLOYEE_RULES" in sys_prompt and "load_skill" in sys_prompt

    # 头部注入：技能清单在、agent.md 段不在、临时目录指引在
    ctx = next(m["content"] for m in history if CONTEXT_MARKER in str(m.get("content", "")))
    assert "demo-skill" in ctx
    assert "following context" not in ctx
    assert "# Temporary Files" in ctx


def test_minimal_without_skills_loader_has_no_skill_list(tmp_path: Path):
    import asyncio

    sa = _agent(_TextProvider(), tmp_path, base_prompt="minimal", scratch_dir="x/tmp")
    history = []
    asyncio.run(sa.run_stream(history, "hi", "sess-3"))
    ctx = next(m["content"] for m in history if CONTEXT_MARKER in str(m.get("content", "")))
    assert "demo-skill" not in ctx
    assert "out/assignment-1/tmp/sess-3" not in ctx
    assert "x/tmp/sess-3" in ctx


def test_minimal_with_scratch_dir_points_there(tmp_path: Path):
    import asyncio

    sa = _agent(
        _TextProvider(), tmp_path,
        base_prompt="minimal", scratch_dir="out/assignment-1/tmp",
    )
    history = []
    asyncio.run(sa.run_stream(history, "hi", "sess-4"))
    ctx = next(m["content"] for m in history if CONTEXT_MARKER in str(m.get("content", "")))
    assert "out/assignment-1/tmp/sess-4" in ctx


def test_minimal_head_context_is_stable_across_rounds(tmp_path: Path):
    """两轮头部注入逐字相同（刷新而非重复插入，前缀缓存友好）。"""
    import asyncio

    sa = _agent(_TextProvider(), tmp_path, base_prompt="minimal", scratch_dir="x/tmp")
    history = []
    asyncio.run(sa.run_stream(history, "q1", "sess-5"))
    n_after_r1 = len(history)
    asyncio.run(sa.run_stream(history, "q2", "sess-5"))
    ctx_msgs = [m for m in history if CONTEXT_MARKER in str(m.get("content", ""))]
    assert len(ctx_msgs) == 1, "头部上下文被重复插入"
    assert n_after_r1 < len(history)
