# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Demo — Delete documents from the index.

Shows:
  1. get_indexed_files() — query which files are in the index
  2. delete() — remove documents by source_path
  3. delete() — remove documents by doc_id
  4. delete() — batch delete multiple documents
  5. Verify deletion: search no longer returns deleted documents
  6. Re-index after delete: deleted documents can be restored

Usage:
    cd TreeSearch
    python examples/08_delete_demo.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from treesearch import TreeSearch

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "markdowns")
DB_PATH = os.path.join(os.path.dirname(__file__), "index.db")

# 1. Create engine and index
ts = TreeSearch(DATA_DIR, db_path=DB_PATH)
print(f"\n{'=' * 60}")
print("Step 1: Index documents")
print("=" * 60)
# search() triggers lazy indexing automatically
ts.search("dummy query")  # This builds the index
indexed = ts.get_indexed_files()
print(f"Indexed files ({len(indexed)} documents):")
for info in indexed:
    print(f"  [{info['source_type']:>8}] {info['source_path']}")

# 2. Search before delete
print(f"\n{'=' * 60}")
print("Step 2: Search 'authentication' (before delete)")
print("=" * 60)
results = ts.search("authentication")
print(f"Found {len(results['documents'])} documents")
for doc in results["documents"]:
    print(f"  - {doc['doc_name']}")

# 3. Delete by source_path
if indexed:
    target = indexed[0]["source_path"]
    print(f"\n{'=' * 60}")
    print(f"Step 3: Delete by source_path: {target}")
    print("=" * 60)
    removed = ts.delete(target)
    print(f"Removed {removed} document(s)")

# 4. Verify deletion
print(f"\n{'=' * 60}")
print("Step 4: Verify deletion")
print("=" * 60)
remaining = ts.get_indexed_files()
print(f"Remaining indexed files: {len(remaining)}")
results_after = ts.search("authentication")
print(f"Search results after delete: {len(results_after['documents'])} documents")

# 5. Delete by doc_id (if available)
print(f"\n{'=' * 60}")
print("Step 5: Delete by doc_id")
print("=" * 60)
remaining = ts.get_indexed_files()
if remaining:
    doc_id_target = remaining[0]["doc_id"]
    print(f"Deleting by doc_id: {doc_id_target}")
    removed = ts.delete(doc_id_target)
    print(f"Removed {removed} document(s)")

# 6. Batch delete
print(f"\n{'=' * 60}")
print("Step 6: Batch delete")
print("=" * 60)
remaining = ts.get_indexed_files()
if len(remaining) >= 2:
    paths_to_delete = [remaining[0]["source_path"], remaining[1]["source_path"]]
    print(f"Deleting multiple: {paths_to_delete}")
    removed = ts.delete(*paths_to_delete)
    print(f"Removed {removed} document(s)")
else:
    print("Not enough documents for batch delete demo")

# 7. Re-index after delete
print(f"\n{'=' * 60}")
print("Step 7: Re-index after delete")
print("=" * 60)
print("Re-indexing all files...")
ts.search("dummy query")  # Trigger re-index
indexed_after_reindex = ts.get_indexed_files()
print(f"Indexed files after re-index: {len(indexed_after_reindex)} documents")
results_restored = ts.search("authentication")
print(f"Search 'authentication' after re-index: {len(results_restored['documents'])} documents")
