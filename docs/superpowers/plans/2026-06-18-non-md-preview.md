# 非 Markdown 文件合成 md 预览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/api/preview` 对 `.pdf/.docx/.xlsx/.xlsm/.xltx/.xltm/.csv` 文件改为从 DB `documents.structure_json` 合成 markdown 字符串返回，复用现有 `<md-viewer>` 渲染（含行定位、关键字高亮），DB 无记录时返回 `404 NOT_INDEXED`。

**Architecture:** 后端在 `cortex/web_v2/preview_synthesizer.py` 新建纯函数合成器，DFS 遍历树 → md 字符串，csv/xlsx text 解析为 md table、pdf/docx text 渲染为段落，按 `node.line_start` 填白行对齐。API 层按后缀白名单分流，DB 查询复用 `FTS5Index.load_document_by_source_path`（新增方法）。前端 `search-view.ts` 仅加 NOT_INDEXED 错误码识别和扩展"需要全文件读取"的后缀判断，`<preview-pane>` / `<md-viewer>` 零改动。

**Tech Stack:** Python 3.11+ / FastAPI / Pydantic / SQLite FTS5 / Lit + TypeScript（前端零改动）

**Spec:** `docs/superpowers/specs/2026-06-18-non-md-preview-design.md`

---

## File Structure

| 文件 | 类型 | 责任 |
|------|------|------|
| `treesearch/fts.py` | 修改 | 新增 `FTS5Index.load_document_by_source_path(source_path) -> Document \| None` |
| `cortex/web_v2/preview_synthesizer.py` | 新建 | 纯函数模块：`render_tree_to_md(structure, source_type) -> str` + 私有辅助 |
| `cortex/web_v2/api/preview.py` | 修改 | 后缀白名单 `BINARY_PREVIEW_EXTS` 分流；DB 查询；NOT_INDEXED |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 修改 | 识别 `NOT_INDEXED`；扩展"全文件预览"后缀判断 |
| `tests/web_v2/test_preview_synthesizer.py` | 新建 | 合成器单测 |
| `tests/web_v2/test_preview_api.py` | 修改 | 新增 pdf/csv/xlsx/md/txt 回归 + NOT_INDEXED |

---

## Task 1: FTS5Index 新增 `load_document_by_source_path`

**Files:**
- Modify: `treesearch/fts.py`（在 `load_document` 方法之后插入）
- Test: `tests/web_v2/test_preview_synthesizer.py`（先建空文件占位，本任务只跑独立 DB 测试）

- [ ] **Step 1.1: 先看一眼现有 `load_document` 实现作为参照**

Run: `grep -n "def load_document\b" treesearch/fts.py`
Expected: 显示 `def load_document(self, doc_id: str) -> Optional[Document]:` 行号（约 1340 行附近）

读其实现（约 20 行），确认返回的 `Document` 字段构造方式（`doc_id / doc_name / doc_description / structure / source_type / metadata`）。

- [ ] **Step 1.2: 写失败的测试**

创建 `tests/web_v2/test_preview_synthesizer.py`，先只放 DB 方法测试：

```python
"""preview_synthesizer 与 FTS5Index.load_document_by_source_path 的单测。"""
import json
import os

import pytest

from treesearch.fts import FTS5Index
from treesearch.tree import Document


@pytest.fixture
def fts_index(tmp_path):
    """构造内存映射到临时文件的 FTS5Index。"""
    db_path = str(tmp_path / "test.db")
    fts = FTS5Index(db_path=db_path)
    yield fts
    fts.close()


def _make_doc(source_path: str, source_type: str = "csv") -> Document:
    return Document(
        doc_id="doc1",
        doc_name="sample",
        structure=[{
            "title": "sample",
            "node_id": "root",
            "text": "Columns: a, b",
            "line_start": 1,
            "line_end": 1,
            "nodes": [],
        }],
        source_type=source_type,
        metadata={"source_path": source_path},
    )


def test_load_document_by_source_path_hits(fts_index):
    doc = _make_doc(source_path="/abs/path/sample.csv", source_type="csv")
    fts_index.index_document(doc)

    found = fts_index.load_document_by_source_path("/abs/path/sample.csv")
    assert found is not None
    assert found.doc_id == "doc1"
    assert found.source_type == "csv"
    assert found.structure[0]["title"] == "sample"


def test_load_document_by_source_path_miss_returns_none(fts_index):
    doc = _make_doc(source_path="/abs/path/sample.csv")
    fts_index.index_document(doc)

    assert fts_index.load_document_by_source_path("/not/indexed.csv") is None


def test_load_document_by_source_path_empty_structure(fts_index):
    """structure_json 为空字符串时应返回空 structure 而不是抛 JSONDecodeError。"""
    fts_index._conn.execute(
        "INSERT INTO documents (doc_id, doc_name, source_path, source_type, structure_json) "
        "VALUES (?, ?, ?, ?, ?)",
        ("d2", "empty", "/abs/empty.pdf", "pdf", ""),
    )
    fts_index._conn.commit()
    found = fts_index.load_document_by_source_path("/abs/empty.pdf")
    assert found is not None
    assert found.structure == []
```

