# SaaS Boutique 视觉重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 doclens web_v2 前端从 Bento Grid teal 重构为 SaaS Boutique（Electric Blue + Inter + 双层阴影 + 16px 圆角）的完整视觉重构，保持所有功能/状态/事件/属性不变。

**Architecture:** 两阶段纯视觉重构。阶段 A 替换 `tokens.css` 全局设计 token（teal→electric blue、字体→Inter、新增 shadow/glow/gradient tokens）+ `index.html` 字体加载；阶段 B 逐组件修改 Lit shadow DOM 内的 `static styles` 块（CSS only），不改 TS 逻辑。组件按"导航 → 表单 → 内容 → 预览/设置 → 视图层"分组。

**Tech Stack:** Lit 3.x Web Components · Vite 5.x · TypeScript (strict) · Vitest 单测 · Playwright E2E。不引入新依赖。

**设计真相源：** [`frontend-spec/design-system/MASTER.md`](../../frontend-spec/design-system/MASTER.md)
**Spec：** [`docs/superpowers/specs/2026-07-13-saas-boutique-refactor-design.md`](../specs/2026-07-13-saas-boutique-refactor-design.md)

---

## Global Constraints

- **路径**：所有路径基于 `C:\Users\lianghao\github\cortex\`，Bash 用 Git Bash 正斜杠。
- **Shell**：必须用 PowerShell 7 (`pwsh`)，不用老版 Windows PowerShell。
- **Git**：**未经用户明确允许，禁止 commit 或 push**。每个任务末尾的"提交"步骤是**请求许可**，不是自动执行。commit message 禁止 `Co-Authored-By:`，格式 `<type>(scope): <description>`。
- **TS 逻辑**：**不改任何 `.ts` 的 props/state/events/lifecycle/template**。本计划只动 CSS（`static styles` / `:host`）+ `tokens.css` + `index.html` 字体 link + `global.css` 滚动条。
- **测试**：不动测试代码。现有 vitest 应全绿。
- **响应式**：单一断点 1024px（已在 `breakpoints.css`），不动。
- **Token 真相源**：所有颜色/字体/圆角/阴影必须来自 `tokens.css` 变量；禁止组件内硬编码十六进制色（历史遗留的硬编码色按本计划替换为 token）。
- **通用 build 验证命令**：`cd doclens/web_v2/frontend && npm run build`（Git Bash）。必须无 TS/Vite 报错。
- **通用 vitest 命令**：`cd doclens/web_v2/frontend && npx vitest run`（Git Bash）。应全绿。

---

## File Structure

### 修改的文件（共 ~28 个 .ts + 1 tokens.css + 1 index.html + 1 global.css）

**阶段 A（Task 1）**
- `doclens/web_v2/frontend/src/styles/tokens.css` — 完整重写
- `doclens/web_v2/frontend/index.html` — 加 Google Fonts link（若实际入口是 static/index.html，同步处理；以 vite 实际源为准）

**阶段 B-1 核心导航（Task 2，4 文件）**
- `doclens/web_v2/frontend/src/components/app-bar.ts`
- `doclens/web_v2/frontend/src/components/activity-bar.ts`
- `doclens/web_v2/frontend/src/components/tab-bar.ts`
- `doclens/web_v2/frontend/src/components/focus-header.ts`

**阶段 B-2 表单（Task 3，4 文件）**
- `doclens/web_v2/frontend/src/components/input-box.ts`
- `doclens/web_v2/frontend/src/components/settings-scope-segment.ts`
- `doclens/web_v2/frontend/src/components/pagination-bar.ts`
- `doclens/web_v2/frontend/src/components/toast-stack.ts`

**阶段 B-3a 初始态（Task 4，3 文件）**
- `doclens/web_v2/frontend/src/components/welcome-pane.ts`
- `doclens/web_v2/frontend/src/components/history-list.ts`
- `doclens/web_v2/frontend/src/components/history-item.ts`

**阶段 B-3b 搜索结果（Task 5，2 文件）**
- `doclens/web_v2/frontend/src/components/search-results.ts`
- `doclens/web_v2/frontend/src/components/result-card.ts`

**阶段 B-3c 对话（Task 6，3 文件）**
- `doclens/web_v2/frontend/src/components/chat-stream.ts`
- `doclens/web_v2/frontend/src/components/chat-message.ts`
- `doclens/web_v2/frontend/src/components/chat-tool-trace.ts`

**阶段 B-3d 文件浏览器（Task 7，6 文件）**
- `doclens/web_v2/frontend/src/components/file-tree.ts`
- `doclens/web_v2/frontend/src/components/tree-node.ts`
- `doclens/web_v2/frontend/src/components/file-list.ts`
- `doclens/web_v2/frontend/src/components/file-row.ts`
- `doclens/web_v2/frontend/src/components/file-search-box.ts`
- `doclens/web_v2/frontend/src/components/file-search-results.ts`

**阶段 B-4a 预览/Markdown（Task 8，3 文件）**
- `doclens/web_v2/frontend/src/components/preview-pane.ts`
- `doclens/web_v2/frontend/src/components/md-viewer.ts`
- `doclens/web_v2/frontend/src/components/md-editor.ts`

**阶段 B-4b 设置页（Task 9，2 文件）**
- `doclens/web_v2/frontend/src/views/settings-view.ts`
- `doclens/web_v2/frontend/src/views/settings-fields.ts`

**阶段 B-5 视图层 + 对话框 + 杂项（Task 10，10 文件）**
- `doclens/web_v2/frontend/src/views/search-view.ts`
- `doclens/web_v2/frontend/src/views/chat-view.ts`
- `doclens/web_v2/frontend/src/views/files-view.ts`
- `doclens/web_v2/frontend/src/components/mkdir-dialog.ts`
- `doclens/web_v2/frontend/src/components/rename-dialog.ts`
- `doclens/web_v2/frontend/src/components/move-dialog.ts`
- `doclens/web_v2/frontend/src/components/delete-dialog.ts`
- `doclens/web_v2/frontend/src/components/reindex-dialog.ts`
- `doclens/web_v2/frontend/src/components/drop-zone.ts`
- `doclens/web_v2/frontend/src/styles/global.css`

### 不修改的文件
- 任何 `.spec.ts` 测试文件 · 后端 / API / 路由 / state store · `breakpoints.css` · `package.json` / `vite.config.ts` · `shared-styles.ts`（已对齐 token）

---

## Task Index

| # | 名称 | 文件数 |
|---|---|---|
| 1 | 阶段 A · tokens + 字体 | 2 |
| 2 | 阶段 B-1 · 核心导航 | 4 |
| 3 | 阶段 B-2 · 表单 | 4 |
| 4 | 阶段 B-3a · 初始态 | 3 |
| 5 | 阶段 B-3b · 搜索结果 | 2 |
| 6 | 阶段 B-3c · 对话 | 3 |
| 7 | 阶段 B-3d · 文件浏览器 | 6 |
| 8 | 阶段 B-4a · 预览/Markdown | 3 |
| 9 | 阶段 B-4b · 设置页 | 2 |
| 10 | 阶段 B-5 · 视图层+对话框 | 10 |
| 11 | 全量验证 | — |

---

## Task 1: 阶段 A · 替换 tokens.css 与字体加载

**Files:**
- Modify: `doclens/web_v2/frontend/src/styles/tokens.css`（完整重写）
- Modify: `doclens/web_v2/frontend/index.html`（加 Google Fonts link）

**Step 1: 完整重写 `doclens/web_v2/frontend/src/styles/tokens.css`**

替换整个文件内容为：

```css
/* Cortex 设计 tokens · SaaS Boutique（Electric Blue）
 * 真相源：frontend-spec/design-system/MASTER.md */
