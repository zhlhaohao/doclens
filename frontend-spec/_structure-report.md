# Doclens Web v2 前端结构报告（探索存档）

> 探索阶段产出，供写各页 spec 时参考。范围：`doclens/web_v2/frontend/src/`。
> 技术栈：Lit (Web Components) + 自定义 EventTarget store + hash 路由。
> 单一断点 **1024px**：`<1024` 移动 / `≥1024` 桌面。

## 1. 页面清单（views/）

4 个 view（+ `settings-fields.ts` 字段元数据模块）。每个 view 是顶级自定义元素，由 `<cortex-app>` 的 `.main` 按 `store.view` 切换挂载。

### 1.1 `<search-view>` — 搜索页
文件：`src/views/search-view.ts`

状态机：`store.search.state: "initial" | "focus"`

| 状态 | 触发 | 渲染 |
|---|---|---|
| initial | 启动 / focus-header"新搜索"返回 | `.initial-stack`（flex column）：`<welcome-pane>` + `<history-list>` + `.input-row`（`<input-box>` 带 keyword/grep 分裂按钮） |
| focus（无 detail） | 提交 / 翻页 / 点历史 | `<toast-stack>` + `.focus-body`：`<focus-header back-label="新搜索">` + `.focus-main`（flex row：`.results-col` + `.splitter` + `<preview-pane class="desktop-only">`） |
| focus + detail（移动端） | 结果卡片被点击（`actions.pushDetail`） | 叠加 `.detail-overlay`（absolute inset:0 z-index:10）：第二个 `<focus-header back-label="结果">`（带"编辑"action）+ `<preview-pane ?noHeader>` |
| loading | 搜索/翻页进行中 | 不切换 state；focus-header meta 显"搜索中"；`<search-results ?loading>` 内部 spinner |
| empty | 0 条 | `<search-results>` 内部"无搜索结果" |
| NOT_INDEXED | 预览返回 notIndexed | `.not-indexed-hint` |

搜索模式：`keyword`（默认 `/api/search`）↔ `grep`（`/api/grep`），持久化 `localStorage["cortex.searchMode"]`。input-box 的 caret 下拉切换。历史按 `session.mode` 重放。

sub-state：`_resultsPaneWidth`（splitter 拖动，持久化）、`previewDirty`（编辑脏标记，切换前 confirm 丢弃）。

### 1.2 `<chat-view>` — 对话页
文件：`src/views/chat-view.ts`

状态机：`store.chat.state: "initial" | "focus"`

| 状态 | 触发 | 渲染 |
|---|---|---|
| initial | 启动 / "新对话"返回 | `.initial-stack`：`<welcome-pane suffix="问日程">` + `<history-list type="chat">` + `.input-row`（`<input-box multiline>`） |
| focus（无 preview） | 提交首条 / 点历史 | `<toast-stack>` + `.focus-body`：`<focus-header back-label="新对话">` + `.focus-main`（flex column：`<chat-stream>` 居中限宽）+ `.input-bar`（底部 `<input-box multiline>`） |
| focus + preview（桌面） | 点 AI 回复参考资料链接 | `.focus-main` 加 `has-preview` → flex row：`<chat-stream>` + `.splitter.desktop-only` + `.preview-pane-wrap.desktop-only`（✕ 关闭 + `<preview-pane>`） |
| focus + preview（移动） | 同上 | `.preview-overlay`（absolute inset:0 z-index:10）覆盖：`<focus-header back-label="返回">` + `<preview-pane ?noHeader>` |
| streaming | 等待/接收流式 | `.input-bar` input-box `?disabled`；末条 assistant content 逐 token 增长；空 content 显"思考中..." |
| stream interrupted | 连接断/异常 | `finalizeInterruptedMessages`：残留 running 工具步骧标 error，output="（已中断）" |

sub-state：`previewOpen` / `previewContent` / `previewDirty` / `_previewPaneWidth`。

### 1.3 `<settings-view>` — 设置页
文件：`src/views/settings-view.ts`（+ `settings-fields.ts`）

无 focus 状态机——始终渲染完整布局，内嵌状态：

| 状态 | 表现 |
|---|---|
| loading | `_load()` 中；字段未填充 |
| loaded/clean | footer-bar"所有字段与 .env 一致" |
| dirty | 任意字段改；footer-bar dirty-dot + "有 N 个字段已修改" |
| saving | 保存按钮 disabled，"保存中…" |
| saved (toast) | footer-bar 成功消息（桌面）或 toast（移动） |
| error | footer-bar 红字（桌面）或 toast + 字段级红字（移动） |

