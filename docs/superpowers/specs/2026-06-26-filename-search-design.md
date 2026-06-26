# Filename Search in Explorer — Design Spec

**Date:** 2026-06-26
**Topic:** cortex GUI 在 files 视图（左栏顶部）新增文件名搜索框，输入即响应；命中结果显示在三栏布局的中栏（完全替换 file-list），保留预览联动
**Status:** Approved (user authorized implementation, skip per-section confirmation)

## 1. 背景与动机

当前 files 视图（左栏 file-tree + 中栏 file-list + 右栏 preview-pane）只能通过目录树逐层定位文件，缺少跨目录的文件名搜索能力。用户在大型工作目录中找特定文件时，必须手动展开目录、扫描列表，体验割裂；同时 search 视图的全文本搜索（FTS5 + LIKE + ripgrep）面向内容检索，会返回片段与评分，不适合「我就知道文件名里有个 read，想直接定位文件」的场景。

本设计在已有三栏布局上**最小代价**补齐文件名快速定位能力：复用 IndexManager.documents 作为数据源，前端本地过滤，零后端改动，零新接口。

## 2. 需求总结（用户决策）

| 维度 | 决策 |
|------|------|
| 匹配范围 | **仅文件名**（含扩展名），不含路径段 |
| 匹配模式 | 子串包含，Case-Insensitive |
| 数据源 | 仅 `IndexManager.documents` 已索引文档（前端本地过滤，不新增 API） |
| 搜索框位置 | **左栏顶部**（file-tree 之上） |
| 中栏展示 | **完全替换模式**：搜索激活时隐藏面包屑/工具栏/原 file-list，整体变成搜索结果列表 |
| 结果项行布局 | 单行多列：`文件名 + 所在目录 | 大小 · 修改时间` |
| 匹配高亮 | 命中子串使用黄色背景 + 黑色文字 |
| 排序 | 文件名字母序（Case-Insensitive locale-aware） |
| 预览联动 | 点击 / 键盘上下键选中即触发右栏 preview-pane 联动 |
| 清空行为 | 搜索框清空（手点 × 或按 Esc）即自动恢复原 file-list 视图 |
| 数量上限 | 100 项，超出时底部显示提示「共 N 项，仅显示前 100，请补充关键字」 |
| 中文输入法 | 仅中英文文本匹配（不支持拼音首字母、不支持简繁互通），但需正确处理 IME composition 事件避免误触发 |
| 防抖 | 80ms（平衡即时响应与 IME / 大列表性能） |
| 快捷键 | 暂不添加全局快捷键（点击搜索框聚焦即可） |
| 左栏 file-tree | 搜索激活时保持原状（不折叠、不联动） |

## 3. 架构总览

### 3.1 不动的部分（明确不动）

- `doclens/web_v2/api/`、`doclens/web_v2/models/`、`doclens/index_manager.py` 等 **后端零改动**
- `doclens/web_v2/frontend/src/state/types.ts` 中 `FileEntry`、`FileAttrs`、现有 `treeCache / expandedPaths / currentDir / ...` 等字段不动
- `<file-tree>` / `<file-list>` / `<preview-pane>` 组件本身不动

### 3.2 前端文件改动

```
doclens/web_v2/frontend/src/
├── views/
│   └── files-view.ts                  ⭐ 改：插入 <file-search-box>；按搜索态切换中栏
├── components/
│   ├── file-search-box.ts             ⭐ 新增：搜索框（input + × 清空 + 防抖 + IME 处理）
│   └── file-search-results.ts         ⭐ 新增：结果列表（表头 + 行 + 空态 + 超限提示）
├── state/
│   ├── types.ts                       ⭐ 改：扩展 FileExplorerViewState 增加 filenameSearch 字段
│   └── store.ts                       ⭐ 改：新增 3 个 actions + 初始状态
└── api/
    └── documents.ts                   ⭐ 新增：一次性拉取已索引文档列表的 client（用于本地过滤）
```

### 3.3 数据流

```
mount files-view
  ↓
fetch /api/files/documents → store.filenameSearch.allDocs（一次性，按文档数变化刷新）
  ↓
用户输入 → <file-search-box> 防抖 80ms → emit('search', value)
  ↓
files-view 监听 'search' → 本地 filter(allDocs, value)
  ↓
results = sort(字母序) → 截断 100 → store.filenameSearch.results
  ↓
中栏渲染 <file-search-results>
  ↓
点击/键盘选中行 → store.filenameSearch.selectedPath → preview-pane 自动联动
  ↓
清空（× 或 Esc） → store.filenameSearch.isActive=false → 中栏回到 <file-list>
```

