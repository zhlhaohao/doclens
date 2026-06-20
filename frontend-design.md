# Cortex Web UI —— 前端设计 Spec

> **目的：** 一份自包含的参考文档，供 AI agent（或人类开发者）从零复刻 Cortex web UI。每一个尺寸、颜色、字号、结构关系都记录在此，agent 不需要再去读原始源码。
>
> **技术栈：** Lit 3 + TypeScript 5 + Vite 5。原生 Web Components（不用 React/Vue）。Vitest 单测 + Playwright E2E。构建产物为静态资源，由 FastAPI 后端托管。

---

## 1. 设计理念

- **PWA 优先**：可安装到主屏幕、独立窗口运行、支持离线 shell。
- **移动优先响应式**：单一代码库，1024px 断点切换两种布局。移动端 = 底部 tab-bar；桌面端 = 左侧 activity-bar。
- **冷静、文档为中心的美学**：米白背景（`#F5F5F7`）、白色卡片、teal（`#0D9488`）强调色、慷慨的间距。
- **Token 驱动**：所有颜色、间距、字号、圆角都定义为 `:root` 上的 CSS 变量。组件引用 token，绝不硬编码 hex。
- **Bento grid 风格**：卡片式分区，12px 圆角，1px 极细边框。
- **CJK 友好**：字体栈包含 `PingFang SC` / `Microsoft YaHei` 以正确渲染中文。

---

## 2. 设计 Tokens

全部定义在 `src/styles/tokens.css` 的 `:root` 中。

### 2.1 颜色

| Token | Hex | 用途 |
|---|---|---|
| `--cortex-primary` | `#0D9488` | Teal-600。主强调色（激活态、主按钮、链接） |
| `--cortex-primary-hover` | `#0F766E` | Teal-700。悬停加深变体 |
| `--cortex-primary-soft` | `#F0FDFA` | 带 teal 色调的浅背景，用于 info-box、高亮 |
| `--cortex-bg` | `#F5F5F7` | 应用背景（米白） |
| `--cortex-surface` | `#FFFFFF` | 卡片、面板、输入框 |
| `--cortex-surface-muted` | `#FAFAFA` | 次级表面（悬停、代码块、列表背景） |
| `--cortex-border` | `#E4E4E7` | 标准 1px 边框 |
| `--cortex-border-muted` | `#F1F5F9` | 卡片内分隔线 |
| `--cortex-text` | `#0F172A` | 主文字 |
| `--cortex-text-muted` | `#64748B` | 次级文字、label |
| `--cortex-text-subtle` | `#94A3B8` | 三级文字、hint、placeholder |
| `--cortex-warning` | `#F59E0B` | Amber-500。警告、"需重启" 徽章 |
| `--cortex-danger` | `#DC2626` | Red-600。错误、破坏性操作 |
| `--cortex-success` | `#10B981` | Green-500。成功态、"即时生效" 徽章 |

### 2.2 间距（4px 基线）

| Token | 值 |
|---|---|
| `--cortex-space-1` | `4px` |
| `--cortex-space-2` | `8px` |
| `--cortex-space-3` | `12px` |
| `--cortex-space-4` | `16px` |
| `--cortex-space-6` | `24px` |
| `--cortex-space-8` | `32px` |

### 2.3 圆角

| Token | 值 | 用途 |
|---|---|---|
| `--cortex-radius-sm` | `4px` | 小 chip、activity-bar 按钮 |
| `--cortex-radius-md` | `8px` | 输入框、按钮、菜单项 |
| `--cortex-radius-lg` | `12px` | 卡片、分区、下拉菜单 |

### 2.4 字体

**字体栈：**
```
--cortex-font:      "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif
--cortex-font-mono: "JetBrains Mono", "Cascadia Code", Consolas, monospace
```

**字号（响应式 —— 桌面端更小）：**

| Token | 移动端 (<1024px) | 桌面端 (≥1024px) |
|---|---|---|
| `--cortex-fs-xs` | 12px | 11px |
| `--cortex-fs-sm` | 13px | 12px |
| `--cortex-fs-base` | 14px | 13px |
| `--cortex-fs-md` | 15px | 14px |
| `--cortex-fs-lg` | 17px | 15px |
| `--cortex-fs-xl` | 30px | 24px |

桌面端覆盖通过 `src/styles/breakpoints.css` 中的 `@media (min-width: 1024px) { :root { ... } }` 实现。

### 2.5 布局尺寸

| Token | 值 | 用途 |
|---|---|---|
| `--cortex-activity-bar-width` | `48px` | 桌面端左侧栏宽度 |
| `--cortex-tab-bar-height` | `56px` | 移动端底部导航高度 |
| `--cortex-touch-target` | `44px` | 可交互元素最小尺寸 |

AppBar 高度在 `<app-bar>` 样式中硬编码为 `56px`。

---

## 3. 全局样式 & PWA 行为

定义在 `src/styles/global.css`，应用到 `html, body`：

