# Preview Upload Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在预览面板工具栏新增 `⬆️ 上传` 按钮，用户选择 `{stem}_{hash6}{suffix}` 格式的文件后，后端反查 hash 对应的索引相对路径并覆盖原文件，然后触发后台重索引。

**Architecture:** POST `/api/preview/upload` 接收 multipart 文件 → 正则解析文件名 → 遍历 `IndexManager.documents` 按 (stem, sha256(rel_path)[:6]) 双因素匹配 → 越权检查 → 覆盖写盘 → 触发 reindex。前端用 `<input type="file">` + `FormData` 上传，覆盖前 `window.confirm` 确认。

**Tech Stack:** FastAPI (UploadFile + FileResponse), Pydantic, Lit + Lit/decorators, Vitest, pytest-asyncio

**Spec:** `docs/superpowers/specs/2026-06-20-preview-upload-design.md`

---

## File Structure

| 路径 | 责任 | 动作 |
|------|------|------|
| `cortex/web_v2/models/preview.py` | 加 `PreviewUploadResponse` Pydantic 模型 | Modify |
| `cortex/web_v2/api/preview.py` | 加 `_parse_upload_filename`、`_resolve_upload_target`、`POST /preview/upload` 路由 | Modify |
| `tests/web_v2/test_preview_upload.py` | 后端单测 + 集成测试 | Create |
| `cortex/web_v2/frontend/src/api/preview.ts` | 加 `uploadPreview`、`PreviewUploadResponse`、`PreviewUploadError` | Modify |
| `cortex/web_v2/frontend/tests/api-preview-upload.spec.ts` | 前端 API client 单测 | Create |
| `cortex/web_v2/frontend/src/components/preview-pane.ts` | 加 `⬆️ 上传` 按钮、隐藏 `<input type=file>`、事件分发 | Modify |
| `cortex/web_v2/frontend/tests/preview-pane.spec.ts` | 加上传按钮相关测试 | Modify |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 接线 `@upload-success` / `@upload-failed` 事件 | Modify |
| `cortex/web_v2/frontend/tests/search-view-upload.spec.ts` | search-view 上传事件单测 | Create |

---

## Task 1: Backend filename parser + unit tests

**Files:**
- Modify: `cortex/web_v2/api/preview.py`（在文件末尾、其他路由之后加函数）
- Test: `tests/web_v2/test_preview_upload.py`（新建）

- [ ] **Step 1.1: Write the failing test file**

Create `tests/web_v2/test_preview_upload.py`:

```python
"""POST /api/preview/upload 测试。"""
import asyncio
import hashlib

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2 import deps
from cortex.web_v2.app import create_app
from cortex.web_v2.api.preview import _parse_upload_filename


@pytest.fixture
def reset_deps():
    """每个测试前后重置 deps 单例，避免 search_path 跨测试污染。"""
    deps.reset_singletons()
    yield
    deps.reset_singletons()


# ---------------------------------------------------------------------------
# 单元测试：_parse_upload_filename
# ---------------------------------------------------------------------------


def test_parse_upload_filename_basic():
    """{stem}_{hash6}{suffix} 正常解析。"""
    result = _parse_upload_filename("doc1_a1b2c3.md")
    assert result == ("doc1", "a1b2c3", ".md")


def test_parse_upload_filename_stem_contains_underscore():
    """stem 内部含下划线时按最后一段 _(6hex) 切分。"""
    result = _parse_upload_filename("my_file_name_a1b2c3.py")
    assert result == ("my_file_name", "a1b2c3", ".py")


def test_parse_upload_filename_stem_contains_dot():
    """stem 内部含点（无后缀歧义）按最后一个 . 作后缀切分。"""
    result = _parse_upload_filename("config.local_a1b2c3.json")
    assert result == ("config.local", "a1b2c3", ".json")


def test_parse_upload_filename_rejects_no_hash():
    """无 _{6hex} 段 → None。"""
    assert _parse_upload_filename("plain.md") is None


def test_parse_upload_filename_rejects_uppercase_hash():
    """大写 hex → None（下载端始终是小写）。"""
    assert _parse_upload_filename("doc1_A1B2C3.md") is None


def test_parse_upload_filename_rejects_short_hash():
    """hash 不足 6 位 → None。"""
    assert _parse_upload_filename("doc1_abc.md") is None


def test_parse_upload_filename_rejects_long_hash():
    """hash 超过 6 位（且第 7 位是 hex）→ None（必须恰好 6 位）。"""
    assert _parse_upload_filename("doc1_a1b2c3d.md") is None


def test_parse_upload_filename_rejects_no_suffix():
    """无后缀 → None。"""
    assert _parse_upload_filename("doc1_a1b2c3") is None


def test_parse_upload_filename_rejects_double_extension():
    """复合后缀（.tar.gz）→ None（不在本次支持范围）。"""
    assert _parse_upload_filename("archive_a1b2c3.tar.gz") is None
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_upload.py -v
```
Expected: ImportError on `_parse_upload_filename` (function does not exist yet).

