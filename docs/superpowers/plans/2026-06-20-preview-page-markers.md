# Preview Page Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在预览面板为 PDF/PPTX/XLSX 渲染纸张卡片式分页：后端抽取结构化 `pages` 字段（label + line_start），前端 md-viewer 按 line_start 切分 content 渲染为多张卡片。

**Architecture:** 后端 `_extract_pages(structure, source_type, md_content)` 三分支（pdf 扫标记剥除、pptx 遍历 root.nodes、excel 遍历顶层节点）→ `PreviewResponse.pages` 可选字段 → search-view/preview-pane 透传 → md-viewer 切分渲染卡片。

**Tech Stack:** FastAPI + Pydantic（后端）、Lit + marked（前端）、pytest + vitest（测试）

**Spec:** `docs/superpowers/specs/2026-06-20-preview-page-markers-design.md`

---

## File Structure

| 路径 | 责任 | 动作 |
|------|------|------|
| `cortex/web_v2/models/preview.py` | 新增 `PageMarker` 模型 + `PreviewResponse.pages` 字段 | Modify |
| `cortex/web_v2/api/preview.py` | 新增 `_RE_PDF_PAGE_MARKER`、`_extract_pages`；修改 `_synthesize_binary_preview` | Modify |
| `tests/web_v2/test_preview_pages.py` | `_extract_pages` 单元测试 | Create |
| `tests/web_v2/test_preview_api.py` | 集成测试追加（pptx/xlsx/md 回归） | Modify |
| `cortex/web_v2/frontend/src/api/preview.ts` | 导出 `PageMarker` 类型 | Modify |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 新增 `previewPages` state + 透传 | Modify |
| `cortex/web_v2/frontend/src/components/preview-pane.ts` | 新增 `pages` property + 透传到 md-viewer | Modify |
| `cortex/web_v2/frontend/src/components/md-viewer.ts` | 新增 `pages` property + `_splitByPages` + 卡片渲染 + CSS | Modify |
| `cortex/web_v2/frontend/tests/md-viewer-pages.spec.ts` | md-viewer 分页渲染测试 | Create |
| `cortex/web_v2/frontend/tests/preview-pane.spec.ts` | 追加 pages 透传测试 | Modify |

---

## Task 1: Backend `PageMarker` model + `_extract_pages` pdf branch + unit tests

**Files:**
- Modify: `cortex/web_v2/models/preview.py`
- Modify: `cortex/web_v2/api/preview.py`
- Test: `tests/web_v2/test_preview_pages.py`（新建）

- [ ] **Step 1.1: Write the failing test file**

Create `tests/web_v2/test_preview_pages.py`:

```python
"""_extract_pages 单元测试。"""
import pytest

from cortex.web_v2.api.preview import _extract_pages
from cortex.web_v2.models.preview import PageMarker


# ---------------------------------------------------------------------------
# PDF 分支
# ---------------------------------------------------------------------------


def test_extract_pages_pdf_basic():
    """PDF: 多个 [PAGE N] 标记被剥除，pages 按顺序生成，line_start 指向清洗后行号。"""
    md = "[PAGE 1]\nA\nB\n[PAGE 2]\nC"
    pages, cleaned = _extract_pages([], "pdf", md)

    assert pages is not None
    assert len(pages) == 2
    assert pages[0] == PageMarker(label="第 1 页", line_start=1)
    # A,B 在 cleaned-line 1,2；C 在 cleaned-line 3
    assert pages[1] == PageMarker(label="第 2 页", line_start=3)
    assert "[PAGE" not in cleaned
    assert cleaned == "A\nB\nC"


def test_extract_pages_pdf_no_markers_returns_single_page():
    """PDF: 无任何 [PAGE N] 标记 → 整篇当一页，content 不变。"""
    md = "Just some text\nwithout markers"
    pages, cleaned = _extract_pages([], "pdf", md)

    assert pages == [PageMarker(label="第 1 页", line_start=1)]
    assert cleaned == md


def test_extract_pages_pdf_marker_not_at_start_includes_leading():
    """PDF: 标记前有内容（理论不该发生但兜底）→ 内容归入第 1 页。"""
    md = "Intro\n[PAGE 1]\nA"
    pages, cleaned = _extract_pages([], "pdf", md)

    assert pages is not None
    assert pages[0].line_start == 1
    assert "Intro" in cleaned
    assert "[PAGE" not in cleaned


def test_extract_pages_pdf_uses_counter_not_marker_number():
    """PDF: label 用出现顺序计数，不用 marker 里的数字（防跳号）。"""
    md = "[PAGE 5]\nA\n[PAGE 99]\nB"
    pages, _ = _extract_pages([], "pdf", md)

    assert pages[0].label == "第 1 页"
    assert pages[1].label == "第 2 页"


# ---------------------------------------------------------------------------
# 不支持的类型
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "source_type",
    ["markdown", "code", "csv", "docx", "text", "json", "html"],
)
def test_extract_pages_unsupported_types_return_none(source_type):
    """非 pdf/pptx/excel → pages=None，content 不变。"""
    pages, cleaned = _extract_pages([], source_type, "some content")

    assert pages is None
    assert cleaned == "some content"
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_pages.py -v
```
Expected: ImportError on `_extract_pages` / `PageMarker` (neither exists yet).

