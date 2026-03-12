# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Basic demo — TreeSearch with multi-level glob patterns and directories.

Shows:
  1. Multi-level glob patterns (recursive **/*.py, single-level *.md)
  2. Directory indexing — just pass a directory path
  3. resolve_glob_files() — preview which files a glob pattern matches
  4. get_indexed_files() — query which files are already in the index
  5. Search across mixed file types

Usage:
    cd TreeSearch
    python examples/01_basic_demo.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from treesearch import TreeSearch

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "markdowns")

# 1. Create engine with multi-level glob patterns (lazy indexing), can also pass directories directly
ts = TreeSearch(PROJECT_ROOT, DATA_DIR)

# 2. Preview: resolve glob patterns to see matched files (before indexing)
matched_files = ts.resolve_glob_files()
print(f"\nResolved files ({len(matched_files)} total):")
for f in matched_files:
    rel = os.path.relpath(f, PROJECT_ROOT)
    print(f"  {rel}")

# 3. Search (first call triggers index build automatically)
print(f"\n{'=' * 60}")
query = "How does TreeSearch build index?"
print(f"Search: {query}")
print("=" * 60)

results = ts.search(query)
for doc in results["documents"]:
    print(f"\n📄 {doc['doc_name']}")
    for node in doc["nodes"]:
        print(f"  [{node['score']:.2f}] {node['title']}")
        print(f"         line: {node['line_start']}-{node['line_end']}")
        print(f"         text: {node['text'][:200]}...")
        print()

# 4. Query indexed files from the database (after indexing)
print(f"\n{'=' * 60}")
indexed = ts.get_indexed_files()
print(f"Indexed files in DB ({len(indexed)} documents):")
for info in indexed:
    src = info["source_path"]
    rel = os.path.relpath(src, PROJECT_ROOT) if src else info["doc_name"]
    print(f"  [{info['source_type']:>8}] {rel}")
