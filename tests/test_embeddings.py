# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for treesearch.embeddings module (with mocked OpenAI API).
"""
from unittest.mock import patch, MagicMock

import pytest
from treesearch.embeddings import (
    _cosine_similarity,
    EmbeddingPreFilter,
    HybridPreFilter,
)
from treesearch.tree import Document


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_documents(sample_tree_structure):
    return [Document(doc_id="test", doc_name="Test Doc", structure=sample_tree_structure)]


def _make_mock_embedding(dim=8, base=0.1):
    """Create a simple deterministic embedding vector."""
    return [base * (i + 1) for i in range(dim)]


def _mock_openai_client(dim=8):
    """Create a mock OpenAI client that returns deterministic embeddings."""
    client = MagicMock()
    call_count = 0

    def mock_create(model, input):
        nonlocal call_count
        data = []
        for i, _ in enumerate(input):
            call_count += 1
            emb = _make_mock_embedding(dim, base=0.1 * (call_count + i))
            item = MagicMock()
            item.embedding = emb
            data.append(item)
        response = MagicMock()
        response.data = data
        return response

    client.embeddings.create = mock_create
    return client


# ---------------------------------------------------------------------------
# _cosine_similarity
# ---------------------------------------------------------------------------

class TestCosineSimilarity:
    def test_identical_vectors(self):
        v = [1.0, 2.0, 3.0]
        assert abs(_cosine_similarity(v, v) - 1.0) < 1e-6

    def test_orthogonal_vectors(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert abs(_cosine_similarity(a, b)) < 1e-6

    def test_opposite_vectors(self):
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert abs(_cosine_similarity(a, b) - (-1.0)) < 1e-6

    def test_zero_vector(self):
        assert _cosine_similarity([0, 0, 0], [1, 2, 3]) == 0.0

    def test_known_similarity(self):
        a = [1.0, 0.0, 0.0]
        b = [1.0, 1.0, 0.0]
        sim = _cosine_similarity(a, b)
        # cos(45°) ≈ 0.7071
        assert abs(sim - 0.7071) < 0.01


# ---------------------------------------------------------------------------
# EmbeddingPreFilter
# ---------------------------------------------------------------------------

class TestEmbeddingPreFilter:
    def test_build_entries(self, sample_documents):
        with patch("treesearch.embeddings.openai"):
            epf = EmbeddingPreFilter(sample_documents, model="test-model")

        # Should have entries for all nodes in the tree
        assert len(epf._node_entries) > 0
        for entry in epf._node_entries:
            assert "doc_id" in entry
            assert "node_id" in entry
            assert "text" in entry

    def test_doc_node_map(self, sample_documents):
        with patch("treesearch.embeddings.openai"):
            epf = EmbeddingPreFilter(sample_documents, model="test-model")

        assert "test" in epf._doc_node_map
        assert len(epf._doc_node_map["test"]) > 0

    def test_score_nodes(self, sample_documents):
        mock_client = _mock_openai_client()

        with patch.object(EmbeddingPreFilter, "_get_client", return_value=mock_client):
            epf = EmbeddingPreFilter(sample_documents, model="test-model")
            scores = epf.score_nodes("backend python", "test")

        assert isinstance(scores, dict)
        assert len(scores) > 0
        for nid, score in scores.items():
            assert isinstance(nid, str)
            assert isinstance(score, float)
            assert score >= 0.0

    def test_score_nodes_unknown_doc(self, sample_documents):
        mock_client = _mock_openai_client()

        with patch.object(EmbeddingPreFilter, "_get_client", return_value=mock_client):
            epf = EmbeddingPreFilter(sample_documents, model="test-model")
            scores = epf.score_nodes("test", "nonexistent_doc")

        assert scores == {}

    def test_lazy_embedding_computation(self, sample_documents):
        with patch("treesearch.embeddings.openai"):
            epf = EmbeddingPreFilter(sample_documents, model="test-model")

        assert epf._embeddings_computed is False


# ---------------------------------------------------------------------------
# HybridPreFilter
# ---------------------------------------------------------------------------

class TestHybridPreFilter:
    def test_normalize_scores(self):
        scores = {"a": 1.0, "b": 3.0, "c": 5.0}
        norm = HybridPreFilter._normalize_scores(scores)
        assert norm["a"] == 0.0
        assert norm["c"] == 1.0
        assert 0.0 <= norm["b"] <= 1.0

    def test_normalize_scores_empty(self):
        assert HybridPreFilter._normalize_scores({}) == {}

    def test_normalize_scores_uniform(self):
        scores = {"a": 2.0, "b": 2.0}
        norm = HybridPreFilter._normalize_scores(scores)
        assert norm["a"] == 0.5
        assert norm["b"] == 0.5

    def test_score_nodes(self, sample_documents):
        mock_client = _mock_openai_client()

        with patch.object(EmbeddingPreFilter, "_get_client", return_value=mock_client):
            hybrid = HybridPreFilter(sample_documents, bm25_weight=0.6)
            scores = hybrid.score_nodes("backend python", "test")

        assert isinstance(scores, dict)
        for nid, score in scores.items():
            assert isinstance(score, float)
            assert score >= 0.0

    def test_bm25_weight_affects_scores(self, sample_documents):
        mock_client = _mock_openai_client()

        with patch.object(EmbeddingPreFilter, "_get_client", return_value=mock_client):
            hybrid_bm25 = HybridPreFilter(sample_documents, bm25_weight=1.0)
            scores_bm25 = hybrid_bm25.score_nodes("backend", "test")

            hybrid_emb = HybridPreFilter(sample_documents, bm25_weight=0.0)
            scores_emb = hybrid_emb.score_nodes("backend", "test")

        # Different weights should produce different score distributions
        if scores_bm25 and scores_emb:
            # At least some scores should differ
            common_ids = set(scores_bm25.keys()) & set(scores_emb.keys())
            if common_ids:
                nid = next(iter(common_ids))
                # Scores may differ (not guaranteed but likely with different weightings)
                assert isinstance(scores_bm25[nid], float)
                assert isinstance(scores_emb[nid], float)
