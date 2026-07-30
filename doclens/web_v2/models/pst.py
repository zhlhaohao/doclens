"""PST 邮件列表 / 附件 API 请求响应模型。"""
from typing import Optional

from pydantic import BaseModel


class PstEmailItem(BaseModel):
    """邮件列表表格的一行。"""
    entry_id: str
    subject: str
    sender: str
    date: str
    folder: str


class PstEmailListResponse(BaseModel):
    """GET /api/pst/emails 响应（日期倒序分页）。"""
    path: str
    total: int
    offset: int
    limit: int
    emails: list[PstEmailItem]


class PstAttachmentInfo(BaseModel):
    """单邮件预览响应中的附件项。

    stored=False（超限/提取失败）时 download_url 为 None，前端只展示文件名。
    """
    name: str
    size: int
    stored: bool
    download_url: Optional[str] = None
