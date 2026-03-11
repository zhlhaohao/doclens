# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: TreeSearch - Structure-aware document retrieval via tree-structured indexing.

No vector embeddings. No chunk splitting. FTS5/BM25 keyword matching over document trees.

Quick Start::

    from treesearch import TreeSearch

    # Lazy indexing -- auto-builds index on first search
    ts = TreeSearch("docs/*.md", "src/*.py")
    results = ts.search("How to configure voice calls?")
"""
__version__ = "0.7.0"

# ============================================================================
# FTS5 Compatibility: Use pysqlite3 on systems without FTS5 support
# ============================================================================
import sys

def _ensure_fts5_support():
    """Ensure SQLite has FTS5 support, use pysqlite3 as fallback."""
    try:
        import sqlite3
        conn = sqlite3.connect(":memory:")
        conn.execute("CREATE VIRTUAL TABLE _fts5_test USING fts5(content)")
        conn.close()
        return True
    except Exception:
        return False

if not _ensure_fts5_support():
    try:
        from pysqlite3 import dbapi2 as _sqlite3
        sys.modules["sqlite3"] = _sqlite3
        if "treesearch.fts" in sys.modules:
            sys.modules["treesearch.fts"].sqlite3 = _sqlite3
    except ImportError:
        import warnings
        warnings.warn(
            "SQLite FTS5 not available. Full-text search will use LIKE fallback "
            "(slower, no BM25 ranking). For best performance, install pysqlite3-binary:\n"
            "    pip install pysqlite3-binary",
            RuntimeWarning,
            stacklevel=2,
        )

# -- Primary API: TreeSearch is the only class most users need --
from treesearch.treesearch import TreeSearch

# -- Advanced / Power-user API --
# Index & Document
from treesearch.tree import Document, load_index, load_documents, save_index

# Search
from treesearch.search import search, search_sync, PreFilter, GrepFilter

# Configuration
from treesearch.config import TreeSearchConfig, get_config, set_config, reset_config

# FTS5
from treesearch.fts import FTS5Index, get_fts_index, set_fts_index, reset_fts_index

# Tokenizer & utilities
from treesearch.tokenizer import tokenize
from treesearch.utils import count_tokens

# Tree utilities
from treesearch.tree import (
    INDEX_VERSION,
    assign_node_ids,
    build_tree_maps,
    flatten_tree,
    find_node,
    get_leaf_nodes,
    remove_fields,
    format_structure,
    print_toc,
    print_tree_json,
)

# Indexer functions
from treesearch.indexer import build_index, md_to_tree, text_to_tree, code_to_tree, json_to_tree, csv_to_tree

# Parser registry
from treesearch.parsers import ParserRegistry, get_parser

__all__ = [
    # Primary API
    "TreeSearch",
    # Indexer
    "build_index", "md_to_tree", "text_to_tree", "code_to_tree", "json_to_tree", "csv_to_tree",
    # Document
    "Document", "load_index", "load_documents", "save_index",
    # Search
    "search", "search_sync", "PreFilter", "GrepFilter",
    # Config
    "TreeSearchConfig", "get_config", "set_config", "reset_config",
    # FTS5
    "FTS5Index", "get_fts_index", "set_fts_index", "reset_fts_index",
    # Tokenizer & utilities
    "tokenize", "count_tokens",
    # Tree utilities
    "INDEX_VERSION", "assign_node_ids", "build_tree_maps", "flatten_tree", "find_node",
    "get_leaf_nodes", "remove_fields", "format_structure", "print_toc", "print_tree_json",
    # Parser registry
    "ParserRegistry", "get_parser",
]
