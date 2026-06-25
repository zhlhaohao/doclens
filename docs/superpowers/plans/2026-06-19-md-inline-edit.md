# MD Inline Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Cortex Web UI 的 preview pane 中新增 `.md`（及所有可写文本文件）的原地编辑能力——header 加 `[编辑]` 按钮，切到 textarea+行号布局，支持显式保存（按钮 + Ctrl/Cmd+S）+ Toast 反馈 + 切换文件前的 dirty 确认 + 保存后同步触发增量重索引。

**Architecture:**
- **后端**：扩展 `GET /api/preview` 响应加 `writable` 字段；新增 `PUT /api/preview` 写盘+触发 `idx.trigger_background_reindex()`。
- **前端**：新增 `<md-editor>` 组件（textarea+行号+dirty 状态），`<preview-pane>` 协调 preview/edit 模式切换，`<search-view>` 维护 `previewDirty` 状态并在切换前弹 `window.confirm`。
- **隔离边界**：md-editor 是纯 UI 组件，不知道 confirm 逻辑；preview-pane 不知道 toast UI；search-view 不知道编辑内部状态，只监听 dirty-change 事件。

**Tech Stack:** Lit 3 + Vite + marked (existing) / FastAPI + Pydantic + pytest-asyncio / vitest + @open-wc/testing / Playwright

---

## File Structure

| 文件 | 类型 | 职责 |
|------|------|------|
| `cortex/web_v2/models/preview.py` | 修改 | `PreviewResponse` 加 `writable`；新增 `PreviewSaveRequest`/`PreviewSaveResponse` |
| `cortex/web_v2/api/preview.py` | 修改 | 抽 `_compute_writable` 共享给 GET/PUT；GET 调用并填响应；新增 PUT 端点 |
| `cortex/web_v2/frontend/src/api/preview.ts` | 新建 | `savePreview(path, content)` client + `PreviewSaveError` |
| `cortex/web_v2/frontend/src/components/md-editor.ts` | 新建 | textarea+行号+dirty+键盘事件 |
| `cortex/web_v2/frontend/src/components/preview-pane.ts` | 修改 | `writable` prop；`_mode`/`_content` 状态；嵌入 `<md-editor>`；转发 `dirty-change` |
| `cortex/web_v2/frontend/src/components/toast-stack.ts` | 新建 | 右下角 toast 容器 + `pushToast` API |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 修改 | `previewDirty` 状态；`_safeAction` 包装切换入口；调用 `savePreview` + toast |
| `tests/web_v2/test_preview_save.py` | 新建 | 9 个后端 pytest |
| `cortex/web_v2/frontend/tests/md-editor.spec.ts` | 新建 | vitest 单测 |
| `cortex/web_v2/frontend/tests/preview-pane.spec.ts` | 扩展 | 加 mode 切换 + writable 测试 |
| `cortex/web_v2/frontend/tests/e2e/edit-flow.spec.ts` | 新建 | Playwright 端到端 |

**任务总数：12 个**，按 TDD 顺序组织：后端从下往上（models → helper → GET → PUT），前端从组件到集成（api client → md-editor → toast-stack → preview-pane 集成 → search-view 集成），最后 E2E + 构建。

---

## Task 1: 后端 — Pydantic models（writable + save 模型）

**Files:**
- Modify: `cortex/web_v2/models/preview.py`
- Test: `tests/web_v2/test_preview_save.py` (新文件，先建空架子)

- [ ] **Step 1: 写失败的测试（PreviewResponse.writable 字段）**

在 `tests/web_v2/test_preview_save.py` 顶部新建文件，写入：

```python
"""PUT /api/preview + GET writable 字段测试。"""
from cortex.web_v2.models.preview import (
    PreviewResponse,
    PreviewSaveRequest,
    PreviewSaveResponse,
)


def test_preview_response_has_writable_field():
    resp = PreviewResponse(path="x.md", content="hi", writable=True)
    assert resp.writable is True


def test_preview_response_writable_defaults_false():
    resp = PreviewResponse(path="x.md", content="hi")
    assert resp.writable is False


def test_save_request_serializes_content():
    req = PreviewSaveRequest(content="hello\nworld")
    assert req.content == "hello\nworld"


def test_save_response_has_required_fields():
    resp = PreviewSaveResponse(
        path="x.md",
        content="abc",
        bytes_written=3,
        reindex_triggered=True,
    )
    assert resp.path == "x.md"
    assert resp.content == "abc"
    assert resp.bytes_written == 3
    assert resp.reindex_triggered is True
```

- [ ] **Step 2: 运行测试，确认 import 失败**

Run: `cd "D:/github/cortex" && .venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_save.py -v`
Expected: ImportError 或 ModuleNotFoundError（`PreviewSaveRequest` 不存在）

- [ ] **Step 3: 修改 `cortex/web_v2/models/preview.py`**

完整替换为：

```python
"""预览 API 请求/响应模型。"""
from typing import Optional

from pydantic import BaseModel


class PreviewResponse(BaseModel):
    path: str
    language: str = "text"
    content: str
    line_range: Optional[tuple[int, int]] = None
    highlights: list[int] = []
    writable: bool = False


class PreviewSaveRequest(BaseModel):
    """PUT /api/preview 请求体。"""
    content: str


class PreviewSaveResponse(BaseModel):
    """PUT /api/preview 响应。"""
    path: str
    content: str
    bytes_written: int
    reindex_triggered: bool
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd "D:/github/cortex" && .venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_save.py -v`
Expected: 4 passed

- [ ] **Step 5: 提交**

```bash
cd "D:/github/cortex" && git add cortex/web_v2/models/preview.py tests/web_v2/test_preview_save.py && git commit -m "feat(web_v2): add writable field to PreviewResponse + save models"
```

---

## Task 2: 后端 — `_compute_writable` 共享 helper

**Files:**
- Modify: `cortex/web_v2/api/preview.py`
- Modify: `tests/web_v2/test_preview_save.py`

- [ ] **Step 1: 在测试文件追加失败的 helper 测试**

在 `tests/web_v2/test_preview_save.py` 末尾追加：

```python
import os
import stat
from pathlib import Path

from cortex.web_v2.api.preview import _compute_writable


def test_compute_writable_true_for_normal_md(tmp_path: Path, monkeypatch):
    f = tmp_path / "doc.md"
    f.write_text("hi", encoding="utf-8")
    assert _compute_writable(f, search_path=tmp_path) is True


def test_compute_writable_false_for_binary_ext(tmp_path: Path, monkeypatch):
    f = tmp_path / "doc.pdf"
    f.write_text("fake", encoding="utf-8")
    assert _compute_writable(f, search_path=tmp_path) is False


def test_compute_writable_false_inside_cortex_dir(tmp_path: Path, monkeypatch):
    cortex = tmp_path / ".cortex"
    cortex.mkdir()
    f = cortex / "config.env"
    f.write_text("X=1", encoding="utf-8")
    assert _compute_writable(f, search_path=tmp_path) is False


def test_compute_writable_false_for_readonly_file(tmp_path: Path, monkeypatch):
    f = tmp_path / "ro.md"
    f.write_text("hi", encoding="utf-8")
    os.chmod(f, stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
    try:
        assert _compute_writable(f, search_path=tmp_path) is False
    finally:
        os.chmod(f, stat.S_IRUSR | stat.S_IWUSR)


def test_compute_writable_false_for_missing_file(tmp_path: Path, monkeypatch):
    f = tmp_path / "missing.md"
    assert _compute_writable(f, search_path=tmp_path) is False
```