:root {
  /* 主色 · Electric Blue */
  --cortex-primary: #0052FF;
  --cortex-primary-hover: #003ECC;
  --cortex-primary-2: #4D7CFF;
  --cortex-primary-soft: #EFF4FF;
  --cortex-primary-gradient: linear-gradient(135deg, #0052FF 0%, #4D7CFF 100%);
  --cortex-primary-glow: 0 4px 14px rgba(0, 82, 255, 0.25);

  /* 中性色 · Slate */
  --cortex-bg: #FAFAFA;
  --cortex-surface: #FFFFFF;
  --cortex-surface-muted: #F8FAFC;
  --cortex-border: #E2E8F0;
  --cortex-border-muted: #F1F5F9;

  /* 文字 */
  --cortex-text: #0F172A;
  --cortex-text-muted: #64748B;
  --cortex-text-subtle: #94A3B8;

  /* 状态色 */
  --cortex-warning: #F59E0B;
  --cortex-danger: #DC2626;
  --cortex-success: #10B981;

  /* Chat 专用（SaaS Boutique） */
  --cortex-chat-bg: #F8FAFC;
  --cortex-chat-bubble-user: #0052FF;
  --cortex-chat-bubble-user-border: #003ECC;
  --cortex-chat-bubble-user-text: #FFFFFF;
  --cortex-chat-bubble-ai: #FFFFFF;
  --cortex-chat-bubble-ai-border: #E2E8F0;
  --cortex-chat-section: #0052FF;
  --cortex-chat-input-bg: #FFFFFF;
  --cortex-chat-input-border: #E2E8F0;
  --cortex-chat-footer: #94A3B8;

  /* 间距（4px 基线） */
  --cortex-space-1: 4px;
  --cortex-space-2: 8px;
  --cortex-space-3: 12px;
  --cortex-space-4: 16px;
  --cortex-space-6: 24px;
  --cortex-space-8: 32px;

  /* 圆角（圆润现代） */
  --cortex-radius-sm: 6px;
  --cortex-radius-md: 10px;
  --cortex-radius-lg: 16px;
  --cortex-radius-xl: 20px;

  /* 阴影（双层精致） */
  --cortex-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
  --cortex-shadow-md: 0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
  --cortex-shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04);

  /* Focus ring */
  --cortex-focus-ring: 0 0 0 3px rgba(0, 82, 255, 0.18);
  --cortex-focus-ring-danger: 0 0 0 3px rgba(220, 38, 38, 0.18);

  /* 字体 */
  --cortex-font: "Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --cortex-font-mono: "JetBrains Mono", "Cascadia Code", Consolas, monospace;

  /* 字号（移动默认；桌面 breakpoints.css 缩小 ~1px） */
  --cortex-fs-xs: 12px;
  --cortex-fs-sm: 13px;
  --cortex-fs-base: 14px;
  --cortex-fs-md: 15px;
  --cortex-fs-lg: 17px;
  --cortex-fs-xl: 30px;

  /* 布局尺寸 */
  --cortex-activity-bar-width: 48px;
  --cortex-tab-bar-height: 44px;
  --cortex-touch-target: 44px;
}
```

**Step 2: 在 `doclens/web_v2/frontend/index.html` 的 `<head>` 加 Google Fonts link**

在 `<head>` 内、现有 `<link>` / `<meta>` 之后插入：

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
```

> 若 vite 构建入口实际是别的 html（用 `cat doclens/web_v2/frontend/vite.config.ts` 确认 input），同步加到那个文件。font stack 已含 `system-ui` 兜底，离线 PWA 自动降级。

**Step 3: 构建验证**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 构建成功，无报错；`doclens/web_v2/static/assets/` 产出新 hash 的 JS/CSS。

**Step 4: vitest 验证**

Run: `cd doclens/web_v2/frontend && npx vitest run`
Expected: 全绿（token 变化不影响逻辑测试；`scrollbar-style.test.ts` 若断言颜色需在 Task 10 顺带核对）。

**Step 5: 请求提交许可**

向用户请求：
> 阶段 A 完成（tokens.css 替换 + 字体加载），build 与 vitest 全绿。是否提交 `refactor(web_v2): 替换 tokens.css 为 SaaS Boutique 设计语言`？

---

## Task 2: 阶段 B-1 · 核心导航组件

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/app-bar.ts`
- Modify: `doclens/web_v2/frontend/src/components/activity-bar.ts`
- Modify: `doclens/web_v2/frontend/src/components/tab-bar.ts`
- Modify: `doclens/web_v2/frontend/src/components/focus-header.ts`

> 改动规则：只动 `static styles = css\`...\`` 内的 CSS 值/规则，不动模板与 TS 逻辑。

**Step 1: 改 `app-bar.ts`**

用 Grep 定位以下 CSS 规则并按此修改（保持选择器不变）：

- `.brand .logo`：把 `background: var(--cortex-primary);` 改为 `background: var(--cortex-primary-gradient);`
- `watch-badge.dot` 的 `color: #10b981;` 改为 `color: var(--cortex-success);`（消除硬编码）
- `watch-badge.busy` 的 `color: var(--cortex-primary);` 保持
- `watch-badge.warn` 若有硬编码 `#d97706` 改为 `color: var(--cortex-warning);`
- `.refresh-btn:hover` 保持 `var(--cortex-primary-soft)` + `var(--cortex-primary)`（已对齐）
- 头像按钮 `.avatar-btn`（或同类）：若有，hover 用 `background: var(--cortex-primary-soft);`

确认改动后无硬编码 teal 色（`#0D9488` / `#0F766E`）。

**Step 2: 改 `activity-bar.ts`**

定位 `:host` 和导航按钮规则：

- `:host` 加 `border-right: 1px solid var(--cortex-border); background: var(--cortex-surface);`
- 导航按钮 `.nav-btn`（或同类）默认：`color: var(--cortex-text-muted);`
- `.nav-btn:hover`：`background: var(--cortex-surface-muted); color: var(--cortex-text);`
- `.nav-btn.active`（或 `[aria-current]`）：`color: var(--cortex-primary); background: var(--cortex-primary-soft);`
- active 若用左条指示（`border-left`），保持 `var(--cortex-primary)`

**Step 3: 改 `tab-bar.ts`**

- `:host` 加 `border-top: 1px solid var(--cortex-border); background: var(--cortex-surface);`
- tab 按钮默认：`color: var(--cortex-text-muted);`
- `.tab-btn.active`：`color: var(--cortex-primary);`
- active 若用底条指示（`border-bottom` 或 `::after`），保持 `var(--cortex-primary)`
- hover：`background: var(--cortex-surface-muted);`

**Step 4: 改 `focus-header.ts`**

- `.back-btn`（圆形返回）：`border: 1px solid var(--cortex-border); background: var(--cortex-surface); border-radius: 50%;`
- `.back-btn:hover`：`background: var(--cortex-primary-soft); color: var(--cortex-primary); border-color: var(--cortex-primary);`
- `.title`：`font-weight: 600; letter-spacing: -0.01em;`
- `.meta`：`color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);`
- kebab 更多菜单按钮：同 `.back-btn` 基础样式 + hover primary-soft

**Step 5: 构建验证**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 成功无报错。

**Step 6: 相关 vitest 验证**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/app-bar.spec.ts tests/focus-header.spec.ts`
Expected: 全绿（逻辑未动）。

**Step 7: 请求提交许可**

> 阶段 B-1（核心导航 4 组件）完成，build + 相关 vitest 全绿。是否提交 `refactor(web_v2): 阶段 B-1 核心导航组件 CSS 重构`？

---

## Task 3: 阶段 B-2 · 表单组件

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/input-box.ts`
- Modify: `doclens/web_v2/frontend/src/components/settings-scope-segment.ts`
- Modify: `doclens/web_v2/frontend/src/components/pagination-bar.ts`
- Modify: `doclens/web_v2/frontend/src/components/toast-stack.ts`

**Step 1: 改 `input-box.ts`**

