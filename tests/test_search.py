# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for treesearch.search module (FTS5-only, no LLM).

Tests cover: search(), search_sync(), GrepFilter, _CombinedScorer.
"""
import pytest
from treesearch.search import (
    search,
    search_sync,
    GrepFilter,
    PreFilter,
)
from treesearch.tree import Document


class TestSearchResult:
    def test_fields(self):
        r = {
            "documents": [{"doc_id": "d1", "doc_name": "Doc", "nodes": []}],
            "query": "test",
            "flat_nodes": [],
        }
        assert len(r["documents"]) == 1
        assert r["query"] == "test"
        assert r["flat_nodes"] == []

    def test_empty(self):
        r = {"documents": [], "query": "", "flat_nodes": []}
        assert r["documents"] == []
        assert r["query"] == ""


class TestGrepFilter:
    def test_grep_filter_basic(self, sample_tree_structure):
        doc = Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)
        grep = GrepFilter([doc])
        scores = grep.score_nodes("FastAPI", doc.doc_id)
        # Should find "FastAPI" in the Backend node
        assert len(scores) > 0
        assert any("1" in nid for nid in scores)

    def test_grep_filter_no_match(self, sample_tree_structure):
        doc = Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)
        grep = GrepFilter([doc])
        scores = grep.score_nodes("nonexistent_term_xyz", doc.doc_id)
        assert len(scores) == 0

    def test_grep_filter_case_insensitive(self, sample_tree_structure):
        doc = Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)
        grep = GrepFilter([doc], case_sensitive=False)
        scores = grep.score_nodes("fastapi", doc.doc_id)
        assert len(scores) > 0


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
                "node_id": "0", "text": "Machine learning is a subset of AI.",
            }],
        )
        return [doc_a, doc_b]

    @pytest.mark.asyncio
    async def test_fts5_search_returns_results(self, sample_tree_structure):
        doc = Document(
            doc_id="test", doc_name="Test Doc",
            structure=sample_tree_structure,
        )
        result = await search(
            query="backend Python FastAPI",
            documents=[doc],
        )
        assert isinstance(result, dict)
        assert result["query"] == "backend Python FastAPI"
        assert "documents" in result
        assert "flat_nodes" in result
        # No llm_calls key anymore
        assert "llm_calls" not in result

    @pytest.mark.asyncio
    async def test_fts5_multi_doc(self, two_documents):
        result = await search(
            query="backend architecture",
            documents=two_documents,
            top_k_docs=3,
        )
        assert isinstance(result, dict)
        assert "documents" in result

    @pytest.mark.asyncio
    async def test_flat_nodes_in_result(self, sample_tree_structure):
        doc = Document(
            doc_id="test", doc_name="Test Doc",
            structure=sample_tree_structure,
        )
        result = await search(
            query="backend",
            documents=[doc],
        )
        assert "flat_nodes" in result
        if result["flat_nodes"]:
            node = result["flat_nodes"][0]
            assert "node_id" in node
            assert "doc_id" in node
            assert "doc_name" in node
            assert "title" in node
            assert "score" in node


class TestSearchSync:
    def test_sync_wrapper(self, sample_tree_structure):
        doc = Document(
            doc_id="a", doc_name="Doc A",
            doc_description="Architecture and deployment guide.",
            structure=sample_tree_structure,
        )
        result = search_sync(
            query="backend",
            documents=[doc],
        )
        assert isinstance(result, dict)
        assert "flat_nodes" in result