- [ ] **Step 1.3: 运行测试，确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_synthesizer.py -v`
Expected: 3 个测试 FAIL，错误形如 `AttributeError: 'FTS5Index' object has no attribute 'load_document_by_source_path'`

- [ ] **Step 1.4: 实现 `load_document_by_source_path`**

在 `treesearch/fts.py` 的 `load_document` 方法之后插入：

```python
    def load_document_by_source_path(self, source_path: str) -> Optional["Document"]:
        """按 source_path 加载单个 Document（含 structure_json 反序列化）。

        Args:
            source_path: 文件绝对路径，必须与索引时存入 documents.source_path 完全一致。

        Returns:
            Document 对象；无匹配返回 None。
        """
        from .tree import Document  # 局部导入避免循环依赖

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
            doc_name=doc_name or "",
            doc_description=doc_description or "",
            structure=structure,
            source_type=source_type or "",
            metadata={"source_path": sp or ""},
        )
```

注意：`json` 已在 fts.py 顶部导入（`import json`），无需重复；`Document` 局部导入是匹配 `load_document` 的现有模式（参考 fts.py 1340 行附近的 load_document）。

- [ ] **Step 1.5: 运行测试，确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_synthesizer.py -v`
Expected: 3 个测试 PASS

- [ ] **Step 1.6: 提交**

```bash
git add treesearch/fts.py tests/web_v2/test_preview_synthesizer.py
git commit -m "feat(treesearch): add FTS5Index.load_document_by_source_path"
```

---

## Task 2: 合成器骨架 —— pdf/docx 段落渲染

**Files:**
- Create: `cortex/web_v2/preview_synthesizer.py`
- Test: `tests/web_v2/test_preview_synthesizer.py`（追加）

- [ ] **Step 2.1: 追加 3 个失败测试（pdf/docx 段落 + 嵌套层级 + 行号对齐）**

在 `tests/web_v2/test_preview_synthesizer.py` 末尾追加：

```python
from cortex.web_v2.preview_synthesizer import render_tree_to_md


def test_render_pdf_simple_node():
    structure = [{
        "title": "Introduction",
        "node_id": "intro",
        "text": "Welcome to the document.",
        "line_start": 1,
        "line_end": 1,
        "nodes": [],
    }]
    md = render_tree_to_md(structure, source_type="pdf")
    lines = md.split("\n")
    assert lines[0] == "# Introduction"
    assert "Welcome to the document." in md


def test_render_docx_nested_headings():
    structure = [{
        "title": "Chapter",
        "node_id": "ch",
        "text": "",
        "line_start": 1,
        "line_end": 1,
        "nodes": [
            {
                "title": "Section",
                "node_id": "sec",
                "text": "Section body",
                "line_start": 5,
                "line_end": 5,
                "nodes": [],
            },
        ],
    }]
    md = render_tree_to_md(structure, source_type="docx")
    lines = md.split("\n")
    assert lines[0] == "# Chapter"
    # line_start=5 → Section heading 出现在第 5 行（1-indexed），即 lines[4]
    assert lines[4] == "## Section"
    assert "Section body" in md


def test_render_heading_level_capped_at_h6():
    """7 层嵌套时最深节点用 ######（不能更多）。"""
    def nest(depth):
        if depth == 0:
            return {"title": "deep", "node_id": "d", "text": "x",
                    "line_start": 1, "line_end": 1, "nodes": []}
        return {"title": f"L{depth}", "node_id": f"n{depth}", "text": "",
                "line_start": 1, "line_end": 1, "nodes": [nest(depth - 1)]}

    structure = [nest(6)]
    md = render_tree_to_md(structure, source_type="pdf")
    # 深度 6（0-indexed）对应 level=7，cap 到 6
    assert "###### deep" in md
    assert "#######" not in md  # 不应有 7 个 #


def test_render_node_missing_line_start_defaults_to_1():
    """line_start=None 时不报错，heading 从第 1 行开始。"""
    structure = [{"title": "x", "node_id": "x", "text": "y", "nodes": []}]
    md = render_tree_to_md(structure, source_type="pdf")
    assert md.split("\n")[0] == "# x"
```

- [ ] **Step 2.2: 运行测试，确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_synthesizer.py::test_render_pdf_simple_node -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'cortex.web_v2.preview_synthesizer'`

- [ ] **Step 2.3: 创建合成器骨架（仅段落分支，csv/excel 占位为段落）**

创建 `cortex/web_v2/preview_synthesizer.py`：

```python
"""把 treesearch Document.structure 合成为 markdown 字符串。

供 /api/preview 在二进制文档（pdf/docx/xlsx/csv）场景下使用：
DB 里已存结构化树，本模块把它拍平为 md 字符串，复用前端 <md-viewer> 渲染。
"""
from typing import Any, Iterable

