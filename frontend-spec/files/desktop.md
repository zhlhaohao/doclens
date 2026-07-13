# 文件浏览器 — 桌面端（≥1024px）

> 本 spec 描述 files-view 在桌面端的**结构 / 布局 / 交互逻辑**，不含视觉样式。
> 共享组件（`<app-bar>` / `<toast-stack>` / `<reindex-dialog>`）见 [README](../README.md)。

## 1. 路由与入口

| 项 | 值 |
|---|---|
| 路由 hash | `#/files` |
| 渲染入口 | `files-view.render()` → `_isMobile === false` → `_renderDesktop()` |
| 进入方式 | `<activity-bar>` 左侧竖条的 files 图标点击 → `navigate` 事件 → `router.navigate("files")` → hash 变 → `store.view = "files"` → `<cortex-app>` 的 `.main` 挂载 `<files-view>` |
| 初始化 | `connectedCallback` → `_ensureLoaded("")` 加载根目录列表 + `_loadPaneWidths()` 从 localStorage 读取 tree/preview 两栏宽度 + `_loadIndexedDocuments()` 从 `/api/documents` 拉取全量已索引文档到内存（供文件名搜索） |
| 退出 | 点 activity-bar 其它导航 → `<files-view>` 被 DOM 移除 → `disconnectedCallback` 解绑 store 订阅 + 清理 toast 定时器 |

## 2. 状态机

桌面端无统一 focus 状态机，三栏并排常驻，靠以下子状态控制中栏内容与 dialog：

### 2.1 中栏切换：`_isFilenameSearchActive`

| 子状态 | 条件 | 中栏渲染 |
|---|---|---|
| 浏览模式 | `filenameSearch.isActive === false` | `<file-list>`（当前目录表格） |
| 搜索模式 | `filenameSearch.isActive === true` | `<file-search-results>`（跨目录匹配结果） |

切换由 `file-search-box` 的 search/clear 事件驱动（详见 6.6 节）。

### 2.2 Dialog 状态：`_dialog`

| `_dialog` | 渲染 | 触发 |
|---|---|---|
| `null` | 无 dialog | 默认 / 各 dialog 提交或取消后复位 |
| `"mkdir"` | `<dialog open><mkdir-dialog>` | 工具栏「+ 新目录」按钮 |
| `"rename"` | `<dialog open><rename-dialog>` | 工具栏「✎ 重命名」（仅选中 1 项时启用） |
| `"move"` | `<dialog open><move-dialog>` | 工具栏「→ 移动」（选中 ≥1 项时启用） |
| `"delete"` | `<dialog open><delete-dialog>` | 工具栏「🗑 删除」（选中 ≥1 项时启用） |

### 2.3 预览状态（本地私有）

| 字段 | 含义 |
|---|---|
| `_previewPath` | 当前预览文件路径；空 = 未选中 |
| `_previewContent` / `_previewLanguage` / `_previewWritable` / `_previewPages` | 预览内容 / 语言 / 可写标志 / 分页标记（PDF/PPTX/XLSX） |
| `_previewError: "NOT_INDEXED" \| null` | 预览失败态：文件未索引 |
| `_previewDirty` | 编辑器脏标记；切换预览前需 confirm |

### 2.4 栏宽持久化

| 字段 | localStorage key | 默认 / 上下限 |
|---|---|---|
| `_treePaneWidth` | `cortex.files.treePaneWidth` | 默认 240，范围 [180, 720] |
| `_previewPaneWidth` | `cortex.files.previewPaneWidth` | 默认 320，范围 [240, 1600] |

拖动结束时持久化到 localStorage。

## 3. 构件树

