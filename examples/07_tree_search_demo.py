# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tree Search demo -- Best-First Search over document trees.

Demonstrates the new tree search capabilities:
  1. Tree mode vs Flat mode comparison
  2. Path-based results with traversal trace
  3. TreeSearcher low-level API
  4. QueryPlan parsing
  5. Multi-document tree search
  6. Auto mode resolution (smart tree/flat selection)

Usage:
    cd TreeSearch
    python examples/07_tree_search_demo.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from treesearch import (
    TreeSearch,
    TreeSearcher,
    build_query_plan,
    FTS5Index,
    TreeSearchConfig,
    set_config,
    reset_config,
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "markdowns")


def demo_tree_vs_flat():
    """Demo 1: Compare tree search mode with flat (FTS5-only) mode."""
    print("=" * 70)
    print("Demo 1: Tree Mode vs Flat Mode Comparison")
    print("=" * 70)

    ts = TreeSearch(DATA_DIR, db_path=None)  # in-memory

    query = "How to configure Twilio for voice calls?"
    print(f"\nQuery: {query}\n")

    for mode in ["tree", "flat"]:
        t0 = time.time()
        result = ts.search(query, max_nodes_per_doc=3, search_mode=mode)
        elapsed = (time.time() - t0) * 1000  # ms

        actual_mode = result.get("mode", mode)
        total_nodes = sum(len(d["nodes"]) for d in result["documents"])
        print(f"--- [{actual_mode.upper()} mode] {total_nodes} result(s), {elapsed:.1f}ms ---")

        for doc_result in result["documents"]:
            for node in doc_result["nodes"]:
                score = node.get("score", 0)
                title = node.get("title", "")
                text = node.get("text", "")
                preview = text[:120].replace("\n", " ") if text else ""
                if len(text) > 120:
                    preview += "..."
                print(f"  [{score:.4f}] {title}")
                if preview:
                    print(f"           {preview}")

        # Show paths if tree mode
        if "paths" in result:
            print(f"\n  Paths ({len(result['paths'])}):")
            for i, path_info in enumerate(result["paths"], 1):
                p_score = path_info.get("score", 0)
                path_nodes = path_info.get("path", [])
                reasons = path_info.get("reasons", [])
                # Show path as arrow chain
                chain = " > ".join(p.get("title", "?")[:30] for p in path_nodes)
                print(f"    Path {i} ({p_score:.4f}): {chain}")
                if reasons:
                    print(f"      reasons: {'; '.join(reasons[:3])}")
        print()


def demo_path_results():
    """Demo 2: Path-based results -- see how the tree is traversed."""
    print("=" * 70)
    print("Demo 2: Path-Based Results with Traversal Trace")
    print("=" * 70)

    ts = TreeSearch(DATA_DIR, db_path=None)

    queries = [
        "What TTS providers are supported for calls?",
        "How to register an optional agent tool?",
        "Twilio webhook URL configuration",
    ]

    for query in queries:
        result = ts.search(query, max_nodes_per_doc=5, search_mode="tree")
        print(f"\nQuery: {query}")
        print("-" * 50)

        if "paths" not in result or not result["paths"]:
            print("  (no paths found)")
            continue

        for i, path_info in enumerate(result["paths"], 1):
            score = path_info.get("score", 0)
            doc_name = path_info.get("doc_name", "")
            anchor_id = path_info.get("anchor_node_id", "")
            target_id = path_info.get("target_node_id", "")
            path_nodes = path_info.get("path", [])
            snippet = path_info.get("snippet", "")

            print(f"\n  Path {i} (score={score:.4f}) [{doc_name}]")
            print(f"  anchor={anchor_id} -> target={target_id}")

            # Print tree-style path
            for j, pn in enumerate(path_nodes):
                indent = "    " * j
                is_last = j == len(path_nodes) - 1
                connector = "`-> " if is_last else "|-- "
                marker = " [TARGET]" if is_last else ""
                print(f"    {indent}{connector}{pn.get('title', '')}{marker}")

            # Show snippet
            if snippet:
                preview = snippet[:200].replace("\n", " ")
                if len(snippet) > 200:
                    preview += "..."
                print(f"    snippet: {preview}")


