"""GET /api/skills —— 技能工具箱列表 + 技能管理面 CRUD（ADR-0015）。

工具箱端点（GET /api/skills）契约不变：返回有效 context_menu 为 true 的技能，
每项含 name / description / icon / accept_dirs。可变状态全部改走 sidecar
（skills_config.json）合并值，不再读 SKILL.md frontmatter。

管理面端点供设置页技能 tab：
- GET    /api/skills/manage          全量列表（含已删除内置技能灰置条目）
- PATCH  /api/skills/{name}          稀疏更新 enabled/context_menu/accept_dirs
- POST   /api/skills/install/preview GitHub 安装预览（确认弹窗数据源）
- POST   /api/skills/install         GitHub 安装执行
- DELETE /api/skills/{name}          删除（内置=标记+撤部署可恢复；外部=真删）
- POST   /api/skills/{name}/restore  恢复已删除内置技能（重新部署）

所有变更热生效：原位 rescan()/set_disabled() 更新内存 SkillLoader（同一实例
被 load_skill 工具闭包与 StreamingRunner 持有，换新实例会导致工具读旧状态）；
agent 未装配时跳过（下次启动自然生效）。
"""
import logging
import re
import shutil

from fastapi import APIRouter

from doclens import skills_config, skills_installer
from doclens.config import get_global_cortex_dir
from doclens.skills_deploy import deploy_builtin_skills
from doclens.web_v2 import deps
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.models.skill import (
    SkillInstallPreviewRequest,
    SkillInstallPreviewResponse,
    SkillInstallRequest,
    SkillInstallResponse,
    SkillManageItem,
    SkillManageListResponse,
    SkillPatchRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_NAME_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


def _skills_dir():
    return get_global_cortex_dir() / "skills"


def _scan_loader():
    """轻量磁盘扫描（不触发 agent 装配）——管理列表的数据源。"""
    from planify.skills.skill_loader import SkillLoader

    return SkillLoader(_skills_dir())


def _hot_apply(rescan: bool = False) -> None:
    """热生效：原位更新内存 SkillLoader。agent 未装配时静默跳过。"""
    agent = deps.get_agent_if_ready()
    if agent is None:
        return
    loader = agent.runtime.skills
    if rescan:
        loader.rescan()
    loader.set_disabled(skills_config.disabled_names(loader.skills.keys()))


def _validate_name(name: str) -> str:
    if not _NAME_RE.match(name):
        raise CortexAPIError(400, "SKILL_NAME_INVALID", f"非法技能名: {name}")
    return name


def _manage_item(name: str, meta: dict, builtin: bool) -> SkillManageItem:
    state = skills_config.effective_state(name)
    return SkillManageItem(
        name=name,
        description=meta.get("description", ""),
        icon=meta.get("icon", "sparkles"),
        builtin=builtin,
        enabled=state["enabled"],
        context_menu=state["context_menu"],
        accept_dirs=state["accept_dirs"],
        deleted=state["deleted"],
        source_url=state["source_url"],
    )


@router.get("/skills")
async def list_skills():
    """工具箱技能列表（契约不变；context_menu/accept_dirs 改走 sidecar 有效值）。

    停用仅做路由层隔断（不进 system prompt 清单），不影响工具箱展示——
    工具箱显隐由 context_menu 独立控制。
    """
    agent = deps.get_agent()
    skills_loader = agent.runtime.skills
    skills = []
    for name, info in skills_loader.skills.items():
        state = skills_config.effective_state(name)
        if not state["context_menu"]:
            continue
        meta = info.get("meta", {})
        skills.append({
            "name": name,
            "description": meta.get("description", ""),
            "icon": meta.get("icon", "sparkles"),
            "accept_dirs": state["accept_dirs"],
        })
    return {"skills": skills}


@router.get("/skills/manage", response_model=SkillManageListResponse)
async def list_skills_manage():
    """全量技能管理列表：磁盘技能 + 已删除内置技能（灰置可恢复）。"""
    loader = _scan_loader()
    builtins = skills_config.builtin_skill_names()
    items = [
        _manage_item(name, info.get("meta", {}), name in builtins)
        for name, info in loader.skills.items()
    ]
    # 已删除的内置技能不在磁盘上（部署被跳过），从发行包 meta 补灰置条目
    deleted = skills_config.deleted_names()
    builtin_meta = skills_config.builtin_skill_meta()
    for name in sorted(deleted & builtins):
        if name not in loader.skills:
            items.append(_manage_item(name, builtin_meta.get(name, {}), True))
    items.sort(key=lambda s: (s.deleted, not s.builtin, s.name))
    return SkillManageListResponse(skills=items)


@router.patch("/skills/{name}", response_model=SkillManageItem)
async def patch_skill(name: str, req: SkillPatchRequest):
    """稀疏更新可变状态（enabled/context_menu/accept_dirs），热生效。"""
    name = _validate_name(name)
    loader = _scan_loader()
    builtins = skills_config.builtin_skill_names()
    if name not in loader.skills and name not in skills_config.deleted_names():
        raise CortexAPIError(404, "SKILL_NOT_FOUND", f"技能不存在: {name}")
    updates = req.model_dump(exclude_unset=True)
    skills_config.update_skill(name, updates)
    _hot_apply(rescan=False)
    meta = (
        loader.skills.get(name, {}).get("meta")
        or skills_config.builtin_skill_meta().get(name, {})
    )
    return _manage_item(name, meta, name in builtins)


@router.post("/skills/install/preview", response_model=SkillInstallPreviewResponse)
async def preview_install(req: SkillInstallPreviewRequest):
    """GitHub 安装预览：解析 + 下载 + 列出发现的技能（不写盘），供确认弹窗。"""
    try:
        preview = skills_installer.preview_install(req.url)
    except skills_installer.SkillInstallError as e:
        raise CortexAPIError(400, "SKILL_INSTALL_PREVIEW_FAILED", str(e))
    return SkillInstallPreviewResponse(**preview)


@router.post("/skills/install", response_model=SkillInstallResponse)
async def install_skill(req: SkillInstallRequest):
    """GitHub 安装执行：内置同名拒绝、外部同名覆盖（保留用户设置）。热生效。"""
    try:
        installed = skills_installer.install_from_github(req.url, _skills_dir())
    except skills_installer.SkillInstallError as e:
        raise CortexAPIError(400, "SKILL_INSTALL_FAILED", str(e))
    _hot_apply(rescan=True)
    return SkillInstallResponse(installed=installed)


@router.delete("/skills/{name}")
async def delete_skill(name: str):
    """删除技能：内置=标记 deleted + 撤部署目录（可恢复）；外部=真删目录。"""
    name = _validate_name(name)
    builtins = skills_config.builtin_skill_names()
    loader = _scan_loader()
    if name not in loader.skills:
        raise CortexAPIError(404, "SKILL_NOT_FOUND", f"技能不存在: {name}")
    target = _find_skill_dir(name)
    if target is None:
        raise CortexAPIError(500, "SKILL_DIR_MISSING", f"技能目录缺失: {name}")
    if name in builtins:
        skills_config.update_skill(name, {"deleted": True})
    else:
        skills_config.remove_entry(name)
    shutil.rmtree(target)
    _hot_apply(rescan=True)
    return {"deleted": name, "builtin": name in builtins}


@router.post("/skills/{name}/restore", response_model=SkillManageItem)
async def restore_skill(name: str):
    """恢复已删除的内置技能：清除 deleted 标记 + 立即重新部署（热生效）。"""
    name = _validate_name(name)
    builtins = skills_config.builtin_skill_names()
    if name not in builtins:
        raise CortexAPIError(400, "SKILL_NOT_BUILTIN", f"仅内置技能可恢复: {name}")
    if name not in skills_config.deleted_names():
        raise CortexAPIError(409, "SKILL_NOT_DELETED", f"技能未处于已删除状态: {name}")
    skills_config.update_skill(name, {"deleted": None})
    deploy_builtin_skills(_skills_dir())
    _hot_apply(rescan=True)
    meta = skills_config.builtin_skill_meta().get(name, {})
    return _manage_item(name, meta, True)


def _find_skill_dir(name: str):
    """按技能名定位磁盘目录（meta name 解析，目录名兜底）。"""
    from doclens.skills_deploy import skill_name_of

    root = _skills_dir()
    for skill_md in sorted(root.rglob("SKILL.md")):
        if skill_name_of(skill_md, skill_md.parent.name) == name:
            return skill_md.parent
    return None
