# API Reference

## Indexing

### `md_to_tree`

```python
async def md_to_tree(
    md_path: str = None,
    md_content: str = None,
    *,
    model: str = "gpt-4o-2024-11-20",
    if_thinning: bool = False,
    min_token_threshold: int = 5000,
    if_add_node_summary: bool = True,
    summary_token_threshold: int = 200,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
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
    model: str = "gpt-4o-2024-11-20",
    fallback_to_llm: str = "auto",  # "auto" | "yes" | "no"
    if_thinning: bool = False,
    ...
) -> dict
```

Build a tree index from plain text. Supports rule-based heading detection with optional LLM fallback.

**Heading patterns supported**: Numeric (`1.1`, `1.2.3`), Chinese chapters (`第一章`), Roman numerals (`I.`, `II.`), RST underlines, ALL CAPS, and more.

### `build_index`

```python
async def build_index(
    paths: list[str],
    output_dir: str = "./indexes",
    *,
    model: str = "gpt-4o-2024-11-20",
    if_add_node_summary: bool = True,
    if_add_doc_description: bool = True,
    if_add_node_text: bool = True,
    if_add_node_id: bool = True,
    **kwargs,
) -> list[dict]
```

Build tree indexes for multiple files concurrently. Accepts glob patterns (e.g. `["docs/*.md", "paper.txt"]`). Auto-detects `.md`/`.markdown` vs text by extension.

**Returns**: list of result dicts (same format as `md_to_tree` / `text_to_tree`)

---

## Search

### `search`

```python
async def search(
    query: str,
    documents: list[Document],
    model: Optional[str] = None,
    top_k_docs: int = 3,
    max_nodes_per_doc: int = 5,
    strategy: str = "fts5_only",
    value_threshold: float = 0.3,
    max_llm_calls: int = 30,
    use_bm25: bool = True,
    pre_filter: Optional[PreFilter] = None,
    expert_knowledge: str = "",
    text_mode: str = "full",
    include_ancestors: bool = False,
    merge_strategy: str = "interleave",
) -> dict
```

Search across one or more documents using tree-structured retrieval. This is the primary API — it natively supports multi-document search:

1. Route query to relevant documents (LLM reasoning, skipped for single doc)
2. (Optional) Pre-filter scoring over tree nodes for initial ranking
3. Tree search within each document (fts5_only / best_first)
4. Return ranked nodes with text content

**Args**:

| Parameter | Description |
|-----------|-------------|
| `query` | User query string |
| `documents` | List of `Document` objects (single or multiple) |
| `strategy` | `"fts5_only"` (default) or `"best_first"` |
| `max_llm_calls` | Max LLM calls per document (best_first only, default: 30) |
| `use_bm25` | Enable BM25 pre-scoring for best_first strategy (default: True) |
| `pre_filter` | Custom `PreFilter` instance for node pre-scoring (overrides `use_bm25`) |
| `value_threshold` | Minimum relevance score (default: 0.3) |
| `top_k_docs` | Max documents to search in routing stage (default: 3) |
| `max_nodes_per_doc` | Max result nodes per document (default: 5) |
| `expert_knowledge` | Optional domain knowledge to guide search |
| `text_mode` | `"full"` (default), `"summary"`, or `"none"` — controls text in results |
| `include_ancestors` | Attach ancestor titles for context anchoring (default: False) |
| `merge_strategy` | `"interleave"` (default), `"per_doc"`, or `"global_score"` — multi-doc merge |

### `search_sync`

Synchronous wrapper: `search_sync(query, documents, **kwargs) -> dict`

### `TreeSearch`

```python
class TreeSearch:
    def __init__(
        self,
        document: Document,
        query: str,
        model: Optional[str] = None,
        max_results: int = 5,
        threshold: float = 0.3,
        max_llm_calls: int = 30,
        bm25_scores: Optional[dict[str, float]] = None,
        bm25_weight: float = 0.3,
        depth_penalty: float = 0.02,
        use_subtree_cache: bool = True,
        text_excerpt_len: int = 300,
        adaptive_depth_threshold: int = 2,
        dynamic_threshold: bool = True,
        min_threshold: float = 0.15,
        max_prompt_tokens: int = 60000,
    )

    async def run(self) -> list[dict]

    @property
    def llm_calls(self) -> int

    @classmethod
    def clear_subtree_cache(cls)
```

