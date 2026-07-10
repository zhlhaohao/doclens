# Doc Image Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 docx / pptx 文档在 Web 预览里能看到原始图片（解析阶段提取图片落盘，合成 md 时插入图片引用，新增图片资源端点供前端加载）。

**Architecture:** 图片引用作为普通 md 文本嵌入 tree 节点 `text`，复用现有 `render_tree_to_md` + 前端 `marked` 渲染管线，不改合成器、不破坏 `line_map`。parser 在解析时用 `ImageStore` 把图片落盘到 `.cortex/images/<doc_hash>/<seq>.<ext>` 并在 text 内嵌 `![图片 N](/api/preview/asset?path=<rel>&id=<seq>)`；后端新增 `GET /api/preview/asset` 返回图片字节。

**Tech Stack:** python-docx、python-pptx、markitdown、FastAPI (FileResponse)、Lit + marked（前端）、pytest、Playwright。

## Global Constraints

- **覆盖范围**：仅 docx + pptx；PDF / .doc / docx 表格 cell 内图片 / VML 图片列 Phase 2，本期不实现。
- **图片不参与搜索**（纯预览），不写进 FTS 索引内容。
- **rel_path 口径**：相对 `search_path` 的 POSIX 路径（`/` 分隔）。parser 与端点必须用同一口径，否则 `doc_hash` 对不上。
- **doc_hash**：`hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:12]`。
- **images_root**：`Path(db_path).parent / "images"`（默认 = `<workdir>/.cortex/images`）。
- **图片引用格式**：`![图片 N](/api/preview/asset?path=<urlencoded rel_path>&id=<seq>)`。
- **Python 运行**：用 `.venv/Scripts/python.exe -m pytest ...`（Git Bash 下 activate 不生效）；类型注解；不可变 dataclass；每文件 < 800 行。
- **前端**：改 `doclens/web_v2/frontend/**` 后必须 `cd doclens/web_v2/frontend && npm run build` 重建 `static/`。
- **Git（用户硬规则）**：所有 `git commit` 必须等用户明确授权后才能执行；commit message 用 `<type>: <desc>` 格式（types: feat/fix/refactor/test/chore），**禁止 `Co-Authored-By`**。每个 task 末尾的 commit step 给出建议命令，但执行者必须先向用户确认。

## File Structure

| 文件 | 动作 | 职责 |
|------|------|------|
| `treesearch/parsers/image_store.py` | 🆕 新增 | `ImagePart`/`ImageRef`/`ImageStore`：落盘 + 去重 + resolve + purge + meta |
| `tests/treesearch/test_image_store.py` | 🆕 新增 | ImageStore 单元测试 |
| `tests/conftest_image_fixtures.py` | 🆕 新增 | 程序化生成含图 docx/pptx 的 fixture（最小 PNG） |
| `treesearch/parsers/docx_parser.py` | ✏️ 改 | 段落图片提取 + 段落级锚定 |
| `tests/treesearch/test_docx_parser.py` | ✏️ 改 | 含图 docx 解析 + line_map 回归 |
| `treesearch/parsers/markitdown_parser.py` | ✏️ 改 | pptx slide 图片提取 + slide 级注入 |
| `tests/treesearch/test_markitdown_parser.py` | 🆕 新增 | 含图 pptx 解析 |
| `treesearch/indexer.py` | ✏️ 改 | `build_index` 创建 `ImageStore` + purge + 经 `common` 注入 parser |
| `doclens/web_v2/api/preview.py` | ✏️ 改 | 新增 `GET /api/preview/asset` |
| `tests/web_v2/test_preview_asset.py` | 🆕 新增 | 端点测试 |
| `doclens/web_v2/frontend/src/components/md-viewer.ts` | ✏️ 改 | image renderer（lazy）+ img CSS |

## 任务依赖

Task 1 (ImageStore) → Task 2 (docx) / Task 3 (pptx) / Task 5 (端点) → Task 4 (indexer 集成) → Task 6 (前端) → Task 7 (E2E)。按编号顺序执行。

---

### Task 1: ImageStore — 落盘、去重、resolve、purge

**Files:**
- Create: `treesearch/parsers/image_store.py`
- Test: `tests/treesearch/test_image_store.py`

**Interfaces:**
- Produces:
  - `ImagePart(blob: bytes, ext: str, source_ref: str)` — frozen dataclass
  - `ImageRef(seq: int, inline_md: str)` — frozen dataclass
  - `doc_hash_for(rel_path: str) -> str` — sha256 前 12 位
  - `ImageStore(images_root: Path)`，方法：
    - `extract_for_doc(rel_path: str, parts: list[ImagePart]) -> dict[str, ImageRef]`（清空该文档图目录后重提；返回 `source_ref → ImageRef`）
    - `resolve(doc_hash: str, seq: int) -> tuple[Path, str] | None`（返回 `(文件路径, media_type)`）
    - `purge_doc(rel_path: str) -> None`
    - `purge_all() -> None`

- [ ] **Step 1: 写失败测试（落盘 + 去重 + resolve）**

Create `tests/treesearch/test_image_store.py`:

```python
# -*- coding: utf-8 -*-
"""ImageStore 单元测试。"""
from pathlib import Path

from treesearch.parsers.image_store import (
    ImagePart,
    ImageStore,
    doc_hash_for,
)


def _png_bytes(color: bytes = b"\xff\x00\x00") -> bytes:
    """生成一个 1x1 PNG（给定 RGB）。不同 color → 不同 sha256。"""
    import base64
    # 1x1 PNG 模板，IEND 前的 IDAT 用固定透明像素；这里用 base64 模板再替换不可行，
    # 改用最简方式：返回两段不同的合法 PNG（同尺寸不同色）。为测试稳定性，
    # 直接返回两段已知合法且不同的 PNG bytes。
    pngs = {
        b"\xff\x00\x00": base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
        ),
        b"\x00\xff\x00": base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAenqB0sAAAAASUVORK5CYII="
        ),
    }
    return pngs[color]


def test_extract_for_doc_writes_files_and_returns_refs(tmp_path: Path):
    store = ImageStore(tmp_path)
    blob = _png_bytes(b"\xff\x00\x00")
    parts = [ImagePart(blob=blob, ext="png", source_ref="rId1")]

    refs = store.extract_for_doc("doc/报告.docx", parts)

    assert "rId1" in refs
    ref = refs["rId1"]
    assert ref.seq == 1
    assert "/api/preview/asset?path=" in ref.inline_md and "id=1" in ref.inline_md
    dh = doc_hash_for("doc/报告.docx")
    assert (tmp_path / dh / "1.png").read_bytes() == blob
    meta_file = tmp_path / dh / "_meta.json"
    assert meta_file.exists()


def test_extract_for_doc_dedupes_same_blob(tmp_path: Path):
    store = ImageStore(tmp_path)
    blob = _png_bytes(b"\xff\x00\x00")
    # 同一 blob 被两个 rId 引用 → 只落一份文件，两个 source_ref 指向同一 seq
    parts = [
        ImagePart(blob=blob, ext="png", source_ref="rId1"),
        ImagePart(blob=blob, ext="png", source_ref="rId2"),
    ]

    refs = store.extract_for_doc("a.docx", parts)

    assert refs["rId1"].seq == refs["rId2"].seq == 1
    dh = doc_hash_for("a.docx")
    assert list((tmp_path / dh).glob("*.png")) == [(tmp_path / dh / "1.png")]


def test_resolve_returns_path_and_media_type(tmp_path: Path):
    store = ImageStore(tmp_path)
    blob = _png_bytes(b"\x00\xff\x00")
    store.extract_for_doc("a.docx", [ImagePart(blob, "png", "rId1")])

    dh = doc_hash_for("a.docx")
    resolved = store.resolve(dh, 1)
    assert resolved is not None
    path, media = resolved
    assert path.name == "1.png" and media == "image/png"


def test_resolve_missing_returns_none(tmp_path: Path):
    store = ImageStore(tmp_path)
    assert store.resolve(doc_hash_for("a.docx"), 99) is None
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/treesearch/test_image_store.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'treesearch.parsers.image_store'`

- [ ] **Step 3: 实现 ImageStore**

Create `treesearch/parsers/image_store.py`:

```python
# -*- coding: utf-8 -*-
"""图片落盘存储 —— 把富文档里提取出的图片写成磁盘文件并维护元信息。

供 docx / pptx parser 在解析阶段调用：落盘 + 文档内按 blob sha256 去重，
返回每个图片引用的 markdown 内联语法。预览端点用 ``resolve`` 反查文件。
"""
import hashlib
import json
import logging
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

logger = logging.getLogger(__name__)

# 扩展名 → MIME（缺省 application/octet-stream）
_EXT_TO_MEDIA: dict[str, str] = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "webp": "image/webp",
    "tiff": "image/tiff",
    "tif": "image/tiff",
    "svg": "image/svg+xml",
    "emf": "image/emf",
    "wmf": "image/wmf",
    "ico": "image/x-icon",
}

_META_FILENAME = "_meta.json"


@dataclass(frozen=True)
class ImagePart:
    """待落盘的一张图片。

    Attributes:
        blob: 图片二进制。
        ext: 扩展名（不含点，如 "png"）。
        source_ref: 溯源键，docx 用 rId，pptx 用 "slide{idx}:{shape_id}"。
    """
    blob: bytes
    ext: str
    source_ref: str


@dataclass(frozen=True)
class ImageRef:
    """落盘后返回的图片引用。"""
    seq: int
    inline_md: str


def doc_hash_for(rel_path: str) -> str:
    """rel_path → 12 位 sha256，用作图片子目录名。"""
    return hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:12]


def _normalize_ext(ext: str) -> str:
    return (ext or "").lower().lstrip(".")


def _inline_md(seq: int, rel_path: str) -> str:
    url = f"/api/preview/asset?path={quote(rel_path, safe='')}&id={seq}"
    return f"![图片 {seq}]({url})"


class ImageStore:
    """图片落盘存储（无运行时可变状态，仅持有 images_root）。

    所有方法基于磁盘文件操作，可被索引阶段与预览端点各自独立实例化，
    只要 ``images_root`` 指向同一目录即可。
    """

    def __init__(self, images_root: Path):
        self._root = Path(images_root)

    @property
    def root(self) -> Path:
        return self._root

    def _doc_dir(self, doc_hash: str) -> Path:
        return self._root / doc_hash

    def extract_for_doc(
        self,
        rel_path: str,
        parts: list[ImagePart],
    ) -> dict[str, ImageRef]:
        """把一个文档的图片落盘 + 去重。

        幂等：每次调用先清空该文档的图目录，再重新提取（保证重索引时无旧图残留）。
        文档内按 ``sha256(blob)`` 去重，同图只落一份，多个 source_ref 指向同一 seq。
        """
        if not parts:
            return {}
        dh = doc_hash_for(rel_path)
        doc_dir = self._doc_dir(dh)
        if doc_dir.exists():
            shutil.rmtree(doc_dir, ignore_errors=True)
        doc_dir.mkdir(parents=True, exist_ok=True)

        meta: dict[str, dict] = {}
        refs: dict[str, ImageRef] = {}
        blob_to_seq: dict[str, int] = {}
        seq = 0
        for part in parts:
            sha = hashlib.sha256(part.blob).hexdigest()
            if sha in blob_to_seq:
                s = blob_to_seq[sha]
            else:
                seq += 1
                s = seq
                blob_to_seq[sha] = s
                ext = _normalize_ext(part.ext) or "png"
                fname = f"{s}.{ext}"
                try:
                    (doc_dir / fname).write_bytes(part.blob)
                except OSError as e:
                    logger.warning("Failed to write image %s: %s", fname, e)
                    continue
                meta[str(s)] = {
                    "sha256": sha,
                    "media_type": _EXT_TO_MEDIA.get(ext, "application/octet-stream"),
                    "filename": fname,
                }
            refs[part.source_ref] = ImageRef(seq=s, inline_md=_inline_md(s, rel_path))

        self._write_meta(doc_dir, meta)
        return refs

    def resolve(self, doc_hash: str, seq: int) -> tuple[Path, str] | None:
        """端点用：按 doc_hash + seq 返回 (文件路径, media_type)，缺失返回 None。"""
        doc_dir = self._doc_dir(doc_hash)
        meta = self._load_meta(doc_dir)
        entry = meta.get(str(seq))
        if not entry:
            return None
        path = doc_dir / entry["filename"]
        if not path.exists():
            return None
        return path, entry.get("media_type", "application/octet-stream")

    def purge_doc(self, rel_path: str) -> None:
        """删除单个文档的图目录（用于源文件被删除的清理）。"""
        doc_dir = self._doc_dir(doc_hash_for(rel_path))
        if doc_dir.exists():
            shutil.rmtree(doc_dir, ignore_errors=True)

    def purge_all(self) -> None:
        """清空整个 images_root（用于 force 全量重建）。"""
        if self._root.exists():
            shutil.rmtree(self._root, ignore_errors=True)
        self._root.mkdir(parents=True, exist_ok=True)

    def _load_meta(self, doc_dir: Path) -> dict:
        mp = doc_dir / _META_FILENAME
        if not mp.exists():
            return {}
        try:
            return json.loads(mp.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            logger.warning("image meta corrupted, ignoring: %s", mp)
            return {}

    def _write_meta(self, doc_dir: Path, meta: dict) -> None:
        """原子写 _meta.json：临时文件 + os.replace。"""
        mp = doc_dir / _META_FILENAME
        tmp = mp.with_suffix(".tmp")
        tmp.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, mp)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/treesearch/test_image_store.py -v`
