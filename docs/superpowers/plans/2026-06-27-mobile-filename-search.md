# 移动端文件名搜索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为移动端 files 视图的 tree 面板增加文件名即时搜索功能，与桌面端行为一致。

**Architecture:** 在 `_renderMobile()` 的 tree 面板顶部添加搜索框，搜索激活时用 `file-search-results` 替换 `file-tree`。调整 `_goBack()` 和 `_onFilenameResultActivated` 处理搜索态下的面板导航。所有改动集中在 `files-view.ts`。

**Tech Stack:** Lit Web Components, TypeScript, Vitest (单元测试), Playwright (E2E)

## Global Constraints

- 运行 Python 使用 `.venv/Scripts/python.exe`
- 前端测试工作目录：`doclens/web_v2/frontend`
- Vitest 运行：`npx vitest run`
- Playwright 运行需要后端服务（通过 webServer 配置自动启动）
- 移动端判定：`window.innerWidth < 1024`（`_isMobile` getter）
- Playwright 已配置 `mobile-iphone` 项目（iPhone 13，390×844）

---

### Task 1: 搜索框状态提取 + 移动端 tree 面板渲染 + CSS

**Files:**
- Modify: `doclens/web_v2/frontend/src/views/files-view.ts` — 提取 getter、修改 `_renderMobile()`、修改 CSS
- Test: `doclens/web_v2/frontend/tests/files-view.spec.ts`
- Modify: `doclens/web_v2/frontend/tests/test-utils.ts` — 添加移动端 viewport helper

**Interfaces:**
- Consumes: `_isFilenameSearchActive` (existing getter on FilesView), `store.getState().files.filenameSearch`
- Produces: `_searchBoxState` getter (returns `{ disabled: boolean, placeholder: string }`)

- [ ] **Step 1: Add mobile viewport helpers to test-utils.ts**

在 `doclens/web_v2/frontend/tests/test-utils.ts` 末尾添加：

```ts
/** 设置 jsdom 的 innerWidth 为移动端尺寸（390px，模拟 iPhone 13）。 */
export function setMobileViewport() {
  Object.defineProperty(window, "innerWidth", {
    writable: true, configurable: true, value: 390,
  });
}

/** 恢复 jsdom 的 innerWidth 为桌面端尺寸（1280px）。 */
export function setDesktopViewport() {
  Object.defineProperty(window, "innerWidth", {
    writable: true, configurable: true, value: 1280,
  });
}
```

- [ ] **Step 2: Write failing tests for mobile tree pane search box**

在 `doclens/web_v2/frontend/tests/files-view.spec.ts` 的 `describe("files-view filename search", ...)` 块**之后**追加新的 describe 块。同时在文件顶部 import 中添加 `setMobileViewport` 和 `setDesktopViewport`：

```ts
import { resetStore, setMobileViewport, setDesktopViewport } from "./test-utils";
```

追加测试块：

```ts
describe("files-view mobile filename search", () => {
  beforeEach(() => {
    resetStore(store);
    setMobileViewport();
  });
  afterEach(() => {
    setDesktopViewport();
  });

  it("renders file-search-box in mobile tree pane", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".mobile-layout")).toBeTruthy();
    expect(el.shadowRoot.querySelector(".mobile-layout file-search-box")).toBeTruthy();
    document.body.removeChild(el);
  });

  it("shows file-search-results instead of file-tree when search active on mobile", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const mobile = el.shadowRoot.querySelector(".mobile-layout");
    expect(mobile.querySelector("file-search-results")).toBeTruthy();
    expect(mobile.querySelector("file-tree")).toBeNull();
    document.body.removeChild(el);
  });

  it("shows file-tree when search inactive on mobile", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const mobile = el.shadowRoot.querySelector(".mobile-layout");
    expect(mobile.querySelector("file-tree")).toBeTruthy();
    expect(mobile.querySelector("file-search-results")).toBeNull();
    document.body.removeChild(el);
  });

  it("restores file-tree after clearing search on mobile", async () => {
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
    const mobile = el.shadowRoot.querySelector(".mobile-layout");
    expect(mobile.querySelector("file-tree")).toBeTruthy();
    expect(mobile.querySelector("file-search-results")).toBeNull();
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/files-view.spec.ts`
Expected: FAIL — mobile tests fail because `.mobile-layout file-search-box` not found

