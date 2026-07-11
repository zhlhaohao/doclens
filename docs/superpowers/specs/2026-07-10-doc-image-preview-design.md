# Doc Image Preview — Design Spec

**Date:** 2026-07-10
**Topic:** docx / pptx 文档预览图片可见性（解析阶段提取图片，md 预览内联展示）
**Status:** Approved (pending user spec review)

## 1. 背景与动机

doclens 对富文档（docx / pdf / pptx / doc）的预览链路：

```
parser 解析 → Document.structure（嵌套节点 title/text/line_start）
  → structure_json 存入 SQLite (.cortex/sessions.db)
GET /api/preview → _synthesize_binary_preview
  → render_tree_to_md(structure, source_type) 合成 md
  → 前端 <md-viewer> 用 marked 渲染
```

**问题**：预览 docx / pptx 文档时看不到图片。

**根因**：四个富文档 parser 在解析阶段就完全丢弃图片：

| 类型 | parser | 现状 |
|------|--------|------|
| docx | `treesearch/parsers/docx_parser.py` | 遍历 body 只取 `p`(段落)+`tbl`(表格)，跳过 `<w:drawing>` |
| pdf | `treesearch/parsers/pdf_parser.py` | pdfplumber `extract_words` 只取文字，丢弃 `page.images` |
| pptx | `treesearch/parsers/markitdown_parser.py` | markitdown 转 md 默认不导出图片文件 |
| doc | `treesearch/parsers/doc_parser.py` | textutil/antiword/LibreOffice 只抽纯文本 |

tree 节点 `text` 里没有任何图片引用，合成 md 自然无图。前端 `<md-viewer>` 本身能渲染 `![](url)`——缺口在数据源。

## 2. 需求总结（用户决策）

| 维度 | 决策 |
|------|------|
| 覆盖类型 | 本期：docx + pptx；PDF / .doc 列 Phase 2 |
| 架构方案 | 方案 A：图片落盘 `.cortex/images/` + HTTP URL 引用 |
| 图片参与搜索 | 否（纯预览） |
| docx 锚定粒度 | 段落级：图片追加到所属段落 text 尾部 |
| pptx 锚定粒度 | slide 级：每 slide 正文后展示该 slide 全部图片 |
| 存储路径 | `.cortex/images/<sha256(rel_path)[:12]>/<seq>.<ext>` + `_meta.json` |
| 去重 | 文档内按 image part sha256 去重；不做跨文档去重 |
| 图片引用格式 | `![图片 N](/api/preview/asset?path=<rel>&id=<seq>)` |
| 前端交互 | `<img loading="lazy">`；点击放大暂不做（YAGNI） |

## 3. 架构与数据流

关键洞察：**图片引用就是普通 md 文本**——放进节点 `text` 的 `![](...)` 会被现有 `render_tree_to_md` 原样输出、被前端 marked 渲染成 `<img>`。所以**不改合成器、不破坏 `line_map`**，改动收敛在 parser 与端点。

```
索引阶段
  indexer.dispatch(file)
      │  注入 rel_path + image_store（via kwargs）
      ▼
  docx_parser / markitdown_parser
      │  ① 遍历提取图片 part（docx rId / pptx PICTURE shape）
      ▼
  ImageStore.extract_for_doc(rel, parts)
      │  ② 落盘 + 去重 + 写 _meta.json
      ▼  返回 {source_ref → (seq, inline_md)}
  parser 把 ![图片N](/api/preview/asset?...) 拼进节点 text
      ▼
  structure_json 存 DB（不变）

预览阶段
  GET /api/preview?path=x.docx
      ▼
  _synthesize_binary_preview → render_tree_to_md（不改）
      ▼  md 含图片引用
  前端 <md-viewer> marked 渲染 <img loading="lazy">
      ▼  <img> 自动请求
  GET /api/preview/asset?path=x.docx&id=N   ← 新增端点
      ▼  FileResponse(图片字节, media_type)
  图片显示
```

