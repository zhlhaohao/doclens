"""搜索评分管道 — 评分、过滤、降级的公共逻辑"""

from __future__ import annotations

from dataclasses import dataclass, field

from cortex.scoring import calc_proximity_score, compute_composite_score
from cortex import ripgrep as rg_module


@dataclass
class ScoreResult:
    """score_and_rank 的返回值"""

    results: list[tuple] = field(default_factory=list)
    source: str = "fts"  # "fts" | "like" | "ripgrep"
    like_raw: list[dict] | None = None  # LIKE 原始 dict（TUI renderer 需要）


def score_and_rank(
    nodes: list[dict],
    docs: list[dict],
    query: str,
    query_words: list[str],
    idx_manager,
) -> ScoreResult:
    """评分 → 过滤 → 降级 → 排序 → 二次过滤，返回统一结果。

    Args:
        nodes: FTS5 返回的 flat_nodes
        docs: FTS5 返回的 documents（含嵌套节点）
        query: 原始查询字符串
        query_words: 分词结果
        idx_manager: IndexManager 实例（提供配置和 like_search）
    """
    # ---- FTS 无结果：LIKE → ripgrep 降级 ----
    if not nodes:
        return _fallback_no_fts(query, query_words, idx_manager, {})

    # ---- FTS 有结果：评分 → 过滤 ----
    doc_nodes_map, doc_fts_best = _build_doc_maps(nodes, docs)
    all_candidates = _score_nodes(
        doc_nodes_map, doc_fts_best, query_words, idx_manager
    )
    filtered = _filter_candidates(
        all_candidates, query_words, idx_manager.min_keyword_match,
        idx_manager.min_proximity_score, idx_manager.min_score_threshold,
    )

    # ---- 降级到 >= 1 匹配 ----
    if not filtered and query_words:
        filtered = [item for item in all_candidates if item[2] >= 1]

    # ---- 最终降级 ----
    if not filtered:
        return _fallback_no_fts(query, query_words, idx_manager, doc_nodes_map)

    # ---- 排序 + 二次过滤 ----
    scored_results = _rank_results(filtered)
    if idx_manager.min_score_threshold > 0.0:
        scored_results = [
            r for r in scored_results
            if r[0] >= idx_manager.min_score_threshold
        ]

    return ScoreResult(results=scored_results, source="fts")


# ---- 内部辅助函数 ----


def _build_doc_maps(nodes, docs):
    """构建 doc_nodes_map 和 doc_fts_best。"""
    doc_nodes_map: dict[str, list[dict]] = {}
    for doc in docs:
        doc_id = doc.get("doc_id", "")
        doc_nodes_map[doc_id] = list(doc.get("nodes", []))

    doc_fts_best: dict[str, float] = {}
    for node in nodes:
        doc_id = node.get("doc_id", "")
        score = node.get("score", 0.0)
        if doc_id not in doc_fts_best or score > doc_fts_best[doc_id]:
            doc_fts_best[doc_id] = score

    return doc_nodes_map, doc_fts_best


def _score_nodes(doc_nodes_map, doc_fts_best, query_words, idx_manager):
    """对每个文档的所有节点计算综合评分，每文档取 top N。"""
    doc_best: dict[str, list[tuple]] = {}
    for doc_id in doc_nodes_map:
        all_nodes = doc_nodes_map[doc_id]
        node_scores: list[tuple] = []
        for n in all_nodes:
            n_text = n.get("text", "") or ""
            cnt, proximity = calc_proximity_score(
                n_text, query_words, max_span=idx_manager.max_span
            )
            if cnt > 0:
                composite, factors = compute_composite_score(
                    matched_count=cnt,
                    total_keywords=len(query_words),
                    doc_name=doc_id,
                    node_title=n.get("title", ""),
                    fts_score=doc_fts_best.get(doc_id, 0.0),
                    query_words=query_words,
                    weights=idx_manager.scoring_weights,
                    proximity=proximity,
                )
                node_scores.append((n, cnt, proximity, composite, factors))
        node_scores.sort(key=lambda x: -x[3])
        top_n = node_scores[: idx_manager.max_nodes_per_doc]
        if top_n:
            doc_best[doc_id] = [
                (n, cnt, prox, doc_fts_best.get(doc_id, 0.0), composite, factors)
                for n, cnt, prox, composite, factors in top_n
            ]

    all_candidates = []
    for did, node_list in doc_best.items():
        for bn, cnt, prox, fts, composite, _factors in node_list:
            all_candidates.append((did, bn, cnt, prox, fts, composite))
    return all_candidates


def _filter_candidates(all_candidates, query_words, min_keyword_match,
                       min_proximity_score, min_score_threshold):
    """初始过滤：composite >= threshold OR (关键词匹配 AND 邻近度)。"""
    return [
        item
        for item in all_candidates
        if item[5] >= min_score_threshold
        or (item[2] >= min_keyword_match and item[3] >= min_proximity_score)
    ]


def _rank_results(filtered):
    """按综合评分排序，返回 [(composite, (doc_id, node, matched, prox, fts))]。"""
    scored_results = []
    for item in filtered:
        did, display_node, matched, prox, fts, composite = item[:6]
        scored_results.append((composite, (did, display_node, matched, prox, fts)))
    scored_results.sort(key=lambda x: -x[0])
    return scored_results


def _fallback_no_fts(query, query_words, idx_manager, doc_nodes_map):
    """FTS 无结果时的降级路径：LIKE → ripgrep。"""
    like_results = idx_manager.like_search(query, max_results=idx_manager.max_results)
    if like_results:
        return ScoreResult(results=[], source="like", like_raw=like_results)

    filtered = rg_module.rg_fallback_search(
        query,
        idx_manager.path_map,
        doc_nodes_map,
        query_words,
        context_before=idx_manager.rg_context_before,
        context_after=idx_manager.rg_context_after,
    )
    return ScoreResult(results=filtered, source="ripgrep")
