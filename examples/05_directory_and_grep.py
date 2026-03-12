# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Directory indexing + ripgrep-accelerated GrepFilter demo.

V1 new features:
  1. Smart directory discovery — ts.index("path/to/dir") just works
  2. Ripgrep acceleration — GrepFilter auto-uses `rg` when available

Usage:
    cd TreeSearch
    python examples/05_directory_and_grep.py
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from treesearch import TreeSearch, GrepFilter
from treesearch.pathutil import resolve_paths
from treesearch.ripgrep import rg_available

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "markdowns")


def demo_directory_indexing():
    """Demo 1: Index an entire directory — no glob patterns needed."""
    print("=" * 60)
    print("Demo 1: Smart Directory Indexing")
    print("=" * 60)

    db_path = os.path.join(tempfile.mkdtemp(), "dir_demo.db")
    ts = TreeSearch(db_path=db_path)

    # Just pass a directory — TreeSearch auto-discovers supported files
    docs = ts.index(DATA_DIR)
    print(f"\nIndexed directory: {DATA_DIR}")
    print(f"  Found {len(docs)} documents:")
    for doc in docs:
        print(f"    - {doc.doc_name} ({doc.source_type})")


def demo_mixed_inputs():
    """Demo 2: Mix files, globs, and directories in one call."""
    print("\n" + "=" * 60)
    print("Demo 2: Mixed Inputs (files + globs + directories)")
    print("=" * 60)

    treesearch_dir = os.path.join(PROJECT_ROOT, "treesearch")

    # resolve_paths handles all three types
    resolved = resolve_paths(
        [
            DATA_DIR,                                           # directory
            os.path.join(PROJECT_ROOT, "README.md"),            # single file
            os.path.join(treesearch_dir, "*.py"),               # glob
        ],
        allowed_extensions={".py", ".md"},
    )
    print(f"\nResolved {len(resolved)} files from mixed inputs:")
    for f in resolved[:10]:
        print(f"  {os.path.relpath(f, PROJECT_ROOT)}")
    if len(resolved) > 10:
        print(f"  ... and {len(resolved) - 10} more")

    # Index all at once
    db_path = os.path.join(tempfile.mkdtemp(), "mixed_demo.db")
    ts = TreeSearch(db_path=db_path)
    docs = ts.index(
        DATA_DIR,
        os.path.join(treesearch_dir, "*.py"),
    )
    print(f"\nIndexed {len(docs)} documents total")


def demo_directory_search():
    """Demo 3: Index a code directory and search it."""
    print("\n" + "=" * 60)
    print("Demo 3: Code Directory Search")
    print("=" * 60)

    treesearch_dir = os.path.join(PROJECT_ROOT, "treesearch")
    db_path = os.path.join(tempfile.mkdtemp(), "code_demo.db")
    ts = TreeSearch(db_path=db_path)

    # Index the entire treesearch package directory
    docs = ts.index(treesearch_dir)
    print(f"\nIndexed {len(docs)} code files from treesearch/")

    # Search
    queries = [
        "build tree index from files",
        "FTS5 full text search",
        "GrepFilter score nodes",
    ]
    for query in queries:
        print(f"\nQuery: {query}")
        result = ts.search(query, max_nodes_per_doc=2)
        for doc in result["documents"]:
            for node in doc["nodes"]:
                print(f"  [{node['score']:.2f}] [{doc['doc_name']}] {node['title']}")


def demo_ripgrep_grepfilter():
    """Demo 4: GrepFilter with ripgrep acceleration."""
    print("\n" + "=" * 60)
    print("Demo 4: GrepFilter with Ripgrep Acceleration")
    print("=" * 60)

    rg_status = "available" if rg_available() else "not found (using native fallback)"
    print(f"\nripgrep (rg): {rg_status}")

    treesearch_dir = os.path.join(PROJECT_ROOT, "treesearch")
    db_path = os.path.join(tempfile.mkdtemp(), "grep_demo.db")
    ts = TreeSearch(db_path=db_path)
    docs = ts.index(treesearch_dir)

    # GrepFilter automatically uses rg when source_path exists and rg is installed
    grep = GrepFilter(docs)

    for query in ["FTS5Index", "async def search", "flatten_tree"]:
        print(f"\nGrep: '{query}'")
        for doc in docs:
            hits = grep.score_nodes(query, doc.doc_id)
            if hits:
                top_nodes = sorted(hits.items(), key=lambda x: -x[1])[:3]
                print(f"  [{doc.doc_name}] {len(hits)} node(s) matched")
                for nid, score in top_nodes:
                    node = doc.get_node_by_id(nid)
                    title = node.get("title", "") if node else ""
                    print(f"    [{score:.2f}] {title}")


if __name__ == "__main__":
    demo_directory_indexing()
    demo_mixed_inputs()
    demo_directory_search()
    demo_ripgrep_grepfilter()
