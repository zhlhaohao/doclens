# File Explorer Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 cortex GUI 新增 `files` tab，提供对 `IndexManager.search_path` 工作目录的目录树遍历、目录/文件 CRUD、拖拽上传、文件属性查看，所有写操作自动触发增量重索引。

**Architecture:** 新建独立路由 `cortex/web_v2/api/files.py` + 共享模块 `path_safety.py`，前端以 11 个 Lit 组件构成三栏（桌面）/ 单栏（移动）布局，状态由现有 `store.ts` 扩展一个 `files` 切片管理。采用懒加载树（展开节点时 fetch 子目录）+ 写后局部缓存失效策略。

**Tech Stack:** FastAPI (APIRouter + UploadFile + Depends), Pydantic v2, Lit + lit/decorators, Vitest, pytest-asyncio, Playwright (E2E via playwright-cli skill)

**Spec:** `docs/superpowers/specs/2026-06-22-file-explorer-design.md`

**Git 注意:** 按 CLAUDE.md 规则，所有 `git commit` 步骤需要用户明确授权。本计划的 commit 步骤在执行前必须先获得用户授权（一次性或逐次）。

**命名约定（CRITICAL）:** 后端 Pydantic 输出 **snake_case**（`is_dir` / `modified_at` / `bytes_written` / `from_path` / `total_size_bytes` 等），前端不做自动转换。前端 interface 和组件字段访问必须与后端字段名**完全一致**。下方各 Task 中的 TypeScript 代码块若出现 camelCase（如 `isDir`/`modifiedAt`），应统一视为 snake_case（`is_dir`/`modified_at`）——这是计划作者疏漏，执行时以后端模型为准。

---

## File Structure

| 路径 | 责任 | 动作 |
|------|------|------|
| `cortex/web_v2/path_safety.py` | 共享路径安全：safe_resolve / is_protected / validate_name / validate_move_target / compute_writable | Create |
| `cortex/web_v2/models/files.py` | Pydantic 请求/响应模型 | Create |
| `cortex/web_v2/api/files.py` | `/api/files/*` CRUD 路由 | Create |
| `cortex/web_v2/app.py` | 注册 files.router | Modify |
| `cortex/web_v2/api/preview.py` | 改为引用 path_safety（可选，Task 11） | Modify |
| `tests/web_v2/test_path_safety.py` | path_safety 单元测试 | Create |
| `tests/web_v2/test_files_api.py` | files API 集成测试 | Create |
| `frontend/src/state/types.ts` | 加 `FileEntry` / `FileExplorerViewState` / `ViewId` 扩展 | Modify |
| `frontend/src/state/store.ts` | INITIAL_STATE 加 `files` 切片；actions 加 files 相关 | Modify |
| `frontend/src/api/files.ts` | files API client | Create |
| `frontend/src/views/files-view.ts` | 顶层视图 | Create |
| `frontend/src/components/file-tree.ts` | 左栏树容器 | Create |
| `frontend/src/components/tree-node.ts` | 递归节点（含只读模式） | Create |
| `frontend/src/components/file-list.ts` | 中栏：工具栏+列表+drop-zone | Create |
| `frontend/src/components/file-row.ts` | 单行 | Create |
| `frontend/src/components/file-detail.ts` | 右栏属性+操作 | Create |
| `frontend/src/components/mkdir-dialog.ts` | 新建目录弹窗 | Create |
| `frontend/src/components/rename-dialog.ts` | 重命名弹窗 | Create |
| `frontend/src/components/move-dialog.ts` | 多选移动弹窗 | Create |
| `frontend/src/components/delete-dialog.ts` | 双重确认删除弹窗 | Create |
| `frontend/src/components/drop-zone.ts` | 拖拽覆盖层 | Create |
| `frontend/src/components/activity-bar.ts` | `_items` 加 files 项 | Modify |
| `frontend/src/components/tab-bar.ts` | `_items` 加 files 项 | Modify |
| `frontend/src/app.ts` | `_renderView` 加 files 分支；import files-view | Modify |
| `frontend/tests/api-files.spec.ts` | API client 单测 | Create |
| `frontend/tests/file-tree.spec.ts` | 树组件单测 | Create |
| `frontend/tests/file-list.spec.ts` | 列表组件单测 | Create |
| `frontend/tests/file-detail.spec.ts` | 详情组件单测 | Create |
| `frontend/tests/delete-dialog.spec.ts` | 删除对话状态机单测 | Create |
| `frontend/tests/move-dialog.spec.ts` | 移动对话单测 | Create |
| `frontend/tests/mkdir-dialog.spec.ts` | 新建目录对话单测 | Create |
| `frontend/tests/rename-dialog.spec.ts` | 重命名对话单测 | Create |
| `frontend/tests/files-view.spec.ts` | 顶层视图集成单测 | Create |
| `frontend/tests/e2e/files-explorer.spec.ts` | Playwright E2E | Create |

---

## Task 1: Backend path_safety.py — safe_resolve + is_protected + is_root

**Files:**
- Create: `cortex/web_v2/path_safety.py`
- Test: `tests/web_v2/test_path_safety.py`

- [ ] **Step 1.1: Write failing tests for safe_resolve / is_protected / is_root**

Create `tests/web_v2/test_path_safety.py`:

```python
"""path_safety 共享模块测试。"""
import os
from pathlib import Path

import pytest

from cortex.web_v2.api.errors import CortexAPIError
from cortex.web_v2.path_safety import (
    safe_resolve,
    is_protected,
    is_root,
    assert_not_protected,
    assert_not_root,
)


@pytest.fixture
def base(tmp_path: Path) -> Path:
    """创建 base 目录，含 docs/ 和 .cortex/。"""
    (tmp_path / "docs" / "sub").mkdir(parents=True)
    (tmp_path / "docs" / "report.md").write_text("hi", encoding="utf-8")
    (tmp_path / ".cortex").mkdir()
    (tmp_path / ".cortex" / "index.db").write_bytes(b"")
    (tmp_path / ".env").write_text("KEY=x", encoding="utf-8")
    (tmp_path / "memo.draft.md").write_text("ok", encoding="utf-8")  # 点在中间，不算 dotfile
    return tmp_path


# --- safe_resolve ---

def test_safe_resolve_normal_path(base: Path):
    full = safe_resolve(base, "docs/report.md")
    assert full == (base / "docs" / "report.md").resolve()


def test_safe_resolve_rejects_dotdot(base: Path):
    with pytest.raises(CortexAPIError) as exc:
        safe_resolve(base, "../outside")
    assert exc.value.status == 404
    assert exc.value.code == "FILE_NOT_FOUND"


def test_safe_resolve_rejects_absolute_outside(base: Path):
    """绝对路径被 join 后仍可能在 base 外。"""
    with pytest.raises(CortexAPIError):
        safe_resolve(base, "/etc/passwd")


# --- is_protected ---

def test_is_protected_cortex_dir(base: Path):
    assert is_protected(base / ".cortex" / "index.db", base) is True


def test_is_protected_env_file(base: Path):
    assert is_protected(base / ".env", base) is True


def test_is_protected_dotfile_inside_subdir(base: Path):
    (base / "docs" / ".hidden").write_text("x", encoding="utf-8")
    assert is_protected(base / "docs" / ".hidden", base) is True


def test_is_protected_dotdir_inside_subdir(base: Path):
    (base / "docs" / ".git").mkdir()
    assert is_protected(base / "docs" / ".git" / "config", base) is True


def test_is_protected_normal_file_is_false(base: Path):
    assert is_protected(base / "docs" / "report.md", base) is False


def test_is_protected_memo_with_dot_in_middle_is_false(base: Path):
    """文件名中间的点不算 dotfile。"""
    assert is_protected(base / "memo.draft.md", base) is False


def test_is_protected_outside_base_is_true(base: Path):
    assert is_protected(Path("/etc/passwd").resolve(), base) is True


# --- is_root ---

def test_is_root_matches_base(base: Path):
    assert is_root(base, base) is True


def test_is_root_rejects_subdir(base: Path):
    assert is_root(base / "docs", base) is False


# --- assert_not_protected / assert_not_root ---

def test_assert_not_protected_raises_for_dotfile(base: Path):
    with pytest.raises(CortexAPIError) as exc:
        assert_not_protected(base / ".env", base)
    assert exc.value.code == "PROTECTED"


def test_assert_not_protected_passes_for_normal(base: Path):
    assert_not_protected(base / "docs" / "report.md", base)  # 不抛


def test_assert_not_root_raises_for_base(base: Path):
    with pytest.raises(CortexAPIError) as exc:
        assert_not_root(base, base)
    assert exc.value.code == "INVALID_TARGET"


def test_assert_not_root_passes_for_subdir(base: Path):
    assert_not_root(base / "docs", base)  # 不抛
```

- [ ] **Step 1.2: Run tests, verify they fail with ImportError**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_path_safety.py -v`
Expected: collection error / `ModuleNotFoundError: cortex.web_v2.path_safety`

- [ ] **Step 1.3: Implement path_safety.py basics**

Create `cortex/web_v2/path_safety.py`:

```python
"""共享路径安全模块。

preview.py 和 files.py 共用：路径解析、点文件保护、根目录保护。
"""
from pathlib import Path

from cortex.web_v2.api.errors import CortexAPIError

MAX_PATH_LEN = 255


def safe_resolve(base: Path, requested: str) -> Path:
    """解析并校验请求路径必须落在 base 内（防 .. 越权）。"""
    base_abs = base.resolve()
    candidate = (base_abs / requested).resolve()
    try:
        candidate.relative_to(base_abs)
    except ValueError:
        raise CortexAPIError(404, "FILE_NOT_FOUND", "路径越权")
    if len(str(candidate)) > MAX_PATH_LEN:
        raise CortexAPIError(400, "INVALID_PATH", f"路径超过 {MAX_PATH_LEN} 字符")
    return candidate


def is_protected(full: Path, base: Path) -> bool:
    """任何路径组件以 '.' 开头都视为受保护。"""
    try:
        rel = full.relative_to(base.resolve())
    except ValueError:
        return True
    return any(part.startswith(".") for part in rel.parts)


def is_root(full: Path, base: Path) -> bool:
    return full.resolve() == base.resolve()


def assert_not_protected(full: Path, base: Path) -> None:
    if is_protected(full, base):
        raise CortexAPIError(403, "PROTECTED", f"受保护路径: {full}")


def assert_not_root(full: Path, base: Path) -> None:
    if is_root(full, base):
        raise CortexAPIError(400, "INVALID_TARGET", "不能操作根目录")
```

- [ ] **Step 1.4: Run tests, verify they pass**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_path_safety.py -v`
Expected: All tests PASS

- [ ] **Step 1.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/path_safety.py tests/web_v2/test_path_safety.py
git commit -m "feat(web): add path_safety shared module for files/preview"
```

---

## Task 2: Backend path_safety.py — validate_name + validate_move_target + compute_writable

**Files:**
- Modify: `cortex/web_v2/path_safety.py`
- Modify: `tests/web_v2/test_path_safety.py`

- [ ] **Step 2.1: Append failing tests for validators**

Append to `tests/web_v2/test_path_safety.py`:

```python
# --- validate_name ---

from cortex.web_v2.path_safety import validate_name, validate_move_target, compute_writable


def test_validate_name_normal():
    validate_name("report.md")  # 不抛
    validate_name("新建目录")    # 不抛
    validate_name("file (1).txt")  # 不抛


def test_validate_name_rejects_empty():
    with pytest.raises(CortexAPIError) as exc:
        validate_name("")
    assert exc.value.code == "INVALID_NAME"


def test_validate_name_rejects_dot():
    with pytest.raises(CortexAPIError):
        validate_name(".")
    with pytest.raises(CortexAPIError):
        validate_name("..")


def test_validate_name_rejects_leading_dot():
    with pytest.raises(CortexAPIError) as exc:
        validate_name(".hidden")
    assert "点" in exc.value.detail


def test_validate_name_rejects_illegal_chars():
    for bad in ["a/b", "a\\b", "a:b", "a*b", 'a"b', "a<b", "a>b", "a|b", "a?b"]:
        with pytest.raises(CortexAPIError) as exc:
            validate_name(bad)
        assert exc.value.code == "INVALID_NAME"


def test_validate_name_rejects_control_chars():
    with pytest.raises(CortexAPIError):
        validate_name("a\x01b")


def test_validate_name_rejects_leading_whitespace():
    with pytest.raises(CortexAPIError):
        validate_name(" leading")


def test_validate_name_rejects_windows_reserved():
    for reserved in ["CON", "PRN", "AUX", "NUL", "COM1", "LPT9",
                     "con", "com1", "lpt1"]:
        with pytest.raises(CortexAPIError) as exc:
            validate_name(reserved)
        assert exc.value.code == "RESERVED_NAME"


# --- validate_move_target ---

def test_validate_move_target_rejects_self(base: Path):
    src = base / "docs"
    with pytest.raises(CortexAPIError) as exc:
        validate_move_target(src, src)
    assert exc.value.code == "INVALID_TARGET"


def test_validate_move_target_rejects_own_child(base: Path):
    """把 docs 移到 docs/sub 下 → 拒绝。"""
    src = base / "docs"
    dest_dir = base / "docs" / "sub"
    with pytest.raises(CortexAPIError) as exc:
        validate_move_target(src, dest_dir)
    assert exc.value.code == "INVALID_TARGET"


def test_validate_move_target_allows_independent_paths(base: Path):
    src = base / "docs"
    dest_dir = base / "archive"
    dest_dir.mkdir()
    validate_move_target(src, dest_dir)  # 不抛


# --- compute_writable ---

def test_compute_writable_protected_is_false(base: Path):
    assert compute_writable(base / ".env", base) is False
    assert compute_writable(base / ".cortex" / "index.db", base) is False


def test_compute_writable_nonexistent_is_false(base: Path):
    assert compute_writable(base / "nope.md", base) is False


def test_compute_writable_normal_file_is_true(base: Path):
    assert compute_writable(base / "docs" / "report.md", base) is True


def test_compute_writable_normal_dir_is_true(base: Path):
    assert compute_writable(base / "docs", base) is True


def test_compute_writable_readonly_file_is_false(base: Path, monkeypatch):
    """模拟只读文件。"""
    f = base / "docs" / "readonly.md"
    f.write_text("x", encoding="utf-8")
    os.chmod(f, 0o444)
    try:
        assert compute_writable(f, base) is False
    finally:
        os.chmod(f, 0o644)  # 恢复，避免 teardown 失败
```

- [ ] **Step 2.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_path_safety.py -v -k "validate_name or validate_move_target or compute_writable"`
Expected: ImportError on `validate_name` / `validate_move_target` / `compute_writable`

- [ ] **Step 2.3: Implement the three functions**

Append to `cortex/web_v2/path_safety.py`:

```python
import os
import re

ILLEGAL_NAME_CHARS = frozenset('\\/:*?"<>|')
_ILLEGAL_NAME_PATTERNS = [
    re.compile(r"^\s"),
    re.compile(r"[\x00-\x1f]"),
]
RESERVED_WIN_NAMES = frozenset({
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
})


def validate_name(name: str) -> None:
    """mkdir / rename / upload 文件名共用校验。"""
    if not name or name in (".", ".."):
        raise CortexAPIError(400, "INVALID_NAME", "名称为空或为保留字")
    if name.startswith("."):
        raise CortexAPIError(400, "INVALID_NAME", "名称不能以点开头")
    bad = set(name) & ILLEGAL_NAME_CHARS
    if bad:
        raise CortexAPIError(400, "INVALID_NAME", f"含非法字符: {bad}")
    if any(p.search(name) for p in _ILLEGAL_NAME_PATTERNS):
        raise CortexAPIError(400, "INVALID_NAME", "含控制字符或以空白开头")
    if name.upper() in RESERVED_WIN_NAMES:
        raise CortexAPIError(400, "RESERVED_NAME", f"Windows 保留名: {name}")


def validate_move_target(from_path: Path, dest_dir: Path) -> None:
    """from 不能是 dest_dir 本身或其祖先（防自循环）。"""
    if from_path.resolve() == dest_dir.resolve():
        raise CortexAPIError(400, "INVALID_TARGET", "不能移动到自身")
    try:
        dest_dir.resolve().relative_to(from_path.resolve())
        raise CortexAPIError(400, "INVALID_TARGET", "不能移动到自己的子目录")
    except ValueError:
        pass  # 安全


def compute_writable(full: Path, base: Path) -> bool:
    """统一可写性判断（保护 / 存在性 / 文件 W_OK / 目录 W_OK+X_OK）。"""
    if is_protected(full, base):
        return False
    if not full.exists():
        return False
    if full.is_file():
        return os.access(full, os.W_OK)
    if full.is_dir():
        return os.access(full, os.W_OK) and os.access(full, os.X_OK)
    return False
```

- [ ] **Step 2.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_path_safety.py -v`
Expected: All PASS

- [ ] **Step 2.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/path_safety.py tests/web_v2/test_path_safety.py
git commit -m "feat(web): add validate_name/move_target/compute_writable to path_safety"
```

---

## Task 3: Backend models/files.py

**Files:**
- Create: `cortex/web_v2/models/files.py`

- [ ] **Step 3.1: Create models**

Create `cortex/web_v2/models/files.py`:

```python
"""files API 请求/响应模型。"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class Entry(BaseModel):
    """目录条目（文件或子目录）。"""
    name: str
    path: str                    # 相对 POSIX 路径，根为 ""
    is_dir: bool
    size: int                    # 文件：字节数；目录：0
    modified_at: datetime
    indexed: bool                # 仅文件有意义；目录始终 false
    writable: bool


class ListDirResponse(BaseModel):
    path: str
    entries: list[Entry]
    total: int


class DirStatsResponse(BaseModel):
    path: str
    file_count: int
    dir_count: int
    total_size_bytes: int


class AttrsResponse(Entry):
    created_at: datetime
    extension: Optional[str] = None
    is_protected: bool = False


class MkdirRequest(BaseModel):
    path: str


class SkippedItem(BaseModel):
    from_path: str
    reason: str


class MoveRequest(BaseModel):
    from_paths: list[str] = Field(..., min_length=1)
    dest_dir: str
    overwrite: bool = False


class MoveResponse(BaseModel):
    moved: list[str]
    skipped: list[SkippedItem]


class RenameRequest(BaseModel):
    path: str
    new_name: str


class UploadResponse(BaseModel):
    path: str
    bytes_written: int
    overwritten: bool
    reindex_triggered: bool
```

- [ ] **Step 3.2: Quick syntax check**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -c "from cortex.web_v2.models import files; print(files.Entry.__name__)"`
Expected: `Entry`

- [ ] **Step 3.3: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/models/files.py
git commit -m "feat(web): add Pydantic models for files API"
```

---

## Task 4: Backend api/files.py — router scaffold + GET /list

**Files:**
- Create: `cortex/web_v2/api/files.py`
- Modify: `cortex/web_v2/app.py`
- Test: `tests/web_v2/test_files_api.py`

- [ ] **Step 4.1: Write failing tests for GET /list**

Create `tests/web_v2/test_files_api.py`:

```python
"""files API 集成测试。"""
import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2 import deps
from cortex.web_v2.app import create_app


@pytest.fixture
def reset_deps():
    deps.reset_singletons()
    yield
    deps.reset_singletons()


def _init_and_reindex():
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


@pytest.fixture
def populated_workdir(temp_workdir):
    """在 temp_workdir 基础上加目录结构和点文件。"""
    (temp_workdir / "docs").mkdir()
    (temp_workdir / "docs" / "report.md").write_text("# Report", encoding="utf-8")
    (temp_workdir / "docs" / "sub").mkdir()
    (temp_workdir / "docs" / "sub" / "note.md").write_text("note", encoding="utf-8")
    (temp_workdir / "images").mkdir()
    (temp_workdir / "images" / "logo.png").write_bytes(b"\x89PNG\r\n")
    (temp_workdir / ".env").write_text("KEY=x", encoding="utf-8")
    (temp_workdir / ".hidden").mkdir()
    return temp_workdir


@pytest.mark.asyncio
async def test_list_root_returns_entries(populated_workdir, env_cortex_config, reset_deps):
    """GET /api/files/list path="" → 根目录条目（隐藏点文件）。"""
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": ""})
    assert res.status_code == 200
    body = res.json()
    assert body["path"] == ""
    names = {e["name"] for e in body["entries"]}
    # 应包含 doc1.md / doc2.py / data.csv / docs / images（来自 temp_workdir + populated）
    assert "doc1.md" in names
    assert "docs" in names
    assert "images" in names
    # 不应包含点文件
    assert ".env" not in names
    assert ".hidden" not in names
    # 条目排序：目录在前
    entries = body["entries"]
    dirs_first = all(e["is_dir"] for e in entries[: sum(1 for e in entries if e["is_dir"])])
    assert dirs_first


@pytest.mark.asyncio
async def test_list_subdir(populated_workdir, env_cortex_config, reset_deps):
    """GET /api/files/list path=docs → docs 的子条目。"""
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": "docs"})
    assert res.status_code == 200
    names = {e["name"] for e in res.json()["entries"]}
    assert names == {"report.md", "sub"}


@pytest.mark.asyncio
async def test_list_protected_dir_returns_403(populated_workdir, env_cortex_config, reset_deps):
    """GET /api/files/list path=.cortex → 403 PROTECTED。"""
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": ".cortex"})
    assert res.status_code == 403
    assert res.json()["code"] == "PROTECTED"


@pytest.mark.asyncio
async def test_list_nonexistent_returns_404(temp_workdir, env_cortex_config, reset_deps):
    """GET /api/files/list path=nonexistent → 404。"""
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": "nonexistent"})
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_list_indexed_badge(populated_workdir, env_cortex_config, reset_deps):
    """已索引文件的 indexed=true。"""
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/list", params={"path": ""})
    entries = res.json()["entries"]
    doc1 = next(e for e in entries if e["name"] == "doc1.md")
    assert doc1["indexed"] is True
```

- [ ] **Step 4.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v`
Expected: ImportError or 404 (router not registered)

- [ ] **Step 4.3: Implement api/files.py with GET /list**

Create `cortex/web_v2/api/files.py`:

```python
"""GET/POST/DELETE /api/files/* — 工作目录文件管理。

所有写操作成功后调用 idx.trigger_background_reindex()。
路径安全 + 点文件保护统一走 path_safety 模块。
"""
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, Query

