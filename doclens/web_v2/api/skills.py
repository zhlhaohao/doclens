"""GET /api/skills —— 技能工具箱列表。

只返回声明 context_menu: true 的白名单技能（工具箱技能），
每项含 name / description / icon / accept_dirs。icon 为前端图标注册表名字，
前端渲染 <doclens-icon name=...>。accept_dirs: true 表示技能可处理目录
（如 knowledge-base 用 paths 限定目录范围问答），前端勾选项可保留目录。
"""
import logging

from fastapi import APIRouter

from doclens.web_v2.deps import get_agent

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/skills")
async def list_skills():
    agent = get_agent()
    skills_loader = agent.runtime.skills
    skills = []
    for name, info in skills_loader.skills.items():
        meta = info.get("meta", {})
        if str(meta.get("context_menu", "")).strip().lower() != "true":
            continue
        skills.append({
            "name": name,
            "description": meta.get("description", ""),
            "icon": meta.get("icon", "sparkles"),
            "accept_dirs": str(meta.get("accept_dirs", "")).strip().lower() == "true",
        })
    return {"skills": skills}
