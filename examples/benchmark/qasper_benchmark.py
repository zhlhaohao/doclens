# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: QASPER benchmark script with optional embedding comparison.

Loads the QASPER dataset from HuggingFace (allenai/qasper), builds tree indexes
from academic papers, and evaluates BM25 / FTS5 / BestFirst / Embedding retrieval strategies.

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

Environment variables for embedding comparison:
    TREESEARCH_EMBEDDING_API_KEY - API key for OpenAI embedding model
    TREESEARCH_EMBEDDING_BASE_URL - Base URL for embedding API (default: https://api.openai.com/v1)

Usage:
    # Evaluate on 20 samples with BM25, FTS5, BestFirst:
    python examples/benchmark/qasper_benchmark.py --max-samples 20

    # Evaluate with specific strategies:
    python examples/benchmark/qasper_benchmark.py --strategies bm25 fts5 best_first --max-samples 50

    # Compare with embedding retrieval:
    python examples/benchmark/qasper_benchmark.py --max-samples 50 --max-papers 20 --with-embedding
"""
import asyncio
import argparse
import logging
import os
import sys
import time
import json
import numpy as np
from dataclasses import dataclass, field
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from treesearch import build_index, search
from treesearch.tree import Document, flatten_tree

from examples.benchmark.benchmark import (
    BenchmarkSample,
    load_qasper_from_hf,
    run_benchmark_with_samples,
    print_report,
    print_comparison,
    resolve_relevant_nodes,
)
from examples.benchmark.metrics import (
    CostStats, CostTracker, aggregate_cost_stats,
    evaluate_query,
)

logger = logging.getLogger(__name__)

# Environment variable names for embedding API
_ENV_EMBEDDING_API_KEY = "TREESEARCH_EMBEDDING_API_KEY"
_ENV_EMBEDDING_BASE_URL = "TREESEARCH_EMBEDDING_BASE_URL"
_DEFAULT_EMBEDDING_BASE_URL = "https://api.openai.com/v1"


# ---------------------------------------------------------------------------
# Embedding client
# ---------------------------------------------------------------------------

class EmbeddingClient:
    """Simple OpenAI-compatible embedding client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: str = "text-embedding-3-small",
    ):
        self.api_key = api_key or os.getenv(_ENV_EMBEDDING_API_KEY)
        self.base_url = base_url or os.getenv(_ENV_EMBEDDING_BASE_URL, _DEFAULT_EMBEDDING_BASE_URL)
        self.model = model

        if not self.api_key:
            raise ValueError(
                f"Embedding API key not set. Please set {_ENV_EMBEDDING_API_KEY} environment variable."
            )

        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError("Install openai: pip install openai")

        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of texts."""
        if not texts:
            return []

        batch_size = 10
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch = [t if t.strip() else " " for t in batch]

            response = self.client.embeddings.create(
                model=self.model,
                input=batch,
            )
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)

        return all_embeddings

    def embed_single(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        return self.embed([text])[0]


# ---------------------------------------------------------------------------
# Chunk-based document representation
# ---------------------------------------------------------------------------

@dataclass
class Chunk:
    """A chunk of text from a document."""
    chunk_id: str
    doc_id: str
    text: str
    embedding: Optional[list[float]] = None
    metadata: dict = field(default_factory=dict)


def chunk_document_by_paragraph(
    paper: dict,
    max_chunk_size: int = 512,
) -> list[Chunk]:
    """Split a QASPER paper into paragraph-based chunks."""
    chunks = []
    paper_id = paper.get("id", "unknown")
    title = paper.get("title", "Untitled")
    abstract = paper.get("abstract", "")

    chunk_idx = 0

    if abstract:
        chunks.append(Chunk(
            chunk_id=f"{paper_id}_chunk_{chunk_idx}",
            doc_id=paper_id,
            text=f"{title}\n\n{abstract}",
            metadata={"section": "Abstract"},
        ))
        chunk_idx += 1

    full_text = paper.get("full_text", {})
    section_names = full_text.get("section_name", [])
    paragraphs = full_text.get("paragraphs", [])

    for i, section_name in enumerate(section_names):
        if i < len(paragraphs):
            for para in paragraphs[i]:
                if para and para.strip():
                    text = para.strip()
                    if len(text) > max_chunk_size * 4:
                        words = text.split()
                        current_chunk = []
                        current_len = 0
                        for word in words:
                            current_chunk.append(word)
                            current_len += len(word) + 1
                            if current_len > max_chunk_size * 3:
                                chunk_text = " ".join(current_chunk)
                                chunks.append(Chunk(
                                    chunk_id=f"{paper_id}_chunk_{chunk_idx}",
                                    doc_id=paper_id,
                                    text=f"[{section_name}] {chunk_text}",
                                    metadata={"section": section_name},
                                ))
                                chunk_idx += 1
                                current_chunk = []
                                current_len = 0
                        if current_chunk:
                            chunk_text = " ".join(current_chunk)
                            chunks.append(Chunk(
                                chunk_id=f"{paper_id}_chunk_{chunk_idx}",
                                doc_id=paper_id,
                                text=f"[{section_name}] {chunk_text}",
                                metadata={"section": section_name},
                            ))
                            chunk_idx += 1
                    else:
                        chunks.append(Chunk(
                            chunk_id=f"{paper_id}_chunk_{chunk_idx}",
                            doc_id=paper_id,
                            text=f"[{section_name}] {text}",
                            metadata={"section": section_name},
                        ))
                        chunk_idx += 1

    return chunks


# ---------------------------------------------------------------------------
# Embedding-based retrieval index
# ---------------------------------------------------------------------------

class EmbeddingIndex:
    """Simple in-memory embedding index with cosine similarity search."""

    def __init__(self, embedding_client: EmbeddingClient):
        self.client = embedding_client
        self.chunks: list[Chunk] = []
        self.embeddings: Optional[np.ndarray] = None

    def index_chunks(self, chunks: list[Chunk]) -> None:
        """Build embedding index for chunks."""
        self.chunks = chunks
        texts = [c.text for c in chunks]

        logger.info("Generating embeddings for %d chunks...", len(chunks))
        embeddings = self.client.embed(texts)

        self.embeddings = np.array(embeddings, dtype=np.float32)
        norms = np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        self.embeddings = self.embeddings / (norms + 1e-9)

        logger.info("Embedding index built: %d chunks, dim=%d",
                    len(chunks), self.embeddings.shape[1])

    def search(
        self,
        query: str,
        top_k: int = 10,
        doc_id: Optional[str] = None,
    ) -> list[dict]:
        """Search for top-k similar chunks to query."""
        if self.embeddings is None or len(self.chunks) == 0:
            return []

        query_embedding = np.array(self.client.embed_single(query), dtype=np.float32)
        query_embedding = query_embedding / (np.linalg.norm(query_embedding) + 1e-9)

        similarities = self.embeddings @ query_embedding

        if doc_id:
            mask = np.array([c.doc_id == doc_id or doc_id in c.doc_id for c in self.chunks])
            similarities = np.where(mask, similarities, -np.inf)

        top_indices = np.argsort(similarities)[-top_k:][::-1]

        results = []
        for idx in top_indices:
            if similarities[idx] > -np.inf:
                chunk = self.chunks[idx]
                results.append({
                    "chunk_id": chunk.chunk_id,
                    "doc_id": chunk.doc_id,
                    "text": chunk.text,
                    "score": float(similarities[idx]),
                    "section": chunk.metadata.get("section", ""),
                })

        return results


# ---------------------------------------------------------------------------
# Ground truth matching for chunks
# ---------------------------------------------------------------------------

def resolve_relevant_chunks(
    sample: BenchmarkSample,
    chunks: list[Chunk],
) -> list[str]:
    """Map sample's evidence to chunk_ids that contain the evidence text."""
    relevant_ids = []

    target_chunks = chunks
    if sample.doc_id:
        target_chunks = [c for c in chunks if sample.doc_id in c.doc_id or c.doc_id == sample.doc_id]

    for chunk in target_chunks:
        chunk_text_lower = chunk.text.lower()

        for evidence in sample.evidence_texts:
            if evidence and evidence.lower() in chunk_text_lower:
                relevant_ids.append(chunk.chunk_id)
                break

    return list(dict.fromkeys(relevant_ids))