Expected: PASS（4 个测试全过）

- [ ] **Step 5: 补 purge 测试**

追加到 `tests/treesearch/test_image_store.py` 末尾:

```python
def test_purge_doc_removes_dir(tmp_path: Path):
    store = ImageStore(tmp_path)
    store.extract_for_doc("a.docx", [ImagePart(_png_bytes(), "png", "rId1")])
    dh = doc_hash_for("a.docx")
    assert (tmp_path / dh).exists()
    store.purge_doc("a.docx")
    assert not (tmp_path / dh).exists()


def test_purge_all_clears_root(tmp_path: Path):
    store = ImageStore(tmp_path)
    store.extract_for_doc("a.docx", [ImagePart(_png_bytes(), "png", "rId1")])
    store.extract_for_doc("b.docx", [ImagePart(_png_bytes(b"\x00\xff\x00"), "png", "rId1")])
    assert any(tmp_path.iterdir())
    store.purge_all()
    assert not any((tmp_path / d) for d in ("a", "b"))  # 子目录清空
    assert tmp_path.exists()  # root 自身保留
```

Run: `.venv/Scripts/python.exe -m pytest tests/treesearch/test_image_store.py -v`
Expected: PASS（6 个测试全过）

- [ ] **Step 6: Commit（需用户授权）**

```bash
git add treesearch/parsers/image_store.py tests/treesearch/test_image_store.py
git commit -m "feat(image): 新增 ImageStore 图片落盘/去重/resolve/purge"
```

---

### Task 2: docx 段落图片提取 + 段落级锚定

**Files:**
- Create: `tests/conftest_image_fixtures.py`（程序化生成含图 docx）
- Modify: `treesearch/parsers/docx_parser.py`
- Test: `tests/treesearch/test_docx_parser.py`（已存在，扩展）

**Interfaces:**
- Consumes: `ImagePart` / `ImageStore`（来自 Task 1）
- Produces: `docx_to_tree(docx_path, ..., image_store=None, rel_path=None, **kwargs)` 新增两个具名参数（默认 None，向后兼容）。当二者都提供时，段落 text 尾部追加该段图片的 `![图片 N](...)`。

- [ ] **Step 1: 写 fixture 辅助**

Create `tests/conftest_image_fixtures.py`:

```python
# -*- coding: utf-8 -*-
"""程序化生成含图 docx/pptx 测试 fixture，避免提交二进制文件。"""
import base64
import io
import os
import tempfile

# 两个不同的 1x1 PNG（不同 sha256），用于去重/多图测试
PNG_RED = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
)
PNG_GREEN = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAenqB0sAAAAASUVORK5CYII="
)


def make_docx_with_image(path: str, *, with_heading: bool = True) -> str:
    """生成一个含标题 + 段落 + 1 张图片的 docx，返回路径。"""
    from docx import Document
    from docx.shared import Inches

    doc = Document()
    if with_heading:
        doc.add_heading("标题一", level=1)
    doc.add_paragraph("第一段正文。")
    doc.add_picture(io.BytesIO(PNG_RED), width=Inches(1))
    doc.add_paragraph("第二段正文。")
    doc.save(path)
    return path


def make_pptx_with_image(path: str) -> str:
    """生成一个含 1 张标题 slide + 1 张图片的 pptx，返回路径。"""
    from pptx import Presentation
    from pptx.util import Inches

    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[5])  # blank
    slide.shapes.title.text = "幻灯片标题"
    slide.shapes.add_picture(io.BytesIO(PNG_RED), Inches(1), Inches(1), width=Inches(2))
    prs.save(path)
    return path
```

- [ ] **Step 2: 写失败测试（docx 图片提取 + 锚定 + line_map 回归）**

追加到 `tests/treesearch/test_docx_parser.py` 末尾（若文件无 `import`，在文件头补 `import asyncio` 和 fixture 导入）:

```python
import os
import tempfile
from pathlib import Path

from treesearch.parsers.image_store import ImageStore
from tests.conftest_image_fixtures import make_docx_with_image


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_docx_to_tree_extracts_image_into_node_text(tmp_path: Path):
    docx_path = make_docx_with_image(str(tmp_path / "sample.docx"))
    images_root = tmp_path / "images"
    store = ImageStore(images_root)

    result = _run(docx_to_tree(
        docx_path,
        image_store=store,
        rel_path="sample.docx",
        if_add_node_text=True,
    ))

    # 图片 md 引用应出现在某个节点的 text 里
    all_text = _collect_text(result["structure"])
    assert any("/api/preview/asset?path=sample.docx&id=1" in t for t in all_text)
    # 图片文件已落盘
    from treesearch.parsers.image_store import doc_hash_for
    assert (images_root / doc_hash_for("sample.docx") / "1.png").exists()


def test_docx_to_tree_without_image_store_still_works(tmp_path: Path):
    """向后兼容：不传 image_store 时行为不变（无图片引用）。"""
    docx_path = make_docx_with_image(str(tmp_path / "sample.docx"))
    result = _run(docx_to_tree(docx_path, if_add_node_text=True))
    all_text = _collect_text(result["structure"])
    assert not any("/api/preview/asset" in t for t in all_text)


def _collect_text(structure: list) -> list[str]:
    out: list[str] = []
    def walk(node):
        out.append(node.get("text") or "")
        for c in node.get("nodes") or []:
            walk(c)
    for n in structure:
        walk(n)
    return out
```