- `input` / `textarea`：`border-radius: var(--cortex-radius-md);`
- `input:focus` / `textarea:focus`：`border-color: var(--cortex-primary); box-shadow: var(--cortex-focus-ring); outline: none;`
- 提交主按钮 `.submit`（或 `.submit-btn`）：`background: var(--cortex-primary-gradient); color: #fff; border: none; border-radius: var(--cortex-radius-lg); box-shadow: var(--cortex-primary-glow); font-weight: 500;`
- `.submit:hover`：`filter: brightness(1.05);`
- `.submit:disabled`：`opacity: 0.5; cursor: not-allowed; box-shadow: none;`
- 模式分裂按钮（caret / secondary）：`border: 1px solid var(--cortex-border); background: var(--cortex-surface); border-radius: var(--cortex-radius-md);`
- 模式菜单下拉：`background: var(--cortex-surface); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); box-shadow: var(--cortex-shadow-lg);`
- 菜单项 hover：`background: var(--cortex-surface-muted);`
- 菜单项 active/selected：`color: var(--cortex-primary); background: var(--cortex-primary-soft);`

**Step 2: 改 `settings-scope-segment.ts`**

- active pill：`background: var(--cortex-primary-soft); color: var(--cortex-primary); border: 1px solid var(--cortex-primary); border-radius: 999px; font-weight: 500;`
- inactive pill：`background: var(--cortex-surface); color: var(--cortex-text-muted); border: 1px solid var(--cortex-border); border-radius: 999px;`
- disabled pill：`opacity: 0.4; cursor: not-allowed;`

**Step 3: 改 `pagination-bar.ts`**

- 页码按钮 `.page-btn`：`border: 1px solid var(--cortex-border); background: var(--cortex-surface); border-radius: var(--cortex-radius-md); color: var(--cortex-text);`
- `.page-btn:hover:not(:disabled)`：`background: var(--cortex-surface-muted); border-color: var(--cortex-text-subtle);`
- `.page-btn.active`：`background: var(--cortex-primary); color: #fff; border-color: var(--cortex-primary);`
- `.page-btn:disabled`：`opacity: 0.4; cursor: not-allowed;`
- 页码信息文本：`color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);`

**Step 4: 改 `toast-stack.ts`**

- `.toast`：`background: var(--cortex-surface); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); box-shadow: var(--cortex-shadow-lg);`
- `.toast.success`：`border-left: 3px solid var(--cortex-success);`
- `.toast.error`：`border-left: 3px solid var(--cortex-danger);`
- `.toast.info`：`border-left: 3px solid var(--cortex-primary);`
- `.toast .title`：`font-weight: 600;`
- `.toast .msg`：`color: var(--cortex-text-muted);`
- 关闭按钮 hover：`background: var(--cortex-surface-muted); border-radius: var(--cortex-radius-sm);`

**Step 5: 构建验证**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 成功。

**Step 6: 相关 vitest 验证**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/input-box.spec.ts tests/settings-scope-segment.spec.ts tests/pagination-bar.spec.ts tests/toast-stack.spec.ts`
Expected: 全绿。

**Step 7: 请求提交许可**

> 阶段 B-2（表单 4 组件）完成。是否提交 `refactor(web_v2): 阶段 B-2 表单组件 CSS 重构`？

---

## Task 4: 阶段 B-3a · 初始态组件

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/welcome-pane.ts`
- Modify: `doclens/web_v2/frontend/src/components/history-list.ts`
- Modify: `doclens/web_v2/frontend/src/components/history-item.ts`

**Step 1: 改 `welcome-pane.ts`**

- `.heading`（大标题）：`font-size: var(--cortex-fs-xl); font-weight: 700; letter-spacing: -0.02em; color: var(--cortex-text);`
- `.suffix`（如「问日程」）：`color: var(--cortex-primary); font-weight: 600;`
- `.subheading`：`color: var(--cortex-text-muted); font-size: var(--cortex-fs-md);`
- 状态区 `.status-row`：`color: var(--cortex-text-muted); font-size: var(--cortex-fs-xs);`
- 状态区内的路径/数字/文件类型分布：`font-family: var(--cortex-font-mono);`
- 状态图标保留 emoji；监控中点 `●` 若有硬编码 `#10b981` 改为 `var(--cortex-success)`

**Step 2: 改 `history-list.ts`**

- `.title`（「历史会话」）：`color: var(--cortex-text-muted); font-weight: 500; font-size: var(--cortex-fs-sm);`
- `.clear-btn`：`color: var(--cortex-text-subtle); border: none; background: transparent; border-radius: var(--cortex-radius-sm);`
- `.clear-btn:hover`：`color: var(--cortex-danger); background: var(--cortex-surface-muted);`
- 空态文本：`color: var(--cortex-text-subtle);`
- 列表分隔 hairline：`var(--cortex-border-muted);`

**Step 3: 改 `history-item.ts`**

- `:host` / `.item`：`background: var(--cortex-surface); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); padding: 10px 12px; cursor: pointer; transition: background 0.15s, border-color 0.15s;`
- `:host(:hover)` / `.item:hover`：`background: var(--cortex-surface-muted); border-color: var(--cortex-text-subtle);`
- `.item-title`：`color: var(--cortex-text); font-weight: 500; font-size: var(--cortex-fs-base);`
- `.item-meta`：`color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);`
- grep mode-tag `.mode-tag`：`background: var(--cortex-primary-soft); color: var(--cortex-primary); border-radius: var(--cortex-radius-sm); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); padding: 0 4px;`

**Step 4: 构建验证**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 成功。

**Step 5: 相关 vitest 验证**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/welcome-pane.spec.ts tests/history-list.spec.ts tests/history-item-grep.spec.ts`
Expected: 全绿。

**Step 6: 请求提交许可**

> 阶段 B-3a（初始态 3 组件）完成。是否提交 `refactor(web_v2): 阶段 B-3a 初始态组件 CSS 重构`？

---

## Task 5: 阶段 B-3b · 搜索结果组件

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/search-results.ts`
- Modify: `doclens/web_v2/frontend/src/components/result-card.ts`

**Step 1: 改 `search-results.ts`**

- 容器 `:host` / `.list`：`gap: var(--cortex-space-2); display: flex; flex-direction: column;`
- loading spinner 文案：`color: var(--cortex-text-muted);`
- spinner 圆圈：`border-color: var(--cortex-border); border-top-color: var(--cortex-primary);`
- 空态「无搜索结果」：`color: var(--cortex-text-subtle); text-align: center; padding: var(--cortex-space-8) var(--cortex-space-4);`

**Step 2: 改 `result-card.ts`**

现有 `:host`（行 9-17）改为：

```css
:host {
  display: block;
  background: var(--cortex-surface);
  border: 1px solid var(--cortex-border);
  border-radius: var(--cortex-radius-lg);
  padding: 12px 16px;
  cursor: pointer;
  box-shadow: var(--cortex-shadow-sm);
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
:host([active]) {
  border-color: var(--cortex-primary);
  background: var(--cortex-primary-soft);
  box-shadow: var(--cortex-shadow-md);
}
:host(:hover) {
  border-color: var(--cortex-primary);
  box-shadow: var(--cortex-shadow-md);
}
```

- `.path`：`font-family: var(--cortex-font-mono); color: var(--cortex-text-muted); font-size: var(--cortex-fs-xs);`（已有，核对）
- `.badge`（路径 badge）：`background: var(--cortex-primary-soft); color: var(--cortex-primary); border-radius: var(--cortex-radius-sm); font-size: var(--cortex-fs-xs); padding: 0 4px;`
- `.score`（评分百分比）：`color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);`
- `.snippet code`：`font-family: var(--cortex-font-mono); background: var(--cortex-surface-muted); border-radius: var(--cortex-radius-sm);`
- `.snippet pre`：`background: var(--cortex-surface-muted); border-radius: var(--cortex-radius-sm);`

**Step 3: 构建验证**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 成功。

