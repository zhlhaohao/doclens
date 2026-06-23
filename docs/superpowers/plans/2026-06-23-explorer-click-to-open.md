# Explorer 点击即打开 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 explorer tab 中，单击文件夹直接进入；单击文件在最右 pane 预览（复用 search tab 的 `<preview-pane>`）；多选改为复选框列。

**Architecture:** 把 search-view 中的 `_fetchAndShowPreview` + `isFullFilePreview` 抽到共享模块 `src/api/preview.ts`。file-row 加复选框列并改写点击语义：行体单击派发 `activated`（文件夹=进入；文件=预览），复选框单击派发 `checked`。files-view 把 `<file-detail>` 替换为 `<preview-pane>`，新增本地 preview state。删除 file-detail 组件。

**Tech Stack:** Lit + Lit decorators, TypeScript, Vitest, fetch API

**Spec:** [docs/superpowers/specs/2026-06-23-explorer-click-to-open-design.md](../specs/2026-06-23-explorer-click-to-open-design.md)

---

## File Structure

| 文件 | 角色 |
|------|------|
| `cortex/web_v2/frontend/src/api/preview.ts` | **修改** — 新增 `fetchPreview`、`isFullFilePreview`、`PreviewFetchError` |
| `cortex/web_v2/frontend/src/views/search-view.ts` | **修改** — 替换内联 fetch 逻辑为 `fetchPreview` 调用，移除 `isFullFilePreview` 局部定义 |
| `cortex/web_v2/frontend/src/components/file-row.ts` | **修改** — 加复选框列；行体单击改为派发 `activated`；新增 `checked` 事件 |
| `cortex/web_v2/frontend/src/components/file-list.ts` | **修改** — `_onRowClicked` → `_onRowChecked`；表头加全选复选框 |
| `cortex/web_v2/frontend/src/views/files-view.ts` | **修改** — `<file-detail>` → `<preview-pane>`；新增 preview state + `_fetchPreview` + dirty 处理 |
| `cortex/web_v2/frontend/src/components/file-detail.ts` | **删除** |
| `cortex/web_v2/frontend/tests/file-detail.spec.ts` | **删除** |
| `cortex/web_v2/frontend/tests/api-preview.spec.ts` | **修改** — 新增 `fetchPreview` 测试 |
| `cortex/web_v2/frontend/tests/file-row.spec.ts` | **新建** — 行体单击 + 复选框单击事件契约 |
| `cortex/web_v2/frontend/tests/file-list.spec.ts` | **修改** — 新增复选框全选、checked 事件转发测试 |
| `cortex/web_v2/frontend/tests/files-view.spec.ts` | **修改** — 新增单击文件触发 fetchPreview 测试 |

---

## Task 1：在 `src/api/preview.ts` 新增 `fetchPreview` + `isFullFilePreview`

**Files:**
- Modify: `cortex/web_v2/frontend/src/api/preview.ts`
- Test: `cortex/web_v2/frontend/tests/api-preview.spec.ts`

- [ ] **Step 1.1：写失败测试（追加到 `tests/api-preview.spec.ts`）**

```typescript
import { savePreview, PreviewSaveError, fetchPreview, isFullFilePreview } from "../src/api/preview";

// ... existing tests ...

describe("isFullFilePreview", () => {
  it("returns true for .md/.pdf/.docx/.xlsx/.xlsm/.xltx/.xltm/.csv", () => {
    for (const p of ["/x.md", "a.pdf", "b.docx", "c.xlsx", "d.xlsm", "e.xltx", "f.xltm", "g.csv"]) {
      expect(isFullFilePreview(p)).toBe(true);
    }
  });
  it("returns false for other extensions", () => {
    for (const p of ["x.py", "y.txt", "z.html", "noext"]) {
      expect(isFullFilePreview(p)).toBe(false);
    }
  });
  it("is case-insensitive on suffix", () => {
    expect(isFullFilePreview("X.PDF")).toBe(true);
    expect(isFullFilePreview("X.Md")).toBe(true);
  });
});

describe("fetchPreview", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it("returns ok result with content/language/writable on 200", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn(async (url) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          path: "a.md", content: "# hi", language: "markdown",
          line_range: null, highlights: [], writable: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const r = await fetchPreview("a.md");
    expect(capturedUrl).toBe("/api/preview?path=a.md");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content).toBe("# hi");
      expect(r.language).toBe("markdown");
      expect(r.writable).toBe(true);
      expect(r.pages).toBe(null);
    }
  });

  it("returns notIndexed=true when backend returns 404 NOT_INDEXED", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ code: "NOT_INDEXED", detail: "未索引" }),
        { status: 404 },
      ),
    ) as unknown as typeof fetch;

    const r = await fetchPreview("unindexed.pdf");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.notIndexed).toBe(true);
    }
  });

  it("returns notIndexed=false for other errors", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ code: "FILE_NOT_FOUND", detail: "missing" }),
        { status: 404 },
      ),
    ) as unknown as typeof fetch;

    const r = await fetchPreview("missing.md");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.notIndexed).toBe(false);
      expect(r.message).toContain("missing");
    }
  });
});
```

