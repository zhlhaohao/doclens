# 搜索评分管道去重设计

## 背景

CLI `search` 和 TUI `/search` 的评分/过滤/降级逻辑已对齐，但代码完全重复（~120 行）。本次重构提取公共管道函数，消除重复。

## 核心设计

### 新文件：`cortex/scoring_pipeline.py`

提取函数 `score_and_rank()`，封装从 FTS 原始结果到最终排序列表的完整管道。

```python
from dataclasses import dataclass

@dataclass
class ScoreResult:
    results: list[tuple]         # [(composite, (doc_id, node, matched, prox, fts))]
    source: str                  # "fts" | "like" | "ripgrep"
    like_raw: list[dict] | None  # LIKE 原始 dict（TUI renderer 需要 is_like 路径）

def score_and_rank(
    nodes: list[dict],
    docs: list[dict],
    query: str,
    query_words: list[str],
    idx_manager,
) -> ScoreResult:
```

### 管道逻辑

```
FTS 有节点？
  ├── 是: 评分 → 过滤 → 降级 >=1 → 排序 → 二次过滤
  │         结果非空？→ 返回 (source="fts")
  │         结果为空？→ LIKE 降级 → ripgrep 降级
  └── 否: LIKE 降级 → ripgrep 降级
```

具体步骤：

1. FTS 无结果：`idx_manager.like_search()` → 有则返回 `(source="like")`，无则 ripgrep → 返回 `(source="ripgrep")`
2. FTS 有结果：构建 doc_nodes_map → 计算 doc_fts_best → 逐文档评分 → 过滤 → 降级到 >=1 匹配
3. 步骤 2 结果为空：LIKE 降级 → ripgrep 降级
4. scored_results 排序 → 二次过滤 → 返回 `(source="fts")`

### 调用方精简

#### CLI (`cortex_cli.py:format_results`)

```python
def format_results(self, nodes, docs, query, max_results=20, min_score_threshold=0.0):
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]

    result = score_and_rank(nodes, docs, query, query_words, self.idx)

    if result.source == "like":
        like_items = self._convert_like_to_render_items(result.like_raw, query_words)
        self._render_results(query, like_items, query_words, max_results, is_like=True)
    elif result.source == "ripgrep":
        self._render_results(query, result.results, query_words, max_results, is_ripgrep=True)
    elif not result.results:
        print(f"\n[未找到包含 '{query}' 的结果]\n")
    else:
        if min_score_threshold > 0.0:
            # CLI 额外的分数过滤日志
            before = len(result.results)
            result.results = [r for r in result.results if r[0] >= min_score_threshold]
            if result.results:
                print(f"[分数过滤: 阈值 {min_score_threshold:.0%}, 过滤掉 {before - len(result.results)} 个低分结果]")
        if result.results:
            self._render_results(query, result.results, query_words, max_results)
```

#### TUI (`tui/app.py:_do_search`)

```python
def _do_search(self, query: str) -> None:
    worker = get_current_worker()
    if worker.is_cancelled:
        return
    try:
        nodes, docs = self.idx.search(query, max_results=self.max_results)
        query_words = tokenize_query(query)
        if not query_words:
            query_words = [w.strip() for w in query.split() if w.strip()]

        result = score_and_rank(nodes, docs, query, query_words, self.idx)

        render_kwargs = dict(
            query=query, query_words=query_words,
            path_map=self.idx.path_map, max_results=self.max_results,
            max_anchor_lines=self.idx.max_anchor_lines,
            context_expand_range=self.idx.context_expand_range,
            min_keywords_per_line=self.idx.min_keywords_per_line,
            max_context_lines=self.idx.max_context_lines,
        )

        if result.source == "like":
            renderables = render_search_results(results=result.like_raw, is_like=True, **render_kwargs)
        elif result.source == "ripgrep":
            renderables = render_search_results(results=result.results, is_ripgrep=True, **render_kwargs)
        else:
            renderables = render_search_results(results=result.results, **render_kwargs)

        self.call_from_thread(self._on_search_done, renderables)
    except Exception as exc:
        self.call_from_thread(self._on_search_error, str(exc))
```

### 涉及文件

| 文件 | 变更 |
|------|------|
| `cortex/scoring_pipeline.py` | 新建，~120 行（评分/过滤/降级管道） |
| `cortex/cortex_cli.py` | `format_results()` 从 ~140 行精简到 ~25 行 |
| `cortex/tui/app.py` | `_do_search()` 从 ~190 行精简到 ~30 行 |

### 不变的部分

- CLI `_render_results()` — ANSI 渲染不变
- TUI `renderers/search.py` — Rich 渲染不变
- `kb_tools.py` 搜索逻辑 — 独立路径，不动
- 上下文选择算法 — 各自 renderer 保留

### ScoreResult.results 格式

- `source="fts"` 时：`[(composite, (doc_id, node, matched, prox, fts))]` — 已排序、已过滤
- `source="like"` 时：`results` 为空列表，原始数据在 `like_raw`（`list[dict]`）中
- `source="ripgrep"` 时：`[(doc_id, node, matched, prox, fts)]` — ripgrep 返回格式
