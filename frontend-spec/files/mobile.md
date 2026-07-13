# 文件浏览器 — 移动端（<1024px）

> 本 spec 描述 files-view 在移动端的**结构 / 布局 / 交互逻辑**，不含视觉样式。
> 共享组件（`<app-bar>` / `<toast-stack>` / `<reindex-dialog>`）见 [README](../README.md)。

## 1. 路由与入口

| 项 | 值 |
|---|---|
| 路由 hash | `#/files` |
| 渲染入口 | `files-view.render()` → `_isMobile === true` → `_renderMobile()` |
| 进入方式 | `<tab-bar>` 底部 files tab 点击 → `navigate` 事件 → `router.navigate("files")` → hash 变 → `store.view = "files"` → `<cortex-app>` 的 `.main` 挂载 `<files-view>` |
| 初始化 | `connectedCallback` → `_ensureLoaded("")` 加载根目录列表 + `_loadPaneWidths()`（桌面栏宽读取，移动端不使用但无副作用） + `_loadIndexedDocuments()` 从 `/api/documents` 拉取全量已索引文档到内存 |
| 退出 | 点 tab-bar 其它导航 → `<files-view>` 被 DOM 移除 → `disconnectedCallback` 解绑 store 订阅 + 清理 toast 定时器 |
| 默认 pane | `store.files.mobilePane = "tree"`（首屏显示目录树面板） |

## 2. 状态机

### 2.1 主状态机：`mobilePane`

移动端核心状态机，驱动 `.mobile-layout` 内单 pane 线性栈：

| mobilePane | 渲染内容 | 前进触发 | 后退目标 |
|---|---|---|---|
| `"tree"` | `<file-search-box>` +（搜索激活时 `<file-search-results>` 否则 `<file-tree>`） | 点目录 → `"list"` | 无（顶层） |
| `"list"` | `<file-list ?mobile>`（自带 mobile-header） | 点文件 → `"detail"` | `"tree"`（mobile-header 返回按钮） |
| `"detail"` | `.mobile-preview` 包 `<preview-pane ?mobile>`（自带 mobile-header） | — | `"list"`（或搜索激活时回 `"tree"`） |

转换由 `actions.setMobilePane(value)` 驱动。

### 2.2 中栏 / tree pane 内子状态：`_isFilenameSearchActive`

| 子状态 | 条件 | tree pane 渲染 |
|---|---|---|
| 浏览模式 | `filenameSearch.isActive === false` | `<file-tree>` |
| 搜索模式 | `filenameSearch.isActive === true` | `<file-search-results>` |

搜索模式下 tree pane 不显示目录树，改显搜索结果。

### 2.3 Dialog 状态：`_dialog`

| `_dialog` | 渲染 | 触发 |
|---|---|---|
| `null` | 无 dialog | 默认 / 各 dialog 提交或取消后复位 |
| `"mkdir"` | `<dialog open><mkdir-dialog>` | mobile-header 更多菜单「+ 新目录」 |
| `"rename"` | `<dialog open><rename-dialog>` | mobile-header 更多菜单「✎ 重命名」（仅选中 1 项时启用） |
| `"move"` | `<dialog open><move-dialog>` | mobile-header 更多菜单「→ 移动」（选中 ≥1 项时启用） |
| `"delete"` | `<dialog open><delete-dialog>` | mobile-header 更多菜单「🗑 删除」（选中 ≥1 项时启用） |

### 2.4 预览状态（本地私有）

| 字段 | 含义 |
|---|---|
| `_previewPath` | 当前预览文件路径；空 = 未选中 |
| `_previewContent` / `_previewLanguage` / `_previewWritable` / `_previewPages` | 预览内容 / 语言 / 可写标志 / 分页标记 |
| `_previewError: "NOT_INDEXED" \| null` | 预览失败态：文件未索引 |
| `_previewDirty` | 编辑器脏标记；切换预览前需 confirm |

## 3. 构件树

