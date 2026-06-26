# DOCX 段落分隔与表格渲染修复 — Design

**Date**: 2026-06-26
**Owner**: zlhao
**Status**: Approved (user waived further confirmation)

## 背景

`中国联通广东省分公司通信网络应急预案-网络运营支撑系统分册.docx` 在 doclens 预览窗口中存在两个渲染问题：

1. **段落合并**："场景四"这一节里多个段落被合并成单个段落渲染。
2. **表格不渲染**：文档里的 13 张"操作步骤 | 风险 | 处置措施"表格在前端只是一段软换行的普通段落，没有被识别为表格。

## 根因（已用真实文档验证）

### 段落合并

在"场景四：应用指令下发异常"节点上，诊断脚本输出：

```
[Node] title='场景四：应用指令下发异常'  line_start=323  line_end=343
  text 里 \n 数量: 20
  text 里 \n\n 数量: 0      ← 关键
```

根因链：

1. `treesearch/parsers/docx_parser.py:131` 构建 node text 时用 `"\n".join(lines[start:end]).strip()`。docx 每个 `<w:p>` 在 `lines` 里占一项，所以 20 个段落被单 `\n` 拼成一个串。
2. `doclens/web_v2/preview_synthesizer.py:81` 把这段 text 直接 `body.split("\n")` 后逐行 `out.append`，最终 `"\n".join(out)` 输出。相邻段落之间只有单个 `\n`。
3. 前端 `<md-viewer>` 按 CommonMark 渲染：单个 `\n` 是软换行（同一段落），需要 `\n\n` 才分段。于是 20 段在预览窗口被合并成 1 段。

### 表格不渲染

`_table_to_text` 原实现输出 pipe-separated 多行串：

```
操作步骤 | 风险 | 处置措施
删除Pod重建 | 单副本应用删除期间会导致服务不可用 | ...
...
```

缺 GFM md 表格必需的 `| --- | --- |` 分隔行——前端 `<md-viewer>` 不识别为表格，只作为软换行段落。

附带观察（不在本次范围）：该文档里 `（一）判断条件：`、`（二）业务影响：` 这类行其实有清晰的子标题模式，但 docx 走到"有 Word heading 样式"分支时，这些子标题被当成正文，结构信息也丢了。

## 方案

方案 A：在 `docx_parser.py` 根因层修复——段落拼接和表格输出都在 parser 完成。

### 改动范围

| 文件 | 改动 |
|------|------|
| `treesearch/parsers/docx_parser.py` | 1) `docx_to_tree` 的段落拼接：过滤空段，用 `\n\n` 连接，同步修 fallback 路径。2) 新增 `_escape_md_cell`，重写 `_table_to_text` 输出 GFM md 表格（header + separator + rows）。 |
| `treesearch/config.py` | `INDEX_SCHEMA_VERSION: "2" → "3"`，补 history 注释行。 |
| `tests/treesearch/test_docx_parser.py`（新建） | 6 个用例：2 个段落分隔 + 4 个表格渲染（GFM 输出 / `\|` 转义 / cell 内换行 / 端到端 preview）。 |

不动：`preview_synthesizer.py`、`indexer.py`、其它 parser。原因：根因只在 docx 输出层，synthesizer 拿到合规的 `\n\n` 分段 + GFM 表格 text 后已经能正确渲染，与 csv/xlsx 走的 `_emit_table_block` 口径对齐。

### 段落拼接算法

**位置 1：`_extract_docx_headings` 不动**。它继续往 `lines` 里逐项 append（每个 docx `<w:p>` 一项），保持 heading 行号与 `lines` 1:1 对齐——这是 synthesizer heading 对齐的前提。

**位置 2：`docx_to_tree` 构建 node text 时**：

```python
# before
text = "\n".join(lines[start:end]).strip()

# after
paragraphs = [ln for ln in lines[start:end] if ln.strip()]
text = "\n\n".join(paragraphs).strip()
```