# 后缀 → 渲染分支的 source_type 判断键
_TABLE_SOURCE_TYPES = frozenset({"csv", "excel"})


def render_tree_to_md(structure: Any, source_type: str) -> str:
    """把 Document.structure（list 或 dict）合成为 markdown 字符串。

    Args:
        structure: treesearch 的树结构根节点列表（或单根 dict）。
        source_type: Document.source_type，决定节点 text 走段落还是 table。

    Returns:
        markdown 源字符串。每个 heading 所在行 == 该节点的 line_start
        （通过填白行对齐），便于前端 <md-viewer> 的 data-source-line 定位。
    """
    out: list[str] = []
    roots: Iterable[dict]
    if isinstance(structure, dict):
        roots = [structure]
    elif isinstance(structure, list):
        roots = structure
    else:
        return ""
    for root in roots:
        _emit_node(out, root, depth=0, source_type=source_type)
    return "\n".join(out)


def _emit_node(out: list[str], node: dict, depth: int, source_type: str) -> None:
    """DFS 把单个节点输出为 heading + body。"""
    line_start = node.get("line_start") or 1
    title = node.get("title", "") or ""
    text = node.get("text") or ""
    children = node.get("nodes") or []

    # 行号对齐：填白让 heading 出现在第 line_start 行（1-indexed）
    while len(out) + 1 < line_start:
        out.append("")

    level = min(depth + 1, 6)  # md 只有 h1-h6
    out.append("#" * level + " " + title)

    # csv 根节点：聚合子节点，table 块负责，短路递归避免重复 heading
    if source_type == "csv" and children and text.lstrip().startswith("Columns:"):
        _emit_table_block(out, text, children, source_type)
        return

    if source_type in _TABLE_SOURCE_TYPES:
        _emit_table_block(out, text, children, source_type)
    elif text:
        out.append("")
        out.extend(text.split("\n"))
        out.append("")

    for child in children:
        _emit_node(out, child, depth + 1, source_type=source_type)


def _emit_table_block(
    out: list[str],
    text: str,
    children: list[dict],
    source_type: str,
) -> None:
    """csv/xlsx: text 解析为 md table。Task 3 实现，此处先退化段落输出。"""
    # TODO: Task 3 替换为真正的 md table 实现
    body_lines = text.split("\n") if text else []
    if body_lines:
        out.append("")
        out.extend(body_lines)
        out.append("")
```

注意：`_emit_table_block` 的真正实现在 Task 3 完成，此处先段落输出保证测试只校验段落分支。

- [ ] **Step 2.4: 运行测试，确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_synthesizer.py -v`
Expected: 之前 3 个 DB 测试 + 4 个新单测全部 PASS

- [ ] **Step 2.5: 提交**

```bash
git add cortex/web_v2/preview_synthesizer.py tests/web_v2/test_preview_synthesizer.py
git commit -m "feat(web_v2): add preview_synthesizer skeleton with paragraph rendering"
```

---

## Task 3: 合成器 —— csv/xlsx md table 渲染

**Files:**
- Modify: `cortex/web_v2/preview_synthesizer.py`
- Test: `tests/web_v2/test_preview_synthesizer.py`（追加）

- [ ] **Step 3.1: 追加 4 个失败测试**

在 `tests/web_v2/test_preview_synthesizer.py` 末尾追加：

```python
def test_render_xlsx_to_md_table():
    """xlsx 单节点 text 自带 header + 所有数据行。"""
    structure = [{
        "title": "Sheet1 (2 rows)",
        "node_id": "s1",
        "text": "Columns: a, b\na: 1; b: 2\na: 3; b: 4",
        "line_start": 1,
        "line_end": 3,
        "nodes": [],
    }]
    md = render_tree_to_md(structure, source_type="excel")
    lines = md.split("\n")
    assert lines[0] == "# Sheet1 (2 rows)"
    # 第 2 行起应是空行 + 表头 + 分隔 + 数据
    assert "| a | b |" in md
    assert "| --- | --- |" in md
    assert "| 1 | 2 |" in md
    assert "| 3 | 4 |" in md


def test_render_csv_aggregates_children():
    """csv 根节点 text 只有 header，数据在 level-2 子节点。"""
    structure = [{
        "title": "data",
        "node_id": "root",
        "text": "Columns: a, b",
        "line_start": 1,
        "line_end": 1,
        "nodes": [
            {"title": "r1", "node_id": "r1", "text": "a: 1; b: 2",
             "line_start": 2, "line_end": 2, "nodes": []},
            {"title": "r2", "node_id": "r2", "text": "a: 3; b: 4",
             "line_start": 3, "line_end": 3, "nodes": []},
        ],
    }]
    md = render_tree_to_md(structure, source_type="csv")
    # table 聚合后，子节点不应再单独输出 ## r1 / ## r2
    assert "## r1" not in md
    assert "## r2" not in md
    # 数据行应在 table 内
    assert "| a | b |" in md
    assert "| 1 | 2 |" in md
    assert "| 3 | 4 |" in md


def test_render_table_falls_back_to_paragraph_when_not_columns():
    """text 不以 Columns: 开头时退化为段落，不抛错。"""
    structure = [{
        "title": "weird",
        "node_id": "w",
        "text": "just some text\nsecond line",
        "line_start": 1,
        "line_end": 2,
        "nodes": [],
    }]
    md = render_tree_to_md(structure, source_type="excel")
    # 不应出现 table 分隔符
    assert "|" not in md.split("\n")[2]
    assert "just some text" in md
    assert "second line" in md


def test_render_table_escapes_pipe_in_cell():
    """cell 含 | 时转义为 \\|，避免破坏 table 结构。"""
    structure = [{
        "title": "s",
        "node_id": "s",
        "text": "Columns: a\na: 1|2",
        "line_start": 1,
        "line_end": 2,
        "nodes": [],
    }]
    md = render_tree_to_md(structure, source_type="excel")
    assert "| 1\\|2 |" in md
```

