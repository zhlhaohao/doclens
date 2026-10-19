"""POST /api/search —— 关键词搜索（文件分组响应）。

复用 IndexManager.search() + scoring_pipeline.score_and_rank，与 CLI/TUI
完全一致的行为：字面子串过滤、综合评分、FTS → LIKE → ripgrep 三重降级。
响应为 GroupedSearchResponse：按文件分组（分页单位 = 文件），组内一条
命中一行（行号 + 单行文本 + 命中区间），2026-10-18 决议。
"""
import asyncio
import logging
import time

from fastapi import APIRouter, Depends

from doclens.index_manager import IndexManager
from doclens.scoring import tokenize_query
from doclens.scoring_pipeline import score_and_rank, ScoreResult
from doclens.web_v2.api._grouping import (
    build_substring_matchers,
    extract_like_rows,
    extract_match_rows,
    group_and_paginate,
)
from doclens.web_v2.api._pathutil import resolve_preview_path
from doclens.web_v2.deps import get_index_manager
from doclens.web_v2.models.search import SearchRequest, GroupedSearchResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# 单次搜索拉取的最大 FTS 候选数。覆盖大部分实际匹配；
# score_and_rank 在此集合上做完整过滤+排序，提供准确 total。
# 超过该值的匹配不可见（v1 接受）。
_MAX_FETCH = 1000


def _do_search(
    idx: IndexManager, query: str, max_fetch: int = _MAX_FETCH
) -> tuple[ScoreResult, list[str]]:
    """在子线程中执行同步搜索 + 评分管道。

    max_fetch 是 FTS 候选拉取上限（搜索池大小），与 endpoint 的 limit（页大小）解耦。
    TreeSearch.search 是同步的，不能在事件循环内调用。

    返回 (ScoreResult, query_words)：query_words 是后端分词结果，
    空分词时降级为按空白拆分，供命中行提取与前端高亮使用。
    """
    nodes, docs = idx.search(query, max_results=max_fetch)
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]
    return score_and_rank(nodes, docs, query, query_words, idx), query_words


def _scored_to_group_items(
    result: ScoreResult,
    path_map: dict,
    search_path: str,
    matchers: list,
) -> list[tuple[str, float, list]]:
    """把 ScoreResult 转成 (path, score, match_rows) 项（不分组、不分页）。

    三个分支：
      - source="fts":     result.results = [(composite, (doc_id, node, matched, prox, fts))]
      - source="like":    result.like_raw = list[dict]（无行号，退化为单行卡）
      - source="ripgrep": result.results = [(doc_id, node, matched, prox, fts)]（无 composite）
    """
    items: list[tuple[str, float, list]] = []

    if result.source == "fts":
        for composite, (doc_id, node, _matched, _prox, _fts) in result.results:
            path = resolve_preview_path(doc_id, path_map, search_path)
            rows = extract_match_rows(
                node.get("text", "") or "", node.get("line_start"), matchers,
            )
            if rows:
                items.append((path, composite, rows))

    elif result.source == "like":
        for raw in result.like_raw or []:
            doc_key = raw.get("doc_name", "") or raw.get("doc_id", "")
            path = resolve_preview_path(doc_key, path_map, search_path)
            rows = extract_like_rows(raw.get("summary", "") or "", matchers)
            if rows:
                items.append((path, 0.5, rows))  # 对齐 CLI 固定分

    elif result.source == "ripgrep":
        # rg_fallback_search 结果为 6 元（尾元=matched 词列表）；web_v2 高亮走 query_words 通道
        for doc_id, node, _matched, _prox, _fts, _matched_words in result.results:
            path = resolve_preview_path(doc_id, path_map, search_path)
            rows = extract_match_rows(
                node.get("text", "") or "", node.get("line_start"), matchers,
            )
            if rows:
                items.append((path, 0.0, rows))  # 对齐 CLI 固定分

    return items


@router.post("/search", response_model=GroupedSearchResponse)
async def search(req: SearchRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    try:
        result, query_words = await asyncio.to_thread(_do_search, idx, req.query)
    except Exception as e:
        logger.warning("score_and_rank failed: %s; returning empty result", e)
        return GroupedSearchResponse(
            groups=[], total=0, total_matches=0, offset=0, limit=req.limit,
            query=req.query, query_words=[], source="fts",
            elapsed_ms=int((time.perf_counter() - start) * 1000),
        )

    matchers = build_substring_matchers(query_words)
    items = _scored_to_group_items(result, idx.path_map, idx.search_path, matchers)
    page, total_files, total_matches, page_offset = group_and_paginate(
        items, req.offset, req.limit,
    )
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return GroupedSearchResponse(
        groups=page,
        total=total_files,
        total_matches=total_matches,
        offset=page_offset,
        limit=req.limit,
        query=req.query,
        query_words=query_words,
        source=result.source,
        elapsed_ms=elapsed_ms,
    )