要点：
- 过滤空段（docx 常用空段做视觉间距，markdown 里用 `\n\n` 表达等价语义，留空段会变成 `\n\n\n\n` 噪声）。
- 表格项是 `lines` 里的一项、内容自带 `row1\nrow2\nrow3`——它作为一个整体参与 `\n\n` 连接，与相邻段落正确分段；表内仍保持单 `\n`（markdown 表格行的既定行为）。
- 首段仍是 heading 文本，`_strip_leading_title` 的首行匹配不受影响（`_normalize_title` 相等）。

**位置 3：fallback 路径**（当前 `docx_parser.py:108`）：

```python
# before
text_content = "\n".join(lines)

# after
text_content = "\n\n".join(ln for ln in lines if ln.strip())
```

`text_to_tree` 的 `_preprocess_text` 会把 `\n{3,}` 收敛为 `\n\n`，安全；`_detect_headings` 对空行无敏感。

### 表格渲染算法

新增 `_escape_md_cell`，重写 `_table_to_text` 为 GFM md 表格输出：

```python
def _escape_md_cell(s: str) -> str:
    """转义 md table 单元格：| → \\|，换行 → 空格，回车删除。
    与 csv/xlsx 在 preview_synthesizer._escape_md_cell 的口径一致。"""
    return s.replace("|", "\\|").replace("\n", " ").replace("\r", "")


def _table_to_text(table) -> str:
    """输出 GFM md 表格：首行视为 header，紧跟 separator 行，再接数据行。"""
    rows = []
    ncols = 0
    for row in table.rows:
        cells = [_escape_md_cell(cell.text.strip()) for cell in row.cells]
        ncols = max(ncols, len(cells))
        rows.append("| " + " | ".join(cells) + " |")
    if not rows or ncols == 0:
        return ""
    separator = "| " + " | ".join(["---"] * ncols) + " |"
    return "\n".join([rows[0], separator, *rows[1:]])
```

要点：
- 首行视为 header（与 csv/xlsx 一致，doclens 既定路径）。
- 单元格内 `|` 转义为 `\|`，避免破坏表格结构；换行替换为空格，避免行被截断。
- 表格作为一个整体字符串仍是 `lines` 里的一项，参与 `\n\n` 段落分隔；表内行保持单 `\n`，符合 GFM 表格行约定。
- 与 csv/xlsx 在 `_emit_table_block` 里用的 `_escape_md_cell` 口径一致，三大 binary 表格来源（csv / xlsx / docx）统一。

### 数据流验证

```
docx <w:p>x21
    ↓ _extract_docx_headings（不动）
lines = [h, p1, p2, ..., p20]   # 21 项
    ↓ docx_to_tree 新拼接
node.text = "h\n\np1\n\np2\n\n...\n\np20"   # 20 个 \n\n
    ↓ _finalize_tree → assign_node_ids / format_structure / generate_summaries
落库
    ↓ /api/preview
render_tree_to_md → _emit_node:
    body = _strip_leading_title(text, title) = "p1\n\np2\n\n...\n\np20"
    out.extend(body.split("\n"))
    # → ["", "p1", "", "p2", "", ..., "", "p20", ""]
    ↓ "\n".join(out)
md 输出：每个 pi 之间都有一个空行 → CommonMark 渲染为独立段落 ✓
```

副效果（正向）：
- `_split_oversized_nodes` 第一选择就是 `\n\n` 边界（`indexer.py:310`），新 text 天然友好；超长场景节点现在按段落自然切分。
- `_summarize_node` 走 `text[:250].replace("\n"," ")`，不受影响。
- `prefix_summary` / `summary` 字段内容不变（仍是去换行拼接），所以 search snippet 不变。

## 错误处理与边界

