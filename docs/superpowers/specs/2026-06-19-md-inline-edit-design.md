# Cortex GUI · Markdown 预览原地编辑 Design Spec

**Date:** 2026-06-19
**Status:** Draft (awaiting user review)

---

## 1. Overview

Cortex Web UI（`cortex/web_v2`）的搜索结果点击后，`<preview-pane>` 对 `.md` 文件走 `<md-viewer>` 渲染（marked → HTML），但**只读**——用户发现需要修正错别字 / 补充说明时，必须切回外部编辑器，改完再回来重新搜索。

本特性在预览页内提供**原地编辑**能力：默认预览，header 加一个 `[编辑]` 按钮；点击后预览区切换为 textarea（带行号），用户改完点 `[保存]` 或按 `Ctrl/Cmd+S` 写回磁盘；成功后立即用新内容重新渲染预览。整个过程不离开 search view，**保存后同步触发该文件的增量重索引**，搜索结果自动反映新内容。

## 2. Goals

- 在不离开预览页的前提下，让用户编辑 `search_path` 下的任意可写文本文件（`.md` / `.txt` / `.py` / `.js` 等）
- 编辑体验与已有 markdown 预览一致（行号、字体、配色）
- 保存后**搜索结果同步更新**（同步触发增量重索引，UI 不需要等手动 reindex）
- 显式保存模型（按钮 + Ctrl/Cmd+S），不做自动保存
- 未保存修改在切换其他文件/搜索前**有明确提示**，避免误操作丢数据

## 3. Non-goals

- **不可编辑**：二进制合成预览（`.pdf` / `.docx` / `.xlsx` / `.xls` / `.xltx` / `.xltm` / `.csv`）—— 它们是从 FTS5 DB 合成出来的，不对应磁盘原始字节。`writable: false`，前端不显示 `[编辑]` 按钮。
- **不做**：markdown 语法高亮（CodeMirror / Monaco / highlight.js）—— 引入 ~100KB 依赖，对"快速小改"场景过度。
- **不做**：自动保存（autosave on blur）—— 与"显式保存"目标冲突。
- **不做**：乐观锁 / 409 冲突检测（外部进程同时改文件）—— 个人工具场景，last-write-wins。
- **不做**：撤销/重做（undo/redo）—— 浏览器原生 textarea 已有 undo，依赖系统能力即可。
- **不做**：协同编辑 / 多用户锁。
- **不做**：创建新文件（当前仅编辑已存在的可写文件）。
- **不做**：文件类型转换（`.md` ↔ `.txt`）。
- **不做**：编辑器内嵌图片 / 拖拽上传 / 粘贴富文本。
- **不做**：移动端专用键盘（用系统默认 textarea，移动端用户通常切到外部编辑器更顺手）。

## 4. Information Architecture

### 4.1 编辑态入口

`<preview-pane>` 的 header 在预览态下右侧多一个 `[编辑]` 按钮（仅当 `writable=true` 时显示）。点击后整个 body 区域从 `<md-viewer>` 切换为 `<md-editor>`。

```
┌──────────────────────────────────────────────────────────┐
│ 📄 notes.md                              [ ✏️ 编辑 ]       │  ← header (preview)
├──────────────────────────────────────────────────────────┤
│  # 标题                                                   │
│  正文渲染...                                                │  ← md-viewer
│  - 列表项                                                   │
└──────────────────────────────────────────────────────────┘

点击 [编辑] 后：

┌──────────────────────────────────────────────────────────┐
│ 📄 notes.md    [ ●未保存 ]   [ 💾 保存 ]  [ ✖️ 取消 ]        │  ← header (edit)
├────┬─────────────────────────────────────────────────────┤
│  1 │ # 标题                                                │
│  2 │                                                       │
│  3 │ 正文内容（用户改过的）                                   │
│  4 │                                                       │
│  5 │ - 列表项                                               │
│  6 │ - 另一个                                               │
└────┴─────────────────────────────────────────────────────┘
   ↑  行号栏（与现有非 md 预览一致，shadow DOM 内实现）
```

### 4.2 未保存指示

