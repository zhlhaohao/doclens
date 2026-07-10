# PDF Image Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 PDF 文档在 Web 预览里能看到内嵌图片（用 PyMuPDF/fitz 提取图片，复用已建好的 docx/pptx 图片管线）。

**Architecture:** 图片引用作为普通 md 文本注入节点 `text`，复用现有 `render_tree_to_md` + 前端 `marked` 渲染管线，不改合成器、不破坏 `line_map`。pdf_parser 用 fitz 按页提取图片、`ImageStore` 落盘去重、每页正文文字后注入 `![图片 N](/api/preview/asset?...)`。ImageStore / `/api/preview/asset` / 前端 md-viewer / `render_tree_to_md` / `build_index` 注入逻辑全部零改动复用。

**Tech Stack:** PyMuPDF(fitz)、pdfplumber（文字，现有）、FastAPI TestClient、pytest。

## Global Constraints

- **提取后端**：PyMuPDF(fitz) — `page.get_images(full=True)` + `doc.extract_image(xref)`；AGPL-3.0（用户已确认对本项目 OK）
- **锚定**：页面级 — 每页正文文字后注入该页图片 md（复用 `[PAGE N]` 分页）
- **纯图页**（无文字层，如扫描页/纯插图页）：必须保留 — 有文字**或**图片即输出该页块（否则扫描页图片丢失）
- **source_ref**：`page{idx}:{ordinal}`（ordinal = 该页图片实例序号），保证唯一
- **去重**：复用 `ImageStore`（按 blob sha256），同图多页/多次 → 每处一个 md 引用（同 seq），存一份文件
- **依赖**：`pyproject.toml` + `requirements.txt` 加 `PyMuPDF>=1.23`（主依赖）
- **fitz 不可用**：降级 — 仅文字预览（`ImportError` → debug 日志；`Exception` → warning），不中断索引，文字功能不受影响
- **rel_path 口径**：相对 search_path 的 POSIX 路径；`doc_hash = sha256(rel_path)[:12]`（与 docx/pptx 同口径，PDF 自动适用）
- **边界**：raster 图提取；**矢量图跳过**（fitz 不 raster 化）；**扫描页整页大图本期不过滤**（Phase 3）
- **图片不参与搜索**（纯预览）
- **Python**：0710-4 worktree 无 `.venv`；用系统 `python -m pytest ...`（web_v2 测试加 `--import-mode=importlib`）
- **Git**：已授权连续执行；message `<type>: <desc>`；禁止 Co-Authored-By

## File Structure

| 文件 | 动作 | 职责 |
|------|------|------|
| `treesearch/parsers/pdf_parser.py` | ✏️ 改 | 新增 `_extract_pdf_page_images`；`extract_pdf_text` 加 `page_image_mds` 参数；`pdf_to_tree` 加 `image_store`/`rel_path` |
| `pyproject.toml` | ✏️ 改 | `dependencies` 加 `PyMuPDF>=1.23` |
| `requirements.txt` | ✏️ 改 | 加 `PyMuPDF>=1.23` |
| `tests/conftest_image_fixtures.py` | ✏️ 改 | 加 `make_pdf_with_image`（fitz 生成） |
| `tests/treesearch/test_pdf_parser.py` | 🆕 新增 | PDF 图片提取单元测试（含 fitz 降级） |
| `tests/web_v2/test_image_e2e.py` | ✏️ 改 | `e2e_env` 加 PDF + PDF preview/asset 测试 |

## 任务依赖

Task 1（核心提取）→ Task 2（E2E）。按顺序执行。

---

### Task 1: PDF 图片提取 + pdf_parser 改造

**Files:**
- Modify: `treesearch/parsers/pdf_parser.py`
- Modify: `pyproject.toml`（`dependencies` 数组，`pdfplumber` 行附近）
- Modify: `requirements.txt`
- Modify: `tests/conftest_image_fixtures.py`
- Test: `tests/treesearch/test_pdf_parser.py`（新建）