桌面布局：`.layout`（flex row）= `.sidebar`（固定 180px：`<settings-scope-segment>` + 垂直 `.tab-strip`）+ `.main`（flex 1：`.scroll-area` + `.footer-bar` 固定底部）。

4 个 tab：`ai`（5 字段，需重启）/ `search`（7 字段，即时）/ `scoring`（5 slider，即时）/ `terminal`（3 字段，仅 CLI）。所有 tab-panel 同时 DOM，`.tab-panel.active` display 切换。

特殊：
- `PLANIFY_PROVIDER` 切换已知预设联动填 base_url + protocol（除非 `_userEditedBaseUrl`）
- 保存消息按 `result.needs_restart` 区分"重启生效"vs"即时生效"
- 全局事件 `cortex:save-settings` / `cortex:revert-settings`（来自 app-bar）触发 `_save()` / `_revert()`
- `_loadGen` 代际计数器防 stale load

### 1.4 `<files-view>` — 文件浏览器
文件：`src/views/files-view.ts`

无统一状态机——`_isMobile` 二分渲染：

桌面 `_renderDesktop()`：`.desktop-layout`（CSS Grid 5 列）：
```
.tree-pane | splitter | (file-list 或 file-search-results) | splitter | .preview-col
```
- `.tree-pane` = `<file-search-box>` + `<file-tree>`
- 中栏：`_isFilenameSearchActive` 时 `<file-search-results>` 否则 `<file-list>`
- `.preview-col` = `<preview-pane>` 或 `.preview-placeholder` 或 `.not-indexed-hint`
- 两 splitter 可拖动，中间栏最小 300px

移动 `_renderMobile()`：`.mobile-layout`（flex column，单 pane 栈），`store.files.mobilePane: "tree"|"list"|"detail"` 控制：

| mobilePane | 渲染 | 后退 |
|---|---|---|
| tree | `<file-search-box>` +（搜索激活时 `<file-search-results>` 否则 `<file-tree>`） | — |
| list | `<file-list ?mobile>`（自带 mobile-header：返回/路径/更多菜单） | tree |
| detail | `.mobile-preview` 包 `<preview-pane ?mobile>`（mobile-header） | list |

导航：tree 点目录 → selectDir + setMobilePane("list")；list 点文件 → 预览 + setMobilePane("detail")；detail `<preview-pane @back>` → list。

Dialog：`_dialog: "mkdir"|"rename"|"move"|"delete"|null`，渲染 `<dialog open>`。

`<drop-zone>` 始终渲染，移动端 `display:none !important`。

## 2. 组件清单（components/）

