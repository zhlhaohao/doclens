# Search Pagination — Design Spec

**Date:** 2026-06-20
**Topic:** 搜索结果页码分页（numbered pagination）
**Status:** Approved (pending user spec review)

## 1. 背景与动机

当前 `POST /api/search` 的分页契约是"残废"的：

- `SearchRequest.offset` 字段存在（`cortex/web_v2/models/search.py:11`），但 `cortex/web_v2/api/search.py` 从不读 `req.offset`
- `_format_scored_results` 用 `out[:limit]` 截断，`total = len(results)` —— total 只是当前页大小，不是真实匹配总数
- 前端拿到 total=20 永远显示"20 条结果"，无法知道是否还有更多

用户实际看到：搜索返回 ≤20 条，看不到剩余匹配。对大索引（数十/上百文档）极不友好。

本次目标：实现真正的页码分页，用户能看到 `共 X 条 · 第 N/M 页`，可点页码跳转。

## 2. 需求总结（用户决策）

| 维度 | 决策 |
|------|------|
| 交互样式 | 页码分页：`[上一页] [1] [2] ... [N] [下一页]` |
| 每页条数 | 20 条/页（与现有默认一致） |
| 架构方案 | 方案 A：放大 FTS 取数到 `_MAX_FETCH=1000`，全量过滤后切片 |
| `_MAX_FETCH` 上限 | 1000（超过部分不可见，v1 接受） |
| Session/History | **不动 session schema**；history 加载回到第 1 页（YAGNI） |
| Pagination 位置 | search-results 下方，跟随滚动（不做 sticky） |
| 大页码省略 | `totalPages > 7` 时中间用 `...` 省略 |

## 3. 架构与数据流

```
search-view._submit(query)
    ↓ (offset=0, limit=20)
POST /api/search {query, offset, limit}
    ↓
后端：
  1. idx.search(query, max_results=_MAX_FETCH=1000)   # 拉全部 FTS 候选
  2. score_and_rank(nodes, docs, ...)                  # 完整过滤+排序
  3. _format_scored_results(result, ...)               # 完整 SearchResult 列表
  4. total = len(all_results)
  5. safe_offset = min(req.offset, max(0, total-1)) if total > 0 else 0
  6. page = all_results[safe_offset : safe_offset + req.limit]
  7. 返回 {results: page, total, offset: safe_offset, limit, query, source, elapsed_ms}
    ↓
search-view:
  - state: results=page, total, offset=safe_offset, limit
  - 渲染 <search-results> + <pagination-bar>（仅当 total > limit）

用户点页码 N:
    ↓
search-view._goToPage(N)
  newOffset = (N-1) * limit
  searchApi({query, offset: newOffset, limit})
    ↓
  （同上，offset=newOffset）
```

## 4. 后端组件

### 4.1 `SearchResponse` 模型扩展（`cortex/web_v2/models/search.py`）

```python
class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int            # 真实过滤后总数（不再是 len(results)）
    offset: int = 0       # 当前页起始 offset（响应回显，便于调试）
    limit: int = 20       # 当前页大小
    query: str
    elapsed_ms: int
    source: str = "fts"
```

`SearchRequest` 不变（已有 `offset: int = Field(default=0, ge=0)`）。

### 4.2 `cortex/web_v2/api/search.py` 改造

新增模块常量：

```python
# 单次搜索拉取的最大 FTS 候选数。覆盖大部分实际匹配；
# score_and_rank 在此集合上做完整过滤+排序，提供准确 total。
# 超过此值的匹配不可见（v1 接受）。
_MAX_FETCH = 1000
```

**修改 `_do_search`**：把 `limit` 参数改为 `max_fetch`，默认 `_MAX_FETCH`：

```python
def _do_search(idx: IndexManager, query: str, max_fetch: int = _MAX_FETCH) -> ScoreResult:
    """在子线程中执行同步搜索 + 评分管道。"""
    nodes, docs = idx.search(query, max_results=max_fetch)
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]
    return score_and_rank(nodes, docs, query, query_words, idx)
```

**修改 `_format_scored_results`**：去掉 `limit` 参数和末尾 `out[:limit]` 切片，返回完整 list：

```python
def _format_scored_results(
    result: ScoreResult,
    path_map: dict,
    search_path: str,
) -> list[SearchResult]:
    """把 score_and_rank 的 ScoreResult 转成完整 SearchResult 列表（不切片）。

    切片由调用方（endpoint）按 offset/limit 处理。
    """
    out: list[SearchResult] = []
    # ... 三分支填充逻辑不变（fts/like/ripgrep）...
    return out  # 去掉 [:limit]
```

**修改 endpoint**：

