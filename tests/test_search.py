# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for treesearch.search module (with mocked LLM).

Tests cover: BestFirstTreeSearch, route_documents,
             search(), search_sync().
"""
from unittest.mock import patch, AsyncMock, MagicMock
import json

import pytest
from treesearch.search import (
    BestFirstTreeSearch,
    search,
    search_sync,
    route_documents,
)
from treesearch.tree import Document


class TestBestFirstTreeSearch:
    @pytest.mark.asyncio
    async def test_run_returns_results(self, sample_tree_structure):
        async def mock_achat(prompt, **kwargs):
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.8}, {"node_id": "0001", "relevance": 0.7}, {"node_id": "0002", "relevance": 0.6}, {"node_id": "0003", "relevance": 0.9}]}'
            return '{"relevance": 0.8}'

        doc = Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)
        with patch("treesearch.search.achat", side_effect=mock_achat):
            searcher = BestFirstTreeSearch(
                document=doc,
                query="What is the backend technology?",
                max_results=5,
                use_subtree_cache=False,
            )
            results = await searcher.run()

        assert isinstance(results, list)
        assert len(results) > 0
        for r in results:
            assert "title" in r
            assert "score" in r
            assert "node_id" in r

    @pytest.mark.asyncio
    async def test_early_stopping(self, sample_tree_structure):
        """Flat tree with low scores should return few/no high-scoring results."""
        async def mock_achat(prompt, **kwargs):
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.05}, {"node_id": "0001", "relevance": 0.05}, {"node_id": "0002", "relevance": 0.05}, {"node_id": "0003", "relevance": 0.05}]}'
            return '{"relevance": 0.05}'

        doc = Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)
        with patch("treesearch.search.achat", side_effect=mock_achat):
            searcher = BestFirstTreeSearch(
                document=doc,
                query="Unrelated query",
                threshold=0.5,
                use_subtree_cache=False,
                dynamic_threshold=False,
            )
            results = await searcher.run()

        # All scores are very low
        assert isinstance(results, list)
        for r in results:
            assert r["score"] <= 0.1

    @pytest.mark.asyncio
    async def test_max_results_limit(self, sample_tree_structure):
        async def mock_achat(prompt, **kwargs):
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.9}, {"node_id": "0001", "relevance": 0.9}, {"node_id": "0002", "relevance": 0.9}, {"node_id": "0003", "relevance": 0.9}]}'
            return '{"relevance": 0.9}'

        doc = Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)
        with patch("treesearch.search.achat", side_effect=mock_achat):
            searcher = BestFirstTreeSearch(
                document=doc,
                query="test",
                max_results=2,
                threshold=0.1,
                use_subtree_cache=False,
            )
            results = await searcher.run()

        assert len(results) <= 2

    @pytest.mark.asyncio
    async def test_budget_control(self, sample_tree_structure):
        async def mock_achat(prompt, **kwargs):
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.8}, {"node_id": "0001", "relevance": 0.8}, {"node_id": "0002", "relevance": 0.8}, {"node_id": "0003", "relevance": 0.8}]}'
            return '{"relevance": 0.8}'

        doc = Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)
        with patch("treesearch.search.achat", side_effect=mock_achat):
            searcher = BestFirstTreeSearch(
                document=doc,
                query="test",
                max_llm_calls=5,
                threshold=0.1,
                use_subtree_cache=False,
            )
            await searcher.run()

        assert searcher.llm_calls <= 5

    @pytest.mark.asyncio
    async def test_results_sorted_by_score(self, sample_tree_structure):
        async def mock_achat(prompt, **kwargs):
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.3}, {"node_id": "0001", "relevance": 0.9}, {"node_id": "0002", "relevance": 0.5}, {"node_id": "0003", "relevance": 0.7}]}'
            return '{"relevance": 0.5}'

        doc = Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)
        with patch("treesearch.search.achat", side_effect=mock_achat):
            searcher = BestFirstTreeSearch(
                document=doc,
                query="test",
                threshold=0.1,
                use_subtree_cache=False,
                dynamic_threshold=False,
            )
            results = await searcher.run()

        if len(results) >= 2:
            scores = [r["score"] for r in results]
            assert scores == sorted(scores, reverse=True)

    @pytest.mark.asyncio
    async def test_with_bm25_scores(self, sample_tree_structure):
        async def mock_achat(prompt, **kwargs):
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.7}, {"node_id": "0001", "relevance": 0.7}, {"node_id": "0002", "relevance": 0.7}, {"node_id": "0003", "relevance": 0.7}]}'
            return '{"relevance": 0.7}'

        doc = Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)
        bm25_scores = {"0001": 2.5, "0002": 0.5, "0003": 1.8}

        with patch("treesearch.search.achat", side_effect=mock_achat):
            searcher = BestFirstTreeSearch(
                document=doc,
                query="backend",
                bm25_scores=bm25_scores,
                bm25_weight=0.3,
                threshold=0.1,
                use_subtree_cache=False,
            )
            results = await searcher.run()

        assert isinstance(results, list)
        assert len(results) > 0

    @pytest.mark.asyncio
    async def test_subtree_cache(self, sample_tree_structure):
        """Subtree cache should avoid redundant LLM calls across searches (deep tree)."""
        BestFirstTreeSearch.clear_subtree_cache()
        call_count = 0

        # Use a deep tree to trigger priority-queue mode (not flat hybrid mode)
        deep_structure = [
            {
                "title": "Root",
                "summary": "Root section.",
                "node_id": "0000",
                "text": "Root text.",
                "nodes": [
                    {
                        "title": "Level 1A",
                        "summary": "Level 1A section.",
                        "node_id": "0001",
                        "text": "Level 1A text.",
                        "nodes": [
                            {
                                "title": "Level 2A",
                                "summary": "Level 2A section.",
                                "node_id": "0002",
                                "text": "Level 2A text.",
                                "nodes": [
                                    {
                                        "title": "Level 3A",
                                        "summary": "Level 3A leaf.",
                                        "node_id": "0003",
                                        "text": "Level 3A text.",
                                    }
                                ],
                            }
                        ],
                    }
                ],
            }
        ]

        async def mock_achat(prompt, **kwargs):
            nonlocal call_count
            call_count += 1
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.8}, {"node_id": "0001", "relevance": 0.8}, {"node_id": "0002", "relevance": 0.8}, {"node_id": "0003", "relevance": 0.8}]}'
            return '{"relevance": 0.8}'

        doc = Document(doc_id="test", doc_name="Test Doc", structure=deep_structure)

        # First search
        with patch("treesearch.search.achat", side_effect=mock_achat):
            searcher1 = BestFirstTreeSearch(
                document=doc, query="backend tech", use_subtree_cache=True,
                adaptive_depth_threshold=1,
            )
            await searcher1.run()

        first_calls = call_count

        # Second search with same query -> should hit cache
        with patch("treesearch.search.achat", side_effect=mock_achat):
            searcher2 = BestFirstTreeSearch(
                document=doc, query="backend tech", use_subtree_cache=True,
                adaptive_depth_threshold=1,
            )
            await searcher2.run()

        # Second search should make fewer LLM calls due to cache
        assert call_count - first_calls < first_calls

        BestFirstTreeSearch.clear_subtree_cache()

    @pytest.mark.asyncio
    async def test_dynamic_threshold(self, sample_tree_structure):
        """Dynamic threshold should filter low-scoring nodes."""
        async def mock_achat(prompt, **kwargs):
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.9}, {"node_id": "0001", "relevance": 0.1}, {"node_id": "0002", "relevance": 0.1}, {"node_id": "0003", "relevance": 0.1}]}'
            return '{"relevance": 0.5}'

        doc = Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)
        with patch("treesearch.search.achat", side_effect=mock_achat):
            searcher = BestFirstTreeSearch(
                document=doc,
                query="test",
                use_subtree_cache=False,
                dynamic_threshold=True,
            )
            results = await searcher.run()

        # Dynamic threshold should filter out very low-scoring nodes
        assert isinstance(results, list)
        for r in results:
            assert r["score"] > 0

    @pytest.mark.asyncio
    async def test_context_window_splits_batches(self):
        """When nodes exceed max_prompt_tokens, batches are split into multiple LLM calls.

        Uses a deep tree (depth > 2) to bypass the flat hybrid mode and test
        the actual LLM batch splitting logic.
        """
        # Build a deep structure to avoid flat mode
        structure = [
            {
                "title": "Root",
                "summary": "Root section.",
                "node_id": "root",
                "text": "Root text.",
                "nodes": [
                    {
                        "title": "Mid",
                        "summary": "Mid section.",
                        "node_id": "mid",
                        "text": "Mid text.",
                        "nodes": [
                            {
                                "title": f"Section {i}",
                                "summary": f"Summary for section {i}.",
                                "node_id": f"{i:04d}",
                                "text": f"Content for section {i}. " * 50,
                            }
                            for i in range(6)
                        ],
                    }
                ],
            }
        ]

        call_count = 0

        async def mock_achat(prompt, **kwargs):
            nonlocal call_count
            call_count += 1
            import re
            node_ids = re.findall(r'node_id: (\w+)', prompt)
            rankings = [{"node_id": nid, "relevance": 0.8} for nid in node_ids]
            return json.dumps({"rankings": rankings})

        doc = Document(doc_id="test", doc_name="Test Doc", structure=structure)
        with patch("treesearch.search.achat", side_effect=mock_achat):
            searcher = BestFirstTreeSearch(
                document=doc,
                query="test query",
                use_subtree_cache=False,
                max_prompt_tokens=500,
                adaptive_depth_threshold=1,
            )
            results = await searcher.run()

        assert isinstance(results, list)
        assert call_count > 1

    @pytest.mark.asyncio
    async def test_deep_tree_uses_priority_queue(self):
        """Deep trees (depth > adaptive_depth_threshold) should use priority queue."""
        deep_structure = [
            {
                "title": "Root",
                "summary": "Root section.",
                "node_id": "0000",
                "text": "Root text.",
                "nodes": [
                    {
                        "title": "Level 1",
                        "summary": "Level 1 section.",
                        "node_id": "0001",
                        "text": "Level 1 text.",
                        "nodes": [
                            {
                                "title": "Level 2",
                                "summary": "Level 2 section.",
                                "node_id": "0002",
                                "text": "Level 2 text.",
                                "nodes": [
                                    {
                                        "title": "Level 3",
                                        "summary": "Level 3 leaf.",
                                        "node_id": "0003",
                                        "text": "Level 3 text.",
                                    }
                                ],
                            }
                        ],
                    }
                ],
            }
        ]

        async def mock_achat(prompt, **kwargs):
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.8}]}'
            return '{"relevance": 0.8}'

        doc = Document(doc_id="test", doc_name="Test Doc", structure=deep_structure)
        with patch("treesearch.search.achat", side_effect=mock_achat):
            searcher = BestFirstTreeSearch(
                document=doc,
                query="test",
                use_subtree_cache=False,
                adaptive_depth_threshold=2,
            )
            results = await searcher.run()

        assert isinstance(results, list)
        assert searcher.llm_calls > 0


class TestSearchResult:
    def test_fields(self):
        r = {
            "documents": [{"doc_id": "d1", "doc_name": "Doc", "nodes": []}],
            "query": "test",
        }
        assert len(r["documents"]) == 1
        assert r["query"] == "test"

    def test_empty(self):
        r = {"documents": [], "query": ""}
        assert r["documents"] == []
        assert r["query"] == ""


class TestRouteDocuments:
    @pytest.fixture
    def two_documents(self, sample_tree_structure):
        doc_a = Document(
            doc_id="a", doc_name="Doc A",
            doc_description="Architecture and deployment guide.",
            structure=sample_tree_structure,
        )
        doc_b = Document(
            doc_id="b", doc_name="Doc B",
            doc_description="Machine learning algorithms overview.",
            structure=[{
                "title": "ML Basics", "summary": "Introduction to machine learning.",
                "node_id": "0000", "text": "Machine learning is a subset of AI.",
            }],
        )
        return [doc_a, doc_b]

    @pytest.mark.asyncio
    async def test_routes_to_relevant_doc(self, two_documents):
        async def mock_achat(prompt, **kwargs):
            return '{"selected_doc_ids": ["a"]}'

        with patch("treesearch.search.achat", side_effect=mock_achat):
            selected = await route_documents(
                query="How is the system deployed?",
                documents=two_documents,
            )

        assert isinstance(selected, list)
        assert len(selected) > 0
        assert selected[0].doc_id == "a"

    @pytest.mark.asyncio
    async def test_fallback_when_no_match(self, two_documents):
        async def mock_achat(prompt, **kwargs):
            return '{"selected_doc_ids": []}'

        with patch("treesearch.search.achat", side_effect=mock_achat):
            selected = await route_documents(
                query="Unrelated query",
                documents=two_documents,
            )

        assert len(selected) > 0

    @pytest.mark.asyncio
    async def test_top_k_limit(self, two_documents):
        async def mock_achat(prompt, **kwargs):
            return '{"selected_doc_ids": ["a", "b"]}'

        with patch("treesearch.search.achat", side_effect=mock_achat):
            selected = await route_documents(
                query="test",
                documents=two_documents,
                top_k=1,
            )

        assert len(selected) <= 1


class TestSearch:
    @pytest.fixture
    def two_documents(self, sample_tree_structure):
        doc_a = Document(
            doc_id="a", doc_name="Doc A",
            doc_description="Architecture and deployment guide.",
            structure=sample_tree_structure,
        )
        doc_b = Document(
            doc_id="b", doc_name="Doc B",
            doc_description="Machine learning algorithms overview.",
            structure=[{
                "title": "ML Basics", "summary": "Introduction to machine learning.",
                "node_id": "0000", "text": "Machine learning is a subset of AI.",
            }],
        )
        return [doc_a, doc_b]

    @pytest.mark.asyncio
    async def test_end_to_end_best_first(self, two_documents):
        async def mock_achat(prompt, **kwargs):
            if "select" in prompt.lower() or "document" in prompt.lower():
                return '{"selected_doc_ids": ["a"]}'
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.8}, {"node_id": "0001", "relevance": 0.7}, {"node_id": "0002", "relevance": 0.6}, {"node_id": "0003", "relevance": 0.9}]}'
            return '{"relevance": 0.8}'

        with patch("treesearch.search.achat", side_effect=mock_achat):
            result = await search(
                query="What is the backend?",
                documents=two_documents,
                strategy="best_first",
                top_k_docs=3,
            )

        assert isinstance(result, dict)
        assert result["query"] == "What is the backend?"
        assert "documents" in result

    @pytest.mark.asyncio
    async def test_single_document_skips_routing(self, sample_tree_structure):
        doc = Document(
            doc_id="only", doc_name="Only Doc",
            doc_description="The only doc.",
            structure=sample_tree_structure,
        )

        async def mock_achat(prompt, **kwargs):
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.7}, {"node_id": "0001", "relevance": 0.7}, {"node_id": "0002", "relevance": 0.7}, {"node_id": "0003", "relevance": 0.7}]}'
            return '{"relevance": 0.7}'

        with patch("treesearch.search.achat", side_effect=mock_achat):
            result = await search(
                query="test",
                documents=[doc],
                strategy="best_first",
            )

        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_search_with_bm25_disabled(self, two_documents):
        async def mock_achat(prompt, **kwargs):
            if "select" in prompt.lower() or "document" in prompt.lower():
                return '{"selected_doc_ids": ["a"]}'
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.8}, {"node_id": "0001", "relevance": 0.8}, {"node_id": "0002", "relevance": 0.8}, {"node_id": "0003", "relevance": 0.8}]}'
            return '{"relevance": 0.8}'

        with patch("treesearch.search.achat", side_effect=mock_achat):
            result = await search(
                query="backend",
                documents=two_documents,
                strategy="best_first",
                use_bm25=False,
                top_k_docs=3,
            )

        assert isinstance(result, dict)


class TestSearchSync:
    def test_sync_wrapper(self, sample_tree_structure):
        doc_a = Document(
            doc_id="a", doc_name="Doc A",
            doc_description="Architecture and deployment guide.",
            structure=sample_tree_structure,
        )

        async def mock_achat(prompt, **kwargs):
            if "rankings" in prompt.lower() or "rank" in prompt.lower():
                return '{"rankings": [{"node_id": "0000", "relevance": 0.8}, {"node_id": "0001", "relevance": 0.8}, {"node_id": "0002", "relevance": 0.8}, {"node_id": "0003", "relevance": 0.8}]}'
            return '{"relevance": 0.8}'

        with patch("treesearch.search.achat", side_effect=mock_achat):
            result = search_sync(
                query="test",
                documents=[doc_a],
                strategy="best_first",
            )

        assert isinstance(result, dict)
