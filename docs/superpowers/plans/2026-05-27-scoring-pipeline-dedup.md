# 搜索评分管道去重 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提取 `score_and_rank()` 公共管道函数，消除 CLI 和 TUI 搜索中 ~120 行重复的评分/过滤/降级代码。

**Architecture:** 新建 `cortex/scoring_pipeline.py`，封装 FTS 评分 → 过滤 → 降级(LIKE/ripgrep) → 排序 → 二次过滤的完整管道。CLI 和 TUI 的 `format_results` / `_do_search` 调用此管道后仅保留渲染分发逻辑。

**Tech Stack:** Python, dataclasses

---

### Task 1: 创建 scoring_pipeline.py

**Files:**
- Create: `cortex/scoring_pipeline.py`

- [ ] **Step 1: 创建新文件**

创建 `cortex/scoring_pipeline.py`，内容如下：

```python
"""搜索评分管道 — 评分、过滤、降级的公共逻辑"""

from __future__ import annotations

from dataclasses import dataclass, field

from cortex.scoring import calc_proximity_score, compute_composite_score
from cortex import ripgrep as rg_module


@dataclass
class ScoreResult:
    """score_and_rank 的返回值"""

    results: list[tuple] = field(default_factory=list)
    source: str = "fts"  # "fts" | "like" | "ripgrep"
    like_raw: list[dict] | None = None  # LIKE 原始 dict（TUI renderer 需要）


def score_and_rank(
    nodes: list[dict],
    docs: list[dict],
    query: str,
    query_words: list[str],
    idx_manager,
) -> ScoreResult:
    """评分 → 过滤 → 降级 → 排序 → 二次过滤，返回统一结果。

    Args:
        nodes: FTS5 返回的 flat_nodes
        docs: FTS5 返回的 documents（含嵌套节点）
        query: 原始查询字符串
        query_words: 分词结果
        idx_manager: IndexManager 实例（提供配置和 like_search）
    """
    # ---- FTS 无结果：LIKE → ripgrep 降级 ----
    if not nodes:
        return _fallback_no_fts(query, query_words, idx_manager, {})

    # ---- FTS 有结果：评分 → 过滤 ----
    doc_nodes_map, doc_fts_best = _build_doc_maps(nodes, docs)
    all_candidates = _score_nodes(
        doc_nodes_map, doc_fts_best, query_words, idx_manager
    )
    filtered = _filter_candidates(
        all_candidates, query_words, idx_manager.min_keyword_match,
        idx_manager.min_proximity_score, idx_manager.min_score_threshold,
    )

    # ---- 降级到 >= 1 匹配 ----
    if not filtered and query_words:
        filtered = [item for item in all_candidates if item[2] >= 1]

    # ---- 最终降级 ----
    if not filtered:
        return _fallback_no_fts(query, query_words, idx_manager, doc_nodes_map)

    # ---- 排序 + 二次过滤 ----
    scored_results = _rank_results(filtered)
    if idx_manager.min_score_threshold > 0.0:
        scored_results = [
            r for r in scored_results
            if r[0] >= idx_manager.min_score_threshold
        ]

    return ScoreResult(results=scored_results, source="fts")


# ---- 内部辅助函数 ----


def _build_doc_maps(nodes, docs):
    """构建 doc_nodes_map 和 doc_fts_best。"""
    doc_nodes_map: dict[str, list[dict]] = {}
    for doc in docs:
        doc_id = doc.get("doc_id", "")
        doc_nodes_map[doc_id] = list(doc.get("nodes", []))

    doc_fts_best: dict[str, float] = {}
    for node in nodes:
        doc_id = node.get("doc_id", "")
        score = node.get("score", 0.0)
        if doc_id not in doc_fts_best or score > doc_fts_best[doc_id]:
            doc_fts_best[doc_id] = score

    return doc_nodes_map, doc_fts_best


def _score_nodes(doc_nodes_map, doc_fts_best, query_words, idx_manager):
    """对每个文档的所有节点计算综合评分，每文档取 top N。"""
    doc_best: dict[str, list[tuple]] = {}
    for doc_id in doc_nodes_map:
        all_nodes = doc_nodes_map[doc_id]
        node_scores: list[tuple] = []
        for n in all_nodes:
            n_text = n.get("text", "") or ""
            cnt, proximity = calc_proximity_score(
                n_text, query_words, max_span=idx_manager.max_span
            )
            if cnt > 0:
                composite, factors = compute_composite_score(
                    matched_count=cnt,
                    total_keywords=len(query_words),
                    doc_name=doc_id,
                    node_title=n.get("title", ""),
                    fts_score=doc_fts_best.get(doc_id, 0.0),
                    query_words=query_words,
                    weights=idx_manager.scoring_weights,
                    proximity=proximity,
                )
                node_scores.append((n, cnt, proximity, composite, factors))
        node_scores.sort(key=lambda x: -x[3])
        top_n = node_scores[: idx_manager.max_nodes_per_doc]
        if top_n:
            doc_best[doc_id] = [
                (n, cnt, prox, doc_fts_best.get(doc_id, 0.0), composite, factors)
                for n, cnt, prox, composite, factors in top_n
            ]

    all_candidates = []
    for did, node_list in doc_best.items():
        for bn, cnt, prox, fts, composite, _factors in node_list:
            all_candidates.append((did, bn, cnt, prox, fts, composite))
    return all_candidates


def _filter_candidates(all_candidates, query_words, min_keyword_match,
                       min_proximity_score, min_score_threshold):
    """初始过滤：composite >= threshold OR (关键词匹配 AND 邻近度)。"""
    return [
        item
        for item in all_candidates
        if item[5] >= min_score_threshold
        or (item[2] >= min_keyword_match and item[3] >= min_proximity_score)
    ]


def _rank_results(filtered):
    """按综合评分排序，返回 [(composite, (doc_id, node, matched, prox, fts))]。"""
    scored_results = []
    for item in filtered:
        did, display_node, matched, prox, fts, composite = item[:6]
        scored_results.append((composite, (did, display_node, matched, prox, fts)))
    scored_results.sort(key=lambda x: -x[0])
    return scored_results


def _fallback_no_fts(query, query_words, idx_manager, doc_nodes_map):
    """FTS 无结果时的降级路径：LIKE → ripgrep。"""
    like_results = idx_manager.like_search(query, max_results=idx_manager.max_results)
    if like_results:
        return ScoreResult(results=[], source="like", like_raw=like_results)

    filtered = rg_module.rg_fallback_search(
        query,
        idx_manager.path_map,
        doc_nodes_map,
        query_words,
        context_before=idx_manager.rg_context_before,
        context_after=idx_manager.rg_context_after,
    )
    return ScoreResult(results=filtered, source="ripgrep")
```

