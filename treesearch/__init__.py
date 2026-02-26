# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: TreeSearch - Reasoning-based RAG with tree-structured document retrieval.

No vector embeddings. No chunk splitting. Pure LLM reasoning over document trees.

Core API:
    build_index     - Build tree indexes from documents (returns list[Document])
    load_documents  - Load indexed documents from a directory (returns list[Document])
    search          - Search across documents (returns SearchResult)
    ask             - End-to-end QA: search + answer generation (returns AnswerResult)
    Document        - Document data class
"""
__version__ = "0.3.0"

# Core API: index -> load -> search -> ask
from treesearch.tree import Document, load_index, load_documents, save_index, clear_doc_cache
from treesearch.indexer import build_index, md_to_tree, text_to_tree
from treesearch.search import search, search_sync, SearchResult
from treesearch.answer import ask, ask_sync, generate_answer, AnswerResult

# Query decomposition
from treesearch.query_decompose import decompose_and_search, analyze_query

# Chunk-level refinement
from treesearch.chunk import refine_search, RefinedSearchResult, Chunk

# Configuration
from treesearch.config import TreeSearchConfig, get_config, set_config

# Advanced: search strategies, BM25, metrics (for power users)
from treesearch.search import (
    BestFirstTreeSearch,
    BestFirstTreeSearch as TreeSearch,
    MCTSTreeSearch,
    llm_tree_search,
    route_documents,
    PreFilter,
)
from treesearch.rank_bm25 import NodeBM25Index, NodeTFIDFIndex, BM25Okapi, tokenize, expand_query
from treesearch.metrics import (
    precision_at_k,
    recall_at_k,
    hit_at_k,
    reciprocal_rank,
    ndcg_at_k,
    f1_at_k,
    evaluate_query,
    evaluate_benchmark,
)

# Benchmark
from treesearch.benchmark import run_benchmark, BenchmarkReport, print_report

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