```python
@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    try:
        result = await asyncio.to_thread(_do_search, idx, req.query)
    except Exception as e:
        logger.warning("score_and_rank failed: %s; returning empty result", e)
        return SearchResponse(
            results=[], total=0, offset=0, limit=req.limit,
            query=req.query, source="fts",
            elapsed_ms=int((time.perf_counter() - start) * 1000),
        )

    all_results = _format_scored_results(result, idx.path_map, idx.search_path)
    total = len(all_results)
    # offset 越界兜底：clamp 到最后一页的起点
    safe_offset = min(req.offset, max(0, total - 1)) if total > 0 else 0
    page = all_results[safe_offset : safe_offset + req.limit]
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return SearchResponse(
        results=page,
        total=total,
        offset=safe_offset,
        limit=req.limit,
        query=req.query,
        source=result.source,
        elapsed_ms=elapsed_ms,
    )
```

### 4.3 关键不变量

- **不动 `score_and_rank` / `idx.search`**：只在调用点把 `max_results` 从 `limit` 放大到 `_MAX_FETCH`
- **LIKE / ripgrep 降级路径同样支持分页**：`_format_scored_results` 三分支统一不切片，total 真实
- **`_MAX_FETCH=1000` 与用户可见 `limit` 解耦**：limit 是页大小（默认 20，上限 100），_MAX_FETCH 是搜索池上限

## 5. 前端组件

### 5.1 State（`cortex/web_v2/frontend/src/state/types.ts`）

`SearchViewState` 加 `offset` 和 `limit`：

```typescript
export interface SearchViewState {
  state: "initial" | "searching" | "focus";
  query: string;
  results: SearchResult[];
  total: number;
  source: "fts" | "like" | "ripgrep";
  offset: number;   // NEW，默认 0
  limit: number;    // NEW，默认 20
  // 其他现有字段...
}
```

`actions.setSearchState`（在 `cortex/web_v2/frontend/src/state/store.ts:108-112`）已用 `{...cur, ...s}` 浅合并，新字段自动支持；现有调用点（`_submit` 等）需补 offset/limit。访问方式：`store.getState().search`。

### 5.2 API client（`cortex/web_v2/frontend/src/api/search.ts`）

`SearchResponse` 接口加 `offset` 和 `limit`：

```typescript
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  offset: number;   // NEW
  limit: number;    // NEW
  query: string;
  elapsed_ms: number;
  source: "fts" | "like" | "ripgrep";
}
```

`searchApi` 函数签名已支持 `{query, mode?, limit?, offset?}`，**无需改动**。

### 5.3 `search-view.ts`（`cortex/web_v2/frontend/src/views/search-view.ts`）

1. **`_submit(query)`** 改造：显式传 `offset: 0, limit: 20`：

```typescript
const res = await searchApi({ query, offset: 0, limit: 20 });
actions.setSearchState({
  state: "focus",
  query,
  results: res.results,
  total: res.total,
  offset: 0,           // NEW
  limit: 20,           // NEW
  source: res.source,
});
```

2. **新增 `_goToPage(page: number)`**：

```typescript
private async _goToPage(page: number) {
  const s = store.getState().search;
  if (!s.query || s.state !== "focus") return;
  const limit = s.limit || 20;
  const newOffset = Math.max(0, (page - 1) * limit);
  if (newOffset === s.offset) return;  // 已在该页，no-op
  this.loading = true;
  try {
    const res = await searchApi({ query: s.query, offset: newOffset, limit });
    actions.setSearchState({
      state: "focus",
      query: s.query,
      results: res.results,
      total: res.total,
      offset: res.offset,  // 用后端 clamp 后的值
      limit,
      source: res.source,
    });
    // 翻页后预览面板清空（避免显示前一页的高亮）
    this.previewContent = "";
    this.previewPath = "";
    this.previewLine = null;
  } finally {
    this.loading = false;
  }
}

private _onPageChange = (e: CustomEvent<{ page: number }>) => {
  this._goToPage(e.detail.page);
};
```

3. **模板**：在 `<search-results>` 之后挂 `<pagination-bar>`，仅当 `s.total > s.limit` 时渲染：

```typescript
${s.total > s.limit
  ? html`<pagination-bar
      .total=${s.total}
      .offset=${s.offset}
      .limit=${s.limit}
      ?disabled=${this.loading}
      @page-change=${this._onPageChange}>
    </pagination-bar>`
  : null}
```

### 5.4 新组件 `cortex/web_v2/frontend/src/components/pagination-bar.ts`

Lit `<pagination-bar>` 元素：