## 4. 后端设计（最小改动）

**不新增任何端点。** 复用现有能力：

### 4.1 数据来源

- `IndexManager.documents`（`doclens/index_manager.py:100-103`）返回 `list[Document]`
- 每个 Document 的 `metadata['source_path']` 提供完整相对路径，`doc_name` 提供文件名

### 4.2 数据下发通道（必填字段）

通过现有 `GET /api/files/list` 或新增**只读**轻量端点（二选一，见 §10）：

**方案 A（首选，零新端点）**：扩展 `GET /api/files/list?path=__indexed__`，复用现有路由，由后端识别特殊 path 返回扁平化的已索引文档列表。

**方案 B（更干净）**：新增 `GET /api/files/documents`，返回 `{ path, name, size, modified_at }[]`。

实施阶段优先尝试方案 A；若侵入性大则切换方案 B。本 spec 默认按方案 B 落地，下面给出接口契约：

```
GET /api/files/documents
Response 200:
{
  "documents": [
    {
      "path": "docs/README.md",       // 相对工作目录
      "name": "README.md",            // 文件名（含扩展名）
      "size": 2345,                   // bytes
      "modified_at": "2026-06-24T..."  // ISO8601
    },
    ...
  ],
  "total": 123
}
```

错误响应沿用现有 `api/errors.py` 的 `error_response` 风格。

## 5. 前端设计

### 5.1 状态结构（`state/types.ts`）

```typescript
export interface IndexedDocument {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
}

export interface FilenameSearchState {
  query: string;            // 当前防抖后的查询字符串
  allDocs: IndexedDocument[]; // 一次性拉取的已索引文档全量列表
  docsLoading: boolean;
  docsError: string | null;
  results: IndexedDocument[]; // 已过滤 + 排序 + 截断 100 后的结果
  selectedPath: string | null; // 当前选中项（用于 preview 联动）
  isActive: boolean;          // query 非空时为 true
  totalMatches: number;       // 过滤后总命中数（可能 > results.length）
}

// 在 FileExplorerViewState 中追加：
export interface FileExplorerViewState {
  // ...现有字段保持不动
  filenameSearch: FilenameSearchState;
}
```

### 5.2 Actions（`state/store.ts`）

新增 4 个 action（命名遵循现有 `setFilesState / selectEntry` 风格）：

| Action | Payload | 行为 |
|--------|---------|------|
| `loadIndexedDocuments` | `IndexedDocument[]` | 一次性写入 `allDocs`，清空 `docsLoading` |
| `setFilenameSearchQuery` | `{ query: string; results: IndexedDocument[]; totalMatches: number }` | 写入 query/results/totalMatches，更新 `isActive = query !== ''`；query 变化时 `selectedPath` 重置为 `results[0]?.path ?? null` |
| `clearFilenameSearch` | 无 | `query = ''`、`results = []`、`isActive = false`、`selectedPath = null` |
| `selectFilenameSearchResult` | `path: string \| null` | 仅更新 `selectedPath`（不重新过滤） |

初始状态：
```typescript
filenameSearch: {
  query: '',
  allDocs: [],
  docsLoading: true,
  docsError: null,
  results: [],
  selectedPath: null,
  isActive: false,
  totalMatches: 0,
}
```

### 5.3 组件：`<file-search-box>`

**职责**：渲染 input、处理防抖、处理 IME、emit 搜索/清空事件。

**Props/State**：
- 内部 reactive：`_value: string`、`_isComposing: boolean`
- 不接收 props（受控方式由 store 监听）

**事件**：
- `input` 事件 → 防抖 80ms → 若非 composing 则 emit CustomEvent `'search'` with `{ detail: value }`
- `compositionstart` / `compositionend` → 维护 `_isComposing`；compositionend 后立即触发一次搜索
- 清空按钮 × click → 清空 value、emit `'clear'`、focus 回 input
- `keydown` Esc → 同清空按钮

