# 搜索页（search-view）桌面端设计 Spec

> 视口 ≥1024px。本 spec 只写桌面端结构 / 布局 / 交互，不含视觉样式（颜色、字体、字号、间距数值、渐变、阴影、圆角、像素值）。

## 1. 路由与入口

- 路由 hash：`#/search`（应用默认视图）
- 进入方式：
  - 应用启动时默认挂载
  - activity-bar（左侧竖条）search 图标点击 → navigate 事件 → router.navigate
  - 从 history-view 点历史条目 → `store.pendingSession`（type=search）→ search-view connectedCallback 消费 → `_loadSession`
  - 其他视图通过 hash 切回

## 2. 状态机

主状态 `store.search.state: "initial" | "focus"`

| 状态 | 触发条件 | 渲染区域 |
|------|---------|---------|
| initial | 启动 / focus-header「新搜索」返回 | `.initial-stack`（居中限宽） |
| focus | 提交搜索 / 翻页 / 点击历史条目 | `.focus-body`（focus-header + `.focus-main` 三栏并排） |

桌面端不存在 detail overlay：`.detail-overlay` 在 ≥1024px 时 `display:none`，`detailStack` 虽会更新（用于 activeResult 高亮）但不触发覆盖层。

子状态：
- `_resultsPaneWidth`：结果列宽度，splitter 拖动改变，持久化 localStorage（key: `cortex.resultsPaneWidth`），值 clamp 在允许的最小 / 最大范围内
- `previewDirty`：预览面板编辑脏标记
- `loading`：搜索 / 翻页进行中（不切换 state）
- `previewError`：`null` 或 `"NOT_INDEXED"`
- `searchMode`：`"keyword"`（默认，调 `/api/search`）或 `"grep"`（调 `/api/grep`），持久化 localStorage（key: `cortex.searchMode`）
- `historySessions`：最近 20 条搜索会话

## 3. 构件树

```
<search-view>                                    :host flex column, flex:1
├── [initial] .initial-stack                     flex column, flex:1, 居中限宽
│   ├── <welcome-pane>                           heading="Doclens" subheading="结构感知文档检索"
│   ├── <history-list type="search">             标题"历史会话"
│   │   └── <history-item> × N                   grep 模式带 mode-tag
│   └── .input-row                               flex-shrink:0
│       └── <input-box>                          单行，keyword/grep 分裂按钮 + caret 向上下拉
├── [focus] <toast-stack>                        fixed 通知栈
├── [focus] .focus-body                          flex column, flex:1
│   ├── <focus-header back-label="新搜索">       title=query, meta=结果数 / 搜索中
│   └── .focus-main                              flex row, flex:1
│       ├── .results-col                         flex 0 0 <results-pane-width>, 固定可调
│       │   ├── <search-results>                 flex:1（填充剩余高度）
│       │   │   └── <result-card> × N
│       │   └── <pagination-bar>                 仅 total > limit 时渲染
│       ├── .splitter                            可拖动分隔条, role=separator
│       └── <preview-pane class="desktop-only">  或 .not-indexed-hint.desktop-only
```

## 4. 布局（仅桌面端）

`:host` 为 flex column，占满 `<cortex-app>` 的 `.main` 区域（flex:1, min-height:0）。

### initial 态

`.initial-stack`：flex column, flex:1, min-height:0。**居中限宽**（max-width 约束 + margin:0 auto），避免全宽拉伸。
- `welcome-pane` 顶部。
- `history-list` 中间弹性占满（flex:1）。
- `.input-row`：flex-shrink:0，固定底部。

### focus 态

`.focus-body`：flex column, flex:1, min-height:0。

