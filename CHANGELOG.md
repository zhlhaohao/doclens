# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-03-11

### Removed
- **Strategy routing**: Removed `strategy` parameter from `search()`, `TreeSearch`, `TreeSearchConfig`, and CLI. Pre-filter selection is now automatic based on `source_type` via `PREFILTER_ROUTING`
- **All LLM code**: Removed `_achat`, `_get_async_client`, `_achat_with_finish_reason`, `_needs_llm_fallback`, `_chunk_for_llm`, `_llm_generate_toc` from `indexer.py`
- **`model` parameter**: Removed from all indexing functions (`md_to_tree`, `text_to_tree`, `code_to_tree`, `build_index`, etc.)
- **`fallback_to_llm` parameter**: Removed from `text_to_tree()` — now pure rule-based heading detection only
- **`extract_json`**: Removed from `utils.py` (was only used by LLM code)
- **`llm` optional dependency**: Removed `openai`/`tiktoken` from `pyproject.toml` optional deps
- **CLI flags**: Removed `--strategy`, `--model`, `--fallback-to-llm` from CLI

### Changed
- `STRATEGY_ROUTING` renamed to `PREFILTER_ROUTING` (returns `list[str]` of pre-filter names)
- `get_strategy_for_source_type()` renamed to `get_prefilters_for_source_type()`
- `text_to_tree()` now uses pure rule-based heading detection; falls back to single root node if no headings detected
- `generate_summaries()` simplified: LLM branch removed, pure text summarization only
- `tokenizer.py` and `utils.py` extracted as standalone modules (previously inline in `rank_bm25.py` and `llm.py`)
- CJK tokenizer is now configurable via `TreeSearchConfig.cjk_tokenizer` and `TREESEARCH_CJK_TOKENIZER` env var

## [0.6.0] - 2026-03-10

### Removed
- `llm.py` — LLM client code moved inline to `indexer.py` (temporary, removed in 0.7.0)
- `rank_bm25.py` — BM25 and tokenizer code split into `tokenizer.py` and `utils.py`

### Changed
- CJK tokenizer made configurable (`auto` / `jieba` / `bigram` / `char`)
- Token counting simplified to rule-based (no tiktoken dependency)

## [0.5.0] - 2026-03-10

### Added
- **Parser registry** (`parsers/registry.py`): extensible `ParserRegistry` with `SOURCE_TYPE_MAP` and `PREFILTER_ROUTING`; built-in parsers auto-registered at import time
- **Python AST parser** (`parsers/ast_parser.py`): `ast` module extracts classes/functions with full signatures (parameters, return types, decorators); regex fallback on syntax errors
- **PDF parser** (`parsers/pdf_parser.py`): optional `pageindex`-based PDF text extraction
- **DOCX parser** (`parsers/docx_parser.py`): optional `python-docx`-based heading structure extraction
- **HTML parser** (`parsers/html_parser.py`): optional `beautifulsoup4`-based h1-h6 structure extraction
- `Document.source_type` field for file-type-aware pre-filter routing
- `_CombinedScorer` in search.py: combines GrepFilter + FTS5 for code file searches
- Optional dependencies: `pip install pytreesearch[pdf]`, `[docx]`, `[html]`, `[all]`

### Changed
- `search()` and `build_index()` parameters now default to `None` and resolve from `get_config()` at runtime (config-driven defaults)
- `node_id` encoding changed from fixed 4-digit zero-padded (`zfill(4)`) to variable-length `str(id)` — supports trees of any size
- `_index_one()` in `build_index()` now dispatches via `ParserRegistry.get(ext)` instead of hardcoded `if/elif` chain; unknown extensions fall back to `text_to_tree`
- `_detect_code_headings()` for `.py` files now tries AST parsing first, falls back to regex
- Config priority simplified: `set_config()` > env vars > defaults (YAML support removed)

### Fixed
- `cli.py` `_run_index()`: fixed dict access on `Document` objects (`r['doc_name']` -> `doc.doc_name`)
- FTS5 expression tokenization: `_tokenize_fts_expression()` now stems query terms while preserving FTS5 operators (AND/OR/NOT/NEAR)

## [0.4.0] - 2026-03-09

### Added
- SQLite FTS5 full-text search engine (`fts.py`) with persistent inverted index, WAL mode, incremental updates, and CJK tokenization
- FTS5 search: zero-LLM keyword matching over document trees
- Batch comparative ranking in tree search with context-aware batching
- `text_mode`, `include_ancestors`, `merge_strategy`, `pre_filter` parameters to `search()`
- Unified configuration management (`config.py`) with env > defaults
- `py.typed` PEP 561 marker for type checker support
- `__all__` in `__init__.py` for explicit public API
- `CHANGELOG.md` and `CONTRIBUTING.md`

### Removed
- `query_engine.py` (smart search, intent analysis, query decomposition, reflection)
- `chunk.py` (chunk-level refinement)
- MCTS tree search strategy (`MCTSTreeSearch`)
- `--smart` and `--mcts-iterations` CLI flags
- `QueryEngineConfig` from configuration

## [0.3.0] - 2026-02-01

### Added
- BM25 node-level pre-scoring with hierarchical field weighting
- Multi-document search
- Chinese + English tokenization support (jieba)
- CLI commands (`treesearch index`, `treesearch search`)
- Batch indexing with glob pattern support

## [0.2.0] - 2026-01-15

### Added
- Plain text indexing with rule-based heading detection

## [0.1.0] - 2026-01-01

### Added
- Initial release
- Markdown -> tree structure indexing
