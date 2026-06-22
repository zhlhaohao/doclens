# File Explorer Tab — Design Spec

**Date:** 2026-06-22
**Topic:** cortex GUI 新增 file explorer tab，用于在工作目录上进行目录树遍历、目录/文件 CRUD、属性查看
**Status:** Approved (pending user spec review)

## 1. 背景与动机

当前 cortex GUI 已有四个 tab（search / chat / history / settings），但缺少对 `IndexManager.search_path` 工作目录本身的文件管理能力。用户需要离开浏览器、切到系统文件管理器才能新建/删除/重命名/上传文件，体验割裂。

新增独立的 file explorer tab，定位为**知识库管理器**：所有写操作自动触发增量重索引，与 search/preview 深度联动；`.cortex/` 等点文件隐藏且不可写，防止误删索引/会话数据库。

## 2. 需求总结（用户决策）

| 维度 | 决策 |
|------|------|
| 定位 | 知识库管理器（写操作自动 `trigger_background_reindex`，复用 preview/upload 思路） |
| 必备操作 | 目录树遍历、新建目录、删除目录、上传文件、删除文件、文件属性 |
| 加选操作 | 重命名（单条）、跨目录移动（多选） |
| 不做 | 复制、拖拽移动、键盘快捷键、目录上传、分片/断点续传 |
| 受保护路径 | 所有点文件（任何路径组件以 `.` 开头）一律隐藏 + 不可写 |
| 删除文件夹确认 | 双重确认：列出文件数/子目录数/总大小 + 勾选"我确定"才能点确认 |
| 上传交互 | 按钮（`<input type=file multiple>`）+ 拖拽（桌面端 drop-zone），均不支持目录上传 |
| 移动交互 | 选中 1 项或多项（Ctrl/Shift 多选）→ 点 [移动] → 弹目录树选择器 |
| 布局（桌面 ≥1024px） | 三栏：树(240px) \| 列表(1fr) \| 详情(320px) |
| 布局（移动 <1024px） | 单栏栈式，`mobilePane` 控制当前可见栏（tree / list / detail） |
| 文件大小上限 | 单文件上传 50 MB（沿用 `_MAX_UPLOAD_BYTES`） |
| 索引状态徽章 | 列表行显示 `[已索引]` 徽章（后端查 `idx.documents` 计算） |
| ViewId | 在 `search/chat/history/settings` 之外新增 `"files"` |

## 3. 架构总览

### 3.1 后端文件布局

```
cortex/web_v2/
├── api/
│   ├── files.py            ⭐ 新增：目录/文件 CRUD 路由
│   └── preview.py          （改为引用 path_safety.py）
├── path_safety.py          ⭐ 新增：共享 safe_resolve / is_protected / validate_name / validate_move_target
├── models/
│   └── files.py            ⭐ 新增：Entry / ListDirResponse / DirStatsResponse / AttrsResponse /
│                                   MkdirRequest / MoveRequest / MoveResponse / RenameRequest / UploadResponse
└── app.py                  （追加 include_router(files.router)）
```

### 3.2 前端文件布局

```
frontend/src/
├── views/
│   └── files-view.ts              ⭐ 顶层视图：三栏 / 单栏协调
├── components/
│   ├── file-tree.ts               ⭐ 左栏树容器
│   ├── tree-node.ts               ⭐ 递归节点
│   ├── file-list.ts               ⭐ 中栏：工具栏 + 列表 + drop-zone
│   ├── file-row.ts                ⭐ 单行
│   ├── file-detail.ts             ⭐ 右栏：属性 + 操作按钮
│   ├── mkdir-dialog.ts            ⭐ 新建目录弹窗
│   ├── rename-dialog.ts           ⭐ 重命名弹窗
│   ├── move-dialog.ts             ⭐ 多选移动弹窗（嵌套只读 tree-node）
│   ├── delete-dialog.ts           ⭐ 双重确认弹窗
│   └── drop-zone.ts               ⭐ 拖拽覆盖层（桌面端）
├── api/
│   └── files.ts                   ⭐ API client
└── state/
    └── types.ts                   （扩展 ViewId 和 FileExplorerViewState）
```