`●未保存` 红色圆点 + 文字**只在 textarea 内容相对 `originalContent` 不一致时显示**：

- 初次进入编辑态 → dirty=false，指示隐藏
- 用户敲键盘 → dirty=true，指示出现
- `[保存]` / `[取消]` / 外部强制 discard → dirty=false，指示隐藏

### 4.3 切换文件/搜索前的确认

`<search-view>` 维护一个 `previewDirty: bool` 状态（订阅 `<preview-pane>` 的 `dirty-change` 事件）。当 `previewDirty=true` 且发生以下任一操作，弹原生 `window.confirm`：

- 点击另一个搜索结果卡片
- 点击"新搜索"返回初始页
- 点击"重新搜索"提交新查询
- 切换到 chat / history / settings 视图

确认框文案：

```
当前文件有未保存的修改。
[取消]                                          [丢弃修改]
```

- 点"取消" → 留在当前编辑态
- 点"丢弃修改" → preview-pane 调用 `discard()` 强制重置为原内容、切回预览态、dirty=false；继续原操作

**注**：浏览器原生 `window.confirm` 在 PWA / iframe 场景可能被禁用，但本地运行的 web UI 没有这个限制；后续若需要更精致的 UI 再替换。

## 5. Component Design

### 5.1 `<md-editor>`（新组件）

**位置**：`cortex/web_v2/frontend/src/components/md-editor.ts`

**职责**：纯 UI 组件，只管 textarea + 行号布局 + 键盘事件 + 自身 dirty 状态。**不知道也不关心**父组件的 confirm 逻辑。

**属性（@property）**：

| 名称 | 类型 | 说明 |
|------|------|------|
| `path` | `string` | 当前文件路径（仅显示用） |
| `originalContent` | `string` | 初始内容，discard 时回退到此值 |

**状态（@state）**：

| 名称 | 类型 | 说明 |
|------|------|------|
| `_text` | `string` | textarea 当前内容（与 `originalContent` 比较得到 dirty） |
| `_saving` | `bool` | 保存中状态（按钮 disabled，显示"保存中..."） |
| `_error` | `string \| null` | 保存失败的错误信息（用于 header 内联显示） |

**事件**：

| 事件 | detail | 触发时机 |
|------|--------|---------|
| `dirty-change` | `{ dirty: boolean }` | dirty 状态变化时 |
| `save` | `{ content: string }` | 用户点 `[保存]` 或按 Ctrl/Cmd+S 时 emit（不含 API 调用结果——成功/失败由 preview-pane 处理并 toast） |
| `cancel` | `{}` | 用户点 `[取消]`（**且 dirty 时不弹 confirm**——上层已处理） |

**公共方法**：

| 方法 | 作用 |
|------|------|
| `discard()` | 强制重置 `_text = originalContent`，emit `cancel`。供父组件在 confirm "丢弃修改" 后调用。 |
| `setError(msg)` | 设置 `_error`，UI 显示在 header；下一次输入时自动清除 |

**键盘处理**：

- `Ctrl/Cmd + S`：阻止默认行为，emit `save`（仅当 dirty 且非 saving 时）
- `Escape`：emit `cancel`（仅当 dirty 时；非 dirty 时不响应，让父组件用浏览器的 ESC 自然行为）

**布局**：

- 容器：`display: flex; height: 100%`
- 左列：行号栏，宽度自适应（max ~50px），右对齐，等宽字体，灰色
- 右列：`<textarea>`，flex: 1，monospace 字体，自动换行 off（与现有非 md 预览一致）
- 行号通过同步滚动实现（监听 textarea `scroll` 事件，把 `scrollTop` 赋给行号容器）
- 行数 = `(_text.match(/\n/g) ?? []).length + 1`（最后一行无 `\n` 也算一行）

**与现有非 md 预览的区别**：

非 md 预览当前在 `preview-pane.ts:69-79` 用 `<div>` 渲染只读文本 + 行号（每行一个 div）。`md-editor` 的行号栏采用 textarea + 同步滚动的方案，因为需要可编辑。**视觉风格**与现有非 md 视图对齐（同样的等宽字体、同样的行宽、同样的 padding）。

