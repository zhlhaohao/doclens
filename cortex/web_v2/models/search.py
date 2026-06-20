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
    score: float  # 语义变更：原 FTS5 BM25 原始分 → composite 综合分（0~1 归一化）
    line: Optional[int] = None
    highlights: list[tuple[int, int]] = []


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int  # 真实过滤后总数（不再是 len(results)）
    offset: int = 0  # 当前页起始 offset（响应回显）
    limit: int = 20  # 当前页大小
    query: str
    elapsed_ms: int
    source: str = "fts"  # 值 ∈ {"fts", "like", "ripgrep"}