def demo_query_plan():
    """Demo 3: QueryPlan parsing -- see how queries are analyzed."""
    print("\n" + "=" * 70)
    print("Demo 3: QueryPlan Parsing")
    print("=" * 70)

    test_queries = [
        'How to configure Twilio?',
        '"voice call" webhook configuration',
        'def register_tool function parameter',
        'What TTS providers are supported?',
        'Chapter 2 Architecture overview',
    ]

    for q in test_queries:
        plan = build_query_plan(q)
        print(f"\n  Query: {q!r}")
        print(f"    terms:    {plan.terms}")
        print(f"    phrases:  {plan.phrases}")
        print(f"    is_code:  {plan.is_code_query}")
        print(f"    is_struct: {plan.is_structural_query}")


def demo_low_level_tree_searcher():
    """Demo 4: TreeSearcher low-level API -- fine-grained control."""
    print("\n" + "=" * 70)
    print("Demo 4: TreeSearcher Low-Level API")
    print("=" * 70)

    # Use TreeSearch for indexing (sync), then extract documents
    md_files = [
        os.path.join(DATA_DIR, "voice-call.md"),
        os.path.join(DATA_DIR, "agent-tools.md"),
    ]
    ts = TreeSearch(*md_files, db_path=None)
    ts.search("dummy")  # trigger lazy indexing
    documents = ts.documents
    print(f"\n  Built {len(documents)} documents")

    # Show document tree structure
    for doc in documents:
        print(f"\n  [{doc.doc_name}] depth map:")
        for nid in list(doc._depth_map.keys())[:8]:
            node = doc.get_node_by_id(nid)
            depth = doc.get_depth(nid)
            title = node.get("title", "") if node else ""
            indent = "  " * depth
            print(f"    {indent}[d={depth}] {title}")
        if len(doc._depth_map) > 8:
            print(f"    ... ({len(doc._depth_map)} nodes total)")

    # Build FTS5 scores (simulate what search.py does)
    fts = FTS5Index()
    fts.index_documents(documents)

    query = "How to configure the voice call webhook URL?"
    print(f"\n  Query: {query}")

    fts_score_map = {}
    for doc in documents:
        scores = fts.score_nodes(query, doc.doc_id)
        if scores:
            fts_score_map[doc.doc_id] = scores
            print(f"\n  FTS5 scores for [{doc.doc_name}]:")
            for nid, score in sorted(scores.items(), key=lambda x: -x[1])[:5]:
                node = doc.get_node_by_id(nid)
                title = node.get("title", "") if node else ""
                print(f"    [{score:.4f}] {title}")

    # Run TreeSearcher
    searcher = TreeSearcher()
    paths, flat_nodes = searcher.search(query, documents, fts_score_map)

    print(f"\n  TreeSearcher results: {len(paths)} paths, {len(flat_nodes)} flat nodes")
    for i, pr in enumerate(paths, 1):
        chain = " > ".join(p.get("title", "?")[:25] for p in pr.path)
        print(f"    Path {i} ({pr.score:.4f}): {chain}")
        if pr.snippet:
            preview = pr.snippet[:150].replace("\n", " ")
            print(f"      snippet: {preview}...")


def demo_document_navigation():
    """Demo 5: Document tree navigation -- parent/child/sibling traversal."""
    print("\n" + "=" * 70)
    print("Demo 5: Document Tree Navigation")
    print("=" * 70)

    ts = TreeSearch(os.path.join(DATA_DIR, "voice-call.md"), db_path=None)
    # Search triggers lazy indexing
    ts.search("config")
    doc = ts.documents[0]

    print(f"\n  Document: {doc.doc_name}")
    print(f"  Total nodes: {len(doc._node_map)}")

    # Pick a node to demonstrate navigation
    # Find a node with depth >= 1 that has children
    sample_nid = None
    for nid, depth in doc._depth_map.items():
        if depth >= 1 and doc.get_children_ids(nid):
            sample_nid = nid
            break
    if not sample_nid:
        # Fallback: any node with depth >= 1
        for nid, depth in doc._depth_map.items():
            if depth >= 1:
                sample_nid = nid
                break
    if not sample_nid:
        sample_nid = list(doc._node_map.keys())[0]

    node = doc.get_node_by_id(sample_nid)
    title = node.get("title", "") if node else ""
    depth = doc.get_depth(sample_nid)

    print(f"\n  Selected node: [{sample_nid}] {title} (depth={depth})")

    # Path to root
    path = doc.get_path_to_root(sample_nid)
    path_titles = []
    for pid in path:
        pnode = doc.get_node_by_id(pid)
        path_titles.append(pnode.get("title", "") if pnode else "?")
    print(f"  Path to root: {' > '.join(path_titles)}")

    # Parent
    parent_id = doc.get_parent_id(sample_nid)
    if parent_id:
        pnode = doc.get_node_by_id(parent_id)
        print(f"  Parent: [{parent_id}] {pnode.get('title', '') if pnode else ''}")

    # Children
    children = doc.get_children_ids(sample_nid)
    print(f"  Children ({len(children)}):")
    for cid in children[:5]:
        cnode = doc.get_node_by_id(cid)
        print(f"    [{cid}] {cnode.get('title', '') if cnode else ''}")

    # Siblings
    siblings = doc.get_sibling_ids(sample_nid)
    print(f"  Siblings ({len(siblings)}):")
    for sid in siblings[:5]:
        snode = doc.get_node_by_id(sid)
        print(f"    [{sid}] {snode.get('title', '') if snode else ''}")

    # Subtree
    subtree = doc.get_subtree_node_ids(sample_nid)
    print(f"  Subtree size: {len(subtree)} nodes")