- [ ] **Step 3.2: 运行测试，确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_synthesizer.py::test_render_xlsx_to_md_table -v`
Expected: FAIL — 断言 `| a | b |` 不在 md 中（当前 table block 是段落输出）

- [ ] **Step 3.3: 实现 `_emit_table_block` 与辅助函数**

在 `cortex/web_v2/preview_synthesizer.py` 顶部加入 `import re`，并替换 `_emit_table_block` 函数：

```python
import re
from typing import Any, Iterable

# 后缀 → 渲染分支的 source_type 判断键
_TABLE_SOURCE_TYPES = frozenset({"csv", "excel"})

_COLS_RE = re.compile(r"^Columns:\s*(.+)$")
```

替换 `_emit_table_block`：

```python
def _emit_table_block(
    out: list[str],
    text: str,
    children: list[dict],
    source_type: str,
) -> None:
    """csv/xlsx: text 解析为 md table。

    - xlsx: text 自带 header + 所有数据行（单节点自包含）
    - csv:  text 只有 header，数据在 level-2 子节点 text 里，需聚合
    """
    body_lines = text.split("\n") if text else []

    # csv 根节点聚合所有子节点 text
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
        if not row_line.strip():
            continue
        cells = _parse_kv_row(row_line)
        out.append("| " + " | ".join(_escape_md_cell(cells.get(h, "")) for h in headers) + " |")
    out.append("")


def _parse_kv_row(line: str) -> dict[str, str]:
    """把 'h: v; h: v' 解析成 dict；缺失列留空。

    例：'a: 1; b: 2' → {'a': '1', 'b': '2'}
    """
    result: dict[str, str] = {}
    for pair in line.split(";"):
        if ":" not in pair:
            continue
        k, v = pair.split(":", 1)
        result[k.strip()] = v.strip()
    return result


def _escape_md_cell(s: str) -> str:
    """md table 单元格转义：| → \\|，换行 → 空格，回车删除。"""
    return s.replace("|", "\\|").replace("\n", " ").replace("\r", "")
```

- [ ] **Step 3.4: 运行测试，确认全通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_synthesizer.py -v`
Expected: 11 个测试（3 DB + 4 段落 + 4 table）全部 PASS

- [ ] **Step 3.5: 提交**

```bash
git add cortex/web_v2/preview_synthesizer.py tests/web_v2/test_preview_synthesizer.py
git commit -m "feat(web_v2): render csv/xlsx as md table in preview synthesizer"
```

---

## Task 4: 修改 `/api/preview` —— 后缀白名单分流

**Files:**
- Modify: `cortex/web_v2/api/preview.py`
- Test: `tests/web_v2/test_preview_api.py`（Task 6 集中扩展；本任务先跑回归测试）

- [ ] **Step 4.1: 阅读现状**

Run: `cat cortex/web_v2/api/preview.py`
确认：现有 `preview()` 函数读磁盘 utf-8 → `PreviewResponse`。

- [ ] **Step 4.2: 修改 `cortex/web_v2/api/preview.py`**

在文件顶部 import 块下方加入：

```python
import os

from cortex.web_v2.preview_synthesizer import render_tree_to_md

# 这些后缀的文件磁盘 utf-8 读取会出乱码；改为从 DB 合成 md 预览
BINARY_PREVIEW_EXTS = frozenset({
    ".pdf", ".docx",
    ".xlsx", ".xlsm", ".xltx", ".xltm",
    ".csv",
})
```

修改 `preview()` 函数体，在 `_safe_resolve` 之后插入分支：