```
<files-view>                                    :host flex column · flex:1
├── .desktop-layout                             CSS Grid 5 列 · flex:1 · min-height:0
│   ├── .tree-pane                              aside · flex column · overflow:hidden
│   │   ├── <file-search-box>                   文件名搜索输入 · flex-shrink:0
│   │   └── <file-tree>                         目录树 · flex:1
│   │       └── <tree-node>（递归）             展开箭头 + 📁 + 名 + 子节点
│   │           └── <tree-node>…                depth+1
│   ├── .splitter                               左分隔条 · role=separator · col-resize
│   ├── <file-search-results>                   （搜索模式时）中栏结果列表
│   │   ├── .header-bar                         结果计数
│   │   ├── .columns                            列头（名称·目录 / 大小·修改）
│   │   ├── .rows                               结果行（高亮命中 + 目录 + meta）
│   │   └── .overflow-hint                      （>100 条时）溢出提示
│   │   ── 或 ──
│   ├── <file-list>                             （浏览模式时）中栏文件表格
│   │   ├── .breadcrumb                         上级按钮 + 当前路径
│   │   ├── .toolbar                            工具栏 5 按钮
│   │   ├── .header-row                         7 列表头 + 全选 checkbox + col-resize
│   │   └── .rows
│   │       └── <file-row> × N                  7 列文件行
│   ├── .splitter                               右分隔条 · role=separator · col-resize
│   └── .preview-col                            flex column · overflow:hidden
│       └── <preview-pane>                      或 .preview-placeholder / .not-indexed-hint
├── <dialog open>                               （_dialog 非 null 时）模态
│   └── <mkdir-dialog> | <rename-dialog> | <move-dialog> | <delete-dialog>
├── <drop-zone>                                 全屏拖拽 overlay（display:contents）
└── .toast                                      （_toast 非 null 时）底部居中提示
```

## 4. 布局

### 4.1 `.desktop-layout` — CSS Grid 5 列

```
grid-template-columns:
  var(--tree-pane-width)        ← .tree-pane（弹性宽度，由 splitter 控制）
  4px                            ← .splitter（固定）
  minmax(0, 1fr)                 ← 中栏（file-list / file-search-results，弹性剩余）
  4px                            ← .splitter（固定）
  var(--preview-pane-width)     ← .preview-col（弹性宽度，由 splitter 控制）
```

- `.desktop-layout`：`flex:1; min-height:0; min-width:0`
- 中栏 `minmax(0,1fr)` 保证它吃掉剩余空间但不溢出
- `--tree-pane-width` 和 `--preview-pane-width` 由 inline style 注入，splitter 拖动时实时更新

### 4.2 `.tree-pane`

- `display:flex; flex-direction:column; min-height:0; overflow:hidden`
- `<file-search-box>`：`flex-shrink:0`，固定在顶部
- `<file-tree>`：`flex:1; min-height:0`，内部 `overflow-y:auto` 独立滚动

### 4.3 中栏（file-list / file-search-results）

- `<file-list>` / `<file-search-results>`：`flex:1; min-height:0; min-width:0`
- 内部各自 `display:flex; flex-direction:column`
- 顶部固定区（breadcrumb+toolbar 或 header-bar+columns）`flex-shrink:0`
- `.rows` 区 `flex:1; overflow-y:auto` 独立滚动

### 4.4 `.preview-col`

- `display:flex; flex-direction:column; min-height:0; overflow:hidden`
- 内部 `<preview-pane>`：`flex:1` 填满
- 或 `.preview-placeholder`：`flex:1; align-items:center; justify-content:center` 居中提示

### 4.5 `.splitter`

- `cursor:col-resize`，固定 4px 宽，`min-height:0` 垂直拉伸
- `:hover` / `:active` 反馈色变化（细节属样式层）
- `role="separator"` + `aria-orientation="vertical"` + `aria-label`

## 5. 元素清单

### 5.1 `<file-search-box>` — 文件名搜索输入

| 元素 | 行为 |
|---|---|
| 🔍 icon | 纯装饰 |
| `<input type="text">` | 受控输入；`disabled` 当文档列表加载失败或为空时；`placeholder` 动态（"按文件名搜索…" / "暂无已索引文档" / "文档列表加载失败"） |
| × 清空按钮 | 仅 `_value` 非空时显示；点击清空 + 焦点回 input |

事件：`@search`（detail: `{query}`）/ `@clear`。

### 5.2 `<file-tree>` — 目录树

| 元素 | 行为 |
|---|---|
| `.header` | sticky 顶部「文件」标题 |
| `<tree-node>` × N | 递归渲染根级目录（仅 `is_dir` 项），按 store 的 `expandedPaths` / `currentDir` 控制展开与选中 |

