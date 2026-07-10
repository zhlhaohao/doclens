# Web v2 强制重建索引对话框 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 App Bar 下拉菜单增加「强制重建索引」入口，点击后弹出的对话框（移动端适配）通过 SSE 实时显示 force 全量重建进度。

**Architecture:** 扩展 `IndexManager.trigger_background_reindex(force, on_progress)`；新增 `POST /api/reindex` SSE 端点（复用 chat 的 `EventSourceResponse` + 后台线程→`queue.Queue`→SSE 范式）；前端新增 `reindex-dialog`（确认/进行/完成/错误 4 阶段，`streamSSE` 读流，`AbortController` 中断），App Bar 菜单项触发，`<reindex-dialog>` 挂载到 `cortex-app`。

**Tech Stack:** Python 3 / FastAPI / sse_starlette / pytest / httpx（后端）；TypeScript / Lit / vitest / @open-wc/testing（前端）。

## Global Constraints

- Python：PEP 8 + 类型注解；不可变更新；`logging` 不 `print`；文件 <800 行。
- **`trigger_background_reindex` 向后兼容**：`force`/`on_progress` 均可选，现有调用（`deps.start_watcher`、`files.py`、`preview.py`、`FileWatcher._do_reindex`）不传 → 仍增量、无进度回调，行为不变。
- `trigger_background_reindex(on_complete)` 保证调用（成功/异常两路径），reindexing 在完成回调清零。
- SSE 事件用 `yield {"event": <name>, "data": json.dumps(<obj>, ensure_ascii=False)}` + `EventSourceResponse`（参考 `chat.py:137-167`）；`ensure_ascii=False`（中文文件名）。
- 后端测试：pytest，`tests/web_v2/`，`ASGITransport` + `AsyncClient`，索引初始化在 `asyncio.to_thread` 子线程。fixtures `temp_workdir`（建 doc1.md/doc2.py/data.csv + chdir）/`env_cortex_config` 已存在于 `conftest.py`。
- TS：spread 不可变更新；禁止 `console.log`；`disconnectedCallback` 清理监听/AbortController。
- 前端测试：vitest + @open-wc/testing（`frontend/tests/`）。**注意 vitest 过 ≠ `npm run build` 的 `tsc --noEmit` 过**——提交前确认无未用 import。
- 改前端后必须 `npm run build`（CLAUDE.md 要求，产物 `doclens/web_v2/static/`）。
- Commit message：中文 `<type>: <desc>`，**禁止 `Co-Authored-By`**。
- 仓库根：`/c/Users/lianghao/github/0710-1`；前端工程：`doclens/web_v2/frontend`；Python：`.venv/Scripts/python.exe`。

## File Structure

**后端**
- `doclens/index_manager.py`（改）：`trigger_background_reindex` 加 `force`/`on_progress`。
- `doclens/web_v2/api/reindex.py`（新）：`POST /api/reindex` SSE。
- `doclens/web_v2/app.py`（改）：挂载 reindex router。
- `tests/web_v2/test_reindex_trigger.py`（新）、`tests/web_v2/test_reindex_api.py`（新）。

**前端**
- `frontend/src/state/types.ts`（改）：`ReindexState`/`ReindexResult` + `AppState.reindex`。
- `frontend/src/state/store.ts`（改）：reindex 切片 + 6 actions。
- `frontend/src/api/client.ts`（改）：`streamSSE` 加 `signal`。
- `frontend/src/components/reindex-dialog.ts`（新）：4 阶段 + SSE。
- `frontend/src/components/app-bar.ts`（改）：菜单项。
- `frontend/src/app.ts`（改）：挂载 `<reindex-dialog>`。
- `frontend/tests/store-reindex.spec.ts`（新）、`reindex-dialog.spec.ts`（新）、`app-bar.spec.ts`（改）、`api-client-sse-signal.spec.ts`（新）。

---

### Task 1: 后端 trigger_background_reindex 扩展 force/on_progress

**Files:**
- Modify: `doclens/index_manager.py`（`trigger_background_reindex` 方法，约 249-344 行）
- Test: `tests/web_v2/test_reindex_trigger.py`（新建）

**Interfaces:**
- Produces: `IndexManager.trigger_background_reindex(self, force: bool = False, on_progress=None, on_complete=None) -> threading.Thread`。`on_progress(file_path: str, indexed_count: int)`。Task 2 reindex API 依赖 `force`/`on_progress`/`on_complete`。

- [ ] **Step 1: 写失败测试**

新建 `tests/web_v2/test_reindex_trigger.py`：

