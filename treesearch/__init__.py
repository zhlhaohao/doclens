# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: TreeSearch - Structure-aware document retrieval via tree-structured indexing.

No vector embeddings. No chunk splitting. FTS5/BM25 keyword matching over document trees, with optional LLM reasoning for enhanced accuracy.

Quick Start::

    from treesearch import TreeSearch

    # Lazy indexing — auto-builds index on first search
    ts = TreeSearch("docs/*.md", "src/*.py", model="gpt-4o")
    results = ts.search("How to configure voice calls?")
"""
__version__ = "0.4.0"

# ── Primary API: TreeSearch is the only class most users need ──
from treesearch.treesearch import TreeSearch

# ── Advanced / Power-user API (importable but not front-and-center) ──
# Index & Document
from treesearch.tree import Document, load_index, load_documents, save_index, clear_doc_cache
from treesearch.indexer import build_index, md_to_tree, text_to_tree, code_to_tree, json_to_tree, csv_to_tree

# Search
from treesearch.search import search, search_sync
from treesearch.search import BestFirstTreeSearch, route_documents, PreFilter, GrepFilter

# Configuration
from treesearch.config import TreeSearchConfig, BestFirstConfig, SearchConfig, FTSConfig, IndexConfig, get_config, set_config, reset_config

# FTS5
from treesearch.fts import FTS5Index, get_fts_index, set_fts_index, reset_fts_index

# BM25
from treesearch.rank_bm25 import NodeBM25Index, NodeTFIDFIndex, BM25Okapi, tokenize

# Tree utilities
from treesearch.tree import (
    INDEX_VERSION,
    assign_node_ids,
    flatten_tree,
    find_node,
    get_leaf_nodes,
    remove_fields,
    format_structure,
    print_toc,
    print_tree_json,
)

# LLM utilities
from treesearch.llm import achat, chat, count_tokens, extract_json

__all__ = [
    # ── Primary API ──
    "TreeSearch",
    # ── Advanced API ──
    "build_index", "md_to_tree", "text_to_tree", "code_to_tree", "json_to_tree", "csv_to_tree",
    "Document", "load_index", "load_documents", "save_index", "clear_doc_cache",
    "search", "search_sync",
    "BestFirstTreeSearch", "route_documents", "PreFilter", "GrepFilter",
    "TreeSearchConfig", "BestFirstConfig", "SearchConfig", "FTSConfig", "IndexConfig",
    "get_config", "set_config", "reset_config",
    "FTS5Index", "get_fts_index", "set_fts_index", "reset_fts_index",
    "NodeBM25Index", "NodeTFIDFIndex", "BM25Okapi", "tokenize",
    "INDEX_VERSION", "assign_node_ids", "flatten_tree", "find_node",
    "get_leaf_nodes", "remove_fields", "format_structure", "print_toc", "print_tree_json",
    "achat", "chat", "count_tokens", "extract_json",
]
