"""技能门禁：KB 工具执行前确认所属 skill 已加载，否则弹回。

强制 LLM 在使用 search_kb / read_document / manage_kb / grep / file_info 前先
load_skill("knowledge-base") 获取检索策略与引文规范。

2026-08-17：GATE_ENABLED 临时关闭（技能工具箱场景 AI 已被用户显式指定技能，
弹回一轮浪费 LLM 调用）。代码路径保留，改回 True 即恢复门禁。
"""
from __future__ import annotations

import os
from typing import Any, Callable

from planify.skills.access_state import SkillAccessState, get_current_session_id

# 门禁总开关（可用环境变量 CORTEX_SKILL_GATE 覆盖）。False = 工具直接执行。
GATE_ENABLED = os.environ.get("CORTEX_SKILL_GATE", "").strip().lower() not in {
    "0", "false", "no", "off",
} and False  # 临时关闭：恢复时删除 `and False`

# knowledge-base 技能"拥有"的工具集合
KB_SKILL = "knowledge-base"
KB_GATED_TOOLS = {"search_kb", "read_document", "manage_kb", "grep", "file_info"}

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
    （单元测试、CLI 直调 handler 等）。GATE_ENABLED=False 时门禁整体关闭。
    """
    if not GATE_ENABLED:
        return handler

    def wrapped(**kw: Any) -> Any:
        sid = get_current_session_id()
        if sid and not skill_state.is_loaded(sid, skill_name):
            return BOUNCE_MSG.format(tool=tool_name, skill=skill_name)
        return handler(**kw)

    return wrapped
