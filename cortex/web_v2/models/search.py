"""搜索 API 请求/响应模型。"""
from typing import Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    mode: str = Field(default="keyword", pattern="^(keyword|phrase)$")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class SearchResult(BaseModel):
    path: str
    snippet: str
    score: float
    line: Optional[int] = None
    highlights: list[tuple[int, int]] = []


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str
    elapsed_ms: int
