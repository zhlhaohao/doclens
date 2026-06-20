# Preview Page Markers — Design Spec

**Date:** 2026-06-20
**Topic:** 预览面板为 PDF / PPTX / XLSX 添加纸张卡片式分页标记
**Status:** Approved (pending user spec review)

## 1. 背景与动机

当前预览面板对二进制文档（PDF / PPTX / XLSX）的渲染只是把 DB 里的 structure 拍平为 markdown 字符串，交给 `<md-viewer>` 渲染。视觉上**完全没有"页"的概念**：

- **PDF**：每页之间的 `[PAGE N]` 标记是**纯文本**（`pdf_parser.py:82`），混在段落里被当作正文渲染，看起来像 `[PAGE 1]第一页内容...[PAGE 2]第二页内容...`，丑且无视觉分隔。只有标题检测失败的 fallback 路径（`pdf_parser.py:151-169`）才会把它们升级为 `## Page N` 标题。
- **PPTX**：每个 slide 已经是 structure 里 root 下的子节点，渲染成 `## slide 标题`。结构上有边界，但视觉上没有强调。
- **XLSX**：每个 sheet 是顶层节点，渲染成 `# sheet 名`。同上。

用户希望预览面板**像一页页纸**那样展示这些文档，让读者一眼能看出"这是第几页/slide/sheet"。

## 2. 需求总结（用户决策）

| 维度 | 决策 |
|------|------|
| 视觉风格 | 纸张卡片（每页 = 一张白底卡片，带阴影 + 内边距 + header 标签） |
| 标签内容 | 页号 + 标题（PPTX slide 标题 / XLSX sheet 名；PDF 只有页号） |
| 架构方案 | 方案 A：API 加结构化 `pages` 字段，前端按 `line_start` 切 md 渲染卡片 |
| PDF 标记处理 | 剥除 `[PAGE N]` 标记行（避免在卡片里仍显示为文本） |
| 单页处理 | 仍渲染为单卡片（一致性优先） |
| 适用类型 | 仅 pdf / pptx / excel（xlsx/xlsm/xltx/xltm 共享 source_type `excel`） |

## 3. 架构与数据流

```
GET /api/preview?path=x.pdf
    ↓
preview() 路由
    ↓
_synthesize_binary_preview(idx, rel_path):
  1. md_content = render_tree_to_md(doc.structure, doc.source_type)  # 不变
  2. NEW: pages, cleaned_md = _extract_pages(structure, source_type, md_content)
       - pdf:   扫 md 找 ^\[PAGE (\d+)\]$ 行，剥除 + 重算 line_start
       - pptx:  遍历 structure[0].nodes（slide 子节点）
       - excel: 遍历 structure（顶层 sheet 节点）
       - 其他:  返回 (None, md_content)
  3. return PreviewResponse(content=cleaned_md, pages=pages, ...)
    ↓
前端 search-view._fetchAndShowPreview / _reloadPreview
    ↓
this.previewPages = body.pages
    ↓
<preview-pane .pages=${this.previewPages}>
    ↓
<md-viewer .pages=${this.pages}>
    ↓
md-viewer.render():
  - pages 非空：按 line_start 切 content → 每段一个 .page-card
  - pages 空：原 .md-body 单块渲染（回归）
```

## 4. 后端组件

### 4.1 模型扩展（`cortex/web_v2/models/preview.py`）

```python
class PageMarker(BaseModel):
    """预览分页标记。"""
    label: str          # "第 3 页" / "幻灯片 3 · 项目背景" / "工作表 2 · 销售数据"
    line_start: int     # 1-indexed，对应 content 的行号

class PreviewResponse(BaseModel):
    path: str
    language: str = "text"
    content: str
    line_range: Optional[tuple[int, int]] = None
    highlights: list[int] = []
    writable: bool = False
    pages: Optional[list[PageMarker]] = None  # NEW；仅 pdf/pptx/excel 返回
```

### 4.2 `_extract_pages` 函数（`cortex/web_v2/api/preview.py`）

签名：

```python
def _extract_pages(
    structure: list,
    source_type: str,
    md_content: str,
) -> tuple[Optional[list[PageMarker]], str]:
    """从合成 md + structure 抽取分页信息。

    Returns:
        (pages, cleaned_md):
        - pages: PageMarker 列表或 None（不支持的类型）
        - cleaned_md: 处理后的 md 内容（pdf 会剥除 [PAGE N] 标记行）
    """
```

**三分支逻辑**：

#### `source_type == "pdf"`

