# Mobile Preview Header Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在移动端浏览器预览 Markdown 时，移除 `preview-pane` 内部重复的路径 header（与 `focus-header` title 重复），把 "✏️ 编辑" 按钮迁移到 `focus-header` 最右侧新增的 "更多 ▾" 下拉菜单中。

**Architecture:** 给 `focus-header` 加可选的 `actions` 属性，渲染 "更多 ▾" + 下拉面板（沿用 `app-bar` 的菜单样式）。给 `preview-pane` 加 `noHeader` 属性，从 DOM 真正移除内部 header。`search-view` 在移动端 detail-overlay 启用这两个 prop。桌面端完全不变。

**Tech Stack:** Lit 3 Web Components, TypeScript, Vite, vitest + @open-wc/testing

---

## File Structure

| 文件 | 职责 |
|------|------|
| `cortex/web_v2/frontend/src/components/preview-pane.ts` (修改) | 新增 `noHeader` 属性 + public `enterEdit()` |
| `cortex/web_v2/frontend/src/components/focus-header.ts` (修改) | 新增 `actions` 属性 + "更多 ▾" 按钮 + 下拉面板 + 状态管理 |
| `cortex/web_v2/frontend/src/views/search-view.ts` (修改) | detail-overlay 接线：`actions` → focus-header，`?noHeader` → preview-pane，新增 `_enterPreviewEdit()` |
| `cortex/web_v2/frontend/tests/focus-header.spec.ts` (新增) | 5 个测试覆盖 actions / 下拉 / 点击外部关闭 |
| `cortex/web_v2/frontend/tests/preview-pane.spec.ts` (追加) | +2 个测试覆盖 `noHeader` + `enterEdit()` |
| `cortex/web_v2/static/index.html` + `cortex/web_v2/static/assets/*` (构建产物) | vite build 输出 |

---

## Task 1: preview-pane `noHeader` 属性 + public `enterEdit()`

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/preview-pane.ts`
- Modify: `cortex/web_v2/frontend/tests/preview-pane.spec.ts` (追加 2 个测试)

- [ ] **Step 1: 追加测试 — `noHeader=true` 时三个分支都不渲染 `.header`**

在 `cortex/web_v2/frontend/tests/preview-pane.spec.ts` 文件末尾追加：

```typescript
describe("<preview-pane> noHeader prop", () => {
  it("does not render .header in markdown preview branch when noHeader=true", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# hi" ?noHeader=${true}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".header")).toBeNull();
    expect(el.shadowRoot!.querySelector("md-viewer")).toBeTruthy();
  });

  it("does not render .header in edit mode when noHeader=true", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# hi" writable ?noHeader=${true}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    // 直接调用 public enterEdit() 进入编辑模式
    el.enterEdit();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".header")).toBeNull();
    expect(el.shadowRoot!.querySelector("md-editor")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd cortex/web_v2/frontend && npx vitest run tests/preview-pane.spec.ts
```

Expected: 2 个新测试失败（"noHeader is not a property" / "enterEdit is not a function" / 或 .header 仍然存在）。具体哪个错误先出现都可以。

- [ ] **Step 3: 修改 `preview-pane.ts` — 加 `noHeader` 属性 + 改 `_enterEdit` 为 public `enterEdit`**

修改 `cortex/web_v2/frontend/src/components/preview-pane.ts`：

**3a)** 在 `@property({ type: Boolean }) writable = false;` 之后追加：

```typescript
  @property({ type: Boolean }) noHeader = false;
```

**3b)** 将 `private _enterEdit = () => { this._mode = "edit"; };` 替换为：

```typescript
  /** Public API: 让父组件（search-view / focus-header actions 回调）触发进入编辑模式。 */
  enterEdit() {
    this._mode = "edit";
  }
```

**3c)** 三个 render 分支中所有 `<div class="header">...</div>` 改为：

md-edit 分支（第 129-131 行附近）：
```typescript
    if (this.language === "markdown" && this._mode === "edit") {
      return html`
        ${this.noHeader ? null : html`
          <div class="header">
            <span class="path">${this.path}</span>
          </div>
        `}
        <md-editor
          .path=${this.path}
          .originalContent=${this._content}
          @save=${this._onEditorSave}
          @cancel=${this._onEditorCancel}
          @dirty-change=${this._onEditorDirty}
        ></md-editor>
      `;
    }
```

md-preview 分支（第 142-156 行附近）：
```typescript
    if (this.language === "markdown") {
      return html`
        ${this.noHeader ? null : html`
          <div class="header">
            <span class="path">${this.path}</span>
            ${this.writable
              ? html`<button class="edit-btn" @click=${() => this.enterEdit()}>✏️ 编辑</button>`
              : null}
          </div>
        `}
        <md-viewer
          .content=${this._content}
          .line=${this.line}
          .keyword=${this.keyword}
        ></md-viewer>
      `;
    }
```

非 md 分支（第 161-163 行附近）：
```typescript
    // 非 md：现有纯文本 + 行号视图
    const lines = this._content.split("\n");
    return html`
      ${this.noHeader ? null : html`
        <div class="header">
          <span class="path">${this.path}</span>
        </div>
      `}
      <div class="body">
        ${lines.map((line, i) => {
          const lineNo = i + 1;
          const cls = this.highlights.includes(lineNo) ? "highlight" : "";
          return html`<div class=${cls}><span style="color:var(--cortex-text-subtle);display:inline-block;width:40px;">${lineNo}</span>${line}</div>`;
        })}
      </div>
    `;
  }
