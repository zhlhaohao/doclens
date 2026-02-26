# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: QA Benchmark evaluation script.

This is an example showing how to run end-to-end QA evaluation (EM/F1) on top of
TreeSearch retrieval. TreeSearch itself focuses on search; this script adds
answer generation for benchmark purposes.

Supports: HotpotQA, QASPER, custom datasets.
Evaluates retrieval (Precision/Recall/NDCG/MRR) and generation (EM/F1) metrics.

Usage:
    python examples/benchmark/qa_benchmark.py --dataset custom --data-path data.jsonl --index_dir ./indexes/
"""
import asyncio
import json
import logging
import os
import re
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Import answer generation from the answer demo
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "answer"))
from answer_demo import ask, AnswerResult

from treesearch import search, SearchResult, Document, load_documents
from treesearch.llm import DEFAULT_MODEL
from treesearch.metrics import evaluate_query, evaluate_benchmark

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class BenchmarkSample:
    """A single benchmark question-answer pair."""
    question: str = ""
    answer: str = ""
    supporting_facts: list[str] = field(default_factory=list)
    question_type: str = ""  # "single_hop" | "multi_hop" | "boolean" | "open"
    metadata: dict = field(default_factory=dict)


@dataclass
class BenchmarkResult:
    """Result for a single sample."""
    sample: Optional[BenchmarkSample] = None
    predicted_answer: str = ""
    search_result: Optional[SearchResult] = None
    answer_result: Optional[AnswerResult] = None
    retrieval_metrics: dict = field(default_factory=dict)
    generation_metrics: dict = field(default_factory=dict)
    latency: float = 0.0
    llm_calls: int = 0


@dataclass
class BenchmarkReport:
    """Aggregated benchmark report."""
    dataset: str = ""
    strategy: str = ""
    model: str = ""
    num_samples: int = 0
    avg_retrieval_metrics: dict = field(default_factory=dict)
    avg_generation_metrics: dict = field(default_factory=dict)
    avg_latency: float = 0.0
    avg_llm_calls: float = 0.0
    results_by_type: dict = field(default_factory=dict)
    individual_results: list[BenchmarkResult] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Answer evaluation metrics (EM / F1 / string similarity)
# ---------------------------------------------------------------------------

def _normalize_answer(s: str) -> str:
    """Normalize answer string for comparison."""
    s = s.lower().strip()
    s = re.sub(r"\b(a|an|the)\b", " ", s)
    s = re.sub(r"[^\w\s]", "", s)
    s = " ".join(s.split())
    return s


def exact_match(prediction: str, ground_truth: str) -> float:
    """Exact match score (0 or 1)."""
    return 1.0 if _normalize_answer(prediction) == _normalize_answer(ground_truth) else 0.0


def f1_score(prediction: str, ground_truth: str) -> float:
    """Token-level F1 score between prediction and ground truth."""
    pred_tokens = _normalize_answer(prediction).split()
    gt_tokens = _normalize_answer(ground_truth).split()

    if not pred_tokens or not gt_tokens:
        return float(pred_tokens == gt_tokens)

    common = Counter(pred_tokens) & Counter(gt_tokens)
    num_common = sum(common.values())

    if num_common == 0:
        return 0.0

    precision = num_common / len(pred_tokens)
    recall = num_common / len(gt_tokens)
    return 2 * precision * recall / (precision + recall)


# ---------------------------------------------------------------------------
# Dataset loaders
# ---------------------------------------------------------------------------

def load_hotpotqa(data_path: str, max_samples: int = 500) -> list[BenchmarkSample]:
    """Load HotpotQA dataset. Expected format: JSONL."""
    samples = []
    with open(data_path, "r", encoding="utf-8") as f:
        for line in f:
            if len(samples) >= max_samples:
                break
            item = json.loads(line.strip())
            qtype = item.get("type", "")
            if qtype in ("bridge", "comparison"):
                qtype = "multi_hop"
            else:
                qtype = "single_hop"

            samples.append(BenchmarkSample(
                question=item.get("question", ""),
                answer=item.get("answer", ""),
                supporting_facts=item.get("supporting_facts", []),
                question_type=qtype,
                metadata={"id": item.get("_id", "")},
            ))
    logger.info("Loaded %d HotpotQA samples from %s", len(samples), data_path)
    return samples


def load_qasper(data_path: str, max_samples: int = 500) -> list[BenchmarkSample]:
    """Load QASPER dataset (academic paper QA). Expected format: JSON."""
    samples = []
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for paper_id, paper in data.items():
        if len(samples) >= max_samples:
            break
        for qa in paper.get("qas", []):
            if len(samples) >= max_samples:
                break
            question = qa.get("question", "")
            answers = qa.get("answers", [])
            answer_text = ""
            for ans in answers:
                extracted = ans.get("answer", {})
                if isinstance(extracted, dict):
                    if extracted.get("free_form_answer"):
                        answer_text = extracted["free_form_answer"]
                        break
                    elif extracted.get("extractive_spans"):
                        answer_text = " ".join(extracted["extractive_spans"])
                        break
                    elif extracted.get("yes_no") is not None:
                        answer_text = "yes" if extracted["yes_no"] else "no"
                        break

            if question and answer_text:
                samples.append(BenchmarkSample(
                    question=question,
                    answer=answer_text,
                    question_type="single_hop",
                    metadata={"paper_id": paper_id},
                ))

    logger.info("Loaded %d QASPER samples from %s", len(samples), data_path)
    return samples


def load_custom(data_path: str, max_samples: int = 500) -> list[BenchmarkSample]:
    """Load custom dataset. Expected format: JSONL."""
    samples = []
    with open(data_path, "r", encoding="utf-8") as f:
        for line in f:
            if len(samples) >= max_samples:
                break
            item = json.loads(line.strip())
            samples.append(BenchmarkSample(
                question=item.get("question", ""),
                answer=item.get("answer", ""),
                question_type=item.get("type", "single_hop"),
                supporting_facts=item.get("supporting_facts", []),
                metadata=item.get("metadata", {}),
            ))
    logger.info("Loaded %d custom samples from %s", len(samples), data_path)
    return samples


DATASET_LOADERS = {
    "hotpotqa": load_hotpotqa,
    "qasper": load_qasper,
    "custom": load_custom,
}


# ---------------------------------------------------------------------------
# Benchmark runner
# ---------------------------------------------------------------------------

async def evaluate_sample(
    sample: BenchmarkSample,
    documents: list[Document],
    model: str = DEFAULT_MODEL,
    strategy: str = "best_first",
    use_decompose: bool = False,
    **search_kwargs,
) -> BenchmarkResult:
    """Evaluate a single benchmark sample."""
    start = time.time()

    answer_mode = "extractive"
    if sample.question_type == "boolean":
        answer_mode = "boolean"

    answer_result = await ask(
        query=sample.question,
        documents=documents,
        model=model,
        strategy=strategy,
        answer_mode=answer_mode,
        decompose=use_decompose,
        **search_kwargs,
    )

    latency = time.time() - start

    gen_metrics = {
        "em": exact_match(answer_result.answer, sample.answer),
        "f1": f1_score(answer_result.answer, sample.answer),
    }

    retrieval_metrics = {}
    if sample.supporting_facts and answer_result.search_result:
        retrieved_ids = []
        for doc_result in answer_result.search_result.documents:
            for node in doc_result.get("nodes", []):
                retrieved_ids.append(node.get("node_id", ""))
        if retrieved_ids:
            retrieval_metrics = evaluate_query(
                retrieved_ids, sample.supporting_facts, k_values=[1, 3, 5]
            )

    return BenchmarkResult(
        sample=sample,
        predicted_answer=answer_result.answer,
        search_result=answer_result.search_result,
        answer_result=answer_result,
        retrieval_metrics=retrieval_metrics,
        generation_metrics=gen_metrics,
        latency=latency,
        llm_calls=answer_result.llm_calls,
    )


async def run_benchmark(
    dataset: str,
    documents: list[Document],
    strategies: Optional[list[str]] = None,
    models: Optional[list[str]] = None,
    data_path: Optional[str] = None,
    output_dir: str = "./benchmark_results",
    max_samples: int = 500,
    max_concurrency: int = 5,
    use_decompose: bool = False,
    **search_kwargs,
) -> list[BenchmarkReport]:
    """Run QA benchmark evaluation."""
    if strategies is None:
        strategies = ["best_first"]
    if models is None:
        models = [DEFAULT_MODEL]

    loader = DATASET_LOADERS.get(dataset)
    if loader is None:
        raise ValueError(f"Unknown dataset: {dataset}. Available: {list(DATASET_LOADERS.keys())}")
    if data_path is None:
        raise ValueError("data_path is required for dataset loading")

    samples = loader(data_path, max_samples=max_samples)
    if not samples:
        raise ValueError(f"No samples loaded from {data_path}")

    os.makedirs(output_dir, exist_ok=True)

    reports = []
    semaphore = asyncio.Semaphore(max_concurrency)

    for strategy in strategies:
        for model in models:
            logger.info("Running benchmark: dataset=%s, strategy=%s, model=%s", dataset, strategy, model)

            async def _eval_one(sample: BenchmarkSample) -> BenchmarkResult:
                async with semaphore:
                    try:
                        return await evaluate_sample(
                            sample, documents, model=model, strategy=strategy,
                            use_decompose=use_decompose, **search_kwargs,
                        )
                    except Exception as e:
                        logger.error("Sample evaluation failed: %s", e)
                        return BenchmarkResult(
                            sample=sample,
                            predicted_answer="",
                            generation_metrics={"em": 0.0, "f1": 0.0},
                        )

            results = await asyncio.gather(*[_eval_one(s) for s in samples])

            gen_metrics_list = [r.generation_metrics for r in results if r.generation_metrics]
            avg_gen = {}
            if gen_metrics_list:
                for key in gen_metrics_list[0]:
                    avg_gen[key] = sum(m[key] for m in gen_metrics_list) / len(gen_metrics_list)

            ret_metrics_list = [r.retrieval_metrics for r in results if r.retrieval_metrics]
            avg_ret = {}
            if ret_metrics_list:
                for key in ret_metrics_list[0]:
                    avg_ret[key] = sum(m.get(key, 0) for m in ret_metrics_list) / len(ret_metrics_list)

            avg_latency = sum(r.latency for r in results) / len(results) if results else 0
            avg_calls = sum(r.llm_calls for r in results) / len(results) if results else 0

            by_type = {}
            for r in results:
                qtype = r.sample.question_type if r.sample else "unknown"
                if qtype not in by_type:
                    by_type[qtype] = {"em": [], "f1": [], "count": 0}
                by_type[qtype]["em"].append(r.generation_metrics.get("em", 0))
                by_type[qtype]["f1"].append(r.generation_metrics.get("f1", 0))
                by_type[qtype]["count"] += 1

            for qtype in by_type:
                by_type[qtype]["avg_em"] = sum(by_type[qtype]["em"]) / max(len(by_type[qtype]["em"]), 1)
                by_type[qtype]["avg_f1"] = sum(by_type[qtype]["f1"]) / max(len(by_type[qtype]["f1"]), 1)
                del by_type[qtype]["em"]
                del by_type[qtype]["f1"]

            report = BenchmarkReport(
                dataset=dataset,
                strategy=strategy,
                model=model,
                num_samples=len(results),
                avg_retrieval_metrics=avg_ret,
                avg_generation_metrics=avg_gen,
                avg_latency=avg_latency,
                avg_llm_calls=avg_calls,
                results_by_type=by_type,
                individual_results=results,
            )
            reports.append(report)

            report_data = {
                "dataset": report.dataset,
                "strategy": report.strategy,
                "model": report.model,
                "num_samples": report.num_samples,
                "avg_retrieval_metrics": report.avg_retrieval_metrics,
                "avg_generation_metrics": report.avg_generation_metrics,
                "avg_latency": report.avg_latency,
                "avg_llm_calls": report.avg_llm_calls,
                "results_by_type": report.results_by_type,
            }
            out_path = os.path.join(output_dir, f"{dataset}_{strategy}_{model.replace('/', '_')}.json")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(report_data, f, indent=2, ensure_ascii=False)
            logger.info("Report saved to %s", out_path)

    return reports


def print_report(report: BenchmarkReport) -> None:
    """Print a formatted benchmark report."""
    print(f"\n{'='*70}")
    print(f"  Benchmark: {report.dataset}")
    print(f"  Strategy: {report.strategy}  |  Model: {report.model}")
    print(f"  Samples: {report.num_samples}")
    print(f"{'='*70}")

    if report.avg_generation_metrics:
        print("\n  Generation Metrics:")
        for k, v in report.avg_generation_metrics.items():
            print(f"    {k:>12}: {v:.4f}")

    if report.avg_retrieval_metrics:
        print("\n  Retrieval Metrics:")
        for k, v in report.avg_retrieval_metrics.items():
            print(f"    {k:>12}: {v:.4f}")

    print(f"\n  Avg Latency: {report.avg_latency:.2f}s")
    print(f"  Avg LLM Calls: {report.avg_llm_calls:.1f}")

    if report.results_by_type:
        print("\n  By Question Type:")
        for qtype, metrics in report.results_by_type.items():
            print(f"    {qtype}: n={metrics['count']}, EM={metrics['avg_em']:.4f}, F1={metrics['avg_f1']:.4f}")

    print(f"{'='*70}\n")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

async def main():
    import argparse
    parser = argparse.ArgumentParser(description="QA Benchmark (answer generation on top of TreeSearch)")
    parser.add_argument("--dataset", type=str, required=True,
                        choices=["hotpotqa", "qasper", "custom"], help="Benchmark dataset")
    parser.add_argument("--data-path", type=str, required=True, help="Path to dataset file")
    parser.add_argument("--index_dir", type=str, required=True, help="Directory containing index JSON files")
    parser.add_argument("--model", type=str, default="gpt-4o-mini", help="LLM model name")
    parser.add_argument("--strategy", type=str, nargs="+", default=["best_first"],
                        help="Search strategies to evaluate")
    parser.add_argument("--max-samples", type=int, default=100, help="Max samples to evaluate")
    parser.add_argument("--output-dir", type=str, default="./benchmark_results")
    parser.add_argument("--decompose", action="store_true", help="Enable query decomposition")
    args = parser.parse_args()

    documents = load_documents(args.index_dir)
    if not documents:
        print(f"No indexes found in {args.index_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(documents)} document(s)")
    print(f"Running QA benchmark: {args.dataset} ({args.max_samples} samples)\n")

    reports = await run_benchmark(
        dataset=args.dataset,
        documents=documents,
        strategies=args.strategy,
        models=[args.model],
        data_path=args.data_path,
        output_dir=args.output_dir,
        max_samples=args.max_samples,
        use_decompose=args.decompose,
    )

    for report in reports:
        print_report(report)


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    asyncio.run(main())