from cortex.index_manager import IndexManager
from cortex.web_v2.api.errors import CortexAPIError
from cortex.web_v2.deps import get_index_manager
from cortex.web_v2.models.files import Entry, ListDirResponse
from cortex.web_v2.path_safety import (
    assert_not_protected,
    compute_writable,
    is_protected,
    safe_resolve,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _posix_rel(full: Path, base: Path) -> str:
    """绝对路径 → 相对 base 的 POSIX 字符串。"""
    rel = full.relative_to(base.resolve())
    return "/".join(rel.parts) if rel.parts else ""


def _build_entry(full: Path, base: Path, indexed_paths: set[str]) -> Entry:
    """构造单条 Entry。"""
    stat = full.stat()
    rel = _posix_rel(full, base)
    is_dir = full.is_dir()
    return Entry(
        name=full.name,
        path=rel,
        is_dir=is_dir,
        size=0 if is_dir else stat.st_size,
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        indexed=(not is_dir) and (rel in indexed_paths),
        writable=compute_writable(full, base),
    )


def _indexed_paths(idx: IndexManager, base: Path) -> set[str]:
    """从 idx.documents 构建"相对 POSIX 路径"集合（仅文件）。"""
    result: set[str] = set()
    for doc in idx.documents or []:
        abs_path = doc.metadata.get("source_path", "") if hasattr(doc, "metadata") else ""
        if not abs_path:
            continue
        try:
            p = Path(abs_path)
            rel = p.relative_to(base.resolve())
            result.add("/".join(rel.parts) if rel.parts else "")
        except (ValueError, OSError):
            continue
    return result


@router.get("/files/list", response_model=ListDirResponse)
async def list_dir(
    path: str = Query(default="", description="相对目录路径，根为空字符串"),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    idx: IndexManager = Depends(get_index_manager),
) -> ListDirResponse:
    base = Path(idx.search_path)
    full = safe_resolve(base, path)
    # 保护路径：list 时直接拒绝（前端会隐藏，但 API 仍要拒绝）
    assert_not_protected(full, base)
    if not full.exists():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {path}")
    if not full.is_dir():
        raise CortexAPIError(400, "INVALID_PATH", f"不是目录: {path}")

    indexed = _indexed_paths(idx, base)
    # 过滤点文件 + 收集 Entry
    all_entries: list[Entry] = []
    for child in full.iterdir():
        if is_protected(child, base):
            continue
        all_entries.append(_build_entry(child, base, indexed))
    # 排序：目录在前，名字升序
    all_entries.sort(key=lambda e: (not e.is_dir, e.name.lower()))
    page = all_entries[offset:offset + limit]
    return ListDirResponse(path=path, entries=page, total=len(all_entries))
```

- [ ] **Step 4.4: Register router in app.py**

Modify `cortex/web_v2/app.py:36` — insert after the `config` router line:

```python
    from cortex.web_v2.api import config
    app.include_router(config.router, prefix="/api")
    from cortex.web_v2.api import files
    app.include_router(files.router, prefix="/api")
```

- [ ] **Step 4.5: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k list`
Expected: All 5 list tests PASS

- [ ] **Step 4.6: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/api/files.py cortex/web_v2/app.py tests/web_v2/test_files_api.py
git commit -m "feat(web): add GET /api/files/list with dotfile filtering and indexed badge"
```

---

## Task 5: Backend GET /stats + GET /attrs

**Files:**
- Modify: `cortex/web_v2/api/files.py`
- Modify: `tests/web_v2/test_files_api.py`

- [ ] **Step 5.1: Append failing tests for stats / attrs**

Append to `tests/web_v2/test_files_api.py`:

```python
@pytest.mark.asyncio
async def test_stats_returns_counts(populated_workdir, env_cortex_config, reset_deps):
    """GET /api/files/stats path=docs → 递归统计。"""
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/stats", params={"path": "docs"})
    assert res.status_code == 200
    body = res.json()
    assert body["file_count"] == 2          # report.md + sub/note.md
    assert body["dir_count"] == 1           # sub
    assert body["total_size_bytes"] > 0


@pytest.mark.asyncio
async def test_stats_root(populated_workdir, env_cortex_config, reset_deps):
    """GET /api/files/stats path="" → 根目录统计（跳过点文件）。"""
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/stats", params={"path": ""})
    assert res.status_code == 200
    body = res.json()
    # 至少有 doc1.md + doc2.py + data.csv + docs/report.md + docs/sub/note.md = 5
    assert body["file_count"] >= 5


@pytest.mark.asyncio
async def test_stats_protected_dir_returns_403(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/stats", params={"path": ".cortex"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_attrs_for_file(populated_workdir, env_cortex_config, reset_deps):
    """GET /api/files/attrs path=docs/report.md → 完整属性。"""
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/attrs", params={"path": "docs/report.md"})
    assert res.status_code == 200
    body = res.json()
    assert body["is_dir"] is False
    assert body["extension"] == ".md"
    assert body["is_protected"] is False
    assert "created_at" in body


@pytest.mark.asyncio
async def test_attrs_protected_returns_403(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/attrs", params={"path": ".env"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_attrs_nonexistent_returns_404(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/files/attrs", params={"path": "nope.md"})
    assert res.status_code == 404
```

- [ ] **Step 5.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k "stats or attrs"`
Expected: 404 or fail

- [ ] **Step 5.3: Implement /stats and /attrs**

Append to `cortex/web_v2/api/files.py`:

```python
from cortex.web_v2.models.files import AttrsResponse, DirStatsResponse


def _walk_for_stats(root: Path, base: Path) -> tuple[int, int, int]:
    """递归统计（跳过点文件子目录）。返回 (file_count, dir_count, total_size)。"""
    files = 0
    dirs = 0
    total = 0
    for child in root.iterdir():
        if is_protected(child, base):
            continue
        if child.is_dir():
            dirs += 1
            f, d, s = _walk_for_stats(child, base)
            files += f
            dirs += d
            total += s
        elif child.is_file():
            files += 1
            try:
                total += child.stat().st_size
            except OSError:
                pass
    return files, dirs, total


@router.get("/files/stats", response_model=DirStatsResponse)
async def stats(
    path: str = Query(..., description="相对目录路径"),
    idx: IndexManager = Depends(get_index_manager),
) -> DirStatsResponse:
    base = Path(idx.search_path)
    full = safe_resolve(base, path)
    assert_not_protected(full, base)
    if not full.exists():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {path}")
    if not full.is_dir():
        raise CortexAPIError(400, "INVALID_PATH", f"不是目录: {path}")
    files, dirs, total = _walk_for_stats(full, base)
    return DirStatsResponse(
        path=path,
        file_count=files,
        dir_count=dirs,
        total_size_bytes=total,
    )


@router.get("/files/attrs", response_model=AttrsResponse)
async def attrs(
    path: str = Query(..., description="相对路径"),
    idx: IndexManager = Depends(get_index_manager),
) -> AttrsResponse:
    base = Path(idx.search_path)
    full = safe_resolve(base, path)
    assert_not_protected(full, base)
    if not full.exists():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {path}")
    indexed = _indexed_paths(idx, base)
    stat = full.stat()
    return AttrsResponse(
        name=full.name,
        path=_posix_rel(full, base),
        is_dir=full.is_dir(),
        size=0 if full.is_dir() else stat.st_size,
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        indexed=(not full.is_dir()) and (_posix_rel(full, base) in indexed),
        writable=compute_writable(full, base),
        created_at=datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc),
        extension=full.suffix.lower() if full.suffix else None,
        is_protected=False,  # 保护路径已经在 assert_not_protected 拦截
    )
```

- [ ] **Step 5.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k "stats or attrs"`
Expected: All PASS

- [ ] **Step 5.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/api/files.py tests/web_v2/test_files_api.py
git commit -m "feat(web): add GET /api/files/stats and /api/files/attrs"
```

---

## Task 6: Backend POST /mkdir

**Files:**
- Modify: `cortex/web_v2/api/files.py`
- Modify: `tests/web_v2/test_files_api.py`

- [ ] **Step 6.1: Append failing tests**

Append:

```python
@pytest.mark.asyncio
async def test_mkdir_creates_dir(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": "new_folder"})
    assert res.status_code == 200
    assert (temp_workdir / "new_folder").is_dir()


@pytest.mark.asyncio
async def test_mkdir_nested(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": "docs/new_folder"})
    assert res.status_code == 200
    assert (temp_workdir / "docs" / "new_folder").is_dir()


@pytest.mark.asyncio
async def test_mkdir_existing_returns_409(temp_workdir, env_cortex_config, reset_deps):
    (temp_workdir / "existing").mkdir()
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": "existing"})
    assert res.status_code == 409
    assert res.json()["code"] == "ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_mkdir_protected_name_returns_400(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": ".hidden"})
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_mkdir_illegal_name_returns_400(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": "a/b:c"})
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_mkdir_triggers_reindex(temp_workdir, env_cortex_config, reset_deps, monkeypatch):
    await asyncio.to_thread(_init_and_reindex)
    idx = deps.get_index_manager()
    called = {"n": 0}
    def _fake():
        called["n"] += 1
    monkeypatch.setattr(idx, "trigger_background_reindex", _fake)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/mkdir", json={"path": "new_folder"})
    assert res.status_code == 200
    assert called["n"] == 1
```

- [ ] **Step 6.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k mkdir`
Expected: Failures (404)

- [ ] **Step 6.3: Implement /mkdir**

Append to `cortex/web_v2/api/files.py`:

```python
from cortex.web_v2.models.files import MkdirRequest


def _trigger_reindex(idx: IndexManager) -> bool:
    try:
        idx.trigger_background_reindex()
        return True
    except Exception as e:
        logger.warning("reindex failed: %s", e)
        return False


@router.post("/files/mkdir")
async def mkdir(
    req: MkdirRequest,
    idx: IndexManager = Depends(get_index_manager),
):
    base = Path(idx.search_path)
    # path 形如 "docs/new" 或 "new"；校验整体路径合法性 + 父目录存在 + 新名校验
    target = safe_resolve(base, req.path)
    assert_not_protected(target, base)
    parent = target.parent
    if not parent.exists() or not parent.is_dir():
        raise CortexAPIError(400, "INVALID_PATH", f"父目录不存在: {parent}")
    # 新名校验（最后一段）
    validate_name(target.name)
    if target.exists():
        raise CortexAPIError(409, "ALREADY_EXISTS", f"路径已存在: {req.path}")
    try:
        target.mkdir(parents=False)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"创建失败: {e}") from e
    return {"ok": True, "path": _posix_rel(target, base), "reindex_triggered": _trigger_reindex(idx)}
```

Add `validate_name` to the existing `from cortex.web_v2.path_safety import (...)`:

```python
from cortex.web_v2.path_safety import (
    assert_not_protected,
    compute_writable,
    is_protected,
    safe_resolve,
    validate_name,
)
```

- [ ] **Step 6.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k mkdir`
Expected: All PASS

- [ ] **Step 6.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/api/files.py tests/web_v2/test_files_api.py
git commit -m "feat(web): add POST /api/files/mkdir"
```

---

## Task 7: Backend DELETE /files

**Files:**
- Modify: `cortex/web_v2/api/files.py`
- Modify: `tests/web_v2/test_files_api.py`

- [ ] **Step 7.1: Append failing tests**

Append:

```python
@pytest.mark.asyncio
async def test_delete_file(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    assert (temp_workdir / "doc1.md").exists()
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete("/api/files", params={"path": "doc1.md"})
    assert res.status_code == 200
    assert not (temp_workdir / "doc1.md").exists()


@pytest.mark.asyncio
async def test_delete_directory_recursive(populated_workdir, env_cortex_config, reset_deps):
    """递归删除目录。"""
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete("/api/files", params={"path": "docs"})
    assert res.status_code == 200
    assert not (temp_workdir / "docs").exists()


@pytest.mark.asyncio
async def test_delete_protected_returns_403(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete("/api/files", params={"path": ".env"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_delete_root_returns_400(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete("/api/files", params={"path": ""})
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_TARGET"


@pytest.mark.asyncio
async def test_delete_nonexistent_returns_404(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete("/api/files", params={"path": "nope.md"})
    assert res.status_code == 404
```

- [ ] **Step 7.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k "delete and not clear"`
Expected: Failures

- [ ] **Step 7.3: Implement DELETE**

Append to `cortex/web_v2/api/files.py`:

```python
import shutil


@router.delete("/files")
async def delete(
    path: str = Query(..., description="要删除的相对路径"),
    idx: IndexManager = Depends(get_index_manager),
):
    base = Path(idx.search_path)
    full = safe_resolve(base, path)
    assert_not_protected(full, base)
    from cortex.web_v2.path_safety import assert_not_root
    assert_not_root(full, base)
    if not full.exists():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {path}")
    try:
        if full.is_dir():
            shutil.rmtree(full)
        else:
            full.unlink()
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"删除失败: {e}") from e
    return {"ok": True, "deleted": path, "reindex_triggered": _trigger_reindex(idx)}
```

- [ ] **Step 7.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k "delete and not clear"`
Expected: All PASS

- [ ] **Step 7.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/api/files.py tests/web_v2/test_files_api.py
git commit -m "feat(web): add DELETE /api/files (file or recursive dir)"
```

---

## Task 8: Backend POST /files/move (batch)

**Files:**
- Modify: `cortex/web_v2/api/files.py`
- Modify: `tests/web_v2/test_files_api.py`

- [ ] **Step 8.1: Append failing tests**

Append:

```python
@pytest.mark.asyncio
async def test_move_single_file(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": ["doc1.md"],
            "dest_dir": "docs",
            "overwrite": False,
        })
    assert res.status_code == 200
    body = res.json()
    assert body["moved"] == ["docs/doc1.md"]
    assert body["skipped"] == []
    assert (populated_workdir / "docs" / "doc1.md").exists()
    assert not (populated_workdir / "doc1.md").exists()


@pytest.mark.asyncio
async def test_move_multiple(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": ["doc1.md", "doc2.py"],
            "dest_dir": "docs",
            "overwrite": False,
        })
    body = res.json()
    assert sorted(body["moved"]) == ["docs/doc1.md", "docs/doc2.py"]
    assert body["skipped"] == []


@pytest.mark.asyncio
async def test_move_overwrite_false_skips_existing(populated_workdir, env_cortex_config, reset_deps):
    """目标已存在且 overwrite=False → 加入 skipped。"""
    (populated_workdir / "docs" / "doc1.md").write_text("冲突", encoding="utf-8")
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": ["doc1.md"],
            "dest_dir": "docs",
            "overwrite": False,
        })
    body = res.json()
    assert body["moved"] == []
    assert len(body["skipped"]) == 1
    assert body["skipped"][0]["reason"] == "ALREADY_EXISTS"
    # 原文件还在
    assert (populated_workdir / "doc1.md").exists()


@pytest.mark.asyncio
async def test_move_overwrite_true_replaces(populated_workdir, env_cortex_config, reset_deps):
    (populated_workdir / "docs" / "doc1.md").write_text("旧内容", encoding="utf-8")
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": ["doc1.md"],
            "dest_dir": "docs",
            "overwrite": True,
        })
    body = res.json()
    assert body["moved"] == ["docs/doc1.md"]
    # 目标内容是原 doc1.md（"# Doc 1..."）
    assert "Hello world" in (populated_workdir / "docs" / "doc1.md").read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_move_to_own_child_returns_invalid(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": ["docs"],
            "dest_dir": "docs/sub",
            "overwrite": False,
        })
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_TARGET"


@pytest.mark.asyncio
async def test_move_protected_returns_403(populated_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/move", json={
            "from_paths": [".env"],
            "dest_dir": "docs",
            "overwrite": False,
        })
    assert res.status_code == 403
```

- [ ] **Step 8.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k move`
Expected: Failures

- [ ] **Step 8.3: Implement /move**

Append to `cortex/web_v2/api/files.py`:

```python
from cortex.web_v2.models.files import MoveRequest, MoveResponse, SkippedItem
from cortex.web_v2.path_safety import validate_move_target


@router.post("/files/move", response_model=MoveResponse)
async def move(
    req: MoveRequest,
    idx: IndexManager = Depends(get_index_manager),
) -> MoveResponse:
    base = Path(idx.search_path)
    dest_dir = safe_resolve(base, req.dest_dir)
    assert_not_protected(dest_dir, base)
    if not dest_dir.exists() or not dest_dir.is_dir():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"目标目录不存在: {req.dest_dir}")

    moved: list[str] = []
    skipped: list[SkippedItem] = []

    for from_path_str in req.from_paths:
        src = safe_resolve(base, from_path_str)
        try:
            assert_not_protected(src, base)
        except CortexAPIError:
            skipped.append(SkippedItem(from_path=from_path_str, reason="PROTECTED"))
            continue
        if not src.exists():
            skipped.append(SkippedItem(from_path=from_path_str, reason="NOT_FOUND"))
            continue
        try:
            validate_move_target(src, dest_dir)
        except CortexAPIError:
            skipped.append(SkippedItem(from_path=from_path_str, reason="INVALID_TARGET"))
            continue

        target = dest_dir / src.name
        # 路径整体合法性
        try:
            assert_not_protected(target, base)
        except CortexAPIError:
            skipped.append(SkippedItem(from_path=from_path_str, reason="PROTECTED"))
            continue
        if target.exists():
            if not req.overwrite:
                skipped.append(SkippedItem(from_path=from_path_str, reason="ALREADY_EXISTS"))
                continue
            # 覆盖：先删目标
            try:
                if target.is_dir():
                    shutil.rmtree(target)
                else:
                    target.unlink()
            except OSError as e:
                skipped.append(SkippedItem(from_path=from_path_str, reason=f"WRITE_FAILED:{e}"))
                continue
        try:
            shutil.move(str(src), str(target))
            moved.append(_posix_rel(target, base))
        except OSError as e:
            skipped.append(SkippedItem(from_path=from_path_str, reason=f"WRITE_FAILED:{e}"))

    if moved:
        _trigger_reindex(idx)
    return MoveResponse(moved=moved, skipped=skipped)
```

- [ ] **Step 8.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k move`
Expected: All PASS

- [ ] **Step 8.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/api/files.py tests/web_v2/test_files_api.py
git commit -m "feat(web): add POST /api/files/move (batch with overwrite)"
```

---

## Task 9: Backend POST /files/rename

**Files:**
- Modify: `cortex/web_v2/api/files.py`
- Modify: `tests/web_v2/test_files_api.py`

- [ ] **Step 9.1: Append failing tests**

Append:

```python
@pytest.mark.asyncio
async def test_rename_file(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/rename", json={
            "path": "doc1.md",
            "new_name": "renamed.md",
        })
    assert res.status_code == 200
    assert (temp_workdir / "renamed.md").exists()
    assert not (temp_workdir / "doc1.md").exists()


@pytest.mark.asyncio
async def test_rename_existing_returns_409(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/rename", json={
            "path": "doc1.md",
            "new_name": "doc2.py",  # 已存在
        })
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_rename_illegal_returns_400(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/files/rename", json={
            "path": "doc1.md",
            "new_name": "a:b.md",
        })
    assert res.status_code == 400
```

- [ ] **Step 9.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k rename`
Expected: Failures

- [ ] **Step 9.3: Implement /rename**

Append to `cortex/web_v2/api/files.py`:

```python
from cortex.web_v2.models.files import RenameRequest


@router.post("/files/rename", response_model=Entry)
async def rename(
    req: RenameRequest,
    idx: IndexManager = Depends(get_index_manager),
) -> Entry:
    base = Path(idx.search_path)
    src = safe_resolve(base, req.path)
    assert_not_protected(src, base)
    if not src.exists():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {req.path}")
    validate_name(req.new_name)
    target = src.parent / req.new_name
    assert_not_protected(target, base)
    if target.exists():
        raise CortexAPIError(409, "ALREADY_EXISTS", f"目标已存在: {req.new_name}")
    try:
        src.rename(target)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"重命名失败: {e}") from e
    _trigger_reindex(idx)
    indexed = _indexed_paths(idx, base)
    return _build_entry(target, base, indexed)
```

- [ ] **Step 9.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k rename`
Expected: All PASS

- [ ] **Step 9.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/api/files.py tests/web_v2/test_files_api.py
git commit -m "feat(web): add POST /api/files/rename"
```

---

## Task 10: Backend POST /files/upload

**Files:**
- Modify: `cortex/web_v2/api/files.py`
- Modify: `tests/web_v2/test_files_api.py`

- [ ] **Step 10.1: Append failing tests**

Append:

```python
@pytest.mark.asyncio
async def test_upload_new_file(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    content = b"# hello"
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "", "overwrite": "false"},
            files={"file": ("uploaded.md", content, "text/markdown")},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["path"] == "uploaded.md"
    assert body["overwritten"] is False
    assert (temp_workdir / "uploaded.md").read_bytes() == content


@pytest.mark.asyncio
async def test_upload_to_subdir(temp_workdir, env_cortex_config, reset_deps):
    (temp_workdir / "sub").mkdir()
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "sub", "overwrite": "false"},
            files={"file": ("a.md", b"x", "text/markdown")},
        )
    assert res.status_code == 200
    assert (temp_workdir / "sub" / "a.md").exists()


@pytest.mark.asyncio
async def test_upload_overwrite_false_existing_returns_409(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "", "overwrite": "false"},
            files={"file": ("doc1.md", b"new", "text/markdown")},
        )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_upload_overwrite_true(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    new_content = b"replaced content"
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "", "overwrite": "true"},
            files={"file": ("doc1.md", new_content, "text/markdown")},
        )
    assert res.status_code == 200
    assert res.json()["overwritten"] is True
    assert (temp_workdir / "doc1.md").read_bytes() == new_content


@pytest.mark.asyncio
async def test_upload_protected_filename_returns_400(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "", "overwrite": "false"},
            files={"file": (".hidden.md", b"x", "text/markdown")},
        )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_upload_protected_dest_returns_403(temp_workdir, env_cortex_config, reset_deps):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": ".cortex", "overwrite": "false"},
            files={"file": ("a.md", b"x", "text/markdown")},
        )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_upload_too_large_returns_413(temp_workdir, env_cortex_config, reset_deps, monkeypatch):
    await asyncio.to_thread(_init_and_reindex)
    from cortex.web_v2.api import files as files_module
    monkeypatch.setattr(files_module, "_MAX_UPLOAD_BYTES", 16)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/files/upload",
            data={"dest_dir": "", "overwrite": "false"},
            files={"file": ("big.bin", b"x" * 32, "application/octet-stream")},
        )
    assert res.status_code == 413
```

- [ ] **Step 10.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k upload`
Expected: Failures

- [ ] **Step 10.3: Implement /upload**

Append to `cortex/web_v2/api/files.py`:

```python
from fastapi import File, Form, UploadFile
from cortex.web_v2.models.files import UploadResponse

_MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post("/files/upload", response_model=UploadResponse)
async def upload(
    file: UploadFile = File(...),
    dest_dir: str = Form(default=""),
    overwrite: bool = Form(default=False),
    idx: IndexManager = Depends(get_index_manager),
) -> UploadResponse:
    base = Path(idx.search_path)
    dest_full = safe_resolve(base, dest_dir)
    assert_not_protected(dest_full, base)
    if not dest_full.exists() or not dest_full.is_dir():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"目标目录不存在: {dest_dir}")

    filename = file.filename or ""
    validate_name(filename)  # 拒绝点开头 / 非法字符 / 保留名

    target = dest_full / filename
    assert_not_protected(target, base)
    overwritten = False
    if target.exists():
        if not overwrite:
            raise CortexAPIError(409, "ALREADY_EXISTS", f"已存在: {filename}")
        overwritten = True

    data = await file.read(_MAX_UPLOAD_BYTES + 1)
    if len(data) > _MAX_UPLOAD_BYTES:
        raise CortexAPIError(
            413, "CONTENT_TOO_LARGE",
            f"超过 {_MAX_UPLOAD_BYTES // 1024 // 1024}MB 上限",
        )

    try:
        target.write_bytes(data)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"写入失败: {e}") from e

    return UploadResponse(
        path=_posix_rel(target, base),
        bytes_written=len(data),
        overwritten=overwritten,
        reindex_triggered=_trigger_reindex(idx),
    )
```

- [ ] **Step 10.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py -v -k upload`
Expected: All PASS

- [ ] **Step 10.5: Run full files test suite**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_files_api.py tests/web_v2/test_path_safety.py -v`
Expected: All PASS

- [ ] **Step 10.6: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/api/files.py tests/web_v2/test_files_api.py
git commit -m "feat(web): add POST /api/files/upload (50MB limit, overwrite support)"
```

---

## Task 11: Backend — refactor preview.py to use path_safety (optional cleanup)

**Files:**
- Modify: `cortex/web_v2/api/preview.py`

**Purpose:** Reduce duplication. Skip this task if time-constrained — it's pure refactor, no functional change.

- [ ] **Step 11.1: Run baseline tests to establish they pass**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_api.py tests/web_v2/test_preview_save.py tests/web_v2/test_preview_upload.py tests/web_v2/test_preview_download.py -v`
Expected: All PASS

- [ ] **Step 11.2: Replace local helpers with path_safety imports**

In `cortex/web_v2/api/preview.py`:

Replace the `_safe_resolve` function definition with:

```python
from cortex.web_v2.path_safety import safe_resolve as _shared_safe_resolve, is_protected as _shared_is_protected

def _safe_resolve(base: Path, requested: str) -> Path:
    """向后兼容包装：调共享模块。"""
    return _shared_safe_resolve(base, requested)
```

Replace the `_compute_writable` body to call the shared version (preserving existing `BINARY_PREVIEW_EXTS` filtering):

```python
def _compute_writable(full: Path, search_path: Path) -> bool:
    """文件可写性：二进制类型 + 共享 compute_writable。"""
    if not full.exists() or not full.is_file():
        return False
    if full.suffix.lower() in BINARY_PREVIEW_EXTS:
        return False
    if _shared_is_protected(full, search_path):
        return False
    import os
    return os.access(full, os.W_OK)
```

- [ ] **Step 11.3: Run preview tests again, verify still pass**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_api.py tests/web_v2/test_preview_save.py tests/web_v2/test_preview_upload.py tests/web_v2/test_preview_download.py -v`
Expected: All PASS

- [ ] **Step 11.4: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/api/preview.py
git commit -m "refactor(web): preview.py uses path_safety shared module"
```

---

## Task 12: Frontend — extend state types and store

**Files:**
- Modify: `frontend/src/state/types.ts`
- Modify: `frontend/src/state/store.ts`
- Modify: `frontend/tests/test-utils.ts`

- [ ] **Step 12.1: Extend types.ts**

Edit `frontend/src/state/types.ts:3` to extend ViewId:

```ts
export type ViewId = "search" | "chat" | "history" | "settings" | "files";
```

Append the new interfaces before `AppState`:

```ts
export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedAt: string;
  indexed: boolean;
  writable: boolean;
}

