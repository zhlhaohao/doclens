# Markdown Preview with Line Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `.md` 文件点击搜索结果卡片后，preview-pane 渲染为 markdown HTML，并自动滚动到命中行所在块级元素、短暂高亮。

**Architecture:** 后端让 treesearch 的 `flat_nodes` 透传 `line_start`，`/api/search` 把它放进 `SearchResult.line`；前端新增 `<md-viewer>` 组件用 `marked` 渲染并给块级元素打 `data-source-line`，`<preview-pane>` 按 `language` 分支到 `<md-viewer>` 或现有纯文本视图。

**Tech Stack:** Python 3.10 + FastAPI（后端）、Lit 3 + TypeScript（前端）、`marked`（markdown 渲染）、vitest（前端单测）、Playwright（e2e）、pytest（后端测试）。

**Spec:** `docs/superpowers/specs/2026-06-17-markdown-preview-with-line-location-design.md`

---

## File Structure

| 文件 | 改动类型 | 责任 |
|------|----------|------|
| `treesearch/search.py` | 修改 | `flat_nodes` 候选项追加 `line_start`/`line_end` |
| `cortex/web_v2/api/search.py` | 修改 | `SearchResult.line` 从 `node.line_start` 取 |
| `cortex/web_v2/frontend/package.json` + `package-lock.json` | 新增依赖 | `marked` |
| `cortex/web_v2/frontend/src/components/md-viewer.ts` | 新建 | markdown → HTML，data-source-line，scroll + highlight |
| `cortex/web_v2/frontend/src/components/preview-pane.ts` | 修改 | 新增 `line` 属性；按 `language` 分支 |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 修改 | 新增 `previewLine` state，透传给 preview-pane |
| `cortex/web_v2/frontend/src/styles/global.css` | 修改 | `.highlight-flash` keyframe |
| `tests/web_v2/test_search_api.py` | 修改 | 扩展 line 断言 |
| `cortex/web_v2/frontend/tests/md-viewer.spec.ts` | 新建 | md-viewer 单测 |
| `cortex/web_v2/frontend/tests/e2e/markdown-preview.spec.ts` | 新建 | e2e |

---

## Task 1: 后端 — flat_nodes 透传 line_start

**Files:**
- Modify: `treesearch/search.py:743-751`（`flat_nodes` 构建循环）
- Modify: `cortex/web_v2/api/search.py:43-65`（`_format_results`）
- Test: `tests/web_v2/test_search_api.py`

- [ ] **Step 1: 扩展失败测试**

打开 `tests/web_v2/test_search_api.py`，在 `test_search_path_can_be_previewed` 末尾的 `for r in body["results"]:` 循环里，在已有的 `assert "." in path` 之后追加：

```python
            # line 必须是 int（命中行号）或 None（treesearch 未注入）
            assert r["line"] is None or isinstance(r["line"], int), (
                f"line 字段类型错误: {type(r['line'])} value={r['line']!r}"
            )
            # .md 命中应有具体行号（fixture 里 doc1.md 必带 line_start）
            if path.endswith(".md"):
                assert isinstance(r["line"], int) and r["line"] >= 1, (
                    f"markdown 结果缺少 line: {r!r}"
                )
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py::test_search_path_can_be_previewed -xvs`
Expected: FAIL，`assert isinstance(r["line"], int)` 不成立（当前 `line=None`）

- [ ] **Step 3: 改 treesearch/search.py 让 flat_nodes 带 line_start/line_end**

打开 `treesearch/search.py`，定位 743-751 行的 `all_candidates.append({...})`，追加 `line_start`/`line_end`：

```python
        all_candidates.append({
            "node_id": node.get("node_id", ""),
            "doc_id": doc_result.get("doc_id", ""),
            "doc_name": doc_result.get("doc_name", ""),
            "title": node.get("title", ""),
            "score": node.get("score", 0),
            "text": node.get("text", ""),
            "line_start": node.get("line_start"),
            "line_end": node.get("line_end"),
        })
```

- [ ] **Step 4: 改 cortex/web_v2/api/search.py 透传 line**

