"""skill_gate.gate_skill 单元测试。"""
import pytest
from planify.skills.access_state import (
    SkillAccessState,
    reset_current_session_id,
    set_current_session_id,
)

from doclens.skill_gate import BOUNCE_MSG, KB_SKILL, gate_skill


@pytest.fixture(autouse=True)
def _reset_session_context():
    """每个测试前重置 ContextVar，避免测试间污染（finally 中的
    reset_current_session_id(set_current_session_id("")) 复位回旧值，
    不会真正清空，因此需要显式 fixture）。"""
    set_current_session_id("")


def test_gate_bounces_when_not_loaded():
    state = SkillAccessState()
    set_current_session_id("s1")
    try:
        called = []
        gated = gate_skill(state, KB_SKILL, "search_kb", lambda **kw: called.append(kw) or "OK")
        out = gated(query="x")
    finally:
        reset_current_session_id(set_current_session_id(""))
    assert "<skill_required>" in out
    assert "knowledge-base" in out
    assert "search_kb" in out
    assert called == []  # 真实 handler 未执行


def test_gate_executes_when_loaded():
    state = SkillAccessState()
    state.mark_loaded("s1", KB_SKILL)
    set_current_session_id("s1")
    try:
        gated = gate_skill(state, KB_SKILL, "search_kb", lambda **kw: "RESULTS")
        assert gated(query="x") == "RESULTS"
    finally:
        reset_current_session_id(set_current_session_id(""))


def test_gate_skips_when_session_id_empty():
    """ContextVar 未设置（非 run_stream 上下文）时直接执行，不阻断。"""
    state = SkillAccessState()  # 未加载
    assert get_sid() == ""  # 默认空
    gated = gate_skill(state, KB_SKILL, "search_kb", lambda **kw: "RESULTS")
    assert gated(query="x") == "RESULTS"


def get_sid() -> str:
    from planify.skills.access_state import get_current_session_id
    return get_current_session_id()


def test_bounce_msg_contains_load_skill_instruction():
    msg = BOUNCE_MSG.format(tool="grep", skill=KB_SKILL)
    assert 'load_skill(name="knowledge-base")' in msg
