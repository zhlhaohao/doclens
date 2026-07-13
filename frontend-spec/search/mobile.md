# 搜索页（search-view）移动端设计 Spec

> 视口 <1024px。本 spec 只写移动端结构 / 布局 / 交互，不含视觉样式（颜色、字体、字号、间距数值、渐变、阴影、圆角、像素值）。

## 1. 路由与入口

- 路由 hash：`#/search`（应用默认视图）
- 进入方式：
  - 应用启动时默认挂载
  - tab-bar（底部水平条）search tab 点击 → navigate 事件 → router.navigate
  - 从 history-view 点历史条目 → `store.pendingSession`（type=search）→ search-view connectedCallback 消费 → `_loadSession`
  - 其他视图通过 hash 切回

## 2. 状态机

主状态 `store.search.state: "initial" | "focus"`

外加 detail overlay 子态（由 `detailStack` 非空触发，仅移动端可见）：

| 状态 | 触发条件 | 渲染区域 |
|------|---------|---------|
| initial | 启动 / focus-header「新搜索」返回 | `.initial-stack`（全宽） |
| focus（无 detail） | 提交 / 翻页 / 历史重放 | `.focus-body`（focus-header + `.focus-main`，仅 results-col 可见） |
| focus + detail overlay | 结果卡片被点击（`actions.pushDetail`） | `.focus-body.is-covered`（pointer-events:none）+ `.detail-overlay` 全屏覆盖 |

子状态：
- `loading`：搜索 / 翻页进行中（不切换 state）
- `previewDirty`：预览编辑脏标记
- `previewError`：`null` 或 `"NOT_INDEXED"`
- `searchMode`：`"keyword"`（默认，调 `/api/search`）或 `"grep"`（调 `/api/grep`），持久化 localStorage（key: `cortex.searchMode`）
- `detailStack`：`SearchResult[]`，顶部元素（detailTop）是当前 detail overlay 展示的结果；非空时触发 `.detail-overlay` 渲染 + `.focus-body.is-covered`
- `historySessions`：最近 20 条搜索会话

## 3. 构件树

```
<search-view>                                    :host flex column, flex:1
├── [initial] .initial-stack                     flex column, flex:1, 全宽
│   ├── <welcome-pane>                           heading="Doclens" subheading="结构感知文档检索"
│   ├── <history-list type="search">             标题"历史会话"
│   │   └── <history-item> × N                   grep 模式带 mode-tag
│   └── .input-row                               flex-shrink:0
│       └── <input-box>                          单行 --min-h:44px, keyword/grep 分裂按钮 + caret 向上下拉
├── [focus] <toast-stack>                        fixed 通知栈（位置上移避 tab-bar）
├── [focus] .focus-body                          flex column, flex:1（detailTop 存在时加 .is-covered）
│   ├── <focus-header back-label="新搜索">       title=query, meta=结果数 / 搜索中
│   └── .focus-main                              flex row 声明不变（splitter / preview-pane 均 display:none）
│       └── .results-col                         flex:1 占满全宽
│           ├── <search-results>                 flex:1
│           │   └── <result-card> × N
│           └── <pagination-bar>                 仅 total > limit 时渲染
├── [focus+detail] .detail-overlay               absolute inset:0, z-index:10, flex column（全屏覆盖）
│   ├── <focus-header back-label="结果">         title=detailTop.path, 可选"编辑"action
│   └── <preview-pane ?noHeader>                 或 .not-indexed-hint
```

## 4. 布局（仅移动端）

`:host` 为 flex column，占满 `<cortex-app>` 的 `.main` 区域（flex:1, min-height:0）。

### initial 态

`.initial-stack`：flex column, flex:1, min-height:0。**全宽**（无 max-width 约束）。
- `welcome-pane` 顶部。
- `history-list` 中间弹性占满（flex:1）。
- `.input-row`：flex-shrink:0，固定底部。

### focus 态（无 detail）

`.focus-body`：flex column, flex:1, min-height:0。

