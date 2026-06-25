# Web 搜索对齐 CLI 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/api/search` 调用 `cortex.scoring_pipeline.score_and_rank`，使 Web 搜索结果与 CLI `cortex search` 完全一致（同数量、同排序、同分数语义），并支持 FTS → LIKE → ripgrep 三重降级链。

**Architecture:** API 层薄封装 `score_and_rank`，按 `ScoreResult.source ∈ {fts, like, ripgrep}` 三分支格式化为 `SearchResult` 列表；`SearchResponse` 新增 `source` 字段；`SearchResult.score` 语义改为 composite（0~1）；前端 `result-card` 显示百分比分数，`search-view` 在结果计数后追加降级标识。**完全不动** CLI 代码（`cortex_cli.py` / `scoring_pipeline.py` / `index_manager.py`）。

**Tech Stack:** Python 3.11+ / FastAPI / Pydantic / Lit + TypeScript（前端）

**Spec:** `docs/superpowers/specs/2026-06-18-web-search-align-cli-design.md`

---

## File Structure

| 文件 | 类型 | 责任 |
|------|------|------|
| `cortex/web_v2/models/search.py` | 修改 | `SearchResponse` 加 `source: str = "fts"` 字段；`SearchResult.score` 注释更新为 composite（0~1） |
| `cortex/web_v2/api/search.py` | 修改 | 调用 `score_and_rank`；新增 `_format_scored_results` 三分支处理；移除旧 `_format_results` |
| `cortex/web_v2/frontend/src/state/types.ts` | 修改 | `SearchResponse` TS 接口加 `source: string` |
| `cortex/web_v2/frontend/src/api/search.ts` | 修改 | `SearchResponse` 接口同步 `source` |
| `cortex/web_v2/frontend/src/components/result-card.ts` | 修改 | 新增 `评分: NN%` 显示 |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 修改 | 结果计数后追加 `(LIKE)` / `(ripgrep)` 降级标识 |
| `tests/web_v2/test_search_api.py` | 扩展 | composite score / source 字段 / 全空降级测试 |
| `tests/web_v2/test_search_cli_parity.py` | 新建 | Web 前 20 条 vs CLI 前 20 条的对齐守护测试 |

---

## Task 1: SearchResponse schema 加 source 字段

**Files:**
- Modify: `cortex/web_v2/models/search.py`

- [ ] **Step 1.1: 写失败测试**

在 `tests/web_v2/test_search_api.py` 末尾追加（如果文件已有 `reset_deps` fixture，参考 Task 6 之前的代码风格）：

```python
@pytest.mark.asyncio
async def test_search_response_has_source_field(temp_workdir, env_cortex_config, reset_deps):
    """SearchResponse 必须含 source 字段，默认 'fts'。"""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": "hello"})
    assert res.status_code == 200
    body = res.json()
    assert "source" in body
    assert body["source"] in ("fts", "like", "ripgrep")
```

- [ ] **Step 1.2: 运行测试，确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py::test_search_response_has_source_field -v`
Expected: FAIL — `KeyError: 'source'` 或 `AssertionError: 'source' not in body`

- [ ] **Step 1.3: 修改 SearchResponse 加 source 字段**

修改 `cortex/web_v2/models/search.py`，在 `SearchResponse` 类加 `source` 字段：

```python
class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str
    elapsed_ms: int
    source: str = "fts"  # 新增：值 ∈ {"fts", "like", "ripgrep"}
```

并在 `SearchResult.score` 上方加注释说明语义变更：

```python
class SearchResult(BaseModel):
    path: str
    snippet: str
    score: float  # 语义变更：原 FTS5 BM25 原始分 → composite 综合分（0~1 归一化）
    line: Optional[int] = None
    highlights: list[tuple[int, int]] = []
```

- [ ] **Step 1.4: 运行测试，确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py::test_search_response_has_source_field -v`
Expected: PASS

- [ ] **Step 1.5: 提交**

```bash
git add cortex/web_v2/models/search.py tests/web_v2/test_search_api.py
git commit -m "feat(web_v2): add source field to SearchResponse schema"
```

---

## Task 2: /api/search 接入 score_and_rank（核心改动）

**Files:**
- Modify: `cortex/web_v2/api/search.py`

- [ ] **Step 2.1: 写失败测试 —— composite score 范围**

在 `tests/web_v2/test_search_api.py` 末尾追加：

