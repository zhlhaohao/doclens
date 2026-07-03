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
    # 仅二进制合成预览（pdf/docx/xlsx/csv）返回。
    # {node.line_start(原始体系, str): heading 在合成 md 中的实际行号(str)}。
    # JSON 对象 key 必须是 str；前端用 String(r.line) 查表换算 md 行号。
    # None / {} 表示无映射（普通文本预览，r.line 即文件实际行号）。
    line_map: Optional[dict[str, int]] = None


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