> 注：`docx_to_tree` 默认 `if_add_node_text=False` 会清空节点 text；本测试显式传 `if_add_node_text=True` 以保留 text 用于断言。测试文件若已有 `_run`/`_collect_text` 同名辅助，合并而非重复定义。

- [ ] **Step 3: 运行测试确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/treesearch/test_docx_parser.py -k image -v`
Expected: FAIL — 图片引用不存在于 text（当前 parser 跳过图片）

- [ ] **Step 4: 改造 docx_parser.py**

在 `treesearch/parsers/docx_parser.py`：

(a) 顶部 import 区补：

```python
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .image_store import ImagePart, ImageStore
```

(b) 新增图片提取辅助函数（放在 `_table_to_text` 之后、`_extract_docx_headings` 之前）:

```python
def _paragraph_image_rids(para) -> list[str]:
    """段落内所有图片的 rId（按文档顺序，含 inline + anchor）。"""
    from docx.oxml.ns import qn
    return [blip.get(qn("r:embed"))
            for blip in para._p.findall(".//" + qn("a:blip"))
            if blip.get(qn("r:embed"))]


def _docx_part_blob_ext(doc, rid: str) -> tuple[bytes, str] | None:
    """按 rId 取 image part 的 (blob, ext)，失败返回 None。"""
    try:
        part = doc.part.related_parts.get(rid)
        if part is None:
            return None
        blob = part.blob
        ext = ""
        try:
            ext = part.image.ext
        except Exception:
            partname = getattr(part, "partname", None)
            ext = partname.ext.lstrip(".") if partname and partname.ext else ""
        return blob, (ext or "png")
    except Exception as e:
        logger.warning("Failed to extract docx image part %s: %s", rid, e)
        return None
```

(c) 改造 `_extract_docx_headings` 签名 + 收集图片 + 回填。把现有函数签名改为：

```python
def _extract_docx_headings(
    docx_path: str,
    image_store: "ImageStore | None" = None,
    rel_path: str | None = None,
) -> tuple[list[dict], list[str]]:
```

在函数内 `for child in doc.element.body:` 循环中，`tag == "p"` 分支里，记录每段图片 rId；`tag == "tbl"` 分支记录空图片列表。具体：在 `lines = []` 后加 `para_image_rids: list[list[str]] = []`，循环内：

```python
        if tag == "p":
            para = Paragraph(child, doc)
            text = para.text.strip()
            rids = _paragraph_image_rids(para)
            line_num = len(lines) + 1
            lines.append(text)
            para_image_rids.append(rids)
            # ...（原有 heading 检测逻辑保持不变）...

        elif tag == "tbl":
            table = Table(child, doc)
            table_text = _table_to_text(table)
            if table_text.strip():
                lines.append(table_text)
                para_image_rids.append([])
```

在 `return headings, lines` 之前插入图片落盘 + 回填：

```python
    # 图片提取 + 段落级锚定
    if image_store is not None and rel_path:
        unique_rids: list[str] = []
        seen: set[str] = set()
        for rids in para_image_rids:
            for r in rids:
                if r and r not in seen:
                    seen.add(r)
                    unique_rids.append(r)
        parts_list = []
        for rid in unique_rids:
            be = _docx_part_blob_ext(doc, rid)
            if be is not None:
                from .image_store import ImagePart
                parts_list.append(ImagePart(blob=be[0], ext=be[1], source_ref=rid))
        refs = image_store.extract_for_doc(rel_path, parts_list) if parts_list else {}
        for i, rids in enumerate(para_image_rids):
            mds = [refs[r].inline_md for r in rids if r in refs]
            if mds:
                base = lines[i]
                lines[i] = (base + "\n\n" + "\n\n".join(mds)) if base else "\n\n".join(mds)

    return headings, lines
```

(d) 改造 `docx_to_tree` 签名，新增具名参数并透传。把签名改为：

```python
async def docx_to_tree(
    docx_path: str,
    *,
    model: Optional[str] = None,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    image_store: "ImageStore | None" = None,
    rel_path: str | None = None,
    **kwargs,
) -> dict:
```

把函数体内对 `_extract_docx_headings(docx_path)` 的调用改为 `_extract_docx_headings(docx_path, image_store=image_store, rel_path=rel_path)`。

- [ ] **Step 5: 运行测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/treesearch/test_docx_parser.py -v`
Expected: PASS（含新增 3 个图片测试 + 原有测试）

- [ ] **Step 6: line_map 回归测试（验证图片 md 不破坏合成行号）**

追加到 `tests/web_v2/test_preview_synthesizer.py`（若无此文件则新建，并 `from doclens.web_v2.preview_synthesizer import render_tree_to_md`）:

```python
def test_render_tree_to_md_preserves_image_refs_and_line_map():
    """节点 text 含图片 md 引用时，合成 md 原样保留，line_map heading 行号正确。"""
    structure = [{
        "title": "标题一", "line_start": 1, "nodes": [],
        "text": "第一段。\n\n![图片 1](/api/preview/asset?path=a.docx&id=1)",
    }]
    md, line_map = render_tree_to_md(structure, "docx")
    assert "/api/preview/asset?path=a.docx&id=1" in md
    assert line_map.get(1) is not None  # heading 行号映射存在
```

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_synthesizer.py -k image -v`
Expected: PASS（现有 render_tree_to_md 不需改动即可通过）

- [ ] **Step 7: Commit（需用户授权）**

```bash
git add tests/conftest_image_fixtures.py treesearch/parsers/docx_parser.py \
        tests/treesearch/test_docx_parser.py tests/web_v2/test_preview_synthesizer.py
