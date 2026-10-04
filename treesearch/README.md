# TreeSearch

[简体中文](README.zh-CN.md)

Structure-aware document retrieval via tree-structured indexing.

**No vector embeddings. No chunk splitting.** TreeSearch parses each file into a heading tree that mirrors the document's own structure, then builds an FTS5 keyword index (SQLite's built-in full-text search) over the tree nodes. Every hit comes back with its chain of ancestor headings, so you always know which section it came from — a natural fit for keyword search over code bases, technical documentation, and note collections.

## Why TreeSearch

Vector RAG pipelines chunk documents, embed the chunks, and return approximate neighbors that are hard to explain or reproduce. TreeSearch keeps the structure intact and searches it with classic full-text ranking instead:

- **Explainable** — every hit is a tree node with a title, its ancestor headings, and source line numbers.
- **Reproducible** — FTS5 + BM25 ranking is deterministic: the same query over the same index always returns the same results.
- **Structure-aware** — a hit under *Configuration → Authentication* is distinguishable from a passing mention elsewhere.
- **Fully local** — one SQLite file holds everything: document trees, the FTS5 index, and incremental metadata. No embedding service, no vector database, no network calls.

## Installation

Requires Python ≥ 3.10. The PyPI distribution name is `treesearchlib`; the import name is `treesearch`.

```bash
pip install treesearchlib            # light core: Markdown / code / JSON / CSV / plain text
pip install "treesearchlib[all]"     # all capability groups except `legacy` (see table)
```

Install capability groups on demand:

| extras | capability | dependencies |
|--------|------------|--------------|
| `cjk` | Chinese/Japanese/Korean word segmentation (large quality gain for CJK queries) | jieba ≥ 0.42 |
| `parsers` | PDF / DOCX / XLSX / HTML parsing | pdfplumber, PyMuPDF, python-docx, python-pptx, openpyxl, beautifulsoup4 |
| `image` | Image files: placeholder nodes + EXIF/XMP metadata write-back | Pillow, piexif |
| `convert` | PPTX and misc formats → Markdown | markitdown |
| `ast` | Extended code languages via tree-sitter | tree-sitter-languages |
| `nlp` | English word stemming (Porter) | nltk |
| `gitignore` | Honor `.gitignore` during directory walks | pathspec |
| `legacy` | Old formats: doc / ppt / xls / rtf / epub | firecrawl-anydoc (no Windows-ARM64 wheel, hence not in `all`) |

Missing groups degrade gracefully: affected formats fall back to plain-text indexing and tokenization falls back — TreeSearch never crashes over a missing optional dependency. Outlook PST parsing is built in and ships a `pst-extract` sidecar binary with the package, so it works out of the box.

Watch mode (`treesearch watch`) needs the `watchdog` package, which is not part of any extras group — install it separately:

```bash
pip install treesearchlib watchdog
```

## Quick Start

### Library usage (most common)

```python
from treesearch import TreeSearch

# Lazy indexing — the index builds itself on the first search
ts = TreeSearch("./docs/")
results = ts.search("How to configure voice calls?")
```

Useful variations:

```python
# Eager indexing with explicit glob patterns
ts = TreeSearch()
ts.index("docs/*.md", "src/*.py")
results = ts.search("auth flow")

# In-memory mode — no .db file on disk; indexes vanish when the process exits
ts = TreeSearch("docs/", db_path=None)
results = ts.search("voice calls")

# Persist / reload an index file
ts.save_index("./my_index.db")
ts.load_index("./my_index.db")

# Batch: many queries share one warm index, results in input order
results = ts.batch_search(["authentication flow", "database schema", "rate limits"])
```

### CLI

```bash
# Default mode: lazy index + search in one shot
treesearch "How does auth work?" src/ docs/

# Build a persistent index, then search it repeatedly
treesearch index --paths src/ docs/
treesearch search --query "FTS5 search"

# Keep the index up to date automatically (needs: pip install watchdog)
treesearch watch --paths docs/
```