**Step 4: 相关 vitest 验证**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/result-card-grep.spec.ts`
Expected: 全绿。

**Step 5: 请求提交许可**

> 阶段 B-3b（搜索结果 2 组件）完成。是否提交 `refactor(web_v2): 阶段 B-3b 搜索结果组件 CSS 重构`？

---

## Task 6: 阶段 B-3c · 对话组件

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/chat-stream.ts`
- Modify: `doclens/web_v2/frontend/src/components/chat-message.ts`
- Modify: `doclens/web_v2/frontend/src/components/chat-tool-trace.ts`

**Step 1: 改 `chat-stream.ts`**

- `:host` / `.stream`：`background: var(--cortex-chat-bg); display: flex; flex-direction: column; gap: var(--cortex-space-4); padding: var(--cortex-space-4); overflow-y: auto;`
- 空态「开始与 Doclens 对话」：`color: var(--cortex-text-subtle); text-align: center; align-self: center; margin: auto;`

**Step 2: 改 `chat-message.ts`**

- user 气泡 `.bubble.user`：`background: var(--cortex-chat-bubble-user); color: var(--cortex-chat-bubble-user-text); border: 1px solid var(--cortex-chat-bubble-user-border); border-radius: var(--cortex-radius-lg); align-self: flex-end; box-shadow: var(--cortex-shadow-sm);`
- assistant 气泡 `.bubble.assistant`：`background: var(--cortex-chat-bubble-ai); color: var(--cortex-text); border: 1px solid var(--cortex-chat-bubble-ai-border); border-radius: var(--cortex-radius-lg); align-self: flex-start; box-shadow: var(--cortex-shadow-sm);`
- 消息流容器：`display: flex; flex-direction: column; gap: var(--cortex-space-4);`
- 「思考中...」占位：`color: var(--cortex-text-subtle); font-style: italic;`
- 结构化小节标题（`<h1>`-`<h4>` in assistant md）：`color: var(--cortex-chat-section); font-weight: 600;`
- 参考资料 `.ref-link`：`color: var(--cortex-primary); font-weight: 500; text-decoration: none; border-radius: var(--cortex-radius-sm);`
- `.ref-link:hover`：`background: var(--cortex-primary-soft); text-decoration: underline;`
- 参考资料容器 `.refs`：`border-top: 1px solid var(--cortex-border-muted); margin-top: var(--cortex-space-3); padding-top: var(--cortex-space-2);`
- error 段：`color: var(--cortex-danger);`
- inline `code`：`font-family: var(--cortex-font-mono); background: var(--cortex-surface-muted); border-radius: var(--cortex-radius-sm); padding: 0 3px;`

**Step 3: 改 `chat-tool-trace.ts`**

- `.trace` 容器：`border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); background: var(--cortex-surface-muted); overflow: hidden;`
- `.summary`（折叠摘要行）：`padding: var(--cortex-space-2) var(--cortex-space-3); cursor: pointer; font-size: var(--cortex-fs-sm); color: var(--cortex-text-muted);`
- `.summary:hover`：`background: var(--cortex-surface);`
- `.copy-btn`：`border: 1px solid var(--cortex-border); background: var(--cortex-surface); border-radius: var(--cortex-radius-sm);`
- `.copy-btn:hover`：`background: var(--cortex-primary-soft); color: var(--cortex-primary); border-color: var(--cortex-primary);`
- `.step.running` 旋转图标：`color: var(--cortex-primary);`
- `.step.done` ✓：`color: var(--cortex-success);`
- `.step.error` ✗：`color: var(--cortex-danger);`
- `.step` 耗时/duration：`color: var(--cortex-text-subtle); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);`
- `.step .output`（折叠输出）：`background: var(--cortex-surface); border-radius: var(--cortex-radius-sm); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted);`
- 「展开全部」按钮：`color: var(--cortex-primary);`

**Step 4: 构建验证**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 成功。

**Step 5: 相关 vitest 验证**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/chat-message.spec.ts tests/chat-tool-trace.spec.ts`
Expected: 全绿。

**Step 6: 请求提交许可**

> 阶段 B-3c（对话 3 组件）完成。是否提交 `refactor(web_v2): 阶段 B-3c 对话组件 CSS 重构`？

---

## Task 7: 阶段 B-3d · 文件浏览器组件

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/file-tree.ts`
- Modify: `doclens/web_v2/frontend/src/components/tree-node.ts`
- Modify: `doclens/web_v2/frontend/src/components/file-list.ts`
- Modify: `doclens/web_v2/frontend/src/components/file-row.ts`
- Modify: `doclens/web_v2/frontend/src/components/file-search-box.ts`
- Modify: `doclens/web_v2/frontend/src/components/file-search-results.ts`

**Step 1: 改 `file-tree.ts`**

- `.header`（sticky「文件」标题）：`background: var(--cortex-surface); border-bottom: 1px solid var(--cortex-border-muted); font-weight: 600; color: var(--cortex-text); padding: var(--cortex-space-3) var(--cortex-space-4);`

**Step 2: 改 `tree-node.ts`**

- `.node` 行：`padding: var(--cortex-space-2) var(--cortex-space-3); cursor: pointer; border-radius: var(--cortex-radius-sm); display: flex; align-items: center; gap: var(--cortex-space-2);`
- `.node:hover`：`background: var(--cortex-surface-muted);`
- `.node.selected`：`background: var(--cortex-primary-soft); color: var(--cortex-primary);`
- `.label`：`font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm);`
- 展开箭头 `.arrow`：`color: var(--cortex-text-subtle); transition: transform 0.15s;`
- `.arrow.expanded`：`transform: rotate(90deg);`

**Step 3: 改 `file-list.ts`**

- `.breadcrumb`：`background: var(--cortex-surface); border-bottom: 1px solid var(--cortex-border-muted); padding: var(--cortex-space-2) var(--cortex-space-4);`
- `.breadcrumb .path`：`font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm); color: var(--cortex-text-muted);`
- 上级按钮 `.up-btn`：`border: 1px solid var(--cortex-border); background: var(--cortex-surface); border-radius: var(--cortex-radius-sm);`
- `.up-btn:hover:not(:disabled)`：`background: var(--cortex-surface-muted);`
- `.up-btn:disabled`：`opacity: 0.4; cursor: not-allowed;`
- `.toolbar`：`background: var(--cortex-surface); border-bottom: 1px solid var(--cortex-border-muted); padding: var(--cortex-space-2) var(--cortex-space-4); display: flex; gap: var(--cortex-space-2);`
- 工具栏按钮 `.tool-btn`：`border: 1px solid var(--cortex-border); background: var(--cortex-surface); border-radius: var(--cortex-radius-md); color: var(--cortex-text); font-size: var(--cortex-fs-sm);`
- `.tool-btn:hover:not(:disabled)`：`background: var(--cortex-surface-muted); border-color: var(--cortex-text-subtle);`
- `.tool-btn:disabled`：`opacity: 0.4; cursor: not-allowed;`
- 主操作按钮（如 mkdir 若标 primary）：`background: var(--cortex-primary-gradient); color:#fff; border:none; box-shadow: var(--cortex-primary-glow);`
- `.tool-btn.danger`：`color: var(--cortex-danger);`
- `.tool-btn.danger:hover:not(:disabled)`：`background: rgba(220,38,38,0.06); border-color: var(--cortex-danger);`
- 表头 `.header-row`：`background: var(--cortex-surface-muted); border-bottom: 1px solid var(--cortex-border); color: var(--cortex-text-muted); font-weight: 500; font-size: var(--cortex-fs-xs);`
- `.col-resize` 手柄 hover：`background: var(--cortex-primary);`
- 移动端 `.mobile-header`：`background: var(--cortex-surface); border-bottom: 1px solid var(--cortex-border);`
- `.mobile-menu` 下拉：`background: var(--cortex-surface); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); box-shadow: var(--cortex-shadow-lg);`
- `.mobile-menu-item:hover`：`background: var(--cortex-surface-muted);`
- `.mobile-menu-item.danger`：`color: var(--cortex-danger);`
- 空态 `.empty`：`color: var(--cortex-text-subtle);`

