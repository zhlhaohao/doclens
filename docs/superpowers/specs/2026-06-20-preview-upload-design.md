# Preview Upload Feature — Design Spec

**Date:** 2026-06-20
**Topic:** 预览面板新增"上传覆盖原文件"功能（下载流程的逆操作）
**Status:** Approved (pending user spec review)

## 1. 背景与动机

下载端（`GET /api/preview/download`，2026-06-20 完成）已能产出格式为
`{stem}_{sha256(rel_path)[:6]}{suffix}` 的附件文件名。用户在外部编辑器修改后，
希望能把同名文件上传回 Cortex，由后端反查 hash → 相对路径，覆盖原文件，
并自动重索引。

## 2. 需求总结（用户决策）

| 维度 | 决策 |
|------|------|
| 入口 | 预览面板工具栏新增独立 `⬆️ 上传` 按钮（与 `⬇️ 下载` 并列） |
| 无 hash 匹配 | 严格模式，返回错误（不创建新文件、不询问路径） |
| 覆盖确认 | 前端在确认对话框中显示文件名，用户确认后才发起上传 |
| 文件类型 | 不限制（与下载端能力对称，支持 `.md`/`.py`/`.pdf`/`.docx` 等） |
| 大小上限 | 50 MB |
| 重索引 | 上传成功后调用 `idx.trigger_background_reindex()`（与 PUT /api/preview 一致） |
| hash → path 解析 | 方案 A：每次上传遍历 `IndexManager.documents`，按 stem+hash6 双因素匹配 |

## 3. 架构与数据流

```
用户点 [⬆️ 上传]
    ↓
浏览器原生 <input type="file"> 弹出选择器
    ↓
前端拿到 File 对象
    ↓
window.confirm("即将上传 '<filename>' 覆盖原文件，是否继续？")
  ├─ 取消 → 中止
  └─ 确认 ↓
POST /api/preview/upload  (multipart/form-data, 字段名 file)
    ↓
后端处理：
  1. 解析上传文件名 → {stem, hash6, suffix}
     - 不匹配正则 → 400 BAD_FILENAME
  2. 遍历 IndexManager.documents：
     - 对每条 source_path 归一化为相对路径后计算 sha256[:6]
     - 按 (stem, hash6) 双因素精确匹配
     - 无匹配 → 404 NOT_INDEXED
     - 多个匹配 → 409 HASH_COLLISION
  3. 唯一匹配 → 拿到相对路径
     - _safe_resolve(search_path, rel) 校验越权
     - 拒绝 .cortex/ 子目录
  4. 写字节到目标路径（覆盖）
  5. idx.trigger_background_reindex()
  6. 返回 {path, bytes_written, reindex_triggered}
    ↓
前端响应：
  - 成功 → 派发 "upload-success" 事件 → search-view 刷新当前预览
  - 失败 → 派发 "upload-failed" 事件 → search-view toast 显示中文错误
```

## 4. 后端组件

### 4.1 路由：`POST /api/preview/upload`

位置：`cortex/web_v2/api/preview.py`

签名：

```python
@router.post("/preview/upload", response_model=PreviewUploadResponse)
async def upload(
    file: UploadFile = File(...),
    idx: IndexManager = Depends(get_index_manager),
) -> PreviewUploadResponse:
    ...
```

### 4.2 文件名解析

正则：`^(?P<stem>.+)_(?P<hash>[a-f0-9]{6})(?P<suffix>\.[^./\\]+)$`

- `stem`：贪婪匹配到倒数第二段下划线之后
- `hash`：6 位十六进制小写
- `suffix`：以 `.` 开头，不含 `/` `\` `.`（防 `.tar.gz` 这种复合后缀造成歧义；按最后一个 `.` 切分）

不匹配 → `CortexAPIError(400, "BAD_FILENAME", "文件名不符合 {stem}_{hash6}{suffix} 格式")`

### 4.3 反向匹配函数

```python
def _resolve_upload_target(
    idx: IndexManager,
    stem: str,
    hash6: str,
) -> Optional[str]:
    """遍历索引文档，按 (stem, hash6) 双因素匹配，返回相对路径。

    - source_path 可能是绝对路径也可能是相对路径（历史索引兼容），
      统一归一化为相对 search_path 的 POSIX 路径再计算 hash
    - 命中多个 → 抛 HashCollisionError（由路由层捕获转 409）
    - 无命中 → 返回 None
    """