```
<files-view>                                    :host flex column · flex:1
├── .mobile-layout                              flex column · flex:1 · position:relative
│   │
│   ├── （mobilePane === "tree"）
│   │   ├── <file-search-box>                   文件名搜索输入 · flex-shrink:0
│   │   ├── <file-search-results>               （搜索模式）结果列表 · flex:1
│   │   │   ├── .header-bar
│   │   │   ├── .columns
│   │   │   └── .rows
│   │   └── <file-tree>                         （浏览模式）目录树 · flex:1
│   │       └── <tree-node>（递归）
│   │
│   ├── （mobilePane === "list"）
│   │   └── <file-list ?mobile>                 移动模式文件列表 · flex:1
│   │       ├── .mobile-header                  返回 / 路径 / 更多菜单
│   │       │   └── .mobile-menu                （展开时）5 菜单项下拉
│   │       ├── .header-row                     6 列表头 + 全选 checkbox（无 col-resize）
│   │       └── .rows
│   │           └── <file-row> × N              6 列文件行
│   │
│   └── （mobilePane === "detail"）
│       └── .mobile-preview                     flex:1 · flex column
│           └── <preview-pane ?mobile>          移动模式预览（自带 mobile-header）
│               ├── .mobile-header              返回 / 文件名 / 更多菜单
│               │   └── .mobile-menu            （展开时）编辑/下载/上传
│               └── （内容：md-viewer / md-editor / iframe / 纯文本行号）
│
├── <dialog open>                               （_dialog 非 null 时）模态 · 全宽
│   └── <mkdir-dialog> | <rename-dialog> | <move-dialog> | <delete-dialog>
├── <drop-zone>                                 display:none !important（移动端隐藏）
└── .toast                                      （_toast 非 null 时）底部居中提示
```

## 4. 布局

### 4.1 `.mobile-layout`

- `display:flex; flex-direction:column; flex:1; min-height:0; position:relative`
- 同一时刻只有当前 `mobilePane` 对应的内容被渲染（tree / list / detail 三选一），其余不渲染 DOM
- 子元素（file-tree / file-list / file-search-results / .mobile-preview）均为 `display:flex; flex-direction:column; flex:1; min-height:0`，保证高度链完整（preview-pane 内的 md-viewer flex:1 不塌陷）

### 4.2 tree pane（mobilePane === "tree"）

- `<file-search-box>`：`flex-shrink:0` 顶部固定
- 搜索激活时 `<file-search-results>`：`flex:1` 占满剩余
- 浏览模式时 `<file-tree>`：`flex:1` 占满剩余，内部 `overflow-y:auto` 独立滚动

### 4.3 list pane（mobilePane === "list"）

- `<file-list ?mobile>`：`flex:1; min-height:0`
- 内部 `display:flex; flex-direction:column`
- `.mobile-header`：`flex-shrink:0` 顶部固定
- `.header-row`：`flex-shrink:0`
- `.rows`：`flex:1; overflow-y:auto`

### 4.4 detail pane（mobilePane === "detail"）

- `.mobile-preview`：`flex:1; min-height:0; display:flex; flex-direction:column`
- 内部 `<preview-pane ?mobile>`：`flex:1` 填满
- preview-pane 内 `.mobile-header`：`flex-shrink:0`
- 内容区：`flex:1; overflow:auto`

### 4.5 移动端 dialog

- `width:calc(100vw - 16px); max-width:calc(100vw - 16px); max-height:calc(100vh - 16px)`
- `min-width:0`（取消桌面 360px 下限）
- 按钮 `.actions`：`flex-direction:column-reverse`，全宽 `width:100%`，`min-height:44px`
- input `font-size:16px`（防 iOS 缩放）

## 5. 元素清单

### 5.1 `<file-search-box>` — 文件名搜索输入

| 元素 | 行为 |
|---|---|
| 🔍 icon | 纯装饰 |
| `<input type="text">` | 受控输入；`disabled` 当文档列表加载失败或为空时；`placeholder` 动态 |
| × 清空按钮 | 仅 `_value` 非空时显示 |

移动端 `file-search-box` 仅在 tree pane（`mobilePane === "tree"`）渲染。返回 tree pane 时通过外部 `value` prop 恢复输入框内容（防重挂载丢失）。

事件：`@search`（detail: `{query}`）/ `@clear`。

### 5.2 `<file-tree>` — 目录树（tree pane 浏览模式）

| 元素 | 行为 |
|---|---|
| `.header` | sticky 顶部「文件」标题 |
| `<tree-node>` × N | 递归渲染根级目录（仅 `is_dir` 项） |

移动端 tree pane 中的 `<file-tree>` 绑定了内联 `@select-dir` 处理器（不同于桌面端 file-tree 自身的 `_onSelectDir`）：点目录 → `selectDir(path)` + `_ensureLoaded(path)` + `expandDir(path)` + **额外 `setMobilePane("list")`** 推入列表面板。