git commit -m "feat(docx): 段落级图片提取并锚定到节点 text"
```

---

### Task 3: pptx slide 图片提取 + slide 级注入

**Files:**
- Modify: `treesearch/parsers/markitdown_parser.py`
- Test: `tests/treesearch/test_markitdown_parser.py`（新建）

**Interfaces:**
- Consumes: `ImagePart` / `ImageStore`（Task 1）、`make_pptx_with_image`（Task 2 fixture）
- Produces: `markitdown_to_tree(file_path, ..., image_store=None, rel_path=None, **kwargs)` 新增具名参数。pptx 且二者提供时，每 slide 正文后注入该 slide 图片引用。

- [ ] **Step 1: 探测 markitdown pptx 输出格式（确定注入锚点）**

Run:
```bash
.venv/Scripts/python.exe -c "
import tempfile, os
from tests.conftest_image_fixtures import make_pptx_with_image
p = make_pptx_with_image(os.path.join(tempfile.mkdtemp(), 's.pptx'))
from markitdown import MarkItDown
print(MarkItDown().convert(p).text_content)
"
```
Expected: 输出 markitdown 对 pptx 的 md。**观察每个 slide 的边界标记**（典型为 `<!-- Slide number: N -->` 或 `# 标题`）。记下实际格式供 Step 4 注入正则使用。

- [ ] **Step 2: 写失败测试**

Create `tests/treesearch/test_markitdown_parser.py`:

```python
# -*- coding: utf-8 -*-
import asyncio
import os
from pathlib import Path

from treesearch.parsers.image_store import ImageStore, doc_hash_for
from treesearch.parsers.markitdown_parser import markitdown_to_tree
from tests.conftest_image_fixtures import make_pptx_with_image


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _collect_text(structure):
    out = []
    def walk(n):
        out.append(n.get("text") or "")
        for c in n.get("nodes") or []:
            walk(c)
    for n in structure:
        walk(n)
    return out


def test_pptx_extracts_image_into_slide_node(tmp_path: Path):
    pptx_path = make_pptx_with_image(str(tmp_path / "s.pptx"))
    store = ImageStore(tmp_path / "images")
    result = _run(markitdown_to_tree(
        pptx_path, image_store=store, rel_path="s.pptx", if_add_node_text=True,
    ))
    all_text = _collect_text(result["structure"])
    assert any("/api/preview/asset?path=s.pptx&id=1" in t for t in all_text)
    assert (tmp_path / "images" / doc_hash_for("s.pptx") / "1.png").exists()


def test_pptx_without_image_store_still_works(tmp_path: Path):
    pptx_path = make_pptx_with_image(str(tmp_path / "s.pptx"))
    result = _run(markitdown_to_tree(pptx_path, if_add_node_text=True))
    assert not any("/api/preview/asset" in t for t in _collect_text(result["structure"]))
```

- [ ] **Step 3: 运行测试确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/treesearch/test_markitdown_parser.py -v`
Expected: FAIL — 当前 markitdown_to_tree 不接 image_store 参数 / 无图片引用

- [ ] **Step 4: 改造 markitdown_parser.py**

在 `treesearch/parsers/markitdown_parser.py`：

(a) 顶部补 import：

```python
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .image_store import ImagePart, ImageStore
```

(b) 新增 pptx 图片提取 + 注入辅助函数（文件末尾、`markitdown_to_tree` 之前）:

```python
_RE_SLIDE_COMMENT = re.compile(r"^<!--\s*Slide number:\s*(\d+)\s*-->")
_RE_H1 = re.compile(r"^#\s+\S")


def _extract_pptx_slide_images(pptx_path: str) -> list[list["ImagePart"]]:
    """用 python-pptx 按 slide 顺序提取每 slide 的图片，返回 slide_parts[i]。

    shape_type 取值可能抛 NotImplementedError（见 _patch_pptx_shape_type），
    额外用 getattr 容错。
    """
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE
    from .image_store import ImagePart

    prs = Presentation(pptx_path)
    slide_parts: list[list[ImagePart]] = []
    for idx, slide in enumerate(prs.slides):
        parts: list[ImagePart] = []
        for shape in slide.shapes:
            try:
                if shape.shape_type != MSO_SHAPE_TYPE.PICTURE:
                    continue
            except (NotImplementedError, AttributeError):
                continue
            try:
                img = shape.image
                parts.append(ImagePart(blob=img.blob, ext=img.ext or "png",
                                       source_ref=f"slide{idx}:{shape.shape_id}"))
            except Exception as e:  # noqa: BLE001
                logger.warning("skip pptx picture slide%d shape%s: %s",
                               idx, getattr(shape, "shape_id", "?"), e)
        slide_parts.append(parts)
    return slide_parts


def _inject_slide_images(md: str, slide_mds: list[str]) -> str:
    """按 slide 边界把每 slide 的图片 md 注入到对应 slide 块尾。

    优先按 ``<!-- Slide number: N -->`` 切分；否则按 H1 (``# ``) 切分；
    若切分块数 != slide 数，降级为全部图片追加到末尾（带 slide 标注）。
    """
    n = len(slide_mds)
    if n == 0 or not any(slide_mds):
        return md

    lines = md.split("\n")
    # 找边界行号（每个 slide 块起始）
    boundaries: list[int] = []
    for i, ln in enumerate(lines):
        if _RE_SLIDE_COMMENT.match(ln.strip()) or _RE_H1.match(ln.strip()):
            boundaries.append(i)
    # 用边界切分时要求块数 == n
    if boundaries and len(boundaries) >= n:
        # 每个 slide 块 = [boundaries[i], boundaries[i+1])；在块尾（下一边界前）插入
        boundaries.append(len(lines))
        out = list(lines)
        offset = 0
        for i in range(n):
            if not slide_mds[i]:
                continue
            insert_at = boundaries[i + 1] + offset
            block = ["", slide_mds[i], ""]
            out[insert_at:insert_at] = block
            offset += len(block)
        return "\n".join(out)

    # 降级：全部追加末尾
    tail = "\n\n".join(m for m in slide_mds if m)
    return md.rstrip() + "\n\n" + tail