`activity-bar.ts` 和 `tab-bar.ts` 的 `_items` 数组各加一项：
`{ id: "files", icon: "📁", label: "文件" }`

## 4. 后端设计

### 4.1 端点总览（挂在 `/api/files` 前缀下）

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/files/list` | 列出指定目录（懒加载入口） |
| GET | `/api/files/stats` | 目录递归统计（删除前预览） |
| GET | `/api/files/attrs` | 单条目详细属性 |
| POST | `/api/files/mkdir` | 新建目录 |
| DELETE | `/api/files` | 删除文件或目录（递归） |
| POST | `/api/files/move` | 批量移动（保持原名） |
| POST | `/api/files/rename` | 单条重命名 |
| POST | `/api/files/upload` | 上传到指定目录 |

### 4.2 请求 / 响应模型（`models/files.py`）

```python
from datetime import datetime
from pydantic import BaseModel, Field

class Entry(BaseModel):
    name: str
    path: str                    # 相对 POSIX 路径，根为 ""
    is_dir: bool
    size: int                    # 文件：字节数；目录：0
    modified_at: datetime
    indexed: bool                # 仅文件有意义；目录始终 false
    writable: bool               # 预计算，前端直接渲染按钮状态

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
    extension: str | None
    is_protected: bool           # 应该永远 false（保护路径会先 403）

class MkdirRequest(BaseModel):
    path: str                    # 相对路径，如 "docs/new"

class MoveRequest(BaseModel):
    from_paths: list[str] = Field(..., min_length=1)
    dest_dir: str
    overwrite: bool = False

class SkippedItem(BaseModel):
    from_path: str
    reason: str                  # "ALREADY_EXISTS" / "IS_OWN_CHILD" / "PROTECTED" / ...

class MoveResponse(BaseModel):
    moved: list[str]             # 成功的 to_paths
    skipped: list[SkippedItem]

class RenameRequest(BaseModel):
    path: str
    new_name: str                # 仅新名，不含路径

class UploadResponse(BaseModel):
    path: str
    bytes_written: int
    overwritten: bool
    reindex_triggered: bool
```

### 4.3 共享路径安全模块（`path_safety.py`）

抽离并统一以下逻辑（`preview.py` 同步改为引用）：

```python
import re
from pathlib import Path
from cortex.web_v2.api.errors import CortexAPIError

ILLEGAL_NAME_CHARS = frozenset('\\/:*?"<>|')
_ILLEGAL_NAME_PATTERNS = [
    re.compile(r"^\s"),
    re.compile(r"[\x00-\x1f]"),
]
RESERVED_WIN_NAMES = frozenset({
    "CON","PRN","AUX","NUL",
    "COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9",
    "LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9",
})
MAX_PATH_LEN = 255

def safe_resolve(base: Path, requested: str) -> Path:
    """解析并校验：禁止 ..，结果必须在 base 内。"""
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

def validate_name(name: str) -> None:
    """mkdir / rename / upload 文件名共用校验。"""
    if not name or name in (".", ".."):
        raise CortexAPIError(400, "INVALID_NAME", "名称为空或为保留字")
    if name.startswith("."):
        raise CortexAPIError(400, "INVALID_NAME", "不能以点开头")
    bad = set(name) & ILLEGAL_NAME_CHARS
    if bad:
        raise CortexAPIError(400, "INVALID_NAME", f"含非法字符: {bad}")
    if any(p.search(name) for p in _ILLEGAL_NAME_PATTERNS):
        raise CortexAPIError(400, "INVALID_NAME", "含控制字符或以空白开头")
    if name.upper() in RESERVED_WIN_NAMES:
        raise CortexAPIError(400, "RESERVED_NAME", f"Windows 保留名: {name}")

def validate_move_target(from_path: Path, dest_dir: Path) -> None:
    """from 不能是 dest_dir 本身或其祖先。"""
    if from_path == dest_dir:
        raise CortexAPIError(400, "INVALID_TARGET", "不能移动到自身")
    try:
        dest_dir.relative_to(from_path)
        raise CortexAPIError(400, "INVALID_TARGET", "不能移动到自己的子目录")
    except ValueError:
        pass