Both `treesearch` and `python -m treesearch` invoke the same CLI.

## CLI Reference

Default mode (no subcommand) — lazy index + search:

| option | default | meaning |
|--------|---------|---------|
| `query` (positional) | — | Query text; supports `auth*` (prefix) and `*auth*` (contains) |
| `paths...` (positional) | — | Files, directories, or glob patterns |
| `--db PATH` | `./index.db` | SQLite database file |
| `--search-mode {tree,flat}` | `tree` | `tree` = Best-First search over the document tree; `flat` = plain FTS5 |
| `--max-nodes N` | 5 | Max result nodes per document |
| `--show-path` | off | Also print path-style results with the traversal trace |
| `--regex` | off | Treat the query as a raw regex pattern |
| `--fts-expression EXPR` | — | Raw FTS5 expression, e.g. `"auth NEAR/5 token"` |

Subcommands:

| command | purpose | key options |
|---------|---------|-------------|
| `index` | Build or refresh an index | `--paths` (required), `-o/--output_dir` (default `./indexes`), `--force` full rebuild, `--stats` detailed statistics |
| `search` | Search a pre-built index | `--query` or `--fts-expression` (exactly one required), `--index_dir` (default `./indexes`), `--top-k-docs` (3), `--search-mode {auto,tree,flat}` (auto) |
| `verify` | Index consistency check + repair | `--db` (required), `--repair` drop orphan rows, `--drop-missing-files` also delete docs whose source file is gone |
| `watch` | Push-based incremental indexing | `--paths` (required), `--db` (default `./index.db`), `--debounce` (0.5 s), `--ext` extension whitelist, `--poll SECONDS` polling backend for NFS/CIFS shares |

## Supported Formats

| family | extensions | requires |
|--------|------------|----------|
| Markdown | `.md` `.markdown` | — |
| Plain text | `.txt` `.log` `.rst` | — |
| Code (regex parser) | `.py` `.java` `.ts` `.tsx` `.js` `.jsx` `.cpp` `.h` `.c` `.cs` `.php` `.go` `.rb` `.rs` `.swift` `.kt` … | — |
| Code (tree-sitter, ~40 languages incl. Scala, Lua, R, SQL, Bash, Elixir, Erlang, Haskell, Julia, OCaml, Perl, TOML, YAML, Dockerfile, Make) | | `ast` |
| Data | `.json` `.jsonl` `.csv` | — |
| HTML / MHTML | `.html` `.htm` `.mhtml` `.mht` | `parsers` |
| PDF | `.pdf` | `parsers` |
| Word | `.docx` | `parsers` |
| Excel | `.xlsx` `.xlsm` `.xltx` `.xltm` | `parsers` |
| PowerPoint | `.pptx` | `convert` |
| Legacy office / e-book | `.doc` `.docm` `.ppt` `.pps` `.pot` `.xls` `.rtf` `.epub` | `legacy` |
| Outlook PST | `.pst` | — (sidecar bundled; every email becomes its own searchable document, attachments ≤ 100 MB are extracted for preview) |
| Images | `.png` `.jpg` `.jpeg` `.webp` | `image` |

Extensions without a registered parser fall back to plain-text indexing.

## Library API

`TreeSearch` is the only class most users need:

| member | meaning |
|--------|---------|
| `TreeSearch(*paths, db_path="./index.db", ...)` | Constructor. `db_path=None` → in-memory mode; `lazy_search=True` → DB-routed search that loads only the top-k document trees (memory peak O(top_k), designed for million-document corpora — the index must already exist and the caller keeps it fresh) |
| `index(*paths, force=False)` / `await aindex(...)` | Build or incrementally refresh the index |
| `search(query, **kw)` / `await asearch(...)` | Search; returns a dict with `documents`, `flat_nodes`, and `mode`. Key kwargs: `top_k_docs`, `max_nodes_per_doc`, `search_mode`, `text_mode`, `include_ancestors` |
| `batch_search(queries)` / `await abatch_search(...)` | Run many queries concurrently over one warm index; results come back in input order |
| `delete(*paths_or_ids)` | Remove documents from the index by source path or doc_id |
| `save_index(path)` / `load_index(path)` | Persist to / reload from a database file |
| `get_indexed_files()` / `get_index_stats()` | Inspect what is indexed and the statistics of the last index run |
| `resolve_glob_files(*paths)` | Expand glob patterns into the concrete file list |