```css
* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  height: 100vh;
  height: 100dvh;             /* 移动动态视口高度 */
  overflow: hidden;            /* app shell 自己处理滚动 */
  overscroll-behavior: none;   /* 禁用下拉刷新 */
  -webkit-tap-highlight-color: transparent;
  font-family: var(--cortex-font);
  color: var(--cortex-text);
  background: var(--cortex-bg);
}

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* PWA standalone 模式（已安装到主屏幕） */
@media (display-mode: standalone) {
  body {
    user-select: none;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}

/* 全局滚动条（webkit） */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb {
  background: var(--cortex-border);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover { background: var(--cortex-text-subtle); }
```

---

## 4. 响应式策略

两种布局模式通过 `src/styles/breakpoints.css` 中设置在 `:root` 上的 CSS 变量切换：

```css
/* 移动/平板 (<1024px) */
@media (max-width: 1023px) {
  :root {
    --cortex-show-activity-bar: none;
    --cortex-show-tab-bar: flex;
  }
}

/* 桌面 (≥1024px) */
@media (min-width: 1024px) {
  :root {
    --cortex-show-activity-bar: flex;
    --cortex-show-tab-bar: none;
    /* 字号整体缩 1px，避免"手机浏览器"观感 */
    --cortex-fs-xs: 11px; /* 等 */
  }
}
```

组件通过引用这些变量来切换显示：
```css
:host { display: var(--cortex-show-activity-bar, flex); }
```

**断点行为总结：**
| 方面 | 移动端 (<1024px) | 桌面端 (≥1024px) |
|---|---|---|
| 左侧栏 | 隐藏 | 显示（48px activity-bar） |
| 底部导航 | 显示（56px tab-bar） | 隐藏 |
| 字号 | 移动端默认值 | 整体缩 1px |
| App body flex 方向 | 纵向（AppBar 在上，内容堆叠，底部导航） | 横向（AppBar 在上，然后是横向：activity-bar + main） |

---

## 5. App Shell 架构

根元素：`<cortex-app>`（定义在 `src/app.ts`）。

```
┌──────────────────────────────────────────────────────────┐
│ <app-bar>   (56px，始终可见，位于顶部)                    │
├──────┬───────────────────────────────────────────────────┤
│ <acti│                                                 │
│ vity │            <main>                                │
│ -bar │       (当前视图)                                  │
│ >    │                                                 │
│ 48px │                                                 │
│      │                                                 │
├──────┴───────────────────────────────────────────────────┤
│ <tab-bar>   (56px，仅移动端 —— 桌面端隐藏)                │
└──────────────────────────────────────────────────────────┘
```

### `<cortex-app>` 样式

```css
:host {
  display: flex;
  flex-direction: column;     /* app-bar 在上，app-body 在下 */
  height: 100dvh;
  overflow: hidden;
  background: var(--cortex-bg);
}
.app-body {
  flex: 1;
  display: flex;
  flex-direction: row;        /* 桌面端：横向布局 */
  min-height: 0;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;          /* 锚定 detail-overlay、footer-bar 等绝对定位子元素 */
}
@media (max-width: 1023px) {
  .app-body { flex-direction: column; }
}
```

### 视图路由

当前视图存于 `state.view: ViewId`。`_renderView()` 方法返回对应元素：
```typescript
if (view === "search")   return html`<search-view></search-view>`;
if (view === "chat")     return html`<chat-view></chat-view>`;
if (view === "settings") return html`<settings-view></settings-view>`;
return html`<history-view></history-view>`;
```

### 导航事件冒泡

`<app-bar>`、`<activity-bar>`、`<tab-bar>` 都派发 `navigate` 事件，detail 为 `{view: ViewId, scope?: SettingsScope}`。根 `<cortex-app>` 监听这三个，调用 `actions.setView()`（如果带 scope，再调用 `actions.setSettingsScope()`）。

---

## 6. 组件目录

所有组件都是 Lit `LitElement` 子类，通过 `@customElement("tag-name")` 注册。每个组件位于 `src/components/<tag-name>.ts`。

### 6.1 `<app-bar>` —— 顶部品牌 + 用户菜单

| | |
|---|---|
| **用途** | 始终可见的顶栏，左侧品牌，右侧用户/设置下拉 |
| **Props** | `activeView: ViewId` |
| **事件** | `navigate`，detail `{view: "settings", scope: "local" \| "global"}` |
| **内部状态** | `_menuOpen: boolean` |

**结构：**
```html
<div class="brand">🧠 Cortex</div>
<div class="right-cluster">
  <button class="avatar-btn">
    <span class="avatar">L</span>  <!-- 32px 圆形，teal 渐变背景 -->
    <span class="name">Liang</span>
    <span class="chev">▾</span>
  </button>
  <div class="user-menu ${open ? 'open' : ''}">
    <div class="menu-header">姓名 / 邮箱</div>
    <button class="menu-item">📁 本地配置</button>
    <button class="menu-item">🌍 全局配置</button>
  </div>
</div>
```