逐行扫 `md_content`：
- 匹配 `^\[PAGE\s+(\d+)\]$` → 记录 `pages.append(PageMarker(label=f"第 {counter} 页", line_start=<cleaned 行号>))`，**不写入 cleaned_md**；`counter` 从 1 起递增（不用正则捕获的数字，因为某些 PDF 标记会跳号）
- 不匹配 → 追加到 cleaned_md

注意：`line_start` 是 cleaned_md 的行号（剥除后），不是原 md 行号。这样前端按 `line_start` 切 cleaned_md 才对齐。

边界：若整篇没有任何 `[PAGE N]` 标记 → 返回 `([{label: "第 1 页", line_start: 1}], md_content)`，整篇当一页。

正则：在 `preview.py` 内**重新定义**局部常量 `_RE_PDF_PAGE_MARKER = re.compile(r"^\[PAGE\s+(\d+)\]$")`（与 `pdf_parser._RE_PAGE_MARKER` 同模式但不跨模块引用，避免耦合）。

#### `source_type == "pptx"`

PPTX structure 形状：`[root_node(doc_name)] → nodes: [slide1, slide2, ...]`（由 `markitdown_parser.py:106-124` 包裹）。

```python
root = structure[0] if structure else None
slides = (root.get("nodes", []) if root else []) or []
if not slides:
    # markitdown 没解出 slide → 退化到无分页（避免无意义的单卡片）
    return None, md_content
pages = []
for i, slide in enumerate(slides):
    title = (slide.get("title") or "").strip()
    label = f"幻灯片 {i + 1}" + (f" · {title}" if title else "")
    line_start = slide.get("line_start") or 1
    pages.append(PageMarker(label=label, line_start=line_start))
return pages, md_content  # 不改 content
```

边界：
- `structure` 空 → 返回 `(None, md_content)`
- `root.nodes` 空（markitdown 没解出 slide）→ 返回 `(None, md_content)`（无意义的单卡片不如不显示）
- slide 没有 `line_start` → 用 1 兜底

#### `source_type == "excel"`

XLSX structure 形状：`[sheet1_node, sheet2_node, ...]`（顶层，无包裹根）。

```python
if not structure:
    return None, md_content
pages = []
for i, sheet in enumerate(structure):
    name = (sheet.get("title") or "").strip()
    label = f"工作表 {i + 1}" + (f" · {name}" if name else "")
    line_start = sheet.get("line_start") or 1
    pages.append(PageMarker(label=label, line_start=line_start))
return pages, md_content
```

边界：
- `structure` 空 → 返回 `(None, md_content)`

#### 其他 source_type（docx / csv / md / code / ...）

```python
return None, md_content
```

### 4.3 `_synthesize_binary_preview` 调用点

```python
def _synthesize_binary_preview(idx, rel_path):
    ...
    md_content = render_tree_to_md(doc.structure, doc.source_type)
    pages, cleaned_md = _extract_pages(doc.structure, doc.source_type, md_content)
    return PreviewResponse(
        path=rel_path,
        language="markdown",
        content=cleaned_md,
        line_range=None,
        highlights=[],
        writable=False,
        pages=pages,
    )
```

## 5. 前端组件

### 5.1 API 类型（`cortex/web_v2/frontend/src/api/preview.ts`）

```typescript
export interface PageMarker {
  label: string;
  line_start: number;
}

// 在已有的 preview fetch 调用（search-view.ts）里 body 自然包含 pages 字段，
// 这里只补类型导出供其他模块使用。
```

### 5.2 `search-view.ts`（修改）

新增 state：

```typescript
@state() private previewPages: PageMarker[] | null = null;
```

`_fetchAndShowPreview` 内（约 line 293）：

```typescript
this.previewContent = body.content;
this.previewPath = body.path;
this.previewLanguage = body.language;
this.previewLine = (r.line as number | null) ?? null;
this.previewWritable = body.writable ?? false;
this.previewPages = body.pages ?? null;  // NEW
```

`_reloadPreview`（上传成功后调用）同样赋值 `this.previewPages = body.pages ?? null`。

切换结果时清空：在 `previewContent = ""` 的地方同步 `this.previewPages = null`（约 line 228/302/381）。

模板传递（两处 `<preview-pane>`）：

```typescript
<preview-pane
  ...
  .pages=${this.previewPages}  // NEW
  ...>
```

### 5.3 `preview-pane.ts`（修改）

新增 property + 透传：

```typescript
@property({ attribute: false }) pages: PageMarker[] | null = null;
```

`<md-viewer>` 调用加 `.pages=${this.pages}`：