### 5.2 `<preview-pane>`（修改）

**位置**：`cortex/web_v2/frontend/src/components/preview-pane.ts`

**新增属性**：

| 名称 | 类型 | 说明 |
|------|------|------|
| `writable` | `boolean` | 文件是否可写。`false` 时不显示 `[编辑]` 按钮（默认） |

**新增状态（@state）**：

| 名称 | 类型 | 说明 |
|------|------|------|
| `_mode` | `'preview' \| 'edit'` | 当前模式，默认 `'preview'` |
| `_content` | `string` | 当前显示/编辑的内容（与外部 `content` prop 解耦，允许本地变更） |

**新增事件**：

| 事件 | detail | 触发时机 |
|------|--------|---------|
| `dirty-change` | `{ dirty: boolean }` | 透传 `<md-editor>` 的 dirty-change |

**生命周期**：

```ts
willUpdate(changed: Map<string, unknown>) {
  if (changed.has('content')) {
    // 外部 content 变化（用户点了其他搜索结果 / 重新搜索）→ 强制回到 preview 模式
    this._content = this.content;
    this._mode = 'preview';
  }
}
```

**render 逻辑**：

```
if (this.language === 'markdown') {
  if (this._mode === 'edit') {
    return html`
      <div class="header">
        ${this.path}
        <md-editor
          .originalContent=${this._content}
          @save=${this._onEditorSave}
          @cancel=${this._onEditorCancel}
          @dirty-change=${this._onEditorDirty}
        ></md-editor>
      </div>
    `;
  }
  return html`
    <div class="header">
      ${this.path}
      ${this.writable ? html`<button @click=${this._enterEdit}>✏️ 编辑</button>` : null}
    </div>
    <md-viewer .content=${this._content} .line=${this.line} .keyword=${this.keyword}></md-viewer>
  `;
}
// 非 md: 现有逻辑不变（不开放编辑，避免越界；如未来需要可扩展）
```

**事件处理**：

- `_enterEdit`：`_mode = 'edit'`
- `_onEditorSave(e)`：调用 `previewApi.save(path, e.detail.content)`，on success 写入 `_content` + 切回 preview + toast 成功；on failure 调 `editor.setError(msg)` 留在 edit 态
- `_onEditorCancel(e)`：`_mode = 'preview'`（`_content` 不变，textarea 已自行 reset）
- `_onEditorDirty(e)`：透传 emit `dirty-change` 给 search-view

### 5.3 `<search-view>`（修改）

**位置**：`cortex/web_v2/frontend/src/views/search-view.ts`

**新增状态**：

```ts
@state() private previewDirty = false;
```

**新增事件处理**：

```ts
private _onPreviewDirty(e: CustomEvent<{dirty: boolean}>) {
  this.previewDirty = e.detail.dirty;
}
```

**修改 `_onResultSelect`**：在调用 `_onResultSelect` 处理新结果前，若 `previewDirty` 则弹 confirm：

```ts
private async _safeAction(action: () => Promise<void> | void) {
  if (this.previewDirty) {
    if (!window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？")) return;
    this.shadowRoot?.querySelector('preview-pane')?.discard();
  }
  await action();
}
```

把以下入口都用 `_safeAction` 包一层：
- `_onResultSelect`（点击其他结果卡片）
- `_backToInitial`（"新搜索"按钮）
- `_onClearHistory`（清空历史）
- `_submit`（重新搜索 / 提交新查询）

**跨视图切换的 dirty 拦截（v1 不实现）**：

用户从 search 切到 chat / settings 等其他视图时，浏览器原生 `beforeunload` 只对"关页面"生效；切视图不触发。v1 **接受**：编辑态切到其他视图会丢失未保存内容，依赖 §4.2 的 `●未保存` 视觉提示。

如未来需要：`<preview-pane>.discard()` 方法已就位，可在 `cortex-app._navigate` 加一个 navigation gate（一行调用），无需改组件接口。

## 6. API Design

### 6.1 `GET /api/preview`（修改）

`cortex/web_v2/api/preview.py`

**响应新增字段**：