```python
"""trigger_background_reindex(force, on_progress) 扩展测试。"""
import os
import threading

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager


def _make_idx(tmp_path):
    config = CortexConfig(
        search_path=str(tmp_path),
        index_path=str(tmp_path / ".cortex" / "index.db"),
    )
    return IndexManager(config)


def test_trigger_force_invokes_on_progress_and_on_complete(temp_workdir):
    idx = _make_idx(temp_workdir)
    progress = []
    result = {}
    done = threading.Event()

    def on_progress(file_path, n):
        progress.append((os.path.basename(file_path), n))

    def on_complete(success, doc_count, failed_count):
        result.update(success=success, doc_count=doc_count, failed_count=failed_count)
        done.set()

    t = idx.trigger_background_reindex(force=True, on_progress=on_progress, on_complete=on_complete)
    assert t is not None
    t.join(timeout=120)
    assert done.is_set(), "on_complete 未在超时内调用"
    assert result["success"] is True
    assert result["doc_count"] >= 1  # temp_workdir 至少 doc1.md/data.csv 被索引
    assert len(progress) >= 1
    counts = [n for _, n in progress]
    assert counts == sorted(counts)  # indexed_count 单调递增
    assert counts[-1] == len(progress)


def test_trigger_defaults_no_force_no_progress(temp_workdir):
    """不传 force/on_progress 时向后兼容（无回调也能正常完成）。"""
    idx = _make_idx(temp_workdir)
    done = threading.Event()
    result = {}

    def on_complete(success, doc_count, failed_count):
        result.update(success=success, doc_count=doc_count)
        done.set()

    t = idx.trigger_background_reindex(on_complete=on_complete)
    t.join(timeout=120)
    assert done.is_set()
    assert result["success"] is True
```

- [ ] **Step 2: 运行验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_reindex_trigger.py -v`
Expected: FAIL（`trigger_background_reindex() got an unexpected keyword argument 'force'`）

- [ ] **Step 3: 改 `doclens/index_manager.py`**

(a) 修改 `trigger_background_reindex` 签名（约 249 行）：

```python
    def trigger_background_reindex(self, force: bool = False, on_progress=None, on_complete=None):
        """供 FileWatcher / 手动触发的后台 reindex（使用自身的 _reindex_lock）

        Args:
            force: True 时全量重建（清空旧索引重扫）；False 增量更新。
            on_progress: 每个文件索引完调用，签名 (file_path: str, indexed_count: int) -> None。
            on_complete: 索引完成回调，签名 (success: bool, doc_count: int, failed_count: int) -> None。
        """
```

(b) 在 `_bg_work` 内的 `on_file_indexed`（约 280 行）末尾加 on_progress 调用：

```python
                    def on_file_indexed(file_path: str, processed: int = 0, total: int = 0):
                        """每索引完一个文件时调用"""
                        current_file[0] = file_path
                        indexed_count[0] += 1
                        if on_progress:
                            try:
                                on_progress(file_path, indexed_count[0])
                            except Exception as e:  # noqa: BLE001
                                logger.debug("on_progress callback error: %s", e)
```

(c) 把 `new_ts.index(...)`（约 309 行）加 `force=force`：

```python
                        new_ts.index(self.search_path, force=force, progress_callback=on_file_indexed)
```

- [ ] **Step 4: 运行验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_reindex_trigger.py -v`
Expected: 2 passed

- [ ] **Step 5: 回归 watchdog 测试不受影响**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_file_watcher_status.py tests/web_v2/test_deps.py -q`
Expected: passed（不传 force 仍增量）

- [ ] **Step 6: Commit**

```bash
git add doclens/index_manager.py tests/web_v2/test_reindex_trigger.py
git commit -m "feat(index_manager): trigger_background_reindex 支持 force 全量与 on_progress 回调"
```

---

### Task 2: POST /api/reindex SSE 端点

**Files:**
- Create: `doclens/web_v2/api/reindex.py`
- Modify: `doclens/web_v2/app.py`（挂载 router）
- Test: `tests/web_v2/test_reindex_api.py`（新建）

**Interfaces:**
- Consumes: `idx.trigger_background_reindex(force=True, on_progress, on_complete)`（Task 1）。
- Produces: `POST /api/reindex` → SSE 流，事件 `progress` `{current_file, indexed_count}` / `done` `{success, doc_count, failed_count}` / `error` `{detail}`。

- [ ] **Step 1: 写失败测试**

新建 `tests/web_v2/test_reindex_api.py`：

```python
"""POST /api/reindex SSE 测试。"""
import asyncio
import threading