- [ ] **Step 1.2：运行测试确认失败**

```bash
npx vitest run tests/api-preview.spec.ts
```
Expected: FAIL — `fetchPreview` 和 `isFullFilePreview` 不存在（import 报错）。

- [ ] **Step 1.3：在 `src/api/preview.ts` 追加实现**

```typescript
// ---------------------------------------------------------------------------
// GET /api/preview
// ---------------------------------------------------------------------------

/** 这些后缀的预览走 md 渲染且需要全文件内容（与后端 BINARY_PREVIEW_EXTS 对齐）。 */
const FULL_FILE_PREVIEW_EXTS = [
  ".md", ".pdf", ".docx", ".xlsx", ".xlsm", ".xltx", ".xltm", ".csv",
];

export function isFullFilePreview(path: string): boolean {
  const lower = path.toLowerCase();
  return FULL_FILE_PREVIEW_EXTS.some((ext) => lower.endsWith(ext));
}

export type PreviewFetchResult =
  | {
      ok: true;
      path: string;
      content: string;
      language: string;
      writable: boolean;
      pages: PageMarker[] | null;
    }
  | { ok: false; notIndexed: boolean; message: string };

/**
 * 调用 GET /api/preview 获取预览内容。
 *
 * - 成功：返回 { ok: true, ... }
 * - 404 NOT_INDEXED：返回 { ok: false, notIndexed: true }
 * - 其他错误：返回 { ok: false, notIndexed: false, message }
 *
 * 不会抛异常 —— 调用方用判别联合处理。
 */
export async function fetchPreview(path: string): Promise<PreviewFetchResult> {
  const params = new URLSearchParams({ path });
  try {
    const res = await fetch(`/api/preview?${params}`);
    if (res.ok) {
      const body = await res.json();
      return {
        ok: true,
        path: body.path,
        content: body.content,
        language: body.language,
        writable: body.writable ?? false,
        pages: body.pages ?? null,
      };
    }
    const err = await res.json().catch(() => ({ code: "UNKNOWN", detail: "" }));
    const notIndexed = err.code === "NOT_INDEXED";
    return {
      ok: false,
      notIndexed,
      message: err.detail || err.code || `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      notIndexed: false,
      message: (e as Error).message || "网络错误",
    };
  }
}
```

- [ ] **Step 1.4：运行测试确认通过**

```bash
npx vitest run tests/api-preview.spec.ts
```
Expected: PASS — 全部测试通过（包括原有 savePreview 测试 + 新增 fetchPreview/isFullFilePreview 测试）。

- [ ] **Step 1.5：commit**

```bash
git add cortex/web_v2/frontend/src/api/preview.ts cortex/web_v2/frontend/tests/api-preview.spec.ts
git commit -m "feat(web): add fetchPreview and isFullFilePreview to preview api client"
```

---

## Task 2：重构 search-view 使用 `fetchPreview`

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/search-view.ts:14-20, 345-376`

- [ ] **Step 2.1：替换 import 与常量**

定位到 `cortex/web_v2/frontend/src/views/search-view.ts` 第 14-20 行：

```typescript
/** 这些后缀的预览走 md 渲染且需要全文件内容（与后端 BINARY_PREVIEW_EXTS 对齐） */
const FULL_FILE_PREVIEW_EXTS = [".md", ".pdf", ".docx", ".xlsx", ".xlsm", ".xltx", ".xltm", ".csv"];

function isFullFilePreview(path: string): boolean {
  const lower = path.toLowerCase();
  return FULL_FILE_PREVIEW_EXTS.some((ext) => lower.endsWith(ext));
}
```

删除整段，并把第 8 行的 `import type { PageMarker } from "../api/preview";` 改为：

```typescript
import { fetchPreview, isFullFilePreview } from "../api/preview";
import type { PageMarker } from "../api/preview";
```

- [ ] **Step 2.2：重写 `_fetchAndShowPreview`**

定位到第 345-376 行的 `_fetchAndShowPreview` 方法，替换为：