**Interfaces:**
- Consumes: `ImagePart(blob, ext, source_ref)` / `ImageStore.extract_for_doc(rel_path, parts) -> dict[str, ImageRef]`（来自 `treesearch/parsers/image_store.py`，docx/pptx 已交付）
- Produces:
  - `_extract_pdf_page_images(pdf_path: str) -> list[list[ImagePart]]`（按页，source_ref=`page{idx}:{ordinal}`）
  - `extract_pdf_text(file_path, page_image_mds: list[str] | None = None) -> str`（每页文字后追加该页图片 md；纯图页保留）
  - `pdf_to_tree(file_path="", *, pdf_path="", ..., image_store=None, rel_path=None, **kwargs)`（与 docx/pptx 同签名；`image_store=None` 时向后兼容）

- [ ] **Step 1: 加依赖声明 + PDF fixture**

**(a)** `pyproject.toml` 的 `dependencies` 数组里，在 `"pdfplumber>=0.10.0",` 行之后加一行：

```
    "PyMuPDF>=1.23",
```

**(b)** `requirements.txt` 里，在 `pdfplumber>=0.10.0` 行之后加一行：

```
PyMuPDF>=1.23
```

**(c)** `tests/conftest_image_fixtures.py` 末尾追加（复用已有的 `io`、`PNG_RED`）：

```python
def make_pdf_with_image(path: str) -> str:
    """生成一个含 1 页文字 + 1 张内嵌 PNG 的 pdf，返回路径。"""
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), "PDF 标题文本", fontsize=16)
    page.insert_text((50, 110), "下面应出现一张图片。")
    page.insert_image(fitz.Rect(50, 130, 200, 280), stream=io.BytesIO(PNG_RED))
    doc.save(path)
    doc.close()
    return path
```

- [ ] **Step 2: 写失败测试**

Create `tests/treesearch/test_pdf_parser.py`:

```python
# -*- coding: utf-8 -*-
"""PDF 图片提取单元测试（fitz 后端 + 页面级锚定 + 降级）。"""
import asyncio
import io
from pathlib import Path

import pytest

from treesearch.parsers.image_store import ImageStore, doc_hash_for
from treesearch.parsers.pdf_parser import (
    _extract_pdf_page_images,
    extract_pdf_text,
    pdf_to_tree,
)
from tests.conftest_image_fixtures import make_pdf_with_image


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def _collect_text(structure):
    out = []

    def walk(n):
        out.append(n.get("text") or "")
        for c in n.get("nodes") or []:
            walk(c)

    for n in structure:
        walk(n)
    return out


def test_extract_pdf_page_images_returns_per_page(tmp_path: Path):
    pdf = make_pdf_with_image(str(tmp_path / "s.pdf"))
    page_parts = _extract_pdf_page_images(pdf)
    assert len(page_parts) >= 1
    # 第 1 页有 1 张图
    assert len(page_parts[0]) == 1
    part = page_parts[0][0]
    assert part.ext in ("png", "jpeg", "jpg")
    assert part.source_ref == "page0:0"
    assert len(part.blob) > 0


def test_pdf_to_tree_extracts_image_into_text(tmp_path: Path):
    pdf = make_pdf_with_image(str(tmp_path / "s.pdf"))
    store = ImageStore(tmp_path / "images")
    result = _run(pdf_to_tree(
        pdf, image_store=store, rel_path="s.pdf", if_add_node_text=True,
    ))
    all_text = _collect_text(result["structure"])
    assert any("/api/preview/asset?path=s.pdf&id=1" in t for t in all_text), (
        "PDF 节点 text 缺少图片引用"
    )
    # 图片落盘
    assert (tmp_path / "images" / doc_hash_for("s.pdf") / "1.png").exists() or \
           list((tmp_path / "images" / doc_hash_for("s.pdf")).glob("1.*"))


def test_pdf_to_tree_without_image_store_still_works(tmp_path: Path):
    """向后兼容：不传 image_store 时无图片引用，文字功能正常。"""
    pdf = make_pdf_with_image(str(tmp_path / "s.pdf"))
    result = _run(pdf_to_tree(pdf, if_add_node_text=True))
    all_text = _collect_text(result["structure"])
    assert not any("/api/preview/asset" in t for t in all_text)
    # 文字仍在
    assert any("标题" in t or "图片" in t for t in all_text)


def test_pdf_to_tree_degrades_without_fitz(tmp_path: Path, monkeypatch):
    """fitz 不可用时降级：文字预览正常，无图片，不抛异常。"""
    pdf = make_pdf_with_image(str(tmp_path / "s.pdf"))
    store = ImageStore(tmp_path / "images")

    # 让 pdf_parser 内的 `import fitz` 抛 ImportError
    import builtins

    real_import = builtins.__import__

    def _fake_import(name, *args, **kwargs):
        if name == "fitz":
            raise ImportError("simulated: no fitz")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", _fake_import)

    result = _run(pdf_to_tree(
        pdf, image_store=store, rel_path="s.pdf", if_add_node_text=True,
    ))
    all_text = _collect_text(result["structure"])
    assert not any("/api/preview/asset" in t for t in all_text)  # 无图片
    assert any("标题" in t or "图片" in t for t in all_text)     # 文字正常


def test_extract_pdf_text_injects_image_md_for_image_only_page(tmp_path: Path):
    """纯图页（无文字层）也要保留并注入图片 md。"""
    # 构造一个只有图、没有可提取文字的 PDF 页：用 fitz 直接插一张图
    import fitz
    from tests.conftest_image_fixtures import PNG_RED

    pdf = str(tmp_path / "imgonly.pdf")
    doc = fitz.open()
    page = doc.new_page()
    page.insert_image(fitz.Rect(0, 0, 200, 200), stream=io.BytesIO(PNG_RED))
    doc.save(pdf)
    doc.close()

    # extract_pdf_text 不传 page_image_mds → pdfplumber 提不到文字 → 历史行为是空串
    text_no_img = extract_pdf_text(pdf)
    # 传 page_image_mds（模拟一张图）→ 该页块必须出现（不能因无文字被丢）
    text_with_img = extract_pdf_text(pdf, page_image_mds=["![图片 1](/api/preview/asset?path=x.pdf&id=1)"])
    assert "[PAGE 1]" in text_with_img, "纯图页块被丢弃（page_text 为空时不该跳过）"
    assert "/api/preview/asset?path=x.pdf&id=1" in text_with_img
    assert "/api/preview/asset" not in text_no_img  # 不传则无注入
```

- [ ] **Step 3: 运行测试确认失败**

Run: `python -m pytest tests/treesearch/test_pdf_parser.py -v`
Expected: FAIL — `_extract_pdf_page_images` 不存在 / `pdf_to_tree` 不接收 `image_store` / `extract_pdf_text` 不接收 `page_image_mds`

- [ ] **Step 4: 实现 `_extract_pdf_page_images`**

在 `treesearch/parsers/pdf_parser.py`，`extract_pdf_text` 函数之前，新增：

```python
def _extract_pdf_page_images(pdf_path: str) -> list[list]:
    """用 PyMuPDF(fitz) 按页提取内嵌 raster 图片。

    返回 page_parts[page_idx] = list[ImagePart]；每个图片实例一个 ImagePart，
    source_ref="page{idx}:{ordinal}"（唯一）。矢量图不提取（fitz get_images
    只列 raster xref）。单图 extract_image 失败 → warning + 跳过，其余继续。
    需要 PyMuPDF；不可用时由调用方捕获 ImportError 降级。
    """
    import fitz
    from .image_store import ImagePart

    doc = fitz.open(pdf_path)
    try:
        page_parts: list[list] = []
        for page_idx, page in enumerate(doc):
            parts: list = []
            for ordinal, img_info in enumerate(page.get_images(full=True)):
                xref = img_info[0]
                try:
                    img_dict = doc.extract_image(xref)
                    parts.append(ImagePart(
                        blob=img_dict["image"],
                        ext=(img_dict.get("ext") or "png").lower().lstrip("."),
                        source_ref=f"page{page_idx}:{ordinal}",
                    ))
                except Exception as e:  # noqa: BLE001
                    logger.warning("skip pdf image page%d xref%s: %s", page_idx, xref, e)
            page_parts.append(parts)
        return page_parts
    finally:
        doc.close()
```