**渲染**：
```
<div class="file-search-box">
  <span class="icon">🔍</span>
  <input
    type="text"
    placeholder="按文件名搜索…"
    .value=${_value}
    @input=${onInput}
    @compositionstart=${() => _isComposing = true}
    @compositionend=${onCompositionEnd}
    @keydown=${onKeyDown}
  />
  {_value && <button class="clear" @click=${onClear}>×</button>}
</div>
```

样式沿用 `--tree-pane-width`、`--color-bg-elevated`、`--color-border` 等现有 CSS tokens（`frontend/src/styles/`）。聚焦时边框使用 `--color-accent`。

### 5.4 组件：`<file-search-results>`

**职责**：渲染表头 + 结果行 + 空态/超限提示；管理键盘导航。

**Props/State**：
- 内部 reactive：`_hoveredIndex: number | null`（鼠标 hover 不影响 selected，仅视觉）
- 从 store 读取：`filenameSearch.query`、`results`、`selectedPath`、`totalMatches`

**键盘导航**（捕获 keydown，仅当 `isActive`）：
- ArrowDown / ArrowUp → 移动 `selectedPath` 到相邻项（边界 clamp）
- Enter → 复用 files-view 的「在 preview 联动基础上，不影响 file-tree」
- Esc → 触发 clear（沿 search-box 路径）

**行渲染**（参考 §6 的 mockup）：
- 主行：`📄 <高亮文件名> · <path 的目录部分（dim 灰色）>`
- 右侧元信息：`<size 格式化> · <modified_at 相对时间>`
- 选中态背景：`--color-row-active`
- 文件名高亮：将命中子串用 `<mark>` 包裹，背景 `--color-highlight-bg`（黄色）、文字 `--color-highlight-fg`（黑色）

**空态**：
- `results.length === 0 && query !== ''` → 显示「未匹配到任何文件名包含 "<query>" 的文档」

**超限提示**：
- `totalMatches > results.length` → 底部 sticky 一行「共 {totalMatches} 项，仅显示前 100，请补充关键字」

### 5.5 `files-view.ts` 改动

在 `<file-tree>` 之前插入 `<file-search-box>`；根据 `filenameSearch.isActive` 在中栏位置条件渲染：

```typescript
render() {
  return html`
    <div class="files-layout">
      <aside class="tree-pane">
        <file-search-box
          @search=${this._onSearch}
          @clear=${this._onClearSearch}
        ></file-search-box>
        <file-tree ...></file-tree>
      </aside>
      <section class="list-pane">
        ${this._isFilenameSearchActive
          ? html`<file-search-results ...></file-search-results>`
          : html`<file-list ...></file-list>`}
      </section>
      <aside class="preview-pane-container">
        <preview-pane ...></preview-pane>
      </aside>
    </div>
  `;
}
```

`_onSearch` 实现：
1. 接收 `{ detail: query }`
2. 本地过滤：`allDocs.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))`
3. 排序：`localeCompare(query, 'zh', { numeric: true, sensitivity: 'base' })`
4. 截断：`results = sorted.slice(0, 100)`，`totalMatches = sorted.length`
5. dispatch `setFilenameSearchQuery` action

`_onClearSearch` 实现：
1. dispatch `clearFilenameSearch`

预览联动：当 `filenameSearch.isActive && selectedPath` 时，preview-pane 的 `path` prop 绑定到 `selectedPath`；非搜索态保持原绑定（来自 `selectedEntry`）。

### 5.6 数据加载策略

- `files-view.ts` 的 `connectedCallback()` 检查 `filenameSearch.allDocs.length === 0 && docsLoading`，触发 `fetchDocuments()`
- `fetchDocuments()` 在 `<file-search-box>` 不存在的情况下不触发（lazy load，避免影响其它视图）
- 重新进入 files 视图时检查 `docsLoading` 状态决定是否重新拉取；为了简化首版，**每次进入 files 视图都重新拉取一次**（已索引文档数据量可控）

## 6. UI 细节（mockup 引用）

### 6.1 激活态（用户输入「read」）

