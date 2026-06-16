"""POST /api/search —— 关键词搜索。

复用 IndexManager.search()；适配其 (flat_nodes, documents) 返回结构为
SearchResult 列表。

IndexManager.search() 返回:
    flat_nodes: list[dict]  每项含 {node_id, doc_id, doc_name, title, score, text}
    documents:  list[dict]  合并后的文档结果（含 nodes 子列表）
主要数据（路径、文本、分数）来自 flat_nodes 项。
"""
import asyncio
import time
from typing import Iterator

from fastapi import APIRouter, Depends

from cortex.index_manager import IndexManager
from cortex.web_v2.deps import get_index_manager
from cortex.web_v2.models.search import SearchRequest, SearchResponse, SearchResult

router = APIRouter()


def _format_results(nodes) -> Iterator[SearchResult]:
    """把 flat_nodes dict 列表转成 SearchResult 列表。

    每个 node 是一个 dict，包含:
      - doc_name: 文件路径/名称
      - text:     节点文本内容
      - score:    BM25 分数
      - title:    节点标题
    """
    for node in nodes:
        # node 是 dict（由 treesearch search 返回的 flat_nodes 项）
        path = node.get("doc_name", "") or node.get("doc_id", "")
        text = node.get("text", "")
        score = float(node.get("score", 0) or 0)
        snippet = (text or "")[:300]
        yield SearchResult(
            path=path,
            snippet=snippet,
            score=score,
            line=None,
            highlights=[],
        )


def _do_search(idx: IndexManager, query: str, limit: int):
    """在子线程中执行同步搜索（TreeSearch.search 不能在事件循环内调用）。"""
    return idx.search(query, max_results=limit)


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    nodes, documents = await asyncio.to_thread(_do_search, idx, req.query, req.limit)
    results = list(_format_results(nodes))
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return SearchResponse(
        results=results,
        total=len(results),
        query=req.query,
        elapsed_ms=elapsed_ms,
    )