**Default LLM-enhanced search strategy.** Deterministic best-first tree search with three-layer design:

- **Layer 1**: BM25/FTS5 pre-scoring (optional, provides initial priority via `bm25_scores`)
- **Layer 2**: Priority queue expansion with LLM batch comparative ranking (title + summary + text excerpt)
- **Layer 3**: Budget-controlled LLM calls with early stopping

**Features**:
- Batch comparative ranking: evaluate sibling nodes in one LLM call
- Context-aware batching: auto-split batches to respect model context window
- Adaptive depth: flat trees use single batch eval; deep trees use priority queue
- Dynamic threshold: median-based cutoff from first-round scores
- BM25 warm start: when provided, nodes start with BM25-based priority
- Early stopping: stops when top-of-queue score drops below `threshold`
- Budget control: `max_llm_calls` limits total LLM invocations
- Subtree cache: class-level `(query_fingerprint, node_id) -> relevance` cache for reuse

**Returns**: `[{'node_id', 'title', 'score'}]`

### `route_documents`

```python
async def route_documents(
    query: str,
    documents: list[Document],
    model: Optional[str] = None,
    top_k: int = 3,
) -> list[Document]
```

Select relevant documents by LLM reasoning over descriptions. No vector embeddings needed.

---

## BM25

### `tokenize`

```python
def tokenize(text: str) -> list[str]
```

Tokenize text for BM25 indexing. Supports Chinese and English:
- **Chinese**: jieba word segmentation (falls back to character-level if jieba not installed)
- **English**: lowercase + split on non-word characters
- **Mixed**: handled correctly

### `BM25Okapi`

```python
class BM25Okapi:
    def __init__(
        self,
        corpus: list[list[str]],
        k1: float = 1.5,
        b: float = 0.75,
        epsilon: float = 0.25,
    )

    def get_scores(self, query: list[str]) -> list[float]
    def get_top_n(self, query: list[str], n: int = 5) -> list[tuple[int, float]]
```

Pure Python BM25 Okapi implementation. No numpy dependency.

### `NodeBM25Index`

```python
class NodeBM25Index:
    def __init__(
        self,
        documents: list[Document],
        title_weight: float = 1.0,
        summary_weight: float = 0.7,
        body_weight: float = 0.3,
        ancestor_decay: float = 0.5,
        tokenizer: Callable = None,
    )

    def search(self, query: str, top_k: int = 20, propagate: bool = True) -> list[dict]
    def get_node_scores_for_doc(self, query: str, doc_id: str, top_k: int = 50) -> dict[str, float]
```

Structure-aware BM25 index over document tree nodes. No LLM needed — instant results.

**Features**:
- **Hierarchical field weighting**: `title × 1.0 + summary × 0.7 + body × 0.3`
- **Ancestor score propagation**: `parent.score += alpha × max(child.score)` — fixes BM25's structural blindness
- **Chinese + English** via jieba tokenizer
- **Multi-document** support with per-document filtering

**`search()` returns**: `[{'node_id', 'doc_id', 'title', 'summary', 'bm25_score'}]`

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
    metadata: dict = field(default_factory=dict)

    def get_tree_without_text(self) -> list
    def get_node_by_id(self, node_id: str) -> Optional[dict]
```

### Search Result (dict)

```python
# search() returns a dict:
{
    "documents": [  # [{'doc_id', 'doc_name', 'nodes': [{'node_id', 'title', 'text', 'score'}]}]
        ...
    ],
    "query": "",
}
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

# Search with FTS5-only (default, no API key needed)
treesearch search --index_dir ./indexes/ --query "How does authentication work?"

# Search with Best-First strategy (FTS5 + LLM, best accuracy)
treesearch search --index_dir ./indexes/ --query "How does authentication work?" --strategy best_first --fts

# Search without BM25 pre-scoring
treesearch search --index_dir ./indexes/ --query "auth" --no-bm25

# Control LLM budget
treesearch search --index_dir ./indexes/ --query "auth" --max-llm-calls 10
```
