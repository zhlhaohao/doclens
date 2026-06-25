# 非 Markdown 文件的合成 md 预览

## 背景与动机

Cortex Web UI（`cortex/web_v2`）的搜索结果卡片点击后，右侧 `preview-pane` 目前对 **Markdown 文件**渲染为带格式、行号定位、关键字高亮的 md 视图（详见 `2026-06-17-markdown-preview-with-line-location-design.md`）；对**其它文件类型**则按 utf-8 纯文本 + 行号渲染。

问题：二进制文档（`.pdf/.docx/.xlsx/.csv`）通过 `Path.read_text(encoding="utf-8", errors="replace")` 读出来几乎全是乱码，根本无法看；而这些文件的**结构化目录层次结构和文字内容已经存储在 `documents.structure_json` 列中**——预览端却没用到。

用户诉求：对 `pdf/docx/xlsx/csv` 这几类文件，**复用 DB 中已存的树结构和节点文字**，在服务端合成为 md 字符串，复用现有 `<md-viewer>` 渲染：标题层级、表格、行定位、关键字高亮全部继承，无需新增前端组件。

## 现状分析

| 维度 | 现状 |
|------|------|
| `GET /api/preview` | 直接 `full.read_text()` 读磁盘 utf-8；二进制文件返回乱码 |
| `documents` 表 | `structure_json` 存完整树（含 `title/text/line_start/line_end/nodes`），`source_type` 区分类型 |
| `source_type` 取值 | `pdf/docx/excel/csv` 等已持久化（见 `treesearch/parsers/registry.py: SOURCE_TYPE_MAP`） |
| csv 节点结构 | 根节点 `text="Columns: a, b, c"` + 每行一个 level-2 子节点 `text="h1: v1; h2: v2"` |
| xlsx 节点结构 | 每个 sheet 一个 level-1 节点，`text="Columns: ...\nh1: v1; h2: v2\n..."`（整 sheet 内联） |
| pdf/docx 节点结构 | 解析器抽取的标题作为 heading，正文段落作为 `text` |
| `<md-viewer>` | 已支持 `data-source-line` 行定位、`keyword` 关键字高亮（`marked` + TreeWalker） |
| `<preview-pane>` | 已按 `language === "markdown"` 分支路由 |

**根因**：API 层只看磁盘字节流，没有回头查 DB 里已经组织好的结构化数据。

## 范围

### In Scope
- 后端：对 `.pdf/.docx/.xlsx/.xlsm/.xltx/.xltm/.csv` 7 类后缀，从 DB 读树 → 合成 md 字符串 → 以 `language="markdown"` 返回
- csv/xlsx 节点 text 解析为 md table；pdf/docx 节点 text 渲染为段落
- 行号对齐：合成 md 中每个 heading 所在行号 = `node.line_start`，复用 `<md-viewer>` 现有 `data-source-line` 定位逻辑
- DB 无记录时返回 `404 NOT_INDEXED`，前端显示"未索引"提示

### Out of Scope
- 代码文件（`.py/.java/.ts/...`）—— 仍走 utf-8 纯文本预览
- 扁平文本文档（`.txt/.log/...`）—— 同上
- `SearchResult.line` schema 变更 —— 仍使用现有 `flat_nodes[].line_start` 语义
- `<preview-pane>` / `<md-viewer>` 组件改动 —— 零改动
- 索引时预计算 md 字符串（方案 B）—— YAGNI，按需合成足够便宜
- 多关键字高亮的语义升级 —— `<md-viewer>` 现有按空格分词的高亮机制不变

## 架构

### 数据流

