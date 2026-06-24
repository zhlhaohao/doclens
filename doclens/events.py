"""事件类型定义"""
from typing import TypedDict, Literal

StatusEventType = Literal["info", "success", "warning", "error", "file_change"]


class StatusPayload(TypedDict):
    event_type: StatusEventType
    message: str
    files: list[str] | None
    count: int | None
    timestamp: float
