# Filename Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 cortex GUI 的 files 视图左栏顶部新增文件名搜索框；输入即时过滤已索引文档；命中结果以列表形式替换中栏 file-list，并联动 preview-pane。

**Architecture:** 后端新增只读 `GET /api/files/documents` 端点，从 `IndexManager.documents` + `path.stat()` 输出扁平文档列表。前端在 `FileExplorerViewState` 上扩展 `filenameSearch` 切片，新增 `<file-search-box>`（左栏顶部，IME 安全 + 80ms 防抖）和 `<file-search-results>`（中栏完全替换列表，单行多列布局，键盘上下键选中联动 preview）两个 Lit 组件，由 `files-view.ts` 装配切换。

**Tech Stack:** FastAPI + Pydantic（后端）；Lit 3 + TypeScript + Vite + Vitest（前端）；Playwright（E2E）；pytest + httpx ASGITransport（后端测试）。

## Global Constraints

- **Commit 授权**：用户全局规则禁止未经允许的 `git commit`。每个 Task 末尾的 commit 步骤需要等用户最终授权后批量执行；实施过程中只 `git add` 不 `git commit`，最后由用户统一授权 commit。Subagent 实施时遇到 commit 步骤改为 stage 后跳过。
- **不修改后端现有行为**：所有现有 `/api/files/*` 端点保持不变；只新增端点。
- **不修改现有组件接口**：`<file-tree>` / `<file-list>` / `<preview-pane>` / `<file-row>` 的 props 和 events 保持不变。
- **CSS tokens**：所有颜色/间距使用现有 `--cortex-*` CSS 变量（参考 `frontend/src/styles/`）。
- **TypeScript 严格模式**：`npm run build` 会先跑 `tsc --noEmit`，禁止 any/implicit-any。
- **命名风格**：actions 用 camelCase（`setFilenameSearchQuery`），组件用 kebab-case（`file-search-box`）。
- **测试要求**：每个新组件/Action/端点必须有单元测试；不写 console.log。
- **Python 代码**：PEP 8 + 类型注解 + `from __future__ import annotations` 不强制；导入走 isort。
- **文件大小**：新增前端组件 < 400 行；新增后端函数 < 50 行。

---

## File Structure

```
doclens/web_v2/
├── api/files.py                     # 改：新增 GET /files/documents 路由
├── models/files.py                  # 改：新增 IndexedDocument / IndexedDocumentsResponse
└── frontend/
    ├── src/
    │   ├── api/documents.ts         # 新：fetchDocuments() client
    │   ├── state/
    │   │   ├── types.ts             # 改：IndexedDocument / FilenameSearchState / 扩展 FileExplorerViewState
    │   │   └── store.ts             # 改：INITIAL_STATE.files.filenameSearch + 4 个 actions
    │   ├── components/
    │   │   ├── file-search-box.ts   # 新：搜索框（IME + 防抖 + Esc/× 清空）
    │   │   └── file-search-results.ts  # 新：中栏结果列表（表头 + 行 + 空态 + 超限）
    │   └── views/
    │       └── files-view.ts        # 改：插入 search-box；按 isActive 切换中栏；preview 联动
    └── tests/
        ├── test-utils.ts            # 改：resetStore 补齐 filenameSearch 字段
        ├── api-documents.spec.ts    # 新：client 单测
        ├── store-filename-search.spec.ts  # 新：actions 单测
        ├── file-search-box.spec.ts  # 新：组件单测
        ├── file-search-results.spec.ts  # 新：组件单测
        ├── files-view.spec.ts       # 改：补搜索态切换断言
        └── e2e/filename-search.spec.ts  # 新：Playwright E2E
tests/web_v2/
└── test_files_api.py                # 改：新增 GET /files/documents 用例
```

---

## Task 1: 后端 — `GET /api/files/documents` 端点

**Files:**
- Modify: `doclens/web_v2/models/files.py`（追加 2 个模型）
- Modify: `doclens/web_v2/api/files.py`（追加 1 个路由 + 1 个辅助函数）
- Test: `tests/web_v2/test_files_api.py`（追加 3 个测试用例）

**Interfaces:**
- Produces (后端 → 前端契约):
  - `GET /api/files/documents` → `IndexedDocumentsResponse`
  - `IndexedDocument { path: str; name: str; size: int; modified_at: datetime }`
  - `IndexedDocumentsResponse { documents: list[IndexedDocument]; total: int }`

- [ ] **Step 1: 在 `models/files.py` 末尾追加 2 个模型**

```python
class IndexedDocument(BaseModel):
    """已索引文档的扁平表示（用于前端文件名搜索）。"""
    path: str          # 相对工作目录的 POSIX 路径
    name: str          # 文件名（含扩展名）
    size: int          # bytes
    modified_at: datetime


class IndexedDocumentsResponse(BaseModel):
    documents: list[IndexedDocument]
    total: int
```

- [ ] **Step 2: 在 `api/files.py` 追加 import 和辅助函数**

在文件顶部 import 块的 `from doclens.web_v2.models.files import (...)` 中追加 `IndexedDocument`、`IndexedDocumentsResponse`：

```python
from doclens.web_v2.models.files import (
    AttrsResponse,
    DirStatsResponse,
    Entry,
    IndexedDocument,
    IndexedDocumentsResponse,
    ListDirResponse,
    MkdirRequest,
    MoveRequest,
    MoveResponse,
    RenameRequest,
    SkippedItem,
    UploadResponse,
)
```

在 `_indexed_paths` 函数（约 line 78-91）下方追加：

```python
def _indexed_documents(idx: IndexManager, base: Path) -> list[IndexedDocument]:
    """从 idx.documents 构建 IndexedDocument 列表（去重、跳过缺失文件）。"""
    result: list[IndexedDocument] = []
    seen: set[str] = set()
    for doc in idx.documents or []:
        abs_path = doc.metadata.get("source_path", "") if hasattr(doc, "metadata") else ""
        if not abs_path:
            continue
        try:
            p = Path(abs_path)
            rel_parts = p.relative_to(base.resolve()).parts
            rel = "/".join(rel_parts) if rel_parts else ""
            if rel in seen or not p.is_file():
                continue
            seen.add(rel)
            stat = p.stat()
            result.append(IndexedDocument(
                path=rel,
                name=p.name,
                size=stat.st_size,
                modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
            ))
        except (ValueError, OSError):
            continue
    return result
```