### 5.3 `<tree-node>` — 目录节点（非 readonly 模式）

| 元素 | 行为 |
|---|---|
| ▶ 展开箭头 | 有子目录（`has_child_dirs`）时可点；`expanded` 时旋转 90°；`leaf` 不可见 |
| 📁 icon | 纯装饰 |
| `.label` | 目录名，ellipsis |
| `.children` | 展开时递归渲染子目录 `<tree-node>`（缩进） |

事件：`@toggle`（点箭头）/ `@select-dir`（点行体）。

### 5.4 `<file-list>` — 文件表格（桌面模式 `mobile === false`）

| 区域 | 元素 |
|---|---|
| `.breadcrumb` | `↑` 返回上级按钮（`currentDir === ""` 时 disabled）+ 路径文本（ellipsis） |
| `.toolbar` | 5 按钮：`+ 新目录` / `⬆ 上传` / `✎ 重命名`（disabled 当选中≠1）/ `→ 移动`（disabled 当选中=0）/ `🗑 删除`（disabled 当选中=0，`.danger` 样式） |
| `.header-row` | 7 列 grid 表头，详见 5.5 |
| `.rows` | `<file-row>` × N，可滚动 |

### 5.5 桌面 7 列表头（`.header-row`）

| 列序 | CSS var | 内容 | col-resize |
|---|---|---|---|
| 1 | `--col-1` | 全选 checkbox（`.select-all`） | 无 |
| 2 | `--col-2` | 空（类型 icon 列） | 无 |
| 3 | `--col-3` | 「名称」 | 有（`_makeColResizeHandler(2)`） |
| 4 | `--col-4` | 「大小」 | 有（`_makeColResizeHandler(3)`） |
| 5 | `--col-5` | 「修改」 | 有（`_makeColResizeHandler(4)`） |
| 6 | `--col-6` | 空（已索引 badge 列） | 有（`_makeColResizeHandler(5)`） |
| 7 | `--col-7` | 「类型」 | 无 |

- 列宽默认 `[28, 28, 240, 80, 140, 70, 80]`，min/max 约束各列不同
- 持久化到 `localStorage["cortex.files.colWidths"]`
- 列宽通过 `--col-N` CSS var 注入到 `:host`，子树（含 file-row shadow DOM）继承读取

### 5.6 `<file-row>` — 文件行（桌面 7 列）

| 列 | 内容 |
|---|---|
| checkbox | `checked = selected`；`@click` 派发 `checked` 事件（stopPropagation，不触发行体激活） |
| icon | 目录 📁 / 文件 type-badge（圆形字母）/ 📄 默认 |
| name | 文件名，ellipsis |
| size | 文件大小（KB/MB），目录为空 |
| time | 修改时间本地化 |
| indexed | 非目录且 `indexed === true` → 「已索引」badge |
| type | 类型标签（`getTypeLabel`） |

行体 `@click` 派发 `activated`（detail: `{path, is_dir}`）。

### 5.7 `.preview-col` — 预览栏

| 子状态 | 渲染 |
|---|---|
| 未选中（`_previewPath === ""` 且无 error） | `.preview-placeholder`「点击文件预览」 |
| 未索引（`_previewError === "NOT_INDEXED"`） | `.preview-placeholder`「该文件未索引，无法预览。请先执行 doclens index 后重试。」 |
| 正常 | `<preview-pane>`（桌面 `noHeader=false`，即显示常规 header） |

`<preview-pane>` 角色：文件预览主体，按 `language` 分支渲染（markdown → `<md-viewer>` 或 `<md-editor>` / html → iframe / 纯文本行号）。header 含路径文本 + 编辑按钮（可写时）+ 下载 + 上传。事件：`@dirty-change` / `@saved` / `@save-failed` / `@upload-success` / `@upload-failed`。

### 5.8 `<drop-zone>` — 全屏拖拽上传

- 始终渲染，`display:contents`；`.overlay` 默认隐藏
- 拖拽文件进入 window → `_active=true` → `.overlay.active` 全屏覆盖提示
- `targetDir` = `store.files.currentDir`
- 事件：`@drop-files`（detail: `{files: File[], destDir: string}`）

### 5.9 Dialogs

