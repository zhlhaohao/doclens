# Welcome Pane 统一状态区 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在共享的 `<welcome-pane>` 加"系统状态区"统一显示 6 项（工作目录/索引文档数/监控状态/索引大小/上次重建/类型分布），移除 app-bar 的 `watch-badge`，激活 `/api/status` 数据流并补 `search_path`。

**Architecture:** 后端 `/api/status` 增 `search_path`；前端 `watch-polling` 在启动与 reindex 完成时调 `getStatus()` 写 `store.status`；`welcome-pane` 订阅 `store.status + store.watcher` 渲染 4 行状态区（分组列表）；`app-bar` 移除 `watch-badge`、保留 reindex 完成的 toast。

**Tech Stack:** Python 3 / FastAPI / pytest / httpx（后端）；TypeScript / Lit / vitest / @open-wc/testing（前端）。

## Global Constraints

- Python：PEP 8 + 类型注解；不可变更新；`logging` 不 `print`；文件 <800 行。
- TS：spread 不可变更新；禁止 `console.log`；`disconnectedCallback` 清理订阅。
- 后端测试：pytest，`tests/web_v2/`，`ASGITransport` + `AsyncClient`，索引初始化在 `asyncio.to_thread` 子线程。fixtures `temp_workdir` / `env_cortex_config` / `reset_deps` 已存在于 `conftest.py`。
- 前端测试：vitest + @open-wc/testing（`frontend/tests/`）。**vitest 过 ≠ `tsc --noEmit` 过**——提交前确认无未用 import / 类型错。
- 改前端后必须 `npm run build`（CLAUDE.md 要求，产物 `doclens/web_v2/static/`）。
- Commit message：中文 `<type>: <desc>`，**禁止 `Co-Authored-By`**。
- **环境前置**：本 worktree（`0711-2`）无 `.venv` 和 `node_modules`。后端命令用 `../cortex/.venv/Scripts/python.exe`；前端命令在 `doclens/web_v2/frontend` 跑（若 `node_modules` 缺，先 `npm install`，或切到 `../cortex` worktree 的 frontend 跑）。仓库根：`C:\Users\lianghao\github\0711-2`。
- `last_reindex_at` 来自 `file_watcher.py` 的 `time.time()`，**秒级浮点 Unix 时间戳**。

## File Structure

**后端**
- `doclens/web_v2/api/status.py`（改）：返回 dict 加 `search_path`。
- `tests/web_v2/test_status_api.py`（改）：加 `search_path` 断言。

**前端**
- `frontend/src/state/types.ts`（改）：`SystemStatus` 加 `search_path: string`。
- `frontend/src/state/store.ts`（改）：加 `setStatus` action。
- `frontend/src/utils/format.ts`（新）：`formatBytes` / `formatRelative` / `truncatePathMiddle` / `summarizeFileTypes` 纯函数。
- `frontend/src/watch-polling.ts`（改）：加 `refreshStatus`，启动 + reindex 完成时调。
- `frontend/src/components/welcome-pane.ts`（改）：订阅 store，加状态区 `_renderStatus`。
- `frontend/src/components/app-bar.ts`（改）：移除 `_renderWatchBadge` + `.watch-badge*` CSS + render 调用。
- `frontend/tests/store-status.spec.ts`（新）、`format.spec.ts`（新）、`welcome-pane.spec.ts`（新）；`watch-polling.spec.ts` / `app-bar.spec.ts`（改）。

---

### Task 1: 后端 `/api/status` 加 `search_path`

**Files:**
- Modify: `doclens/web_v2/api/status.py`
- Test: `tests/web_v2/test_status_api.py`

**Interfaces:**
- Produces: `GET /api/status` 响应新增 `search_path: str`（= `idx.search_path`）。Task 2 的 `SystemStatus` 类型依赖此字段。

- [ ] **Step 1: 写失败测试**

在 `tests/web_v2/test_status_api.py` 末尾追加：

```python
@pytest.mark.asyncio
async def test_status_includes_search_path(env_cortex_config, reset_deps, temp_workdir):
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/status")

    body = res.json()
    assert "search_path" in body
    assert body["search_path"] == str(idx.search_path)
```

- [ ] **Step 2: 运行验证失败**

