"""验证 build_kb_tools / build_grep_tools 在传入 skill_state 时返回门禁 handler。"""
import pytest
from planify.skills.access_state import (
    SkillAccessState,
    set_current_session_id,
)

from doclens.kb_tools import build_kb_tools
from doclens.grep_tools import build_grep_tools


@pytest.fixture(autouse=True)
def _reset_session_context() -> None:
    """每个测试前重置 ContextVar，避免测试间污染。"""
    set_current_session_id("")


class _FakeIdx:
    """最小 IndexManager 替身，仅满足 handler 不被真实调用即弹回。"""
    max_results = 10


def test_build_kb_tools_gates_search_kb_when_not_loaded():
    state = SkillAccessState()
    _tools, handlers = build_kb_tools(_FakeIdx(), workdir=".", skill_state=state)
    set_current_session_id("s1")
    out = handlers["search_kb"](query="量子计算")
    assert "<skill_required>" in out


def test_build_grep_tools_gates_grep_when_not_loaded():
    state = SkillAccessState()
    _tools, handlers = build_grep_tools(_FakeIdx(), skill_state=state)
    set_current_session_id("s1")
    out = handlers["grep"](pattern="foo")
    assert "<skill_required>" in out


def test_build_kb_tools_no_skill_state_passthrough():
    """不传 skill_state 时行为不变（不门禁），兼容既有调用。"""
    _tools, handlers = build_kb_tools(_FakeIdx(), workdir=".", skill_state=None)
    # handler 存在且可调用（不门禁，会进入真实逻辑——这里只验证未被包裹的签名）
    assert "search_kb" in handlers