| 组件 | 职责 |
|---|---|
| `<app-bar>` | 顶栏 56px：品牌 / 保存按钮（settings dirty）/ 移动刷新按钮 / 头像下拉菜单（全局配置/强制重建索引/放弃修改） |
| `<activity-bar>` | **桌面独占**左侧 36px 图标竖条，3 导航按钮（search/chat/files） |
| `<tab-bar>` | **移动独占**底部水平标签栏，3 tab |
| `<focus-header>` | view 内头部：圆形返回 + 居中标题（ellipsis）+ meta + 可选 kebab 更多菜单 |
| `<welcome-pane>` | initial 态欢迎头：标题 + 副标题 + 系统状态区 |
| `<input-box>` | 通用输入：单行/多行（自动扩充）+ 提交按钮；可选 keyword/grep 分裂按钮 |
| `<history-list>` | 历史会话列表容器：标题 + 清空 + `<history-item>` 列表或空态 |
| `<history-item>` | 单条历史：标题（grep mode-tag）+ meta（消息数/日期） |
| `<search-results>` | 结果列表容器：loading / 空态 / `<result-card>` 列表 |
| `<result-card>` | 单条命中：路径（badge+行号）+ markdown snippet + 评分% |
| `<preview-pane>` | 文件预览主体：按 language 分支（md→viewer/editor / html→iframe / 纯文本行号），下载/上传按钮，移动端独立 mobile-header |
| `<pagination-bar>` | 分页：页码信息 + 按钮组（省略号折叠）+ 上/下页 |
| `<chat-stream>` | 消息流容器：flex column + auto-scroll，空态 |
| `<chat-message>` | 单条气泡：user（右纯文本）/ assistant（左 markdown），可选 tool-trace + 参考资料 + error |
| `<chat-tool-trace>` | 工具调用思考过程：可折叠摘要 + 步骤列表（running 旋转/done ✓/error ✗）+ 复制 + 单步展开 |
| `<file-tree>` | 目录树容器：sticky header + 递归 `<tree-node>`（仅目录） |
| `<tree-node>` | 递归目录节点：展开箭头 + 📁 + 名 + 子节点（事件 relay），readonly 模式派发 pick-dir |
| `<file-list>` | 文件表格中栏：面包屑+上级 / 工具栏（mkdir/上传/重命名/移动/删除）+ 可调列宽表头 + `<file-row>`；移动 mobile-header |
| `<file-row>` | 单行文件：grid（checkbox + 类型 badge + 名 + 大小 + 时间 + 已索引 badge + 类型），行体单击=激活，checkbox=多选 |
| `<file-search-box>` | 文件名搜索：80ms 防抖 + IME + Esc/× 清空 |
| `<file-search-results>` | 文件名搜索结果：header + 列头 + 行（高亮+目录+大小+时间），↑↓/Enter/Esc 键盘导航，>100 显 overflow-hint |
| `<md-viewer>` | Markdown 渲染：marked + 自定义 block renderer（注入 data-source-line）+ 行定位闪烁 + 关键词高亮（TreeWalker）+ 分页模式（PDF/PPTX/XLSX 多 page-card） |
| `<md-editor>` | Markdown 编辑器：toolbar（路径/dirty/error/保存/取消）+ 行号 + textarea，Ctrl+S，dirty 事件 |
| `<drop-zone>` | 全屏拖拽上传 overlay：window dragenter/over/leave/drop，仅 files 类型，移动 display:none |
| `<toast-stack>` | Toast 栈：fixed 右下，push/dismiss，自动消失 |
| `<reindex-dialog>` | 强制重建索引模态：4 状态（confirm/running/done/error），SSE 进度，fixed 居中 |
| `<mkdir-dialog>` | 新建目录：名称 + 非法字符/保留名校验 + Enter |
| `<rename-dialog>` | 重命名：预填 + "名称未变化"校验 + 非法字符 |
| `<move-dialog>` | 移动：内嵌 readonly `<tree-node>` 选目录 + 覆盖同名 checkbox |
| `<delete-dialog>` | 删除确认：先异步加载 stats（文件数/子目录/大小）→ 统计 + "我确定" checkbox + 删除中态 |
| `<settings-scope-selement>` | 配置作用域切换器（当前仅"🌍 全局"pill，local 已禁用） |

## 3. 顶层布局（app.ts）

```
<cortex-app>                       :host flex column, 100dvh, overflow:hidden
├── <app-bar>                      flex-shrink:0, 56px, z-index:50
├── <div class="app-body">         flex:1, display:flex
│   ├── <activity-bar>             桌面:flex / 移动:none
│   ├── <div class="main">         flex:1, flex column, min-width:0, position:relative
│   │   └── _renderView()
│   └── <tab-bar>                  桌面:none / 移动:flex
└── <reindex-dialog>
```

桌面：`.app-body` flex-row（activity-bar 左 + main 中 + tab-bar none）。
移动：`.app-body` flex-column（activity-bar none + main 满 + tab-bar 底）。

## 4. 导航与路由

`src/router/route-map.ts` + `router.ts`：
- hash 路由 4 条：`#/search|chat|files|settings`
- URL 是 view 唯一真相源；`actions.setView()` 只由 router 调
- `router.init()`：replaceState 规范化初始 hash → 订阅 hashchange → 同步 store
- `router.navigate(view)`：`location.hash = hash` → hashchange → setView
- settings scope 不进 URL（store 同步）
- 默认视图 search

导航协作：
```
点击导航元素 → 派发 navigate 事件 → cortex-app._navigate
  → router.navigate(view) → hash 变 → onHashChange → actions.setView → store 变 → 重渲染
  → if settings && scope: setSettingsScope
```

桌面 vs 移动导航元素：
| 元素 | 桌面 | 移动 |
|---|---|---|
| activity-bar | 显示（左侧 36px 竖条） | 隐藏 |
| tab-bar | 隐藏 | 显示（底部水平） |
| app-bar 刷新按钮 | 隐藏 | 显示（圆形，location.reload） |
| 导航项 | search/chat/files（settings 从头像菜单） | 同 |

