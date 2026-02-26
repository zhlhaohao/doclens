# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for treesearch.benchmark module (with mocked LLM).
"""
import json
import os
import tempfile
from unittest.mock import patch

import pytest
from treesearch.benchmark import (
    BenchmarkSample,
    BenchmarkResult,
    BenchmarkReport,
    _normalize_answer,
    exact_match,
    f1_score,
    load_hotpotqa,
    load_qasper,
    load_custom,
    evaluate_sample,
    run_benchmark,
    print_report,
)
from treesearch.tree import Document


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_documents(sample_tree_structure):
    return [Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)]


@pytest.fixture
def hotpotqa_file():
    """Create a temp HotpotQA JSONL file."""
    data = [
        {"_id": "1", "question": "What is Python?", "answer": "A programming language", "type": "bridge"},
        {"_id": "2", "question": "Is the sky blue?", "answer": "yes", "type": "comparison"},
        {"_id": "3", "question": "Who wrote Python?", "answer": "Guido van Rossum", "type": "other"},
    ]
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        for item in data:
            f.write(json.dumps(item) + "\n")
        path = f.name
    yield path
    os.unlink(path)


@pytest.fixture
def qasper_file():
    """Create a temp QASPER JSON file."""
    data = {
        "paper_001": {
            "qas": [
                {
                    "question": "What method is proposed?",
                    "answers": [{"answer": {"free_form_answer": "TreeSearch method"}}],
                },
                {
                    "question": "Does it work?",
                    "answers": [{"answer": {"yes_no": True}}],
                },
            ]
        }
    }
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(data, f)
        path = f.name
    yield path
    os.unlink(path)


@pytest.fixture
def custom_file():
    """Create a temp custom JSONL file."""
    data = [
        {"question": "What is the backend?", "answer": "FastAPI", "type": "single_hop"},
        {"question": "What is the frontend?", "answer": "React", "type": "single_hop"},
    ]
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        for item in data:
            f.write(json.dumps(item) + "\n")
        path = f.name
    yield path
    os.unlink(path)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

class TestDataStructures:
    def test_benchmark_sample(self):
        s = BenchmarkSample(question="Q?", answer="A", question_type="single_hop")
        assert s.question == "Q?"
        assert s.answer == "A"

    def test_benchmark_result(self):
        r = BenchmarkResult()
        assert r.predicted_answer == ""
        assert r.latency == 0.0

    def test_benchmark_report(self):
        r = BenchmarkReport(dataset="test", strategy="best_first", model="gpt-4o-mini", num_samples=10)
        assert r.dataset == "test"
        assert r.num_samples == 10


# ---------------------------------------------------------------------------
# Answer evaluation metrics
# ---------------------------------------------------------------------------

class TestNormalizeAnswer:
    def test_basic(self):
        assert _normalize_answer("  The Answer  ") == "answer"

    def test_articles_removed(self):
        assert _normalize_answer("a cat") == "cat"
        assert _normalize_answer("an apple") == "apple"
        assert _normalize_answer("the world") == "world"

    def test_punctuation_removed(self):
        assert _normalize_answer("hello, world!") == "hello world"

    def test_case_insensitive(self):
        assert _normalize_answer("HELLO") == "hello"


class TestExactMatch:
    def test_exact(self):
        assert exact_match("hello", "hello") == 1.0

    def test_case_insensitive(self):
        assert exact_match("Hello", "hello") == 1.0

    def test_with_articles(self):
        assert exact_match("The answer", "answer") == 1.0

    def test_mismatch(self):
        assert exact_match("hello", "world") == 0.0


class TestF1Score:
    def test_exact_match(self):
        assert f1_score("hello world", "hello world") == 1.0

    def test_partial_overlap(self):
        score = f1_score("hello beautiful world", "hello world")
        assert 0.0 < score < 1.0

    def test_no_overlap(self):
        assert f1_score("cat", "dog") == 0.0

    def test_empty_strings(self):
        assert f1_score("", "") == 1.0

    def test_one_empty(self):
        assert f1_score("hello", "") == 0.0


# ---------------------------------------------------------------------------
# Dataset loaders
# ---------------------------------------------------------------------------

class TestLoadHotpotQA:
    def test_load(self, hotpotqa_file):
        samples = load_hotpotqa(hotpotqa_file, max_samples=10)
        assert len(samples) == 3
        assert samples[0].question_type == "multi_hop"
        assert samples[1].question_type == "multi_hop"
        assert samples[2].question_type == "single_hop"

    def test_max_samples(self, hotpotqa_file):
        samples = load_hotpotqa(hotpotqa_file, max_samples=1)
        assert len(samples) == 1


class TestLoadQasper:
    def test_load(self, qasper_file):
        samples = load_qasper(qasper_file, max_samples=10)
        assert len(samples) == 2
        assert samples[0].answer == "TreeSearch method"
        assert samples[1].answer == "yes"

    def test_max_samples(self, qasper_file):
        samples = load_qasper(qasper_file, max_samples=1)
        assert len(samples) == 1


class TestLoadCustom:
    def test_load(self, custom_file):
        samples = load_custom(custom_file, max_samples=10)
        assert len(samples) == 2
        assert samples[0].question == "What is the backend?"
        assert samples[0].question_type == "single_hop"


# ---------------------------------------------------------------------------
# evaluate_sample
# ---------------------------------------------------------------------------

class TestEvaluateSample:
    @pytest.mark.asyncio
    async def test_basic(self, sample_documents):
        sample = BenchmarkSample(
            question="What is the backend?",
            answer="FastAPI",
            question_type="single_hop",
        )

        async def mock_achat(prompt, **kwargs):
            if "relevance" in prompt.lower() or "rate" in prompt.lower():
                return '{"relevance": 0.8}'
            if "answer" in prompt.lower() or "extract" in prompt.lower():
                return '{"answer": "FastAPI", "confidence": 0.9, "reasoning": "found it"}'
            return '{"node_list": ["0001"]}'

        with patch("treesearch.answer.achat", side_effect=mock_achat), \
             patch("treesearch.search.achat", side_effect=mock_achat):
            result = await evaluate_sample(sample, sample_documents)

        assert isinstance(result, BenchmarkResult)
        assert result.predicted_answer == "FastAPI"
        assert result.generation_metrics["em"] == 1.0
        assert result.generation_metrics["f1"] == 1.0
        assert result.latency > 0


# ---------------------------------------------------------------------------
# run_benchmark
# ---------------------------------------------------------------------------

class TestRunBenchmark:
    @pytest.mark.asyncio
    async def test_basic(self, sample_documents, custom_file):
        async def mock_achat(prompt, **kwargs):
            if "relevance" in prompt.lower() or "rate" in prompt.lower():
                return '{"relevance": 0.8}'
            if "answer" in prompt.lower() or "extract" in prompt.lower():
                return '{"answer": "FastAPI", "confidence": 0.9, "reasoning": "test"}'
            return '{"node_list": ["0001"]}'

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("treesearch.answer.achat", side_effect=mock_achat), \
                 patch("treesearch.search.achat", side_effect=mock_achat):
                reports = await run_benchmark(
                    dataset="custom",
                    documents=sample_documents,
                    strategies=["best_first"],
                    models=["gpt-4o-mini"],
                    data_path=custom_file,
                    output_dir=tmpdir,
                    max_samples=2,
                )

            assert len(reports) == 1
            report = reports[0]
            assert report.dataset == "custom"
            assert report.strategy == "best_first"
            assert report.num_samples == 2
            assert "em" in report.avg_generation_metrics
            assert "f1" in report.avg_generation_metrics

            # Check output file exists
            files = os.listdir(tmpdir)
            assert any(f.endswith(".json") for f in files)

    @pytest.mark.asyncio
    async def test_invalid_dataset_raises(self, sample_documents):
        with pytest.raises(ValueError, match="Unknown dataset"):
            await run_benchmark(
                dataset="nonexistent",
                documents=sample_documents,
                data_path="fake.jsonl",
            )

    @pytest.mark.asyncio
    async def test_no_data_path_raises(self, sample_documents):
        with pytest.raises(ValueError, match="data_path"):
            await run_benchmark(
                dataset="custom",
                documents=sample_documents,
            )


# ---------------------------------------------------------------------------
# print_report
# ---------------------------------------------------------------------------

class TestPrintReport:
    def test_basic(self, capsys):
        report = BenchmarkReport(
            dataset="test",
            strategy="best_first",
            model="gpt-4o-mini",
            num_samples=10,
            avg_generation_metrics={"em": 0.6, "f1": 0.75},
            avg_retrieval_metrics={"precision_at_3": 0.8},
            avg_latency=1.5,
            avg_llm_calls=5.0,
            results_by_type={
                "single_hop": {"count": 7, "avg_em": 0.7, "avg_f1": 0.8},
                "multi_hop": {"count": 3, "avg_em": 0.4, "avg_f1": 0.6},
            },
        )
        print_report(report)
        captured = capsys.readouterr()
        assert "test" in captured.out
        assert "best_first" in captured.out
        assert "0.6000" in captured.out