- [ ] **Step 4: Extract `_searchBoxState` getter and refactor `_renderDesktop()`**

在 `files-view.ts` 中，在 `_isFilenameSearchActive` getter（约 604 行）之前添加新 getter：

```ts
private get _searchBoxState() {
  const fs = store.getState().files.filenameSearch;
  const docsEmpty = !fs.docsLoading && fs.allDocs.length === 0;
  const disabled = fs.docsError !== null || docsEmpty;
  const placeholder = fs.docsError !== null
    ? "文档列表加载失败"
    : docsEmpty
      ? "暂无已索引文档"
      : "按文件名搜索…";
  return { disabled, placeholder };
}
```

然后在 `_renderDesktop()` 方法（约 653 行）中，将开头 6 行局部变量：

```ts
const fs = store.getState().files.filenameSearch;
const docsEmpty = !fs.docsLoading && fs.allDocs.length === 0;
const searchDisabled = fs.docsError !== null || docsEmpty;
const searchPlaceholder = fs.docsError !== null
  ? "文档列表加载失败"
  : docsEmpty
    ? "暂无已索引文档"
    : "按文件名搜索…";
```

替换为：

```ts
const { disabled: searchDisabled, placeholder: searchPlaceholder } = this._searchBoxState;
```

- [ ] **Step 5: Add CSS rule for `file-search-results` in mobile layout**

在 `files-view.ts` 的 `static styles` 中，找到（约 82-89 行）：

```css
.mobile-layout file-tree,
.mobile-layout file-list,
.mobile-layout .mobile-preview {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
```

改为：

```css
.mobile-layout file-tree,
.mobile-layout file-list,
.mobile-layout file-search-results,
.mobile-layout .mobile-preview {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 6: Add search box + conditional results to `_renderMobile()` tree pane**

在 `files-view.ts` 的 `_renderMobile()` 方法（约 705 行）中，将：

```ts
${pane === "tree"
  ? html`<file-tree
      @select-dir=${async (e: CustomEvent<{ path: string }>) => {
        actions.selectDir(e.detail.path);
        await this._ensureLoaded(e.detail.path);
        actions.expandDir(e.detail.path);
        actions.setMobilePane("list");
      }}
    ></file-tree>`
  : ""}
```

替换为：

```ts
${pane === "tree"
  ? html`
      <file-search-box
        ?disabled=${searchState.disabled}
        .placeholder=${searchState.placeholder}
        @search=${this._onFilenameSearch}
        @clear=${this._onFilenameClear}
      ></file-search-box>
      ${this._isFilenameSearchActive
        ? html`<file-search-results
            @activated=${this._onFilenameResultActivated}
            @clear=${this._onFilenameClear}
          ></file-search-results>`
        : html`<file-tree
            @select-dir=${async (e: CustomEvent<{ path: string }>) => {
              actions.selectDir(e.detail.path);
              await this._ensureLoaded(e.detail.path);
              actions.expandDir(e.detail.path);
              actions.setMobilePane("list");
            }}
          ></file-tree>`}
    `
  : ""}