```
点击 pdf/docx/xlsx/csv 搜索结果
  ↓
search-view._onResultSelect
  → fetch /api/preview?path=foo.xlsx&line=123   （无变化）
  ↓
api/preview.py: preview()
  ├─ 后缀 ∈ BINARY_PREVIEW_EXTS = {.pdf, .docx, .xlsx, .xlsm, .xltx, .xltm, .csv}？
  │    ├─ 是: 走新合成路径
  │    │     1. fts.load_document_by_source_path(rel_path) → Document | None
  │    │     2. None → 抛 CortexAPIError(404, "NOT_INDEXED", "文件未索引...")
  │    │     3. preview_synthesizer.render_tree_to_md(doc.structure, doc.source_type)
  │    │          - DFS 遍历，按 node.line_start 填白行对齐
  │    │          - source_type ∈ {csv, excel} → _emit_table_block()
  │    │          - 其它 → 段落输出
  │    │     4. 返回 PreviewResponse(
  │    │            path=path, language="markdown",
  │    │            content=<合成 md>, line_range=None, highlights=[])
  │    └─ 否: 走当前 read_text 纯文本路径（无变化）
  ↓
preview-pane(path, content=<md>, language="markdown", line=123, keyword=...)
  → md-viewer 渲染 + 行定位 + 关键字高亮   （零改动）
```

### 组件边界

| 组件 | 职责 | 输入 | 输出 |
|------|------|------|------|
| `cortex/web_v2/api/preview.py` | 路由分发：后缀白名单分流 | `path`、`line` | `PreviewResponse` |
| `cortex/web_v2/preview_synthesizer.py`（新建） | 树 → md 字符串的纯函数模块 | `structure: list`、`source_type: str` | md 字符串 |
| `treesearch/fts.py` | 新增按 `source_path` 查 Document 的方法 | `source_path: str` | `Document \| None` |
| `cortex/web_v2/frontend/src/components/preview-pane.ts` | 无改动 | — | — |
| `cortex/web_v2/frontend/src/components/md-viewer.ts` | 无改动 | — | — |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 新增对 `NOT_INDEXED` 错误码的 UI 兜底 | API error | 显示提示态 |

**设计要点**：
- 合成器是**独立模块**，纯函数无副作用，便于单测
- API 层只做路由分发，不含合成逻辑
- 前端组件零改动，仅在 view 层加错误码识别

## 关键实现决策

### 1. 后缀白名单 vs source_type 判断

**选择后缀白名单**（在 API 层判断）。理由：
- API 层只能拿到 `path`，要拿到 `source_type` 必须先查 DB；后缀检查 O(1)
- 白名单显式可控，避免误把 `.txt` 等扁平文件卷入
- DB 命中后，渲染分支再用 `doc.source_type` 区分 csv/excel vs pdf/docx

```python
BINARY_PREVIEW_EXTS = frozenset({".pdf", ".docx", ".xlsx", ".xlsm", ".xltx", ".xltm", ".csv"})
```

### 2. 树 → md 的 DFS 遍历

```python
def render_tree_to_md(structure: list, source_type: str) -> str:
    out: list[str] = []
    for root in (structure if isinstance(structure, list) else [structure]):
        _emit_node(out, root, depth=0, source_type=source_type)
    return "\n".join(out)

def _emit_node(out: list[str], node: dict, depth: int, source_type: str) -> None:
    line_start = node.get("line_start") or 1
    title = node.get("title", "")
    text = node.get("text") or ""
    children = node.get("nodes") or []

    # 行号对齐：填白行让 heading 出现在第 line_start 行（1-indexed）
    # 这样 marked 自动打的 data-source-line == 原 line_start，<md-viewer> 定位逻辑零改动
    while len(out) + 1 < line_start:
        out.append("")

    level = min(depth + 1, 6)  # md 只有 h1-h6
    out.append("#" * level + " " + title)

    # csv 根节点：table 已聚合所有子节点 text，短路递归避免重复输出 heading
    if source_type == "csv" and children and text.lstrip().startswith("Columns:"):
        _emit_table_block(out, node, text, children, source_type)
        return

    if source_type in ("csv", "excel"):
        _emit_table_block(out, node, text, children, source_type)
    elif text:
        out.append("")
        out.extend(text.split("\n"))
        out.append("")

    for child in children:
        _emit_node(out, child, depth + 1, source_type)
```

