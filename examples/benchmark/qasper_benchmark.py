# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: QASPER benchmark script.

Loads the QASPER dataset from HuggingFace (allenai/qasper), builds tree indexes
from academic papers, and evaluates BM25 / BestFirst / MCTS / Embedding / Hybrid
retrieval strategies.

QASPER Dataset Overview:
    QASPER (Question Answering on Scientific Papers) contains ~1600 NLP papers with
    information-seeking questions written by NLP practitioners.

    Data splits:
        Train: 888 papers, 2593 questions, 2675 answers
        Valid: 281 papers, 1005 questions, 1764 answers

    Each paper has: id, title, abstract, full_text (section_name + paragraphs), qas.
    QAS fields: question, answers (with free_form_answer, extractive_spans, evidence,
    highlighted_evidence, yes_no, unanswerable), question_id, question_writer,
    nlp_background, topic_background, paper_read, search_query.

    Answer types:
        - extractive_spans: spans in the paper serving as the answer
        - free_form_answer: written out answer
        - yes_no: True for Yes, False for No
        - unanswerable: True if question cannot be answered from the paper
    Evidence is paragraph-level text; highlighted_evidence is sentence-level.

Usage:
    # Evaluate on 20 samples with BM25, BestFirst, MCTS, Embedding, Hybrid:
    python examples/benchmark/qasper_benchmark.py --max-samples 20

    # Evaluate with specific strategies:
    python examples/benchmark/qasper_benchmark.py --strategies bm25 embedding hybrid --max-samples 50

    # Evaluate with a different embedding model:
    python examples/benchmark/qasper_benchmark.py --embedding-model text-embedding-3-large --max-samples 10
"""
import asyncio
import argparse
import logging
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from treesearch import build_index, load_documents, search
from treesearch.tree import Document, assign_node_ids, flatten_tree
from treesearch.rank_bm25 import NodeBM25Index

from examples.benchmark.benchmark import (
    BenchmarkSample,
    load_qasper_from_hf,
    run_benchmark_with_samples,
    print_report,
    print_comparison,
)

logger = logging.getLogger(__name__)


def paper_to_markdown(paper: dict) -> str:
    """Convert a QASPER paper dict to Markdown text for indexing.

    Constructs Markdown with section headings (##) from full_text.section_name
    and paragraph content from full_text.paragraphs.
    """
    parts = []
    title = paper.get("title", "Untitled")
    abstract = paper.get("abstract", "")

    parts.append(f"# {title}\n")
    if abstract:
        parts.append(f"## Abstract\n\n{abstract}\n")

    full_text = paper.get("full_text", {})
    section_names = full_text.get("section_name", [])
    paragraphs = full_text.get("paragraphs", [])

    for i, section_name in enumerate(section_names):
        if not section_name:
            section_name = f"Section {i + 1}"
        parts.append(f"## {section_name}\n")
        if i < len(paragraphs):
            for para in paragraphs[i]:
                if para and para.strip():
                    parts.append(f"{para.strip()}\n")
        parts.append("")

    return "\n".join(parts)


async def build_paper_indexes(
    papers: list[dict],
    output_dir: str,
    model: str = "gpt-4o-mini",
    max_concurrency: int = 5,
    force: bool = False,
) -> list[Document]:
    """Build tree indexes for QASPER papers.

    Converts each paper to Markdown, writes temp files, then runs build_index.
    Returns list of Document objects.
    """
    os.makedirs(output_dir, exist_ok=True)
    md_dir = os.path.join(output_dir, "md_papers")
    os.makedirs(md_dir, exist_ok=True)

    md_paths = []
    for paper in papers:
        paper_id = paper.get("id", "unknown")
        safe_id = paper_id.replace("/", "_").replace("\\", "_")
        md_path = os.path.join(md_dir, f"{safe_id}.md")
        md_content = paper_to_markdown(paper)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        md_paths.append(md_path)

    logger.info("Building indexes for %d papers...", len(md_paths))
    documents = await build_index(
        paths=md_paths,
        output_dir=output_dir,
        model=model,
        if_add_node_summary=True,
        if_add_doc_description=False,
        if_add_node_text=True,
        if_add_node_id=True,
        max_concurrency=max_concurrency,
        force=force,
    )

    # Patch doc_id to paper_id for ground truth matching
    for doc, paper in zip(documents, papers):
        doc.doc_id = paper.get("id", doc.doc_id)

    return documents


async def main():
    parser = argparse.ArgumentParser(
        description="QASPER benchmark: evaluate BM25/BestFirst/MCTS on academic paper QA"
    )
    parser.add_argument(
        "--split", type=str, default="validation", choices=["train", "validation"],
        help="QASPER dataset split (default: validation)"
    )
    parser.add_argument(
        "--strategies", type=str, nargs="+",
        default=["bm25", "best_first", "mcts", "embedding", "hybrid"],
        help="Search strategies to evaluate (default: bm25 best_first mcts embedding hybrid)"
    )
    parser.add_argument("--model", type=str, default="gpt-4o-mini", help="LLM model name")
    parser.add_argument("--embedding-model", type=str, default="text-embedding-3-small",
                        help="Embedding model for embedding/hybrid strategies")
    parser.add_argument("--max-samples", type=int, default=50, help="Max QA samples to evaluate")
    parser.add_argument("--max-papers", type=int, default=20, help="Max papers to index")
    parser.add_argument("--top-k", type=int, default=5, help="Top-K results per query")
    parser.add_argument("--output-dir", type=str, default="./benchmark_results/qasper", help="Output directory")
    parser.add_argument("--index-dir", type=str, default="./indexes/qasper", help="Index directory")
    parser.add_argument("--concurrency", type=int, default=3, help="Max concurrent evaluations")
    parser.add_argument("--force-reindex", action="store_true", help="Force re-indexing papers")
    args = parser.parse_args()

    print(f"Loading QASPER dataset from HuggingFace ({args.split} split)...")
    samples, papers = load_qasper_from_hf(split=args.split, max_samples=args.max_samples)

    # Limit papers to index
    if len(papers) > args.max_papers:
        # Keep only papers that have questions in our samples
        paper_ids_with_samples = {s.doc_id for s in samples}
        papers = [p for p in papers if p["id"] in paper_ids_with_samples][:args.max_papers]
        # Filter samples to only include papers we're indexing
        indexed_ids = {p["id"] for p in papers}
        samples = [s for s in samples if s.doc_id in indexed_ids]

    print(f"Dataset loaded: {len(samples)} QA samples from {len(papers)} papers")
    print(f"Strategies: {args.strategies}")
    print(f"Model: {args.model}")

    # Build indexes
    t0 = time.time()
    print(f"\nBuilding tree indexes for {len(papers)} papers...")
    documents = await build_paper_indexes(
        papers=papers,
        output_dir=args.index_dir,
        model=args.model,
        max_concurrency=args.concurrency,
        force=args.force_reindex,
    )
    index_time = time.time() - t0
    print(f"Indexing completed in {index_time:.1f}s ({len(documents)} documents)\n")

    # Run benchmark
    reports = await run_benchmark_with_samples(
        samples=samples,
        documents=documents,
        dataset_name="qasper",
        strategies=args.strategies,
        model=args.model,
        top_k=args.top_k,
        max_concurrency=args.concurrency,
        output_dir=args.output_dir,
        embedding_model=args.embedding_model,
    )

    # Print results
    for report in reports:
        print_report(report)

    if len(reports) > 1:
        print_comparison(reports)

    print(f"\nTotal indexing time: {index_time:.1f}s")
    print(f"Results saved to: {args.output_dir}")


if __name__ == "__main__":
    asyncio.run(main())