### 5.3 `<tree-node>` — 目录节点（非 readonly）

| 元素 | 行为 |
|---|---|
| ▶ 展开箭头 | 有子目录时可点；展开时旋转 |
| 📁 icon | 纯装饰 |
| `.label` | 目录名，ellipsis |
| `.children` | 展开时递归渲染 |

事件：`@toggle` / `@select-dir`（经 `_relay` 冒泡到 file-tree）。

### 5.4 `<file-list ?mobile>` — 移动模式文件列表

| 区域 | 元素 |
|---|---|
| `.mobile-header` | `←` 返回按钮 + 居中路径文本（ellipsis）+ `⋯` 更多按钮 |
| `.mobile-menu` | 更多按钮展开时的下拉菜单（5 菜单项） |
| `.header-row` | 6 列表头 + 全选 checkbox（无 col-resize） |
| `.rows` | `<file-row>` × N |

### 5.5 mobile-header 更多菜单

| 菜单项 | 条件 | 动作 |
|---|---|---|
| + 新目录 | 始终启用 | 派发 `action{name:"mkdir"}` |
| ⬆ 上传 | 始终启用 | 派发 `action{name:"upload"}` |
| ✎ 重命名 | `selectedPaths.length === 1` 时启用 | 派发 `action{name:"rename"}` |
| → 移动 | `selectedPaths.length >= 1` 时启用 | 派发 `action{name:"move"}` |
| 🗑 删除 | `selectedPaths.length >= 1` 时启用（`.danger`） | 派发 `action{name:"delete"}` |

下拉菜单 `.mobile-menu` 绝对定位在更多按钮下方。点击菜单外任意位置关闭（`document` capture click 监听，排除菜单自身和更多按钮）。

### 5.6 移动 6 列表头（`.header-row`）

| 列序 | 内容 |
|---|---|
| 1 | 全选 checkbox |
| 2 | 空（icon 列） |
| 3 | 「名称」 |
| 4 | 「大小」 |
| 5 | 「修改」 |
| 6 | 空（已索引 badge 列） |

grid 列数从 7 降为 6，`.cell-type` 列 `display:none`，`.col-resize` 全部 `display:none !important`。

### 5.7 `<file-row>` — 文件行（移动 6 列）

| 列 | 内容 |
|---|---|
| checkbox | `checked = selected` |
| icon | 目录 📁 / 文件 type-badge / 📄 |
| name | 文件名，ellipsis |
| size | 文件大小，目录为空 |
| time | 修改时间 |
| indexed | 「已索引」badge |

移动端 `.cell-type` 列 `display:none`（隐藏「类型」列）。行体 `@click` 派发 `activated`。

### 5.8 `<preview-pane ?mobile>` — 移动模式预览

| 子状态 | 渲染 |
|---|---|
| 未选中 | `.empty`「点击左侧结果查看预览」 |
| 加载中 | `.empty`「加载中...」 |
| 正常 | `.mobile-header` + 内容区 |

`.mobile-header`：
- `←` 返回按钮 → 派发 `@back` 事件 → 父组件 `_goBack()`
- 居中文件名（basename，ellipsis）
- `⋯` 更多按钮 → 下拉菜单

`.mobile-menu`（preview-pane 移动端更多菜单）：

| 菜单项 | 条件 | 动作 |
|---|---|---|
| ✏️ 编辑 | `_previewWritable` 时显示 | `enterEdit()` → `_mode="edit"` |
| ⬇️ 下载 | 始终 | 触发原始文件下载 |
| ⬆️ 上传 | 始终 | 打开隐藏 `<input type="file">` → confirm 覆盖 → `uploadPreview` |

内容区按 `language` 分支：markdown preview → `<md-viewer>` / markdown edit → `<md-editor ?mobile>` / html → iframe / 纯文本行号。

### 5.9 `<drop-zone>` — 隐藏

移动端 `:host { display:none !important }`，不监听拖拽，不渲染 overlay。

### 5.10 Dialogs（移动端全宽）

