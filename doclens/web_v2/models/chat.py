"""Chat API 模型。"""
from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    session_id: Optional[str] = None


class ChatStopRequest(BaseModel):
    """POST /api/chat/stop —— 中断指定 session 的 AI 生成。"""
    session_id: str = Field(min_length=1)