def compute_writable(full: Path, base: Path) -> bool:
    """统一可写性判断。

    - 保护路径（点文件 / base 外）→ False
    - 不存在 → False
    - 文件：与 preview.py 的 _compute_writable 语义一致（os.access W_OK）
    - 目录：os.access W_OK + X_OK（可写且可遍历，才能增删子项）
    """
    if is_protected(full, base):
        return False
    if not full.exists():
        return False
    import os
    if full.is_file():
        return os.access(full, os.W_OK)
    if full.is_dir():
        return os.access(full, os.W_OK) and os.access(full, os.X_OK)
    return False
```

### 4.4 端点实现要点

所有写端点（mkdir / delete / move / rename / upload）：

1. 校验请求路径（`safe_resolve` + `assert_not_protected` + 写操作的 `assert_not_root`）
2. 执行文件系统操作
3. 写盘成功后 `try: idx.trigger_background_reindex() except: log warning`
4. 响应包含 `reindex_triggered: bool`

**`GET /api/files/list?path=<dir>&limit=200&offset=0`**
- 隐藏点文件（`is_protected` 过滤）
- 对每个 entry 预计算 `indexed`（从 `idx.documents` 构建 source_path 集合）和 `writable`
- 按 `is_dir desc, name asc` 排序

**`GET /api/files/stats?path=<dir>`**
- 拒绝点文件路径（403）
- 递归遍历，累计 file_count / dir_count / total_size_bytes（忽略点文件子目录）

**`POST /api/files/mkdir`**
- 父目录必须存在；新名走 `validate_name`
- 已存在 → 409 `ALREADY_EXISTS`
- `parents=False` 语义（只允许一层新目录），若要嵌套需客户端多次调用

**`DELETE /api/files?path=<path>`**
- 文件：直接删
- 目录：`shutil.rmtree` 递归
- 点文件 / 根 → 403 / 400
- 不存在 → 404

**`POST /api/files/move`**
- 校验每个 `from_path` + `dest_dir` + 合成的新路径
- `from_path == dest_dir` 的祖先关系 → 收集到 `skipped`
- `overwrite=False` 且目标已存在 → `skipped` reason=`ALREADY_EXISTS`
- `overwrite=True` 则覆盖（文件 `unlink` 后 move；目录 `rmtree` 后 move）
- 每成功一个 → 加入 `moved`；失败 → 加入 `skipped`（带 reason）
- 部分成功后仍触发 reindex

**`POST /api/files/rename`**
- 单条：校验 `new_name`（`validate_name`）
- 同父目录 + 新名 → `Path.rename`
- 目标已存在 → 409

**`POST /api/files/upload`**
- Multipart：`file` + `dest_dir`（表单）+ `overwrite`（表单）
- 大小上限 `_MAX_UPLOAD_BYTES = 50 * 1024 * 1024`（与 preview 一致）
- `dest_dir` 必须存在且非保护路径
- `validate_name(file.filename)`，禁止点开头
- `overwrite=False` 且目标已存在 → 409
- `overwrite=True` 覆盖
- 写盘后触发 reindex

### 4.5 错误码总表

| HTTP | code | 触发场景 |
|------|------|---------|
| 400 | `INVALID_PATH` | 路径超长、结构非法 |
| 400 | `INVALID_NAME` | 空名 / 点开头 / 非法字符 / 控制字符 / 空白开头 |
| 400 | `INVALID_TARGET` | 根目录被删/移动；move 的 dest 是 from 的子路径 |
| 400 | `RESERVED_NAME` | Windows 保留名（CON / PRN / AUX / NUL / COMn / LPTn） |
| 403 | `PROTECTED` | 点文件 / `.cortex/` / 越权 |
| 403 | `NOT_WRITABLE` | 文件系统只读 / 权限不足 |
| 404 | `FILE_NOT_FOUND` | 路径不存在（也用于越权伪装，与 preview.py 一致） |
| 409 | `ALREADY_EXISTS` | mkdir / rename / upload（未勾选覆盖）目标已存在；move 的 skipped reason |
| 413 | `CONTENT_TOO_LARGE` | 上传超过 50 MB |
| 500 | `WRITE_FAILED` | `OSError` 包装 |

## 5. 前端设计

### 5.1 状态扩展（`state/types.ts`）

```ts
export type ViewId = "search" | "chat" | "history" | "settings" | "files";