- `focus-header`：固定顶部，flex-shrink:0。
- `.focus-main`：**flex row**, flex:1, min-height:0。水平排列三个区域：
  1. `.results-col`（flex:`0 0 var(--results-pane-width)`，**固定宽度可拖动调整**，有最小 / 最大宽度约束）：内部 flex column：
     - `search-results`：flex:1（`!important` 覆盖子组件默认 `flex:0 0 auto`），占满剩余高度，内部纵向滚动。
     - `pagination-bar`（可选）：flex-shrink:0，底部。
  2. `.splitter`（flex:`0 0 4px`，cursor:col-resize）：两区域之间的拖动分隔条。
  3. `<preview-pane class="desktop-only">` 或 `.not-indexed-hint.desktop-only`：flex:1 占满剩余宽度。

## 5. 元素清单

### initial 态

| 元素 | 本页角色 / 行为 |
|------|----------------|
| `<welcome-pane>` | 标题「Doclens」+ 副标题「结构感知文档检索」+ 系统状态区（工作目录 / 文档数 / 索引大小 / 监控状态 / 上次重建 / 文件类型分布）。订阅 `store.status + store.watcher`。 |
| `<history-list>` | 标题「历史会话」，type=search。展示最近 20 条搜索会话。`<history-item>` 标题（grep 模式带 mode-tag）+ meta（日期）。@select → 按历史 session.mode 重放搜索。@clear → 清空搜索历史。 |
| `<input-box>` | 单行输入。带 keyword/grep **分裂按钮**（主按钮标签随模式：「搜索」/「grep」）+ caret **向下上展开**的模式选择菜单。placeholder 随模式变化（keyword → 关键词提示，grep → 正则提示）。loading 时 disabled。@submit / @mode-change / @input-change。 |

### focus 态

| 元素 | 本页角色 / 行为 |
|------|----------------|
| `<toast-stack>` | 全局通知栈。保存成功 / 失败、上传成功 / 失败等 toast。 |
| `<focus-header>` | back-label「新搜索」，title=搜索查询文本（ellipsis 截断），meta=动态文本（见下）。@back → 返回 initial 态。无 actions（桌面端编辑入口在 preview-pane 自带 header）。 |
| `<search-results>` | 结果列表容器。props: `results`, `loading`, `activeResult`（来自 detailStack 顶部，引用比较）。内部三种态：loading+空→spinner；非loading+空→「无搜索结果」；有结果→result-card 列表。纵向滚动。 |
| `<result-card>` | 单条命中。显示：路径行（路径命中时显「路径」badge + 路径 + `:行号`）+ markdown snippet（marked 渲染）+ 评分百分比。`active` 属性（引用比较）控制高亮。click → 派发 select 事件。hover 边框反馈。 |
| `<pagination-bar>` | 仅 `total > limit` 时渲染。显示「共 N 条 · 第 X/Y 页」+ 页码按钮组（省略号折叠：totalPages≤7 全显，否则首尾固定 + 当前页±1 + …）+ 上/下页按钮。loading 时全部 disabled。@page-change → 翻页。 |
| `.splitter` | role=separator, aria-orientation=vertical, aria-label「调整搜索结果栏宽度」。mousedown 启动拖动（document mousemove/mouseup），mousemove 实时更新 `_resultsPaneWidth`（clamp 到 min/max），mouseup 持久化 localStorage。hover / active 视觉反馈。 |
| `<preview-pane class="desktop-only">` | 文件预览主体（≥1024px 可见）。按 language 分支渲染：markdown → md-viewer（查看）/ md-editor（编辑）；html → iframe；纯文本 → 行号文本。自带 header（路径 + 下载 / 上传 / 编辑按钮）。props: path, language, content, line（定位行）, keyword（高亮关键词）, writable, pages。事件：@dirty-change / @saved / @save-failed / @upload-success / @upload-failed。 |
| `.not-indexed-hint.desktop-only` | 预览返回 NOT_INDEXED 时的占位提示（「该文件未索引，无法预览」）。替代 preview-pane 位置。 |

### focus-header meta 文本规则

- `loading === true` → 「搜索中」
- `loading === false` + `source === "fts"` → 「N 条结果」
- `loading === false` + `source !== "fts"` → 「N 条结果 (SOURCE)」（SOURCE 为 GREP / RIPGREP 等大写）