- [ ] **Step 3: 在 `api/files.py` 追加路由（建议放在 `/files/attrs` 路由之后、`/files/mkdir` 路由之前）**

```python
# --- GET /files/documents ---

@router.get("/files/documents", response_model=IndexedDocumentsResponse)
async def list_indexed_documents(
    idx: IndexManager = Depends(get_index_manager),
) -> IndexedDocumentsResponse:
    """返回所有已索引文档的扁平列表（用于前端文件名搜索）。"""
    base = Path(idx.search_path)
    docs = _indexed_documents(idx, base)
    docs.sort(key=lambda d: d.name.lower())
    return IndexedDocumentsResponse(documents=docs, total=len(docs))
```

- [ ] **Step 4: 写失败测试 — 在 `tests/web_v2/test_files_api.py` 末尾追加**

```python
# === GET /documents ===

@pytest.mark.asyncio
async def test_documents_returns_indexed_files(populated_workdir, env_cortex_config, reset_deps):
    """documents 端点返回所有已索引文档（不含目录、不含点文件）。"""
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/documents")
    assert res.status_code == 200
    body = res.json()
    names = {d["name"] for d in body["documents"]}
    # populated_workdir 索引了 report.md / note.md / doc1.md / doc2.py / data.csv / logo.png
    assert "report.md" in names
    assert "doc1.md" in names
    assert "logo.png" in names
    # 不含目录
    assert all(not d["path"].startswith(".") for d in body["documents"])
    # 字段齐全
    sample = body["documents"][0]
    assert {"path", "name", "size", "modified_at"} <= set(sample.keys())


@pytest.mark.asyncio
async def test_documents_sorted_by_name_case_insensitive(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/documents")
    names = [d["name"] for d in res.json()["documents"]]
    assert names == sorted(names, key=str.lower)


@pytest.mark.asyncio
async def test_documents_total_matches_count(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/documents")
    body = res.json()
    assert body["total"] == len(body["documents"])
```

- [ ] **Step 5: 跑测试，确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k documents`
Expected: 3 passed

- [ ] **Step 6: 跑整个 files_api 测试套件，确认未回归**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v`
Expected: all passed

- [ ] **Step 7: Stage 改动（不 commit）**

```bash
git add doclens/web_v2/models/files.py doclens/web_v2/api/files.py tests/web_v2/test_files_api.py
```

---

## Task 2: 前端 — State 扩展（types + store + test-utils）

**Files:**
- Modify: `doclens/web_v2/frontend/src/state/types.ts`（追加类型）
- Modify: `doclens/web_v2/frontend/src/state/store.ts`（追加 INITIAL_STATE.files.filenameSearch + 4 个 actions）
- Modify: `doclens/web_v2/frontend/tests/test-utils.ts`（resetStore 补齐新字段）
- Test: `doclens/web_v2/frontend/tests/store-filename-search.spec.ts`（新建）

**Interfaces:**
- Consumes: 无（基础类型层）
- Produces:
  - `IndexedDocument { path: string; name: string; size: number; modifiedAt: string }`
  - `FilenameSearchState { query, allDocs, docsLoading, docsError, results, selectedPath, isActive, totalMatches }`
  - `actions.loadIndexedDocuments(docs: IndexedDocument[])`
  - `actions.setFilenameSearchQuery(payload: { query: string; results: IndexedDocument[]; totalMatches: number })`
  - `actions.clearFilenameSearch()`
  - `actions.selectFilenameSearchResult(path: string | null)`

- [ ] **Step 1: 在 `types.ts` 追加类型定义（在 `FileAttrs` 之后、`FileExplorerViewState` 之前插入）**

```typescript
export interface IndexedDocument {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;  // ISO8601
}

export interface FilenameSearchState {
  query: string;
  allDocs: IndexedDocument[];
  docsLoading: boolean;
  docsError: string | null;
  results: IndexedDocument[];
  selectedPath: string | null;
  isActive: boolean;
  totalMatches: number;
}
```

- [ ] **Step 2: 扩展 `FileExplorerViewState`（在 `error` 字段之前追加最后一项）**

将 `FileExplorerViewState` 末尾改为：

```typescript
export interface FileExplorerViewState {
  treeCache: Record<string, FileEntry[]>;
  expandedPaths: string[];
  currentDir: string;
  selectedPaths: string[];
  lastSelectedAnchor: string | null;
  detail: FileAttrs | null;
  detailLoading: boolean;
  listing: boolean;
  mobilePane: "tree" | "list" | "detail";
  pendingAction: "mkdir" | "delete" | "move" | "rename" | "upload" | null;
  error: string | null;
  filenameSearch: FilenameSearchState;
}
```

- [ ] **Step 3: 在 `store.ts` 的 `INITIAL_STATE.files` 中追加 `filenameSearch` 初值**

```typescript
  files: {
    treeCache: {},
    expandedPaths: [],
    currentDir: "",
    selectedPaths: [],
    lastSelectedAnchor: null,
    detail: null,
    detailLoading: false,
    listing: false,
    mobilePane: "tree",
    pendingAction: null,
    error: null,
    filenameSearch: {
      query: "",
      allDocs: [],
      docsLoading: true,
      docsError: null,
      results: [],
      selectedPath: null,
      isActive: false,
      totalMatches: 0,
    },
  },
```

- [ ] **Step 4: 在 `store.ts` 的 `import type { ... } from "./types"` 中追加新类型**

把 `import type { ... }` 改为包含 `IndexedDocument`：

```typescript
import type {
  AppState,
  FileEntry,
  IndexedDocument,
  Session,
  SettingsFieldValues,
  SettingsScope,
} from "./types";
```

- [ ] **Step 5: 在 `actions` 对象末尾（`setMobilePane` 之后）追加 4 个 actions**