export interface FileEntry {
  name: string;
  path: string;          // 相对 POSIX 路径，根为 ""
  isDir: boolean;
  size: number;
  modifiedAt: string;
  indexed: boolean;
  writable: boolean;
}

export interface FileExplorerViewState {
  treeCache: Record<string, FileEntry[]>;   // dirPath → entries（写后局部失效）
  expandedPaths: string[];                   // 展开的树节点路径
  currentDir: string;                        // 中栏当前目录，默认 ""
  selectedPaths: string[];                   // 多选数组（单击替换 / Ctrl 切换 / Shift 范围）
  lastSelectedAnchor: string | null;         // Shift 多选的起点
  detail: FileEntry | null;                  // 右栏（attrs 补全后）
  detailLoading: boolean;
  listing: boolean;                          // 中栏加载中
  mobilePane: "tree" | "list" | "detail";
  pendingAction: "mkdir" | "delete" | "move" | "rename" | "upload" | null;
  error: string | null;
}

// AppState 增加：
files: FileExplorerViewState;
```

`store.ts` 新增 actions：`expandDir` / `collapseDir` / `selectDir` / `selectEntry`（支持多选语义） / `invalidateDir` / `setMobilePane` / `clearSelection`。

### 5.2 组件职责

| 组件 | 职责 | 行数预算 |
|------|------|---------|
| `files-view` | 顶层协调：响应式切换三栏 / 单栏；托管 dialog 显示状态；订阅 error 显示 toast | < 200 |
| `file-tree` | 左栏树容器：从根递归渲染 `tree-node`；订阅 `expandedPaths` | < 150 |
| `tree-node` | 递归节点：箭头（展开/折叠）+ 图标 + 名；点击切中栏；支持只读模式（给 move-dialog 嵌套用） | < 200 |
| `file-list` | 中栏：工具栏（[新目录][上传][重命名][移动][删除]）+ 行列表 + drop-zone；空态友好提示 | < 250 |
| `file-row` | 单行：图标 + 名 + 大小 + mtime + `[已索引]` 徽章；单击/Ctrl/Shift 选中 | < 150 |
| `file-detail` | 右栏：完整属性 + 操作按钮（[打开预览][下载][重命名][移动][删除]）；未选中占位 | < 200 |
| `mkdir-dialog` | 输入名 + 父目录预览 + 实时非法字符校验 | < 150 |
| `rename-dialog` | 输入框预填原名；同名校验 | < 120 |
| `move-dialog` | 多选显示；嵌套只读目录树选择器；覆盖开关 | < 200 |
| `delete-dialog` | 状态机：`loading-stats` → `confirming` → `deleting`；勾选启用确认按钮 | < 200 |
| `drop-zone` | 全屏覆盖层；拖拽进入时显示"拖放到 `<dir>` 上传"；拒绝目录项 | < 100 |

### 5.3 关键交互

**多选语义**
- 单击：`selectedPaths = [path]`，anchor = path
- Ctrl/Cmd+点击：toggle path 在数组中
- Shift+点击：从 anchor 到当前行范围全选
- 点击空白处 / Esc：`clearSelection`
- 树节点点击：清空多选 + 单选该目录 + 切中栏

**工具栏启用规则**
- `[新目录]`：始终启用（目标 = `currentDir`）
- `[上传]`：始终启用
- `[重命名]`：仅 `selectedPaths.length === 1` 启用
- `[移动]`：`selectedPaths.length >= 1` 启用
- `[删除]`：`selectedPaths.length >= 1` 启用

**树懒加载**
- 初次进入 view：自动展开根 `""`，拉一次 `list("")`
- 点击节点箭头：若 `treeCache[path]` 已存在直接展开；否则拉 `list(path)` 再展开
- 缓存失效：写操作后 `invalidateDir(parentPath)` → 重拉；delete 目录时清除以该路径为前缀的所有 cache key

**选中 → 右栏**
- 选中变化：右栏显示该条目的基础 Entry；若 `selectedPaths.length === 1`，额外拉 `GET /api/files/attrs` 补全 `created_at`/`extension`
- 多选时右栏显示"N 项已选中"占位 + 仅 `[移动]` / `[删除]` 按钮可用

**响应式布局**
- 桌面 ≥1024px：`grid-template-columns: 240px 1fr 320px`，三栏同时可见
- 移动 <1024px：`display: block`，靠 `mobilePane` 切换唯一可见栏；面包屑显示完整路径；返回按钮回退

### 5.4 API client（`api/files.ts`）

```ts
import { request } from "./client";

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedAt: string;
  indexed: boolean;
  writable: boolean;
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
export interface AttrsResponse extends FileEntry {
  createdAt: string;
  extension: string | null;
  isProtected: boolean;
}
export interface UploadResponse {
  path: string;
  bytesWritten: number;
  overwritten: boolean;
  reindexTriggered: boolean;
}
export interface SkippedItem { fromPath: string; reason: string; }
export interface MoveResponse { moved: string[]; skipped: SkippedItem[]; }

