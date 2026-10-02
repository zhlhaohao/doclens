"""git API 请求/响应模型（未提交改动视图，2026-10-01 决议）。"""
from typing import Literal, Optional

from pydantic import BaseModel

# 单条改动的状态归并口径：
#   added    = untracked / staged 新增（HEAD→无，工作区→有）
#   modified = staged / unstaged 修改（含 renamed，按新路径展示）
#   deleted  = staged / unstaged 删除（HEAD→有，工作区→无）
ChangeKind = Literal["added", "modified", "deleted"]

# 暂存分层信息（列表徽章提示用，diff 恒为工作区 vs HEAD 总净效果）
#   untracked  = 未跟踪（?? ）
#   staged     = 只在暂存区有改动（HEAD→index）
#   unstaged   = 只在工作区有改动（index→worktree）
#   both       = 两层都有（叠加）
#   deleted    = 已删除（不含暂存细节区分）
Staging = Literal["untracked", "staged", "unstaged", "both"]


class GitChange(BaseModel):
    """一条未提交改动。path 为相对知识库根的 POSIX 路径。"""
    path: str
    kind: ChangeKind
    staging: Staging
    size: int = 0                 # 工作区当前大小（bytes；删除/二进制未知为 0）
    old_size: Optional[int] = None  # HEAD 版本大小（删除/修改时有值；新增为 None）
    is_binary: bool = False       # git 判定二进制（diff 端点据此返回占位元数据）


class GitChangesResponse(BaseModel):
    """改动列表（前端按「新增在前、其余路径字典序」重排展示）。"""
    changes: list[GitChange]
    total: int


class GitDiffResponse(BaseModel):
    """单文件 Unified Diff（工作区 vs HEAD 总净效果）。"""
    path: str
    kind: ChangeKind
    is_binary: bool
    # unified diff 文本（含 @@ hunk 头；untracked = 全绿新增、deleted = 全红）
    diff: str
    # 二进制占位卡片元数据（is_binary=True 时 diff 为空）
    binary_info: Optional[dict] = None