**Step 4: 改 `file-row.ts`**

- `:host` / `.row`：`border-bottom: 1px solid var(--cortex-border-muted); transition: background 0.1s;`
- `:host(:hover)` / `.row:hover`：`background: var(--cortex-surface-muted);`
- `:host(.selected)` / `.row.selected`：`background: var(--cortex-primary-soft);`
- `:host(.active)` / `.row.active`：`background: var(--cortex-primary-soft);`
- `.name`：`color: var(--cortex-text); font-size: var(--cortex-fs-sm);`
- `.size` / `.time`：`color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);`
- type badge `.type-badge`：`border-radius: var(--cortex-radius-sm); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); background: var(--cortex-surface-muted); color: var(--cortex-text-muted);`
- 「已索引」badge `.indexed-badge`：`background: var(--cortex-primary-soft); color: var(--cortex-primary); border-radius: var(--cortex-radius-sm); font-size: var(--cortex-fs-xs);`
- checkbox 自定义样式保留（或沿用原生 + accent-color: var(--cortex-primary);）

**Step 5: 改 `file-search-box.ts`**

- 容器 `.wrap`：`padding: var(--cortex-space-2) var(--cortex-space-3); border-bottom: 1px solid var(--cortex-border-muted); background: var(--cortex-surface);`
- `input`：`border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); background: var(--cortex-surface); padding: var(--cortex-space-2) var(--cortex-space-3);`
- `input:focus`：`border-color: var(--cortex-primary); box-shadow: var(--cortex-focus-ring); outline: none;`
- `input:disabled`：`opacity: 0.5; cursor: not-allowed; background: var(--cortex-surface-muted);`
- 🔍 icon：`color: var(--cortex-text-subtle);`
- × 清空按钮：`color: var(--cortex-text-subtle); border-radius: var(--cortex-radius-sm);`
- × hover：`background: var(--cortex-surface-muted); color: var(--cortex-text);`

**Step 6: 改 `file-search-results.ts`**

- `.header-bar`（结果计数）：`background: var(--cortex-surface); border-bottom: 1px solid var(--cortex-border-muted); padding: var(--cortex-space-2) var(--cortex-space-3); color: var(--cortex-text-muted); font-size: var(--cortex-fs-xs);`
- `.columns`（列头）：`background: var(--cortex-surface-muted); color: var(--cortex-text-muted); font-weight: 500; font-size: var(--cortex-fs-xs);`
- `.row`：`border-bottom: 1px solid var(--cortex-border-muted); padding: var(--cortex-space-2) var(--cortex-space-3); cursor: pointer;`
- `.row:hover`：`background: var(--cortex-surface-muted);`
- `.row.selected`：`background: var(--cortex-primary-soft);`
- 高亮命中 `.hit` / `mark`：`background: rgba(0,82,255,0.15); color: var(--cortex-primary); border-radius: 2px; padding: 0 2px;`
- `.dir`（目录）：`color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);`
- `.size` / `.time`：`color: var(--cortex-text-subtle); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);`
- `.overflow-hint`：`color: var(--cortex-text-subtle); font-size: var(--cortex-fs-xs); padding: var(--cortex-space-2);`
- 空态 `.empty`：`color: var(--cortex-text-subtle); text-align: center; padding: var(--cortex-space-8) var(--cortex-space-4);`

**Step 7: 构建验证**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 成功。

**Step 8: 相关 vitest 验证**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/file-list.spec.ts tests/file-row.spec.ts tests/file-search-box.spec.ts tests/file-search-results.spec.ts tests/tree-node.spec.ts`
Expected: 全绿。

**Step 9: 请求提交许可**

> 阶段 B-3d（文件浏览器 6 组件）完成。是否提交 `refactor(web_v2): 阶段 B-3d 文件浏览器组件 CSS 重构`？

---

## Task 8: 阶段 B-4a · 预览与 Markdown 组件

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/preview-pane.ts`
- Modify: `doclens/web_v2/frontend/src/components/md-viewer.ts`
- Modify: `doclens/web_v2/frontend/src/components/md-editor.ts`

**Step 1: 改 `preview-pane.ts`**

- `:host`：`background: var(--cortex-surface); display: flex; flex-direction: column; min-height: 0;`
- `.header`（桌面常规 header）：`background: var(--cortex-surface); border-bottom: 1px solid var(--cortex-border-muted); padding: var(--cortex-space-2) var(--cortex-space-4); display: flex; align-items: center; gap: var(--cortex-space-2); flex-shrink: 0;`
- `.header .path`：`font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
- 编辑/下载/上传按钮 `.action-btn`：`border: 1px solid var(--cortex-border); background: var(--cortex-surface); border-radius: var(--cortex-radius-sm); color: var(--cortex-text-muted); font-size: var(--cortex-fs-xs);`
- `.action-btn:hover`：`background: var(--cortex-surface-muted); color: var(--cortex-text);`
- `.action-btn.primary`（编辑按钮可标 primary）：`background: var(--cortex-primary-gradient); color:#fff; border:none; box-shadow: var(--cortex-primary-glow);`
- 移动 `.mobile-header`：`background: var(--cortex-surface); border-bottom: 1px solid var(--cortex-border); padding: var(--cortex-space-2) var(--cortex-space-3); display: flex; align-items: center; gap: var(--cortex-space-2);`
- `.mobile-header .back`：圆形返回按钮样式（同 focus-header）
- `.mobile-menu`：`background: var(--cortex-surface); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); box-shadow: var(--cortex-shadow-lg);`
- 空态 `.empty`：`color: var(--cortex-text-subtle); display: flex; align-items: center; justify-content: center; flex: 1;`
- iframe 容器 `.html-frame`：`border: none; border-radius: 0;`

**Step 2: 改 `md-viewer.ts`**

- `:host`：`display: block; padding: var(--cortex-space-4); overflow-y: auto;`（移动 `@media (max-width: 767px)` padding `var(--cortex-space-2) var(--cortex-space-2)`，沿用现有断点）
- `.md-body`：`background: var(--cortex-surface); border-radius: var(--cortex-radius-lg); box-shadow: var(--cortex-shadow-sm); padding: var(--cortex-space-8) var(--cortex-space-8); color: var(--cortex-text); line-height: 1.6;`（移动 padding `var(--cortex-space-4) var(--cortex-space-4)`）
- `.md-body h1/h2`：`font-weight: 700; letter-spacing: -0.02em; color: var(--cortex-text);`
- `.md-body h3/h4`：`font-weight: 600; color: var(--cortex-text);`
- `.md-body p`：`color: var(--cortex-text);`
- `.md-body a`：`color: var(--cortex-primary); text-decoration: none;`
- `.md-body a:hover`：`text-decoration: underline;`
- `.md-body code`（inline）：`font-family: var(--cortex-font-mono); background: var(--cortex-surface-muted); border-radius: var(--cortex-radius-sm); padding: 0 4px; font-size: 0.9em;`
- `.md-body pre`：`background: var(--cortex-surface-muted); border: 1px solid var(--cortex-border-muted); border-radius: var(--cortex-radius-md); padding: var(--cortex-space-3) var(--cortex-space-4); overflow-x: auto;`
- `.md-body pre code`：`background: transparent; padding: 0;`
- `.md-body blockquote`：`border-left: 3px solid var(--cortex-primary); background: var(--cortex-primary-soft); padding: var(--cortex-space-2) var(--cortex-space-4); border-radius: 0 var(--cortex-radius-md) var(--cortex-radius-md) 0; color: var(--cortex-text-muted);`
- `.md-body table th`：`background: var(--cortex-surface-muted); border: 1px solid var(--cortex-border); padding: var(--cortex-space-2);`
- `.md-body table td`：`border: 1px solid var(--cortex-border); padding: var(--cortex-space-2);`
- `.md-body img`：`border-radius: var(--cortex-radius-md); max-width: 100%;`
- 关键词高亮 `mark` / `.hit`：`background: rgba(0,82,255,0.15); color: var(--cortex-primary); border-radius: 2px; padding: 0 2px;`（若有旧硬编码黄底替换）
- 行定位闪烁 `.line-anchor` / `.target-line`：`animation` 保留；背景闪烁用 `rgba(0,82,255,0.12)`
- `.page-card`（PDF/PPTX/XLSX 分页）：`background: var(--cortex-surface); border-radius: var(--cortex-radius-lg); box-shadow: var(--cortex-shadow-md); margin-bottom: var(--cortex-space-4); padding: var(--cortex-space-6) var(--cortex-space-8);`
- `.page-marker`（分页分隔标记）：`color: var(--cortex-text-subtle); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); text-align: center; padding: var(--cortex-space-2);`