const qs = (p: string) => `/api/files${p}`;

export const filesApi = {
  list: (path: string, limit = 200, offset = 0) =>
    request<ListDirResponse>(qs(`/list?path=${encodeURIComponent(path)}&limit=${limit}&offset=${offset}`)),
  stats: (path: string) =>
    request<DirStatsResponse>(qs(`/stats?path=${encodeURIComponent(path)}`)),
  attrs: (path: string) =>
    request<AttrsResponse>(qs(`/attrs?path=${encodeURIComponent(path)}`)),
  mkdir: (path: string) =>
    request<{ ok: true; path: string }>(qs("/mkdir"), { method: "POST", json: { path } }),
  remove: (path: string) =>
    request<{ ok: true; deleted: string }>(qs(`?path=${encodeURIComponent(path)}`), { method: "DELETE" }),
  move: (fromPaths: string[], destDir: string, overwrite = false) =>
    request<MoveResponse>(qs("/move"), { method: "POST", json: { from_paths: fromPaths, dest_dir: destDir, overwrite } }),
  rename: (path: string, newName: string) =>
    request<FileEntry>(qs("/rename"), { method: "POST", json: { path, new_name: newName } }),
  upload: (file: File, destDir: string, overwrite = false) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dest_dir", destDir);
    fd.append("overwrite", String(overwrite));
    return request<UploadResponse>(qs("/upload"), { method: "POST", body: fd });
  },
};
```

## 6. 关键交互流程

### 6.1 上传（按钮 + 拖拽，不支持目录）

```
[按钮路径]
用户点 [上传] → 弹原生 <input type="file" multiple>
选文件 → 弹 confirm("上传 N 个文件到 <currentDir>？同名覆盖？[取消/跳过/覆盖]")
逐个调 POST /api/files/upload (dest_dir=currentDir, overwrite=...)
  ├─ 200 → invalidateDir(currentDir) 重拉 list
  ├─ 409 ALREADY_EXISTS → 未勾选覆盖时跳过
  └─ 413 → toast "xxx 超过 50MB 上限"
全部完成 → toast "已上传 N 个文件"

[拖拽路径 - 仅桌面端]
用户拖文件进窗口 → drop-zone 全屏覆盖：
            ┌──────────────────────┐
            │  ⬇ 拖放以上传到        │
            │  📁 docs/current      │
            └──────────────────────┘
释放 → 同按钮路径
离开窗口 / Esc → 取消
拖入项是目录（DataTransferItem.isDirectory）→ 警告 toast + 拒绝
```

**多文件并发**：浏览器原生并发上限（~6），不做额外调度。

### 6.2 多选移动

```
Ctrl/Cmd+click 选中多项 → 工具栏点 [移动]
  ↓
