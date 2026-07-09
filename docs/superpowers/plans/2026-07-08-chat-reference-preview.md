# Chat 参考资料预览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 chat（RAG 对话）AI 回答的「## 参考资料」路径可点击，点击后用现有 `<preview-pane>` 预览文档——桌面端右侧并排（按需打开 + 可拖 splitter），移动端全屏 overlay。

**Architecture:** 不新增后端，复用 `fetchPreview(path)` + `<preview-pane>`。改两个前端文件：`chat-message.ts`（marked 渲染后后处理参考资料列表为可点击 `.ref-link`，事件委托派发 `reference-click` 自定义事件穿过 Shadow DOM）+ `chat-view.ts`（持有 preview `@state`，监听事件 → `fetchPreview` → 渲染 preview-pane；桌面水平布局 + splitter + 按需开合，移动 overlay）。

**Tech Stack:** Lit 3 + marked + Vitest + @open-wc/testing + jsdom/happy-dom。

## Global Constraints

- **测试命令**：`cd doclens/web_v2/frontend && npx vitest run <test-file> -t "<pattern>"`（或 `npm test -- <file>`）。根目录 `.git` 在仓库根，但前端工程在 `doclens/web_v2/frontend/`，命令必须 `cd` 到该目录。
- **类型注解**：所有新 TS 函数/字段带类型（项目 typescript coding-style）。
- **不可变**：Lit `@state` 更新用新对象/新值，不原地 mutate。
- **无 `console.log`**（项目 typescript 规则）。
- **Commit 规则**：每个 commit 步骤**必须等用户明确授权**（项目 git-workflow：未经允许禁止 commit/push）；commit message **禁止** `Co-Authored-By`。
- **前端生效**：改完前端代码需 `cd doclens/web_v2/frontend && npm run build` 才能让 GUI 加载到新产物（CLAUDE.md）。每个 task 的 vitest 测试不依赖 build；最后一个 task 做构建验证。
- **E2E**：GUI E2E 用 `playwright-cli` skill（CLAUDE.md），不直接用 playwright。
- **复用而非复制**：preview-pane / fetchPreview / toast-stack / focus-header 直接复用，不改它们。

## File Structure

| 文件 | 责任 | 动作 |
|------|------|------|
| `doclens/web_v2/frontend/src/components/chat-message.ts` | marked 渲染后后处理「## 参考资料」列表为 `.ref-link`；事件委托派发 `reference-click` | 修改 |
| `doclens/web_v2/frontend/src/views/chat-view.ts` | preview `@state` + `_onReferenceClick` + 桌面水平布局/splitter/按需开合 + 移动 overlay + 未索引提示 + 编辑脏标志 confirm | 修改 |
| `doclens/web_v2/frontend/src/components/preview-pane.ts` | 预览组件（md/html/文本 + 编辑/下载/上传） | 不改（复用） |
| `doclens/web_v2/frontend/src/components/chat-stream.ts` | 消息列表容器 | 不改（事件 `composed:true` 透传） |
| `doclens/web_v2/frontend/tests/chat-message.spec.ts` | Task 1 单测 | 新增 |
| `doclens/web_v2/frontend/tests/chat-view-preview.spec.ts` | Task 2 单测 | 新增 |

---

### Task 1: `chat-message` 参考资料可点击化

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/chat-message.ts`
- Test: `doclens/web_v2/frontend/tests/chat-message.spec.ts`

**Interfaces:**
- Produces: `<chat-message>` 在 assistant 消息的 `.md-body` 内，把「## 参考资料」标题后第一个 `<ol>/<ul>` 的每个 `<li>` 包裹为 `<a class="ref-link" data-path="<路径>">`；点击派发 `CustomEvent("reference-click", {detail:{path}, bubbles:true, composed:true})`。

- [ ] **Step 1: Write the failing test**

Create `doclens/web_v2/frontend/tests/chat-message.spec.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/chat-message";
import { ChatMessageEl } from "../src/components/chat-message";