The package also exports lower-level building blocks for advanced use: `build_index`, `md_to_tree`, `text_to_tree`, `search` / `search_sync`, `TreeSearcher` / `PathResult` / `build_query_plan` (the Best-First tree search), `Document` with tree serialization helpers, `FTS5Index`, and the config trio `TreeSearchConfig` / `get_config` / `set_config`.

## Configuration

Priority from high to low: `set_config(TreeSearchConfig(...))` → `TREESEARCH_*` environment variables → built-in defaults.

Environment variables:

| variable | values | default | purpose |
|----------|--------|---------|---------|
| `TREESEARCH_CJK_TOKENIZER` | `auto` `jieba` `bigram` `char` | `auto` | CJK tokenizer choice |
| `TREESEARCH_FINGERPRINT_MODE` | `stat` `content` | `stat` | `stat` = fast `(mtime_ns, size)` fingerprint; `content` = sampled hash (head/mid/tail 64 KB), robust against `touch` and CI replays |
| `TREESEARCH_PRUNE` | `1` `true` `yes` | on | Auto-delete orphan entries on directory walks |
| `TREESEARCH_ENABLE_SHADOW_MD` | `1` `true` `yes` | on | Hidden `.md` copies of binary files so the ripgrep fallback can search them |
| `TREESEARCH_ALLOWED_SOURCE_TYPES` | comma list | empty (all) | Restrict indexing to given source types, e.g. `markdown,code,pdf` |
| `TREESEARCH_MAX_DIR_FILES` | int, `0` = unlimited | 10000 | Safety cap per directory walk |
| `TREESEARCH_INDEX_CHUNK_SIZE` | int, `0` = no chunking | 500 | Files per parse-commit-release chunk; bounds memory on huge corpora |
| `TREESEARCH_XLSX_MAX_ROWS_PER_SHEET` | int | 10000 | Rows indexed per Excel sheet |
| `TREESEARCH_XLSX_MAX_CONSECUTIVE_EMPTY_ROWS` | int | 100 | Stop parsing after this many consecutive empty rows |

Frequently tuned fields on `TreeSearchConfig` itself: `top_k_docs` (3), `max_nodes_per_doc` (5), `search_mode` (`auto`), and the FTS column weights (`fts_title_weight` 5.0, `fts_summary_weight` 2.0, `fts_body_weight` 10.0).

## Design Notes

- **Tree-structured index** — every document becomes a heading tree whose nodes carry titles, summaries, and source line ranges. FTS5 is built at node level, so a hit is traceable to an exact section.
- **Zero vectors, zero chunking** — BM25 keyword ranking over tree nodes; results are explainable and reproducible.
- **Two search modes** — `tree` mode runs a Best-First Search over each document tree starting from anchor hits; `flat` mode returns raw FTS5 matches. `auto` degrades to flat for code-only corpora.
- **Incremental indexing** — stat or content fingerprints detect changes per file; orphaned entries are pruned on directory walks; the schema version is folded into every fingerprint, so upgrading TreeSearch transparently triggers a rebuild of stale indexes.
- **Chunked indexing** — large corpora are processed in chunks of 500 files (parse → commit → release memory), keeping memory flat all the way to millions of documents.
- **Shadow Markdown** — binary formats (PDF, DOCX, …) get hidden `.md` shadows so the ripgrep fallback path can still search them.

## License

Apache-2.0. Repository and issue tracker: <https://github.com/zhlhaohao/doclens>