move-dialog 打开（嵌套只读 tree-node）：
  ┌──────────────────────────────┐
  │ 移动 3 个项目到               │
  │                              │
  │ 📁 docs/                      │
  │ 📁 papers/   ← 当前选中 ✓     │
  │ 📁 archive/                   │
  │   📁 2024/                    │
  │                              │
  │ [ ] 覆盖同名                  │
  │                              │
  │ [取消]   [移动到这里]         │
  └──────────────────────────────┘
点确认 → POST /api/files/move { from_paths: [...], dest_dir: "papers", overwrite: false }
  ├─ 200 →
  │   moved: ["papers/a.md", "papers/b.md"]
  │   skipped: [{"from": "papers/c.md", "reason": "ALREADY_EXISTS"}]
  │   → invalidateDir(每个源父目录) + invalidateDir(dest_dir)
  │   → 若 skipped 非空 → toast "已移动 N 项，M 项因同名跳过"
  ├─ 4xx → toast 错误，dialog 不关
  └─ 成功后清空 selectedPaths，右栏回到占位
```

**约束**：
- 前端隐藏受保护目录（树选择器过滤点文件）
- 后端 `validate_move_target` 防自循环（每个 from 检查）
- 不允许跨设备移动（同 base 内不会触发）

### 6.3 删除文件夹（双重确认）

```
选中目录 → 点 [删除]
  ↓
delete-dialog 打开，状态机：
  ┌─ loading-stats ──────────────┐
  │  GET /api/files/stats?path=docs/old
  └────────┬─────────────────────┘
           ↓
  ┌─ confirming ───────────────────┐
  │ 删除 docs/old？                  │
  │                                 │
  │ ⚠️ 此操作不可恢复                │
  │ 将永久删除：                     │
  │   • 23 个文件                    │
  │   • 4 个子文件夹                 │
  │   • 总计 15.3 MB                 │
  │                                 │
  │ [ ] 我确定要永久删除              │
  │                                 │
  │ [取消]   [永久删除] (灰)         │
  └─────────────────────────────────┘
勾选 → [永久删除] 高亮
点击 → DELETE /api/files?path=docs/old
  ├─ 200 → invalidateDir(parent) + 清除以 path 为前缀的 cache key + close dialog
  └─ 4xx → toast 错误，dialog 不关

[删除单文件] 走同一 dialog，跳过 stats 调用，仅显示 "将永久删除 1 个文件"
[删除多选文件] 显示累计统计（前端聚合 stats）
```

### 6.4 新建目录

```
工具栏点 [新目录] → mkdir-dialog 打开
  ┌────────────────────────────┐
  │ 在 docs/ 下新建目录          │
  │ [输入名称___________]        │
  │   × 非法字符: / \ : * ? " < > │  (实时校验)
  │ [取消]   [新建]              │
  └────────────────────────────┘
点新建 → POST /api/files/mkdir { path: "docs/<name>" }
  ├─ 200 → invalidateDir("docs") + 自动展开 docs/
  ├─ 409 → 提示 "已存在"
  └─ 400 INVALID_NAME → 提示具体原因
```

### 6.5 重命名

```
选中 1 项 → 点 [重命名] → rename-dialog 预填原名
  ↓
输入新名 → 点确认
  ↓
POST /api/files/rename { path: "<dir>/old", new_name: "new" }
  ├─ 200 → invalidateDir(currentDir) + 更新右栏 detail
  └─ 409 → 提示 "已存在该名"
