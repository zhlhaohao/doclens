# AI 对话页隐藏滚动条 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 隐藏 AI 对话页局部滚动容器的垂直滚动条，同时保留滚轮、触摸和键盘滚动能力。

**Architecture:** 采用局部 CSS 修复，不改变聊天页布局和数据流。滚动仍由现有容器负责：`chat-stream` 承载消息列表滚动，`input-box` 的 `textarea` 承载长输入滚动，`chat-tool-trace` 的 `.res` 承载工具输出滚动；每个滚动容器只追加跨浏览器隐藏 scrollbar 的样式。

**Tech Stack:** Lit 3 Web Components、TypeScript、Vite、Vitest、CSS scrollbar 规则（Firefox `scrollbar-width`、旧 Edge/IE `-ms-overflow-style`、WebKit `::-webkit-scrollbar`）。

## Global Constraints

- 保留滚动能力：不能把相关容器改成 `overflow-y: hidden`。
- 仅局部隐藏 AI 对话相关滚动条：不修改 `src/styles/global.css` 的全局滚动条样式。
- 不改变聊天消息、输入框提交、工具调用 trace 的数据流。
- 不新增运行时依赖。
- 遵守仓库 Git 规则：未经用户明确允许，不执行 `git commit` 或 `git push`。

---

## File Structure

- Modify: `doclens/web_v2/frontend/src/components/chat-stream.ts`
  - 负责 AI 对话消息列表；在 `:host` 滚动容器上隐藏 scrollbar。
- Modify: `doclens/web_v2/frontend/src/components/input-box.ts`
  - 负责搜索/聊天输入框；只在多行 `textarea` 自身隐藏 scrollbar。
- Modify: `doclens/web_v2/frontend/src/components/chat-tool-trace.ts`
  - 负责 AI 工具调用 trace；只在工具输出 `.res` 自身隐藏 scrollbar。
- Create: `doclens/web_v2/frontend/src/components/scrollbar-style.test.ts`
  - 用 Vitest 验证上述三个组件包含保留滚动与隐藏 scrollbar 的 CSS 规则。

---

### Task 1: Hide AI Chat Scrollbars Locally

**Files:**
- Create: `doclens/web_v2/frontend/src/components/scrollbar-style.test.ts`
- Modify: `doclens/web_v2/frontend/src/components/chat-stream.ts`
- Modify: `doclens/web_v2/frontend/src/components/input-box.ts`
- Modify: `doclens/web_v2/frontend/src/components/chat-tool-trace.ts`

**Interfaces:**
- Consumes:
  - `ChatStream.styles` from `src/components/chat-stream.ts`
  - `InputBox.styles` from `src/components/input-box.ts`
  - `ChatToolTrace.styles` from `src/components/chat-tool-trace.ts`
- Produces:
  - `chat-stream` remains a vertically scrollable custom element with hidden scrollbar.
  - `input-box` multiline `textarea` remains vertically scrollable with hidden scrollbar.
  - `chat-tool-trace` `.res` remains vertically scrollable with hidden scrollbar.

- [ ] **Step 1: Write the failing CSS style tests**

Create `doclens/web_v2/frontend/src/components/scrollbar-style.test.ts` with this complete content:

```typescript
import { describe, expect, it } from "vitest";

import { ChatStream } from "./chat-stream";
import { ChatToolTrace } from "./chat-tool-trace";
import { InputBox } from "./input-box";

function cssText(styles: unknown): string {
  if (Array.isArray(styles)) {
    return styles.map(cssText).join("\n");
  }
  if (styles && typeof styles === "object" && "cssText" in styles) {
    return String((styles as { cssText: string }).cssText);
  }
  return String(styles ?? "");
}

function expectHiddenScrollbar(css: string): void {
  expect(css).toContain("overflow-y: auto");
  expect(css).toContain("scrollbar-width: none");
  expect(css).toContain("-ms-overflow-style: none");
  expect(css).toContain("::-webkit-scrollbar");
  expect(css).toContain("display: none");
}

describe("AI chat scrollbar styles", () => {
  it("hides the chat stream scrollbar while preserving scrolling", () => {
    const css = cssText(ChatStream.styles);

    expect(css).toContain(":host");
    expectHiddenScrollbar(css);
  });

  it("hides the multiline input textarea scrollbar while preserving scrolling", () => {
    const css = cssText(InputBox.styles);

    expect(css).toContain("textarea");
    expectHiddenScrollbar(css);
  });

  it("hides the tool trace result scrollbar while preserving scrolling", () => {
    const css = cssText(ChatToolTrace.styles);

    expect(css).toContain(".res");
    expectHiddenScrollbar(css);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails before the CSS change**

Run from repository root:

```bash
cd doclens/web_v2/frontend && npm run test -- src/components/scrollbar-style.test.ts
```

Expected result before implementation:

```text
FAIL src/components/scrollbar-style.test.ts
AssertionError: expected ... to contain 'scrollbar-width: none'
```

At least one test must fail because the three components currently use `overflow-y: auto` but do not all include hidden scrollbar rules.

- [ ] **Step 3: Hide scrollbar on `chat-stream` while preserving scroll**

In `doclens/web_v2/frontend/src/components/chat-stream.ts`, replace the existing `:host` CSS block:

```typescript
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1;
      padding: 20px 18px 12px;
      overflow-y: auto;
    }