```

> 注：顶部需 `import re`（markitdown_parser 现有文件可能未导入，确认后补）。

(c) 改造 `markitdown_to_tree` 签名 + 注入逻辑。签名改为：

```python
async def markitdown_to_tree(
    file_path: str,
    *,
    model: Optional[str] = None,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    image_store: "ImageStore | None" = None,
    rel_path: str | None = None,
    **kwargs,
) -> dict:
```

在 `md_content = result.text_content` 之后、`md_to_tree` 调用之前，插入：

```python
    # pptx 图片提取 + slide 级注入（仅 .pptx；其他 markitdown 支持类型暂不提图）
    if image_store is not None and rel_path and file_path.lower().endswith(".pptx"):
        try:
            slide_parts = _extract_pptx_slide_images(file_path)
            all_parts = [p for parts in slide_parts for p in parts]
            refs = image_store.extract_for_doc(rel_path, all_parts) if all_parts else {}
            slide_mds: list[str] = []
            for idx, parts in enumerate(slide_parts):
                mds = [refs[p.source_ref].inline_md for p in parts if p.source_ref in refs]
                slide_mds.append("\n\n".join(mds) if mds else "")
            md_content = _inject_slide_images(md_content, slide_mds)
        except ImportError:
            logger.debug("python-pptx not available, skip pptx image extraction")
        except Exception as e:  # noqa: BLE001
            logger.warning("pptx image extraction failed for %s: %s", file_path, e)
```

- [ ] **Step 5: 运行测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/treesearch/test_markitdown_parser.py -v`
Expected: PASS（2 个测试全过）。若注入位置测试失败，回到 Step 1 确认实际边界格式，调整 `_inject_slide_images` 的正则。

- [ ] **Step 6: Commit（需用户授权）**

```bash
git add treesearch/parsers/markitdown_parser.py tests/treesearch/test_markitdown_parser.py
git commit -m "feat(pptx): slide 级图片提取并注入 markitdown md"
```

---

### Task 4: indexer 集成 — 创建 ImageStore + purge + 注入 parser

**Files:**
- Modify: `treesearch/indexer.py`（`build_index` 函数，约 line 1409-1710）

**Interfaces:**
- Consumes: `ImageStore`（Task 1）
- Produces: `build_index(...)` 内部创建 `ImageStore`，经 `common` kwargs 向所有 parser 透传 `image_store` 与 `rel_path`；`force=True` 时 `purge_all`；每个待索引文件先 `purge_doc` 再由 parser 重提。

- [ ] **Step 1: 写失败测试（端到端：index 后图片落盘）**

Create `tests/treesearch/test_indexer_image_integration.py`:

```python
# -*- coding: utf-8 -*-
import asyncio
import os
from pathlib import Path

from tests.conftest_image_fixtures import make_docx_with_image


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_build_index_extracts_docx_images(tmp_path: Path):
    from treesearch.indexer import build_index

    workdir = tmp_path / "kb"
    workdir.mkdir()
    make_docx_with_image(str(workdir / "报告.docx"))
    db_path = workdir / ".cortex" / "index.db"

    docs = _run(build_index([str(workdir)], db_path=str(db_path), if_add_node_text=True))

    images_root = db_path.parent / "images"
    # 至少一个图片子目录被创建
    assert images_root.exists() and any(images_root.iterdir())
    # 文档节点 text 含图片引用
    all_text = []
    def walk(n):
        all_text.append(n.get("text") or "")
        for c in n.get("nodes") or []:
            walk(c)
    for d in docs:
        for n in d.structure:
            walk(n)
    assert any("/api/preview/asset?path=" in t and "id=1" in t for t in all_text)


def test_build_index_force_purges_all(tmp_path: Path):
    from treesearch.indexer import build_index

    workdir = tmp_path / "kb"
    workdir.mkdir()
    make_docx_with_image(str(workdir / "a.docx"))
    db_path = workdir / ".cortex" / "index.db"
    images_root = db_path.parent / "images"

    _run(build_index([str(workdir)], db_path=str(db_path), if_add_node_text=True))
    assert images_root.exists() and any(images_root.iterdir())

    # force 重建前先制造一个"孤儿"子目录，验证 purge_all 清空
    orphan = images_root / "deadbeefdead"
    orphan.mkdir(parents=True)
    (orphan / "1.png").write_bytes(b"x")

    _run(build_index([str(workdir)], db_path=str(db_path), force=True, if_add_node_text=True))
    assert not orphan.exists()  # force 清空了全部
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/treesearch/test_indexer_image_integration.py -v`
Expected: FAIL — 当前 build_index 不创建 images_root / 不注入图片

- [ ] **Step 3: 改造 build_index**

在 `treesearch/indexer.py` 的 `build_index` 函数中：

(a) 在 `db_path` 解析完成之后（line ~1470 `os.makedirs(...)` 附近）、文件遍历之前，插入 ImageStore 初始化 + force purge：

```python
    # 图片落盘存储（与 index.db 同目录的 images/ 子目录）
    from .parsers.image_store import ImageStore
    images_root = Path(db_path).parent / "images"
    image_store = ImageStore(images_root)
    if force:
        image_store.purge_all()

    # 计算 rel_path 用的 base 目录（paths 里第一个目录，即 search_path）
    base_dir = ""
    for p in paths:
        if os.path.isdir(p):
            base_dir = os.path.abspath(p)
            break
```

（确保文件顶部已 `from pathlib import Path`；若无则补。）

(b) 在 `_index_one` 函数内、构造 `common` 处（line ~1665）改为：

```python
                ext = os.path.splitext(fp)[1].lower()
                rel_path = ""
                if base_dir:
                    rel_path = os.path.relpath(fp, base_dir).replace(os.sep, "/")
                # 该文件重抽前先清掉它的旧图（幂等；force 模式已 purge_all，此处为空操作）
                if rel_path:
                    image_store.purge_doc(rel_path)
                common = dict(
                    if_add_node_summary=if_add_node_summary,
                    if_add_doc_description=if_add_doc_description,
                    if_add_node_text=if_add_node_text,
                    if_add_node_id=if_add_node_id,
                    image_store=image_store,
                    rel_path=rel_path,
                    **kwargs,
                )
```

> 注：`purge_doc` 会在该文件没图时安全跳过（目录不存在即 no-op）。

(c) prune 分支清理（可选增强）：在 `build_index` 末尾的 orphan 文件清理处（line ~1578 附近 `for pruned_path in pruned_paths:`），对被删除的二进制源文件额外 `image_store.purge_doc(rel)`。定位 `from .parsers.registry import is_binary_extension` 的循环，在其内补：

```python
                if is_binary_extension(ext):
                    # 已有的 shadow md 清理保持不变
                    ...
                    # 新增：清理被删文档的图片
                    if base_dir:
                        pruned_rel = os.path.relpath(pruned_path, base_dir).replace(os.sep, "/")
                        image_store.purge_doc(pruned_rel)
```

