# -*- coding: utf-8 -*-
"""
@description: LangChain retriever adapter for TreeSearch.

Wraps a ``TreeSearch`` instance as a LangChain ``BaseRetriever`` so that
TreeSearch can be used as the retrieval backend in any LangChain chain or
agent without changes to the core library.

Usage::

    from treesearch import TreeSearch
    from treesearch.integrations.langchain import TreeSearchRetriever

    ts = TreeSearch("docs/", "src/")
    retriever = TreeSearchRetriever(ts=ts)

    # Use like any LangChain retriever:
    docs = retriever.invoke("How does authentication work?")

    # Or in a chain:
    from langchain_core.runnables import RunnablePassthrough
    chain = {"context": retriever, "question": RunnablePassthrough()} | prompt | llm

Configuration::

    # Tune how many nodes / documents are returned:
    retriever = TreeSearchRetriever(ts=ts, max_nodes=10, top_k_docs=5)

    # Use tree search mode for academic papers:
    retriever = TreeSearchRetriever(ts=ts, search_mode="tree")

Result format::

    Each LangChain ``Document`` returned has:
      page_content  — the node's full text
      metadata:
        source      — document name (e.g. filename)
        node_id     — TreeSearch internal node identifier
        title       — section heading
        score       — BM25 relevance score (float, higher = more relevant)
        line_start  — first line of the node in the source file (int or None)
        line_end    — last line of the node in the source file (int or None)
        doc_id      — TreeSearch document identifier
        search_mode — "flat" or "tree" (whichever was used)
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy import guard — give a helpful error when langchain is not installed.
# ---------------------------------------------------------------------------
try:
    from langchain_core.callbacks import CallbackManagerForRetrieverRun
    from langchain_core.documents import Document as LCDocument
    from langchain_core.retrievers import BaseRetriever

    _LANGCHAIN_AVAILABLE = True
except ImportError:  # pragma: no cover
    _LANGCHAIN_AVAILABLE = False

    # Define placeholder so the class body can still be parsed even without
    # langchain installed. The __init_subclass__ check below will raise at
    # instantiation time with a clear message.
    class BaseRetriever:  # type: ignore[no-redef]
        pass

    class LCDocument:  # type: ignore[no-redef]
        pass

    class CallbackManagerForRetrieverRun:  # type: ignore[no-redef]
        pass


if TYPE_CHECKING:
    from treesearch import TreeSearch


def _require_langchain() -> None:
    """Raise a helpful ImportError when langchain-core is not installed."""
    if not _LANGCHAIN_AVAILABLE:
        raise ImportError(
            "langchain-core is required to use TreeSearchRetriever.\n"
            "Install it with:\n"
            "    pip install pytreesearch[langchain]\n"
            "or:\n"
            "    pip install langchain-core"
        )


# ---------------------------------------------------------------------------
# Converter
# ---------------------------------------------------------------------------

def _flat_nodes_to_lc_docs(flat_nodes: list[dict], search_mode: str) -> list[LCDocument]:
    """Convert TreeSearch flat_nodes to LangChain Documents.

    ``flat_nodes`` is the ``result["flat_nodes"]`` list returned by
    ``TreeSearch.search()``.  Each entry is a dict with keys:
    ``node_id``, ``doc_id``, ``doc_name``, ``title``, ``score``, ``text``.

    Optionally: ``line_start``, ``line_end``.
    """
    docs = []
    for node in flat_nodes:
        text = node.get("text") or ""
        doc = LCDocument(
            page_content=str(text),
            metadata={
                "source": node.get("doc_name", ""),
                "doc_id": node.get("doc_id", ""),
                "node_id": node.get("node_id", ""),
                "title": node.get("title", ""),
                "score": round(float(node.get("score", 0.0)), 6),
                "line_start": node.get("line_start"),
                "line_end": node.get("line_end"),
                "search_mode": search_mode,
            },
        )
        docs.append(doc)
    return docs


# ---------------------------------------------------------------------------
# Retriever
# ---------------------------------------------------------------------------

class TreeSearchRetriever(BaseRetriever):
    """LangChain ``BaseRetriever`` backed by a ``TreeSearch`` instance.

    Instantiate with a configured ``TreeSearch`` object and use it like any
    other LangChain retriever::

        ts = TreeSearch("docs/")
        retriever = TreeSearchRetriever(ts=ts)
        docs = retriever.invoke("authentication flow")

    The retriever is stateless — all state lives in the wrapped ``ts`` object.
    """

    # Pydantic v2 field declarations.
    # BaseRetriever.model_config already sets arbitrary_types_allowed=True,
    # so ``ts: Any`` is accepted without a custom Config class.
    ts: Any  # TreeSearch instance
    max_nodes: int = 5
    top_k_docs: int = 3
    search_mode: str = "auto"

    def __init__(self, ts: "TreeSearch", **kwargs: Any) -> None:
        _require_langchain()
        super().__init__(ts=ts, **kwargs)

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> List[LCDocument]:
        """Synchronous retrieval — called by LangChain's ``invoke()``."""
        result = self.ts.search(
            query,
            max_nodes_per_doc=self.max_nodes,
            top_k_docs=self.top_k_docs,
            search_mode=self.search_mode,
        )
        mode = result.get("mode", "flat")
        flat_nodes = result.get("flat_nodes", [])
        logger.debug(
            "TreeSearchRetriever: query=%r mode=%s nodes=%d",
            query, mode, len(flat_nodes),
        )
        return _flat_nodes_to_lc_docs(flat_nodes, mode)

    async def _aget_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> List[LCDocument]:
        """Asynchronous retrieval — called by LangChain's ``ainvoke()``."""
        result = await self.ts.asearch(
            query,
            max_nodes_per_doc=self.max_nodes,
            top_k_docs=self.top_k_docs,
            search_mode=self.search_mode,
        )
        mode = result.get("mode", "flat")
        flat_nodes = result.get("flat_nodes", [])
        logger.debug(
            "TreeSearchRetriever (async): query=%r mode=%s nodes=%d",
            query, mode, len(flat_nodes),
        )
        return _flat_nodes_to_lc_docs(flat_nodes, mode)