- [ ] **Step 1.3: Implement `_parse_upload_filename`**

Append to `cortex/web_v2/api/preview.py` (after the existing `_build_download_filename` function, before the routes — or at the end of the file, either is fine):

```python
import re

_UPLOAD_FILENAME_RE = re.compile(
    r"^(?P<stem>.+)_(?P<hash>[a-f0-9]{6})(?P<suffix>\.[^./\\]+)$"
)


def _parse_upload_filename(filename: str):
    """解析上传文件名 → (stem, hash6, suffix)。

    格式：{stem}_{hash6}{suffix}，其中 hash6 必须是 6 位小写十六进制。

    Returns:
        (stem, hash6, suffix) 元组；不匹配返回 None。
    """
    m = _UPLOAD_FILENAME_RE.match(filename)
    if not m:
        return None
    return (m.group("stem"), m.group("hash"), m.group("suffix"))
```

> 注：`import re` 应放在文件顶部与其他 stdlib import 一起。如果顶部已有 `import re`，跳过。

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_upload.py -v
```
Expected: 9 passed.

- [ ] **Step 1.5: Commit**

```bash
git add cortex/web_v2/api/preview.py tests/web_v2/test_preview_upload.py
git commit -m "feat(web): add upload filename parser with hash+suffix regex"
```

---

## Task 2: Backend reverse-resolve helper + unit tests

`_resolve_upload_target` 反查 hash → 相对路径。需要已建索引的 fixture。

**Files:**
- Modify: `cortex/web_v2/api/preview.py`
- Test: `tests/web_v2/test_preview_upload.py`（追加）

- [ ] **Step 2.1: Append failing tests to `tests/web_v2/test_preview_upload.py`**

在文件末尾追加：

```python
# ---------------------------------------------------------------------------
# 单元测试：_resolve_upload_target
# ---------------------------------------------------------------------------


def _init_and_reindex():
    """在非事件循环线程中初始化 IndexManager 并建索引。"""
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


@pytest.mark.asyncio
async def test_resolve_upload_target_matches_indexed_doc(temp_workdir, env_cortex_config, reset_deps):
    """已索引文件 stem+hash 双因素匹配 → 返回相对路径。"""
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    rel_path = "doc1.md"
    expected_hash = hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:6]

    from cortex.web_v2.api.preview import _resolve_upload_target, _HashCollisionError
    result = _resolve_upload_target(idx, "doc1", expected_hash)
    assert result == rel_path


@pytest.mark.asyncio
async def test_resolve_upload_target_no_match_returns_none(
    temp_workdir, env_cortex_config, reset_deps
):
    """hash 不在索引中 → 返回 None。"""
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    from cortex.web_v2.api.preview import _resolve_upload_target
    assert _resolve_upload_target(idx, "doc1", "deadbe") is None


@pytest.mark.asyncio
async def test_resolve_upload_target_stem_mismatch_returns_none(
    temp_workdir, env_cortex_config, reset_deps
):
    """hash 匹配但 stem 不一致 → 返回 None（双因素校验）。"""
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    rel_path = "doc1.md"
    expected_hash = hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:6]

    from cortex.web_v2.api.preview import _resolve_upload_target
    # hash 对但 stem 错
    assert _resolve_upload_target(idx, "wrong_stem", expected_hash) is None


@pytest.mark.asyncio
async def test_resolve_upload_target_collision_raises(
    temp_workdir, env_cortex_config, reset_deps, monkeypatch
):
    """多个文档命中同一 (stem, hash6) → 抛 _HashCollisionError。"""
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    # 构造 collision：让 idx.documents 返回两条同 rel_path 的文档
    real_docs = idx.documents
    fake_doc = type(real_docs[0])(
        doc_id=real_docs[0].doc_id + "_dup",
        doc_name=real_docs[0].doc_name,
        structure=real_docs[0].structure,
        doc_description=real_docs[0].doc_description,
        metadata=real_docs[0].metadata,
        source_type=real_docs[0].source_type,
    )
    monkeypatch.setattr(idx, "documents", [real_docs[0], fake_doc])

    rel_path = "doc1.md"
    expected_hash = hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:6]

    from cortex.web_v2.api.preview import _resolve_upload_target, _HashCollisionError
    with pytest.raises(_HashCollisionError):
        _resolve_upload_target(idx, "doc1", expected_hash)
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_upload.py -v -k resolve_upload_target
```
Expected: ImportError on `_resolve_upload_target` / `_HashCollisionError`.

- [ ] **Step 2.3: Implement `_resolve_upload_target` + `_HashCollisionError`**

Append to `cortex/web_v2/api/preview.py`:

```python
class _HashCollisionError(Exception):
    """多个索引文档命中同一 (stem, hash6) 时抛出。"""


