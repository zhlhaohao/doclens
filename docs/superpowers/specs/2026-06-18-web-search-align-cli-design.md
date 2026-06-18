# Web 搜索对齐 CLI 综合评分管道

## 背景与动机

Cortex 的搜索有三个入口：TUI 交互 `/search`、CLI 子命令 `cortex search`、Web UI `POST /api/search`。

实测发现：**同一个查询，Web UI 返回的结果集与 CLI 不一致**。例如 query="健康"：
- CLI `cortex search 健康`：找到 21~25 条匹配
- Web UI `/api/search`：返回 56 条
- 排序、分数语义也都不同

根因：**Web UI 跳过了 `score_and_rank` 综合评分管道**，直接把 FTS5 + treesearch 返回的 `flat_nodes` 转 JSON。CLI/TUI 则会经过 `cortex.scoring_pipeline.score_and_rank`，做字面子串匹配过滤、综合评分、降级链等处理。

用户诉求：Web search 的搜索逻辑与 CLI **完全一致，结果完全相同**。

## 现状分析

### 三入口的调用链

```
TUI 交互 (/search)        → NotebookSearchCLI.do_search → idx.search → format_results → score_and_rank
CLI 子命令 (cortex search) → _cli_search                → idx.search → format_results → score_and_rank
Web UI (/api/search)      → _do_search → idx.search → _format_results（直接转 JSON，跳过 score_and_rank）
```

### score_and_rank 做了什么（CLI 已有，Web 缺失）

参考 `cortex/scoring_pipeline.py:20-66`：

1. **字面子串匹配过滤**：`_score_nodes` 用 `calc_proximity_score` 做严格的 `text_lower.find(kw_lower)` 检查，只保留 `cnt > 0` 的 node。FTS5 用 jieba 分词做 BM25 匹配，会返回大量"分词相关但字面不含关键词"的结果，score_and_rank 把这部分过滤掉
2. **综合评分**：`compute_composite_score` 加权计算（关键词匹配率 + 文件名匹配 + 标题匹配 + BM25 + 邻近度），输出 0~1 归一化分数
3. **每文档 top N**：每个 doc 只保留综合分前 `max_nodes_per_doc`（默认 3）个 node
4. **过滤**：`_filter_candidates` 按 composite 或 `(matched, proximity)` 组合条件过滤
5. **降级链**：FTS 无结果 → LIKE 子串搜索 → ripgrep 兜底；任一降级命中即返回，源标识 `source ∈ {"fts", "like", "ripgrep"}` 分支
6. **排序**：按 composite_score 降序

### 数量差异的来源

| 路径 | query="健康" 返回数 | 排序键 | 分数语义 |
|------|---------------------|--------|---------|
| 底层 `idx.search` flat_nodes | 56 | FTS5 BM25 原始分 | 1.x ~ 0.x |
| CLI 经 `score_and_rank` | 21 | composite 综合分 | 0 ~ 1（前端显示 96%） |
| Web UI 当前 | 56 | FTS5 BM25 原始分 | 1.x ~ 0.x |

差 31 条是"FTS5 命中但 node text 字面不含'健康'"的结果，CLI 过滤掉了，Web 全部返回。

## 范围

### In Scope
- `/api/search` 改为调用 `score_and_rank`，行为完全对齐 CLI
- 三重降级路径（FTS → LIKE → ripgrep）全部对齐
- `SearchResult.score` 语义改为 `composite_score`（0~1 归一化）
- `SearchResponse` 新增 `source: str` 字段，告知前端走哪条降级路径
- 前端 `result-card` 分数显示改为百分比（与 CLI 终端完全一致）
- 前端 `search-view` 在结果计数后追加 `(LIKE)` / `(ripgrep)` 降级标识

### Out of Scope
- **CLI/TUI 业务逻辑零改动**：`cortex_cli.py` / `scoring_pipeline.py` / `index_manager.py` / `scoring.py` 完全不动
- `--min-score` 参数 API 暴露：不新增，沿用 `config.min_score_threshold` 默认 0.0
- `fts_expression`（AND/OR/NOT/phrase）API 暴露：不在本次范围
- 历史 session 里的旧 score 字段迁移：旧值（BM25）在新代码下仅显示略奇怪，不影响搜索；不做迁移
- 前端 result-card 视觉重设计：仅改分数显示文本，不动布局/样式

## 架构

### 数据流