```typescript
<md-viewer
  .content=${this._content}
  .line=${this.line}
  .keyword=${this.keyword}
  .pages=${this.pages}  // NEW
></md-viewer>
```

### 5.4 `md-viewer.ts`（核心渲染改动）

新增 property：

```typescript
@property({ attribute: false }) pages: PageMarker[] | null = null;
```

新增辅助方法 `_splitByPages(content, pages)`：

```typescript
/** 按 pages 的 line_start 把 md content 切成 N 段。
 *  line_start 是 1-indexed；返回 [{label, md}, ...]。 */
private _splitByPages(content: string, pages: PageMarker[]): Array<{label: string; md: string}> {
  const lines = content.split("\n");
  const chunks: Array<{label: string; md: string}> = [];
  for (let i = 0; i < pages.length; i++) {
    const start = pages[i].line_start - 1;  // 转 0-indexed
    const end = i + 1 < pages.length ? pages[i + 1].line_start - 1 : lines.length;
    const md = lines.slice(Math.max(0, start), Math.max(0, end)).join("\n");
    chunks.push({ label: pages[i].label, md });
  }
  return chunks;
}
```

`render()` 改造：

```typescript
render() {
  ensureMdConfigured();
  if (!this.content) {
    return html`<div class="empty">无内容</div>`;
  }
  if (this.pages && this.pages.length > 0) {
    const chunks = this._splitByPages(this.content, this.pages);
    return html`<div class="md-body md-body-paged">
      ${chunks.map((c) => html`
        <section class="page-card">
          <header class="page-card-header">${c.label}</header>
          <div .innerHTML=${marked.parse(c.md, { async: false }) as string}></div>
        </section>
      `)}
    </div>`;
  }
  const raw = marked.parse(this.content, { async: false }) as string;
  return html`<div class="md-body" .innerHTML=${raw}></div>`;
}
```

`updated()` 钩子里的 `_locateAndHighlight` / `_highlightKeyword` 需要把 root 选择器从 `.md-body` 改为 `.md-body, .md-body-paged`（两套根都覆盖）。

### 5.5 CSS（`md-viewer.ts` static styles）

追加：

```css
.page-card {
  background: var(--cortex-surface);
  border: 1px solid var(--cortex-border);
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  margin: 16px 8px;
  padding: 14px 20px;
}
.page-card-header {
  font-size: var(--cortex-fs-sm);
  color: var(--cortex-text-subtle);
  font-weight: 500;
  letter-spacing: 0.02em;
  padding-bottom: 8px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--cortex-border);
}
/* 卡片内部标题更紧凑 */
.page-card h1, .page-card h2, .page-card h3 {
  margin-top: 0.5em;
}
```

## 6. 边界情况与防护

| 情况 | 处理 |
|------|------|
| PDF 无 `[PAGE N]` 标记 | 返回单页 `[{label: "第 1 页", line_start: 1}]`，整篇当一页 |
| PDF `[PAGE N]` 但 n 不连续（如跳号） | 按 marker 出现顺序生成 `第 N 页`（N 用实际计数，不用 marker 里的数字） |
| PPTX root.nodes 为空 | `pages = None`，退化到原 `.md-body` 渲染 |
| XLSX structure 为空 | `pages = None` |
| 某 slide/sheet 无 title | label 退化为 `幻灯片 N` / `工作表 N`（不带 `·`） |
| pages 数组为空 | 退化为原 `.md-body` 渲染 |
| line_start 越界（> content 总行数） | `_splitByPages` 用 `slice(max(0,start), max(0,end))` 兜底，越界返回空字符串 |
| 多个 page 的 line_start 相同 | 切出重复/空段，前端不崩，但视觉上会出现空卡片（接受） |
| `updated()` 钩子的 keyword/line 高亮 | 选择器覆盖 `.md-body` 和 `.md-body-paged`，两套渲染都生效 |
| mobile `noHeader=true` | 卡片渲染不变（cards 在 md-viewer 内部，不受 header 影响） |

## 7. 关键决策记录