（若该循环结构复杂不易定位，本 step 可作为可选——核心增量是 (a)(b)，prune 清理是锦上添花。）

- [ ] **Step 4: 运行测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/treesearch/test_indexer_image_integration.py -v`
Expected: PASS（2 个测试全过）

- [ ] **Step 5: 回归现有索引测试**

Run: `.venv/Scripts/python.exe -m pytest tests/treesearch/ -v -x`
Expected: PASS（确保 image_store 注入未破坏其他 parser / 索引流程）

- [ ] **Step 6: Commit（需用户授权）**

```bash
git add treesearch/indexer.py tests/treesearch/test_indexer_image_integration.py
git commit -m "feat(indexer): build_index 集成 ImageStore 图片提取与生命周期管理"
```

---

### Task 5: GET /api/preview/asset 图片资源端点

**Files:**
- Modify: `doclens/web_v2/api/preview.py`
- Test: `tests/web_v2/test_preview_asset.py`

**Interfaces:**
- Consumes: `ImageStore`、`IndexManager`（`idx.search_path` 作 base 校验、`idx.index_path` 推 images_root）、`doc_hash_for`
- Produces: `GET /api/preview/asset?path=<rel>&id=<seq>` → `FileResponse`（图片字节 + 正确 Content-Type）

- [ ] **Step 1: 写失败测试**

Create `tests/web_v2/test_preview_asset.py`:

```python
# -*- coding: utf-8 -*-
import hashlib
from pathlib import Path

from fastapi.testclient import TestClient


def _client_with_docx_image(tmp_path: Path):
    """构造一个含已索引图片的 app + IndexManager。"""
    from doclens.web_v2.app import create_app
    from doclens.web_v2 import deps
    from doclens.index_manager import IndexManager
    from doclens.config import CortexConfig
    from tests.conftest_image_fixtures import make_docx_with_image

    workdir = tmp_path / "kb"
    workdir.mkdir()
    make_docx_with_image(str(workdir / "报告.docx"))

    deps.reset_singletons()
    cfg = CortexConfig(search_path=str(workdir),
                       index_path=str(workdir / ".cortex" / "index.db"))
    mgr = IndexManager(cfg)
    mgr.load_or_build_index()
    deps._idx_manager = mgr  # 注入单例供 DI 使用

    app = create_app()
    return TestClient(app), "报告.docx"


def test_asset_returns_image_bytes(tmp_path: Path):
    client, rel = _client_with_docx_image(tmp_path)
    r = client.get("/api/preview/asset", params={"path": rel, "id": 1})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/")
    assert len(r.content) > 0


def test_asset_rejects_traversal(tmp_path: Path):
    client, _ = _client_with_docx_image(tmp_path)
    r = client.get("/api/preview/asset", params={"path": "../../etc/passwd", "id": 1})
    assert r.status_code == 404


def test_asset_rejects_non_numeric_id(tmp_path: Path):
    client, rel = _client_with_docx_image(tmp_path)
    r = client.get("/api/preview/asset", params={"path": rel, "id": "../../x"})
    assert r.status_code in (400, 422)


def test_asset_missing_returns_404(tmp_path: Path):
    client, rel = _client_with_docx_image(tmp_path)
    r = client.get("/api/preview/asset", params={"path": rel, "id": 999})
    assert r.status_code == 404
```

> 注：`CortexConfig` 字段名以实际为准（执行者先 `grep "class CortexConfig"` 确认 search_path/index_path 字段名，必要时调整 fixture）。若项目已有 web_v2 测试 fixture 工厂，优先复用。

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_asset.py -v`
Expected: FAIL — 路由 404（端点不存在）

- [ ] **Step 3: 实现端点**

在 `doclens/web_v2/api/preview.py`：

(a) 顶部 import 区补：

```python
from fastapi.responses import FileResponse
# FileResponse 已存在则不重复；补：
from treesearch.parsers.image_store import ImageStore, doc_hash_for
```

（`hashlib` / `os` 已在该文件 import。）

(b) 在 `download` 路由之后（或 `preview` 路由之前）新增：

```python
@router.get("/preview/asset")
async def preview_asset(
    path: str = Query(..., description="文档相对路径"),
    id: int = Query(..., ge=1, description="图片序号（1-indexed）"),
    idx: IndexManager = Depends(get_index_manager),
):
    """返回文档内某张图片的字节流。

    path 经越权校验（必须在 search_path 内）；图片从
    ``<index_path>.parent/images/<doc_hash>/<seq>.<ext>`` 读取。
    """
    base = Path(idx.search_path)
    _safe_resolve(base, path)  # 越权校验，不通过则抛 FILE_NOT_FOUND

    images_root = Path(idx.index_path).parent / "images"
    store = ImageStore(images_root)
    resolved = store.resolve(doc_hash_for(path), id)
    if resolved is None:
        raise CortexAPIError(404, "IMAGE_NOT_FOUND", f"图片不存在: {path} #{id}")
    file_path, media_type = resolved
    return FileResponse(path=str(file_path), media_type=media_type)
```

> `Query(..., ge=1)` 使 id 非正/非数字时 FastAPI 自动返回 422，覆盖 traversal。

- [ ] **Step 4: 运行测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_asset.py -v`
Expected: PASS（4 个测试全过）

- [ ] **Step 5: Commit（需用户授权）**

```bash
git add doclens/web_v2/api/preview.py tests/web_v2/test_preview_asset.py
git commit -m "feat(preview): 新增 GET /api/preview/asset 图片资源端点"
```

---

### Task 6: 前端 md-viewer image renderer + CSS

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/md-viewer.ts`

**Interfaces:**
- Consumes: marked（已在用）
- Produces: `<img>` 带 `loading="lazy"`；图片样式（max-width / 圆角）

- [ ] **Step 1: 写失败测试**

`doclens/web_v2/frontend/tests/md-viewer.spec.ts` 已存在。追加（若用 vitest + jsdom）:

```typescript
import { fixture, expect } from "@open-wc/testing";
import "./md-viewer";

describe("md-viewer images", () => {
  it("renders <img loading=lazy> for markdown image", async () => {
    const el = await fixture<HTMLElement>(`<md-viewer></md-viewer>`);
    (el as any).content = "![图片 1](/api/preview/asset?path=a.docx&id=1)";
    (el as any).keyword = "";
    await el.updateComplete;
    const img = (el.shadowRoot as ShadowRoot).querySelector("img");
    expect(img).to.not.be.null;
    expect(img!.getAttribute("loading")).to.equal("lazy");
    expect(img!.getAttribute("src")).to.include("/api/preview/asset");
  });
});
```