```
前端 search-view.searchApi({ query: "健康", limit: 20 })
  ↓
POST /api/search
  ↓
api/search.py: search(req, idx)
  ├─ start = time.perf_counter()
  ├─ result, limit = await asyncio.to_thread(_do_search, idx, req.query, req.limit)
  │    ├─ nodes, docs = idx.search(query, max_results=limit)        # IndexManager 路径不变
  │    ├─ query_words = tokenize_query(query) or [query.strip()]
  │    ├─ result = score_and_rank(nodes, docs, query, query_words, idx)
  │    │    ├─ FTS 有结果 → 评分 + 过滤 + 重排 → ScoreResult(source="fts", results=[...])
  │    │    ├─ FTS 空 + LIKE 命中 → ScoreResult(source="like", like_raw=[...])
  │    │    └─ FTS 空 + LIKE 空 → ripgrep → ScoreResult(source="ripgrep", results=[...])
  │    └─ return result, limit
  ├─ results = _format_scored_results(result, idx.path_map, idx.search_path, limit)
  │    ├─ source="fts":     取 result.results, composite 作为 score
  │    ├─ source="like":    取 result.like_raw, 固定 score=0.5（对齐 CLI _convert_like_to_render_items）
  │    └─ source="ripgrep": 取 result.results, 固定 score=0.0（对齐 CLI 固定分）
  ├─ return SearchResponse(
  │     results=results,         # 已在 _format_scored_results 内截断到 limit
  │     total=len(results),
  │     query=req.query,
  │     source=result.source,     # 新增字段
  │     elapsed_ms=int((time.perf_counter() - start) * 1000),
  │   )
```

### 组件边界

| 组件 | 职责 | 输入 | 输出 |
|------|------|------|------|
| `cortex/web_v2/api/search.py` | 调用 `score_and_rank`；按 source 分支格式化 | `SearchRequest` | `SearchResponse` |
| `cortex/web_v2/models/search.py` | schema 定义 | — | `SearchResponse` 加 `source` 字段；`SearchResult.score` 注释更新 |
| `cortex/web_v2/frontend/src/api/search.ts` + `state/types.ts` | TS 接口同步 | — | `SearchResponse.source` 字段 |
| `cortex/web_v2/frontend/src/components/result-card.ts` | 显示百分比分数 | `SearchResult.score (0~1)` | `评分: 96%` |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 结果计数 + 降级标识 | `SearchResponse.source` | `21 条结果` 或 `21 条结果 (LIKE)` |
| `cortex/scoring_pipeline.py` | **复用现有 `score_and_rank`** | — | — |
| `cortex/cortex_cli.py` | **无改动** | — | — |
| `cortex/index_manager.py` | **无改动** | — | — |

**关键点**：整个改动**完全不动** `cortex_cli.py` / `scoring_pipeline.py` / `index_manager.py` / `scoring.py`。仅改 Web API + 前端展示层。

## 关键实现决策

### 1. `_format_scored_results` 三分支

`ScoreResult` 的三个分支需分别转成 `SearchResult`：

```python
def _format_scored_results(
    result: ScoreResult,
    path_map: dict,
    search_path: str,
    limit: int,
) -> list[SearchResult]:
    """把 score_and_rank 的 ScoreResult 转成 SearchResult 列表。"""
    out: list[SearchResult] = []

    if result.source == "fts":
        # result.results: [(composite, (doc_id, node, matched, prox, fts)), ...]
        for composite, (doc_id, node, _matched, _prox, _fts) in result.results:
            doc_name = _doc_id_to_name(doc_id)
            path = _resolve_preview_path(doc_name, path_map, search_path)
            out.append(SearchResult(
                path=path,
                snippet=(node.get("text", "") or "")[:300],
                score=round(composite, 4),
                line=node.get("line_start"),
                highlights=[],
            ))

    elif result.source == "like":
        # result.like_raw: list[dict]，fts.like_search 返回格式
        for item in result.like_raw or []:
            doc_name = item.get("doc_name", "") or _doc_id_to_name(item.get("doc_id", ""))
            path = _resolve_preview_path(doc_name, path_map, search_path)
            out.append(SearchResult(
                path=path,
                snippet=(item.get("summary", "") or "")[:300],
                score=0.5,   # 对齐 CLI _convert_like_to_render_items 的固定分
                line=None,   # like_search 不返回 line_start
                highlights=[],
            ))

    elif result.source == "ripgrep":
        # result.results: [(doc_id, node, matched, prox, fts)] 无 composite
        for doc_id, node, _matched, _prox, _fts in result.results:
            doc_name = _doc_id_to_name(doc_id)
            path = _resolve_preview_path(doc_name, path_map, search_path)
            out.append(SearchResult(
                path=path,
                snippet=(node.get("text", "") or "")[:300],
                score=0.0,   # 对齐 CLI 固定分（is_ripgrep 时 display_items 用 0.0）
                line=node.get("line_start"),
                highlights=[],
            ))

    return out[:limit]
```

