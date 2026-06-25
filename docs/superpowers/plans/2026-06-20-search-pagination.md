# Search Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为搜索结果实现页码分页（`[上一页] [1] [2] ... [N] [下一页]`），后端真实返回 total + 按 offset/limit 切片，前端渲染 `<pagination-bar>` 组件。

**Architecture:** 后端把 FTS 候选拉取数从 `limit` 放大到固定 `_MAX_FETCH=1000`，`score_and_rank` 完整过滤+排序后由 endpoint 按请求的 offset/limit 切片，返回真实 `total=len(filtered)`。前端 `SearchViewState` 加 `offset/limit`，新增 `<pagination-bar>` 组件，`search-view` 加 `_goToPage` 在翻页时重搜。

**Tech Stack:** FastAPI + Pydantic（后端）、Lit + Vitest（前端）、pytest-asyncio（集成测试）

**Spec:** `docs/superpowers/specs/2026-06-20-search-pagination-design.md`

---

## File Structure

| 路径 | 责任 | 动作 |
|------|------|------|
| `cortex/web_v2/models/search.py` | `SearchResponse` 加 `offset/limit` 字段 | Modify |
| `cortex/web_v2/api/search.py` | `_MAX_FETCH` 常量、`_do_search(max_fetch)`、`_format_scored_results` 去切片、endpoint 切片逻辑 | Modify |
| `tests/web_v2/test_search_api.py` | 7 个分页集成测试 | Modify（追加） |
| `cortex/web_v2/frontend/src/api/search.ts` | `SearchResponse` 接口加 `offset/limit` | Modify |
| `cortex/web_v2/frontend/src/state/types.ts` | `SearchViewState` 加 `offset/limit` | Modify |
| `cortex/web_v2/frontend/src/state/store.ts` | `INITIAL_STATE.search` 加 `offset/limit` 默认值 | Modify |
| `cortex/web_v2/frontend/src/components/pagination-bar.ts` | 新组件 | Create |
| `cortex/web_v2/frontend/tests/pagination-bar.spec.ts` | 组件单测 | Create |
| `cortex/web_v2/frontend/src/views/search-view.ts` | `_submit` 重置 offset、新增 `_goToPage`、模板挂载 `<pagination-bar>` | Modify |
| `cortex/web_v2/frontend/tests/search-view.spec.ts` | search-view 分页集成测试 | Modify（追加） |

---

## Task 1: Backend pagination (model + endpoint + integration tests)

**Files:**
- Modify: `cortex/web_v2/models/search.py`
- Modify: `cortex/web_v2/api/search.py`
- Test: `tests/web_v2/test_search_api.py`（追加）

- [ ] **Step 1.1: Append failing tests for pagination**

在 `tests/web_v2/test_search_api.py` 末尾追加。测试用 `_make_many_matches` helper 造 30 个匹配文件：