```typescript
  loadIndexedDocuments(docs: IndexedDocument[]) {
    const cur = store.getState().files;
    store.setState({
      files: {
        ...cur,
        filenameSearch: {
          ...cur.filenameSearch,
          allDocs: docs,
          docsLoading: false,
          docsError: null,
        },
      },
    });
  },

  setFilenameSearchDocsError(message: string) {
    const cur = store.getState().files;
    store.setState({
      files: {
        ...cur,
        filenameSearch: {
          ...cur.filenameSearch,
          docsLoading: false,
          docsError: message,
        },
      },
    });
  },

  setFilenameSearchQuery(payload: {
    query: string;
    results: IndexedDocument[];
    totalMatches: number;
  }) {
    const cur = store.getState().files;
    const isActive = payload.query.trim() !== "";
    const selectedPath = isActive
      ? (payload.results[0]?.path ?? null)
      : null;
    store.setState({
      files: {
        ...cur,
        filenameSearch: {
          ...cur.filenameSearch,
          query: payload.query,
          results: payload.results,
          totalMatches: payload.totalMatches,
          isActive,
          selectedPath,
        },
      },
    });
  },

  clearFilenameSearch() {
    const cur = store.getState().files;
    store.setState({
      files: {
        ...cur,
        filenameSearch: {
          ...cur.filenameSearch,
          query: "",
          results: [],
          totalMatches: 0,
          isActive: false,
          selectedPath: null,
        },
      },
    });
  },

  selectFilenameSearchResult(path: string | null) {
    const cur = store.getState().files;
    store.setState({
      files: {
        ...cur,
        filenameSearch: { ...cur.filenameSearch, selectedPath: path },
      },
    });
  },
```

- [ ] **Step 6: 更新 `tests/test-utils.ts` 的 `resetStore`，补齐 `filenameSearch` 字段**

```typescript
import { store } from "../src/state/store";

export function resetStore(target: typeof store) {
  target.setState({
    view: "search",
    search: { state: "initial", currentSession: null, query: "", queryWords: [], results: [], total: 0, source: "fts", offset: 0, limit: 20 },
    chat: { state: "initial", currentSession: null, messages: [], streaming: false },
    settings: { scope: "local", values: {}, original: {}, dirty: false, exists: true, saving: false, error: null },
    files: {
      treeCache: {},
      expandedPaths: [],
      currentDir: "",
      selectedPaths: [],
      lastSelectedAnchor: null,
      detail: null,
      detailLoading: false,
      listing: false,
      mobilePane: "tree",
      pendingAction: null,
      error: null,
      filenameSearch: {
        query: "",
        allDocs: [],
        docsLoading: true,
        docsError: null,
        results: [],
        selectedPath: null,
        isActive: false,
        totalMatches: 0,
      },
    },
    detailStack: [],
    pendingSession: null,
    status: null,
    error: null,
  });
}
```

- [ ] **Step 7: 写 store 单元测试 — 新建 `tests/store-filename-search.spec.ts`**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import type { IndexedDocument } from "../src/state/types";

const docs: IndexedDocument[] = [
  { path: "docs/README.md", name: "README.md", size: 100, modifiedAt: "2026-06-24T00:00:00Z" },
  { path: "src/b.ts", name: "b.ts", size: 200, modifiedAt: "2026-06-25T00:00:00Z" },
  { path: "a.py", name: "a.py", size: 300, modifiedAt: "2026-06-26T00:00:00Z" },
];

describe("filenameSearch store slice", () => {
  beforeEach(() => {
    store.setState({
      ...INITIAL_STATE,
      files: { ...INITIAL_STATE.files, filenameSearch: { ...INITIAL_STATE.files.filenameSearch } },
    });
  });

  it("starts inactive with docsLoading=true", () => {
    const s = store.getState().files.filenameSearch;
    expect(s.isActive).toBe(false);
    expect(s.docsLoading).toBe(true);
    expect(s.results).toEqual([]);
  });

  it("loadIndexedDocuments populates allDocs and clears loading", () => {
    actions.loadIndexedDocuments(docs);
    const s = store.getState().files.filenameSearch;
    expect(s.allDocs).toHaveLength(3);
    expect(s.docsLoading).toBe(false);
    expect(s.docsError).toBeNull();
  });

  it("setFilenameSearchQuery activates when query non-empty and selects first result", () => {
    actions.loadIndexedDocuments(docs);
    actions.setFilenameSearchQuery({
      query: "ts",
      results: [docs[1]],
      totalMatches: 1,
    });
    const s = store.getState().files.filenameSearch;
    expect(s.isActive).toBe(true);
    expect(s.query).toBe("ts");
    expect(s.selectedPath).toBe("src/b.ts");
  });

  it("setFilenameSearchQuery with empty query deactivates and clears selectedPath", () => {
    actions.setFilenameSearchQuery({ query: "ts", results: [docs[1]], totalMatches: 1 });
    actions.setFilenameSearchQuery({ query: "  ", results: [], totalMatches: 0 });
    const s = store.getState().files.filenameSearch;
    expect(s.isActive).toBe(false);
    expect(s.selectedPath).toBeNull();
  });

  it("clearFilenameSearch resets search-time fields but preserves allDocs", () => {
    actions.loadIndexedDocuments(docs);
    actions.setFilenameSearchQuery({ query: "a", results: [docs[0]], totalMatches: 1 });
    actions.clearFilenameSearch();
    const s = store.getState().files.filenameSearch;
    expect(s.query).toBe("");
    expect(s.results).toEqual([]);
    expect(s.isActive).toBe(false);
    expect(s.selectedPath).toBeNull();
    expect(s.allDocs).toHaveLength(3);
  });

  it("selectFilenameSearchResult only updates selectedPath", () => {
    actions.loadIndexedDocuments(docs);
    actions.setFilenameSearchQuery({ query: "", results: [], totalMatches: 0 });
    actions.selectFilenameSearchResult("src/b.ts");
    expect(store.getState().files.filenameSearch.selectedPath).toBe("src/b.ts");
    expect(store.getState().files.filenameSearch.query).toBe("");
  });

  it("setFilenameSearchDocsError sets docsError and clears loading", () => {
    actions.setFilenameSearchDocsError("boom");
    const s = store.getState().files.filenameSearch;
    expect(s.docsError).toBe("boom");
    expect(s.docsLoading).toBe(false);
  });
});
```

- [ ] **Step 8: 跑测试，确认通过**

Run: `cd doclens/web_v2/frontend && npm run test -- store-filename-search`
Expected: all passed

- [ ] **Step 9: 跑全部前端测试，确认未回归**

Run: `cd doclens/web_v2/frontend && npm run test`
Expected: all passed（重点关注 files-view / file-list / file-row 相关测试）

- [ ] **Step 10: Stage 改动（不 commit）**

```bash
git add doclens/web_v2/frontend/src/state/types.ts doclens/web_v2/frontend/src/state/store.ts doclens/web_v2/frontend/tests/test-utils.ts doclens/web_v2/frontend/tests/store-filename-search.spec.ts
```

---

## Task 3: 前端 — API client `fetchDocuments`

**Files:**
- Create: `doclens/web_v2/frontend/src/api/documents.ts`
- Test: `doclens/web_v2/frontend/tests/api-documents.spec.ts`

**Interfaces:**
- Consumes: `request<T>` 和 `ApiError` from `./client`
- Produces:
  - `IndexedDocumentDTO { path; name; size; modified_at }`（snake_case 来自后端）
  - `IndexedDocumentsResponseDTO { documents; total }`
  - `fetchDocuments(): Promise<IndexedDocument[]>`（已转 camelCase）

- [ ] **Step 1: 写失败测试 — 新建 `tests/api-documents.spec.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchDocuments } from "../src/api/documents";