import pytest
from httpx import ASGITransport, AsyncClient

from doclens.web_v2 import deps
from doclens.web_v2.app import create_app


@pytest.fixture
def reset_deps():
    deps.reset_singletons()
    yield
    deps.reset_singletons()


def _init():
    return deps.get_index_manager()


@pytest.mark.asyncio
async def test_reindex_streams_progress_then_done(env_cortex_config, reset_deps, temp_workdir, monkeypatch):
    await asyncio.to_thread(_init)
    idx = deps.get_index_manager()

    captured = {}

    def fake_trigger(force=False, on_progress=None, on_complete=None):
        captured["force"] = force

        def _bg():
            # 模拟后台进度 + 完成
            if on_progress:
                on_progress("/tmp/a.md", 1)
                on_progress("/tmp/b.md", 2)
            if on_complete:
                on_complete(True, 2, 0)

        threading.Thread(target=_bg, daemon=True).start()
        return None

    monkeypatch.setattr(idx, "trigger_background_reindex", fake_trigger)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/reindex")

    assert res.status_code == 200
    assert captured["force"] is True  # force=True 透传
    body = res.text
    assert "progress" in body
    assert "done" in body
    assert "current_file" in body
    assert "doc_count" in body


@pytest.mark.asyncio
async def test_reindex_streams_error_on_failure(env_cortex_config, reset_deps, temp_workdir, monkeypatch):
    await asyncio.to_thread(_init)
    idx = deps.get_index_manager()

    def fake_trigger(force=False, on_progress=None, on_complete=None):
        def _bg():
            if on_complete:
                on_complete(False, 0, 0)
        threading.Thread(target=_bg, daemon=True).start()
        return None

    monkeypatch.setattr(idx, "trigger_background_reindex", fake_trigger)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/reindex")

    assert res.status_code == 200
    assert "done" in res.text
    assert '"success": false' in res.text
```

- [ ] **Step 2: 运行验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_reindex_api.py -v`
Expected: FAIL（404，路由不存在）

- [ ] **Step 3: 新建 `doclens/web_v2/api/reindex.py`**

```python
"""POST /api/reindex —— 强制全量重建索引，SSE 流式返回进度。"""
import asyncio
import json
import logging
import os
import queue as _queue

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from doclens.index_manager import IndexManager
from doclens.web_v2.deps import get_index_manager

logger = logging.getLogger(__name__)
router = APIRouter()

_SSE_TIMEOUT_SECONDS = 600


@router.post("/reindex")
async def force_reindex(idx: IndexManager = Depends(get_index_manager)):
    """启动 force=True 全量重建，SSE 推送 progress / done / error 事件。"""
    q: _queue.Queue = _queue.Queue()
    loop = asyncio.get_event_loop()

    def on_progress(file_path: str, n: int):
        q.put_nowait({
            "event": "progress",
            "data": {"current_file": os.path.basename(file_path), "indexed_count": n},
        })

    def on_complete(success: bool, doc_count: int, failed_count: int):
        q.put_nowait({
            "event": "done",
            "data": {"success": success, "doc_count": doc_count, "failed_count": failed_count},
        })

    idx.trigger_background_reindex(force=True, on_progress=on_progress, on_complete=on_complete)

    async def event_stream():
        while True:
            try:
                item = await asyncio.wait_for(
                    loop.run_in_executor(None, q.get), timeout=_SSE_TIMEOUT_SECONDS
                )
            except asyncio.TimeoutError:
                yield {"event": "error", "data": json.dumps({"detail": "timeout"}, ensure_ascii=False)}
                break
            yield {"event": item["event"], "data": json.dumps(item["data"], ensure_ascii=False)}
            if item["event"] in ("done", "error"):
                break

    return EventSourceResponse(event_stream())
```

- [ ] **Step 4: 在 `app.py` 挂载 router**

`create_app()` 路由区（`watch.router` 之后）加：

```python
    from doclens.web_v2.api import reindex
    app.include_router(reindex.router, prefix="/api")
```

- [ ] **Step 5: 运行验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_reindex_api.py -v`
Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add doclens/web_v2/api/reindex.py doclens/web_v2/app.py tests/web_v2/test_reindex_api.py
git commit -m "feat(web_v2): 新增 POST /api/reindex SSE 强制全量重建端点"
```

---

### Task 3: 前端 types + store reindex 切片

**Files:**
- Modify: `frontend/src/state/types.ts`、`frontend/src/state/store.ts`
- Test: `frontend/tests/store-reindex.spec.ts`（新建）