## 6. 交互逻辑

### 6.1 搜索提交

1. input-box 输入文本 → 搜索按钮 click 或 Enter → @submit（detail: `{ value: trimmed }`）
2. `_submit()`（经 `_safeAction` 包裹，若 previewDirty 则先 confirm 丢弃）：
   - 重置 preview 状态（previewContent/previewPath/previewError/previewPages 全清）+ 清空 `detailStack`
   - 切换到 focus 态（先清空 results/total/offset，避免显示旧结果）
   - `loading=true`
   - 按 searchMode 调 API（offset=0, limit=20）：keyword → `searchApi({query})` / grep → `grepApi({pattern})`
   - 成功 → 更新 results/total/queryWords/source/offset
   - **桌面自动预览首条**：`_autoPreviewFirstDesktop` 检查 `window.innerWidth >= 1024 && results.length > 0`，满足则 fire-and-forget 调 `_fetchAndShowPreview(results[0])`。**关键：不调 `actions.pushDetail`**（detailStack 是移动端 overlay 触发器，桌面 push 后窗口缩窄会误弹 overlay）。首条卡片不高亮（activeResult 为 null），用户点击后才走 pushDetail + 高亮。
   - 后台 findOrCreateSession（去重写历史）→ 更新 currentSession + 重新加载历史列表（不阻塞 UI）
   - 失败 → `actions.setError("搜索失败: ...")`
   - finally → `loading=false`

### 6.2 搜索模式切换（keyword ↔ grep）

- 仅在 initial 态可用（focus 态无 input-box，需返回 initial 才能切换）
- input-box caret 按钮 → 向上展开模式菜单 → 选择模式
- @mode-change → 更新 `searchMode` + 持久化 localStorage（key: `cortex.searchMode`）
- 主按钮标签更新（搜索 / grep）+ placeholder 更新（关键词 / 正则表达式）
- 历史重放：`_loadSession` 按 `session.mode` 自动切换引擎（grep → grepApi，否则 searchApi）+ 同步 searchMode + 持久化

### 6.3 翻页

- pagination-bar @page-change（detail: `{ page }` 1-indexed）→ `_goToPage(page)`
- 计算新 offset = `(page-1) * limit`；与当前 offset 相同则 no-op
- `loading=true`，按 searchMode 调 API（offset=newOffset, limit=当前 limit）
- 成功 → 更新 results/total/offset/source（用后端 clamp 后的 offset）
- **翻页后清空 preview**（previewContent/previewPath/previewLine 全清），避免显示前一页的高亮定位
- 失败 → setError「翻页失败: ...」
- finally → loading=false

### 6.4 结果选中与预览

- result-card click → @select（detail: `{ result }`）→ `_onResultSelect`（经 `_safeAction`）
- `actions.pushDetail(r)` → 更新 detailStack（桌面端仅用于 activeResult 高亮，不触发 overlay）
- `_fetchAndShowPreview(r)`：
  - 判断预览范围：若 `r.line != null && !isFullFilePreview(r.path)` → **范围预览**（line-10 ~ line+20，专用 fetch，`start_line`/`end_line` 参数）
  - 否则 → **全文预览**（`fetchPreview(r.path)`）
  - 成功 → 设置 previewContent/previewPath/previewLanguage/previewWritable/previewPages
  - 行号定位：`r.line` 为 null 时不定位；非 null 时，二进制合成预览（docx/pdf/xlsx/csv）用 `result.lineMap` 把 `r.line` 换算为 md 实际行号（映射不到返回 null，md-viewer 不滚动）；普通文本预览 lineMap 为 null，`r.line` 即文件实际行号，直接使用
  - NOT_INDEXED → 设置 `previewError="NOT_INDEXED"`，清空 previewContent，preview-pane 替换为 not-indexed-hint

### 6.5 列宽调整（splitter 拖动）

