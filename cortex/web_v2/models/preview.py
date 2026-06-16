"""预览 API 响应模型。"""
from typing import Optional

from pydantic import BaseModel


class PreviewResponse(BaseModel):
    path: str
    language: str = "text"
    content: str
    line_range: Optional[tuple[int, int]] = None
    highlights: list[int] = []  # 高亮行号
