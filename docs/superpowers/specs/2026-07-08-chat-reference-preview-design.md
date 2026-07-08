# Chat 参考资料预览设计

## 背景

doclens Web UI 的 chat（RAG 对话）中，AI 回答末尾的「## 参考资料」列表（由 `knowledge-base` skill 的引文规范产生）当前是**纯文本路径，不可点击**。用户无法直接核验引文来源，必须手动切到 search tab 搜同一份文档。

search tab 已有成熟的预览能力：`<preview-pane>` 组件 + `fetchPreview(path)` (`GET /api/preview?path=...`) + 后端 `/api/preview`，支持 markdown / html / 纯文本三种渲染，以及编辑、下载、上传。search-view 的布局是：视图持有 preview 相关 `@state`，点击结果 → `fetchPreview` → 渲染 `<preview-pane>`；桌面端结果列 + splitter + preview-pane 并排，移动端 detail-overlay 全屏覆盖。

chat 侧现状：
- `chat-view` 布局为 `focus-header + chat-stream + input-bar`，chat-stream 桌面 `max-width:800px` 居中，两侧留白；移动端全宽。
- `chat-message` 用 `marked.parse(content)` 把 assistant 回答渲染成 `.md-body` 的 innerHTML，参考资料是 `<ol><li>路径</li></ol>`，路径为纯文本节点。
- 全局 `AppState` 有 `detailStack`（search 移动端用），无 chat 专属 preview 状态。
- **路径格式一致**：SKILL.md 引文规范要求路径来自 `search_kb`/`grep` 的 `<path>`（相对 workdir），与 `fetchPreview(path)` 期望的 path 一致，可直接复用。

## 目标

- AI 回答「## 参考资料」列表中的文档路径**可点击**，点击后用现有 `<preview-pane>` 预览该文档（与 search tab 预览体验一致）。
- **桌面端**：preview-pane 在 chat 右侧并排（仿 search），可拖 splitter 调宽；preview 按需打开（点参考资料才出现，可关闭恢复 chat 全宽）。
- **移动端**：preview 以全屏 overlay 出现（仿 search 移动端 detail-overlay），顶部 `← 返回` 回到对话。
- 多条参考资料一次只显示一份，点新的替换（不做 pane 内切换 UI，YAGNI）。
- 不新增后端，不改 SKILL.md 引文格式，不依赖 AI 输出链接语法。

## 方案概述

- **`chat-message.ts`**：marked 渲染后，后处理 `.md-body` DOM——定位「## 参考资料」标题后的列表，把每个 `<li>` 的路径文本包裹成可点击 `<a class="ref-link">`；事件委托捕获点击 → 派发 `reference-click` 自定义事件（`composed:true` 穿 Shadow DOM）。
- **`chat-view.ts`**：新增 preview 相关 `@state`；监听 `reference-click` → `fetchPreview(path)` → 填 state + 开 pane；桌面端水平布局（chat-stream + splitter + preview-pane，按需切换），移动端 overlay。
- **`<preview-pane>` / `<chat-stream>` / 后端**：不改。

## 组件设计

### 1. `chat-message.ts` —— 参考资料可点击化

**后处理（在 `updated()` 钩子，`message` 变化时执行）：**

1. 取 `.md-body` 容器（renderRoot 内）。
2. 遍历其子元素，找文本内容包含「参考资料」的 `<h2>`（兼容 AI 偶尔的标题措辞波动，用 `includes('参考资料')`）。
3. 从该 `<h2>` 的后续兄弟中找第一个 `<ol>` 或 `<ul>`（参考资料列表）。
4. 对该列表的每个 `<li>`：取 `textContent.trim()` 作为路径 `P`；把 `<li>` 内部替换为 `<a class="ref-link" data-path="${P}" href="#">${原文本}</a>`（保留原文本，仅包裹）。路径为空或纯空白则跳过。

**事件委托（`firstUpdated` 绑一次，挂在 `.md-body` 上）：**

- click 事件中，沿 `composedPath()` 找是否有 `.ref-link`；命中则 `e.preventDefault()` 并派发：
  ```ts
  this.dispatchEvent(new CustomEvent("reference-click", {
    detail: { path }, bubbles: true, composed: true,
  }));
  ```
- 事件委托天然幂等：流式 token 每次 re-render 重设 `<a>` 节点无需重新绑定监听。

**流式安全：** 每次 `marked.parse` 后都跑一次后处理；「## 参考资料」标题或列表尚未完整时识别不到就跳过，不报错。

**降级：** 若回答里没有「## 参考资料」区块，或列表项不是路径，前端不报错，回答正常显示（只是没有可点击链接）。

