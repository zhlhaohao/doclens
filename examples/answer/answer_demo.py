# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Answer generation demo - shows how to build QA on top of TreeSearch retrieval.

This is an example of how to use TreeSearch as a retrieval component and add
answer generation on top. TreeSearch focuses on search; answer generation is
left to downstream applications (like this demo).

Supports three answer modes:
  - extractive: extract answer spans from retrieved text
  - generative: free-form answer based on retrieved context
  - boolean: yes/no judgment

Usage:
    python examples/answer/answer_demo.py
"""
import asyncio
import logging
import os
import sys
from dataclasses import dataclass, field
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from treesearch import search, Document, load_documents, build_index
from treesearch.llm import achat, extract_json, count_tokens

logger = logging.getLogger(__name__)

pwd_path = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(pwd_path), "data", "markdowns")
INDEX_DIR = os.path.join(os.path.dirname(pwd_path), "indexes", "best_first_demo")


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class AnswerResult:
    """Result from answer generation."""
    answer: str = ""
    confidence: float = 0.0
    sources: list[dict] = field(default_factory=list)
    reasoning: str = ""
    search_result: Optional[dict] = None
    llm_calls: int = 0


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------

def _build_context(search_result: dict, max_context_tokens: int = 8000) -> tuple[str, list[dict]]:
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
            remaining = max_context_tokens - total_tokens
            if remaining > 100:
                truncated = text[:remaining * 4]
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
    search_result: dict,
    model: Optional[str] = None,
    max_context_tokens: int = 8000,
    answer_mode: str = "extractive",
) -> AnswerResult:
    """
    Generate an answer from search results.

    Args:
        query: user question
        search_result: dict from treesearch.search()
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
    model: Optional[str] = None,
    strategy: str = "best_first",
    answer_mode: str = "extractive",
    max_context_tokens: int = 8000,
    pre_filter=None,
    **search_kwargs,
) -> AnswerResult:
    """
    End-to-end question answering: search + generate answer.

    Args:
        query: user question
        documents: list of Document objects
        model: LLM model
        strategy: search strategy ('best_first')
        answer_mode: 'extractive' | 'generative' | 'boolean'
        max_context_tokens: max context token budget
        pre_filter: custom PreFilter instance
        **search_kwargs: additional args passed to search()

    Returns:
        AnswerResult
    """
    search_result = await search(
        query=query,
        documents=documents,
        model=model,
        strategy=strategy,
        pre_filter=pre_filter,
        **search_kwargs,
    )

    answer_result = await generate_answer(
        query=query,
        search_result=search_result,
        model=model,
        max_context_tokens=max_context_tokens,
        answer_mode=answer_mode,
    )
    answer_result.llm_calls += 0

    return answer_result


def ask_sync(query: str, documents: list[Document], **kwargs) -> AnswerResult:
    """Synchronous wrapper around :func:`ask`."""
    return asyncio.run(ask(query, documents, **kwargs))


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

async def main():
    """Demo: search + answer generation using TreeSearch."""
    print("Loading indexed documents...")
    documents = load_documents(INDEX_DIR)
    if not documents:
        print(f"No indexes found in {INDEX_DIR}, building...")
        documents = await build_index(
            paths=[f"{DATA_DIR}/*.md"],
            output_dir=INDEX_DIR,
        )

    print(f"Loaded {len(documents)} document(s)")
    for doc in documents:
        print(f"  - {doc.doc_name}")

    queries = [
        "How to configure openclaw plugins?",
        "接听电话的白名单如何设置？",
    ]

    for query in queries:
        print(f"\n{'='*60}")
        print(f"Question: {query}")
        print(f"{'='*60}")

        result = await ask(query=query, documents=documents)

        print(f"\nAnswer: {result.answer}")
        print(f"Confidence: {result.confidence:.2f}")
        if result.reasoning:
            print(f"Reasoning: {result.reasoning}")
        print(f"\nSources ({len(result.sources)}):")
        for src in result.sources:
            print(f"  [{src.get('score', 0):.2f}] {src.get('doc_name', '')} > {src.get('title', '')}")
        print(f"\nLLM calls: {result.llm_calls}")


if __name__ == "__main__":
    asyncio.run(main())
