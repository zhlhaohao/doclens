# Markdown 预览 + 行号定位

## 背景与动机

Cortex Web UI（`cortex/web_v2`）的搜索结果卡片在点击后，右侧 `preview-pane` 目前对**所有文件类型**都按纯文本 + 行号渲染。对 `.md` 文件而言体验明显劣于 TUI——既看不到格式化效果，也不能像 TUI 那样直接看到命中行号（`path:line`）。

用户诉求：
1. `.md` 文件按 markdown 模式渲染（标题/列表/代码块）
2. 渲染后自动定位到命中行所在段落并短暂高亮

## 现状分析

| 维度 | 现状 |
|------|------|
| 后端 `_format_results` | `line=None` 硬编码，从未透传 |
| `flat_nodes` 字段 | `treesearch/search.py:743-751` 构建时**丢弃了 `line_start`/`line_end`** |
| TUI 路径 | 走 `score_and_rank(nodes, docs, ...)`，从 `docs[].nodes[]` 读取节点，那里**有** `line_start`（由 `_attach_node_fields` 注入） |
| 前端 `preview-pane` | 全部按 `<div class="body"><div class="line">...</div></div>` 纯文本渲染 |
| 前端依赖 | 只有 `lit` + `@shoelace-style/shoelace`，无 markdown 库 |

**根因**：`flat_nodes` 是 web_v2 唯一的数据源，但 treesearch 在该结构里省略了行号字段。修复不需要改 web_v2 的搜索流程，也不需要改 TUI——只需让 `flat_nodes` 透传已有的 `line_start`/`line_end`。

## 范围

### In Scope
- `.md` 文件的 markdown 渲染预览
- 点击卡片后自动滚动到命中行所在块级元素并短暂高亮
- 后端搜索 API 返回 `line` 字段

### Out of Scope
- 非 `.md` 文件（`.docx`/`.pdf`/`.py`/`.txt`...）——保持纯文本+行号视图
- 多行范围高亮（仅定位单行所在块）
- markdown 内嵌 HTML 的安全沙箱化（本地索引文件，威胁模型内不引入 DOMPurify）
- 会话历史里旧 `path` 数据的迁移（与本次范围正交，下次处理）

## 架构

### 数据流

```
后端:
  treesearch.search()
    → flat_nodes（每个 node 现带 line_start/line_end）
  cortex/web_v2/api/search.py _format_results
    → SearchResult(path, snippet, score, line=node["line_start"], highlights=[])

前端:
  search-view._onResultSelect
    → fetch /api/preview?path=foo.md（全文件内容）
    → preview-pane(path, content, language="markdown", line=14)
  preview-pane.render
    → 分支: language === "markdown" → <md-viewer content line>
                                      → marked 渲染（带 data-source-line）
                                      → 渲染后 scrollIntoView + .highlight-flash
            其它                       → 现有纯文本 + 行号视图
```

### 组件边界

| 组件 | 职责 | 输入 | 输出 |
|------|------|------|------|
| `treesearch/search.py` | flat_nodes 构建 | enriched_nodes | 加 `line_start`/`line_end` 字段 |
| `cortex/web_v2/api/search.py` | SearchResult 装配 | flat_nodes + path_map | `SearchResult.line` 填充 |
| `<md-viewer>`（新组件） | markdown → 安全 HTML | `content`、`line` | 带 `data-source-line` 的 HTML，并自管 scroll/highlight |
| `<preview-pane>` | 分支渲染 | `language`、`content`、`line`、`path` | 按 language 选 md-viewer 或纯文本 |

`<md-viewer>` 独立组件以便单测；`<preview-pane>` 仅做条件分支。

## 关键实现决策

### 1. Markdown 库：marked

`marked`（~30KB gzip）通过 `walkTokens` 能拿到 token 的 `line` 区间，结合自定义 renderer 给块级元素加 `data-source-line` 属性。

备选 `markdown-it` 体积更大且需额外插件；手写渲染器在嵌套列表/表格/转义上 edge case 过多，否决。

### 2. 行号 → 渲染元素映射

marked 的 token 上携带行号信息（具体字段名与索引基准 0/1-indexed 需在实现时查 marked 当前版本 API 确认）。在自定义 renderer 里给 `<h1>/<h2>/<p>/<li>/<pre>/<blockquote>` 等块级元素加 `data-source-line="<1-indexed 文件行号>"` 属性，归一化为 1-indexed 以匹配 `SearchResult.line` 语义。

定位时：选 `data-source-line` ≤ 目标行 的最后一个元素（即命中行所在的块），`scrollIntoView({ block: "center" })`，添加一次性 `.highlight-flash` 类（CSS keyframe 2s 淡出）。

### 3. 兜底

- `line === null`（旧会话 / treesearch 未注入）：渲染 markdown 但不滚动，顶部显示
- marked 抛错（极少）：`try/catch` 回退为纯文本视图，console.warn
- 目标行超出文档：scrollIntoView 自然到底部，无高亮

### 4. 安全

marked 默认转义内嵌 HTML；不开启 `async`；不渲染原始 HTML。本地索引文件威胁模型下足够。

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `treesearch/search.py` | 修改（+2 行） | `flat_nodes` 候选项追加 `line_start`/`line_end` |
| `cortex/web_v2/api/search.py` | 修改（1 行） | `line=node.get("line_start")` 替代 `line=None` |
| `cortex/web_v2/frontend/package.json` | 新增依赖 | `marked` |
| `cortex/web_v2/frontend/src/components/md-viewer.ts` | 新建 | markdown 渲染 + 行号定位组件 |
| `cortex/web_v2/frontend/src/components/preview-pane.ts` | 修改 | 新增 `line` 属性；按 `language` 分支到 `<md-viewer>` 或纯文本 |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 修改 | 新增 `previewLine` state；`_onResultSelect` 里从 `r.line` 读；传给 `<preview-pane>` |
| `cortex/web_v2/frontend/src/styles/*.css` | 新增 token | `.highlight-flash` 动画 |
| `tests/web_v2/test_search_api.py` | 扩展 | `test_search_path_can_be_previewed` 增加 line 断言 |
| `cortex/web_v2/frontend/tests/*.spec.ts` | 新增 | md-viewer 单测 + Playwright e2e |

## 测试策略

### 后端
扩展现有 `test_search_path_can_be_previewed`：
- 断言每条 result 的 `line` 是 `int | None`
- 对 `.md` 命中结果断言 `line >= 1`

### 前端单元测试（vitest）
- `md-viewer.spec.ts`：
  - 渲染简单 markdown，断言 `<h1>` 存在
  - 给定 `line=N`，断言能查到 `data-source-line` 元素并加上 highlight 类
  - `line=null` 不抛错

### E2E（Playwright）
- 搜索 "hello" → 点击 `.md` 卡片 → preview-pane 出现 `<md-viewer>`，shadow root 含 `<h1>` 或 `<p>`，且有 `data-source-line` 属性

## 验收标准

1. `.md` 文件点击卡片后，右侧渲染为格式化 markdown（至少能看到 `<h1>/<h2>/<p>/<ul>` 样式区分）
2. 卡片显示的 `path:line` 与实际文件行号一致
3. 渲染后视口自动滚动到命中行所在块，块短暂高亮
4. 非 `.md` 文件视图不变
5. `line === null` 时不报错，从顶部显示
6. 所有现有测试（19 个 web_v2 测试 + 现有前端测试）继续通过
