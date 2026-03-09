# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Quick start demo - FTS5 keyword search over document trees (default, no LLM needed).

Demonstrates search strategies:
  1. FTS5-only (default) — pure FTS5/BM25 keyword matching, zero LLM calls, fastest
  2. Best-First (FTS5 + LLM) — FTS5 pre-scoring + LLM tree search, best accuracy
  3. FTS5-rerank — FTS5 candidates + single LLM rerank, best cost/quality tradeoff

Usage:
    python examples/01_basic_demo.py                         # default: fts5_only (no API key needed)
    python examples/01_basic_demo.py --strategy best_first   # FTS5 + LLM tree search
    python examples/01_basic_demo.py --strategy fts5_rerank  # FTS5 + single LLM rerank
    python examples/01_basic_demo.py --fts-db ./fts.db       # persistent FTS5 database
"""
import argparse
import asyncio
import os
import sys
import time
import textwrap

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from treesearch import build_index, search, get_config, set_config

DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "markdowns")
SEPARATOR = "=" * 72


def pprint_result(result):
    """Pretty-print a SearchResult with rich detail."""
    print(f"\n{SEPARATOR}")
    print(f"  Query:    {result.query}")
    print(f"  Strategy: {result.strategy}  |  LLM calls: {result.total_llm_calls}")
    print(SEPARATOR)

    for doc in result.documents:
        doc_label = doc.get("doc_name", doc.get("doc_id", "unknown"))
        nodes = doc.get("nodes", [])
        print(f"\n  Document: {doc_label}  ({len(nodes)} matched nodes)")
        print(f"  {'-' * 60}")

        for node in nodes:
            score = node.get("score", 0)
            title = node.get("title", "")
            node_id = node.get("node_id", "")
            line_start = node.get("line_start")
            line_end = node.get("line_end")
            summary = node.get("summary", "")
            text = node.get("text", "")

            # Line range
            if line_start and line_end:
                line_info = f"L{line_start}-{line_end}"
            elif line_start:
                line_info = f"L{line_start}"
            else:
                line_info = ""

            print(f"\n    [{score:.2f}] {title}")
            print(f"           node_id: {node_id}  {line_info}")

            # Summary (first 120 chars)
            if summary:
                s_preview = summary.replace("\n", " ").strip()
                if len(s_preview) > 120:
                    s_preview = s_preview[:120] + "..."
                wrapped = textwrap.fill(
                    f"summary: {s_preview}", width=68,
                    initial_indent="           ", subsequent_indent="           ",
                )
                print(wrapped)

            # Text preview (first 200 chars)
            if text:
                t_preview = text.replace("\n", " ").strip()
                if len(t_preview) > 200:
                    t_preview = t_preview[:200] + "..."
                wrapped = textwrap.fill(
                    f"text: {t_preview}", width=68,
                    initial_indent="           ", subsequent_indent="           ",
                )
                print(wrapped)

    print(f"\n{SEPARATOR}\n")


async def main():
    parser = argparse.ArgumentParser(description="TreeSearch demo with FTS5")
    parser.add_argument("--strategy", type=str, default="fts5_only",
                        choices=["fts5_only", "best_first", "fts5_rerank", "llm"],
                        help="Search strategy (default: fts5_only, no API key needed)")
    parser.add_argument("--fts-db", type=str, default="", help="Path to persistent FTS5 database (default: in-memory)")
    args = parser.parse_args()

    # Enable FTS5
    cfg = get_config()
    cfg.fts.enabled = True
    cfg.fts.db_path = args.fts_db
    set_config(cfg)

    search_strategy = args.strategy

    # Step 1: Build indexes (auto-skips unchanged files)
    print("Building indexes ...")
    t0 = time.time()
    documents = await build_index(paths=[f"{DATA_DIR}/*.md"], output_dir="./indexes")
    t_index = time.time() - t0
    print(f"Indexed {len(documents)} documents in {t_index:.2f}s")
    for doc in documents:
        src = doc.metadata.get("source_path", "")
        print(f"  - {doc.doc_name} ({len(doc.structure)} root nodes) source: {src}")

    print(f"\nFTS5 DB: {cfg.fts.db_path or 'in-memory'} | Strategy: {search_strategy}")

    # Step 2: Search
    queries = [
        "how to configure openclaw plugins?",
        "接听电话的白名单如何设置？",
    ]

    for query in queries:
        t0 = time.time()
        result = await search(query=query, documents=documents, strategy=search_strategy)
        t_search = time.time() - t0

        pprint_result(result)
        print(f"  Search took {t_search:.2f}s\n")


if __name__ == "__main__":
    asyncio.run(main())
