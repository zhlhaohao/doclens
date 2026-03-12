# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: CLI workflow demo -- the simplest way to use TreeSearch.

This script demonstrates three usage patterns:
  1. Default (lazy) mode: treesearch "query" path/ — one command does everything
  2. Python API equivalent: TreeSearch(path).search(query)
  3. Advanced subcommands: index + search separately

Usage:
    python examples/03_cli_workflow.py
"""
import asyncio
import os
import sys
import shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from treesearch import TreeSearch, build_index, search, load_documents

DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "markdowns")
INDEX_DIR = os.path.join(os.path.dirname(__file__), "indexes", "cli_demo")
INDEX_DB = os.path.join(INDEX_DIR, "index.db")


def demo_default_mode():
    """Demo 1: Default lazy mode — the simplest workflow.

    Equivalent CLI:
        treesearch "How to configure voice call?" data/markdowns/
    """
    print("=" * 60)
    print("Demo 1: Default lazy mode (one command does everything)")
    print("=" * 60)

    ts = TreeSearch(DATA_DIR, db_path=INDEX_DB)
    queries = [
        "How to configure the voice call webhook URL?",
        "How to register an optional agent tool?",
        "What TTS providers are supported for calls?",
    ]

    for query in queries:
        print(f"\nQuery: {query}")
        print("-" * 40)
        result = ts.search(query, max_nodes_per_doc=3)

        if not result["documents"] or not result["flat_nodes"]:
            print("  No results found.")
            continue

        total = sum(len(d["nodes"]) for d in result["documents"])
        print(f"  Found {total} result(s) in {len(result['documents'])} doc(s)\n")

        for doc_result in result["documents"]:
            doc_name = doc_result["doc_name"]
            for node in doc_result["nodes"]:
                score = node.get("score", 0)
                title = node.get("title", "")
                line_start = node.get("line_start")
                line_end = node.get("line_end")
                text = node.get("text", "")

                loc = f"  (lines {line_start}-{line_end})" if line_start and line_end else ""
                print(f"  [{score:.2f}] {doc_name} > {title}{loc}")

                if text:
                    preview = text[:300]
                    if len(text) > 300:
                        preview += "..."
                    for line in preview.split("\n")[:5]:
                        print(f"    {line}")
                print()


async def demo_advanced_mode():
    """Demo 2: Advanced mode — separate index and search steps.

    Equivalent CLI:
        treesearch index --paths data/markdowns/voice-call.md data/markdowns/agent-tools.md -o indexes/cli_demo --add-description
        treesearch search --index_dir indexes/cli_demo --query "tools"
    """
    print("=" * 60)
    print("Demo 2: Advanced mode (separate index + search)")
    print("=" * 60)

    # Clean up from previous runs
    if os.path.isdir(INDEX_DIR):
        shutil.rmtree(INDEX_DIR)
    os.makedirs(INDEX_DIR, exist_ok=True)

    # Step 1: Build indexes explicitly
    print("\n--- Step 1: Building indexes ---\n")
    md_files = [
        os.path.join(DATA_DIR, "voice-call.md"),
        os.path.join(DATA_DIR, "agent-tools.md"),
    ]
    documents = await build_index(
        paths=md_files,
        output_dir=INDEX_DIR,
        if_add_node_summary=True,
        if_add_node_text=True,
        if_add_doc_description=True,
    )

    for doc in documents:
        print(f"  Indexed: {doc.doc_name}")
        print(f"    Description: {doc.doc_description or 'N/A'}")

    # Step 2: Search with returned documents
    print(f"\n--- Step 2: Search ({len(documents)} documents) ---\n")
    query = "How to configure the voice call webhook URL?"
    print(f"Query: {query}")
    result = await search(query=query, documents=documents, max_nodes_per_doc=3)
    for doc_result in result["documents"]:
        for node in doc_result["nodes"]:
            print(f"  [{node.get('score', 0):.2f}] [{doc_result['doc_name']}] {node['title']}")

    # Step 3: Load from disk later
    print(f"\n--- Step 3: Load from disk ---")
    loaded_docs = load_documents(INDEX_DB)
    print(f"  Loaded {len(loaded_docs)} documents from {INDEX_DB}")


def main():
    # Demo 1: Default lazy mode (recommended for most users)
    demo_default_mode()

    print("\n")

    # Demo 2: Advanced separate index + search
    asyncio.run(demo_advanced_mode())

    # Print equivalent CLI commands
    print("\n" + "=" * 60)
    print("Equivalent CLI commands")
    print("=" * 60)
    print(f'\n# Default mode (simplest — one command does everything):')
    print(f'treesearch "How to configure voice call?" {DATA_DIR}/')
    print(f'treesearch "agent tools" {DATA_DIR}/voice-call.md {DATA_DIR}/agent-tools.md')
    print(f'\n# Advanced: build index first, then search:')
    print(f'treesearch index --paths {DATA_DIR}/voice-call.md {DATA_DIR}/agent-tools.md -o {INDEX_DIR} --add-description')
    print(f'treesearch search --index_dir {INDEX_DIR} --query "How to configure the voice call webhook URL?"')
    print(f'treesearch search --index_dir {INDEX_DIR} --query "tools"')


if __name__ == "__main__":
    main()