```python
@router.get("/preview", response_model=PreviewResponse)
async def preview(
    path: str = Query(..., description="相对路径"),
    start_line: int = Query(default=0, ge=0),
    end_line: int = Query(default=0, ge=0),
    idx: IndexManager = Depends(get_index_manager),
):
    base = Path(idx.search_path)
    full = _safe_resolve(base, path)

    # 二进制文档：走 DB 合成 md 路径
    if full.suffix.lower() in BINARY_PREVIEW_EXTS:
        return _synthesize_binary_preview(idx, path)

    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {path}")

    try:
        text = full.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        raise CortexAPIError(500, "INTERNAL_ERROR", f"读取失败: {e}") from e

    lines = text.split("\n")
    if start_line > 0 or end_line > 0:
        s = max(0, start_line - 1)
        e = end_line if end_line > 0 else len(lines)
        content = "\n".join(lines[s:e])
        line_range = (s + 1, e)
    else:
        content = text
        line_range = None

    return PreviewResponse(
        path=path,
        language=_LANGUAGE_MAP.get(full.suffix.lower(), "text"),
        content=content,
        line_range=line_range,
        highlights=[],
    )


def _synthesize_binary_preview(idx: IndexManager, rel_path: str) -> PreviewResponse:
    """从 DB 读 structure_json → 合成 md → 返回 language=markdown。"""
    from treesearch.fts import FTS5Index

    abs_path = os.path.abspath(os.path.join(idx.search_path, rel_path))
    fts = FTS5Index(db_path=idx.index_path)
    try:
        doc = fts.load_document_by_source_path(abs_path)
        # 防御性双查：部分历史索引可能用相对路径存
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
    return PreviewResponse(
        path=rel_path,
        language="markdown",
        content=md_content,
        line_range=None,
        highlights=[],
    )
```

**关键点**：
- `full.suffix.lower() in BINARY_PREVIEW_EXTS` 检查放在 `_safe_resolve` 之后——`_safe_resolve` 已做路径越权检查，二进制分支不再二次读磁盘
- `_safe_resolve` 原本在 `if not full.exists()` 之前，现保留位置不变；二进制分支不需要 `full.exists()`（DB 查不到就报 NOT_INDEXED）
- 局部 `from treesearch.fts import FTS5Index` 匹配 IndexManager 已有模式（参考 `index_manager.py:111`、`438`）
- `idx.index_path` 是 IndexManager 已有属性（参考 `index_manager.py:40`）

- [ ] **Step 4.3: 跑现有回归测试，确认 md/txt 路径未受影响**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_api.py -v`
Expected: 2 个现有测试（`test_preview_returns_file_content`、`test_preview_404_for_missing_file`）继续 PASS

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/ -v`
Expected: 全部 web_v2 测试 PASS

- [ ] **Step 4.4: 提交**

```bash
git add cortex/web_v2/api/preview.py
git commit -m "feat(web_v2): route binary docs through DB-synthesized md preview"
```

---

## Task 5: 前端 —— NOT_INDEXED 处理 + 全文件预览后缀扩展

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/search-view.ts`

- [ ] **Step 5.1: 阅读现状**

Run: `grep -n "isMarkdown\|previewContent\|previewLanguage\|/api/preview" cortex/web_v2/frontend/src/views/search-view.ts`

确认：
- 当前 `isMarkdown = r.path.toLowerCase().endsWith(".md")` 控制是否切片（md 走全文件）
- 错误仅 `console.warn`，无 UI 兜底
- `previewContent/previewPath/previewLanguage/previewLine` 4 个 state

- [ ] **Step 5.2: 扩展"全文件预览"后缀判断**

在 `search-view.ts` 顶部 import 块下方加入：

```typescript
/** 这些后缀的预览走 md 渲染且需要全文件内容（与后端 BINARY_PREVIEW_EXTS 对齐） */
const FULL_FILE_PREVIEW_EXTS = [".md", ".pdf", ".docx", ".xlsx", ".xlsm", ".xltx", ".xltm", ".csv"];

