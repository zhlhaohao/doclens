# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Chunk-level fine-grained retrieval within tree nodes.

When tree search locates relevant nodes (section-level), this module
further narrows down to specific paragraphs/chunks within those nodes.
"""
import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

from .llm import achat, extract_json, count_tokens, DEFAULT_MODEL
from .rank_bm25 import BM25Okapi, tokenize
from .search import SearchResult

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    """A text chunk within a node."""
    text: str = ""
    node_id: str = ""
    doc_id: str = ""
    doc_name: str = ""
    node_title: str = ""
    chunk_index: int = 0
    score: float = 0.0
    line_start: Optional[int] = None
    line_end: Optional[int] = None


@dataclass
class RefinedSearchResult:
    """Result from chunk-level refinement."""
    chunks: list[Chunk] = field(default_factory=list)
    query: str = ""
    total_llm_calls: int = 0
    original_search_result: Optional[SearchResult] = None


def _split_into_chunks(
    text: str,
    chunk_size: int = 256,
    chunk_overlap: int = 64,
) -> list[str]:
    """
    Split text into overlapping chunks using token-based sliding window.

    Args:
        text: input text
        chunk_size: target chunk size in tokens
        chunk_overlap: overlap between consecutive chunks in tokens

    Returns:
        list of chunk strings
    """
    if not text.strip():
        return []

    words = text.split()
    if not words:
        return []

    # Approximate: 1 word ~ 1.3 tokens for English
    words_per_chunk = max(int(chunk_size / 1.3), 10)
    words_overlap = max(int(chunk_overlap / 1.3), 2)
    step = max(words_per_chunk - words_overlap, 1)

    chunks = []
    for i in range(0, len(words), step):
        chunk_words = words[i:i + words_per_chunk]
        if chunk_words:
            chunks.append(" ".join(chunk_words))
        if i + words_per_chunk >= len(words):
            break

    return chunks


def _bm25_rank_chunks(
    query: str,
    chunks: list[str],
    top_k: int = 3,
) -> list[tuple[int, float]]:
    """Rank chunks by BM25 score. Returns (chunk_index, score) pairs."""
    if not chunks:
        return []

    corpus = [tokenize(c) for c in chunks]
    query_tokens = tokenize(query)
    if not query_tokens:
        return [(i, 0.0) for i in range(min(top_k, len(chunks)))]

    bm25 = BM25Okapi(corpus)
    return bm25.get_top_n(query_tokens, n=top_k)


async def _llm_rerank_chunks(
    query: str,
    chunks: list[tuple[int, str]],
    model: str = DEFAULT_MODEL,
    top_k: int = 3,
) -> list[tuple[int, float]]:
    """
    LLM rerank of candidate chunks.

    Args:
        query: search query
        chunks: list of (index, text) pairs
        model: LLM model
        top_k: number of top chunks to return

    Returns:
        list of (chunk_index, score) pairs
    """
    if not chunks:
        return []

    chunk_list = "\n\n".join(
        f"[Chunk {idx}]: {text[:500]}" for idx, text in chunks
    )

    prompt = (
        f"Rate the relevance of each text chunk to the query.\n\n"
        f"Query: {query}\n\n"
        f"Chunks:\n{chunk_list}\n\n"
        f"Return JSON only:\n"
        f'{{"scores": [{{"chunk_index": <int>, "relevance": <float 0.0-1.0>}}]}}'
    )

    response = await achat(prompt, model=model, temperature=0)
    result = extract_json(response)
    scores = result.get("scores", [])

    ranked = []
    for item in scores:
        idx = item.get("chunk_index")
        rel = float(item.get("relevance", 0.0))
        if idx is not None:
            ranked.append((idx, rel))

    ranked.sort(key=lambda x: -x[1])
    return ranked[:top_k]


async def refine_search(
    query: str,
    search_result: SearchResult,
    model: str = DEFAULT_MODEL,
    chunk_size: int = 256,
    chunk_overlap: int = 64,
    top_k_chunks: int = 3,
    use_bm25: bool = True,
    use_llm_rerank: bool = False,
    max_nodes: int = 5,
) -> RefinedSearchResult:
    """
    Refine search results to chunk-level granularity.

    Takes node-level results from search() and narrows down to specific
    text chunks within those nodes.

    Pipeline:
      1. Take top nodes from search_result
      2. Split each node's text into overlapping chunks
      3. BM25 rank chunks within each node
      4. (Optional) LLM rerank top candidates
      5. Return top-k chunks across all nodes

    Args:
        query: search query
        search_result: SearchResult from search()
        model: LLM model for optional reranking
        chunk_size: target chunk size in tokens
        chunk_overlap: overlap between chunks
        top_k_chunks: number of top chunks to return
        use_bm25: use BM25 for initial chunk ranking
        use_llm_rerank: use LLM for reranking BM25 candidates
        max_nodes: max nodes to process
    """
    all_chunks = []
    llm_calls = 0

    # Collect nodes from search results
    nodes_to_process = []
    for doc_result in search_result.documents:
        doc_id = doc_result.get("doc_id", "")
        doc_name = doc_result.get("doc_name", "")
        for node in doc_result.get("nodes", []):
            text = node.get("text", "")
            if text and count_tokens(text) > chunk_size:
                nodes_to_process.append({
                    "doc_id": doc_id,
                    "doc_name": doc_name,
                    "node_id": node.get("node_id", ""),
                    "title": node.get("title", ""),
                    "text": text,
                    "score": node.get("score", 0),
                    "line_start": node.get("line_start"),
                    "line_end": node.get("line_end"),
                })
            else:
                # Node is small enough to be a chunk itself
                all_chunks.append(Chunk(
                    text=text,
                    node_id=node.get("node_id", ""),
                    doc_id=doc_id,
                    doc_name=doc_name,
                    node_title=node.get("title", ""),
                    chunk_index=0,
                    score=node.get("score", 0),
                    line_start=node.get("line_start"),
                    line_end=node.get("line_end"),
                ))

    # Process large nodes
    nodes_to_process.sort(key=lambda x: -x["score"])
    nodes_to_process = nodes_to_process[:max_nodes]

    for node_info in nodes_to_process:
        text = node_info["text"]
        chunks = _split_into_chunks(text, chunk_size, chunk_overlap)
        if not chunks:
            continue

        if use_bm25:
            # BM25 rank within this node
            ranked = _bm25_rank_chunks(query, chunks, top_k=top_k_chunks * 2)
            candidate_chunks = [(idx, chunks[idx]) for idx, _ in ranked if idx < len(chunks)]
        else:
            candidate_chunks = [(i, c) for i, c in enumerate(chunks)]

        if use_llm_rerank and candidate_chunks:
            reranked = await _llm_rerank_chunks(query, candidate_chunks, model, top_k=top_k_chunks)
            llm_calls += 1
            for idx, score in reranked:
                if idx < len(chunks):
                    all_chunks.append(Chunk(
                        text=chunks[idx],
                        node_id=node_info["node_id"],
                        doc_id=node_info["doc_id"],
                        doc_name=node_info["doc_name"],
                        node_title=node_info["title"],
                        chunk_index=idx,
                        score=score,
                        line_start=node_info["line_start"],
                        line_end=node_info["line_end"],
                    ))
        else:
            for idx, bm25_score in (ranked if use_bm25 else [(i, 0.0) for i in range(len(chunks))]):
                if idx < len(chunks):
                    all_chunks.append(Chunk(
                        text=chunks[idx],
                        node_id=node_info["node_id"],
                        doc_id=node_info["doc_id"],
                        doc_name=node_info["doc_name"],
                        node_title=node_info["title"],
                        chunk_index=idx,
                        score=bm25_score if use_bm25 else node_info["score"],
                        line_start=node_info["line_start"],
                        line_end=node_info["line_end"],
                    ))

    # Sort all chunks by score and return top-k
    all_chunks.sort(key=lambda x: -x.score)

    return RefinedSearchResult(
        chunks=all_chunks[:top_k_chunks],
        query=query,
        total_llm_calls=llm_calls,
        original_search_result=search_result,
    )
