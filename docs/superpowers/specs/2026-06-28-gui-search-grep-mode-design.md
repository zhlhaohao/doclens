# GUI 搜索 Tab 增加 Grep 模式 — 设计文档

- **日期**: 2026-06-28
- **状态**: 已批准（待实现）
- **范围**: `doclens/web_v2`（后端 API + 前端 SPA）单特性

## 1. 背景与目标

doclens GUI 的 search tab 目前只提供关键词搜索（`POST /api/search`，FTS→LIKE→ripgrep
三段降级 + 综合评分 + 分页）。后端已存在完整的 grep 能力 —— CLI `cortex grep <pattern>`
经由 `doclens/ripgrep.py::execute_grep_search` 执行正则搜索，覆盖**所有文件（含未索引）**，
按词项命中数评分，并区分「内容匹配」与「路径匹配」—— 但该能力**未暴露到 Web**。

目标：把 grep 能力接入 search tab，与关键词搜索共享同一套结果/预览/分页 UI，
保持页面简洁。约束：**不新增按钮**（复用现有单一搜索按钮）。

## 2. 关键决策（已与用户确认）

1. **统一结果呈现**：grep 复用现有的 `search-results` / `preview-pane` / `pagination-bar`，
   对用户而言 grep 只是同一输入框的「另一种搜索引擎」。
2. **模式切换 = 分裂按钮下拉**：现有单一搜索按钮增加一个 `▾` caret；点 caret 弹出
   `[🔍 关键词 | </> 正则 Grep]` 菜单；按钮主体文案/图标跟随当前模式；点主体仍执行搜索。
3. **共享历史 + 模式标记**：grep 查询与关键词查询一起进入「历史会话」列表，grep 条目带
   `</>` 标记；点击历史条目按其记录的模式用对应引擎重放。
4. **默认模式 = keyword**（不改变现有用户体验）。
5. **模式持久化**：所选模式写入 `localStorage`，跨刷新保留（沿用
   `cortex.resultsPaneWidth` 的既有模式）。
6. **新增 `source: "grep"` 字面量**：grep 响应的 `source` 用 `"grep"`，便于 meta 行区分。
7. **新增可选 `kind: "content" | "path"` 字段**：路径匹配结果携带 `kind="path"`，
   支持卡片上的细微「路径」徽标；`/api/search` 结果默认 `kind="content"`，前端无破坏。

## 3. 数据流

```
submit(query)
  ├─ mode=keyword → POST /api/search  （既有：FTS→LIKE→ripgrep，综合评分，分页）
  └─ mode=grep    → POST /api/grep    （新增：正则搜索，覆盖所有文件）
```

两个端点返回**相同的 `SearchResponse` 结构**，因此前端的 `SearchViewState`、结果列、
预览面板、分页栏全部复用，只在 `search-view` 内按 `searchMode` 选择调用哪个 API。

## 4. 后端设计

### 4.1 新增 `POST /api/grep`

新文件 `doclens/web_v2/api/grep.py`，在 `app.py` 中 `app.include_router(grep.router, prefix="/api")` 注册。

- **Request**: `GrepRequest { pattern: str, offset: int = 0, limit: int = 20 }`（结构与
  `SearchRequest` 对齐，字段名用 `pattern` 以语义清晰）。
- **实现**: 在 `asyncio.to_thread` 中调用既有 `execute_grep_search(idx, pattern)`，
  **不新增搜索逻辑**，行为与 `cortex grep` 完全一致。
- **结果转换**: 将 `GrepResult.content_results` + `GrepResult.path_results` 拍平为单一
  `SearchResult[]`：
  - `path`：把 `doc_id` 解析为相对 `search_path` 的可预览路径。为此把 `search.py`
    中现有的私有 `_resolve_preview_path` **提升为共享函数**（移至
    `doclens/web_v2/api/_pathutil.py`），由 `search.py` 与 `grep.py` 共同 import。
  - `snippet`：`node["text"][:300]`。
  - `line`：`node.get("line_start")`（路径匹配无行号，为 `None`）。
  - `score`：`matched / total_terms`（total_terms = `len(result.query_words)`，至少为 1）。
  - `kind`：内容匹配 = `"content"`，路径匹配 = `"path"`。
- **分页**: 对拍平后的完整列表按 `offset/limit` 切片（`execute_grep_search` 已在
  `grep_max_results` 处封顶，切片在此上限内进行）。`safe_offset` 越界兜底与 `search.py` 一致。
- **Response**: 复用 `SearchResponse`，`source="grep"`，`query_words=result.query_words`，
  `total=len(all_results)`。
