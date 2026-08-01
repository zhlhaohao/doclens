"""diary API 请求/响应模型。"""
from typing import Optional

from pydantic import BaseModel


class FragmentModel(BaseModel):
    """一条片段（文字或图片+备注）。image_url 可直接用于 <img src>。"""
    fid: str
    time: str            # HH:MM
    kind: str            # "text" | "photo"
    text: str            # 文字内容，或图片备注
    image_url: Optional[str] = None   # /api/preview/raw?path=...（仅 photo）


class DayEntryResponse(BaseModel):
    """某日小节。state: raw（片段态）/ summarized（成品态）/ empty（无记录）。

    summarized 时 content 为成品 md，图片引用已重写为 /api/preview/raw URL，
    前端 md-viewer 直接渲染即可。
    """
    date: str
    state: str
    fragments: list[FragmentModel] = []
    content: str = ""


class TodayResponse(BaseModel):
    """服务器本地今天日期 + 当日小节（记录页数据源）。"""
    today: str
    entry: DayEntryResponse


class AddTextRequest(BaseModel):
    text: str


class FragmentResponse(BaseModel):
    fragment: FragmentModel


class CalendarResponse(BaseModel):
    month: str
    dates: list[str]  # 该月有内容（任意状态）的日期，升序


class DeleteFragmentResponse(BaseModel):
    deleted: bool