**关键 CSS：**
- `:host` —— `height: 56px; padding: 0 var(--cortex-space-6); background: var(--cortex-surface); border-bottom: 1px solid var(--cortex-border); display: flex; justify-content: space-between;`
- `.brand .logo` —— 28×28px teal 背景，白色 emoji 居中，radius-md
- `.avatar` —— 32×32px 圆形，`linear-gradient(135deg, #0D9488, #0F766E)`
- `.user-menu` —— `position: absolute; right: 0; top: calc(100% + 6px); width: 280px; box-shadow: 0 8px 24px rgba(0,0,0,0.10); display: none;` `.open { display: block; }`

**行为：**
- 点击头像 → 切换 `_menuOpen`（并 `e.stopPropagation()` 避免文档监听器立刻关闭）
- 文档点击监听器在 `connectedCallback` 注册、`disconnectedCallback` 移除；用 `e.composedPath()` 判断点击是否在 host 内
- 点击菜单项 → 派发 `navigate` 事件 + 关闭菜单

### 6.2 `<activity-bar>` —— 桌面端左侧导航

| | |
|---|---|
| **用途** | 桌面端纵向图标侧栏 |
| **Props** | `active: ViewId` |
| **事件** | `navigate`，detail `{view: ViewId}` |
| **可见性** | `display: var(--cortex-show-activity-bar, flex)` —— 移动端隐藏 |

**结构：**
```html
<nav>
  <button class="${active === 'search' ? 'active' : ''}">🔍</button>
  <button class="${active === 'chat' ? 'active' : ''}">💬</button>
  <button class="${active === 'history' ? 'active' : ''}">🕘</button>
</nav>
```

**关键 CSS：**
- `:host` —— `width: 48px; background: #0F172A; color: #94A3B8;`（深 slate，UI 中唯一的深色元素）
- `button` —— 36×36px，透明背景，radius-sm，悬停时背景变浅
- `button.active` —— `background: var(--cortex-primary); color: #fff;`

### 6.3 `<tab-bar>` —— 移动端底部导航

| | |
|---|---|
| **用途** | 移动端横向底部 tab 栏 |
| **Props** | `active: ViewId` |
| **事件** | `navigate`，detail `{view: ViewId}` |
| **可见性** | `display: var(--cortex-show-tab-bar, none)` —— 桌面端隐藏 |

**结构：** 3 个等宽 tab，每个含 emoji 图标 + 中文 label。

**关键 CSS：**
- `:host` —— `height: 56px; background: var(--cortex-surface); border-top: 1px solid var(--cortex-border); padding-bottom: env(safe-area-inset-bottom);`
- tab 图标 18px；label 10px
- 激活态：`color: var(--cortex-primary); font-weight: 600;`

### 6.4 `<welcome-pane>` —— 渐变欢迎横幅

| | |
|---|---|
| **用途** | initial 状态下显示在输入框上方的装饰性横幅 |
| **Props** | `heading = "Cortex"`、`subheading = ""` |

**结构：** 居中 heading + subheading，叠在 teal 到白色的纵向渐变上。

**关键 CSS：**
```css
:host {
  background: linear-gradient(180deg, var(--cortex-primary-soft) 0%, var(--cortex-surface) 100%);
  text-align: center;
  padding: var(--cortex-space-8) var(--cortex-space-4);
}
h1 {
  font-size: var(--cortex-fs-xl);
  font-weight: 700;
  color: var(--cortex-primary-hover);
  margin: 0 0 var(--cortex-space-2);
}
```

### 6.5 `<input-box>` —— 可复用输入框 + 按钮

| | |
|---|---|
| **用途** | 单行/多行输入框，内嵌提交按钮 |
| **Props** | `value`、`placeholder`、`buttonLabel`、`buttonIcon`、`multiline = false`、`disabled = false` |
| **事件** | `input-change {value}`、`submit {value}` |

**结构：**
```html
<div class="wrapper">
  ${multiline
    ? html`<textarea ...></textarea>`
    : html`<input type="text" .../>`}
  <button class="submit-btn">...</button>
</div>
```

**关键 CSS：**
- `:host` block 显示，带 padding
- `.wrapper` 有 `border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); background: var(--cortex-surface);`
- `.wrapper:focus-within` 加 primary 边框 + `box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12)`
- 提交按钮：`background: var(--cortex-primary); color: #fff; border-radius: var(--cortex-radius-md);`
- 移动端最小高度：`var(--cortex-touch-target)`（44px）

**行为：**
- 单行：Enter 提交
- 多行：Ctrl/Cmd+Enter 提交
- 派发带当前值的 `submit` 事件

### 6.6 `<focus-header>` —— focus 状态的带返回按钮顶栏

| | |
|---|---|
| **用途** | search/chat 激活会话时显示在顶部的 header |
| **Props** | `backLabel = "返回"`、`title`、`meta` |
| **事件** | `back` |

**结构：**
```html
<header>
  <button class="back">← ${backLabel}</button>
  <div class="title">${title}</div>
  <div class="meta">${meta}</div>
</header>
```