### 3. csv/excel 的 md table 聚合

csv 和 xlsx 节点结构不同：
- **xlsx**：整 sheet 内联在单个节点的 `text` 里（自带 header + 所有数据行）
- **csv**：根节点 `text` 只有 header；每个数据行是独立的 level-2 子节点

两者 `text` 字段都使用统一行格式 `"h1: v1; h2: v2"`，可共用解析逻辑：

```python
_COLS_RE = re.compile(r"^Columns:\s*(.+)$")

def _emit_table_block(out, node, text, children, source_type):
    body_lines = (text or "").split("\n")
    # csv 根节点：聚合所有 level-2 子节点的 text 作为数据行
    if source_type == "csv" and children:
        body_lines = body_lines + [
            line
            for c in children
            for line in (c.get("text") or "").split("\n")
            if line.strip()
        ]

    if not body_lines or not body_lines[0].strip():
        return

    m = _COLS_RE.match(body_lines[0].strip())
    if not m:
        # 退化兜底：text 不匹配 Columns 模式 → 段落输出，不阻塞渲染
        out.append("")
        out.extend(body_lines)
        out.append("")
        return

    headers = [h.strip() for h in m.group(1).split(",") if h.strip()]
    out.append("")
    out.append("| " + " | ".join(headers) + " |")
    out.append("|" + " | ".join(["---"] * len(headers)) + " |")
    for row_line in body_lines[1:]:
        cells = _parse_kv_row(row_line, headers)
        out.append("| " + " | ".join(_escape_md_cell(cells.get(h, "")) for h in headers) + " |")
    out.append("")

def _parse_kv_row(line: str, headers: list[str]) -> dict:
    """把 'h: v; h: v' 解析成 dict；缺失列留空。"""
    result = {}
    for pair in line.split(";"):
        if ":" not in pair:
            continue
        k, v = pair.split(":", 1)
        result[k.strip()] = v.strip()
    return result

def _escape_md_cell(s: str) -> str:
    """md table 单元格转义：| → \\|，换行 → 空格。"""
    return s.replace("|", "\\|").replace("\n", " ").replace("\r", "")
```

**关键点**：
- csv 根节点（text 以 `Columns:` 起头且有子节点）在 `_emit_node` 里**短路递归**——table 已聚合子节点 text，不再为每个子节点单独输出 heading
- xlsx 节点 text 自带所有数据行，无需聚合子节点（本身也无子节点），正常走 `_emit_table_block`
- 退化兜底确保 text 异常时仍能预览（不抛错）
- 单元格转义防止 `|` 破坏表格结构

### 3.1 md table 行定位的局限

`<md-viewer>` 的 `data-source-line` 只打在 heading/paragraph/code/list/blockquote 上（见 `md-viewer.ts: blockRenderer`），**marked 的 table renderer 不在自定义 renderer 列表中**，因此 table 内部的 `<tr>` 没有 `data-source-line`。

点击 csv/xlsx 结果后的定位行为：
- `<md-viewer>` 找 `data-source-line <= line` 的最后一个块 → 命中 **table 前的 heading**（即 sheet/根节点的 heading）
- table 本身会随 heading 进入视口，用户能看到目标表头
- 若需要更精准的 row 定位（高亮具体 `<tr>`），需在 md-viewer 自定义 table renderer（**Out of Scope**，留给后续优化）

### 4. 行号对齐策略

合成 md 中每个 heading 所在行 = `node.line_start`（来自 DB），实现方式：
- DFS 输出前用 `while len(out) + 1 < line_start: out.append("")` 填白
- `<md-viewer>` 的 marked renderer 会基于 md 源串中 token 出现的行位置打 `data-source-line`，因此 heading 的 `data-source-line` 等于 `node.line_start`
- `SearchResult.line = flat_nodes[].line_start`（已有）→ md-viewer 找 `data-source-line <= line` 的最后一个块 → scroll + flash，行为与 md 文件完全一致