### 2. `doc_id` → `doc_name` 还原

`score_and_rank` 的 fts/ripgrep 分支返回的 `doc_id` 可能带 `_<hash>` 后缀（例如 `肠道健康与益生菌科学指南_a92d8cf8`），而 `IndexManager.path_map` 用 `doc_name`（无 hash）作 key。需在 Web API 层剥后缀，不修改 `score_and_rank` 签名：

```python
def _doc_id_to_name(doc_id: str) -> str:
    """剥掉 doc_id 的 _<hash> 后缀，返回 doc_name。

    例：'肠道健康与益生菌科学指南_a92d8cf8' → '肠道健康与益生菌科学指南'
        'simple' → 'simple'（无后缀时原样返回）
    """
    if "_" in doc_id:
        base, _, tail = doc_id.rpartition("_")
        if tail.isalnum() and len(tail) <= 16:
            return base
    return doc_id
```

### 3. `SearchResponse` schema 变更

```python
class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str
    elapsed_ms: int
    source: str = "fts"   # 新增：值 ∈ {"fts", "like", "ripgrep"}
```

前端 `search-view.ts` 显示 `X 条结果` 时，若 `source !== "fts"` 追加 `(LIKE)` 或 `(ripgrep)` 标识，与 CLI 的 `找到 N 个匹配 (LIKE)` 完全对齐。

### 4. `SearchResult.score` 语义变更（破坏性）

| 维度 | 旧（FTS5 BM25 原始分） | 新（composite 综合分） |
|------|----------------------|----------------------|
| 类型/范围 | float（1.x ~ 0.x） | float（0.0 ~ 1.0） |
| 来源 | `flat_nodes[].score` | `compute_composite_score` 加权输出 |
| CLI 对应 | TUI 终端显示 `评分: 96%` | 完全一致 |
| 前端显示 | 当前不显示或显示原始值 | result-card 改为 `评分: 96%` |

**破坏性影响**：
- 旧 session 历史里的 `score` 字段是 BM25 语义（如 1.618），新代码会按 composite 解读并显示为 `161.8%`。仅显示层奇怪，不影响搜索召回
- 不做 session 数据迁移（score 仅用于显示和排序，非关键字段）

### 5. `max_results` / `limit` 语义

`req.limit` 仅在最终输出截断（`out[:limit]`）。`score_and_rank` 内部不截断——这与 CLI 行为一致（CLI 也是在 `_render_results` 里 `display_items = results[:max_results]` 截断）。

`req.limit` 默认值 20，与 `config.max_results` 默认值 20 一致。用户可显式传 `limit` 控制。

### 6. 异常兜底

`score_and_rank` 抛异常时（理论不应发生），API 层 try/except 兜底为空结果 + log warning，不让整个 `/api/search` 挂掉：

```python
try:
    result, limit = await asyncio.to_thread(_do_search, idx, req.query, req.limit)
except Exception as e:
    logger.warning("score_and_rank failed: %s; returning empty result", e)
    return SearchResponse(results=[], total=0, query=req.query, source="fts", elapsed_ms=0)
```

`ripgrep` 降级需要外部 `rg` 进程；若进程不存在，`rg_module.rg_fallback_search` 返回空列表，`ScoreResult(source="ripgrep", results=[])`，API 正常响应。

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `cortex/web_v2/api/search.py` | 修改 | 调用 `score_and_rank`；新增 `_format_scored_results` 和 `_doc_id_to_name`；移除旧的 `_format_results` |
| `cortex/web_v2/models/search.py` | 修改 | `SearchResponse` 加 `source: str = "fts"` 字段；`SearchResult.score` 注释更新 |
| `cortex/web_v2/frontend/src/state/types.ts` | 修改 | `SearchResponse` 接口加 `source: string` |
| `cortex/web_v2/frontend/src/api/search.ts` | 修改 | `SearchResponse` 接口加 `source` |
| `cortex/web_v2/frontend/src/components/result-card.ts` | 修改 | 分数显示为百分比（`Math.round(score * 100)%`） |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 修改 | 结果计数后追加降级标识 `(LIKE)` / `(ripgrep)` |
| `tests/web_v2/test_search_api.py` | 扩展 | 新增 composite score / source 字段 / CLI 对齐回归测试 |
| `tests/web_v2/test_search_cli_parity.py` | 新建 | Web 前 N 条 vs CLI 前 N 条的对齐回归测试 |
| `cortex/web_v2/frontend/tests/result-card.spec.ts` | 扩展 | 断言 `score=0.965` → 显示 `96%` |
| `cortex/scoring_pipeline.py` | **无改动** | 复用 |
| `cortex/cortex_cli.py` | **无改动** | CLI 零变化 |
| `cortex/index_manager.py` | **无改动** | search 方法不变 |