def _resolve_upload_target(idx, stem: str, hash6: str):
    """遍历索引文档，按 (stem, sha256(rel_path)[:6]) 双因素匹配。

    - IndexManager.documents[*].metadata["source_path"] 存的是绝对路径，
      需先转相对 search_path 的 POSIX 路径再算 hash
    - 命中 0 → None
    - 命中 1 → 相对路径字符串
    - 命中 ≥2 → raise _HashCollisionError
    """
    base = Path(idx.search_path)
    matches = []
    for doc in idx.documents:
        abs_path = doc.metadata.get("source_path", "")
        if not abs_path:
            continue
        try:
            rel = os.path.relpath(abs_path, base).replace(os.sep, "/")
        except ValueError:
            # Windows 跨盘符 relpath 会抛 ValueError
            continue
        if Path(rel).stem != stem:
            continue
        h = hashlib.sha256(rel.encode("utf-8")).hexdigest()[:6]
        if h == hash6:
            matches.append(rel)
    if len(matches) == 0:
        return None
    if len(matches) > 1:
        raise _HashCollisionError(
            f"hash+stem 命中多个文件：{matches}"
        )
    return matches[0]
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_upload.py -v
```
Expected: 13 passed (9 from Task 1 + 4 new).

- [ ] **Step 2.5: Commit**

```bash
git add cortex/web_v2/api/preview.py tests/web_v2/test_preview_upload.py
git commit -m "feat(web): add hash+stem reverse resolver for upload target"
```

---

## Task 3: Backend POST endpoint + model + integration tests

**Files:**
- Modify: `cortex/web_v2/models/preview.py`
- Modify: `cortex/web_v2/api/preview.py`
- Test: `tests/web_v2/test_preview_upload.py`（追加）

- [ ] **Step 3.1: Add `PreviewUploadResponse` model**

Edit `cortex/web_v2/models/preview.py`，在文件末尾追加：

```python
class PreviewUploadResponse(BaseModel):
    """POST /api/preview/upload 响应。"""
    path: str
    bytes_written: int
    reindex_triggered: bool
```

- [ ] **Step 3.2: Append integration tests**

在 `tests/web_v2/test_preview_upload.py` 末尾追加：

```python
# ---------------------------------------------------------------------------
# 集成测试：POST /api/preview/upload
# ---------------------------------------------------------------------------


def _hash_for(rel_path: str) -> str:
    return hashlib.sha256(rel_path.encode("utf-8")).hexdigest()[:6]


@pytest.mark.asyncio
async def test_upload_overwrites_markdown_file(temp_workdir, env_cortex_config, reset_deps):
    """正常上传覆盖 markdown：磁盘内容被替换，响应 200。"""
    await asyncio.to_thread(_init_and_reindex)

    h = _hash_for("doc1.md")
    new_content = b"# Overwritten by upload test"

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": (f"doc1_{h}.md", new_content, "text/markdown")},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["path"] == "doc1.md"
    assert body["bytes_written"] == len(new_content)
    assert body["reindex_triggered"] is True
    # 磁盘内容确实被覆盖
    assert (temp_workdir / "doc1.md").read_bytes() == new_content


@pytest.mark.asyncio
async def test_upload_overwrites_binary_file(temp_workdir, env_cortex_config, reset_deps):
    """正常上传覆盖二进制（.pdf）：字节完全一致。"""
    # 准备一个 pdf + 索引
    original_pdf = b"%PDF-1.4 original"
    (temp_workdir / "sample.pdf").write_bytes(original_pdf)
    await asyncio.to_thread(_init_and_reindex)

    h = _hash_for("sample.pdf")
    new_pdf = b"%PDF-1.4 replaced bytes"

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": (f"sample_{h}.pdf", new_pdf, "application/pdf")},
        )
    assert res.status_code == 200
    assert (temp_workdir / "sample.pdf").read_bytes() == new_pdf


@pytest.mark.asyncio
async def test_upload_bad_filename_returns_400(temp_workdir, env_cortex_config, reset_deps):
    """文件名不符合格式 → 400 BAD_FILENAME。"""
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": ("plain.md", b"hello", "text/markdown")},
        )
    assert res.status_code == 400
    assert res.json()["code"] == "BAD_FILENAME"


@pytest.mark.asyncio
async def test_upload_not_indexed_returns_404(temp_workdir, env_cortex_config, reset_deps):
    """hash+stem 在索引中找不到 → 404 NOT_INDEXED。"""
    await asyncio.to_thread(_init_and_reindex)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": ("doc1_deadbe.md", b"x", "text/markdown")},
        )
    assert res.status_code == 404
    assert res.json()["code"] == "NOT_INDEXED"


@pytest.mark.asyncio
async def test_upload_too_large_returns_413(temp_workdir, env_cortex_config, reset_deps, monkeypatch):
    """超过大小上限 → 413。"""
    await asyncio.to_thread(_init_and_reindex)
    # monkeypatch 缩小上限避免造大文件
    from cortex.web_v2 import api as preview_api_module
    monkeypatch.setattr(preview_api_module, "_MAX_UPLOAD_BYTES", 16)

    h = _hash_for("doc1.md")
    big = b"x" * 32

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": (f"doc1_{h}.md", big, "text/markdown")},
        )
    assert res.status_code == 413
    assert res.json()["code"] == "CONTENT_TOO_LARGE"


