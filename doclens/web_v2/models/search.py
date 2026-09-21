"""搜索 API 请求/响应模型。"""
from typing import Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    mode: str = Field(default="keyword", pattern="^(keyword|phrase)$")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class GrepRequest(BaseModel):
    pattern: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class SearchResult(BaseModel):
    path: str
    snippet: str
    score: float  # 语义变更：原 FTS5 BM25 原始分 → composite 综合分（0~1 归一化）
    line: Optional[int] = None
    highlights: list[tuple[int, int]] = []
    kind: str = "content"  # "content" | "path"（grep 路径匹配为 "path"）


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int  # 真实过滤后总数（不再是 len(results)）
    offset: int = 0  # 当前页起始 offset（响应回显）
    limit: int = 20  # 当前页大小
    query: str
    query_words: list[str] = []  # 后端分词结果，供前端高亮使用
    elapsed_ms: int
    source: str = "fts"  # 值 ∈ {"fts", "like", "ripgrep", "grep"}
    # 引擎附注（grep 源可能非空）：rg 超时截断、二进制子集超限未覆盖等
    # 「结果为什么可能不完整」的提示
    notes: list[str] = []
    # 引擎异常摘要——引擎抛错时结果为空但请求仍是 200，前端据此区分
    # 「无结果」与「出错了」（None = 正常）
    error: Optional[str] = None