**Interfaces:**
- Produces: `ReindexState`/`ReindexResult` 类型；`actions.openReindexConfirm/startReindex/setReindexProgress/finishReindex/failReindex/closeReindex`。Task 5/6 依赖。

- [ ] **Step 1: 写失败测试**

新建 `frontend/tests/store-reindex.spec.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import type { ReindexState } from "../src/state/types";

const FRESH: ReindexState = {
  dialog: "closed", current_file: null, indexed_count: 0, result: null, error: null,
};

describe("reindex store slice", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE, reindex: { ...FRESH } });
  });

  it("starts closed", () => {
    expect(store.getState().reindex.dialog).toBe("closed");
  });

  it("openReindexConfirm → confirm", () => {
    actions.openReindexConfirm();
    expect(store.getState().reindex.dialog).toBe("confirm");
  });

  it("startReindex resets progress and sets running", () => {
    actions.openReindexConfirm();
    actions.startReindex();
    const r = store.getState().reindex;
    expect(r.dialog).toBe("running");
    expect(r.indexed_count).toBe(0);
    expect(r.result).toBeNull();
  });

  it("setReindexProgress updates only when running", () => {
    actions.startReindex();
    actions.setReindexProgress({ current_file: "a.md", indexed_count: 3 });
    expect(store.getState().reindex).toMatchObject({ current_file: "a.md", indexed_count: 3 });
    // 非 running 阶段忽略
    actions.finishReindex({ success: true, doc_count: 5, failed_count: 0 });
    actions.setReindexProgress({ current_file: "x.md", indexed_count: 9 });
    expect(store.getState().reindex.current_file).toBe("a.md");
  });

  it("finishReindex → done with result", () => {
    actions.startReindex();
    actions.finishReindex({ success: true, doc_count: 7, failed_count: 1 });
    const r = store.getState().reindex;
    expect(r.dialog).toBe("done");
    expect(r.result).toEqual({ success: true, doc_count: 7, failed_count: 1 });
  });

  it("failReindex → error", () => {
    actions.startReindex();
    actions.failReindex("boom");
    expect(store.getState().reindex).toMatchObject({ dialog: "error", error: "boom" });
  });

  it("closeReindex resets to closed", () => {
    actions.finishReindex({ success: true, doc_count: 1, failed_count: 0 });
    actions.closeReindex();
    expect(store.getState().reindex).toEqual(FRESH);
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/store-reindex.spec.ts`
Expected: FAIL（`ReindexState` 不存在 / actions 未定义）

- [ ] **Step 3: 改 `frontend/src/state/types.ts`**

在 `WatcherStatus` 之后新增：

```typescript
export interface ReindexResult { success: boolean; doc_count: number; failed_count: number; }

export interface ReindexState {
  dialog: "closed" | "confirm" | "running" | "done" | "error";
  current_file: string | null;
  indexed_count: number;
  result: ReindexResult | null;
  error: string | null;
}
```

在 `AppState` 加字段（紧接 `watcher` 之后）：

```typescript
  watcher: WatcherStatus | null;
  reindex: ReindexState;
```

- [ ] **Step 4: 改 `frontend/src/state/store.ts`**

在 `INITIAL_STATE`（`watcher: null,` 之后）加：

```typescript
  watcher: null,
  reindex: { dialog: "closed", current_file: null, indexed_count: 0, result: null, error: null },
```

在 `actions` 对象（`setWatcherStatus` 之后）加 6 个 action：

```typescript
  openReindexConfirm() {
    const r = store.getState().reindex;
    store.setState({ reindex: { ...r, dialog: "confirm" } });
  },

  startReindex() {
    store.setState({
      reindex: {
        ...store.getState().reindex,
        dialog: "running", current_file: null, indexed_count: 0, result: null, error: null,
      },
    });
  },

  setReindexProgress(p: { current_file: string; indexed_count: number }) {
    const r = store.getState().reindex;
    if (r.dialog !== "running") return;
    store.setState({ reindex: { ...r, current_file: p.current_file, indexed_count: p.indexed_count } });
  },

  finishReindex(res: { success: boolean; doc_count: number; failed_count: number }) {
    store.setState({ reindex: { ...store.getState().reindex, dialog: "done", result: res } });
  },

  failReindex(msg: string) {
    store.setState({ reindex: { ...store.getState().reindex, dialog: "error", error: msg } });
  },

  closeReindex() {
    store.setState({
      reindex: { dialog: "closed", current_file: null, indexed_count: 0, result: null, error: null },
    });
  },
```

