# GUI 搜索 Tab 增加 Grep 模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 doclens GUI 的 search tab 上增加正则 Grep 搜索能力，复用现有结果/预览/分栏，模式切换走「分裂按钮下拉」，grep 历史带标记并支持重放。

**Architecture:** 后端新增 `POST /api/grep` 薄封装既有 `execute_grep_search`，返回与 `/api/search` 相同的 `SearchResponse`；前端在 `search-view` 增加持久化的 `searchMode` 状态，按模式路由到 `/api/search` 或 `/api/grep`；`input-box` 增加可选的「分裂按钮」模式选择器（对现有 chat/files 消费者零影响）；会话存储增加 `mode` 列以支持历史标记与重放。

**Tech Stack:** FastAPI + Pydantic（后端）、Lit + TypeScript + Vite/Vitest/Playwright（前端）、SQLite（会话存储）。

## Global Constraints

- **运行 Python（Bash 工具用 Git Bash，`activate` 不会把 python 加入 PATH）**：必须直接用 `.venv/Scripts/python.exe`，例如 `.venv/Scripts/python.exe -m pytest ...`。
- **后端测试**：`.venv/Scripts/python.exe -m pytest tests/web_v2/<file>.py -v`。`pytest-asyncio` 已是 `auto` 模式，无需 `@pytest.mark.asyncio` 也可，但保留与现有一致。
- **前端单测**：在 `doclens/web_v2/frontend` 目录执行 `npx vitest run tests/<file>.spec.ts`（等价 `npm test` 的单文件形式）。
- **前端类型检查**：`cd doclens/web_v2/frontend && npm run typecheck`（即 `tsc --noEmit`）。
- **前端构建**：`cd doclens/web_v2/frontend && npm run build`，产物输出到 `doclens/web_v2/static/`（git 跟踪）。
- **E2E 测试**：按用户全局规则，使用 **playwright-cli skill** 执行，不要直接调用 playwright。
- **Commit 风格**：中文 Conventional Commits（如 `feat(web): ...`、`refactor(web): ...`），与仓库历史一致。
- **禁止**：本计划不修改 `execute_grep_search` 等 grep 搜索核心逻辑；不改动 chat-view / files-view 对 `input-box` 的既有用法。

---

## File Structure

**后端（创建/修改）**
- Create: `doclens/web_v2/api/_pathutil.py` — 共享的 `resolve_preview_path(doc_key, path_map, search_path)`。
- Create: `doclens/web_v2/api/grep.py` — `POST /api/grep` 路由，封装 `execute_grep_search`。
- Modify: `doclens/web_v2/models/search.py` — `SearchResult` 增 `kind`，`SearchResponse.source` 注释加 `"grep"`，新增 `GrepRequest`。
- Modify: `doclens/web_v2/api/search.py` — 改为 import 共享的 `resolve_preview_path`。
- Modify: `doclens/web_v2/app.py` — 注册 grep 路由。
- Modify: `doclens/web_v2/sessions_store.py` — sessions 表加 `mode` 列（含旧库迁移），`SessionSummary` 加 `mode`，`find_or_create` 按 `(type,title,mode)` 去重。
- Modify: `doclens/web_v2/models/session.py` — 各 session 模型加可选 `mode`。
- Modify: `doclens/web_v2/api/sessions.py` — 透传 `mode`。

**前端（创建/修改）**
- Create: `doclens/web_v2/frontend/src/api/grep.ts` — `grepApi({pattern, offset?, limit?})`。
- Modify: `doclens/web_v2/frontend/src/state/types.ts` — `SearchMode` 类型、`SearchResult.kind?`、`Session.mode?`、`SearchViewState.source` 联合加 `"grep"`。
- Modify: `doclens/web_v2/frontend/src/api/search.ts` — `SearchResponse.source` 联合加 `"grep"`。
- Modify: `doclens/web_v2/frontend/src/api/sessions.ts` — `findOrCreateSession` 入参与响应加 `mode`。
- Modify: `doclens/web_v2/frontend/src/components/input-box.ts` — 可选分裂按钮 + 模式下拉。
- Modify: `doclens/web_v2/frontend/src/views/search-view.ts` — `searchMode` 状态、路由、持久化、历史重放。
- Modify: `doclens/web_v2/frontend/src/components/result-card.ts` — `kind==="path"` 时显示「路径」徽标。
- Modify: `doclens/web_v2/frontend/src/components/history-item.ts` — `mode==="grep"` 时显示 `</>` 标记。

**测试（创建/修改）**
- Create: `tests/web_v2/test_grep_api.py` — `/api/grep` 后端测试。
- Modify: `tests/web_v2/test_sessions_store.py` — `mode` 列与去重测试。
- Modify: `doclens/web_v2/frontend/tests/input-box.spec.ts` — 分裂按钮测试。
- Modify: `doclens/web_v2/frontend/tests/search-view.spec.ts` — 模式路由与持久化测试。
- Modify: `doclens/web_v2/frontend/tests/history-list.spec.ts`（或新增）— grep 标记测试。
- Create: `doclens/web_v2/frontend/tests/e2e/grep-mode.spec.ts` — E2E（用 playwright-cli skill 运行）。

---

### Task 1: 抽取共享的 `resolve_preview_path` 辅助函数

**Files:**
- Create: `doclens/web_v2/api/_pathutil.py`
- Modify: `doclens/web_v2/api/search.py:28-42`（删除本地 `_resolve_preview_path`，改为 import）
- Test: `tests/web_v2/test_search_api.py`（既有，回归）

**Interfaces:**
- Produces: `resolve_preview_path(doc_key: str, path_map: dict, search_path: str) -> str`，供 search.py 与 Task 2 的 grep.py 共用。

- [ ] **Step 1: 创建 `_pathutil.py`**

```python
"""web_v2 API 共享：把 doc_id/doc_name 解析为相对 search_path 的可预览路径。"""
from pathlib import Path


def resolve_preview_path(doc_key: str, path_map: dict, search_path: str) -> str:
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
```

