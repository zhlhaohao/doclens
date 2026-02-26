# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Optional embedding support for hybrid retrieval.

Implements PreFilter protocol for seamless integration with search().
Embedding is optional — BM25 + LLM tree search works without it.

Usage:
    # Pure embedding pre-filter
    emb = EmbeddingPreFilter(documents, model="text-embedding-3-small")
    result = await search(query, documents, pre_filter=emb, use_bm25=False)

    # Hybrid (BM25 + Embedding)
    hybrid = HybridPreFilter(documents, bm25_weight=0.4)
    result = await search(query, documents, pre_filter=hybrid, use_bm25=False)
"""
import asyncio
import logging
import math
from typing import Optional, Callable

import openai

from .rank_bm25 import NodeBM25Index, tokenize
from .tree import Document, flatten_tree

logger = logging.getLogger(__name__)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class EmbeddingPreFilter:
    """
    Embedding-based node pre-filter implementing the PreFilter protocol.

    Uses OpenAI embedding API to compute query-node similarity scores.
    Can replace NodeBM25Index as the pre_filter parameter in search().
    """

    def __init__(
        self,
        documents: list[Document],
        model: str = "text-embedding-3-small",
        api_key: Optional[str] = None,
        batch_size: int = 100,
    ):
        """
        Build embedding index for all document nodes.

        Args:
            documents: list of Document objects
            model: OpenAI embedding model name
            api_key: OpenAI API key (uses env OPENAI_API_KEY if None)
            batch_size: batch size for embedding API calls
        """
        self.model = model
        self.api_key = api_key
        self.batch_size = batch_size

        # Build node -> embedding mapping
        self._node_entries: list[dict] = []  # [{doc_id, node_id, text}]
        self._embeddings: list[list[float]] = []
        self._doc_node_map: dict[str, list[int]] = {}  # doc_id -> [entry_indices]

        self._build_entries(documents)
        # Embeddings are computed lazily on first query
        self._embeddings_computed = False

    def _build_entries(self, documents: list[Document]) -> None:
        """Extract all nodes with their text for embedding."""
        for doc in documents:
            doc_indices = []
            for node in flatten_tree(doc.structure):
                nid = node.get("node_id", "")
                title = node.get("title", "")
                summary = node.get("summary", node.get("prefix_summary", ""))
                text = node.get("text", "")
                # Combine title + summary + text excerpt for embedding
                embed_text = f"{title}. {summary}" if summary else title
                if text:
                    embed_text += f"\n{text[:500]}"

                idx = len(self._node_entries)
                self._node_entries.append({
                    "doc_id": doc.doc_id,
                    "node_id": nid,
                    "text": embed_text,
                })
                doc_indices.append(idx)

            self._doc_node_map[doc.doc_id] = doc_indices

    def _get_client(self) -> openai.OpenAI:
        """Get sync OpenAI client for embedding."""
        import os
        key = self.api_key or os.getenv("OPENAI_API_KEY", "")
        base_url = os.getenv("OPENAI_BASE_URL")
        kw = {"api_key": key}
        if base_url:
            kw["base_url"] = base_url
        return openai.OpenAI(**kw)

    def _compute_embeddings(self) -> None:
        """Compute embeddings for all nodes (batched)."""
        if self._embeddings_computed:
            return

        client = self._get_client()
        texts = [e["text"] for e in self._node_entries]
        all_embeddings = []

        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            try:
                response = client.embeddings.create(model=self.model, input=batch)
                for item in response.data:
                    all_embeddings.append(item.embedding)
            except Exception as e:
                logger.error("Embedding API error: %s", e)
                # Fill with zero vectors on error
                dim = len(all_embeddings[0]) if all_embeddings else 1536
                for _ in batch:
                    all_embeddings.append([0.0] * dim)

        self._embeddings = all_embeddings
        self._embeddings_computed = True
        logger.info("Computed embeddings for %d nodes", len(all_embeddings))

    def _embed_query(self, query: str) -> list[float]:
        """Get embedding for a query string."""
        client = self._get_client()
        try:
            response = client.embeddings.create(model=self.model, input=[query])
            return response.data[0].embedding
        except Exception as e:
            logger.error("Query embedding error: %s", e)
            dim = len(self._embeddings[0]) if self._embeddings else 1536
            return [0.0] * dim

    def score_nodes(self, query: str, doc_id: str) -> dict[str, float]:
        """
        PreFilter protocol: return {node_id: score} for nodes in given document.

        Computes cosine similarity between query embedding and node embeddings.
        """
        self._compute_embeddings()

        query_emb = self._embed_query(query)
        indices = self._doc_node_map.get(doc_id, [])

        scores = {}
        for idx in indices:
            if idx < len(self._embeddings):
                sim = _cosine_similarity(query_emb, self._embeddings[idx])
                nid = self._node_entries[idx]["node_id"]
                scores[nid] = max(sim, 0.0)  # clamp negative similarities

        return scores


class HybridPreFilter:
    """
    Hybrid BM25 + Embedding pre-filter.

    Combines BM25 lexical matching with embedding semantic similarity.
    hybrid_score = alpha * bm25_norm + (1 - alpha) * embedding_norm
    """

    def __init__(
        self,
        documents: list[Document],
        bm25_weight: float = 0.5,
        embedding_model: str = "text-embedding-3-small",
        api_key: Optional[str] = None,
        **bm25_kwargs,
    ):
        """
        Args:
            documents: list of Document objects
            bm25_weight: weight for BM25 scores (1-bm25_weight for embedding)
            embedding_model: embedding model name
            api_key: OpenAI API key
            **bm25_kwargs: additional args for NodeBM25Index
        """
        self.bm25_weight = bm25_weight
        self._bm25 = NodeBM25Index(documents, **bm25_kwargs)
        self._embedding = EmbeddingPreFilter(
            documents, model=embedding_model, api_key=api_key,
        )

    @staticmethod
    def _normalize_scores(scores: dict[str, float]) -> dict[str, float]:
        """Min-max normalize scores to [0, 1]."""
        if not scores:
            return {}
        vals = list(scores.values())
        min_v, max_v = min(vals), max(vals)
        rng = max_v - min_v
        if rng == 0:
            return {k: 0.5 for k in scores}
        return {k: (v - min_v) / rng for k, v in scores.items()}

    def score_nodes(self, query: str, doc_id: str) -> dict[str, float]:
        """
        PreFilter protocol: return hybrid {node_id: score}.

        Combines normalized BM25 and embedding scores.
        """
        bm25_raw = self._bm25.score_nodes(query, doc_id)
        emb_raw = self._embedding.score_nodes(query, doc_id)

        bm25_norm = self._normalize_scores(bm25_raw)
        emb_norm = self._normalize_scores(emb_raw)

        all_ids = set(bm25_norm.keys()) | set(emb_norm.keys())
        alpha = self.bm25_weight

        return {
            nid: alpha * bm25_norm.get(nid, 0.0) + (1 - alpha) * emb_norm.get(nid, 0.0)
            for nid in all_ids
        }