打开 `cortex/web_v2/api/search.py`，定位 `_format_results` 里的 `yield SearchResult(...)`，把 `line=None` 改为：

```python
        yield SearchResult(
            path=path,
            snippet=snippet,
            score=score,
            line=node.get("line_start"),
            highlights=[],
        )
```

- [ ] **Step 5: 运行测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py -xvs`
Expected: PASS（3 个测试全过）

- [ ] **Step 6: 提交**

```bash
git add treesearch/search.py cortex/web_v2/api/search.py tests/web_v2/test_search_api.py
git commit -m "feat(search): surface line_start through flat_nodes to SearchResult"
```

---

## Task 2: 前端 — 安装 marked 依赖

**Files:**
- Modify: `cortex/web_v2/frontend/package.json`
- Modify: `cortex/web_v2/frontend/package-lock.json`（npm 自动改）

- [ ] **Step 1: 安装 marked**

```bash
cd cortex/web_v2/frontend
npm install marked
```

- [ ] **Step 2: 确认 package.json 里有 marked**

```bash
grep '"marked"' package.json
```
Expected: 输出包含 `"marked": "^15.x.x"`（具体版本以 npm 最新稳定版为准）

- [ ] **Step 3: 提交**

```bash
cd ../../..
git add cortex/web_v2/frontend/package.json cortex/web_v2/frontend/package-lock.json
git commit -m "feat(frontend): add marked for markdown rendering"
```

---

## Task 3: 前端 — 创建 md-viewer 组件（基础渲染，无 line 支持）

**Files:**
- Create: `cortex/web_v2/frontend/src/components/md-viewer.ts`
- Create: `cortex/web_v2/frontend/tests/md-viewer.spec.ts`

- [ ] **Step 1: 写失败测试**

新建 `cortex/web_v2/frontend/tests/md-viewer.spec.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/md-viewer";