### 2. `chat-view.ts` —— preview state + 双布局

**新增 `@state`（仿 search-view）：**

```
previewOpen: boolean
previewContent / previewPath / previewLanguage: string
previewLine: number | null
previewPages: PageMarker[] | null
previewWritable: boolean
previewError: "NOT_INDEXED" | null
previewDirty: boolean
_previewPaneWidth: number（持久化到 localStorage，key 如 cortex.chatPreviewWidth）
```

**事件处理：**

- `<chat-stream>` 上监听 `@reference-click=${this._onReferenceClick}`。
- `_onReferenceClick(e)`：取 `e.detail.path`；若 `previewDirty` 先 `confirm("丢弃修改？")`（仿 search `_safeAction`）；调 `fetchPreview(path)`：
  - `ok` → 填 state + `previewOpen=true`。
  - `notIndexed` → `previewError="NOT_INDEXED"` + `previewOpen=true`（pane 区显示未索引提示）。
  - 其他失败 → toast `预览失败：<message>`，不开 pane。

**桌面端布局（≥1024px）：**

- `focus-body`（垂直）保持：`focus-header` + `.focus-main`（水平 flex:1）+ `.input-bar`。
  - 新增 `.focus-main` 包裹层（原 chat-stream 直接挂在 focus-body 下，现收进 focus-main）。
- `.focus-main`：
  - `previewOpen=false`：仅 chat-stream，沿用 `max-width:800px; margin:0 auto`（现状居中）。
  - `previewOpen=true`：水平排布 `chat-stream(flex:1，取消 max-width 居中) + .splitter(col-resize, 4px) + preview-pane(固定宽 _previewPaneWidth)`。preview-pane 顶部带「✕ 关闭」按钮（或复用 focus-header 风格的关闭条），点击 → `previewOpen=false`。
- splitter 拖动逻辑复用 search-view 的 `_onSplitterMouseDown` 模式（mousedown 记录起点 → mousemove 改宽 → mouseup 持久化）。

**移动端布局（<1024px）：**

- `.focus-main` 始终只含 chat-stream（全宽）；splitter 与桌面 preview-pane 加 `desktop-only`（`@media(max-width:1023px){display:none}`）。
- `previewOpen=true` 时，在 focus-body 内叠一层 `.preview-overlay`（`position:absolute; inset:0; z-index:10`），结构：`focus-header(← 返回 + 文件名) + preview-pane(noHeader)`。返回按钮 → `previewOpen=false`。

**未索引提示：** 复用 search-view 的 `_renderNotIndexedHint` 模式，preview 区显示「该文件未索引，请先执行 doclens index 后重试」。

**编辑脏标志：** `<preview-pane>` 的 md 编辑能力保留（writable 时显示编辑按钮，与 search 一致）；切换参考或关闭 pane 前，若 `previewDirty` 则 `confirm`（复用 `_safeAction` 模式）。

### 3. 不改动的部分

- `<preview-pane>`：直接复用，props（path/language/content/line/keyword/writable/pages）由 chat-view 喂入。`keyword` 传当前用户最近一次提问（用于高亮命中词），或留空。
- `<chat-stream>`：不改；`reference-click` 事件 `composed:true` 自动穿过其 Shadow DOM 到达 chat-view。
- 后端 `/api/preview`：不改。

## 数据流

**桌面 happy path：**
```
用户点 AI 回答「## 参考资料」中的路径
 → chat-message 事件委托命中 .ref-link → dispatch "reference-click" {path} (composed)
 → 穿 chat-stream Shadow DOM → chat-view._onReferenceClick
 → fetchPreview(path)（GET /api/preview）
 → 填 preview* state + previewOpen=true
 → 桌面 .focus-main 切水平布局：chat-stream 让位 + splitter + preview-pane 渲染
```

**移动 happy path：**
```
同上至 previewOpen=true
 → 移动端 .preview-overlay 全屏覆盖：focus-header(← 返回 + 文件名) + preview-pane
 → ← 返回 → previewOpen=false
```

**切换参考资料：**
```
previewOpen=true 时点另一条路径
 → _onReferenceClick 再触发 → 若 previewDirty 先 confirm → fetchPreview 新 path → 替换 state
```

## 边界与错误处理

