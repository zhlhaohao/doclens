"""POST /api/grep —— 正则搜索。

复用 doclens.ripgrep.execute_grep_search，与 CLI `cortex grep` 行为完全一致：
LIKE(REGEXP) → ripgrep 降级 → 路径正则，按词项命中数评分。覆盖所有文件（含未索引）。
返回与 /api/search 相同的 SearchResponse 结构，source="grep"。
"""
import asyncio
import logging
import time

from fastapi import APIRouter, Depends

from doclens.index_manager import IndexManager
from doclens.ripgrep import execute_grep_search
from doclens.web_v2.api._pathutil import resolve_preview_path
from doclens.web_v2.deps import get_index_manager
from doclens.web_v2.models.search import GrepRequest, SearchResponse, SearchResult

logger = logging.getLogger(__name__)
router = APIRouter()


def _to_search_result(
    doc_id, node, matched, total_terms, kind, path_map, search_path,
    context_before: int, context_after: int, terms: list[str],
    match_max: int,
) -> SearchResult:
    # 未索引文件的合成节点自带 source_path（伪 doc_id 在 path_map 中查不到）
    source_path = node.get("source_path") or doc_id
    # 统一锚点窗口（与 CLI/MCP 的 grep 工具同口径）；正则不合法/无命中
    # 退回完整 node text（Phase 1 的 summary 已是截断产物）
    from doclens.grep_tools import _regex_led_snippet

    snippet = _regex_led_snippet(
        node.get("text", "") or "", terms,
        before=context_before, after=context_after, match_max=match_max,
    )
    if snippet is None:
        snippet = node.get("text", "") or ""
    return SearchResult(
        path=resolve_preview_path(source_path, path_map, search_path),
        snippet=snippet,
        score=round(matched / total_terms, 4) if total_terms > 0 else 0.0,
        line=node.get("line_start"),
        highlights=[],
        kind=kind,
    )


def _do_grep(idx: IndexManager, pattern: str):
    """在子线程中执行同步 grep 搜索，返回 (SearchResult[], query_words)。"""
    result = execute_grep_search(idx, pattern)
    total_terms = max(len(result.query_words), 1)
    out: list[SearchResult] = []
    ctx = dict(
        path_map=idx.path_map, search_path=idx.search_path,
        context_before=idx.search_context_before, context_after=idx.search_context_after,
        match_max=idx.grep_match_max_chars,
        terms=result.query_words,
    )
    for doc_id, node, matched, _prox, _fts in result.content_results:
        out.append(_to_search_result(doc_id, node, matched, total_terms, "content", **ctx))
    for doc_id, node, matched, _prox, _fts in result.path_results:
        out.append(_to_search_result(doc_id, node, matched, total_terms, "path", **ctx))
    return out, result.query_words


@router.post("/grep", response_model=SearchResponse)
async def grep(req: GrepRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    try:
        all_results, query_words = await asyncio.to_thread(_do_grep, idx, req.pattern)
    except Exception as e:
        logger.warning("execute_grep_search failed: %s; returning empty result", e)
        return SearchResponse(
            results=[], total=0, offset=0, limit=req.limit,
            query=req.pattern, query_words=[], source="grep",
            elapsed_ms=int((time.perf_counter() - start) * 1000),
        )

    total = len(all_results)
    safe_offset = min(req.offset, max(0, total - 1)) if total > 0 else 0
    page = all_results[safe_offset : safe_offset + req.limit]
    return SearchResponse(
        results=page, total=total, offset=safe_offset, limit=req.limit,
        query=req.pattern, query_words=query_words, source="grep",
        elapsed_ms=int((time.perf_counter() - start) * 1000),
    )