```

实现要点：
- 使用 `idx.documents` 拿到文档列表，每条 `doc.source_path`
- 归一化：`rel = os.path.relpath(source_path, idx.search_path)` 然后 `rel.replace(os.sep, "/")`
- 双重 hash 校验：`hashlib.sha256(rel.encode("utf-8")).hexdigest()[:6] == hash6`
- stem 校验：`Path(rel).stem == stem`
- 命中 0 → None；命中 1 → rel；命中 ≥2 → raise

### 4.4 越权与可写性检查

```python
full = _safe_resolve(base, rel)
# 显式拒绝 .cortex/ 子目录（_safe_resolve 不拦）
try:
    full.relative_to(base / ".cortex")
    raise CortexAPIError(403, "NOT_WRITABLE", "禁止覆盖索引元数据")
except ValueError:
    pass
```

> 注：这里**不**调用 `_compute_writable()` —— 那个函数对二进制后缀（`.pdf`/`.docx`）
> 返回 False，与"上传不限制类型"的决策冲突。只做路径越权和 `.cortex/` 防护即可。

### 4.5 写盘 + 重索引

```python
# 大小检查（UploadFile.stream 流式读取前 50MB+1 字节）
_MAX_UPLOAD_BYTES = 50 * 1024 * 1024
data = await file.read(_MAX_UPLOAD_BYTES + 1)
if len(data) > _MAX_UPLOAD_BYTES:
    raise CortexAPIError(413, "CONTENT_TOO_LARGE", f"文件超过 50MB 上限")
try:
    full.write_bytes(data)
except OSError as e:
    raise CortexAPIError(500, "WRITE_FAILED", f"写入失败: {e}") from e

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

### 4.6 模型（`cortex/web_v2/models/preview.py`）

新增 `PreviewUploadResponse`：

```python
class PreviewUploadResponse(BaseModel):
    path: str
    bytes_written: int
    reindex_triggered: bool
```

### 4.7 错误码汇总

| HTTP | code | 触发条件 |
|------|------|---------|
| 400 | `BAD_FILENAME` | 文件名不符合 `{stem}_{hash6}{suffix}` 正则 |
| 403 | `NOT_WRITABLE` | 解析出的相对路径落入 `.cortex/` |
| 404 | `NOT_INDEXED` | hash+stem 在索引中找不到 |
| 404 | `FILE_NOT_FOUND` | `_safe_resolve` 拒绝越权路径（防御性） |
| 409 | `HASH_COLLISION` | 多个索引文件命中同一 (stem, hash6) |
| 413 | `CONTENT_TOO_LARGE` | 超过 50 MB |
| 500 | `WRITE_FAILED` | 写盘 OSError |

## 5. 前端组件

### 5.1 `preview-pane.ts`（修改）

新增元素：
- `<button class="upload-btn">⬆️ 上传</button>`，三种 header 分支都加
- 一个隐藏的 `<input type="file">`（无 `accept` 限制），挂在 shadowRoot

事件流：
- 点击 `.upload-btn` → `input.click()`
- `input.change` → 拿到 `file = input.files?.[0]`，重置 `input.value = ""`（允许重复选同一文件）
- `window.confirm(\`即将上传 '${file.name}' 覆盖原文件，是否继续？\`)` → false 则中止
- 调用 `uploadPreview(file)`
- 成功 → `this.dispatchEvent(new CustomEvent("upload-success", { detail: { path } }))`
- 失败 → `this.dispatchEvent(new CustomEvent("upload-failed", { detail: { message } }))`

样式：`.upload-btn` 与 `.download-btn`、`.edit-btn` 共用同一组样式规则（已在 download 任务中合并）。

`noHeader=true`（移动端 focus 视图）时不渲染，与现有下载按钮一致。

### 5.2 `api/preview.ts`（扩展）

```typescript
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
    const err = await res.json().catch(() => ({ code: "UNKNOWN", detail: res.statusText }));
    throw new PreviewUploadError(
      err.code ?? "UNKNOWN",
      err.detail ?? "上传失败",
      res.status,
    );
  }
  return res.json();
}
```

### 5.3 `views/search-view.ts`（修改）

在两处 `<preview-pane>`（桌面 split 视图和移动 focus 视图）上挂监听：

```typescript
@upload-success=${this._onPreviewUploadSuccess}
@upload-failed=${this._onPreviewUploadFailed}
```

新增方法（与现有 saved / save-failed 并列）：

```typescript
private _onPreviewUploadSuccess = (e: CustomEvent<{ path: string }>) => {
  this._pushToast(`已覆盖：${e.detail.path}`, "success", 2500);
  // 上传是外部覆盖（不是 md-editor 原地编辑），必须重新拉取预览内容
  this._reloadPreview();
};

private _onPreviewUploadFailed = (e: CustomEvent<{ message: string }>) => {
  this._pushToast(`上传失败：${e.detail.message}`, "error", 5000);
};
```

说明：
- 现有 `_onPreviewSaved` 只清 dirty + toast，**不**重拉预览（因为 PUT 响应已含新内容，
  且 md-editor 已本地更新）。上传场景不同 —— 文件被外部覆盖，必须重新 GET /api/preview。