**退化场景**：
- `node.line_start` 为 `None` → 用 `1` 兜底，渲染不报错（但不保证行号对齐）
- 多个节点 `line_start` 相同 → 先到的填白对齐，后到的自然追加（不影响整体定位）
- `line_start` 稀疏（如 1, 50, 100）→ 中间填白行，md 体积可控（pdf/docx 罕见 >10000 行）

### 5. DB 查询方法

`FTS5Index` 新增方法：

```python
def load_document_by_source_path(self, source_path: str) -> Optional[Document]:
    """按 source_path 加载单个 Document（含 structure_json 反序列化）。

    Returns:
        Document 对象，无匹配返回 None。
    """
    row = self._conn.execute(
        "SELECT doc_id, doc_name, doc_description, source_path, source_type, structure_json "
        "FROM documents WHERE source_path = ? LIMIT 1",
        (source_path,),
    ).fetchone()
    if not row:
        return None
    doc_id, doc_name, doc_description, sp, source_type, structure_json = row
    structure = json.loads(structure_json) if structure_json else []
    return Document(
        doc_id=doc_id,
        doc_name=doc_name,
        doc_description=doc_description,
        structure=structure,
        source_type=source_type or "",
        metadata={"source_path": sp},
    )
```

**路径对齐**：API 收到的 `path` 是相对 `idx.search_path` 的相对路径，存入 DB 时是 `os.path.abspath(file_path)`（绝对路径）。合成路径需要：
```python
abs_path = os.path.abspath(os.path.join(idx.search_path, path))
doc = fts.load_document_by_source_path(abs_path)
```
若 DB 没命中，再尝试用相对路径查询作为兜底（防御性）。

### 6. DB 无记录兜底

```python
doc = fts.load_document_by_source_path(abs_path)
if doc is None:
    raise CortexAPIError(
        status_code=404,
        code="NOT_INDEXED",
        message=f"文件未索引，无法预览：{path}。请先执行 cortex index。",
    )
```

前端在 `search-view._fetchPreview` 的 catch 分支识别 `error.code === "NOT_INDEXED"`，设置 `previewState = "not_indexed"`，`<preview-pane>` 渲染：

```
该文件未索引，无法预览。
请先执行 cortex index 后重试。
```

### 7. 安全

- 合成 md 全部来自 DB（本地索引产物），非用户自由输入，威胁模型与现有 md 预览一致
- `<md-viewer>` 已用 `marked` 默认转义 HTML，不开启 raw HTML
- md table 单元格做 `|` 转义，避免破坏结构
- 路径越权检查（`_safe_resolve`）继续生效，未授权路径直接 404

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `cortex/web_v2/preview_synthesizer.py` | 新建 | 树 → md 合成器（纯函数模块，<200 行） |
| `cortex/web_v2/api/preview.py` | 修改 | 后缀白名单分流；DB 查询；调用合成器；NOT_INDEXED 错误码 |
| `treesearch/fts.py` | 修改 | 新增 `load_document_by_source_path` 方法 |
| `cortex/web_v2/models/preview.py` | 无改动 | 现有 `PreviewResponse` 足够 |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 修改 | 识别 `NOT_INDEXED` 错误码，设置预览态 |
| `cortex/web_v2/frontend/src/components/preview-pane.ts` | 无改动 | — |
| `cortex/web_v2/frontend/src/components/md-viewer.ts` | 无改动 | — |
| `tests/web_v2/test_preview_synthesizer.py` | 新建 | 合成器单测 |
| `tests/web_v2/test_preview_api.py` | 扩展 | pdf/xlsx/csv/md/txt 路由分发 + NOT_INDEXED |

## 测试策略

### 合成器单测（`tests/web_v2/test_preview_synthesizer.py`）