describe("<md-viewer>", () => {
  it("renders markdown content as HTML", async () => {
    const el = await fixture(html`
      <md-viewer content="# Title\n\nparagraph"></md-viewer>
    `);
    // 等待首次 update 完成
    await el.updateComplete;

    const h1 = el.shadowRoot!.querySelector("h1");
    expect(h1).toBeTruthy();
    expect(h1!.textContent).toContain("Title");

    const p = el.shadowRoot!.querySelector("p");
    expect(p).toBeTruthy();
    expect(p!.textContent).toContain("paragraph");
  });

  it("renders empty state when content is empty", async () => {
    const el = await fixture(html`<md-viewer content=""></md-viewer>`);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".empty")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd cortex/web_v2/frontend
npx vitest run tests/md-viewer.spec.ts
```
Expected: FAIL，`md-viewer` 组件未注册

- [ ] **Step 3: 创建 md-viewer 组件**

新建 `cortex/web_v2/frontend/src/components/md-viewer.ts`：

```typescript
import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import { marked } from "marked";

@customElement("md-viewer")
export class MdViewer extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 12px 16px;
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-base);
      line-height: 1.7;
      color: var(--cortex-text);
      overflow: auto;
      height: 100%;
    }
    :host h1, :host h2, :host h3 {
      margin: 1em 0 0.5em;
      line-height: 1.3;
    }
    :host h1 { font-size: 1.4em; }
    :host h2 { font-size: 1.2em; }
    :host h3 { font-size: 1.05em; }
    :host p { margin: 0.5em 0; }
    :host ul, :host ol { margin: 0.5em 0; padding-left: 1.5em; }
    :host li { margin: 0.2em 0; }
    :host pre {
      background: var(--cortex-surface-muted);
      padding: 8px 12px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    :host code {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    :host blockquote {
      border-left: 3px solid var(--cortex-border);
      padding-left: 12px;
      color: var(--cortex-text-muted);
      margin: 0.5em 0;
    }
    .empty {
      color: var(--cortex-text-subtle);
      text-align: center;
      padding: 24px;
    }
    /* 见 Task 5：高亮动画 */
    .highlight-flash {
      animation: highlight-flash 2s ease-out;
    }
    @keyframes highlight-flash {
      0% { background: rgba(254, 243, 199, 0.8); }
      100% { background: transparent; }
    }
  `;

  @property() content = "";
  /** 1-indexed 目标行；渲染后滚动到 data-source-line ≤ line 的最近块 */
  @property({ type: Number }) line: number | null = null;

  updated() {
    // Task 5 会在这里挂 scroll + highlight 逻辑
  }

  render() {
    if (!this.content) {
      return html`<div class="empty">无内容</div>`;
    }
    const raw = marked.parse(this.content, { async: false }) as string;
    return html`<div class="md-body" .innerHTML=${raw}></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "md-viewer": MdViewer;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/md-viewer.spec.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd ../../..
git add cortex/web_v2/frontend/src/components/md-viewer.ts cortex/web_v2/frontend/tests/md-viewer.spec.ts
git commit -m "feat(frontend): add basic <md-viewer> component"
```

---

## Task 4: 前端 — md-viewer 加 data-source-line 属性

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/md-viewer.ts`
- Modify: `cortex/web_v2/frontend/tests/md-viewer.spec.ts`

- [ ] **Step 1: 扩展失败测试**

在 `tests/md-viewer.spec.ts` 末尾追加：

```typescript
  it("adds data-source-line to block elements", async () => {
    const md = "# Title\n\nfirst paragraph\n\nsecond paragraph\n";
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`);
    await el.updateComplete;

    const h1 = el.shadowRoot!.querySelector("h1");
    expect(h1?.getAttribute("data-source-line")).toBe("1");

    const ps = el.shadowRoot!.querySelectorAll("p");
    expect(ps.length).toBe(2);
    expect(ps[0].getAttribute("data-source-line")).toBe("3");
    expect(ps[1].getAttribute("data-source-line")).toBe("5");
  });
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd cortex/web_v2/frontend
npx vitest run tests/md-viewer.spec.ts
```
Expected: FAIL，`h1.getAttribute("data-source-line")` 为 `null`

- [ ] **Step 3: 用 marked 的 renderer override 注入 data-source-line**

修改 `cortex/web_v2/frontend/src/components/md-viewer.ts`，在文件顶部 `import` 之后，`@customElement` 之前加入：

```typescript
// 块级元素 renderer —— 给每个块加 data-source-line（1-indexed）
// marked v15+ renderer 方法接收完整 token 对象；token.line 是 0-indexed 起始行
const blockRenderer = {
  heading(token: any) {
    const text = (this as any).parser.parseInline(token.tokens);
    const line = token.line ?? 0;
    return `<h${token.depth} data-source-line="${line + 1}">${text}</h${token.depth}>\n`;
  },
  paragraph(token: any) {
    const text = (this as any).parser.parseInline(token.tokens);
    const line = token.line ?? 0;
    return `<p data-source-line="${line + 1}">${text}</p>\n`;
  },
  code(token: any) {
    const line = token.line ?? 0;
    const langAttr = token.lang ? ` class="language-${token.lang}"` : "";
    return `<pre data-source-line="${line + 1}"><code${langAttr}>${escapeHtml(token.text)}</code></pre>\n`;
  },
  list(token: any) {
    const line = token.line ?? 0;
    const tag = token.ordered ? "ol" : "ul";
    const body = (this as any).parser.parse(token.items);
    return `<${tag} data-source-line="${line + 1}">${body}</${tag}>\n`;
  },
  blockquote(token: any) {
    const line = token.line ?? 0;
    const body = (this as any).parser.parse(token.tokens);
    return `<blockquote data-source-line="${line + 1}">${body}</blockquote>\n`;
  },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);
}

// 标记是否已 use 过（避免重复 use）
let mdConfigured = false;
function ensureMdConfigured() {
  if (mdConfigured) return;
  mdConfigured = true;
  marked.use({ renderer: blockRenderer as any });
}
```

然后在 `render()` 方法第一行（`if (!this.content)` 之前）调用 `ensureMdConfigured();`：

```typescript
  render() {
    ensureMdConfigured();
    if (!this.content) {
      return html`<div class="empty">无内容</div>`;
    }
    const raw = marked.parse(this.content, { async: false }) as string;
    return html`<div class="md-body" .innerHTML=${raw}></div>`;
  }