def demo_multi_doc_tree_search():
    """Demo 6: Multi-document tree search with path output."""
    print("\n" + "=" * 70)
    print("Demo 6: Multi-Document Tree Search")
    print("=" * 70)

    ts = TreeSearch(DATA_DIR, db_path=None)

    queries = [
        "voice call configuration",
        "agent tool registration",
        "How to use allowlist for tools?",
    ]

    for query in queries:
        result = ts.search(query, max_nodes_per_doc=2, search_mode="tree")
        mode = result.get("mode", "?")
        total = sum(len(d["nodes"]) for d in result["documents"])

        print(f"\nQuery: {query}  [{mode} mode, {total} results]")

        for doc_result in result["documents"]:
            doc_name = doc_result["doc_name"]
            print(f"  [{doc_name}]")
            for node in doc_result["nodes"]:
                print(f"    [{node['score']:.4f}] {node['title']}")

        if "paths" in result:
            for i, p in enumerate(result["paths"][:2], 1):
                chain = " > ".join(pn.get("title", "?")[:25] for pn in p["path"])
                print(f"  Path {i} ({p['score']:.4f}): {chain}")


def demo_auto_mode_resolution():
    """Demo 7: Auto mode resolution -- smart tree/flat selection based on doc types and depth."""
    print("\n" + "=" * 70)
    print("Demo 7: Auto Mode Resolution (Smart tree/flat Selection)")
    print("=" * 70)

    from treesearch.search import _TREE_BENEFIT, _TREE_RATIO_THRESHOLD, _has_meaningful_depth

    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    treesearch_dir = os.path.join(PROJECT_ROOT, "treesearch")

    # Scenario A: Pure markdown docs → expect tree mode
    print("\n--- Scenario A: Pure markdown (hierarchical) ---")
    ts_md = TreeSearch(DATA_DIR, db_path=None)
    result_md = ts_md.search("voice call configuration", search_mode="auto")
    print(f"  Docs: {[d.doc_name for d in ts_md.documents[:5]]}")
    for doc in ts_md.documents[:3]:
        st = doc.source_type or ""
        benefit = _TREE_BENEFIT.get(st, False)
        has_depth = _has_meaningful_depth(doc) if benefit else False
        print(f"    [{doc.doc_name}] type={st}, tree_benefit={benefit}, has_depth={has_depth}")
    print(f"  Auto resolved → {result_md.get('mode', '?')} mode")

    # Scenario B: Pure code docs → expect flat mode
    print("\n--- Scenario B: Pure code files ---")
    ts_code = TreeSearch(treesearch_dir, db_path=None)
    result_code = ts_code.search("FTS5 search index", search_mode="auto")
    code_count = sum(1 for d in ts_code.documents if (d.source_type or "") == "code")
    print(f"  Total docs: {len(ts_code.documents)}, code: {code_count}")
    print(f"  Auto resolved → {result_code.get('mode', '?')} mode")

    # Scenario C: Mixed docs (markdown + code) → depends on ratio
    print("\n--- Scenario C: Mixed (markdown + code) ---")
    ts_mixed = TreeSearch(DATA_DIR, treesearch_dir, db_path=None)
    result_mixed = ts_mixed.search("tree search configuration", search_mode="auto")
    type_counts: dict[str, int] = {}
    tree_count = 0
    for doc in ts_mixed.documents:
        st = doc.source_type or "unknown"
        type_counts[st] = type_counts.get(st, 0) + 1
        if _TREE_BENEFIT.get(st, False) and _has_meaningful_depth(doc):
            tree_count += 1
    total = len(ts_mixed.documents)
    ratio = tree_count / total if total else 0
    print(f"  Total docs: {total}, type breakdown: {type_counts}")
    print(f"  Tree-benefiting docs: {tree_count}/{total} ({ratio:.0%}), threshold: {_TREE_RATIO_THRESHOLD:.0%}")
    print(f"  Auto resolved → {result_mixed.get('mode', '?')} mode")

    # Summary table
    print(f"\n  {'Scenario':<25} {'Mode':<8} {'Rationale'}")
    print(f"  {'-'*25} {'-'*8} {'-'*40}")
    print(f"  {'Pure markdown':<25} {result_md.get('mode','?'):<8} All docs have heading hierarchy")
    print(f"  {'Pure code':<25} {result_code.get('mode','?'):<8} Code → FTS5 keyword match suffices")
    print(f"  {'Mixed (md+code)':<25} {result_mixed.get('mode','?'):<8} Ratio {ratio:.0%} vs threshold {_TREE_RATIO_THRESHOLD:.0%}")