- `focus-header`：固定顶部，flex-shrink:0。
- `.focus-main`：flex row（CSS 声明与桌面一致），但实际仅 `.results-col` 可见，splitter 与 preview-pane 被 media query 隐藏：
  - `.results-col`：flex:1（覆盖桌面固定宽度规则），max-width:none, min-width:0，**占满全宽**。内部 flex column：
    - `search-results`：flex:1，内部纵向滚动。
    - `pagination-bar`（可选）：flex-shrink:0，底部。
  - `.splitter`：`display:none`（移动端禁用列宽调整）。
  - `<preview-pane class="desktop-only">`：`display:none`（移动端预览由 detail-overlay 提供）。

### focus + detail overlay

当 `detailStack` 非空（detailTop 存在）时：

- `.focus-body` 添加 `is-covered` 类 → `pointer-events:none`（仅 <1024px 生效，防止被覆盖的 focus-header 拦截点击）。focus-body 仍在 DOM 中，保留状态。
- `.detail-overlay`：`position:absolute, inset:0, z-index:10`，flex column，**全屏覆盖** `.focus-body`：
  - 第二个 `focus-header`（back-label「结果」）：固定顶部，flex-shrink:0。
  - `<preview-pane ?noHeader=true>` 或 `.not-indexed-hint`：flex:1 占满剩余高度。

## 5. 元素清单

### initial 态

| 元素 | 本页角色 / 行为 |
|------|----------------|
| `<welcome-pane>` | 标题「Doclens」+ 副标题「结构感知文档检索」+ 系统状态区（工作目录 / 文档数 / 索引大小 / 监控状态 / 上次重建 / 文件类型分布）。全宽展示，超宽 ellipsis 兜底。 |
| `<history-list>` | 标题「历史会话」，type=search。最近 20 条搜索会话。@select → 按历史 session.mode 重放。@clear → 清空。 |
| `<input-box>` | 单行输入（`--min-h` 较桌面更小）。带 keyword/grep 分裂按钮（主按钮标签随模式）+ caret **向上展开**模式菜单。placeholder 随模式变化。loading 时 disabled。@submit / @mode-change / @input-change。 |

### focus 态（无 detail）

| 元素 | 本页角色 / 行为 |
|------|----------------|
| `<toast-stack>` | 全局通知栈。位置上移避开 tab-bar。保存 / 上传 toast。 |
| `<focus-header>` | back-label「新搜索」，title=搜索查询文本（ellipsis），meta=动态文本（见下）。@back → 返回 initial 态。无 actions。 |
| `<search-results>` | 结果列表容器，全宽。props: `results`, `loading`, `activeResult`。三种态：loading+空→spinner；非loading+空→「无搜索结果」；有结果→result-card 列表。 |
| `<result-card>` | 单条命中。路径行（路径 badge + 路径 + `:行号`）+ markdown snippet + 评分百分比。`active` 高亮（引用比较）。**click → pushDetail → 触发 detail overlay 全屏覆盖**。依赖 :active 反馈（无 hover）。 |
| `<pagination-bar>` | 仅 `total > limit` 时渲染。「共 N 条 · 第 X/Y 页」+ 页码按钮组（省略号折叠）+ 上/下页。loading 时 disabled。@page-change → 翻页。 |

### detail overlay（focus + detail）

| 元素 | 本页角色 / 行为 |
|------|----------------|
| `.detail-overlay` | absolute 全屏覆盖容器（inset:0, z-index:10），flex column。背景不透明（完全遮盖 .focus-body）。 |
| `<focus-header back-label="结果">` | 第二个 focus-header。title=`detailTop.path`（ellipsis）。**previewWritable 时**有「编辑」kebab action（点击 → `_enterPreviewEdit()` 定位 `.detail-overlay preview-pane` → enterEdit）。@back → `actions.popDetail()`（返回 results 列表）。 |
| `<preview-pane ?noHeader=true>` | 文件预览。**noHeader=true**（隐藏自带 header，因 detail-overlay 有自己的 focus-header 提供标题 / 返回 / 编辑入口）。按 language 分支渲染（md → viewer/editor，html → iframe，纯文本 → 行号）。props: path, language, content, line, keyword, writable, pages。事件：@dirty-change / @saved / @save-failed / @upload-success / @upload-failed。 |
| `.not-indexed-hint` | NOT_INDEXED 时占位（无 desktop-only 类，移动端可见）。提示「该文件未索引，无法预览」。 |