Run: `../cortex/.venv/Scripts/python.exe -m pytest tests/web_v2/test_status_api.py::test_status_includes_search_path -v`
Expected: FAIL（`KeyError: 'search_path'`）

- [ ] **Step 3: 改 `doclens/web_v2/api/status.py`**

在 `status()` 返回 dict 的**第一项**加 `search_path`（`indexed_docs` 之前）：

```python
    return {
        "search_path": str(idx.search_path),
        "indexed_docs": len(docs),
        "index_path": str(idx.index_path),
        "total_size_bytes": total_size,
        "file_types": type_counts,
        "watcher": {
            "enabled": get_config().watch_enabled,
            **(watcher_obj.status() if watcher_obj is not None else {
                "running": False,
                "reindexing": False,
                "changed_count": 0,
                "last_reindex_at": None,
                "last_doc_count": None,
                "last_success": None,
            }),
        },
    }
```

- [ ] **Step 4: 运行验证通过**

Run: `../cortex/.venv/Scripts/python.exe -m pytest tests/web_v2/test_status_api.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/api/status.py tests/web_v2/test_status_api.py
git commit -m "feat(web_v2): /api/status 返回 search_path 工作目录"
```

---

### Task 2: 前端 `SystemStatus` 类型 + `setStatus` action

**Files:**
- Modify: `frontend/src/state/types.ts`、`frontend/src/state/store.ts`
- Test: `frontend/tests/store-status.spec.ts`（新）

**Interfaces:**
- Produces: `SystemStatus.search_path: string`；`actions.setStatus(s: SystemStatus): void`。Task 4（watch-polling）与 Task 5（welcome-pane）依赖。
- Consumes: Task 1 的 `/api/status` 响应字段。

- [ ] **Step 1: 写失败测试**

新建 `frontend/tests/store-status.spec.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import type { SystemStatus } from "../src/state/types";

const STATUS: SystemStatus = {
  search_path: "C:/kb",
  indexed_docs: 3,
  index_path: "C:/kb/.cortex/index.db",
  total_size_bytes: 1024,
  file_types: { ".md": 3 },
  watcher: null,
};

describe("status store slice", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE });
  });

  it("setStatus writes status", () => {
    actions.setStatus(STATUS);
    expect(store.getState().status).toEqual(STATUS);
  });

  it("setStatus replaces (not merges) status", () => {
    actions.setStatus(STATUS);
    actions.setStatus({ ...STATUS, indexed_docs: 10 });
    expect(store.getState().status?.indexed_docs).toBe(10);
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/store-status.spec.ts`
Expected: FAIL（`actions.setStatus is not a function`）

- [ ] **Step 3a: 改 `frontend/src/state/types.ts`**

`SystemStatus` 接口加 `search_path`（`indexed_docs` 之前）：

```typescript
export interface SystemStatus {
  search_path: string;
  indexed_docs: number;
  index_path: string;
  total_size_bytes: number;
  file_types: Record<string, number>;
  watcher?: WatcherStatus | null;
}
```

- [ ] **Step 3b: 改 `frontend/src/state/store.ts`**

在 `actions` 对象的 `setWatcherStatus` 之后加 `setStatus`：

```typescript
  setWatcherStatus(w: AppState["watcher"]) {
    store.setState({ watcher: w });
  },

  setStatus(s: AppState["status"]) {
    store.setState({ status: s });
  },
```

（`api/status.ts` 的 `getStatus()` 返回类型已是 `SystemStatus`，字段自动跟进，无需改。）

- [ ] **Step 4: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/store-status.spec.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/frontend/src/state/types.ts doclens/web_v2/frontend/src/state/store.ts doclens/web_v2/frontend/tests/store-status.spec.ts
git commit -m "feat(web): store 新增 setStatus action 与 SystemStatus.search_path"
```

---

### Task 3: `utils/format.ts` 格式化工具

**Files:**
- Create: `frontend/src/utils/format.ts`
- Test: `frontend/tests/format.spec.ts`（新）

**Interfaces:**
- Produces: `formatBytes(b) / formatRelative(ts) / truncatePathMiddle(p, keepSegments?) / summarizeFileTypes(ft, top?)`。Task 5（welcome-pane）依赖。

- [ ] **Step 1: 写失败测试**

新建 `frontend/tests/format.spec.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatBytes, formatRelative, truncatePathMiddle, summarizeFileTypes,
} from "../src/utils/format";