- [ ] **Step 1.3: Add `PageMarker` model**

Edit `cortex/web_v2/models/preview.py`, append at end:

```python
class PageMarker(BaseModel):
    """预览分页标记（PDF 页 / PPTX slide / XLSX sheet）。"""
    label: str          # "第 3 页" / "幻灯片 3 · 项目背景" / "工作表 2 · 销售数据"
    line_start: int     # 1-indexed，对应 PreviewResponse.content 的行号
```

Also update `PreviewResponse` to add the `pages` field. Find the existing class definition and add the field at the end:

```python
class PreviewResponse(BaseModel):
    path: str
    language: str = "text"
    content: str
    line_range: Optional[tuple[int, int]] = None
    highlights: list[int] = []
    writable: bool = False
    pages: Optional[list[PageMarker]] = None  # NEW；仅 pdf/pptx/excel 返回
```

- [ ] **Step 1.4: Add `_extract_pages` with pdf branch only**

Edit `cortex/web_v2/api/preview.py`. Add a new regex constant near the existing `_UPLOAD_FILENAME_RE` (around line 212), and a new function below `_resolve_upload_target` (around line 265):

```python
# PDF [PAGE N] 标记正则（与 treesearch.parsers.pdf_parser._RE_PAGE_MARKER 同模式，
# 但本模块内独立定义避免跨模块耦合）
_RE_PDF_PAGE_MARKER = re.compile(r"^\[PAGE\s+(\d+)\]$")


def _extract_pages(
    structure: list,
    source_type: str,
    md_content: str,
):
    """从合成 md + structure 抽取分页信息。

    Args:
        structure: treesearch Document.structure（root 节点列表）
        source_type: Document.source_type（"pdf" / "pptx" / "excel" / ...）
        md_content: render_tree_to_md 的输出

    Returns:
        (pages, cleaned_md):
        - pages: list[PageMarker] 或 None（不支持的类型或空 structure）
        - cleaned_md: 处理后的 md（pdf 会剥除 [PAGE N] 标记行；其他类型原样返回）
    """
    if source_type == "pdf":
        return _extract_pdf_pages(md_content)
    # pptx / excel 在 Task 2 实现
    return None, md_content


def _extract_pdf_pages(md_content: str):
    """PDF 分支：剥除 [PAGE N] 标记 + 按 counter 生成 pages。"""
    from cortex.web_v2.models.preview import PageMarker

    pages: list = []
    cleaned_lines: list[str] = []

    for line in md_content.split("\n"):
        if _RE_PDF_PAGE_MARKER.match(line.strip()):
            if not pages:
                # 第一个 marker → page 1 起始 = cleaned-line 1
                pages.append(PageMarker(label="第 1 页", line_start=1))
            else:
                # 后续 marker → page N 起始 = 下一 cleaned-line
                pages.append(
                    PageMarker(
                        label=f"第 {len(pages) + 1} 页",
                        line_start=len(cleaned_lines) + 1,
                    )
                )
            # 不写入 cleaned_lines
        else:
            cleaned_lines.append(line)

    if not pages:
        # 无 marker → 整篇当一页
        pages = [PageMarker(label="第 1 页", line_start=1)]

    return pages, "\n".join(cleaned_lines)
```

- [ ] **Step 1.5: Run tests to verify they pass**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_pages.py -v
```
Expected: 11 passed (4 pdf tests + 7 parametrized unsupported-type tests).

- [ ] **Step 1.6: Run regression — no impact on existing preview tests**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/ -v
```
Expected: all green (PageMarker field added but `_synthesize_binary_preview` not wired yet, so no API change).