## 5. 响应式差异矩阵

全局断点变量（`src/styles/breakpoints.css`）：
| 变量 | 移动 | 桌面 |
|---|---|---|
| --cortex-show-activity-bar | none | flex |
| --cortex-show-tab-bar | flex | none |
| --cortex-fs-* 字号 | 较大 | 缩小 |

各组件差异：

### cortex-app
| 维度 | 桌面 | 移动 |
|---|---|---|
| .app-body 方向 | flex-row | flex-column |

### app-bar
| 元素 | 桌面 | 移动 |
|---|---|---|
| .refresh-btn | display:none | display:inline-flex（圆形，旋转动画） |

### activity-bar / tab-bar
| 维度 | 桌面 | 移动 |
|---|---|---|
| 可见性 | activity-bar 可见 / tab-bar 隐藏 | activity-bar 隐藏 / tab-bar 可见 |
| 布局 | activity-bar flex column 36px 宽 | tab-bar flex row 固定高 |

### welcome-pane
| 维度 | 桌面 | 移动 |
|---|---|---|
| 内容结构 | 无变化 | 无变化 |

### input-box
| 维度 | 桌面 | 移动 |
|---|---|---|
| --min-h | 48px | 44px |

### search-view
| 维度 | 桌面 | 移动 |
|---|---|---|
| .initial-stack | max-width:720px 居中 | 全宽 |
| .focus-main | flex row：results-col + splitter + preview-pane 并排 | flex row 不变，splitter none，preview-pane(.desktop-only) none |
| .results-col | flex 0 0 var(--results-pane-width) 固定可调 | flex:1 占满 |
| .splitter | block 可拖动 | none |
| 预览 | 右侧常驻 `<preview-pane desktop-only>` | 点击结果 → pushDetail → .detail-overlay 全屏覆盖（第二 focus-header "结果"） |
| .focus-body.is-covered | 不存在 | pointer-events:none |
| 桌面独占行为 | _autoPreviewFirstDesktop 搜索后自动预览首条 | 不自动预览 |

### chat-view
| 维度 | 桌面 | 移动 |
|---|---|---|
| .initial-stack | max-width:760px 居中 | 全宽 |
| .input-bar | max-width:820px 居中 | 全宽 |
| .focus-main:not(.has-preview) | chat-stream max-width:820px 居中 | 全宽 |
| .focus-main.has-preview | flex-row + padding：chat-stream + splitter + preview-pane-wrap | 维持 column，splitter/preview-pane-wrap/desktop-only 全 none |
| 预览 | 右侧并排 .preview-pane-wrap（✕ 关闭） | .preview-overlay 全屏覆盖（focus-header "返回"） |
| .splitter (desktop-only) | 可拖动 | none |

### settings-view
| 维度 | 桌面 | 移动 |
|---|---|---|
| .layout | flex row：sidebar 左 + main 右 | flex column：sidebar 上 + main 下 |
| .sidebar | 180px 固定，垂直 scope-segment + tab-strip | 100%，水平 scope + 水平滚动 tab-strip，border 底 |
| .tab-strip | flex column，左 border 指示 active | flex row + overflow-x:auto，底 border 指示 active，nowrap |
| .copy-banner | none | flex（顶部"正在编辑全局配置"） |
| .field grid | minmax(220px,280px) 1fr（label+control 并排） | 1fr（上下堆叠） |
| .footer-bar | 显示（dirty + 放弃/保存） | none（保存/放弃由 app-bar） |
| .scroll-area | overflow-y:auto 内部滚动 | overflow:visible 整体滚动 |
| slider 控件 | number input + range 并排 | number 隐藏，只 range + value-chip |
| password"显示"按钮 | 绝对定位 input 右内 | 独立一行 static |
| 错误提示 | footer-bar 红字 | toast + 字段级红字 |
| toast-stack 位置 | 右下 | 底部上移避 tab-bar |
| dialog 按钮 | 水平 flex-end | 垂直 column-reverse 全宽 min-height 44px |