```

> **实现时验证**：marked v15+ 的 renderer 接收 token 对象，token 上应有 `line` 字段（0-indexed）。如发现 token 没带 `line`，改用 `marked.Lexer.lex(content)` 先拿到 token 流，建立 `token.type+text → sourceLine` 的 Map，在 renderer 里通过 token.text 反查。验证方法：在浏览器 devtools 里检查渲染出的 `<h1>` 是否带 `data-source-line="1"`。

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/md-viewer.spec.ts
```
Expected: PASS（3 个测试）

- [ ] **Step 5: 提交**

```bash
cd ../../..
git add cortex/web_v2/frontend/src/components/md-viewer.ts cortex/web_v2/frontend/tests/md-viewer.spec.ts
git commit -m "feat(frontend): inject data-source-line into md-viewer block elements"
```

---

## Task 5: 前端 — md-viewer 加 scroll + highlight

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/md-viewer.ts`
- Modify: `cortex/web_v2/frontend/tests/md-viewer.spec.ts`

- [ ] **Step 1: 扩展失败测试**

在 `tests/md-viewer.spec.ts` 末尾追加：

```typescript
  it("scrolls to and highlights block containing target line", async () => {
    const md = "# Heading 1\n\npara 1\n\n## Heading 2\n\npara 2\n";
    const el = await fixture(html`<md-viewer .content=${md} .line=${6}></md-viewer>`) as any;
    await el.updateComplete;

    // 找到 data-source-line ≤ 6 的最后一个块（应该是 "## Heading 2" 在第 5 行）
    const highlighted = el.shadowRoot!.querySelector(".highlight-flash");
    expect(highlighted).toBeTruthy();
    expect(highlighted!.getAttribute("data-source-line")).toBe("5");
  });

  it("does not highlight when line is null", async () => {
    const el = await fixture(html`<md-viewer content="# x" .line=${null}></md-viewer>`) as any;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".highlight-flash")).toBeNull();
  });
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd cortex/web_v2/frontend
npx vitest run tests/md-viewer.spec.ts
```
Expected: FAIL，前 4 个测试通过，新增 2 个失败

- [ ] **Step 3: 实现 scroll + highlight 逻辑**

修改 `md-viewer.ts` 的 `updated()` 方法：

```typescript
  updated(changedProps: Map<string, unknown>) {
    super.updated?.(changedProps);
    if (changedProps.has("line") || changedProps.has("content")) {
      this._locateAndHighlight();
    }
  }

  private _locateAndHighlight() {
    if (this.line === null || this.line === undefined) return;
    const blocks = Array.from(
      this.shadowRoot!.querySelectorAll<HTMLElement>("[data-source-line]")
    );
    if (blocks.length === 0) return;

    // 找 data-source-line <= this.line 的最后一个块
    const target = blocks.reduce<HTMLElement | null>((best, el) => {
      const ls = Number(el.getAttribute("data-source-line"));
      if (ls <= this.line! && (!best || ls > Number(best.getAttribute("data-source-line")))) {
        return el;
      }
      return best;
    }, null);
    if (!target) return;

    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.classList.remove("highlight-flash");  // 重置以便动画重放
    // 强制 reflow，让 animation 重新触发
    void target.offsetWidth;
    target.classList.add("highlight-flash");
  }
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/md-viewer.spec.ts
```
Expected: PASS（5 个测试）

- [ ] **Step 5: 提交**

```bash
cd ../../..
git add cortex/web_v2/frontend/src/components/md-viewer.ts cortex/web_v2/frontend/tests/md-viewer.spec.ts
git commit -m "feat(frontend): scroll to and highlight target line in md-viewer"
```

---

## Task 6: 前端 — preview-pane 按 language 分支

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/preview-pane.ts`

- [ ] **Step 1: 写失败测试**