| Dialog | 内容 |
|---|---|
| `<mkdir-dialog>` | 标签（在 X 下新建目录）+ 输入框 + 错误提示 + 取消/新建按钮 |
| `<rename-dialog>` | 标签（重命名）+ 预填输入框 + 错误提示 + 取消/重命名按钮 |
| `<move-dialog>` | 标题（移动 N 项）+ 内嵌 readonly `<tree-node>` 选目录 + 目标路径文本 + 覆盖同名 checkbox + 取消/移动按钮 |
| `<delete-dialog>` | loading-stats → 标题 + 不可恢复警告 + 统计列表（文件数/子目录数/总大小）+ 「我确定」checkbox + 取消/永久删除按钮 |

桌面 dialog 尺寸：`min-width:360px; max-width:90vw`；按钮区 `flex-end` 水平排列。

### 5.10 `.toast`

- `position:fixed; bottom:24px; left:50%` 居中
- `_toast` 非 null 时显示，点击关闭，3.5s 自动消失

## 6. 交互逻辑

### 6.1 目录树展开 / 折叠 / 选中

1. **点箭头 toggle**：`@toggle` → 若 `expandedPaths` 已含 → `collapseDir(path)`；否则 `_ensureLoaded(path)` + `expandDir(path)`
2. **点行体 select-dir**：`@select-dir` → `selectDir(path)` + `_ensureLoaded(path)` + `expandDir(path)`
3. `selectDir` 更新 `store.files.currentDir` → `<file-list>` 重渲染该目录内容
4. `_ensureLoaded` 先查 `treeCache[path]`，未缓存则 `filesApi.list(path)` → 写入 `treeCache`；并发写做 merge 而非覆盖

### 6.2 文件激活与即时预览

1. **行体单击** → `<file-row>` 派发 `activated`（detail: `{path, is_dir}`）
2. **目录** → `selectDir(path)` + `_ensureLoaded(path)` → 进入该目录（中栏刷新）
3. **文件** → `_previewPathWithDirtyCheck(path)`：
   - 若 `_previewDirty` → `window.confirm` 确认丢弃 → 拒绝则中止，同意则 `_discardPreviewEdits()`
   - `_fetchPreview(path)` → `fetchPreview` API → 成功填充 `_previewPath/_previewContent/_previewLanguage/_previewWritable/_previewPages`；`notIndexed` → `_previewError="NOT_INDEXED"`；失败 → toast
4. 桌面端**不**切换 `mobilePane`（三栏并排，预览直接刷新右栏）

### 6.3 多选

| 操作 | 行为 |
|---|---|
| checkbox 单击 | `<file-row>` `@checked`（detail: `{path, ctrl, shift}`）→ `_onRowChecked` → `actions.selectEntry(path, {ctrl, shift})` |
| ctrl+点击 | 累积切换该 path 的选中态 |
| shift+点击 | 范围选择（从 `lastSelectedAnchor` 到当前 path） |
| 表头全选 checkbox | `@click` → `_onSelectAll`：checked=true → 合并当前目录全部 path 到 `selectedPaths`（去重）；checked=false → 从 `selectedPaths` 剔除当前目录下的 path |

选中态驱动工具栏按钮 enable/disable：重命名需恰好 1 项；移动/删除需 ≥1 项。

### 6.4 列宽调整（桌面独占）

1. 表头 col-resize 手柄 `@mousedown` → `_makeColResizeHandler(idx)`
2. 阻止默认行为 + 全局 `cursor:col-resize` + `userSelect:none`
3. `mousemove` → `dx` 增量 → clamp 到 `[COL_MINS[idx], COL_MAXS[idx]]` → 更新 `_colWidths[idx]`（不可变数组拷贝）
4. `willUpdate` 中将 `_colWidths` 注入到 `:host` 的 `--col-N` CSS var → file-row 经继承读取
5. `mouseup` → 持久化到 localStorage

### 6.5 Splitter 拖动调栏宽（桌面独占）

