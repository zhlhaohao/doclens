"""POST /api/grep —— 正则搜索（文件分组响应）。

复用 doclens.ripgrep.execute_grep_search，与 CLI `cortex grep` 行为完全一致：
LIKE(REGEXP) → ripgrep 降级 → 路径正则，按词项命中数评分。覆盖所有文件（含未索引）。
返回与 /api/search 同构的 GroupedSearchResponse（按文件分组），source="grep"。
path 命中 = 文件组 kind="path"（头部「路径」徽标、无命中行）；2026-10-18 决议。
"""
import asyncio
import logging
import time

from fastapi import APIRouter, Depends

from doclens.index_manager import IndexManager
from doclens.ripgrep import execute_grep_search
from doclens.web_v2.api._grouping import (
    build_regex_matchers,
    extract_match_rows,
    group_and_paginate,
)
from doclens.web_v2.api._pathutil import resolve_preview_path
from doclens.web_v2.deps import get_index_manager
from doclens.web_v2.models.search import GrepRequest, GroupedSearchResponse, MatchItem

logger = logging.getLogger(__name__)
router = APIRouter()


def _do_grep(idx: IndexManager, pattern: str, max_results: int):
    """在子线程中执行同步 grep 搜索，返回 (分组项, query_words, notes)。

    content 命中对节点文本按正则词项提取命中行；path 命中无文本可扫，
    保持单条占位行（text = 命中说明，line = None）。
    """
    result = execute_grep_search(idx, pattern, max_results=max_results)
    matchers = build_regex_matchers(result.query_words)

    items: list[tuple[str, float, list]] = []
    # 元组为 6 元（尾元=matched 词列表，kb 链路用）；web_v2 高亮走 query_words 通道，不解包内容
    for doc_id, node, matched, _prox, _fts, _matched_words in result.content_results:
        # 未索引文件的合成节点自带 source_path（伪 doc_id 在 path_map 中查不到）
        source_path = node.get("source_path") or doc_id
        path = resolve_preview_path(source_path, idx.path_map, idx.search_path)
        rows = extract_match_rows(
            node.get("text", "") or "", node.get("line_start"), matchers,
        )
        # 正则词项扫描无命中（如词项是纯语法结构）时退回节点首行占位，
        # 保证文件仍出现在分组里（引擎已判定该文件命中）
        if not rows:
            first = next(
                (ln for ln in (node.get("text", "") or "").split("\n") if ln.strip()),
                "",
            )
            if first:
                rows = [MatchItem(line=node.get("line_start"), text=first[:200], spans=[])]
        if rows:
            total_terms = max(len(result.query_words), 1)
            items.append((path, matched / total_terms, rows))

    path_items: list[tuple[str, float, list]] = []
    for doc_id, node, matched, _prox, _fts, _matched_words in result.path_results:
        path = resolve_preview_path(doc_id, idx.path_map, idx.search_path)
        row = [MatchItem(line=None, text=f"路径匹配: {node.get('title', '')}", spans=[])]
        path_items.append((path, 0.0, row))

    return items, result.query_words, result.notes, path_items


@router.post("/grep", response_model=GroupedSearchResponse)
async def grep(req: GrepRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    # 分页下推：引擎按 offset+limit 取足量，翻页才不会被默认 max_results
    # 截在 50 条内（引擎内部还有 grep_max_results 上限，取二者较大值）
    fetch_size = req.offset + req.limit
    try:
        items, query_words, notes, path_items = await asyncio.to_thread(
            _do_grep, idx, req.pattern, fetch_size,
        )
    except Exception as e:
        logger.warning("execute_grep_search failed: %s; returning empty result", e)
        return GroupedSearchResponse(
            groups=[], total=0, total_matches=0, offset=0, limit=req.limit,
            query=req.pattern, query_words=[], source="grep",
            elapsed_ms=int((time.perf_counter() - start) * 1000),
            error=f"grep 引擎异常: {e}",
        )

    page, total_files, total_matches, page_offset = group_and_paginate(
        items, req.offset, req.limit, path_items=path_items,
    )
    return GroupedSearchResponse(
        groups=page,
        total=total_files,
        total_matches=total_matches,
        offset=page_offset,
        limit=req.limit,
        query=req.pattern,
        query_words=query_words,
        source="grep",
        elapsed_ms=int((time.perf_counter() - start) * 1000),
        notes=notes,
    )