**关键 CSS：**
- `background: var(--cortex-surface-muted); border-bottom: 1px solid var(--cortex-border); padding: var(--cortex-space-3) var(--cortex-space-4); display: flex; align-items: center;`
- 返回按钮：`color: var(--cortex-primary); background: transparent;`
- 标题：`flex: 1; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`

### 6.7 `<history-list>` —— 带"清空"按钮的可滚动会话列表

| | |
|---|---|
| **用途** | 含标题 + 清空按钮 + 由 `<history-item>` 组成的可滚动列表 |
| **Props** | `title = "历史会话"`、`sessions: Session[]`、`type?`、`clearing = false` |
| **事件** | `select {session}`、`clear` |

**结构：**
```html
<div class="header">
  <h2>${title}</h2>
  ${sessions.length > 0
    ? html`<button @click=${...}>${clearing ? '清空中...' : '清空'}</button>`
    : nothing}
</div>
<div class="list">
  ${sessions.map(s => html`<history-item .session=${s} @select=${...}></history-item>`)}
</div>
```

**关键 CSS：**
- 清空按钮：悬停 → `color: var(--cortex-danger);`
- 列表：`overflow-y: auto; display: flex; flex-direction: column; gap: var(--cortex-space-2);`
- 空状态：居中 muted 文字

### 6.8 `<history-item>` —— 单条会话卡片

| | |
|---|---|
| **Props** | `session: Session` |
| **事件** | `select {session}` |

**关键 CSS：**
- `background: var(--cortex-surface-muted); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); padding: var(--cortex-space-3);`
- 悬停：`border-color: var(--cortex-primary); cursor: pointer;`
- 显示标题（单行截断）、副标题含 `message_count` + 日期

### 6.9 `<search-results>` —— 搜索结果列表面板

| | |
|---|---|
| **Props** | `results: SearchResult[]`、`activePath`、`activeLine` |
| **事件** | `select {result}` |

**布局：**
- 桌面端：左侧固定 360px 宽（最大 480px），`border-right`
- 移动端：整宽，`border-bottom`

**关键 CSS：**
- `background: var(--cortex-surface-muted); display: flex; flex-direction: column;`
- 列表区：`flex: 1; overflow-y: auto; padding: var(--cortex-space-4); gap: var(--cortex-space-4);`

### 6.10 `<result-card>` —— 单条搜索结果卡片

| | |
|---|---|
| **Props** | `result: SearchResult`、`active = false`（反射属性） |
| **事件** | `select {result}` |

**结构：**
```html
<article class="${active ? 'active' : ''}">
  <div class="path">${path}</div>
  <div class="snippet">${snippetHtml}</div>  <!-- 可能含 <mark> 高亮 -->
  <div class="meta">${source} · ${scorePercent}%</div>
</article>
```

**关键 CSS：**
- `background: var(--cortex-surface); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); padding: var(--cortex-space-3); cursor: pointer;`
- `.active` → `border-color: var(--cortex-primary); background: var(--cortex-primary-soft);`
- snippet：`display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;`
- snippet 内 `<mark>`：`background: rgba(245, 158, 11, 0.4); color: inherit; padding: 0 2px;`

### 6.11 `<preview-pane>` —— 文档查看器

| | |
|---|---|
| **Props** | `path`、`language = "text"`、`content`、`highlights: number[]`、`loading`、`line: number \| null`、`keyword` |

**结构：**
- 顶部 header 行：文件路径（monospace、省略号截断）
- 主体：
  - Markdown 文件（`.md`）：委托给 `<md-viewer>`
  - 其他文件：带行号的 `<pre>` + 高亮行

**关键 CSS：**
- header：`font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); padding: var(--cortex-space-2) var(--cortex-space-4); border-bottom: 1px solid var(--cortex-border);`
- 行号列：`width: 40px; color: var(--cortex-text-subtle); text-align: right; padding-right: var(--cortex-space-3); user-select: none;`
- 高亮行：`background: rgba(245, 158, 11, 0.15);`

### 6.12 `<md-viewer>` —— 带行定位的 Markdown 渲染器

| | |
|---|---|
| **Props** | `content`、`line: number \| null`、`keyword` |

**行为：**
- 用 `marked` 库，自定义 renderer 给每个 block（`<p>`、`<h1>-<h6>`、`<ul>`、`<pre>` 等）注入 `data-source-line="${lineNumber}"` 属性
- 在 `updated()` 中，如果设置了 `line` prop，滚动到对应 block 并闪烁高亮
- 高亮动画：1.2s 从黄色背景淡出到透明
- 关键词高亮：用 `TreeWalker` 遍历渲染后的 DOM，把匹配项包进 `<mark class="keyword-hit">`

**排版：**
- `line-height: 1.7; font-size: var(--cortex-fs-base);`
- 代码块：`font-family: var(--cortex-font-mono); background: var(--cortex-surface-muted); padding: var(--cortex-space-3); border-radius: var(--cortex-radius-md);`

