# Web v2 强制重建索引对话框设计

## 目标

在 App Bar 下拉菜单增加「强制重建索引」入口，点击后弹出的对话框显示重建进度；移动端适配。用户可主动触发全量索引重建并实时观察进度，弥补现有「仅文件写操作后增量 reindex、无手动全量入口」的缺口。

## 背景

- 后端 `IndexManager.reindex(force=True)` 是**同步全量**重建（阻塞，Web 不可直接调用）。
- `trigger_background_reindex()` 是**异步**后台 reindex，但**仅增量、不支持 force**；其进度经进程内 `EventBus` 发布，Web 前端订阅不了。
- 前端已有成熟的 dialog 模式（原生 `<dialog open>` + 内容组件 + `submit/cancel` event，移动端已适配），chat 已有 SSE 基建（`sse_starlette.EventSourceResponse` + 后台线程 + queue + 前端 `streamSSE`）。
- App Bar 下拉菜单（`user-menu`）已有「全局配置」等菜单项，可新增项。

## 方案

扩展 `trigger_background_reindex(force, on_progress)` 支持 force 全量 + 进度回调；新增 `POST /api/reindex` SSE 端点，复用 chat 的「后台线程 + queue + SSE」范式把进度流式推给前端；前端新增 `reindex-dialog` 组件（确认/进行/完成/错误 4 阶段），用 `streamSSE` 读取进度，App Bar 菜单项触发，对话框移动端复用现有 dialog CSS 模式。

进度方式选 SSE（非轮询）：用户点重建后会盯着对话框等完成，实时反馈体验更好；chat SSE 基建可复用，边际成本低。

## 架构

```
app-bar 菜单「强制重建索引」→ actions.openReindexConfirm()
  → store.reindex.dialog="confirm" → <reindex-dialog> 显示确认 UI
用户点「确认」→ actions.startReindex() + _runReindex()
  → POST /api/reindex（streamSSE + AbortController）
       idx.trigger_background_reindex(force=True, on_progress, on_complete)
         │  后台线程 _bg_work（_reindex_lock）
         │  new_ts.index(search_path, force=True, progress_callback=on_file_indexed)
         │    ├─ on_file_indexed → on_progress(file,n) → q.put({progress})
         │    └─ 完成 → on_complete(success,doc_count,failed) → q.put({done})
       EventSourceResponse：async 从 q 取 → SSE 事件流
         event:progress {current_file, indexed_count}
         event:done     {success, doc_count, failed_count}   → 关流
         event:error    {detail}                              → 关流
  前端按 event 分派 actions（setReindexProgress / finishReindex / failReindex）+ 完成 toast
用户点「关闭」（running）→ abort SSE + closeReindex（后台 reindex 继续跑完，幂等）
```

## 组件设计

### 后端

#### 1. `doclens/index_manager.py` — `trigger_background_reindex` 扩展

签名加 `force: bool = False, on_progress=None`（向后兼容，现有调用不传 force 仍增量）：

- `_bg_work` 内 `new_ts.index(self.search_path, force=force, progress_callback=on_file_indexed)`（加 `force=force`）
- 内部 `on_file_indexed(file_path, processed, total)` 在更新 `indexed_count` 后，若 `on_progress` 非空则调 `on_progress(file_path, indexed_count[0])`
- `on_complete` 行为不变（保证调用：成功 `on_complete(True, doc_count, failed_count)`，异常 `on_complete(False, 0, 0)`）

兼容性：`deps.start_watcher` / `files.py` / `preview.py` 调 `trigger_background_reindex()` 不传 force → 仍增量；`FileWatcher._do_reindex` 不传 force → 不受影响。

#### 2. 新增 `doclens/web_v2/api/reindex.py` — `POST /api/reindex`（SSE）

```python
"""POST /api/reindex —— 强制全量重建索引，SSE 流式返回进度。"""
import asyncio
import json
import os
import queue as _queue

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from doclens.index_manager import IndexManager
from doclens.web_v2.deps import get_index_manager

router = APIRouter()


@router.post("/reindex")
async def force_reindex(idx: IndexManager = Depends(get_index_manager)):
    q: _queue.Queue = _queue.Queue()
    loop = asyncio.get_event_loop()

    def on_progress(file_path: str, n: int):
        q.put_nowait({"type": "progress",
                      "current_file": os.path.basename(file_path),
                      "indexed_count": n})

    def on_complete(success: bool, doc_count: int, failed: int):
        q.put_nowait({"type": "done", "success": success,
                      "doc_count": doc_count, "failed_count": failed})

    idx.trigger_background_reindex(force=True, on_progress=on_progress, on_complete=on_complete)

    async def event_stream():
        while True:
            try:
                item = await asyncio.wait_for(loop.run_in_executor(None, q.get), timeout=600)
            except asyncio.TimeoutError:
                yield {"event": "error", "data": json.dumps({"detail": "timeout"})}
                break
            yield {"event": item["type"], "data": json.dumps(item)}
            if item["type"] in ("done", "error"):
                break

    return EventSourceResponse(event_stream())
```

