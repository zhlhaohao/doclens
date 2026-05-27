# 搜索逻辑对齐：CLI search 与 TUI /search

## 背景

CLI `search` 子命令和 TUI `/search` 命令共享 FTS5 搜索和综合评分算法，但在过滤阈值、上下文选择策略和降级路径上存在差异。本次对齐目标是统一两者的搜索行为。

## 变更概览

| 维度 | 现状 | 目标 |
|------|------|------|
| TUI 过滤阈值 | 硬编码 `>= 0` | 使用 `config.min_score_threshold` |
| TUI 排序后二次过滤 | 无 | 当 `min_score_threshold > 0` 时再过滤 |
| TUI 上下文选择 | 简单策略（匹配行前后各1行） | CLI 智能锚点算法 |
| CLI LIKE 降级 | FTS → ripgrep | FTS → LIKE → ripgrep |

## 变更 1：TUI 过滤阈值对齐

**文件**: `cortex/tui/app.py` — `_do_search()` 方法

### 初始过滤

```python
# 现状 (第 681 行)
filtered = [
    item for item in all_candidates
    if item[5] >= 0  # 硬编码 0
    or (item[2] >= self.idx.min_keyword_match
        and item[3] >= self.idx.min_proximity_score)
]

# 目标
filtered = [
    item for item in all_candidates
    if item[5] >= self.idx.min_score_threshold  # 使用 config 阈值
    or (item[2] >= self.idx.min_keyword_match
        and item[3] >= self.idx.min_proximity_score)
]
```

### 排序后二次过滤

在 scored_results 排序后（第 734 行之后），增加：

```python
if self.idx.min_score_threshold > 0.0:
    scored_results = [r for r in scored_results if r[0] >= self.idx.min_score_threshold]
```

与 CLI `format_results()` 第 315-319 行逻辑一致。

## 变更 2：TUI 上下文选择对齐

**文件**: `cortex/tui/renderers/search.py` — `render_search_result()` 函数

### 参数变更

`render_search_result` 增加以下参数（对应 `IndexManager` 的配置属性）：

- `max_anchor_lines: int = 3`
- `context_expand_range: int = 5`
- `min_keywords_per_line: int = 2`
- `max_context_lines: int = 5`

`render_search_results` 也增加这些参数，透传给 `render_search_result`。

`app.py:_do_search()` 调用 `render_search_results` 时传入 `self.idx` 的配置值。

### 算法替换

替换现有的 `match_indices` 逻辑（第 107-128 行）为 CLI 的智能锚点算法：

1. 计算每行的关键词命中数
2. 按命中数降序排序
3. 筛选命中数 >= `min_keywords_per_line` 的行作为锚点候选
4. 若无满足条件的行，取前 `max_context_lines` 个匹配行
5. 取前 `max_anchor_lines` 个锚点
6. 每个锚点向前后扩展 `context_expand_range` 行
7. 汇总、去重、排序所有上下文行
8. 无匹配行时，取前 `max_context_lines` 个非空行（与 CLI fallback 一致）

## 变更 3：CLI 加 LIKE 降级

**文件**: `cortex/cortex_cli.py` — `format_results()` 方法

### FTS 无结果降级（第 208-224 行）

```python
# 现状：FTS 无结果直接 ripgrep
if not nodes:
    filtered = rg_module.rg_fallback_search(...)
    ...

# 目标：FTS 无结果先 LIKE，再 ripgrep
if not nodes:
    # 先尝试 LIKE 降级
    like_results = self.idx.like_search(query, max_results=self.max_results)
    if like_results:
        self._render_results(query, like_results, query_words, max_results, is_like=True)
        return
    # LIKE 也无结果，ripgrep 降级
    filtered = rg_module.rg_fallback_search(...)
    ...
```

### 排序后无结果降级（第 293-301 行）

```python
# 现状：排序后无结果直接 ripgrep
if not filtered:
    filtered = rg_module.rg_fallback_search(...)

# 目标：排序后无结果先 LIKE，再 ripgrep
if not filtered:
    like_results = self.idx.like_search(query, max_results=self.max_results)
    if like_results:
        self._render_results(query, like_results, query_words, max_results, is_like=True)
        return
    filtered = rg_module.rg_fallback_search(...)
```

### `_render_results` 支持 LIKE

`_render_results` 需要支持 `is_like=True` 参数，处理 LIKE 结果的格式。LIKE 结果格式为 `{doc_id, title, summary, fts_score, ...}`，需要适配渲染逻辑。

## 不变的部分

- 评分算法（`calc_proximity_score` + `compute_composite_score`）不变
- 评分权重不变
- TUI Rich Text 渲染方式不变（只是上下文选择策略变了）
- CLI ANSI 渲染方式不变
- kb_tools 的搜索逻辑不变（它已经使用 `min_score_threshold`）

## 涉及文件

| 文件 | 变更内容 |
|------|----------|
| `cortex/tui/app.py` | `_do_search()` 过滤阈值 + 二次过滤 + 传递上下文参数给 renderer |
| `cortex/tui/renderers/search.py` | `render_search_result()` 上下文选择算法 + 签名变更 |
| `cortex/cortex_cli.py` | `format_results()` 加 LIKE 降级 + `_render_results()` 支持 LIKE |
