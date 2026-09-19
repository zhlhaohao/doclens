"""Sessions API 模型。"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from doclens.web_v2.sessions_store import SessionType


class SessionCreateRequest(BaseModel):
    type: SessionType
    title: str = Field(min_length=1, max_length=200)
    preview: str = Field(default="", max_length=200)
    mode: Optional[str] = None  # search: 'keyword' | 'grep'；chat: 'skill'（技能会话）


class SessionAppendRequest(BaseModel):
    """追加 items 到指定会话。"""
    items: list[dict[str, Any]]  # [{kind, payload}]
    message_count: Optional[int] = None


class SessionRenameRequest(BaseModel):
    """人工改名。处理规则在端点内：strip 后为空 → 400；超 60 字符截断
    （与 chat-view 创建时的 slice(0, 60) 语义对齐，故此处不设 max_length）。"""
    title: str = Field(min_length=1)


class SessionStarRequest(BaseModel):
    """加星/取消加星（2026-09-17）：加星即置顶 + 删除保护；不刷新 updated_at。"""
    starred: bool


class SessionRewindRequest(BaseModel):
    """执行回退（ADR-0027）。point_seq = 锚点 message_user 的 seq；
    restore_files=False 时跳过文件恢复（仅对话回退）。"""
    point_seq: int
    restore_files: bool = True


class SessionCreatedResponse(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    mode: Optional[str] = None


class SessionListItem(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    mode: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int
    starred: bool = False


class SessionListResponse(BaseModel):
    sessions: list[SessionListItem]
    returned: int


class SessionDetailResponse(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    mode: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int
    starred: bool = False
    items: list[dict[str, Any]]
    # 实时上下文窗口（runtime.config 现读，与压缩决策同源）。前端会话信息
    # 弹窗分母优先本值，而非 usage 落库行的历史快照——配置热更后旧会话
    # 显示不再停滞旧窗口。agent 未装配时为 0（前端回落历史快照）。
    context_window: int = 0