```

注意：md-preview 分支中原本是 `@click=${this._enterEdit}`（私有方法引用），现在改为 `@click=${() => this.enterEdit()}`，因为我们把 `_enterEdit` 改成了 public `enterEdit`。

- [ ] **Step 4: 跑 preview-pane 测试验证通过**

Run:
```bash
cd cortex/web_v2/frontend && npx vitest run tests/preview-pane.spec.ts
```

Expected: 全部通过（原有 8 + 新增 2 = 10 个）。

- [ ] **Step 5: 跑 tsc 验证类型**

Run:
```bash
cd cortex/web_v2/frontend && npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
cd D:/github/cortex
git add cortex/web_v2/frontend/src/components/preview-pane.ts cortex/web_v2/frontend/tests/preview-pane.spec.ts
git commit -m "feat(preview-pane): add noHeader prop + public enterEdit() for mobile header removal"
```

---

## Task 2: focus-header `actions` 属性 + "更多 ▾" 下拉

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/focus-header.ts`
- Create: `cortex/web_v2/frontend/tests/focus-header.spec.ts`

- [ ] **Step 1: 创建测试文件**

创建 `cortex/web_v2/frontend/tests/focus-header.spec.ts`：

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { FocusHeader, FocusHeaderAction } from "../src/components/focus-header";
import "../src/components/focus-header";