describe("<chat-message> reference links", () => {
  it("wraps reference list items as .ref-link with data-path", async () => {
    const content = "回答正文。\n\n## 参考资料\n\n1. docs/a.md\n2. docs/b.md\n";
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    const links = el.shadowRoot!.querySelectorAll(".md-body .ref-link");
    expect(links.length).toBe(2);
    expect(links[0].getAttribute("data-path")).toBe("docs/a.md");
    expect(links[1].getAttribute("data-path")).toBe("docs/b.md");
  });

  it("does not touch body lists (only the 参考资料 section)", async () => {
    const content = "步骤：\n\n1. 第一步\n2. 第二步\n\n## 参考资料\n\n1. x.md\n";
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    const links = el.shadowRoot!.querySelectorAll(".md-body .ref-link");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("data-path")).toBe("x.md");
  });

  it("no 参考资料 section → no .ref-link, no error", async () => {
    const content = "只是普通回答，没有参考资料列表。";
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".md-body .ref-link").length).toBe(0);
  });

  it("click .ref-link dispatches reference-click with path (composed)", async () => {
    const content = "## 参考资料\n\n1. docs/a.md\n";
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    const handler = vi.fn();
    el.addEventListener("reference-click", handler);
    const link = el.shadowRoot!.querySelector(".ref-link") as HTMLElement;
    link.click();
    expect(handler).toHaveBeenCalledTimes(1);
    const ev = handler.mock.calls[0][0] as CustomEvent<{ path: string }>;
    expect(ev.detail.path).toBe("docs/a.md");
    expect(ev.composed).toBe(true);
  });

  it("idempotent across streaming updates (no duplicate links)", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: "回答..." } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    el.message = { role: "assistant", content: "回答...\n\n## 参考资料\n\n1. a.md\n" };
    await el.updateComplete;
    el.message = { role: "assistant", content: "回答...\n\n## 参考资料\n\n1. a.md\n2. b.md\n" };
    await el.updateComplete;
    const links = el.shadowRoot!.querySelectorAll(".md-body .ref-link");
    expect(links.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/chat-message.spec.ts`
Expected: FAIL — `el.shadowRoot.querySelectorAll(...).length` 期望 2，实际 0（无 `.ref-link`，未实现后处理）。

- [ ] **Step 3: Implement post-processing + event delegation in `chat-message.ts`**

In `doclens/web_v2/frontend/src/components/chat-message.ts`:

(a) 在 `static styles` 的 `.md-body` 规则块末尾追加 `.ref-link` 样式：

```ts
    .md-body .ref-link {
      color: var(--cortex-primary);
      text-decoration: underline;
      cursor: pointer;
    }
    .md-body .ref-link:hover {
      opacity: 0.8;
    }
```

(b) 在类体内（`render()` 之前）新增生命周期 + 后处理 + 事件委托：

```ts
  firstUpdated() {
    this.addEventListener("click", this._onClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("click", this._onClick);
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has("message") && this.role === "assistant") {
      this._processReferences();
    }
  }

  /** 后处理：把「## 参考资料」列表项包裹成可点击 .ref-link。幂等。 */
  private _processReferences(): void {
    const body = this.renderRoot.querySelector(".md-body");
    if (!body) return;
    const headings = Array.from(body.querySelectorAll("h2"));
    const refHeading = headings.find((h) => (h.textContent ?? "").includes("参考资料"));
    if (!refHeading) return;
    let next: Element | null = refHeading.nextElementSibling;
    while (next && next.tagName !== "OL" && next.tagName !== "UL") {
      next = next.nextElementSibling;
    }
    if (!next) return;
    next.querySelectorAll("li").forEach((li) => {
      if (li.querySelector(".ref-link")) return; // 已处理（幂等）
      const path = (li.textContent ?? "").trim();
      if (!path) return;
      const a = document.createElement("a");
      a.className = "ref-link";
      a.setAttribute("data-path", path);
      a.setAttribute("href", "#");
      a.textContent = path;
      li.textContent = "";
      li.appendChild(a);
    });
  }

  /** 事件委托：命中 .ref-link 时派发 reference-click。 */
  private _onClick = (e: MouseEvent): void => {
    const target = e.composedPath().find(
      (n): n is HTMLElement =>
        n instanceof HTMLElement && n.classList.contains("ref-link"),
    );
    if (!target) return;
    e.preventDefault();
    const path = target.getAttribute("data-path") ?? "";
    this.dispatchEvent(
      new CustomEvent("reference-click", {
        detail: { path },
        bubbles: true,
        composed: true,
      }),
    );
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/chat-message.spec.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**（需用户授权）

```bash
cd doclens/web_v2/frontend && cd ../.. && git add doclens/web_v2/frontend/src/components/chat-message.ts doclens/web_v2/frontend/tests/chat-message.spec.ts
git commit -m "feat(chat): make 参考资料 reference links clickable via post-processing"
```

---

### Task 2: `chat-view` preview（state + 事件 + 桌面布局 + 移动 overlay）

**Files:**
- Modify: `doclens/web_v2/frontend/src/views/chat-view.ts`
- Test: `doclens/web_v2/frontend/tests/chat-view-preview.spec.ts`

**Interfaces:**
- Consumes: `<chat-message>` 的 `reference-click` 事件（Task 1）；`fetchPreview(path)` (`../api/preview`)；`<preview-pane>` 组件；`<toast-stack>`；`<focus-header>`。
- Produces: `<chat-view>` 持有 preview `@state`；桌面端 `.focus-main` 内 `chat-stream + splitter + preview-pane`（按需开合），移动端 `.preview-overlay` 全屏覆盖。

- [ ] **Step 1: Write the failing test**

Create `doclens/web_v2/frontend/tests/chat-view-preview.spec.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/views/chat-view";
import { ChatView } from "../src/views/chat-view";
import { store, actions } from "../src/state/store";
import { resetStore, setDesktopViewport, setMobileViewport } from "./test-utils";

const baseMessages = [
  { role: "user", content: "量子计算" },
  { role: "assistant", content: "答案。\n\n## 参考资料\n\n1. docs/a.md\n" },
];

function focusChat() {
  actions.setChatState({
    state: "focus",
    currentSession: {
      id: "s1", type: "chat", title: "t", preview: "p",
      updated_at: new Date().toISOString(), message_count: 2,
    },
    messages: baseMessages as any,
    streaming: false,
  });
}

function mockPreviewOk() {
  global.fetch = vi.fn(async (url: string) => {
    if (String(url).startsWith("/api/preview")) {
      return new Response(
        JSON.stringify({ path: "docs/a.md", language: "markdown", content: "# A", writable: false }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
}

describe("<chat-view> reference preview", () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
    resetStore(store);
    focusChat();
    setDesktopViewport();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("reference-click opens preview pane on desktop + fills state", async () => {
    mockPreviewOk();
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/a.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect((el as any).previewOpen).toBe(true);
    expect((el as any).previewPath).toBe("docs/a.md");
    expect((el as any).previewContent).toBe("# A");
    expect(el.shadowRoot!.querySelector(".focus-main preview-pane")).toBeTruthy();
  });

  it("previewOpen=false does not render preview-pane nor splitter", async () => {
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".focus-main preview-pane")).toBeNull();
    expect(el.shadowRoot!.querySelector(".focus-main .splitter")).toBeNull();
  });

  it("NOT_INDEXED → previewError set + pane area shows hint", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: "NOT_INDEXED", detail: "not indexed" }),
        { status: 404, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/x.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect((el as any).previewError).toBe("NOT_INDEXED");
    expect((el as any).previewOpen).toBe(true);
    expect(el.shadowRoot!.querySelector(".focus-main .not-indexed-hint")).toBeTruthy();
  });

  it("fetch failure (non-NOT_INDEXED) → previewOpen stays false", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: "INTERNAL", detail: "boom" }),
        { status: 500, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/a.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect((el as any).previewOpen).toBe(false);
  });

  it("mobile viewport renders .preview-overlay with preview-pane", async () => {
    setMobileViewport();
    mockPreviewOk();
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/a.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".preview-overlay")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".preview-overlay preview-pane")).toBeTruthy();
  });

  it("_closePreview sets previewOpen=false", async () => {
    mockPreviewOk();
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/a.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect((el as any).previewOpen).toBe(true);
    (el as any)._closePreview();
    await el.updateComplete;
    expect((el as any).previewOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/chat-view-preview.spec.ts`
Expected: FAIL — `_onReferenceClick` 不存在 / `previewOpen` 未定义（chat-view 尚未加 preview 能力）。

- [ ] **Step 3: Add imports + constants + state to `chat-view.ts`**

In `doclens/web_v2/frontend/src/views/chat-view.ts`:

(a) 顶部 imports 追加：

```ts
import { fetchPreview } from "../api/preview";
import type { PageMarker } from "../api/preview";
import "../components/preview-pane";
import "../components/toast-stack";
import type { ToastStack } from "../components/toast-stack";
```

(b) 类顶部新增常量（与 `RESULTS_PANE_WIDTH_KEY` 等并列，仿 search-view）：

```ts
  static readonly PREVIEW_PANE_WIDTH_KEY = "cortex.chatPreviewWidth";
  static readonly PREVIEW_PANE_WIDTH_DEFAULT = 420;
  static readonly PREVIEW_PANE_WIDTH_MIN = 300;
  static readonly PREVIEW_PANE_WIDTH_MAX = 900;
```

(c) 新增 `@state` 字段（在现有 `@state() private _clearing` 附近）：

```ts
  @state() private previewOpen = false;
  @state() private previewContent = "";
  @state() private previewPath = "";
  @state() private previewLanguage = "text";
  @state() private previewPages: PageMarker[] | null = null;
  @state() private previewWritable = false;
  @state() private previewError: "NOT_INDEXED" | null = null;
  @state() private previewDirty = false;
  @state() private _previewPaneWidth = ChatView.PREVIEW_PANE_WIDTH_DEFAULT;
```

- [ ] **Step 4: Add CSS for `.focus-main` + splitter + overlay + mobile/desktop visibility**

现有 `static styles` 里 `@media (min-width: 1024px)` 块：**保留** `.initial-stack` 与 `.input-bar` 的居中规则；**删除** 原 `chat-stream { max-width: 800px; margin: 0 auto; width: 100%; }` 规则（改由下面 `.focus-main chat-stream` 两条规则控制）。新增以下规则：

```ts
    .focus-main {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
    }
    /* 桌面 preview 关闭：chat-stream 居中（现状） */
    @media (min-width: 1024px) {
      .focus-main:not(.has-preview) chat-stream {
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
      }
    }
    /* 桌面 preview 打开：水平排布，chat-stream 让位 */
    @media (min-width: 1024px) {
      .focus-main.has-preview {
        flex-direction: row;
        padding: var(--cortex-space-3);
      }
      .focus-main.has-preview chat-stream {
        flex: 1 1 0;
        min-width: 0;
        max-width: none;
      }
    }
    .focus-main .splitter {
      flex: 0 0 4px;
      cursor: col-resize;
      background: var(--cortex-border);
      transition: background 0.15s;
    }
    .focus-main .splitter:hover,
    .focus-main .splitter:active {
      background: var(--cortex-primary);
    }
    .focus-main .preview-pane-wrap {
      flex: 0 0 var(--preview-pane-width, 420px);
      min-width: 300px;
      max-width: 900px;
      display: flex;
      flex-direction: column;
      min-height: 0;
      position: relative;
    }
    .focus-main .preview-close {
      position: absolute;
      top: 6px;
      right: 8px;
      z-index: 2;
      border: none;
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .focus-main .not-indexed-hint {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      padding: 24px;
      text-align: center;
    }
    /* 移动端：桌面 splitter / preview-pane-wrap 隐藏 */
    @media (max-width: 1023px) {
      .focus-main .splitter,
      .focus-main .preview-pane-wrap,
      .focus-main .desktop-only {
        display: none;
      }
    }
    /* 移动端预览 overlay */
    .preview-overlay {
      position: absolute;
      inset: 0;
      background: var(--cortex-surface);
      display: flex;
      flex-direction: column;
      z-index: 10;
    }
    @media (min-width: 1024px) {
      .preview-overlay {
        display: none;
      }
    }
```

保留原有的 `.focus-body` / `.input-bar` 等规则；原 `@media (min-width:1024px)` 里对 `.initial-stack` 的居中规则保留不动。

- [ ] **Step 5: Add event handlers + splitter + helpers**

在 `chat-view.ts` 类体内（`_onHistorySelect` 附近）新增：

```ts
  private _loadPreviewPaneWidth(): void {
    const saved = localStorage.getItem(ChatView.PREVIEW_PANE_WIDTH_KEY);
    if (!saved) return;
    const w = Number(saved);
    if (!Number.isNaN(w)) {
      this._previewPaneWidth = Math.max(
        ChatView.PREVIEW_PANE_WIDTH_MIN,
        Math.min(ChatView.PREVIEW_PANE_WIDTH_MAX, w),
      );
    }
  }

  private _onSplitterMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = this._previewPaneWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(
        ChatView.PREVIEW_PANE_WIDTH_MIN,
        Math.min(ChatView.PREVIEW_PANE_WIDTH_MAX, startWidth + (ev.clientX - startX)),
      );
      if (w !== this._previewPaneWidth) this._previewPaneWidth = w;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(ChatView.PREVIEW_PANE_WIDTH_KEY, String(this._previewPaneWidth));
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  private get _previewKeyword(): string {
    const msgs = store.getState().chat.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") return msgs[i].content;
    }
    return "";
  }

  private async _onReferenceClick(e: CustomEvent<{ path: string }>): Promise<void> {
    await this._safeAction(async () => {
      const path = e.detail.path;
      this.previewError = null;
      const result = await fetchPreview(path);
      if (result.ok) {
        this.previewContent = result.content;
        this.previewPath = result.path;
        this.previewLanguage = result.language;
        this.previewWritable = result.writable;
        this.previewPages = result.pages;
        this.previewOpen = true;
      } else if (result.notIndexed) {
        this.previewError = "NOT_INDEXED";
        this.previewContent = "";
        this.previewPath = path;
        this.previewWritable = false;
        this.previewPages = null;
        this.previewOpen = true;
      } else {
        this._pushToast(`预览失败：${result.message}`, "error", 5000);
      }
    });
  }

  private _onPreviewDirty = (e: CustomEvent<{ dirty: boolean }>): void => {
    this.previewDirty = e.detail.dirty;
  };

  private _closePreview = async (): Promise<void> => {
    await this._safeAction(() => {
      this.previewOpen = false;
    });
  };

  private async _safeAction(action: () => void | Promise<void>): Promise<void> {
    if (this.previewDirty) {
      const ok = window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？");
      if (!ok) return;
      const pp = this.shadowRoot?.querySelector("preview-pane") as any;
      pp?.discard?.();
      this.previewDirty = false;
    }
    await action();
  }

  private _pushToast(message: string, level: "success" | "error" | "info", duration: number): void {
    const stack = this.shadowRoot?.querySelector("toast-stack") as ToastStack | null;
    stack?.pushToast(message, level, duration);
  }

  private _renderNotIndexedHint(): unknown {
    return html`<div class="not-indexed-hint">
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`;
  }
```

并在 `connectedCallback` 末尾追加 `this._loadPreviewPaneWidth();`（或在现有逻辑里调用）。

- [ ] **Step 6: Rewrite `render()` to add `.focus-main` + splitter + preview-pane + overlay**

把 `render()` 的 focus 分支（现有 `return html\`<div class="focus-body">...\``）替换为：

```ts
  render() {
    const s = this.viewState;
    if (s.state === "initial") {
      return html`
        <div class="initial-stack">
          <welcome-pane heading="Doclens" subheading="与你的知识库对话"></welcome-pane>
          <history-list
            title="历史会话"
            type="chat"
            ?clearing=${this._clearing}
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}
            @clear=${this._onClearHistory}>
          </history-list>
          <div class="input-row">
            <input-box
              placeholder="问 Doclens 任何问题..."
              button-label="→"
              multiline
              .value=${this.draft}
              @input-change=${(e: any) => (this.draft = e.detail.value)}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;
    }
    const hasPreview = this.previewOpen;
    const previewPane = (noHeader: boolean) => html`<preview-pane
      ?noHeader=${noHeader}
      path=${this.previewPath}
      language=${this.previewLanguage}
      content=${this.previewContent}
      .keyword=${this._previewKeyword}
      ?writable=${this.previewWritable}
      .pages=${this.previewPages}
      @dirty-change=${this._onPreviewDirty}>
    </preview-pane>`;
    return html`
      <toast-stack></toast-stack>
      <div class="focus-body">
        <focus-header
          back-label="新对话"
          title=${s.currentSession?.title ?? ""}
          meta=${`${s.messages.length} 条消息`}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main ${hasPreview ? "has-preview" : ""}"
             style="--preview-pane-width: ${this._previewPaneWidth}px">
          <chat-stream
            .messages=${s.messages}
            @reference-click=${this._onReferenceClick}>
          </chat-stream>
          ${hasPreview ? html`
            <div class="splitter desktop-only"
                 role="separator"
                 aria-orientation="vertical"
                 aria-label="调整预览栏宽度"
                 @mousedown=${this._onSplitterMouseDown}></div>
            <div class="preview-pane-wrap desktop-only">
              <button class="preview-close" type="button" aria-label="关闭预览"
                      @click=${this._closePreview}>✕</button>
              ${this.previewError === "NOT_INDEXED"
                ? this._renderNotIndexedHint()
                : previewPane(false)}
            </div>` : null}
        </div>
        <div class="input-bar">
          <input-box
            placeholder="继续对话..."
            button-label="→"
            multiline
            ?disabled=${s.streaming}
            .value=${this.draft}
            @input-change=${(e: any) => (this.draft = e.detail.value)}
            @submit=${this._submit}>
          </input-box>
        </div>
      </div>
      ${hasPreview ? html`
        <div class="preview-overlay">
          <focus-header
            back-label="返回"
            title=${this.previewPath}
            @back=${this._closePreview}>
          </focus-header>
          ${this.previewError === "NOT_INDEXED"
            ? this._renderNotIndexedHint()
            : previewPane(true)}
        </div>` : null}
    `;
  }
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/chat-view-preview.spec.ts`
Expected: PASS（6 tests）

- [ ] **Step 8: Run full frontend test suite to confirm no regression**

Run: `cd doclens/web_v2/frontend && npx vitest run`
Expected: 所有既有测试 + 新增 11 个测试全部 PASS。

- [ ] **Step 9: Commit**（需用户授权）

```bash
git add doclens/web_v2/frontend/src/views/chat-view.ts doclens/web_v2/frontend/tests/chat-view-preview.spec.ts
git commit -m "feat(chat): preview 参考资料 documents in-pane (desktop) / overlay (mobile)"
```

---

### Task 3: 前端构建验证 + E2E 手验指引

**Files:** 无代码改动；构建产物 + E2E 验证。

- [ ] **Step 1: 生产构建确认无 TS / 打包错误**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: `tsc --noEmit` 通过 + `vite build` 产出 `../static/assets/` 新 hash 文件，无报错。

- [ ] **Step 2: E2E 手验（playwright-cli skill）**

前提：后端已起 `pwsh -File ./start-app.ps1 gui`，知识库已索引含可引用文档。

调用 `/playwright-cli` skill：
1. 打开 GUI → 进入 chat tab → 提一个能命中知识库的问题（如 `知识库里有哪些文档？`）。
2. 等 AI 回答出现「## 参考资料」→ **断言路径有下划线/可点样式**（`.ref-link`）。
3. 点击某条路径 → **桌面端右侧出现 preview-pane**，内容为对应文档，关键词高亮；顶部「✕」可关闭恢复 chat 全宽。
4. 拖动 splitter → preview 宽度变化，刷新后宽度保持（localStorage）。
5. 窄屏（<1024px，DevTools 切移动端或窄窗）→ 点击路径走**全屏 overlay**，`← 返回` 回到对话。
6. 边界：若点到未索引文件 → preview 区显示「该文件未索引」提示。

- [ ] **Step 3: 记录结果**

把 E2E 观察回报会话。若点击无反应 / preview 不出 / 布局错乱，回对应 Task 排查。

---

## Self-Review

**1. Spec coverage：**
- chat-message 后处理 + 事件 → Task 1 ✓
- chat-view preview state + _onReferenceClick + fetchPreview + 错误处理 + confirm → Task 2 Step 5 ✓
- 桌面水平布局 + splitter + 按需开合 + 关闭按钮 → Task 2 Step 4/6 ✓
- 移动 overlay + focus-header 返回 → Task 2 Step 6 ✓
- 未索引提示 → Task 2 Step 5/6 ✓
- 编辑脏标志 confirm → Task 2 Step 5 `_safeAction` ✓
- keyword 取最近一问 → Task 2 Step 5 `_previewKeyword` ✓
- 已知限制（路径取 textContent / 中文标题匹配）→ Task 1 实现一致 ✓
- E2E → Task 3 ✓

**2. Placeholder scan：** 所有步骤含完整 TS 代码 / 确切命令 / 预期输出，无 TBD/TODO。✓

**3. Type consistency：**
- `reference-click` 事件 `detail: { path: string }` —— Task 1 派发与 Task 2 接收一致 ✓
- `_onReferenceClick(e: CustomEvent<{ path: string }>)` —— Task 2 定义与测试调用 `(el as any)._onReferenceClick({ detail: { path } } as any)` 一致 ✓
- `previewOpen/previewPath/previewContent/...` —— Task 2 Step 3 定义、Step 5 读写、测试断言一致 ✓
- `PREVIEW_PANE_WIDTH_*` 常量与 `_onSplitterMouseDown` / `_loadPreviewPaneWidth` 引用一致 ✓
- `PageMarker` 从 `../api/preview` 导入，与 preview-pane 一致 ✓

**4. Ambiguity：**
- "桌面 previewOpen=false 时 chat-stream 居中"：用 `.focus-main:not(.has-preview) chat-stream` 选择器明确（Step 4 CSS）✓
- "移动 overlay 与桌面 pane 互斥"：`.preview-overlay` 在 `@media(min-width:1024px)` 隐藏；`.focus-main .desktop-only` 在 `@media(max-width:1023px)` 隐藏（Step 4 CSS）✓
- splitter 拖动仅桌面：`.splitter.desktop-only` class + CSS 双保险 ✓

无类型/命名漂移，无歧义。
