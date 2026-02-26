# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for treesearch.answer module (with mocked LLM).
"""
from unittest.mock import patch, AsyncMock

import pytest
from treesearch.answer import (
    AnswerResult,
    _build_context,
    _answer_prompt,
    generate_answer,
    ask,
    ask_sync,
)
from treesearch.search import SearchResult
from treesearch.tree import Document


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_search_result():
    """A SearchResult with realistic node data."""
    return SearchResult(
        documents=[
            {
                "doc_id": "d1",
                "doc_name": "Architecture Doc",
                "nodes": [
                    {
                        "node_id": "0001",
                        "title": "Backend",
                        "score": 0.9,
                        "text": "The backend is built with Python and FastAPI.",
                        "summary": "Python FastAPI backend.",
                        "line_start": 10,
                        "line_end": 20,
                    },
                    {
                        "node_id": "0002",
                        "title": "Frontend",
                        "score": 0.6,
                        "text": "The frontend uses React with TypeScript.",
                        "summary": "React TypeScript frontend.",
                        "line_start": 25,
                        "line_end": 35,
                    },
                ],
            }
        ],
        query="What is the backend?",
        total_llm_calls=3,
        strategy="best_first",
    )


@pytest.fixture
def empty_search_result():
    return SearchResult(
        documents=[{"doc_id": "d1", "doc_name": "Doc", "nodes": []}],
        query="test",
        total_llm_calls=1,
    )


@pytest.fixture
def sample_documents(sample_tree_structure):
    return [Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)]


# ---------------------------------------------------------------------------
# AnswerResult
# ---------------------------------------------------------------------------

class TestAnswerResult:
    def test_defaults(self):
        r = AnswerResult()
        assert r.answer == ""
        assert r.confidence == 0.0
        assert r.sources == []
        assert r.reasoning == ""
        assert r.search_result is None
        assert r.llm_calls == 0

    def test_custom(self):
        r = AnswerResult(answer="test", confidence=0.9, llm_calls=5)
        assert r.answer == "test"
        assert r.confidence == 0.9
        assert r.llm_calls == 5


# ---------------------------------------------------------------------------
# _build_context
# ---------------------------------------------------------------------------

class TestBuildContext:
    def test_basic(self, sample_search_result):
        context, sources = _build_context(sample_search_result, max_context_tokens=8000)
        assert "Backend" in context
        assert "FastAPI" in context
        assert len(sources) == 2
        # Sorted by score descending
        assert sources[0]["score"] >= sources[1]["score"]

    def test_empty_nodes(self, empty_search_result):
        context, sources = _build_context(empty_search_result)
        assert context == ""
        assert sources == []

    def test_token_budget_truncation(self, sample_search_result):
        # Very small budget -> should truncate
        context, sources = _build_context(sample_search_result, max_context_tokens=10)
        # Should still have at least some content or be truncated
        assert isinstance(context, str)

    def test_source_metadata(self, sample_search_result):
        _, sources = _build_context(sample_search_result)
        src = sources[0]
        assert src["doc_name"] == "Architecture Doc"
        assert src["doc_id"] == "d1"
        assert src["node_id"] in ("0001", "0002")
        assert "title" in src
        assert "line_start" in src
        assert "line_end" in src


# ---------------------------------------------------------------------------
# _answer_prompt
# ---------------------------------------------------------------------------

class TestAnswerPrompt:
    def test_extractive(self):
        p = _answer_prompt("What is X?", "Some context", "extractive")
        assert "extract" in p.lower()
        assert "What is X?" in p
        assert "Some context" in p

    def test_generative(self):
        p = _answer_prompt("What is X?", "Some context", "generative")
        assert "synthesize" in p.lower()

    def test_boolean(self):
        p = _answer_prompt("Is X true?", "Some context", "boolean")
        assert "yes" in p.lower() and "no" in p.lower()

    def test_unknown_mode_falls_back_to_generative(self):
        p = _answer_prompt("test", "ctx", "unknown_mode")
        assert "synthesize" in p.lower()


# ---------------------------------------------------------------------------
# generate_answer
# ---------------------------------------------------------------------------

class TestGenerateAnswer:
    @pytest.mark.asyncio
    async def test_basic(self, sample_search_result):
        async def mock_achat(prompt, **kwargs):
            return '{"answer": "FastAPI", "confidence": 0.95, "reasoning": "Found in backend section"}'

        with patch("treesearch.answer.achat", side_effect=mock_achat):
            result = await generate_answer(
                query="What is the backend built with?",
                search_result=sample_search_result,
            )

        assert result.answer == "FastAPI"
        assert result.confidence == 0.95
        assert result.reasoning == "Found in backend section"
        assert len(result.sources) > 0
        assert result.llm_calls == 1

    @pytest.mark.asyncio
    async def test_empty_context(self, empty_search_result):
        result = await generate_answer(
            query="test",
            search_result=empty_search_result,
        )
        assert "No relevant" in result.answer
        assert result.confidence == 0.0
        assert result.llm_calls == 0

    @pytest.mark.asyncio
    async def test_boolean_mode(self, sample_search_result):
        async def mock_achat(prompt, **kwargs):
            return '{"answer": "yes", "confidence": 0.8, "reasoning": "Context supports this"}'

        with patch("treesearch.answer.achat", side_effect=mock_achat):
            result = await generate_answer(
                query="Is the backend built with Python?",
                search_result=sample_search_result,
                answer_mode="boolean",
            )

        assert result.answer == "yes"

    @pytest.mark.asyncio
    async def test_malformed_llm_response(self, sample_search_result):
        async def mock_achat(prompt, **kwargs):
            return "This is not JSON, just a plain text answer."

        with patch("treesearch.answer.achat", side_effect=mock_achat):
            result = await generate_answer(
                query="test",
                search_result=sample_search_result,
            )

        # Should fall back to raw response
        assert len(result.answer) > 0


# ---------------------------------------------------------------------------
# ask (end-to-end)
# ---------------------------------------------------------------------------

class TestAsk:
    @pytest.mark.asyncio
    async def test_basic(self, sample_documents):
        async def mock_achat(prompt, **kwargs):
            if "relevance" in prompt.lower() or "rate" in prompt.lower():
                return '{"relevance": 0.8}'
            if "answer" in prompt.lower() or "extract" in prompt.lower():
                return '{"answer": "FastAPI", "confidence": 0.9, "reasoning": "test"}'
            return '{"node_list": ["0001"]}'

        with patch("treesearch.answer.achat", side_effect=mock_achat), \
             patch("treesearch.search.achat", side_effect=mock_achat):
            result = await ask(
                query="What is the backend?",
                documents=sample_documents,
                strategy="best_first",
            )

        assert isinstance(result, AnswerResult)
        assert result.llm_calls > 0

    @pytest.mark.asyncio
    async def test_with_decompose(self, sample_documents):
        async def mock_achat(prompt, **kwargs):
            if "decomposition" in prompt.lower() or "multi-hop" in prompt.lower() or "sub-question" in prompt.lower():
                return '{"needs_decomposition": false, "sub_questions": [], "reasoning": "simple"}'
            if "relevance" in prompt.lower() or "rate" in prompt.lower():
                return '{"relevance": 0.8}'
            if "answer" in prompt.lower() or "extract" in prompt.lower():
                return '{"answer": "test answer", "confidence": 0.7, "reasoning": "test"}'
            return '{"node_list": ["0001"]}'

        with patch("treesearch.answer.achat", side_effect=mock_achat), \
             patch("treesearch.search.achat", side_effect=mock_achat), \
             patch("treesearch.query_decompose.achat", side_effect=mock_achat):
            result = await ask(
                query="test question",
                documents=sample_documents,
                decompose=True,
            )

        assert isinstance(result, AnswerResult)


# ---------------------------------------------------------------------------
# ask_sync
# ---------------------------------------------------------------------------

class TestAskSync:
    def test_sync_wrapper(self, sample_documents):
        async def mock_achat(prompt, **kwargs):
            if "relevance" in prompt.lower() or "rate" in prompt.lower():
                return '{"relevance": 0.8}'
            return '{"answer": "sync answer", "confidence": 0.7, "reasoning": "test"}'

        with patch("treesearch.answer.achat", side_effect=mock_achat), \
             patch("treesearch.search.achat", side_effect=mock_achat):
            result = ask_sync(
                query="test",
                documents=sample_documents,
                strategy="best_first",
            )

        assert isinstance(result, AnswerResult)