### focus-header meta 文本规则

- `loading === true` → 「搜索中」
- `loading === false` + `source === "fts"` → 「N 条结果」
- `loading === false` + `source !== "fts"` → 「N 条结果 (SOURCE)」

## 6. 交互逻辑

### 6.1 搜索提交

1. input-box 输入文本 → 搜索按钮 click 或 Enter → @submit（detail: `{ value: trimmed }`）
2. `_submit()`（经 `_safeAction` 包裹，若 previewDirty 则先 confirm 丢弃）：
   - 重置 preview 状态（previewContent/previewPath/previewError/previewPages 全清）+ 清空 `detailStack`
   - 切换到 focus 态（先清空 results/total/offset）
   - `loading=true`
   - 按 searchMode 调 API（offset=0, limit=20）：keyword → `searchApi({query})` / grep → `grepApi({pattern})`
   - 成功 → 更新 results/total/queryWords/source/offset
   - **不自动预览首条**：`_autoPreviewFirstDesktop` 检查 `window.innerWidth >= 1024`，移动端直接 return
   - 后台 findOrCreateSession → 更新 currentSession + 重新加载历史
   - 失败 → `actions.setError("搜索失败: ...")`
   - finally → `loading=false`

### 6.2 搜索模式切换（keyword ↔ grep）

- 仅在 initial 态可用（focus 态无 input-box）
- input-box caret 按钮 → 向上展开模式菜单 → 选择模式
- @mode-change → 更新 `searchMode` + 持久化 localStorage（key: `cortex.searchMode`）
- 主按钮标签更新（搜索 / grep）+ placeholder 更新（关键词 / 正则提示）
- 历史重放：`_loadSession` 按 `session.mode` 自动切换引擎 + 同步 searchMode + 持久化

### 6.3 翻页

- pagination-bar @page-change（detail: `{ page }` 1-indexed）→ `_goToPage(page)`
- 计算新 offset = `(page-1) * limit`；与当前相同则 no-op
- `loading=true`，按 searchMode 调 API（offset=newOffset, limit=当前 limit）
- 成功 → 更新 results/total/offset/source
- **翻页后清空 preview**（previewContent/previewPath/previewLine 全清）
- 若 detail overlay 打开（detailStack 非空），翻页不自动关闭 overlay（但 preview 内容已清，overlay 内 preview-pane 会空白）
- 失败 → setError「翻页失败: ...」
- finally → loading=false

### 6.4 结果选中与 detail overlay

- result-card click → @select（detail: `{ result }`）→ `_onResultSelect`（经 `_safeAction`）
- `actions.pushDetail(r)` → detailStack 非空 → detailTop=r → **触发 `.detail-overlay` 渲染** + `.focus-body.is-covered`
- `_fetchAndShowPreview(r)`：
  - 判断预览范围：`r.line != null && !isFullFilePreview(r.path)` → **范围预览**（line-10 ~ line+20，专用 fetch，`start_line`/`end_line` 参数）
  - 否则 → **全文预览**（`fetchPreview(r.path)`）
  - 成功 → 设置 previewContent/previewPath/previewLanguage/previewWritable/previewPages
  - 行号定位：`r.line` 为 null 时不定位；非 null 时，二进制合成预览用 `result.lineMap` 换算为 md 行号（映射不到返回 null）；普通文本 lineMap 为 null，直接用 `r.line`
  - NOT_INDEXED → `previewError="NOT_INDEXED"`，detail-overlay 内 preview-pane 替换为 not-indexed-hint
- detail overlay 展示：focus-header「结果」+ preview-pane（noHeader=true）
- activeResult 高亮：search-results 的 `activeResult` = detailTop（引用比较），对应 result-card 加 `active` 高亮（overlay 遮挡时不可见，返回后可见）

### 6.5 返回 results（detail overlay 关闭）

