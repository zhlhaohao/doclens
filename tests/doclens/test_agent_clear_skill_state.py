"""验证 /clear 斜杠命令清空当前 session 的技能加载状态。"""
from types import SimpleNamespace

from planify.skills.access_state import SkillAccessState

from doclens.agent_integration import CortexAgent


def test_clear_slash_command_clears_skill_state(tmp_path):
    agent = CortexAgent(tmp_path)
    state = SkillAccessState()
    state.mark_loaded("s1", "knowledge-base")

    agent.session = SimpleNamespace(
        skill_access_state=state,
        session_id="s1",
        replace_messages_in_place=lambda msgs: None,
    )

    should_exit, history = agent.handle_slash_command(
        "clear", "", [{"role": "user", "content": "x"}]
    )

    assert should_exit is False
    assert not state.is_loaded("s1", "knowledge-base")