**Step 3: 改 `md-editor.ts`**

- `:host`：`display: flex; flex-direction: column; background: var(--cortex-surface); border-radius: var(--cortex-radius-lg); overflow: hidden;`
- `.toolbar`：`background: var(--cortex-surface); border-bottom: 1px solid var(--cortex-border-muted); padding: var(--cortex-space-2) var(--cortex-space-4); display: flex; align-items: center; gap: var(--cortex-space-2);`
- `.toolbar .path`：`font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted); flex: 1;`
- dirty 标记 `.dirty-dot`：`color: var(--cortex-warning);`
- 保存按钮 `.save-btn`：主按钮（`background: var(--cortex-primary-gradient); box-shadow: var(--cortex-primary-glow); border:none; color:#fff; border-radius: var(--cortex-radius-md);`）
- 取消按钮 `.cancel-btn`：次按钮样式
- `.body`（编辑区）：`flex: 1; display: flex; min-height: 0;`
- 行号列 `.gutter`：`background: var(--cortex-surface-muted); color: var(--cortex-text-subtle); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm); padding: var(--cortex-space-3) var(--cortex-space-2); text-align: right; user-select: none; overflow: hidden; border-right: 1px solid var(--cortex-border-muted);`
- `textarea`：`flex: 1; border: none; outline: none; resize: none; padding: var(--cortex-space-3) var(--cortex-space-4); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm); line-height: 1.6; color: var(--cortex-text); background: var(--cortex-surface);`
- error 提示 `.error-bar`：`color: var(--cortex-danger); background: rgba(220,38,38,0.06);`

**Step 4: 构建验证**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 成功。

**Step 5: 相关 vitest 验证**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/preview-pane.spec.ts tests/md-viewer.spec.ts tests/md-viewer-pages.spec.ts tests/md-editor.spec.ts`
Expected: 全绿。

**Step 6: 请求提交许可**

> 阶段 B-4a（预览/Markdown 3 组件）完成。是否提交 `refactor(web_v2): 阶段 B-4a 预览与 Markdown 组件 CSS 重构`？

---

## Task 9: 阶段 B-4b · 设置页组件

**Files:**
- Modify: `doclens/web_v2/frontend/src/views/settings-view.ts`
- Modify: `doclens/web_v2/frontend/src/views/settings-fields.ts`

**Step 1: 改 `settings-view.ts`**

- `.layout`（桌面 flex-row / 移动 flex-column）：保持方向逻辑
- `.sidebar`：`background: var(--cortex-surface); border-right: 1px solid var(--cortex-border);`（移动 `border-right: none; border-bottom: 1px solid var(--cortex-border);`）
- `.tab-strip`（桌面垂直）：`display: flex; flex-direction: column; padding: var(--cortex-space-2); gap: var(--cortex-space-1);`（移动 flex-row + overflow-x:auto）
- `.tab-strip .tab-btn`：`background: transparent; border: none; border-left: 3px solid transparent; padding: var(--cortex-space-2) var(--cortex-space-3); text-align: left; color: var(--cortex-text-muted); font-size: var(--cortex-fs-sm); border-radius: 0; cursor: pointer;`
- `.tab-strip .tab-btn:hover`：`background: var(--cortex-surface-muted); color: var(--cortex-text);`
- `.tab-strip .tab-btn.active`（桌面）：`color: var(--cortex-primary); border-left-color: var(--cortex-primary); background: var(--cortex-primary-soft); font-weight: 500;`
- 移动端 `.tab-strip .tab-btn.active`：`border-left-color: transparent; border-bottom: 2px solid var(--cortex-primary);`
- `.scroll-area`（桌面内部滚动）：`flex: 1; overflow-y: auto; padding: var(--cortex-space-4);`
- `.tab-panel`：`max-width: 680px; margin: 0 auto; display: none;`
- `.tab-panel.active`：`display: block;`
- `.section`（分组卡片）：`background: var(--cortex-surface); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-lg); box-shadow: var(--cortex-shadow-md); padding: var(--cortex-space-4) var(--cortex-space-6); margin-bottom: var(--cortex-space-4);`
- `.section h2`：`font-size: var(--cortex-fs-md); font-weight: 600; color: var(--cortex-text); letter-spacing: -0.01em; margin: 0 0 var(--cortex-space-4);`
- `.info-box`：`background: var(--cortex-primary-soft); border-left: 3px solid var(--cortex-primary); border-radius: var(--cortex-radius-md); padding: var(--cortex-space-3) var(--cortex-space-4); color: var(--cortex-text); font-size: var(--cortex-fs-sm); margin-bottom: var(--cortex-space-4);`
- `.info-box.warn`：`background: rgba(245,158,11,0.08); border-left-color: var(--cortex-warning);`
- `.copy-banner`（移动端显示）：`background: var(--cortex-primary-soft); color: var(--cortex-primary); padding: var(--cortex-space-2) var(--cortex-space-4); font-size: var(--cortex-fs-sm); font-weight: 500;`
- `.footer-bar`（桌面底部）：`background: var(--cortex-surface); border-top: 1px solid var(--cortex-border); padding: var(--cortex-space-3) var(--cortex-space-6); display: flex; justify-content: space-between; align-items: center; max-width: 680px; margin: 0 auto;`
- `.dirty-status`：`color: var(--cortex-text-muted); font-size: var(--cortex-fs-sm);`
- `.dirty-dot`：`display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--cortex-warning); margin-right: var(--cortex-space-2);`
- `.dirty-status .success-msg`：`color: var(--cortex-success);`
- `.dirty-status .error-msg`：`color: var(--cortex-danger);`
- 放弃按钮 `.btn`（次按钮）：`border: 1px solid var(--cortex-border); background: var(--cortex-surface); border-radius: var(--cortex-radius-md); color: var(--cortex-text); padding: var(--cortex-space-2) var(--cortex-space-4);`
- 保存按钮 `.btn.primary`：`background: var(--cortex-primary-gradient); color:#fff; border:none; box-shadow: var(--cortex-primary-glow); border-radius: var(--cortex-radius-md); font-weight: 500;`

**Step 2: 改 `settings-fields.ts`**