- [ ] **Step 1.7: Commit**

```bash
git add cortex/web_v2/models/preview.py cortex/web_v2/api/preview.py tests/web_v2/test_preview_pages.py
git commit -m "feat(web): add PageMarker model and pdf page extractor"
```

---

## Task 2: Backend `_extract_pages` pptx + excel branches + unit tests

**Files:**
- Modify: `cortex/web_v2/api/preview.py`（扩展 `_extract_pages`）
- Test: `tests/web_v2/test_preview_pages.py`（追加）

- [ ] **Step 2.1: Append failing tests for pptx + excel**

在 `tests/web_v2/test_preview_pages.py` 末尾追加：

```python
# ---------------------------------------------------------------------------
# PPTX 分支
# ---------------------------------------------------------------------------


def test_extract_pages_pptx_with_slides():
    """PPTX: 每个 slide 子节点 → 一个 page，label 含标题。"""
    structure = [{
        "title": "doc.pptx",
        "line_start": 1,
        "nodes": [
            {"title": "Intro", "line_start": 2, "nodes": []},
            {"title": "Method", "line_start": 10, "nodes": []},
        ],
    }]
    pages, cleaned = _extract_pages(structure, "pptx", "md content")

    assert pages is not None
    assert len(pages) == 2
    assert pages[0] == PageMarker(label="幻灯片 1 · Intro", line_start=2)
    assert pages[1] == PageMarker(label="幻灯片 2 · Method", line_start=10)
    assert cleaned == "md content"  # pptx 不改 content


def test_extract_pages_pptx_empty_slides_returns_none():
    """PPTX: root.nodes 为空 → None。"""
    structure = [{"title": "empty.pptx", "line_start": 1, "nodes": []}]
    pages, cleaned = _extract_pages(structure, "pptx", "md")

    assert pages is None
    assert cleaned == "md"


def test_extract_pages_pptx_no_structure_returns_none():
    """PPTX: structure 为空 → None。"""
    pages, cleaned = _extract_pages([], "pptx", "md")

    assert pages is None
    assert cleaned == "md"


def test_extract_pages_pptx_slide_without_title():
    """PPTX: slide 无 title → label 只有序号（不带 ·）。"""
    structure = [{
        "title": "doc.pptx",
        "nodes": [{"title": "", "line_start": 2}],
    }]
    pages, _ = _extract_pages(structure, "pptx", "md")

    assert pages is not None
    assert pages[0].label == "幻灯片 1"


# ---------------------------------------------------------------------------
# Excel 分支
# ---------------------------------------------------------------------------


def test_extract_pages_excel_with_sheets():
    """XLSX: 每个 sheet 顶层节点 → 一个 page。"""
    structure = [
        {"title": "Sales", "line_start": 1, "nodes": []},
        {"title": "Inventory", "line_start": 50, "nodes": []},
    ]
    pages, cleaned = _extract_pages(structure, "excel", "md content")

    assert pages is not None
    assert len(pages) == 2
    assert pages[0] == PageMarker(label="工作表 1 · Sales", line_start=1)
    assert pages[1] == PageMarker(label="工作表 2 · Inventory", line_start=50)
    assert cleaned == "md content"


def test_extract_pages_excel_empty_returns_none():
    """XLSX: structure 空 → None。"""
    pages, cleaned = _extract_pages([], "excel", "md")

    assert pages is None
    assert cleaned == "md"


def test_extract_pages_excel_sheet_without_title():
    """XLSX: sheet 无 title → label 只有序号。"""
    structure = [{"title": "", "line_start": 1}]
    pages, _ = _extract_pages(structure, "excel", "md")

    assert pages is not None
    assert pages[0].label == "工作表 1"
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_pages.py -v -k "pptx or excel"
```
Expected: 7 failures (pptx / excel branches not implemented yet — currently return `(None, md)`).

- [ ] **Step 2.3: Extend `_extract_pages` with pptx + excel branches**

Edit `cortex/web_v2/api/preview.py`. Replace the `_extract_pages` function (added in Task 1) with this expanded version that dispatches to per-type helpers. **pptx / excel 不改 content**，由 `_extract_pages` 把原 `md_content` 透传出去；只有 pdf 分支会返回剥除标记后的 cleaned_md。