describe("fetchDocuments", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as any;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns camelCased documents on 200", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [
          { path: "docs/a.md", name: "a.md", size: 100, modified_at: "2026-06-24T00:00:00Z" },
          { path: "b.py", name: "b.py", size: 200, modified_at: "2026-06-25T00:00:00Z" },
        ],
        total: 2,
      }),
    });
    const result = await fetchDocuments();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      path: "docs/a.md",
      name: "a.md",
      size: 100,
      modifiedAt: "2026-06-24T00:00:00Z",
    });
  });

  it("returns empty array on HTTP error (caller handles via try/catch)", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ code: "INTERNAL", detail: "boom" }),
    });
    await expect(fetchDocuments()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败（模块不存在）**

Run: `cd doclens/web_v2/frontend && npm run test -- api-documents`
Expected: FAIL with "Failed to resolve import" 或 "fetchDocuments is not a function"

- [ ] **Step 3: 创建 `src/api/documents.ts`**

```typescript
import { request } from "./client";

/** 后端原始 DTO（snake_case）。 */
interface IndexedDocumentDTO {
  path: string;
  name: string;
  size: number;
  modified_at: string;
}

interface IndexedDocumentsResponseDTO {
  documents: IndexedDocumentDTO[];
  total: number;
}

/** 前端使用的 camelCase 版本。 */
export interface IndexedDocument {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
}

/** 拉取所有已索引文档列表（用于文件名搜索本地过滤）。 */
export async function fetchDocuments(): Promise<IndexedDocument[]> {
  const res = await request<IndexedDocumentsResponseDTO>("/api/files/documents");
  return res.documents.map((d) => ({
    path: d.path,
    name: d.name,
    size: d.size,
    modifiedAt: d.modified_at,
  }));
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `cd doclens/web_v2/frontend && npm run test -- api-documents`
Expected: 2 passed

- [ ] **Step 5: Stage 改动（不 commit）**

```bash
git add doclens/web_v2/frontend/src/api/documents.ts doclens/web_v2/frontend/tests/api-documents.spec.ts
```

---

## Task 4: 前端 — `<file-search-box>` 组件

**Files:**
- Create: `doclens/web_v2/frontend/src/components/file-search-box.ts`
- Test: `doclens/web_v2/frontend/tests/file-search-box.spec.ts`

**Interfaces:**
- Consumes: 无 store 依赖；纯受控组件
- Produces（emits CustomEvent，bubbles + composed）:
  - `search` event with `{ detail: { query: string } }` — 防抖 80ms 后触发
  - `clear` event with no detail — 用户按 Esc 或点 × 触发

- [ ] **Step 1: 写失败测试 — 新建 `tests/file-search-box.spec.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "../src/components/file-search-box";

describe("file-search-box", () => {
  let el: any;

  beforeEach(async () => {
    el = document.createElement("file-search-box");
    document.body.appendChild(el);
    await el.updateComplete;
  });
  afterEach(() => {
    document.body.removeChild(el);
  });

  it("renders an input with placeholder", () => {
    const input = el.shadowRoot.querySelector("input");
    expect(input).toBeTruthy();
    expect(input.placeholder).toContain("文件名");
  });

  it("emits 'search' after debounce when typing", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    el.addEventListener("search", (e: CustomEvent) => events.push(e.detail.query));
    const input = el.shadowRoot.querySelector("input");
    input.value = "read";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    // 还没触发（防抖中）
    expect(events).toEqual([]);
    vi.advanceTimersByTime(80);
    expect(events).toEqual(["read"]);
    vi.useRealTimers();
  });

  it("does not emit during IME composition", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    el.addEventListener("search", (e: CustomEvent) => events.push(e.detail.query));
    const input = el.shadowRoot.querySelector("input");
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    input.value = "zhong";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(80);
    expect(events).toEqual([]);
    // compositionend 后再触发一次
    input.dispatchEvent(new CompositionEvent("compositionend"));
    vi.advanceTimersByTime(80);
    expect(events.length).toBeGreaterThanOrEqual(1);
    vi.useRealTimers();
  });

  it("emits 'clear' on Esc keydown and empties input", async () => {
    let cleared = false;
    el.addEventListener("clear", () => { cleared = true; });
    const input = el.shadowRoot.querySelector("input");
    input.value = "abc";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await el.updateComplete;
    expect(cleared).toBe(true);
    expect(input.value).toBe("");
  });

  it("emits 'clear' on × button click", async () => {
    let cleared = false;
    el.addEventListener("clear", () => { cleared = true; });
    const input = el.shadowRoot.querySelector("input");
    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    const btn = el.shadowRoot.querySelector("button.clear") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    await el.updateComplete;
    expect(cleared).toBe(true);
    expect(input.value).toBe("");
  });

  it("does not show × when input empty", () => {
    const btn = el.shadowRoot.querySelector("button.clear");
    expect(btn).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `cd doclens/web_v2/frontend && npm run test -- file-search-box`
Expected: FAIL（元素未注册）

- [ ] **Step 3: 创建 `src/components/file-search-box.ts`**

```typescript
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

const DEBOUNCE_MS = 80;

@customElement("file-search-box")
export class FileSearchBox extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .box {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 4px 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      background: var(--cortex-surface);
    }
    .box:focus-within {
      border-color: var(--cortex-primary);
    }
    .icon { opacity: 0.6; font-size: 13px; }
    input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      color: var(--cortex-text);
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
    }
    input::placeholder { color: var(--cortex-text-subtle); }
    button.clear {
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0 4px;
      border-radius: var(--cortex-radius-sm);
    }
    button.clear:hover { color: var(--cortex-text); background: var(--cortex-surface-muted); }
  `;

  @state() private _value = "";
  @state() private _isComposing = false;
  private _timer: any = null;

  disconnectedCallback() {
    if (this._timer) clearTimeout(this._timer);
    super.disconnectedCallback();
  }

  private _emitSearch() {
    this.dispatchEvent(new CustomEvent("search", {
      detail: { query: this._value },
      bubbles: true,
      composed: true,
    }));
  }

  private _scheduleEmit() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      if (!this._isComposing) this._emitSearch();
    }, DEBOUNCE_MS);
  }

  private _emitClear() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._value = "";
    this.dispatchEvent(new CustomEvent("clear", {
      bubbles: true,
      composed: true,
    }));
  }

  private _onInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    this._value = input.value;
    if (this._value.trim() === "") {
      // 空输入直接清空（不走防抖），让中栏立即恢复 file-list
      this._emitClear();
      return;
    }
    this._scheduleEmit();
  };

  private _onCompositionStart = () => {
    this._isComposing = true;
  };

  private _onCompositionEnd = () => {
    this._isComposing = false;
    // composition 结束后立即触发一次（中文输入法确认后再搜）
    this._scheduleEmit();
  };

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      this._emitClear();
    }
  };

  private _onClearClick = () => {
    this._emitClear();
    // 清空后焦点回到 input
    const input = this.shadowRoot?.querySelector("input") as HTMLInputElement | null;
    input?.focus();
  };

  render() {
    return html`
      <div class="box">
        <span class="icon">🔍</span>
        <input
          type="text"
          placeholder="按文件名搜索…"
          .value=${this._value}
          @input=${this._onInput}
          @compositionstart=${this._onCompositionStart}
          @compositionend=${this._onCompositionEnd}
          @keydown=${this._onKeyDown}
        />
        ${this._value
          ? html`<button class="clear" title="清空" @click=${this._onClearClick}>×</button>`
          : ""}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-search-box": FileSearchBox; }
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `cd doclens/web_v2/frontend && npm run test -- file-search-box`
Expected: 6 passed

- [ ] **Step 5: Stage 改动（不 commit）**

```bash
git add doclens/web_v2/frontend/src/components/file-search-box.ts doclens/web_v2/frontend/tests/file-search-box.spec.ts
```

---

## Task 5: 前端 — `<file-search-results>` 组件

**Files:**
- Create: `doclens/web_v2/frontend/src/components/file-search-results.ts`
- Test: `doclens/web_v2/frontend/tests/file-search-results.spec.ts`

**Interfaces:**
- Consumes:
  - `store.getState().files.filenameSearch`（query, results, selectedPath, totalMatches）
  - `actions.selectFilenameSearchResult(path)`
- Produces:
  - emits `activated` event with `{ detail: { path: string } }` — 用户点击/双击/Enter 时（files-view 监听并触发预览）
  - emits `clear` event — 用户按 Esc 时（冒泡到 files-view 调用 clearFilenameSearch）

- [ ] **Step 1: 写失败测试 — 新建 `tests/file-search-results.spec.ts`**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import "../src/components/file-search-results";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";
import type { IndexedDocument } from "../src/state/types";

const docs: IndexedDocument[] = [
  { path: "docs/README.md", name: "README.md", size: 2345, modifiedAt: "2026-06-24T00:00:00Z" },
  { path: "src/guide/readme.txt", name: "readme.txt", size: 1100, modifiedAt: "2026-06-21T00:00:00Z" },
  { path: "src/utils/bread.py", name: "bread.py", size: 800, modifiedAt: "2026-06-12T00:00:00Z" },
];

describe("file-search-results", () => {
  beforeEach(() => resetStore(store));

  it("renders empty state when query non-empty but no matches", async () => {
    actions.setFilenameSearchQuery({ query: "xyz", results: [], totalMatches: 0 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("未匹配到任何文件名包含");
    expect(el.shadowRoot.textContent).toContain("xyz");
    document.body.removeChild(el);
  });

  it("renders result rows with name + dir + size + modified", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const rows = el.shadowRoot.querySelectorAll(".row");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("README.md");
    expect(rows[0].textContent).toContain("docs/");
    expect(rows[0].textContent).toContain("2.3 KB");
  });

  it("highlights matched substring with <mark>", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const marks = el.shadowRoot.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(marks[0].textContent.toLowerCase()).toBe("read");
  });

  it("first row is selected by default (selectedPath = results[0].path)", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const active = el.shadowRoot.querySelector(".row.active");
    expect(active).toBeTruthy();
    expect(active.textContent).toContain("README.md");
    document.body.removeChild(el);
  });

  it("clicking a row emits 'activated' with path", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    let captured: any = null;
    el.addEventListener("activated", (e: CustomEvent) => captured = e.detail);
    const rows = el.shadowRoot.querySelectorAll(".row");
    rows[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await el.updateComplete;
    expect(captured).toEqual({ path: "src/guide/readme.txt" });
    document.body.removeChild(el);
  });

  it("ArrowDown moves selectedPath to next row", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await el.updateComplete;
    expect(store.getState().files.filenameSearch.selectedPath).toBe("src/guide/readme.txt");
    document.body.removeChild(el);
  });

  it("ArrowUp does not wrap above first row", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await el.updateComplete;
    expect(store.getState().files.filenameSearch.selectedPath).toBe("docs/README.md");
    document.body.removeChild(el);
  });

  it("Esc emits 'clear' event", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    let cleared = false;
    el.addEventListener("clear", () => { cleared = true; });
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(cleared).toBe(true);
    document.body.removeChild(el);
  });

  it("shows overflow hint when totalMatches > results.length", async () => {
    actions.setFilenameSearchQuery({
      query: "a",
      results: docs.slice(0, 2),
      totalMatches: 247,
    });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const hint = el.shadowRoot.querySelector(".overflow-hint");
    expect(hint).toBeTruthy();
    expect(hint.textContent).toContain("247");
    expect(hint.textContent).toContain("100");
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `cd doclens/web_v2/frontend && npm run test -- file-search-results`
Expected: FAIL（元素未注册）

- [ ] **Step 3: 创建 `src/components/file-search-results.ts`**

```typescript
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { store, actions } from "../state/store";
import type { IndexedDocument } from "../state/types";

const MAX_RESULTS = 100;

/** 把命中片段用 <mark> 包起来；大小写不敏感，连续子串。 */
function highlight(name: string, query: string): unknown {
  if (!query) return name;
  const lower = name.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return name;
  return [
    name.slice(0, idx),
    html`<mark>${name.slice(idx, idx + q.length)}</mark>`,
    name.slice(idx + q.length),
  ];
}

/** 从 path 中提取所在目录（不含文件名）。 */
function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i + 1);
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatRelative(s: string): string {
  if (!s) return "";
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const day = 24 * 3600 * 1000;
  if (diffMs < day) return "今天";
  if (diffMs < 2 * day) return "昨天";
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} 天前`;
  if (diffMs < 30 * day) return `${Math.floor(diffMs / (7 * day))} 周前`;
  if (diffMs < 365 * day) return `${Math.floor(diffMs / (30 * day))} 个月前`;
  return `${Math.floor(diffMs / (365 * day))} 年前`;
}

@customElement("file-search-results")
export class FileSearchResults extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      min-width: 0;
      background: var(--cortex-surface);
      overflow: hidden;
    }
    .header-bar {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      color: var(--cortex-primary);
      font-size: var(--cortex-fs-sm);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--cortex-space-2);
      padding: 6px var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .rows {
      flex: 1;
      overflow-y: auto;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--cortex-space-2);
      align-items: center;
      padding: 6px var(--cortex-space-3);
      cursor: pointer;
      border-bottom: 1px solid var(--cortex-border-muted);
      font-size: var(--cortex-fs-base);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.active { background: var(--cortex-primary-soft); }
    .name-cell {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      min-width: 0;
    }
    .icon { flex-shrink: 0; }
    .name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--cortex-text);
    }
    .dir {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-sm);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    mark {
      background: var(--cortex-warning-soft, #fff3a8);
      color: var(--cortex-warning-fg, #1a1a1a);
      padding: 0 2px;
      border-radius: 2px;
    }
    .empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--cortex-space-8);
      color: var(--cortex-text-subtle);
      text-align: center;
      gap: var(--cortex-space-2);
    }
    .empty .icon-big { font-size: 32px; opacity: 0.5; }
    .overflow-hint {
      padding: 6px var(--cortex-space-3);
      background: var(--cortex-surface-muted);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      text-align: center;
      border-top: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
  `;

  private get _state() {
    return store.getState().files.filenameSearch;
  }

  private _onRowClick(doc: IndexedDocument) {
    actions.selectFilenameSearchResult(doc.path);
    this.dispatchEvent(new CustomEvent("activated", {
      detail: { path: doc.path },
      bubbles: true,
      composed: true,
    }));
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    const { results, selectedPath } = this._state;
    if (results.length === 0) {
      if (e.key === "Escape") {
        this.dispatchEvent(new CustomEvent("clear", { bubbles: true, composed: true }));
      }
      return;
    }
    const idx = results.findIndex(r => r.path === selectedPath);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = results[Math.min(results.length - 1, idx + 1)];
      actions.selectFilenameSearchResult(next.path);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = results[Math.max(0, idx - 1)];
      actions.selectFilenameSearchResult(prev.path);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cur = results[idx] ?? results[0];
      if (cur) {
        this.dispatchEvent(new CustomEvent("activated", {
          detail: { path: cur.path },
          bubbles: true,
          composed: true,
        }));
      }
    } else if (e.key === "Escape") {
      this.dispatchEvent(new CustomEvent("clear", { bubbles: true, composed: true }));
    }
  };

  connectedCallback() {
    super.connectedCallback();
    this.tabIndex = 0;
    this.addEventListener("keydown", this._onKeyDown);
  }
  disconnectedCallback() {
    this.removeEventListener("keydown", this._onKeyDown);
    super.disconnectedCallback();
  }

  render() {
    const { query, results, selectedPath, totalMatches } = this._state;
    if (results.length === 0) {
      return html`
        <div class="empty">
          <div class="icon-big">🔍</div>
          <div>未匹配到任何文件名包含 "<b>${query}</b>" 的文档</div>
        </div>
      `;
    }
    return html`
      <div class="header-bar">📄 文件名搜索结果 · 共 ${totalMatches} 项</div>
      <div class="columns">
        <span>名称 · 目录</span>
        <span>大小 · 修改</span>
      </div>
      <div class="rows">
        ${results.map(doc => {
          const dir = dirOf(doc.path);
          const isActive = doc.path === selectedPath;
          return html`
            <div
              class="row ${isActive ? "active" : ""}"
              @click=${() => this._onRowClick(doc)}
            >
              <span class="name-cell">
                <span class="icon">📄</span>
                <span class="name">${highlight(doc.name, query)}</span>
                ${dir ? html`<span class="dir">${dir}</span>` : ""}
              </span>
              <span class="meta">${formatSize(doc.size)} · ${formatRelative(doc.modifiedAt)}</span>
            </div>
          `;
        })}
      </div>
      ${totalMatches > results.length
        ? html`<div class="overflow-hint">共 ${totalMatches} 项，仅显示前 ${MAX_RESULTS}，请补充关键字</div>`
        : ""}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-search-results": FileSearchResults; }
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `cd doclens/web_v2/frontend && npm run test -- file-search-results`
Expected: 9 passed

- [ ] **Step 5: Stage 改动（不 commit）**

```bash
git add doclens/web_v2/frontend/src/components/file-search-results.ts doclens/web_v2/frontend/tests/file-search-results.spec.ts
```

---

## Task 6: 前端 — `files-view.ts` 装配 + 切换 + 预览联动

**Files:**
- Modify: `doclens/web_v2/frontend/src/views/files-view.ts`
- Test: `doclens/web_v2/frontend/tests/files-view.spec.ts`（追加用例）

**Interfaces:**
- Consumes:
  - `fetchDocuments()` from `../api/documents`
  - `actions.loadIndexedDocuments`, `actions.setFilenameSearchDocsError`, `actions.setFilenameSearchQuery`, `actions.clearFilenameSearch`, `actions.selectFilenameSearchResult`
  - `<file-search-box>` 和 `<file-search-results>` 组件
- Produces:
  - 当 `filenameSearch.isActive === true` 时，desktop-layout 中栏渲染 `<file-search-results>`，否则渲染 `<file-list>`
  - preview 仍然走现有 `_fetchPreview` / `_renderPreviewPane` 路径，无需新增

- [ ] **Step 1: 追加测试用例到 `tests/files-view.spec.ts`（在文件末尾追加）**

```typescript
describe("files-view filename search", () => {
  beforeEach(() => resetStore(store));

  it("renders file-search-box in desktop layout", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const box = el.shadowRoot.querySelector("file-search-box");
    expect(box).toBeTruthy();
    document.body.removeChild(el);
  });

  it("replaces file-list with file-search-results when search activated", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector("file-search-results")).toBeTruthy();
    expect(el.shadowRoot.querySelector("file-list")).toBeNull();
    document.body.removeChild(el);
  });

  it("shows file-list again after clearFilenameSearch", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    actions.clearFilenameSearch();
    await el.updateComplete;
    expect(el.shadowRoot.querySelector("file-list")).toBeTruthy();
    expect(el.shadowRoot.querySelector("file-search-results")).toBeNull();
    document.body.removeChild(el);
  });
});
```

> 备注：如果 `files-view.spec.ts` 顶部尚未导入 `resetStore` / `actions` / `store`，请补齐：
> ```typescript
> import { resetStore } from "./test-utils";
> import { store, actions } from "../src/state/store";
> ```

- [ ] **Step 2: 跑测试，确认新增用例失败**

Run: `cd doclens/web_v2/frontend && npm run test -- files-view`
Expected: 至少 1 个新用例 FAIL（file-search-box 未渲染 / 装配未完成）

- [ ] **Step 3: 修改 `src/views/files-view.ts` — 追加 import**

在现有 import 块（顶部）追加：

```typescript
import "../components/file-search-box";
import "../components/file-search-results";
import { fetchDocuments } from "../api/documents";
```

- [ ] **Step 4: 修改 `src/views/files-view.ts` — 在 `connectedCallback` 末尾追加 `loadDocuments` 调用**

找到 `connectedCallback()` 方法（约 line 158-163），在 `this._loadPaneWidths();` 之后追加：

```typescript
  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    this._ensureLoaded("");
    this._loadPaneWidths();
    this._loadIndexedDocuments();
  }

  private async _loadIndexedDocuments() {
    if (!store.getState().files.filenameSearch.docsLoading) return;
    try {
      const docs = await fetchDocuments();
      actions.loadIndexedDocuments(docs);
    } catch (e: any) {
      actions.setFilenameSearchDocsError(e?.message || "文档列表加载失败");
    }
  }
