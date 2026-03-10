# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-03-10

### Added
- **Parser registry** (`parsers/registry.py`): extensible `ParserRegistry` with `SOURCE_TYPE_MAP` and `STRATEGY_ROUTING`; built-in parsers auto-registered at import time
- **Python AST parser** (`parsers/ast_parser.py`): `ast` module extracts classes/functions with full signatures (parameters, return types, decorators); regex fallback on syntax errors
- **PDF parser** (`parsers/pdf_parser.py`): optional `pageindex`-based PDF text extraction
- **DOCX parser** (`parsers/docx_parser.py`): optional `python-docx`-based heading structure extraction
- **HTML parser** (`parsers/html_parser.py`): optional `beautifulsoup4`-based h1–h6 structure extraction
- `search()` `strategy="auto"` mode: per-document strategy routing based on `source_type` (code → GrepFilter + FTS5)
- `Document.source_type` field for file-type-aware search routing
- `_CombinedScorer` in search.py: combines GrepFilter + FTS5 for code file searches
- Optional dependencies: `pip install pytreesearch[pdf]`, `[docx]`, `[html]`, `[all]`

### Changed
- `search()` and `build_index()` parameters now default to `None` and resolve from `get_config()` at runtime (config-driven defaults)
- `node_id` encoding changed from fixed 4-digit zero-padded (`zfill(4)`) to variable-length `str(id)` — supports trees of any size
- `_index_one()` in `build_index()` now dispatches via `ParserRegistry.get(ext)` instead of hardcoded `if/elif` chain; unknown extensions fall back to `text_to_tree`
- `_detect_code_headings()` for `.py` files now tries AST parsing first, falls back to regex
- Config priority simplified: `set_config()` > env vars > defaults (YAML support removed)
- Default model changed from `gpt-4o-mini` to `gpt-4o`

### Fixed
- `cli.py` `_run_index()`: fixed dict access on `Document` objects (`r['doc_name']` → `doc.doc_name`)
- FTS5 expression tokenization: `_tokenize_fts_expression()` now stems query terms while preserving FTS5 operators (AND/OR/NOT/NEAR)

## [0.4.0] - 2026-03-09

### Added
- SQLite FTS5 full-text search engine (`fts.py`) with persistent inverted index, WAL mode, incremental updates, and CJK tokenization
- `fts5_only` and `best_first` search strategies for zero-LLM and LLM-enhanced retrieval
- Batch comparative ranking in `TreeSearch` with context-aware batching
- `text_mode`, `include_ancestors`, `merge_strategy`, `pre_filter` parameters to `search()`
- Unified configuration management (`config.py`) with env > YAML > defaults
- `py.typed` PEP 561 marker for type checker support
- `__all__` in `__init__.py` for explicit public API
- `CHANGELOG.md` and `CONTRIBUTING.md`

### Removed
- `query_engine.py` (smart search, intent analysis, query decomposition, reflection)
- `chunk.py` (chunk-level refinement)
- MCTS tree search strategy (`MCTSTreeSearch`)
- `--smart` and `--mcts-iterations` CLI flags
- `QueryEngineConfig` from configuration

### Changed
- `search()` strategy options: `best_first`, `fts5_only` (removed `mcts`, `llm`, `fts5_rerank`)
- CLI `--strategy` choices updated accordingly

## [0.3.0] - 2026-02-01

### Added
- BM25 node-level pre-scoring with hierarchical field weighting
- Best-First tree search as default strategy
- Multi-document search with LLM document routing
- Chinese + English tokenization support (jieba)
- CLI commands (`treesearch index`, `treesearch search`)
- Batch indexing with glob pattern support

## [0.2.0] - 2026-01-15

### Added
- MCTS tree search strategy
- Plain text indexing with rule-based heading detection
- LLM single-pass search

## [0.1.0] - 2026-01-01

### Added
- Initial release
- Markdown → tree structure indexing
- LLM-guided tree search
