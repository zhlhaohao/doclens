"""搜索 API 请求/响应模型。"""
from typing import Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    # 纯空白 query 拒绝（BUG-F2 修复）：strip 后为空 → 422——此前 " " 长度
    # ≥1 过验证，触发 LIKE '% %' 随机命中（把含连续空格的 summary 当结果）。
    query: str = Field(min_length=1, max_length=500, pattern=r"\S")
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


class MatchItem(BaseModel):
    """单条命中行（文件分组视图，2026-10-18）：行号 + 单行文本 + 命中区间。"""
    line: Optional[int] = None  # 无行号源（LIKE）为 None，前端行号区显示「—」
    text: str                    # 单行文本（超长以首命中为中心截断，≤200 字符）
    spans: list[tuple[int, int]] = []  # text 内命中区间 [start, end)，供 <mark>


class FileGroup(BaseModel):
    """一个文件的结果分组：头部信息 + 命中行集合。"""
    path: str
    best_score: float = 0.0   # 组内最高综合分（排序依据，不再展示给用户）
    total_matches: int = 0    # 命中总数（徽标显示值，不受 cap 影响）
    matches: list[MatchItem] = []
    kind: str = "content"     # "content" | "path"（路径命中组无命中行）
    truncated: bool = False   # matches 超 MATCHES_PER_FILE_CAP 截断


class GroupedSearchResponse(BaseModel):
    """文件分组搜索响应（2026-10-18 起 /api/search 与 /api/grep 的返回体）。"""
    groups: list[FileGroup]
    total: int          # 文件总数（分页单位 = 文件）
    total_matches: int  # 全部命中行总数（「N 个文件 · M 处命中」的 M）
    offset: int = 0
    limit: int = 20
    query: str
    query_words: list[str] = []
    elapsed_ms: int
    source: str = "fts"
    notes: list[str] = []
    error: Optional[str] = None


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
