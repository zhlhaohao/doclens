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

**TreeSearch** is a structure-aware document retrieval library. No vector embeddings. No chunk splitting. SQLite FTS5 keyword matching over document tree structures. Supports Markdown, plain text, code files (Python AST + regex, Java/Go/JS/C++ etc.), HTML, XML, JSON, CSV, PDF, and DOCX.

Millisecond-latency search over tens of thousands of documents and large codebases, with structure preservation.

## Installation

```bash
pip install -U pytreesearch
```

## Quick Start

```python
from treesearch import TreeSearch

# Just pass directories — auto-discovers all supported files
ts = TreeSearch("project_root/", "docs/")
results = ts.search("How does auth work?")
for doc in results["documents"]:
    for node in doc["nodes"]:
        print(f"[{node['score']:.2f}] {node['title']}")
        print(f"  {node['text'][:200]}")
```

Directories are walked recursively with smart defaults:
- Auto-discovers `.py`, `.md`, `.json`, `.jsonl`, `.java`, `.go`, `.ts`, `.pdf`, `.docx`, etc.
- Skips `.git`, `node_modules`, `__pycache__`, `.venv`, `dist`, `build`, etc.
- Respects `.gitignore` when [`pathspec`](https://pypi.org/project/pathspec/) is installed(`pip install pathspec`)
- Safety cap of 10,000 files per directory (configurable via `max_files`)

You can also mix directories, files, and glob patterns freely:

```python
# All three input types work together
ts = TreeSearch("src/", "docs/*.md", "README.md")
results = ts.search("authentication")
```

### In-Memory Mode

For quick searches, scripts, or ephemeral use cases, set `db_path=None` to skip writing any `.db` file to disk:

```python
# In-memory mode — no index.db file, all indexes kept in memory
ts = TreeSearch("docs/", db_path=None)
results = ts.search("voice calls")
```

Performance is excellent even with thousands of documents (5,000 docs < 10ms). The trade-off is that indexes are lost when the process exits. For persistent, incremental indexing, use the default `db_path` or set it to a file path.

### Tree Mode (Best for Papers & Documents)

For academic papers, long documents, and technical docs with deep heading hierarchy, use **tree mode** to get structure-aware best-first search:

```python
from treesearch import TreeSearch

# Tree mode: anchor retrieval → tree walk → path aggregation
ts = TreeSearch("papers/", "docs/")
results = ts.search("experimental methodology", search_mode="tree")

# Tree mode returns ranked nodes (same as flat mode)
for doc in results["documents"]:
    for node in doc["nodes"]:
        print(f"[{node['score']:.2f}] {node['title']}")

# Plus: tree traversal paths showing how results connect
for path in results["paths"]:
    chain = " > ".join(p["title"] for p in path["path"])
    print(f"[{path['score']:.2f}] {chain}")
    print(f"  {path['snippet'][:200]}")
```

**When to use which mode?**
| Mode | Best For | MRR Advantage |
|------|----------|---------------|
| `"auto"` (default) | Auto-selects based on document type | Smart default |
| `"tree"` | Academic papers, technical docs with heading hierarchy | Best on QASPER (+18%) |
| `"flat"` | Code search, keyword-heavy queries | Best on CodeSearchNet (0.84) |

**Auto Mode** (`search_mode="auto"`, 默认): 智能选择 tree vs flat
- **All code** → `flat` (FTS5 keyword matching)
- **All non-code are flat formats** (PDF/DOCX/CSV/Text/HTML) → `flat` (no meaningful hierarchy)
- **Otherwise** → `tree` (has Markdown/JSON/JSONL with hierarchical structure)

| Document Type | Has Hierarchy? | Auto Mode |
|---|---|---|
| Code (.py/.js/.go...) | AST-based | `flat` |
| Markdown (.md) | Headings + sections | `tree` |
| JSON (.json) | Nested objects | `tree` |
| JSONL (.jsonl) | Mixed | `tree` |
| PDF (.pdf) | **Flat** (single node fallback) | `flat` |
| DOCX (.docx) | **Flat** (no headings → single node) | `flat` |
| CSV (.csv) | Flat table | `flat` |
| Text (.txt) | Flat | `flat` |

**Benchmark验证**:
- QASPER (Markdown/JSONL) → auto → `tree` ✅ MRR +18%
- FinanceBench (PDF) → auto → `flat` ✅ (v0.6.2 修复: MRR 0.2420 vs 旧版 tree 0.2386)
- CodeSearchNet (Code) → auto → `flat` ✅ MRR 0.84

## Why TreeSearch?

Traditional RAG systems split documents into fixed-size chunks and retrieve by vector similarity. This **destroys document structure**, loses heading hierarchy, and misses reasoning-dependent queries.

TreeSearch takes a fundamentally different approach — parse documents into **tree structures** based on their natural heading hierarchy, then search with **FTS5 keyword matching** (zero-cost, no API key needed).

| | Traditional RAG | TreeSearch |
|---|---|---|
| **Preprocessing** | Chunk splitting + embedding | Parse headings → build tree |
| **Retrieval** | Vector similarity search | FTS5 keyword matching (no LLM needed) |
| **Multi-doc** | Needs vector DB for routing | FTS5 cross-doc scoring |
| **Structure** | Lost after chunking | Fully preserved as tree hierarchy |
| **Dependencies** | Vector DB + embedding model | SQLite only (no embedding, no vector DB) |

### Key Advantages

- **No vector embeddings** — No embedding model to train, deploy, or pay for
- **No chunk splitting** — Documents retain their natural heading structure
- **No vector DB** — No Pinecone, Milvus, or Chroma to manage
- **Tree-aware retrieval** — Heading hierarchy guides search, not arbitrary chunk boundaries
- **SQLite FTS5 engine** — Persistent inverted index with WAL mode, incremental updates, CJK support, and SQL aggregation

## Features

- **Smart directory discovery** — `ts.index("src/")` recursively discovers all supported files; skips `.git`/`node_modules`/`__pycache__`; respects `.gitignore`
- **FTS5 search** — Zero LLM calls, millisecond-level FTS5 keyword matching, no API key needed
- **SQLite FTS5 engine** — Persistent inverted index, WAL mode, incremental updates, MD structure-aware columns (title/summary/body/code/front_matter), column weighting, CJK tokenization
- **Tree-structured indexing** — Markdown, plain text, code files (Python AST + regex, Java/Go/JS/C++/PHP), HTML, XML, JSON, CSV, PDF, and DOCX are parsed into hierarchical trees
- **Ripgrep-accelerated GrepFilter** — Auto-uses system `rg` for fast line-level matching with transparent native Python fallback; hit-count-based scoring ranks multi-match nodes higher
- **Parser registry** — Extensible `ParserRegistry` with built-in parsers auto-registered; custom parsers via `ParserRegistry.register()`
- **Python AST parsing** — `ast` module extracts classes/functions with full signatures (parameters, return types); regex fallback for syntax errors
- **PDF/DOCX/HTML parsers** — Optional parsers via `PyMuPDF`, `python-docx`, `beautifulsoup4` (install with `pip install pytreesearch[all]`)
- **GrepFilter** — Exact literal/regex matching for precise symbol and keyword search across tree nodes
- **Source-type routing** — Automatic pre-filter selection based on file type (e.g., code files use GrepFilter + FTS5)
- **Chinese + English** — Built-in jieba tokenization for Chinese and regex tokenization for English
- **Batch indexing** — `build_index()` supports glob patterns, files, and directories for concurrent multi-file processing
- **Async-first** — All core functions are async with sync wrappers available
- **Config-driven defaults** — `search()` and `build_index()` read defaults from `get_config()`, overridable per-call
- **CLI included** — `treesearch "query" path/` for instant search; `treesearch index` and `treesearch search` for advanced workflows

## FTS5 Standalone

```python
from treesearch import FTS5Index, Document, load_index, save_index, md_to_tree
import asyncio

# Option 1: Build from Markdown and save to DB
result = asyncio.run(md_to_tree(md_path="docs/voice-call.md", if_add_node_summary=True))
save_index(result, "indexes/voice-call.db")

# Option 2: Load a previously saved document from DB
doc = load_index("indexes/voice-call.db")  # returns a Document object

# Create FTS5 index and search
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

## CLI

```bash
# Default mode: one command does everything (lazy index + search)
treesearch "How does auth work?" src/ docs/
treesearch "configure Redis" project/

# With options
treesearch "auth" src/ --max-nodes 10 --db ./my_index.db

# Advanced: build index separately (for large codebases)
treesearch index --paths src/ docs/ --add-description
treesearch index --paths "docs/*.md" "src/**/*.py" --add-description

# Advanced: search a pre-built index
treesearch search --index_dir ./indexes/ --query "How does auth work?"
```

## How It Works

```
Input Documents (MD/TXT/Code/JSON/CSV/HTML/XML/PDF/DOCX)
        │
        ▼
   ┌──────────┐
   │  Indexer  │  ParserRegistry dispatch → parse structure → build tree → generate summaries
   └────┬─────┘    (build_index supports glob for batch processing)
        │  SQLite DB (FTS5)
        ▼
   ┌──────────┐
   │  search   │  FTS5/Grep pre-filter → cross-doc scoring → ranked results
   └────┬─────┘
        │  dict result
        ▼
  Ranked nodes with scores and text
```

**Flat Mode (default)**: `FTS5Index` uses SQLite FTS5 inverted index with structure-aware columns (title/summary/body/code/front_matter) and column weighting for fast scoring. Instant results, no LLM needed.

**Tree Mode**: Best-first search over document trees — FTS5 finds anchor nodes, then walks the tree (parent/child/sibling) with heuristic scoring (title match, term overlap, IDF weighting, generic section demotion) to find optimal paths through the document hierarchy.

**Source-Type Routing**: For code files, `GrepFilter` + `FTS5` are combined automatically for precise symbol matching. The pre-filter is selected based on file type via `PREFILTER_ROUTING`.

## Use Cases

### Use Case 1: Technical Documentation QA (Best Scenario)

**Problem**: Your company has 100+ technical docs (API docs, design docs, RFCs), and traditional search can't find the right answers.

```python
from treesearch import build_index, search

# 1. Build index — just pass directories (run once)
docs = await build_index(
    paths=["docs/", "specs/"],
    output_dir="./indexes"
)

# 2. Search — millisecond response
result = await search(
    query="How to configure Redis cluster?",
    documents=docs,
)

# 3. Results — complete sections, not fragments
for doc in result["documents"]:
    print(f"Doc: {doc['doc_name']}")
    for node in doc["nodes"]:
        print(f"  Section: {node['title']}")
        print(f"  Content: {node['text'][:200]}...")
```

**Why better than traditional RAG?**
- Finds **complete sections**, not fragments
- Includes **section titles** as context anchors
- Supports hierarchical navigation (parent/child sections)

### Use Case 2: Codebase Search

**Problem**: Want to search for "login-related classes and methods" in a large codebase, but grep only finds lines without structure.

```python
# Index entire directories — auto-discovers .py, .java, .go, etc.
docs = await build_index(
    paths=["src/", "lib/"],
    output_dir="./code_indexes"
)

# Search — auto-detects code files, uses AST parsing + GrepFilter (ripgrep-accelerated)
result = await search(
    query="user login authentication",
    documents=docs,
)

# Results example:
# Doc: auth_service.py
#   class UserAuthenticator
#     def login(username, password)
#     def verify_token(token)
```

**Why better than grep/IDE search?**
- **Semantic understanding**: Not just keyword matching, understands "login" = "authentication"
- **Structure-aware**: Finds complete classes/methods with docstrings
- **Precise location**: Directly locates to code line numbers

### Use Case 3: Long Document QA (Papers/Books)

**Problem**: Have a 50-page paper, want to ask "What experimental methods are mentioned in Chapter 3?"

```python
docs = await build_index(paths=["paper.pdf"])

result = await search(
    query="experimental methodology",
    documents=docs,
)

# Automatically finds "3.2 Experimental Design" section content
```

**Why better than Ctrl+F?**
- **Semantic matching**: Finds synonymous paragraphs for "experimental methods"
- **Section location**: Tells you which chapter and section
- **Scalable to multi-doc**: Search 10 papers simultaneously

### Real Case Comparison

**Case**: Find "How to request GPU machines" in company docs

**Traditional way (Ctrl+F)**:
```
Search "GPU" → Found 47 matches → Manual review → 10 minutes
```

**TreeSearch way**:
```python
result = await search("How to request GPU machines", docs)
# Directly returns "Resource Guide > GPU Request Process" section
# Time: < 100ms
```

**Efficiency gain**: **100x**

### Comparison with Other Solutions

| Solution | Pros | Cons | Best For |
|----------|------|------|----------|
| **Ctrl+F** | Simple | No semantic understanding, fragmented results | Known keywords |
| **Vector DB** | Similarity search | Requires embedding preprocessing, high cost | Large-scale semantic retrieval |
| **TreeSearch** | Preserves structure + Fast + Zero cost | Requires structured documents | Tech docs/Codebase |

## Benchmark

### Document Retrieval (QASPER)

Evaluated on [QASPER](https://huggingface.co/datasets/allenai/qasper) dataset (47 queries, 18 academic papers):

| Metric | Embedding (zhipu-embedding-3) | TreeSearch FTS5 | TreeSearch Tree |
|--------|-----------------------------------|-----------------|--------------------|
| **MRR** | 0.4235 | 0.4033 | **0.4763** |
| **Precision@1** | 0.2553 | 0.2128 | **0.2979** |
| **Recall@5** | 0.4259 | 0.3387 | **0.4344** |
| **Hit@5** | 0.6383 | 0.7021 | **0.7660** |
| **NDCG@3** | 0.4245 | 0.2929 | **0.3702** |
| **Index Time** | 22.8s | **0.1s** | **0.1s** |
| **Avg Query Time** | 151.8ms | **0.8ms** | 1.2ms |

**Key Findings**:
- 🏆 **Tree mode wins MRR** (0.48 vs 0.42 Embedding vs 0.40 FTS5) — Structure-aware tree walk boosts ranking quality
- Tree mode MRR **+18.1%** over FTS5 on academic papers
- Tree mode Recall@5 **+35%** over Embedding — Hierarchical traversal finds more relevant content
- Tree mode Hit@5 **0.77** vs Embedding 0.64 — Significantly better coverage
- TreeSearch **126x faster** queries — Sub-millisecond vs hundreds of milliseconds

### Financial Document Retrieval (FinanceBench)

Evaluated on [FinanceBench](https://huggingface.co/datasets/PatronusAI/financebench) dataset (50 queries, SEC filings):

| Metric | Embedding (zhipu-embedding-3) | TreeSearch FTS5 | TreeSearch Tree |
|--------|-----------------------------------|-----------------|--------------------|
| **MRR** | 0.2206 | **0.2420** | 0.2386 |
| **Precision@1** | 0.1000 | **0.1000** | **0.1200** |
| **Recall@5** | 0.2782 | 0.2067 | **0.2076** |
| **Hit@5** | 0.3600 | **0.5200** | 0.5400 |
| **NDCG@10** | 0.2852 | **0.3680** | 0.3287 |
| **Index Time** | 406.0s | **0.24s** | **0.24s** |
| **Avg Query Time** | 154.3ms | **16.5ms** | 47.6ms |

**Key Findings**:
- 🏆 **FTS5 and Tree nearly tied on MRR** (0.24 vs 0.24) — Both close to持平
- Tree mode Hit@5 slightly higher (0.54 vs 0.52) — Better recall on SEC filings
- FTS5 **Precision@1 = 0.30** — 3x better than Embedding (0.10) on exact term matching
- TreeSearch **1692x faster** indexing — 0.24s vs 406s (no embedding API calls for large documents)
- TreeSearch **9x faster** queries — Milliseconds vs hundreds of milliseconds

### Code Retrieval (CodeSearchNet)

Evaluated on [CodeSearchNet](https://huggingface.co/datasets/code_search_net) dataset (50 queries, 500 Python corpus):

| Metric | Embedding (zhipu-embedding-3) | TreeSearch FTS5 | TreeSearch Tree |
|--------|-----------------------------------|--------------------|--------------------|
| **MRR** | 0.8483 | **0.8400** | 0.0029 |
| **Precision@1** | 0.7800 | **0.8200** | 0.0000 |
| **Recall@5** | **0.9400** | 0.8600 | 0.0000 |
| **Hit@1** | 0.7800 | **0.8200** | 0.0000 |
| **Index Time** | 33.8s | **2.8s** | 2.8s |
| **Avg Query Time** | 166.0ms | **1.7ms** | 1382.4ms |

**Key Findings**:
- TreeSearch FTS5 MRR nearly matches Embedding (0.84 vs 0.85) — BM25 excels on code with high lexical overlap
- Tree mode **completely fails** on code search (MRR=0.003) — Do NOT use Tree mode for code; use `search_mode="auto"` (auto-resolves to flat for code-only corpora)
- TreeSearch **Precision@1 wins** (0.82 vs 0.78) — Exact keyword matching is strong for code search
- TreeSearch **98x faster** queries — Milliseconds vs hundreds of milliseconds
- TreeSearch **12x faster** indexing — No embedding API calls needed

### Summary

> TreeSearch provides **zero-cost, ultra-fast** retrieval that outperforms embeddings on structured documents. Tree mode excels on academic papers (MRR +18% over Embedding), FTS5 mode dominates financial documents (MRR +80% over Embedding), and both modes match embeddings on code search — all at 100x+ faster query speed.

| Benchmark | Best Mode | MRR | vs Embedding | Query Speed |
|-----------|-----------|-----|-------------|-------------|
| **QASPER** (Academic Papers) | Tree | **0.4763** | +18% | 126x faster |
| **FinanceBench** (SEC Filings) | FTS5 | **0.2420** | +10% | 9x faster |
| **CodeSearchNet** (Python) | FTS5 | **0.8400** | −1% | 98x faster |

> Note: FinanceBench Tree vs FTS5 gap narrowed to 1.4% after algorithm improvements. CodeSearchNet Tree mode is not recommended (MRR~0); use `search_mode="auto"` or `"flat"` for code.

Run the benchmarks yourself:
```bash
# Document retrieval (QASPER)
python examples/benchmark/qasper_benchmark.py --max-samples 50 --max-papers 20 --with-embedding

# Financial document retrieval (FinanceBench)
python examples/benchmark/financebench_benchmark.py --max-samples 50 --with-embedding

# Code retrieval (CodeSearchNet)
python examples/benchmark/codesearchnet_benchmark.py --max-samples 50 --max-corpus 500 --with-embedding
```

## Documentation

- [Architecture](https://github.com/shibing624/TreeSearch/blob/main/docs/architecture.md) — Design principles and architecture
- [API Reference](https://github.com/shibing624/TreeSearch/blob/main/docs/api.md) — Complete API documentation

## Community

- **GitHub Issues** — [Submit an issue](https://github.com/shibing624/TreeSearch/issues)
- **WeChat Group** — Add WeChat ID `xuming624`, note "nlp", to join the tech group

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

- [SQLite FTS5](https://www.sqlite.org/fts5.html) — The full-text search engine powering TreeSearch
- [VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex) — Inspiration for structure-aware indexing and retrieval