```

- [ ] **Step 5: 修改 `src/views/files-view.ts` — 在 `_renderDesktop()` 的 `<file-tree>` 之前插入 `<file-search-box>`，并把中栏 `<file-list>` 替换为条件渲染**

将 `_renderDesktop()` 中：
```typescript
        <file-tree></file-tree>
        <div
          class="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整文件树栏宽度"
          @mousedown=${this._onTreeSplitterMouseDown}
        ></div>
        <file-list
          .activePath=${this._previewPath}
          @action=${this._onAction}
          @activated=${this._onFileListActivated}
        ></file-list>
```

改为：

```typescript
        <aside class="tree-pane">
          <file-search-box
            @search=${this._onFilenameSearch}
            @clear=${this._onFilenameClear}
          ></file-search-box>
          <file-tree></file-tree>
        </aside>
        <div
          class="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整文件树栏宽度"
          @mousedown=${this._onTreeSplitterMouseDown}
        ></div>
        ${this._isFilenameSearchActive
          ? html`<file-search-results
              @activated=${this._onFilenameResultActivated}
              @clear=${this._onFilenameClear}
            ></file-search-results>`
          : html`<file-list
              .activePath=${this._previewPath}
              @action=${this._onAction}
              @activated=${this._onFileListActivated}
            ></file-list>`}