```python
@pytest.mark.asyncio
async def test_search_scores_are_composite_in_unit_range(
    temp_workdir, env_cortex_config, reset_deps
):
    """所有 SearchResult.score 必须在 [0, 1] 区间（composite 综合分语义）。"""
    # 准备一个能命中的 md 文件
    (temp_workdir / "健康.md").write_text(
        "# 健康指南\n\n肠道健康很重要。健康饮食。", encoding="utf-8"
    )
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": "健康"})
    assert res.status_code == 200
    body = res.json()
    assert body["results"], "应至少返回一条结果"
    for r in body["results"]:
        assert 0.0 <= r["score"] <= 1.0, f"score {r['score']} 不在 [0,1] 区间"
```

- [ ] **Step 2.2: 运行测试，确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py::test_search_scores_are_composite_in_unit_range -v`
Expected: FAIL — score 仍是 FTS5 原始分（> 1.0）

- [ ] **Step 2.3: 重写 cortex/web_v2/api/search.py**

完整替换 `cortex/web_v2/api/search.py`（保留 `_resolve_preview_path` 函数不变，其它全部重写）：

```python
"""POST /api/search —— 关键词搜索。

复用 IndexManager.search() + scoring_pipeline.score_and_rank，与 CLI/TUI
完全一致的行为：字面子串过滤、综合评分、FTS → LIKE → ripgrep 三重降级。
"""
import asyncio
import logging
import time
from pathlib import Path

from fastapi import APIRouter, Depends

from cortex.index_manager import IndexManager
from cortex.scoring import tokenize_query
from cortex.scoring_pipeline import score_and_rank, ScoreResult
from cortex.web_v2.deps import get_index_manager
from cortex.web_v2.models.search import SearchRequest, SearchResponse, SearchResult

logger = logging.getLogger(__name__)
router = APIRouter()


def _resolve_preview_path(doc_key: str, path_map: dict, search_path: str) -> str:
    """把 doc_id 或 doc_name 解析为相对 search_path 的可预览路径。

    IndexManager.path_map 同时以 doc_id（可能带 _hash 后缀）和 doc_name 作 key，
    所以两种 key 都可直接查。
    """
    source_abs = path_map.get(doc_key) if path_map else None
    if not source_abs:
        return doc_key
    try:
        rel = Path(source_abs).resolve().relative_to(Path(search_path).resolve())
        return rel.as_posix()
    except (ValueError, OSError):
        return doc_key


def _format_scored_results(
    result: ScoreResult,
    path_map: dict,
    search_path: str,
    limit: int,
) -> list[SearchResult]:
    """把 score_and_rank 的 ScoreResult 转成 SearchResult 列表。

    三个分支：
      - source="fts":     result.results = [(composite, (doc_id, node, matched, prox, fts))]
      - source="like":    result.like_raw = list[dict]（fts.like_search 返回格式）
      - source="ripgrep": result.results = [(doc_id, node, matched, prox, fts)]（无 composite）
    """
    out: list[SearchResult] = []

    if result.source == "fts":
        for composite, (doc_id, node, _matched, _prox, _fts) in result.results:
            path = _resolve_preview_path(doc_id, path_map, search_path)
            out.append(SearchResult(
                path=path,
                snippet=(node.get("text", "") or "")[:300],
                score=round(composite, 4),
                line=node.get("line_start"),
                highlights=[],
            ))

    elif result.source == "like":
        for item in result.like_raw or []:
            doc_key = item.get("doc_name", "") or item.get("doc_id", "")
            path = _resolve_preview_path(doc_key, path_map, search_path)
            out.append(SearchResult(
                path=path,
                snippet=(item.get("summary", "") or "")[:300],
                score=0.5,  # 对齐 CLI _convert_like_to_render_items 的固定分
                line=None,  # like_search 不返回 line_start
                highlights=[],
            ))

    elif result.source == "ripgrep":
        for doc_id, node, _matched, _prox, _fts in result.results:
            path = _resolve_preview_path(doc_id, path_map, search_path)
            out.append(SearchResult(
                path=path,
                snippet=(node.get("text", "") or "")[:300],
                score=0.0,  # 对齐 CLI is_ripgrep 的固定分
                line=node.get("line_start"),
                highlights=[],
            ))

    return out[:limit]