- [ ] **Step 5: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/store-reindex.spec.ts`
Expected: 7 passed

- [ ] **Step 6: Commit**

```bash
git add doclens/web_v2/frontend/src/state/types.ts doclens/web_v2/frontend/src/state/store.ts doclens/web_v2/frontend/tests/store-reindex.spec.ts
git commit -m "feat(web): store 新增 reindex 切片与 6 个状态机 action"
```

---

### Task 4: api/client.ts streamSSE 加 signal 参数

**Files:**
- Modify: `frontend/src/api/client.ts`（`streamSSE` 函数）
- Test: `frontend/tests/api-client-sse-signal.spec.ts`（新建）

**Interfaces:**
- Produces: `streamSSE(path, body, signal?)` —— `signal` 透传给 `fetch`。Task 5 用 signal 中断。

- [ ] **Step 1: 写失败测试**

新建 `frontend/tests/api-client-sse-signal.spec.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { streamSSE } from "../src/api/client";

describe("streamSSE signal passthrough", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes signal to fetch when provided", async () => {
    const ctrl = new AbortController();
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
    });

    try {
      for await (const _ev of streamSSE("/api/x", {}, ctrl.signal)) { void _ev; break; }
    } catch { /* aborted/empty ok */ }

    const callInit = (globalThis.fetch as any).mock.calls[0][1] as RequestInit;
    expect(callInit.signal).toBe(ctrl.signal);
  });

  it("omits signal when not provided (no regression)", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
    });
    try {
      for await (const _ev of streamSSE("/api/x", {})) { void _ev; break; }
    } catch { /* ok */ }
    const callInit = (globalThis.fetch as any).mock.calls[0][1] as RequestInit;
    expect(callInit.signal).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/api-client-sse-signal.spec.ts`
Expected: FAIL（`callInit.signal` undefined —— 当前 streamSSE 不接收 signal）

- [ ] **Step 3: 改 `frontend/src/api/client.ts`**

把 `streamSSE` 签名与 fetch 调用改为：

```typescript
export async function* streamSSE(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<{ event: string; data: string }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, "stream_failed", "流式请求失败");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    while (true) {
      const m = buffer.match(/\r\n\r\n|\r\r|\n\n/);
      if (!m || m.index === undefined) break;
      const idx = m.index;
      const sepLen = m[0].length;
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + sepLen);
      let event = "message";
      let data = "";
      for (const line of rawEvent.split(/\r\n|\r|\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      yield { event, data };
    }
  }
}
```

- [ ] **Step 4: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/api-client-sse-signal.spec.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/frontend/src/api/client.ts doclens/web_v2/frontend/tests/api-client-sse-signal.spec.ts
git commit -m "feat(web): streamSSE 支持可选 AbortSignal 透传"
```

---

### Task 5: reindex-dialog 组件（4 阶段 + SSE）

**Files:**
- Create: `frontend/src/components/reindex-dialog.ts`
- Test: `frontend/tests/reindex-dialog.spec.ts`（新建）

**Interfaces:**
- Consumes: `store.reindex` + `actions`（Task 3）、`streamSSE(path, body, signal)`（Task 4）。
- Produces: `<reindex-dialog>` 自定义元素，订阅 `store.reindex.dialog` 显示 4 阶段。

- [ ] **Step 1: 写失败测试**

新建 `frontend/tests/reindex-dialog.spec.ts`：

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

vi.mock("../src/api/client", () => ({
  streamSSE: vi.fn(),
  ApiError: class extends Error {},
}));

import "../src/components/reindex-dialog";
import type { ReindexDialog } from "../src/components/reindex-dialog";
import { actions, store, INITIAL_STATE } from "../src/state/store";
import { streamSSE } from "../src/api/client";

function makeStream(events: { event: string; data: string }[]) {
  return async function* () {
    for (const e of events) yield e;
  };
}

