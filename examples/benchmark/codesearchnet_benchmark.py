# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: CodeSearchNet benchmark script.

Evaluates TreeSearch on code retrieval using the CodeSearchNet dataset.
Compares FTS5 structure-aware search against embedding-based retrieval.

CodeSearchNet Dataset Overview:
    CodeSearchNet is a large-scale code search benchmark with 6 programming languages.
    Each sample has a natural language query (docstring) paired with code.

    Languages: Python, Java, JavaScript, Go, Ruby, PHP
    Task: Given a natural language query, retrieve the relevant code snippet.

    Data format: Each sample has:
        - func_code_string: the code
        - func_documentation_string: natural language docstring (used as query)
        - func_name: function name
        - language: programming language

Usage:
    # Evaluate on 50 samples
    python examples/benchmark/codesearchnet_benchmark.py --max-samples 50

    # Evaluate specific language
    python examples/benchmark/codesearchnet_benchmark.py --language python --max-samples 100

    # Compare with embedding
    python examples/benchmark/codesearchnet_benchmark.py --with-embedding --max-samples 50
"""
import asyncio
import argparse
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from treesearch import build_index, search
from treesearch.fts import FTS5Index
from treesearch.tree import Document, flatten_tree

from examples.benchmark.metrics import (
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
    ndcg_at_k,
    hit_at_k,
    f1_at_k,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class CodeSample:
    """A single code search sample."""
    query: str = ""  # Natural language query (docstring)
    code: str = ""  # Code snippet
    func_name: str = ""
    language: str = ""
    repo: str = ""
    path: str = ""
    url: str = ""
    idx: int = 0  # Index in the corpus


@dataclass
class CodeCorpus:
    """Code corpus for retrieval."""
    samples: list[CodeSample] = field(default_factory=list)
    language: str = ""


# ---------------------------------------------------------------------------
# Dataset loading
# ---------------------------------------------------------------------------

def load_codesearchnet_from_hf(
    language: str = "python",
    split: str = "test",
    max_samples: int = 100,
    max_corpus: int = 1000,
) -> tuple[list[CodeSample], CodeCorpus]:
    """Load CodeSearchNet from HuggingFace.

    Args:
        language: Programming language (python, java, javascript, go, ruby, php)
        split: Dataset split (train, validation, test)
        max_samples: Max query samples for evaluation
        max_corpus: Max code samples for corpus (retrieval candidates)

    Returns:
        (query_samples, corpus) - queries to evaluate, corpus to search in
    """
    try:
        from datasets import load_dataset as hf_load
    except ImportError:
        raise ImportError("Install datasets: pip install datasets")

    logger.info(f"Loading CodeSearchNet ({language}, {split}) from HuggingFace...")
    ds = hf_load("code_search_net", language, split=split, trust_remote_code=True)

    # Build corpus from all samples
    corpus_samples = []
    for idx, row in enumerate(ds):
        if idx >= max_corpus:
            break

        code = row.get("func_code_string", "") or row.get("whole_func_string", "")
        docstring = row.get("func_documentation_string", "")

        if not code or not docstring:
            continue

        corpus_samples.append(CodeSample(
            query=docstring.strip(),
            code=code.strip(),
            func_name=row.get("func_name", ""),
            language=language,
            repo=row.get("repository_name", ""),
            path=row.get("path", ""),
            url=row.get("url", ""),
            idx=len(corpus_samples),
        ))

    corpus = CodeCorpus(samples=corpus_samples, language=language)

    # Use first max_samples as queries (with known ground truth = their own code)
    query_samples = corpus_samples[:max_samples]

    logger.info(f"Loaded {len(query_samples)} query samples, {len(corpus_samples)} corpus samples")
    return query_samples, corpus


# ---------------------------------------------------------------------------
# Embedding-based retrieval
# ---------------------------------------------------------------------------

class EmbeddingIndex:
    """Simple embedding-based retrieval index."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str = "text-embedding-3-small",
    ):
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError("Install openai: pip install openai")

        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.embeddings: np.ndarray | None = None
        self.samples: list[CodeSample] = []

    def _get_embedding(self, texts: list[str], batch_size: int = 10) -> np.ndarray:
        """Get embeddings for texts in batches."""
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = self.client.embeddings.create(input=batch, model=self.model)
            batch_embeddings = [e.embedding for e in response.data]
            all_embeddings.extend(batch_embeddings)
        return np.array(all_embeddings)

    def index(self, corpus: CodeCorpus) -> float:
        """Index corpus and return indexing time."""
        t0 = time.time()
        self.samples = corpus.samples

        # Embed code snippets (what we search against)
        texts = [s.code for s in corpus.samples]
        logger.info(f"Generating embeddings for {len(texts)} code snippets...")
        self.embeddings = self._get_embedding(texts)

        return time.time() - t0

    def search(self, query: str, top_k: int = 10) -> list[tuple[int, float]]:
        """Search for query, return [(idx, score), ...]."""
        query_emb = self._get_embedding([query])[0]

        # Cosine similarity
        norms = np.linalg.norm(self.embeddings, axis=1) * np.linalg.norm(query_emb)
        scores = np.dot(self.embeddings, query_emb) / (norms + 1e-10)

        top_indices = np.argsort(scores)[::-1][:top_k]
        return [(int(idx), float(scores[idx])) for idx in top_indices]


