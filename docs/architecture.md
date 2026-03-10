# Architecture

**TreeSearch: Structure-aware document retrieval without embeddings.**

TreeSearch is a **structure-aware RAG** framework. Unlike traditional RAG systems that rely on vector embeddings and chunk splitting, TreeSearch preserves document structure as trees and uses FTS5/BM25 keyword matching for fast retrieval, with optional LLM reasoning for enhanced accuracy.

## Core Concepts

### Document Tree

Every document is converted into a **hierarchical tree** where:
- Each node represents a section (heading + content)
- Parent-child relationships reflect the document's logical structure
- Nodes carry metadata: `title`, `summary`, `text`, `node_id`

```
Document
├── Chapter 1: Introduction
│   ├── 1.1 Background
│   └── 1.2 Motivation
├── Chapter 2: Methods
│   ├── 2.1 Data Collection
│   └── 2.2 Model Design
└── Chapter 3: Results
```

### Three-Layer Search Architecture

```
Query
  │
  ▼
[Layer 1] FTS5/BM25 Keyword Search (default: fts5_only)
  │       - SQLite FTS5 inverted index with MD structure-aware columns
  │       - Hierarchical field weighting: title > summary > body
  │       - Chinese + English tokenization (jieba / regex)
  │       - No LLM needed — instant results, millisecond-level
  ▼
[Layer 2] Best-First Tree Search (optional: strategy="best_first")
  │       - Priority queue driven: always expands most promising node
  │       - FTS5/BM25 scores as initial priority (warm start)
  │       - LLM evaluates relevance: title + summary only (no full text)
  │       - Early stopping: queue top score < threshold → stop
  │       - Budget control: max_llm_calls limit
  ▼
[Layer 3] Ranked Results (tens → 2~4)
          - Subtree cache: (query_fingerprint, node_id) for reuse
          - Results with scores, paths, and source text
```

**Stage 0 - Document Routing**: Given a query and multiple documents, the LLM reasons about which documents are most likely to contain the answer, based on document descriptions. No vector search needed. (Skipped automatically for single-document queries.)

**Stage 1 - FTS5/BM25 Keyword Search** (default): `FTS5Index` scores all tree nodes using SQLite FTS5 inverted index with MD structure-aware columns and column weighting. `NodeBM25Index` provides an in-memory BM25 alternative with hierarchical field weighting (`title × 1.0 + summary × 0.7 + body × 0.3`) and ancestor score propagation. Both are instant (no LLM needed). This is the default strategy (`fts5_only`).

**Stage 2 - Best-First Tree Search** (optional): `TreeSearch` uses a priority queue to expand the most promising nodes first. Each node is evaluated by LLM (title + summary only) and scored for relevance. FTS5/BM25 scores serve as initial priority. Early stopping and budget control keep LLM usage efficient. Enable with `strategy="best_first"`.

## Module Overview

| Module | Responsibility |
|---|---|
| `llm.py` | Async OpenAI client with retry, token counting, JSON extraction |
| `tree.py` | `Document` dataclass, tree traversal, persistence (save/load) |
| `indexer.py` | Markdown / plain text → tree structure conversion, batch `build_index()` |
| `search.py` | FTS5-only (default), Best-First tree search, document routing, unified `search()` API |
| `fts.py` | SQLite FTS5 full-text search engine with MD structure-aware columns, WAL mode, incremental updates |
| `rank_bm25.py` | BM25Okapi (pure Python), `NodeBM25Index` with hierarchical weighting, Chinese/English tokenization |
| `config.py` | Unified configuration management: env vars > YAML (`~/.treesearch/config.yaml`) > built-in defaults |
| `cli.py` | CLI with `index` (glob support) and `search` subcommands |

## Why No Vector Embeddings?

Traditional RAG splits documents into fixed-size chunks and retrieves by vector similarity. This has known limitations:

1. **Lost structure**: Chunking destroys document hierarchy
2. **Boundary problems**: Important context may span chunk boundaries
3. **Semantic gaps**: Vector similarity misses reasoning-dependent queries

TreeSearch takes a different approach:

1. **Preserve structure**: Documents keep their natural hierarchy
2. **BM25 pre-scoring**: Structure-aware keyword matching with hierarchical weighting — no embedding model needed
3. **Reasoning over structure**: LLM reads section titles and summaries to navigate
4. **Best-First exploration**: Priority queue expands the most promising nodes first, with early stopping

## Why FTS5-only as Default?

FTS5-only is the default strategy because:

- **Zero-cost**: No LLM API key, no API calls, no cost
- **Instant**: Millisecond-level SQLite FTS5 inverted index queries
- **Structure-aware**: MD-aware columns (title/summary/body/code) with column weighting
- **Production-ready**: Persistent inverted index, WAL mode, incremental updates, CJK tokenization
- **Great baseline**: Benchmark results show FTS5-only already achieves strong performance

**Alternative**: For higher accuracy, upgrade to `best_first` (FTS5 + LLM).

## Why Best-First for LLM Enhancement?

Best-First search is the recommended LLM-enhanced strategy because:

- LLM uses `temperature=0` → evaluations are **deterministic**
- Same query + node always produces the same relevance score
- Priority queue is simple, fast, and natively supports FTS5/BM25 integration, early stopping, and budget control
- Batch comparative ranking reduces LLM calls vs per-node evaluation

## Data Flow

```
Input Documents (MD/TXT)
        │
        ▼
   ┌──────────┐
   │  Indexer  │  Parse headings → build tree → generate summaries
   └────┬─────┘    (build_index supports glob patterns for batch processing)
        │  JSON index files
        ▼
   ┌──────────┐
   │  search  │  FTS5 keyword match → (optional) route to docs → Best-First tree search
   └────┬─────┘
        │  dict result
        ▼
  Ranked nodes with text content
```

## Comparison with GraphRAG

| Dimension | GraphRAG | TreeSearch |
|-----------|----------|------------|
| Offline build cost | High (knowledge graph construction) | Low (trees are natural) |
| Update complexity | High (graph incremental update) | Low (rebuild single doc tree) |
| Explainability | Moderate (complex graph paths) | Strong (tree paths are intuitive) |
| Query latency | High | Controllable (budget mechanism) |
| Engineering complexity | High (graph DB + embedding + LLM) | Medium (pure LLM + BM25) |
| Chinese / vertical domains | Unstable (embedding quality dependent) | Customizable (LLM prompts) |
| Vector dependency | Required | Not needed |

**Key insight**: GraphRAG solves "how to build structure from unstructured data". TreeSearch solves "how to truly leverage existing structure". For documents that are naturally trees, TreeSearch is the more efficient, cheaper, and controllable approach — with FTS5 providing a zero-cost baseline and LLM reasoning as an optional enhancement.