**左 splitter（tree-pane 右边缘）：**
1. `@mousedown` → 记录 `startX` / `startWidth`
2. `mousemove` → `dx = clientX - startX`（正 = 变宽）
3. 动态上限 = `hostWidth - previewPaneWidth - MIDDLE_PANE_MIN(300) - SPLITTERS_TOTAL(8)`；与静态上限 `TREE_PANE_WIDTH_MAX(720)` 取 min
4. clamp 到 `[TREE_PANE_WIDTH_MIN(180), cap]`
5. `mouseup` → 持久化 `cortex.files.treePaneWidth`

**右 splitter（preview-col 左边缘）：**
1. `dx` 负 = 变宽（拖左）
2. 动态上限 = `hostWidth - treePaneWidth - MIDDLE_PANE_MIN(300) - SPLITTERS_TOTAL(8)`；与 `PREVIEW_PANE_WIDTH_MAX(1600)` 取 min
3. clamp 到 `[PREVIEW_PANE_WIDTH_MIN(240), cap]`
4. `mouseup` → 持久化 `cortex.files.previewPaneWidth`

两条 splitter 共同保证中间栏（file-list / file-search-results）不低于 300px。

### 6.6 文件名搜索

1. `<file-search-box>` 输入 → `_onInput`：
   - 空输入（trim 后）→ `_emitClear()`（不走防抖，立即清空）
   - 非空 → `_scheduleEmit()`（80ms 防抖；IME composition 期间不触发，composition 结束后补触发）
2. **search 事件** → `_onFilenameSearch(query)`：
   - query trim 空 → `clearFilenameSearch()` 回 file-list
   - 非空 → 从 `filenameSearch.allDocs` 内存过滤 `name.toLowerCase().includes(q)` → 按 `name.localeCompare`（zh, numeric）排序 → 前 100 条 → `setFilenameSearchQuery({query, results, totalMatches})` → `filenameSearch.isActive = true` → 中栏切换到 `<file-search-results>`
   - 首结果存在 → 立即 `_previewPathWithDirtyCheck(results[0].path)` 联动预览
3. **clear 事件** → `clearFilenameSearch()` → `isActive=false` → 中栏回 `<file-list>`
4. **键盘导航**（`<file-search-results>` `tabIndex=0` + `keydown`）：
   - ↑/↓ → `selectFilenameSearchResult` + 派发 `activated` 联动预览
   - Enter → 派发 `activated`（当前选中或首条）
   - Esc → 派发 `clear` 事件
5. **结果行点击** → `selectFilenameSearchResult(path)` + 派发 `activated` → `_onFilenameResultActivated` → `_previewPathWithDirtyCheck`

### 6.7 拖拽上传（桌面独占）

1. 文件拖入 window → `dragenter`（`_hasFilesOnly` 校验）→ `_dragCounter++` + `_active=true`
2. `dragover` → `preventDefault`（允许 drop）
3. `dragleave` → `_dragCounter--`，归零 → `_active=false`
4. `drop` → 收集 `dataTransfer.files` → 派发 `drop-files`（detail: `{files, destDir: targetDir}`）
5. `_onDropFiles` → `_uploadFiles(files, destDir)`

### 6.8 文件操作流

**入口**：工具栏按钮 → `<file-list>` 派发 `action`（detail: `{name}`）→ `_onAction`。

#### 6.8.1 上传 upload

1. `_onAction("upload")` → `_openFilePicker()`：创建隐藏 `<input type="file" multiple>` → `click()`
2. `change` → `_uploadFiles(files, currentDir)`：
   - 循环 `filesApi.upload(file, destDir, overwrite=false)`
   - `ALREADY_EXISTS` → 计入 skipped；其它错误 → 记 lastError
   - 完成后 `invalidateDir(destDir)` + `_ensureLoaded(destDir)` 刷新列表
   - toast 汇总（已上传 N / 跳过 N / 部分失败）

#### 6.8.2 新建目录 mkdir

1. `_dialog = "mkdir"` → 渲染 `<mkdir-dialog>`
2. `<mkdir-dialog>` 校验：空 / 点开头 / 非法字符 `\ / : * ? " < > |` / 空白开头 / Windows 保留名（con/prn/aux/nul/comN/lptN）
3. 提交 → `_onMkdirSubmit`：路径拼接 `parent/name` → `filesApi.mkdir(path)` → `invalidateDir(parent)` + `_ensureLoaded(parent)` + `expandDir(parent)` → toast「目录已创建」

