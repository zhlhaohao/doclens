# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tree search over document structures — FTS5-only (default),
              Best-First LLM-enhanced, and the unified multi-document ``search()`` pipeline.
"""
import asyncio
import hashlib
import heapq
import json
import logging
from typing import Optional, Protocol, runtime_checkable

from .llm import achat, count_tokens, extract_json
from .tree import Document
from .config import get_config

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# PreFilter protocol
# ---------------------------------------------------------------------------

@runtime_checkable
class PreFilter(Protocol):
    """Protocol for pre-scoring nodes before tree search.

    Implementations must provide ``score_nodes`` which returns a dict
    mapping node_id -> relevance score for a given query and document.
    Built-in implementation: ``NodeBM25Index``, ``GrepFilter``.
    """

    def score_nodes(self, query: str, doc_id: str) -> dict[str, float]:
        """Return {node_id: score} for nodes in the given document."""
        ...


class GrepFilter:
    """
    Literal string or regex matching filter.

    Provides exact matching capabilities to complement semantic search.
    """

    def __init__(self, documents: list[Document], case_sensitive: bool = False, use_regex: bool = False):
        self._doc_map = {doc.doc_id: doc for doc in documents}
        self.case_sensitive = case_sensitive
        self.use_regex = use_regex

    def score_nodes(self, query: str, doc_id: str) -> dict[str, float]:
        """Return {node_id: 1.0} for nodes that contain the query literal/regex."""
        doc = self._doc_map.get(doc_id)
        if not doc:
            return {}

        results = {}
        pattern = query if self.case_sensitive else query.lower()
        
        import re
        regex = None
        if self.use_regex:
            try:
                regex = re.compile(query, 0 if self.case_sensitive else re.IGNORECASE)
            except re.error:
                logger.warning("Invalid regex in GrepFilter: %s", query)

        def _scan(node):
            nid = node.get("node_id", "")
            title = node.get("title", "")
            summary = node.get("summary", node.get("prefix_summary", ""))
            text = node.get("text", "")
            
            # Match against title, summary, and text
            matched = False
            if regex:
                if regex.search(title) or regex.search(summary) or regex.search(text):
                    matched = True
            else:
                t_title = title if self.case_sensitive else title.lower()
                t_summary = summary if self.case_sensitive else summary.lower()
                t_text = text if self.case_sensitive else text.lower()
                if (t_title and pattern in t_title) or (t_summary and pattern in t_summary) or (t_text and pattern in t_text):
                    matched = True
            
            if matched:
                results[nid] = 1.0
            
            for child in node.get("nodes", []):
                _scan(child)

        structure = doc.structure
        if isinstance(structure, list):
            for item in structure:
                _scan(item)
        else:
            _scan(structure)
            
        return results


# ---------------------------------------------------------------------------
# Text normalizer for cache-friendly prompts
# ---------------------------------------------------------------------------

def _normalize(text: str, max_len: int = 512) -> str:
    """Collapse whitespace and truncate for stable prompt / cache keys."""
    return " ".join(text.strip().split())[:max_len]


def _query_fingerprint(query: str) -> str:
    """Short hash for cache keys."""
    return hashlib.md5(query.encode()).hexdigest()[:12]


# ---------------------------------------------------------------------------
# Tree Search (optional LLM-enhanced strategy)
# ---------------------------------------------------------------------------

class BestFirstTreeSearch:
    """
    Best-first tree search with batch comparative ranking.

    Key optimizations over naive per-node evaluation:
      - Batch eval: rank sibling nodes in one LLM call (comparative > absolute scoring)
      - Context-aware batching: auto-split batches to respect model context window
      - Text excerpts: include node text in prompts for richer context
      - Adaptive depth: flat trees (depth <= threshold) use single batch eval
      - Dynamic threshold: median-based cutoff from first-round scores
      - BM25 prior: optional pre-scoring for initial priority
      - Budget control: max_llm_calls limits total LLM invocations
    """

    # Class-level subtree cache shared across searches
    _subtree_cache: dict[str, dict] = {}
    _SUBTREE_CACHE_MAX_SIZE: int = 10000

    # Default max tokens for batch prompt (leave room for response)
    _DEFAULT_MAX_PROMPT_TOKENS = 60000

    def __init__(
        self,
        document: Document,
        query: str,
        model: Optional[str] = None,
        max_results: int = 5,
        threshold: float = 0.3,
        max_llm_calls: int = 30,
        bm25_scores: Optional[dict[str, float]] = None,
        bm25_weight: float = 0.3,
        depth_penalty: float = 0.02,
        use_subtree_cache: bool = True,
        text_excerpt_len: int = 300,
        adaptive_depth_threshold: int = 2,
        dynamic_threshold: bool = True,
        min_threshold: float = 0.15,
        max_prompt_tokens: int = 0,
    ):
        self.document = document
        self.query = query
        self.model = model
        self.max_results = max_results
        self.threshold = threshold
        self.max_llm_calls = max_llm_calls
        self.bm25_scores = bm25_scores or {}
        self.bm25_weight = bm25_weight
        self.depth_penalty = depth_penalty
        self.use_subtree_cache = use_subtree_cache
        self.text_excerpt_len = text_excerpt_len
        self.adaptive_depth_threshold = adaptive_depth_threshold
        self.dynamic_threshold = dynamic_threshold
        self.min_threshold = min_threshold
        self.max_prompt_tokens = max_prompt_tokens or self._DEFAULT_MAX_PROMPT_TOKENS

        self._llm_calls = 0
        self._value_cache: dict[str, float] = {}
        self._qfp = _query_fingerprint(query)

        # Build node map from document tree
        self._node_map: dict[str, dict] = {}
        self._parent_map: dict[str, Optional[str]] = {}
        self._depth_map: dict[str, int] = {}
        self._build(document.structure, parent_id=None, depth=0)

    @property
    def llm_calls(self) -> int:
        return self._llm_calls

    def _build(self, structure, parent_id: Optional[str], depth: int) -> None:
        if isinstance(structure, list):
            for item in structure:
                self._build(item, parent_id, depth)
        elif isinstance(structure, dict):
            nid = structure.get("node_id", "")
            self._node_map[nid] = structure
            self._parent_map[nid] = parent_id
            self._depth_map[nid] = depth
            for child in structure.get("nodes", []):
                self._build(child, parent_id=nid, depth=depth + 1)

    def _get_summary(self, node: dict) -> str:
        return _normalize(node.get("summary", node.get("prefix_summary", "")))

    def _get_text_excerpt(self, node: dict) -> str:
        """Get text excerpt for richer evaluation context."""
        text = node.get("text", "")
        if text and self.text_excerpt_len > 0:
            return _normalize(text, max_len=self.text_excerpt_len)
        return ""

    def _max_tree_depth(self) -> int:
        """Return the maximum depth in the tree."""
        return max(self._depth_map.values()) if self._depth_map else 0

    def _initial_priority(self, node_id: str) -> float:
        """Compute initial priority from BM25 score and depth penalty."""
        bm25 = self.bm25_scores.get(node_id, 0.0)
        depth = self._depth_map.get(node_id, 0)
        bm25_norm = min(bm25 / max(max(self.bm25_scores.values(), default=1.0), 1e-6), 1.0) if bm25 > 0 else 0.0
        return bm25_norm * self.bm25_weight - depth * self.depth_penalty

    def _build_section_text(self, nid: str, index: int) -> str:
        """Build section text for a single node in batch prompt."""
        node = self._node_map.get(nid)
        if not node:
            return ""
        title = node.get("title", "")
        summary = self._get_summary(node)
        excerpt = self._get_text_excerpt(node)
        section_text = f"Section {index} (node_id: {nid}):\n  Title: {title}\n  Summary: {summary}"
        if excerpt:
            section_text += f"\n  Content: {excerpt}"
        return section_text

    def _build_prompt(self, sections_str: str, num_sections: int = 0) -> str:
        """Build the listwise ranking prompt from sections string.

        Uses listwise ranking (order by relevance) instead of absolute scoring.
        LLMs are more accurate at comparative ordering than absolute calibration.
        """
        return (
            f"Rank these document sections from MOST to LEAST relevant to the query. "
            f"Only include sections that have ANY relevance. "
            f"Omit completely irrelevant sections.\n\n"
            f"Query: {self.query}\n\n"
            f"{sections_str}\n\n"
            f"Return JSON only — node_ids ordered from most to least relevant:\n"
            f'{{"ranked_node_ids": ["most_relevant_id", "second_id", ...]}}'
        )

    def _split_into_batches(self, node_ids: list[str]) -> list[list[str]]:
        """Split node_ids into batches that fit within max_prompt_tokens.

        Estimates token count for each section and groups them so that
        the total prompt stays under the context window limit.
        """
        # Build prompt skeleton (without sections) to measure overhead
        skeleton = self._build_prompt("")
        overhead_tokens = count_tokens(skeleton, model=self.model)
        budget = self.max_prompt_tokens - overhead_tokens

        if budget <= 0:
            # Fallback: one node per batch
            return [[nid] for nid in node_ids]

        batches: list[list[str]] = []
        current_batch: list[str] = []
        current_tokens = 0

        for i, nid in enumerate(node_ids):
            section = self._build_section_text(nid, i + 1)
            section_tokens = count_tokens(section, model=self.model)

            # If a single section exceeds budget, it gets its own batch
            if section_tokens >= budget:
                if current_batch:
                    batches.append(current_batch)
                    current_batch = []
                    current_tokens = 0
                batches.append([nid])
                continue

            if current_tokens + section_tokens > budget:
                batches.append(current_batch)
                current_batch = [nid]
                current_tokens = section_tokens
            else:
                current_batch.append(nid)
                current_tokens += section_tokens

        if current_batch:
            batches.append(current_batch)

        return batches if batches else [node_ids]

    async def _batch_evaluate(self, node_ids: list[str]) -> dict[str, float]:
        """Batch comparative ranking with auto-splitting for context window.

        If the combined prompt exceeds max_prompt_tokens, splits into
        multiple LLM calls automatically.
        """
        if not node_ids:
            return {}

        # Check caches first, only evaluate uncached nodes
        scores: dict[str, float] = {}
        to_evaluate: list[str] = []
        for nid in node_ids:
            if self.use_subtree_cache:
                cache_key = f"{self._qfp}::{nid}"
                cached = BestFirstTreeSearch._subtree_cache.get(cache_key)
                if cached is not None:
                    scores[nid] = cached.get("max_relevance", 0.0)
                    continue
            if nid in self._value_cache:
                scores[nid] = self._value_cache[nid]
                continue
            to_evaluate.append(nid)

        if not to_evaluate:
            return scores

        # Split into batches respecting context window
        batches = self._split_into_batches(to_evaluate)
        logger.debug("Batch evaluate %d nodes in %d batch(es)", len(to_evaluate), len(batches))

        for batch_nids in batches:
            if self._llm_calls >= self.max_llm_calls:
                break

            sections = []
            for i, nid in enumerate(batch_nids):
                section = self._build_section_text(nid, i + 1)
                if section:
                    sections.append(section)

            if not sections:
                continue

            sections_str = "\n".join(sections)
            prompt = self._build_prompt(sections_str, num_sections=len(batch_nids))
            response = await achat(prompt, model=self.model, temperature=0)
            result = extract_json(response)
            self._llm_calls += 1

            # Parse listwise ranking: ranked_node_ids → positional scores
            ranked_ids = result.get("ranked_node_ids", [])
            if ranked_ids:
                n_ranked = len(ranked_ids)
                for rank, nid_raw in enumerate(ranked_ids):
                    nid = str(nid_raw)
                    if nid in self._node_map:
                        # Convert rank to score: top-1 gets ~0.95, decays linearly
                        rel = max(0.95 - rank * (0.8 / max(n_ranked - 1, 1)), 0.1)
                        scores[nid] = rel
                        self._value_cache[nid] = rel
                        if self.use_subtree_cache:
                            cache_key = f"{self._qfp}::{nid}"
                            BestFirstTreeSearch._subtree_cache[cache_key] = {
                                "max_relevance": rel,
                                "depth": self._depth_map.get(nid, 0),
                            }
                            # LRU eviction: drop oldest entries when cache exceeds limit
                            if len(BestFirstTreeSearch._subtree_cache) > BestFirstTreeSearch._SUBTREE_CACHE_MAX_SIZE:
                                excess = len(BestFirstTreeSearch._subtree_cache) - BestFirstTreeSearch._SUBTREE_CACHE_MAX_SIZE
                                for old_key in list(BestFirstTreeSearch._subtree_cache)[:excess]:
                                    del BestFirstTreeSearch._subtree_cache[old_key]
            else:
                # Fallback: try old format (rankings with absolute scores)
                rankings = result.get("rankings", [])
                for item in rankings:
                    nid = str(item.get("node_id", ""))
                    rel = float(item.get("relevance", 0.0))
                    if nid in self._node_map:
                        scores[nid] = rel
                        self._value_cache[nid] = rel
                        if self.use_subtree_cache:
                            cache_key = f"{self._qfp}::{nid}"
                            BestFirstTreeSearch._subtree_cache[cache_key] = {
                                "max_relevance": rel,
                                "depth": self._depth_map.get(nid, 0),
                            }

            # Nodes not returned by LLM in this batch get score 0
            for nid in batch_nids:
                if nid not in scores:
                    scores[nid] = 0.0
                    self._value_cache[nid] = 0.0

        return scores

    def _compute_dynamic_threshold(self, scores: dict[str, float]) -> float:
        """Compute dynamic threshold from median of first-round scores."""
        if not scores:
            return self.threshold
        vals = sorted(scores.values())
        median = vals[len(vals) // 2]
        return max(median * 0.8, self.min_threshold)

    async def _run_flat(self) -> list[dict]:
        """Flat tree mode: use BM25 scoring without LLM.

        For shallow trees (depth <= adaptive_depth_threshold), LLM evaluation
        adds noise without tree-structure advantage. BM25 ranking is more
        reliable and avoids LLM cost.
        """
        scores = dict(self.bm25_scores) if self.bm25_scores else {}

        if not scores:
            # Fall back to LLM batch evaluation if no scores available
            all_ids = list(self._node_map.keys())
            scores = await self._batch_evaluate(all_ids)

        results = []
        for nid, score in scores.items():
            node = self._node_map.get(nid, {})
            if node:
                results.append({
                    "node_id": nid,
                    "title": node.get("title", ""),
                    "score": round(score, 4),
                })

        results.sort(key=lambda x: (-x["score"], x["node_id"]))
        return results[:self.max_results]

    async def run(self) -> list[dict]:
        """
        Run best-first tree search.

        Uses adaptive strategy:
        - Flat trees (depth <= adaptive_depth_threshold): batch evaluate all nodes
        - Deep trees: priority-queue expansion with batch sibling evaluation

        Returns: [{'node_id': str, 'title': str, 'score': float}]
        """
        max_depth = self._max_tree_depth()

        # Adaptive: flat tree -> single-pass batch evaluation
        if max_depth <= self.adaptive_depth_threshold:
            return await self._run_flat()

        # Deep tree: priority-queue based best-first expansion
        pq: list[tuple[float, str]] = []
        visited: set[str] = set()
        results: list[dict] = []

        # Phase 1: batch evaluate root nodes
        root_ids = [n.get("node_id", "") for n in self.document.structure if isinstance(n, dict)]
        root_scores = await self._batch_evaluate(root_ids)
        for rid in root_ids:
            val = root_scores.get(rid, 0.0)
            priority = val + self._initial_priority(rid)
            heapq.heappush(pq, (-priority, rid))

        # Compute dynamic threshold from root scores if enabled
        threshold = self.threshold
        if self.dynamic_threshold and self._value_cache:
            threshold = self._compute_dynamic_threshold(self._value_cache)

        # Phase 2: best-first expansion
        while pq and len(results) < self.max_results and self._llm_calls < self.max_llm_calls:
            neg_score, nid = heapq.heappop(pq)
            score = -neg_score

            if nid in visited:
                continue
            visited.add(nid)

            if score < threshold:
                break

            node = self._node_map.get(nid)
            if not node:
                continue

            children = node.get("nodes", [])
            child_ids = [c.get("node_id", "") for c in children if isinstance(c, dict)]
            unvisited_children = [cid for cid in child_ids if cid not in visited]

            if not child_ids:
                # Leaf node -> collect as result
                llm_score = self._value_cache.get(nid, score)
                results.append({
                    "node_id": nid,
                    "title": node.get("title", ""),
                    "score": round(llm_score, 4),
                })
            else:
                # Non-leaf: batch evaluate children
                if unvisited_children and self._llm_calls < self.max_llm_calls:
                    child_scores = await self._batch_evaluate(unvisited_children)
                    for cid in unvisited_children:
                        cval = child_scores.get(cid, 0.0)
                        priority = cval + self._initial_priority(cid)
                        heapq.heappush(pq, (-priority, cid))

                # Non-leaf node itself can also be a result if relevant
                llm_score = self._value_cache.get(nid, score)
                if llm_score >= threshold:
                    results.append({
                        "node_id": nid,
                        "title": node.get("title", ""),
                        "score": round(llm_score, 4),
                    })

        results.sort(key=lambda x: (-x["score"], x["node_id"]))
        return results[:self.max_results]

    @classmethod
    def clear_subtree_cache(cls):
        """Clear the shared subtree cache."""
        cls._subtree_cache.clear()




# ---------------------------------------------------------------------------
# Document routing (pure LLM reasoning, no vector embeddings)
# ---------------------------------------------------------------------------

async def route_documents(
    query: str,
    documents: list[Document],
    model: Optional[str] = None,
    top_k: int = 3,
) -> list[Document]:
    """
    Route query to relevant documents by LLM reasoning over descriptions.

    No vector embeddings or chunk splitting needed.
    """
    doc_list = [
        {"doc_id": d.doc_id, "doc_name": d.doc_name, "doc_description": d.doc_description}
        for d in documents
    ]
    prompt = (
        f"Select documents relevant to the query.\n\n"
        f"Query: {query}\n\n"
        f"Documents: {json.dumps(doc_list, indent=2, ensure_ascii=False)}\n\n"
        f'Return JSON only:\n'
        f'{{"selected_doc_ids": ["doc_id_1", "doc_id_2"]}}'
    )

    response = await achat(prompt, model=model, temperature=0)
    result = extract_json(response)
    selected_ids = result.get("selected_doc_ids", [])

    selected = [d for d in documents if d.doc_id in selected_ids][:top_k]
    if not selected:
        selected = documents[:top_k]
    return selected


# ---------------------------------------------------------------------------
# Unified search API
# ---------------------------------------------------------------------------

def _get_ancestor_titles(doc: Document, node_id: str) -> list[str]:
    """Get ancestor node titles for context anchoring."""
    titles = []
    # Build parent map
    parent_map = {}

    def _scan(structure, parent_id=None):
        if isinstance(structure, list):
            for item in structure:
                _scan(item, parent_id)
        elif isinstance(structure, dict):
            nid = structure.get("node_id", "")
            parent_map[nid] = parent_id
            for child in structure.get("nodes", []):
                _scan(child, nid)

    _scan(doc.structure)

    pid = parent_map.get(node_id)
    while pid:
        pnode = doc.get_node_by_id(pid)
        if pnode:
            titles.append(pnode.get("title", ""))
        pid = parent_map.get(pid)

    titles.reverse()
    return titles


def _attach_node_fields(
    nodes: list[dict],
    doc: Document,
    text_mode: str = "full",
    include_ancestors: bool = False,
) -> None:
    """Attach full node fields to search result nodes."""
    for n in nodes:
        full = doc.get_node_by_id(str(n["node_id"]))
        if not full:
            continue

        if text_mode == "full":
            n["text"] = full.get("text", "")
        elif text_mode == "summary":
            n["text"] = full.get("summary", full.get("prefix_summary", ""))
        # text_mode == "none": no text attached

        n["summary"] = full.get("summary", full.get("prefix_summary", ""))
        n["line_start"] = full.get("line_start")
        n["line_end"] = full.get("line_end")

        if include_ancestors:
            n["ancestors"] = _get_ancestor_titles(doc, str(n["node_id"]))


def _merge_doc_results(
    doc_results: list[dict],
    merge_strategy: str = "interleave",
) -> list[dict]:
    """Apply merge strategy to multi-document results."""
    if merge_strategy == "per_doc":
        return [r for r in doc_results if r.get("nodes")]

    if merge_strategy == "global_score":
        # Flatten all nodes with doc info, sort globally by score
        all_nodes = []
        for r in doc_results:
            for node in r.get("nodes", []):
                node_copy = dict(node)
                node_copy["_doc_id"] = r.get("doc_id", "")
                node_copy["_doc_name"] = r.get("doc_name", "")
                all_nodes.append(node_copy)
        all_nodes.sort(key=lambda x: (-x.get("score", 0), x.get("node_id", "")))

        # Re-group by doc but preserve global order
        seen_docs = {}
        merged = []
        for node in all_nodes:
            did = node.pop("_doc_id", "")
            dname = node.pop("_doc_name", "")
            if did not in seen_docs:
                seen_docs[did] = {"doc_id": did, "doc_name": dname, "nodes": []}
                merged.append(seen_docs[did])
            seen_docs[did]["nodes"].append(node)
        return merged

    # Default: interleave (current behavior)
    return [r for r in doc_results if r.get("nodes")]


async def search(
    query: str,
    documents: list[Document],
    model: Optional[str] = None,
    top_k_docs: int = 3,
    max_nodes_per_doc: int = 5,
    strategy: str = "fts5_only",
    value_threshold: float = 0.3,
    max_llm_calls: int = 30,
    use_bm25: bool = True,
    pre_filter: Optional[PreFilter] = None,
    text_mode: str = "full",
    include_ancestors: bool = False,
    merge_strategy: str = "interleave",
) -> dict:
    """
    Search across one or more documents using tree-structured retrieval.

    This is the primary API. It natively supports multi-document search:
      1. Route query to relevant documents (LLM reasoning, no vector DB)
      2. (Optional) Pre-filter scoring over tree nodes for initial ranking
      3. Tree search within each document (fts5_only / best_first)
      4. Return ranked nodes with text content

    Args:
        query: user query
        documents: list of Document objects (single or multiple)
        model: LLM model name
        top_k_docs: max documents to search (routing stage)
        max_nodes_per_doc: max result nodes per document
        strategy: 'fts5_only' (default) or 'best_first'
                  'fts5_only' uses pure FTS5/BM25 scoring without any LLM calls (fastest)
                  'best_first' uses BM25 pre-scoring + LLM batch ranking (highest quality)
        value_threshold: minimum relevance score
        max_llm_calls: max LLM calls per document (only for best_first)
        use_bm25: enable built-in BM25 pre-scoring (ignored if pre_filter is set)
        pre_filter: custom PreFilter instance for node pre-scoring (overrides use_bm25)
        text_mode: 'full' (default) | 'summary' | 'none' - controls text in results
        include_ancestors: attach ancestor titles for context anchoring
        merge_strategy: 'interleave' (default) | 'per_doc' | 'global_score'

    Returns:
        dict with 'documents' (list) and 'query' (str).
        documents: [{'doc_id', 'doc_name', 'nodes': [{'node_id', 'title', 'text', 'score'}]}]
    """

    # Stage 1: document routing (skip for single doc or fts5_only)
    if len(documents) <= 1 or strategy == "fts5_only":
        selected = documents[:top_k_docs] if strategy == "fts5_only" else documents
    else:
        selected = await route_documents(query, documents, model, top_k=top_k_docs)

    logger.info("Selected %d documents: %s", len(selected), [d.doc_name for d in selected])

    # Stage 1.5: Pre-filter scoring (for best_first, fts5_only)
    scorer = pre_filter
    if scorer is None and strategy in ("best_first", "fts5_only") and selected:
        fts_cfg = get_config().fts
        if fts_cfg.enabled or strategy == "fts5_only":
            from .fts import get_fts_index
            fts_index = get_fts_index(db_path=fts_cfg.db_path or None)
            for doc in selected:
                if not fts_index.is_document_indexed(doc.doc_id):
                    fts_index.index_document(doc)
            scorer = fts_index
        elif use_bm25:
            from .rank_bm25 import NodeBM25Index
            scorer = NodeBM25Index(selected)

    # Stage 2: tree search within each document (concurrent)
    async def _search_doc(doc: Document) -> dict:

        if strategy == "fts5_only":
            # Pure FTS5/BM25 scoring — zero LLM calls, millisecond-level
            nodes = []
            if scorer is not None:
                score_map = scorer.score_nodes(query, doc.doc_id)
                for nid, score in sorted(score_map.items(), key=lambda x: -x[1]):
                    full_node = doc.get_node_by_id(nid)
                    nodes.append({
                        "node_id": nid,
                        "title": full_node.get("title", "") if full_node else "",
                        "score": round(score, 4),
                    })
                    if len(nodes) >= max_nodes_per_doc:
                        break

        elif strategy == "best_first":
            bf_cfg = get_config().best_first

            bm25_scores = {}
            if scorer is not None:
                bm25_scores = scorer.score_nodes(query, doc.doc_id)

            searcher = BestFirstTreeSearch(
                document=doc,
                query=query,
                model=model,
                max_results=max_nodes_per_doc,
                threshold=value_threshold,
                max_llm_calls=max_llm_calls,
                bm25_scores=bm25_scores,
                bm25_weight=bf_cfg.bm25_weight,
                depth_penalty=bf_cfg.depth_penalty,
                text_excerpt_len=bf_cfg.text_excerpt_len,
                adaptive_depth_threshold=bf_cfg.adaptive_depth_threshold,
                dynamic_threshold=bf_cfg.dynamic_threshold,
                min_threshold=bf_cfg.min_threshold,
            )
            nodes = await searcher.run()

        else:
            raise ValueError(f"Unknown strategy: {strategy!r}. Use 'fts5_only' or 'best_first'.")

        # Attach full node fields to results
        _attach_node_fields(nodes, doc, text_mode=text_mode, include_ancestors=include_ancestors)

        return {"doc_id": doc.doc_id, "doc_name": doc.doc_name, "nodes": nodes}

    doc_results = await asyncio.gather(*(_search_doc(d) for d in selected))

    # Stage 3: merge results across documents
    merged = _merge_doc_results(list(doc_results), merge_strategy)

    return {
        "documents": merged,
        "query": query,
    }



def search_sync(query: str, documents: list[Document], **kwargs) -> dict:
    """Synchronous wrapper around :func:`search`."""
    return asyncio.run(search(query, documents, **kwargs))
