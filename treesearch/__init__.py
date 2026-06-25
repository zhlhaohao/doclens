# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: TreeSearch - Structure-aware document retrieval via tree-structured indexing.

No vector embeddings. No chunk splitting. FTS5 keyword matching over document trees.

Quick Start::

    from treesearch import TreeSearch

    # Lazy indexing -- auto-builds index on first search
    ts = TreeSearch("./docs/")
    results = ts.search("How to configure voice calls?")
"""
__version__ = "1.1.0"

# ============================================================================
# Public API
# ============================================================================

# -- Primary: the only class most users need --
from treesearch.treesearch import TreeSearch

# -- Core --
from treesearch.indexer import build_index, md_to_tree, text_to_tree, IndexStats
from treesearch.search import search, search_sync, GrepFilter
from treesearch.tree import Document, load_index, load_documents, save_index, flatten_tree, print_toc
from treesearch.config import (
    TreeSearchConfig, get_config, set_config, reset_config,
    INDEX_SCHEMA_VERSION,
)
from treesearch.fts import FTS5Index
from treesearch.tree_searcher import TreeSearcher, PathResult
from treesearch.heuristics import build_query_plan, QueryPlan

__all__ = [
    # Primary
    "TreeSearch",
    # Indexing
    "build_index", "md_to_tree", "text_to_tree", "IndexStats",
    # Search
    "search", "search_sync", "GrepFilter",
    # Tree Search
    "TreeSearcher", "PathResult", "build_query_plan", "QueryPlan",
    # Document & tree
    "Document", "load_index", "load_documents", "save_index", "flatten_tree", "print_toc",
    # Config
    "TreeSearchConfig", "get_config", "set_config", "reset_config",
    "INDEX_SCHEMA_VERSION",
    # FTS5
    "FTS5Index",
]