def _do_search(idx: IndexManager, query: str, limit: int) -> ScoreResult:
    """在子线程中执行同步搜索 + 评分管道（TreeSearch.search 不能在事件循环内调用）。"""
    nodes, docs = idx.search(query, max_results=limit)
    if not nodes and not docs:
        # idx.search 空返回时，score_and_rank 仍会触发降级链（_fallback_no_fts）
        # 这里保持传空 list，让 score_and_rank 统一处理降级
        pass
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]
    return score_and_rank(nodes, docs, query, query_words, idx)


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    try:
        result = await asyncio.to_thread(_do_search, idx, req.query, req.limit)
    except Exception as e:
        logger.warning("score_and_rank failed: %s; returning empty result", e)
        return SearchResponse(
            results=[],
            total=0,
            query=req.query,
            source="fts",
            elapsed_ms=int((time.perf_counter() - start) * 1000),
        )

    results = _format_scored_results(result, idx.path_map, idx.search_path, req.limit)
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return SearchResponse(
        results=results,
        total=len(results),
        query=req.query,
        source=result.source,
        elapsed_ms=elapsed_ms,
    )
```

- [ ] **Step 2.4: 运行新测试，确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py::test_search_scores_are_composite_in_unit_range -v`
Expected: PASS

- [ ] **Step 2.5: 跑整个 search_api 套件做回归**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py -v`
Expected: 所有测试 PASS（含 Task 1 的 source 字段测试）

如有失败，常见原因：
- `ImportError: cannot import name 'ScoreResult'`：检查 `cortex/scoring_pipeline.py` 的 `ScoreResult` 是否已导出
- `tokenize_query is None`：`cortex.scoring.tokenize_query` 对纯英文 query 可能返回空 list，已用 `or [query.strip()]` 兜底

- [ ] **Step 2.6: 提交**

```bash
git add cortex/web_v2/api/search.py tests/web_v2/test_search_api.py
git commit -m "feat(web_v2): route /api/search through score_and_rank pipeline"
```

---

## Task 3: CLI 对齐守护测试（关键）

**Files:**
- Create: `tests/web_v2/test_search_cli_parity.py`

- [ ] **Step 3.1: 写守护测试**

创建 `tests/web_v2/test_search_cli_parity.py`：

```python
"""Web /api/search 与 CLI cortex search 的对齐守护测试。

任一端分叉（数量、顺序、score 语义）会立即失败。
这是"Web 搜索对齐 CLI"诉求的核心保障。
"""
import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.scoring import tokenize_query
from cortex.scoring_pipeline import score_and_rank
from cortex.web_v2 import deps
from cortex.web_v2.app import create_app


@pytest.fixture
def reset_deps():
    deps.reset_singletons()
    yield
    deps.reset_singletons()


def _init_and_reindex():
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


def _cli_ground_truth(idx, query: str, limit: int = 20):
    """模拟 CLI cortex search 的 ground truth：idx.search + score_and_rank。

    返回前 limit 条 (path, line, score) tuple。
    """
    nodes, docs = idx.search(query, max_results=limit)
    query_words = tokenize_query(query) or [w.strip() for w in query.split() if w.strip()]
    result = score_and_rank(nodes, docs, query, query_words, idx)

    truth = []
    if result.source == "fts":
        for composite, (doc_id, node, _m, _p, _f) in result.results[:limit]:
            path = idx.path_map.get(doc_id, doc_id)
            truth.append((path, node.get("line_start"), round(composite, 4)))
    elif result.source == "like":
        for item in (result.like_raw or [])[:limit]:
            doc_key = item.get("doc_name", "") or item.get("doc_id", "")
            path = idx.path_map.get(doc_key, doc_key)
            truth.append((path, None, 0.5))
    elif result.source == "ripgrep":
        for doc_id, node, _m, _p, _f in result.results[:limit]:
            path = idx.path_map.get(doc_id, doc_id)
            truth.append((path, node.get("line_start"), 0.0))
    return truth, result.source


