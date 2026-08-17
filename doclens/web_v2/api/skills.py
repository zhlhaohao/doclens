"""GET /api/skills —— 技能工具箱列表。

只返回声明 context_menu: true 的白名单技能（工具箱技能），
每项含 name / description / icon。icon 为前端图标注册表名字，
前端渲染 <doclens-icon name=...>。
"""
import logging

from fastapi import APIRouter

from doclens.web_v2.deps import get_agent

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/skills")
async def list_skills():
    agent = get_agent()
    skills_loader = agent.session.skills
    skills = []
    for name, info in skills_loader.skills.items():
        meta = info.get("meta", {})
        if str(meta.get("context_menu", "")).strip().lower() != "true":
            continue
        skills.append({
            "name": name,
            "description": meta.get("description", ""),
            "icon": meta.get("icon", "sparkles"),
        })
    return {"skills": skills}