function isFullFilePreview(path: string): boolean {
  const lower = path.toLowerCase();
  return FULL_FILE_PREVIEW_EXTS.some((ext) => lower.endsWith(ext));
}
```

把 `_onResultSelect` 里的判断从 `isMarkdown` 改为 `isFullFilePreview`：

```typescript
private async _onResultSelect(e: CustomEvent<{ result: SearchResult }>) {
  const r = e.detail.result;
  actions.pushDetail(r);
  this.previewError = null;  // 重置错误态
  try {
    const params = new URLSearchParams({ path: r.path });
    // md 与二进制合成 md 走 md-viewer 渲染：需要全文件以保持
    // data-source-line 与绝对行号一致，否则 md-viewer 的行号映射会偏移。
    // 非 markdown（纯文本视图）保留 30 行窗口切片以节省渲染。
    const fullFile = isFullFilePreview(r.path);
    if (r.line && !fullFile) {
      params.set("start_line", String(Math.max(1, r.line - 10)));
      params.set("end_line", String(r.line + 20));
    }
    const res = await fetch(`/api/preview?${params}`);
    if (res.ok) {
      const body = await res.json();
      this.previewContent = body.content;
      this.previewPath = body.path;
      this.previewLanguage = body.language;
      this.previewLine = (r.line as number | null) ?? null;
    } else {
      const err = await res.json().catch(() => ({ code: "UNKNOWN", detail: "" }));
      if (err.code === "NOT_INDEXED") {
        this.previewError = "NOT_INDEXED";
        this.previewContent = "";
        this.previewPath = r.path;
      }
    }
  } catch (e) {
    console.warn("preview failed", e);
  }
}
```

在 `SearchView` 类的字段声明区追加（与其它 `@state()` 同区）：

```typescript
@state() private previewError: string | null = null;
```

- [ ] **Step 5.3: 在 `<preview-pane>` 调用处加未索引兜底渲染**

`render()` 方法里 focus 状态的两处 `<preview-pane>` 都需要：未索引时不传 content，让 `<preview-pane>` 显示 `.empty`。最简单做法是在传参时清空 content：

把 render 中 focus 状态的两处 preview-pane 的 `content=${this.previewContent}` 改为：

```typescript
content=${this.previewError === "NOT_INDEXED" ? "" : this.previewContent}
```

但为了让"未索引"提示更明确，更好的做法是在 `<preview-pane>` 外层加条件。不过 `<preview-pane>` 已有 `.empty` 提示"点击左侧结果查看预览"，文案不准确。

**选择最小改动方案**：在 `search-view.ts` 的 `focus-main` 与 `detail-overlay` 两处，把 `<preview-pane>` 包条件渲染。当 `previewError === "NOT_INDEXED"` 时显示自定义提示层。

修改 focus-main 桌面端 preview-pane 块（第 267-274 行附近）：

```typescript
${this.previewError === "NOT_INDEXED"
  ? html`<div class="desktop-only" style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--cortex-text-subtle);padding:24px;text-align:center;">
      该文件未索引，无法预览。<br>请先执行 cortex index 后重试。
    </div>`
  : html`<preview-pane
      class="desktop-only"
      path=${this.previewPath}
      language=${this.previewLanguage}
      content=${this.previewContent}
      .line=${this.previewLine}
      .keyword=${s.query}>
    </preview-pane>`}
```

修改 detail-overlay 内的 preview-pane 块（第 294-300 行附近）：

```typescript
${this.previewError === "NOT_INDEXED"
  ? html`<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--cortex-text-subtle);padding:24px;text-align:center;">
      该文件未索引，无法预览。<br>请先执行 cortex index 后重试。
    </div>`
  : html`<preview-pane
      path=${this.previewPath}
      language=${this.previewLanguage}
      content=${this.previewContent}
      .line=${this.previewLine}
      .keyword=${s.query}>
    </preview-pane>`}
```

- [ ] **Step 5.4: 类型检查 + 前端构建**

Run:
```bash
cd cortex/web_v2/frontend && npm run build
```
Expected: 构建成功（无 TS 错误），输出到 `cortex/web_v2/static/`

- [ ] **Step 5.5: 提交**

```bash
git add cortex/web_v2/frontend/src/views/search-view.ts cortex/web_v2/static
git commit -m "feat(web_v2): handle NOT_INDEXED preview error and extend full-file preview exts"
```

---

## Task 6: API 集成测试扩展

**Files:**
- Modify: `tests/web_v2/conftest.py`（新增 csv fixture 文件）
- Modify: `tests/web_v2/test_preview_api.py`

- [ ] **Step 6.1: 在 conftest.py 加 csv fixture 文件**

修改 `tests/web_v2/conftest.py` 的 `temp_workdir` fixture，在写完 doc1.md/doc2.py 之后追加：

```python
    (tmp_path / "data.csv").write_text(
        "name,age\nAlice,30\nBob,25\n",
        encoding="utf-8",
    )
```

完整 fixture 改为：

```python
@pytest.fixture
def temp_workdir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """创建临时工作目录，含几个示例文档。"""
    (tmp_path / "doc1.md").write_text("# Doc 1\n\nHello world from doc1.", encoding="utf-8")
    (tmp_path / "doc2.py").write_text("def hello():\n    return 'world'\n", encoding="utf-8")
    (tmp_path / "data.csv").write_text(
        "name,age\nAlice,30\nBob,25\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)
    return tmp_path
```

- [ ] **Step 6.2: 在 test_preview_api.py 写 5 个新测试**

在 `tests/web_v2/test_preview_api.py` 末尾追加：

```python
import os

import pytest

from cortex.config import CortexConfig
from cortex.index_manager import IndexManager


@pytest.fixture
def indexed_csv(temp_workdir, env_cortex_config):
    """触发一次索引，让 data.csv 进入 DB。"""
    cfg = CortexConfig()
    idx = IndexManager(cfg)
    idx.reindex()
    return temp_workdir / "data.csv"


@pytest.mark.asyncio
async def test_preview_csv_returns_markdown(indexed_csv, env_cortex_config):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "data.csv"})
    assert res.status_code == 200
    body = res.json()
    assert body["language"] == "markdown"
    assert "# data" in body["content"]
    # 应渲染为 md table
    assert "| name | age |" in body["content"]
    assert "| Alice | 30 |" in body["content"]


