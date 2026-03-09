[**🌐English**](https://github.com/shibing624/TreeSearch/blob/main/README.md) | [**🇨🇳中文**](https://github.com/shibing624/TreeSearch/blob/main/README_ZH.md)

<div align="center">
  <a href="https://github.com/shibing624/TreeSearch">
    <img src="https://raw.githubusercontent.com/shibing624/TreeSearch/main/docs/logo.svg" height="150" alt="Logo">
  </a>
</div>

-----------------

# TreeSearch: Structure-Aware Document Retrieval
[![PyPI version](https://badge.fury.io/py/pytreesearch.svg)](https://badge.fury.io/py/pytreesearch)
[![Downloads](https://static.pepy.tech/badge/pytreesearch)](https://pepy.tech/project/pytreesearch)
[![License Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![python_version](https://img.shields.io/badge/Python-3.10%2B-green.svg)](requirements.txt)
[![GitHub issues](https://img.shields.io/github/issues/shibing624/TreeSearch.svg)](https://github.com/shibing624/TreeSearch/issues)
[![Wechat Group](https://img.shields.io/badge/wechat-group-green.svg?logo=wechat)](#Community)

**TreeSearch** is a structure-aware document retrieval library. No vector embeddings. No chunk splitting. SQLite FTS5 + BM25 + LLM reasoning over document tree structures.

## Installation

```bash
pip install -U pytreesearch
```

## Quick Start

```python
import asyncio
from treesearch import build_index, load_index, Document, search, get_config, set_config

async def main():
    # Enable FTS5 (SQLite full-text search, default pre-filter)
    cfg = get_config()
    cfg.fts.enabled = True
    cfg.fts.db_path = "indexes/fts.db"  # persistent, or "" for in-memory
    set_config(cfg)

    # Build indexes for markdown files
    await build_index(paths=["docs/*.md"], output_dir="./indexes")

    # Load indexed documents
    import os
    documents = []
    for fp in sorted(os.listdir("./indexes")):
        if not fp.endswith(".json"):
            continue
        data = load_index(os.path.join("./indexes", fp))
        documents.append(Document(
            doc_id=fp, doc_name=data["doc_name"],
            structure=data["structure"],
            doc_description=data.get("doc_description", ""),
        ))

    # Search with Best-First strategy (FTS5 + LLM)
    result = await search(query="How does auth work?", documents=documents)
    for doc_result in result.documents:
        for node in doc_result["nodes"]:
            print(f"[{node['score']:.2f}] {node['title']}")

asyncio.run(main())
```

FTS5/BM25 strategies work out of the box with no API key. For LLM-enhanced strategies (`best_first`, `fts5_rerank`, `llm`), set up API key:

```bash
export OPENAI_API_KEY="sk-..."
# Optional: custom endpoint
export OPENAI_BASE_URL="https://api.openai.com/v1"
```

## Why TreeSearch?

Traditional RAG systems split documents into fixed-size chunks and retrieve by vector similarity. This **destroys document structure**, loses heading hierarchy, and misses reasoning-dependent queries.

TreeSearch takes a fundamentally different approach — parse documents into **tree structures** based on their natural heading hierarchy, then search with **FTS5/BM25 keyword matching** (zero-cost, no API key) or **LLM reasoning** for enhanced accuracy.

| | Traditional RAG | TreeSearch |
|---|---|---|
| **Preprocessing** | Chunk splitting + embedding | Parse headings → build tree |
| **Retrieval** | Vector similarity search | FTS5/BM25 pre-scoring + LLM tree search |
| **Multi-doc** | Needs vector DB for routing | LLM routes by document descriptions |
| **Structure** | Lost after chunking | Fully preserved as tree hierarchy |
| **Dependencies** | Vector DB + embedding model | SQLite only (LLM optional, no embedding, no vector DB) |
| **Zero-cost baseline** | N/A | FTS5/BM25-only search (no LLM needed) |

### Key Advantages

- **No vector embeddings** — No embedding model to train, deploy, or pay for
- **No chunk splitting** — Documents retain their natural heading structure
- **No vector DB** — No Pinecone, Milvus, or Chroma to manage
- **Tree-aware retrieval** — Heading hierarchy guides search, not arbitrary chunk boundaries
- **SQLite FTS5 pre-filter** (default) — Persistent inverted index with WAL mode, incremental updates, CJK support, and SQL aggregation
- **BM25 zero-cost baseline** — Instant keyword search with no API calls, useful as standalone or pre-filter
- **Budget-controlled LLM calls** — Set max LLM calls per query, with early stopping when confidence is high

## Features

- **FTS5-only search** (default) — Zero LLM calls, millisecond-level FTS5/BM25 keyword matching, no API key needed
- **SQLite FTS5 engine** — Persistent inverted index, WAL mode, incremental updates, MD structure-aware columns (title/summary/body/code/front_matter), column weighting, CJK tokenization
- **Tree-structured indexing** — Markdown and plain text documents are parsed into hierarchical trees
- **BM25 node-level index** — Structure-aware scoring with hierarchical field weighting (title > summary > body) and ancestor propagation
- **Best-First search** (optional) — Priority queue driven, FTS5 pre-scoring + LLM evaluation, early stopping and budget control
- **FTS5-rerank** — FTS5 candidates + single LLM listwise rerank, best cost/quality tradeoff
- **LLM single-pass** — One LLM call per document for minimal cost
- **Multi-document search** — Route queries across document collections via LLM reasoning
- **Chinese + English** — Built-in jieba tokenization for Chinese and regex tokenization for English
- **Batch indexing** — `build_index()` supports glob patterns for concurrent multi-file processing
- **Evaluation metrics** — Precision@K, Recall@K, MRR, NDCG@K, Hit@K, F1@K (in `examples/benchmark/metrics.py`)
- **Async-first** — All core functions are async with sync wrappers available
- **CLI included** — `treesearch index` and `treesearch search` commands

## FTS5 Standalone (No LLM Needed)

```python
from treesearch import FTS5Index, Document, load_index

data = load_index("indexes/my_doc.json")
doc = Document(doc_id="doc1", doc_name=data["doc_name"], structure=data["structure"])

fts = FTS5Index(db_path="indexes/fts.db")  # persistent, or omit for in-memory
fts.index_documents([doc])

# Simple keyword search
results = fts.search("authentication config", top_k=5)
for r in results:
    print(f"[{r['fts_score']:.4f}] {r['title']}")

# Advanced FTS5 query syntax
results = fts.search("auth", fts_expression='title:auth AND body:config', top_k=5)

# Per-document aggregation
agg = fts.search_with_aggregation("authentication", group_by_doc=True)
for doc_agg in agg:
    print(f"{doc_agg['doc_name']}: {doc_agg['hit_count']} hits, best={doc_agg['best_score']:.4f}")
```

## BM25 Standalone (No LLM Needed)

```python
from treesearch import NodeBM25Index, Document, load_index

data = load_index("indexes/my_doc.json")
doc = Document(doc_id="doc1", doc_name=data["doc_name"], structure=data["structure"])

index = NodeBM25Index([doc])
results = index.search("authentication config", top_k=5)
for r in results:
    print(f"[{r['bm25_score']:.4f}] {r['title']}")
```

## CLI

```bash
# Build indexes from glob pattern
treesearch index --paths "docs/*.md" --add-description

# Search with Best-First + FTS5 (default pre-filter)
treesearch search --index_dir ./indexes/ --query "How does auth work?" --fts

# Search with persistent FTS5 database
treesearch search --index_dir ./indexes/ --query "auth" --fts --fts-db ./indexes/fts.db

# Control LLM budget
treesearch search --index_dir ./indexes/ --query "auth" --max-llm-calls 10
```

## How It Works

```
Input Documents (MD/TXT)
        │
        ▼
   ┌──────────┐
   │  Indexer  │  Parse headings → build tree → generate summaries
   └────┬─────┘    (build_index supports glob for batch processing)
        │  JSON index files
        ▼
   ┌──────────┐
   │  search   │  FTS5 keyword match → (optional) route to docs → tree search
   └────┬─────┘
        │  SearchResult
        ▼
  Ranked nodes with scores and text
```

**Layer 1 — FTS5/BM25 Pre-Scoring**: `FTS5Index` (default) uses SQLite FTS5 inverted index with MD structure-aware columns and column weighting for fast pre-filtering. Alternatively, `NodeBM25Index` provides in-memory BM25 scoring. Both are instant, no LLM needed.

**Layer 2 — Tree Search** (optional): `TreeSearch` uses a priority queue to expand the most promising nodes. LLM evaluates each node's relevance (title + summary only). Early stopping when top score drops below threshold.

**Layer 3 — Results**: Budget-controlled LLM calls with subtree caching for reuse across similar queries.

### Search Strategies

| Strategy | Description | LLM Calls | Best For |
|----------|-------------|-----------|----------|
| `fts5_only` (default) | Pure FTS5/BM25 scoring | Zero | Fast keyword search, no API key needed |
| `fts5_rerank` | FTS5 top-N candidates + single LLM listwise rerank | 1 per doc | Best cost/quality tradeoff |
| `best_first` | FTS5/BM25 pre-scoring + priority queue + LLM evaluation | Moderate (budget-controlled) | Best accuracy |
| `llm` | Single LLM call per document | Minimal | Low-cost, simple queries |
| FTS5 standalone | `FTS5Index.search()` | Zero | Persistent inverted index, no API key |
| BM25 standalone | `NodeBM25Index.search()` | Zero | In-memory keyword search, no API key |

## Examples

| Example | Description |
|---------|-------------|
| [`01_basic_demo.py`](examples/01_basic_demo.py) | Basic demo: build index + search with FTS5/TreeSearch |
| [`02_index_and_search.py`](examples/02_index_and_search.py) | Single document indexing + FTS5 search |
| [`03_text_indexing.py`](examples/03_text_indexing.py) | Plain text → tree index with auto heading detection |
| [`04_cli_workflow.py`](examples/04_cli_workflow.py) | CLI workflow: build indexes + search with strategies |
| [`05_multi_doc_search.py`](examples/05_multi_doc_search.py) | Multi-doc BM25 + TreeSearch + strategy comparison + Chinese |

## Project Structure

```
treesearch/
├── llm.py            # Async LLM client with retry and JSON extraction
├── tree.py           # Document dataclass, tree operations, persistence
├── indexer.py        # Markdown / plain text → tree structure, batch build_index()
├── search.py         # Best-First, LLM search, document routing, unified search() API
├── fts.py            # SQLite FTS5 full-text search engine (persistent inverted index)
├── rank_bm25.py      # BM25Okapi, NodeBM25Index, Chinese/English tokenizer
├── config.py         # Unified configuration management (env > YAML > defaults)
└── cli.py            # CLI entry point (index / search)
```

## Documentation

- [Architecture](https://github.com/shibing624/TreeSearch/blob/main/docs/architecture.md) — Design principles and three-layer architecture
- [API Reference](https://github.com/shibing624/TreeSearch/blob/main/docs/api.md) — Complete API documentation

## Community

- **GitHub Issues** — [Submit an issue](https://github.com/shibing624/TreeSearch/issues)
- **WeChat Group** — Add WeChat ID `xuming624`, note "llm", to join the tech group

<img src="https://github.com/shibing624/TreeSearch/blob/main/docs/wechat.jpeg" width="200" />

## Citation

If you use TreeSearch in your research, please cite:

```bibtex
@software{xu2026treesearch,
  author = {Xu, Ming},
  title = {TreeSearch: Structure-Aware Document Retrieval Without Embeddings},
  year = {2026},
  publisher = {GitHub},
  url = {https://github.com/shibing624/TreeSearch}
}
```

## License

[Apache License 2.0](LICENSE)

## Contributing

Contributions are welcome! Please submit a [Pull Request](https://github.com/shibing624/TreeSearch/pulls).

## Acknowledgements

- [BM25 (Okapi BM25)](https://en.wikipedia.org/wiki/Okapi_BM25) — The classic probabilistic ranking function
- [VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex) — Inspiration for structure-aware indexing and retrieval
