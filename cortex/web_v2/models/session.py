"""Sessions API 模型。"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from cortex.web_v2.sessions_store import SessionType


class SessionCreateRequest(BaseModel):
    type: SessionType
    title: str = Field(min_length=1, max_length=200)
    preview: str = Field(default="", max_length=200)


class SessionAppendRequest(BaseModel):
    """追加 items 到指定会话。"""
    items: list[dict[str, Any]]  # [{kind, payload}]
    message_count: Optional[int] = None


class SessionCreatedResponse(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str


class SessionListItem(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class SessionListResponse(BaseModel):
    sessions: list[SessionListItem]
    total: int


class SessionDetailResponse(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    created_at: datetime
    updated_at: datetime
    message_count: int
    items: list[dict[str, Any]]