```typescript
private async _fetchAndShowPreview(r: SearchResult) {
  this.previewError = null;
  const fullFile = isFullFilePreview(r.path);
  // search hit 高亮：非全文件预览时，传 start_line/end_line 给后端
  const line = (r.line as number | null) ?? null;
  let result;
  if (line && !fullFile) {
    // 范围预览 —— 直接 fetch（fetchPreview 暂不支持 line range）
    result = await this._fetchPreviewRange(r.path, line);
  } else {
    result = await fetchPreview(r.path);
  }
  if (result.ok) {
    this.previewContent = result.content;
    this.previewPath = result.path;
    this.previewLanguage = result.language;
    this.previewLine = line;
    this.previewWritable = result.writable;
    this.previewPages = result.pages;
  } else if (result.notIndexed) {
    this.previewError = "NOT_INDEXED";
    this.previewContent = "";
    this.previewPath = r.path;
    this.previewWritable = false;
    this.previewPages = null;
  }
}

/** search hit 范围预览（line 周围 ±10/+20 行）。
 *  fetchPreview 不支持 line range，所以这里独立保留。 */
private async _fetchPreviewRange(
  path: string,
  line: number,
): Promise<{ ok: true; content: string; language: string; writable: boolean; pages: PageMarker[] | null } | { ok: false; notIndexed: boolean }> {
  const params = new URLSearchParams({ path });
  params.set("start_line", String(Math.max(1, line - 10)));
  params.set("end_line", String(line + 20));
  try {
    const res = await fetch(`/api/preview?${params}`);
    if (res.ok) {
      const body = await res.json();
      return {
        ok: true,
        content: body.content,
        language: body.language,
        writable: body.writable ?? false,
        pages: body.pages ?? null,
      };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, notIndexed: err.code === "NOT_INDEXED" };
  } catch {
    return { ok: false, notIndexed: false };
  }
}
```

- [ ] **Step 2.3：同步 `_reloadPreview` 使用 fetchPreview**

定位到 `_reloadPreview` 方法（约 442-458 行），替换为：

```typescript
private async _reloadPreview() {
  if (!this.previewPath) return;
  const r = await fetchPreview(this.previewPath);
  if (r.ok) {
    this.previewContent = r.content;
    this.previewLanguage = r.language;
    this.previewWritable = r.writable;
    this.previewPages = r.pages;
  }
}
```

- [ ] **Step 2.4：运行所有 search 相关测试验证无回归**

```bash
npx vitest run tests/search-view.spec.ts tests/search-view-edit.spec.ts tests/search-view-upload.spec.ts tests/preview-pane.spec.ts
```
Expected: PASS — 全部原有测试通过。

- [ ] **Step 2.5：commit**

```bash
git add cortex/web_v2/frontend/src/views/search-view.ts
git commit -m "refactor(web): search-view uses shared fetchPreview helper"
```

---

## Task 3：file-row 加复选框 + 单击派发 activated

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/file-row.ts`
- Test: `cortex/web_v2/frontend/tests/file-row.spec.ts` (新建)

- [ ] **Step 3.1：写失败测试（新建 `tests/file-row.spec.ts`）**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import "../src/components/file-row";
import type { FileEntry } from "../src/api/files";

const fileEntry: FileEntry = {
  name: "a.md", path: "a.md", is_dir: false, size: 100,
  modified_at: "2026-06-22T00:00:00Z", indexed: true, writable: true, has_child_dirs: false,
};
const dirEntry: FileEntry = {
  name: "docs", path: "docs", is_dir: true, size: 0,
  modified_at: "2026-06-22T00:00:00Z", indexed: false, writable: true, has_child_dirs: true,
};

function makeRow(entry: FileEntry, selected = false) {
  const el = document.createElement("file-row") as any;
  el.entry = entry;
  el.selected = selected;
  document.body.appendChild(el);
  return el;
}

describe("file-row", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("row body click dispatches activated with is_dir=false for files", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    let captured: any = null;
    el.addEventListener("activated", (e: Event) => captured = (e as CustomEvent).detail);
    el.shadowRoot.querySelector(".row").click();
    expect(captured).toEqual({ path: "a.md", is_dir: false });
  });

  it("row body click dispatches activated with is_dir=true for folders", async () => {
    const el = makeRow(dirEntry);
    await el.updateComplete;
    let captured: any = null;
    el.addEventListener("activated", (e: Event) => captured = (e as CustomEvent).detail);
    el.shadowRoot.querySelector(".row").click();
    expect(captured).toEqual({ path: "docs", is_dir: true });
  });

  it("checkbox click dispatches checked and does not activate", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    let activated = null;
    let checked = null;
    el.addEventListener("activated", (e: Event) => activated = (e as CustomEvent).detail);
    el.addEventListener("checked", (e: Event) => checked = (e as CustomEvent).detail);
    const ev = new MouseEvent("click", { bubbles: true, ctrlKey: true });
    el.shadowRoot.querySelector("input[type='checkbox']").dispatchEvent(ev);
    expect(activated).toBeNull();
    expect(checked).toEqual({ path: "a.md", ctrl: true, shift: false });
  });

  it("row body click does not dispatch checked", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    let checked = null;
    el.addEventListener("checked", (e: Event) => checked = (e as CustomEvent).detail);
    el.shadowRoot.querySelector(".row").click();
    expect(checked).toBeNull();
  });

  it("reflects selected state on checkbox", async () => {
    const el = makeRow(fileEntry, true);
    await el.updateComplete;
    const cb = el.shadowRoot.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });
});
```