@pytest.mark.asyncio
async def test_preview_unindexed_pdf_returns_404(temp_workdir, env_cortex_config):
    """未索引的 .pdf 文件应返回 404 NOT_INDEXED（不读磁盘 utf-8）。"""
    # 故意不索引；temp_workdir 里也没有这个文件
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "missing.pdf"})
    assert res.status_code == 404
    body = res.json()
    assert body["code"] == "NOT_INDEXED"


@pytest.mark.asyncio
async def test_preview_txt_still_uses_text_route(temp_workdir, env_cortex_config):
    """回归：.txt 仍走 utf-8 纯文本路径，language='text'。"""
    (temp_workdir / "notes.txt").write_text("plain text note", encoding="utf-8")
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "notes.txt"})
    assert res.status_code == 200
    body = res.json()
    assert body["language"] == "text"
    assert body["content"] == "plain text note"


@pytest.mark.asyncio
async def test_preview_md_unchanged(temp_workdir, env_cortex_config):
    """回归：.md 仍走 utf-8 直读路径，content 为原文件内容（非 DB 合成）。"""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "doc1.md"})
    assert res.status_code == 200
    body = res.json()
    assert body["language"] == "markdown"
    # 原文件内容应包含 "Hello world from doc1."
    assert "Hello world from doc1." in body["content"]


@pytest.mark.asyncio
async def test_preview_csv_path_traversal_blocked(env_cortex_config):
    """越权路径应被 _safe_resolve 拦截，返回 FILE_NOT_FOUND。"""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "../../../etc/passwd.csv"})
    # 路径越权，_safe_resolve 抛 FILE_NOT_FOUND；由于后缀 .csv 在白名单，
    # 走二进制分支前已先 _safe_resolve 校验，返回 FILE_NOT_FOUND 而非 NOT_INDEXED
    assert res.status_code == 404
    assert res.json()["code"] == "FILE_NOT_FOUND"
```

注意：第 5 个测试依赖于"白名单分支在 `_safe_resolve` 之后"的实现细节。若 Step 4.2 实现顺序变了（白名单分支在 `_safe_resolve` 之前），需要把白名单检查改在 `_safe_resolve` 之后，保证越权路径一律 FILE_NOT_FOUND。

- [ ] **Step 6.3: 跑新测试**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_api.py -v`
Expected: 2 个旧测试 + 5 个新测试全部 PASS

如果有测试失败：
- `test_preview_csv_returns_markdown` 失败可能原因：IndexManager.reindex 签名/调用方式不对。运行 `.venv/Scripts/python.exe -c "from cortex.index_manager import IndexManager; print([m for m in dir(IndexManager) if 'index' in m.lower()])"` 找正确方法名（可能是 `reindex()` 或 `reindex(force=True)` 或 `build_index()`）
- `test_preview_csv_path_traversal_blocked` 失败可能原因：白名单分支位置不对。确认 `_safe_resolve` 在白名单检查之前

- [ ] **Step 6.4: 跑整个 web_v2 套件做回归**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/ -v`
Expected: 全部 PASS（原 19 个 + 新增测试）

- [ ] **Step 6.5: 提交**

```bash
git add tests/web_v2/conftest.py tests/web_v2/test_preview_api.py
git commit -m "test(web_v2): cover binary preview route, NOT_INDEXED, and regressions"
```

---

## Task 7: 前端构建 + E2E 验证

**Files:** 无源码改动，只跑构建和 E2E

- [ ] **Step 7.1: 确认前端构建产物是最新的**

Run:
```bash
cd cortex/web_v2/frontend && npm run build
```
Expected: 构建成功，输出到 `cortex/web_v2/static/`

- [ ] **Step 7.2: 启动 Web UI 服务**

背景启动：
```bash
.venv/Scripts/python.exe -m cortex gui --port 7860
```
Expected: 服务在 http://localhost:7860 监听；日志显示 "Uvicorn running on http://127.0.0.1:7860"

- [ ] **Step 7.3: 准备测试数据**

确保 `test_work_dir/` 下有至少一个 .csv 文件（如 Task 6 用过的 `data.csv`），并执行索引：

```bash
cd test_work_dir && ../.venv/Scripts/python.exe -m cortex index
```
Expected: 索引完成，`data.csv` 出现在索引文档列表

- [ ] **Step 7.4: E2E 测试 —— csv 预览**

使用 `playwright-cli` skill。流程：
1. 打开 http://localhost:7860
2. 在搜索框输入 csv 中某个值（如 "Alice"）
3. 点击搜索结果中的 `data.csv` 卡片
4. 验证右侧 `<preview-pane>` 内出现 `<md-viewer>`
5. 进入 `<md-viewer>` 的 shadowRoot，断言存在 `<table>` 元素，且 `<thead>` 含 "name"、"age"
6. 断言页面中没有"该文件未索引"提示
7. 断言搜索关键字 "Alice" 在 table 内被 `<mark class="keyword-hit">` 包裹

- [ ] **Step 7.5: E2E 测试 —— NOT_INDEXED 提示**

流程：
1. 在 `test_work_dir/` 放一个 `.pdf` 文件（可以随便复制一个）
2. **不**重新索引
3. 浏览器里搜索一个能匹配的关键字（或者通过其它方式触发预览请求）
4. 由于该 pdf 未索引，应看到"该文件未索引，无法预览。请先执行 cortex index 后重试。"提示
5. 断言页面没有乱码、没有空白

- [ ] **Step 7.6: 关闭服务 + 整体回归**

停止 Step 7.2 后台服务。

Run: `.venv/Scripts/python.exe -m pytest tests/ -v --ignore=tests/web_v2/frontend`
Expected: 全部 Python 测试 PASS（含 web_v2、treesearch 等）

- [ ] **Step 7.7: 提交（如有 E2E 中发现并修复的问题）**

如果 E2E 暴露问题并修复了，提交：
```bash
git add -A
git commit -m "fix(web_v2): <具体修复说明>"
```

如果一切顺利、无代码改动，本步骤跳过。

---

## 最终验收 Checklist

参照 spec `## 验收标准`：