- [ ] **Step 2: 运行新测试，确认失败（import 失败）**

Run: `cd "D:/github/cortex" && .venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_save.py::test_compute_writable_true_for_normal_md -v`
Expected: ImportError: cannot import name '_compute_writable' from 'cortex.web_v2.api.preview'

- [ ] **Step 3: 在 `cortex/web_v2/api/preview.py` 顶部加 helper**

在 `BINARY_PREVIEW_EXTS` 定义之后（line 23 之后）插入新函数：

```python
import os  # 确认文件顶部已有；若没有就加上


def _compute_writable(full: Path, search_path: Path) -> bool:
    """判断文件是否可在 PUT /api/preview 中写入。

    用于 GET（响应 writable 字段）和 PUT（写前检查），保持两端判断一致。
    """
    if not full.exists() or not full.is_file():
        return False
    if full.suffix.lower() in BINARY_PREVIEW_EXTS:
        return False
    # .cortex/ 内部不让用户改索引
    try:
        full.relative_to(search_path / ".cortex")
        return False
    except ValueError:
        pass
    return os.access(full, os.W_OK)
```

- [ ] **Step 4: 运行新测试，确认通过**

Run: `cd "D:/github/cortex" && .venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_save.py -v -k compute_writable`
Expected: 5 passed

- [ ] **Step 5: 提交**

```bash
cd "D:/github/cortex" && git add cortex/web_v2/api/preview.py tests/web_v2/test_preview_save.py && git commit -m "feat(web_v2): extract _compute_writable helper for GET/PUT sharing"
```

---

## Task 3: 后端 — `GET /api/preview` 响应加 `writable`

**Files:**
- Modify: `cortex/web_v2/api/preview.py`
- Modify: `tests/web_v2/test_preview_save.py`

- [ ] **Step 1: 写失败的端到端测试**

在测试文件末尾追加：

```python
import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2 import deps
from cortex.web_v2.app import create_app


@pytest.fixture
def reset_deps():
    deps.reset_singletons()
    yield
    deps.reset_singletons()


@pytest.mark.asyncio
async def test_get_preview_includes_writable_true_for_md(
    temp_workdir, env_cortex_config, reset_deps
):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "doc1.md"})
    assert res.status_code == 200
    body = res.json()
    assert body["writable"] is True


@pytest.mark.asyncio
async def test_get_preview_includes_writable_false_for_csv(
    temp_workdir, env_cortex_config, reset_deps
):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "data.csv"})
    assert res.status_code == 200
    body = res.json()
    assert body["writable"] is False
```

- [ ] **Step 2: 运行新测试，确认 writable 缺失失败**

Run: `cd "D:/github/cortex" && .venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_save.py::test_get_preview_includes_writable_true_for_md -v`
Expected: KeyError: 'writable'（响应体里没有 writable 字段）

- [ ] **Step 3: 修改 `preview()` 函数填 writable 字段**

定位 `cortex/web_v2/api/preview.py` 的 `preview()` 函数（约 line 45-83）。在两处 `return PreviewResponse(...)` 都加 `writable=_compute_writable(full, base)`：

文本文件分支的 return（第 77-83 行）改为：

```python
    return PreviewResponse(
        path=path,
        language=_LANGUAGE_MAP.get(full.suffix.lower(), "text"),
        content=content,
        line_range=line_range,
        highlights=[],
        writable=_compute_writable(full, base),
    )
```

二进制合成预览分支的 return（第 108-114 行 `_synthesize_binary_preview` 内）改为：

```python
    return PreviewResponse(
        path=rel_path,
        language="markdown",
        content=md_content,
        line_range=None,
        highlights=[],
        writable=False,  # 合成预览不可写
    )
```

- [ ] **Step 4: 运行新测试 + 旧 preview_api 测试，确认通过**

Run:
```bash
cd "D:/github/cortex" && .venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_save.py tests/web_v2/test_preview_api.py -v
```
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
cd "D:/github/cortex" && git add cortex/web_v2/api/preview.py tests/web_v2/test_preview_save.py && git commit -m "feat(web_v2): include writable in GET /api/preview response"
```

---

## Task 4: 后端 — `PUT /api/preview` 端点

**Files:**
- Modify: `cortex/web_v2/api/preview.py`
- Modify: `tests/web_v2/test_preview_save.py`

- [ ] **Step 1: 写失败的成功路径测试**

在测试文件末尾追加：

```python
@pytest.mark.asyncio
async def test_put_overwrites_file_content(
    temp_workdir, env_cortex_config, reset_deps
):
    target = temp_workdir / "doc1.md"
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/preview",
            params={"path": "doc1.md"},
            json={"content": "## new content"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["path"] == "doc1.md"
    assert body["content"] == "## new content"
    assert body["bytes_written"] == len("## new content".encode("utf-8"))
    assert body["reindex_triggered"] is True
    # 磁盘文件实际写入
    assert target.read_text(encoding="utf-8") == "## new content"
```

- [ ] **Step 2: 写失败的所有错误路径测试**

```python
@pytest.mark.asyncio
async def test_put_rejects_binary_extension(
    temp_workdir, env_cortex_config, reset_deps
):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/preview",
            params={"path": "data.csv"},
            json={"content": "x"},
        )
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_WRITABLE"


@pytest.mark.asyncio
async def test_put_rejects_path_traversal(
    env_cortex_config, reset_deps
):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/preview",
            params={"path": "../../../etc/passwd"},
            json={"content": "x"},
        )
    # _safe_resolve 抛 FILE_NOT_FOUND（按现有约定）
    assert res.status_code == 404
    assert res.json()["code"] == "FILE_NOT_FOUND"


@pytest.mark.asyncio
async def test_put_rejects_nonexistent_file(
    temp_workdir, env_cortex_config, reset_deps
):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/preview",
            params={"path": "ghost.md"},
            json={"content": "x"},
        )
    assert res.status_code == 404
    assert res.json()["code"] == "FILE_NOT_FOUND"