```

### 6.6 写后缓存失效规则

| 操作 | 失效范围 |
|------|---------|
| mkdir | 父目录 |
| delete | 父目录 + 整个被删子树（从 treeCache 清除所有以该路径为前缀的 key） |
| move | 每个 from 的父目录 + dest_dir |
| rename | 当前目录 |
| upload | dest_dir |

## 7. 安全模型与边界

### 7.1 各端点的安全检查矩阵

| 端点 | safe_resolve | assert_not_protected | assert_not_root | validate_name | writable | 其他 |
|------|:---:|:---:|:---:|:---:|:---:|------|
| `GET list` | ✓ | ✓（过滤） | — | — | — | — |
| `GET stats` | ✓ | ✓（拒绝） | — | — | — | — |
| `GET attrs` | ✓ | ✓（拒绝） | — | — | — | — |
| `POST mkdir` | ✓（父目录） | ✓（父+新名） | — | ✓ | ✓（父目录） | — |
| `DELETE` | ✓ | ✓ | ✓ | — | — | — |
| `POST move` | ✓（每个 from + dest） | ✓ | ✓（每个 from） | — | ✓（dest_dir） | `validate_move_target` 每个 from |
| `POST rename` | ✓ | ✓ | ✓ | ✓ | ✓（父目录） | — |
| `POST upload` | ✓（dest_dir） | ✓（dest_dir） | — | ✓（filename） | ✓（dest_dir） | 50 MB 上限 |

### 7.2 文件大小与路径上限

| 维度 | 上限 |
|------|------|
| 单文件上传 | 50 MB |
| 单次上传请求 | 50 MB（不允许聚合） |
| 文本预览/编辑 | 5 MB（沿用 preview） |
| list 条目数分页 | 默认 200，最大 500 |
| 单条路径长度 | 255 字符 |

### 7.3 浏览器兼容限制

- iOS Safari 不支持拖拽上传 → 移动端 drop-zone 禁用，仅走按钮路径
- 任何浏览器都不支持目录上传（`<input type=file>` 不加 `webkitdirectory`）
- 拖拽时检测 `DataTransferItem.isDirectory`，若为目录 → 警告 + 拒绝

## 8. 测试策略

### 8.1 后端测试（pytest）

**文件布局**：

```
tests/
├── web_v2/
│   ├── test_files_api.py          ⭐ 新增
│   ├── test_path_safety.py        ⭐ 新增
│   └── conftest.py                （加 files fixture）
└── ...
```

**`test_path_safety.py`**（纯单元，无网络）：

```
✓ safe_resolve 正常路径
✓ safe_resolution 拒绝 ".."
✓ safe_resolution 拒绝符号链接越权（boundary）
✓ is_protected 识别 .cortex/.git/.env/.DS_Store
✓ is_protected 不误判 "memo.draft.md"（点在中间不是开头）
✓ validate_name 通过正常名 / 拒绝空 / 拒绝点开头 / 拒绝非法字符 / 拒绝 Windows 保留名
✓ validate_move_target 拒绝自循环 + 子目录
✓ is_root 识别根
✓ MAX_PATH_LEN 触发 INVALID_PATH
```

**`test_files_api.py`**（FastAPI TestClient）：每个端点覆盖矩阵：

| 端点 | Happy | 404 | 403 PROTECTED | 400 INVALID | 409 EXISTS | 其他 |
|------|:---:|:---:|:---:|:---:|:---:|------|
| `GET list` | ✓ | ✓ | ✓（点文件隐藏） | — | — | 空目录返回 `entries: []` |
| `GET stats` | ✓ | ✓ | ✓ | — | — | 深层嵌套不卡 |
| `GET attrs` | ✓ | ✓ | ✓ | — | — | — |
| `POST mkdir` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `DELETE` | ✓（文件 + 递归目录） | ✓ | ✓ | ✓（根） | — | — |
| `POST move` | ✓（单 + 多） | ✓ | ✓ | ✓（自循环） | ✓ | `skipped` 数组结构正确 |
| `POST rename` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `POST upload` | ✓（新文件 + 覆盖） | — | ✓ | ✓（非法文件名） | ✓ | 50MB+1 字节触发 413 |

**关键场景**：
- 写后索引触发：mock `trigger_background_reindex`，断言被调用
- move 后两侧缓存失效（通过 list 重拉验证）
- 并发同名 mkdir：第二次请求返回 409
- Windows 保留名测试用 `@pytest.mark.skipif(sys.platform == "linux")` 标记（验证校验逻辑本身正确）

### 8.2 前端测试

**单元（Vitest，`frontend/tests/unit/`）**：

```
file-tree.test.ts       展开折叠、选中传递
file-row.test.ts        选中高亮、徽章渲染（indexed / writable）
file-list.test.ts       空态、工具栏禁用规则、多选交互（shift/ctrl）
delete-dialog.test.ts   状态机：loading-stats → confirming → deleting
move-dialog.test.ts     多选显示、目录树选择、覆盖开关
mkdir-dialog.test.ts    实时非法字符校验
rename-dialog.test.ts   预填、同名校验
drop-zone.test.ts       dragenter/dragleave/drop 事件、目录项拒绝
```

**E2E（Playwright，按 CLAUDE.md 用 playwright-cli skill）**：

```
files_explorer.spec.ts
  ├─ 桌面布局（viewport 1280x800）：三栏可见
  ├─ 移动布局（viewport 375x812）：单栏切换
  ├─ 完整流程：mkdir → 上传文件 → rename → move → delete（带双重确认）
  ├─ 受保护路径不显示（.cortex 不可见）
  ├─ 多选移动：ctrl+click 3 项 → move dialog 显示 "3 个项目"
  ├─ 上传同名未勾选覆盖 → toast 提示跳过
  └─ 拖拽上传到当前目录（仅桌面端 case）