```python
# ---------------------------------------------------------------------------
# 分页测试（offset/limit/total 真实切片）
# ---------------------------------------------------------------------------


def _make_many_matches(tmp_path, count: int = 30, keyword: str = "paginationtest"):
    """造 count 个 .md 文件，每个都包含 keyword，确保 FTS+过滤后至少 count 个匹配。"""
    for i in range(count):
        (tmp_path / f"page_match_{i:02d}.md").write_text(
            f"# Doc {i}\n\nThis file contains {keyword} for matching.\n",
            encoding="utf-8",
        )


@pytest.mark.asyncio
async def test_search_returns_real_total_when_matches_exceed_limit(
    temp_workdir, env_cortex_config, reset_deps
):
    """30 个匹配文件、limit=20 → total=30, len(results)=20。"""
    _make_many_matches(temp_workdir, count=30)
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20, "offset": 0}
        )

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 30, f"expected total=30 (real match count), got {body['total']}"
    assert len(body["results"]) == 20, f"expected page size 20, got {len(body['results'])}"


@pytest.mark.asyncio
async def test_search_offset_slices_second_page(
    temp_workdir, env_cortex_config, reset_deps
):
    """offset=20, limit=20 → 第二页 20 条，与第一页不重叠。"""
    _make_many_matches(temp_workdir, count=30)
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res1 = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20, "offset": 0}
        )
        res2 = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20, "offset": 20}
        )

    page1_paths = {r["path"] for r in res1.json()["results"]}
    page2_paths = {r["path"] for r in res2.json()["results"]}
    assert len(page2_paths) == 10  # 30 - 20 = 10 remaining
    assert page1_paths.isdisjoint(page2_paths), "page 1 and page 2 should not overlap"


@pytest.mark.asyncio
async def test_search_offset_out_of_range_clamps(
    temp_workdir, env_cortex_config, reset_deps
):
    """offset=1000, total=30 → safe_offset clamp 到 max(0, total-1)=29，返回最后 1 条。"""
    _make_many_matches(temp_workdir, count=30)
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20, "offset": 1000}
        )

    body = res.json()
    assert body["total"] == 30
    # safe_offset = min(1000, 29) = 29；切片 [29:49] = 1 条
    assert body["offset"] == 29
    assert len(body["results"]) == 1


@pytest.mark.asyncio
async def test_search_offset_zero_first_page(
    temp_workdir, env_cortex_config, reset_deps
):
    """回归：offset=0 与不传 offset 行为一致。"""
    _make_many_matches(temp_workdir, count=30)
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_default = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20}
        )
        res_explicit = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 20, "offset": 0}
        )

    assert res_default.json()["results"] == res_explicit.json()["results"]


@pytest.mark.asyncio
async def test_search_response_includes_offset_and_limit(
    temp_workdir, env_cortex_config, reset_deps
):
    """响应里 offset/limit 字段存在且为 int。"""
    _make_many_matches(temp_workdir, count=30)
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/search", json={"query": "paginationtest", "limit": 15, "offset": 5}
        )

    body = res.json()
    assert isinstance(body["offset"], int)
    assert isinstance(body["limit"], int)
    assert body["offset"] == 5
    assert body["limit"] == 15


@pytest.mark.asyncio
async def test_search_empty_results_total_zero(
    env_cortex_config, reset_deps, temp_workdir
):
    """无匹配查询 → total=0, results=[], offset=0。"""
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/search",
            json={"query": "zzz_no_such_keyword_xyz", "limit": 20, "offset": 0},
        )

    body = res.json()
    assert body["total"] == 0
    assert body["results"] == []
    assert body["offset"] == 0


@pytest.mark.asyncio
async def test_search_total_reflects_filter_not_fetch_size(
    temp_workdir, env_cortex_config, reset_deps
):
    """total 反映过滤后的真实匹配数，不是 _MAX_FETCH 或 FTS 候选数。

    构造：3 个含 'unique_kw_aaa' 的文件 + 27 个不含的文件。
    FTS 可能匹配更多（部分子串），但字面过滤后应只剩 3。
    """
    for i in range(30):
        (temp_workdir / f"mix_{i:02d}.md").write_text(
            f"# Doc {i}\n\nGeneric content {i} without special keyword.\n",
            encoding="utf-8",
        )
    for i in range(3):
        (temp_workdir / f"special_{i}.md").write_text(
            f"# Special {i}\n\nThis has unique_kw_aaa in it.\n",
            encoding="utf-8",
        )
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/search", json={"query": "unique_kw_aaa", "limit": 20, "offset": 0}
        )

    body = res.json()
    # 至少 3（精确字面匹配），不超过 FTS 候选总数（不应是 _MAX_FETCH=1000）
    assert body["total"] >= 3
    assert body["total"] < 1000
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py -v -k "pagination or offset or total"
```
Expected: 多数失败（`total` 仍是 `len(results)`，offset 字段不存在，切片没生效）。

- [ ] **Step 1.3: Update `SearchResponse` model**

Edit `cortex/web_v2/models/search.py`，把 `SearchResponse` 加 `offset` + `limit` 字段：

```python
class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int            # 真实过滤后总数（不再是 len(results)）
    offset: int = 0       # 当前页起始 offset（响应回显）
    limit: int = 20       # 当前页大小
    query: str
    elapsed_ms: int
    source: str = "fts"  # 值 ∈ {"fts", "like", "ripgrep"}
```

`SearchRequest` 已经有 `offset: int = Field(default=0, ge=0)`，**无需改动**。

- [ ] **Step 1.4: Update `cortex/web_v2/api/search.py`**

三处改动：

1. **文件顶部（约 line 20 后）加常量**：