- [ ] **Step 3.2：运行测试确认失败**

```bash
npx vitest run tests/file-row.spec.ts
```
Expected: FAIL — `.row` 的单击现在派发 `clicked` 不是 `activated`；没有 checkbox 元素。

- [ ] **Step 3.3：重写 `src/components/file-row.ts`**

完整替换为：

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FileEntry } from "../api/files";

@customElement("file-row")
export class FileRow extends LitElement {
  static styles = css`
    :host { display: block; }
    .row {
      display: grid;
      grid-template-columns: 28px 20px 1fr 80px 140px 70px;
      gap: var(--cortex-space-2);
      align-items: center;
      padding: 6px var(--cortex-space-3);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.selected { background: var(--cortex-primary-soft); }
    .checkbox { display: flex; align-items: center; justify-content: center; }
    .icon { font-size: 14px; }
    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .size, .time {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      font-size: 10px;
      border-radius: var(--cortex-radius-sm);
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
    }
  `;

  @property({ type: Object }) entry!: FileEntry;
  @property({ type: Boolean }) selected = false;

  private _fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  private _fmtTime(s: string): string {
    if (!s) return "";
    try {
      return new Date(s).toLocaleString(undefined, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return ""; }
  }

  /** 行体单击 = 激活（文件夹=进入；文件=预览） */
  private _onRowClick() {
    this.dispatchEvent(new CustomEvent("activated", {
      detail: { path: this.entry.path, is_dir: this.entry.is_dir },
      bubbles: true, composed: true,
    }));
  }

  /** 复选框单击 = 多选（不触发 activated） */
  private _onCheckboxClick(e: MouseEvent) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("checked", {
      detail: {
        path: this.entry.path,
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
      },
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      <div
        class="row ${this.selected ? "selected" : ""}"
        @click=${this._onRowClick}>
        <span class="checkbox">
          <input
            type="checkbox"
            .checked=${this.selected}
            @click=${this._onCheckboxClick}
          />
        </span>
        <span class="icon">${this.entry.is_dir ? "📁" : "📄"}</span>
        <span class="name">${this.entry.name}</span>
        <span class="size">${this.entry.is_dir ? "" : this._fmtSize(this.entry.size)}</span>
        <span class="time">${this._fmtTime(this.entry.modified_at)}</span>
        <span>${!this.entry.is_dir && this.entry.indexed ? html`<span class="badge">已索引</span>` : ""}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-row": FileRow; }
}
```

- [ ] **Step 3.4：运行测试确认通过**

```bash
npx vitest run tests/file-row.spec.ts
```
Expected: PASS — 全部 5 个测试通过。

- [ ] **Step 3.5：commit**

```bash
git add cortex/web_v2/frontend/src/components/file-row.ts cortex/web_v2/frontend/tests/file-row.spec.ts
git commit -m "feat(web): file-row adds checkbox and activates on row body click"
```

---

## Task 4：file-list 改用 checked 事件 + 表头全选

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/file-list.ts`
- Test: `cortex/web_v2/frontend/tests/file-list.spec.ts`

- [ ] **Step 4.1：追加失败测试**

在 `tests/file-list.spec.ts` 末尾的 `});` 前追加：

```typescript
  it("forwards row 'checked' event to actions.selectEntry", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const row = el.shadowRoot.querySelector("file-row");
    expect(row).toBeTruthy();
    row.dispatchEvent(new CustomEvent("checked", {
      detail: { path: "a.md", ctrl: false, shift: false },
      bubbles: true, composed: true,
    }));
    expect(store.getState().files.selectedPaths).toEqual(["a.md"]);
    document.body.removeChild(el);
  });

  it("header select-all checkbox toggles all entries", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const headerCb = el.shadowRoot.querySelector(".select-all") as HTMLInputElement;
    expect(headerCb).toBeTruthy();
    headerCb.click();
    expect(store.getState().files.selectedPaths.sort()).toEqual(["a.md", "b.md", "docs"].sort());
    // 再点一次清空
    headerCb.click();
    expect(store.getState().files.selectedPaths).toEqual([]);
    document.body.removeChild(el);
  });
```

- [ ] **Step 4.2：运行测试确认失败**

```bash
npx vitest run tests/file-list.spec.ts
```
Expected: FAIL — `.select-all` 不存在；`@clicked` 监听还在，但新测试直接 dispatch `checked` CustomEvent 应该已能通过（因为 Lit 事件转发）。需要新增表头复选框。

- [ ] **Step 4.3：修改 `src/components/file-list.ts`**

替换整文件为：

```typescript
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { store, actions } from "../state/store";
import "./file-row";

@customElement("file-list")
export class FileList extends LitElement {
  static styles = css`
    :host {
      display: flex; flex-direction: column; flex: 1; min-height: 0;
      background: var(--cortex-surface);
    }
    .breadcrumb {
      display: flex; align-items: center; gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .breadcrumb .path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .up-btn {
      padding: 2px 8px;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      line-height: 1.4;
    }
    .up-btn:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .up-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar {
      display: flex; gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .toolbar button {
      padding: 6px 12px;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
    }
    .toolbar button:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar button.danger { color: var(--cortex-danger); }
    .header-row {
      display: grid;
      grid-template-columns: 28px 20px 1fr 80px 140px 70px;
      gap: var(--cortex-space-2);
      padding: 6px var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .select-all { display: flex; align-items: center; justify-content: center; }
    .rows { flex: 1; overflow-y: auto; }
    .empty {
      padding: var(--cortex-space-8);
      text-align: center;
      color: var(--cortex-text-subtle);
    }
  `;

  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
  }
  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  private _action(name: string) {
    this.dispatchEvent(new CustomEvent("action", {
      detail: { name },
      bubbles: true, composed: true,
    }));
  }

  private _onRowChecked(e: CustomEvent<{ path: string; ctrl: boolean; shift: boolean }>) {
    actions.selectEntry(e.detail.path, { ctrl: e.detail.ctrl, shift: e.detail.shift });
  }

  private _onSelectAll(e: Event) {
    const cb = e.target as HTMLInputElement;
    const { currentDir, treeCache, selectedPaths } = store.getState().files;
    const entries = treeCache[currentDir] || [];
    if (cb.checked) {
      // 全选当前目录所有条目
      const all = entries.map(en => en.path);
      // 合并已选（避免重复）
      const merged = Array.from(new Set([...selectedPaths, ...all]));
      actions.setFilesState({ selectedPaths: merged });
    } else {
      // 取消当前目录所有条目
      const inDir = new Set(entries.map(en => en.path));
      actions.setFilesState({
        selectedPaths: selectedPaths.filter(p => !inDir.has(p)),
      });
    }
  }

  private _goUp() {
    const { currentDir } = store.getState().files;
    if (currentDir === "") return;
    const parent = currentDir.includes("/")
      ? currentDir.slice(0, currentDir.lastIndexOf("/"))
      : "";
    actions.selectDir(parent);
  }

  render() {
    const { currentDir, treeCache, selectedPaths } = store.getState().files;
    const entries = treeCache[currentDir] || [];
    const sel = new Set(selectedPaths);
    const canRename = selectedPaths.length === 1;
    const canAct = selectedPaths.length >= 1;
    const canGoUp = currentDir !== "";
    const breadcrumb = currentDir === "" ? "/" : `/${currentDir}/`;
    const allSelected = entries.length > 0 && entries.every(e => sel.has(e.path));

    return html`
      <div class="breadcrumb">
        <button
          class="up-btn"
          title="返回上一级目录"
          ?disabled=${!canGoUp}
          @click=${this._goUp}
        >↑</button>
        <span class="path">${breadcrumb}</span>
      </div>
      <div class="toolbar">
        <button data-action="mkdir" @click=${() => this._action("mkdir")}>+ 新目录</button>
        <button data-action="upload" @click=${() => this._action("upload")}>⬆ 上传</button>
        <button data-action="rename" ?disabled=${!canRename} @click=${() => this._action("rename")}>✎ 重命名</button>
        <button data-action="move" ?disabled=${!canAct} @click=${() => this._action("move")}>→ 移动</button>
        <button data-action="delete" ?disabled=${!canAct} class="danger" @click=${() => this._action("delete")}>🗑 删除</button>
      </div>
      ${entries.length === 0
        ? html`<div class="empty">目录为空</div>`
        : html`<div class="header-row">
            <span class="select-all">
              <input
                type="checkbox"
                class="select-all"
                .checked=${allSelected}
                @click=${this._onSelectAll}
              />
            </span>
            <span></span>
            <span>名称</span>
            <span style="text-align:right;">大小</span>
            <span style="text-align:right;">修改</span>
            <span></span>
          </div>`}
      <div class="rows">
        ${entries.map(e => html`
          <file-row
            .entry=${e}
            .selected=${sel.has(e.path)}
            @checked=${this._onRowChecked}
          ></file-row>`)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-list": FileList; }
}
```

注意删除 `_onRowClicked` 和 `_onRowActivated`（前者不再需要；后者由 files-view 的 `@activated` 接管，因为 file-row 的 activated 事件 composed=true 会冒泡到 file-list 外部）。

- [ ] **Step 4.4：运行测试确认通过**

```bash
npx vitest run tests/file-list.spec.ts
```
Expected: PASS — 全部测试通过（含原有 + 新增 2 个）。

- [ ] **Step 4.5：commit**

```bash
git add cortex/web_v2/frontend/src/components/file-list.ts cortex/web_v2/frontend/tests/file-list.spec.ts
git commit -m "feat(web): file-list uses checkbox for selection, header select-all"
```

---

## Task 5：files-view 桌面端用 preview-pane 替换 file-detail

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/files-view.ts`

- [ ] **Step 5.1：改 imports 和 state**

在 `files-view.ts` 顶部追加：

```typescript
import "../components/preview-pane";
import { fetchPreview, isFullFilePreview } from "../api/preview";
```

在 class `FilesView` 内 `_lastSelectedSig` 下方追加 preview state：

```typescript
@state() private _previewPath = "";
@state() private _previewContent = "";
@state() private _previewLanguage = "text";
@state() private _previewWritable = false;
@state() private _previewPages: PageMarker[] | null = null;
@state() private _previewError: "NOT_INDEXED" | null = null;
@state() private _previewDirty = false;
```

并在文件顶部 import 中加：

```typescript
import type { PageMarker } from "../api/preview";
```

- [ ] **Step 5.2：改 `_onFileListActivated` 处理文件**

定位到 `_onFileListActivated`（约 319-325 行），替换为：

```typescript
private async _onFileListActivated(e: CustomEvent<{ path: string; is_dir: boolean }>) {
  if (e.detail.is_dir) {
    await this._ensureLoaded(e.detail.path);
    return;
  }
  // 文件：dirty 检查后切换预览
  if (this._previewDirty) {
    const ok = window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？");
    if (!ok) return;
    this._discardPreviewEdits();
  }
  await this._fetchPreview(e.detail.path);
  if (this._isMobile) {
    actions.setMobilePane("detail");
  }
}

private async _fetchPreview(path: string) {
  const result = await fetchPreview(path);
  if (result.ok) {
    this._previewError = null;
    this._previewPath = result.path;
    this._previewContent = result.content;
    this._previewLanguage = result.language;
    this._previewWritable = result.writable;
    this._previewPages = result.pages;
  } else if (result.notIndexed) {
    this._previewError = "NOT_INDEXED";
    this._previewPath = path;
    this._previewContent = "";
    this._previewWritable = false;
    this._previewPages = null;
  } else {
    this._showToast(result.message || "预览失败");
  }
}

private _discardPreviewEdits() {
  const pp = this.shadowRoot?.querySelector("preview-pane") as any;
  pp?.discard?.();
  this._previewDirty = false;
}

private _onPreviewDirty = (e: CustomEvent<{ dirty: boolean }>) => {
  this._previewDirty = e.detail.dirty;
};

private _onPreviewSaved = () => {
  this._previewDirty = false;
  this._showToast("已保存");
};

private _onPreviewSaveFailed = (e: CustomEvent<{ message: string }>) => {
  this._showToast(`保存失败：${e.detail.message}`);
};

private _onPreviewUploadSuccess = (e: CustomEvent<{ path: string }>) => {
  this._previewDirty = false;
  this._showToast(`已覆盖：${e.detail.path}`);
  // 重新拉取以同步 content
  void this._reloadPreview();
};

private _onPreviewUploadFailed = (e: CustomEvent<{ message: string }>) => {
  this._showToast(`上传失败：${e.detail.message}`);
};

private async _reloadPreview() {
  if (!this._previewPath) return;
  const r = await fetchPreview(this._previewPath);
  if (r.ok) {
    this._previewContent = r.content;
    this._previewLanguage = r.language;
    this._previewWritable = r.writable;
    this._previewPages = r.pages;
  }
}

private _renderNotIndexedHint() {
  return html`<div class="preview-placeholder">
    该文件未索引，无法预览。<br>
    请先执行 cortex index 后重试。
  </div>`;
}

private _renderPreviewPane(noHeader = false) {
  if (this._previewError === "NOT_INDEXED") {
    return this._renderNotIndexedHint();
  }
  if (!this._previewPath) {
    return html`<div class="preview-placeholder">点击文件预览</div>`;
  }
  return html`<preview-pane
    ?noHeader=${noHeader}
    path=${this._previewPath}
    language=${this._previewLanguage}
    content=${this._previewContent}
    ?writable=${this._previewWritable}
    .pages=${this._previewPages}
    @dirty-change=${this._onPreviewDirty}
    @saved=${this._onPreviewSaved}
    @save-failed=${this._onPreviewSaveFailed}
    @upload-success=${this._onPreviewUploadSuccess}
    @upload-failed=${this._onPreviewUploadFailed}
  ></preview-pane>`;
}
```

- [ ] **Step 5.3：移除 `_maybeLoadDetail` 调用和方法**

定位到 `updated()` 钩子（约 158-161 行）：

```typescript
updated() {
  this._maybeLoadDetail();
}
```

替换为（直接移除该钩子；若 `updated` 无其它逻辑，整个方法可删）：

```typescript
updated() {
  // 不再需要 detail 自动加载（file-detail 已移除）
}
```

并删除整个 `_maybeLoadDetail` 方法（约 135-156 行）。

- [ ] **Step 5.4：替换桌面布局的 file-detail**

定位到 `_renderDesktop`，把 `<file-detail>` 行替换为 `<div class="preview-col">` 包装的 preview：

```typescript
private _renderDesktop() {
  return html`
    <div class="desktop-layout">
      <file-tree></file-tree>
      <file-list @action=${this._onAction} @activated=${this._onFileListActivated}></file-list>
      <div class="preview-col">${this._renderPreviewPane(false)}</div>
    </div>
  `;
}
```

- [ ] **Step 5.5：更新 desktop-layout CSS 以适配新列**

定位到 `static styles = css\`...\``，在 `.desktop-layout` 规则下面加：

```css
.preview-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--cortex-surface);
  border-left: 1px solid var(--cortex-border);
  overflow: hidden;
}
.preview-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--cortex-space-8);
  color: var(--cortex-text-subtle);
  text-align: center;
}
```

- [ ] **Step 5.6：替换移动端布局的 file-detail**

定位到 `_renderMobile` 中 `${pane === "detail" ? ...}` 块，替换为：

```typescript
${pane === "detail"
  ? html`<div class="mobile-preview">${this._renderPreviewPane(true)}</div>`
  : ""}
```

在 `static styles` 中加：

```css
.mobile-preview {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
}
```

- [ ] **Step 5.7：删除 `_onAction` 中的 preview/download 分支（preview-pane 自带 header 按钮）**

定位到 `_onAction`（约 169-187 行）。其中 `name === "preview"` 分支用 `window.open(...download)`、`name === "download"` 也是。这两个动作现在由 preview-pane header 内置，不再需要。但保留也无害（其他组件若触发仍有效）。建议直接删除这两个分支。

- [ ] **Step 5.8：处理删除当前预览文件的边界**

在 `_onDeleteSubmit`（约 256-279 行）中，`for (const p of paths)` 循环后、`clearSelection` 前，加入：

```typescript
// 若删除了正在预览的文件，清空 preview state
if (paths.includes(this._previewPath)) {
  this._previewPath = "";
  this._previewContent = "";
  this._previewError = null;
  this._previewWritable = false;
  this._previewPages = null;
  this._previewDirty = false;
}
```

- [ ] **Step 5.9：处理重命名当前预览文件的边界**

在 `_onRenameSubmit`（约 222-233 行）中，rename 成功后加入：

```typescript
const oldPath = path;
const newName = e.detail.newName;
const newPath = oldPath.includes("/")
  ? oldPath.slice(0, oldPath.lastIndexOf("/") + 1) + newName
  : newName;
if (this._previewPath === oldPath) {
  this._previewPath = newPath;
  void this._reloadPreview();
}
```

- [ ] **Step 5.10：运行 files-view 测试验证**

```bash
npx vitest run tests/files-view.spec.ts
```
Expected: 现有 7 个测试中，"loads directory contents when file-list activates a directory" 仍通过；其他可能因 file-detail 不再渲染而需调整。先观察，下一步统一更新。

- [ ] **Step 5.11：commit**

```bash
git add cortex/web_v2/frontend/src/views/files-view.ts
git commit -m "feat(web): files-view replaces file-detail with preview-pane"
```

---

## Task 6：删除 file-detail 组件和测试

**Files:**
- Delete: `cortex/web_v2/frontend/src/components/file-detail.ts`
- Delete: `cortex/web_v2/frontend/tests/file-detail.spec.ts`

- [ ] **Step 6.1：删除文件**

```bash
rm cortex/web_v2/frontend/src/components/file-detail.ts
rm cortex/web_v2/frontend/tests/file-detail.spec.ts
```

- [ ] **Step 6.2：确认无残留引用**

```bash
cd cortex/web_v2/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: 无 `file-detail` 相关错误；可能仍有其他类型错误（待 Task 7 修复）。

- [ ] **Step 6.3：commit**

```bash
git add -A cortex/web_v2/frontend/src/components/file-detail.ts cortex/web_v2/frontend/tests/file-detail.spec.ts
git commit -m "chore(web): remove file-detail component (replaced by preview-pane)"
```

---

## Task 7：更新 files-view 测试 + 全量回归

**Files:**
- Modify: `cortex/web_v2/frontend/tests/files-view.spec.ts`

- [ ] **Step 7.1：调整 mock**

在 `tests/files-view.spec.ts` 顶部的 `vi.mock("../src/api/files", ...)` 之后追加 preview mock：

```typescript
import { fetchPreview as _fp } from "../src/api/preview";

vi.mock("../src/api/preview", () => ({
  fetchPreview: vi.fn().mockResolvedValue({
    ok: true,
    path: "a.md",
    content: "# hello",
    language: "markdown",
    writable: false,
    pages: null,
  }),
  isFullFilePreview: vi.fn(() => false),
}));
```

- [ ] **Step 7.2：新增"单击文件触发 fetchPreview"测试**

在最后一个 `it(...)` 前追加：

```typescript
it("clicking a file loads preview via fetchPreview", async () => {
  const { fetchPreview } = await import("../src/api/preview");
  const spy = fetchPreview as ReturnType<typeof vi.fn>;
  spy.mockClear();
  const el = document.createElement("files-view") as any;
  document.body.appendChild(el);
  await el.updateComplete;
  el.shadowRoot.querySelector("file-list").dispatchEvent(
    new CustomEvent("activated", {
      detail: { path: "a.md", is_dir: false },
      bubbles: true, composed: true,
    }),
  );
  await new Promise(r => setTimeout(r, 0));
  expect(spy).toHaveBeenCalledWith("a.md");
  document.body.removeChild(el);
});
```

- [ ] **Step 7.3：运行 files-view 测试**

```bash
npx vitest run tests/files-view.spec.ts
```
Expected: PASS — 全部 8 个测试通过。

- [ ] **Step 7.4：运行全量前端测试**

```bash
npx vitest run
```
Expected: PASS — 所有测试通过；若有失败，根据失败信息定位并修复。

- [ ] **Step 7.5：commit**

```bash
git add cortex/web_v2/frontend/tests/files-view.spec.ts
git commit -m "test(web): add fetchPreview test for files-view file activation"
```

---

## Task 8：生产构建 + 浏览器手动验证

- [ ] **Step 8.1：构建**

```bash
cd cortex/web_v2/frontend && npm run build
```
Expected: vite build 成功；`../static/assets/index.*.js` 重新生成。

- [ ] **Step 8.2：启动 GUI（如果未运行）**

```bash
# 在仓库根目录
pwsh -File ./start-cortex.ps1 gui
```
记下端口（7860/7861/...）。

- [ ] **Step 8.3：playwright-cli E2E 验证**

```bash
playwright-cli open http://localhost:7860/#/files
playwright-cli reload
playwright-cli snapshot

# 1. 单击文件 → preview
# 找到任一 .md 文件的行 ref（例如 e70），单击
playwright-cli click e70
playwright-cli snapshot
# 期望：右侧 preview-pane 显示该文件内容（含 "已索引" badge 的 .md 应该 language=markdown）

# 2. 单击文件夹 → 进入
# 找到任一文件夹的行 ref，单击
playwright-cli click e41
playwright-cli snapshot
# 期望：面包屑变为 /folder/，中栏显示该目录条目；右栏 preview 不变（VS Code 风格）

# 3. 复选框多选
# 勾选两个文件 checkbox
playwright-cli click <checkbox1>
playwright-cli click <checkbox2>
playwright-cli snapshot
# 期望：两行 selected 样式；工具栏"删除"按钮启用；右栏 preview 仍为最后单击的文件

# 4. 表头全选
# 单击表头 checkbox
playwright-cli click <header-checkbox>
playwright-cli snapshot
# 期望：当前目录所有行 selected

playwright-cli close
```

- [ ] **Step 8.4：commit 静态产物**

```bash
git add cortex/web_v2/static/
git commit -m "chore(web): rebuild static assets for explorer click-to-open"
```

---

## Verification Checklist

完成所有任务后，确认：

- [ ] 单击文件夹 → 面包屑切换 + 中栏显示新目录内容
- [ ] 单击文件 → 右栏 preview-pane 显示内容
- [ ] 单击未索引 PDF → 右栏显示"未索引"提示
- [ ] 复选框勾选 → 工具栏"删除/移动"启用；右栏 preview 不变
- [ ] 表头全选 checkbox → 切换当前目录所有条目
- [ ] 编辑 markdown 文件后未保存 → 切换文件弹 confirm
- [ ] 删除当前预览文件 → 右栏清空为"点击文件预览"
- [ ] 重命名当前预览文件 → 右栏 previewPath 更新并重载
- [ ] 移动端 tree→list→preview 流程正常
- [ ] search tab 所有原有功能（preview/upload/edit/save）无回归