describe("formatBytes", () => {
  it("formats B / KB / MB / GB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
    expect(formatBytes(1073741824)).toBe("1 GB");
  });
});

describe("formatRelative", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(100000 * 1000)); });
  afterEach(() => { vi.useRealTimers(); });

  it("formats intervals from seconds (ts is seconds)", () => {
    expect(formatRelative(100000)).toBe("刚刚");              // 0 diff
    expect(formatRelative(100000 - 30)).toBe("刚刚");         // 30s
    expect(formatRelative(100000 - 120)).toBe("2 分钟前");    // 2min
    expect(formatRelative(100000 - 3600)).toBe("1 小时前");   // 1h
    expect(formatRelative(100000 - 86400)).toBe("1 天前");    // 1d
  });

  it("returns null for null ts", () => {
    expect(formatRelative(null)).toBeNull();
  });
});

describe("truncatePathMiddle", () => {
  it("keeps last 2 segments with … prefix when long", () => {
    const r = truncatePathMiddle("C:/a/b/c/test_work_dir");
    expect(r.text).toBe("…/c/test_work_dir");
    expect(r.title).toBe("C:/a/b/c/test_work_dir");
  });

  it("returns as-is when <= 2 segments", () => {
    expect(truncatePathMiddle("test_work_dir").text).toBe("test_work_dir");
    expect(truncatePathMiddle("cortex/test_work_dir").text).toBe("cortex/test_work_dir");
  });

  it("handles backslash separators", () => {
    const r = truncatePathMiddle("C:\\a\\b\\c\\dir");
    expect(r.text).toBe("…/c/dir");
  });

  it("returns — for empty", () => {
    expect(truncatePathMiddle("").text).toBe("—");
  });
});