- `.detail-overlay` 的 focus-header @back → `_popDetail()` → `actions.popDetail()`
  - detailStack pop 最后一个 → detailTop 变 undefined → `.detail-overlay` 不渲染 → `.focus-body.is-covered` 移除 → pointer-events 恢复 → 回到 results 列表
  - results 列表状态完整保留（focus-header + search-results + pagination-bar）

### 6.6 预览编辑（detail overlay 内）

- focus-header「编辑」action（仅 `previewWritable === true` 时显示）→ `_enterPreviewEdit()`
  - 定位 `.detail-overlay preview-pane`（非桌面那个）→ 调用 `enterEdit()` → 切换 md-editor
- 编辑 → @dirty-change（detail: `{ dirty: true }`）→ `previewDirty=true`
- Ctrl+S / 保存按钮 → preview-pane save → @saved → `previewDirty=false` + toast「已保存」
- 保存失败 → @save-failed → toast「保存失败：...」
- 取消编辑 → preview-pane discard → 复位内容
- 上传成功 → @upload-success → `previewDirty=false` + toast + `_reloadPreview`（重新拉取全文）
- 上传失败 → @upload-failed → toast

### 6.7 previewDirty 保护

- `_safeAction` 包裹所有可能丢失编辑的操作：新搜索、返回 initial、翻页、结果选中（pushDetail 会替换 preview）、清空历史
- previewDirty 时触发 `window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？")`：
  - 确认 → `_discardPreviewEdits()`（定位 preview-pane.discard()）→ `previewDirty=false` → 继续原操作
  - 取消 → 中止操作
- **注意**：detail overlay 的返回（popDetail）不走 `_safeAction`，不触发 confirm——popDetail 只移除 detailStack 栈顶，不改变 preview 状态，preview 内容保留（下次点同一卡片不会重新 fetch）

### 6.8 历史会话

- initial 态 history-list @select → `_loadSession(session)`
  - 按 `session.mode` 设置 searchMode + 持久化
  - 调 `_submit(session.title)` 重放
- history-list @clear → `_onClearHistory`（经 `_safeAction`）→ `_clearing=true` → clearSessions("search") → 清空 historySessions → `_clearing=false`
- 跨视图加载：connectedCallback 检查 `store.pendingSession`，type=search 则消费

### 6.9 返回 initial

- focus-header @back → `_backToInitial`（经 `_safeAction`）
- 重置 search state：state=initial, currentSession=null, results=[], query="", queryWords=[]
- 清空 localQuery + 重新加载历史

## 7. 边界态

| 边界态 | 触发条件 | 表现 |
|--------|---------|------|
| loading（搜索中） | 搜索 / 翻页进行中 | state 不切换；focus-header meta 显「搜索中」；search-results 在 `loading && results.length===0` 时显 spinner 文案「搜索中」；loading 且已有结果时保持旧结果 |
| empty（无结果） | 搜索完成，results 为空 | search-results 显「无搜索结果」；不触发 detail overlay（无卡片可点击） |
| error（搜索/翻页失败） | API 异常 | `store.error` 设置；toast 显示错误信息；保持 focus 态 |
| NOT_INDEXED | 预览 fetch 返回 notIndexed | `previewError="NOT_INDEXED"`；detail-overlay 内 preview-pane 替换为 `.not-indexed-hint`（提示「该文件未索引，无法预览。请先执行 doclens index 后重试。」） |
| previewDirty 保护 | 预览有未保存编辑 + 用户触发安全操作（新搜索 / 返回 / 翻页 / 点另一结果 / 清空历史） | confirm 弹窗；确认丢弃则继续，取消则中止 |
| detail overlay 返回 | popDetail | detailStack 清空 → `.detail-overlay` 不渲染 → `.focus-body.is-covered` 移除 → 回 results 列表（状态完整保留） |
| 初始空预览 | 移动端不自动预览首条 | 搜索后 preview 为空，用户需点击 result-card 才触发 detail overlay |
| 历史加载失败 | listSessions API 异常 | console.warn；history-list 为空（静默降级） |
| 会话写入失败 | findOrCreateSession API 异常 | console.warn；不影响搜索结果展示 |