- `.field`（桌面 grid 2 列 / 移动 1 列）：`display: grid; grid-template-columns: minmax(220px, 280px) 1fr; gap: var(--cortex-space-4); padding: var(--cortex-space-3) 0; border-top: 1px solid var(--cortex-border-muted);`（首字段无 border-top）
- 移动 `.field`：`grid-template-columns: 1fr;`
- `.field-label .name`：`font-size: var(--cortex-fs-sm); font-weight: 500; color: var(--cortex-text);`
- `.field-label .env`：`font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted);`
- effect badge `.effect-badge.live`：`color: var(--cortex-success); font-size: var(--cortex-fs-xs);`
- effect badge `.effect-badge.restart`：`color: var(--cortex-warning); font-size: var(--cortex-fs-xs);`
- `.field-control .row`：`display: flex; align-items: center; gap: var(--cortex-space-2);`
- `.field-control input[type="text"]` / `input[type="number"]` / `input[type="password"]`：`border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); background: var(--cortex-surface); padding: var(--cortex-space-2) var(--cortex-space-3); font-size: var(--cortex-fs-sm); width: 100%;`
- `.field-control input.mono`：`font-family: var(--cortex-font-mono);`
- `input:focus`：`border-color: var(--cortex-primary); box-shadow: var(--cortex-focus-ring); outline: none;`
- `.password-wrap` 桌面 `position: relative;`；移动 `position: static;`
- 「显示」按钮 `.toggle-pw`：桌面 `position: absolute; right: var(--cortex-space-2); top: 50%; transform: translateY(-50%);`；移动 `position: static; margin-top: var(--cortex-space-2); align-self: flex-end;`
- `select`：同 input 样式 + `appearance: none;` + 自定义箭头（可用 SVG background 或保留原生）
- `.slider-row`（桌面 flex-row / 移动 flex-column）：`display: flex; align-items: center; gap: var(--cortex-space-2);`
- `input[type="range"]`：`accent-color: var(--cortex-primary); flex: 1;`
- `.value-chip`（移动显示 / 桌面隐藏）：`background: var(--cortex-primary-soft); color: var(--cortex-primary); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); border-radius: var(--cortex-radius-sm); padding: 2px var(--cortex-space-2); font-variant-numeric: tabular-nums;`
- `.hint`：`color: var(--cortex-text-subtle); font-size: var(--cortex-fs-xs); margin-top: var(--cortex-space-1);`
- `.field-error`（移动字段级错误）：`color: var(--cortex-danger); font-size: var(--cortex-fs-xs); margin-top: var(--cortex-space-1);`
- unit 后缀 `.unit`：`color: var(--cortex-text-muted); font-size: var(--cortex-fs-sm);`

**Step 3: 构建验证**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 成功。

**Step 4: 相关 vitest 验证**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/settings-view.spec.ts tests/settings-fields.spec.ts`
Expected: 全绿。

**Step 5: 请求提交许可**

> 阶段 B-4b（设置页 2 文件）完成。是否提交 `refactor(web_v2): 阶段 B-4b 设置页 CSS 重构`？

---

## Task 10: 阶段 B-5 · 视图层 + 对话框 + 杂项

**Files:**
- Modify: `doclens/web_v2/frontend/src/views/search-view.ts`
- Modify: `doclens/web_v2/frontend/src/views/chat-view.ts`
- Modify: `doclens/web_v2/frontend/src/views/files-view.ts`
- Modify: `doclens/web_v2/frontend/src/components/mkdir-dialog.ts`
- Modify: `doclens/web_v2/frontend/src/components/rename-dialog.ts`
- Modify: `doclens/web_v2/frontend/src/components/move-dialog.ts`
- Modify: `doclens/web_v2/frontend/src/components/delete-dialog.ts`
- Modify: `doclens/web_v2/frontend/src/components/reindex-dialog.ts`
- Modify: `doclens/web_v2/frontend/src/components/drop-zone.ts`
- Modify: `doclens/web_v2/frontend/src/styles/global.css`

**Step 1: 改 `search-view.ts`**

- `.initial-stack`：保持（已在 shared-styles 处理）
- `.focus-body`：`display: flex; flex-direction: column; flex: 1; min-height: 0;`
- `.focus-main`：`display: flex; flex: 1; min-height: 0;`（桌面 row / 移动 row 但 splitter/preview hidden）
- `.results-col`：桌面 `flex: 0 0 var(--results-pane-width); min-height: 0; display: flex; flex-direction: column;`；移动 `flex: 1;`
- `.splitter`：`width: 4px; cursor: col-resize; background: var(--cortex-border-muted); flex-shrink: 0; transition: background 0.15s;`
- `.splitter:hover` / `.splitter:active`：`background: var(--cortex-primary);`
- `.not-indexed-hint`：`background: var(--cortex-surface-muted); border-radius: var(--cortex-radius-md); color: var(--cortex-text-muted); padding: var(--cortex-space-6); text-align: center; display: flex; align-items: center; justify-content: center; flex: 1;`

**Step 2: 改 `chat-view.ts`**

- `.initial-stack`：保持
- `.focus-body`：同 search-view
- `.focus-main`：桌面 has-preview 时 flex-row；移动始终 column
- `.focus-main:not(.has-preview) chat-stream`：`max-width: 820px; margin: 0 auto; width: 100%;`（移动无 max-width）
- `.input-bar`：`max-width: 820px; margin: 0 auto; width: 100%; padding: var(--cortex-space-3) var(--cortex-space-4); border-top: 1px solid var(--cortex-border); background: var(--cortex-surface); flex-shrink: 0;`（移动全宽无 max-width）
- `.preview-pane-wrap`（桌面 has-preview）：`flex: 0 0 var(--preview-pane-width); position: relative; min-height: 0; display: flex; flex-direction: column;`
- `.preview-close`（✕ 关闭）：`position: absolute; top: var(--cortex-space-2); right: var(--cortex-space-2); z-index: 2; width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--cortex-border); background: var(--cortex-surface); color: var(--cortex-text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;`
- `.preview-close:hover`：`background: var(--cortex-primary-soft); color: var(--cortex-primary);`
- `.preview-overlay`（移动全屏覆盖）：`position: absolute; inset: 0; z-index: 10; background: var(--cortex-surface); display: flex; flex-direction: column;`
- `.not-indexed-hint`：同 search-view

**Step 3: 改 `files-view.ts`**

- `.desktop-layout`：`display: grid; grid-template-columns: var(--tree-pane-width) 4px minmax(0,1fr) 4px var(--preview-pane-width); flex: 1; min-height: 0; min-width: 0;`
- `.tree-pane`：`display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--cortex-surface); border-right: 1px solid var(--cortex-border-muted);`
- `.splitter`：同 search-view（hover primary）
- `.preview-col`：`display: flex; flex-direction: column; min-height: 0; overflow: hidden;`
- `.preview-placeholder`：`flex: 1; display: flex; align-items: center; justify-content: center; color: var(--cortex-text-subtle); background: var(--cortex-surface-muted); border-radius: var(--cortex-radius-lg); margin: var(--cortex-space-2);`
- `.mobile-layout`：`display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative;`
- `.mobile-preview`：`flex: 1; min-height: 0; display: flex; flex-direction: column;`
- `.toast`：`position: fixed; bottom: var(--cortex-space-6); left: 50%; transform: translateX(-50%); background: var(--cortex-text); color: var(--cortex-surface); padding: var(--cortex-space-2) var(--cortex-space-4); border-radius: var(--cortex-radius-md); box-shadow: var(--cortex-shadow-lg); font-size: var(--cortex-fs-sm); z-index: 100;`

**Step 4: 改 5 个对话框（mkdir/rename/move/delete/reindex）**

每个 dialog 的 `:host` / `.dialog` / `<dialog>` 容器统一样式：

- 对话框容器：`background: var(--cortex-surface); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-xl); box-shadow: var(--cortex-shadow-lg); padding: var(--cortex-space-6); max-width: 90vw;`（桌面 `min-width: 360px;`，移动 `min-width: 0; width: calc(100vw - 16px);`）
- `.title` / `h2`：`font-size: var(--cortex-fs-md); font-weight: 600; color: var(--cortex-text); letter-spacing: -0.01em; margin: 0 0 var(--cortex-space-4);`
- `.label`：`font-size: var(--cortex-fs-sm); color: var(--cortex-text-muted); margin-bottom: var(--cortex-space-2); display: block;`
- `.error`（字段错误提示）：`color: var(--cortex-danger); font-size: var(--cortex-fs-xs); margin-top: var(--cortex-space-2);`
- `.actions`（按钮区）：桌面 `display: flex; justify-content: flex-end; gap: var(--cortex-space-2); margin-top: var(--cortex-space-6);`；移动 `flex-direction: column-reverse;` + 按钮全宽 `width: 100%; min-height: var(--cortex-touch-target);`
- 主按钮（确认）由 `shared-styles.ts` 的 `dialogControlStyles` 提供（已对齐 gradient + glow）
- **delete-dialog** 删除按钮 `.btn.danger` / `button.danger`：`background: var(--cortex-danger); color: #fff; border: none; border-radius: var(--cortex-radius-lg);`
- delete-dialog 警告文字：`color: var(--cortex-warning);`
- delete-dialog 统计列表：`color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm);`
- **reindex-dialog** progress 进度文本：`color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm);`
- reindex progress bar 填充：`background: var(--cortex-primary-gradient);`
- reindex error 态：`color: var(--cortex-danger);`
- reindex done 态：`color: var(--cortex-success);`
- **move-dialog** 内嵌 readonly tree：`border: 1px solid var(--cortex-border-muted); border-radius: var(--cortex-radius-md); max-height: 50vh; overflow-y: auto;`（移动 max-height 50vh）
- move-dialog 目标路径文本：`font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted);`