- **未索引**：`fetchPreview` 返回 `notIndexed=true` → `previewError="NOT_INDEXED"`、`previewOpen=true` → preview 区显示未索引提示（桌面在 pane 位置，移动在 overlay 内）。
- **路径获取失败**（网络/其他错误）：`ok:false` 且非 notIndexed → toast `预览失败：<message>`，不打开 pane。
- **AI 格式不符**（无「## 参考资料」标题、列表缺失、或列表项不是路径）：后处理识别不到 → 无 `.ref-link`，回答正常显示，不报错。
- **流式中途点击**：允许；若路径不完整导致 `fetchPreview` 失败，走 toast 分支。
- **切换/关闭时有未保存编辑**：`previewDirty` 为 true 时 `confirm("当前文件有未保存的修改。确定要丢弃吗？")`，确认才切换/关闭（复用 search `_safeAction`）。
- **路径含特殊字符**：`fetchPreview` 内部用 `URLSearchParams` 编码，已安全。

## 已知限制（v1 简化，非阻塞）

- **路径识别取 `<li>` 整段 textContent**：假设 AI 遵守 SKILL.md 规范（列表项仅为纯文档路径）。若 AI 在路径后附加说明文本（如 `第一章.md — 介绍部分`），textContent 会含说明，`fetchPreview` 大概率失败 → 走 toast 降级。v1 **不做**"从混合文本启发式提取路径"。
- **标题匹配限定中文「参考资料」**：`<h2>` textContent `includes('参考资料')`。英文 `References` 或其他变体 v1 不识别（当前 SKILL.md 用中文标题，AI 应跟从）。
- **`keyword` 高亮来源**：preview-pane 的 `keyword` prop 取 chat 最近一条 user message 的 content（用于命中词高亮，与 search 一致）；多轮对话里以最近一问为准。

## 测试策略

### 单元测试（Vitest）

**`chat-message` 后处理：**
- 回答含「## 参考资料」+ `<ol>` 路径列表 → 渲染后每个 `<li>` 含 `.ref-link` 且 `data-path` 正确。
- 点击 `.ref-link` → 派发 `reference-click` 事件，`detail.path` 正确，`composed:true`。
- 正文段落、非参考资料区的 `<ul>/<ol>`（如正文里的步骤列表）**不被**包裹成 `.ref-link`。
- 无「## 参考资料」区块时 → 无 `.ref-link`，不报错。
- 流式增量更新（content 多次变化）→ 后处理幂等，不产生重复绑定或重复 `.ref-link`。

**`chat-view` preview：**
- `reference-click` → mock `fetchPreview` 返回 ok → `previewOpen=true`，state 字段正确。
- 桌面 render（宽屏）`previewOpen=true` 含 `<preview-pane>` + splitter；`previewOpen=false` 不含。
- 移动 render（窄屏）`previewOpen=true` 含 `.preview-overlay`；返回按钮 → `previewOpen=false`。
- `notIndexed` → preview 区含未索引提示文案。
- `ok:false`（非 notIndexed）→ 触发 toast，`previewOpen` 保持 false。
- `previewDirty` 时 `_onReferenceClick` 弹 confirm（mock `window.confirm` 返回 false 时不切换）。

### E2E（playwright-cli skill，手验）

按 CLAUDE.md 规定 GUI E2E 用 `playwright-cli` skill：
- 提一个 KB 问题 → 等 AI 回答出现「## 参考资料」→ 点击某条路径 → preview 出现对应文档（关键词高亮）。
- 窄屏（<1024px）→ preview 走全屏 overlay，`← 返回` 可关闭。

## 不做（Out of Scope）

- preview-pane 内多文档切换 UI（一次一份，点新替换）。
- 正文 `[1]` 标注点击跳预览（只做参考资料列表项）。
- preview pane 常驻（按需打开，关闭恢复 chat 全宽居中）。
- 改 SKILL.md 引文格式（保持纯路径列表，前端识别）。
- 新增后端接口（复用 `/api/preview`）。
- chat-stream 的 `<chat-message>` 组件本身样式调整（只加后处理 + 事件）。

## 涉及文件清单

| 文件 | 改动 |
|------|------|
| `doclens/web_v2/frontend/src/components/chat-message.ts` | marked 渲染后后处理参考资料区块为可点击 `.ref-link`；事件委托派发 `reference-click` |
| `doclens/web_v2/frontend/src/views/chat-view.ts` | 新增 preview `@state`；监听 `reference-click` + `fetchPreview`；桌面水平布局 + splitter；移动 overlay；未索引提示；编辑脏标志 confirm |
| `doclens/web_v2/frontend/src/components/preview-pane.ts` | 不改（复用） |
| `doclens/web_v2/frontend/src/components/chat-stream.ts` | 不改（事件 composed 透传） |
| `doclens/web_v2/frontend/tests/` | 新增 `chat-message` 后处理 + `chat-view` preview 的单元测试 |
