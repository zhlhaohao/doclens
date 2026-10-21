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

from doclens.index_manager import IndexManager, IndexUnavailable
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


def _do_search(
    idx: IndexManager, query: str
) -> tuple[ScoreResult, list[str], list[str]]:
    """在子线程中执行同步搜索 + 评分管道。

    **候选池就是配置里的 `top_k_docs`（默认 100 个文档）**——AP-47：这里
    原先写着 `_MAX_FETCH = 1000` 并据此传 `max_results`，但引擎从未消费
    该参数，实际池子是 100，于是 `total` 号称覆盖 1000 个候选其实只覆盖
    100 个。现在不再编造池子大小，改为「池满就明说」：路由到的文档数等于
    池上限时，实际命中很可能更多，用 notes 告诉用户/前端。

    TreeSearch.search 是同步的，不能在事件循环内调用。

    返回 (ScoreResult, query_words, notes)。
    """
    nodes, docs = idx.search(query)
    pool = idx.top_k_docs
    notes: list[str] = []
    if len(docs) >= pool:
        notes.append(
            f"候选池已满（{pool} 个文档），实际命中可能更多——"
            "可缩小查询范围或调大 CORTEX_TOP_K_DOCS"
        )
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]
    return score_and_rank(nodes, docs, query, query_words, idx), query_words, notes


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
        result, query_words, notes = await asyncio.to_thread(
            _do_search, idx, req.query
        )
    except IndexUnavailable as e:
        # AP-45：索引库不可读 ≠ 没有匹配。与 /api/grep 对齐填 error，
        # 前端据此区分「无结果」与「出错了」。
        logger.warning("index unavailable: %s", e)
        return GroupedSearchResponse(
            groups=[], total=0, total_matches=0, offset=0, limit=req.limit,
            query=req.query, query_words=[], source="fts",
            notes=[str(e)],
            error=f"索引库不可用，本次结果不代表知识库内容: {e}",
            elapsed_ms=int((time.perf_counter() - start) * 1000),
        )
    except Exception as e:
        logger.warning("score_and_rank failed: %s; returning empty result", e)
        return GroupedSearchResponse(
            groups=[], total=0, total_matches=0, offset=0, limit=req.limit,
            query=req.query, query_words=[], source="fts",
            notes=[f"检索引擎异常: {e}"],
            error=f"搜索失败: {e}",
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
        notes=notes,
        elapsed_ms=elapsed_ms,
    )