```python
def _extract_pages(
    structure: list,
    source_type: str,
    md_content: str,
):
    """从合成 md + structure 抽取分页信息。

    Args:
        structure: treesearch Document.structure（root 节点列表）
        source_type: Document.source_type（"pdf" / "pptx" / "excel" / ...）
        md_content: render_tree_to_md 的输出

    Returns:
        (pages, cleaned_md):
        - pages: list[PageMarker] 或 None（不支持的类型或空 structure）
        - cleaned_md: pdf 分支为剥除 [PAGE N] 后的 md；其他分支原样返回 md_content
    """
    if source_type == "pdf":
        return _extract_pdf_pages(md_content)
    if source_type == "pptx":
        return _extract_pptx_pages(structure), md_content
    if source_type == "excel":
        return _extract_excel_pages(structure), md_content
    return None, md_content


def _extract_pptx_pages(structure: list):
    """PPTX: 返回 pages 或 None。content 由 _extract_pages 原样返回。"""
    from cortex.web_v2.models.preview import PageMarker

    root = structure[0] if structure else None
    slides = (root.get("nodes", []) if root else []) or []
    if not slides:
        return None

    pages = []
    for i, slide in enumerate(slides):
        title = (slide.get("title") or "").strip()
        label = f"幻灯片 {i + 1}" + (f" · {title}" if title else "")
        line_start = slide.get("line_start") or 1
        pages.append(PageMarker(label=label, line_start=line_start))
    return pages


def _extract_excel_pages(structure: list):
    """Excel: 返回 pages 或 None。content 由 _extract_pages 原样返回。"""
    from cortex.web_v2.models.preview import PageMarker

    if not structure:
        return None

    pages = []
    for i, sheet in enumerate(structure):
        name = (sheet.get("title") or "").strip()
        label = f"工作表 {i + 1}" + (f" · {name}" if name else "")
        line_start = sheet.get("line_start") or 1
        pages.append(PageMarker(label=label, line_start=line_start))
    return pages
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_pages.py -v
```
Expected: 18 passed (11 from Task 1 + 7 new).

- [ ] **Step 2.5: Commit**

```bash
git add cortex/web_v2/api/preview.py tests/web_v2/test_preview_pages.py
git commit -m "feat(web): add pptx and excel page extractors"
```

---

## Task 3: Backend integration: wire `_synthesize_binary_preview` + integration tests

**Files:**
- Modify: `cortex/web_v2/api/preview.py`（`_synthesize_binary_preview`）
- Test: `tests/web_v2/test_preview_api.py`（追加）

- [ ] **Step 3.1: Append failing integration tests**

在 `tests/web_v2/test_preview_api.py` 末尾追加：