### files-view
| 维度 | 桌面 | 移动 |
|---|---|---|
| 渲染入口 | _renderDesktop() | _renderMobile() |
| .desktop-layout | CSS Grid 5 列 | none |
| .mobile-layout | none | flex column 按 mobilePane 切单 pane |
| 导航模型 | 三栏并排（tree 左常驻 / 中列表 / 右预览） | 三 pane 线性栈 tree→list→detail |
| file-tree 行为 | 点目录 → selectDir + ensureLoaded + expandDir | 同 + setMobilePane("list") |
| file-list | 桌面：面包屑+上级/工具栏/col-resize/7 列 | ?mobile：mobile-header，6 列（隐藏"类型"），无 col-resize |
| file-row | 7 列 grid | 6 列（cell-type none） |
| preview-pane | noHeader=false | ?mobile（mobile-header） |
| drop-zone | 全屏拖拽 overlay | none !important |
| 上传入口 | 工具栏按钮 / drop-zone | mobile-header 更多菜单 |
| 文件操作入口 | 工具栏按钮 | mobile-header 更多菜单 |
| dialog | min-width:360px | width:calc(100vw-16px)，按钮全宽 column-reverse |

### md-viewer（次级断点 768px）
| 维度 | 宽屏 | 窄屏 <768 |
|---|---|---|
| :host padding | 20px 16px | 12px 8px |
| .md-body/.page-card padding | 28px 36px | 18px 16px |

### 各 dialog（mkdir/rename/move/delete/reindex）
| 维度 | 桌面 | 移动 |
|---|---|---|
| :host min-width | 360px | 0 |
| dialog 尺寸 | min-width:360px max-width:90vw | width:calc(100vw-16px) |
| .actions | flex row flex-end | column-reverse 全宽 min-height 44px |
| input font-size | 继承 | 16px（防 iOS 缩放） |

### 行为差异汇总
| 行为 | 桌面 | 移动 |
|---|---|---|
| 导航 | activity-bar 图标 | tab-bar 底部 tab |
| settings 保存 | footer-bar 按钮 | app-bar 头像菜单 + 💾 按钮；toast |
| 文件上传 | 工具栏 + drop-zone | 仅 mobile-header 更多菜单 |
| 搜索预览 | 自动预览首条 + 右侧常驻 | pushDetail → 整页 overlay |
| 对话预览 | 右侧并排 + ✕ | 全屏 overlay + focus-header 返回 |
| 文件浏览器 | 三栏并排即时预览 | 三 pane 线性栈 |
| 页面刷新 | 浏览器原生 | app-bar 圆形刷新按钮 |
| hover | 大量 :hover | 无（依赖 :active） |
| 列宽调整 | splitter + col-resize | 全禁用 |
| 拖拽上传 | 支持 | 不支持 |

## 6. 关键交互流

### 6.1 搜索提交（search-view）
1. input-box 输入 + 搜索按钮/Enter
2. `_submit()` 重置 preview + detailStack，切 focus 态
3. 按 searchMode 调 searchApi/grepApi（offset=0 limit=20）
4. 更新结果 + **桌面自动预览首条**（不 pushDetail）
5. 后台 findOrCreateSession（去重写历史），更新 currentSession + 刷新历史
6. 失败 → setError

模式切换：input-box caret → 向上菜单 → 持久化 + placeholder 更新。
翻页：pagination-bar @page-change → _goToPage → 重查 → 清 preview。
结果选中：result-card @select → pushDetail + _fetchAndShowPreview（有 line 且非 full → line±10/+20 片段；否则全文；二进制用 result.lineMap 换算）。
dirty 保护：切换 preview 前 _safeAction → previewDirty 则 confirm。

### 6.2 AI 对话流式（chat-view）
1. input-box 输入，Enter 发送（Shift+Enter 换行）
2. `_submit()`：initial 先 createSession；追加 user + 空 assistant；streaming:true input disabled
3. `for await (ev of chatStream)`：token/tool_call/tool_result/references/error/done → applyStreamEvent 不可变更新
4. 结束 appendSession 持久化 + 刷新历史
5. 异常 finalizeInterruptedMessages + setError；finally streaming:false

参考资料点击：chat-message @reference-click → _normalizeReferencePath → fetchPreview → 桌面 preview-pane-wrap / 移动 preview-overlay。
chat-tool-trace 自动展开：有步骤 running 时 _expanded=true；全完成 _expanded=false。

### 6.3 设置保存/放弃/热重载（settings-view）
1. 加载：connectedCallback → _load() → getConfig(scope) → 填 _values/_original/_exists
2. 编辑：@input → _onInput：PLANIFY_PROVIDER 预设联动（除非 _userEditedBaseUrl）；其他直接 _updateValues + updateSetting
3. 保存：桌面 footer-bar/app-bar 💾 / 移动 app-bar 💾 → cortex:save-settings → _save() → putConfig：成功更新 _original + 按 needs_restart 区分消息；失败 ConfigApiError → 桌面 footer 红字 / 移动 toast + 字段级 _fieldErrors
4. 放弃：footer-bar/app-bar 头像菜单 → cortex:revert-settings → _revert() 复位
5. scope 切换：scope-segment @scope-change → setSettingsScope → _load() 重载