| Dialog | 内容 | 移动差异 |
|---|---|---|
| `<mkdir-dialog>` | 标签 + 输入框 + 错误提示 + 取消/新建 | `min-width:0`；按钮 `column-reverse` 全宽 `min-height:44px`；input `font-size:16px` |
| `<rename-dialog>` | 预填输入框 + 错误提示 + 取消/重命名 | 同上 |
| `<move-dialog>` | 标题 + readonly tree-node 选目录 + 目标路径 + 覆盖 checkbox + 取消/移动 | `.tree max-height:50vh`；按钮 `column-reverse` 全宽 |
| `<delete-dialog>` | loading → 标题 + 警告 + 统计 + 我确定 checkbox + 取消/删除 | 按钮 `column-reverse` 全宽 |

## 6. 交互逻辑

### 6.1 Pane 导航（移动端核心流）

| 流程 | 触发 | 动作 |
|---|---|---|
| tree → list | tree pane 点目录 | `selectDir(path)` + `_ensureLoaded(path)` + `expandDir(path)` + `setMobilePane("list")` |
| list → detail | list pane 点文件行 | `_previewPathWithDirtyCheck(path)` + `setMobilePane("detail")` |
| detail → list | preview-pane mobile-header 返回 | `_goBack()` → `setMobilePane("list")` |
| list → tree | file-list mobile-header 返回 | `_goBack()` → `setMobilePane("tree")` |
| detail → tree（搜索态） | preview-pane 返回 + 搜索激活 | `_goBack()` → `setMobilePane("tree")`（因 `_isFilenameSearchActive` 为 true，跳过 list 回 tree） |

`_goBack()` 逻辑：
- `mobilePane === "detail"` → 若 `_isFilenameSearchActive` 则回 `"tree"` 否则回 `"list"`
- `mobilePane === "list"` → 回 `"tree"`

### 6.2 目录树展开 / 折叠（tree pane）

1. **点箭头 toggle** → `<tree-node>` 派发 `toggle` → file-tree `_onToggle`：已展开 → `collapseDir`；未展开 → `_ensureLoaded` + `expandDir`
2. **点行体** → `<tree-node>` 派发 `select-dir` → files-view 内联处理器：`selectDir` + `_ensureLoaded` + `expandDir` + **`setMobilePane("list")`**（推入 list pane）

### 6.3 文件激活与预览推入

1. list pane 行体单击 → `<file-row>` 派发 `activated`（detail: `{path, is_dir}`）
2. **目录** → `selectDir(path)` + `_ensureLoaded(path)`（停在 list pane，刷新当前目录）
3. **文件** → `_previewPathWithDirtyCheck(path)`：
   - `_previewDirty` → `window.confirm` 确认丢弃
   - `_fetchPreview(path)` → 成功填充 preview state / `notIndexed` → `_previewError="NOT_INDEXED"` / 失败 → toast
4. **`setMobilePane("detail")`** → 推入 detail pane 显示 `<preview-pane ?mobile>`

### 6.4 多选

| 操作 | 行为 |
|---|---|
| checkbox 单击 | `<file-row>` `@checked`（detail: `{path, ctrl, shift}`）→ `selectEntry(path, {ctrl, shift})` |
| ctrl+点击 | 累积切换该 path 的选中态 |
| shift+点击 | 范围选择 |
| 表头全选 checkbox | checked → 合并当前目录 path；unchecked → 剔除当前目录 path |

选中态驱动 mobile-header 更多菜单项的 enable/disable。

### 6.5 文件名搜索

1. tree pane 的 `<file-search-box>` 输入 → 80ms 防抖（IME composition 期间不触发）
2. **空输入** → `_emitClear()` 立即清空 → `_onFilenameClear` → `clearFilenameSearch()` → tree pane 回 `<file-tree>`
3. **非空** → `_onFilenameSearch(query)`：
   - 从 `allDocs` 内存过滤 `name.toLowerCase().includes(q)` → 排序 → 前 100 → `setFilenameSearchQuery` → `isActive=true` → tree pane 切换到 `<file-search-results>`
   - 首结果 → `_previewPathWithDirtyCheck` 预览（但**不自动推入 detail pane**，需用户点击）
4. **键盘导航**（`<file-search-results>` `tabIndex=0`）：
   - ↑/↓ → 选 + 派发 `activated` 联动预览
   - Enter → 派发 `activated`
   - Esc → 派发 `clear`
5. **结果行点击** → `_onFilenameResultActivated`：`_previewPathWithDirtyCheck(path)` + **`setMobilePane("detail")`** → 推入 detail pane

### 6.6 上传（移动端）

