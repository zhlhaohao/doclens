"""预览 API 请求/响应模型。"""
from typing import Optional

from pydantic import BaseModel


class PageMarker(BaseModel):
    """预览分页标记（PDF 页 / PPTX slide / XLSX sheet）。"""
    label: str          # "第 3 页" / "幻灯片 3 · 项目背景" / "工作表 2 · 销售数据"
    line_start: int     # 1-indexed，对应 PreviewResponse.content 的行号


class PreviewResponse(BaseModel):
    path: str
    language: str = "text"
    content: str
    line_range: Optional[tuple[int, int]] = None
    highlights: list[int] = []
    writable: bool = False
    pages: Optional[list[PageMarker]] = None  # 仅 pdf/pptx/excel 返回


class PreviewSaveRequest(BaseModel):
    """PUT /api/preview 请求体。"""
    content: str


class PreviewSaveResponse(BaseModel):
    """PUT /api/preview 响应。"""
    path: str
    content: str
    bytes_written: int
    reindex_triggered: bool


class PreviewUploadResponse(BaseModel):
    """POST /api/preview/upload 响应。"""
    path: str
    bytes_written: int
    reindex_triggered: bool