```

### 8.3 测试工作目录

复用 CLAUDE.md 规定的 `test_work_dir/`；每个测试用例前清空 `.cortex/` 子目录 + 重建索引 fixture。

### 8.4 覆盖率目标

| 模块 | 目标 |
|------|------|
| `path_safety.py` | 100% lines |
| `api/files.py` | ≥ 90% lines |
| 前端 `api/files.ts` | 100% |
| 前端组件 | ≥ 80%（关键状态机全覆盖） |

## 9. 实施顺序建议

1. `path_safety.py` + `test_path_safety.py`（无依赖，可独立交付）
2. `models/files.py` + `api/files.py` + `test_files_api.py`
3. `state/types.ts` + `state/store.ts` 扩展 + `api/files.ts`
4. 顶层 `files-view.ts` + `activity-bar` / `tab-bar` `_items` 扩展
5. 三个核心栏组件：`file-tree` / `tree-node` / `file-list` / `file-row` / `file-detail`
6. 四个 dialog：`mkdir` / `rename` / `move` / `delete`
7. `drop-zone` 拖拽上传
8. Vitest 单元测试
9. Playwright E2E（用 playwright-cli skill）
10. `cortex/web_v2/frontend/` 下 `npm run build` 重新生成 static/

## 10. 风险与边界

| 风险 | 缓解 |
|------|------|
| 大目录（>500 文件）首次进入卡顿 | list 分页 + 默认 200 条；前端不做整树一次性加载 |
| Windows 文件锁（`docs/report.md` 被编辑器打开） | DELETE / MOVE 返回 `WRITE_FAILED`，前端 toast 提示"文件被占用" |
| 中文 / Emoji 文件名 | Pydantic 模型用 `str`；路径用 `pathlib`；客户端 `encodeURIComponent` |
| 并发同名 mkdir | 文件系统原子性 + try/except → 409 |
| 删除 `currentDir` 后中栏空白 | 失效后自动回退到根；若根也被删（不会发生），显示重置提示 |
| 拖拽时误把目录当文件上传 | 前端检查 `DataTransferItem.isDirectory` 拒绝；后端文件名校验兜底 |
| 索引滞后 | 写后 reindex 是异步；前端可选刷新（无显式按钮，依赖 `file-watcher` 事件触发 search 页同步） |

## 11. 不在本次范围

以下功能 YAGNI，明确不做：

- 复制 / 粘贴
- 拖拽移动（仅在 drop-zone 内上传，不做跨目录拖拽）
- 键盘快捷键
- 目录上传（所有浏览器）
- 分片上传 / 断点续传
- 文件内容搜索（已有 search tab 覆盖）
- 多窗口 / 标签页（单视图）
- 回收站 / 软删除
- 版本历史
- ACL / 权限管理 UI
- 跨 search_path 多根支持