```python
# 单次搜索拉取的最大 FTS 候选数。覆盖大部分实际匹配；
# score_and_rank 在此集合上做完整过滤+排序，提供准确 total。
# 超过此值的匹配不可见（v1 接受）。
_MAX_FETCH = 1000
```

2. **`_format_scored_results` 去掉 `limit` 参数和切片**。当前签名：

```python
def _format_scored_results(
    result: ScoreResult,
    path_map: dict,
    search_path: str,
    limit: int,
) -> list[SearchResult]:
```

改为（去掉 `limit` 参数 + 末尾 `return out[:limit]` 改为 `return out`）：

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
    # ... 三分支填充逻辑不变（fts / like / ripgrep）...
    return out  # 原来是 return out[:limit]
```

> 注：函数体三个分支（`result.source == "fts"` / `"like"` / `"ripgrep"`）的填充代码完全保留，只删除最后的切片。

3. **`_do_search` 把 `limit` 参数改名为 `max_fetch`，默认 `_MAX_FETCH`**：

```python
def _do_search(
    idx: IndexManager, query: str, max_fetch: int = _MAX_FETCH
) -> ScoreResult:
    """在子线程中执行同步搜索 + 评分管道。

    max_fetch 是 FTS 候选拉取上限（搜索池大小），与 endpoint 的 limit（页大小）解耦。
    """
    nodes, docs = idx.search(query, max_results=max_fetch)
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]
    return score_and_rank(nodes, docs, query, query_words, idx)