```

然后在 `_renderMobile()` 方法开头添加 `searchState` 变量。将方法开头：

```ts
private _renderMobile() {
    const pane = this._state.mobilePane;
    return html`
```

改为：

```ts
private _renderMobile() {
    const pane = this._state.mobilePane;
    const searchState = this._searchBoxState;
    return html`
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/files-view.spec.ts`
Expected: PASS — all tests including mobile ones pass

- [ ] **Step 8: Commit**

```bash
git add doclens/web_v2/frontend/src/views/files-view.ts doclens/web_v2/frontend/tests/files-view.spec.ts doclens/web_v2/frontend/tests/test-utils.ts
git commit -m "feat(mobile): 文件名搜索框加入移动端 tree 面板"
```

---

### Task 2: 移动端导航调整 — 返回逻辑 + 结果点击跳转

**Files:**
- Modify: `doclens/web_v2/frontend/src/views/files-view.ts` — `_goBack()` 和 `_onFilenameResultActivated`
- Test: `doclens/web_v2/frontend/tests/files-view.spec.ts`

**Interfaces:**
- Consumes: `_isFilenameSearchActive` (existing getter), `_isMobile` (existing getter), `actions.setMobilePane`
- Produces: modified `_goBack()` behavior, modified `_onFilenameResultActivated` behavior

- [ ] **Step 1: Write failing tests for mobile navigation**

在 `doclens/web_v2/frontend/tests/files-view.spec.ts` 的 `describe("files-view mobile filename search", ...)` 块内追加：

```ts
  it("_goBack from detail goes to tree when search active on mobile", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    actions.setMobilePane("detail");
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector(".back-btn").click();
    await el.updateComplete;
    expect(store.getState().files.mobilePane).toBe("tree");
    document.body.removeChild(el);
  });

  it("_goBack from detail goes to list when search inactive on mobile", async () => {
    actions.setMobilePane("detail");
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector(".back-btn").click();
    await el.updateComplete;
    expect(store.getState().files.mobilePane).toBe("list");
    document.body.removeChild(el);
  });

  it("filename result activation switches to detail pane on mobile", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector("file-search-results").dispatchEvent(
      new CustomEvent("activated", {
        detail: { path: "a.md" },
        bubbles: true, composed: true,
      }),
    );
    await new Promise(r => setTimeout(r, 0));
    expect(store.getState().files.mobilePane).toBe("detail");
    document.body.removeChild(el);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/files-view.spec.ts`
Expected: FAIL — `_goBack` from detail with search active goes to "list" not "tree"; result activation doesn't switch pane

- [ ] **Step 3: Adjust `_goBack()` for search-aware back navigation**

在 `files-view.ts` 中，找到 `_goBack()` 方法（约 486 行）：

```ts
private _goBack() {
    const pane = this._state.mobilePane;
    if (pane === "detail") actions.setMobilePane("list");
    else if (pane === "list") actions.setMobilePane("tree");
  }
```

替换为：

```ts
private _goBack() {
    const pane = this._state.mobilePane;
    if (pane === "detail") {
      if (this._isFilenameSearchActive) actions.setMobilePane("tree");
      else actions.setMobilePane("list");
    } else if (pane === "list") {
      actions.setMobilePane("tree");
    }
  }
```

- [ ] **Step 4: Add mobile pane switch to `_onFilenameResultActivated`**

在 `files-view.ts` 中，找到 `_onFilenameResultActivated`（约 634 行）：

```ts
private _onFilenameResultActivated = async (e: CustomEvent<{ path: string }>) => {
    await this._previewPathWithDirtyCheck(e.detail.path);
  };
```

替换为：

```ts
private _onFilenameResultActivated = async (e: CustomEvent<{ path: string }>) => {
    await this._previewPathWithDirtyCheck(e.detail.path);
    if (this._isMobile) {
      actions.setMobilePane("detail");
    }
  };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/files-view.spec.ts`
Expected: PASS — all tests pass

- [ ] **Step 6: Run full vitest suite to verify no regressions**

Run: `cd doclens/web_v2/frontend && npx vitest run`
Expected: PASS — all test files pass

- [ ] **Step 7: Commit**

```bash
git add doclens/web_v2/frontend/src/views/files-view.ts doclens/web_v2/frontend/tests/files-view.spec.ts
git commit -m "feat(mobile): 搜索结果点击跳转预览 + 返回逻辑适配搜索态"
```

---

### Task 3: E2E 测试 — 现有桌面测试标记 + 新增移动端测试

**Files:**
- Modify: `doclens/web_v2/frontend/tests/e2e/filename-search.spec.ts` — 标记桌面专用
- Create: `doclens/web_v2/frontend/tests/e2e/filename-search-mobile.spec.ts` — 移动端 E2E

**Interfaces:**
- Consumes: Playwright `devices["iPhone 13"]` project (pre-configured in playwright.config.ts)

- [ ] **Step 1: Mark existing desktop filename-search E2E tests as desktop-only**

在 `doclens/web_v2/frontend/tests/e2e/filename-search.spec.ts` 的 `test.describe("filename search", ...)` 内部，`test.beforeEach` 之前添加：

```ts
test.skip(({ }, testInfo) => testInfo.project.name !== "desktop-chrome", "Desktop only");
```

- [ ] **Step 2: Create mobile E2E test file**

创建 `doclens/web_v2/frontend/tests/e2e/filename-search-mobile.spec.ts`：

```ts
import { test, expect } from "@playwright/test";

const FILES_VIEW_HASH = "#/files";

async function gotoFilesViewMobile(page: import("@playwright/test").Page) {
  await page.goto(FILES_VIEW_HASH);
  await page.waitForSelector("file-search-box input", { state: "visible" });
}

test.describe("mobile filename search", () => {
  test.skip(({ }, testInfo) => testInfo.project.name !== "mobile-iphone", "Mobile only");

  test.beforeEach(async ({ page }) => {
    await gotoFilesViewMobile(page);
  });

  test("MFILENAME-001: search box visible in mobile tree pane", async ({ page }) => {
    await expect(page.locator("file-search-box input")).toBeVisible();
    await expect(page.locator("file-tree")).toBeVisible();
  });

  test("MFILENAME-002: typing shows results, file-tree hidden", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    await expect(page.locator("file-search-results")).toBeVisible();
    await expect(page.locator("file-tree")).toHaveCount(0);
    await expect(page.locator("file-search-results .row").first()).toBeVisible();
  });

  test("MFILENAME-003: tapping a row navigates to preview pane", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    const firstRow = page.locator("file-search-results .row").first();
    await firstRow.click();
    await expect(page.locator("preview-pane")).toBeVisible();
  });

  test("MFILENAME-004: back from preview returns to search results", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    await page.locator("file-search-results .row").first().click();
    await expect(page.locator("preview-pane")).toBeVisible();
    await page.locator(".back-btn").click();
    // 返回 tree 面板，搜索结果仍在
    await expect(page.locator("file-search-results")).toBeVisible();
  });

  test("MFILENAME-005: clearing search restores file-tree", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    await expect(page.locator("file-search-results")).toBeVisible();
    await page.locator("file-search-box input").fill("");
    await expect(page.locator("file-tree")).toBeVisible();
    await expect(page.locator("file-search-results")).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add doclens/web_v2/frontend/tests/e2e/filename-search.spec.ts doclens/web_v2/frontend/tests/e2e/filename-search-mobile.spec.ts
git commit -m "test(e2e): 添加移动端文件名搜索 E2E 测试，桌面测试标记 desktop-only"
```

---

### Task 4: 构建前端产物 + 全量验证

**Files:**
- Build: `doclens/web_v2/static/` — Vite 构建产物

- [ ] **Step 1: Build frontend**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 构建成功，产物输出到 `doclens/web_v2/static/`

- [ ] **Step 2: Commit static assets**

```bash
git add doclens/web_v2/static/
git commit -m "chore(static): 重新构建前端产物（移动端文件名搜索）"
```

- [ ] **Step 3: Run full vitest suite**

Run: `cd doclens/web_v2/frontend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Run Playwright E2E (desktop + mobile)**

Run: `cd doclens/web_v2/frontend && npx playwright test`
Expected: ALL PASS（desktop filename-search + mobile filename-search）

---

## Self-Review Checklist

- [x] Spec coverage: 所有 spec 中的改动点（布局、导航、CSS、测试）均有对应 Task
- [x] Placeholder scan: 无 TODO/TBD，每个 Step 都有完整代码
- [x] Type consistency: `_searchBoxState` 返回类型在 Task 1 定义并使用，`_goBack` 和 `_onFilenameResultActivated` 签名一致
- [x] 现有桌面测试不会回归（标记为 desktop-only，新 mobile 测试独立文件）
