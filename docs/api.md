# API Reference

## Indexing

### `md_to_tree`

```python
async def md_to_tree(
    md_path: str = None,
    md_content: str = None,
    *,
    if_thinning: bool = False,
    min_thinning_chars: int = 15000,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict
```

Build a tree index from a Markdown file or string.

**Returns**: `{'doc_name': str, 'structure': list, 'doc_description'?: str}`

### `text_to_tree`

```python
async def text_to_tree(
    text_path: str = None,
    text_content: str = None,
    *,
    if_thinning: bool = False,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict
```

Build a tree index from plain text. Uses rule-based heading detection.

**Heading patterns supported**: Numeric (`1.1`, `1.2.3`), Chinese chapters (`第一章`), Roman numerals (`I.`, `II.`), RST underlines, ALL CAPS, and more.

### `code_to_tree`

```python
async def code_to_tree(
    code_path: str,
    *,
    if_add_node_summary: bool = True,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict
```

Build a tree index from a code file. Python files use AST parsing; other languages use regex-based parsing.

### `build_index`

```python
async def build_index(
    paths: list[str],
    output_dir: str = "./indexes",
    *,
    if_add_node_summary: bool = True,
    if_add_doc_description: bool = True,
    if_add_node_text: bool = True,
    if_add_node_id: bool = True,
    max_concurrency: int = 5,
    force: bool = False,
    **kwargs,
) -> list[Document]
```

Build tree indexes for multiple files concurrently. Accepts glob patterns (e.g. `["docs/*.md", "src/**/*.py"]`). Auto-dispatches via `ParserRegistry` based on file extension.

**Returns**: list of `Document` objects

---

## Search

### `search`

```python
async def search(
    query: str,
    documents: list[Document],
    top_k_docs: int = 3,
    max_nodes_per_doc: int = 5,
    value_threshold: float = 0.3,
    pre_filter: Optional[PreFilter] = None,
    text_mode: str = "full",
    include_ancestors: bool = False,
    merge_strategy: str = "interleave",
) -> dict
```

Search across one or more documents using FTS5 keyword matching over tree structures. This is the primary API:

1. FTS5 pre-filter scoring over tree nodes
2. Source-type routing: auto-select pre-filters by file type (code → GrepFilter + FTS5)
3. Cross-document scoring and ranking
4. Return ranked nodes with text content

**Args**:

| Parameter | Description |
|-----------|-------------|
| `query` | User query string |
| `documents` | List of `Document` objects (single or multiple) |
| `pre_filter` | Custom `PreFilter` instance for node pre-scoring |
| `value_threshold` | Minimum relevance score (default: 0.3) |
| `top_k_docs` | Max documents to search (default: 3) |
| `max_nodes_per_doc` | Max result nodes per document (default: 5) |
| `text_mode` | `"full"` (default), `"summary"`, or `"none"` — controls text in results |
| `include_ancestors` | Attach ancestor titles for context anchoring (default: False) |
| `merge_strategy` | `"interleave"` (default), `"per_doc"`, or `"global_score"` — multi-doc merge |

**Returns**:

```python
{
    "documents": [
        {
            "doc_id": str,
            "doc_name": str,
            "nodes": [
                {"node_id": str, "title": str, "text": str, "score": float, ...}
            ]
        }
    ],
    "query": str,
}
```

### `search_sync`

Synchronous wrapper: `search_sync(query, documents, **kwargs) -> dict`

### `TreeSearch` (High-level API)

```python
class TreeSearch:
    def __init__(
        self,
        *patterns: str,
        db_path: str = "",
    )

    def index(self, *patterns: str) -> list[Document]
    def search(self, query: str, **kwargs) -> dict
    def resolve_glob_files(self) -> list[str]
    def get_indexed_files(self) -> list[dict]
```

High-level API for indexing + search. Recommended for most use cases.

**Features**:
- Lazy indexing: auto-builds index on first search
- Glob patterns for file selection
- Persistent SQLite database for incremental updates
- Sync interface (wraps async internally)

---

## FTS5

### `FTS5Index`

```python
class FTS5Index:
    def __init__(self, db_path: str = "")

    def index_documents(self, documents: list[Document]) -> None
    def search(self, query: str, top_k: int = 20, fts_expression: str = "") -> list[dict]
    def score_nodes(self, query: str, doc_id: str) -> dict[str, float]
    def search_with_aggregation(self, query: str, group_by_doc: bool = False) -> list[dict]
```

SQLite FTS5 full-text search engine with MD structure-aware columns.

**Features**:
- Persistent inverted index with WAL mode
- Incremental updates (add/remove documents)
- MD structure-aware columns: title, summary, body, code, front_matter
- Column weighting (configurable via `TreeSearchConfig`)
- CJK tokenization support (jieba / bigram)
- FTS5 query syntax support (AND/OR/NOT/NEAR)

### `GrepFilter`

```python
class GrepFilter:
    def __init__(self, documents: list[Document])
    def score_nodes(self, query: str, doc_id: str) -> dict[str, float]
```

Exact literal/regex matching for precise symbol and keyword search. Used automatically for code files via source-type routing.

---

## Data Models

### `Document`

```python
@dataclass
class Document:
    doc_id: str
    doc_name: str
    structure: list       # tree structure (list of root nodes)
    doc_description: str = ""
    source_type: str = ""  # "markdown", "code", "text", "json", etc.
    source_path: str = ""
    metadata: dict = field(default_factory=dict)

    def get_tree_without_text(self) -> list
    def get_node_by_id(self, node_id: str) -> Optional[dict]
```

---

## Tree Utilities

| Function | Description |
|---|---|
| `flatten_tree(structure)` | Flatten tree into list of node dicts |
| `find_node(structure, node_id)` | Find node by ID |
| `get_leaf_nodes(structure)` | Get all leaf nodes |
| `assign_node_ids(data)` | Assign zero-padded IDs to all nodes |
| `remove_fields(data, fields)` | Remove specified fields recursively |
| `save_index(index, path)` | Save tree index to JSON |
| `load_index(path)` | Load tree index from JSON |
| `print_toc(tree)` | Print tree as table of contents |

---

## CLI

```bash
# Build index from Markdown (single file)
treesearch index --paths document.md

# Build indexes from glob pattern (multiple files)
treesearch index --paths "docs/*.md" --add-description

# Build index from mixed file types
treesearch index --paths docs/*.md paper.txt -o ./indexes

# Search with FTS5
treesearch search --index_dir ./indexes/ --query "How does authentication work?"

# Search with persistent FTS5 database
treesearch search --index_dir ./indexes/ --query "auth" --fts --fts-db ./indexes/fts.db
```