1. mobile-header 更多菜单「⬆ 上传」→ `<file-list>` 派发 `action{name:"upload"}` → `_onAction` → `_openFilePicker()`
2. 隐藏 `<input type="file" multiple>` → `click()`
3. `change` → `_uploadFiles(files, currentDir)`：循环 `filesApi.upload` → `invalidateDir` + `_ensureLoaded` → toast 汇总
4. 移动端不支持拖拽上传（`<drop-zone>` 隐藏），上传仅从更多菜单入口

### 6.7 文件操作流

**入口**：list pane 的 mobile-header 更多菜单 → `<file-list>` 派发 `action` → `_onAction`。

#### 6.7.1 新建目录 mkdir

1. `_dialog = "mkdir"` → `<mkdir-dialog>`
2. 校验：空 / 点开头 / 非法字符 / 空白开头 / Windows 保留名
3. 提交 → `_onMkdirSubmit`：`filesApi.mkdir` → `invalidateDir(parent)` + `_ensureLoaded` + `expandDir` → toast

#### 6.7.2 重命名 rename

1. 选中 1 项 → `_dialog = "rename"` → 预填 basename
2. 校验：空 / 名称未变化 / 点开头 / 非法字符 / Windows 保留名
3. 提交 → `_onRenameSubmit`：`filesApi.rename` → `invalidateDir` + `_ensureLoaded` → 若重命名当前预览文件 → 更新 `_previewPath` + `_reloadPreview` → toast

#### 6.7.3 移动 move

1. 选中 ≥1 项 → `_dialog = "move"` → `<move-dialog>`
2. 内嵌 readonly `<tree-node>`（移动端 `.tree max-height:50vh`）
3. 选目标 + 可选覆盖同名
4. 提交 → `_onMoveSubmit`：`filesApi.move` → 批量 `invalidateDir` + `_ensureLoaded` → `clearSelection` → toast

#### 6.7.4 删除 delete

1. 选中 ≥1 项 → `_dialog = "delete"` → `<delete-dialog>` 先 loading-stats
2. 统计加载 → confirming → 勾「我确定」→ 提交
3. `_onDeleteSubmit`：循环 `filesApi.remove` → `invalidateSubtree` + `invalidateDir` + `_ensureLoaded` → 若删预览文件 → 清空 preview state → `clearSelection` → toast

### 6.8 预览编辑闭环（移动端）

1. detail pane 的 `<preview-pane ?mobile>` mobile-header 更多菜单「✏️ 编辑」（仅 writable 时显示）→ `enterEdit()` → `<md-editor ?mobile>`
2. 编辑 → `dirty-change` → `_previewDirty = true`
3. 保存 → `savePreview` → `@saved`（更新内容 + 退出 edit + toast）/ `@save-failed`（toast）
4. 取消 → `@cancel` → `_mode="preview"`
5. **dirty 保护**：切换预览前 `_previewPathWithDirtyCheck` → confirm

### 6.9 上传覆盖（preview-pane）

1. detail pane mobile-header 更多菜单「⬆ 上传」
2. 隐藏 `<input type="file">` → 选文件 → `window.confirm` 确认覆盖 → `uploadPreview(file)`
3. 成功 → `@upload-success`（清 dirty + `_reloadPreview` + toast）/ 失败 → `@upload-failed`（toast）

## 7. 边界态

| 场景 | 表现 |
|---|---|
| 目录为空 | `<file-list>` `.rows` 上方 `.empty`「目录为空」 |
| 搜索无结果 | `<file-search-results>` `.empty`（🔍 + 「未匹配到任何文件名包含 "X" 的文档」） |
| 搜索结果 >100 | 底部 `.overflow-hint`「共 N 项，仅显示前 100，请补充关键字」 |
| 文件未索引 | detail pane 预览区 `.preview-placeholder`（`.not-indexed-hint`）「该文件未索引，无法预览。请先执行 doclens index 后重试。」 |
| 文档列表加载中 | `<file-search-box>` disabled + placeholder 正常 |
| 文档列表为空 | `<file-search-box>` disabled + placeholder「暂无已索引文档」 |
| 文档列表加载失败 | `<file-search-box>` disabled + placeholder「文档列表加载失败」 |
| 目录加载失败 | toast 错误消息 |
| 预览失败 | toast「预览失败」 |
| 上传全失败 | toast lastError |
| 上传部分失败 | toast 汇总 |
| 删除部分失败 | toast 汇总 |
| 移动部分跳过 | toast 汇总 |
| 更多菜单展开时点击其它位置 | 下拉关闭（document capture click 监听） |
