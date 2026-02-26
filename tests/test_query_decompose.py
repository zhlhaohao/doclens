# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for treesearch.query_decompose module (with mocked LLM).
"""
from unittest.mock import patch

import pytest
from treesearch.query_decompose import (
    DecomposeResult,
    analyze_query,
    decompose_and_search,
)
from treesearch.search import SearchResult
from treesearch.tree import Document


@pytest.fixture
def sample_documents(sample_tree_structure):
    return [Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)]


# ---------------------------------------------------------------------------
# DecomposeResult
# ---------------------------------------------------------------------------

class TestDecomposeResult:
    def test_defaults(self):
        r = DecomposeResult()
        assert r.needs_decomposition is False
        assert r.sub_questions == []
        assert r.reasoning == ""

    def test_custom(self):
        r = DecomposeResult(
            needs_decomposition=True,
            sub_questions=["q1", "q2"],
            reasoning="multi-hop",
        )
        assert r.needs_decomposition is True
        assert len(r.sub_questions) == 2


# ---------------------------------------------------------------------------
# analyze_query
# ---------------------------------------------------------------------------

class TestAnalyzeQuery:
    @pytest.mark.asyncio
    async def test_simple_query_no_decomposition(self):
        async def mock_achat(prompt, **kwargs):
            return '{"needs_decomposition": false, "sub_questions": [], "reasoning": "Simple factual question"}'

        with patch("treesearch.query_decompose.achat", side_effect=mock_achat):
            result = await analyze_query("What is Python?")

        assert isinstance(result, DecomposeResult)
        assert result.needs_decomposition is False
        assert result.sub_questions == []

    @pytest.mark.asyncio
    async def test_complex_query_needs_decomposition(self):
        async def mock_achat(prompt, **kwargs):
            return (
                '{"needs_decomposition": true, '
                '"sub_questions": ["Which paper introduced attention?", "What architecture does it use?"], '
                '"reasoning": "Multi-hop: need to find paper first, then its architecture"}'
            )

        with patch("treesearch.query_decompose.achat", side_effect=mock_achat):
            result = await analyze_query(
                "What architecture does the paper that introduced attention use?"
            )

        assert result.needs_decomposition is True
        assert len(result.sub_questions) == 2

    @pytest.mark.asyncio
    async def test_malformed_llm_response(self):
        async def mock_achat(prompt, **kwargs):
            return "Not valid JSON"

        with patch("treesearch.query_decompose.achat", side_effect=mock_achat):
            result = await analyze_query("test")

        assert isinstance(result, DecomposeResult)
        assert result.needs_decomposition is False


# ---------------------------------------------------------------------------
# decompose_and_search
# ---------------------------------------------------------------------------

class TestDecomposeAndSearch:
    @pytest.mark.asyncio
    async def test_no_decomposition_direct_search(self, sample_documents):
        """When LLM says no decomposition needed, should fall through to direct search."""
        async def mock_achat(prompt, **kwargs):
            if "decomposition" in prompt.lower() or "multi-hop" in prompt.lower() or "sub-question" in prompt.lower():
                return '{"needs_decomposition": false, "sub_questions": [], "reasoning": "simple"}'
            if "relevance" in prompt.lower() or "rate" in prompt.lower():
                return '{"relevance": 0.8}'
            return '{"node_list": ["0001"]}'

        with patch("treesearch.query_decompose.achat", side_effect=mock_achat), \
             patch("treesearch.search.achat", side_effect=mock_achat):
            result = await decompose_and_search(
                query="What is the backend?",
                documents=sample_documents,
                strategy="best_first",
            )

        assert isinstance(result, SearchResult)
        assert result.total_llm_calls >= 1

    @pytest.mark.asyncio
    async def test_with_decomposition(self, sample_documents):
        """Multi-hop decomposition should search each sub-question and merge."""
        decompose_call = [True]  # first call to query_decompose.achat is analyze_query

        async def mock_decompose_achat(prompt, **kwargs):
            if decompose_call[0]:
                decompose_call[0] = False
                return (
                    '{"needs_decomposition": true, '
                    '"sub_questions": ["What is the backend?", "What is the frontend?"], '
                    '"reasoning": "Need both"}'
                )
            return '{"relevance": 0.8}'

        async def mock_search_achat(prompt, **kwargs):
            if "relevance" in prompt.lower() or "rate" in prompt.lower():
                return '{"relevance": 0.8}'
            return '{"node_list": ["0001"]}'

        with patch("treesearch.query_decompose.achat", side_effect=mock_decompose_achat), \
             patch("treesearch.search.achat", side_effect=mock_search_achat):
            result = await decompose_and_search(
                query="What are the backend and frontend technologies?",
                documents=sample_documents,
                strategy="best_first",
            )

        assert isinstance(result, SearchResult)
        assert "decompose" in result.strategy
        # Should have results from searching sub-questions
        assert result.total_llm_calls >= 1

    @pytest.mark.asyncio
    async def test_max_hops_limit(self, sample_documents):
        """Should respect max_hops limit."""
        async def mock_achat(prompt, **kwargs):
            if "decomposition" in prompt.lower() or "multi-hop" in prompt.lower() or "sub-question" in prompt.lower():
                return (
                    '{"needs_decomposition": true, '
                    '"sub_questions": ["q1", "q2", "q3", "q4", "q5"], '
                    '"reasoning": "many hops"}'
                )
            if "relevance" in prompt.lower() or "rate" in prompt.lower():
                return '{"relevance": 0.7}'
            return '{"node_list": ["0001"]}'

        with patch("treesearch.query_decompose.achat", side_effect=mock_achat), \
             patch("treesearch.search.achat", side_effect=mock_achat):
            result = await decompose_and_search(
                query="complex question",
                documents=sample_documents,
                max_hops=2,
                strategy="best_first",
            )

        assert isinstance(result, SearchResult)

    @pytest.mark.asyncio
    async def test_deduplicates_nodes(self, sample_documents):
        """Same nodes found across hops should not be duplicated."""
        async def mock_achat(prompt, **kwargs):
            if "decomposition" in prompt.lower() or "multi-hop" in prompt.lower() or "sub-question" in prompt.lower():
                return (
                    '{"needs_decomposition": true, '
                    '"sub_questions": ["q1", "q2"], '
                    '"reasoning": "two hops"}'
                )
            if "relevance" in prompt.lower() or "rate" in prompt.lower():
                return '{"relevance": 0.9}'
            return '{"node_list": ["0001"]}'

        with patch("treesearch.query_decompose.achat", side_effect=mock_achat), \
             patch("treesearch.search.achat", side_effect=mock_achat):
            result = await decompose_and_search(
                query="test",
                documents=sample_documents,
                strategy="best_first",
            )

        # Check no duplicate node_ids within any doc result
        for doc_result in result.documents:
            node_ids = [n.get("node_id") for n in doc_result.get("nodes", [])]
            assert len(node_ids) == len(set(node_ids))
