"""技能门禁：KB 工具执行前确认所属 skill 已加载，否则弹回。

强制 LLM 在使用 search_kb / read_document / manage_kb / grep 前先
load_skill("knowledge-base") 获取检索策略与引文规范。
"""
from __future__ import annotations

from typing import Any, Callable

from planify.skills.access_state import SkillAccessState, get_current_session_id

# knowledge-base 技能"拥有"的工具集合
KB_SKILL = "knowledge-base"
KB_GATED_TOOLS = {"search_kb", "read_document", "manage_kb", "grep"}

BOUNCE_MSG = (
    "<skill_required>\n"
    "本工具（{tool}）属于 {skill} 技能，但该技能尚未加载。\n"
    "请先调用 load_skill(name=\"{skill}\") 获取检索策略与引文规范，再重新调用本工具。\n"
    "</skill_required>"
)


def gate_skill(
    skill_state: SkillAccessState,
    skill_name: str,
    tool_name: str,
    handler: Callable[..., Any],
) -> Callable[..., Any]:
    """包装工具 handler：未加载所属 skill 时弹回，否则执行。

    ContextVar（当前 session_id）为空时跳过门禁直接执行，兼容非会话上下文
    （单元测试、CLI 直调 handler 等）。
    """
    def wrapped(**kw: Any) -> Any:
        sid = get_current_session_id()
        if sid and not skill_state.is_loaded(sid, skill_name):
            return BOUNCE_MSG.format(tool=tool_name, skill=skill_name)
        return handler(**kw)

    return wrapped