# ---------------------------------------------------------------------------
# TreeSearch FTS5-based retrieval
# ---------------------------------------------------------------------------

class TreeSearchCodeIndex:
    """TreeSearch FTS5-based code retrieval."""

    def __init__(self):
        self.fts_index: FTS5Index | None = None
        self.documents: list[Document] = []
        self.idx_to_node_id: dict[int, str] = {}  # Map corpus idx to node_id

    async def index(self, corpus: CodeCorpus, output_dir: str) -> float:
        """Index corpus and return indexing time."""
        t0 = time.time()

        # Create temporary code files for indexing
        os.makedirs(output_dir, exist_ok=True)
        code_dir = os.path.join(output_dir, "code_files")
        os.makedirs(code_dir, exist_ok=True)

        # Write each code sample as a file
        ext_map = {
            "python": ".py",
            "java": ".java",
            "javascript": ".js",
            "go": ".go",
            "ruby": ".rb",
            "php": ".php",
        }
        ext = ext_map.get(corpus.language, ".txt")

        code_paths = []
        for sample in corpus.samples:
            # Add docstring as comment for better searchability
            if corpus.language == "python":
                content = f'"""{sample.query}"""\n{sample.code}'
            elif corpus.language in ("java", "javascript", "go"):
                content = f"/* {sample.query} */\n{sample.code}"
            else:
                content = f"# {sample.query}\n{sample.code}"

            safe_name = f"code_{sample.idx}{ext}"
            path = os.path.join(code_dir, safe_name)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            code_paths.append(path)

        # Build TreeSearch index
        logger.info(f"Building TreeSearch index for {len(code_paths)} code files...")
        self.documents = await build_index(
            paths=code_paths,
            output_dir=output_dir,
            if_add_node_summary=False,
            if_add_doc_description=False,
            if_add_node_text=True,
            if_add_node_id=True,
            max_concurrency=10,
            force=True,
        )

        # Build FTS5 index
        self.fts_index = FTS5Index()
        self.fts_index.index_documents(self.documents)

        # Build mapping from corpus idx to node_id
        for doc in self.documents:
            # Extract idx from filename (code_0.py -> 0)
            try:
                basename = os.path.basename(doc.doc_name)
                idx = int(basename.split("_")[1].split(".")[0])
                # Get root node id
                nodes = flatten_tree(doc.structure)
                if nodes:
                    self.idx_to_node_id[idx] = nodes[0].get("node_id", "")
            except (IndexError, ValueError):
                pass

        return time.time() - t0

    def search(self, query: str, top_k: int = 10) -> list[tuple[int, float]]:
        """Search for query, return [(idx, score), ...]."""
        results = self.fts_index.search(query, top_k=top_k * 2)  # Get more, then dedupe by doc

        # Map node_id back to corpus idx
        seen_idx = set()
        output = []
        for r in results:
            doc_id = r.get("doc_id", "")
            # Extract idx from doc_id (code_0.py -> 0)
            try:
                basename = os.path.basename(doc_id)
                idx = int(basename.split("_")[1].split(".")[0])
                if idx not in seen_idx:
                    seen_idx.add(idx)
                    output.append((idx, r.get("fts_score", 0.0)))
                    if len(output) >= top_k:
                        break
            except (IndexError, ValueError):
                pass

        return output


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