describe("<reindex-dialog>", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE, reindex: { ...INITIAL_STATE.reindex } });
    (streamSSE as any).mockReset();
  });

  it("renders nothing when closed", async () => {
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector("dialog[open]")).toBeNull();
  });

  it("confirm stage shows warning + buttons", async () => {
    actions.openReindexConfirm();
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.textContent).toContain("强制重建索引");
    expect(el.shadowRoot?.querySelectorAll("button").length).toBeGreaterThanOrEqual(2);
  });

  it("confirm → start streams SSE and reaches done", async () => {
    (streamSSE as any).mockImplementation(makeStream([
      { event: "progress", data: JSON.stringify({ current_file: "a.md", indexed_count: 1 }) },
      { event: "done", data: JSON.stringify({ success: true, doc_count: 2, failed_count: 0 }) },
    ]));
    actions.openReindexConfirm();
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    const confirmBtn = Array.from(el.shadowRoot!.querySelectorAll("button"))
      .find((b) => (b.textContent || "").includes("确认重建")) as HTMLButtonElement;
    confirmBtn.click();
    // 等待 async streamSSE 完成
    await new Promise((r) => setTimeout(r, 50));
    await elementUpdated(el);
    expect(store.getState().reindex.dialog).toBe("done");
    expect(store.getState().reindex.result?.doc_count).toBe(2);
  });

  it("progress event updates running stage", async () => {
    (streamSSE as any).mockImplementation(makeStream([
      { event: "progress", data: JSON.stringify({ current_file: "b.md", indexed_count: 5 }) },
    ]));
    actions.openReindexConfirm();
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    (Array.from(el.shadowRoot!.querySelectorAll("button"))
      .find((b) => (b.textContent || "").includes("确认重建")) as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50));
    await elementUpdated(el);
    expect(store.getState().reindex.indexed_count).toBe(5);
    expect(el.shadowRoot?.textContent).toContain("5");
  });

  it("error event → error stage", async () => {
    (streamSSE as any).mockImplementation(makeStream([
      { event: "error", data: JSON.stringify({ detail: "boom" }) },
    ]));
    actions.openReindexConfirm();
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    (Array.from(el.shadowRoot!.querySelectorAll("button"))
      .find((b) => (b.textContent || "").includes("确认重建")) as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50));
    await elementUpdated(el);
    expect(store.getState().reindex.dialog).toBe("error");
    expect(store.getState().reindex.error).toBe("boom");
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/reindex-dialog.spec.ts`
Expected: FAIL（`<reindex-dialog>` 未注册 / 模块不存在）

- [ ] **Step 3: 新建 `frontend/src/components/reindex-dialog.ts`**

```typescript
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { ReindexState } from "../state/types";
import { streamSSE } from "../api/client";
import "../components/toast-stack";
import type { ToastStack } from "../components/toast-stack";

@customElement("reindex-dialog")
export class ReindexDialog extends LitElement {
  static styles = css`
    :host { display: block; min-width: 360px; }
    h3 { margin: 0 0 var(--cortex-space-3) 0; font-size: var(--cortex-fs-md); }
    .body { font-size: var(--cortex-fs-sm); color: var(--cortex-text); line-height: 1.6; }
    .progress {
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted); margin-top: var(--cortex-space-2);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2); margin-top: var(--cortex-space-4);
    }
    button {
      padding: 6px 16px; border: 1px solid var(--cortex-border);
      background: var(--cortex-surface); cursor: pointer;
      border-radius: var(--cortex-radius-sm); font-size: var(--cortex-fs-base);
    }
    button.primary { background: var(--cortex-primary); color: #fff; border-color: var(--cortex-primary); }
    button.warn { background: var(--cortex-danger); color: #fff; border-color: var(--cortex-danger); }
    dialog {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      padding: 0; background: var(--cortex-surface);
      box-shadow: 0 12px 32px rgba(0,0,0,0.12);
      min-width: 360px; max-width: 90vw;
    }
    dialog::backdrop { background: rgba(0,0,0,0.3); }
    dialog > * { display: block; padding: var(--cortex-space-6); }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      dialog {
        min-width: 0; width: calc(100vw - 16px); max-width: calc(100vw - 16px);
        max-height: calc(100vh - 16px);
      }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;

  private _abort: AbortController | null = null;
  private _unsub?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = store.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    this._abort?.abort();
    this._unsub?.();
    super.disconnectedCallback();
  }

  private _pushToast(message: string, level: "success" | "error" | "info" = "info", duration = 2500) {
    const stack = this.shadowRoot?.querySelector("toast-stack") as ToastStack | null;
    stack?.pushToast(message, level, duration);
  }

  private _confirm() {
    actions.startReindex();
    void this._runReindex();
  }

  private _close() {
    this._abort?.abort();
    actions.closeReindex();
  }

  private async _runReindex(): Promise<void> {
    this._abort = new AbortController();
    try {
      for await (const ev of streamSSE("/api/reindex", {}, this._abort.signal)) {
        if (this._abort.signal.aborted) break;
        if (ev.event === "progress") {
          const d = JSON.parse(ev.data);
          actions.setReindexProgress({ current_file: d.current_file, indexed_count: d.indexed_count });
        } else if (ev.event === "done") {
          const d = JSON.parse(ev.data);
          actions.finishReindex({ success: d.success, doc_count: d.doc_count, failed_count: d.failed_count });
          this._pushToast(`索引重建完成：${d.doc_count} 文档`, "success", 3000);
          break;
        } else if (ev.event === "error") {
          const d = JSON.parse(ev.data);
          actions.failReindex(d.detail || "重建失败");
          break;
        }
      }
    } catch (e) {
      if (!this._abort?.signal.aborted) {
        actions.failReindex((e as Error).message || "重建失败");
      }
    }
  }

  private _renderBody(r: ReindexState) {
    if (r.dialog === "confirm") {
      return html`
        <h3>🔄 强制重建索引</h3>
        <div class="body">⚠️ 将清空当前索引并全量重扫工作目录，期间（数十秒）搜索结果可能不完整。是否继续？</div>
        <div class="actions">
          <button @click=${() => actions.closeReindex()}>取消</button>
          <button class="warn" @click=${this._confirm}>确认重建</button>
        </div>
      `;
    }
    if (r.dialog === "running") {
      return html`
        <h3>⟳ 正在重建索引…</h3>
        <div class="body">已索引 <strong>${r.indexed_count}</strong> 个文件</div>
        ${r.current_file ? html`<div class="progress">当前：${r.current_file}</div>` : ""}
        <div class="actions">
          <button @click=${this._close}>关闭（后台继续）</button>
        </div>
      `;
    }
    if (r.dialog === "done") {
      const res = r.result;
      return html`
        <h3>✅ 重建完成</h3>
        <div class="body">
          共索引 <strong>${res?.doc_count ?? 0}</strong> 个文档
          ${res && res.failed_count > 0 ? html`<br />· ${res.failed_count} 个文件失败` : ""}
        </div>
        <div class="actions">
          <button class="primary" @click=${this._close}>关闭</button>
        </div>
      `;
    }
    return html`
      <h3>⚠️ 重建失败</h3>
      <div class="body">${r.error || "未知错误"}</div>
      <div class="actions">
        <button class="primary" @click=${this._close}>关闭</button>
      </div>
    `;
  }

  render() {
    const r = store.getState().reindex;
    if (r.dialog === "closed") return html`<toast-stack></toast-stack>`;
    return html`
      <dialog open>${this._renderBody(r)}</dialog>
      <toast-stack></toast-stack>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "reindex-dialog": ReindexDialog; }
}
```

- [ ] **Step 4: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/reindex-dialog.spec.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/frontend/src/components/reindex-dialog.ts doclens/web_v2/frontend/tests/reindex-dialog.spec.ts
git commit -m "feat(web): 新增 reindex-dialog 4 阶段组件（确认/进行/完成/错误 + SSE）"
```

