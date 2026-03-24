# -*- coding: utf-8 -*-
"""
@description: LlamaIndex retriever adapter for TreeSearch.

Wraps a ``TreeSearch`` instance as a LlamaIndex ``BaseRetriever`` so that
TreeSearch can be used as the retrieval backend in any LlamaIndex query
engine or pipeline.

Usage::

    from treesearch import TreeSearch
    from treesearch.integrations.llamaindex import TreeSearchNodeRetriever

    ts = TreeSearch("docs/", "src/")
    retriever = TreeSearchNodeRetriever(ts=ts)

    # Use like any LlamaIndex retriever:
    nodes = retriever.retrieve("How does authentication work?")

    # Or build a query engine on top:
    from llama_index.core.query_engine import RetrieverQueryEngine
    query_engine = RetrieverQueryEngine(retriever=retriever)
    response = query_engine.query("authentication flow")

Configuration::

    retriever = TreeSearchNodeRetriever(ts=ts, max_nodes=10, top_k_docs=5)
    retriever = TreeSearchNodeRetriever(ts=ts, search_mode="tree")

Result format::

    Each ``NodeWithScore`` contains a ``TextNode`` with:
      text          — the node's full text (``TextNode.text``)
      metadata:
        source      — document name (e.g. filename)
        doc_id      — TreeSearch document identifier
        node_id     — TreeSearch internal node identifier
        title       — section heading
        line_start  — first line of the node in the source file (int or None)
        line_end    — last line of the node in the source file (int or None)
        search_mode — "flat" or "tree"
      score         — BM25 relevance score (float, higher = more relevant)
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy import guard — give a helpful error when llama-index is not installed.
# ---------------------------------------------------------------------------
try:
    from llama_index.core.base.base_retriever import BaseRetriever as LIBaseRetriever
    from llama_index.core.schema import NodeWithScore, QueryBundle, TextNode

    _LLAMAINDEX_AVAILABLE = True
except ImportError:  # pragma: no cover
    _LLAMAINDEX_AVAILABLE = False

    class LIBaseRetriever:  # type: ignore[no-redef]
        pass

    class NodeWithScore:  # type: ignore[no-redef]
        pass

    class QueryBundle:  # type: ignore[no-redef]
        pass

    class TextNode:  # type: ignore[no-redef]
        pass


if TYPE_CHECKING:
    from treesearch import TreeSearch


def _require_llamaindex() -> None:
    """Raise a helpful ImportError when llama-index-core is not installed."""
    if not _LLAMAINDEX_AVAILABLE:
        raise ImportError(
            "llama-index-core is required to use TreeSearchNodeRetriever.\n"
            "Install it with:\n"
            "    pip install pytreesearch[llamaindex]\n"
            "or:\n"
            "    pip install llama-index-core"
        )


# ---------------------------------------------------------------------------
# Converter
# ---------------------------------------------------------------------------

def _flat_nodes_to_li_nodes(flat_nodes: list[dict], search_mode: str) -> list[NodeWithScore]:
    """Convert TreeSearch flat_nodes to LlamaIndex NodeWithScore objects.

    ``flat_nodes`` is the ``result["flat_nodes"]`` list returned by
    ``TreeSearch.search()``.
    """
    nodes_with_scores = []
    for node in flat_nodes:
        text = node.get("text") or ""
        text_node = TextNode(
            text=str(text),
            metadata={
                "source": node.get("doc_name", ""),
                "doc_id": node.get("doc_id", ""),
                "node_id": node.get("node_id", ""),
                "title": node.get("title", ""),
                "line_start": node.get("line_start"),
                "line_end": node.get("line_end"),
                "search_mode": search_mode,
            },
        )
        score = float(node.get("score", 0.0))
        nodes_with_scores.append(NodeWithScore(node=text_node, score=score))
    return nodes_with_scores


# ---------------------------------------------------------------------------
# Retriever
# ---------------------------------------------------------------------------

class TreeSearchNodeRetriever(LIBaseRetriever):
    """LlamaIndex ``BaseRetriever`` backed by a ``TreeSearch`` instance.

    Instantiate with a configured ``TreeSearch`` object and use it like any
    other LlamaIndex retriever::

        ts = TreeSearch("docs/")
        retriever = TreeSearchNodeRetriever(ts=ts)
        nodes = retriever.retrieve("authentication flow")
    """

    def __init__(
        self,
        ts: "TreeSearch",
        max_nodes: int = 5,
        top_k_docs: int = 3,
        search_mode: str = "auto",
        **kwargs: Any,
    ) -> None:
        _require_llamaindex()
        super().__init__(**kwargs)
        self._ts = ts
        self._max_nodes = max_nodes
        self._top_k_docs = top_k_docs
        self._search_mode = search_mode

    def _retrieve(self, query_bundle: "QueryBundle") -> List["NodeWithScore"]:
        """Synchronous retrieval — called by LlamaIndex's ``retrieve()``."""
        query = query_bundle.query_str
        result = self._ts.search(
            query,
            max_nodes_per_doc=self._max_nodes,
            top_k_docs=self._top_k_docs,
            search_mode=self._search_mode,
        )
        mode = result.get("mode", "flat")
        flat_nodes = result.get("flat_nodes", [])
        logger.debug(
            "TreeSearchNodeRetriever: query=%r mode=%s nodes=%d",
            query, mode, len(flat_nodes),
        )
        return _flat_nodes_to_li_nodes(flat_nodes, mode)

    async def _aretrieve(self, query_bundle: "QueryBundle") -> List["NodeWithScore"]:
        """Asynchronous retrieval — called by LlamaIndex's ``aretrieve()``."""
        query = query_bundle.query_str
        result = await self._ts.asearch(
            query,
            max_nodes_per_doc=self._max_nodes,
            top_k_docs=self._top_k_docs,
            search_mode=self._search_mode,
        )
        mode = result.get("mode", "flat")
        flat_nodes = result.get("flat_nodes", [])
        logger.debug(
            "TreeSearchNodeRetriever (async): query=%r mode=%s nodes=%d",
            query, mode, len(flat_nodes),
        )
        return _flat_nodes_to_li_nodes(flat_nodes, mode)
