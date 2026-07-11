# PDF Image Preview — Design Spec

**Date:** 2026-07-10
**Topic:** PDF 文档预览图片可见性（解析阶段用 PyMuPDF 提取图片，复用已有 docx/pptx 图片管线）
**Status:** Approved (pending user spec review)
**Depends on:** `2026-07-10-doc-image-preview-design.md`（已实现的 ImageStore / 端点 / 前端管线）

## 1. 背景与动机

doclens 已为 docx/pptx 实现图片预览（见 `2026-07-10-doc-image-preview-design.md`，已交付）。PDF 仍是 Phase 2：预览 PDF 时看不到图片。

**根因**：`treesearch/parsers/pdf_parser.py` 的 `extract_pdf_text` 用 `pdfplumber.extract_words` 只提取文字词，完全丢弃图片（`page.images` 未用）。合成 md 无图片引用。

**PDF 图片提取的现实**：`pdfplumber` 只能给图片 bbox，提取 blob 能力很弱（需 ghostscript 或手解 pdfminer）。**PyMuPDF(fitz)** 是业界标准——`page.get_images(full=True)` + `doc.extract_image(xref)` 直接拿 `{image, ext}` blob。环境已装 `PyMuPDF 1.27.2.2`。

本 spec 把 PDF 接入已建好的图片管线：新增 fitz 提取 + 页面级锚定，**ImageStore / `/api/preview/asset` / 前端 md-viewer / `render_tree_to_md` 全部零改动复用**。

## 2. 需求总结（用户决策）

| 维度 | 决策 |
|------|------|
| 提取后端 | PyMuPDF(fitz)：`page.get_images(full=True)` → `doc.extract_image(xref)` |
| 协议 | AGPL-3.0（用户确认对本项目 OK） |
| 锚定粒度 | **页面级**：每页正文文字后注入该页图片（复用 `[PAGE N]` 分页） |
| 依赖声明 | `pyproject.toml` + `requirements.txt` 加 `PyMuPDF>=1.23`（主依赖） |
| fitz 不可用 | 降级：仅文字预览（warning），不中断 |
| 图片参与搜索 | 否（纯预览） |
| 扫描页整页大图 | **本期不过滤**（YAGNI；Phase 3 可按 `bbox≈页面尺寸` 过滤） |
| 矢量图 | 跳过（fitz 不 raster 化矢量绘制指令） |
| source_ref | `page{idx}:{ordinal}`（ordinal = 该页图片实例序号），保证唯一 |
| 去重 | 复用 ImageStore 按 blob sha256 去重；同图多页/多次出现 → 每处一个 md 引用（同 seq），存一份文件 |

## 3. 架构与数据流

关键洞察（与 docx/pptx 一致）：**图片引用就是普通 md 文本**——注入节点 `text` 后，`render_tree_to_md` 原样输出，前端 `marked` 渲染 `<img loading="lazy">`。**不改合成器、不破坏 `line_map`**。

```
索引阶段（build_index 已注入 image_store + rel_path，Task 4 成果）
  pdf_to_tree(file_path, image_store=, rel_path=, ...)
      │
      ├─ ① fitz 提取每页图片：page.get_images(full=True) → doc.extract_image(xref)
      │     → list[list[ImagePart]]（按页），source_ref="page{idx}:{ordinal}"
      │
      ├─ ② ImageStore.extract_for_doc(rel_path, all_parts)（复用，零改动）
      │     → {source_ref: ImageRef(seq, inline_md)}，落盘 .cortex/images/<doc_hash>/<seq>.<ext>
      │
      ├─ ③ extract_pdf_text(file_path, page_image_mds=...)
      │     pdfplumber 提文字（不变）+ 每页 page_text 后追加该页 inline_md
      │
      └─ ④ text_to_tree(...)（不变）→ 节点 text 含图片引用 → structure_json 落库

预览阶段（零改动，复用 docx/pptx 已建）
  GET /api/preview?path=x.pdf → render_tree_to_md（不改）→ md 含 ![](/api/preview/asset?...)
  GET /api/preview/asset?path=x.pdf&id=N → FileResponse（Task 5 端点，PDF 自动适用）
  前端 md-viewer marked 渲染 <img>（Task 6，零改动）
```