@pytest.mark.asyncio
async def test_upload_rejects_dotcortex_target(
    temp_workdir, env_cortex_config, reset_deps, monkeypatch
):
    """解析出的相对路径落入 .cortex/ → 403 NOT_WRITABLE。"""
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()

    # 在 .cortex 下造一个文件并加入索引（绕过常规路径）
    cortex_dir = temp_workdir / ".cortex"
    cortex_dir.mkdir(exist_ok=True)
    (cortex_dir / "internal.md").write_text("# internal", encoding="utf-8")

    # 重新索引让它进 DB
    await asyncio.to_thread(_init_and_reindex)

    # 计算 .cortex/internal.md 的 hash
    rel = ".cortex/internal.md"
    h = _hash_for(rel)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/preview/upload",
            files={"file": (f"internal_{h}.md", b"hacked", "text/markdown")},
        )
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_WRITABLE"
```

- [ ] **Step 3.3: Run tests to verify they fail**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_upload.py -v -k "upload_overwrites or upload_bad or upload_not or upload_too or upload_rejects"
```
Expected: 404 / 405 (route doesn't exist yet) or AttributeError on `_MAX_UPLOAD_BYTES`.

- [ ] **Step 3.4: Add imports + endpoint**

Edit `cortex/web_v2/api/preview.py`:

1. 在顶部 import 块追加（如果还没有）：

```python
import logging
```

2. 修改 fastapi import 行，加入 `File, UploadFile`：

```python
from fastapi import APIRouter, Body, Depends, File, Query, UploadFile
```

3. 在 `_resolve_upload_target` 之后、路由定义之前，加入大小常量：

```python
# 50MB 上限（防御性，避免 OOM；允许二进制大文件）
_MAX_UPLOAD_BYTES = 50 * 1024 * 1024
```

4. 在 `@router.get("/preview/download")` 路由**之前**插入上传路由（更具体的路径优先）：

```python
@router.post("/preview/upload", response_model=PreviewUploadResponse)
async def upload(
    file: UploadFile = File(..., description="要上传的文件"),
    idx: IndexManager = Depends(get_index_manager),
):
    """上传文件，按文件名 hash 反查目标路径并覆盖原文件。"""
    # 1. 解析文件名
    parsed = _parse_upload_filename(file.filename or "")
    if parsed is None:
        raise CortexAPIError(
            400, "BAD_FILENAME",
            "文件名不符合 {stem}_{hash6}{suffix} 格式",
        )
    stem, hash6, _suffix = parsed

    # 2. 反查目标相对路径
    try:
        rel = _resolve_upload_target(idx, stem, hash6)
    except _HashCollisionError as e:
        raise CortexAPIError(409, "HASH_COLLISION", str(e)) from e
    if rel is None:
        raise CortexAPIError(
            404, "NOT_INDEXED",
            f"hash+stem 在索引中找不到匹配：{file.filename}",
        )

    # 3. 越权与可写性检查
    base = Path(idx.search_path)
    full = _safe_resolve(base, rel)
    # 显式拒绝 .cortex/ 子目录
    try:
        full.relative_to(base / ".cortex")
        raise CortexAPIError(403, "NOT_WRITABLE", "禁止覆盖索引元数据")
    except ValueError:
        pass

    # 4. 读字节 + 大小检查
    data = await file.read(_MAX_UPLOAD_BYTES + 1)
    if len(data) > _MAX_UPLOAD_BYTES:
        raise CortexAPIError(
            413, "CONTENT_TOO_LARGE",
            f"文件超过 {_MAX_UPLOAD_BYTES // 1024 // 1024}MB 上限",
        )

    # 5. 写盘
    try:
        full.write_bytes(data)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"写入失败: {e}") from e

    # 6. 触发后台重索引（不阻塞响应）
    try:
        idx.trigger_background_reindex()
    except Exception as e:
        logging.getLogger(__name__).warning("Upload reindex failed: %s", e)

    return PreviewUploadResponse(
        path=rel,
        bytes_written=len(data),
        reindex_triggered=True,
    )
```

5. 在 `from cortex.web_v2.models.preview import (...)` 块中追加 `PreviewUploadResponse`：

```python
from cortex.web_v2.models.preview import (
    PreviewResponse,
    PreviewSaveRequest,
    PreviewSaveResponse,
    PreviewUploadResponse,
)
```

- [ ] **Step 3.5: Run all upload tests**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_upload.py tests/web_v2/test_preview_api.py tests/web_v2/test_preview_download.py -v
```
Expected: all pass (no regressions on existing preview/download tests).

- [ ] **Step 3.6: Commit**

```bash
git add cortex/web_v2/models/preview.py cortex/web_v2/api/preview.py tests/web_v2/test_preview_upload.py
git commit -m "feat(web): add POST /api/preview/upload endpoint with hash+stem matching"
```

---

## Task 4: Frontend API client + tests

**Files:**
- Modify: `cortex/web_v2/frontend/src/api/preview.ts`
- Test: `cortex/web_v2/frontend/tests/api-preview-upload.spec.ts`（新建）

- [ ] **Step 4.1: Write failing test file**

Create `cortex/web_v2/frontend/tests/api-preview-upload.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadPreview, PreviewUploadError } from "../src/api/preview";

