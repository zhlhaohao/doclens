"""POST /api/search —— 关键词搜索。

复用 IndexManager.search()；适配其 (flat_nodes, documents) 返回结构为
SearchResult 列表。

IndexManager.search() 返回:
    flat_nodes: list[dict]  每项含 {node_id, doc_id, doc_name, title, score, text, line_start, line_end}
    documents:  list[dict]  合并后的文档结果（含 nodes 子列表）
主要数据（路径、文本、分数）来自 flat_nodes 项。
"""
import asyncio
import time
from pathlib import Path
from typing import Iterator

from fastapi import APIRouter, Depends

from cortex.index_manager import IndexManager
from cortex.web_v2.deps import get_index_manager
from cortex.web_v2.models.search import SearchRequest, SearchResponse, SearchResult

router = APIRouter()


def _resolve_preview_path(doc_name: str, path_map: dict, search_path: str) -> str:
    """把 doc_name（无扩展名的文件 basename）解析为相对 search_path 的可预览路径。

    treesearch 的 doc_name 仅是 basename 去扩展名（如 '量子密码'），
    无法直接被 /api/preview 当作相对路径使用。这里通过 IndexManager.path_map
    还原到真实绝对路径，再转成相对路径（POSIX 分隔符），保留扩展名与子目录。
    """
    source_abs = path_map.get(doc_name) if path_map else None
    if not source_abs:
        # 退化：索引里没记录 source_path，只能返回原 doc_name
        return doc_name
    try:
        rel = Path(source_abs).resolve().relative_to(Path(search_path).resolve())
        return rel.as_posix()
    except (ValueError, OSError):
        return doc_name


def _format_results(nodes, path_map: dict, search_path: str) -> Iterator[SearchResult]:
    """把 flat_nodes dict 列表转成 SearchResult 列表。

    每个 node 是一个 dict，包含:
      - doc_name: 文件 basename 去扩展名（需经 _resolve_preview_path 还原）
      - text:     节点文本内容
      - score:    BM25 分数
      - title:    节点标题
    """
    for node in nodes:
        # node 是 dict（由 treesearch search 返回的 flat_nodes 项）
        doc_name = node.get("doc_name", "") or node.get("doc_id", "")
        path = _resolve_preview_path(doc_name, path_map, search_path)
        text = node.get("text", "")
        score = float(node.get("score", 0) or 0)
        snippet = (text or "")[:300]
        yield SearchResult(
            path=path,
            snippet=snippet,
            score=score,
            line=node.get("line_start"),
            highlights=[],
        )


def _do_search(idx: IndexManager, query: str, limit: int):
    """在子线程中执行同步搜索（TreeSearch.search 不能在事件循环内调用）。"""
    return idx.search(query, max_results=limit)


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    nodes, documents = await asyncio.to_thread(_do_search, idx, req.query, req.limit)
    # path_map / search_path 为只读，可在主线程直接读取后传入子线程或在此使用
    results = list(_format_results(nodes, idx.path_map, idx.search_path))
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return SearchResponse(
        results=results,
        total=len(results),
        query=req.query,
        elapsed_ms=elapsed_ms,
    )