```python
# ---------------------------------------------------------------------------
# 分页标记（pages 字段）集成测试
# ---------------------------------------------------------------------------


def _init_and_reindex_sync():
    """在非事件循环线程中初始化 + 索引。"""
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


@pytest.mark.asyncio
async def test_preview_pptx_returns_pages_with_slide_titles(
    temp_workdir, env_cortex_config, reset_deps
):
    """pptx 预览：pages 列出每个 slide，label 含 slide 标题。"""
    from pptx import Presentation  # type: ignore

    prs = Presentation()
    s1 = prs.slides.add_slide(prs.slide_layouts[0])
    s1.shapes.title.text = "Intro Slide"
    s1.placeholders[1].text = "intro body"
    s2 = prs.slides.add_slide(prs.slide_layouts[0])
    s2.shapes.title.text = "Method Slide"
    s2.placeholders[1].text = "method body"
    prs.save(str(temp_workdir / "twoslides.pptx"))

    await asyncio.to_thread(_init_and_reindex_sync)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "twoslides.pptx"})

    assert res.status_code == 200
    body = res.json()
    assert body["pages"] is not None
    assert len(body["pages"]) == 2
    assert body["pages"][0]["label"] == "幻灯片 1 · Intro Slide"
    assert body["pages"][1]["label"] == "幻灯片 2 · Method Slide"
    # line_start 是 1-indexed 整数
    assert isinstance(body["pages"][0]["line_start"], int)


@pytest.mark.asyncio
async def test_preview_xlsx_returns_pages_with_sheet_names(
    temp_workdir, env_cortex_config, reset_deps
):
    """xlsx 预览：pages 列出每个 sheet，label 含 sheet 名。"""
    from openpyxl import Workbook  # type: ignore

    wb = Workbook()
    wb.active.title = "Sales"
    wb.active.append(["name", "amt"])
    wb.active.append(["Alice", 100])
    wb.create_sheet("Inventory").append(["item", "qty"])
    wb.save(str(temp_workdir / "multi.xlsx"))

    await asyncio.to_thread(_init_and_reindex_sync)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "multi.xlsx"})

    assert res.status_code == 200
    body = res.json()
    assert body["pages"] is not None
    assert len(body["pages"]) == 2
    assert body["pages"][0]["label"] == "工作表 1 · Sales"
    assert body["pages"][1]["label"] == "工作表 2 · Inventory"


@pytest.mark.asyncio
async def test_preview_md_pages_is_null(temp_workdir, env_cortex_config, reset_deps):
    """回归：md 文件预览，pages 为 null（不支持分页）。"""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "doc1.md"})

    assert res.status_code == 200
    body = res.json()
    assert body["pages"] is None


@pytest.mark.asyncio
async def test_preview_csv_pages_is_null(temp_workdir, env_cortex_config, reset_deps):
    """回归：csv 文件预览，pages 为 null。"""
    await asyncio.to_thread(_init_and_reindex_sync)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "data.csv"})

    assert res.status_code == 200
    body = res.json()
    assert body["pages"] is None
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_api.py -v -k "pages or pptx_returns or xlsx_returns or md_pages or csv_pages"
```
Expected: pages tests fail (body["pages"] doesn't exist yet because `_synthesize_binary_preview` not wired).

- [ ] **Step 3.3: Wire `_extract_pages` into `_synthesize_binary_preview`**

Find `_synthesize_binary_preview` in `cortex/web_v2/api/preview.py` (around line 110). Current shape:

```python
def _synthesize_binary_preview(idx: IndexManager, rel_path: str) -> PreviewResponse:
    ...
    md_content = render_tree_to_md(doc.structure, doc.source_type)
    return PreviewResponse(
        path=rel_path,
        language="markdown",
        content=md_content,
        line_range=None,
        highlights=[],
        writable=False,
    )
```

Replace with:

```python
def _synthesize_binary_preview(idx: IndexManager, rel_path: str) -> PreviewResponse:
    """从 DB 读 structure_json → 合成 md → 返回 language=markdown。"""
    from treesearch.fts import FTS5Index

    abs_path = os.path.abspath(os.path.join(idx.search_path, rel_path))
    fts = FTS5Index(db_path=idx.index_path)
    try:
        doc = fts.load_document_by_source_path(abs_path)
        if doc is None:
            doc = fts.load_document_by_source_path(rel_path)
    finally:
        fts.close()

    if doc is None:
        raise CortexAPIError(
            status=404,
            code="NOT_INDEXED",
            detail=f"文件未索引，无法预览：{rel_path}。请先执行 cortex index。",
        )

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

- [ ] **Step 3.4: Run all preview tests**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/ -v
```
Expected: all green (existing 114 + new ~4 = 118+).

- [ ] **Step 3.5: Commit**

```bash
git add cortex/web_v2/api/preview.py tests/web_v2/test_preview_api.py
git commit -m "feat(web): wire pages metadata through preview response"
```

---

## Task 4: Frontend API types + search-view state + preview-pane pass-through

**Files:**
- Modify: `cortex/web_v2/frontend/src/api/preview.ts`
- Modify: `cortex/web_v2/frontend/src/views/search-view.ts`
- Modify: `cortex/web_v2/frontend/src/components/preview-pane.ts`
- Test: `cortex/web_v2/frontend/tests/preview-pane.spec.ts`（追加）

- [ ] **Step 4.1: Append failing test for pass-through**

在 `cortex/web_v2/frontend/tests/preview-pane.spec.ts` 末尾追加：

```typescript
describe("<preview-pane> pages pass-through", () => {
  it("passes pages prop to md-viewer", async () => {
    const pages = [{ label: "第 1 页", line_start: 1 }];
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" .pages=${pages}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const mdv = el.shadowRoot!.querySelector("md-viewer") as any;
    expect(mdv).toBeTruthy();
    expect(mdv.pages).toEqual(pages);
  });

  it("defaults pages to null when not provided", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const mdv = el.shadowRoot!.querySelector("md-viewer") as any;
    expect(mdv.pages).toBeNull();
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/preview-pane.spec.ts
```
Expected: 2 new tests fail (pages prop not defined on preview-pane).

- [ ] **Step 4.3: Add PageMarker type to api/preview.ts**

Edit `cortex/web_v2/frontend/src/api/preview.ts`, append at end:

```typescript
// ---------------------------------------------------------------------------
// 分页标记（PDF / PPTX / XLSX 预览）
// ---------------------------------------------------------------------------

export interface PageMarker {
  label: string;
  line_start: number;
}
```

- [ ] **Step 4.4: Add `pages` property to preview-pane.ts**

Edit `cortex/web_v2/frontend/src/components/preview-pane.ts`.

1. 在顶部 import 加入 `PageMarker`:

```typescript
import { savePreview, PreviewSaveError, uploadPreview } from "../api/preview";
import type { PageMarker } from "../api/preview";
```

2. 在 `@property` 块中（约第 67 行 `writable` 之后）加：

```typescript
@property({ attribute: false }) pages: PageMarker[] | null = null;
```

3. 在 markdown 预览分支的 `<md-viewer>` 上加 `.pages`（约 175 行附近）：

```typescript
<md-viewer
  .content=${this._content}
  .line=${this.line}
  .keyword=${this.keyword}
  .pages=${this.pages}
></md-viewer>
```

- [ ] **Step 4.5: Add `previewPages` state to search-view.ts**

Edit `cortex/web_v2/frontend/src/views/search-view.ts`.

1. 在顶部 import 加入 `PageMarker` 类型（找到已有的 `import type { ... } from "../api/..."` 或新增）：

```typescript
import type { PageMarker } from "../api/preview";
```

2. 在 `@state()` 块中 `previewWritable` 之后（约第 128 行）加：

```typescript
@state() private previewPages: PageMarker[] | null = null;
```

3. 在 `_fetchAndShowPreview` 中（约第 293-297 行），在 `this.previewWritable = body.writable ?? false;` 后追加：

```typescript
this.previewPages = body.pages ?? null;
```

4. 在 `_reloadPreview`（约第 373-388 行），`this.previewWritable = body.writable ?? false;` 后同样追加：

```typescript
this.previewPages = body.pages ?? null;
```

5. 在 3 处 reset 位置同步清空 `previewPages`（行号约 228、302、412）。每处 `this.previewContent = "";` 后追加：

```typescript
this.previewPages = null;
```

具体 3 个位置：
- 第 228 行附近（search 提交重置）
- 第 302 行附近（NOT_INDEXED 错误分支）
- 第 412 行附近（切换 session / 清空时）

6. 在两处 `<preview-pane>` 标签上加 `.pages` 绑定。找到桌面端 `<preview-pane>`（约第 497 行）和移动端 `<preview-pane>`（约第 527 行），在已有 `.keyword=${s.query}` 后加：

```typescript
.pages=${this.previewPages}
```

- [ ] **Step 4.6: Run test to verify pass-through passes**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/preview-pane.spec.ts
```
Expected: all tests pass (existing + 2 new).

- [ ] **Step 4.7: Commit**

```bash
git add cortex/web_v2/frontend/src/api/preview.ts cortex/web_v2/frontend/src/views/search-view.ts cortex/web_v2/frontend/src/components/preview-pane.ts cortex/web_v2/frontend/tests/preview-pane.spec.ts
git commit -m "feat(web): thread pages metadata from api to md-viewer"
```

---

## Task 5: Frontend md-viewer rendering + CSS + tests

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/md-viewer.ts`
- Test: `cortex/web_v2/frontend/tests/md-viewer-pages.spec.ts`（新建）

- [ ] **Step 5.1: Write failing test file**

Create `cortex/web_v2/frontend/tests/md-viewer-pages.spec.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/md-viewer";
import type { MdViewer } from "../src/components/md-viewer";

describe("<md-viewer> pages rendering", () => {
  it("renders single .md-body when pages is null (regression)", async () => {
    const el = await fixture(html`<md-viewer content="# T"></md-viewer>`) as MdViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".md-body")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".md-body-paged")).toBeNull();
    expect(el.shadowRoot!.querySelectorAll(".page-card").length).toBe(0);
  });

  it("renders .md-body-paged and one .page-card when pages has 1 item", async () => {
    const el = await fixture(html`
      <md-viewer
        content="body"
        .pages=${[{ label: "第 1 页", line_start: 1 }]}>
      </md-viewer>
    `) as MdViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".md-body-paged")).toBeTruthy();
    const cards = el.shadowRoot!.querySelectorAll(".page-card");
    expect(cards.length).toBe(1);
    const header = cards[0].querySelector(".page-card-header");
    expect(header).toBeTruthy();
    expect(header!.textContent).toContain("第 1 页");
  });

  it("renders N .page-cards in order with correct labels", async () => {
    const content = "page1\npage2\npage3";
    const pages = [
      { label: "第 1 页", line_start: 1 },
      { label: "第 2 页", line_start: 2 },
      { label: "第 3 页", line_start: 3 },
    ];
    const el = await fixture(html`
      <md-viewer .content=${content} .pages=${pages}></md-viewer>
    `) as MdViewer;
    await el.updateComplete;
    const cards = el.shadowRoot!.querySelectorAll(".page-card");
    expect(cards.length).toBe(3);
    const labels = Array.from(cards).map(
      (c) => c.querySelector(".page-card-header")!.textContent!.trim(),
    );
    expect(labels).toEqual(["第 1 页", "第 2 页", "第 3 页"]);
  });

  it("empty pages array falls back to single .md-body", async () => {
    const el = await fixture(html`
      <md-viewer content="# T" .pages=${[]}></md-viewer>
    `) as MdViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".md-body")).toBeTruthy();
    expect(el.shadowRoot!.querySelectorAll(".page-card").length).toBe(0);
  });

  it("splits content by line_start correctly", async () => {
    // 5 行内容，3 页：page1 = lines 1-2，page2 = lines 3-4，page3 = line 5
    const content = "L1\nL2\nL3\nL4\nL5";
    const pages = [
      { label: "第 1 页", line_start: 1 },
      { label: "第 2 页", line_start: 3 },
      { label: "第 3 页", line_start: 5 },
    ];
    const el = await fixture(html`
      <md-viewer .content=${content} .pages=${pages}></md-viewer>
    `) as MdViewer;
    await el.updateComplete;
    const cards = el.shadowRoot!.querySelectorAll(".page-card");
    expect(cards.length).toBe(3);
    // page 1 的 body 应含 L1 L2
    const p1 = cards[0].textContent ?? "";
    expect(p1).toContain("L1");
    expect(p1).toContain("L2");
    expect(p1).not.toContain("L3");
    // page 2 含 L3 L4
    const p2 = cards[1].textContent ?? "";
    expect(p2).toContain("L3");
    expect(p2).toContain("L4");
    expect(p2).not.toContain("L2");
    // page 3 含 L5
    const p3 = cards[2].textContent ?? "";
    expect(p3).toContain("L5");
  });
});
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/md-viewer-pages.spec.ts
```
Expected: 5 failures (pages prop not defined on md-viewer; no .page-card rendering).

- [ ] **Step 5.3: Add `pages` property + `_splitByPages` + new render branch + CSS**

Edit `cortex/web_v2/frontend/src/components/md-viewer.ts`.

1. 在顶部 import `PageMarker` type（与 Task 4 一致）：

```typescript
import type { PageMarker } from "../api/preview";
```

2. 在 `@property()` 块中（约第 153 行 `keyword` 之后）加：

```typescript
/** 分页标记（PDF/PPTX/XLSX）；为 null 时走单块渲染 */
@property({ attribute: false }) pages: PageMarker[] | null = null;
```

3. 在 `render()` 方法之前新增 `_splitByPages` 辅助方法：

```typescript
/** 按 pages 的 line_start 把 md content 切成 N 段。
 *  line_start 是 1-indexed；返回 [{label, md}, ...]。 */
private _splitByPages(
  content: string,
  pages: PageMarker[],
): Array<{ label: string; md: string }> {
  const lines = content.split("\n");
  const chunks: Array<{ label: string; md: string }> = [];
  for (let i = 0; i < pages.length; i++) {
    const start = pages[i].line_start - 1;  // 转 0-indexed
    const end = i + 1 < pages.length ? pages[i + 1].line_start - 1 : lines.length;
    const md = lines.slice(Math.max(0, start), Math.max(0, end)).join("\n");
    chunks.push({ label: pages[i].label, md });
  }
  return chunks;
}
```

4. 替换 `render()` 方法（保留原签名）：

```typescript
render() {
  ensureMdConfigured();
  if (!this.content) {
    return html`<div class="empty">无内容</div>`;
  }
  // 分页模式：每段 = 一张卡片
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
  // 回归：单块渲染
  const raw = marked.parse(this.content, { async: false }) as string;
  return html`<div class="md-body" .innerHTML=${raw}></div>`;
}
```

5. 修改 `_locateAndHighlight` 和 `_highlightKeyword` 中的 root 选择器，让两套渲染都覆盖。

   - `_highlightKeyword`（约第 204 行）：

   找到：
   ```typescript
   const root = this.shadowRoot?.querySelector(".md-body") as HTMLElement | null;
   ```
   改为：
   ```typescript
   const root = this.shadowRoot?.querySelector(".md-body-paged, .md-body") as HTMLElement | null;
   ```

6. 追加 CSS（在 `static styles` 末尾，`</style>` 闭合前，约第 147 行 `:host mark.keyword-hit { ... }` 之后）：

```css
/* 分页卡片 */
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

- [ ] **Step 5.4: Run tests to verify they pass**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/md-viewer-pages.spec.ts
```
Expected: 5 passed.

- [ ] **Step 5.5: Run all frontend tests for regression**

```bash
cd cortex/web_v2/frontend && npx vitest run --exclude tests/e2e
```
Expected: all green.

- [ ] **Step 5.6: Commit**

```bash
git add cortex/web_v2/frontend/src/components/md-viewer.ts cortex/web_v2/frontend/tests/md-viewer-pages.spec.ts
git commit -m "feat(web): render preview pages as paper cards in md-viewer"
```

---

## Task 6: Build frontend + smoke test

**Files:**
- Build output: `cortex/web_v2/static/`

- [ ] **Step 6.1: Run TypeScript check + vite build**

```bash
cd cortex/web_v2/frontend && npm run build
```
Expected:
```
✓ 126+ modules transformed.
../static/index.html                 0.81 kB │ gzip:  0.48 kB
../static/assets/index.XXXXXXXXX.css  20.x kB
../static/assets/index.XXXXXXXXX.js  2xx kB
✓ built in <1s
```

- [ ] **Step 6.2: Verify backend + frontend tests still green**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/ 2>&1 | tail -3
cd cortex/web_v2/frontend && npx vitest run --exclude tests/e2e 2>&1 | tail -5
```
Expected: all pass.

- [ ] **Step 6.3: Manual smoke test**

启动服务：

```bash
.venv/Scripts/python.exe -m cortex gui
```

浏览器 `http://localhost:7860`，验证：

1. **PPTX**：搜索或直接打开一个多 slide 的 .pptx → 预览面板显示多张 `.page-card`，每张 header 是 `幻灯片 N · 标题`
2. **XLSX**：多 sheet 的 .xlsx → 每张卡片 header 是 `工作表 N · sheet名`
3. **PDF**：多页 PDF → 每张卡片 header 是 `第 N 页`，content 中不再有 `[PAGE` 字样
4. **回归**：md / py / csv 文件预览仍正常（单块 `.md-body`，无卡片）
5. **搜索高亮**：在 pdf/pptx 预览中触发搜索 → keyword 高亮仍能在卡片内 `<mark>` 出现
6. **行定位**：从搜索结果点击跳转 → `_locateAndHighlight` 仍能滚动到目标块（无论是否在卡片内）

- [ ] **Step 6.4: Commit built static assets**

```bash
git add cortex/web_v2/static/
git commit -m "chore(web): rebuild static assets for page markers feature"
```

---

## 完成检查

- [ ] 所有 6 个 Task 的所有 step 已勾选
- [ ] 后端 `pytest tests/web_v2/` 全绿（含 ~18 个新测试）
- [ ] 前端 `npx vitest run --exclude tests/e2e` 全绿（含 ~7 个新测试）
- [ ] `npm run build` 成功
- [ ] 手工冒烟测试 6 个场景通过
- [ ] 工作树干净

## 自审清单（已在写完时检查）

- 所有文件路径精确（绝对路径 + 行号）
- 每个 step 都有可执行的代码或命令
- TDD：测试先于实现
- 频繁 commit（每个 Task 末尾）
- 类型一致：`PageMarker`（Pydantic + TS）、`_extract_pages`、`_extract_pdf_pages`、`_extract_pptx_pages`、`_extract_excel_pages`、`_splitByPages` 在所有 task 中签名一致
- spec 的所有需求都有对应 task：
  - PageMarker 模型 → Task 1
  - PDF 剥标记 + 重算 line_start → Task 1
  - PPTX 遍历 root.nodes → Task 2
  - XLSX 遍历顶层节点 → Task 2
  - 不支持类型返回 None → Task 1（参数化测试）
  - `_synthesize_binary_preview` 接入 → Task 3
  - 前端 types + state + 透传 → Task 4
  - md-viewer 卡片渲染 + CSS → Task 5
  - 边界（单页、空数组、line_start 越界） → Task 5（测试覆盖）
  - 高亮/定位选择器更新 → Task 5 Step 5.3.5