- [ ] **Step 2: 修改 `search.py` 使用共享函数**

在 `doclens/web_v2/api/search.py` 顶部 import 区追加：

```python
from doclens.web_v2.api._pathutil import resolve_preview_path
```

删除文件中原有的 `_resolve_preview_path` 函数（第 28–42 行整段）。然后把 `_format_scored_results` 中对 `_resolve_preview_path(...)` 的三处调用改为 `resolve_preview_path(...)`（去掉前导下划线）。

- [ ] **Step 3: 回归既有搜索测试**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py -v`
Expected: 全部 PASS（行为未变，仅函数位置移动）。

- [ ] **Step 4: Commit**

```bash
git add doclens/web_v2/api/_pathutil.py doclens/web_v2/api/search.py
git commit -m "refactor(web): 抽取 resolve_preview_path 为共享辅助函数"
```

---

### Task 2: 后端 `POST /api/grep` 端点 + 模型字段

**Files:**
- Create: `doclens/web_v2/api/grep.py`
- Modify: `doclens/web_v2/models/search.py`（`SearchResult.kind`、`SearchResponse.source`、新增 `GrepRequest`）
- Modify: `doclens/web_v2/app.py:38`（注册路由）
- Test: Create `tests/web_v2/test_grep_api.py`

**Interfaces:**
- Consumes: `resolve_preview_path`（Task 1）；`execute_grep_search(idx, pattern)`（`doclens/ripgrep.py`，返回 `GrepResult{content_results, path_results, query_words}`，每项为 `(doc_id, node_dict, matched, prox, fts_score)`）；`IndexManager.path_map` / `.search_path`。
- Produces: `POST /api/grep` 接收 `GrepRequest{pattern, offset, limit}`，返回 `SearchResponse`（`source="grep"`），`SearchResult` 含 `kind`。

- [ ] **Step 1: 写失败测试 `tests/web_v2/test_grep_api.py`**

```python
"""POST /api/grep 测试。"""
import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from doclens.web_v2 import deps
from doclens.web_v2.app import create_app


@pytest.fixture
def reset_deps():
    deps.reset_singletons()
    yield
    deps.reset_singletons()


def _init_and_reindex():
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


@pytest.mark.asyncio
async def test_grep_returns_results_with_grep_source(env_cortex_config, reset_deps, temp_workdir):
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/grep", json={"pattern": "hello"})

    assert res.status_code == 200
    body = res.json()
    assert body["query"] == "hello"
    assert body["source"] == "grep"
    assert isinstance(body["results"], list)
    assert body["total"] == len(body["results"]) + body["offset"]
    for r in body["results"]:
        assert r["kind"] in ("content", "path")
        assert r["path"]  # 非空


@pytest.mark.asyncio
async def test_grep_rejects_empty_pattern(env_cortex_config, reset_deps):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/grep", json={"pattern": ""})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_grep_no_match_returns_empty(env_cortex_config, reset_deps, temp_workdir):
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/grep", json={"pattern": "zzz_no_such_xyz"})

    body = res.json()
    assert body["total"] == 0
    assert body["results"] == []
    assert body["source"] == "grep"


@pytest.mark.asyncio
async def test_grep_offset_slices_second_page(temp_workdir, env_cortex_config, reset_deps):
    # 造 25 个含相同词的文件，limit=20 → 第二页 5 条
    for i in range(25):
        (temp_workdir / f"grep_match_{i:02d}.md").write_text(
            f"# Doc {i}\n\nThis file has grepfoo token number {i}.\n", encoding="utf-8"
        )
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res1 = await client.post("/api/grep", json={"pattern": "grepfoo", "limit": 20, "offset": 0})
        res2 = await client.post("/api/grep", json={"pattern": "grepfoo", "limit": 20, "offset": 20})

    b1, b2 = res1.json(), res2.json()
    assert b1["total"] >= 1
    p1 = {r["path"] for r in b1["results"]}
    p2 = {r["path"] for r in b2["results"]}
    assert p1.isdisjoint(p2)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_grep_api.py -v`
Expected: FAIL（`/api/grep` 路由不存在 → 404/405）。

- [ ] **Step 3: 修改 `models/search.py`**

把 `doclens/web_v2/models/search.py` 改为：

```python
"""搜索 API 请求/响应模型。"""
from typing import Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    mode: str = Field(default="keyword", pattern="^(keyword|phrase)$")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class GrepRequest(BaseModel):
    pattern: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class SearchResult(BaseModel):
    path: str
    snippet: str
    score: float  # 综合分（0~1 归一化）；grep 为词项命中占比
    line: Optional[int] = None
    highlights: list[tuple[int, int]] = []
    kind: str = "content"  # "content" | "path"


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    offset: int = 0
    limit: int = 20
    query: str
    query_words: list[str] = []
    elapsed_ms: int
    source: str = "fts"  # 值 ∈ {"fts", "like", "ripgrep", "grep"}
```

- [ ] **Step 4: 创建 `api/grep.py`**

```python
"""POST /api/grep —— 正则搜索。

复用 doclens.ripgrep.execute_grep_search，与 CLI `cortex grep` 行为完全一致：
LIKE(REGEXP) → ripgrep 降级 → 路径正则，按词项命中数评分。覆盖所有文件（含未索引）。
返回与 /api/search 相同的 SearchResponse 结构，source="grep"。
"""
import asyncio
import logging
import time

from fastapi import APIRouter, Depends

from doclens.index_manager import IndexManager
from doclens.ripgrep import execute_grep_search
from doclens.web_v2.api._pathutil import resolve_preview_path
from doclens.web_v2.deps import get_index_manager
from doclens.web_v2.models.search import GrepRequest, SearchResponse, SearchResult

logger = logging.getLogger(__name__)
router = APIRouter()


def _to_search_result(doc_id, node, matched, total_terms, kind, path_map, search_path) -> SearchResult:
    return SearchResult(
        path=resolve_preview_path(doc_id, path_map, search_path),
        snippet=(node.get("text", "") or "")[:300],
        score=round(matched / total_terms, 4) if total_terms > 0 else 0.0,
        line=node.get("line_start"),
        highlights=[],
        kind=kind,
    )