---

### Task 6: app-bar 菜单项

**Files:**
- Modify: `frontend/src/components/app-bar.ts`（`user-menu` 加菜单项 + `_onReindexClick`）
- Test: `frontend/tests/app-bar.spec.ts`（追加）

**Interfaces:**
- Consumes: `actions.openReindexConfirm()`（Task 3）。
- Produces：菜单项 click → `store.reindex.dialog === "confirm"`。

- [ ] **Step 1: 追加失败测试**

在 `frontend/tests/app-bar.spec.ts` 末尾追加：

```typescript
describe("<app-bar> reindex menu item", () => {
  it("renders 强制重建索引 menu item", async () => {
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);
    const labels = Array.from(el.shadowRoot?.querySelectorAll(".menu-item") ?? [])
      .map((i) => i.textContent ?? "");
    expect(labels.some((l) => l.includes("强制重建索引"))).toBe(true);
  });

  it("clicking reindex menu opens confirm dialog (store)", async () => {
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);
    const btn = Array.from(el.shadowRoot?.querySelectorAll(".menu-item") ?? [])
      .find((b) => (b.textContent ?? "").includes("强制重建索引")) as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);
    expect(store.getState().reindex.dialog).toBe("confirm");
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/app-bar.spec.ts`
Expected: 新 2 测试 FAIL（无「强制重建索引」菜单项）；预存 2 navigate 失败不变。

- [ ] **Step 3: 改 `frontend/src/components/app-bar.ts`**

(a) import 区确保有 `actions`（若已 import `store` 则补 `actions`）：

```typescript
import { store, actions } from "../state/store";
```

(b) 加 `_onReindexClick` 方法（与其他 `_onXxxClick` 同级）：

```typescript
  private _onReindexClick() {
    this._menuOpen = false;
    actions.openReindexConfirm();
  }
```