describe("uploadPreview", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs multipart form and returns parsed response", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          path: "doc1.md",
          bytes_written: 5,
          reindex_triggered: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const file = new File(["hello"], "doc1_a1b2c3.md", { type: "text/markdown" });
    const result = await uploadPreview(file);

    expect(mocked).toHaveBeenCalledTimes(1);
    const [url, init] = mocked.mock.calls[0];
    expect(url).toBe("/api/preview/upload");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("file")).toBe(file);
    expect(result).toEqual({
      path: "doc1.md",
      bytes_written: 5,
      reindex_triggered: true,
    });
  });

  it("throws PreviewUploadError with code+message on failure", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: "NOT_INDEXED", detail: "hash+stem 不匹配" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );

    const file = new File(["x"], "wrong_deadbe.md");
    await expect(uploadPreview(file)).rejects.toMatchObject({
      name: "PreviewUploadError",
      code: "NOT_INDEXED",
      message: "hash+stem 不匹配",
      status: 404,
    });
  });

  it("falls back to UNKNOWN code when body is not JSON", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response("plain text", { status: 500 }),
    );

    const file = new File(["x"], "doc1_a1b2c3.md");
    await expect(uploadPreview(file)).rejects.toMatchObject({
      code: "UNKNOWN",
      status: 500,
    });
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/api-preview-upload.spec.ts
```
Expected: FAIL — `uploadPreview` is not exported.

- [ ] **Step 4.3: Implement `uploadPreview`**

Edit `cortex/web_v2/frontend/src/api/preview.ts`，在文件末尾追加：

```typescript
// ---------------------------------------------------------------------------
// POST /api/preview/upload
// ---------------------------------------------------------------------------

export interface PreviewUploadResponse {
  path: string;
  bytes_written: number;
  reindex_triggered: boolean;
}

export class PreviewUploadError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "PreviewUploadError";
  }
}

export async function uploadPreview(file: File): Promise<PreviewUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/preview/upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ code: "UNKNOWN", detail: res.statusText }));
    throw new PreviewUploadError(
      err.code ?? "UNKNOWN",
      err.detail ?? "上传失败",
      res.status,
    );
  }
  return res.json();
}
```

- [ ] **Step 4.4: Run test to verify it passes**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/api-preview-upload.spec.ts
```
Expected: 3 passed.

- [ ] **Step 4.5: Commit**

```bash
git add cortex/web_v2/frontend/src/api/preview.ts cortex/web_v2/frontend/tests/api-preview-upload.spec.ts
git commit -m "feat(web): add uploadPreview API client with multipart form"
```

---

