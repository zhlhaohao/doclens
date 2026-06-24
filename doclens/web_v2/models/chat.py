"""Chat API 模型。"""
from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    session_id: Optional[str] = None
    history: list[dict] = Field(default_factory=list)  # [{role, content}]