```python
class PreviewResponse(BaseModel):
    path: str
    language: str = "text"
    content: str
    line_range: Optional[tuple[int, int]] = None
    highlights: list[int] = []
    writable: bool = False  # 新增
```

**writable 计算逻辑**：

```python
def _compute_writable(full: Path) -> bool:
    if not full.exists() or not full.is_file():
        return False
    if full.suffix.lower() in BINARY_PREVIEW_EXTS:
        return False
    # 排除 .cortex 目录
    try:
        full.relative_to(Path(idx.search_path) / ".cortex")
        return False  # 在 .cortex 内部，不让用户改索引
    except ValueError:
        pass
    return os.access(full, os.W_OK)
```

> 注：当前 `BINARY_PREVIEW_EXTS` 在文件顶部定义；`os.W_OK` 是 POSIX / Windows 都有的标准接口。

### 6.2 `PUT /api/preview`（新）

**位置**：`cortex/web_v2/api/preview.py`（同文件追加）

**请求**：

```
PUT /api/preview?path=<relative_path>
Content-Type: application/json

{
  "content": "..."
}
```

**请求模型**：

```python
class PreviewSaveRequest(BaseModel):
    content: str
```

**响应**：

```python
class PreviewSaveResponse(BaseModel):
    path: str
    content: str  # 回显，便于前端同步
    bytes_written: int
    reindex_triggered: bool
```

**错误码**：

| HTTP | code | 场景 |
|------|------|------|
| 400 | `BAD_PATH` | 路径非法（含 `..` 或越界 search_path） |
| 403 | `NOT_WRITABLE` | 文件不可写（在 BINARY_PREVIEW_EXTS / .cortex 内 / 权限不足） |
| 404 | `FILE_NOT_FOUND` | 文件不存在 |
| 413 | `CONTENT_TOO_LARGE` | content 超过 5MB（防御性，避免 OOM） |
| 500 | `WRITE_FAILED` | `OSError` / `PermissionError` / 磁盘满等 |

**实现**：

```python
@router.put("/preview", response_model=PreviewSaveResponse)
async def save_preview(
    path: str = Query(..., description="相对路径"),
    body: PreviewSaveRequest = Body(...),
    idx: IndexManager = Depends(get_index_manager),
):
    base = Path(idx.search_path)
    full = _safe_resolve(base, path)

    # 与 GET 同样的可写性检查
    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {path}")
    if full.suffix.lower() in BINARY_PREVIEW_EXTS:
        raise CortexAPIError(403, "NOT_WRITABLE", f"该文件类型不可编辑: {path}")
    if not os.access(full, os.W_OK):
        raise CortexAPIError(403, "NOT_WRITABLE", f"文件只读或无写权限: {path}")

    if len(body.content.encode("utf-8")) > 5 * 1024 * 1024:
        raise CortexAPIError(413, "CONTENT_TOO_LARGE", "content 超过 5MB 上限")

    try:
        full.write_text(body.content, encoding="utf-8")
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"写入失败: {e}") from e

    # 同步触发增量重索引（在后台线程跑，不阻塞响应）
    try:
        idx.trigger_background_reindex()
    except Exception as e:
        # 索引失败不阻断保存成功——内容已落盘；记录 warning
        logger.warning("Save reindex failed: %s", e)

    return PreviewSaveResponse(
        path=path,
        content=body.content,
        bytes_written=len(body.content.encode("utf-8")),
        reindex_triggered=True,
    )
```

**`_safe_resolve` 复用**：与 GET 共享同一个函数，保证 `..` 越权检查一致。

**`_compute_writable` 提取**：把可写性判断从 GET 路径抽出，GET 和 PUT 共享（避免"GET 显示可写但 PUT 失败"的不一致）。

### 6.3 前端 API client

**新增** `cortex/web_v2/frontend/src/api/preview.ts`：

```ts
export interface PreviewSaveResponse {
  path: string;
  content: string;
  bytes_written: number;
  reindex_triggered: boolean;
}

export async function savePreview(path: string, content: string): Promise<PreviewSaveResponse> {
  const res = await fetch(`/api/preview?path=${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ code: "UNKNOWN", detail: res.statusText }));
    throw new PreviewSaveError(err.code, err.detail ?? "保存失败", res.status);
  }
  return res.json();
}