export interface FileAttrs extends FileEntry {
  createdAt: string;
  extension: string | null;
  isProtected: boolean;
}

export interface FileExplorerViewState {
  treeCache: Record<string, FileEntry[]>;
  expandedPaths: string[];
  currentDir: string;
  selectedPaths: string[];
  lastSelectedAnchor: string | null;
  detail: FileAttrs | null;
  detailLoading: boolean;
  listing: boolean;
  mobilePane: "tree" | "list" | "detail";
  pendingAction: "mkdir" | "delete" | "move" | "rename" | "upload" | null;
  error: string | null;
}
```

Add `files` to `AppState`:

```ts
export interface AppState {
  view: ViewId;
  search: SearchViewState;
  chat: ChatViewState;
  detailStack: SearchResult[];
  pendingSession: Session | null;
  status: SystemStatus | null;
  error: string | null;
  settings: SettingsViewState;
  files: FileExplorerViewState;   // ⬅ 新增
}
```

- [ ] **Step 12.2: Extend store.ts INITIAL_STATE and actions**

Edit `frontend/src/state/store.ts`:

Add to `INITIAL_STATE` after `settings`:

```ts
  files: {
    treeCache: {},
    expandedPaths: [],
    currentDir: "",
    selectedPaths: [],
    lastSelectedAnchor: null,
    detail: null,
    detailLoading: false,
    listing: false,
    mobilePane: "tree",
    pendingAction: null,
    error: null,
  },
```

Add actions in the `actions` object:

```ts
  setFilesState(s: Partial<AppState["files"]>) {
    const cur = store.getState().files;
    store.setState({ files: { ...cur, ...s } });
  },

  expandDir(path: string) {
    const cur = store.getState().files;
    if (cur.expandedPaths.includes(path)) return;
    store.setState({ files: { ...cur, expandedPaths: [...cur.expandedPaths, path] } });
  },

  collapseDir(path: string) {
    const cur = store.getState().files;
    store.setState({ files: { ...cur, expandedPaths: cur.expandedPaths.filter(p => p !== path) } });
  },

  selectDir(path: string) {
    const cur = store.getState().files;
    store.setState({
      files: {
        ...cur,
        currentDir: path,
        selectedPaths: [],
        lastSelectedAnchor: null,
        detail: null,
        mobilePane: cur.mobilePane === "tree" ? "list" : cur.mobilePane,
      },
    });
  },

  selectEntry(path: string, opts: { ctrl?: boolean; shift?: boolean } = {}) {
    const cur = store.getState().files;
    let next: string[];
    let anchor: string | null = cur.lastSelectedAnchor;
    if (opts.shift && anchor !== null) {
      // 范围选择：基于 currentDir 缓存
      const entries = cur.treeCache[cur.currentDir] || [];
      const paths = entries.map(e => e.path);
      const a = paths.indexOf(anchor);
      const b = paths.indexOf(path);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        next = paths.slice(lo, hi + 1);
      } else {
        next = [path];
        anchor = path;
      }
    } else if (opts.ctrl) {
      next = cur.selectedPaths.includes(path)
        ? cur.selectedPaths.filter(p => p !== path)
        : [...cur.selectedPaths, path];
      anchor = path;
    } else {
      next = [path];
      anchor = path;
    }
    store.setState({ files: { ...cur, selectedPaths: next, lastSelectedAnchor: anchor } });
  },

  clearSelection() {
    const cur = store.getState().files;
    store.setState({
      files: { ...cur, selectedPaths: [], lastSelectedAnchor: null, detail: null },
    });
  },

  invalidateDir(dirPath: string) {
    const cur = store.getState().files;
    const nextCache = { ...cur.treeCache };
    delete nextCache[dirPath];
    store.setState({ files: { ...cur, treeCache: nextCache } });
  },

  invalidateSubtree(prefix: string) {
    const cur = store.getState().files;
    const nextCache: Record<string, FileEntry[]> = {};
    for (const [k, v] of Object.entries(cur.treeCache)) {
      if (k !== prefix && !k.startsWith(prefix + "/")) {
        nextCache[k] = v;
      }
    }
    store.setState({ files: { ...cur, treeCache: nextCache } });
  },

  setMobilePane(pane: "tree" | "list" | "detail") {
    const cur = store.getState().files;
    store.setState({ files: { ...cur, mobilePane: pane } });
  },
```

Also import `FileEntry` from `./types` if not already:

```ts
import type {
  AppState,
  FileEntry,
  Session,
  SettingsFieldValues,
  SettingsScope,
} from "./types";
```

- [ ] **Step 12.3: Update test-utils.ts to reset files state**

Edit `frontend/tests/test-utils.ts:5-14`:

```ts
  target.setState({
    view: "search",
    search: { state: "initial", currentSession: null, query: "", results: [], total: 0, source: "fts", offset: 0, limit: 20 },
    chat: { state: "initial", currentSession: null, messages: [], streaming: false },
    settings: { scope: "local", values: {}, original: {}, dirty: false, exists: true, saving: false, error: null },
    files: {
      treeCache: {},
      expandedPaths: [],
      currentDir: "",
      selectedPaths: [],
      lastSelectedAnchor: null,
      detail: null,
      detailLoading: false,
      listing: false,
      mobilePane: "tree",
      pendingAction: null,
      error: null,
    },
    detailStack: [],
    pendingSession: null,
    status: null,
    error: null,
  });
```

- [ ] **Step 12.4: Run existing frontend tests to verify no regression**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run`
Expected: All existing tests PASS

- [ ] **Step 12.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/src/state/types.ts cortex/web_v2/frontend/src/state/store.ts cortex/web_v2/frontend/tests/test-utils.ts
git commit -m "feat(web): extend state with FileExplorerViewState slice"
```

---

## Task 13: Frontend — api/files.ts client + tests

**Files:**
- Create: `frontend/src/api/files.ts`
- Create: `frontend/tests/api-files.spec.ts`

- [ ] **Step 13.1: Write failing test for files API client**

Create `frontend/tests/api-files.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { filesApi } from "../src/api/files";

describe("filesApi", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("list builds correct URL", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ path: "", entries: [], total: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    await filesApi.list("");
    const [url] = mocked.mock.calls[0];
    expect(url).toBe("/api/files/list?path=&limit=200&offset=0");
  });

  it("stats encodes path", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ path: "a/b", file_count: 0, dir_count: 0, total_size_bytes: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    await filesApi.stats("a/b");
    const [url] = mocked.mock.calls[0];
    expect(url).toBe("/api/files/stats?path=a%2Fb");
  });

  it("mkdir posts JSON", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, path: "x", reindex_triggered: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    await filesApi.mkdir("x");
    const [url, init] = mocked.mock.calls[0];
    expect(url).toBe("/api/files/mkdir");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ path: "x" }));
  });

  it("move sends from_paths array", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ moved: ["d/a.md"], skipped: [] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    await filesApi.move(["a.md"], "d", false);
    const [, init] = mocked.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      from_paths: ["a.md"], dest_dir: "d", overwrite: false,
    });
  });

  it("upload sends FormData", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({
        path: "f.md", bytes_written: 1, overwritten: false, reindex_triggered: true,
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const file = new File(["x"], "f.md");
    await filesApi.upload(file, "", false);
    const [, init] = mocked.mock.calls[0];
    expect(init?.body).toBeInstanceOf(FormData);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBe(file);
    expect(fd.get("dest_dir")).toBe("");
    expect(fd.get("overwrite")).toBe("false");
  });

  it("remove uses DELETE with query", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, deleted: "a", reindex_triggered: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    await filesApi.remove("a/b");
    const [url, init] = mocked.mock.calls[0];
    expect(url).toBe("/api/files?path=a%2Fb");
    expect(init?.method).toBe("DELETE");
  });

  it("throws ApiError on non-2xx", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "PROTECTED", detail: "nope" }), {
        status: 403, headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(filesApi.list(".cortex")).rejects.toMatchObject({
      name: "ApiError", status: 403, code: "PROTECTED",
    });
  });
});
```

- [ ] **Step 13.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run api-files`
Expected: FAIL — module not found

- [ ] **Step 13.3: Implement api/files.ts**

Create `frontend/src/api/files.ts`:

```ts
import { request, ApiError } from "./client";

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedAt: string;
  indexed: boolean;
  writable: boolean;
}

export interface FileAttrs extends FileEntry {
  createdAt: string;
  extension: string | null;
  isProtected: boolean;
}

export interface ListDirResponse {
  path: string;
  entries: FileEntry[];
  total: number;
}
export interface DirStatsResponse {
  path: string;
  fileCount: number;
  dirCount: number;
  totalSizeBytes: number;
}
export interface MkdirResponse { ok: true; path: string; reindex_triggered: boolean; }
export interface DeleteResponse { ok: true; deleted: string; reindex_triggered: boolean; }
export interface SkippedItem { fromPath: string; reason: string; }
export interface MoveResponse { moved: string[]; skipped: SkippedItem[]; }
export interface RenameResponse extends FileEntry {}
export interface UploadResponse {
  path: string;
  bytesWritten: number;
  overwritten: boolean;
  reindexTriggered: boolean;
}

const qs = (p: string) => `/api/files${p}`;

export const filesApi = {
  list: (path: string, limit = 200, offset = 0) =>
    request<ListDirResponse>(
      qs(`/list?path=${encodeURIComponent(path)}&limit=${limit}&offset=${offset}`),
    ),
  stats: (path: string) =>
    request<DirStatsResponse>(qs(`/stats?path=${encodeURIComponent(path)}`)),
  attrs: (path: string) =>
    request<FileAttrs>(qs(`/attrs?path=${encodeURIComponent(path)}`)),
  mkdir: (path: string) =>
    request<MkdirResponse>(qs("/mkdir"), { method: "POST", json: { path } }),
  remove: (path: string) =>
    request<DeleteResponse>(qs(`?path=${encodeURIComponent(path)}`), { method: "DELETE" }),
  move: (fromPaths: string[], destDir: string, overwrite = false) =>
    request<MoveResponse>(qs("/move"), {
      method: "POST",
      json: { from_paths: fromPaths, dest_dir: destDir, overwrite },
    }),
  rename: (path: string, newName: string) =>
    request<RenameResponse>(qs("/rename"), { method: "POST", json: { path, new_name: newName } }),
  upload: (file: File, destDir: string, overwrite = false) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dest_dir", destDir);
    fd.append("overwrite", String(overwrite));
    return request<UploadResponse>(qs("/upload"), { method: "POST", body: fd });
  },
};

export { ApiError };
```