`app.py` 的 `create_app()` 路由区挂载 `reindex.router`（prefix `/api`）。

关键点：
- **进度桥接**：后台线程 → `queue.Queue.put_nowait`（线程安全）；SSE async 用 `run_in_executor(None, q.get)` 取（阻塞转 async），`asyncio.wait_for(..., 600)` 兜底超时。
- **流结束**：`done`/`error` 事件后 break；前端 `streamSSE` 读到 done 停止。
- **中断语义**：用户关对话框 → 前端 `AbortController` 中断 fetch；**后端 reindex 仍跑完**（幂等，跑完索引即最新）。

### 前端

#### 1. `state/types.ts` + `state/store.ts` — reindex 切片

```typescript
// types.ts
export interface ReindexResult { success: boolean; doc_count: number; failed_count: number; }
export interface ReindexState {
  dialog: "closed" | "confirm" | "running" | "done" | "error";
  current_file: string | null;
  indexed_count: number;
  result: ReindexResult | null;
  error: string | null;
}
// AppState 加：reindex: ReindexState
```

`INITIAL_STATE.reindex`：
```typescript
reindex: { dialog: "closed", current_file: null, indexed_count: 0, result: null, error: null },
```

`actions`（全部不可变更新）：
- `openReindexConfirm()` → `dialog:"confirm"`
- `startReindex()` → `dialog:"running", indexed_count:0, current_file:null, result:null, error:null`
- `setReindexProgress(p)` → 更新 `current_file`/`indexed_count`（仅 dialog==="running" 时）
- `finishReindex(r)` → `dialog:"done", result:r`
- `failReindex(msg)` → `dialog:"error", error:msg`
- `closeReindex()` → 重置回 `dialog:"closed"` 全字段归零

#### 2. `api/client.ts` — `streamSSE` 加可选 `signal`

`streamSSE(path, body, signal?)`：把 `signal` 透传给 `fetch` 的 `init`。现有 chat 调用不传 signal，行为不变；reindex-dialog 用 signal 实现中断。

#### 3. `components/reindex-dialog.ts`（新）— 4 阶段对话框

- 订阅 `store.reindex`，根元素为 `<dialog open>`（dialog==="closed" 时不渲染）
- **confirm**：⚠️「将全量重建索引，期间搜索结果可能不完整」+「确认重建 / 取消」 → 确认调 `startReindex()` 后执行 `_runReindex()`
- **running**：`⟳ 正在重建索引…` + `已索引 ${indexed_count} 个` + `当前：${current_file}` + 「关闭」按钮（关闭 = abort + closeReindex）
- **done**：✅ `重建完成：${doc_count} 文档`（`failed_count>0` 时附 `· ${failed} 个失败`）+「关闭」
- **error**：⚠️ `重建失败：${error}` +「关闭」

`_runReindex()`（核心 SSE 读取）：

```typescript
private async _runReindex(): Promise<void> {
  this._abort = new AbortController();
  try {
    for await (const ev of streamSSE("/api/reindex", {}, this._abort.signal)) {
      if (this._abort.signal.aborted) break;
      if (ev.event === "progress") {
        const d = JSON.parse(ev.data);
        actions.setReindexProgress({ current_file: d.current_file, indexed_count: d.indexed_count });
      } else if (ev.event === "done") {
        const d = JSON.parse(ev.data);
        actions.finishReindex({ success: d.success, doc_count: d.doc_count, failed_count: d.failed_count });
        this._pushToast(`索引重建完成：${d.doc_count} 文档`, "success");
        break;
      } else if (ev.event === "error") {
        actions.failReindex(JSON.parse(ev.data).detail || "重建失败");
        break;
      }
    }
  } catch (e) {
    if (!this._abort?.signal.aborted) actions.failReindex((e as Error).message);
  }
}
```

`disconnectedCallback`：`this._abort?.abort()` 清理。内嵌 `<toast-stack>` 用于完成 toast（参考 app-bar 模式）。

#### 4. `components/app-bar.ts` — 菜单项

`user-menu` 内「全局配置」之后加：

```html
<button class="menu-item" type="button" @click=${this._onReindexClick}>
  <span class="icon">🔄</span>
  <span class="text">
    <span class="label">强制重建索引</span>
    <span class="desc">全量重扫工作目录</span>
  </span>
</button>
```

`_onReindexClick`：`actions.openReindexConfirm()` + 关菜单（`this._menuOpen = false`）。

#### 5. `app.ts` — 挂载

import `./components/reindex-dialog`；`render()` 顶层（与 app-bar 平级）加 `<reindex-dialog></reindex-dialog>`。

## 数据流（端到端）