```

with:

```typescript
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1;
      padding: 20px 18px 12px;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
```

This keeps the message list scrollable and hides the visible scrollbar in Firefox, old Edge/IE, Chrome, Edge, and Safari.

- [ ] **Step 4: Hide scrollbar on multiline `textarea` while preserving scroll**

In `doclens/web_v2/frontend/src/components/input-box.ts`, replace the second `textarea` CSS block:

```typescript
    /* multiline 自动扩充：默认单行高度，换行后随内容增高，超出上限内部滚动 */
    textarea {
      max-height: 200px;
      overflow-y: auto;
    }
```

with:

```typescript
    /* multiline 自动扩充：默认单行高度，换行后随内容增高，超出上限内部滚动 */
    textarea {
      max-height: 200px;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    textarea::-webkit-scrollbar {
      display: none;
    }
```

This keeps long multiline input accessible without displaying an internal vertical scrollbar.

- [ ] **Step 5: Hide scrollbar on tool trace result output while preserving scroll**

In `doclens/web_v2/frontend/src/components/chat-tool-trace.ts`, replace the existing `.res` CSS block:

```typescript
    .res {
      margin-top: 5px; background: var(--cortex-bg);
      border-radius: var(--cortex-radius-sm); padding: 5px 7px;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      white-space: pre-wrap; word-break: break-word;
      max-height: 96px; overflow-y: auto;
    }
```

with:

```typescript
    .res {
      margin-top: 5px; background: var(--cortex-bg);
      border-radius: var(--cortex-radius-sm); padding: 5px 7px;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      white-space: pre-wrap; word-break: break-word;
      max-height: 96px; overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .res::-webkit-scrollbar {
      display: none;
    }
```

This preserves the compact trace output area and hides only its visual scrollbar.

- [ ] **Step 6: Run the targeted test to verify it passes**

Run from repository root:

```bash
cd doclens/web_v2/frontend && npm run test -- src/components/scrollbar-style.test.ts
```

Expected result after implementation:

```text
PASS src/components/scrollbar-style.test.ts
```

- [ ] **Step 7: Run the frontend production build**

Run from repository root:

```bash
cd doclens/web_v2/frontend && npm run build
```

Expected result:

```text
✓ built in ...
```

The command also runs `tsc --noEmit`, so TypeScript errors must be fixed before continuing.

- [ ] **Step 8: Review the diff without committing**

Run from repository root:

```bash
git diff -- doclens/web_v2/frontend/src/components/chat-stream.ts \
  doclens/web_v2/frontend/src/components/input-box.ts \
  doclens/web_v2/frontend/src/components/chat-tool-trace.ts \
  doclens/web_v2/frontend/src/components/scrollbar-style.test.ts \
  docs/superpowers/specs/2026-07-11-chat-scrollbar-design.md \
  docs/superpowers/plans/2026-07-11-chat-scrollbar.md
```

Expected result:

```text
The diff only adds local hidden-scrollbar CSS rules, one Vitest style test, and the spec/plan documents.
```

Do not run `git commit` unless the user explicitly asks for a commit.

---

## Self-Review

- Spec coverage: the plan covers `chat-stream`, `input-box` textarea, and `chat-tool-trace`; it preserves `overflow-y: auto`; it does not modify `src/styles/global.css`.
- Placeholder scan: no `TBD`, `TODO`, or deferred implementation language remains.
- Type consistency: the tests import existing exported classes `ChatStream`, `InputBox`, and `ChatToolTrace`; the helper uses `unknown` and a narrow `cssText` shape, so no new runtime interface is introduced.
