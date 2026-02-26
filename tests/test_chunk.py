# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for treesearch.chunk module.
"""
from unittest.mock import patch

import pytest
from treesearch.chunk import (
    Chunk,
    RefinedSearchResult,
    _split_into_chunks,
    _bm25_rank_chunks,
    _llm_rerank_chunks,
    refine_search,
)
from treesearch.search import SearchResult


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def large_text():
    """A text large enough to be split into multiple chunks."""
    return " ".join(f"word{i}" for i in range(500))


@pytest.fixture
def search_result_with_text():
    """SearchResult containing nodes with large text content."""
    large_text = " ".join(f"The system uses Python and FastAPI for backend services word{i}" for i in range(200))
    return SearchResult(
        documents=[{
            "doc_id": "d1",
            "doc_name": "Test Doc",
            "nodes": [
                {
                    "node_id": "0001",
                    "title": "Backend",
                    "score": 0.9,
                    "text": large_text,
                    "line_start": 10,
                    "line_end": 50,
                },
                {
                    "node_id": "0002",
                    "title": "Frontend",
                    "score": 0.7,
                    "text": "Short text about React.",
                    "line_start": 55,
                    "line_end": 60,
                },
            ],
        }],
        query="What is the backend?",
        total_llm_calls=3,
    )


# ---------------------------------------------------------------------------
# Chunk / RefinedSearchResult
# ---------------------------------------------------------------------------

class TestDataclasses:
    def test_chunk_defaults(self):
        c = Chunk()
        assert c.text == ""
        assert c.score == 0.0
        assert c.chunk_index == 0

    def test_chunk_custom(self):
        c = Chunk(text="hello", node_id="n1", score=0.8, chunk_index=2)
        assert c.text == "hello"
        assert c.node_id == "n1"
        assert c.score == 0.8

    def test_refined_search_result_defaults(self):
        r = RefinedSearchResult()
        assert r.chunks == []
        assert r.query == ""
        assert r.total_llm_calls == 0


# ---------------------------------------------------------------------------
# _split_into_chunks
# ---------------------------------------------------------------------------

class TestSplitIntoChunks:
    def test_basic_split(self, large_text):
        chunks = _split_into_chunks(large_text, chunk_size=100, chunk_overlap=20)
        assert len(chunks) > 1
        # Each chunk should be non-empty
        for c in chunks:
            assert len(c) > 0

    def test_small_text_single_chunk(self):
        chunks = _split_into_chunks("hello world", chunk_size=256)
        assert len(chunks) == 1
        assert "hello world" in chunks[0]

    def test_empty_text(self):
        assert _split_into_chunks("") == []
        assert _split_into_chunks("   ") == []

    def test_overlap_between_chunks(self, large_text):
        chunks = _split_into_chunks(large_text, chunk_size=100, chunk_overlap=30)
        if len(chunks) >= 2:
            # Chunks should have some overlapping words
            words_0 = set(chunks[0].split())
            words_1 = set(chunks[1].split())
            assert len(words_0 & words_1) > 0


# ---------------------------------------------------------------------------
# _bm25_rank_chunks
# ---------------------------------------------------------------------------

class TestBm25RankChunks:
    def test_basic_ranking(self):
        chunks = [
            "Python backend FastAPI REST API",
            "React frontend TypeScript components",
            "Python machine learning training data",
        ]
        ranked = _bm25_rank_chunks("Python backend", chunks, top_k=2)
        assert len(ranked) == 2
        # Should return (index, score) pairs
        for idx, score in ranked:
            assert isinstance(idx, int)
            assert isinstance(score, float)

    def test_empty_chunks(self):
        assert _bm25_rank_chunks("test", []) == []

    def test_empty_query(self):
        ranked = _bm25_rank_chunks("", ["hello world"])
        assert len(ranked) == 1
        assert ranked[0][1] == 0.0


# ---------------------------------------------------------------------------
# _llm_rerank_chunks
# ---------------------------------------------------------------------------

class TestLlmRerankChunks:
    @pytest.mark.asyncio
    async def test_basic_rerank(self):
        async def mock_achat(prompt, **kwargs):
            return '{"scores": [{"chunk_index": 0, "relevance": 0.9}, {"chunk_index": 1, "relevance": 0.3}]}'

        chunks = [(0, "Python backend"), (1, "React frontend")]
        with patch("treesearch.chunk.achat", side_effect=mock_achat):
            ranked = await _llm_rerank_chunks("Python", chunks, top_k=2)

        assert len(ranked) == 2
        # First should be highest score
        assert ranked[0][1] >= ranked[1][1]

    @pytest.mark.asyncio
    async def test_empty_chunks(self):
        result = await _llm_rerank_chunks("test", [])
        assert result == []


# ---------------------------------------------------------------------------
# refine_search
# ---------------------------------------------------------------------------

class TestRefineSearch:
    @pytest.mark.asyncio
    async def test_basic_refinement(self, search_result_with_text):
        result = await refine_search(
            query="Python backend",
            search_result=search_result_with_text,
            chunk_size=100,
            top_k_chunks=3,
        )

        assert isinstance(result, RefinedSearchResult)
        assert result.query == "Python backend"
        assert len(result.chunks) > 0
        for chunk in result.chunks:
            assert isinstance(chunk, Chunk)
            assert chunk.text

    @pytest.mark.asyncio
    async def test_small_nodes_pass_through(self, search_result_with_text):
        """Nodes smaller than chunk_size should pass through as-is."""
        result = await refine_search(
            query="React",
            search_result=search_result_with_text,
            chunk_size=256,
            top_k_chunks=10,
        )

        # Node 0002 "Frontend" has short text, should pass through
        node_ids = [c.node_id for c in result.chunks]
        assert "0002" in node_ids

    @pytest.mark.asyncio
    async def test_with_llm_rerank(self, search_result_with_text):
        async def mock_achat(prompt, **kwargs):
            return '{"scores": [{"chunk_index": 0, "relevance": 0.9}]}'

        with patch("treesearch.chunk.achat", side_effect=mock_achat):
            result = await refine_search(
                query="backend",
                search_result=search_result_with_text,
                use_llm_rerank=True,
                chunk_size=100,
                top_k_chunks=3,
            )

        assert isinstance(result, RefinedSearchResult)
        assert result.total_llm_calls > 0

    @pytest.mark.asyncio
    async def test_empty_search_result(self):
        empty_result = SearchResult(documents=[], query="test")
        result = await refine_search(
            query="test",
            search_result=empty_result,
        )

        assert isinstance(result, RefinedSearchResult)
        assert result.chunks == []