@pytest.mark.asyncio
async def test_put_rejects_readonly_file(
    temp_workdir, env_cortex_config, reset_deps
):
    target = temp_workdir / "doc1.md"
    os.chmod(target, stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
    try:
        app = create_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.put(
                "/api/preview",
                params={"path": "doc1.md"},
                json={"content": "x"},
            )
        assert res.status_code == 403
        assert res.json()["code"] == "NOT_WRITABLE"
    finally:
        os.chmod(target, stat.S_IRUSR | stat.S_IWUSR)


@pytest.mark.asyncio
async def test_put_rejects_oversized_content(
    temp_workdir, env_cortex_config, reset_deps
):
    big = "x" * (6 * 1024 * 1024)  # 6MB
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/preview",
            params={"path": "doc1.md"},
            json={"content": big},
        )
    assert res.status_code == 413
    assert res.json()["code"] == "CONTENT_TOO_LARGE"
```

- [ ] **Step 3: 运行新测试，确认全部失败（PUT 405）**

Run: `cd "D:/github/cortex" && .venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_save.py -v -k put_`
Expected: 全部失败（405 Method Not Allowed）

- [ ] **Step 4: 实现 PUT 端点**

在 `cortex/web_v2/api/preview.py` 顶部 import 加 `from fastapi import Body`。在文件末尾追加：

```python
from cortex.web_v2.models.preview import PreviewSaveRequest, PreviewSaveResponse

# 5MB 上限（防御性，避免 OOM）
_MAX_SAVE_BYTES = 5 * 1024 * 1024


@router.put("/preview", response_model=PreviewSaveResponse)
async def save_preview(
    path: str = Query(..., description="相对路径"),
    body: PreviewSaveRequest = Body(...),
    idx: IndexManager = Depends(get_index_manager),
):
    base = Path(idx.search_path)
    full = _safe_resolve(base, path)

    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {path}")
    if not _compute_writable(full, base):
        raise CortexAPIError(403, "NOT_WRITABLE", f"该文件不可编辑: {path}")

    encoded = body.content.encode("utf-8")
    if len(encoded) > _MAX_SAVE_BYTES:
        raise CortexAPIError(413, "CONTENT_TOO_LARGE", f"content 超过 {_MAX_SAVE_BYTES // 1024 // 1024}MB 上限")

    try:
        full.write_bytes(encoded)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"写入失败: {e}") from e

    # 触发后台增量重索引（不阻塞响应）
    try:
        idx.trigger_background_reindex()
    except Exception as e:
        # 索引失败不阻断保存成功
        logger = logging.getLogger(__name__)
        logger.warning("Save reindex failed: %s", e)

    return PreviewSaveResponse(
        path=path,
        content=body.content,
        bytes_written=len(encoded),
        reindex_triggered=True,
    )
```

并在文件顶部加 `import logging`。

- [ ] **Step 5: 运行所有 preview_save 测试 + 既有 preview_api 测试**

Run: `cd "D:/github/cortex" && .venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_save.py tests/web_v2/test_preview_api.py -v`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
cd "D:/github/cortex" && git add cortex/web_v2/api/preview.py tests/web_v2/test_preview_save.py && git commit -m "feat(web_v2): add PUT /api/preview for inline edit save"
```

---

## Task 5: 前端 — `api/preview.ts` 客户端

**Files:**
- Create: `cortex/web_v2/frontend/src/api/preview.ts`
- Create: `cortex/web_v2/frontend/tests/api-preview.spec.ts`（轻量单测：PreviewSaveError 类 + URL 编码）

- [ ] **Step 1: 写失败的测试**

新建 `cortex/web_v2/frontend/tests/api-preview.spec.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { savePreview, PreviewSaveError } from "../src/api/preview";

describe("savePreview", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends PUT with JSON body and query-encoded path", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    global.fetch = vi.fn(async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(
        JSON.stringify({ path: "a b.md", content: "x", bytes_written: 1, reindex_triggered: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const result = await savePreview("a b.md", "x");
    expect(capturedUrl).toBe("/api/preview?path=a%20b.md");
    expect(capturedInit?.method).toBe("PUT");
    expect(JSON.parse(capturedInit!.body as string)).toEqual({ content: "x" });
    expect(result.bytes_written).toBe(1);
  });

  it("throws PreviewSaveError with code and status on non-2xx", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: "NOT_WRITABLE", detail: "read only" }), { status: 403 }),
    ) as unknown as typeof fetch;

    await expect(savePreview("ro.md", "x")).rejects.toMatchObject({
      code: "NOT_WRITABLE",
      status: 403,
      message: "read only",
    });
  });

  it("falls back to UNKNOWN code when body is not JSON", async () => {
    global.fetch = vi.fn(async () => new Response("plain text error", { status: 500 })) as unknown as typeof fetch;
    await expect(savePreview("x.md", "y")).rejects.toBeInstanceOf(PreviewSaveError);
  });
});

describe("PreviewSaveError", () => {
  it("is an Error subclass with code/status fields", () => {
    const e = new PreviewSaveError("X", "msg", 400);
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("X");
    expect(e.status).toBe(400);
    expect(e.message).toBe("msg");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败（模块不存在）**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npx vitest run tests/api-preview.spec.ts`
Expected: FAIL (cannot resolve ../src/api/preview)

- [ ] **Step 3: 创建 `cortex/web_v2/frontend/src/api/preview.ts`**

```typescript
/** PUT /api/preview 客户端。*/

export interface PreviewSaveResponse {
  path: string;
  content: string;
  bytes_written: number;
  reindex_triggered: boolean;
}

export class PreviewSaveError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "PreviewSaveError";
  }
}

export async function savePreview(path: string, content: string): Promise<PreviewSaveResponse> {
  const res = await fetch(`/api/preview?path=${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ code: "UNKNOWN", detail: res.statusText }));
    throw new PreviewSaveError(
      err.code ?? "UNKNOWN",
      err.detail ?? "保存失败",
      res.status,
    );
  }
  return res.json();
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npx vitest run tests/api-preview.spec.ts`
Expected: 4 passed

- [ ] **Step 5: 提交**

```bash
cd "D:/github/cortex" && git add cortex/web_v2/frontend/src/api/preview.ts cortex/web_v2/frontend/tests/api-preview.spec.ts && git commit -m "feat(web_v2): add savePreview api client + PreviewSaveError"
```

---

## Task 6: 前端 — `<md-editor>` 组件

**Files:**
- Create: `cortex/web_v2/frontend/src/components/md-editor.ts`
- Create: `cortex/web_v2/frontend/tests/md-editor.spec.ts`

- [ ] **Step 1: 写失败的测试**

新建 `cortex/web_v2/frontend/tests/md-editor.spec.ts`：

```typescript
import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { MdEditor } from "../src/components/md-editor";
import "../src/components/md-editor";

async function makeFixture(original: string): Promise<MdEditor> {
  const el = await fixture(html`<md-editor path="x.md" .originalContent=${original}></md-editor>`) as MdEditor;
  await el.updateComplete;
  return el;
}