- [ ] **Step 2: 验证导入**

```bash
cd E:/github/cortex
.venv/Scripts/python.exe -c "from cortex.scoring_pipeline import score_and_rank, ScoreResult; print('OK')"
```

预期: `OK`

- [ ] **Step 3: Commit**

```bash
git add cortex/scoring_pipeline.py
git commit -m "refactor(search): 提取评分管道 score_and_rank 公共函数"
```

---

### Task 2: 精简 TUI _do_search

**Files:**
- Modify: `cortex/tui/app.py`

- [ ] **Step 1: 添加导入**

在 `cortex/tui/app.py` 第 27 行（`from cortex import ripgrep as rg_module` 之后），添加：

```python
from cortex.scoring_pipeline import score_and_rank
```

- [ ] **Step 2: 替换 _do_search 方法**

将 `_do_search()` 方法（第 579-771 行）整体替换为：

```python
    def _do_search(self, query: str) -> None:
        """后台线程：执行搜索"""
        worker = get_current_worker()
        if worker.is_cancelled:
            return

        try:
            # 执行 FTS5 搜索
            nodes, docs = self.idx.search(query, max_results=self.max_results)

            # 分词
            query_words = tokenize_query(query)
            if not query_words:
                query_words = [w.strip() for w in query.split() if w.strip()]

            # 评分管道
            result = score_and_rank(nodes, docs, query, query_words, self.idx)

            # 渲染参数
            render_kwargs = dict(
                query=query,
                query_words=query_words,
                path_map=self.idx.path_map,
                max_results=self.max_results,
                max_anchor_lines=self.idx.max_anchor_lines,
                context_expand_range=self.idx.context_expand_range,
                min_keywords_per_line=self.idx.min_keywords_per_line,
                max_context_lines=self.idx.max_context_lines,
            )

            if result.source == "like":
                renderables = render_search_results(
                    results=result.like_raw, is_like=True, **render_kwargs
                )
            elif result.source == "ripgrep":
                renderables = render_search_results(
                    results=result.results, is_ripgrep=True, **render_kwargs
                )
            else:
                renderables = render_search_results(
                    results=result.results, **render_kwargs
                )

            self.call_from_thread(self._on_search_done, renderables)

        except Exception as exc:
            self.call_from_thread(self._on_search_error, str(exc))
```

- [ ] **Step 3: 清理不再需要的导入**

检查 `app.py` 中的 `calc_proximity_score` 和 `compute_composite_score` 导入是否还有其他地方使用。如果只在 `_do_search` 中使用，可以从第 26 行删除：

查找第 26 行：
```python
from cortex.scoring import tokenize_query, calc_proximity_score, compute_composite_score
```

如果 `calc_proximity_score` 和 `compute_composite_score` 在 `app.py` 中不再有其他引用，替换为：
```python
from cortex.scoring import tokenize_query
```

