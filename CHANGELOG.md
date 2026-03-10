# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