### 6.13 `<chat-stream>` —— 可滚动的消息容器

| | |
|---|---|
| **Props** | `messages: ChatMessage[]` |

**行为：** 在 `updated()` 中自动滚到底部。

**关键 CSS：**
- `flex: 1; overflow-y: auto; padding: var(--cortex-space-4) var(--cortex-space-6); display: flex; flex-direction: column; gap: var(--cortex-space-2);`
- 空状态：居中 muted 文字
- 桌面端把子元素包在 `max-width: 800px; margin: 0 auto;` 列里

### 6.14 `<chat-message>` —— 单条聊天气泡

| | |
|---|---|
| **Props** | `role: "user" \| "assistant"`（反射）、`message: ChatMessage`、`error: string \| null` |

**布局差异：**
- 用户：`align-self: flex-end; max-width: 75%; background: var(--cortex-primary); color: #fff; border-radius: 12px 12px 4px 12px;`
- 助手：`align-self: flex-start; max-width: 75%; background: var(--cortex-surface-muted); border: 1px solid var(--cortex-border); border-radius: 12px 12px 12px 4px;`

非对称的 4px 底角制造指向发送方的"尾巴"。

**其他：**
- padding：`var(--cortex-space-3) var(--cortex-space-4)`
- 助手内容为空 → 显示 "思考中..." 占位（muted 色）

---

## 7. 视图目录

### 7.1 `<search-view>` —— 文档搜索

**两种状态（由 `state.search.state` 控制）：**

**Initial 状态（无活动会话）：**
```
┌─────────────────────────────────┐
│      <welcome-pane>             │  桌面端居中，max-width 720px
├─────────────────────────────────┤
│      <history-list>             │  可滚动
│      type="search"              │
├─────────────────────────────────┤
│      <input-box>                │  搜索输入 + 按钮
│      button-label="搜索"        │
└─────────────────────────────────┘
```

**Focus 状态（有结果的会话激活）：**
```
桌面端 (≥1024px)：
┌─────────────────────────────────────────────────────┐
│ <focus-header>   (返回 / 查询 / 结果数)               │
├──────────────────┬──────────────────────────────────┤
│ <search-results> │ <preview-pane>                   │
│ 宽 360px         │ flex: 1                          │
│ (激活项高亮)     │ (选中卡片对应的文件内容，          │
│                  │  滚动到匹配行)                    │
├──────────────────┴──────────────────────────────────┤
│ <input-box>   (细化查询)                              │
└─────────────────────────────────────────────────────┘

移动端 (<1024px)：
┌─────────────────────────┐
│ <focus-header>          │
├─────────────────────────┤
│ <search-results>        │  整宽
├─────────────────────────┤
│ <input-box>             │
└─────────────────────────┘
   ↓ (点击结果)
┌─────────────────────────┐
│ <focus-header>   ← 返回 │  detail-overlay 覆盖整个视图
├─────────────────────────┤  (position: absolute; inset: 0; z-index: 10)
│ <preview-pane>          │
└─────────────────────────┘
```

**内部状态：**
- `localQuery` —— 输入文本
- `loading` —— 搜索进行中
- `previewContent/Path/Language/Line/Error` —— 当前预览
- `historySessions` —— 最近 20 条搜索会话（connect 时加载）

**行为：**
- 提交：POST `/api/search` → 通过 `/api/sessions` 创建会话 → 渲染结果
- 选中结果：拉取预览（`.md/.pdf/.docx/.xlsx/.csv` 取整文件，其他取行窗口）→ 更新 preview-pane
- 返回：丢弃会话，回到 initial 状态
- 订阅 store 接收来自 history 视图的 pending session 加载

### 7.2 `<chat-view>` —— AI 对话

**Initial 状态：** 与 search-view initial 结构相同（welcome + history + input）。

**Focus 状态：**
```
┌─────────────────────────────────┐
│ <focus-header>   (返回 / 标题 / 消息数)
├─────────────────────────────────┤
│ <chat-stream>                   │  flex: 1，自动滚动
│   <chat-message role="user">    │
│   <chat-message role="assistant">│
│   ...                           │
├─────────────────────────────────┤
│ <input-box multiline>           │  Ctrl+Enter 发送
│ button-label="发送"             │
└─────────────────────────────────┘
```

**行为：**
- 提交：首条消息时创建会话 → POST `/api/chat`（SSE 流）→ 把 token 增量追加到最后一条 assistant 消息 → 完成后通过 `/api/sessions/{id}` PATCH 持久化
- 流式期间：输入框仍可用；消息增量渲染

### 7.3 `<history-view>` —— 全部会话

**布局：** 纵向堆叠 —— welcome-pane + history-list。无输入框。

**行为：**
- connect 时加载最多 100 条会话
- 选中 → 在 store 设置 `pendingSession` 并导航到会话的视图（`search` 或 `chat`）
- 清空按钮 → DELETE 全部会话