def _do_grep(idx: IndexManager, pattern: str):
    """在子线程中执行同步 grep 搜索，返回 (SearchResult[], query_words)。"""
    result = execute_grep_search(idx, pattern)
    total_terms = max(len(result.query_words), 1)
    out: list[SearchResult] = []
    for doc_id, node, matched, _prox, _fts in result.content_results:
        out.append(_to_search_result(doc_id, node, matched, total_terms, "content", idx.path_map, idx.search_path))
    for doc_id, node, matched, _prox, _fts in result.path_results:
        out.append(_to_search_result(doc_id, node, matched, total_terms, "path", idx.path_map, idx.search_path))
    return out, result.query_words


@router.post("/grep", response_model=SearchResponse)
async def grep(req: GrepRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    try:
        all_results, query_words = await asyncio.to_thread(_do_grep, idx, req.pattern)
    except Exception as e:
        logger.warning("execute_grep_search failed: %s; returning empty result", e)
        return SearchResponse(
            results=[], total=0, offset=0, limit=req.limit,
            query=req.pattern, query_words=[], source="grep",
            elapsed_ms=int((time.perf_counter() - start) * 1000),
        )

    total = len(all_results)
    safe_offset = min(req.offset, max(0, total - 1)) if total > 0 else 0
    page = all_results[safe_offset : safe_offset + req.limit]
    return SearchResponse(
        results=page, total=total, offset=safe_offset, limit=req.limit,
        query=req.pattern, query_words=query_words, source="grep",
        elapsed_ms=int((time.perf_counter() - start) * 1000),
    )
```

- [ ] **Step 5: 在 `app.py` 注册路由**

在 `doclens/web_v2/app.py` 的 `create_app()` 中，紧接 files 路由注册之后追加：

```python
    from doclens.web_v2.api import grep
    app.include_router(grep.router, prefix="/api")
```

- [ ] **Step 6: 运行测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_grep_api.py -v`
Expected: 全部 PASS。

- [ ] **Step 7: 回归既有搜索/会话测试**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py tests/web_v2/test_sessions_api.py -v`
Expected: 全部 PASS（`kind` 默认值不破坏既有断言）。

- [ ] **Step 8: Commit**

```bash
git add doclens/web_v2/api/grep.py doclens/web_v2/models/search.py doclens/web_v2/app.py tests/web_v2/test_grep_api.py
git commit -m "feat(web): 新增 POST /api/grep 正则搜索端点"
```

---

### Task 3: 会话存储增加 `mode` 列（历史标记与重放）

**Files:**
- Modify: `doclens/web_v2/sessions_store.py`（schema 迁移、`SessionSummary.mode`、`create`/`find_or_create`/`list`/`get`/`_row_to_summary`）
- Modify: `doclens/web_v2/models/session.py`（各模型加 `mode`）
- Modify: `doclens/web_v2/api/sessions.py`（透传 `mode`）
- Test: Modify `tests/web_v2/test_sessions_store.py`

**Interfaces:**
- Produces: `SessionSummary.mode: Optional[str]`；`SessionsStore.find_or_create(type_, title, preview, mode=None)` 按 `(type, title, COALESCE(mode,'keyword'))` 去重；session API 模型均含可选 `mode`。

- [ ] **Step 1: 写失败测试**

在 `tests/web_v2/test_sessions_store.py` 末尾追加（如文件无现成 fixture，参照 `conftest` 用 `tmp_path` 直接构造 `SessionsStore`）：

```python
from datetime import datetime
from doclens.web_v2.sessions_store import SessionsStore, SessionSummary, SessionType


def _summary(title="t", mode=None):
    now = datetime.utcnow()
    return SessionSummary(
        id="x", type=SessionType.SEARCH, title=title, preview="p",
        mode=mode, created_at=now, updated_at=now, message_count=0,
    )


def test_find_or_create_distinguishes_modes(tmp_path):
    store = SessionsStore(tmp_path / "s.db")
    kw = store.find_or_create(SessionType.SEARCH, "foo", "p", mode="keyword")
    gp = store.find_or_create(SessionType.SEARCH, "foo", "p", mode="grep")
    assert kw.id != gp.id  # 同 title 不同 mode → 两条记录


def test_find_or_create_dedup_same_mode(tmp_path):
    store = SessionsStore(tmp_path / "s.db")
    a = store.find_or_create(SessionType.SEARCH, "foo", "p", mode="grep")
    b = store.find_or_create(SessionType.SEARCH, "foo", "p2", mode="grep")
    assert a.id == b.id  # 同 title 同 mode → 复用


def test_find_or_create_persists_and_reads_mode(tmp_path):
    store = SessionsStore(tmp_path / "s.db")
    created = store.find_or_create(SessionType.SEARCH, "foo", "p", mode="grep")
    items = store.list(SessionType.SEARCH)
    assert items and items[0].mode == "grep"
    got = store.get(created.id)
    assert got is not None and got.mode == "grep"


def test_legacy_db_migration_adds_mode_column(tmp_path):
    """旧库无 mode 列时，重新打开应自动迁移且不报错。"""
    db = tmp_path / "s.db"
    store = SessionsStore(db)
    store.find_or_create(SessionType.SEARCH, "foo", "p")  # 写一条
    # 再开一次（触发迁移路径）
    store2 = SessionsStore(db)
    items = store2.list(SessionType.SEARCH)
    assert items and items[0].mode is None  # 旧记录无 mode
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_sessions_store.py -v`
Expected: FAIL（`mode` 字段/列不存在）。

- [ ] **Step 3: 修改 `sessions_store.py`**

在 `SessionSummary` 增加 `mode`：

```python
class SessionSummary(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    mode: Optional[str] = None  # 搜索模式：'keyword' | 'grep'（chat 为 None）
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
```

把 `_SCHEMA` 中 sessions 建表语句改为（增加 `mode TEXT` 列）：

```python
_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    type         TEXT NOT NULL,
    title        TEXT NOT NULL,
    preview      TEXT NOT NULL,
    mode         TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_type_updated
    ON sessions(type, updated_at DESC);

CREATE TABLE IF NOT EXISTS session_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,
    kind        TEXT NOT NULL,
    payload     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_session ON session_items(session_id, seq);
"""
```

把 `_init_schema` 改为（含旧库迁移）：

```python
    def _init_schema(self) -> None:
        with self._lock:
            with self._conn() as conn:
                conn.executescript(_SCHEMA)
                # 迁移：旧库 sessions 表无 mode 列时补上（新库 _SCHEMA 已含）
                cols = {row[1] for row in conn.execute("PRAGMA table_info(sessions)")}
                if "mode" not in cols:
                    conn.execute("ALTER TABLE sessions ADD COLUMN mode TEXT")
```

把 `create` 改为：

```python
    def create(self, s: SessionSummary) -> None:
        with self._lock, self._conn() as conn:
            conn.execute(
                """INSERT INTO sessions
                   (id, type, title, preview, mode, created_at, updated_at, message_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    s.id, s.type.value, s.title, s.preview, s.mode,
                    s.created_at.isoformat(), s.updated_at.isoformat(), s.message_count,
                ),
            )
```

把 `find_or_create` 改为（新增 `mode` 参数；查询/写入带 mode；`COALESCE` 把 NULL 视作 `'keyword'` 以兼容旧记录与 chat）：

```python
    def find_or_create(
        self,
        type_: SessionType,
        title: str,
        preview: str = "",
        mode: Optional[str] = None,
    ) -> SessionSummary:
        """按 (type, title, mode) 原子地查找会话；命中则刷新 updated_at（并更新 preview），
        未命中则新建。整个过程持锁，避免并发条件下的重复创建。

        主要服务于 search 历史：相同关键词只保留一条记录，重复搜索时只置顶。
        mode 仅对 search 有意义；旧记录与 chat 的 mode 为 NULL，视作 'keyword'。
        """
        now = datetime.utcnow()
        now_iso = now.isoformat()
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT id, type, title, preview, mode, created_at, updated_at, message_count
                   FROM sessions
                   WHERE type = ? AND title = ?
                     AND COALESCE(mode, 'keyword') = COALESCE(?, 'keyword')
                   ORDER BY datetime(updated_at) DESC
                   LIMIT 1""",
                (type_.value, title, mode),
            ).fetchone()
            if row is not None:
                conn.execute(
                    """UPDATE sessions SET updated_at = ?, preview = ? WHERE id = ?""",
                    (now_iso, preview, row["id"]),
                )
                return SessionSummary(
                    id=row["id"],
                    type=SessionType(row["type"]),
                    title=row["title"],
                    preview=preview,
                    mode=row["mode"],
                    created_at=datetime.fromisoformat(row["created_at"]),
                    updated_at=now,
                    message_count=row["message_count"],
                )
            sid = str(_ulid.new())
            conn.execute(
                """INSERT INTO sessions
                   (id, type, title, preview, mode, created_at, updated_at, message_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0)""",
                (sid, type_.value, title, preview, mode, now_iso, now_iso),
            )
            return SessionSummary(
                id=sid, type=type_, title=title, preview=preview, mode=mode,
                created_at=now, updated_at=now, message_count=0,
            )
```

把 `list` 与 `get` 的 SELECT 列表加上 `mode`（即 `SELECT id, type, title, preview, mode, created_at, updated_at, message_count ...`）。

把 `_row_to_summary` 改为：

```python
    @staticmethod
    def _row_to_summary(row: sqlite3.Row) -> SessionSummary:
        return SessionSummary(
            id=row["id"],
            type=SessionType(row["type"]),
            title=row["title"],
            preview=row["preview"],
            mode=row["mode"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            message_count=row["message_count"],
        )
```

- [ ] **Step 4: 修改 `models/session.py`**

给 `SessionCreateRequest`、`SessionCreatedResponse`、`SessionListItem`、`SessionDetailResponse` 各加一个可选字段：

```python
    mode: Optional[str] = None  # 搜索模式：'keyword' | 'grep'
```

（放在 `preview` 之后即可；`from typing import Optional` 已存在。）

- [ ] **Step 5: 修改 `api/sessions.py` 透传 mode**

`create_session`：

```python
    summary = SessionSummary(
        id=sid, type=req.type, title=req.title, preview=req.preview,
        mode=req.mode, created_at=now, updated_at=now, message_count=0,
    )
    store.create(summary)
    return SessionCreatedResponse(id=sid, type=req.type, title=req.title, preview=req.preview, mode=req.mode)
```

`find_or_create_session`：

```python
    summary = store.find_or_create(req.type, req.title, req.preview, req.mode)
    return SessionCreatedResponse(
        id=summary.id, type=summary.type, title=summary.title,
        preview=summary.preview, mode=summary.mode,
    )
```

- [ ] **Step 6: 运行测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_sessions_store.py tests/web_v2/test_sessions_api.py -v`
Expected: 全部 PASS。

- [ ] **Step 7: Commit**

```bash
git add doclens/web_v2/sessions_store.py doclens/web_v2/models/session.py doclens/web_v2/api/sessions.py tests/web_v2/test_sessions_store.py
git commit -m "feat(web): 会话存储增加 mode 列支持 grep 历史标记"
```

---

### Task 4: 前端类型与 API 客户端

**Files:**
- Modify: `doclens/web_v2/frontend/src/state/types.ts`
- Modify: `doclens/web_v2/frontend/src/api/search.ts`
- Modify: `doclens/web_v2/frontend/src/api/sessions.ts`
- Create: `doclens/web_v2/frontend/src/api/grep.ts`
- Test: `npm run typecheck`

**Interfaces:**
- Produces: `SearchMode = "keyword" | "grep"`；`SearchResult.kind?`；`Session.mode?`；`SearchViewState.source` 含 `"grep"`；`grepApi({pattern, offset?, limit?})`；`findOrCreateSession` 入参与响应含 `mode`。

- [ ] **Step 1: 修改 `state/types.ts`**

在 `SearchResult` 加字段：

```ts
export interface SearchResult {
  path: string;
  snippet: string;
  score: number;
  line: number | null;
  highlights: [number, number][];
  kind?: "content" | "path";
}
```

在 `Session` 加字段：

```ts
export interface Session {
  id: string;
  type: "search" | "chat";
  title: string;
  preview: string;
  updated_at: string;
  message_count: number;
  mode?: "keyword" | "grep";
}
```

把 `SearchViewState.source` 改为：

```ts
  source: "fts" | "like" | "ripgrep" | "grep";
```

在文件顶部（`ViewId` 附近）新增导出类型：

```ts
export type SearchMode = "keyword" | "grep";
```

- [ ] **Step 2: 修改 `api/search.ts`**

把 `SearchResponse.source` 改为：

```ts
  source: "fts" | "like" | "ripgrep" | "grep";
```

- [ ] **Step 3: 创建 `api/grep.ts`**

```ts
import { request } from "./client";
import type { SearchResponse } from "./search";

/** POST /api/grep —— 正则搜索，返回与 searchApi 相同的 SearchResponse。 */
export async function grepApi(req: { pattern: string; offset?: number; limit?: number }): Promise<SearchResponse> {
  return request<SearchResponse>("/api/grep", { method: "POST", json: req });
}
```

- [ ] **Step 4: 修改 `api/sessions.ts`**

```ts
export interface CreateSessionResponse extends Pick<Session, "id" | "type" | "title" | "preview" | "mode"> {}

export async function createSession(req: { type: "search" | "chat"; title: string; preview?: string; mode?: "keyword" | "grep" }): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/api/sessions", { method: "POST", json: req });
}

/** 按 (type, title, mode) 原子地查找或新建会话；用于 search 历史去重。 */
export async function findOrCreateSession(req: { type: "search" | "chat"; title: string; preview?: string; mode?: "keyword" | "grep" }): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/api/sessions/find-or-create", { method: "POST", json: req });
}
```

（`listSessions`/`appendSession` 等保持不变。）

- [ ] **Step 5: 类型检查**

Run: `cd doclens/web_v2/frontend && npm run typecheck`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add doclens/web_v2/frontend/src/state/types.ts doclens/web_v2/frontend/src/api/search.ts doclens/web_v2/frontend/src/api/grep.ts doclens/web_v2/frontend/src/api/sessions.ts
git commit -m "feat(web): 前端新增 grepApi 与 SearchMode 类型"
```

---

### Task 5: `input-box` 可选分裂按钮模式选择器

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/input-box.ts`
- Test: Modify `doclens/web_v2/frontend/tests/input-box.spec.ts`

**Interfaces:**
- Consumes: `SearchMode`（Task 4）。
- Produces: `input-box` 新增属性 `.mode`（`SearchMode`）与 `.modes`（`Record<SearchMode, {label, icon}>`）；当二者齐备时渲染分裂按钮（主体 `submit` + caret 弹下拉），选中派发 `mode-change` 事件（`detail: { mode }`）。未提供 `.modes` 时渲染与现状完全一致的单一按钮（chat/files 不受影响）。

- [ ] **Step 1: 写失败测试**

在 `doclens/web_v2/frontend/tests/input-box.spec.ts` 末尾追加：

```ts
import type { SearchMode } from "../src/state/types";

const MODES: Record<SearchMode, { label: string; icon: string }> = {
  keyword: { label: "关键词", icon: "🔍" },
  grep: { label: "Grep", icon: "</>" },
};

describe("<input-box> mode split-button", () => {
  it("renders split caret only when modes provided", async () => {
    const el = await fixture(html`<input-box .mode="keyword" .modes=${MODES}></input-box>`) as any;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".caret")).toBeTruthy();
  });

  it("does not render caret when modes omitted (legacy)", async () => {
    const el = await fixture(html`<input-box button-label="go"></input-box>`) as any;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".caret")).toBeNull();
    // 主体按钮仍存在且为第一个 button
    expect(el.shadowRoot!.querySelector("button.primary, button")).toBeTruthy();
  });

  it("clicking caret opens menu; selecting grep emits mode-change", async () => {
    const el = await fixture(html`<input-box .mode="keyword" .modes=${MODES}></input-box>`) as any;
    await el.updateComplete;
    const caret = el.shadowRoot!.querySelector<HTMLButtonElement>(".caret")!;
    caret.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu")).toBeTruthy();

    let emitted: string | null = null;
    el.addEventListener("mode-change", (e: any) => (emitted = e.detail.mode));

    // 菜单第二项是 grep
    const items = el.shadowRoot!.querySelectorAll<HTMLElement>(".menu-item");
    items[1].click();
    await el.updateComplete;
    expect(emitted).toBe("grep");
    expect(el.shadowRoot!.querySelector(".menu")).toBeNull(); // 菜单已关
  });

  it("clicking primary body still emits submit", async () => {
    const el = await fixture(html`<input-box .mode="keyword" .modes=${MODES}></input-box>`) as any;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("input")!;
    input.value = "x";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    let submitted = "";
    el.addEventListener("submit", (e: any) => (submitted = e.detail.value));
    el.shadowRoot!.querySelector<HTMLButtonElement>("button.primary")!.click();
    expect(submitted).toBe("x");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/input-box.spec.ts`
Expected: 新增用例 FAIL（无 `.caret` / `.menu` / `mode-change`）。

- [ ] **Step 3: 修改 `input-box.ts`**

在文件顶部 import 增加 `state`，并引入类型：

```ts
import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type { SearchMode } from "../state/types";
```

在现有 `@property` 之后新增属性与内部状态：

```ts
  /** 模式选择器：提供时渲染分裂按钮 + caret 下拉；不提供时为遗留单一按钮。 */
  @property() mode: SearchMode = "keyword";
  @property({ attribute: false }) modes: Record<SearchMode, { label: string; icon: string }> | null = null;
  @state() private _menuOpen = false;
```

新增辅助方法与事件处理（放在 `_submit` 之后、`render` 之前）：

```ts
  private get _hasModes(): boolean {
    return !!this.modes && this.mode in this.modes;
  }

  private _toggleMenu(e: Event) {
    e.stopPropagation();
    this._menuOpen = !this._menuOpen;
    if (this._menuOpen) {
      // 点击组件外任意处关闭菜单
      document.addEventListener("click", this._onDocClick);
    }
  }

  private _onDocClick = () => {
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
  };

  private _selectMode(key: SearchMode) {
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
    this.dispatchEvent(new CustomEvent("mode-change", { detail: { mode: key } }));
  }

  private _renderButton() {
    if (!this._hasModes) {
      // 遗留单一按钮：与改造前完全一致
      return html`
        <button @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
          ${this.buttonIcon ? html`<span aria-hidden="true">${this.buttonIcon}</span>` : null}
          <span>${this.buttonLabel}</span>
        </button>`;
    }
    const cur = this.modes![this.mode];
    return html`
      <div class="actions split">
        <button class="primary" @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
          ${cur?.icon ? html`<span aria-hidden="true">${cur.icon}</span>` : null}
          <span>${cur?.label ?? this.buttonLabel}</span>
        </button>
        <button class="caret" @click=${this._toggleMenu} ?disabled=${this.disabled}
                aria-label="切换搜索模式" aria-expanded=${this._menuOpen}>▾</button>
      </div>`;
  }

  private _renderMenu() {
    if (!this._hasModes || !this._menuOpen) return null;
    return html`
      <div class="menu" role="menu">
        ${(Object.keys(this.modes!) as SearchMode[]).map((key) => html`
          <div class="menu-item ${key === this.mode ? "active" : ""}" role="menuitem"
               @click=${() => this._selectMode(key)}>
            ${this.modes![key].icon ? html`<span aria-hidden="true">${this.modes![key].icon}</span>` : null}
            <span>${this.modes![key].label}</span>
          </div>`)}
      </div>`;
  }
```

把 `render()` 改为：

```ts
  render() {
    const field = this.multiline
      ? html`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown}></textarea>`
      : html`<input type="text" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown} />`;
    return html`
      <div class="wrapper">
        ${field}
        ${this._renderButton()}
        ${this._renderMenu()}
      </div>
    `;
  }
```

在 `static styles` 中保留原 `button { ... }` 规则，并追加分裂按钮/菜单样式：

```css
    .actions.split {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
    }
    .actions.split .primary {
      position: static;
      transform: none;
      top: auto;
      right: auto;
      min-width: var(--cortex-touch-target);
      height: calc(var(--min-h) - 8px);
      border-radius: var(--cortex-radius-sm) 0 0 var(--cortex-radius-sm);
    }
    .caret {
      background: var(--cortex-primary);
      color: #fff;
      border: none;
      border-left: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 0 var(--cortex-radius-sm) var(--cortex-radius-sm) 0;
      height: calc(var(--min-h) - 8px);
      min-width: 24px;
      padding: 0 8px;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .caret:hover:not(:disabled) { background: var(--cortex-primary-hover); }
    .caret:disabled { opacity: 0.5; cursor: not-allowed; }
    .menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 6px;
      z-index: 20;
      min-width: 140px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      overflow: hidden;
    }
    .menu-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      cursor: pointer;
    }
    .menu-item:hover { background: var(--cortex-surface-muted); }
    .menu-item.active { color: var(--cortex-primary); font-weight: 600; }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/input-box.spec.ts`
Expected: 全部 PASS（含原有遗留按钮用例）。

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/frontend/src/components/input-box.ts doclens/web_v2/frontend/tests/input-box.spec.ts
git commit -m "feat(web): input-box 支持可选分裂按钮模式选择器"
```

---

### Task 6: `search-view` 模式状态、路由与持久化

**Files:**
- Modify: `doclens/web_v2/frontend/src/views/search-view.ts`
- Test: Modify `doclens/web_v2/frontend/tests/search-view.spec.ts`

**Interfaces:**
- Consumes: `grepApi`（Task 4）、`input-box` 分裂按钮（Task 5）、`Session.mode`（Task 4）。
- Produces: `search-view` 持久化 `searchMode`（localStorage key `cortex.searchMode`），`_submit`/`_goToPage` 按模式路由；提交时把 `mode` 传给 `findOrCreateSession`；历史重放先设模式。

- [ ] **Step 1: 写失败测试**

在 `doclens/web_v2/frontend/tests/search-view.spec.ts` 末尾追加：

```ts
describe("<search-view> grep mode routing", () => {
  const MODE_KEY = "cortex.searchMode";
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    resetStore(store);
    localStorage.removeItem(MODE_KEY);
  });
  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.removeItem(MODE_KEY);
    vi.restoreAllMocks();
  });

  it("persists and restores searchMode from localStorage", async () => {
    localStorage.setItem(MODE_KEY, "grep");
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    expect((el as any).searchMode).toBe("grep");
  });

  it("defaults to keyword when no saved mode", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    expect((el as any).searchMode).toBe("keyword");
  });

  it("submit in grep mode calls /api/grep (not /api/search)", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    (el as any).searchMode = "grep";

    const fetchSpy = vi.fn(async (url: string) => {
      if (String(url) === "/api/grep") {
        return new Response(JSON.stringify({
          results: [], total: 0, offset: 0, limit: 20, query: "x",
          query_words: [], elapsed_ms: 1, source: "grep",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as any;
    global.fetch = fetchSpy;

    await (el as any)._submit("x");
    await new Promise((r) => setTimeout(r, 20));

    const grepCalls = fetchSpy.mock.calls.filter((c: any) => String(c[0]) === "/api/grep");
    const searchCalls = fetchSpy.mock.calls.filter((c: any) => String(c[0]) === "/api/search");
    expect(grepCalls.length).toBe(1);
    expect(searchCalls.length).toBe(0);

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/search-view.spec.ts`
Expected: 新增用例 FAIL（无 `searchMode`、无 grep 路由）。

- [ ] **Step 3: 修改 `search-view.ts`**

import 区追加：

```ts
import { searchApi } from "../api/search";
import { grepApi } from "../api/grep";
import type { SearchMode, SearchResult, Session } from "../state/types";
```

在类常量区（`RESULTS_PANE_WIDTH_*` 附近）新增：

```ts
  static readonly SEARCH_MODE_KEY = "cortex.searchMode";
  static readonly SEARCH_MODES: Record<SearchMode, { label: string; icon: string }> = {
    keyword: { label: "关键词", icon: "🔍" },
    grep: { label: "Grep", icon: "</>" },
  };
```

在 `@state()` 区新增：

```ts
  @state() private searchMode: SearchMode = "keyword";
```

在 `connectedCallback` 中 `this._loadResultsPaneWidth();` 之后调用 `this._loadSearchMode();`，并新增方法：

```ts
  private _loadSearchMode() {
    const saved = localStorage.getItem(SearchView.SEARCH_MODE_KEY);
    if (saved === "keyword" || saved === "grep") {
      this.searchMode = saved;
    }
  }

  private _onModeChange = (e: CustomEvent<{ mode: SearchMode }>) => {
    this.searchMode = e.detail.mode;
    localStorage.setItem(SearchView.SEARCH_MODE_KEY, e.detail.mode);
  };
```

把 `_submit` 中调用 API 与写会话两段改为按模式分支。具体：把

```ts
        const res = await searchApi({ query, offset: 0, limit: 20 });
```

替换为：

```ts
        const res = this.searchMode === "grep"
          ? await grepApi({ pattern: query, offset: 0, limit: 20 })
          : await searchApi({ query, offset: 0, limit: 20 });
```

并把 `findOrCreateSession({ type: "search", title: query, preview: query.slice(0, 100) })` 改为带上 mode：

```ts
        void findOrCreateSession({
          type: "search", title: query, preview: query.slice(0, 100),
          mode: this.searchMode === "grep" ? "grep" : "keyword",
        }).then((created) => {
```

把 `_goToPage` 中

```ts
      const res = await searchApi({ query: s.query, offset: newOffset, limit });
```

替换为：

```ts
      const res = this.searchMode === "grep"
        ? await grepApi({ pattern: s.query, offset: newOffset, limit })
        : await searchApi({ query: s.query, offset: newOffset, limit });
```

把 `_loadSession` 改为先设模式再重放：

```ts
  private async _loadSession(s: Session) {
    // 历史条目携带模式：按其记录的引擎重放。
    this.searchMode = s.mode === "grep" ? "grep" : "keyword";
    localStorage.setItem(SearchView.SEARCH_MODE_KEY, this.searchMode);
    await this._submit(s.title);
  }
```

在 `render()` 的 initial 分支 `<input-box ...>` 上增加模式属性与事件，placeholder 随模式变化：

```ts
            <input-box
              placeholder=${this.searchMode === "grep" ? "输入正则表达式..." : "输入搜索关键词..."}
              button-label="搜索"
              button-icon="🔍"
              .mode=${this.searchMode}
              .modes=${SearchView.SEARCH_MODES}
              ?disabled=${this.loading}
              .value=${this.localQuery}
              @input-change=${(e: any) => (this.localQuery = e.detail.value)}
              @mode-change=${this._onModeChange}
              @submit=${this._submit}>
            </input-box>
```

（meta 行已是 `${s.source === "fts" ? "" : ` (${s.source.toUpperCase()})`}`，grep 的 `source="grep"` 会自动显示 `(GREP)`，无需改动。）

- [ ] **Step 4: 运行测试确认通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/search-view.spec.ts`
Expected: 全部 PASS。

- [ ] **Step 5: 类型检查**

Run: `cd doclens/web_v2/frontend && npm run typecheck`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add doclens/web_v2/frontend/src/views/search-view.ts doclens/web_v2/frontend/tests/search-view.spec.ts
git commit -m "feat(web): search-view 按模式路由到 grep/search 并持久化模式"
```

---

### Task 7: `result-card` 路径徽标 + `history-item` 模式标记

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/result-card.ts`
- Modify: `doclens/web_v2/frontend/src/components/history-item.ts`
- Test: 新增/修改对应 spec

**Interfaces:**
- Consumes: `SearchResult.kind`（Task 4）、`Session.mode`（Task 4）。

- [ ] **Step 1: 写失败测试**

新建 `doclens/web_v2/frontend/tests/result-card-grep.spec.ts`：

```ts
import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/result-card";

describe("<result-card> path badge", () => {
  it("shows 路径 badge when kind=path", async () => {
    const el = await fixture(html`<result-card .result=${{ path: "a/b.md", snippet: "s", score: 0.5, line: null, kind: "path" } as any}></result-card>`) as any;
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain("路径");
  });

  it("does not show 路径 badge for content/default", async () => {
    const el = await fixture(html`<result-card .result=${{ path: "a/b.md", snippet: "s", score: 0.5, line: 3 } as any}></result-box>`) as any;
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).not.toContain("路径");
  });
});
```

> 注：第二条用例的标签笔误应为 `result-card`（非 `result-box`），实现时写成 `<result-card ...>`。

新建 `doclens/web_v2/frontend/tests/history-item-grep.spec.ts`：

```ts
import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/history-item";

describe("<history-item> grep marker", () => {
  it("shows </> marker when mode=grep", async () => {
    const el = await fixture(html`<history-item .session=${{ id: "1", type: "search", title: "foo", preview: "", updated_at: new Date().toISOString(), message_count: 0, mode: "grep" } as any}></history-item>`) as any;
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain("</>");
  });

  it("no marker when mode is keyword/absent", async () => {
    const el = await fixture(html`<history-item .session=${{ id: "1", type: "search", title: "foo", preview: "", updated_at: new Date().toISOString(), message_count: 0 } as any}></history-item>`) as any;
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).not.toContain("</>");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/result-card-grep.spec.ts tests/history-item-grep.spec.ts`
Expected: FAIL（无徽标/标记）。

- [ ] **Step 3: 修改 `result-card.ts`**

在 `static styles` 中追加徽标样式：

```css
    .badge {
      display: inline-block;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
      border-radius: 4px;
      padding: 0 4px;
      margin-right: 4px;
    }
```

把 `render()` 的 `.path` 行改为：

```ts
      <div class="path">
        ${this.result.kind === "path" ? html`<span class="badge">路径</span>` : null}
        ${this.result.path}${this.result.line ? `:${this.result.line}` : ""}
      </div>
```

- [ ] **Step 4: 修改 `history-item.ts`**

在 `static styles` 中追加：

```css
    .mode-tag {
      display: inline-block;
      margin-right: 6px;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-primary);
    }
```

把 `render()` 的 `.name` 行改为：

```ts
      <div class="name">
        ${this.session.mode === "grep" ? html`<span class="mode-tag" title="正则 Grep"></>` : null}
        ${this.session.title}
      </div>
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/result-card-grep.spec.ts tests/history-item-grep.spec.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add doclens/web_v2/frontend/src/components/result-card.ts doclens/web_v2/frontend/src/components/history-item.ts doclens/web_v2/frontend/tests/result-card-grep.spec.ts doclens/web_v2/frontend/tests/history-item-grep.spec.ts
git commit -m "feat(web): 结果卡片显示路径徽标，历史项显示 grep 标记"
```

---

### Task 8: 前端构建 + E2E 验证（playwright-cli skill）

**Files:**
- Create: `doclens/web_v2/frontend/tests/e2e/grep-mode.spec.ts`
- Modify: `doclens/web_v2/static/**`（`npm run build` 产物，git 跟踪）

**Interfaces:**
- Consumes: 全部前端改动（Task 4–7）+ 后端 `/api/grep`（Task 2）。

> **E2E 执行方式**：按用户全局规则，必须通过 **playwright-cli skill** 运行本测试，不要直接调用 `playwright`。

- [ ] **Step 1: 创建 E2E 测试 `tests/e2e/grep-mode.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

function shadow(page: import("@playwright/test").Page, host: string, inner: string) {
  return page.locator(`${host} >> ${inner}`);
}

test.describe("Search tab grep mode", () => {
  test("switch to grep via caret and submit", async ({ page }) => {
    await page.goto("/");

    // 输入并切到 Grep
    const input = shadow(page, "input-box", "input");
    await input.fill("hello");
    await shadow(page, "input-box", ".caret").click();
    // 菜单第二项：Grep
    await shadow(page, "input-box", ".menu-item:nth-child(2)").click();

    // 提交
    await shadow(page, "input-box", "button.primary").click();

    // 进入 focus 怗态；source 标记为 GREP
    await expect(page.locator("focus-header")).toBeVisible();
    await expect(shadow(page, "focus-header", ".meta")).toContainText("GREP");
  });

  test("grep entry appears in history with marker", async ({ page }) => {
    await page.goto("/");
    // 切 Grep 并提交（产生一条 grep 历史）
    await shadow(page, "input-box", "input").fill("world");
    await shadow(page, "input-box", ".caret").click();
    await shadow(page, "input-box", ".menu-item:nth-child(2)").click();
    await shadow(page, "input-box", "button.primary").click();
    await expect(page.locator("focus-header")).toBeVisible();

    // 回到新搜索
    await shadow(page, "focus-header", ".back").click();
    // 历史列表含 grep 标记
    await expect(shadow(page, "history-list", "history-item .mode-tag")).toHaveCount(1);
  });
});
```

- [ ] **Step 2: 构建前端**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: `tsc --noEmit` 通过 + Vite 构建成功，产物写入 `../static/`。

- [ ] **Step 3: 用 playwright-cli skill 跑 E2E**

调用 **playwright-cli skill** 启动后端（`./start.ps1 gui` 或 `.venv/Scripts/python.exe -m doclens -C test_work_dir gui`）并执行新 E2E：
- 启动服务（端口见日志，如 7860）。
- 运行 `grep-mode.spec.ts`。
Expected: 两条用例 PASS。

> 若 focus-header 的返回按钮选择器 `.back` 与实际不符，先在浏览器中确认返回按钮的真实选择器（参考 `focus-header` 组件），再调整。

- [ ] **Step 4: 提交构建产物与 E2E**

```bash
git add doclens/web_v2/frontend/tests/e2e/grep-mode.spec.ts doclens/web_v2/static
git commit -m "test(web): 新增 grep 模式 E2E 并更新前端构建产物"
```

---

## Self-Review（已完成）

- **Spec 覆盖**：§2 决策 1（统一结果）→ Task 2/6 复用 SearchResponse；决策 2（分裂按钮）→ Task 5；决策 3（共享历史+标记）→ Task 3/6/7；决策 4（默认 keyword）→ Task 6 默认值；决策 5（持久化）→ Task 6 `_loadSearchMode`/`SEARCH_MODE_KEY`；决策 6（`source="grep"`）→ Task 2/4；决策 7（`kind` 徽标）→ Task 2/4/7。§4 后端 → Task 1/2/3；§5 前端 → Task 4/5/6/7；§6 复用 → Task 6 不动结果/预览/分页；§7 测试 → 各 Task 单测 + Task 8 E2E；§8 非目标（不做经典 grep 视图/高级选项）→ 未引入新结果组件，符合。
- **占位符扫描**：无 TBD/TODO；每步均含完整代码或确切命令。
- **类型一致性**：`SearchMode`、`grepApi({pattern,offset?,limit?})`、`resolve_preview_path`、`SessionSummary.mode`、`find_or_create(..., mode=None)`、`SEARCH_MODE_KEY`/`SEARCH_MODES`、`mode-change` 事件在各 Task 间命名一致。Task 7 Step 1 已标注 `result-box` 笔误需写为 `result-card`。