## 测试策略

### 后端单元测试（扩展 `tests/web_v2/test_search_api.py`）

- `test_search_returns_composite_score`：query="健康"，断言每条 `result.score <= 1.0`（不再是 BM25 的 1.x）
- `test_search_source_is_fts_default`：默认走 FTS，`response.source == "fts"`
- `test_search_fts_results_match_cli`：**核心对齐断言**——同一 query，`/api/search` 前 N 条 `(path, line)` 与 CLI `format_results` 输出完全一致
- `test_search_min_score_threshold_default_no_filter`：默认 `config.min_score_threshold=0.0` 不过滤
- `test_search_all_empty_returns_ripgrep_source`：构造 FTS/LIKE/ripgrep 全部命空（如 query="zzz不存在的关键字"），断言 `source="ripgrep"`、`results=[]`（`score_and_rank._fallback_no_fts` 在 LIKE 也空时返回 `ScoreResult(results=[], source="ripgrep")`）

### CLI 对齐回归测试（新建 `tests/web_v2/test_search_cli_parity.py`）

```python
def test_web_search_matches_cli_top_20():
    """Web /api/search 的前 20 条 (path, line) 必须与 CLI cortex search 完全一致。"""
    # 1. 调 idx.search + score_and_rank，得到 CLI 路径的 ground truth（前 20 条）
    # 2. 调 /api/search，拿到 Web 路径结果
    # 3. 断言两者前 20 条 (path, line) tuple 完全一致
    # 4. 断言 score 都在 [0, 1] 区间
```

这个测试是"完全一致"诉求的守护测试——一旦未来任一端分叉，立即失败。

### 前端测试

- `result-card.spec.ts`：给定 `score=0.965`，断言显示 `96%`（四舍五入）；给定 `score=0.0`，显示 `0%`
- E2E（playwright-cli）：搜索 "健康" → 结果数 ≈ 21（与 CLI 一致），卡片显示百分比分数，header 显示 `21 条结果`（无 `(LIKE)` 后缀，因为走 FTS）；`limit` 参数默认 20，与 `config.max_results` 默认值一致

### 验收标准

1. **同一 query，Web `/api/search` 返回的 `(path, line)` 前 20 条与 CLI `cortex search` 完全一致**（守护测试通过）
2. `SearchResult.score` ∈ [0, 1]，与 CLI 综合分完全一致
3. `SearchResponse.source` ∈ {`"fts"`, `"like"`, `"ripgrep"`}
4. 前端 result-card 显示 `评分: 96%` 格式
5. 降级路径：FTS 无结果时返回 LIKE 或 ripgrep 结果（之前 Web 直接返空）
6. **CLI/TUI 行为零变化**（`cortex_cli.py` / `scoring_pipeline.py` / `index_manager.py` 零改动）
7. 所有现有测试继续通过

## 风险与备注

- **API 契约破坏性变更**：`SearchResult.score` 从 BM25 改为 composite（0~1）。外部调用者（如有）需适配。本次范围仅 cortex 项目自身，无外部消费者
- **旧 session 兼容**：历史 session 里存的 score 是旧语义，新代码显示会略奇怪（`161.8%`），不影响搜索召回。不做迁移
- **降级路径覆盖测试**：LIKE / ripgrep 是兜底场景，触发条件难构造（需要 FTS5 分词失败但字面匹配的 query）。单测中可用 monkey patch 强制让 `idx.search` 返空来触发降级
- **性能**：`score_and_rank` 是纯 Python 计算（邻近度扫描），对大文档（>100 nodes）可能略慢；但 CLI 已在线上使用同管道，性能可接受
- **`doc_id` 后缀剥除的脆弱性**：`_doc_id_to_name` 靠 `_<8~16位 alnum>` 模式识别 hash 后缀。若未来 treesearch 改变 doc_id 生成规则（如改用 UUID 或去掉后缀），此函数需同步调整；单测应覆盖 `simple_name`（无后缀）和 `name_a92d8cf8`（有后缀）两种情况
