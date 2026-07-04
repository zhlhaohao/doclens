"""POST /api/search —— 关键词搜索。

复用 IndexManager.search() + scoring_pipeline.score_and_rank，与 CLI/TUI
完全一致的行为：字面子串过滤、综合评分、FTS → LIKE → ripgrep 三重降级。
"""
import asyncio
import logging
import re
import time

from fastapi import APIRouter, Depends

from doclens.index_manager import IndexManager
from doclens.scoring import tokenize_query
from doclens.scoring_pipeline import score_and_rank, ScoreResult
from doclens.web_v2.api._pathutil import resolve_preview_path
from doclens.web_v2.deps import get_index_manager
from doclens.web_v2.models.search import SearchRequest, SearchResponse, SearchResult
from doclens.web_v2.preview_synthesizer import _strip_leading_title

logger = logging.getLogger(__name__)
router = APIRouter()

# 单次搜索拉取的最大 FTS 候选数。覆盖大部分实际匹配；
# score_and_rank 在此集合上做完整过滤+排序，提供准确 total。
# 超过该值的匹配不可见（v1 接受）。
_MAX_FETCH = 1000

# snippet 按字符截断的兜底上限（防止单行超长节点把 snippet 撑爆）。
_SNIPPET_MAX_CHARS = 300


def _truncate_snippet_by_lines(text: str, max_lines: int) -> str:
    """按 max_lines 行数截断 snippet（取前 N 行）；<= 0 时不截断。
    与 CLI 兜底分支 `max_context_lines` 语义对齐：让 result-card 卡片
    显示的行数统一受 CORTEX_MAX_CONTEXT_LINES 控制。"""
    if max_lines <= 0 or not text:
        return text
    lines = text.split("\n")
    if len(lines) <= max_lines:
        return text
    return "\n".join(lines[:max_lines])


# PDF [PAGE N] 内部页码标记。与 pdf_parser._RE_PAGE_MARKER /
# preview._RE_PDF_PAGE_MARKER 同源，本模块独立定义避免跨模块耦合。
_RE_PDF_PAGE_MARKER = re.compile(r"^\[PAGE\s+\d+\]$")


def _is_pdf_path(path: str) -> bool:
    """按相对路径后缀判断是否 PDF（resolve_preview_path 返回 POSIX 相对路径）。"""
    return path.lower().endswith(".pdf")


def _compose_pdf_snippet(text: str, title: str, max_lines: int) -> str:
    """PDF 专用 snippet 合成：与 preview 的 render_tree_to_md 口径对齐。

    PDF 的 node.text 是 pdfplumber 提取的纯文本（无 ``#``/``-``/表格等 markdown
    语法），直接交给 marked.parse 只得到普通 ``<p>`` 段落，卡片看起来"像原始文本"。
    这里做三件事让它具备 markdown 结构：

      1. 前缀加 ``# {title}``，让节点标题渲染成 heading（与预览面板一致）。
      2. 剥除正文首行与 title 重复 —— ``_cut_md_text`` 从 heading 行开始切片，
         导致 node.text 首行就是 title；预览路径用 _strip_leading_title 剥除，
         搜索路径原先未剥，标题会在卡片里重复出现。
      3. 剥除 ``[PAGE N]`` 内部页码标记 —— preview 路径 _extract_pdf_pages 会剥，
         搜索路径原先泄漏，卡片直接显示 ``[PAGE 3]`` 这种标记。

    body 行数受 max_lines 控制；heading 行额外附加，不挤占正文配额。
    最后按 _SNIPPET_MAX_CHARS 字符兜底截断。
    """
    body = _strip_leading_title(text, title)
    body = "\n".join(
        ln for ln in body.split("\n") if not _RE_PDF_PAGE_MARKER.match(ln.strip())
    )
    body = _truncate_snippet_by_lines(body, max_lines).strip()

    if not body:
        return f"# {title}" if title else ""
    if not title:
        return body[:_SNIPPET_MAX_CHARS]
    return f"# {title}\n\n{body}"[:_SNIPPET_MAX_CHARS]