@pytest.mark.asyncio
async def test_web_search_matches_cli_top_20(temp_workdir, env_cortex_config, reset_deps):
    """Web /api/search 的前 20 条 (path, line) 必须与 CLI 完全一致。"""
    # 准备多个 md 文件让搜索有足够命中
    (temp_workdir / "健康.md").write_text(
        "# 健康指南\n\n肠道健康很重要。健康饮食。身心健康。", encoding="utf-8"
    )
    (temp_workdir / "运动.md").write_text(
        "# 运动健康\n\n运动促进健康。", encoding="utf-8"
    )
    await asyncio.to_thread(_init_and_reindex)

    idx = deps.get_index_manager()

    # CLI ground truth
    truth, truth_source = _cli_ground_truth(idx, "健康", limit=20)

    # Web API
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": "健康", "limit": 20})
    assert res.status_code == 200
    body = res.json()

    # source 必须一致
    assert body["source"] == truth_source, (
        f"source 不一致: web={body['source']} vs cli={truth_source}"
    )

    # 数量必须一致
    web_results = body["results"]
    assert len(web_results) == len(truth), (
        f"结果数不一致: web={len(web_results)} vs cli={len(truth)}"
    )

    # 前 N 条 (path, line) 必须完全一致
    for i, (exp_path, exp_line, exp_score) in enumerate(truth):
        web_path = web_results[i]["path"]
        web_line = web_results[i]["line"]
        # path 比较用绝对路径（因为 truth 里是 abs path，web 里是相对路径）
        # 通过 idx.search_path 把 web 的相对路径还原成绝对路径
        import os
        web_abs = os.path.join(idx.search_path, web_path)
        assert web_abs == exp_path or web_path.endswith(exp_path.replace("\\", "/").split("/")[-1]), (
            f"[{i}] path 不一致: web={web_path} (abs={web_abs}) vs cli={exp_path}"
        )
        assert web_line == exp_line, (
            f"[{i}] line 不一致: web={web_line} vs cli={exp_line}"
        )

    # score 都在 [0, 1]
    for r in web_results:
        assert 0.0 <= r["score"] <= 1.0


@pytest.mark.asyncio
async def test_web_search_source_matches_cli_when_fts_empty(
    temp_workdir, env_cortex_config, reset_deps
):
    """FTS 无结果时，Web 与 CLI 必须走同一条降级路径（source 一致）。"""
    # 不创建任何文件，让 query 命中 0 条
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    query = "zzz绝对不存在的罕见关键字xyz"
    truth, truth_source = _cli_ground_truth(idx, query, limit=20)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": query, "limit": 20})
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == truth_source, (
        f"降级路径不一致: web={body['source']} vs cli={truth_source}"
    )
    assert len(body["results"]) == len(truth), (
        f"降级结果数不一致: web={len(body['results'])} vs cli={len(truth)}"
    )
```

- [ ] **Step 3.2: 运行守护测试**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_cli_parity.py -v`
Expected: 2 个测试 PASS

如失败：
- `path 不一致`：检查 `_resolve_preview_path` 的 `relative_to` 是否正确处理了 `idx.search_path`；可能需要用 `os.path.realpath` 规范化两边
- `source 不一致`：检查 score_and_rank 的内部降级条件，确认 query 真的触发了同一条路径
- `结果数不一致`：可能是 `idx.search` 在两次调用间返回不同（多线程/并发问题），重新跑一次

- [ ] **Step 3.3: 跑整个 web_v2 套件回归**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/ -v`
Expected: 全部 PASS

- [ ] **Step 3.4: 提交**

```bash
git add tests/web_v2/test_search_cli_parity.py
git commit -m "test(web_v2): add CLI parity guard for /api/search results"
```

---

## Task 4: 前端 types/api 同步 source 字段

**Files:**
- Modify: `cortex/web_v2/frontend/src/state/types.ts`
- Modify: `cortex/web_v2/frontend/src/api/search.ts`

- [ ] **Step 4.1: 读现状**

Run: `cat cortex/web_v2/frontend/src/state/types.ts`
确认 `SearchResponse` 接口当前的字段（通常含 `results / total / query / elapsed_ms`）。

Run: `cat cortex/web_v2/frontend/src/api/search.ts`
确认 `SearchResponse` 接口的同名定义（如有重复定义，两边都要改）。

- [ ] **Step 4.2: 修改 types.ts**

在 `cortex/web_v2/frontend/src/state/types.ts` 找到 `SearchResponse` 接口（或 `SearchResult`/`SearchResponse` 的 export type），加 `source` 字段：

```typescript
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  elapsed_ms: number;
  source: "fts" | "like" | "ripgrep";  // 新增
}
```

如果文件里 `SearchResult` 也有定义，确认 `score: number` 字段无需类型变化（仍是 number，只是语义变为 0~1）。

- [ ] **Step 4.3: 修改 api/search.ts**

在 `cortex/web_v2/frontend/src/api/search.ts` 的 `SearchResponse` 接口加 `source`：

```typescript
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  elapsed_ms: number;
  source: "fts" | "like" | "ripgrep";  // 新增
}
```

- [ ] **Step 4.4: 类型检查**

Run:
```bash
cd cortex/web_v2/frontend && npx tsc --noEmit
```
Expected: 无 TS 错误

- [ ] **Step 4.5: 提交**

```bash
git add cortex/web_v2/frontend/src/state/types.ts cortex/web_v2/frontend/src/api/search.ts
git commit -m "feat(web_v2): sync SearchResponse.source field in frontend types"
```

---

## Task 5: result-card 显示百分比分数

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/result-card.ts`

