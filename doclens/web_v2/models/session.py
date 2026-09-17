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