(c) 在 `render()` 的 `user-menu` 内「全局配置」menu-item 之后插入：

```html
          <button class="menu-item" type="button" @click=${this._onReindexClick}>
            <span class="icon">🔄</span>
            <span class="text">
              <span class="label">强制重建索引</span>
              <span class="desc">全量重扫工作目录</span>
            </span>
          </button>
```

- [ ] **Step 4: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/app-bar.spec.ts`
Expected: 新 2 测试通过；预存 2 navigate 失败不变。

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/frontend/src/components/app-bar.ts doclens/web_v2/frontend/tests/app-bar.spec.ts
git commit -m "feat(web): app-bar 下拉菜单新增强制重建索引入口"
```

---

### Task 7: app.ts 挂载 + 重建产物 + 冒烟

**Files:**
- Modify: `frontend/src/app.ts`（import + render `<reindex-dialog>`）
- 产物：`doclens/web_v2/static/`（`npm run build`）

- [ ] **Step 1: 改 `frontend/src/app.ts`**

import 区加（与其他 `./components/...` 同级）：

```typescript
import "./components/reindex-dialog";
```

`render()` 末尾（`</div>` 闭合 `.app-body` 之后）加：

```typescript
      <reindex-dialog></reindex-dialog>
```

完整 `render()` 末尾示意：
```typescript
        <tab-bar .active=${view} @navigate=${this._navigate}></tab-bar>
      </div>
      <reindex-dialog></reindex-dialog>
    `;
  }
```

- [ ] **Step 2: 前端构建（tsc + vite）**

Run:
```bash
cd doclens/web_v2/frontend && npm run build
```
Expected: `tsc --noEmit` 无错 + `✓ built`。**若 tsc 报未用 import 等，修复后重跑**（watchdog 的教训：vitest 过 ≠ tsc 过）。

- [ ] **Step 3: 前端全量 vitest 回归（区分预存失败）**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/reindex-dialog.spec.ts tests/store-reindex.spec.ts tests/api-client-sse-signal.spec.ts tests/app-bar.spec.ts`
Expected: 本次新测试全过（app-bar 预存 2 navigate 失败不变）。

- [ ] **Step 4: 后端全量回归（本次 + 跳过预存 collection error）**

Run:
```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_reindex_trigger.py tests/web_v2/test_reindex_api.py tests/web_v2/test_watch_api.py tests/web_v2/test_status_api.py tests/doclens/test_file_watcher_status.py -q
```
Expected: 全 passed。

- [ ] **Step 5: 提交**

```bash
git add doclens/web_v2/frontend/src/app.ts doclens/web_v2/static
git commit -m "feat(web): cortex-app 挂载 reindex-dialog 并重建前端产物"
```

- [ ] **Step 6: 手动冒烟（可选，用户在终端执行）**

```
! pwsh -File ./start-app.ps1 gui
```
浏览器打开后，点头像 → 「强制重建索引」→ 确认 → 观察对话框「已索引 N · 当前 x.md」递增 → 完成弹 toast。移动端窄屏验证对话框全宽 + 按钮全宽。

---

## Self-Review 记录

**Spec 覆盖核对：**
- `trigger_background_reindex(force, on_progress)` 扩展 → Task 1 ✅
- `POST /api/reindex` SSE（progress/done/error） → Task 2 ✅
- `app.py` 挂载 → Task 2 Step 4 ✅
- `ReindexState` + `AppState.reindex` + 6 actions → Task 3 ✅
- `streamSSE` 加 signal → Task 4 ✅
- `reindex-dialog` 4 阶段 + SSE + abort + 内嵌 toast-stack + 移动端 CSS → Task 5 ✅
- app-bar 菜单项 → Task 6 ✅
- `app.ts` 挂载 `<reindex-dialog>` → Task 7 ✅
- `npm run build` → Task 7 ✅
- 已知限制（不中断/角标不同步/无百分比/单用户）→ 记录在 spec，无需任务实现

**类型一致性：** `ReindexState` 字段（`dialog`/`current_file`/`indexed_count`/`result`/`error`）、`ReindexResult`（`success`/`doc_count`/`failed_count`）、SSE 事件名（`progress`/`done`/`error`）、6 个 action 名——在 Task 1（后端 on_progress/on_complete 签名）↔ Task 2（SSE data 字段）↔ Task 3（store/types）↔ Task 5（dialog 解析 + actions 调用）全部一致。`streamSSE(path, body, signal?)` 签名贯穿 Task 4↔Task 5。

**Placeholder 扫描：** 无 TBD/TODO；每步含可执行代码与命令。