- [ ] **Step 5.1: 读现状**

Run: `cat cortex/web_v2/frontend/src/components/result-card.ts`

确认当前 `render()` 方法只显示 `path` 和 `snippet`，不显示 `score`。本任务加一行 `评分: NN%`。

- [ ] **Step 5.2: 修改 result-card.ts 的 render 与 styles**

在 `static styles` 中加 `.score` 样式：

```typescript
    .score {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      margin-top: 2px;
    }
```

在 `render()` 方法的 snippet 下方加分数显示：

```typescript
  render() {
    if (!this.result) return null;
    const scorePct = Math.round(this.result.score * 100);
    return html`
      <div class="path">${this.result.path}${this.result.line ? `:${this.result.line}` : ""}</div>
      <div class="snippet">${this.result.snippet}</div>
      <div class="score">评分: ${scorePct}%</div>
    `;
  }
```

- [ ] **Step 5.3: 类型检查 + 构建**

Run:
```bash
cd cortex/web_v2/frontend && npm run build
```
Expected: 构建成功，无 TS 错误

- [ ] **Step 5.4: 提交**

```bash
git add cortex/web_v2/frontend/src/components/result-card.ts cortex/web_v2/static
git commit -m "feat(frontend): show composite score as percentage in result-card"
```

---

## Task 6: search-view 加降级标识

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/search-view.ts`

- [ ] **Step 6.1: 读现状**

Run: `grep -n "条结果\|s.total" cortex/web_v2/frontend/src/views/search-view.ts`

确认形如 `meta=${\`${s.total} 条结果\`}` 的代码位置。

- [ ] **Step 6.2: 修改 meta 显示逻辑**

在 `cortex/web_v2/frontend/src/views/search-view.ts` 找到显示 `条结果` 的位置（约 line 290 附近），改为根据 `s.source` 追加降级标识：

```typescript
// 找到形如 meta=${`${s.total} 条结果`} 的地方，替换为：
meta=${`${s.total} 条结果${s.source === "fts" ? "" : ` (${s.source.toUpperCase()})`}`}
```

注意：
- `s.source` 是 `"fts" | "like" | "ripgrep"`，fts 时不显示后缀（保持清爽）
- like/ripgrep 时显示 ` (LIKE)` / ` (RIPGREP)`，对齐 CLI 的 `找到 N 个匹配 (LIKE)` 风格
- 需要确认 `s` 这个变量名是 search state 对象，包含 `total` 和 `source` 字段；如果变量名不同，按实际改

- [ ] **Step 6.3: 类型检查 + 构建**

Run:
```bash
cd cortex/web_v2/frontend && npm run build
```
Expected: 构建成功，无 TS 错误

- [ ] **Step 6.4: 提交**

```bash
git add cortex/web_v2/frontend/src/views/search-view.ts cortex/web_v2/static
git commit -m "feat(frontend): show fallback source tag in search result count"
```

---

## Task 7: E2E 验证（playwright-cli）

**Files:** 无源码改动

- [ ] **Step 7.1: 启动 Web UI（后台）**

Run（用 Bash 后台）:
```bash
cd test_work_dir && ../.venv/Scripts/python.exe -m cortex gui --port 7861
```

等待服务起来，确认 http://127.0.0.1:7861/api/status 返回 200。

- [ ] **Step 7.2: 先跑 CLI ground truth**

Run:
```bash
cd test_work_dir && ../.venv/Scripts/python.exe -m cortex search 健康 2>&1 | head -5
```
记录 CLI 显示的结果数（例如 `找到 21 个匹配`）和第一条标题。

- [ ] **Step 7.3: E2E 验证 Web UI 一致性（playwright-cli skill）**

调用 `playwright-cli` skill，流程：
1. `playwright-cli open http://127.0.0.1:7861`
2. 在搜索框输入 "健康"，回车
3. `playwright-cli snapshot`，读取 `N 条结果` 文本，断言 N 与 CLI 一致（21 ± 容差 0）
4. 点击第一个 result-card，进入预览
5. `playwright-cli snapshot` 确认 preview 正常显示（不应报错）

- [ ] **Step 7.4: 关闭服务**

停止后台服务的 task。

- [ ] **Step 7.5: 整体回归测试**

Run: `.venv/Scripts/python.exe -m pytest tests/ --ignore=tests/web_v2/frontend -q`
Expected: 全部 PASS

- [ ] **Step 7.6: 提交（如有 E2E 暴露的修复）**

如果 E2E 暴露问题并修复，提交相应 fix commit。无改动则跳过。

---

## 最终验收 Checklist

参照 spec `## 验收标准`：

- [ ] 1. 同一 query，Web `/api/search` 返回的 `(path, line)` 前 20 条与 CLI `cortex search` 完全一致（Task 3 守护测试通过）
- [ ] 2. `SearchResult.score` ∈ [0, 1]，与 CLI 综合分完全一致
- [ ] 3. `SearchResponse.source` ∈ {`"fts"`, `"like"`, `"ripgrep"`}
- [ ] 4. 前端 result-card 显示 `评分: NN%` 格式
- [ ] 5. 降级路径：FTS 无结果时返回 LIKE 或 ripgrep 结果（Task 3 降级测试覆盖）
- [ ] 6. CLI/TUI 行为零变化（`cortex_cli.py` / `scoring_pipeline.py` / `index_manager.py` 零改动）
- [ ] 7. 所有现有测试继续通过

---

## Self-Review

**Spec coverage check**（对照 spec 章节）：
- ✅ 范围 In Scope: Task 1 (source 字段) + Task 2 (score_and_rank 接入 + 三分支) + Task 5/6 (前端显示) + Task 3 (降级守护)
- ✅ 范围 Out of Scope: 不动 `cortex_cli.py` / `scoring_pipeline.py`（plan 无相关 task）
- ✅ 架构 数据流: Task 2 完整实现
- ✅ 组件边界: Task 1（models）+ Task 2（api）+ Task 4-6（前端）+ Task 3（测试）
- ✅ 关键决策 1（三分支）: Task 2 Step 2.3
- ✅ 关键决策 2（doc_id → path_map 直查）: Task 2 Step 2.3 的 `_resolve_preview_path` 直接传 `doc_id`，**不需 `_doc_id_to_name`**（spec 里这部分过度设计，plan 里简化）
- ✅ 关键决策 3（SearchResponse.source）: Task 1
- ✅ 关键决策 4（score 语义破坏性）: Task 1（注释）+ Task 5（前端显示）
- ✅ 关键决策 5（limit 语义）: Task 2 Step 2.3 的 `out[:limit]`
- ✅ 关键决策 6（异常兜底）: Task 2 Step 2.3 的 try/except
- ✅ 测试策略: Task 1/2/3 覆盖单测 + 对齐守护测试；Task 7 E2E

**Placeholder scan**:
- ✅ 所有 Step 都有具体代码或命令
- ✅ 无 "TBD" / "TODO" / "add appropriate error handling"
- ✅ 测试代码完整可运行

**Type / signature consistency**:
- ✅ `ScoreResult.source` / `ScoreResult.results` / `ScoreResult.like_raw` 在 scoring_pipeline.py 中已定义，Task 2 引用一致
- ✅ `score_and_rank(nodes, docs, query, query_words, idx)` 签名与 `cortex/scoring_pipeline.py:20` 一致
- ✅ `tokenize_query(query)` 签名与 `cortex/scoring.py:4` 一致
- ✅ `_format_scored_results(result, path_map, search_path, limit)` 在 Task 2 定义，无其它 task 引用（纯内部函数）
- ✅ `SearchResponse.source` 在 Task 1 定义、Task 4 同步、Task 6 读取，类型一致 `"fts" | "like" | "ripgrep"`

**关键简化**（相对 spec 的调整）：
- spec 里的 `_doc_id_to_name` 函数**移除**——`path_map` 双写 `doc_id` 和 `doc_name`（见 `cortex/index_manager.py:325-326`），直接用 `doc_id` 查即可。`_resolve_preview_path` 不变，第一个参数从 `doc_name` 改名为 `doc_key`（接受两种 key）

plan 完整可执行。