- [ ] **Step 5: 改造 `extract_pdf_text` 加 `page_image_mds`**

把 `extract_pdf_text`（现有签名 `def extract_pdf_text(file_path: str) -> str:`）改为：

```python
def extract_pdf_text(file_path: str, page_image_mds: list[str] | None = None) -> str:
    """Extract text from a PDF file using pdfplumber.

    可选 page_image_mds：每页正文后追加的图片 md 列表（按页对齐）。
    关键：纯图页（pdfplumber 提不到文字，如扫描页/纯插图页）只要有图片 md，
    也必须输出该页块——否则扫描页图片会随空 page_text 一起被丢弃。
    """
    _check_backends()
    try:
        import pdfplumber

        parts = []
        with pdfplumber.open(file_path) as doc:
            for i, page in enumerate(doc.pages):
                page_text = _extract_page_text_with_paragraphs(page)
                img_md = (page_image_mds[i]
                          if page_image_mds and i < len(page_image_mds) else "")
                if page_text or img_md:
                    block = f"\n[PAGE {i + 1}]\n{page_text}".rstrip()
                    if img_md:
                        block += "\n\n" + img_md
                    parts.append(block)
        return "\n".join(parts)
    except Exception as e:
        logger.error("Error extracting text from %s: %s", file_path, e)
        return ""
```

> 注：原 `extract_pdf_text` 的 `try/except` 只包 `logger.error` + return ""。新版保留该兜底（整个 pdfplumber 失败时返回空串），但把 `if page_text:` 收紧逻辑改为 `if page_text or img_md:`。`_extract_page_text_with_paragraphs` 调用不变。

- [ ] **Step 6: 改造 `pdf_to_tree` 加 `image_store`/`rel_path` + 注入**

**(a)** 把 `pdf_to_tree` 签名（现有 `async def pdf_to_tree(file_path="", *, pdf_path="", model=None, ..., **kwargs)`）在 `**kwargs` 前加两个具名参数：

```python
async def pdf_to_tree(
    file_path: str = "",
    *,
    pdf_path: str = "",
    model: Optional[str] = None,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    image_store: Optional[object] = None,
    rel_path: Optional[str] = None,
    **kwargs,
) -> dict:
```

> `image_store` 用 `Optional[object]` 避免 TYPE_CHECKING 块（也可像 docx_parser 那样用 `"ImageStore | None"` 字符串注解 + TYPE_CHECKING import；二者皆可，保持与 docx_parser 一致更佳——若用字符串注解，文件顶部加 `from typing import TYPE_CHECKING` + TYPE_CHECKING 块 import ImageStore）。

**(b)** 在函数体内，把现有的 `text = extract_pdf_text(fp)` 调用替换为：先算 `page_image_mds`（fitz 提取 + ImageStore 落盘），再调 `extract_pdf_text(fp, page_image_mds=...)`：

```python
    # 图片提取 + 页面级注入（fitz 不可用则降级为纯文字）
    page_image_mds: list[str] | None = None
    if image_store is not None and rel_path:
        try:
            page_parts = _extract_pdf_page_images(fp)
            all_parts = [p for parts in page_parts for p in parts]
            refs = image_store.extract_for_doc(rel_path, all_parts) if all_parts else {}
            page_image_mds = [
                "\n\n".join(refs[p.source_ref].inline_md
                            for p in parts if p.source_ref in refs)
                or ""
                for parts in page_parts
            ]
        except ImportError:
            logger.debug("PyMuPDF not available, skip PDF image extraction: %s", fp)
        except Exception as e:  # noqa: BLE001
            logger.warning("PDF image extraction failed for %s: %s", fp, e)

    # Step 1: Extract text with [PAGE N] markers (注入每页图片 md)
    text = extract_pdf_text(fp, page_image_mds=page_image_mds)
```

（后面的 `_normalize_pdf_headings` / `_check_needs_page_fallback` / `text_to_tree` / `result["doc_name"]` / `result["source_path"]` 全部保持不变。）