新建 `cortex/web_v2/frontend/tests/preview-pane.spec.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/preview-pane";

describe("<preview-pane> markdown branch", () => {
  it("renders <md-viewer> when language is markdown", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# Title"
        .line=${1}>
      </preview-pane>
    `) as any;
    await el.updateComplete;
    const mdv = el.shadowRoot!.querySelector("md-viewer");
    expect(mdv).toBeTruthy();
    expect((mdv as any).line).toBe(1);
  });

  it("renders plain text view for other languages", async () => {
    const el = await fixture(html`
      <preview-pane language="python" content="print('hi')"></preview-pane>
    `) as any;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("md-viewer")).toBeNull();
    expect(el.shadowRoot!.querySelector(".body")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd cortex/web_v2/frontend
npx vitest run tests/preview-pane.spec.ts
```
Expected: FAIL，`<md-viewer>` 不存在

- [ ] **Step 3: 改 preview-pane.ts 加 line 属性 + 分支**

打开 `cortex/web_v2/frontend/src/components/preview-pane.ts`，在 properties 区追加：

```typescript
  @property({ type: Number }) line: number | null = null;
```

在文件顶部 import 区追加：

```typescript
import "./md-viewer";
```

替换 `render()` 方法（保留现有 `loading`/`empty` 分支）：

```typescript
  render() {
    if (this.loading) return html`<div class="empty">加载中...</div>`;
    if (!this.content) return html`<div class="empty">点击左侧结果查看预览</div>`;

    // markdown 走 <md-viewer>，其它类型保持原纯文本+行号视图
    if (this.language === "markdown") {
      return html`
        <div class="header">${this.path}</div>
        <md-viewer
          .content=${this.content}
          .line=${this.line}>
        </md-viewer>
      `;
    }

    const lines = this.content.split("\n");
    return html`
      <div class="header">${this.path}</div>
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

> **注意 CSS**：原 `:host { display: flex; flex-direction: column; flex: 1; }` 保留；md-viewer 自身 `:host { display: block; overflow: auto; height: 100%; }` 会撑满。若 md-viewer 没占满高度，给 preview-pane 的 md-viewer 加 `flex: 1; min-height: 0;` 包装 div。

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/preview-pane.spec.ts
```
Expected: PASS（2 个测试）

- [ ] **Step 5: 提交**

```bash
cd ../../..
git add cortex/web_v2/frontend/src/components/preview-pane.ts cortex/web_v2/frontend/tests/preview-pane.spec.ts
git commit -m "feat(frontend): preview-pane branches to md-viewer for markdown"
```

---

## Task 7: 前端 — search-view 透传 previewLine

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/search-view.ts`

- [ ] **Step 1: 写失败 e2e 测试占位（先标记 skip）**

跳过单测（search-view 集成层），直接在 Task 9 的 e2e 验证整链路。这里仅做代码改动 + 编译通过验证。

- [ ] **Step 2: 改 search-view.ts**

打开 `cortex/web_v2/frontend/src/views/search-view.ts`，在 state 区追加：

```typescript
  @state() private previewLine: number | null = null;
```

在 `_onResultSelect` 方法的 `this.previewContent = body.content;` 之后追加：

```typescript
        this.previewLine = (r.line as number | null) ?? null;
```

（位置：`this.previewLanguage = body.language;` 之后那一行）

把渲染里的两处 `<preview-pane>` 都加上 `.line=${this.previewLine}`：

第一处（desktop-only 那个）：

```html
          <preview-pane
            class="desktop-only"
            path=${this.previewPath}
            language=${this.previewLanguage}
            content=${this.previewContent}
            .line=${this.previewLine}>
          </preview-pane>
```

第二处（mobile overlay 内）：

```html
          <preview-pane
            path=${this.previewPath}
            language=${this.previewLanguage}
            content=${this.previewContent}
            .line=${this.previewLine}>
          </preview-pane>
```

- [ ] **Step 3: 类型检查 + 单测全跑**

```bash
cd cortex/web_v2/frontend
npm run typecheck
npx vitest run
```
Expected: typecheck 0 错误；vitest 全绿

- [ ] **Step 4: 提交**

```bash
cd ../../..
git add cortex/web_v2/frontend/src/views/search-view.ts
git commit -m "feat(frontend): pass previewLine from search result to preview-pane"
```

---

## Task 8: 构建 + Playwright 手动验证

**Files:**
- Modify: `cortex/web_v2/static/`（构建产物）

- [ ] **Step 1: 构建前端**

```bash
cd cortex/web_v2/frontend
npm run build
```
Expected: 输出 `dist/` 目录并 copy 到 `../static/`

- [ ] **Step 2: 重启 Cortex GUI**

打开运行 Cortex GUI 的终端，停掉旧实例，重新启动：

```bash
cd C:/Users/lianghao/github/cortex
.venv/Scripts/python.exe -m cortex gui
```

- [ ] **Step 3: Playwright 手动点击验证**

```bash
npx playwright-cli open http://localhost:7860/
```

操作：搜索 "工作记录" → 点击第一张 `.md` 卡片 → 截图：

```bash
npx playwright-cli screenshot --filename=.playwright-cli/md-preview.png
```

打开截图人工检查：
- preview-pane 内是格式化 markdown（h3/段落/列表）
- 视口滚动到中间某段（不是顶部）
- 命中块带淡黄色高亮（2 秒内淡出）

- [ ] **Step 4: 提交构建产物**

```bash
cd ../../..
git add cortex/web_v2/static/
git commit -m "build(web_v2): rebuild static with markdown preview"
```

---

## Task 9: E2E 测试

**Files:**
- Create: `cortex/web_v2/frontend/tests/e2e/markdown-preview.spec.ts`

- [ ] **Step 1: 写 e2e 测试**

新建 `cortex/web_v2/frontend/tests/e2e/markdown-preview.spec.ts`：

```typescript
import { test, expect } from "@playwright/test";

function shadow(page: import("@playwright/test").Page, host: string, inner: string) {
  return page.locator(`${host} >> ${inner}`);
}

test.describe("Markdown preview", () => {
  test("clicking a .md card renders markdown and highlights a block", async ({ page }) => {
    await page.goto("/");

    // 输入搜索
    const input = shadow(page, "input-box", "input").first();
    await input.fill("工作记录");
    await shadow(page, "input-box", "button").first().click();

    // 等待结果列表
    await expect(page.locator("result-card").first()).toBeVisible({ timeout: 10_000 });

    // 点第一张卡片
    await page.locator("result-card").first().click();

    // preview-pane 出现 md-viewer
    const mdViewer = shadow(page, "preview-pane", "md-viewer");
    await expect(mdViewer).toBeVisible();

    // md-viewer shadowRoot 里至少有一个带 data-source-line 的元素
    const hasSourceLine = await mdViewer.evaluate((el: any) => {
      const inner = el.shadowRoot;
      return !!inner && !!inner.querySelector("[data-source-line]");
    });
    expect(hasSourceLine).toBe(true);
  });
});
```

- [ ] **Step 2: 运行 e2e**

确保 GUI 服务在 7860 端口运行（reuseExistingServer: true），然后：

```bash
cd cortex/web_v2/frontend
npx playwright test tests/e2e/markdown-preview.spec.ts --project=desktop-chrome
```
Expected: 1 passed

- [ ] **Step 3: 提交**

```bash
cd ../../..
git add cortex/web_v2/frontend/tests/e2e/markdown-preview.spec.ts
git commit -m "test(e2e): add markdown preview flow"
```

---

## Self-Review Notes

- **Spec coverage**：
  - `treesearch/search.py` flat_nodes 透传 → Task 1
  - `_format_results` 透传 → Task 1
  - `marked` 依赖 → Task 2
  - `<md-viewer>` 新建 → Task 3
  - `data-source-line` → Task 4
  - scroll + highlight → Task 5
  - `<preview-pane>` 分支 → Task 6
  - `search-view` 透传 `previewLine` → Task 7
  - `.highlight-flash` 动画 → Task 3（已在 CSS 内）+ Task 5 触发
  - 后端测试扩展 → Task 1
  - vitest 单测 → Task 3/4/5/6
  - Playwright e2e → Task 9
- **Placeholder 扫描**：无 TBD/TODO；Task 4 内有「实现时验证 marked API」提示，附了降级方案
- **类型一致性**：`previewLine` / `line` 命名贯穿所有任务一致；`data-source-line` 字符串属性前后一致
- **索引基准**：spec 模糊处已在 Task 4 代码里固定为 `line + 1`（marked 0-indexed → 1-indexed）