def evaluate_retrieval(
    query_samples: list[CodeSample],
    index,
    top_k: int = 10,
    k_values: list[int] = None,
) -> dict:
    """Evaluate retrieval performance.

    For each query, the ground truth is its own code (idx matches).
    """
    if k_values is None:
        k_values = [1, 3, 5, 10]

    all_metrics = {f"precision@{k}": [] for k in k_values}
    all_metrics.update({f"recall@{k}": [] for k in k_values})
    all_metrics["mrr"] = []
    all_metrics.update({f"ndcg@{k}": [] for k in k_values})
    all_metrics.update({f"hit@{k}": [] for k in k_values})
    all_metrics.update({f"f1@{k}": [] for k in k_values})

    query_times = []
    hits = 0
    total = 0

    for sample in query_samples:
        t0 = time.time()
        results = index.search(sample.query, top_k=max(k_values))
        query_time = time.time() - t0
        query_times.append(query_time)

        retrieved_ids = [idx for idx, _ in results]
        relevant_ids = [sample.idx]  # Ground truth is the sample's own idx

        for k in k_values:
            all_metrics[f"precision@{k}"].append(precision_at_k(retrieved_ids, relevant_ids, k))
            all_metrics[f"recall@{k}"].append(recall_at_k(retrieved_ids, relevant_ids, k))
            all_metrics[f"ndcg@{k}"].append(ndcg_at_k(retrieved_ids, relevant_ids, k))
            all_metrics[f"hit@{k}"].append(hit_at_k(retrieved_ids, relevant_ids, k))
            all_metrics[f"f1@{k}"].append(f1_at_k(retrieved_ids, relevant_ids, k))

        all_metrics["mrr"].append(reciprocal_rank(retrieved_ids, relevant_ids))

        if sample.idx in retrieved_ids[:1]:
            hits += 1
        total += 1

        hit_str = "HIT" if sample.idx in retrieved_ids[:1] else "miss"
        logger.info(
            f"[{total}/{len(query_samples)}] MRR={all_metrics['mrr'][-1]:.2f} "
            f"P@1={all_metrics['precision@1'][-1]:.2f} [{hit_str}] {query_time:.3f}s"
        )

    # Aggregate
    avg_metrics = {k: np.mean(v) for k, v in all_metrics.items()}
    avg_metrics["avg_query_time"] = np.mean(query_times)
    avg_metrics["total_queries"] = len(query_samples)
    avg_metrics["hit_rate@1"] = hits / total if total > 0 else 0

    return avg_metrics


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    parser = argparse.ArgumentParser(
        description="CodeSearchNet benchmark: evaluate TreeSearch on code retrieval"
    )
    parser.add_argument(
        "--language", type=str, default="python",
        choices=["python", "java", "javascript", "go", "ruby", "php"],
        help="Programming language (default: python)"
    )
    parser.add_argument(
        "--split", type=str, default="test",
        choices=["train", "validation", "test"],
        help="Dataset split (default: test)"
    )
    parser.add_argument("--max-samples", type=int, default=100, help="Max query samples to evaluate")
    parser.add_argument("--max-corpus", type=int, default=1000, help="Max corpus size")
    parser.add_argument("--top-k", type=int, default=10, help="Top-K results per query")
    parser.add_argument("--output-dir", type=str, default="./benchmark_results/codesearchnet", help="Output directory")
    parser.add_argument("--index-dir", type=str, default="./indexes/codesearchnet", help="Index directory")
    parser.add_argument("--with-embedding", action="store_true", help="Also evaluate embedding-based retrieval")
    args = parser.parse_args()

    # Load dataset
    query_samples, corpus = load_codesearchnet_from_hf(
        language=args.language,
        split=args.split,
        max_samples=args.max_samples,
        max_corpus=args.max_corpus,
    )

    print(f"\n{'='*70}")
    print(f"CodeSearchNet Benchmark: {args.language.upper()}")
    print(f"Queries: {len(query_samples)} | Corpus: {len(corpus.samples)} | Top-K: {args.top_k}")
    print(f"{'='*70}\n")

    results = {}

    # TreeSearch FTS5 evaluation
    print(f"\n{'='*60}")
    print("Strategy: TREESEARCH FTS5")
    print(f"{'='*60}")

    ts_index = TreeSearchCodeIndex()
    ts_index_time = await ts_index.index(corpus, args.index_dir)
    print(f"Index time: {ts_index_time:.2f}s")

    ts_metrics = evaluate_retrieval(query_samples, ts_index, top_k=args.top_k)
    ts_metrics["index_time"] = ts_index_time
    ts_metrics["num_nodes"] = sum(len(flatten_tree(d.structure)) for d in ts_index.documents)
    results["treesearch_fts5"] = ts_metrics

    # Embedding evaluation (optional)
    if args.with_embedding:
        api_key = os.environ.get("TREESEARCH_EMBEDDING_API_KEY", "")
        base_url = os.environ.get("TREESEARCH_EMBEDDING_BASE_URL", "https://api.openai.com/v1")

        if not api_key:
            print("\n⚠️  TREESEARCH_EMBEDDING_API_KEY not set, skipping embedding evaluation")
        else:
            print(f"\n{'='*60}")
            print("Strategy: EMBEDDING (text-embedding-3-small)")
            print(f"{'='*60}")

            emb_index = EmbeddingIndex(api_key=api_key, base_url=base_url)
            emb_index_time = emb_index.index(corpus)
            print(f"Index time: {emb_index_time:.2f}s")

            emb_metrics = evaluate_retrieval(query_samples, emb_index, top_k=args.top_k)
            emb_metrics["index_time"] = emb_index_time
            emb_metrics["num_embeddings"] = len(corpus.samples)
            results["embedding"] = emb_metrics

    # Print comparison
    print(f"\n{'='*70}")
    print("BENCHMARK COMPARISON: CodeSearchNet")
    print(f"{'='*70}")

    metrics_to_show = ["mrr", "precision@1", "precision@5", "recall@5", "hit_rate@1"]

    header = f"{'Metric':<25}"
    for name in results:
        header += f"{name.upper():>20}"
    print(header)
    print("-" * (25 + 20 * len(results)))

    for metric in metrics_to_show:
        row = f"{metric:<25}"
        for name, m in results.items():
            val = m.get(metric, 0)
            row += f"{val:>20.4f}"
        print(row)

    print("-" * (25 + 20 * len(results)))

    # Index stats
    row = f"{'Index time (s)':<25}"
    for name, m in results.items():
        row += f"{m.get('index_time', 0):>20.2f}"
    print(row)

    row = f"{'Avg query time (s)':<25}"
    for name, m in results.items():
        row += f"{m.get('avg_query_time', 0):>20.4f}"
    print(row)

    print(f"{'='*70}\n")

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)

    for name, m in results.items():
        print(f"\n{name.upper()}:")
        print(f"  - MRR: {m.get('mrr', 0):.4f}")
        print(f"  - Hit@1: {m.get('hit_rate@1', 0):.4f}")
        print(f"  - Index time: {m.get('index_time', 0):.2f}s")
        print(f"  - Avg query time: {m.get('avg_query_time', 0):.4f}s")

    if "embedding" in results and "treesearch_fts5" in results:
        emb_mrr = results["embedding"]["mrr"]
        ts_mrr = results["treesearch_fts5"]["mrr"]
        ts_query_time = results["treesearch_fts5"]["avg_query_time"]
        emb_query_time = results["embedding"]["avg_query_time"]

        if emb_mrr > ts_mrr:
            print(f"\n📊 Embedding outperforms TreeSearch FTS5 by {(emb_mrr - ts_mrr) / ts_mrr * 100:.1f}% on MRR")
        else:
            print(f"\n📊 TreeSearch FTS5 outperforms Embedding by {(ts_mrr - emb_mrr) / emb_mrr * 100:.1f}% on MRR")

        speedup = emb_query_time / ts_query_time if ts_query_time > 0 else 0
        print(f"⚡ TreeSearch FTS5 is {speedup:.1f}x faster per query")

    # Save results
    os.makedirs(args.output_dir, exist_ok=True)
    report_path = os.path.join(args.output_dir, f"{args.language}_benchmark_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nReport saved: {report_path}")


if __name__ == "__main__":
    asyncio.run(main())
