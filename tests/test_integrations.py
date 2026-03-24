# -*- coding: utf-8 -*-
"""
@description: Tests for treesearch.integrations (LangChain + LlamaIndex adapters).

Strategy: mock the external framework dependencies so these tests run in the
standard CI environment without requiring langchain-core or llama-index-core to
be installed.  The tests verify the adapter logic itself (field mapping, error
handling, empty-result behaviour) rather than the external framework's internals.
"""
import sys
from types import ModuleType
from unittest.mock import MagicMock, AsyncMock, patch
import pytest

from treesearch import TreeSearch
from treesearch.tree import Document


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_ts_with_docs(sample_tree_structure) -> TreeSearch:
    """Return an in-memory TreeSearch with one pre-indexed document."""
    ts = TreeSearch(db_path=None)
    doc = Document(
        doc_id="doc1",
        doc_name="auth.md",
        structure=sample_tree_structure,
        metadata={"source_path": "/fake/auth.md"},
        source_type="markdown",
    )
    ts.documents = [doc]
    return ts


def _fake_search_result(query: str = "test") -> dict:
    return {
        "documents": [
            {
                "doc_id": "doc1",
                "doc_name": "auth.md",
                "nodes": [
                    {
                        "node_id": "1",
                        "title": "Backend",
                        "score": 0.85,
                        "text": "The backend is built with Python and FastAPI.",
                        "line_start": 5,
                        "line_end": 10,
                    }
                ],
            }
        ],
        "query": query,
        "flat_nodes": [
            {
                "node_id": "1",
                "doc_id": "doc1",
                "doc_name": "auth.md",
                "title": "Backend",
                "score": 0.85,
                "text": "The backend is built with Python and FastAPI.",
                "line_start": 5,
                "line_end": 10,
            }
        ],
        "mode": "flat",
    }


# ---------------------------------------------------------------------------
# LangChain adapter tests
# ---------------------------------------------------------------------------

class TestLangChainRetriever:
    def test_import_error_without_langchain(self, monkeypatch):
        """When langchain-core is not installed, import gives a clear error."""
        # Force _LANGCHAIN_AVAILABLE = False
        import treesearch.integrations.langchain as lc_mod
        original = lc_mod._LANGCHAIN_AVAILABLE
        monkeypatch.setattr(lc_mod, "_LANGCHAIN_AVAILABLE", False)
        try:
            with pytest.raises(ImportError, match="langchain-core"):
                lc_mod._require_langchain()
        finally:
            monkeypatch.setattr(lc_mod, "_LANGCHAIN_AVAILABLE", original)

    def test_flat_nodes_to_lc_docs_basic(self):
        """_flat_nodes_to_lc_docs maps fields correctly."""
        try:
            from langchain_core.documents import Document as LCDocument
        except ImportError:
            pytest.skip("langchain-core not installed")

        from treesearch.integrations.langchain import _flat_nodes_to_lc_docs

        flat_nodes = [
            {
                "node_id": "1",
                "doc_id": "doc1",
                "doc_name": "auth.md",
                "title": "Backend",
                "score": 0.85,
                "text": "FastAPI backend text.",
                "line_start": 5,
                "line_end": 10,
            }
        ]
        docs = _flat_nodes_to_lc_docs(flat_nodes, "flat")
        assert len(docs) == 1
        doc = docs[0]
        assert isinstance(doc, LCDocument)
        assert doc.page_content == "FastAPI backend text."
        assert doc.metadata["source"] == "auth.md"
        assert doc.metadata["title"] == "Backend"
        assert doc.metadata["score"] == 0.85
        assert doc.metadata["node_id"] == "1"
        assert doc.metadata["search_mode"] == "flat"

    def test_flat_nodes_to_lc_docs_none_text(self):
        """text=None is converted to empty string, not passed as None."""
        try:
            from langchain_core.documents import Document as LCDocument
        except ImportError:
            pytest.skip("langchain-core not installed")

        from treesearch.integrations.langchain import _flat_nodes_to_lc_docs

        flat_nodes = [{"node_id": "1", "doc_id": "d1", "doc_name": "f.md",
                       "title": "T", "score": 0.5, "text": None}]
        docs = _flat_nodes_to_lc_docs(flat_nodes, "flat")
        assert docs[0].page_content == ""

    def test_flat_nodes_to_lc_docs_empty(self):
        try:
            from treesearch.integrations.langchain import _flat_nodes_to_lc_docs
        except ImportError:
            pytest.skip("langchain-core not installed")

        docs = _flat_nodes_to_lc_docs([], "flat")
        assert docs == []

    def test_retriever_get_relevant_documents(self, sample_tree_structure):
        """TreeSearchRetriever returns LangChain Documents with correct fields."""
        try:
            from treesearch.integrations.langchain import TreeSearchRetriever
        except ImportError:
            pytest.skip("langchain-core not installed")

        ts = _make_ts_with_docs(sample_tree_structure)
        with patch.object(ts, "search", return_value=_fake_search_result()) as mock_search:
            retriever = TreeSearchRetriever(ts=ts)
            docs = retriever.invoke("FastAPI")

        mock_search.assert_called_once()
        assert len(docs) == 1
        assert docs[0].page_content == "The backend is built with Python and FastAPI."
        assert docs[0].metadata["title"] == "Backend"

    def test_retriever_empty_results(self, sample_tree_structure):
        """No results → returns empty list (no exception)."""
        try:
            from treesearch.integrations.langchain import TreeSearchRetriever
        except ImportError:
            pytest.skip("langchain-core not installed")

        empty_result = {"documents": [], "query": "xyz", "flat_nodes": [], "mode": "flat"}
        ts = _make_ts_with_docs(sample_tree_structure)
        with patch.object(ts, "search", return_value=empty_result):
            retriever = TreeSearchRetriever(ts=ts)
            docs = retriever.invoke("nonexistent_query_xyz")

        assert docs == []

    async def test_retriever_aget_relevant_documents(self, sample_tree_structure):
        """Async retrieval path works correctly."""
        try:
            from treesearch.integrations.langchain import TreeSearchRetriever
        except ImportError:
            pytest.skip("langchain-core not installed")

        ts = _make_ts_with_docs(sample_tree_structure)
        with patch.object(ts, "asearch", new=AsyncMock(return_value=_fake_search_result())):
            retriever = TreeSearchRetriever(ts=ts)
            docs = await retriever.ainvoke("FastAPI")

        assert len(docs) == 1
        assert docs[0].metadata["score"] == 0.85


