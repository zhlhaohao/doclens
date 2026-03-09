# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: TreeSearch - Structure-aware document retrieval via tree-structured indexing.

No vector embeddings. No chunk splitting. FTS5/BM25 keyword matching over document trees, with optional LLM reasoning for enhanced accuracy.

Core API:
    build_index      - Build tree indexes from documents (returns list[Document])
    load_documents   - Load indexed documents from a directory (returns list[Document])
    search           - Search across documents (returns SearchResult)
    search_sync      - Synchronous search wrapper
    Document         - Document data class
"""
__version__ = "0.4.0"

# Core API: index -> load -> search
from treesearch.tree import Document, load_index, load_documents, save_index, clear_doc_cache
from treesearch.indexer import build_index, md_to_tree, text_to_tree
from treesearch.search import search, search_sync, SearchResult

# Configuration
from treesearch.config import TreeSearchConfig, BestFirstConfig, SearchConfig, FTSConfig, IndexConfig, get_config, set_config, reset_config

# FTS5 full-text search engine
from treesearch.fts import FTS5Index, get_fts_index, set_fts_index, reset_fts_index

# Advanced: search strategies, BM25 (for power users)
from treesearch.search import (
    TreeSearch,
    BestFirstTreeSearch,  # backward compat alias
    llm_tree_search,
    route_documents,
    PreFilter,
)
from treesearch.rank_bm25 import NodeBM25Index, NodeTFIDFIndex, BM25Okapi, tokenize, expand_query

# Tree utilities (for advanced usage)
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
    # Core API
    "build_index", "md_to_tree", "text_to_tree",
    "Document", "load_index", "load_documents", "save_index", "clear_doc_cache",
    "search", "search_sync", "SearchResult",
    # Configuration
    "TreeSearchConfig", "BestFirstConfig", "SearchConfig", "FTSConfig", "IndexConfig",
    "get_config", "set_config", "reset_config",
    # FTS5
    "FTS5Index", "get_fts_index", "set_fts_index", "reset_fts_index",
    # Search strategies & BM25
    "TreeSearch", "BestFirstTreeSearch",
    "llm_tree_search", "route_documents", "PreFilter",
    "NodeBM25Index", "NodeTFIDFIndex", "BM25Okapi", "tokenize", "expand_query",
    # Tree utilities
    "INDEX_VERSION", "assign_node_ids", "flatten_tree", "find_node",
    "get_leaf_nodes", "remove_fields", "format_structure", "print_toc", "print_tree_json",
    # LLM utilities
    "achat", "chat", "count_tokens", "extract_json",
]