# ---------------------------------------------------------------------------
# Benchmark report for embedding
# ---------------------------------------------------------------------------

@dataclass
class EmbeddingBenchmarkReport:
    """Benchmark report for embedding-based retrieval."""
    dataset: str = ""
    strategy: str = ""
    model: str = ""
    num_samples: int = 0
    avg_retrieval_metrics: dict = field(default_factory=dict)
    avg_cost: CostStats = field(default_factory=CostStats)
    total_cost: CostStats = field(default_factory=CostStats)
    embedding_time: float = 0.0
    num_chunks: int = 0

    def to_dict(self) -> dict:
        return {
            "dataset": self.dataset,
            "strategy": self.strategy,
            "model": self.model,
            "num_samples": self.num_samples,
            "avg_retrieval_metrics": self.avg_retrieval_metrics,
            "avg_cost": self.avg_cost.to_dict(),
            "total_cost": self.total_cost.to_dict(),
            "embedding_time": self.embedding_time,
            "num_chunks": self.num_chunks,
        }


# ---------------------------------------------------------------------------
# Paper processing utilities
# ---------------------------------------------------------------------------

def paper_to_markdown(paper: dict) -> str:
    """Convert a QASPER paper dict to Markdown text for indexing."""
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
    model: str = None,
    max_concurrency: int = 5,
    force: bool = False,
) -> list[Document]:
    """Build tree indexes for QASPER papers."""
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

    for doc, paper in zip(documents, papers):
        doc.doc_id = paper.get("id", doc.doc_id)

    return documents