```
用户点菜单「强制重建索引」
 → actions.openReindexConfirm() → store.reindex.dialog="confirm"
 → <reindex-dialog> 显示确认 UI
用户点「确认重建」
 → actions.startReindex()（dialog="running"）+ _runReindex()
 → streamSSE POST /api/reindex
 → 后端 trigger_background_reindex(force=True)
   → 后台线程全量重扫，每个文件 on_progress → q.put(progress) → SSE event:progress
   → 前端 setReindexProgress（角标旁对话框更新"已索引 N · 当前 x.md"）
 → 扫描完成 on_complete → q.put(done) → SSE event:done
   → 前端 finishReindex（dialog="done"）+ toast「索引重建完成：N 文档」
用户点「关闭」（running 阶段）
 → abort SSE + closeReindex（dialog="closed"），后台 reindex 继续跑完
```

## 错误处理

| 情况 | 处理 |
|------|------|
| idx 未初始化 / trigger 抛异常 | `on_complete(success=False)` → SSE `error` 事件 → 前端 `failReindex` → 对话框 error 阶段 |
| SSE 超时（600s 无事件） | 后端 yield `error` 事件关流；前端 failReindex |
| 前端网络/解析错误 | `_runReindex` catch → `failReindex`（abort 引发的除外） |
| 用户关对话框（running） | `AbortController.abort()` 中断 fetch；后端 reindex 继续跑完（幂等） |
| 重复触发 | 对话框 modal + store 状态机：dialog≠"closed" 时菜单项不再开新确认（确认阶段可取消回 closed 再触发） |
| 并发 reindex | `_reindex_lock` 保证 force 与 watcher reindex 互斥（后者等锁） |

## 测试策略

### 后端（pytest）

- `tests/web_v2/test_reindex_api.py`：用 `AsyncClient` POST `/api/reindex`，mock `idx.trigger_background_reindex` 捕获 `on_progress/on_complete`，手动触发 `on_progress("a.md",1)` / `on_progress("b.md",2)` / `on_complete(True,2,0)`，断言 SSE 流产出 `progress`×2 → `done` 事件序列；验证 `force=True` 透传给 trigger
- `index_manager` force 扩展：现有 `test_file_watcher_status.py` 等回归不受影响（不传 force 仍增量）；可选加单测验证 `trigger_background_reindex(force=True)` 把 force 透给 `new_ts.index`

### 前端（vitest）

- `reindex-dialog.spec.ts`：4 阶段渲染（confirm/running/done/error）；mock `streamSSE` 为 async generator，验证 progress→done 状态转换 + toast；abort 关闭路径
- `store-reindex.spec.ts`：6 个 actions 状态转换（openReindexConfirm/startReindex/setReindexProgress/finishReindex/failReindex/closeReindex）
- `app-bar.spec.ts` 追加：菜单项 click → `store.reindex.dialog === "confirm"`
- `api/client.spec`（或 api.spec）追加：`streamSSE` 透传 `signal` 给 fetch

### E2E（可选）

启动后端，点菜单→确认，观察对话框从 confirm → running（已索引数递增）→ done。因依赖文件系统与 SSE 时序，标记可选。

## 配置

无新配置。复用现有 `IndexManager`（`search_path`、`_reindex_lock`）。force 全量重建语义来自 `reindex(force=True)`。

## 已知限制

- **不支持中断取消**：进行中「关闭」= 隐藏对话框，后端 reindex 继续跑完（treesearch index 中断机制复杂，YAGNI）。
- **角标不同步**：force reindex 不经 `FileWatcher`，完成后 `FileWatcher.last_doc_count` 不更新，app-bar 角标数字可能短暂不准；完成 toast 显示新 doc_count，角标在下次文件变化/watcher reindex 时自然更新。不强制同步。
- **进度无百分比**：treesearch `progress_callback` 的 `total` 可能为 0，故只显示「已索引 N 个 + 当前文件名」，不承诺百分比进度条。
- **单用户场景**：SSE 流绑定单次请求；多端同时触发会各自起流，后端 `_reindex_lock` 串行化实际重建。

## 改动文件清单

**后端**
- `doclens/index_manager.py`（`trigger_background_reindex` 加 `force`/`on_progress`）
- `doclens/web_v2/api/reindex.py`（新增 `POST /api/reindex` SSE）
- `doclens/web_v2/app.py`（挂载 reindex router）

**前端**
- `frontend/src/state/types.ts`（`ReindexState` + `AppState.reindex`）
- `frontend/src/state/store.ts`（reindex 切片 + 6 actions）
- `frontend/src/api/client.ts`（`streamSSE` 加 `signal`）
- `frontend/src/components/reindex-dialog.ts`（新增，4 阶段 + SSE）
- `frontend/src/components/app-bar.ts`（菜单项）
- `frontend/src/app.ts`（挂载 `<reindex-dialog>`）