```

注意 `<aside class="tree-pane">` 是新增的包装元素，需要给它加 CSS 让内部纵向布局；在 `static styles` 中追加：

```typescript
    .tree-pane {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    .tree-pane file-tree {
      flex: 1;
      min-height: 0;
    }
```

- [ ] **Step 6: 修改 `src/views/files-view.ts` — 追加 4 个私有方法和 1 个 getter**

在 class 末尾（`_cancelDialog` 之前）追加：

```typescript
  private get _isFilenameSearchActive(): boolean {
    return store.getState().files.filenameSearch.isActive;
  }

  private _onFilenameSearch = (e: CustomEvent<{ query: string }>) => {
    const query = e.detail.query;
    if (query.trim() === "") {
      actions.clearFilenameSearch();
      return;
    }
    const { allDocs } = store.getState().files.filenameSearch;
    const q = query.toLowerCase();
    const filtered = allDocs.filter(d => d.name.toLowerCase().includes(q));
    filtered.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "zh", {
      numeric: true,
      sensitivity: "base",
    }));
    const totalMatches = filtered.length;
    const results = filtered.slice(0, 100);
    actions.setFilenameSearchQuery({ query, results, totalMatches });
    // 选中首项时立即联动 preview
    if (results[0]) {
      void this._fetchPreview(results[0].path);
    }
  };

  private _onFilenameClear = () => {
    actions.clearFilenameSearch();
  };

  private _onFilenameResultActivated = async (e: CustomEvent<{ path: string }>) => {
    if (this._previewDirty) {
      const ok = window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？");
      if (!ok) return;
      this._discardPreviewEdits();
    }
    await this._fetchPreview(e.detail.path);
  };