- `test_render_pdf_tree_to_md`：构造 `{title, text, line_start, nodes}` → 断言含 `# title`、段落、heading 在第 `line_start` 行
- `test_render_docx_with_nested_headings`：多级嵌套 → 断言 heading 层级正确（`#`/`##`/`###`）
- `test_render_xlsx_to_md_table`：sheet 节点 text = `"Columns: a, b\na: 1; b: 2\na: 3; b: 4"` → 断言输出 md table 含表头 + 2 数据行
- `test_render_csv_aggregates_children`：根节点 + 多个 level-2 子节点 → 断言聚合到同一 table，子节点不再单独输出 heading
- `test_render_falls_back_to_paragraph_when_not_columns`：text 不匹配 `Columns:` → 段落输出，不抛错
- `test_line_alignment_padding`：稀疏 line_start（1, 50, 100）→ 断言每个 heading 在正确行号（`md.split("\n").index("# heading") == line_start - 1`）
- `test_heading_level_capped_at_h6`：构造 7 层嵌套 → 断言最深节点用 `######`
- `test_escape_md_cell_pipe`：cell 含 `|` → 断言转义为 `\|`

### API 集成测试（扩展 `tests/web_v2/test_preview_api.py`）

- `test_preview_pdf_returns_markdown`：索引 fixture pdf → GET /api/preview?path=...pdf → 断言 `language == "markdown"`、`content` 含 `#`
- `test_preview_xlsx_contains_md_table`：索引 fixture xlsx → 断言 content 含 `|` 表格分隔符
- `test_preview_csv_aggregates_rows`：索引 fixture csv → 断言含多行 table row
- `test_preview_unindexed_pdf_returns_404`：未索引的 .pdf → 断言 404 + `code == "NOT_INDEXED"`
- `test_preview_txt_still_uses_text_route`：.txt → 断言 `language == "text"`（回归）
- `test_preview_md_unchanged`：.md → 仍走老路径（回归）
- `test_preview_pdf_path_traversal_blocked`：`path="../../../etc/passwd"` → 404 `FILE_NOT_FOUND`

### 前端

- 无需新增单元测试（`preview-pane` / `md-viewer` 已覆盖）
- E2E（playwright-cli skill）：搜索关键字 → 点击 .xlsx 结果 → preview 出现 `<md-viewer>`，shadowRoot 含 `<table>`；命中行所在的 heading（即 sheet 名）滚动到视口并短暂高亮，table 进入可视区域

## 验收标准

1. 点击 `.pdf/.docx/.xlsx/.xlsm/.xltx/.xltm/.csv` 搜索结果 → 右侧以 md 模式渲染（至少能看到 `<h1>/<h2>` 标题、段落或表格）
2. csv/xlsx 渲染为 md table，列对齐、表头加粗可见
3. pdf/docx 渲染为带层级的 md 文档（章节标题 + 正文段落）
4. 卡片显示的 `path:line` 与实际文件行号一致；渲染后自动滚动到命中行所在块并短暂高亮（行为与 md 文件完全一致）
5. 搜索关键字在合成 md 中按空格分词高亮（`<md-viewer>` 现有逻辑）
6. DB 无记录时显示"该文件未索引，无法预览"，不显示乱码
7. `.py/.txt/.json/.md/.html` 等其它文件预览行为零变化（回归测试通过）
8. 所有现有测试继续通过（19 个 web_v2 测试 + 现有前端测试）

## 风险与备注

- **DB 内容陈旧**：用户在索引后修改了源文件，DB 仍是旧内容。本次不处理（与 md 预览同口径，md 也是从磁盘读最新）。后续可加重索引提示或 FileWatcher 自动刷新
- **稀疏 line_start 导致 md 体积膨胀**：极端情况（pdf 10000+ 行）合成 md 可能达数百 KB。本次不设硬上限，留给后续按需优化
- **csv/xlsx 表格列数动态**：若数据行 `h: v` 对的 key 与 header 不完全匹配，缺失列留空、多余列丢弃；不阻塞渲染
- **load_document_by_source_path 路径匹配**：DB 存绝对路径，API 收到相对路径；首次实现需用 `os.path.abspath` 拼接，必要时双查（绝对 + 相对）作为兜底