# ---------------------------------------------------------------------------
# LlamaIndex adapter tests
# ---------------------------------------------------------------------------

class TestLlamaIndexRetriever:
    def test_import_error_without_llamaindex(self, monkeypatch):
        """When llama-index-core is not installed, import gives a clear error."""
        import treesearch.integrations.llamaindex as li_mod
        original = li_mod._LLAMAINDEX_AVAILABLE
        monkeypatch.setattr(li_mod, "_LLAMAINDEX_AVAILABLE", False)
        try:
            with pytest.raises(ImportError, match="llama-index-core"):
                li_mod._require_llamaindex()
        finally:
            monkeypatch.setattr(li_mod, "_LLAMAINDEX_AVAILABLE", original)

    def test_flat_nodes_to_li_nodes_basic(self):
        """_flat_nodes_to_li_nodes maps fields correctly."""
        try:
            from llama_index.core.schema import NodeWithScore, TextNode
        except ImportError:
            pytest.skip("llama-index-core not installed")

        from treesearch.integrations.llamaindex import _flat_nodes_to_li_nodes

        flat_nodes = [
            {
                "node_id": "1",
                "doc_id": "doc1",
                "doc_name": "auth.md",
                "title": "Backend",
                "score": 0.85,
                "text": "FastAPI backend text.",
                "line_start": 5,
                "line_end": 10,
            }
        ]
        nodes = _flat_nodes_to_li_nodes(flat_nodes, "flat")
        assert len(nodes) == 1
        nws = nodes[0]
        assert isinstance(nws, NodeWithScore)
        assert isinstance(nws.node, TextNode)
        assert nws.score == 0.85
        assert nws.node.text == "FastAPI backend text."
        assert nws.node.metadata["title"] == "Backend"
        assert nws.node.metadata["search_mode"] == "flat"

    def test_flat_nodes_to_li_nodes_none_text(self):
        """text=None is converted to empty string."""
        try:
            from llama_index.core.schema import TextNode
        except ImportError:
            pytest.skip("llama-index-core not installed")

        from treesearch.integrations.llamaindex import _flat_nodes_to_li_nodes

        flat_nodes = [{"node_id": "1", "doc_id": "d1", "doc_name": "f.md",
                       "title": "T", "score": 0.5, "text": None}]
        nodes = _flat_nodes_to_li_nodes(flat_nodes, "flat")
        assert nodes[0].node.text == ""

    def test_flat_nodes_to_li_nodes_empty(self):
        try:
            from treesearch.integrations.llamaindex import _flat_nodes_to_li_nodes
        except ImportError:
            pytest.skip("llama-index-core not installed")

        nodes = _flat_nodes_to_li_nodes([], "flat")
        assert nodes == []

    def test_retriever_retrieve(self, sample_tree_structure):
        """TreeSearchNodeRetriever.retrieve() returns NodeWithScore list."""
        try:
            from treesearch.integrations.llamaindex import TreeSearchNodeRetriever
            from llama_index.core.schema import NodeWithScore
        except ImportError:
            pytest.skip("llama-index-core not installed")

        ts = _make_ts_with_docs(sample_tree_structure)
        with patch.object(ts, "search", return_value=_fake_search_result()):
            retriever = TreeSearchNodeRetriever(ts=ts)
            nodes = retriever.retrieve("FastAPI")

        assert len(nodes) == 1
        assert isinstance(nodes[0], NodeWithScore)
        assert nodes[0].score == 0.85
        assert "FastAPI" in nodes[0].node.text

    def test_retriever_empty_results(self, sample_tree_structure):
        """No results → returns empty list (no exception)."""
        try:
            from treesearch.integrations.llamaindex import TreeSearchNodeRetriever
        except ImportError:
            pytest.skip("llama-index-core not installed")

        empty_result = {"documents": [], "query": "xyz", "flat_nodes": [], "mode": "flat"}
        ts = _make_ts_with_docs(sample_tree_structure)
        with patch.object(ts, "search", return_value=empty_result):
            retriever = TreeSearchNodeRetriever(ts=ts)
            nodes = retriever.retrieve("nonexistent_query_xyz")

        assert nodes == []

    async def test_retriever_aretrieve(self, sample_tree_structure):
        """Async retrieval path works correctly."""
        try:
            from treesearch.integrations.llamaindex import TreeSearchNodeRetriever
        except ImportError:
            pytest.skip("llama-index-core not installed")

        ts = _make_ts_with_docs(sample_tree_structure)
        with patch.object(ts, "asearch", new=AsyncMock(return_value=_fake_search_result())):
            retriever = TreeSearchNodeRetriever(ts=ts)
            nodes = await retriever.aretrieve("FastAPI")

        assert len(nodes) == 1
        assert nodes[0].score == 0.85