#### 6.8.3 重命名 rename

1. 选中恰好 1 项 → `_dialog = "rename"` → 预填 `selectedPaths[0]` 的 basename
2. `<rename-dialog>` 校验：空 / **名称未变化** / 点开头 / 非法字符 / Windows 保留名
3. 提交 → `_onRenameSubmit`：`filesApi.rename(path, newName)` → `invalidateDir(currentDir)` + `_ensureLoaded` → 若重命名的是当前预览文件 → 更新 `_previewPath` + `_reloadPreview()` → toast「已重命名」

#### 6.8.4 移动 move

1. 选中 ≥1 项 → `_dialog = "move"` → 渲染 `<move-dialog>`
2. `<move-dialog>`：内嵌 readonly `<tree-node>`（点击派发 `pick-dir` 而非 `select-dir`），可展开浏览目录树
3. 选目标目录 + 可选「覆盖同名」checkbox
4. 提交 → `_onMoveSubmit`：`filesApi.move(selectedPaths, destDir, overwrite)` → 批量 `invalidateDir`（所有源父目录 + 目标目录）+ 逐个 `_ensureLoaded` → `clearSelection()` → toast（已移动 N 项，跳过 N 项）

#### 6.8.5 删除 delete

1. 选中 ≥1 项 → `_dialog = "delete"` → 渲染 `<delete-dialog>`
2. `<delete-dialog>` 先 `loading-stats` → `filesApi.stats(path)` 循环加载统计（文件数/子目录数/总大小）→ `confirming`
3. 勾选「我确定」→ 按钮启用
4. 提交 → `_onDeleteSubmit`：循环 `filesApi.remove(path)` → 每项 `invalidateSubtree(p)` + `invalidateDir(parent)` → 逐父目录 `_ensureLoaded` → 若删了正在预览的文件 → 清空全部 preview state → `clearSelection()` → toast

### 6.9 预览编辑闭环

1. `<preview-pane>` header「✏️ 编辑」（仅 `_previewWritable` 时）→ `enterEdit()` → `_mode="edit"` → 渲染 `<md-editor>`
2. 编辑 → `dirty-change` → `_previewDirty = true`
3. Ctrl+S / 保存按钮 → `<md-editor>` `@save` → `savePreview(path, content)` API → 成功 → `@saved`（更新内容 + 退出 edit + toast「已保存」）/ 失败 → `@save-failed`（editor setError + toast）
4. 取消 → `<md-editor>` `@cancel` → `_mode="preview"`
5. **dirty 保护**：切换预览（点别的文件 / 搜索结果）前 `_previewPathWithDirtyCheck` → `_previewDirty` 时 confirm

## 7. 边界态

| 场景 | 表现 |
|---|---|
| 目录为空 | `<file-list>` `.rows` 上方渲染 `.empty`「目录为空」 |
| 搜索无结果 | `<file-search-results>` 渲染 `.empty`（🔍 + 「未匹配到任何文件名包含 "X" 的文档」） |
| 搜索结果 >100 | 底部 `.overflow-hint`「共 N 项，仅显示前 100，请补充关键字」 |
| 文件未索引 | 预览栏 `.preview-placeholder`「该文件未索引，无法预览。请先执行 doclens index 后重试。」 |
| 未选预览 | 预览栏 `.preview-placeholder`「点击文件预览」 |
| 文档列表加载中 | `<file-search-box>` disabled + placeholder「按文件名搜索…」（docsLoading=true 时 placeholder 正常，输入框可用） |
| 文档列表为空 | `<file-search-box>` disabled + placeholder「暂无已索引文档」 |
| 文档列表加载失败 | `<file-search-box>` disabled + placeholder「文档列表加载失败」 |
| 目录加载失败 | toast 显示错误消息 + `store.files.error` 记录 |
| 预览失败（非 NOT_INDEXED） | toast 显示「预览失败」+ result.message |
| 上传全部失败 | toast 显示 lastError |
| 上传部分失败 | toast 汇总「已上传 N，跳过 N，部分失败」 |
| 删除部分失败 | toast 汇总「已删除 N，失败 M」 |
| 移动部分跳过 | toast 汇总「已移动 N 项，M 项跳过」 |