export class PreviewSaveError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}
```

> 注：当前 `cortex/web_v2/frontend/src/api/` 下没有 `preview.ts`（搜索预览直接用 `fetch` 在 `search-view.ts:200`），为遵循前端惯例，**新建** `api/preview.ts` 作为 preview 相关的 client 入口，未来 GET 也可迁过来。

## 7. Save Model

### 7.1 时机

| 触发 | 是否保存 |
|------|---------|
| 点 `[保存]` 按钮 | ✅（仅 dirty 且非 saving） |
| Ctrl/Cmd + S | ✅（同上） |
| 失焦（blur） | ❌（不做自动保存） |
| 点 `[取消]` | ❌（丢弃改动） |
| 关闭浏览器 / 切视图 | ❌（依赖浏览器 `beforeunload` + ●未保存 视觉提示） |

### 7.2 Toast 反馈

- **成功**：右下角 toast "已保存"（2.5s 自动消失）
- **失败**：右下角 toast "保存失败：<code> <detail>"（红色，5s 不自动消失，需手动关闭）

**v1 实现**：`<toast-stack>` 组件固定定位在 `<search-view>` 内部，仅 search-view 使用（v1 唯一会触发 toast 的视图）。`search-view` 维护 `_toasts: Toast[]` 状态，`pushToast(message, level, durationMs)` 添加，`requestUpdate()` 触发 Lit 重渲染。**不引入** 全局 EventBus / 全局 toast-stack，理由：v1 范围内只有 search view 需要 toast，过早抽象徒增复杂度。后续如其他视图也需 toast，再升级为 cortex-app 顶层组件。

### 7.3 索引同步

PUT 端点在写盘成功后、构造响应前调用 `idx.trigger_background_reindex()`。该方法**立即返回**（内部启动后台线程，不等待索引完成），HTTP 响应不被索引阻塞。

**当前 search session 的 results 不会自动刷新**。理由：
- 索引完成时机不可预测（取决于文件 hash 比对 + 索引器速度）
- 当前预览卡片的新内容已通过"保存后重新渲染预览"让用户立即看到
- 重新搜索即可看到全量更新（`trigger_background_reindex` 内部有 `_reindex_lock` + `_needs_reload`，下次 search 时 `load_or_build_index` 会从磁盘 reload）

如未来需要实时刷新：可订阅 `EventBus` 的 `indexing` 事件（`event_type: indexing`），complete 时由 `index_manager.trigger_background_reindex` 的 `on_complete` 回调派发 `search-refresh` 事件给 search-view。**v1 不做**。

## 8. Error Handling

| 场景 | 后端 | 前端 |
|------|------|------|
| 文件不存在 | 404 `FILE_NOT_FOUND` | toast 错误，切回 preview 态，保留原 content |
| 二进制类型 | 403 `NOT_WRITABLE` | toast 错误（理论上不会发生——GET 时已禁用按钮） |
| 文件只读 | 403 `NOT_WRITABLE` | toast 错误，留在 edit 态让用户复制内容到外部 |
| content 超 5MB | 413 `CONTENT_TOO_LARGE` | toast 错误，留在 edit 态 |
| 写盘失败（磁盘满 / IO error） | 500 `WRITE_FAILED` | toast 错误，留在 edit 态 |
| 索引失败（warning 级别） | — | 仍然 toast "已保存"（内容已落盘），索引失败由 background logger 记录 |
| 网络中断 | — | fetch 抛 TypeError，preview-pane 捕获后调 `editor.setError("网络错误")` |
| 旧版浏览器不支持 fetch PUT | — | 不做兜底（v1 不支持 IE / 远古浏览器） |

## 9. File Changes

| 文件 | 类型 | 说明 |
|------|------|------|
| `cortex/web_v2/models/preview.py` | 修改 | `PreviewResponse` 加 `writable`；新增 `PreviewSaveRequest` / `PreviewSaveResponse` |
| `cortex/web_v2/api/preview.py` | 修改 | GET 加 writable 计算；新增 PUT endpoint；提取 `_compute_writable` |
| `cortex/web_v2/app.py` | 不变 | PUT 走同一个 router，FastAPI 自动按 method 路由 |
| `cortex/web_v2/frontend/src/api/preview.ts` | 新建 | `savePreview()` + `PreviewSaveError` |
| `cortex/web_v2/frontend/src/components/md-editor.ts` | 新建 | textarea + 行号 + dirty 状态 + 键盘 |
| `cortex/web_v2/frontend/src/components/preview-pane.ts` | 修改 | `writable` prop；`_mode` / `_content` 状态；`<md-editor>` 嵌入 |
| `cortex/web_v2/frontend/src/components/toast-stack.ts` | 新建 | 右下角 toast 容器（search-view 内） |
| `cortex/web_v2/frontend/src/views/search-view.ts` | 修改 | `previewDirty` 状态；`_safeAction` 包装切换；接 preview-pane 事件 |
| `cortex/web_v2/frontend/src/styles/*.css` | 新增 token | 编辑模式样式（行号栏颜色、按钮颜色、`●未保存` 红点） |

> 注：纯前端样式 token 的细节在实现时由前端决定，spec 只约束行为。

## 10. Testing Strategy

### 10.1 后端（pytest）

`tests/web_v2/test_preview_save.py`（新文件）：

- `test_put_text_file_succeeds` — 创建 .md 文件，PUT 修改，断言写盘 + 响应正确
- `test_put_rejects_binary_extension` — 创建 .pdf/.docx 文件，PUT 期望 403 `NOT_WRITABLE`
- `test_put_rejects_path_traversal` — path 含 `..`，期望 400 `BAD_PATH`
- `test_put_rejects_nonexistent_file` — path 指向不存在文件，期望 404
- `test_put_rejects_readonly_file` — `os.chmod(0o444)`，期望 403
- `test_put_rejects_oversized_content` — 6MB content，期望 413
- `test_get_returns_writable_for_text_file` — 普通 .md，断言 `writable: true`
- `test_get_returns_writable_false_for_binary` — 创建 .docx，断言 `writable: false`
- `test_get_returns_writable_false_for_cortex_dir` — 在 .cortex/ 内创建 .env，断言 `writable: false`

### 10.2 前端单元测试（vitest）

`cortex/web_v2/frontend/tests/components/md-editor.spec.ts`（新）：

- 渲染：textarea + 行号栏，行数等于 text 行数
- 修改 textarea → emit `dirty-change` (true)
- 点 `[保存]`（dirty=true）→ emit `save` with content
- Ctrl+S → emit `save`
- 点 `[取消]`（dirty=true）→ emit `cancel`，textarea 重置为 `originalContent`
- `discard()` 调用 → textarea 重置 + emit `cancel`
- `setError(msg)` → header 显示 msg

`cortex/web_v2/frontend/tests/components/preview-pane.spec.ts`（新/扩）：

- `writable=true` → 显示 `[编辑]` 按钮
- `writable=false` → 不显示
- 点击 `[编辑]` → 切换到 `<md-editor>`
- 接 `save` 事件 + API 成功 → `_content` 更新 + 切回 preview + 触发 GET re-render

### 10.3 E2E（Playwright）

`cortex/web_v2/frontend/tests/e2e/edit-flow.spec.ts`（新）：

- 搜索 → 点击 .md 卡片 → preview 显示 → 点击 [编辑] → 修改 → 点 [保存] → toast "已保存" → preview 渲染新内容
- 编辑态下点击另一个结果 → 弹 confirm → 取消 → 留在当前编辑态
- 编辑态下点击另一个结果 → 弹 confirm → 丢弃 → 切换到新结果，编辑内容消失
- 移动端（detail-overlay）：同上 [编辑] / [保存] 流程

## 11. Acceptance Criteria

1. 搜索结果点击 .md 文件，preview header 右侧有 `[编辑]` 按钮
2. 点击 `[编辑]` 后，预览区切换为带行号的 textarea，header 出现 `[保存]` `[取消]` 按钮
3. textarea 内修改任意字符 → header 出现 `●未保存` 指示 + 透传 `dirty-change` 给 search-view
4. 按 `Ctrl+S`（Mac `Cmd+S`）触发保存
5. 保存成功后：toast "已保存"、textarea 消失、preview 重新渲染新内容
6. 保存失败：toast 红色错误条 + 留在编辑态 + 编辑器 header 显示 `setError` 错误
7. 二进制合成预览（PDF/Word/Excel）不显示 `[编辑]` 按钮
8. `.cortex/.env` 等内部文件 `writable=false`，不显示 `[编辑]` 按钮
9. 编辑态下点击其他搜索结果卡片 → 弹原生 confirm → 取消则停留，丢弃则切换
10. 编辑态下点击 "新搜索" / 提交新查询 → 同样弹 confirm
11. 保存后磁盘文件实际包含新内容（用 `read_text` 验证）
12. 保存后重新执行 search API 能在结果中看到新内容（说明 reindex 触发成功）
13. 所有现有 19 个 web_v2 测试 + 现有前端测试继续通过
14. 非 md 文本文件（.py / .txt）的编辑流程与 .md 一致（共享 `writable` 判断）
15. 移动端 detail-overlay 内的 [编辑] / [保存] 流程正常工作

## 12. Open Questions / Risks

- **R1：编辑器跨视图切换的 dirty 拦截**：v1 不实现，依赖浏览器 `beforeunload` + 视觉提醒。代价：用户在 search view 编辑中点 chat tab 会丢数据。**缓解**：header 内的 `●未保存` 是最直观提示；后续若用户反馈多，再补 navigation gate。

- **R2：重索引性能**：`trigger_background_reindex` 是**全目录**增量扫描（基于 hash，未变文件秒过）。对小型项目（<1k 文件）基本瞬时；大型项目（>10k 文件）有 1-3s 延迟。前端不在等待——HTTP 响应立即返回（reindex 是后台线程）。**风险**：用户保存后立即在 search box 重新搜索，可能命中旧索引。**缓解**：保存 API 的 `reindex_triggered=true` 已透传，前端在 toast 中可以加 "正在重建索引..." 的 hint 文案。v1 不做更精细的处理。

- **R3：行号栏滚动同步精度**：textarea 与行号栏分别有自己的滚动源，需通过 `scroll` 事件同步。当 textarea 高度变化（用户拖大/拖小）时，行号栏高度要跟随。spec 要求基本同步即可，edge case（IME 合成中文时光标位置异常）不在范围内。

- **R4：`os.access` 在 Windows 上的行为差异**：Windows 上 `os.W_OK` 实际检查 ACL，可能对继承的 deny ACE 返回 False。**缓解**：在 Windows 上若 `os.access` 返回 True 但实际 write 失败，OSError 会被 500 捕获；toast 会显示。v1 接受这种"在 Windows 上偶发更严格的写权限判断"。

- **R5：与 file_watcher 的竞态**：保存 API 写盘 → 触发 `trigger_background_reindex`（自己跑增量）；同时 file_watcher 的 watchdog 检测到 `on_modified` → 触发 FileWatcher 自己的 5s 防抖 reindex。**可能双跑**。**缓解**：两次 reindex 都用 `trigger_background_reindex`，内部有 `_reindex_lock` 互斥，后跑的会等前一个完成。`FTS5Index` 自身对同一文件的并发写入用 SQLite 锁，第二次写入会等待。**风险**：长时间运行下偶发"双跑"日志噪音；v1 接受。

- **R6：搜索结果中的卡片不自动刷新**：见 §7.3。已知 trade-off，v1 不处理。

- **R7：编辑 .env / .git 等配置文件**：配置文件可写（`writable=true`），用户可改。若改坏，搜索可能异常。**缓解**：v1 不做限制；如未来需要可加"敏感路径列表"。

## 13. Implementation Plan Pointer

下一步：调用 `superpowers:writing-plans` skill 生成分阶段实现计划（建议顺序：后端 PUT endpoint + writable 提取 → 前端 md-editor 组件 → preview-pane 集成 → search-view dirty 状态 + confirm 弹窗 → 测试）。