- [ ] **Step 7: 运行测试确认通过**

Run: `python -m pytest tests/treesearch/test_pdf_parser.py -v`
Expected: PASS（5 个测试全过）

- [ ] **Step 8: 回归 treesearch 套件**

Run: `python -m pytest tests/treesearch/ -q`
Expected: 仅已知的 pre-existing 失败（`test_docx_table_renders_as_md_table_in_preview` tuple 解包），其余通过；无新增失败。

- [ ] **Step 9: Commit（已授权连续执行）**

```bash
git add treesearch/parsers/pdf_parser.py pyproject.toml requirements.txt \
        tests/conftest_image_fixtures.py tests/treesearch/test_pdf_parser.py
git commit -m "feat(pdf): PyMuPDF 提取内嵌图片并页面级锚定到 md"
```

---

### Task 2: PDF E2E（端到端全链路）

**Files:**
- Modify: `tests/web_v2/test_image_e2e.py`

**Interfaces:**
- Consumes: Task 1 的 `pdf_to_tree(image_store=, rel_path=)`；`make_pdf_with_image`（Task 1 加到 conftest）；docx/pptx 的 E2E 已验证 `e2e_env` 模式
- Produces: `e2e_env` fixture 增加一个 PDF 文档；2 个新测试验证 PDF 全链路

- [ ] **Step 1: `e2e_env` fixture 加 PDF**

在 `tests/web_v2/test_image_e2e.py`：

**(a)** import 行加 `make_pdf_with_image`：

```python
from tests.conftest_image_fixtures import make_docx_with_image, make_pptx_with_image, make_pdf_with_image
```

**(b)** `e2e_env` fixture 内，在 pptx 之后加 PDF，并扩展 yield 元组。把 fixture 改为（关键改动：加 `pdf_rel` + 生成 + yield 含 pdf_rel）：

```python
@pytest.fixture
def e2e_env(tmp_path: Path):
    workdir = tmp_path / "kb"
    workdir.mkdir()
    docx_rel = "报告.docx"
    pptx_rel = "演示.pptx"
    pdf_rel = "论文.pdf"
    make_docx_with_image(str(workdir / docx_rel))
    make_pptx_with_image(str(workdir / pptx_rel))
    make_pdf_with_image(str(workdir / pdf_rel))

    deps.reset_singletons()
    cfg = CortexConfig(
        search_path=str(workdir),
        index_path=str(workdir / ".cortex" / "index.db"),
    )
    mgr = IndexManager(cfg)
    mgr.load_or_build_index()
    deps._idx_manager = mgr

    app = create_app()
    client = TestClient(app)
    images_root = Path(mgr.index_path).parent / "images"
    yield client, mgr, docx_rel, pptx_rel, pdf_rel, images_root
    deps.reset_singletons()
```

**(c)** 所有**现有**测试函数的解包要同步加 `pdf_rel`（占位用 `_pdf_rel`）。例：

```python
def test_docx_preview_contains_image_markdown(e2e_env):
    client, _mgr, docx_rel, _pptx_rel, _pdf_rel, _root = e2e_env
    ...
```

把现有 6 个测试的解包元组从 `(client, _mgr, docx_rel, _pptx_rel, _root)` 改为 `(client, _mgr, docx_rel, _pptx_rel, _pdf_rel, _root)`（pptx 测试同理，把 `pptx_rel` 留名、`docx_rel` 变 `_docx_rel`，加 `_pdf_rel`）。

- [ ] **Step 2: 加 PDF 测试**

在 `test_image_e2e.py` 末尾（`test_force_rebuild_preserves_images` 之前或之后均可）追加：