| 场景 | 行为 |
|----|------|
| 整段全空（仅空段） | `paragraphs=[]` → `text=""` → node 照常建立，text 为空。与现行行为一致（现行 `\n`.join 空段再 `.strip()` 也是空）。 |
| 只有一个段落 | `\n\n`.join 单元素 = 该段本身，无 `\n\n`，符合预期。 |
| 表格 + 段落混排 | 表格作为整体一项参与 `\n\n` 连接，表格上下自然出现段落分隔。表内行仍单 `\n`。 |
| 表格 cell 内含 `\|` | 转义为 `\|`，防破坏表格结构。 |
| 表格 cell 内含换行（多段落） | 替换为空格，防表格行被截断。 |
| 空表格（0 行） | `_table_to_text` 返回 `""`，`lines` 不追加该项。 |
| heading 标题被 `_normalize_title` 剥掉数字后与首行不等 | `_strip_leading_title` 原样返回 text，首段保留——已存在的老行为，不回归。 |
| markdown 特殊字符（`#`/`*`/`-` 开头的段落） | 原样保留，前端按 CommonMark 渲染。doclens 本来就不转义用户内容，与现状一致。 |

## 测试策略

**`tests/treesearch/test_docx_parser.py`（新文件）**，6 个用例：

**段落分隔（2 个）**

1. **`test_docx_paragraphs_are_double_newline_separated`**（核心回归）
   - 用 `python-docx` 造 docx：1 个 Heading 1 + 3 个 Normal 段落（中间夹 1 个空段）+ 1 个简单表格。
   - 调 `docx_to_tree(path, if_add_node_summary=False, if_add_node_text=True)`。
   - 断言：根节点下唯一子节点的 `text` 用 `"\n\n"` 切分后正好 5 段（heading 文本 + 3 段正文 + 1 个 GFM 表格块，空段被过滤）。

2. **`test_docx_fallback_path_also_separates_paragraphs`**
   - 用 `python-docx` 造一个没有任何 Heading 样式的 docx，仅 3 个 Normal 段落。
   - 调 `docx_to_tree(...)`，命中 fallback → `text_to_tree`。
   - 断言：生成的结构里至少存在包含 `\n\n` 的 text。

**表格渲染（4 个）**

3. **`test_table_to_text_outputs_github_flavored_md_table`**
   - 直接调 `_table_to_text`，断言输出为 GFM 表格（header 行 + `| --- | --- | --- |` separator + 数据行）。

4. **`test_table_to_text_escapes_pipe_in_cell`**
   - cell 内含 `|`，断言转义为 `\|`。

5. **`test_table_to_text_collapses_newline_in_cell`**
   - cell 内多段落，断言换行替换为空格。

6. **`test_docx_table_renders_as_md_table_in_preview`**（端到端）
   - docx → `docx_to_tree` → `render_tree_to_md`，断言 preview md 含 `| --- | --- |` separator 行和数据行。

**手动验证脚本**（不入库）：跑 `_diag_docx.py` 确认"场景四"节点 text 的 `\n\n` 数量；跑 `_gen_preview.py` 检查联通文档 13 张表格的 GFM 形态。

**索引重建验证**：bump schema 后，启动 doclens 应看到 `Indexed (new/changed): N` 而不是 `Skipped`。

## 索引迁移

`treesearch/config.py:32`：

```python
INDEX_SCHEMA_VERSION = "3"
# History 注释补一行：
#   "3" — docx parser emits \n\n between paragraphs for correct preview rendering.
```

效果：所有已索引文件的 `index_meta` 里 fingerprint 形如 `v2:stat:...`，新代码生成的是 `v3:stat:...`，前缀不匹配 → `_file_hash` 与 `all_meta` 比较时全部 miss → 全量重建。`_detect_and_apply_moves` 用的也是 `_current_prefix`，会自动跳过旧记录。

## 不在本次范围（YAGNI）

明确不做：
- `（一）判断条件：` 子标题结构识别（方案 C，留待后续单独排期）。
- pdf/text/markdown parser 的段落分隔审视（pdf_parser 走 pdfplumber、近期刚改过 `599135aa`，本次仅修 docx）。
- 给 doclens CLI 加 "schema 升级提示" 之类 UX（启动日志里能看到重建即可）。