### 7.4 `<settings-view>` —— 配置编辑器

**结构：**
```
┌──────────────────────────────────────────┐
│ [从全局复制 banner]   (仅当 scope=local   │
│                       且 !exists 时显示)  │
├──────────────────────────────────────────┤
│ Tab 栏：[AI][搜索调优][评分][终端]        │  窄屏横向滚动
├──────────────────────────────────────────┤
│ 滚动区：                                  │
│   info-box (per-tab 提示)                 │
│   分区卡片含字段                          │
│   (两栏 grid：label | control)            │
├──────────────────────────────────────────┤
│ 页脚栏（粘性）：                          │  position: absolute; bottom: 0
│   ● N 字段已修改  [放弃] [💾 保存XX配置]  │  box-shadow: 0 -2px 8px rgba(0,0,0,0.04)
└──────────────────────────────────────────┘
```

**字段渲染** 由 `SETTINGS_FIELDS`（18 条）元数据驱动。每条声明：
```typescript
{
  tab: "ai" | "search" | "scoring" | "terminal",
  section: string,                  // emoji 前缀中文标题
  envVar: string,                   // 如 "PLANIFY_API_KEY"
  label: string,                    // 中文显示名
  component: "text" | "number" | "select" | "password" | "slider",
  effect?: "live" | "restart",      // 在 label 旁渲染徽章
  hint?: string,                    // 字段下方中文说明
  min?, max?, step?: number,        // 用于 number/slider
  unit?: string,                    // 如 "行"
  mono?: boolean,                   // 等宽字体
  datalist?: string[],              // 自动补全建议
  options?: {value, label}[],       // 用于 select
}
```

**组件类型渲染为：**
- `text` —— `<input type="text">` + 可选 `<datalist>` 自动补全
- `password` —— `<input type="password">` 配绝对定位的"显示"切换按钮
- `number` —— `<input type="number">` 带 min/max/step + 可选单位后缀
- `select` —— `<select>` 配 options
- `slider` —— 成对的 `<input type="number">`（100px）+ `<input type="range">`（flex），双向绑定同一值

**Effect 徽章（label 旁）：**
- `effect: "live"` → 绿色药丸：`● 即时`
- `effect: "restart"` → 琥珀色药丸：`🔁 需重启`

**Per-tab info-box：**
- AI tab："本 tab 修改需重启 cortex gui 才能生效"（primary-soft 背景，primary 左边框）
- Search tab："本 tab 的参数保存后下次查询即时生效"（同样式）
- Scoring tab：白话版公式说明（5 个加权信号，推荐区间 0~10，设为 0 即禁用）
- Terminal tab：警告样式（琥珀色 tint）"仅影响 CLI/TUI 终端输出，对 Web UI 无效"

**内部状态：**
- `_activeTab`、`_saving`、`_error`、`_toast`、`_values`、`_original`、`_exists`、`_scope` —— 全部 `@state()`
- `_loadGen` —— 代计数器，用于作废过期 fetch（防竞态）
- `_toastTimer` —— setTimeout 句柄，disconnect 时清除

**生命周期：**
- `connectedCallback` —— 从 store 读取 scope、订阅 store、调用 `_load()`
- `_load()` —— `GET /api/config?scope=X` → 填充 values/original/exists
- store 变更 → 若 scope 变了，重新加载
- 字段输入 → 更新 `_values[field]`，重算 `_dirty`
- 保存 → `PUT /api/config?scope=X` 带 values → 成功则更新 original + 显示 toast（4s 超时）
- 点击从全局复制 banner → `POST /api/config/copy-from-global` → 重新加载
- `disconnectedCallback` —— 取消订阅、清除 toast 计时器、自增 `_loadGen`

---

## 8. 状态管理

自研轻量 store，位于 `src/state/store.ts`。不用 Redux/Zustand。模式：EventTarget 风格 subscribe + 不可变状态替换。

```typescript
const INITIAL_STATE: AppState = { /* 见下 */ };

class CortexStore {
  private state: AppState = INITIAL_STATE;
  private listeners = new Set<(s: AppState) => void>();

  getState(): AppState { return this.state; }
  setState(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }
  subscribe(cb: (s: AppState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  subscribeSelector<T>(selector: (s: AppState) => T, cb: (t: T) => void): () => void {
    let prev = selector(this.state);
    return this.subscribe((s) => {
      const next = selector(s);
      if (next !== prev) { prev = next; cb(next); }
    });
  }
  private emit() { for (const cb of this.listeners) cb(this.state); }
}

export const store = new CortexStore();
```

**组件集成方式：**
```typescript
connectedCallback() {
  super.connectedCallback();
  this._unsubscribe = store.subscribe(() => this.requestUpdate());
}
disconnectedCallback() {
  this._unsubscribe?.();
  super.disconnectedCallback();
}
```

### AppState 结构

