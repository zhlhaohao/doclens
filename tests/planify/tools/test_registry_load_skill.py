"""验证 build_tool_registry 的 load_skill handler 在成功时标记 skill 已加载。"""
import pytest
from planify.skills.access_state import (
    SkillAccessState,
    set_current_session_id,
)
from planify.skills.skill_loader import SkillLoader


@pytest.fixture(autouse=True)
def _reset_session_context() -> None:
    """每个测试前重置 ContextVar，避免测试间污染。"""
    set_current_session_id("")


class _FakeLoader:
    """最小 SkillLoader 替身。"""
    def load(self, name: str) -> str:
        if name == "knowledge-base":
            return "<skill>body</skill>"
        return f"Error: Unknown skill '{name}'"


def _build_registry_handlers(skill_state):
    """仅构建 load_skill handler（隔离重型 build_tool_registry）。"""
    from planify.tools.registry import _build_load_skill_handler
    return _build_load_skill_handler(_FakeLoader(), skill_state)


def test_load_skill_marks_state_on_success():
    state = SkillAccessState()
    handler = _build_registry_handlers(state)
    set_current_session_id("s1")
    body = handler(name="knowledge-base")
    assert body == "<skill>body</skill>"
    assert state.is_loaded("s1", "knowledge-base")


def test_load_skill_does_not_mark_on_unknown():
    state = SkillAccessState()
    handler = _build_registry_handlers(state)
    set_current_session_id("s1")
    body = handler(name="nope")
    assert body.startswith("Error:")
    assert not state.is_loaded("s1", "nope")