def demo_config_tuning():
    """Demo 8: Tree search config tuning -- adjust search behavior."""
    print("\n" + "=" * 70)
    print("Demo 8: Config Tuning for Tree Search")
    print("=" * 70)

    ts = TreeSearch(DATA_DIR, db_path=None)
    query = "Twilio webhook configuration"

    # Default config
    result_default = ts.search(query, search_mode="tree")
    paths_default = result_default.get("paths", [])

    # Aggressive expansion: more hops, more anchors
    set_config(TreeSearchConfig(
        search_mode="tree",
        anchor_top_k=8,
        max_expansions=60,
        max_hops=5,
        max_siblings=4,
        path_top_k=5,
    ))
    ts2 = TreeSearch(DATA_DIR, db_path=None)
    result_wide = ts2.search(query, search_mode="tree")
    paths_wide = result_wide.get("paths", [])
    reset_config()

    # Conservative: fewer expansions
    set_config(TreeSearchConfig(
        search_mode="tree",
        anchor_top_k=2,
        max_expansions=10,
        max_hops=1,
        path_top_k=2,
    ))
    ts3 = TreeSearch(DATA_DIR, db_path=None)
    result_narrow = ts3.search(query, search_mode="tree")
    paths_narrow = result_narrow.get("paths", [])
    reset_config()

    print(f"\n  Query: {query}")
    print(f"\n  Default config:     {len(paths_default)} paths")
    for p in paths_default[:3]:
        chain = " > ".join(pn.get("title", "?")[:20] for pn in p["path"])
        print(f"    ({p['score']:.4f}) {chain}")

    print(f"\n  Wide expansion:     {len(paths_wide)} paths")
    for p in paths_wide[:3]:
        chain = " > ".join(pn.get("title", "?")[:20] for pn in p["path"])
        print(f"    ({p['score']:.4f}) {chain}")

    print(f"\n  Narrow (conservative): {len(paths_narrow)} paths")
    for p in paths_narrow[:3]:
        chain = " > ".join(pn.get("title", "?")[:20] for pn in p["path"])
        print(f"    ({p['score']:.4f}) {chain}")


def main():
    # Demo 1: Tree vs Flat comparison
    demo_tree_vs_flat()

    # Demo 2: Path-based results
    demo_path_results()

    # Demo 3: QueryPlan parsing
    demo_query_plan()

    # Demo 4: TreeSearcher low-level API
    demo_low_level_tree_searcher()

    # Demo 5: Document tree navigation
    demo_document_navigation()

    # Demo 6: Multi-document tree search
    demo_multi_doc_tree_search()

    # Demo 7: Auto mode resolution (smart tree/flat selection)
    demo_auto_mode_resolution()

    # Demo 8: Config tuning
    demo_config_tuning()

    print("\n" + "=" * 70)
    print("All demos complete.")
    print("=" * 70)
    print("\nEquivalent CLI commands:")
    print(f'  # Tree mode (default):')
    print(f'  treesearch "How to configure Twilio?" {DATA_DIR}/')
    print(f'  treesearch "How to configure Twilio?" {DATA_DIR}/ --show-path')
    print(f'  # Flat mode (original FTS5-only):')
    print(f'  treesearch "How to configure Twilio?" {DATA_DIR}/ --search-mode flat')


if __name__ == "__main__":
    main()