- splitter mousedown → preventDefault → 记录 startX + startWidth
- document.body 设置 cursor=col-resize + userSelect=none（拖动期间全局禁选）
- document mousemove → dx = clientX - startX → `w = clamp(min, max, startWidth + dx)` → 更新 `_resultsPaneWidth`（Lit 响应式重渲染 `.focus-main` 的 `--results-pane-width` CSS 变量）
- document mouseup → 移除 document 监听 → 恢复 cursor + userSelect → 持久化 `_resultsPaneWidth` 到 localStorage（key: `cortex.resultsPaneWidth`）
- connectedCallback 时 `_loadResultsPaneWidth` 从 localStorage 恢复（NaN / 越界则用默认值）

### 6.6 预览编辑保护（previewDirty）

- preview-pane 进入编辑 → @dirty-change（detail: `{ dirty: true }`）→ `previewDirty=true`
- `_safeAction` 包裹所有可能丢失编辑的操作：新搜索、返回 initial、翻页、结果选中、清空历史
- previewDirty 时触发 `window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？")`：
  - 确认 → `_discardPreviewEdits()`（调用 preview-pane.discard() 退出编辑 + 复位内容）→ `previewDirty=false` → 继续原操作
  - 取消 → 中止操作（return）
- 编辑保存成功 → @saved → `previewDirty=false` + toast「已保存」
- 编辑保存失败 → @save-failed → toast「保存失败：...」
- 上传成功 → @upload-success → `previewDirty=false` + toast「已覆盖：...」+ `_reloadPreview`（重新拉取全文预览，因上传是外部覆盖，PUT 不含新内容）
- 上传失败 → @upload-failed → toast「上传失败：...」

### 6.7 历史会话

- initial 态 history-list @select（detail: `{ session }`）→ `_loadSession(session)`
  - 按 `session.mode` 设置 searchMode + 持久化 localStorage
  - 调 `_submit(session.title)` 重放搜索
- history-list @clear → `_onClearHistory`（经 `_safeAction`）→ `_clearing=true` → clearSessions("search") API → 清空 `historySessions` → `_clearing=false`
- 跨视图加载：connectedCallback 检查 `store.pendingSession`，type=search 则消费（`actions.setPendingSession(null)` + `_loadSession`）

### 6.8 返回 initial

- focus-header @back → `_backToInitial`（经 `_safeAction`）
- 重置 search state：state=initial, currentSession=null, results=[], query="", queryWords=[]
- 清空 localQuery → 重新加载历史（`_loadHistory`）

## 7. 边界态

| 边界态 | 触发条件 | 表现 |
|--------|---------|------|
| loading（搜索中） | 搜索 / 翻页进行中 | state 不切换；focus-header meta 显「搜索中」；search-results 在 `loading && results.length===0` 时显 spinner 文案「搜索中」；loading 且已有结果时保持旧结果 |
| empty（无结果） | 搜索完成，results 为空 | search-results 显「无搜索结果」；preview-pane 区域空白（previewContent=""），不自动预览 |
| error（搜索/翻页失败） | API 异常 | `store.error` 设置；toast 显示「搜索失败: ...」/「翻页失败: ...」；保持 focus 态（已有结果不变，loading=false） |
| NOT_INDEXED | 预览 fetch 返回 notIndexed | `previewError="NOT_INDEXED"`；`.focus-main` 第三栏由 preview-pane 替换为 `.not-indexed-hint.desktop-only`（提示「该文件未索引，无法预览。请先执行 doclens index 后重试。」） |
| previewDirty 保护 | 预览有未保存编辑 + 用户触发安全操作 | confirm 弹窗；确认丢弃则继续，取消则中止 |
| 初始空预览 | 搜索后 results 为空（无首条可自动预览） | preview-pane 空白 |
| 历史加载失败 | listSessions API 异常 | console.warn；history-list 为空（静默降级，不阻塞搜索功能） |
| 会话写入失败 | findOrCreateSession API 异常 | console.warn；不影响搜索结果展示（后台 fire-and-forget） |
