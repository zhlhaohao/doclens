# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Query decomposition for multi-hop questions.

Breaks complex questions into sub-questions, searches iteratively,
and accumulates context across hops. No knowledge graph needed.
"""
import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

from .llm import achat, extract_json, DEFAULT_MODEL
from .search import search, SearchResult, PreFilter
from .tree import Document

logger = logging.getLogger(__name__)


@dataclass
class DecomposeResult:
    """Result from query decomposition analysis."""
    needs_decomposition: bool = False
    sub_questions: list[str] = field(default_factory=list)
    reasoning: str = ""


async def analyze_query(
    query: str,
    model: str = DEFAULT_MODEL,
) -> DecomposeResult:
    """
    Analyze whether a query needs decomposition into sub-questions.

    Returns:
        DecomposeResult with sub_questions if decomposition needed
    """
    prompt = (
        "Given a question, determine if it requires multiple steps to answer "
        "(multi-hop reasoning). If yes, break it into simple sub-questions.\n\n"
        "Rules:\n"
        "- Each sub-question should be self-contained and answerable from a single document section\n"
        "- Later sub-questions can reference findings from earlier ones\n"
        "- Simple factual questions do NOT need decomposition\n\n"
        f"Question: {query}\n\n"
        "Return JSON only:\n"
        '{"needs_decomposition": true/false, '
        '"sub_questions": ["q1", "q2", ...], '
        '"reasoning": "brief explanation"}'
    )

    response = await achat(prompt, model=model, temperature=0)
    result = extract_json(response)

    return DecomposeResult(
        needs_decomposition=bool(result.get("needs_decomposition", False)),
        sub_questions=result.get("sub_questions", []),
        reasoning=result.get("reasoning", ""),
    )


async def decompose_and_search(
    query: str,
    documents: list[Document],
    model: str = DEFAULT_MODEL,
    max_hops: int = 3,
    strategy: str = "best_first",
    pre_filter: Optional[PreFilter] = None,
    **search_kwargs,
) -> SearchResult:
    """
    Multi-hop search via query decomposition.

    Pipeline:
      1. Analyze if query needs multi-hop decomposition
      2. If not, run direct search()
      3. If yes, decompose into sub-questions
      4. Search each sub-question iteratively, injecting prior findings as context
      5. Merge all results

    Args:
        query: original user question
        documents: list of Document objects
        model: LLM model name
        max_hops: maximum number of sub-question hops
        strategy: search strategy
        pre_filter: optional PreFilter
        **search_kwargs: additional args passed to search()
    """
    # Step 1: analyze query
    decomp = await analyze_query(query, model=model)
    total_llm_calls = 1  # for analysis

    if not decomp.needs_decomposition or not decomp.sub_questions:
        logger.info("No decomposition needed, running direct search")
        result = await search(
            query=query,
            documents=documents,
            model=model,
            strategy=strategy,
            pre_filter=pre_filter,
            **search_kwargs,
        )
        result.total_llm_calls += total_llm_calls
        return result

    # Step 2: iterative search over sub-questions
    sub_questions = decomp.sub_questions[:max_hops]
    logger.info("Decomposed into %d sub-questions: %s", len(sub_questions), sub_questions)

    accumulated_context = []  # findings from previous hops
    all_doc_results = {}  # doc_id -> {doc_id, doc_name, nodes: []}

    for i, sub_q in enumerate(sub_questions):
        # Inject prior findings as expert knowledge
        expert_knowledge = ""
        if accumulated_context:
            expert_knowledge = "Previously found information:\n" + "\n".join(
                f"- {ctx}" for ctx in accumulated_context
            )

        logger.info("Hop %d/%d: %s", i + 1, len(sub_questions), sub_q)

        sub_result = await search(
            query=sub_q,
            documents=documents,
            model=model,
            strategy=strategy,
            pre_filter=pre_filter,
            expert_knowledge=expert_knowledge,
            **search_kwargs,
        )
        total_llm_calls += sub_result.total_llm_calls

        # Merge results and accumulate context
        for doc_result in sub_result.documents:
            doc_id = doc_result.get("doc_id", "")
            if doc_id not in all_doc_results:
                all_doc_results[doc_id] = {
                    "doc_id": doc_id,
                    "doc_name": doc_result.get("doc_name", ""),
                    "nodes": [],
                }

            existing_node_ids = {n.get("node_id") for n in all_doc_results[doc_id]["nodes"]}
            for node in doc_result.get("nodes", []):
                nid = node.get("node_id")
                if nid not in existing_node_ids:
                    all_doc_results[doc_id]["nodes"].append(node)
                    existing_node_ids.add(nid)

                # Accumulate context for next hop
                title = node.get("title", "")
                summary = node.get("summary", "")
                text_preview = (node.get("text", "") or "")[:200]
                if title and (summary or text_preview):
                    accumulated_context.append(
                        f"[{title}] {summary or text_preview}"
                    )

    # Step 3: sort nodes within each doc by score
    merged_docs = []
    for doc_result in all_doc_results.values():
        doc_result["nodes"].sort(key=lambda x: -x.get("score", 0))
        if doc_result["nodes"]:
            merged_docs.append(doc_result)

    return SearchResult(
        documents=merged_docs,
        query=query,
        total_llm_calls=total_llm_calls,
        strategy=f"{strategy}+decompose",
    )
