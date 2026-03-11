# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Multi-document search with GrepFilter demo.

Demonstrates:
  - TreeSearch multi-doc search (FTS5, zero LLM calls)
  - GrepFilter for exact literal matching (advanced)

Usage:
    python examples/04_multi_doc_search.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from treesearch import TreeSearch, GrepFilter

DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "markdowns")
INDEX_DB = os.path.join(os.path.dirname(__file__), "indexes", "multi_doc_demo", "index.db")

# 1. Create engine and index
ts = TreeSearch(db_path=INDEX_DB)
ts.index(f"{DATA_DIR}/*.md")
print(f"Indexed {len(ts.documents)} documents: {[d.doc_name for d in ts.documents]}\n")

# --- Demo 1: FTS5 multi-doc search (default, no LLM) ---
print("=" * 60)
print("Demo 1: FTS5 Multi-Document Search (no LLM)")
print("=" * 60)
for query in ["voice call configuration", "agent tool registration"]:
    result = ts.search(query, max_nodes_per_doc=3)
    print(f"\nQuery: {query}")
    for doc in result["documents"]:
        for node in doc["nodes"]:
            print(f"  [{node['score']:.4f}] {node['title']}")

# --- Demo 2: GrepFilter for exact matching (advanced) ---
print("\n" + "=" * 60)
print("Demo 2: GrepFilter Exact Matching")
print("=" * 60)
grep = GrepFilter(ts.documents)
for query in ["Twilio", "white_list"]:
    print(f"\nGrep: '{query}'")
    for doc in ts.documents:
        hits = grep.score_nodes(query, doc.doc_id)
        if hits:
            print(f"  [{doc.doc_name}] {len(hits)} node(s) matched")
            for nid in list(hits)[:3]:
                node = doc.get_node_by_id(nid)
                print(f"    [{nid}] {node.get('title', '') if node else ''}")