def _make_snippet(text: str, title: str, path: str, max_lines: int) -> str:
    """合成 SearchResult.snippet。

    PDF 走 _compose_pdf_snippet（结构化合成 + 清洗 [PAGE N]/首行重复）；
    其他类型保持裸 node.text —— md/docx 等的 node.text 本身已含 markdown 语法，
    直接 marked.parse 即可正确渲染，无需额外处理。
    """
    if _is_pdf_path(path):
        return _compose_pdf_snippet(text, title, max_lines)
    return _truncate_snippet_by_lines(text, max_lines)[:_SNIPPET_MAX_CHARS]


def _format_scored_results(
    result: ScoreResult,
    path_map: dict,
    search_path: str,
    max_context_lines: int,
) -> list[SearchResult]:
    """把 score_and_rank 的 ScoreResult 转成完整 SearchResult 列表（不切片）。

    切片由调用方（endpoint）按 offset/limit 处理。

    三个分支：
      - source="fts":     result.results = [(composite, (doc_id, node, matched, prox, fts))]
      - source="like":    result.like_raw = list[dict]（fts.like_search 返回格式）
      - source="ripgrep": result.results = [(doc_id, node, matched, prox, fts)]（无 composite）
    """
    out: list[SearchResult] = []

    if result.source == "fts":
        for composite, (doc_id, node, _matched, _prox, _fts) in result.results:
            path = resolve_preview_path(doc_id, path_map, search_path)
            text = node.get("text", "") or ""
            title = node.get("title", "") or ""
            snippet = _make_snippet(text, title, path, max_context_lines)
            out.append(SearchResult(
                path=path,
                snippet=snippet,
                score=round(composite, 4),
                line=node.get("line_start"),
                highlights=[],
            ))

    elif result.source == "like":
        for item in result.like_raw or []:
            doc_key = item.get("doc_name", "") or item.get("doc_id", "")
            path = resolve_preview_path(doc_key, path_map, search_path)
            text = item.get("summary", "") or ""
            title = item.get("title", "") or ""
            snippet = _make_snippet(text, title, path, max_context_lines)
            out.append(SearchResult(
                path=path,
                snippet=snippet,
                score=0.5,  # 对齐 CLI _convert_like_to_render_items 的固定分
                line=None,  # like_search 不返回 line_start
                highlights=[],
            ))

    elif result.source == "ripgrep":
        for doc_id, node, _matched, _prox, _fts in result.results:
            path = resolve_preview_path(doc_id, path_map, search_path)
            text = node.get("text", "") or ""
            title = node.get("title", "") or ""
            snippet = _make_snippet(text, title, path, max_context_lines)
            out.append(SearchResult(
                path=path,
                snippet=snippet,
                score=0.0,  # 对齐 CLI is_ripgrep 的固定分
                line=node.get("line_start"),
                highlights=[],
            ))

    return out


def _do_search(
    idx: IndexManager, query: str, max_fetch: int = _MAX_FETCH
) -> tuple[ScoreResult, list[str]]:
    """在子线程中执行同步搜索 + 评分管道。

    max_fetch 是 FTS 候选拉取上限（搜索池大小），与 endpoint 的 limit（页大小）解耦。
    TreeSearch.search 是同步的，不能在事件循环内调用。

    返回 (ScoreResult, query_words)：query_words 是后端分词结果，
    空分词时降级为按空白拆分，供前端做关键字高亮。
    """
    nodes, docs = idx.search(query, max_results=max_fetch)
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]
    return score_and_rank(nodes, docs, query, query_words, idx), query_words


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    try:
        result, query_words = await asyncio.to_thread(_do_search, idx, req.query)
    except Exception as e:
        logger.warning("score_and_rank failed: %s; returning empty result", e)
        return SearchResponse(
            results=[],
            total=0,
            offset=0,
            limit=req.limit,
            query=req.query,
            query_words=[],
            source="fts",
            elapsed_ms=int((time.perf_counter() - start) * 1000),
        )

    all_results = _format_scored_results(result, idx.path_map, idx.search_path, idx.max_context_lines)
    total = len(all_results)
    # offset 越界兜底：clamp 到最后一页的起点
    safe_offset = min(req.offset, max(0, total - 1)) if total > 0 else 0
    page = all_results[safe_offset : safe_offset + req.limit]
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return SearchResponse(
        results=page,
        total=total,
        offset=safe_offset,
        limit=req.limit,
        query=req.query,
        query_words=query_words,
        source=result.source,
        elapsed_ms=elapsed_ms,
    )