- [ ] 1. 点击 `.pdf/.docx/.xlsx/.xlsm/.xltx/.xltm/.csv` 搜索结果 → 右侧以 md 模式渲染
- [ ] 2. csv/xlsx 渲染为 md table，列对齐、表头加粗
- [ ] 3. pdf/docx 渲染为带层级的 md 文档（章节标题 + 正文段落）
- [ ] 4. `path:line` 与实际文件行号一致；渲染后自动滚动到命中行所在块并短暂高亮
- [ ] 5. 搜索关键字在合成 md 中按空格分词高亮
- [ ] 6. DB 无记录时显示"该文件未索引，无法预览"，不显示乱码
- [ ] 7. `.py/.txt/.json/.md/.html` 等其它文件预览行为零变化（回归通过）
- [ ] 8. 所有现有测试继续通过

---

## Self-Review

**Spec coverage check**（对照 spec 章节）：
- ✅ 范围 In Scope: Task 1-4 覆盖后端合成路径 + NOT_INDEXED
- ✅ 范围 Out of Scope: Task 5 仅扩展 isFullFilePreview 判断，未动 `<preview-pane>` / `<md-viewer>`
- ✅ 架构 数据流: Task 4 实现 API 分流；Task 2-3 实现合成器；Task 1 实现 DB 查询
- ✅ 组件边界: Task 1（fts.py）、Task 2-3（preview_synthesizer.py）、Task 4（api/preview.py）、Task 5（search-view.ts）
- ✅ 关键决策 1（后缀白名单）: Task 4 Step 4.2
- ✅ 关键决策 2（DFS 遍历）: Task 2 Step 2.3
- ✅ 关键决策 3（md table 聚合）: Task 3 Step 3.3
- ✅ 关键决策 3.1（table 行定位局限）: spec 中已说明，plan 不需要专门任务
- ✅ 关键决策 4（行号对齐）: Task 2 Step 2.3 _emit_node 里 `while len(out)+1 < line_start`
- ✅ 关键决策 5（DB 查询方法）: Task 1
- ✅ 关键决策 6（DB 无记录兜底）: Task 4 Step 4.2 + Task 5 Step 5.3
- ✅ 关键决策 7（安全）: 路径越权测试在 Task 6 Step 6.2

**Placeholder scan**:
- ✅ Task 2 Step 2.3 的 `_emit_table_block` 有 `# TODO: Task 3 替换`，但这是 TDD 占位，Task 3 明确替换；不算最终交付的占位
- ✅ Task 6 Step 6.2 测试代码完整，无 "TBD"
- ✅ 所有代码块都是完整可运行的代码

**Type / signature consistency**:
- ✅ `FTS5Index.load_document_by_source_path(source_path: str) -> Optional[Document]` 在 Task 1 定义，Task 4 调用一致
- ✅ `render_tree_to_md(structure, source_type) -> str` 在 Task 2 定义，Task 4 调用一致
- ✅ `_emit_node(out, node, depth, source_type)` 在 Task 2 定义，Task 3 内部递归调用一致
- ✅ `_emit_table_block` Task 2 签名 `(out, text, children, source_type)`，Task 3 替换时签名一致（去掉了 node 参数，因为不需要）

**潜在问题已修复**：
- Task 6 路径越权测试：明确要求 `_safe_resolve` 在白名单分支之前，已在 Task 4 Step 4.2 代码示例中体现（`full = _safe_resolve(base, path)` 在 `if full.suffix.lower() in BINARY_PREVIEW_EXTS` 之前）
- Task 5 错误处理：明确 `previewError` state 重置时机（每次 `_onResultSelect` 开头置 null）

plan 完整可执行。