> 若该 spec 文件用的是 Playwright 而非 vitest（见 `frontend/tests/` 实际框架），改用对应断言在真实页面上查 `md-viewer img[loading=lazy]`。执行者先看 `frontend/package.json` 的 test 脚本与现有 spec 风格。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd doclens/web_v2/frontend && npm test -- md-viewer`
Expected: FAIL — `<img>` 无 loading 属性

- [ ] **Step 3: 改造 md-viewer.ts**

(a) 在 `ensureMdConfigured` 的 `marked.use({ ... })` 里追加 `renderer.image`：

```typescript
  marked.use({
    hooks: {
      preprocess(src: string) {
        currentSrc = src;
        cursor = 0;
        return src;
      },
    },
    renderer: blockRenderer,
    // 新增：图片加 loading="lazy"
    renderer: {
      ...blockRenderer,
      image({ href, title, text }: any) {
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        return `<img src="${href}" alt="${escapeHtml(text || "")}"${titleAttr} loading="lazy">\n`;
      },
    } as any,
  });
```

> 注意 marked v18 token-style renderer：`image` 接收 token 对象（`{href, title, tokens/text}`）。若合并 `blockRenderer` 与 `image` 到一个对象报错，改为把 `image` 直接写进 `blockRenderer`（blockRenderer 是普通对象，加 `image` 键即可），并移除上面重复的 `renderer` 键，保持单个 `renderer: blockRenderer`：

```typescript
// 更稳妥：直接在 blockRenderer 对象上加 image 键
blockRenderer.image = function (token: any) {
  const titleAttr = token.title ? ` title="${escapeHtml(token.title)}"` : "";
  return `<img src="${token.href}" alt="${escapeHtml(token.text || "")}"${titleAttr} loading="lazy">\n`;
};
```
（把这段放在 `ensureMdConfigured` 调用 `marked.use({ hooks, renderer: blockRenderer })` 之前。）

(b) 在 `static styles = css\`...\`` 内追加（`:host table` 规则之后）:

```typescript
    :host img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 0.5em 0;
      display: block;
    }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd doclens/web_v2/frontend && npm test -- md-viewer`
Expected: PASS

- [ ] **Step 5: 构建前端静态产物**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 构建成功，`doclens/web_v2/static/assets/index.*.js` 更新

- [ ] **Step 6: Commit（需用户授权）**

```bash
git add doclens/web_v2/frontend/src/components/md-viewer.ts \
        doclens/web_v2/frontend/tests/md-viewer.spec.ts \
        doclens/web_v2/static
git commit -m "feat(web): md-viewer 渲染图片带 lazy 加载与自适应样式"
```

---

### Task 7: E2E 验证（Playwright）

**Files:**
- 无新增源码；准备真实含图 docx/pptx 样本到 `test_work_dir/`（或现有 KB）

**目标**：端到端验证索引 → 预览 → 图片可见，按 CLAUDE.md 用 `playwright-cli` skill。

- [ ] **Step 1: 准备含图样本并索引**

把一张真实图片的 docx（如 `test_work_dir/报告.docx`）放入 KB，运行：

```bash
.venv/Scripts/python.exe -m doclens index --force
```
（或通过 `start-app.ps1 index --force`）。确认 `.cortex/images/<hash>/` 下生成了图片文件。

- [ ] **Step 2: 启动 Web UI**

```bash
pwsh -File ./start-app.ps1 gui
```
记下日志里的实际端口（7860/7861...）。

- [ ] **Step 3: 用 playwright-cli skill 验证图片可见**

调用 `playwright-cli` skill，驱动：打开预览该 docx → 断言 `md-viewer` 内出现 `img[src*="/api/preview/asset"]` 且 `naturalWidth > 0`（图片真正加载成功，非 broken）。

- [ ] **Step 4: 验证 force 重建后图片仍可见**

再次 `index --force` → 刷新预览 → 图片仍加载（验证 purge_all + 重提后路径稳定）。

- [ ] **Step 5: 记录结果**

在 PR/commit 描述中记录 E2E 通过的证据（截图或 `naturalWidth>0` 断言成功）。

---

## Self-Review

**1. Spec 覆盖检查**（对照 `2026-07-10-doc-image-preview-design.md` 各节）：

| Spec 要求 | 覆盖 Task |
|-----------|-----------|
| 4.1 ImageStore（落盘/去重/resolve/purge/meta） | Task 1 ✅ |
| 4.2 docx 段落图片提取 + 锚定 | Task 2 ✅ |
| 4.3 pptx slide 图片提取 + 注入 | Task 3 ✅ |
| 4.4 /api/preview/asset 端点 + 越权 | Task 5 ✅ |
| 4.5 前端 image renderer + lazy + CSS | Task 6 ✅ |
| 4.6 索引生命周期（force purge_all / 增量 purge_doc） | Task 4 ✅ |
| 第 5 节 错误处理（单图失败跳过、meta 损坏降级、依赖缺失静默） | Task 1/2/3/5 内置 ✅ |
| 第 6 节 测试计划（单元 + E2E） | Task 1-6 单元 + Task 7 E2E ✅ |
| 第 7 节 Phase 2（PDF/.doc/cell/VML） | 本期不做，Global Constraints 声明 ✅ |

**2. 占位符扫描**：无 TBD/TODO；每步含完整代码或精确命令。✅

**3. 类型/命名一致性**：
- `ImagePart(blob, ext, source_ref)` / `ImageRef(seq, inline_md)` / `doc_hash_for(rel_path)` — Task 1 定义，Task 2/3/4/5 使用一致 ✅
- `extract_for_doc(rel_path, parts)` / `resolve(doc_hash, seq)` / `purge_doc(rel_path)` / `purge_all()` — 全局一致 ✅
- parser 具名参数 `image_store` / `rel_path` — docx(Task 2)、pptx(Task 3) 一致 ✅
- 端点 `path` + `id` query 与 URL 生成（Task 1 `_inline_md`）一致 ✅

无遗漏，计划完整。