```
┌──────────────┬─────────────────────────────────┬──────────────────┐
│ 🔍 read  ×  │ 📄 文件名搜索结果 · 共 3 项      │ preview-pane     │
│--------------│----------------------------------│                  │
│ 📁 项目根    │ 名称 · 目录        | 大小 · 修改 │ README.md        │
│ ├─ 📁 docs   │ ──────────────────────────────── │                  │
│ ├─ 📁 src    │ 📄 [READ]ME.md  docs/ | 2.3KB·2天│ 这是项目说明...  │
│ │  ├─ guide  │ 📄 [read]me.txt src/guide/| 1.1KB│                  │
│ │  └─ utils  │ 📄 b[read].py   src/utils/| 0.8KB│                  │
│ └─ README.md │                                  │                  │
└──────────────┴─────────────────────────────────┴──────────────────┘
```

### 6.2 空态

```
中栏显示：
   ┌───────────────────────────┐
   │   🔍                      │
   │   未匹配到任何文件名包含   │
   │   "xyz" 的文档            │
   └───────────────────────────┘
```

### 6.3 超限提示

底部 sticky 行：
```
共 247 项，仅显示前 100，请补充关键字
```

## 7. 错误处理

| 场景 | 行为 |
|------|------|
| `GET /api/files/documents` 失败 | 搜索框 disable，placeholder 改为「文档列表加载失败」；点击重试 |
| `allDocs` 为空 | 搜索框 disable，placeholder 改为「暂无已索引文档」 |
| `query` 仅空白字符 | 视作空查询，dispatch `clearFilenameSearch` |
| 预览接口失败 | 沿用 preview-pane 现有错误处理（不引入新逻辑） |

## 8. 性能

- **过滤**：10000 项以下，纯前端 substring + localeCompare 排序在 80ms 防抖窗口内可完成（实测可接受）
- **渲染**：上限 100 行，DOM 压力可控
- **内存**：`allDocs` 数组约 10000 项 × 200 bytes/项 ≈ 2 MB，可接受
- **重新拉取**：每次进入 files 视图拉一次；如未来成为瓶颈可加 ETag/version 校验，本期不做

## 9. 测试计划

### 9.1 前端单元测试（Vitest）

- `file-search-box.test.ts`
  - 输入触发 `search` 事件（防抖后）
  - IME composition 期间不触发 search
  - Esc / × 清空按钮触发 `clear` 事件
- `file-search-results.test.ts`
  - 渲染结果列表（高亮、元信息）
  - 空态显示正确文案
  - 超限提示显示正确文案
  - 键盘 ArrowUp/ArrowDown 移动 selectedPath
- `store.test.ts`（扩展）
  - `setFilenameSearchQuery` 正确更新 query/results/totalMatches
  - `clearFilenameSearch` 完全清空
  - `selectFilenameSearchResult` 不重新过滤

### 9.2 E2E（Playwright，沿用 `cortex-test` skill）

- `FILENAME-001`：进入 files 视图，搜索框聚焦，输入「read」，中栏出现结果列表，左栏 file-tree 不变
- `FILENAME-002`：点击结果项，右栏 preview-pane 加载预览
- `FILENAME-003`：键盘 ArrowDown 选中第二项，preview 切换
- `FILENAME-004`：按 Esc，中栏恢复 file-list
- `FILENAME-005`：输入不存在的关键字，显示空态
- `FILENAME-006`：制造 >100 项匹配，显示超限提示

## 10. 实施顺序与风险

| 步骤 | 内容 | 风险 |
|------|------|------|
| 1 | 后端：新增 `GET /api/files/documents`（方案 B） + 单元测试 | 低 |
| 2 | 前端：扩展 `state/types.ts` + `state/store.ts` + Vitest | 低 |
| 3 | 前端：新增 `<file-search-box>` + Vitest | 低（IME 处理需小心） |
| 4 | 前端：新增 `<file-search-results>` + Vitest | 低 |
| 5 | 前端：改动 `files-view.ts` 装配 + 联动 preview | 中（preview 联动需复用现有逻辑） |
| 6 | E2E：添加 6 个 FILENAME-* 用例 | 低 |
| 7 | 构建 `npm run build` 验证产物 | 低 |

## 11. 不在本期范围（YAGNI）

明确不做：
- 全局快捷键（Ctrl+P 等）
- 拼音首字母匹配、简繁互通
- 搜索未索引的磁盘文件
- 模糊匹配（VSCode 风格字符序列）
- 多关键字空格分词
- 搜索历史 / 最近搜索
- 文件类型图标差异化（PDF / DOCX / XLSX 等都用 📄）
- 移动端单独适配（依赖 files-view 移动端布局已存在；本期让搜索框跟随 tree-pane 即可）
