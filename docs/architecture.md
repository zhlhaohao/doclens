# Architecture

**TreeSearch: Structure-aware document retrieval without embeddings.**

TreeSearch is a **structure-aware RAG** framework. Unlike traditional RAG systems that rely on vector embeddings and chunk splitting, TreeSearch preserves document structure as trees and uses FTS5 keyword matching for fast retrieval.

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

### Search Architecture

```
Query
  │
  ▼
[FTS5/Grep Pre-filter]
  │       - SQLite FTS5 inverted index with MD structure-aware columns
  │       - Hierarchical field weighting: title > summary > body
  │       - Chinese + English tokenization (jieba / regex)
  │       - GrepFilter for exact symbol matching (code files)
  │       - No LLM needed — instant results, millisecond-level
  ▼
[Cross-document Scoring]
  │       - FTS5 scores across all documents
  │       - Source-type routing: auto-select pre-filters by file type
  │       - Top-K document selection
  ▼
[Ranked Results]
          - Nodes with scores, paths, and source text
          - Line number references for code files
```

**Stage 1 - FTS5 Pre-Scoring**: `FTS5Index` scores all tree nodes using SQLite FTS5 inverted index with MD structure-aware columns and column weighting. Instant results, no LLM needed.

**Stage 2 - Source-Type Routing**: Pre-filters are automatically selected based on document `source_type` via `PREFILTER_ROUTING`. Code files get `GrepFilter` + `FTS5` combined scoring. Markdown/text files use `FTS5` only.

**Stage 3 - Ranked Results**: Top-scoring nodes are returned with text content, section titles, and line number references.

## Module Overview

| Module | Responsibility |
|---|---|
| `tree.py` | `Document` dataclass, tree traversal, persistence (save/load) |
| `indexer.py` | Markdown / plain text / code → tree structure conversion, batch `build_index()` |
| `search.py` | FTS5 scoring, source-type pre-filter routing, unified `search()` API |
| `fts.py` | SQLite FTS5 full-text search engine with MD structure-aware columns, WAL mode, incremental updates |
| `tokenizer.py` | Chinese/English tokenization (jieba / regex) |
| `utils.py` | Token counting utilities |
| `config.py` | Unified configuration management: env vars > built-in defaults |
| `cli.py` | CLI with `index` (glob support) and `search` subcommands |
| `parsers/` | Extensible parser registry: Markdown, code (AST+regex), PDF, DOCX, HTML, XML, JSON, CSV |

## Why No Vector Embeddings?

Traditional RAG splits documents into fixed-size chunks and retrieves by vector similarity. This has known limitations:

1. **Lost structure**: Chunking destroys document hierarchy
2. **Boundary problems**: Important context may span chunk boundaries
3. **Semantic gaps**: Vector similarity misses reasoning-dependent queries

TreeSearch takes a different approach:

1. **Preserve structure**: Documents keep their natural hierarchy
2. **FTS5 scoring**: Structure-aware keyword matching with hierarchical column weighting — no embedding model needed
3. **Source-type routing**: Automatic pre-filter selection based on file type (code → GrepFilter + FTS5)

## Why FTS5 as Default?

FTS5 is the default (and only) search strategy because:

- **Zero-cost**: No LLM API key, no API calls, no cost
- **Instant**: Millisecond-level SQLite FTS5 inverted index queries
- **Structure-aware**: MD-aware columns (title/summary/body/code) with column weighting
- **Production-ready**: Persistent inverted index, WAL mode, incremental updates, CJK tokenization
- **Great baseline**: Benchmark results show FTS5 already achieves strong performance

## Data Flow

```
Input Documents (MD/TXT/Code/JSON/CSV/HTML/XML/PDF/DOCX)
        │
        ▼
   ┌──────────┐
   │  Indexer  │  ParserRegistry dispatch → parse structure → build tree → generate summaries
   └────┬─────┘    (build_index supports glob patterns for batch processing)
        │  JSON index files
        ▼
   ┌──────────┐
   │  search  │  FTS5/Grep pre-filter → cross-doc scoring → ranked results
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
| Query latency | High | Millisecond-level |
| Engineering complexity | High (graph DB + embedding + LLM) | Low (SQLite FTS5 only) |
| Chinese / vertical domains | Unstable (embedding quality dependent) | Customizable (CJK tokenizer) |
| Vector dependency | Required | Not needed |

**Key insight**: GraphRAG solves "how to build structure from unstructured data". TreeSearch solves "how to truly leverage existing structure". For documents that are naturally trees, TreeSearch is the more efficient, cheaper, and controllable approach — with FTS5 providing a zero-cost baseline.