- **降级**: `execute_grep_search` 抛错时返回空结果（`results=[]`, `total=0`, `source="grep"`），
  与 `search.py` 的异常兜底风格一致。

### 4.2 模型改动（`doclens/web_v2/models/search.py`）

- `SearchResult` 增加可选字段 `kind: "content" | "path" = "content"`。
- `SearchResponse.source` 的字面量联合类型增加 `"grep"`。
- 新增 `GrepRequest`（或复用 `SearchRequest` 重命名字段——采用独立 `GrepRequest` 更清晰）。

## 5. 前端设计

### 5.1 `input-box.ts` — 分裂按钮

不新增组件，扩展现有 `input-box`：

- 新增属性：`mode: "keyword" | "grep"`、`modes` 描述符（每模式的 label + icon）。
  模式的「真相源」在父级 `search-view`，由其下发。
- 渲染为分裂按钮：`[ <icon> <label> | ▾ ]`，主体与 caret 之间一条细分割线，整体视觉为
  **单一控件**。
  - 点 **caret ▾** → 展开 2 项下拉 `🔍 关键词` / `</> 正则 Grep`，选中后派发
    `mode-change` 事件（`detail: { mode }`）。
  - 点 **主体** → 仍派发 `submit`。
- 按钮主体的 icon/label 跟随 `mode`（keyword: `🔍` + `关键词`；grep: `</>` + `Grep`）。
- 下拉点击外部关闭；键盘 Esc 关闭。

### 5.2 `search-view.ts` — 模式状态与路由

- 新增 `@state() searchMode: "keyword" | "grep" = "keyword"`，以及 localStorage key
  `cortex.searchMode` 的加载/保存（参照 `RESULTS_PANE_WIDTH_KEY` 的既有实现）。
- `_submit` / `_goToPage` 按 `searchMode` 分支：keyword 调 `searchApi`，grep 调新的
  `grepApi`。两者都写入同一个 `SearchViewState`，结果列/预览/分页无需改动。
- placeholder 与 focus-header 标题随模式调整（grep placeholder：`输入正则表达式…`）。
- meta 行：keyword 维持现状（`N 条结果` + source）；grep 显示 `N 条结果 (GREP)`。
- `search-results` 接收结果中的 `kind`，路径匹配卡片渲染细微「路径」徽标。

### 5.3 API client（`src/api/`）

- 新增 `grepApi(req: { pattern, offset?, limit? }): Promise<SearchResponse>`，
  `POST /api/grep`。
- `SearchResponse.source` 类型联合增加 `"grep"`；`SearchResult` 增加 `kind?`。

### 5.4 历史会话 — 模式标记与重放

- `Session`（TS 类型 + 后端 `sessions_store` 记录）增加可选 `mode: "keyword" | "grep"`。
- grep 提交时 `findOrCreateSession` 传 `mode: "grep"`；keyword 提交传/省略为 keyword。
- `history-item` 在 grep 条目旁渲染 `</>` 小标记，列表一眼区分引擎。
- 点击历史条目：先 `searchMode = entry.mode`，再用对应端点重放（复用 `_submit`）。

## 6. 复用与不变项

- 结果列（`search-results`）、预览面板（`preview-pane`）、分页栏（`pagination-bar`）、
  详情覆盖层（`detail-overlay`）、移动端响应式布局 —— **全部不变**。
- grep 结果卡片点击 → 预览面板按 `line` 拉取内容，与关键词搜索完全一致（grep node 带
  `line_start`）。
- `execute_grep_search` 等后端搜索逻辑 **不改**，仅在外层包 REST 端点。

## 7. 测试

- **后端单测**：`/api/grep` 返回 `SearchResponse` 结构；按 offset/limit 正确切片；
  `kind` 正确标注（content/path）；`execute_grep_search` 无结果时优雅返回空。
- **前端单测（Vitest）**：分裂按钮点主体派发 `submit`、点 caret 派发 `mode-change`；
  `search-view` 按 `searchMode` 路由到正确 API；模式持久化；历史重放设置正确模式。
- **E2E（playwright-cli）**：输入正则 → caret 切到 Grep → 提交 → 看到 `(GREP)` 结果；
  切回关键词；点击 grep 历史条目确认走 grep 引擎。

## 8. 范围与非目标

- **范围内**：一个 `/api/grep` 端点；`input-box` 分裂按钮；`search-view` 模式状态与路由；
  历史模式标记与重放；路径匹配徽标。
- **非目标**（YAGNI）：按文件分组、每文件多行命中的「经典 grep 视图」（即原方案 B，未来若
  需要 再做）；grep 高级选项（大小写、glob 过滤）—— 当前 `execute_grep_search` 不支持，
  不在本期扩展。
