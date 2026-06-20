"""POST /api/search —— 关键词搜索。

复用 IndexManager.search() + scoring_pipeline.score_and_rank，与 CLI/TUI
完全一致的行为：字面子串过滤、综合评分、FTS → LIKE → ripgrep 三重降级。
"""
import asyncio
import logging
import time
from pathlib import Path

from fastapi import APIRouter, Depends

from cortex.index_manager import IndexManager
from cortex.scoring import tokenize_query
from cortex.scoring_pipeline import score_and_rank, ScoreResult
from cortex.web_v2.deps import get_index_manager
from cortex.web_v2.models.search import SearchRequest, SearchResponse, SearchResult

logger = logging.getLogger(__name__)
router = APIRouter()

# 单次搜索拉取的最大 FTS 候选数。覆盖大部分实际匹配；
# score_and_rank 在此集合上做完整过滤+排序，提供准确 total。
# 超过该值的匹配不可见（v1 接受）。
_MAX_FETCH = 1000


def _resolve_preview_path(doc_key: str, path_map: dict, search_path: str) -> str:
    """把 doc_id 或 doc_name 解析为相对 search_path 的可预览路径。

    IndexManager.path_map 同时以 doc_id（可能带 _hash 后缀）和 doc_name 作 key，
    所以两种 key 都可直接查。
    """
    source_abs = path_map.get(doc_key) if path_map else None
    if not source_abs:
        return doc_key
    try:
        rel = Path(source_abs).resolve().relative_to(Path(search_path).resolve())
        return rel.as_posix()
    except (ValueError, OSError):
        return doc_key


def _format_scored_results(
    result: ScoreResult,
    path_map: dict,
    search_path: str,
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
            path = _resolve_preview_path(doc_id, path_map, search_path)
            out.append(SearchResult(
                path=path,
                snippet=(node.get("text", "") or "")[:300],
                score=round(composite, 4),
                line=node.get("line_start"),
                highlights=[],
            ))

    elif result.source == "like":
        for item in result.like_raw or []:
            doc_key = item.get("doc_name", "") or item.get("doc_id", "")
            path = _resolve_preview_path(doc_key, path_map, search_path)
            out.append(SearchResult(
                path=path,
                snippet=(item.get("summary", "") or "")[:300],
                score=0.5,  # 对齐 CLI _convert_like_to_render_items 的固定分
                line=None,  # like_search 不返回 line_start
                highlights=[],
            ))

    elif result.source == "ripgrep":
        for doc_id, node, _matched, _prox, _fts in result.results:
            path = _resolve_preview_path(doc_id, path_map, search_path)
            out.append(SearchResult(
                path=path,
                snippet=(node.get("text", "") or "")[:300],
                score=0.0,  # 对齐 CLI is_ripgrep 的固定分
                line=node.get("line_start"),
                highlights=[],
            ))

    return out


def _do_search(
    idx: IndexManager, query: str, max_fetch: int = _MAX_FETCH
) -> ScoreResult:
    """在子线程中执行同步搜索 + 评分管道。

    max_fetch 是 FTS 候选拉取上限（搜索池大小），与 endpoint 的 limit（页大小）解耦。
    TreeSearch.search 是同步的，不能在事件循环内调用。
    """
    nodes, docs = idx.search(query, max_results=max_fetch)
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]
    return score_and_rank(nodes, docs, query, query_words, idx)


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    try:
        result = await asyncio.to_thread(_do_search, idx, req.query)
    except Exception as e:
        logger.warning("score_and_rank failed: %s; returning empty result", e)
        return SearchResponse(
            results=[],
            total=0,
            offset=0,
            limit=req.limit,
            query=req.query,
            source="fts",
            elapsed_ms=int((time.perf_counter() - start) * 1000),
        )

    all_results = _format_scored_results(result, idx.path_map, idx.search_path)
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
        source=result.source,
        elapsed_ms=elapsed_ms,
    )