## 4. 组件设计

### 4.1 ImageStore（新增 `treesearch/parsers/image_store.py`）

不可变风格：方法返回新值/路径，不持有可变文档状态。单文件聚焦（<300 行）。

```python
@dataclass(frozen=True)
class ImagePart:
    blob: bytes
    ext: str            # "png" / "jpeg" / ...
    source_ref: str     # 溯源：docx rId 或 pptx "slide{N}:shape{M}"

@dataclass(frozen=True)
class ImageRef:
    seq: int
    inline_md: str      # ![图片 N](/api/preview/asset?path=...&id=N)

class ImageStore:
    def __init__(self, images_root: Path): ...
    def extract_for_doc(self, rel_path: str, parts: list[ImagePart]) -> dict[str, ImageRef]:
        """落盘 + 去重，返回 source_ref → ImageRef 映射。"""
    def resolve(self, doc_hash: str, seq: int) -> tuple[Path, str] | None:
        """端点用：返回 (文件路径, media_type)，缺失返回 None。"""
    def purge_doc(self, rel_path: str) -> None: ...
    def purge_all(self) -> None: ...
```

落盘目录：

```
.cortex/images/<sha256(rel_path)[:12]>/
    ├─ 1.png
    ├─ 2.jpeg
    └─ _meta.json   # {"1": {"sha256": "...", "media_type": "image/png"}, ...}
```

- **去重**：同 `sha256(blob)` 只落一份，多个 `source_ref` 映射到同一 seq
- **`_meta.json` 写入**：临时文件 + `os.replace` 原子化
- **media_type**：由 ext 映射（`{png: image/png, jpeg/jpg: image/jpeg, gif: image/gif, bmp: image/bmp, ...}`），缺省 `application/octet-stream`

### 4.2 docx 图片提取（改 `docx_parser.py`）

段落级锚定：`_extract_docx_headings` 遍历 body 时，对每个 paragraph 抓取 `<w:drawing>` 里的 rId，落盘后把图片 md 追加到该段 text。

```python
from docx.oxml.ns import qn

def _paragraph_image_refs(para) -> list[str]:
    """段落内所有图片 rId（按出现顺序，含 inline + anchor）。"""
    return [blip.get(qn("r:embed"))
            for blip in para._p.findall(".//" + qn("a:blip"))
            if blip.get(qn("r:embed"))]
```

流程：

1. 第一遍遍历 body：记录每段落 `(text, [rId, ...])`（保持顺序）
2. 收集唯一 rId → `doc.part.related_parts[rId]` 拿 blob/ext → 构造 `ImagePart`
3. `image_store.extract_for_doc(rel, parts)` → `{source_ref: ImageRef}`
4. 第二遍回填：每段 text 尾部追加该段图片的 `inline_md`（多图顺序追加）

**`line_map` 不受影响**：图片 md 随 text 计入行数，heading 锚点不变；前端 `lineOf` 也能定位图片所在 paragraph。

**边界**：只处理 body 级段落图片；表格 cell 内图片、老式 VML（`w:pict`）→ Phase 2。

### 4.3 pptx 图片提取（改 `markitdown_parser.py`）

slide 级锚定：markitdown 转 md（文本）后，**额外用 `python-pptx`** 按 slide 顺序提图，注入到 md 里对应 slide 块尾，再喂 `md_to_tree`。

```python
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

prs = Presentation(path)
slide_images: list[list[ImagePart]] = []
for idx, slide in enumerate(prs.slides):
    pics = []
    for shape in slide.shapes:
        if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
            img = shape.image
            pics.append(ImagePart(img.blob, img.ext, f"slide{idx}:{shape.shape_id}"))
    slide_images.append(pics)
```

- 全部 slide 图片合并一次 `extract_for_doc`，再按 slide index 在 md 对应块尾注入 `inline_md`
- **注入点**：markitdown pptx 输出每个 slide 是 `# 标题` 块 → 按 slide index 顺序追加
- 复用已有 `_patch_pptx_shape_type` 防 `shape_type` 异常