describe("<md-editor>", () => {
  it("renders textarea with original content", async () => {
    const el = await makeFixture("hello\nworld");
    const ta = el.shadowRoot!.querySelector("textarea")!;
    expect(ta).toBeTruthy();
    expect(ta.value).toBe("hello\nworld");
  });

  it("shows correct number of line numbers", async () => {
    const el = await makeFixture("a\nb\nc");
    await el.updateComplete;
    const lineNos = el.shadowRoot!.querySelectorAll(".line-no");
    // "a\nb\nc" 包含 2 个 \n → 3 行
    expect(lineNos.length).toBe(3);
  });

  it("emits dirty-change(true) on input", async () => {
    const el = await makeFixture("hello");
    await el.updateComplete;
    const detail = vi.fn();
    el.addEventListener("dirty-change", (e: any) => detail(e.detail));
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.value = "changed";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    expect(detail).toHaveBeenCalledWith({ dirty: true });
  });

  it("emits save event with content on [保存] click (when dirty)", async () => {
    const el = await makeFixture("hello");
    await el.updateComplete;
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.value = "world";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    const saveHandler = vi.fn();
    el.addEventListener("save", (e: any) => saveHandler(e.detail));
    const saveBtn = el.shadowRoot!.querySelector(".save-btn") as HTMLButtonElement;
    saveBtn.click();
    expect(saveHandler).toHaveBeenCalledWith({ content: "world" });
  });

  it("emits save event on Ctrl+S keydown (when dirty)", async () => {
    const el = await makeFixture("hello");
    await el.updateComplete;
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.value = "world";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    const saveHandler = vi.fn();
    el.addEventListener("save", (e: any) => saveHandler(e.detail));
    const evt = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true });
    ta.dispatchEvent(evt);
    expect(saveHandler).toHaveBeenCalledWith({ content: "world" });
  });

  it("does NOT emit save on Ctrl+S when not dirty", async () => {
    const el = await makeFixture("hello");
    await el.updateComplete;
    const saveHandler = vi.fn();
    el.addEventListener("save", (e: any) => saveHandler(e.detail));
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    expect(saveHandler).not.toHaveBeenCalled();
  });

  it("emits cancel event on [取消] click and resets textarea", async () => {
    const el = await makeFixture("original");
    await el.updateComplete;
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.value = "changed";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    const cancelHandler = vi.fn();
    el.addEventListener("cancel", () => cancelHandler());
    (el.shadowRoot!.querySelector(".cancel-btn") as HTMLButtonElement).click();
    await el.updateComplete;
    expect(cancelHandler).toHaveBeenCalled();
    expect(ta.value).toBe("original");
  });

  it("discard() resets content and emits cancel", async () => {
    const el = await makeFixture("orig");
    await el.updateComplete;
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.value = "x";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    const cancelHandler = vi.fn();
    el.addEventListener("cancel", () => cancelHandler());
    el.discard();
    await el.updateComplete;
    expect(ta.value).toBe("orig");
    expect(cancelHandler).toHaveBeenCalled();
  });

  it("setError() shows error message in header", async () => {
    const el = await makeFixture("hi");
    await el.updateComplete;
    el.setError("网络错误");
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".error-msg")!.textContent).toContain("网络错误");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败（模块不存在）**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npx vitest run tests/md-editor.spec.ts`
Expected: FAIL (cannot resolve component)

- [ ] **Step 3: 创建 `cortex/web_v2/frontend/src/components/md-editor.ts`**

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

/**
 * <md-editor> — textarea + 行号 + dirty 状态 + 键盘事件。
 *
 * 设计为纯 UI 组件：
 * - 不调用任何 API（save 由父组件处理）
 * - 不弹任何 confirm 对话框
 * - 通过事件向父组件汇报 dirty / save / cancel
 */
@customElement("md-editor")
export class MdEditor extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
    }
    .toolbar .path {
      flex: 1;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
    }
    .toolbar .dirty {
      color: #d97706;
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
    }
    .toolbar .error-msg {
      color: #dc2626;
      font-size: var(--cortex-fs-sm);
      flex: 1;
    }
    button {
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: 4px;
      cursor: pointer;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.save-btn {
      background: var(--cortex-primary);
      color: #fff;
      border-color: var(--cortex-primary);
    }
    .body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .line-col {
      flex-shrink: 0;
      padding: 8px 6px 8px 0;
      text-align: right;
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-sm);
      line-height: 1.6;
      user-select: none;
      overflow: hidden;
      background: var(--cortex-surface-muted);
      border-right: 1px solid var(--cortex-border-muted);
      min-width: 32px;
    }
    .line-col .line-no {
      display: block;
    }
    textarea {
      flex: 1;
      resize: none;
      border: none;
      outline: none;
      padding: 8px 12px;
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      line-height: 1.6;
      background: var(--cortex-surface);
      color: inherit;
      white-space: pre;
      overflow: auto;
    }
  `;

  @property() path = "";
  @property() originalContent = "";

  @state() private _text = "";
  @state() private _dirty = false;
  @state() private _error: string | null = null;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("originalContent")) {
      this._text = this.originalContent;
      this._dirty = false;
      this._error = null;
    }
  }

  private get _lineCount(): number {
    // "a\nb\nc" → 3 行；"a\nb" → 2 行；"" → 1 行
    if (this._text === "") return 1;
    return (this._text.match(/\n/g) ?? []).length + 1;
  }

  private _onInput(e: Event) {
    const ta = e.target as HTMLTextAreaElement;
    this._text = ta.value;
    this._error = null;
    this._updateDirty();
  }

  private _onScroll(e: Event) {
    const ta = e.target as HTMLTextAreaElement;
    const lineCol = this.shadowRoot!.querySelector(".line-col") as HTMLElement;
    if (lineCol) lineCol.scrollTop = ta.scrollTop;
  }

  private _onKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (this._dirty) this._emitSave();
    }
  }

  private _updateDirty() {
    const next = this._text !== this.originalContent;
    if (next !== this._dirty) {
      this._dirty = next;
      this.dispatchEvent(
        new CustomEvent("dirty-change", { detail: { dirty: next } }),
      );
    }
  }

  private _emitSave() {
    this.dispatchEvent(
      new CustomEvent("save", { detail: { content: this._text } }),
    );
  }

  private _onSaveClick = () => {
    if (this._dirty) this._emitSave();
  };

  private _onCancelClick = () => {
    this.discard();
  };

  /** 强制重置为 originalContent，并 emit cancel。供父组件在用户确认"丢弃"后调用。 */
  discard() {
    this._text = this.originalContent;
    this._dirty = false;
    this._error = null;
    this.dispatchEvent(new CustomEvent("cancel", {}));
  }

  /** 设置错误信息（由父组件在保存失败时调用）。下一次输入会自动清除。 */
  setError(msg: string) {
    this._error = msg;
  }

  render() {
    const lines: number[] = [];
    for (let i = 1; i <= this._lineCount; i++) lines.push(i);
    return html`
      <div class="toolbar">
        <span class="path">${this.path}</span>
        ${this._error
          ? html`<span class="error-msg">⚠ ${this._error}</span>`
          : this._dirty
          ? html`<span class="dirty">●未保存</span>`
          : null}
        <button class="save-btn" ?disabled=${!this._dirty} @click=${this._onSaveClick}>
          💾 保存
        </button>
        <button class="cancel-btn" @click=${this._onCancelClick}>✖ 取消</button>
      </div>
      <div class="body">
        <div class="line-col">
          ${lines.map((n) => html`<span class="line-no">${n}</span>`)}
        </div>
        <textarea
          spellcheck="false"
          .value=${this._text}
          @input=${this._onInput}
          @scroll=${this._onScroll}
          @keydown=${this._onKeyDown}
        ></textarea>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "md-editor": MdEditor;
  }
}
```

- [ ] **Step 4: 运行测试，确认全部通过**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npx vitest run tests/md-editor.spec.ts`
Expected: 9 passed

- [ ] **Step 5: 提交**

```bash
cd "D:/github/cortex" && git add cortex/web_v2/frontend/src/components/md-editor.ts cortex/web_v2/frontend/tests/md-editor.spec.ts && git commit -m "feat(web_v2): add <md-editor> component with textarea+line numbers+dirty state"
```

---

## Task 7: 前端 — `<toast-stack>` 组件

**Files:**
- Create: `cortex/web_v2/frontend/src/components/toast-stack.ts`
- Create: `cortex/web_v2/frontend/tests/toast-stack.spec.ts`

- [ ] **Step 1: 写失败的测试**

新建 `cortex/web_v2/frontend/tests/toast-stack.spec.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { ToastStack } from "../src/components/toast-stack";
import "../src/components/toast-stack";

describe("<toast-stack>", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders empty initially", async () => {
    const el = await fixture(html`<toast-stack></toast-stack>`) as ToastStack;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".toast").length).toBe(0);
  });

  it("pushToast() adds a toast with message", async () => {
    const el = await fixture(html`<toast-stack></toast-stack>`) as ToastStack;
    await el.updateComplete;
    el.pushToast("已保存", "success", 2500);
    await el.updateComplete;
    const toasts = el.shadowRoot!.querySelectorAll(".toast");
    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toContain("已保存");
    expect(toasts[0].classList.contains("success")).toBe(true);
  });

  it("auto-dismisses after duration", async () => {
    const el = await fixture(html`<toast-stack></toast-stack>`) as ToastStack;
    await el.updateComplete;
    el.pushToast("hi", "info", 1000);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".toast").length).toBe(1);
    vi.advanceTimersByTime(1100);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".toast").length).toBe(0);
  });

  it("dismiss() removes toast and cancels timer", async () => {
    const el = await fixture(html`<toast-stack></toast-stack>`) as ToastStack;
    await el.updateComplete;
    el.pushToast("err", "error", 10000);
    await el.updateComplete;
    const id = el._toasts[0].id;
    el.dismiss(id);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".toast").length).toBe(0);
    vi.advanceTimersByTime(11000);
    await el.updateComplete;
    // 仍为 0，没有副作用
    expect(el.shadowRoot!.querySelectorAll(".toast").length).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npx vitest run tests/toast-stack.spec.ts`
Expected: FAIL (cannot resolve)

- [ ] **Step 3: 创建 `cortex/web_v2/frontend/src/components/toast-stack.ts`**

```typescript
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

