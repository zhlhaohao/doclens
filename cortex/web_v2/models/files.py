"""files API 请求/响应模型。"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class Entry(BaseModel):
    """目录条目（文件或子目录）。"""
    name: str
    path: str
    is_dir: bool
    size: int
    modified_at: datetime
    indexed: bool
    writable: bool
    has_child_dirs: bool = False


class ListDirResponse(BaseModel):
    path: str
    entries: list[Entry]
    total: int


class DirStatsResponse(BaseModel):
    path: str
    file_count: int
    dir_count: int
    total_size_bytes: int


class AttrsResponse(Entry):
    created_at: datetime
    extension: Optional[str] = None
    is_protected: bool = False


class MkdirRequest(BaseModel):
    path: str


class SkippedItem(BaseModel):
    from_path: str
    reason: str


class MoveRequest(BaseModel):
    from_paths: list[str] = Field(..., min_length=1)
    dest_dir: str
    overwrite: bool = False


class MoveResponse(BaseModel):
    moved: list[str]
    skipped: list[SkippedItem]


class RenameRequest(BaseModel):
    path: str
    new_name: str


class UploadResponse(BaseModel):
    path: str
    bytes_written: int
    overwritten: bool
    reindex_triggered: bool