```python
# ---------------------------------------------------------------------------
# pdf 全链路（Task: PDF image preview）
# ---------------------------------------------------------------------------

def test_pdf_preview_contains_image_markdown(e2e_env):
    """pdf 预览合成的 md 必须包含 ![图片 1](/api/preview/asset?...) 内联语法。"""
    client, _mgr, _docx_rel, _pptx_rel, pdf_rel, _root = e2e_env
    r = client.get("/api/preview", params={"path": pdf_rel})
    assert r.status_code == 200
    content = r.json()["content"]
    assert _IMG_MARK in content, "pdf 合成 md 缺少图片内联语法 ![图片 1]"
    assert _ASSET_URL_FRAGMENT in content, "pdf 合成 md 缺少 asset 端点 URL"


def test_pdf_asset_returns_real_image_bytes(e2e_env):
    """pdf 图片端点返回 200 + image/* Content-Type + 非空字节。"""
    client, _mgr, _docx_rel, _pptx_rel, pdf_rel, images_root = e2e_env
    img_file = images_root / doc_hash_for(pdf_rel) / "1.png"
    assert img_file.exists(), f"pdf 图片未落盘: {img_file}"

    r = client.get("/api/preview/asset", params={"path": pdf_rel, "id": 1})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/")
    assert len(r.content) > 0
```

- [ ] **Step 3: 运行测试确认通过**

Run: `python -m pytest tests/web_v2/test_image_e2e.py -v --import-mode=importlib`
Expected: PASS（原 6 + 新 2 = 8 个测试全过）

- [ ] **Step 4: 回归 web_v2 端点套件**

Run: `python -m pytest tests/web_v2/test_image_e2e.py tests/web_v2/test_preview_asset.py -v --import-mode=importlib`
Expected: 全过（pre-existing failures 在其他文件，不在此范围）

- [ ] **Step 5: Commit（已授权）**

```bash
git add tests/web_v2/test_image_e2e.py
git commit -m "test(pdf): E2E 验证 PDF 图片预览全链路"
```

---

## Self-Review

**1. Spec 覆盖检查**（对照 `2026-07-10-pdf-image-preview-design.md`）：

| Spec 要求 | 覆盖 Task |
|-----------|-----------|
| 4.1 `_extract_pdf_page_images`（fitz，source_ref=page{idx}:{ordinal}，单图失败跳过） | Task 1 Step 4 ✅ |
| 4.2 `extract_pdf_text` 加 `page_image_mds`（纯图页保留） | Task 1 Step 5 ✅ |
| 4.2 `pdf_to_tree` 加 `image_store`/`rel_path` + fitz 降级 | Task 1 Step 6 ✅ |
| 4.3 依赖声明 `PyMuPDF>=1.23`（pyproject + requirements） | Task 1 Step 1 ✅ |
| 4.4 复用 ImageStore/端点/前端（零改动） | 计划明确不改这些文件 ✅ |
| 第 5 节 错误处理（ImportError 降级 / 单图跳过 / 空页） | Task 1 Step 4/5/6 + 测试 `test_pdf_to_tree_degrades_without_fitz`、`test_extract_pdf_text_injects_image_md_for_image_only_page` ✅ |
| 第 6 节 测试（单元含降级 + E2E） | Task 1 单元 + Task 2 E2E ✅ |
| 第 7 节 Phase 3（扫描页过滤/矢量/.doc） | 本期不做，Global Constraints 声明 ✅ |

**2. 占位符扫描**：无 TBD/TODO；每步含完整代码或精确命令。✅

**3. 类型/签名一致性**：
- `_extract_pdf_page_images(pdf_path) -> list[list[ImagePart]]` — Task 1 Step 4 定义，Step 6 使用一致 ✅
- `extract_pdf_text(file_path, page_image_mds=None)` — Step 5 定义，Step 6 调用一致 ✅
- `pdf_to_tree(..., image_store=None, rel_path=None, **kwargs)` — 与 docx/pptx 同签名；registry 的 `_pdf_parser(fp, **kw)` 透传 `**kw` 到 `pdf_to_tree(file_path=fp, **kw)` ✅
- `source_ref="page{idx}:{ordinal}"` — Step 4 定义，refs 字典 key 一致 ✅
- `make_pdf_with_image(path) -> str` — Task 1 Step 1 定义，Task 2 复用 ✅
- e2e_env yield 元组从 5 元素扩到 6 元素（加 pdf_rel）—— Step 1c 提醒同步现有测试解包 ✅

无遗漏，计划完整。