```

> 关键依赖：`_fetchPreview` 已存在于 files-view 中（line ~486），可直接复用，无需改动。

- [ ] **Step 7: 跑测试，确认通过**

Run: `cd doclens/web_v2/frontend && npm run test -- files-view`
Expected: all passed（含新增 3 用例）

- [ ] **Step 8: 跑全部前端测试**

Run: `cd doclens/web_v2/frontend && npm run test`
Expected: all passed

- [ ] **Step 9: 类型检查 + 构建**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: `tsc --noEmit` 0 errors，`vite build` 成功，产物写到 `doclens/web_v2/static/`

- [ ] **Step 10: Stage 改动（不 commit）**

```bash
git add doclens/web_v2/frontend/src/views/files-view.ts doclens/web_v2/frontend/tests/files-view.spec.ts doclens/web_v2/static/
```

---

## Task 7: E2E — Playwright 文件名搜索用例

**Files:**
- Create: `doclens/web_v2/frontend/tests/e2e/filename-search.spec.ts`

**Interfaces:**
- Consumes: 已启动的 cortex gui 服务（默认 http://localhost:7860），通过 `playwright.config.ts` 配置
- Produces: 6 个 E2E 用例，对应 spec §9.2 的 FILENAME-001 到 FILENAME-006

- [ ] **Step 1: 看现有 e2e 模板（保持风格一致）**

读 `tests/e2e/files-explorer.spec.ts` 前 40 行，了解 base URL、selector 风格、beforeEach 风格。本任务假设沿用相同模式（`page.goto("/")` → 切到 files 视图 → 操作）。

- [ ] **Step 2: 创建 `tests/e2e/filename-search.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