字段 effect 标记：effect:"live"|"restart" → badge（● 即时 / 🔁 需重启）。

### 6.4 文件树/选中/预览（files-view）
1. 首次：connectedCallback → _ensureLoaded("") → expandDir("")
2. 展开/折叠：点箭头 toggle → 已展开 collapseDir / 未展开 ensureLoaded + expandDir；点行体 select-dir → selectDir + ensureLoaded + expandDir；移动额外 setMobilePane("list")
3. 文件列表：行体单击 activated → 目录=进入 / 文件=预览；checkbox checked → selectEntry(ctrl/shift 多选/范围)；表头全选 → 合并/剔除当前目录
4. 预览：_previewPathWithDirtyCheck → _fetchPreview → fetchPreview API；NOT_INDEXED 设 _previewError；移动额外 setMobilePane("detail")
5. 列宽（桌面）：表头 col-resize → _makeColResizeHandler → _colWidths → --col-N → localStorage

文件操作（mkdir/rename/move/delete/upload）：
- 触发：工具栏/移动更多菜单 → _onAction(name) → _dialog → `<dialog open>`
- mkdir：mkdir API → invalidateDir + ensureLoaded + expandDir
- rename：rename API → invalidateDir + ensureLoaded + 如重命名当前预览则更新 previewPath + reload
- move：move(sel, destDir, overwrite) → 批量 invalidate + clearSelection
- delete：remove 循环 → invalidateSubtree + invalidateDir(parent) + 如删预览文件则清空
- upload：_openFilePicker（隐藏 input multiple）→ upload 循环 → invalidateDir + ensureLoaded

### 6.5 强制重建索引（reindex-dialog）
1. 入口：app-bar 头像菜单 → openReindexConfirm → dialog=confirm
2. 确认 → startReindex → running + _runReindex()
3. SSE：progress → setReindexProgress；done → finishReindex + toast；error → failReindex
4. 关闭（后台继续）→ abort + closeReindex
5. watch-polling：startWatchPolling 每 5s 拉 watch/status；last_reindex_at 变 → cortex:watch-reindexed → app-bar toast + 刷新 getStatus → welcome-pane 状态区更新

### 6.6 跨视图会话加载
store.pendingSession：search/chat 的 connectedCallback 检查，匹配本类型则消费。

### 6.7 预览编辑（preview-pane + md-editor）
1. preview-pane header"✏️ 编辑" / 移动更多菜单"编辑" → enterEdit → _mode=edit
2. md-editor：toolbar + 行号 + textarea
3. 编辑 → dirty-change → 父 view previewDirty=true
4. Ctrl+S/保存 → save 事件 → savePreview API：成功更新 content + 退出 edit + saved → 父 toast；失败 setError + save-failed
5. 取消 → discard 复位
6. 外部 dirty 保护：父切换 preview 前 confirm → preview-pane.discard()

### 6.8 文件名搜索（files-view）
1. file-search-box 输入 → 80ms 防抖（IME 期间不触发）→ search 事件
2. 空 → clear → clearFilenameSearch → 中栏 file-list
3. 非空 → _onFilenameSearch：allDocs 内存过滤 name.includes + 排序 + 前 100 → setFilenameSearchQuery → 中栏 file-search-results
4. 首结果自动 _previewPathWithDirtyCheck
5. 键盘：↑↓ 选 + 联动预览，Enter 激活，Esc 清空
6. file-search-results 行点击 → _onFilenameResultActivated → 预览 + 移动 setMobilePane("detail")

## 附：文件索引

- 核心：`src/app.ts`、`src/main.ts`
- 路由：`src/router/route-map.ts`、`src/router/router.ts`
- 状态：`src/state/types.ts`、`src/state/store.ts`
- 轮询：`src/watch-polling.ts`
- Views：`src/views/search-view.ts`、`chat-view.ts`、`settings-view.ts`、`files-view.ts`、`settings-fields.ts`
- Components：`src/components/` 下 30 个组件
- 样式：`src/styles/breakpoints.css`、`global.css`、`tokens.css`