## 4. 组件设计

### 4.1 PDF 图片提取（新增 `_extract_pdf_page_images`）

放在 `treesearch/parsers/pdf_parser.py`，不可变风格（返回新列表，无副作用）：

```python
def _extract_pdf_page_images(pdf_path: str) -> list[list[ImagePart]]:
    """用 fitz 按页提取内嵌 raster 图片，返回 page_parts[page_idx]。

    每个图片实例一个 ImagePart，source_ref="page{idx}:{ordinal}"（唯一）。
    矢量图不提取（fitz get_images 只列 raster xref）。单图失败 warning + 跳过。
    """
    import fitz
    from .image_store import ImagePart

    doc = fitz.open(pdf_path)
    try:
        page_parts: list[list[ImagePart]] = []
        for page_idx, page in enumerate(doc):
            parts: list[ImagePart] = []
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

### 4.2 `pdf_parser.py` 改造

**(a) `extract_pdf_text` 增加可选 `page_image_mds`**：每页 `page_text` 后追加该页图片 md。

```python
def extract_pdf_text(file_path: str, page_image_mds: list[str] | None = None) -> str:
    # ...（现有 _extract_page_text_with_paragraphs 不变）
    parts = []
    with pdfplumber.open(file_path) as doc:
        for i, page in enumerate(doc.pages):
            page_text = _extract_page_text_with_paragraphs(page)
            img_md = (page_image_mds[i]
                      if page_image_mds and i < len(page_image_mds) else "")
            # 关键：纯图页（无文字层，如扫描页/纯插图页）也要保留
            # ——有文字或图片即输出该页块，否则扫描页图片会被丢失
            if page_text or img_md:
                block = f"\n[PAGE {i + 1}]\n{page_text}".rstrip()
                if img_md:
                    block += "\n\n" + img_md
                parts.append(block)
    return "\n".join(parts)
```

**(b) `pdf_to_tree` 加 `image_store`/`rel_path` 具名参数**（与 docx/pptx 同签名），在 `extract_pdf_text` 之前提图 + 注入；`ImportError`/`Exception` 降级：

```python
async def pdf_to_tree(
    file_path: str = "", *, pdf_path: str = "",
    model=None, if_add_node_summary=True, summary_chars_threshold=600,
    if_add_doc_description=False, if_add_node_text=False, if_add_node_id=True,
    image_store: "ImageStore | None" = None,
    rel_path: str | None = None,
    **kwargs,
) -> dict:
    fp = file_path or pdf_path
    # ...（现有 _check_backends / doc_name 不变）

    # 图片提取 + 页面级注入（fitz 不可用则降级）
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

    text = extract_pdf_text(fp, page_image_mds=page_image_mds)
    # ...（现有 _normalize_pdf_headings / _check_needs_page_fallback / text_to_tree 不变）