```typescript
@customElement("pagination-bar")
export class PaginationBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
    }
    .meta {
      color: var(--cortex-text-subtle);
      text-align: center;
    }
    .pages {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    button {
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      min-width: 28px;
      height: 28px;
      padding: 0 8px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover:not(:disabled) {
      background: var(--cortex-surface-muted);
    }
    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    button.current {
      background: var(--cortex-primary);
      color: white;
      border-color: var(--cortex-primary);
    }
    .ellipsis {
      padding: 0 4px;
      color: var(--cortex-text-subtle);
    }
  `;

  @property({ type: Number }) total = 0;
  @property({ type: Number }) offset = 0;
  @property({ type: Number }) limit = 20;
  @property({ type: Boolean }) disabled = false;

  get currentPage(): number {
    return Math.floor(this.offset / this.limit) + 1;
  }
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  private _emitPage(page: number) {
    if (this.disabled) return;
    if (page < 1 || page > this.totalPages) return;
    this.dispatchEvent(
      new CustomEvent("page-change", { detail: { page } }),
    );
  }

  /**
   * 生成要渲染的页码槽位数组。
   * 数字 = 具体页码；"..." = 省略号。
   * 当 totalPages <= 7：渲染全部。
   * 否则：始终显示第 1 页、最后一页、当前页±1；中间用 "..." 折叠。
   */
  private _pageSlots(): Array<number | "..."> {
    const tp = this.totalPages;
    const cp = this.currentPage;
    if (tp <= 7) {
      return Array.from({ length: tp }, (_, i) => i + 1);
    }
    const slots: Array<number | "..."> = [1];
    const start = Math.max(2, cp - 1);
    const end = Math.min(tp - 1, cp + 1);
    if (start > 2) slots.push("...");
    for (let i = start; i <= end; i++) slots.push(i);
    if (end < tp - 1) slots.push("...");
    slots.push(tp);
    return slots;
  }

  render() {
    if (this.total <= this.limit) return html``;  // 单页不渲染
    const slots = this._pageSlots();
    return html`
      <div class="meta">
        共 ${this.total} 条 · 第 ${this.currentPage}/${this.totalPages} 页
      </div>
      <div class="pages">
        <button
          ?disabled=${this.disabled || this.currentPage === 1}
          @click=${() => this._emitPage(this.currentPage - 1)}
          aria-label="上一页">‹</button>
        ${slots.map((s) =>
          s === "..."
            ? html`<span class="ellipsis">…</span>`
            : html`<button
                class=${s === this.currentPage ? "current" : ""}
                ?disabled=${this.disabled}
                @click=${() => this._emitPage(s as number)}>${s}</button>`,
        )}
        <button
          ?disabled=${this.disabled || this.currentPage === this.totalPages}
          @click=${() => this._emitPage(this.currentPage + 1)}
          aria-label="下一页">›</button>
      </div>
    `;
  }
}
```

## 6. Session/History 行为（决策：保持现状）

- **不修改 session schema**：session 仍存首次搜索时的 page-1 结果，与现有行为一致
- **History 点击**：加载已保存的 page-1 结果，`offset` 重置为 0
- **已知限制（v1 接受）**：用户在 page 3 离开后从 history 回来会看到 page 1。后续如需"记忆页码"，可改 session 存 `query + offset` 并在 load 时重搜
- **不写入 session 路径加 offset 字段**：避免破坏现有 session 数据兼容性
- **`_goToPage` 不调用 `appendSession` / `updateSession`**：翻页是临时交互，不污染 history

## 7. 边界情况与防护

| 情况 | 处理 |
|------|------|
| total = 0 | 不渲染 `<pagination-bar>`；results 为空，保持现有"无结果"提示 |
| total ≤ limit（单页） | 不渲染 `<pagination-bar>`（无意义） |
| offset 越界（如 offset=1000, total=500） | 后端 clamp：`safe_offset = min(req.offset, max(0, total-1))`；前端按响应里的 `offset` 渲染 |
| limit = 100（上限） | 单页 100 条；只在 total > 100 时显示分页 |
| 大总数（1000+ 匹配） | `_MAX_FETCH=1000` 上限，total 最多显示 1000；超过部分不可见（v1 接受） |
| 搜索中又点页码 | `loading=true` → pagination-bar `disabled=true`，所有按钮不可点 |
| 切查询（新 search） | `_submit` 强制 offset=0，pagination-bar 回到第 1 页 |
| LIKE / ripgrep 降级 | 同样支持分页（_format_scored_results 三分支统一不切片） |
| total 恰好整除（如 40 条 / 20 每页） | 总 2 页，第 2 页满；下一页禁用 |
| 翻页时预览面板 | `_goToPage` 清空 previewContent/Path/Line，避免显示前一页高亮 |
| 翻页请求失败 | `loading=false`（finally），UI 回到可点状态；可加 toast 提示（YAGNI，先不加） |

## 8. 关键决策记录

1. **`_MAX_FETCH=1000` 是搜索池上限，与 limit 解耦**：limit 是页大小（用户可控，默认 20，上限 100），_MAX_FETCH 是后端拉取候选上限（固定 1000）。两者职责不同。
2. **不动 `score_and_rank` / `idx.search`**：只在调用点放大 max_results，管线内部零改动。降低回归风险。
3. **session 不变**：避免破坏现有数据；YAGNI。History 加载回到 page 1 是 v1 接受的 UX 简化。
4. **响应回显 offset/limit**：调试友好，前端可不依赖但可读。
5. **pagination-bar 在 search-results 下方**：跟随滚动，不做 sticky（YAGNI）。
6. **`_pageSlots` 智能省略**：`totalPages > 7` 时折叠中间页码，避免按钮溢出（典型：`1 ... 5 [6] 7 ... 20`）。
7. **翻页清空预览**：避免用户看到前一页的命中高亮位置（`data-source-line` 指向已不存在的块）。

## 9. 测试策略

### 9.1 后端（`tests/web_v2/test_search_api.py` 追加）

1. **`test_search_returns_real_total_when_matches_exceed_limit`** — 索引 30 个匹配文件，limit=20 → `total=30, len(results)==20`
2. **`test_search_offset_slices_correctly`** — offset=20, limit=20 → 返回第 21-30 条，与 offset=0 的前 20 条不重叠
3. **`test_search_offset_out_of_range_clamps`** — offset=1000, total=30 → `safe_offset` ≤ 30，返回最后一页（可能为空或部分）
4. **`test_search_offset_zero_first_page`（回归）** — offset=0 → 与现有行为一致
5. **`test_search_response_includes_offset_and_limit`** — 响应字段 `offset` 和 `limit` 存在且类型为 int
6. **`test_search_empty_results_total_zero`** — 无匹配查询 → `total=0, results=[], offset=0`
7. **`test_search_total_reflects_filter_not_fetch_size`** — FTS 返回 50 候选但字面过滤后剩 15 → `total=15`（不是 50 也不是 1000）

### 9.2 前端 — `pagination-bar` 单元测试（新建 `tests/pagination-bar.spec.ts`）

1. **`renders nothing when total <= limit`** — 单页时不渲染 `.pages`
2. **`renders page numbers when total > limit`** — total=100, limit=20 → 至少渲染几个页码按钮
3. **`clicking page dispatches page-change event with correct page`** — 点击页码 3 → 派发 `page-change { page: 3 }`
4. **`previous disabled on page 1`** — offset=0 时"上一页"按钮 disabled
5. **`next disabled on last page`** — offset=(totalPages-1)*limit 时"下一页"disabled
6. **`ellipsis shown when totalPages > 7`** — total=200, limit=20, currentPage=5 → 出现 `.ellipsis`
7. **`current page has .current class`** — 当前页按钮有高亮 class
8. **`disabled prop disables all buttons`** — `disabled=true` 时所有按钮 disabled

### 9.3 前端 — `search-view` 集成（追加到 `tests/search-view.spec.ts`）

1. **`new search resets offset to 0`** — 翻到 page 3 后再搜索新词 → state.offset === 0
2. **`_goToPage calls searchApi with new offset`** — mock fetch，验证请求 body 含正确 offset
3. **`pagination-bar rendered when total > limit`** — state.total=50, state.limit=20 → `pagination-bar` 元素存在
4. **`pagination-bar not rendered when total <= limit`** — state.total=15, state.limit=20 → 不存在

## 10. 不在本次范围内（YAGNI）

- Session 记忆页码（用户从 history 回到离开时的页）
- 跳页输入框（"跳到第 N 页"）
- 每页条数可配（10/20/50/100）
- URL 同步（page 出现在 URL，可分享/刷新保持）
- 翻页失败 toast 提示
- 翻页无限滚动替代方案
- Sticky pagination（滚动时常驻）
- 总数显示"1000+"提示（当超过 _MAX_FETCH 时）
- 键盘快捷键（左右箭头翻页）
- 翻页进度条/骨架屏（仅 loading disabled 即可）

## 11. 实施顺序（建议）

1. 后端 SearchResponse 模型加 offset/limit 字段（不破坏现有调用）
2. 后端 `_do_search` + `_format_scored_results` + endpoint 改造 + 7 个集成测试
3. 前端 API 类型 + state types 加 offset/limit
4. 前端新 `<pagination-bar>` 组件 + 8 个单元测试
5. 前端 search-view 接线（_submit / _goToPage / 模板挂载） + 4 个集成测试
6. `npm run build` 更新 `static/`
7. 手工冒烟（30+ 匹配的查询，验证页码 + 翻页 + 边界）