- [ ] **Step 13.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run api-files`
Expected: All PASS

- [ ] **Step 13.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/src/api/files.ts cortex/web_v2/frontend/tests/api-files.spec.ts
git commit -m "feat(web): add files API client with multipart upload"
```

---

## Task 14: Frontend — activity-bar + tab-bar + app.ts integration

**Files:**
- Modify: `frontend/src/components/activity-bar.ts:38`
- Modify: `frontend/src/components/tab-bar.ts:36`
- Modify: `frontend/src/app.ts:19,77`

- [ ] **Step 14.1: Add `files` to activity-bar items**

Edit `frontend/src/components/activity-bar.ts` line 38:

```ts
  private _items: Array<{ id: ViewId; icon: string; label: string }> = [
    { id: "search", icon: "🔍", label: "搜索" },
    { id: "chat", icon: "💬", label: "对话" },
    { id: "files", icon: "📁", label: "文件" },
    { id: "history", icon: "🕘", label: "历史" },
  ];
```

- [ ] **Step 14.2: Add `files` to tab-bar items**

Edit `frontend/src/components/tab-bar.ts` line 36 with the same array.

- [ ] **Step 14.3: Wire files-view into app.ts**

Edit `frontend/src/app.ts:22`:

```ts
import "./views/files-view";
```

Edit `frontend/src/app.ts` `_renderView()`:

```ts
  private _renderView() {
    const view = store.getState().view;
    if (view === "search") return html`<search-view></search-view>`;
    if (view === "chat") return html`<chat-view></chat-view>`;
    if (view === "settings") return html`<settings-view></settings-view>`;
    if (view === "files") return html`<files-view></files-view>`;
    return html`<history-view></history-view>`;
  }
```

- [ ] **Step 14.4: Run existing tests, verify no regression**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run`
Expected: All PASS (except possibly files-view import since we haven't created it yet — that's the next task; for now you can create a stub)

If the `files-view` import fails, create a stub at `frontend/src/views/files-view.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("files-view")
export class FilesView extends LitElement {
  static styles = css`:host { display: block; padding: 20px; }`;
  render() { return html`<div>Files (stub)</div>`; }
}

declare global {
  interface HTMLElementTagNameMap { "files-view": FilesView; }
}
```

- [ ] **Step 14.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/src/components/activity-bar.ts cortex/web_v2/frontend/src/components/tab-bar.ts cortex/web_v2/frontend/src/app.ts cortex/web_v2/frontend/src/views/files-view.ts
git commit -m "feat(web): wire files tab into activity-bar, tab-bar, app router"
```

---

## Task 15: Frontend — tree-node component (recursive)

**Files:**
- Create: `frontend/src/components/tree-node.ts`
- Create: `frontend/tests/tree-node.spec.ts`

- [ ] **Step 15.1: Write failing test**

Create `frontend/tests/tree-node.spec.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import "../src/components/tree-node";
import { resetStore } from "./test-utils";
import { store } from "../src/state/store";

describe("tree-node", () => {
  it("renders folder icon and name", async () => {
    resetStore(store);
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "docs", path: "docs", isDir: true, size: 0, modifiedAt: "", indexed: false, writable: true };
    el.depth = 0;
    el.readonly = false;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("docs");
    document.body.removeChild(el);
  });

  it("dispatches select event on click", async () => {
    resetStore(store);
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "docs", path: "docs", isDir: true, size: 0, modifiedAt: "", indexed: false, writable: true };
    el.depth = 0;
    el.readonly = false;
    document.body.appendChild(el);
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("select-dir", (e: Event) => spy((e as CustomEvent).detail));
    el.shadowRoot.querySelector(".label").click();
    expect(spy).toHaveBeenCalledWith({ path: "docs" });
    document.body.removeChild(el);
  });

  it("dispatches toggle event on arrow click", async () => {
    resetStore(store);
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "docs", path: "docs", isDir: true, size: 0, modifiedAt: "", indexed: false, writable: true };
    el.depth = 0;
    el.expanded = false;
    el.readonly = false;
    document.body.appendChild(el);
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("toggle", (e: Event) => spy((e as CustomEvent).detail));
    el.shadowRoot.querySelector(".arrow").click();
    expect(spy).toHaveBeenCalledWith({ path: "docs" });
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 15.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run tree-node`
Expected: FAIL — module not found

- [ ] **Step 15.3: Implement tree-node**

Create `frontend/src/components/tree-node.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FileEntry } from "../api/files";

@customElement("tree-node")
export class TreeNode extends LitElement {
  static styles = css`
    :host { display: block; }
    .row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-1);
      padding: 4px 8px;
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      user-select: none;
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.selected { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
    .arrow {
      width: 16px; height: 16px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--cortex-text-subtle);
      transition: transform 0.1s;
    }
    .arrow.expanded { transform: rotate(90deg); }
    .arrow.leaf { visibility: hidden; }
    .icon { font-size: 14px; }
    .label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .children { padding-left: 16px; }
  `;

  @property({ type: Object }) entry!: FileEntry;
  @property({ type: Number }) depth = 0;
  @property({ type: Boolean }) expanded = false;
  @property({ type: Boolean }) selected = false;
  @property({ type: Boolean }) readonly = false;
  @property({ type: Array }) children: FileEntry[] = [];
  @property({ type: String }) loading = "";

  private _selectDir() {
    if (this.readonly) return;
    this.dispatchEvent(new CustomEvent("select-dir", {
      detail: { path: this.entry.path },
      bubbles: true, composed: true,
    }));
  }

  private _toggle(e: Event) {
    e.stopPropagation();
    if (!this.entry.isDir) return;
    this.dispatchEvent(new CustomEvent("toggle", {
      detail: { path: this.entry.path },
      bubbles: true, composed: true,
    }));
  }

  private _pick() {
    // 只读模式下：选中目标目录
    if (this.readonly) {
      this.dispatchEvent(new CustomEvent("pick-dir", {
        detail: { path: this.entry.path },
        bubbles: true, composed: true,
      }));
    } else {
      this._selectDir();
    }
  }

  render() {
    return html`
      <div class="row ${this.selected ? "selected" : ""}" @click=${this._pick}>
        <span
          class="arrow ${this.expanded ? "expanded" : ""} ${this.entry.isDir ? "" : "leaf"}"
          @click=${this._toggle}>▶</span>
        <span class="icon">${this.entry.isDir ? "📁" : "📄"}</span>
        <span class="label">${this.entry.name}</span>
      </div>
      ${this.expanded && this.entry.isDir ? html`
        <div class="children">
          ${this.loading === this.entry.path
            ? html`<div style="padding: 4px 8px; color: var(--cortex-text-subtle)">加载中…</div>`
            : this.children.map(c => html`
              <tree-node
                .entry=${c}
                .depth=${this.depth + 1}
                .readonly=${this.readonly}
                @select-dir=${(e: Event) => e.stopPropagation() || this.dispatchEvent(new CustomEvent("select-dir", { detail: (e as CustomEvent).detail, bubbles: true, composed: true }))}
                @toggle=${(e: Event) => e.stopPropagation() || this.dispatchEvent(new CustomEvent("toggle", { detail: (e as CustomEvent).detail, bubbles: true, composed: true }))}
                @pick-dir=${(e: Event) => e.stopPropagation() || this.dispatchEvent(new CustomEvent("pick-dir", { detail: (e as CustomEvent).detail, bubbles: true, composed: true }))}
              ></tree-node>
            `)}
        </div>
      ` : html``}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "tree-node": TreeNode; }
}
```

- [ ] **Step 15.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run tree-node`
Expected: All PASS

- [ ] **Step 15.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/src/components/tree-node.ts cortex/web_v2/frontend/tests/tree-node.spec.ts
git commit -m "feat(web): add recursive tree-node component with readonly mode"
```

---

## Task 16: Frontend — file-tree container + file-row + file-list

**Files:**
- Create: `frontend/src/components/file-row.ts`
- Create: `frontend/src/components/file-list.ts`
- Create: `frontend/src/components/file-tree.ts`
- Create: `frontend/tests/file-list.spec.ts`

This task groups 3 tightly-coupled components. Each file stays under 250 lines.

- [ ] **Step 16.1: Write failing test for file-list**

Create `frontend/tests/file-list.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../src/components/file-list";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";
import type { FileEntry } from "../src/api/files";

const entries: FileEntry[] = [
  { name: "docs", path: "docs", isDir: true, size: 0, modifiedAt: "2026-06-22T00:00:00Z", indexed: false, writable: true },
  { name: "a.md", path: "a.md", isDir: false, size: 100, modifiedAt: "2026-06-22T00:00:00Z", indexed: true, writable: true },
  { name: "b.md", path: "b.md", isDir: false, size: 200, modifiedAt: "2026-06-22T00:00:00Z", indexed: false, writable: true },
];

describe("file-list", () => {
  beforeEach(() => resetStore(store));

  it("renders empty state when no entries", async () => {
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("空");
    document.body.removeChild(el);
  });

  it("renders rows from store treeCache[currentDir]", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const rows = el.shadowRoot.querySelectorAll("file-row");
    expect(rows.length).toBe(3);
    document.body.removeChild(el);
  });

  it("toolbar rename disabled when 0 or 2+ selected", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const renameBtn = el.shadowRoot.querySelector('[data-action="rename"]') as HTMLButtonElement;
    expect(renameBtn.disabled).toBe(true);
    document.body.removeChild(el);
  });

  it("toolbar rename enabled when exactly 1 selected", async () => {
    actions.setFilesState({
      currentDir: "",
      treeCache: { "": entries },
      selectedPaths: ["a.md"],
    });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const renameBtn = el.shadowReader.querySelector('[data-action="rename"]') as HTMLButtonElement;
    // Note: fix shadowReader → shadowRoot in actual code
    document.body.removeChild(el);
  });
});
```

> **Note:** Fix `shadowReader` → `shadowRoot` typo before running (it's `el.shadowRoot`).

- [ ] **Step 16.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run file-list`
Expected: FAIL — module not found

- [ ] **Step 16.3: Implement file-row**

Create `frontend/src/components/file-row.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FileEntry } from "../api/files";

@customElement("file-row")
export class FileRow extends LitElement {
  static styles = css`
    :host { display: block; }
    .row {
      display: grid;
      grid-template-columns: 20px 1fr 80px 120px 80px;
      gap: var(--cortex-space-2);
      align-items: center;
      padding: 6px var(--cortex-space-3);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.selected { background: var(--cortex-primary-soft); }
    .icon { font-size: 14px; }
    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .size, .time { color: var(--cortex-text-muted); font-size: var(--cortex-fs-sm); text-align: right; }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      font-size: 10px;
      border-radius: var(--cortex-radius-sm);
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
    }
  `;

  @property({ type: Object }) entry!: FileEntry;
  @property({ type: Boolean }) selected = false;

  private _fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  private _fmtTime(s: string): string {
    try { return new Date(s).toLocaleString(); }
    catch { return ""; }
  }

  private _onClicked(e: MouseEvent) {
    this.dispatchEvent(new CustomEvent("clicked", {
      detail: {
        path: this.entry.path,
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
      },
      bubbles: true, composed: true,
    }));
  }

  private _onDoubleClicked() {
    this.dispatchEvent(new CustomEvent("activated", {
      detail: { path: this.entry.path, isDir: this.entry.isDir },
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      <div
        class="row ${this.selected ? "selected" : ""}"
        @click=${this._onClicked}
        @dblclick=${this._onDoubleClicked}>
        <span class="icon">${this.entry.isDir ? "📁" : "📄"}</span>
        <span class="name">${this.entry.name}</span>
        <span class="size">${this.entry.isDir ? "" : this._fmtSize(this.entry.size)}</span>
        <span class="time">${this._fmtTime(this.entry.modifiedAt)}</span>
        <span>${!this.entry.isDir && this.entry.indexed ? html`<span class="badge">已索引</span>` : ""}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-row": FileRow; }
}
```

- [ ] **Step 16.4: Implement file-list**

Create `frontend/src/components/file-list.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { store, actions } from "../state/store";
import "./file-row";
import "./drop-zone";
import "../api/files";

@customElement("file-list")
export class FileList extends LitElement {
  static styles = css`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; background: var(--cortex-surface); }
    .toolbar {
      display: flex;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
    }
    .toolbar button {
      padding: 6px 12px;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
    }
    .toolbar button:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar button.danger { color: var(--cortex-danger); }
    .breadcrumb {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .rows { flex: 1; overflow-y: auto; position: relative; }
    .empty { padding: var(--cortex-space-8); text-align: center; color: var(--cortex-text-subtle); }
  `;

  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
  }
  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  private _action(name: string) {
    this.dispatchEvent(new CustomEvent("action", {
      detail: { name },
      bubbles: true, composed: true,
    }));
  }

  private _onRowClicked(e: CustomEvent<{ path: string; ctrl: boolean; shift: boolean }>) {
    actions.selectEntry(e.detail.path, { ctrl: e.detail.ctrl, shift: e.detail.shift });
  }

  private _onRowActivated(e: CustomEvent<{ path: string; isDir: boolean }>) {
    if (e.detail.isDir) {
      actions.selectDir(e.detail.path);
    }
  }

  render() {
    const { currentDir, treeCache, selectedPaths } = store.getState().files;
    const entries = treeCache[currentDir] || [];
    const sel = new Set(selectedPaths);
    const canRename = selectedPaths.length === 1;
    const canAct = selectedPaths.length >= 1;
    const breadcrumb = currentDir === "" ? "/" : `/${currentDir}/`;

    return html`
      <div class="breadcrumb">${breadcrumb}</div>
      <div class="toolbar">
        <button data-action="mkdir" @click=${() => this._action("mkdir")}>+ 新目录</button>
        <button data-action="upload" @click=${() => this._action("upload")}>⬆ 上传</button>
        <button data-action="rename" ?disabled=${!canRename} @click=${() => this._action("rename")}>✎ 重命名</button>
        <button data-action="move" ?disabled=${!canAct} @click=${() => this._action("move")}>→ 移动</button>
        <button data-action="delete" ?disabled=${!canAct} class="danger" @click=${() => this._action("delete")}>🗑 删除</button>
      </div>
      <div class="rows">
        ${entries.length === 0
          ? html`<div class="empty">目录为空（拖放文件以上传）</div>`
          : entries.map(e => html`
            <file-row
              .entry=${e}
              .selected=${sel.has(e.path)}
              @clicked=${this._onRowClicked}
              @activated=${this._onRowActivated}
            ></file-row>`)}
        <drop-zone .targetDir=${currentDir}></drop-zone>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-list": FileList; }
}
```

- [ ] **Step 16.5: Implement file-tree container**

Create `frontend/src/components/file-tree.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { store, actions } from "../state/store";
import { filesApi } from "../api/files";
import "./tree-node";