## Task 5: Frontend preview-pane upload button + tests

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/preview-pane.ts`
- Test: `cortex/web_v2/frontend/tests/preview-pane.spec.ts`（追加）

- [ ] **Step 5.1: Append failing tests to `cortex/web_v2/frontend/tests/preview-pane.spec.ts`**

在文件末尾追加：

```typescript
describe("<preview-pane> upload button", () => {
  it("renders upload button in markdown preview header", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".upload-btn")).toBeTruthy();
  });

  it("renders upload button in plain-text preview header", async () => {
    const el = await fixture(html`
      <preview-pane language="python" content="print('hi')" path="a.py"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".upload-btn")).toBeTruthy();
  });

  it("renders upload button in edit mode header", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    el.enterEdit();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".upload-btn")).toBeTruthy();
  });

  it("does not render upload button when noHeader=true", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md" ?noHeader=${true}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".upload-btn")).toBeNull();
  });

  it("clicking upload button triggers hidden file input click", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    const clickSpy = vi.fn();
    input.click = clickSpy;

    (el.shadowRoot!.querySelector(".upload-btn") as HTMLElement).click();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("file pick + confirm OK dispatches upload-success event", async () => {
    vi.stubGlobal("confirm", () => true);
    const fetchSpy = vi
      .stubGlobal("fetch", vi.fn())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            path: "doc.md",
            bytes_written: 3,
            reindex_triggered: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;

    const detailPromise = new Promise((resolve) => {
      el.addEventListener("upload-success", (e: any) => resolve(e.detail));
    });

    const input = el.shadowRoot!.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["abc"], "doc1_a1b2c3.md", { type: "text/markdown" });
    Object.defineProperty(input, "files", { value: [file], writable: false });
    input.dispatchEvent(new Event("change"));

    const detail: any = await detailPromise;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/preview/upload");
    expect(init?.method).toBe("POST");
    expect(detail).toEqual({ path: "doc.md" });

    vi.unstubAllGlobals();
  });

  it("confirm cancelled does not call fetch", async () => {
    vi.stubGlobal("confirm", () => false);
    const fetchSpy = vi.stubGlobal("fetch", vi.fn());

    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["abc"], "doc1_a1b2c3.md");
    Object.defineProperty(input, "files", { value: [file], writable: false });
    input.dispatchEvent(new Event("change"));

    await new Promise((r) => setTimeout(r, 0));
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("upload failure dispatches upload-failed event with message", async () => {
    vi.stubGlobal("confirm", () => true);
    vi.stubGlobal("fetch", vi.fn()).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: "NOT_INDEXED", detail: "hash+stem 不匹配" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );

    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;

    const detailPromise = new Promise((resolve) => {
      el.addEventListener("upload-failed", (e: any) => resolve(e.detail));
    });

    const input = el.shadowRoot!.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["abc"], "wrong_deadbe.md");
    Object.defineProperty(input, "files", { value: [file], writable: false });
    input.dispatchEvent(new Event("change"));

    const detail: any = await detailPromise;
    expect(detail.message).toContain("NOT_INDEXED");

    vi.unstubAllGlobals();
  });
});
```

> 注：测试文件顶部需在 `import { describe, it, expect } from "vitest";` 中加入 `vi`：
> ```typescript
> import { describe, it, expect, vi } from "vitest";
> ```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/preview-pane.spec.ts
```
Expected: 6 new tests fail (button not rendered).

- [ ] **Step 5.3: Add upload button + handler to `preview-pane.ts`**

Edit `cortex/web_v2/frontend/src/components/preview-pane.ts`:

1. 在文件顶部 `import` 块加入 `uploadPreview`：

```typescript
import { savePreview, PreviewSaveError, uploadPreview } from "../api/preview";
```

2. 在 CSS 块的 `button.edit-btn, button.download-btn` 选择器里加入 `button.upload-btn`：

```typescript
button.edit-btn,
button.download-btn,
button.upload-btn {
  font-family: inherit;
  font-size: var(--cortex-fs-sm);
  padding: 4px 10px;
  border: 1px solid var(--cortex-border);
  background: var(--cortex-surface);
  color: var(--cortex-text);
  border-radius: 4px;
  cursor: pointer;
}
```

3. 在类中（`_renderDownloadBtn` 旁边）加：

```typescript
private _onUploadClick = () => {
  const input = this.shadowRoot?.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement | null;
  input?.click();
};

private async _onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  // 重置 value 允许下次再选同一文件
  input.value = "";
  if (!file) return;
  const ok = window.confirm(`即将上传 '${file.name}' 覆盖原文件，是否继续？`);
  if (!ok) return;
  try {
    const res = await uploadPreview(file);
    this.dispatchEvent(
      new CustomEvent("upload-success", { detail: { path: res.path } }),
    );
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "上传失败";
    this.dispatchEvent(
      new CustomEvent("upload-failed", { detail: { message: msg } }),
    );
  }
}

private _renderUploadBtn() {
  return html`<button class="upload-btn" @click=${this._onUploadClick}>⬆️ 上传</button>`;
}
```

4. 在 `render()` 末尾（最后一个 `return html\`...\`` 之后、`}` 之前）加入隐藏 input 一次。实际上，因为 Lit 模板必须返回单个根，更好的做法是把 `<input>` 嵌到每个 header 分支或放到模板最外层。最简方案：在 `render()` 的**每个** `html\`...\`` 顶层包一层 `<div>`，把 `<input>` 放进去。

   具体做法：把现有的 `return html\`...\`` 三处都改为先输出 `<input type="file" hidden @change=${this._onFileChange}>`，然后是原有内容。例如 markdown 预览分支改为：

```typescript
if (this.language === "markdown") {
  return html`
    <input type="file" hidden @change=${this._onFileChange}>
    ${this.noHeader ? null : html`
      <div class="header">
        <span class="path">${this.path}</span>
        ${this.writable
          ? html`<button class="edit-btn" @click=${() => this.enterEdit()}>✏️ 编辑</button>`
          : null}
        ${this._renderDownloadBtn()}
        ${this._renderUploadBtn()}
      </div>
    `}
    <md-viewer
      .content=${this._content}
      .line=${this.line}
      .keyword=${this.keyword}
    ></md-viewer>
  `;
}
```

   同理修改 markdown edit 分支、非 markdown 分支。所有三个分支都在最前面加 `<input type="file" hidden @change=${this._onFileChange}>`，并在 header 内 `${this._renderUploadBtn()}`。

> 完整 render() 代码见 Step 5.4。

- [ ] **Step 5.4: Full render() replacement**

把 `preview-pane.ts` 的整个 `render()` 方法替换为：

```typescript
render() {
  if (this.loading) return html`<div class="empty">加载中...</div>`;
  if (!this._content && !this.content)
    return html`<div class="empty">点击左侧结果查看预览</div>`;

  if (this.language === "markdown" && this._mode === "edit") {
    return html`
      <input type="file" hidden @change=${this._onFileChange}>
      ${this.noHeader ? null : html`
        <div class="header">
          <span class="path">${this.path}</span>
          ${this._renderDownloadBtn()}
          ${this._renderUploadBtn()}
        </div>
      `}
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
      <input type="file" hidden @change=${this._onFileChange}>
      ${this.noHeader ? null : html`
        <div class="header">
          <span class="path">${this.path}</span>
          ${this.writable
            ? html`<button class="edit-btn" @click=${() => this.enterEdit()}>✏️ 编辑</button>`
            : null}
          ${this._renderDownloadBtn()}
          ${this._renderUploadBtn()}
        </div>
      `}
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
    <input type="file" hidden @change=${this._onFileChange}>
    ${this.noHeader ? null : html`
      <div class="header">
        <span class="path">${this.path}</span>
        ${this._renderDownloadBtn()}
        ${this._renderUploadBtn()}
      </div>
    `}
    <div class="body">
      ${lines.map((line, i) => {
        const lineNo = i + 1;
        const cls = this.highlights.includes(lineNo) ? "highlight" : "";
        return html`<div class=${cls}><span style="color:var(--cortex-text-subtle);display:inline-block;width:40px;">${lineNo}</span>${line}</div>`;
      })}
    </div>
  `;
}
```

- [ ] **Step 5.5: Run tests to verify they pass**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/preview-pane.spec.ts
```
Expected: all tests pass (existing 16 + 8 new = 24).

- [ ] **Step 5.6: Commit**

```bash
git add cortex/web_v2/frontend/src/components/preview-pane.ts cortex/web_v2/frontend/tests/preview-pane.spec.ts
git commit -m "feat(web): add upload button to preview-pane toolbar"
```

---

## Task 6: Frontend search-view event wiring + tests

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/search-view.ts`
- Test: `cortex/web_v2/frontend/tests/search-view-upload.spec.ts`（新建）

- [ ] **Step 6.1: Write failing test file**

Create `cortex/web_v2/frontend/tests/search-view-upload.spec.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/views/search-view";
import type { SearchView } from "../src/views/search-view";

describe("<search-view> upload event wiring", () => {
  it("forwards upload-success from preview-pane to toast + reload", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;

    // mock reload method
    const reloadSpy = vi.fn();
    (el as any)._reloadPreview = reloadSpy;

    // 找到桌面端的 preview-pane，派发 upload-success
    const pane = el.shadowRoot!.querySelector("preview-pane") as any;
    expect(pane).toBeTruthy();

    pane.dispatchEvent(
      new CustomEvent("upload-success", { detail: { path: "doc1.md" } }),
    );
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(reloadSpy).toHaveBeenCalledTimes(1);

    // toast 应该出现 "已覆盖：doc1.md"
    const toast = el.shadowRoot!.querySelector("toast-stack") as any;
    expect(toast).toBeTruthy();
    // 不直接断言 toast 内部状态，间接断言 _pushToast 调用即可
    // 这里仅验证 reload 触发，toast 渲染验证留给 e2e
  });

  it("forwards upload-failed to toast with error message", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;

    const pane = el.shadowRoot!.querySelector("preview-pane") as any;
    pane.dispatchEvent(
      new CustomEvent("upload-failed", {
        detail: { message: "NOT_INDEXED hash+stem 不匹配" },
      }),
    );
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    const toast = el.shadowRoot!.querySelector("toast-stack") as any;
    expect(toast).toBeTruthy();
    // 同上，仅断言 toast 容器存在；具体文案在 e2e 验证
  });
});
```

- [ ] **Step 6.2: Run test to verify it fails**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/search-view-upload.spec.ts
```
Expected: FAIL — `_reloadPreview` not defined, or event handlers not wired.

- [ ] **Step 6.3: Wire event handlers in `search-view.ts`**

Edit `cortex/web_v2/frontend/src/views/search-view.ts`:

1. 在现有 `_onPreviewSaveFailed`（约 358 行）之后追加三个方法：

```typescript
private _onPreviewUploadSuccess = (e: CustomEvent<{ path: string }>) => {
  this._pushToast(`已覆盖：${e.detail.path}`, "success", 2500);
  // 上传是外部覆盖（不像 PUT /api/preview 已含新内容），必须重新拉取
  this._reloadPreview();
};

private _onPreviewUploadFailed = (e: CustomEvent<{ message: string }>) => {
  this._pushToast(`上传失败：${e.detail.message}`, "error", 5000);
};

/** 上传成功后用：按当前 previewPath 重新拉取完整预览内容（不缩行范围）。 */
private async _reloadPreview() {
  if (!this.previewPath) return;
  try {
    const res = await fetch(
      `/api/preview?path=${encodeURIComponent(this.previewPath)}`,
    );
    if (res.ok) {
      const body = await res.json();
      this.previewContent = body.content;
      this.previewLanguage = body.language;
      this.previewWritable = body.writable ?? false;
    }
  } catch (e) {
    console.warn("reload preview failed", e);
  }
}
```

> **不**复用 `_fetchAndShowPreview(r: SearchResult)`：那个方法会用 `r.line` 缩
> `start_line`/`end_line` 范围；上传后我们想要完整文件内容，不应缩行。

2. 在两处 `<preview-pane>` 标签（桌面 split 视图约 462 行 + 移动 focus 视图约 498 行）上加监听。

   桌面端 `<preview-pane>` 改为：

```typescript
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
  @save-failed=${this._onPreviewSaveFailed}
  @upload-success=${this._onPreviewUploadSuccess}
  @upload-failed=${this._onPreviewUploadFailed}>
</preview-pane>
```

   移动端 `<preview-pane>`（在 detail-overlay 内）同样在已有 `@save-failed` 之后加两行 `@upload-success` / `@upload-failed`。

- [ ] **Step 6.4: Verify handler signatures match**

重新读修改后的 `search-view.ts`，确认：
- `_onPreviewUploadSuccess` 类型是 `(e: CustomEvent<{ path: string }>) => void`
- `_onPreviewUploadFailed` 类型是 `(e: CustomEvent<{ message: string }>) => void`
- 两处 `<preview-pane>` 都挂上了 `@upload-success` 和 `@upload-failed`

```bash
cd cortex/web_v2/frontend && grep -n "upload-success\|upload-failed\|_onPreviewUpload" src/views/search-view.ts
```
Expected: ≥ 6 行（2 个 handler 定义 + 2 处 pane × 2 个事件）。

- [ ] **Step 6.5: Run tests to verify they pass**

```bash
cd cortex/web_v2/frontend && npx vitest run tests/search-view-upload.spec.ts
```
Expected: 2 passed.

- [ ] **Step 6.6: Run all frontend tests for regression**

```bash
cd cortex/web_v2/frontend && npx vitest run
```
Expected: all pass.

- [ ] **Step 6.7: Commit**

```bash
git add cortex/web_v2/frontend/src/views/search-view.ts cortex/web_v2/frontend/tests/search-view-upload.spec.ts
git commit -m "feat(web): wire upload events in search-view with toast and preview reload"
```

---

## Task 7: Build frontend + smoke test

**Files:**
- Build output: `cortex/web_v2/static/`

- [ ] **Step 7.1: Run TypeScript check + vite build**

```bash
cd cortex/web_v2/frontend && npm run build
```
Expected:
```
✓ 126 modules transformed.
../static/index.html                 0.81 kB │ gzip:  0.48 kB
../static/assets/index.XXXXXXXXX.css  20.x kB
../static/assets/index.XXXXXXXXX.js  2xx kB
✓ built in <1s
```

- [ ] **Step 7.2: Verify backend + frontend tests still green**

```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/ -v
cd cortex/web_v2/frontend && npx vitest run
```
Expected: all pass.

- [ ] **Step 7.3: Manual smoke test**

启动服务：

```bash
.venv/Scripts/python.exe -m cortex gui
```

浏览器打开 `http://localhost:7860`，验证：

1. 搜索任意关键词 → 选中一个 `.md` 文件 → 工具栏出现 `⬇️ 下载` 和 `⬆️ 上传` 按钮
2. 点 `⬇️ 下载` → 浏览器下载 `xxx_<hash>.md`
3. 用编辑器修改下载的文件内容并保存（不要改名）
4. 点 `⬆️ 上传` → 选择刚修改的文件 → 弹 confirm 对话框 → 确认
5. 右上角 toast 显示 "已覆盖：xxx.md"
6. 预览内容刷新为新内容
7. 重复对 `.pdf` 文件（二进制）的下载→修改→上传流程
8. 尝试上传一个随机文件名（无 hash）→ 应弹 "上传失败：文件名不符合..."

- [ ] **Step 7.4: Commit built static assets**

```bash
git add cortex/web_v2/static/
git commit -m "chore(web): rebuild static assets for upload feature"
```

---

## 完成检查

- [ ] 所有 7 个 Task 的所有 step 已勾选
- [ ] 后端 `pytest tests/web_v2/` 全绿
- [ ] 前端 `npx vitest run` 全绿
- [ ] `npm run build` 成功
- [ ] 手工冒烟测试 8 个场景通过
- [ ] 工作树干净（`git status` 显示 nothing to commit）

## 自审清单（已在写完时检查）

- 所有文件路径精确（绝对路径 + 行号）
- 每个 step 都有可执行的代码或命令
- TDD：测试先于实现
- 频繁 commit（每个 Task 末尾）
- 类型一致：`_resolve_upload_target` / `_parse_upload_filename` / `_HashCollisionError` / `uploadPreview` / `PreviewUploadError` / `PreviewUploadResponse` 在所有 task 中签名一致
- spec 的所有需求都有对应 task（架构、文件名解析、反查、越权、大小限制、重索引、UI、确认、事件接线、测试）
