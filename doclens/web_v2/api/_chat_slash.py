"""斜杠技能调用（``/技能名 问题``）——纯逻辑，独立于 chat.py 便于单测。

设计（grilling 会话共识 2026-09-18；信封简化为斜杠形态）：
- 前端引导式下拉 + 非法阻断是 UX 层；**本模块是注入权威**——chat.py 每次请求
  用 runtime SkillLoader 复检合法性（存在 ∧ 未停用 ∧ user-invocable）；
- 合法时：用户消息**原样**发给 LLM（落库原文、展示保真），紧随其后注入一条
  hint 消息对（system-reminder + assistant "Noted."），指示模型 load_skill；
- hint 持久化复用 skill_context 通路（upsert 按名幂等 + 回放原样重建消息对），
  去重键加 ``slash:`` 前缀与技能正文条目隔离；跨轮前缀缓存稳定的关键；
- 引文策展联动：斜杠前缀命中合法技能 = 技能会话（提取式引文）。工具箱直发
  （对话页/文件页右键）同样发送斜杠形态消息，与本链路完全统一；
  ``[调用技能: …]`` 信封仅为遗留会话的兼容检测（skill_refs.is_skill_message）。
"""

import re
from typing import Optional

from doclens import skills_config
from doclens.web_v2.api._chat_markers import SLASH_HINT_MARKER

# 技能名字符集与 API 校验一致（skills._NAME_RE：[\w.\-]+ Unicode——ADR-0041 D4
# 起对 CJK 开放，深读技能的中文书名 slug 可斜杠匹配）
_SLASH_SKILL_RE = re.compile(r"^/([\w.\-]+)(?:\s|$)", re.UNICODE)

# hint 注入消息的标记（与 <loaded-skill> 语义区分：本标记 = 请求加载，
# loaded-skill = 已加载正文；runner 的重注入去重只认 loaded-skill，不冲突）
SLASH_HINT_RE = re.compile(re.escape(SLASH_HINT_MARKER) + r'([^"]+)">')

_HINT_TEMPLATE = (
    "<system-reminder>\n"
    '<slash-skill-hint name="{name}">\n'
    "用户以斜杠命令调用技能。请先 load_skill(\"{name}\") 加载该技能，"
    "然后严格按技能指引处理用户问题。\n"
    "</slash-skill-hint>\n"
    "</system-reminder>"
)


def legal_slash_skill(message: str, skills_loader) -> Optional[str]:
    """复检斜杠调用的合法性，合法返回技能名，否则 None。

    五门（与前端引导菜单同口径）：斜杠前缀命中 ∧ 技能存在 ∧ 未停用/未删除
    （loader.is_disabled，宿主已注入 sidecar 停用名单）∧ user-invocable
    （用户调用面硬门，model-only 技能不可经用户入口调用）∧ 非深读技能
    直连（ADR-0041：深读技能的唯一用户入口是深读面板，手敲斜杠/对话菜单
    都不注入——但面板点书跳 chat 复用的正是斜杠形态消息，故深读技能的
    面板消息须放行：豁免方式 = disabled 检查对深读技能跳过（宿主把深读
    技能整体注入 disabled 名单实现模型感知面隔断，见 agent_integration），
    is_disabled 为 False 时面板链路畅通）。

    Args:
        message: 用户消息原文（前端已 trim；未 trim 的调用方消息带前导空格
            时不命中——斜杠调用以首字符为准）
        skills_loader: planify SkillLoader（runtime.skills；None 视为不合法）
    """
    if skills_loader is None:
        return None
    match = _SLASH_SKILL_RE.match(message)
    if not match:
        return None
    name = match.group(1)
    if name not in skills_loader.skills:
        return None
    if skills_loader.is_disabled(name):
        # 深读技能经 disabled 名单做模型感知面隔断（ADR-0041 D2/D3），
        # 但面板点书的消息必须放行——豁免：前缀命中即视为合法，
        # 交由上层（面板链路）独占
        if not name.startswith(skills_config.BOOK_SKILL_PREFIX):
            return None
    if not skills_loader.is_user_invocable(name):
        return None
    return name


def slash_hint_content(name: str) -> str:
    """构造 hint 注入消息（模型侧的加载指引，持久化后回放原样重建）。"""
    return _HINT_TEMPLATE.format(name=name)


def hint_already_injected(history: list, name: str) -> bool:
    """会话历史中是否已有该技能的 hint（含回放重建的早轮条目）。

    已注入则本轮不再追加——早轮 hint 已在上下文且 skill_context 落库按名
    幂等，重复注入会造成「内存两对、回放一对」的前缀分叉。
    """
    marker = f"{SLASH_HINT_MARKER}{name}\">"
    return any(
        m.get("role") == "user"
        and isinstance(m.get("content"), str)
        and marker in m["content"]
        for m in history
    )