如果仍有其他引用，保持不变。

同理检查 `from cortex import ripgrep as rg_module`（第 27 行）。如果 `_do_ripgrep` 等其他方法仍在使用 `rg_module`，保持导入。

- [ ] **Step 4: 验证**

```bash
cd E:/github/cortex
.venv/Scripts/python.exe -c "from cortex.tui.app import CortexApp; print('TUI import OK')"
```

预期: `TUI import OK`

- [ ] **Step 5: Commit**

```bash
git add cortex/tui/app.py
git commit -m "refactor(tui/search): _do_search 调用 score_and_rank 管道，精简 ~160 行"
```

---

### Task 3: 精简 CLI format_results

**Files:**
- Modify: `cortex/cortex_cli.py`

- [ ] **Step 1: 添加导入**

在 `cortex/cortex_cli.py` 第 26 行（`from cortex import ripgrep as rg_module` 之后），添加：

```python
from cortex.scoring_pipeline import score_and_rank
```

- [ ] **Step 2: 替换 format_results 方法**

将 `format_results()` 方法（第 223-362 行）整体替换为：

```python
    def format_results(self, nodes, docs, query, max_results=20, min_score_threshold=0.0):
        """格式化搜索结果（协调器）"""
        # 分词
        query_words = tokenize_query(query)
        if not query_words:
            query_words = [w.strip() for w in query.split() if w.strip()]

        # 评分管道
        result = score_and_rank(nodes, docs, query, query_words, self.idx)

        if result.source == "like":
            like_items = self._convert_like_to_render_items(
                result.like_raw, query_words
            )
            self._render_results(
                query, like_items, query_words, max_results, is_like=True
            )
        elif result.source == "ripgrep":
            if not result.results:
                print(f"\n[未找到包含 '{query}' 的结果]\n")
                return
            self._render_results(
                query, result.results, query_words, max_results, is_ripgrep=True
            )
        elif not result.results:
            print(f"\n[未找到包含 '{query}' 的结果]\n")
        else:
            # CLI 额外的分数过滤日志
            scored_results = result.results
            if min_score_threshold > 0.0:
                filtered_count_before = len(scored_results)
                scored_results = [
                    r for r in scored_results if r[0] >= min_score_threshold
                ]
                if scored_results:
                    print(
                        f"[分数过滤: 阈值 {min_score_threshold:.0%}, "
                        f"过滤掉 {filtered_count_before - len(scored_results)} 个低分结果]"
                    )
            if scored_results:
                self._render_results(
                    query, scored_results, query_words, max_results
                )
            else:
                print(f"\n[未找到包含 '{query}' 的结果]\n")
```

- [ ] **Step 3: 清理不再需要的导入**

检查 `cortex_cli.py` 第 24 行：
```python
from cortex.scoring import tokenize_query, calc_proximity_score, compute_composite_score
```

如果 `calc_proximity_score` 和 `compute_composite_score` 在 `cortex_cli.py` 中不再有其他引用，替换为：
```python
from cortex.scoring import tokenize_query
```

如果仍有其他引用（例如在其他方法中），保持不变。

同理检查 `rg_module` 导入（第 26 行）。如果 `_render_results` 或其他方法中不再使用 `rg_module`，可以删除。但需要注意 `_render_results` 是否还在其他地方被调用。

- [ ] **Step 4: 验证**

```bash
cd E:/github/cortex
.venv/Scripts/python.exe -c "from cortex.cortex_cli import NotebookSearchCLI; print('CLI import OK')"
.venv/Scripts/python.exe -m cortex search python 2>&1 | head -15
```

预期: `CLI import OK`，然后搜索结果正常显示。

- [ ] **Step 5: Commit**

```bash
git add cortex/cortex_cli.py
git commit -m "refactor(cli/search): format_results 调用 score_and_rank 管道，精简 ~140 行"
```

---

### Task 4: 端到端验证

**Files:**
- 无代码变更

- [ ] **Step 1: 验证 CLI 搜索**

```bash
cd E:/github/cortex
.venv/Scripts/python.exe -m cortex search python
.venv/Scripts/python.exe -m cortex search python --min-score 0.5
```

预期: 搜索结果正常，带 `--min-score` 时有分数过滤日志。

- [ ] **Step 2: 验证 TUI 搜索**

```bash
.venv/Scripts/python.exe -m cortex
# 在 TUI 中输入: /s python
# /s token limit
```

预期: 搜索结果正常，上下文选择使用智能锚点。

- [ ] **Step 3: 验证 import 清洁度**

```bash
.venv/Scripts/python.exe -c "
from cortex.scoring_pipeline import score_and_rank, ScoreResult
from cortex.cortex_cli import NotebookSearchCLI
from cortex.tui.app import CortexApp
print('All imports OK')
"
```

预期: `All imports OK`，无 DeprecationWarning。
