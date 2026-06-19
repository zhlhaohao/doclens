"""预览 API 请求/响应模型。"""
from typing import Optional

from pydantic import BaseModel


class PreviewResponse(BaseModel):
    path: str
    language: str = "text"
    content: str
    line_range: Optional[tuple[int, int]] = None
    highlights: list[int] = []
    writable: bool = False


class PreviewSaveRequest(BaseModel):
    """PUT /api/preview 请求体。"""
    content: str


class PreviewSaveResponse(BaseModel):
    """PUT /api/preview 响应。"""
    path: str
    content: str
    bytes_written: int
    reindex_triggered: bool
