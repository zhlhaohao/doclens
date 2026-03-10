# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Single document indexing + FTS5 search demo (advanced usage).

Demonstrates lower-level APIs:
  - md_to_tree: parse Markdown into a hierarchical tree structure
  - text_to_tree: parse plain text with auto heading detection
  - FTS5Index: fast keyword search over tree nodes (no LLM needed)

For most users, use TreeSearch class instead (see 01_basic_demo.py).

Usage:
    python examples/02_index_and_search.py
"""
import asyncio
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from treesearch import md_to_tree, text_to_tree, Document, save_index, print_toc, FTS5Index

DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "markdowns")
MD_FILE = os.path.join(DATA_DIR, "voice-call.md")

SAMPLE_TEXT = """\
1. Introduction

This chapter introduces the fundamental concepts of distributed systems.

1.1 Definition and Goals

The primary goals of distributed systems include:
- Resource sharing across networked computers
- Transparency in distribution

1.2 Types of Distributed Systems

There are several categories:
- Distributed computing systems (cluster, grid, cloud)
- Distributed information systems (transaction processing)

2. Architecture

This chapter covers architectural styles for distributed systems.

2.1 Layered Architecture

Software is organized into layers where each layer provides services
to the layer above and uses services from the layer below.

2.2 Peer-to-Peer Architecture

In P2P systems, all nodes are equal and can act as both client and server.
"""


async def demo_markdown():
    """Demo: Build tree from a Markdown file and search with FTS5."""
    print("=" * 60)
    print("Demo 1: Markdown Indexing + FTS5 Search")
    print("=" * 60)

    result = await md_to_tree(md_path=MD_FILE, if_add_node_summary=True, if_add_node_text=True)

    print("\nTable of Contents:")
    print_toc(result["structure"])

    output_path = "indexes/voice-call_structure.json"
    save_index(result, output_path)
    print(f"\nIndex saved to: {output_path}")

    doc = Document(doc_id="voice-call", doc_name=result["doc_name"], structure=result["structure"])

    fts = FTS5Index()
    fts.index_documents([doc])

    for query in ["How to configure Twilio?", "What TTS providers are supported?"]:
        print(f"\n--- Query: '{query}' ---")
        results = fts.search(query, top_k=3)
        for r in results:
            print(f"  [{r['fts_score']:.4f}] [{r['node_id']}] {r['title']}")


async def demo_plain_text():
    """Demo: Build tree from plain text with auto heading detection."""
    print("\n" + "=" * 60)
    print("Demo 2: Plain Text Indexing (auto heading detection)")
    print("=" * 60)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write(SAMPLE_TEXT)
        text_path = f.name

    try:
        result = await text_to_tree(text_path=text_path, fallback_to_llm="no", if_add_node_summary=True)
        print("\nTable of Contents:")
        print_toc(result["structure"])
    finally:
        os.unlink(text_path)


async def main():
    await demo_markdown()
    await demo_plain_text()


if __name__ == "__main__":
    asyncio.run(main())