### 4.4 图片资源端点（改 `doclens/web_v2/api/preview.py`）

```
GET /api/preview/asset?path=<rel_doc>&id=<seq>
```

| 步骤 | 处理 |
|------|------|
| 越权校验 | `path` 经 `_safe_resolve` 确认在 workdir 内 |
| id 校验 | `seq` 必须纯数字（防 path traversal） |
| 定位 | `doc_hash = sha256(rel)[:12]` → `image_store.resolve(doc_hash, seq)` |
| 返回 | `FileResponse(path, media_type)`；文件缺失 → 404 |

端点用 IndexManager 注入的 `image_store`（与索引阶段同一个 `images_root`）。

### 4.5 前端（改 `md-viewer.ts`）

两处小改：

1. 注册 marked `image` renderer → 输出 `<img … loading="lazy">`
2. CSS 加 `:host img { max-width: 100%; border-radius: 4px; margin: 0.5em 0; }`

图片 URL 是后端合成时写死的绝对路径，PWA 与 FastAPI 同源，Shadow DOM 不影响 `<img>` 加载——**无需改前端 API client**。

### 4.6 索引生命周期（改 `index_manager` / `indexer`）

- `index --force`：`image_store.purge_all()` 后全量重抽
- 增量重索引：单文档 file_hash 变化 → `purge_doc(rel)` 再重抽；文件删除 → `purge_doc(rel)`
- `ImageStore` 由 IndexManager 创建并持有（`images_root = search_path/.cortex/images`）；索引时经 indexer dispatch 的 kwargs 透传给 docx/markitdown parser；API 层从 IndexManager 取同一实例做 resolve。其他 parser（pdf/doc/excel）通过 `**kwargs` 忽略 image_store

## 5. 错误处理

| 场景 | 处理 |
|------|------|
| 单图提取/落盘失败 | warning + 跳过该图，索引继续 |
| `_meta.json` 损坏 | 端点降级用文件扩展名猜 media_type |
| 端点请求图片不存在 | 404 + 友好信息 |
| `python-docx` / `python-pptx` 未装 | 走现有 `ImportError` 路径，图片功能静默禁用（文本预览不受影响） |
| 图片 blob 损坏无法识别 | 跳过该图 |
| `_meta.json` 写入 | 临时文件 + `os.replace` 原子化 |

## 6. 测试计划

**单元（pytest）**

- `ImageStore`：`extract_for_doc` 落盘 + 去重（同 blob 多 `source_ref` 只存一份）、`resolve`、`purge_doc`/`purge_all`、`_meta.json` 原子写
- `docx_parser`：含图样本 → 节点 `text` 含 `![](url)` + 图片文件落盘 + 段落级锚定位置正确
- `markitdown_parser`：含图 pptx → 每 slide 节点含图
- `/api/preview/asset`：200 + 正确 media_type、越权 404、`id` 非法 400、文件缺失 404
- `render_tree_to_md`：含图片引用的 text 正常输出，`line_map` 不偏

**集成 / E2E**（Playwright，按 CLAUDE.md 用 `playwright-cli` skill）

- 索引含图 docx/pptx → 打开预览 → `<img>` 渲染且图片可见
- `index --force` → `.cortex/images/` 清空重建后仍可见
- 增量改文件 → 重抽后图片更新

**测试样本**：准备含图片的 docx/pptx fixtures（放 `tests/fixtures/`）

## 7. 边界与 Phase 2

本期不实现，预留接口位置：

- **PDF 图片**：需引入 `PyMuPDF(fitz)` 依赖，图片与文字流锚定复杂
- **.doc 图片**：基本只能 LibreOffice 转 docx 再抽
- **docx 表格 cell 内图片**、老式 VML（`w:pict`）图片
- **图片点击放大（lightbox）**
- **图片参与搜索 / OCR**