1. **PDF 标记剥除（而非 CSS 隐藏）**：`[PAGE 1]` 作为纯文本会出现在 `<p>` 里，CSS 隐藏需要给每个 `<p>` 加判断；直接剥除源头更干净。代价：剥除后下游 line_start 必须用剥除后的行号（已在 `_extract_pages` 里同步重算）。
2. **PDF label 用计数 N 而非 marker 里的数字**：marker 数字偶尔会跳号或不规范（如某些 PDF 工具生成的标记），按出现顺序生成 `第 1 页、第 2 页` 最稳定。
3. **PPTX/XLSX 不剥除任何内容**：它们的"页边界"是 structure 节点，md 中表现为 heading；heading 本身是合法的 md，应当保留。
4. **pages 为 null vs 空数组**：null 表示"类型不支持分页"（docx/csv/md/code 等），前端走原渲染；空数组理论上不应出现，但前端按"空数组也走原渲染"兜底。
5. **单页仍渲染卡片**：一致性优先。单 PDF 单页、单 slide、单 sheet 都渲染为一张卡片，避免"有时卡片有时不卡片"的视觉跳变。
6. **label 中文优先**：`第 N 页` / `幻灯片 N` / `工作表 N` 与项目其他 UI 文案一致（toast、confirm 都是中文）。
7. **`_extract_pages` 不污染 `render_tree_to_md`**：synthesizer 保持通用，page 抽取作为 preview API 层的独立后处理。未来若其他端（CLI 等）想用 page 信息，可独立调用 `_extract_pages`。

## 8. 测试策略

### 8.1 后端（`tests/web_v2/test_preview_api.py` 追加）

1. **`test_preview_pdf_returns_pages`**：用 reportlab 造带 3 页文本的 PDF → 索引 → 预览。断言：
   - `body["pages"]` 长度为 3
   - 每个 page 的 label 形如 `第 N 页`
   - 每个 page 的 line_start 是清洗后 md 的行号
   - 关键回归：`body["content"]` 不含 `[PAGE` 字符串

2. **`test_preview_pdf_without_page_markers_returns_single_page`**：构造一个无 `[PAGE N]` 标记的 PDF（理论上不会出现，但兜底）。断言 pages 为 `[{label: "第 1 页", line_start: 1}]`。

3. **`test_preview_pptx_returns_pages_with_slide_titles`**：复用 `test_preview_pptx_returns_markdown_from_db` 的 pptx fixture（python-pptx 造 1 slide）。造一个 2 slide 版本。断言：
   - pages 长度 = slide 数
   - 每个 label 形如 `幻灯片 N · {title}`
   - line_start 来自 slide 节点的 line_start

4. **`test_preview_xlsx_returns_pages_with_sheet_names`**：用 openpyxl 造 2 sheet 的 xlsx → 索引 → 预览。断言：
   - pages 长度 = sheet 数
   - 每个 label 形如 `工作表 N · {sheet_name}`

5. **`test_preview_md_pages_is_null`**（回归）：md 文件预览，`body["pages"]` 为 `None`。

6. **`test_preview_csv_pages_is_null`**（回归）：csv 文件预览，`body["pages"]` 为 `None`。

7. **`test_preview_docx_pages_is_null`**（回归）：docx 文件预览，`body["pages"]` 为 `None`。

### 8.2 前端

**`cortex/web_v2/frontend/tests/md-viewer-pages.spec.ts`**（新建）：

1. `pages=null` 时渲染单个 `.md-body`，无 `.page-card`（回归）
2. `pages=[{label:"第 1 页", line_start:1}]` 时渲染 1 个 `.page-card`，header 含 "第 1 页"
3. `pages=[..., ..., ...]`（3 项）时渲染 3 个 `.page-card`，每个 header 按顺序对应 label
4. `_splitByPages` 按行号正确切（content 含 N 行，pages line_start 分别为 1、5、12 → 三段长度对得上）
5. line_start 越界时不崩（返回空段，仍渲染卡片 header）

**`cortex/web_v2/frontend/tests/preview-pane.spec.ts`** 追加：

- preview-pane 透传 pages 到 md-viewer（property 反射）

## 9. 不在本次范围内（YAGNI）

- 跳转到第 N 页（点击 page-card-header 滚动到该卡片）
- 页码搜索（"跳到包含 X 的页"）
- 折叠/展开单页
- 多列布局（左右双页）
- 打印友好模式
- docx 分页（DOCX 本身无原生页码，渲染时分页才计算）
- 卡片右键菜单（"复制此页内容"、"导出此页"等）
- 卡片懒加载（超长 PDF 性能优化）
- 卡片间吸附滚动（snap）

## 10. 实施顺序（建议）

1. 后端模型 `PageMarker` + `PreviewResponse.pages` 字段（带单测）
2. 后端 `_extract_pages` 三分支 + 单测（不接路由）
3. 后端 `_synthesize_binary_preview` 接入 + 集成测试（5 个预览场景）
4. 前端 API 类型 + search-view 传递 + preview-pane 透传
5. 前端 md-viewer 渲染 + CSS + 单测
6. `npm run build` 更新 `static/`
7. 手工冒烟（pdf/pptx/xlsx 三种文件预览，验证卡片效果）