```typescript
interface AppState {
  view: ViewId;                       // "search" | "chat" | "history" | "settings"
  search: SearchViewState;            // state, currentSession, query, results, total, source
  chat: ChatViewState;                // state, currentSession, messages, streaming
  settings: SettingsViewState;        // scope, values, original, dirty, exists, saving, error
  detailStack: SearchResult[];        // 移动端 detail-overlay 导航栈
  pendingSession: Session | null;     // 跨视图会话交接（history → search/chat）
  status: SystemStatus | null;        // 后端健康/索引信息
  error: string | null;
}
```

### Actions（与 store 一起导出）

| Action | 效果 |
|---|---|
| `setView(view)` | `state.view = view` |
| `setSearchState(s)` | 合并到 `state.search` |
| `setChatState(s)` | 合并到 `state.chat` |
| `pushDetail(r)` / `popDetail()` | 移动端详情栈 push/pop |
| `setPendingSession(s)` | 跨视图会话交接 |
| `setError(e)` | 全局错误 |
| `setSettingsScope(scope)` | 切换 local/global |
| `loadSettings(values, exists)` | 批量加载 + 清 dirty |
| `updateSetting(field, value)` | 编辑单字段 + 重算 dirty |
| `revertSettings()` | 恢复到 original |
| `setSettingsSaving(b)` / `setSettingsError(e)` | 标志位 |

---

## 9. API 契约摘要