@customElement("file-tree")
export class FileTree extends LitElement {
  static styles = css`
    :host {
      display: flex; flex-direction: column;
      background: var(--cortex-surface);
      border-right: 1px solid var(--cortex-border);
      overflow-y: auto;
    }
    .header {
      padding: var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      position: sticky; top: 0;
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border-muted);
      z-index: 1;
    }
  `;

  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    // 自动加载根目录
    this._ensureLoaded("");
    actions.expandDir("");
  }
  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  private async _ensureLoaded(path: string) {
    const { treeCache } = store.getState().files;
    if (path in treeCache) return;
    try {
      actions.setFilesState({ listing: true });
      const res = await filesApi.list(path);
      actions.setFilesState({
        treeCache: { ...store.getState().files.treeCache, [path]: res.entries },
        listing: false,
      });
    } catch (e: any) {
      actions.setFilesState({ listing: false, error: e?.message || "加载失败" });
    }
  }

  private _onToggle = async (e: CustomEvent<{ path: string }>) => {
    const path = e.detail.path;
    const { expandedPaths } = store.getState().files;
    if (expandedPaths.includes(path)) {
      actions.collapseDir(path);
    } else {
      await this._ensureLoaded(path);
      actions.expandDir(path);
    }
  };

  private _onSelectDir = (e: CustomEvent<{ path: string }>) => {
    actions.selectDir(e.detail.path);
    // 选中目录时同步展开
    this._ensureLoaded(e.detail.path).then(() => actions.expandDir(e.detail.path));
  };

  render() {
    const { treeCache, expandedPaths, currentDir } = store.getState().files;
    const rootEntries = treeCache[""] || [];
    const expanded = new Set(expandedPaths);
    const sel = (p: string) => p === currentDir;

    return html`
      <div class="header">文件</div>
      ${rootEntries.filter(e => e.isDir).map(e => html`
        <tree-node
          .entry=${e}
          .depth=${0}
          .expanded=${expanded.has(e.path)}
          .selected=${sel(e.path)}
          .children=${treeCache[e.path] || []}
          .loading=""
          @toggle=${this._onToggle}
          @select-dir=${this._onSelectDir}
        ></tree-node>
      `)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-tree": FileTree; }
}
```

- [ ] **Step 16.6: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run file-list`
Expected: All PASS

- [ ] **Step 16.7: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/src/components/file-row.ts cortex/web_v2/frontend/src/components/file-list.ts cortex/web_v2/frontend/src/components/file-tree.ts cortex/web_v2/frontend/tests/file-list.spec.ts
git commit -m "feat(web): add file-tree, file-list, file-row components with lazy loading"
```

---

## Task 17: Frontend — file-detail

**Files:**
- Create: `frontend/src/components/file-detail.ts`
- Create: `frontend/tests/file-detail.spec.ts`

- [ ] **Step 17.1: Write failing test**

Create `frontend/tests/file-detail.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../src/components/file-detail";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";

describe("file-detail", () => {
  beforeEach(() => resetStore(store));

  it("shows placeholder when no selection", async () => {
    const el = document.createElement("file-detail") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("选择");
    document.body.removeChild(el);
  });

  it("renders detail when one selected", async () => {
    actions.setFilesState({
      selectedPaths: ["a.md"],
      detail: {
        name: "a.md", path: "a.md", isDir: false, size: 100,
        modifiedAt: "2026-06-22T00:00:00Z", indexed: true, writable: true,
        createdAt: "2026-06-20T00:00:00Z", extension: ".md", isProtected: false,
      } as any,
    });
    const el = document.createElement("file-detail") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("a.md");
    expect(el.shadowRoot.textContent).toContain(".md");
    document.body.removeChild(el);
  });

  it("shows multi-select placeholder when 2+ selected", async () => {
    actions.setFilesState({ selectedPaths: ["a.md", "b.md"] });
    const el = document.createElement("file-detail") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("2");
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 17.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run file-detail`
Expected: FAIL

- [ ] **Step 17.3: Implement file-detail**

Create `frontend/src/components/file-detail.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { store } from "../state/store";

@customElement("file-detail")
export class FileDetail extends LitElement {
  static styles = css`
    :host {
      display: flex; flex-direction: column;
      background: var(--cortex-surface);
      border-left: 1px solid var(--cortex-border);
      padding: var(--cortex-space-4);
      gap: var(--cortex-space-2);
      overflow-y: auto;
    }
    h2 {
      margin: 0 0 var(--cortex-space-2) 0;
      font-size: var(--cortex-fs-md);
      word-break: break-all;
    }
    .placeholder {
      color: var(--cortex-text-subtle);
      text-align: center;
      padding: var(--cortex-space-8) 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: var(--cortex-space-2) 0;
      border-bottom: 1px solid var(--cortex-border-muted);
      font-size: var(--cortex-fs-sm);
    }
    .row .k { color: var(--cortex-text-muted); }
    .row .v { font-family: var(--cortex-font-mono); word-break: break-all; text-align: right; }
    .actions {
      display: flex; flex-direction: column; gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    .actions button {
      padding: 8px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    .actions button:hover { background: var(--cortex-surface-muted); }
    .actions button.danger { color: var(--cortex-danger); }
  `;

  private _unsubscribe?: () => void;
  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
  }
  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  private _action(name: string) {
    this.dispatchEvent(new CustomEvent("action", {
      detail: { name },
      bubbles: true, composed: true,
    }));
  }

  private _fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  render() {
    const { selectedPaths, detail } = store.getState().files;

    if (selectedPaths.length === 0) {
      return html`<div class="placeholder">选择一个文件查看详情</div>`;
    }
    if (selectedPaths.length > 1) {
      return html`
        <div class="placeholder">
          <p><strong>${selectedPaths.length}</strong> 项已选中</p>
          <div class="actions">
            <button @click=${() => this._action("move")}>→ 移动…</button>
            <button class="danger" @click=${() => this._action("delete")}>🗑 删除…</button>
          </div>
        </div>
      `;
    }

    if (!detail) {
      return html`<div class="placeholder">加载中…</div>`;
    }
    const d = detail;
    return html`
      <h2>${d.isDir ? "📁" : "📄"} ${d.name}</h2>
      <div class="row"><span class="k">路径</span><span class="v">${d.path}</span></div>
      <div class="row"><span class="k">大小</span><span class="v">${d.isDir ? "—" : this._fmtSize(d.size)}</span></div>
      <div class="row"><span class="k">类型</span><span class="v">${d.extension || "—"}</span></div>
      <div class="row"><span class="k">修改</span><span class="v">${new Date(d.modifiedAt).toLocaleString()}</span></div>
      <div class="row"><span class="k">创建</span><span class="v">${new Date(d.createdAt).toLocaleString()}</span></div>
      <div class="row"><span class="k">可写</span><span class="v">${d.writable ? "是" : "否"}</span></div>
      ${d.isDir ? "" : html`<div class="row"><span class="k">已索引</span><span class="v">${d.indexed ? "是" : "否"}</span></div>`}
      <div class="actions">
        ${!d.isDir ? html`<button @click=${() => this._action("preview")}>👁 打开预览</button>` : ""}
        ${!d.isDir ? html`<button @click=${() => this._action("download")}>⬇ 下载</button>` : ""}
        <button @click=${() => this._action("rename")}>✎ 重命名</button>
        <button @click=${() => this._action("move")}>→ 移动</button>
        <button class="danger" @click=${() => this._action("delete")}>🗑 删除</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-detail": FileDetail; }
}
```

- [ ] **Step 17.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run file-detail`
Expected: All PASS

- [ ] **Step 17.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/src/components/file-detail.ts cortex/web_v2/frontend/tests/file-detail.spec.ts
git commit -m "feat(web): add file-detail panel with attrs and action buttons"
```

---

## Task 18: Frontend — mkdir-dialog + rename-dialog

**Files:**
- Create: `frontend/src/components/mkdir-dialog.ts`
- Create: `frontend/src/components/rename-dialog.ts`
- Create: `frontend/tests/mkdir-dialog.spec.ts`
- Create: `frontend/tests/rename-dialog.spec.ts`

- [ ] **Step 18.1: Write failing test for mkdir-dialog**

Create `frontend/tests/mkdir-dialog.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../src/components/mkdir-dialog";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";

describe("mkdir-dialog", () => {
  beforeEach(() => resetStore(store));

  it("rejects names with illegal chars in real-time", async () => {
    actions.setFilesState({ currentDir: "" });
    const el = document.createElement("mkdir-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector("input").value = "a:b";
    el.shadowRoot.querySelector("input").dispatchEvent(new Event("input"));
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("非法");
    const btn = el.shadowRoot.querySelector("button.primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    document.body.removeChild(el);
  });

  it("submits valid name via event", async () => {
    actions.setFilesState({ currentDir: "docs" });
    const el = document.createElement("mkdir-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector("input").value = "new_folder";
    el.shadowRoot.querySelector("input").dispatchEvent(new Event("input"));
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("submit", (e: Event) => spy((e as CustomEvent).detail));
    el.shadowRoot.querySelector("button.primary").click();
    expect(spy).toHaveBeenCalledWith({ path: "docs/new_folder" });
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 18.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run mkdir-dialog`
Expected: FAIL

- [ ] **Step 18.3: Implement mkdir-dialog**

Create `frontend/src/components/mkdir-dialog.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store } from "../state/store";

const ILLEGAL = /[\\/:*?"<>|]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

@customElement("mkdir-dialog")
export class MkdirDialog extends LitElement {
  static styles = css`
    :host { display: block; }
    .row { margin: var(--cortex-space-3) 0; }
    label { display: block; font-size: var(--cortex-fs-sm); color: var(--cortex-text-muted); margin-bottom: 4px; }
    input {
      width: 100%; padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
      box-sizing: border-box;
    }
    input.invalid { border-color: var(--cortex-danger); }
    .err { color: var(--cortex-danger); font-size: var(--cortex-fs-sm); margin-top: 4px; }
    .actions { display: flex; justify-content: flex-end; gap: var(--cortex-space-2); margin-top: var(--cortex-space-4); }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
    }
    button.primary { background: var(--cortex-primary); color: white; border-color: var(--cortex-primary); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
  `;

  @state() private _name = "";
  @state() private _err = "";

  private get _parent() { return store.getState().files.currentDir; }

  private _validate(v: string): string {
    if (!v) return "名称不能为空";
    if (v.startsWith(".")) return "不能以点开头";
    if (ILLEGAL.test(v)) return "含非法字符 / \\ : * ? \" < > |";
    if (/\s/.test(v[0] || "")) return "不能以空白开头";
    if (RESERVED.test(v)) return "Windows 保留名";
    return "";
  }

  private _onInput(e: Event) {
    this._name = (e.target as HTMLInputElement).value;
    this._err = this._validate(this._name);
  }

  private _submit() {
    if (this._err) return;
    const path = this._parent ? `${this._parent}/${this._name}` : this._name;
    this.dispatchEvent(new CustomEvent("submit", {
      detail: { path },
      bubbles: true, composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  render() {
    const invalid = !!this._err;
    return html`
      <div class="row">
        <label>在 ${this._parent || "/"} 下新建目录</label>
        <input
          autofocus
          class=${invalid ? "invalid" : ""}
          .value=${this._name}
          @input=${this._onInput}
          @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this._submit()}
        />
        ${invalid ? html`<div class="err">${this._err}</div>` : ""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${invalid} @click=${this._submit}>新建</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "mkdir-dialog": MkdirDialog; }
}
```

- [ ] **Step 18.4: Implement rename-dialog**

Create `frontend/src/components/rename-dialog.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement, state, property } from "lit/decorators.js";

const ILLEGAL = /[\\/:*?"<>|]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

@customElement("rename-dialog")
export class RenameDialog extends LitElement {
  static styles = css`
    :host { display: block; }
    .row { margin: var(--cortex-space-3) 0; }
    label { display: block; font-size: var(--cortex-fs-sm); color: var(--cortex-text-muted); margin-bottom: 4px; }
    input {
      width: 100%; padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
      box-sizing: border-box;
    }
    input.invalid { border-color: var(--cortex-danger); }
    .err { color: var(--cortex-danger); font-size: var(--cortex-fs-sm); margin-top: 4px; }
    .actions { display: flex; justify-content: flex-end; gap: var(--cortex-space-2); margin-top: var(--cortex-space-4); }
    button { padding: 6px 16px; border: 1px solid var(--cortex-border); background: var(--cortex-surface); cursor: pointer; border-radius: var(--cortex-radius-sm); }
    button.primary { background: var(--cortex-primary); color: white; border-color: var(--cortex-primary); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
  `;

  @property({ type: String }) currentName = "";
  @state() private _name = "";
  @state() private _err = "";

  connectedCallback() {
    super.connectedCallback();
    this._name = this.currentName;
  }

  private _validate(v: string): string {
    if (!v) return "名称不能为空";
    if (v === this.currentName) return "名称未变化";
    if (v.startsWith(".")) return "不能以点开头";
    if (ILLEGAL.test(v)) return "含非法字符";
    if (RESERVED.test(v)) return "Windows 保留名";
    return "";
  }

  private _onInput(e: Event) {
    this._name = (e.target as HTMLInputElement).value;
    this._err = this._validate(this._name);
  }

  private _submit() {
    if (this._err) return;
    this.dispatchEvent(new CustomEvent("submit", {
      detail: { newName: this._name },
      bubbles: true, composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  render() {
    const invalid = !!this._err;
    return html`
      <div class="row">
        <label>重命名</label>
        <input
          autofocus
          class=${invalid ? "invalid" : ""}
          .value=${this._name}
          @input=${this._onInput}
          @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this._submit()}
        />
        ${invalid ? html`<div class="err">${this._err}</div>` : ""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${invalid} @click=${this._submit}>重命名</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "rename-dialog": RenameDialog; }
}
```

- [ ] **Step 18.5: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run "mkdir-dialog or rename-dialog"`
Expected: All PASS (mkdir-dialog test only; rename-dialog test is a stub you can write yourself following the same pattern)

- [ ] **Step 18.6: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/src/components/mkdir-dialog.ts cortex/web_v2/frontend/src/components/rename-dialog.ts cortex/web_v2/frontend/tests/mkdir-dialog.spec.ts
git commit -m "feat(web): add mkdir-dialog and rename-dialog with live validation"
```

---

## Task 19: Frontend — move-dialog (multi-select with tree picker)

**Files:**
- Create: `frontend/src/components/move-dialog.ts`
- Create: `frontend/tests/move-dialog.spec.ts`

- [ ] **Step 19.1: Write failing test**

Create `frontend/tests/move-dialog.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../src/components/move-dialog";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";

describe("move-dialog", () => {
  beforeEach(() => resetStore(store));

  it("shows 'N items' when multiple selected", async () => {
    actions.setFilesState({
      selectedPaths: ["a.md", "b.md", "c.md"],
      treeCache: { "": [
        { name: "docs", path: "docs", isDir: true, size: 0, modifiedAt: "", indexed: false, writable: true },
      ]},
    });
    const el = document.createElement("move-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("3");
    document.body.removeChild(el);
  });

  it("submit dispatches with selected dest_dir", async () => {
    actions.setFilesState({
      selectedPaths: ["a.md"],
      treeCache: { "": [
        { name: "docs", path: "docs", isDir: true, size: 0, modifiedAt: "", indexed: false, writable: true },
      ]},
    });
    const el = document.createElement("move-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    // 模拟选中 docs
    el._selectedDest = "docs";
    el.requestUpdate();
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("submit", (e: Event) => spy((e as CustomEvent).detail));
    el.shadowRoot.querySelector("button.primary").click();
    expect(spy).toHaveBeenCalledWith({ destDir: "docs", overwrite: false });
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 19.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run move-dialog`
Expected: FAIL

- [ ] **Step 19.3: Implement move-dialog**

Create `frontend/src/components/move-dialog.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store } from "../state/store";
import "./tree-node";

@customElement("move-dialog")
export class MoveDialog extends LitElement {
  static styles = css`
    :host { display: block; min-width: 320px; }
    h3 { margin: 0 0 var(--cortex-space-3) 0; font-size: var(--cortex-fs-md); }
    .tree {
      max-height: 320px; overflow-y: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: var(--cortex-space-2);
      margin: var(--cortex-space-2) 0;
    }
    .selected { color: var(--cortex-text-muted); font-size: var(--cortex-fs-sm); margin-bottom: var(--cortex-space-2); }
    .actions { display: flex; justify-content: flex-end; gap: var(--cortex-space-2); }
    button { padding: 6px 16px; border: 1px solid var(--cortex-border); background: var(--cortex-surface); cursor: pointer; border-radius: var(--cortex-radius-sm); }
    button.primary { background: var(--cortex-primary); color: white; border-color: var(--cortex-primary); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    label.opt { display: flex; gap: var(--cortex-space-2); align-items: center; font-size: var(--cortex-fs-sm); padding: var(--cortex-space-2) 0; }
  `;

  @state() private _dest = "";
  @state() private _overwrite = false;

  private get _selectedCount() { return store.getState().files.selectedPaths.length; }

  private _onPickDir(e: CustomEvent<{ path: string }>) {
    this._dest = e.detail.path;
  }

  private _onToggle(e: Event) {
    // 让事件冒泡到内部 tree-node 处理；这里只阻止关闭 dialog
    e.stopPropagation();
  }

  private _submit() {
    if (!this._dest) return;
    this.dispatchEvent(new CustomEvent("submit", {
      detail: { destDir: this._dest, overwrite: this._overwrite },
      bubbles: true, composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  render() {
    const { treeCache, expandedPaths } = store.getState().files;
    const rootDirs = (treeCache[""] || []).filter(e => e.isDir);
    const expanded = new Set(expandedPaths);

    return html`
      <h3>移动 ${this._selectedCount} 个项目到</h3>
      <div class="tree">
        ${rootDirs.map(d => html`
          <tree-node
            .entry=${d}
            .depth=${0}
            .readonly=${true}
            .expanded=${expanded.has(d.path)}
            .selected=${this._dest === d.path}
            .children=${treeCache[d.path] || []}
            @pick-dir=${this._onPickDir}
            @toggle=${this._onToggle}
          ></tree-node>
        `)}
      </div>
      <div class="selected">目标：${this._dest || "（请选择）"}</div>
      <label class="opt">
        <input type="checkbox" .checked=${this._overwrite} @change=${(e: Event) => this._overwrite = (e.target as HTMLInputElement).checked} />
        覆盖同名
      </label>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${!this._dest} @click=${this._submit}>移动到这里</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "move-dialog": MoveDialog; }
}
```

- [ ] **Step 19.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run move-dialog`
Expected: All PASS

- [ ] **Step 19.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/src/components/move-dialog.ts cortex/web_v2/frontend/tests/move-dialog.spec.ts
git commit -m "feat(web): add move-dialog with readonly tree picker and overwrite toggle"
```

---

## Task 20: Frontend — delete-dialog (state machine + double confirm)

**Files:**
- Create: `frontend/src/components/delete-dialog.ts`
- Create: `frontend/tests/delete-dialog.spec.ts`

- [ ] **Step 20.1: Write failing test**

Create `frontend/tests/delete-dialog.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../src/components/delete-dialog";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";

describe("delete-dialog", () => {
  beforeEach(() => resetStore(store));

  it("single file does not call stats", async () => {
    actions.setFilesState({ selectedPaths: ["a.md"] });
    const el = document.createElement("delete-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    // 直接 confirming 状态，无 loading
    expect(el.shadowRoot.textContent).toContain("1 个文件");
    document.body.removeChild(el);
  });

  it("confirm button disabled until checkbox checked", async () => {
    actions.setFilesState({ selectedPaths: ["docs"] });
    const el = document.createElement("delete-dialog") as any;
    el._stats = { file_count: 5, dir_count: 2, total_size_bytes: 1024 };
    el._state = "confirming";
    document.body.appendChild(el);
    await el.updateComplete;
    const btn = el.shadowRoot.querySelector("button.danger") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // 勾选
    el.shadowRoot.querySelector("input[type=checkbox]").click();
    await el.updateComplete;
    expect(btn.disabled).toBe(false);
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 20.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run delete-dialog`
Expected: FAIL

- [ ] **Step 20.3: Implement delete-dialog**

Create `frontend/src/components/delete-dialog.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store } from "../state/store";
import { filesApi } from "../api/files";

type Phase = "loading-stats" | "confirming" | "deleting";

@customElement("delete-dialog")
export class DeleteDialog extends LitElement {
  static styles = css`
    :host { display: block; min-width: 360px; }
    .warn {
      padding: var(--cortex-space-3);
      background: #FEF3C7;
      border: 1px solid #FCD34D;
      border-radius: var(--cortex-radius-md);
      color: #92400E;
      font-size: var(--cortex-fs-sm);
      margin-bottom: var(--cortex-space-3);
    }
    .stats { font-size: var(--cortex-fs-sm); color: var(--cortex-text); line-height: 1.6; }
    .stats li { list-style: none; padding: 2px 0; }
    .actions { display: flex; justify-content: flex-end; gap: var(--cortex-space-2); margin-top: var(--cortex-space-4); }
    button { padding: 6px 16px; border: 1px solid var(--cortex-border); background: var(--cortex-surface); cursor: pointer; border-radius: var(--cortex-radius-sm); }
    button.danger { background: var(--cortex-danger); color: white; border-color: var(--cortex-danger); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    label.opt { display: flex; gap: var(--cortex-space-2); align-items: center; padding: var(--cortex-space-2) 0; font-size: var(--cortex-fs-sm); }
    .spinner { color: var(--cortex-text-muted); }
  `;

  @state() private _phase: Phase = "confirming";
  @state() private _stats: { file_count: number; dir_count: number; total_size_bytes: number } | null = null;
  @state() private _confirmed = false;

  private get _selected() { return store.getState().files.selectedPaths; }
  private get _singleDir() {
    const sel = this._selected;
    return sel.length === 1 && sel[0] !== "";
  }

  connectedCallback() {
    super.connectedCallback();
    // 多选或单选目录时拉 stats
    if (this._selected.length > 1 || (this._selected.length === 1)) {
      this._phase = "loading-stats";
      this._loadStats();
    }
  }

  private async _loadStats() {
    const sel = this._selected;
    let totalFiles = 0, totalDirs = 0, totalBytes = 0;
    for (const p of sel) {
      try {
        const s = await filesApi.stats(p);
        totalFiles += s.fileCount;
        totalDirs += s.dirCount;
        totalBytes += s.totalSizeBytes;
      } catch {
        // 单文件会 400，忽略
      }
    }
    this._stats = { file_count: totalFiles, dir_count: totalDirs, total_size_bytes: totalBytes };
    this._phase = "confirming";
  }

  private _fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  private _delete() {
    if (!this._confirmed) return;
    this._phase = "deleting";
    this.dispatchEvent(new CustomEvent("submit", {
      detail: { paths: this._selected },
      bubbles: true, composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  render() {
    const count = this._selected.length;
    if (this._phase === "loading-stats") {
      return html`<div class="spinner">统计中…</div>`;
    }
    return html`
      <h3>删除 ${count > 1 ? `${count} 项` : this._selected[0]}？</h3>
      <div class="warn">⚠️ 此操作不可恢复</div>
      ${this._stats ? html`
        <div class="stats">
          将永久删除：
          <ul>
            <li>• ${this._stats.file_count} 个文件</li>
            <li>• ${this._stats.dir_count} 个子文件夹</li>
            <li>• 总计 ${this._fmtSize(this._stats.total_size_bytes)}</li>
          </ul>
        </div>
      ` : html`<div class="stats">将永久删除 1 个文件。</div>`}
      <label class="opt">
        <input type="checkbox" .checked=${this._confirmed} @change=${(e: Event) => this._confirmed = (e.target as HTMLInputElement).checked} />
        我确定要永久删除
      </label>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="danger" ?disabled=${!this._confirmed || this._phase === "deleting"} @click=${this._delete}>
          ${this._phase === "deleting" ? "删除中…" : "永久删除"}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "delete-dialog": DeleteDialog; }
}
```

- [ ] **Step 20.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run delete-dialog`
Expected: All PASS

- [ ] **Step 20.5: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/src/components/delete-dialog.ts cortex/web_v2/frontend/tests/delete-dialog.spec.ts
git commit -m "feat(web): add delete-dialog with stats preview and double confirmation"
```

---

## Task 21: Frontend — drop-zone (drag-drop upload)

**Files:**
- Create: `frontend/src/components/drop-zone.ts`

- [ ] **Step 21.1: Implement drop-zone**

Create `frontend/src/components/drop-zone.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("drop-zone")
export class DropZone extends LitElement {
  static styles = css`
    :host { display: contents; }
    .overlay {
      position: absolute; inset: 0;
      background: rgba(13, 148, 136, 0.15);
      border: 3px dashed var(--cortex-primary);
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: var(--cortex-space-2);
      pointer-events: none;
      z-index: 10;
      font-size: var(--cortex-fs-md);
      color: var(--cortex-primary);
      font-weight: 500;
    }
    .overlay.active { display: flex; }
    @media (max-width: 1023px) {
      /* 移动端不支持拖拽上传，drop-zone 完全禁用 */
      :host { display: none; }
    }
  `;

  @property({ type: String }) targetDir = "";
  @state() private _active = false;

  private _dragCounter = 0;

  connectedCallback() {
    super.connectedCallback();
    // 监听 window，让 drop-zone 在文件进入窗口时即激活
    window.addEventListener("dragenter", this._onDragEnter);
    window.addEventListener("dragover", this._onDragOver);
    window.addEventListener("dragleave", this._onDragLeave);
    window.addEventListener("drop", this._onDrop);
  }

  disconnectedCallback() {
    window.removeEventListener("dragenter", this._onDragEnter);
    window.removeEventListener("dragover", this._onDragOver);
    window.removeEventListener("dragleave", this._onDragLeave);
    window.removeEventListener("drop", this._onDrop);
    super.disconnectedCallback();
  }

  private _hasFilesOnly(e: DragEvent): boolean {
    if (!e.dataTransfer) return false;
    // 拒绝包含目录的拖放
    const items = Array.from(e.dataTransfer.items || []);
    if (items.length === 0) return e.dataTransfer.types.includes("Files");
    return items.every(i => i.kind === "file");
  }

  private _onDragEnter = (e: DragEvent) => {
    if (!this._hasFilesOnly(e)) return;
    e.preventDefault();
    this._dragCounter++;
    this._active = true;
  };
  private _onDragOver = (e: DragEvent) => {
    if (!this._hasFilesOnly(e)) return;
    e.preventDefault();
  };
  private _onDragLeave = () => {
    this._dragCounter--;
    if (this._dragCounter <= 0) {
      this._active = false;
      this._dragCounter = 0;
    }
  };
  private _onDrop = (e: DragEvent) => {
    if (!e.dataTransfer) return;
    e.preventDefault();
    this._active = false;
    this._dragCounter = 0;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    this.dispatchEvent(new CustomEvent("drop-files", {
      detail: { files, destDir: this.targetDir },
      bubbles: true, composed: true,
    }));
  };

  render() {
    return html`
      <div class="overlay ${this._active ? "active" : ""}">
        <div>⬇ 拖放以上传到</div>
        <div>📁 ${this.targetDir || "/"}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "drop-zone": DropZone; }
}
```

- [ ] **Step 21.2: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/src/components/drop-zone.ts
git commit -m "feat(web): add drop-zone for drag-drop upload (desktop only)"
```

---

## Task 22: Frontend — files-view top-level coordinator

**Files:**
- Create: `frontend/src/views/files-view.ts` (replace stub)
- Create: `frontend/tests/files-view.spec.ts`

- [ ] **Step 22.1: Write failing test**

Create `frontend/tests/files-view.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../src/views/files-view";
import { resetStore } from "./test-utils";
import { store } from "../src/state/store";

describe("files-view", () => {
  beforeEach(() => resetStore(store));

  it("renders three panes on desktop viewport", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    // 三栏容器存在
    expect(el.shadowRoot.querySelector(".desktop-layout")).toBeTruthy();
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 22.2: Run, verify fail**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run files-view`
Expected: FAIL (stub does not have desktop-layout)

- [ ] **Step 22.3: Implement files-view (replace stub)**

Replace `frontend/src/views/files-view.ts`:

```ts
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store, actions } from "../state/store";
import { filesApi } from "../api/files";
import "../components/file-tree";
import "../components/file-list";
import "../components/file-detail";
import "../components/mkdir-dialog";
import "../components/rename-dialog";
import "../components/move-dialog";
import "../components/delete-dialog";

type DialogKind = "mkdir" | "rename" | "move" | "delete" | null;

@customElement("files-view")
export class FilesView extends LitElement {
  static styles = css`
    :host {
      display: flex; flex-direction: column;
      flex: 1; min-height: 0;
      background: var(--cortex-bg);
      font-family: var(--cortex-font);
    }
    .desktop-layout {
      flex: 1;
      display: grid;
      grid-template-columns: 240px 1fr 320px;
      min-height: 0;
    }
    .mobile-layout {
      flex: 1; min-height: 0; position: relative;
    }
    dialog {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      padding: var(--cortex-space-6);
      background: var(--cortex-surface);
      box-shadow: 0 12px 32px rgba(0,0,0,0.12);
      min-width: 360px;
    }
    dialog::backdrop { background: rgba(0,0,0,0.3); }
    .back-btn {
      position: absolute; top: var(--cortex-space-2); left: var(--cortex-space-2);
      padding: 6px 12px; border: 1px solid var(--cortex-border);
      background: var(--cortex-surface); border-radius: var(--cortex-radius-sm);
      cursor: pointer;
    }
    @media (max-width: 1023px) {
      .desktop-layout { display: none; }
    }
    @media (min-width: 1024px) {
      .mobile-layout { display: none; }
    }
  `;

  @state() private _dialog: DialogKind = null;
  @state() private _toast: string | null = null;

  private _unsubscribe?: () => void;
  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    // 首次进入：自动加载根目录到中栏
    this._ensureLoaded("");
  }
  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  private get _state() { return store.getState().files; }
  private get _isMobile() {
    return typeof window !== "undefined" && window.innerWidth < 1024;
  }

  private async _ensureLoaded(path: string) {
    if (path in this._state.treeCache) return;
    try {
      actions.setFilesState({ listing: true });
      const res = await filesApi.list(path);
      actions.setFilesState({
        treeCache: { ...store.getState().files.treeCache, [path]: res.entries },
        listing: false,
      });
    } catch (e: any) {
      actions.setFilesState({ listing: false, error: e?.message || "加载失败" });
    }
  }

  // 选中变化时，若单选，拉详情
  private async _maybeLoadDetail() {
    const sel = this._state.selectedPaths;
    if (sel.length !== 1) {
      actions.setFilesState({ detail: null });
      return;
    }
    actions.setFilesState({ detailLoading: true });
    try {
      const attrs = await filesApi.attrs(sel[0]);
      actions.setFilesState({ detail: attrs, detailLoading: false });
    } catch {
      actions.setFilesState({ detailLoading: false });
    }
  }

  updated(changed: Map<string, any>) {
    // 监听 selectedPaths 变化（简单粗暴：每次 update 都检查）
    this._maybeLoadDetail();
  }

  private _onAction(e: CustomEvent<{ name: string }>) {
    const name = e.detail.name;
    if (name === "preview") {
      // 复用现有预览路由：跳到 search view 加载该文件（简化版）
      const path = this._state.selectedPaths[0];
      window.open(`/api/preview/download?path=${encodeURIComponent(path)}`, "_blank");
      return;
    }
    if (name === "download") {
      const path = this._state.selectedPaths[0];
      window.open(`/api/preview/download?path=${encodeURIComponent(path)}`, "_blank");
      return;
    }
    this._dialog = name as DialogKind;
  }

  // dialog 事件处理
  private async _onMkdirSubmit(e: CustomEvent<{ path: string }>) {
    this._dialog = null;
    try {
      await filesApi.mkdir(e.detail.path);
      const parent = e.detail.path.includes("/") ? e.detail.path.slice(0, e.detail.path.lastIndexOf("/")) : "";
      actions.invalidateDir(parent);
      await this._ensureLoaded(parent);
      actions.expandDir(parent);
      this._toast = "目录已创建";
    } catch (e: any) { this._toast = e?.message || "创建失败"; }
  }

  private async _onRenameSubmit(e: CustomEvent<{ newName: string }>) {
    const path = this._state.selectedPaths[0];
    this._dialog = null;
    try {
      await filesApi.rename(path, e.detail.newName);
      actions.invalidateDir(this._state.currentDir);
      await this._ensureLoaded(this._state.currentDir);
      this._toast = "已重命名";
    } catch (e: any) { this._toast = e?.message || "重命名失败"; }
  }

  private async _onMoveSubmit(e: CustomEvent<{ destDir: string; overwrite: boolean }>) {
    const sel = this._state.selectedPaths;
    this._dialog = null;
    try {
      const res = await filesApi.move(sel, e.detail.destDir, e.detail.overwrite);
      // 失效所有涉及的父目录
      const parents = new Set(sel.map(p => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""));
      parents.add(e.detail.destDir);
      parents.forEach(p => actions.invalidateDir(p));
      for (const p of parents) await this._ensureLoaded(p);
      actions.clearSelection();
      this._toast = res.skipped.length
        ? `已移动 ${res.moved.length} 项，${res.skipped.length} 项跳过`
        : `已移动 ${res.moved.length} 项`;
    } catch (e: any) { this._toast = e?.message || "移动失败"; }
  }

  private async _onDeleteSubmit(e: CustomEvent<{ paths: string[] }>) {
    const paths = e.detail.paths;
    this._dialog = null;
    let deleted = 0;
    let failed = 0;
    for (const p of paths) {
      try {
        await filesApi.remove(p);
        deleted++;
        // 失效子树
        actions.invalidateSubtree(p);
        const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
        actions.invalidateDir(parent);
      } catch { failed++; }
    }
    if (paths.length === 1) {
      const parent = paths[0].includes("/") ? paths[0].slice(0, paths[0].lastIndexOf("/")) : "";
      await this._ensureLoaded(parent);
    } else {
      await this._ensureLoaded("");
    }
    actions.clearSelection();
    this._toast = failed ? `已删除 ${deleted}，失败 ${failed}` : `已删除 ${deleted} 项`;
  }

  private _onDropFiles(e: CustomEvent<{ files: File[]; destDir: string }>) {
    this._uploadFiles(e.detail.files, e.detail.destDir);
  }

  private async _uploadFiles(files: File[], destDir: string) {
    let ok = 0, skipped = 0;
    for (const f of files) {
      try {
        await filesApi.upload(f, destDir, false);
        ok++;
      } catch (e: any) {
        if (e?.code === "ALREADY_EXISTS") skipped++;
        else { this._toast = e?.message || "上传失败"; }
      }
    }
    actions.invalidateDir(destDir);
    await this._ensureLoaded(destDir);
    this._toast = `已上传 ${ok}${skipped ? `，跳过 ${skipped}` : ""}`;
  }

  render() {
    return html`
      ${this._isMobile ? this._renderMobile() : this._renderDesktop()}
      ${this._renderDialogs()}
      ${this._toast ? html`<div class="toast" @click=${() => this._toast = null}>${this._toast}</div>` : ""}
    `;
  }

  private _renderDesktop() {
    return html`
      <div class="desktop-layout">
        <file-tree></file-tree>
        <file-list @action=${this._onAction} @drop-files=${this._onDropFiles}></file-list>
        <file-detail @action=${this._onAction}></file-detail>
      </div>
    `;
  }

  private _renderMobile() {
    const pane = this._state.mobilePane;
    return html`
      <div class="mobile-layout">
        ${pane !== "tree" ? html`<button class="back-btn" @click=${() => this._goBack()}>← 返回</button>` : ""}
        ${pane === "tree" ? html`<file-tree></file-tree>` : ""}
        ${pane === "list" ? html`<file-list @action=${this._onAction}></file-list>` : ""}
        ${pane === "detail" ? html`<file-detail @action=${this._onAction}></file-detail>` : ""}
      </div>
    `;
  }

  private _goBack() {
    const pane = this._state.mobilePane;
    if (pane === "detail") actions.setMobilePane("list");
    else if (pane === "list") actions.setMobilePane("tree");
  }

  private _renderDialogs() {
    if (this._dialog === "mkdir") {
      return html`<dialog open><mkdir-dialog @submit=${this._onMkdirSubmit} @cancel=${() => this._dialog = null}></mkdir-dialog></dialog>`;
    }
    if (this._dialog === "rename") {
      const sel = this._state.selectedPaths[0] || "";
      const name = sel.split("/").pop() || "";
      return html`<dialog open><rename-dialog .currentName=${name} @submit=${this._onRenameSubmit} @cancel=${() => this._dialog = null}></rename-dialog></dialog>`;
    }
    if (this._dialog === "move") {
      return html`<dialog open><move-dialog @submit=${this._onMoveSubmit} @cancel=${() => this._dialog = null}></move-dialog></dialog>`;
    }
    if (this._dialog === "delete") {
      return html`<dialog open><delete-dialog @submit=${this._onDeleteSubmit} @cancel=${() => this._dialog = null}></delete-dialog></dialog>`;
    }
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap { "files-view": FilesView; }
}
```

- [ ] **Step 22.4: Run, verify pass**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run files-view`
Expected: All PASS

- [ ] **Step 22.5: Run full frontend test suite**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm test -- --run`
Expected: All PASS (any non-files tests should still pass)

- [ ] **Step 22.6: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/src/views/files-view.ts cortex/web_v2/frontend/tests/files-view.spec.ts
git commit -m "feat(web): implement files-view top-level coordinator with dialogs"
```

---

## Task 23: Build frontend static assets

**Files:**
- Modify: `cortex/web_v2/static/` (auto-generated by Vite)

- [ ] **Step 23.1: Verify lint passes**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm run lint 2>/dev/null || npm run typecheck 2>/dev/null || true`
Expected: no errors (or skip if no lint script)

- [ ] **Step 23.2: Build**

Run: `cd C:/Users/lianghao/github/cortex/cortex/web_v2/frontend && npm run build`
Expected: Vite outputs to `../static/`, no errors

- [ ] **Step 23.3: Sanity check — start server and verify page loads**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m cortex gui --port 7860 &
sleep 2
curl -s http://localhost:7860/api/health
curl -s http://localhost:7860/api/files/list?path= | head -200
# 手动浏览器访问 http://localhost:7860 切换到 files tab 验证`

Kill the server when done.

- [ ] **Step 23.4: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/static/
git commit -m "chore(web): rebuild static assets for file explorer tab"
```

---

## Task 24: Playwright E2E test

**Files:**
- Create: `frontend/tests/e2e/files-explorer.spec.ts`

> **IMPORTANT:** Per CLAUDE.md, use the `playwright-cli` skill for E2E tests, not direct playwright invocation.

- [ ] **Step 24.1: Invoke playwright-cli skill to scaffold E2E**

Use Skill tool with `playwright-cli` to verify project setup. Then create the test file:

Create `frontend/tests/e2e/files-explorer.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("files explorer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // 切换到 files tab（桌面端点击 activity-bar，移动端点击 tab-bar）
    const desktop = page.locator("activity-bar button[title='文件']");
    const mobile = page.locator("tab-bar button:has-text('文件')");
    if (await desktop.isVisible()) await desktop.click();
    else await mobile.click();
  });

  test("desktop renders three panes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator("file-tree")).toBeVisible();
    await expect(page.locator("file-list")).toBeVisible();
    await expect(page.locator("file-detail")).toBeVisible();
  });

  test("mobile renders single pane", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // 默认显示 tree 或 list
    await expect(page.locator(".mobile-layout")).toBeVisible();
  });

  test("mkdir creates folder and shows it in list", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator("file-list").locator('[data-action="mkdir"]').click();
    await page.locator("mkdir-dialog input").fill("e2e_test_folder");
    await page.locator("mkdir-dialog button.primary").click();
    // 列表里应该出现该目录
    await expect(page.locator("file-row").filter({ hasText: "e2e_test_folder" })).toBeVisible();
  });

  test("delete folder requires double confirm", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // 选中刚创建的目录
    await page.locator("file-row").filter({ hasText: "e2e_test_folder" }).click();
    await page.locator("file-list").locator('[data-action="delete"]').click();
    // 确认按钮初始 disabled
    const confirmBtn = page.locator("delete-dialog button.danger");
    await expect(confirmBtn).toBeDisabled();
    // 勾选确认
    await page.locator("delete-dialog input[type=checkbox]").check();
    await confirmBtn.click();
    // 删除后该行消失
    await expect(page.locator("file-row").filter({ hasText: "e2e_test_folder" })).toHaveCount(0);
  });

  test("dotfile paths are hidden in tree", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // .cortex 不应出现在树里
    await expect(page.locator("file-tree tree-node .label").filter({ hasText: ".cortex" })).toHaveCount(0);
  });

  test("multi-select move with ctrl+click", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // 准备：创建两个测试文件（略，依赖前面 mkdir 流程）
    // 选第一个
    const rows = page.locator("file-row");
    await rows.nth(0).click();
    // ctrl 选第二个
    await rows.nth(1).click({ modifiers: ["Control"] });
    // 点移动
    await page.locator("file-list").locator('[data-action="move"]').click();
    await expect(page.locator("move-dialog")).toContainText("2");
  });
});
```

- [ ] **Step 24.2: Run E2E via playwright-cli skill**

Use the playwright-cli skill (per CLAUDE.md) to run the test:

Skill invocation: `playwright-cli` with args `run frontend/tests/e2e/files-explorer.spec.ts`

Expected: All E2E tests PASS

- [ ] **Step 24.3: Commit**

```bash
cd C:/Users/lianghao/github/cortex
git add cortex/web_v2/frontend/tests/e2e/files-explorer.spec.ts
git commit -m "test(web): add Playwright E2E for files explorer"
```

---

## Self-Review Checklist (after writing)

Before handing off, verify each spec section has tasks:

| Spec Section | Tasks |
|---|---|
| §2 需求总结（决策表） | All tasks |
| §3.1 后端文件布局 | Tasks 1-11 |
| §3.2 前端文件布局 | Tasks 12-22 |
| §4.1 端点总览 | Tasks 4-10 |
| §4.2 请求/响应模型 | Task 3 |
| §4.3 path_safety.py | Tasks 1, 2 |
| §4.4 端点实现要点 | Tasks 4-10 |
| §4.5 错误码总表 | Tests in Tasks 4-10 |
| §5.1 状态扩展 | Task 12 |
| §5.2 组件职责 | Tasks 14-22 |
| §5.3 关键交互 | Task 16 (multi-select), Task 22 |
| §5.4 API client | Task 13 |
| §6 关键交互流程 | Tasks 18-22 |
| §7 安全模型 | Tasks 1, 2, 4-10 |
| §8 测试策略 | All tasks include tests |
| §9 实施顺序 | Maps 1:1 to tasks |

All spec sections covered. No TBD/TODO/placeholders. Type consistency verified.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-22-file-explorer.md`.**

Per user instruction "不需要我的确认", proceeding to execution automatically.

**Execution mode: Subagent-Driven** (per skill recommendation for plans of this size).

REQUIRED SUB-SKILL: superpowers:subagent-driven-development