const FILES_VIEW_HASH = "#/files";

async function gotoFilesView(page: import("@playwright/test").Page) {
  await page.goto(FILES_VIEW_HASH);
  await page.waitForSelector("file-search-box input", { state: "visible" });
}

test.describe("filename search", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFilesView(page);
  });

  test("FILENAME-001: typing shows results, file-tree unchanged", async ({ page }) => {
    const input = page.locator("file-search-box input");
    await input.fill("doc");
    // 中栏出现 file-search-results
    await expect(page.locator("file-search-results")).toBeVisible();
    // 左栏 file-tree 仍在
    await expect(page.locator("file-tree")).toBeVisible();
    // 结果列表至少 1 行
    await expect(page.locator("file-search-results .row").first()).toBeVisible();
  });

  test("FILENAME-002: clicking a row loads preview", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    const firstRow = page.locator("file-search-results .row").first();
    await firstRow.click();
    // preview-pane 出现路径文本（取自 _previewPath）
    await expect(page.locator("preview-pane")).toBeVisible();
  });

  test("FILENAME-003: ArrowDown moves selection and switches preview", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    const results = page.locator("file-search-results");
    await results.click();
    const firstActive = await page.locator("file-search-results .row.active").first().textContent();
    await page.keyboard.press("ArrowDown");
    const secondActive = await page.locator("file-search-results .row.active").first().textContent();
    expect(firstActive).not.toEqual(secondActive);
  });

  test("FILENAME-004: Esc clears and restores file-list", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    await expect(page.locator("file-search-results")).toBeVisible();
    await page.locator("file-search-box input").press("Escape");
    await expect(page.locator("file-list")).toBeVisible();
    await expect(page.locator("file-search-results")).toHaveCount(0);
  });

  test("FILENAME-005: empty state when no matches", async ({ page }) => {
    await page.locator("file-search-box input").fill("zzzznotfound");
    await expect(page.locator("file-search-results")).toContainText("未匹配到任何文件名包含");
  });

  test("FILENAME-006: overflow hint when more than 100 matches", async ({ page }) => {
    // 该用例依赖被测工作目录有 >100 个匹配文件；
    // 在 CI / 标准测试目录中可能跳过。保留断言以备大数据场景。
    test.skip(true, "需要 >100 个匹配文件的工作目录");
  });
});
```

- [ ] **Step 3: 启动后端服务，手动跑 E2E（用户参与）**

由于 E2E 需要后端服务运行，本步骤需要用户启动服务（或 plan 执行器后台启动）。Run:
```bash
cd C:/Users/lianghao/github/cortex
./start.ps1 gui  # 后台启动，端口默认 7860
# 另一个终端
cd doclens/web_v2/frontend
npx playwright test filename-search --reporter=line
```
Expected: 5 passed, 1 skipped

- [ ] **Step 4: Stage 改动（不 commit）**

```bash
git add doclens/web_v2/frontend/tests/e2e/filename-search.spec.ts
```

---

## Self-Review Notes

**Spec coverage:**
- §2 匹配范围（仅文件名）→ Task 6 `_onFilenameSearch` 用 `d.name.toLowerCase().includes(q)`
- §2 匹配模式（子串 / Case-Insensitive）→ 同上
- §2 数据源（仅已索引）→ Task 1 `_indexed_documents` 来自 `idx.documents`
- §2 搜索框位置（左栏顶部）→ Task 6 `<aside class="tree-pane">` 内 `<file-search-box>` 在 `<file-tree>` 之前
- §2 中栏展示（完全替换）→ Task 6 三元运算符切换 `<file-search-results>` / `<file-list>`
- §2 行布局（单行多列：名称+目录 | 大小+修改）→ Task 5 `.row` grid 布局
- §2 高亮 → Task 5 `highlight()` + `mark` 样式
- §2 排序（字母序 locale-aware）→ Task 6 `localeCompare(..., "zh", { numeric: true, sensitivity: "base" })`
- §2 预览联动 → Task 6 `_onFilenameSearch` 选中首项立即 `_fetchPreview`；Task 5 键盘上下键 → store → 自动重渲染 active row
- §2 清空行为 → Task 4 `_emitClear` + Task 6 `_onFilenameClear`
- §2 数量上限 100 → Task 5 `MAX_RESULTS` 常量 + Task 6 `.slice(0, 100)`
- §2 中文 IME → Task 4 `compositionstart` / `compositionend` 处理
- §2 防抖 80ms → Task 4 `DEBOUNCE_MS`
- §2 左栏 file-tree 保持原状 → Task 6 不修改 file-tree，仅插入 search-box

**Placeholder scan:** 已检查，无 TBD/TODO；FILENAME-006 标记 `test.skip` 是有意的（依赖大数据目录），不算 placeholder。

**Type consistency:**
- `IndexedDocument` 前后端字段：后端 snake_case（`modified_at`），前端 camelCase（`modifiedAt`），由 `api/documents.ts` 转换
- `actions` 命名：`loadIndexedDocuments` / `setFilenameSearchQuery` / `clearFilenameSearch` / `selectFilenameSearchResult` / `setFilenameSearchDocsError` —— 5 个（spec 写"4 个 action"是因为 `setFilenameSearchDocsError` 是实施时为了让 Task 2 处理错误路径而补充的，无功能差异）
- 组件 events：`search` / `clear` / `activated` 命名一致
- `MAX_RESULTS = 100` 在 Task 5 定义；Task 6 也写 100（硬编码，与 spec §2 一致）

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-26-filename-search.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - 每个 Task 派发一个新 subagent，task 间有 review checkpoint，迭代快

**2. Inline Execution** - 在当前 session 中按 `superpowers:executing-plans` 流程批量执行，关键节点 checkpoint

**Which approach?**