describe("summarizeFileTypes", () => {
  it("top 3 desc + +N", () => {
    expect(summarizeFileTypes({ ".md": 30, ".pdf": 12, ".docx": 8, ".py": 3, ".txt": 1 }))
      .toBe(".md 30 · .pdf 12 · .docx 8 · +2");
  });

  it("no remainder when <= top", () => {
    expect(summarizeFileTypes({ ".md": 5, ".pdf": 2 })).toBe(".md 5 · .pdf 2");
  });

  it("empty → —", () => {
    expect(summarizeFileTypes({})).toBe("—");
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/format.spec.ts`
Expected: FAIL（`Cannot find module '../src/utils/format'`）

- [ ] **Step 3: 新建 `frontend/src/utils/format.ts`**

```typescript
/** welcome-pane 状态区格式化工具（纯函数）。 */

/** 字节数 → 人类可读（B/KB/MB/GB），<10 保留 1 位小数。 */
export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${fmt(b / 1024)} KB`;
  if (b < 1024 * 1024 * 1024) return `${fmt(b / (1024 * 1024))} MB`;
  return `${fmt(b / (1024 * 1024 * 1024))} GB`;
}
function fmt(n: number): string {
  return n < 10 ? n.toFixed(1) : String(Math.round(n));
}

/** 秒级 Unix 时间戳 → 相对时间；null → null。 */
export function formatRelative(ts: number | null | undefined): string | null {
  if (ts == null) return null;
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return new Date(ts * 1000).toISOString().slice(0, 10).replace(/-/g, "/");
}

/** 路径中段省略：保留最后 keepSegments 段，前缀以 … ；空 → "—"。
 *  同时兼容 / 与 \ 分隔符，输出统一用 / 连接。title 始终为原始路径。 */
export function truncatePathMiddle(
  p: string,
  keepSegments = 2,
): { text: string; title: string } {
  if (!p) return { text: "—", title: p };
  const segs = p.split(/[/\\]+/).filter((s) => s.length > 0);
  if (segs.length <= keepSegments) return { text: segs.join("/"), title: p };
  const tail = segs.slice(-keepSegments).join("/");
  return { text: `…/${tail}`, title: p };
}

/** 文件类型分布 → "前 top 高亮 · +N" 字符串；空 → "—"。 */
export function summarizeFileTypes(ft: Record<string, number>, top = 3): string {
  const entries = Object.entries(ft).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "—";
  const head = entries.slice(0, top).map(([ext, n]) => `${ext} ${n}`).join(" · ");
  const rest = entries.length - top;
  return rest > 0 ? `${head} · +${rest}` : head;
}
```

- [ ] **Step 4: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/format.spec.ts`
Expected: 全 passed

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/frontend/src/utils/format.ts doclens/web_v2/frontend/tests/format.spec.ts
git commit -m "feat(web): 新增 utils/format 状态区格式化纯函数"
```

---

### Task 4: `watch-polling` 加 `refreshStatus`

**Files:**
- Modify: `frontend/src/watch-polling.ts`、`frontend/tests/watch-polling.spec.ts`

**Interfaces:**
- Consumes: `getStatus`（`api/status.ts`）、`actions.setStatus`（Task 2）。
- Produces: 启动时 + reindex 完成时调用 `getStatus()` 填 `store.status`。Task 5 依赖 `store.status` 被填充。

- [ ] **Step 1: 写失败测试**

在 `frontend/tests/watch-polling.spec.ts` 顶部 import 区加 `getStatus` 的 mock 支持，并替换 `mockWatch` 为按 URL 区分的实现。然后在 `describe` 块末尾追加 2 个测试。

替换顶部 `mockWatch`（line 5-10）为：

```typescript
function mockBoth(watchResp: any, statusResp: any) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
    const body = url.includes("/api/watch/status") ? watchResp : statusResp;
    return Promise.resolve({ ok: true, json: async () => body });
  }));
}
```

末尾追加：

```typescript
  it("startWatchPolling loads status on startup", async () => {
    mockBoth(
      { enabled: true, watcher: { running: true, reindexing: false, changed_count: 0,
        last_reindex_at: 100, last_doc_count: 5, last_success: true } },
      { search_path: "C:/kb", indexed_docs: 7, index_path: "x", total_size_bytes: 0, file_types: {} },
    );
    startWatchPolling();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().status?.search_path).toBe("C:/kb");
    expect(store.getState().status?.indexed_docs).toBe(7);
  });

  it("refreshes status when last_reindex_at changes", async () => {
    let docs = 7;
    mockBoth(
      { enabled: true, watcher: { running: true, reindexing: false, changed_count: 0,
        last_reindex_at: 200, last_doc_count: 6, last_success: true } },
      { search_path: "C:/kb", indexed_docs: docs, index_path: "x", total_size_bytes: 0, file_types: {} },
    );
    startWatchPolling();
    await vi.advanceTimersByTimeAsync(0);                  // 首次：记录 200，不刷新
    expect(store.getState().status?.indexed_docs).toBe(7);

    docs = 9;                                               // 模拟 reindex 后文档数变化
    mockBoth(
      { enabled: true, watcher: { running: true, reindexing: false, changed_count: 0,
        last_reindex_at: 300, last_doc_count: 9, last_success: true } },
      { search_path: "C:/kb", indexed_docs: docs, index_path: "x", total_size_bytes: 0, file_types: {} },
    );
    await vi.advanceTimersByTimeAsync(5000);                // 第二次 tick → 200→300 触发刷新

    expect(store.getState().status?.indexed_docs).toBe(9);
  });
```

同时把原有 3 个测试里的 `mockWatch(...)` 调用改为 `mockBoth(..., null)`（第二个参数 `null` 提供 status 占位，避免 refreshStatus 拿到 watch 格式数据）。例如：
```typescript
mockBoth({ enabled: true, watcher: {...} }, null);
```
`null` 会让 `getStatus` 的 `resp.json()` 返回 null → `setStatus(null)`——为兼容，`refreshStatus` catch 不写 null（见 Step 3）。

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/watch-polling.spec.ts`
Expected: FAIL（新 2 测试：`store.getState().status` 为 null）

- [ ] **Step 3: 改 `frontend/src/watch-polling.ts`**

完整替换为：

```typescript
/** 轻量轮询 /api/watch/status 写入 store.watcher；启动 + reindex 完成时刷新 store.status。
 *  reindex 完成时派发 cortex:watch-reindexed toast 事件。 */
import { getWatchStatus, getStatus } from "./api/status";
import { actions } from "./state/store";
import type { SystemStatus, WatcherStatus } from "./state/types";

const POLL_INTERVAL_MS = 5000;

let timer: number | null = null;
let lastReindexAt: number | null | undefined = undefined; // undefined = 未初始化

async function refreshStatus(): Promise<void> {
  try {
    const s: SystemStatus = await getStatus();
    actions.setStatus(s);
  } catch {
    // 静默：welcome 状态区自行显示"获取失败"
  }
}

async function tick(): Promise<void> {
  try {
    const resp = await getWatchStatus();
    const w: WatcherStatus | null = resp.watcher;
    const at = w?.last_reindex_at ?? null;
    // 仅在已初始化且时间戳变化时通知 + 刷新 status（首次拉取不触发）
    if (lastReindexAt !== undefined && at !== null && at !== lastReindexAt) {
      window.dispatchEvent(new CustomEvent("cortex:watch-reindexed", {
        detail: { doc_count: w?.last_doc_count ?? null },
      }));
      void refreshStatus();
    }
    lastReindexAt = at;
    actions.setWatcherStatus(w);
  } catch {
    // 轮询失败静默忽略
  }
}

export function startWatchPolling(): void {
  if (timer !== null) return;
  lastReindexAt = undefined;
  void refreshStatus();
  void tick();
  timer = window.setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
}

export function stopWatchPolling(): void {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}
```

- [ ] **Step 4: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/watch-polling.spec.ts`
Expected: 5 passed（原 3 + 新 2）

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/frontend/src/watch-polling.ts doclens/web_v2/frontend/tests/watch-polling.spec.ts
git commit -m "feat(web): watch-polling 启动与 reindex 完成时刷新 store.status"
```

---

### Task 5: `welcome-pane` 状态区

**Files:**
- Modify: `frontend/src/components/welcome-pane.ts`
- Test: `frontend/tests/welcome-pane.spec.ts`（新）

**Interfaces:**
- Consumes: `store.status` / `store.watcher`（Task 2/4）、`utils/format`（Task 3）。
- Produces: `<welcome-pane>` 在副标题下方渲染 4 行状态区。

- [ ] **Step 1: 写失败测试**

新建 `frontend/tests/welcome-pane.spec.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/components/welcome-pane";
import type { WelcomePane } from "../src/components/welcome-pane";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import type { SystemStatus, WatcherStatus } from "../src/state/types";

const STATUS: SystemStatus = {
  search_path: "C:/a/b/c/test_work_dir",
  indexed_docs: 69,
  index_path: "x",
  total_size_bytes: 12 * 1024 * 1024,
  file_types: { ".md": 30, ".pdf": 12, ".docx": 8, ".py": 3 },
};
const WATCHER: WatcherStatus = {
  running: true, reindexing: false, changed_count: 0,
  last_reindex_at: Date.now() / 1000 - 180, last_doc_count: 69, last_success: true,
};

describe("<welcome-pane> status area", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE });
  });

  async function mount(): Promise<WelcomePane> {
    const el = await fixture<WelcomePane>(html`<welcome-pane></welcome-pane>`);
    await elementUpdated(el);
    return el;
  }

  it("renders 4 status rows when status + watcher present", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus(WATCHER);
    const el = await mount();
    const text = el.shadowRoot?.querySelector(".status-area")?.textContent ?? "";
    expect(text).toContain("工作目录");
    expect(text).toContain("…/c/test_work_dir");
    expect(text).toContain("69 个文档");
    expect(text).toContain("12 MB");
    expect(text).toContain("监控");
    expect(text).toContain(".md 30");
  });

  it("watcher reindexing → ⟳ 更新中", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus({ ...WATCHER, reindexing: true });
    const el = await mount();
    expect(el.shadowRoot?.querySelector(".status-area")?.textContent).toContain("更新中");
  });

  it("watcher running + changed → 待更新 N", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus({ ...WATCHER, changed_count: 4 });
    const el = await mount();
    expect(el.shadowRoot?.querySelector(".status-area")?.textContent).toContain("待更新 4");
  });

  it("watcher !running → ○ 未启用", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus({ ...WATCHER, running: false });
    const el = await mount();
    expect(el.shadowRoot?.querySelector(".status-area")?.textContent).toContain("未启用");
  });

  it("watcher null → 监控行 —", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus(null);
    const el = await mount();
    const rows = el.shadowRoot?.querySelectorAll(".status-row");
    const monitorRow = Array.from(rows ?? []).find((r) => r.textContent?.includes("监控"));
    expect(monitorRow?.textContent).toContain("—");
  });

  it("status null → all values —", async () => {
    const el = await mount();
    const text = el.shadowRoot?.querySelector(".status-area")?.textContent ?? "";
    expect(text).toContain("—");
  });

  it("path title attr holds full path", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus(WATCHER);
    const el = await mount();
    const pathEl = el.shadowRoot?.querySelector(".status-value[data-kind='path']") as HTMLElement | null;
    expect(pathEl?.title).toBe(STATUS.search_path);
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/welcome-pane.spec.ts`
Expected: FAIL（无 `.status-area` 元素）

- [ ] **Step 3: 改 `frontend/src/components/welcome-pane.ts`**

完整替换为：

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

import { store } from "../state/store";
import type { SystemStatus, WatcherStatus } from "../state/types";
import {
  formatBytes, formatRelative, truncatePathMiddle, summarizeFileTypes,
} from "../utils/format";

@customElement("welcome-pane")
export class WelcomePane extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 36px var(--cortex-space-6) 22px;
      text-align: center;
      background: linear-gradient(
        180deg,
        rgba(208, 245, 232, 0.55) 0%,
        rgba(240, 242, 249, 0) 100%
      );
      flex-shrink: 0;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: var(--cortex-text);
      letter-spacing: -0.3px;
      margin: 0;
    }
    .title .accent { color: var(--cortex-primary); font-weight: 700; }
    .title .sep { color: var(--cortex-text-subtle); margin: 0 6px; font-weight: 400; }
    .subtitle {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      margin-top: 6px;
    }
    .status-area {
      max-width: 520px;
      margin: 24px auto 0;
      padding-top: 16px;
      border-top: 1px solid var(--cortex-border-muted);
      text-align: left;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .status-row {
      display: flex;
      gap: var(--cortex-space-3);
      padding: 4px 0;
      align-items: baseline;
    }
    .status-label {
      width: 5em;
      flex-shrink: 0;
      color: var(--cortex-text-subtle);
    }
    .status-value {
      flex: 1;
      min-width: 0;
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status-fail {
      margin-top: 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-danger, #dc2626);
    }
    @media (min-width: 1024px) {
      :host { padding: 28px var(--cortex-space-4) 18px; }
      .title { font-size: 24px; }
    }
    @media (max-width: 1023px) {
      .status-label { width: 4em; }
    }
  `;

  @property() heading = "Doclens";
  @property() subheading = "";
  @property() suffix = "";

  private _unsub?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = store.subscribe(() => this.requestUpdate());
  }
  disconnectedCallback() {
    this._unsub?.();
    super.disconnectedCallback();
  }

  /** 监控状态文本（已含可能的"· 🕒 X前"段）。watcher==null → "—"。 */
  private _monitorText(w: WatcherStatus | null): string {
    if (!w) return "—";
    let head: string;
    if (w.reindexing) head = "⟳ 更新中";
    else if (w.running && w.changed_count > 0) head = `● 监控 · 待更新 ${w.changed_count}`;
    else if (w.running) head = "● 监控中";
    else head = "○ 未启用";
    const rel = formatRelative(w.last_reindex_at);
    return rel ? `${head} · 🕒 ${rel}` : head;
  }

  private _renderStatus(status: SystemStatus | null, watcher: WatcherStatus | null) {
    const path = status ? truncatePathMiddle(status.search_path) : { text: "—", title: "" };
    const indexVal = status ? `${status.indexed_docs} 个文档 · 💾 ${formatBytes(status.total_size_bytes)}` : "—";
    const typeVal = status ? summarizeFileTypes(status.file_types) : "—";
    return html`
      <div class="status-area">
        <div class="status-row">
          <span class="status-label">📁 工作目录</span>
          <span class="status-value" data-kind="path" title=${path.title}>${path.text}</span>
        </div>
        <div class="status-row">
          <span class="status-label">📄 索引</span>
          <span class="status-value">${indexVal}</span>
        </div>
        <div class="status-row">
          <span class="status-label">👁 监控</span>
          <span class="status-value">${this._monitorText(watcher)}</span>
        </div>
        <div class="status-row">
          <span class="status-label">🗂 类型</span>
          <span class="status-value">${typeVal}</span>
        </div>
      </div>
    `;
  }

  render() {
    const { status, watcher } = store.getState();
    return html`
      <h1 class="title">
        <span class="accent">${this.heading}</span>${this.suffix
          ? html`<span class="sep">·</span><span>${this.suffix}</span>`
          : null}
      </h1>
      ${this.subheading ? html`<p class="subtitle">${this.subheading}</p>` : null}
      ${this._renderStatus(status, watcher)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "welcome-pane": WelcomePane;
  }
}
```

- [ ] **Step 4: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/welcome-pane.spec.ts`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/frontend/src/components/welcome-pane.ts doclens/web_v2/frontend/tests/welcome-pane.spec.ts
git commit -m "feat(web): welcome-pane 新增系统状态区（工作目录/索引/监控/类型）"
```

---

### Task 6: `app-bar` 移除 `watch-badge`

**Files:**
- Modify: `frontend/src/components/app-bar.ts`、`frontend/tests/app-bar.spec.ts`

**Interfaces:**
- Consumes: 无新依赖。
- Produces: app-bar 不再渲染 `.watch-badge`；`cortex:watch-reindexed` toast 保留。

- [ ] **Step 1: 改测试（删 badge 渲染断言，保留 toast 断言）**

在 `frontend/tests/app-bar.spec.ts` 中，把 `describe("<app-bar> watcher badge", ...)` 块（约 line 154-198）改为只保留 toast 测试：

```typescript
describe("<app-bar> reindex toast", () => {
  it("dispatching cortex:watch-reindexed pushes a toast", async () => {
    actions.setWatcherStatus({
      enabled: true, running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 123, last_doc_count: 42, last_success: true,
    });
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    await elementUpdated(el);
    const stack = el.shadowRoot?.querySelector("toast-stack") as any;
    const before = stack._toasts.length;
    window.dispatchEvent(new CustomEvent("cortex:watch-reindexed", { detail: { doc_count: 42 } }));
    await elementUpdated(el);
    expect(stack._toasts.length).toBe(before + 1);
    expect(stack._toasts[stack._toasts.length - 1].message).toContain("42");
  });

  it("does not render watch-badge anymore", async () => {
    actions.setWatcherStatus({
      enabled: true, running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 123, last_doc_count: 42, last_success: true,
    });
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".watch-badge")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/app-bar.spec.ts`
Expected: FAIL（`does not render watch-badge` —— 当前仍渲染）

- [ ] **Step 3: 改 `frontend/src/components/app-bar.ts`**

(a) 删除 `_renderWatchBadge` 方法（约 line 300-309）。

(b) 在 `render()` 中删除对它的调用（约 line 318 `${this._renderWatchBadge(store.getState().watcher)}`）。

(c) 删除 `.watch-badge`、`.watch-badge.dot`、`.watch-badge.busy`、`.watch-badge.warn` 四条 CSS 规则（约 line 47-61）。

`render()` 的 `.right-cluster` 起始部分变为：

```typescript
      <div class="right-cluster">
        ${this._showSaveAndRevert ? html`
          <button class="save-btn" type="button" @click=${this._onSaveClick}>💾 保存</button>
        ` : nothing}
        <button
          class="refresh-btn ${this._refreshing ? "spinning" : ""}"
          ...
```

（即 `.right-cluster` 第一个孩子从 watch-badge 变为 save-btn/refresh-btn。）

- [ ] **Step 4: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/app-bar.spec.ts`
Expected: 本次新/改 2 测试通过（其它原有 navigate/reindex 菜单项测试不变）。

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/frontend/src/components/app-bar.ts doclens/web_v2/frontend/tests/app-bar.spec.ts
git commit -m "refactor(web): app-bar 移除 watch-badge（状态统一由 welcome 状态区显示）"
```

---

### Task 7: 前端构建 + 回归 + 冒烟

**Files:**
- 产物：`doclens/web_v2/static/`（`npm run build`）

- [ ] **Step 1: 前端全量 vitest 回归**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/store-status.spec.ts tests/format.spec.ts tests/welcome-pane.spec.ts tests/watch-polling.spec.ts tests/app-bar.spec.ts tests/store-reindex.spec.ts tests/api-status.spec.ts`
Expected: 全 passed（注意 api-status.spec.ts 的 mock 响应需含 `search_path` 字段——若其 mock 缺字段导致类型/断言问题，补上 `"search_path": "x"`）。

- [ ] **Step 2: 后端回归**

Run: `../cortex/.venv/Scripts/python.exe -m pytest tests/web_v2/test_status_api.py tests/web_v2/test_watch_api.py -q`
Expected: 全 passed。

- [ ] **Step 3: 前端构建（tsc + vite）**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: `tsc --noEmit` 无错 + `✓ built`。**若 tsc 报未用 import 等，修复后重跑**（vitest 过 ≠ tsc 过）。

- [ ] **Step 4: 同步产物 + 提交**

若在 0711-2 构建失败（无 node_modules）而在 cortex 构建，需把 `doclens/web_v2/static/{index.html,assets/*}` 同步回 0711-2。然后：

```bash
git add doclens/web_v2/frontend/src/app.ts doclens/web_v2/static
git commit -m "feat(web): welcome 状态区构建产物"
```
（`app.ts` 无改动则只 add `static`。）

- [ ] **Step 5: 手动冒烟（用户在终端执行）**

```
! pwsh -File ./start-app.ps1 gui
```

浏览器打开后进搜索 tab（初始页）：
- 状态区 4 行显示：工作目录（`…/尾2段`）/ `N 个文档 · 💾 X MB` / 监控状态 / 类型分布
- 切到对话 tab：状态区同样显示（系统状态相同）
- app-bar 右上角**无** watch-badge
- 点头像 → 强制重建索引 → 完成后回初始页，文档数应刷新

移动端窄屏（DevTools 响应式）：状态区标签列 4em、值列省略号兜底，整体垂直。

---

## Self-Review 记录

**Spec 覆盖核对：**
- 后端 `/api/status` 加 `search_path` → Task 1 ✅
- `SystemStatus.search_path` 类型 + `setStatus` action → Task 2 ✅
- `utils/format.ts` 四个格式化工具 → Task 3 ✅
- `watch-polling` 启动 + reindex 完成刷新 status → Task 4 ✅
- `welcome-pane` 状态区 4 行 + 监控 4 分支 + 加载/失败 + 路径截断 + 类型分布 → Task 5 ✅
- `app-bar` 移除 `watch-badge`、保留 toast → Task 6 ✅
- 构建 + 冒烟 → Task 7 ✅
- 已知限制（仅初始页可见 / 路径截断 / 不高频轮询 / 类型前 3）→ spec 记录，无需任务实现

**类型一致性：** `SystemStatus.search_path: string`（Task 1 后端 ↔ Task 2 类型 ↔ Task 4 getStatus ↔ Task 5 渲染）；`actions.setStatus(s)`（Task 2 定义 ↔ Task 4 调用）；`formatBytes/formatRelative/truncatePathMiddle/summarizeFileTypes`（Task 3 定义 ↔ Task 5 调用）；`last_reindex_at` 秒级（Global Constraints ↔ Task 3 formatRelative ↔ Task 5 _monitorText）。

**Placeholder 扫描：** 无 TBD/TODO；每步含可执行代码与命令。Task 6 Step 3 的 CSS 删除定位用了"约 line"——因 app-bar.ts 改动以删除为主，实现者按规则名 `.watch-badge*` 定位删除即可，无歧义。

**Task 4 mock 兼容性说明：** 原 3 个测试改用 `mockBoth(..., null)` 后，`refreshStatus` 的 `getStatus()` 会拿到 `null` body → `actions.setStatus(null as any)`。这会把 `store.status` 设为 null（等于"未加载"），不影响 watcher 断言，且 welcome-pane 的 `status==null` 分支正常显示 `—`。若实现者希望更严谨，可让 `mockBoth` 的 status 参数对原有 3 测试传一个合法 `SystemStatus` 对象——但非必需。
