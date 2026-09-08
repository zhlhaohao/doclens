"""技能管理面的请求/响应模型（ADR-0015）。"""
from typing import Optional

from pydantic import BaseModel


class SkillManageItem(BaseModel):
    """管理列表条目：磁盘技能 or 已删除内置技能（灰置可恢复）。"""

    name: str
    description: str = ""
    icon: str = "sparkles"
    builtin: bool
    enabled: bool
    context_menu: bool
    accept_dirs: bool
    deleted: bool
    source_url: Optional[str] = None


class SkillManageListResponse(BaseModel):
    skills: list[SkillManageItem]


class SkillPatchRequest(BaseModel):
    """可变状态稀疏更新：未出现的字段不动；显式 null 表示移除覆盖（回落默认）。"""

    enabled: Optional[bool] = None
    context_menu: Optional[bool] = None
    accept_dirs: Optional[bool] = None


class SkillInstallPreviewRequest(BaseModel):
    url: str


class SkillInstallPreviewItem(BaseModel):
    name: str
    description: str = ""


class SkillInstallPreviewResponse(BaseModel):
    source_url: str
    skills: list[SkillInstallPreviewItem]
    conflicts: list[str] = []


class SkillInstallRequest(BaseModel):
    url: str


class SkillInstallResponse(BaseModel):
    installed: list[str]