- `_reloadPreview()` 是新增辅助方法：基于 `this.previewPath` 重新调用现有的预览加载
  流程（与 `_loadPreview` 或 search-view 中 `_selectPreview` 同一逻辑路径；具体复用
  或抽公共方法由实现阶段看代码结构决定，但**必须重新发起 GET**）。
- toast 文案用"已覆盖：xxx"明确区分于普通保存。
- `_pushToast` 已存在（search-view.ts:362），直接复用。

## 6. 边界情况与防护

| 情况 | 处理 |
|------|------|
| 文件名不含 hash（如用户手动重命名） | 400 BAD_FILENAME |
| hash 匹配但 stem 不一致 | 404 NOT_INDEXED（双因素匹配） |
| 多个文件命中 | 409 HASH_COLLISION |
| 索引里的 source_path 是绝对路径 | `_resolve_upload_target` 内归一化为相对路径后算 hash |
| 目标文件已被删除但索引未刷新 | 404 NOT_INDEXED；下次 reindex 后会自愈 |
| 用户上传到 `.cortex/` 子目录 | 403 NOT_WRITABLE |
| 超过 50 MB | 413 CONTENT_TOO_LARGE |
| 网络中断 / 写盘失败 | 500 WRITE_FAILED |
| 用户重复选同一文件 | input.value 重置后可再次触发 change |
| 上传中再次选别的文件 | 最后一次 change 为准（input 单选） |

## 7. 安全考量

- **路径越权**：`_safe_resolve` + 显式 `.cortex/` 拦截，双重防护
- **任意文件覆盖**：hash+stem 双因素匹配，攻击者必须知道目标相对路径的 sha256[:6]
  且 stem 完全一致才能覆盖；非索引文件无法覆盖
- **DoS（超大文件）**：50 MB 硬上限，读取时只读 `MAX+1` 字节即可判定
- **文件类型**：不限制；hash+stem 匹配保证只能覆盖索引中已存在的文件

## 8. 测试策略

### 8.1 后端 `tests/web_v2/test_preview_upload.py`

需新增 fixture：构造一个含多个文件的临时索引（复用 `temp_workdir` + 索引建好）。

1. **正常上传覆盖 markdown**：上传 `doc1_<hash>.md` → 200，磁盘内容被替换
2. **正常上传覆盖二进制（.pdf）**：上传 `sample_<hash>.pdf` → 200，字节完全一致
3. **文件名无 hash**（如 `plain.md`）→ 400 BAD_FILENAME
4. **hash+stem 不匹配**（构造 stem 相同但 hash 错的文件名）→ 404 NOT_INDEXED
5. **hash+stem 命中多个**（手工往 DB 插两条同 rel_path hash 的文档）→ 409 HASH_COLLISION
6. **路径越权**（mock `_resolve_upload_target` 返回 `../etc/passwd`）→ 404 FILE_NOT_FOUND
7. **目标在 `.cortex/` 下**（mock 返回 `.cortex/index.db`）→ 403 NOT_WRITABLE
8. **超过 50 MB**（用小 threshold monkeypatch 测，避免真造 50 MB）→ 413
9. **reindex 被触发**（mock `trigger_background_reindex`）→ 验证调用
10. **source_path 为绝对路径的兼容**：构造一条 abs path 文档，验证仍能匹配

### 8.2 前端 `cortex/web_v2/frontend/tests/preview-pane.spec.ts`

1. 三种 header（markdown preview / markdown edit / plain text）都渲染 `.upload-btn`
2. `noHeader=true` 时不渲染 `.upload-btn`
3. 点击 `.upload-btn` 触发 `<input type=file>` 的 click
4. `input.change` + confirm OK → 调用 `uploadPreview`（mock fetch）→ 成功派发 `upload-success`
5. confirm 取消 → 不调用 `uploadPreview`，不派发事件
6. 上传失败 → 派发 `upload-failed` 并带 message

## 9. 不在本次范围内（YAGNI）

- 多文件批量上传（单文件足够）
- 上传进度条（50 MB 以内通常瞬间完成）
- 拖拽上传（已有独立按钮足够）
- 上传创建新文件（严格模式，hash 必须匹配）
- `hash → source_path` 缓存或持久化派生表（方案 A 足够快）
- 上传到非 Cortex 索引的外部目录

## 10. 实施顺序（建议）

1. 后端模型 + 路由 + 反向匹配函数（带单测）
2. 前端 API client + preview-pane 按钮 + 测试
3. search-view 事件接线 + 端到端验证
4. `npm run build` 更新 `static/`
5. 浏览器手工冒烟（下载→外部修改→上传→预览刷新）