**Step 5: 改 `drop-zone.ts`**

- `.overlay`（拖拽时显示）：`position: fixed; inset: 0; background: rgba(0,82,255,0.05); border: 2px dashed var(--cortex-primary); border-radius: var(--cortex-radius-lg); display: none; align-items: center; justify-content: center; z-index: 1000;`
- `.overlay.active`：`display: flex;`
- `.overlay .hint`：`color: var(--cortex-primary); font-size: var(--cortex-fs-lg); font-weight: 600;`
- 移动端 `:host`：`display: none !important;`（保持）

**Step 6: 改 `global.css`**

- 滚动条 `::-webkit-scrollbar-thumb`：`background: var(--cortex-border); border-radius: var(--cortex-radius-sm);`（已对齐，核对）
- `::-webkit-scrollbar-thumb:hover`：`background: var(--cortex-text-subtle);`
- 可加 `::-webkit-scrollbar-track`：`background: transparent;`

**Step 7: 构建验证**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 成功。

**Step 8: 相关 vitest 验证**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/mkdir-dialog.spec.ts tests/rename-dialog.spec.ts tests/move-dialog.spec.ts tests/delete-dialog.spec.ts tests/reindex-dialog.spec.ts tests/search-view.spec.ts tests/chat.spec.ts tests/files-view.spec.ts`
Expected: 全绿。

**Step 9: 请求提交许可**

> 阶段 B-5（视图层 + 5 对话框 + drop-zone + global.css，10 文件）完成。是否提交 `refactor(web_v2): 阶段 B-5 视图层与对话框 CSS 重构`？

---

## Task 11: 全量验证与收尾

**Files:** 无新增改动（本任务是验证 + 清理残留）

**Step 1: grep 检查旧 teal 硬编码残留**

Run: `cd doclens/web_v2/frontend && grep -rn "#0D9488\|#0F766E\|#0F766E\|#D4F5E8\|#B8EBD2\|#9FE0BF\|#E8F7F2\|#F0FDFA" src/`
Expected: **0 命中**（旧 Bento teal / 薄荷绿应全部清除）。若有命中，逐个替换为对应 token。

**Step 2: grep 检查通用硬编码十六进制色（组件内应尽量用 token）**

Run: `cd doclens/web_v2/frontend && grep -rEn "#[0-9a-fA-F]{6}" src/ | grep -v "tokens.css" | grep -v "test"`
Expected: 仅剩少量合理硬编码（如纯白 `#fff`/`#FFFFFF` 用于文字反白、`rgba(...)` 透明度叠层、渐变端点色）。审查每一处是否可用 token 替换。语义色（success/warning/danger）必须用 token。

**Step 3: 全量构建**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 成功无报错；`doclens/web_v2/static/assets/` 产出新 hash。

**Step 4: 全量 vitest**

Run: `cd doclens/web_v2/frontend && npx vitest run`
Expected: 全绿（~50 文件）。若有失败，用 systematic-debugging 排查（应是逻辑测试，CSS 不应影响；个别如 scrollbar-style.test.ts 若断言样式值，按新 token 修测试或确认是合理变更）。

**Step 5: 视觉验收（人工）**

Run: `pwsh -File ./start-app.ps1 gui`（在 `C:\Users\lianghao\github\cortex\` 执行）

浏览器打开后，逐项核对（桌面 ≥1024 + 移动 <1024 两种视口，用 DevTools 切换）：

- [ ] 全局色为 electric blue（`#0052FF`），不再是 teal
- [ ] 主按钮（搜索/知识库对话/保存/确认）显示蓝色渐变 + glow 阴影
- [ ] 卡片/面板（result-card / section / dialog / toast）有双层阴影 + 16px 圆角
- [ ] 字体为 Inter（标题紧凑），路径/数字/评分为 JetBrains Mono
- [ ] chat 用户气泡蓝色白字，助手气泡白底 hairline
- [ ] activity-bar / tab-bar active 项 primary-soft 底 + primary 色
- [ ] settings tab-strip active 左条（桌面）/ 底条（移动）primary
- [ ] 移动端按钮触控目标 ≥44px，dialog 按钮垂直全宽
- [ ] 搜索/对话/上传/编辑/预览/设置保存流程功能正常

**Step 6: 请求最终提交许可（含重新构建的静态资产）**

向用户报告验收结果，请求：
> 全量验证通过（grep 无残留、build 成功、vitest 全绿、视觉验收 OK）。是否提交 `chore(web_v2): 重新构建前端静态资产`？（git add `doclens/web_v2/static/assets/*`）

---

## Self-Review Notes

**Spec coverage（spec 章节 → task 映射）:**
- spec §2 阶段 A tokens → Task 1 ✅
- spec §2.2 字体加载 → Task 1 Step 2 ✅
- spec §3.1 改造规则 → 贯穿 Task 2-10 ✅
- spec §3.2.1 核心导航 → Task 2 ✅
- spec §3.2.2 表单 → Task 3 ✅
- spec §3.2.3 初始态 → Task 4 ✅
- spec §3.2.4 搜索结果 → Task 5 ✅
- spec §3.2.5 对话 → Task 6 ✅
- spec §3.2.6 文件浏览器 → Task 7 ✅
- spec §3.2.7 预览/Markdown → Task 8 ✅
- spec §3.2.8 设置页 → Task 9 ✅
- spec §3.2.9 dialogs → Task 10 ✅
- spec §3.2.10 杂项（toast/drop-zone） → Task 3 / Task 10 ✅
- spec §3.2.11 视图层 → Task 10 ✅
- spec §5 测试策略 → 每个 Task 的 vitest step + Task 11 ✅
- spec §6 风险（硬编码残留） → Task 11 Step 1-2 grep ✅
- spec §9 验收清单 → Task 11 ✅

**Placeholder scan:** 无 TBD/TODO/「类似 Task N」；每个 step 都有具体 CSS 或命令。

**Type consistency:** 本计划是纯 CSS，无 TS 类型/函数签名变更，无跨 task 类型依赖。Token 名（`--cortex-primary` 等）在所有 task 中一致。

**已知执行风险（实施者注意）:**
1. 选择器名（如 `.submit` / `.nav-btn` / `.tab-btn`）需用 Read/Grep 在实际文件中确认后再套用本计划的 CSS——计划给出的选择器是基于 spec 与结构报告的合理推断，实际 class 名可能略有出入。**先 Read 文件确认选择器，再改 CSS。**
2. 部分组件可能已有接近 SaaS Boutique 的样式（之前部分重构过），改动应是最小增量，不要推翻重写整个 `static styles`。
3. `shared-styles.ts` 的 `dialogControlStyles` 已为主按钮 + input 提供 token 化样式，dialog 内不要重复定义覆盖（除非有 danger/warn 特例）。