export type ToastLevel = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  level: ToastLevel;
  /** 0 = 不自动消失（需手动 dismiss） */
  duration: number;
}

@customElement("toast-stack")
export class ToastStack extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      min-width: 200px;
      max-width: 360px;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .toast.success { background: #10b981; color: #fff; }
    .toast.error { background: #dc2626; color: #fff; }
    .toast.info { background: var(--cortex-surface); color: var(--cortex-text); border: 1px solid var(--cortex-border); }
    .toast .msg { flex: 1; }
  `;

  @state() _toasts: ToastItem[] = [];
  private _nextId = 1;
  private _timers = new Map<number, number>();

  pushToast(message: string, level: ToastLevel = "info", duration = 2500) {
    const id = this._nextId++;
    this._toasts = [...this._toasts, { id, message, level, duration }];
    if (duration > 0) {
      const handle = window.setTimeout(() => this.dismiss(id), duration);
      this._timers.set(id, handle);
    }
  }

  dismiss(id: number) {
    const handle = this._timers.get(id);
    if (handle !== undefined) {
      window.clearTimeout(handle);
      this._timers.delete(id);
    }
    this._toasts = this._toasts.filter((t) => t.id !== id);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    for (const handle of this._timers.values()) window.clearTimeout(handle);
    this._timers.clear();
  }

  render() {
    return html`
      ${this._toasts.map(
        (t) => html`
          <div class="toast ${t.level}" @click=${() => this.dismiss(t.id)}>
            <span class="msg">${t.message}</span>
          </div>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "toast-stack": ToastStack;
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npx vitest run tests/toast-stack.spec.ts`
Expected: 4 passed

- [ ] **Step 5: 提交**

```bash
cd "D:/github/cortex" && git add cortex/web_v2/frontend/src/components/toast-stack.ts cortex/web_v2/frontend/tests/toast-stack.spec.ts && git commit -m "feat(web_v2): add <toast-stack> component for transient notifications"
```

---

## Task 8: 前端 — `<preview-pane>` 集成 md-editor + writable

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/preview-pane.ts`
- Modify: `cortex/web_v2/frontend/tests/preview-pane.spec.ts`

- [ ] **Step 1: 在测试文件追加失败测试**

在 `cortex/web_v2/frontend/tests/preview-pane.spec.ts` 末尾追加：

```typescript
import "../src/components/md-editor";

describe("<preview-pane> edit mode", () => {
  it("shows [编辑] button when writable=true and language=markdown", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector(".edit-btn");
    expect(btn).toBeTruthy();
  });

  it("hides [编辑] button when writable=false", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".edit-btn")).toBeNull();
  });

  it("clicking [编辑] switches to <md-editor>", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# hello" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".edit-btn") as HTMLElement).click();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector("md-editor");
    expect(editor).toBeTruthy();
    expect((editor as any).originalContent).toBe("# hello");
  });

  it("md-editor cancel event switches back to <md-viewer>", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# hello" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".edit-btn") as HTMLElement).click();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector("md-editor") as any;
    editor.dispatchEvent(new CustomEvent("cancel", {}));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("md-editor")).toBeNull();
    expect(el.shadowRoot!.querySelector("md-viewer")).toBeTruthy();
  });

  it("forwards dirty-change from md-editor", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# hello" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".edit-btn") as HTMLElement).click();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector("md-editor") as any;
    let received: any = null;
    el.addEventListener("dirty-change", (e: any) => (received = e.detail));
    editor.dispatchEvent(new CustomEvent("dirty-change", { detail: { dirty: true } }));
    expect(received).toEqual({ dirty: true });
  });

  it("content prop change forces back to preview mode", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# a" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".edit-btn") as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("md-editor")).toBeTruthy();
    el.content = "# b";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("md-editor")).toBeNull();
    expect(el.shadowRoot!.querySelector("md-viewer")).toBeTruthy();
  });

  it("discard() forces back to preview mode (public method)", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# a" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".edit-btn") as HTMLElement).click();
    await el.updateComplete;
    el.discard();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("md-editor")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行新测试，确认失败**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npx vitest run tests/preview-pane.spec.ts`
Expected: 失败——`edit-btn` 元素不存在 / 没有 `<md-editor>` 集成 / 没有 `discard()` 方法

- [ ] **Step 3: 重写 `cortex/web_v2/frontend/src/components/preview-pane.ts`**

完整替换为：

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./md-viewer";
import "./md-editor";
import { savePreview, PreviewSaveError } from "../api/preview";
import type { MdEditor } from "./md-editor";

@customElement("preview-pane")
export class PreviewPane extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      background: var(--cortex-surface);
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      padding: 10px 14px;
      border-bottom: 1px solid var(--cortex-border);
      font-family: var(--cortex-font-mono);
      flex-shrink: 0;
    }
    .header .path { flex: 1; }
    .body {
      flex: 1;
      overflow: auto;
      padding: 12px 14px;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      line-height: 1.7;
      color: var(--cortex-text);
      white-space: pre;
    }
    .highlight { background: #fef3c7; padding: 0 2px; border-radius: 2px; }
    .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
    }
    button.edit-btn {
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: 4px;
      cursor: pointer;
    }
  `;

  @property() path = "";
  @property() language = "text";
  @property() content = "";
  @property({ attribute: false }) highlights: number[] = [];
  @property({ type: Boolean }) loading = false;
  @property({ type: Number }) line: number | null = null;
  @property() keyword = "";
  @property({ type: Boolean }) writable = false;

  @state() private _mode: "preview" | "edit" = "preview";
  @state() private _content = "";

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("content")) {
      this._content = this.content;
      this._mode = "preview";
    }
  }

  private _enterEdit = () => {
    this._mode = "edit";
  };

  private _onEditorCancel = () => {
    this._mode = "preview";
  };

  private _onEditorDirty = (e: CustomEvent<{ dirty: boolean }>) => {
    this.dispatchEvent(
      new CustomEvent("dirty-change", { detail: { dirty: e.detail.dirty } }),
    );
  };

  private async _onEditorSave(e: CustomEvent<{ content: string }>) {
    const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
    try {
      await savePreview(this.path, e.detail.content);
      this._content = e.detail.content;
      this._mode = "preview";
      this.dispatchEvent(
        new CustomEvent("saved", { detail: { content: e.detail.content } }),
      );
    } catch (err) {
      const msg =
        err instanceof PreviewSaveError
          ? `${err.code} ${err.message}`
          : (err as Error).message ?? "保存失败";
      editor?.setError(msg);
      this.dispatchEvent(
        new CustomEvent("save-failed", { detail: { message: msg } }),
      );
    }
  }

  /** 公共方法：父组件（search-view）在用户确认"丢弃修改"后调用。 */
  discard() {
    const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
    editor?.discard();
    this._mode = "preview";
  }

  render() {
    if (this.loading) return html`<div class="empty">加载中...</div>`;
    if (!this._content && !this.content)
      return html`<div class="empty">点击左侧结果查看预览</div>`;

    if (this.language === "markdown" && this._mode === "edit") {
      return html`
        <div class="header">
          <span class="path">${this.path}</span>
        </div>
        <md-editor
          .path=${this.path}
          .originalContent=${this._content}
          @save=${this._onEditorSave}
          @cancel=${this._onEditorCancel}
          @dirty-change=${this._onEditorDirty}
        ></md-editor>
      `;
    }

    if (this.language === "markdown") {
      return html`
        <div class="header">
          <span class="path">${this.path}</span>
          ${this.writable
            ? html`<button class="edit-btn" @click=${this._enterEdit}>✏️ 编辑</button>`
            : null}
        </div>
        <md-viewer
          .content=${this._content}
          .line=${this.line}
          .keyword=${this.keyword}
        ></md-viewer>
      `;
    }

    // 非 md：现有纯文本 + 行号视图
    const lines = this._content.split("\n");
    return html`
      <div class="header">
        <span class="path">${this.path}</span>
      </div>
      <div class="body">
        ${lines.map((line, i) => {
          const lineNo = i + 1;
          const cls = this.highlights.includes(lineNo) ? "highlight" : "";
          return html`<div class=${cls}><span style="color:var(--cortex-text-subtle);display:inline-block;width:40px;">${lineNo}</span>${line}</div>`;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "preview-pane": PreviewPane;
  }
}
```

- [ ] **Step 4: 运行 preview-pane 全部测试，确认通过**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npx vitest run tests/preview-pane.spec.ts`
Expected: 全部通过（旧的 2 个 + 新的 7 个 = 9 passed）

- [ ] **Step 5: 提交**

```bash
cd "D:/github/cortex" && git add cortex/web_v2/frontend/src/components/preview-pane.ts cortex/web_v2/frontend/tests/preview-pane.spec.ts && git commit -m "feat(web_v2): integrate <md-editor> into <preview-pane> with mode toggle"
```

---

## Task 9: 前端 — `<search-view>` 接入 dirty 状态 + confirm + savePreview

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/search-view.ts`
- Create: `cortex/web_v2/frontend/tests/search-view-edit.spec.ts`（_safeAction 单测用最小 stub）

- [ ] **Step 1: 写失败测试**

新建 `cortex/web_v2/frontend/tests/search-view-edit.spec.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { SearchView } from "../src/views/search-view";
import "../src/views/search-view";
import { store, actions } from "../src/state/store";
import { resetStore } from "./test-utils";

describe("<search-view> edit flow integration", () => {
  let confirmSpy: any;

  beforeEach(async () => {
    resetStore(store);
    confirmSpy = vi.spyOn(window, "confirm");
  });
  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it("preview-pane editable when writable=true in focus state", async () => {
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [
        { path: "doc1.md", snippet: "hi", score: 1, line: 1, highlights: [] } as any,
      ],
      total: 1,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    // mock fetch GET /api/preview 返回带 writable=true 的响应
    const origFetch = global.fetch;
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ path: "doc1.md", language: "markdown", content: "# T", writable: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    try {
      const result = el.shadowRoot!.querySelector("search-results") as any;
      result.dispatchEvent(
        new CustomEvent("select", {
          detail: { result: { path: "doc1.md", snippet: "hi", score: 1, line: 1, highlights: [] } },
        }),
      );
      await new Promise((r) => setTimeout(r, 50));
      await el.updateComplete;
      const pp = el.shadowRoot!.querySelector("preview-pane") as any;
      expect(pp).toBeTruthy();
      expect(pp.writable).toBe(true);
    } finally {
      global.fetch = origFetch;
    }
  });

  it("previewDirty blocks result switch with confirm dialog", async () => {
    confirmSpy.mockReturnValue(false); // user cancels
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [
        { path: "a.md", snippet: "a", score: 1, line: 1, highlights: [] } as any,
        { path: "b.md", snippet: "b", score: 1, line: 1, highlights: [] } as any,
      ],
      total: 2,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    (el as any).previewDirty = true;
    // 触发 _onResultSelect —— 因为 dirty=true，应该弹 confirm 并因 false 而放弃
    await (el as any)._onResultSelect({
      detail: { result: { path: "b.md", snippet: "b", score: 1, line: 1, highlights: [] } },
    } as any);
    expect(confirmSpy).toHaveBeenCalled();
    // previewPath 没有切换到 b
    expect((el as any).previewPath).not.toBe("b.md");
  });
});
```

新建 `cortex/web_v2/frontend/tests/test-utils.ts`（共享 reset 工具）：

```typescript
import type { CortexStore } from "../src/state/store";

export function resetStore(store: CortexStore) {
  // 重置 store 到初始 state；具体字段由各测试自己 setXxxState 设置
  store.setState({
    view: "search",
    search: { state: "initial", query: "", results: [], total: 0, source: "fts" },
    chat: { messages: [], sessions: [] },
    history: { sessions: [] },
    settings: { scope: "local", values: {}, original: {}, dirty: false, saving: false, error: null },
    detailStack: [],
    pendingSession: null,
  });
}
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npx vitest run tests/search-view-edit.spec.ts`
Expected: 失败（`previewDirty` 不存在 / `_safeAction` 不存在 / store API 不匹配）

- [ ] **Step 3: 修改 `cortex/web_v2/frontend/src/views/search-view.ts`**

先在文件顶部 import 区域追加：

```typescript
import { savePreview, PreviewSaveError } from "../api/preview";
import "./preview-pane"; // 确保 import（应该已存在）
import "./toast-stack";
import type { ToastStack } from "../components/toast-stack";
```

在 `@state() private previewError: ...` 之后追加状态：

```typescript
@state() private previewDirty = false;
```

把 `_onResultSelect` 整段替换为：

```typescript
private async _onResultSelect(e: CustomEvent<{ result: SearchResult }>) {
  // dirty 时弹 confirm
  if (this.previewDirty) {
    const ok = window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？");
    if (!ok) return;
    this._discardPreviewEdits();
  }
  const r = e.detail.result;
  actions.pushDetail(r);
  this.previewError = null;
  try {
    const params = new URLSearchParams({ path: r.path });
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
      this.previewWritable = body.writable ?? false;
    } else {
      const err = await res.json().catch(() => ({ code: "UNKNOWN", detail: "" }));
      if (err.code === "NOT_INDEXED") {
        this.previewError = "NOT_INDEXED";
        this.previewContent = "";
        this.previewPath = r.path;
        this.previewWritable = false;
      }
    }
  } catch (e) {
    console.warn("preview failed", e);
  }
}
```

新增 `previewWritable` state：

```typescript
@state() private previewWritable = false;
```

新增 `_discardPreviewEdits` 私有方法：

```typescript
private _discardPreviewEdits() {
  const pp = this.shadowRoot?.querySelector("preview-pane") as any;
  pp?.discard?.();
  this.previewDirty = false;
}
```

新增 `_onPreviewDirty` 事件处理（绑定到 `<preview-pane>` 的 `dirty-change`）：

```typescript
private _onPreviewDirty = (e: CustomEvent<{ dirty: boolean }>) => {
  this.previewDirty = e.detail.dirty;
};
```

新增 `_onPreviewSaved` 事件处理（保存成功后 toast）：

```typescript
private _onPreviewSaved = () => {
  this._pushToast("已保存", "success", 2500);
};

private _onPreviewSaveFailed = (e: CustomEvent<{ message: string }>) => {
  this._pushToast(`保存失败：${e.detail.message}`, "error", 5000);
};

private _pushToast(message: string, level: "success" | "error" | "info", duration: number) {
  const stack = this.shadowRoot?.querySelector("toast-stack") as ToastStack | null;
  stack?.pushToast(message, level, duration);
}
```

修改 `<preview-pane>` 渲染部分（桌面端 + detail-overlay 两处）加 `writable` prop + 事件：

把：
```html
<preview-pane
  class="desktop-only"
  path=${this.previewPath}
  language=${this.previewLanguage}
  content=${this.previewContent}
  .line=${this.previewLine}
  .keyword=${s.query}>
</preview-pane>
```

改为：
```html
<preview-pane
  class="desktop-only"
  path=${this.previewPath}
  language=${this.previewLanguage}
  content=${this.previewContent}
  .line=${this.previewLine}
  .keyword=${s.query}
  ?writable=${this.previewWritable}
  @dirty-change=${this._onPreviewDirty}
  @saved=${this._onPreviewSaved}
  @save-failed=${this._onPreviewSaveFailed}>
</preview-pane>
```

detail-overlay 内的 `<preview-pane>` 同样改：

```html
<preview-pane
  path=${this.previewPath}
  language=${this.previewLanguage}
  content=${this.previewContent}
  .line=${this.previewLine}
  .keyword=${s.query}
  ?writable=${this.previewWritable}
  @dirty-change=${this._onPreviewDirty}
  @saved=${this._onPreviewSaved}
  @save-failed=${this._onPreviewSaveFailed}>
</preview-pane>
```

在 `render()` 顶部（`return html\``之后第一个元素之前）加 `<toast-stack>`：

```html
<toast-stack></toast-stack>
```

- [ ] **Step 4: 运行新测试**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npx vitest run tests/search-view-edit.spec.ts`
Expected: 2 passed

- [ ] **Step 5: 运行所有前端测试，确认既有测试不破**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npx vitest run`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
cd "D:/github/cortex" && git add cortex/web_v2/frontend/src/views/search-view.ts cortex/web_v2/frontend/tests/search-view-edit.spec.ts cortex/web_v2/frontend/tests/test-utils.ts && git commit -m "feat(web_v2): wire previewDirty+confirm+saved toast in search-view"
```

---

## Task 10: 前端 — 前端构建验证

**Files:** (无新文件，验证构建)

- [ ] **Step 1: 运行 vite build**

Run: `cd "D:/github/cortex/cortex/web_v2/frontend" && npm run build`
Expected: 构建成功，无 TS 错误

- [ ] **Step 2: 修复任何 TS 错误**

如有，根据错误修源代码（最常见：类型不匹配、import 缺失）。

- [ ] **Step 3: 提交（如有修复）**

```bash
cd "D:/github/cortex" && git add -A cortex/web_v2/frontend/src/ && git commit -m "fix(web_v2): address vite build type errors" || echo "no changes"
```

---

## Task 11: 后端 — 跑全量 web_v2 测试

**Files:** (无新文件，回归)

- [ ] **Step 1: 运行所有 web_v2 测试**

Run: `cd "D:/github/cortex" && .venv/Scripts/python.exe -m pytest tests/web_v2/ -v`
Expected: 全部通过

- [ ] **Step 2: 修复任何失败**

如有，根据失败信息回退到对应 Task 修复。

- [ ] **Step 3: 提交（如有修复）**

```bash
cd "D:/github/cortex" && git add -A cortex/ tests/ && git commit -m "fix(web_v2): address pytest regressions" || echo "no changes"
```

---

## Task 12: 手动冒烟测试（test_work_dir）

**Files:** (无新文件，smoke test)

- [ ] **Step 1: 在 test_work_dir 创建测试 .md**

```bash
cd "D:/github/cortex" && mkdir -p test_work_dir/notes && cat > test_work_dir/notes/hello.md <<'EOF'
# Hello

Original content.
EOF
ls test_work_dir/notes/hello.md
```

- [ ] **Step 2: 启动 cortex gui**

```bash
cd "D:/github/cortex/test_work_dir" && ../.venv/Scripts/python.exe -m cortex gui --port 7861 &
sleep 5
```

- [ ] **Step 3: 用 curl 验证 GET 返回 writable=true**

```bash
curl -s "http://localhost:7861/api/preview?path=notes/hello.md" | python -c "import sys,json; d=json.load(sys.stdin); print('writable:', d['writable'], 'lang:', d['language'])"
```
Expected: `writable: True lang: markdown`

- [ ] **Step 4: 用 curl 验证 PUT 写盘**

```bash
curl -s -X PUT "http://localhost:7861/api/preview?path=notes/hello.md" \
  -H "Content-Type: application/json" \
  -d '{"content":"# Hello\n\nEdited via PUT."}' | python -c "import sys,json; d=json.load(sys.stdin); print('bytes:', d['bytes_written'], 'reindex:', d['reindex_triggered'])"
cat test_work_dir/notes/hello.md
```
Expected: PUT 响应显示 bytes 与 reindex 字段；磁盘文件已更新

- [ ] **Step 5: 浏览器手动验证 UI 流程**

打开浏览器访问 http://localhost:7861，搜索 `hello`，点击 `notes/hello.md` 卡片，验证：
- preview header 有 `[编辑]` 按钮
- 点击后切换到 textarea + 行号
- 修改文字 → 出现 `●未保存`
- 点 `[保存]` → toast "已保存" → preview 重新渲染
- 再次进入编辑态 → 改文字 → 不保存 → 点击其他结果 → 弹 confirm

- [ ] **Step 6: 停止 server**

```bash
# kill background gui server
pkill -f "cortex gui" || true
```

- [ ] **Step 7: 提交（如有手动修复）**

如发现 bug，修复后提交。无需修改时跳过。

---

## Self-Review

**Spec coverage check**（按 spec 13 节核对）：

| Spec 节 | 对应 Task |
|---------|-----------|
| §4.1 编辑态入口 + [编辑] 按钮 | Task 8 (preview-pane integration) |
| §4.2 `●未保存` 指示 | Task 6 (md-editor) + Task 8 |
| §4.3 切换文件/搜索前的 confirm | Task 9 (search-view) |
| §5.1 `<md-editor>` 组件 | Task 6 |
| §5.2 `<preview-pane>` 修改 | Task 8 |
| §5.3 `<search-view>` 修改 | Task 9 |
| §6.1 GET 加 writable | Task 2 + 3 |
| §6.2 PUT 端点 | Task 4 |
| §6.3 前端 api client | Task 5 |
| §7.1 保存时机 | Task 6 (Ctrl+S + 按钮) + Task 9 (失败处理) |
| §7.2 Toast 反馈 | Task 7 + 9 |
| §7.3 索引同步 | Task 4 (trigger_background_reindex) |
| §8 Error Handling | Task 4 (后端错误码) + Task 9 (前端错误处理) |
| §10 后端测试 | Task 1-4 |
| §10 前端单测 | Task 5-9 |
| §10 E2E | Task 12 手动冒烟（spec 列了 e2e 自动化，但 v1 暂用手动） |
| §11 验收 1-15 | Task 12 步骤 3-5 覆盖；其他 AC 由 Task 1-9 单测覆盖 |

**Placeholder scan**：
- 全文搜索 `TBD` / `TODO` / `implement later` / `fill in` — 0 hits ✓
- 全文搜索 `类似 Task N` / `同上` / `...` — 0 hits（"同上"只用于指明旧代码块引用，已在 Step 3 明确指明替换目标）✓
- 每个 Task 都有具体代码块、具体命令、具体预期输出 ✓

**Type consistency**：
- `writable: bool` 在 models/preview.py / preview.py / preview-pane.ts / search-view.ts 全部一致 ✓
- `dirty-change` 事件 detail `{ dirty: boolean }` 在 md-editor / preview-pane / search-view 三处一致 ✓
- `save` 事件 detail `{ content: string }` 在 md-editor / preview-pane 一致 ✓
- `saved` 事件 detail（preview-pane → search-view）：Task 8 / Task 9 都用 `{ content }` ✓
- `save-failed` 事件 detail `{ message }` 在 preview-pane / search-view 一致 ✓
- `discard()` 公共方法在 md-editor / preview-pane 都有，签名一致 ✓
- `setError(msg)` 在 md-editor / preview-pane 调用一致 ✓
- `PreviewSaveError(code, message, status)` 在 api/preview.ts / search-view.ts 一致 ✓
- `pushToast(message, level, duration)` 在 toast-stack / search-view 一致 ✓
- `previewDirty: bool` 在 search-view 一处定义使用 ✓

**Risks**：
- R1 (跨视图切换 dirty 拦截) v1 不实现 — spec §5.3 已声明，本 plan 不涉及 ✓
- R2 (重索引性能) 由 Task 4 调用 `trigger_background_reindex` 接受其 fire-and-forget 行为 ✓
- R5 (与 file_watcher 竞态) 由现有 `_reindex_lock` 解决，本 plan 不引入新问题 ✓
- R6 (搜索结果不自动刷新) — 本 plan 不实现，spec §7.3 已说明 trade-off ✓