```

4. **endpoint 改造**：

```python
@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    try:
        result = await asyncio.to_thread(_do_search, idx, req.query)
    except Exception as e:
        logger.warning("score_and_rank failed: %s; returning empty result", e)
        return SearchResponse(
            results=[],
            total=0,
            offset=0,
            limit=req.limit,
            query=req.query,
            source="fts",
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

- [ ] **Step 1.5: Run all search tests**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py -v
```
Expected: 所有测试通过（包括新增 7 个 + 现有的 `test_search_returns_results` 等）。

> 如果 `test_search_returns_results` 失败（它断言 `body["total"] == len(body["results"])`），原因是查询 "hello" 现在可能匹配多文件。检查 fixture 中只有 doc1.md 含 "hello"；如多匹配则改查询或更新断言。

- [ ] **Step 1.6: Full web_v2 regression**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/ -v 2>&1 | tail -5
```
Expected: all pass。

- [ ] **Step 1.7: Commit**

```bash
git add cortex/web_v2/models/search.py cortex/web_v2/api/search.py tests/web_v2/test_search_api.py
git commit -m "feat(web): backend search pagination with real total and offset slicing"
```

---

## Task 2: Frontend types + state defaults

**Files:**
- Modify: `cortex/web_v2/frontend/src/api/search.ts`
- Modify: `cortex/web_v2/frontend/src/state/types.ts`
- Modify: `cortex/web_v2/frontend/src/state/store.ts`

> 无新测试（纯类型/默认值改动，无行为）。前端组件测试在 Task 3+4 覆盖。

- [ ] **Step 2.1: Add offset/limit to `SearchResponse` interface**

Edit `cortex/web_v2/frontend/src/api/search.ts`：

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

- [ ] **Step 2.2: Add offset/limit to `SearchViewState`**

Edit `cortex/web_v2/frontend/src/state/types.ts` 的 `SearchViewState`：

```typescript
export interface SearchViewState {
  state: FocusState;
  currentSession: Session | null;
  query: string;
  results: SearchResult[];
  total: number;
  source: "fts" | "like" | "ripgrep";
  offset: number;   // NEW
  limit: number;    // NEW
}
```

- [ ] **Step 2.3: Update `INITIAL_STATE.search` defaults**

Edit `cortex/web_v2/frontend/src/state/store.ts`（约 line 38-45），在 `search: { ... }` 块加默认值：

```typescript
search: {
  state: "initial",
  currentSession: null,
  query: "",
  results: [],
  total: 0,
  source: "fts",
  offset: 0,   // NEW
  limit: 20,   // NEW
},
```

- [ ] **Step 2.4: TypeScript check**

```bash
cd cortex/web_v2/frontend && npx tsc --noEmit
```
Expected: 无错误（如果有现有 setSearchState 调用点缺少 offset/limit，类型不会强制要求因为是浅合并；但应无错误）。

- [ ] **Step 2.5: Run vitest for regression**

```bash
cd cortex/web_v2/frontend && npx vitest run --exclude tests/e2e 2>&1 | tail -5
```
Expected: all pass。

- [ ] **Step 2.6: Commit**

```bash
git add cortex/web_v2/frontend/src/api/search.ts cortex/web_v2/frontend/src/state/types.ts cortex/web_v2/frontend/src/state/store.ts
git commit -m "feat(web): add offset/limit to SearchResponse and SearchViewState"
```

---

## Task 3: `<pagination-bar>` component + unit tests

**Files:**
- Create: `cortex/web_v2/frontend/src/components/pagination-bar.ts`
- Test: `cortex/web_v2/frontend/tests/pagination-bar.spec.ts`（新建）

- [ ] **Step 3.1: Write failing test file**

Create `cortex/web_v2/frontend/tests/pagination-bar.spec.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/pagination-bar";
import type { PaginationBar } from "../src/components/pagination-bar";

describe("<pagination-bar>", () => {
  it("renders nothing when total <= limit (single page)", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${15} .offset=${0} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".pages")).toBeNull();
    expect(el.shadowRoot!.querySelector(".meta")).toBeNull();
  });

  it("renders page numbers when total > limit", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${0} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".pages")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".meta")!.textContent).toContain("100");
    // 至少一个页码按钮
    const pageBtns = el.shadowRoot!.querySelectorAll(".pages button:not([aria-label])");
    expect(pageBtns.length).toBeGreaterThan(0);
  });

  it("clicking page dispatches page-change event with correct page", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${0} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    let received: number | null = null;
    el.addEventListener("page-change", (e: any) => (received = e.detail.page));
    // 点击页码 3
    const btns = Array.from(
      el.shadowRoot!.querySelectorAll(".pages button:not([aria-label])"),
    ) as HTMLButtonElement[];
    const page3 = btns.find((b) => b.textContent?.trim() === "3");
    expect(page3).toBeTruthy();
    page3!.click();
    expect(received).toBe(3);
  });

  it("previous disabled on page 1", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${0} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    const prev = el.shadowRoot!.querySelector('button[aria-label="上一页"]') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it("next disabled on last page", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${80} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    const next = el.shadowRoot!.querySelector('button[aria-label="下一页"]') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it("ellipsis shown when totalPages > 7", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${200} .offset=${80} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    const ellipsis = el.shadowRoot!.querySelectorAll(".ellipsis");
    expect(ellipsis.length).toBeGreaterThan(0);
  });

  it("current page button has .current class", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${40} .limit=${20}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    // offset=40, limit=20 → currentPage=3
    const current = el.shadowRoot!.querySelector("button.current");
    expect(current).toBeTruthy();
    expect(current!.textContent?.trim()).toBe("3");
  });

  it("disabled prop disables all buttons", async () => {
    const el = await fixture(html`
      <pagination-bar .total=${100} .offset=${0} .limit=${20} ?disabled=${true}></pagination-bar>
    `) as PaginationBar;
    await el.updateComplete;
    const allBtns = el.shadowRoot!.querySelectorAll(".pages button");
    expect(allBtns.length).toBeGreaterThan(0);
    for (const b of allBtns) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/pagination-bar.spec.ts
```
Expected: 8 failures（`<pagination-bar>` 元素不存在）。

- [ ] **Step 3.3: Create the component**

Create `cortex/web_v2/frontend/src/components/pagination-bar.ts`：

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <pagination-bar> —— 搜索结果页码分页。
 *
 * Props:
 *   - total: 过滤后总匹配数
 *   - offset: 当前页起始（0-indexed）
 *   - limit: 每页大小
 *   - disabled: 加载中时禁用所有按钮
 *
 * Events:
 *   - page-change: { page: number }（1-indexed 页码）
 */
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
    if (this.limit <= 0) return 1;
    return Math.floor(this.offset / this.limit) + 1;
  }

  get totalPages(): number {
    if (this.limit <= 0) return 1;
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
   * totalPages <= 7：渲染全部。
   * 否则：始终显示第 1 页、最后一页、当前页 ±1；中间用 "..." 折叠。
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

declare global {
  interface HTMLElementTagNameMap {
    "pagination-bar": PaginationBar;
  }
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/pagination-bar.spec.ts
```
Expected: 8 passed.

- [ ] **Step 3.5: Commit**

```bash
git add cortex/web_v2/frontend/src/components/pagination-bar.ts cortex/web_v2/frontend/tests/pagination-bar.spec.ts
git commit -m "feat(web): add pagination-bar component with numbered pages and ellipsis"
```

---

## Task 4: search-view integration

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/search-view.ts`
- Test: `cortex/web_v2/frontend/tests/search-view.spec.ts`（追加）

- [ ] **Step 4.1: Append failing tests for pagination integration**

在 `cortex/web_v2/frontend/tests/search-view.spec.ts` 末尾追加（**先看文件顶部 imports**，复用现有的 `resetStore`、`actions.setSearchState`、`store` import）：

```typescript
describe("<search-view> pagination integration", () => {
  it("new search resets offset to 0", async () => {
    // 先把 state 设成"在 page 3"
    actions.setSearchState({
      state: "focus",
      query: "old",
      results: [],
      total: 100,
      offset: 40,  // page 3
      limit: 20,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;

    // mock fetch 拦截 searchApi
    const fetchSpy = vi.stubGlobal("fetch", vi.fn()).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ path: "x.md", snippet: "...", score: 1, line: 1, highlights: [] }],
          total: 5,
          offset: 0,
          limit: 20,
          query: "new",
          elapsed_ms: 10,
          source: "fts",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    // 触发新搜索
    (el as any)._submit("new");
    await new Promise((r) => setTimeout(r, 10));

    const s = store.getState().search;
    expect(s.offset).toBe(0);
    expect(s.query).toBe("new");

    vi.unstubAllGlobals();
  });

  it("pagination-bar rendered when total > limit", async () => {
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [],
      total: 100,
      offset: 0,
      limit: 20,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("pagination-bar")).toBeTruthy();
  });

  it("pagination-bar not rendered when total <= limit", async () => {
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [],
      total: 15,
      offset: 0,
      limit: 20,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("pagination-bar")).toBeNull();
  });

  it("_goToPage calls searchApi with new offset", async () => {
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [],
      total: 100,
      offset: 0,
      limit: 20,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;

    const fetchSpy = vi.stubGlobal("fetch", vi.fn()).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [],
          total: 100,
          offset: 40,
          limit: 20,
          query: "x",
          elapsed_ms: 5,
          source: "fts",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await (el as any)._goToPage(3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.offset).toBe(40);  // (3-1) * 20
    expect(body.limit).toBe(20);

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/search-view.spec.ts -t "pagination"
```
Expected: 失败（`_goToPage` 不存在；`<pagination-bar>` 没挂载）。

- [ ] **Step 4.3: Modify `search-view.ts`**

Edit `cortex/web_v2/frontend/src/views/search-view.ts`。

1. **顶部 import** 加 `pagination-bar`：

```typescript
import "./../components/pagination-bar";
```

（找已有的 `import "./../components/<xxx>";` 行，按字母序加进去）

2. **`_submit` 方法**（约 line 230-260）：

找到现有的 `searchApi({ query })` 调用并改为显式传 offset/limit；并在 `actions.setSearchState` 里加 offset/limit。具体改动：把 `const res = await searchApi({ query });` 改为：

```typescript
const res = await searchApi({ query, offset: 0, limit: 20 });
```

并把后面的 `actions.setSearchState({ state: "focus", query, results: res.results, total: res.total, source: res.source, ... })` 加 `offset: 0, limit: 20`：

```typescript
actions.setSearchState({
  state: "focus",
  query,
  results: res.results,
  total: res.total,
  offset: 0,
  limit: 20,
  source: res.source,
});
```

3. **新增 `_goToPage` + `_onPageChange`**。在现有 `_submit` 之后或 `_onResultSelect` 之前加：

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

> 注：`store` 已在文件顶部 import（与现有代码一致）；如果没有，加 `import { store } from "../state/store";`。

4. **模板挂载 `<pagination-bar>`**。在 `render()` 方法里找到 `<search-results>` 标签之后（约 line 485-490 附近），加：

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

具体位置：在 `<search-results ...></search-results>` 闭合标签之后、`.splitter` 之前（或结果区底部，保持视觉层级合理）。读代码上下文确定确切位置。

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/search-view.spec.ts
```
Expected: 全部通过（现有 + 4 新）。

- [ ] **Step 4.5: Full vitest regression**

```bash
cd cortex/web_v2/frontend && npx vitest run --exclude tests/e2e
```
Expected: all pass。

- [ ] **Step 4.6: Commit**

```bash
git add cortex/web_v2/frontend/src/views/search-view.ts cortex/web_v2/frontend/tests/search-view.spec.ts
git commit -m "feat(web): wire pagination-bar in search-view with _goToPage"
```

---

## Task 5: Build + smoke test

**Files:**
- Build output: `cortex/web_v2/static/`

- [ ] **Step 5.1: TypeScript check + vite build**

```bash
cd cortex/web_v2/frontend && npm run build
```
Expected: 构建成功，输出 `index.html` + 新 hash 的 `assets/index.XXXXXX.js` + `assets/index.XXXXXX.css`。

- [ ] **Step 5.2: Verify backend + frontend tests still green**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/ 2>&1 | tail -3
cd cortex/web_v2/frontend && npx vitest run --exclude tests/e2e 2>&1 | tail -5
```
Expected: all pass。

- [ ] **Step 5.3: Manual smoke test**

启动：

```bash
.venv/Scripts/python.exe -m cortex gui
```

浏览器 `http://localhost:7860`，验证：

1. **少量结果（≤20）**：搜索一个稀有关键词，结果 ≤20 条 → 不显示 pagination-bar
2. **多结果（>20）**：索引 30+ 文档后搜索常见关键词 → 显示 pagination-bar，meta 显示"共 N 条 · 第 1/M 页"
3. **翻页**：点页码 2 → 第二页结果正确（与第一页不重叠），meta 显示"第 2/M 页"
4. **上一页/下一页**：第 1 页"上一页"disabled；最后一页"下一页"disabled
5. **大页码省略**：索引 200+ 匹配后搜索 → 中间显示 `...` 省略号
6. **新搜索重置**：翻到第 3 页后搜索新词 → 自动回到第 1 页
7. **翻页后预览**：翻页后预览面板清空（不残留前一页的高亮）
8. **加载中**：翻页时 pagination-bar 按钮 disabled，搜索中无法再点

- [ ] **Step 5.4: Commit built static assets**

```bash
git add cortex/web_v2/static/
git commit -m "chore(web): rebuild static assets for search pagination"
```

---

## 完成检查

- [ ] 所有 5 个 Task 的所有 step 已勾选
- [ ] 后端 `pytest tests/web_v2/` 全绿（含 7 个新分页测试）
- [ ] 前端 `npx vitest run --exclude tests/e2e` 全绿（含 8 个新 pagination-bar + 4 个新 search-view 测试）
- [ ] `npm run build` 成功
- [ ] 手工冒烟测试 8 个场景通过
- [ ] 工作树干净

## 自审清单（已在写完时检查）

- 所有文件路径精确（绝对路径 + 行号）
- 每个 step 都有可执行的代码或命令
- TDD：测试先于实现（每 task 都是先写失败测试 → 验证失败 → 实现 → 验证通过 → commit）
- 频繁 commit（每个 Task 末尾）
- 类型一致：`SearchResponse`（Pydantic + TS）、`SearchViewState`、`PaginationBar` 在所有 task 中签名一致
- spec 的所有需求都有对应 task：
  - §3 数据流 → Task 1（后端）+ Task 4（前端）
  - §4.1 `SearchResponse` 加 offset/limit → Task 1 Step 1.3
  - §4.2 `_do_search`/`_format_scored_results`/endpoint 改造 → Task 1 Step 1.4
  - §5.1 `SearchViewState` 加 offset/limit → Task 2
  - §5.2 API client 接口 → Task 2
  - §5.3 `_submit` / `_goToPage` / 模板挂载 → Task 4
  - §5.4 `<pagination-bar>` 组件 → Task 3
  - §6 session 不变 → Task 4 不调用 `appendSession`/`updateSession`（隐式实现）
  - §7 边界情况 → Task 1 测试覆盖 offset 越界 + Task 3 测试覆盖 disabled + ellipsis
  - §9 测试策略 → Task 1（7 个）+ Task 3（8 个）+ Task 4（4 个）= 19 个新测试