# ---------------------------------------------------------------------------
# Embedding comparison evaluation
# ---------------------------------------------------------------------------

async def run_embedding_comparison(
    samples: list[BenchmarkSample],
    papers: list[dict],
    documents: list[Document],
    embedding_model: str,
    top_k: int,
    output_dir: str,
    treesearch_index_time: float,
) -> tuple[EmbeddingBenchmarkReport, EmbeddingBenchmarkReport]:
    """Run embedding vs TreeSearch FTS5 comparison."""
    k_values = [1, 3, 5]

    # Build embedding index
    print(f"\n{'='*60}")
    print("Building EMBEDDING index (traditional RAG approach)...")
    print(f"{'='*60}")

    t0 = time.time()
    all_chunks = []
    for paper in papers:
        chunks = chunk_document_by_paragraph(paper)
        all_chunks.extend(chunks)

    print(f"Created {len(all_chunks)} chunks from {len(papers)} papers")

    embedding_client = EmbeddingClient(model=embedding_model)
    embedding_index = EmbeddingIndex(embedding_client)
    embedding_index.index_chunks(all_chunks)

    embedding_time = time.time() - t0
    print(f"Embedding index built in {embedding_time:.1f}s")

    # Build FTS5 index
    from treesearch.fts import FTS5Index
    fts_index = FTS5Index()
    fts_index.index_documents(documents)

    # Evaluate embedding retrieval
    print(f"\n{'='*60}")
    print(f"Strategy: EMBEDDING | Samples: {len(samples)}")
    print(f"{'='*60}")

    embedding_results = []
    for i, sample in enumerate(samples):
        tracker = CostTracker()
        with tracker:
            results = embedding_index.search(
                sample.question,
                top_k=top_k,
                doc_id=sample.doc_id,
            )
            retrieved_chunk_ids = [r["chunk_id"] for r in results]

        relevant_chunk_ids = resolve_relevant_chunks(sample, all_chunks)
        metrics = evaluate_query(retrieved_chunk_ids, relevant_chunk_ids, k_values) if relevant_chunk_ids else {}

        if metrics:
            hit = "HIT" if metrics.get("hit@1", 0) > 0 else "miss"
            print(f"  [{i+1}/{len(samples)}] MRR={metrics.get('mrr', 0):.2f} "
                  f"P@3={metrics.get('precision@3', 0):.2f} R@3={metrics.get('recall@3', 0):.2f} "
                  f"[{hit}] {tracker.stats.latency_seconds:.2f}s")
        else:
            print(f"  [{i+1}/{len(samples)}] Skipped (no ground truth)")

        embedding_results.append({
            "metrics": metrics,
            "cost": tracker.stats,
        })

    # Aggregate embedding results
    valid_emb = [r for r in embedding_results if r["metrics"]]
    if valid_emb:
        avg_emb_metrics = {}
        for key in valid_emb[0]["metrics"]:
            avg_emb_metrics[key] = sum(r["metrics"].get(key, 0) for r in valid_emb) / len(valid_emb)
        cost_list = [r["cost"] for r in valid_emb]
        avg_emb_cost = aggregate_cost_stats(cost_list)
        total_emb_cost = CostStats(
            total_tokens=sum(c.total_tokens for c in cost_list),
            llm_calls=sum(c.llm_calls for c in cost_list),
            latency_seconds=sum(c.latency_seconds for c in cost_list),
        )
    else:
        avg_emb_metrics = {}
        avg_emb_cost = CostStats()
        total_emb_cost = CostStats()

    emb_report = EmbeddingBenchmarkReport(
        dataset="qasper",
        strategy="embedding",
        model=embedding_model,
        num_samples=len(valid_emb),
        avg_retrieval_metrics=avg_emb_metrics,
        avg_cost=avg_emb_cost,
        total_cost=total_emb_cost,
        embedding_time=embedding_time,
        num_chunks=len(all_chunks),
    )

    # Evaluate FTS5 retrieval
    print(f"\n{'='*60}")
    print(f"Strategy: FTS5 (TreeSearch) | Samples: {len(samples)}")
    print(f"{'='*60}")

    fts_results = []
    for i, sample in enumerate(samples):
        tracker = CostTracker()
        with tracker:
            all_scored: list[tuple[str, float]] = []
            target_docs = documents
            if sample.doc_id:
                matched = [d for d in documents if sample.doc_id in d.doc_id or sample.doc_id in d.doc_name]
                if matched:
                    target_docs = matched
            for doc in target_docs:
                node_scores = fts_index.score_nodes(sample.question, doc.doc_id)
                all_scored.extend(node_scores.items())
            all_scored.sort(key=lambda x: -x[1])
            retrieved_node_ids = [nid for nid, _ in all_scored[:top_k]]

        relevant_node_ids = resolve_relevant_nodes(sample, documents)
        metrics = evaluate_query(retrieved_node_ids, relevant_node_ids, k_values) if relevant_node_ids else {}

        if metrics:
            hit = "HIT" if metrics.get("hit@1", 0) > 0 else "miss"
            print(f"  [{i+1}/{len(samples)}] MRR={metrics.get('mrr', 0):.2f} "
                  f"P@3={metrics.get('precision@3', 0):.2f} R@3={metrics.get('recall@3', 0):.2f} "
                  f"[{hit}] {tracker.stats.latency_seconds:.3f}s")
        else:
            print(f"  [{i+1}/{len(samples)}] Skipped (no ground truth)")

        fts_results.append({
            "metrics": metrics,
            "cost": tracker.stats,
        })

    # Aggregate FTS5 results
    valid_fts = [r for r in fts_results if r["metrics"]]
    if valid_fts:
        avg_fts_metrics = {}
        for key in valid_fts[0]["metrics"]:
            avg_fts_metrics[key] = sum(r["metrics"].get(key, 0) for r in valid_fts) / len(valid_fts)
        cost_list = [r["cost"] for r in valid_fts]
        avg_fts_cost = aggregate_cost_stats(cost_list)
        total_fts_cost = CostStats(
            total_tokens=sum(c.total_tokens for c in cost_list),
            llm_calls=sum(c.llm_calls for c in cost_list),
            latency_seconds=sum(c.latency_seconds for c in cost_list),
        )
    else:
        avg_fts_metrics = {}
        avg_fts_cost = CostStats()
        total_fts_cost = CostStats()

    fts_report = EmbeddingBenchmarkReport(
        dataset="qasper",
        strategy="fts5",
        model="N/A",
        num_samples=len(valid_fts),
        avg_retrieval_metrics=avg_fts_metrics,
        avg_cost=avg_fts_cost,
        total_cost=total_fts_cost,
        embedding_time=treesearch_index_time,
        num_chunks=sum(len(flatten_tree(d.structure)) for d in documents),
    )

    # Print comparison
    print(f"\n{'='*80}")
    print("BENCHMARK COMPARISON: Embedding vs TreeSearch")
    print(f"{'='*80}")

    metrics_to_show = ["mrr", "precision@1", "precision@3", "precision@5",
                       "recall@1", "recall@3", "recall@5", "ndcg@3", "hit@1", "f1@3"]

    header = f"{'Metric':<22}{'EMBEDDING':>18}{'FTS5':>18}"
    print(header)
    print("-" * 58)

    for metric in metrics_to_show:
        row = f"{metric:<22}"
        row += f"{emb_report.avg_retrieval_metrics.get(metric, 0):>18.4f}"
        row += f"{fts_report.avg_retrieval_metrics.get(metric, 0):>18.4f}"
        print(row)

    print("-" * 58)
    print(f"{'Index time (s)':<22}{emb_report.embedding_time:>18.1f}{fts_report.embedding_time:>18.1f}")
    print(f"{'Num chunks/nodes':<22}{emb_report.num_chunks:>18}{fts_report.num_chunks:>18}")
    print(f"{'Avg query time (s)':<22}{emb_report.avg_cost.latency_seconds:>18.4f}{fts_report.avg_cost.latency_seconds:>18.4f}")
    print(f"{'='*80}\n")

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)

    emb_mrr = emb_report.avg_retrieval_metrics.get("mrr", 0)
    fts_mrr = fts_report.avg_retrieval_metrics.get("mrr", 0)

    print(f"\nEmbedding ({embedding_model}):")
    print(f"  - MRR: {emb_mrr:.4f}")
    print(f"  - Index time: {emb_report.embedding_time:.1f}s ({emb_report.num_chunks} chunks)")
    print(f"  - Avg query time: {emb_report.avg_cost.latency_seconds:.4f}s")

    print(f"\nTreeSearch (FTS5):")
    print(f"  - MRR: {fts_mrr:.4f}")
    print(f"  - Index time: {fts_report.embedding_time:.1f}s ({fts_report.num_chunks} nodes)")
    print(f"  - Avg query time: {fts_report.avg_cost.latency_seconds:.4f}s")

    if fts_mrr > emb_mrr:
        improvement = ((fts_mrr - emb_mrr) / emb_mrr * 100) if emb_mrr > 0 else 0
        print(f"\n✅ TreeSearch FTS5 outperforms Embedding by {improvement:.1f}% on MRR")
    else:
        improvement = ((emb_mrr - fts_mrr) / fts_mrr * 100) if fts_mrr > 0 else 0
        print(f"\n📊 Embedding outperforms TreeSearch FTS5 by {improvement:.1f}% on MRR")

    speed_ratio = emb_report.avg_cost.latency_seconds / fts_report.avg_cost.latency_seconds if fts_report.avg_cost.latency_seconds > 0 else 0
    print(f"⚡ TreeSearch FTS5 is {speed_ratio:.1f}x faster per query")

    # Save reports
    os.makedirs(output_dir, exist_ok=True)
    for r in [emb_report, fts_report]:
        path = os.path.join(output_dir, f"qasper_{r.strategy}_report.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(r.to_dict(), f, indent=2, ensure_ascii=False)
        print(f"\nReport saved: {path}")

    return emb_report, fts_report


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    parser = argparse.ArgumentParser(
        description="QASPER benchmark: evaluate BM25/FTS5/BestFirst/Embedding on academic paper QA"
    )
    parser.add_argument(
        "--split", type=str, default="validation", choices=["train", "validation"],
        help="QASPER dataset split (default: validation)"
    )
    parser.add_argument(
        "--strategies", type=str, nargs="+",
        default=["bm25", "fts5", "best_first"],
        help="Search strategies to evaluate (default: bm25 fts5 best_first)"
    )
    parser.add_argument("--model", type=str, default=None, help="LLM model name")
    parser.add_argument("--max-samples", type=int, default=50, help="Max QA samples to evaluate")
    parser.add_argument("--max-papers", type=int, default=20, help="Max papers to index")
    parser.add_argument("--top-k", type=int, default=10, help="Top-K results per query")
    parser.add_argument("--output-dir", type=str, default="./benchmark_results/qasper", help="Output directory")
    parser.add_argument("--index-dir", type=str, default="./indexes/qasper", help="Index directory")
    parser.add_argument("--concurrency", type=int, default=3, help="Max concurrent evaluations")
    parser.add_argument("--force-reindex", action="store_true", help="Force re-indexing papers")
    parser.add_argument(
        "--with-embedding", action="store_true",
        help="Also run embedding-based retrieval comparison"
    )
    parser.add_argument(
        "--embedding-model", type=str, default="text-embedding-3-small",
        help="OpenAI embedding model for comparison (default: text-embedding-3-small)"
    )
    args = parser.parse_args()

    print(f"Loading QASPER dataset from HuggingFace ({args.split} split)...")
    samples, papers = load_qasper_from_hf(split=args.split, max_samples=args.max_samples)

    # Limit papers to index
    if len(papers) > args.max_papers:
        paper_ids_with_samples = {s.doc_id for s in samples}
        papers = [p for p in papers if p["id"] in paper_ids_with_samples][:args.max_papers]
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

    # Run embedding comparison if requested
    if args.with_embedding:
        api_key = os.getenv(_ENV_EMBEDDING_API_KEY)
        if not api_key:
            print(f"Warning: {_ENV_EMBEDDING_API_KEY} not set, skipping embedding comparison.")
            print(f"Please set it with: export {_ENV_EMBEDDING_API_KEY}=sk-...")
        else:
            await run_embedding_comparison(
                samples=samples,
                papers=papers,
                documents=documents,
                embedding_model=args.embedding_model,
                top_k=args.top_k,
                output_dir=args.output_dir,
                treesearch_index_time=index_time,
            )
            return

    # Run standard benchmark
    reports = await run_benchmark_with_samples(
        samples=samples,
        documents=documents,
        dataset_name="qasper",
        strategies=args.strategies,
        model=args.model,
        top_k=args.top_k,
        max_concurrency=args.concurrency,
        output_dir=args.output_dir,
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