```

> 注：pdfplumber（文字）与 fitz（图片）各自打开同一 PDF，互不干扰。页码（pdfplumber `enumerate(doc.pages)` 与 fitz `enumerate(doc)`）一致——都按 PDF 物理页序。

### 4.3 依赖声明

`pyproject.toml`（`dependencies` 数组）+ `requirements.txt` 各加一行：

```
PyMuPDF>=1.23
```

放主依赖（PDF 图片预览是 PDF 功能的核心组成）。运行时 fitz `ImportError` 走 4.2 的降级路径。

### 4.4 复用组件（零改动）

| 组件 | 来源 | 改动 |
|------|------|------|
| `ImageStore` | Task 1（`treesearch/parsers/image_store.py`） | 无 |
| `GET /api/preview/asset` | Task 5（`doclens/web_v2/api/preview.py`） | 无（PDF 自动适用，`doc_hash_for(path)` 与文件类型无关） |
| `md-viewer` image renderer | Task 6（`md-viewer.ts`） | 无 |
| `render_tree_to_md` | `preview_synthesizer.py` | 无（图片 md 作为普通 text） |
| `build_index` 注入 `image_store`/`rel_path` | Task 4（`indexer.py`） | 无（pdf_parser 经 `**kwargs` 已能接收） |

> pdf_parser 注册在 `registry.py`，`_pdf_parser(fp, **kw)` 透传 `**kw` 到 `pdf_to_tree`，新增的 `image_store`/`rel_path` 自动经 `**kwargs` 到达。**registry.py 无需改动**。

## 5. 错误处理

| 场景 | 处理 |
|------|------|
| `PyMuPDF` 未安装 | `ImportError` → debug 日志，PDF 降级为纯文字预览（不影响文字功能） |
| 单张图片 `extract_image` 失败 | warning + 跳过该图，继续其余 |
| fitz 打开/读取 PDF 异常 | warning，整文档跳过图片（文字仍正常） |
| 空页（无图片） | `page_parts[i] = []`，`page_image_mds[i] = ""`，该页不注入 |
| 图片 blob 损坏 | `extract_image` 抛异常 → 走"单图失败"路径 |

## 6. 测试计划

**单元（pytest，用 `python -m pytest`）**
- `_extract_pdf_page_images`：含图 PDF → 按页图片列表（blob/ext/source_ref 正确）；无图 PDF → 各页空列表；单图损坏 → 跳过其余继续
- `pdf_to_tree`：含图 PDF + `image_store` → 节点 text 含 `![](/api/preview/asset?path=...&id=1)` + 图片落盘；`image_store=None` → 向后兼容（无图片引用，行为同改造前）
- `extract_pdf_text` 的 `page_image_mds` 注入：每页文字后正确追加；空 md 不追加
- fitz 降级：monkeypatch `import fitz` 抛 `ImportError` → pdf_to_tree 不抛异常，文字预览正常

**E2E（TestClient，复用 Task 7 模式）**
- 索引含图 PDF → `GET /preview` content 含图片 URL → `GET /preview/asset?path=...&id=1` 返回 200 + 图片字节 + `image/*` content-type
- force 重建后图片仍可访问（doc_hash 稳定）

**fixture**：`tests/conftest_image_fixtures.py` 加 `make_pdf_with_image(path)`——用 fitz 生成（`fitz.open()` → `new_page()` → `insert_text` + `insert_image(stream=PNG_RED)` → `save`）。复用现有 `PNG_RED`。

## 7. 边界与 Phase 3

本期不实现，预留：
- **扫描页整页大图过滤**：按 `bbox ≈ 页面尺寸` 过滤（扫描 PDF 会产出大量整页 raster，本期一律提取）
- **矢量图**：fitz 不 raster 化 PDF 矢量绘制（图表/线条），本期跳过
- **.doc 图片**：仍 Phase 2（需 LibreOffice 转 docx 再抽）

## 8. 实现工作量

由于复用 docx/pptx 已建的 ImageStore/端点/前端管线，**新增工作集中在**：
- `treesearch/parsers/pdf_parser.py`：`_extract_pdf_page_images` + `extract_pdf_text`/`pdf_to_tree` 改造（~60 行）
- `pyproject.toml` + `requirements.txt`：加 `PyMuPDF>=1.23`（2 行）
- `tests/conftest_image_fixtures.py`：`make_pdf_with_image`（~15 行）
- `tests/treesearch/test_pdf_parser.py`（新建）+ `tests/web_v2/test_image_e2e.py`（加 PDF case）

预计 1 个实现 task（含 TDD + E2E）。