describe("<focus-header> actions prop", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not render .more-btn when actions is empty", async () => {
    const el = await fixture(html`<focus-header title="t"></focus-header>`) as FocusHeader;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".more-btn")).toBeNull();
  });

  it("renders .more-btn when actions is non-empty", async () => {
    const el = await fixture(html`
      <focus-header title="t" .actions=${[{ label: "A", onClick: () => {} }]}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".more-btn")).toBeTruthy();
  });

  it("clicking .more-btn toggles the dropdown", async () => {
    const el = await fixture(html`
      <focus-header title="t" .actions=${[{ label: "A", onClick: () => {} }]}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement;
    btn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeTruthy();
    btn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeNull();
  });

  it("clicking a menu item calls onClick and closes the dropdown", async () => {
    const onClick = vi.fn();
    const el = await fixture(html`
      <focus-header title="t" .actions=${[{ label: "A", icon: "🔧", onClick }]}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement).click();
    await el.updateComplete;
    const item = el.shadowRoot!.querySelector(".menu-item") as HTMLButtonElement;
    item.click();
    await el.updateComplete;
    expect(onClick).toHaveBeenCalledOnce();
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeNull();
  });

  it("clicking outside closes the dropdown", async () => {
    const el = await fixture(html`
      <focus-header title="t" .actions=${[{ label: "A", onClick: () => {} }]}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeTruthy();
    // 模拟点击 body 上的其它元素
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run:
```bash
cd cortex/web_v2/frontend && npx vitest run tests/focus-header.spec.ts
```

Expected: 全部 5 个测试失败（FocusHeaderAction 类型未导出 / actions prop 不存在 / etc.）。

- [ ] **Step 3: 修改 `focus-header.ts`**

完整重写 `cortex/web_v2/frontend/src/components/focus-header.ts`：

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export interface FocusHeaderAction {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
}

@customElement("focus-header")
export class FocusHeader extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      background: var(--cortex-surface-muted);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
      position: relative;
    }
    .back {
      background: none;
      border: none;
      color: var(--cortex-primary);
      font-weight: 600;
      font-size: var(--cortex-fs-base);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .back:hover { background: var(--cortex-primary-soft); }
    .title {
      font-weight: 600;
      color: var(--cortex-text);
      font-size: var(--cortex-fs-md);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta { color: var(--cortex-text-subtle); font-size: var(--cortex-fs-sm); }
    .more-wrap { position: relative; }
    .more-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: 1px solid var(--cortex-border);
      color: var(--cortex-text);
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: 4px 10px;
      border-radius: var(--cortex-radius-sm);
      cursor: pointer;
    }
    .more-btn:hover { background: var(--cortex-surface); }
    .more-btn .chev { transition: transform 0.15s; display: inline-block; }
    .more-btn[aria-expanded="true"] .chev { transform: rotate(180deg); }
    .menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 200px;
      max-width: 280px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      box-shadow: 0 8px 24px rgba(0,0,0,0.10);
      padding: var(--cortex-space-2);
      display: none;
      z-index: 60;
    }
    .menu.open { display: block; }
    .menu-item {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
      transition: background 0.15s;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      font-family: inherit;
      color: var(--cortex-text);
    }
    .menu-item:hover { background: var(--cortex-surface-muted); }
    .menu-item:disabled { opacity: 0.5; cursor: not-allowed; }
    .menu-item .icon { font-size: 16px; flex-shrink: 0; }
    .menu-item .label { font-size: var(--cortex-fs-sm); font-weight: 500; }
  `;

  @property() backLabel = "返回";
  @property() title = "";
  @property() meta = "";
  @property({ attribute: false }) actions: FocusHeaderAction[] = [];

  @state() private _menuOpen = false;

  private _back() {
    this.dispatchEvent(new CustomEvent("back", { bubbles: true, composed: true }));
  }

  private _onMoreClick(e: Event) {
    e.stopPropagation();
    this._menuOpen = !this._menuOpen;
  }

  private _onItemClick(action: FocusHeaderAction) {
    if (action.disabled) return;
    this._menuOpen = false;
    action.onClick();
  }

  private _onDocClick: (e: MouseEvent) => void = (e: MouseEvent) => {
    if (!this._menuOpen) return;
    const path = e.composedPath();
    if (!path.includes(this)) {
      this._menuOpen = false;
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._onDocClick);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocClick);
    super.disconnectedCallback();
  }

  render() {
    return html`
      <button class="back" @click=${this._back}>← ${this.backLabel}</button>
      <div class="title">${this.title}</div>
      ${this.meta ? html`<div class="meta">${this.meta}</div>` : null}
      ${this.actions.length > 0 ? html`
        <div class="more-wrap">
          <button
            class="more-btn"
            type="button"
            aria-haspopup="true"
            aria-expanded=${this._menuOpen ? "true" : "false"}
            @click=${this._onMoreClick}
          >
            更多 <span class="chev">▾</span>
          </button>
          <div class="menu ${this._menuOpen ? "open" : ""}" role="menu">
            ${this.actions.map((a) => html`
              <button
                class="menu-item"
                type="button"
                role="menuitem"
                ?disabled=${a.disabled ?? false}
                @click=${() => this._onItemClick(a)}
              >
                ${a.icon ? html`<span class="icon">${a.icon}</span>` : null}
                <span class="label">${a.label}</span>
              </button>
            `)}
          </div>
        </div>
      ` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "focus-header": FocusHeader;
  }
}
```

- [ ] **Step 4: 跑 focus-header 测试验证通过**

Run:
```bash
cd cortex/web_v2/frontend && npx vitest run tests/focus-header.spec.ts
```

Expected: 全部 5 个通过。

- [ ] **Step 5: 跑 tsc 验证类型**

Run:
```bash
cd cortex/web_v2/frontend && npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
cd D:/github/cortex
git add cortex/web_v2/frontend/src/components/focus-header.ts cortex/web_v2/frontend/tests/focus-header.spec.ts
git commit -m "feat(focus-header): add actions prop with '更多 ▾' dropdown menu"
```

---

## Task 3: search-view 接线 — `actions` + `?noHeader` 推到移动端

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/search-view.ts`

- [ ] **Step 1: 修改 detail-overlay 区域**

在 `cortex/web_v2/frontend/src/views/search-view.ts` 中，找到 detail-overlay 渲染块（约第 373-393 行）：

将：
```typescript
      ${detailTop ? html`
        <div class="detail-overlay">
          <focus-header
            back-label="结果"
            title=${detailTop.path}
            @back=${this._popDetail}>
          </focus-header>
          ${this.previewError === "NOT_INDEXED"
            ? this._renderNotIndexedHint(false)
            : html`<preview-pane
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${s.query}
                ?writable=${this.previewWritable}
                @dirty-change=${this._onPreviewDirty}
                @saved=${this._onPreviewSaved}
                @save-failed=${this._onPreviewSaveFailed}>
              </preview-pane>`}
        </div>` : null}
```

改为：
```typescript
      ${detailTop ? html`
        <div class="detail-overlay">
          <focus-header
            back-label="结果"
            title=${detailTop.path}
            .actions=${this.previewWritable
              ? [{ label: "编辑", icon: "✏️", onClick: () => this._enterPreviewEdit() }]
              : []}
            @back=${this._popDetail}>
          </focus-header>
          ${this.previewError === "NOT_INDEXED"
            ? this._renderNotIndexedHint(false)
            : html`<preview-pane
                ?noHeader=${true}
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${s.query}
                ?writable=${this.previewWritable}
                @dirty-change=${this._onPreviewDirty}
                @saved=${this._onPreviewSaved}
                @save-failed=${this._onPreviewSaveFailed}>
              </preview-pane>`}
        </div>` : null}
```

- [ ] **Step 2: 新增 `_enterPreviewEdit` 私有方法**

在 `search-view.ts` 中找到 `_discardPreviewEdits` 方法（约第 232-236 行），在它后面追加：

```typescript
  private _enterPreviewEdit() {
    const pp = this.shadowRoot?.querySelector(".detail-overlay preview-pane") as any;
    pp?.enterEdit?.();
  }
```

- [ ] **Step 3: 跑全部前端测试验证通过**

Run:
```bash
cd cortex/web_v2/frontend && npx vitest run
```

Expected: 全部通过（已有 79 + 新增 5 + 新增 2 = 86 个）。如果有旧的 search-view-edit.spec.ts 测试失败（detail-overlay preview-pane 行为变化），需要更新断言。

注：已有的 `tests/search-view-edit.spec.ts` 第 49 行 `const pp = el.shadowRoot!.querySelector("preview-pane") as any;` — 这查的是 desktop-only preview-pane，**不应该**受影响。但如果有任何测试查 detail-overlay 的 preview-pane（不存在，因为 fixture 不会触发 detail-overlay），就不需要改。

- [ ] **Step 4: 跑 tsc 验证类型**

Run:
```bash
cd cortex/web_v2/frontend && npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 5: 提交**

```bash
cd D:/github/cortex
git add cortex/web_v2/frontend/src/views/search-view.ts
git commit -m "feat(search-view): wire focus-header actions + preview-pane noHeader on mobile overlay"
```

---

## Task 4: vite build + 提交构建产物

**Files:**
- Modify: `cortex/web_v2/static/index.html`
- Modify: `cortex/web_v2/static/assets/*`（构建产物）

- [ ] **Step 1: 跑 vite build**

Run:
```bash
cd cortex/web_v2/frontend && npm run build
```

Expected: 成功，输出到 `cortex/web_v2/static/`。控制台打印构建信息（模块数、耗时、输出文件大小）。

- [ ] **Step 2: 检查构建产物**

Run:
```bash
git status cortex/web_v2/static/
```

Expected: `index.html` 和 `assets/index.*.js`/`assets/index.*.css` 标记为 modified（hash 会变）。

- [ ] **Step 3: 提交构建产物**

```bash
cd D:/github/cortex
git add cortex/web_v2/static/
git commit -m "build(web_v2): production frontend build for mobile preview header redesign"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: Section 1.1/1.2/1.3 目标 → Task 1+2+3 实现；Section 2.1 focus-header actions → Task 2；Section 2.2 preview-pane noHeader+enterEdit → Task 1；Section 2.3 search-view 接线 → Task 3；Section 4 验收 → 通过 Task 1+2+3 的测试和 Task 4 的 build
- [x] **Type consistency**: `FocusHeaderAction` interface 在 Task 2 定义，Task 3 中 `.actions=${[{ label, icon, onClick }]}` 严格匹配；`enterEdit()` 在 Task 1 暴露，Task 3 中 `pp.enterEdit?.()` 调用
- [x] **No placeholders**: 每个代码步骤都给出完整代码
- [x] **TDD order**: 三个组件任务都是 "先写测试 → 跑红 → 实现 → 跑绿 → 提交"
- [x] **Frequent commits**: 每个 Task 单独 commit，便于 review 和回滚