所有端点带 `/api` 前缀。前端用 `src/api/client.ts` 中的共享 `request()` helper 处理 JSON 序列化、错误提取、SSE 解析。

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/search` | POST | FTS5/ripgrep 搜索；body `{query, mode?, limit?, offset?}` → `{results, total, query, elapsed_ms, source}` |
| `/api/preview` | GET | 拉取文件内容用于预览；`?path=...&keyword=...&start_line=...&end_line=...` |
| `/api/sessions` | GET / POST / PATCH / DELETE | 会话 CRUD；`?type=search\|chat&limit=N` |
| `/api/sessions/{id}` | PATCH / DELETE | 单会话更新 / 删除 |
| `/api/chat` | POST (SSE) | 流式 AI 对话；body `{message, session_id?}` → 事件流 `token` / `done` / `error` |
| `/api/status` | GET | 索引健康 + 文档数 |
| `/api/config` | GET / PUT | 读写 .env 值；`?scope=local\|global` |
| `/api/config/copy-from-global` | POST | 把 `~/.cortex/.env` 拷到 `{cwd}/.cortex/.env` |

**标准错误 shape**（来自后端 `CortexAPIError`）：
```json
{ "code": "ERROR_CODE", "detail": "...", "...extra" }
```

校验错误在此基础上加 `fields: [{field, error}, ...]`。

---

## 10. 交互 & 视觉模式

### 10.1 带操作按钮的粘性页脚

`<settings-view>` 使用：
```css
.footer-bar {
  position: absolute;        /* 锚定到最近的 position:relative 祖先（.main） */
  bottom: 0; left: 0; right: 0;
  background: var(--cortex-surface);
  border-top: 1px solid var(--cortex-border);
  padding: var(--cortex-space-3) var(--cortex-space-8);
  box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
  display: flex; justify-content: space-between; align-items: center;
}
```

### 10.2 移动端详情 overlay

`<search-view>` 用于 preview-pane：
```css
.detail-overlay {
  position: absolute;
  inset: 0;
  background: var(--cortex-surface);
  display: flex; flex-direction: column;
  z-index: 10;
}
```
通过 store 的 `detailStack` 进行 push/pop。

### 10.3 下拉菜单（AppBar 头像）

```css
.user-menu {
  position: absolute;
  top: calc(100% + 6px);     /* 触发元素下方 6px 间隙 */
  right: 0;
  width: 280px;
  background: var(--cortex-surface);
  border: 1px solid var(--cortex-border);
  border-radius: var(--cortex-radius-lg);
  box-shadow: 0 8px 24px rgba(0,0,0,0.10);
  padding: var(--cortex-space-2);
  display: none;             /* 通过 .open 类切换 */
  z-index: 60;
}
.user-menu.open { display: block; }
```

### 10.4 Info-box 变体

```css
.info-box {
  background: var(--cortex-primary-soft);
  border-left: 3px solid var(--cortex-primary);
  padding: var(--cortex-space-3) var(--cortex-space-4);
  border-radius: var(--cortex-radius-md);
  font-size: var(--cortex-fs-sm);
  line-height: 1.7;
}
.info-box.warn {
  background: rgba(245, 158, 11, 0.08);
  border-left-color: var(--cortex-warning);
}
```

### 10.5 Effect / 状态徽章

放在 label 旁的小药丸，表达 live/restart/reindex 状态：
```css
.effect {
  display: inline-flex;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
}
.effect.restart { background: rgba(245, 158, 11, 0.12); color: var(--cortex-warning); }
.effect.live    { background: rgba(16, 185, 129, 0.12); color: var(--cortex-success); }
.effect.reindex { background: rgba(13, 148, 136, 0.12); color: var(--cortex-primary-hover); }
```

### 10.6 按钮

```css
.btn {
  display: inline-flex; align-items: center; gap: var(--cortex-space-2);
  padding: 6px 12px;
  border: 1px solid var(--cortex-border);
  background: var(--cortex-surface);
  color: var(--cortex-text);
  font-size: var(--cortex-fs-sm);
  border-radius: var(--cortex-radius-md);
  cursor: pointer; font-family: inherit;
}
.btn:hover { background: var(--cortex-surface-muted); }
.btn.primary {
  background: var(--cortex-primary);
  border-color: var(--cortex-primary);
  color: #fff;
}
.btn.primary:hover { background: var(--cortex-primary-hover); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.ghost { border-color: transparent; background: transparent; }
```

### 10.7 输入框

```css
.input, .select {
  padding: 6px 10px;
  border: 1px solid var(--cortex-border);
  border-radius: var(--cortex-radius-md);
  background: var(--cortex-surface);
  font-size: var(--cortex-fs-sm);
  font-family: inherit;
  color: var(--cortex-text);
}
.input.mono { font-family: var(--cortex-font-mono); }
.input:focus, .select:focus {
  outline: none;
  border-color: var(--cortex-primary);
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
}
```

### 10.8 卡片 / 分区

```css
.section {
  background: var(--cortex-surface);
  border: 1px solid var(--cortex-border);
  border-radius: var(--cortex-radius-lg);
  padding: var(--cortex-space-6);
  margin-bottom: var(--cortex-space-4);
}
.section h2 {
  margin: 0 0 var(--cortex-space-1) 0;
  font-size: var(--cortex-fs-md);
  font-weight: 600;
}
.section-desc {
  color: var(--cortex-text-muted);
  font-size: var(--cortex-fs-sm);
  margin: 0 0 var(--cortex-space-4) 0;
}
```

### 10.9 表单字段（两栏 grid）

```css
.field {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: var(--cortex-space-6);
  padding: var(--cortex-space-3) 0;
  border-top: 1px solid var(--cortex-border-muted);
  align-items: start;
}
.field:first-of-type { border-top: none; }
.field-label .name {
  font-size: var(--cortex-fs-base);
  font-weight: 500;
  display: flex; align-items: center; gap: var(--cortex-space-2);
}
.field-label .env {
  font-family: var(--cortex-font-mono);
  font-size: var(--cortex-fs-xs);
  color: var(--cortex-text-subtle);
  margin-top: 2px;
}
.field-control .hint {
  font-size: var(--cortex-fs-xs);
  color: var(--cortex-text-muted);
}
```

---

## 11. 复刻清单

AI agent 从零重建此 UI 时，按以下顺序构建：

1. **项目初始化**：Vite + TypeScript + Lit。安装 `lit`、`marked`、`@open-wc/testing`（dev）。配置 `tsconfig.json` 启用 `noUnusedLocals: true`、`strict: true`、`experimentalDecorators: true`。
2. **Tokens**：按 §2、§3 创建 `tokens.css`、`breakpoints.css`、`global.css`，在 `main.ts` 中引入。
3. **Store**：按 §8 构建 `state/store.ts` 和 `state/types.ts`。导出 `store`、`actions` 以及 `selectSettingsDirtyFields` selector。
4. **API 客户端**：先建 `api/client.ts`（共享 `request()` + SSE），然后按 §9 建 `api/{chat,search,sessions,config}.ts`。
5. **App shell**：`<cortex-app>` 用 §5 的样式。通过 `--cortex-show-*` 变量验证移动/桌面切换。
6. **导航组件**：`<app-bar>`、`<activity-bar>`、`<tab-bar>`。
7. **通用组件**（无业务逻辑）：`<welcome-pane>`、`<focus-header>`、`<input-box>`、`<history-list>`、`<history-item>`、`<result-card>`、`<search-results>`、`<preview-pane>`、`<md-viewer>`、`<chat-message>`、`<chat-stream>`。
8. **视图**：`<search-view>`、`<chat-view>`、`<history-view>`、`<settings-view>` + `settings-fields.ts` 元数据。
9. **接线**：app.ts 根据 `state.view` 路由。每个视图订阅 store 并派发 action。
10. **测试**：Vitest + `@open-wc/testing` 做组件 fixture；`vi.stubGlobal("fetch", ...)` 模拟 API。
11. **构建**：`vite build` 输出到 `../static/`（由 FastAPI 托管）。

### 验证

复刻正确后，打开应用应看到：
- 56px 白色 AppBar，左侧 `🧠 Cortex` 品牌，右侧 teal 渐变头像
- search/chat/history 导航（桌面：深 slate 侧栏含 emoji 图标；移动：白色底部栏）
- 米白 `#F5F5F7` 背景，白色卡片，全局 teal `#0D9488` 强调色
- 1024px 断点平滑切换桌面/移动布局
- 所有圆角只有 4/8/12px 三种
- 所有间距是 4px 倍数
- 正文用 Plus Jakarta Sans，代码/路径用 JetBrains Mono
