# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Answer generation module. Generates answers from retrieved tree nodes.

Supports three modes:
  - extractive: extract answer spans from retrieved text
  - generative: free-form answer based on retrieved context
  - boolean: yes/no judgment
"""
import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

from .llm import achat, extract_json, count_tokens, DEFAULT_MODEL
from .search import search, SearchResult
from .tree import Document

logger = logging.getLogger(__name__)


@dataclass
class AnswerResult:
    """Result from answer generation."""
    answer: str = ""
    confidence: float = 0.0
    sources: list[dict] = field(default_factory=list)
    reasoning: str = ""
    search_result: Optional[SearchResult] = None
    llm_calls: int = 0


def _build_context(search_result: SearchResult, max_context_tokens: int = 8000) -> tuple[str, list[dict]]:
    """
    Build context string from search results.

    Assembles retrieved nodes ordered by score, with parent title anchors.
    Truncates to max_context_tokens.

    Returns:
        (context_string, sources_list)
    """
    nodes_with_meta = []
    for doc_result in search_result.documents:
        doc_name = doc_result.get("doc_name", "")
        for node in doc_result.get("nodes", []):
            nodes_with_meta.append({
                "doc_name": doc_name,
                "doc_id": doc_result.get("doc_id", ""),
                "node_id": node.get("node_id", ""),
                "title": node.get("title", ""),
                "score": node.get("score", 0),
                "text": node.get("text", ""),
                "summary": node.get("summary", ""),
                "line_start": node.get("line_start"),
                "line_end": node.get("line_end"),
            })

    # Sort by score descending
    nodes_with_meta.sort(key=lambda x: -x["score"])

    # Build context with token budget
    context_parts = []
    sources = []
    total_tokens = 0

    for node in nodes_with_meta:
        text = node["text"] or node["summary"] or ""
        if not text:
            continue
        section = f"[Document: {node['doc_name']}] [Section: {node['title']}]\n{text}\n"
        section_tokens = count_tokens(section)
        if total_tokens + section_tokens > max_context_tokens:
            # Try truncating this section
            remaining = max_context_tokens - total_tokens
            if remaining > 100:
                truncated = text[:remaining * 4]  # rough char estimate
                section = f"[Document: {node['doc_name']}] [Section: {node['title']}]\n{truncated}\n"
                context_parts.append(section)
                sources.append({
                    "doc_name": node["doc_name"],
                    "doc_id": node["doc_id"],
                    "node_id": node["node_id"],
                    "title": node["title"],
                    "score": node["score"],
                    "line_start": node["line_start"],
                    "line_end": node["line_end"],
                })
            break
        context_parts.append(section)
        sources.append({
            "doc_name": node["doc_name"],
            "doc_id": node["doc_id"],
            "node_id": node["node_id"],
            "title": node["title"],
            "score": node["score"],
            "line_start": node["line_start"],
            "line_end": node["line_end"],
        })
        total_tokens += section_tokens

    return "\n".join(context_parts), sources


def _answer_prompt(query: str, context: str, answer_mode: str) -> str:
    """Build the answer generation prompt."""
    mode_instructions = {
        "extractive": (
            "Answer the question by extracting relevant spans from the provided context. "
            "Quote directly from the text when possible. If the answer is not in the context, say so."
        ),
        "generative": (
            "Answer the question based on the provided context. "
            "Synthesize information from multiple sections if needed. "
            "If the context does not contain enough information, say so."
        ),
        "boolean": (
            "Based on the provided context, answer the question with 'yes' or 'no'. "
            "Provide brief reasoning for your answer."
        ),
    }

    instruction = mode_instructions.get(answer_mode, mode_instructions["generative"])

    return (
        f"{instruction}\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {query}\n\n"
        f"Return JSON only:\n"
        f'{{"answer": "<your answer>", "confidence": <float 0.0-1.0>, "reasoning": "<brief reasoning>"}}'
    )


async def generate_answer(
    query: str,
    search_result: SearchResult,
    model: str = DEFAULT_MODEL,
    max_context_tokens: int = 8000,
    answer_mode: str = "extractive",
) -> AnswerResult:
    """
    Generate an answer from search results.

    Args:
        query: user question
        search_result: SearchResult from search()
        model: LLM model name
        max_context_tokens: max context token budget
        answer_mode: 'extractive' | 'generative' | 'boolean'

    Returns:
        AnswerResult with answer, confidence, sources, reasoning
    """
    context, sources = _build_context(search_result, max_context_tokens)

    if not context.strip():
        return AnswerResult(
            answer="No relevant information found in the documents.",
            confidence=0.0,
            sources=[],
            search_result=search_result,
            llm_calls=0,
        )

    prompt = _answer_prompt(query, context, answer_mode)
    response = await achat(prompt, model=model, temperature=0)
    result = extract_json(response)

    return AnswerResult(
        answer=result.get("answer", response),
        confidence=float(result.get("confidence", 0.0)),
        sources=sources,
        reasoning=result.get("reasoning", ""),
        search_result=search_result,
        llm_calls=1,
    )


async def ask(
    query: str,
    documents: list[Document],
    model: str = DEFAULT_MODEL,
    strategy: str = "best_first",
    answer_mode: str = "extractive",
    max_context_tokens: int = 8000,
    decompose: bool = False,
    use_embedding: bool = False,
    pre_filter=None,
    **search_kwargs,
) -> AnswerResult:
    """
    End-to-end question answering: search + generate answer.

    Args:
        query: user question
        documents: list of Document objects
        model: LLM model
        strategy: search strategy ('best_first', 'mcts', 'llm')
        answer_mode: 'extractive' | 'generative' | 'boolean'
        max_context_tokens: max context token budget
        decompose: enable query decomposition for multi-hop questions
        use_embedding: use embedding pre-filter (requires embeddings module)
        pre_filter: custom PreFilter instance
        **search_kwargs: additional args passed to search()

    Returns:
        AnswerResult
    """
    # Optional embedding pre-filter
    if use_embedding and pre_filter is None:
        try:
            from .embeddings import EmbeddingPreFilter
            pre_filter = EmbeddingPreFilter(documents, model=model)
        except ImportError:
            logger.warning("Embedding support not available, falling back to BM25")

    # Optional query decomposition
    if decompose:
        try:
            from .query_decompose import decompose_and_search
            search_result = await decompose_and_search(
                query=query,
                documents=documents,
                model=model,
                strategy=strategy,
                pre_filter=pre_filter,
                **search_kwargs,
            )
        except ImportError:
            logger.warning("Query decomposition not available, using direct search")
            search_result = await search(
                query=query,
                documents=documents,
                model=model,
                strategy=strategy,
                pre_filter=pre_filter,
                **search_kwargs,
            )
    else:
        search_result = await search(
            query=query,
            documents=documents,
            model=model,
            strategy=strategy,
            pre_filter=pre_filter,
            **search_kwargs,
        )

    # Generate answer
    answer_result = await generate_answer(
        query=query,
        search_result=search_result,
        model=model,
        max_context_tokens=max_context_tokens,
        answer_mode=answer_mode,
    )
    answer_result.llm_calls += search_result.total_llm_calls

    return answer_result


def ask_sync(query: str, documents: list[Document], **kwargs) -> AnswerResult:
    """Synchronous wrapper around :func:`ask`."""
    return asyncio.run(ask(query, documents, **kwargs))
