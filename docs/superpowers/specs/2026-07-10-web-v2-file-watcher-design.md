# Web v2 (GUI) 文件监控 (watchdog) 支持设计

## 目标

为 doclens Web UI（`doclens/web_v2`）补上工作目录文件变化的 watchdog 监控，使其能力与 TUI 对齐：用户在 VSCode、资源管理器等外部工具中增删改文件后，索引自动增量重建；前端以轻量轮询方式展示监控状态与更新结果。

## 背景

| 维度 | TUI (`tui/app.py`) | CLI (`cortex_cli.py`) | GUI (`web_v2`) |
|------|------|------|------|
| watchdog 接入 | 完整 | 基础 | **无** |
| 外部文件变化感知 | 自动 reindex + 状态栏提示 | 自动 reindex（静默） | **无感知，索引过期** |

根因：`config.watch_enabled` / `watch_debounce`（`doclens/config.py:67-68`）这条配置链只被 TUI/CLI 消费，`web_v2` 从未实例化 `FileWatcher`。`create_app()` 仅注册路由与静态文件，无 lifespan startup 拉起 Observer。

前端现状：`/api/status` 已存在但前端**完全未调用**（`indexed_docs` 仅在 `state/types.ts:69` 定义但未使用），顶栏 `app-bar.ts` 无任何索引状态展示位。因此前端部分需从零搭建「轮询 + 展示」。

## 方案

**复用** `doclens/file_watcher.py` 的 `FileWatcher`（与 TUI 同源，不重写），只对其做「可观测性」扩展；在 `web_v2` 适配层用 FastAPI lifespan 驱动启停，新增零开销轻量端点供前端轮询，前端在顶栏常驻角标 + toast 反馈。

通知机制选定「轻量轮询」（非 SSE）：GUI 已有 `/api/status`，轮询不引入长连接复杂度，又能让用户明确感知索引在自动更新。

## 架构

```
FastAPI lifespan startup
    └─ if config.watch_enabled:
         FileWatcher(idx, debounce=watch_debounce, on_reindex_done=…).start()
         │  (复用 doclens/file_watcher.py，与 TUI 同一份代码)
         ├─ Observer 线程递归监控 search_path
         ├─ on_change: changed_count += 1（防抖 5s）
         └─ _do_reindex → trigger_background_reindex（_reindex_lock 下，线程安全）
              └─ on_complete: 更新 last_reindex_at / last_doc_count / last_success

GET /api/watch/status  →  只读 watcher 内存快照（零文档遍历开销）
GET /api/status        →  原响应 + watcher 子对象（状态页一次性拉取用）

前端 <cortex-app>
    └─ setInterval(5s) → getWatchStatus() → store.status.watcher
         ├─ app-bar 角标：●监控 / ⟳更新中 / ·待更新 N / ○监控关
         └─ toast-stack：reindex 完成且 doc_count 变化时「索引已更新：N 文档」

FastAPI lifespan shutdown  →  watcher.stop()
```

核心原则：
- **复用 `FileWatcher`**，扩展状态而非重写，TUI 也因此获得可观测性（纯增量，不破坏现有回调契约）
- **lifespan 驱动启停**，资源生命周期绑定 FastAPI 应用
- **零开销轮询端点**，避免每次轮询都遍历文档计算 `total_size`

## 组件设计

### 后端

#### 1. 扩展 `doclens/file_watcher.py` — 可观测状态

新增线程安全的状态字段与 `status()` 快照方法：

```python
class FileWatcher:
    # 新增字段（__init__）
    self._state_lock = threading.Lock()
    self._running = False
    self._changed_count = 0          # 自上次 reindex 起累计变化数
    self._last_reindex_at: float | None = None
    self._last_doc_count: int | None = None
    self._last_success: bool | None = None

    def status(self) -> dict:
        """返回 watcher 状态快照（线程安全）。"""
        with self._state_lock:
            return {
                "running": self._running,
                "reindexing": self._reindexing,
                "changed_count": self._changed_count,
                "last_reindex_at": self._last_reindex_at,
                "last_doc_count": self._last_doc_count,
                "last_success": self._last_success,
            }
```

写入点（均在 `_state_lock` 保护下；FileWatcher 自身状态自洽，**不依赖外部回调**）：
- `start()` 成功 → `_running = True`
- `_on_change` → `_changed_count += 1`
- `_do_reindex` 进入后（设 `reindexing=True` 之后、调用 `trigger_background_reindex` 之前）→ `_changed_count = 0`
- `_do_reindex` 传给 `trigger_background_reindex(on_complete=…)` 的 **内部 wrapper** 完成 → 更新 `_last_reindex_at = time.time()`、`_last_doc_count`、`_last_success`，随后再转发调用外部 `on_reindex_done(success, doc_count, failed_count)`

线程模型：Observer 线程与 reindex 后台线程写、API 请求线程读 → 用 `_state_lock` 保护。`_reindexing` 字段保留现有 property，但读写也纳入锁保护以一致。

不破坏 TUI 现有回调契约（`on_change_callback` / `on_reindex_start` / `on_reindex_done` 仍按原签名转发给调用方），纯增量扩展。FileWatcher 的内部状态更新与外部回调是两条独立路径：GUI 可以不传任何回调，仅靠 `status()` 观测。

#### 2. `doclens/web_v2/deps.py` — watcher 单例

```python
_watcher: Optional["FileWatcher"] = None

def get_watcher() -> "FileWatcher | None":
    return _watcher

def set_watcher(w): ...   # lifespan 启动时注入
```

并在 `reset_singletons()` 中一并清空 `_watcher = None`。

#### 3. `doclens/web_v2/app.py` — FastAPI lifespan

`create_app()` 改为构造带 `lifespan` 的 FastAPI 实例：

- **startup**：`idx = get_index_manager()` → 若 `get_config().watch_enabled`，构造
  `FileWatcher(idx, debounce_seconds=watch_debounce, on_reindex_done=<更新状态>)` 并 `start()`；
  `start()` 返回 True 则 `set_watcher(w)`，否则记 warning。整个 startup 用 try/except 包裹，异常只记日志、不阻断 uvicorn。
- **shutdown**：`w = get_watcher(); w.stop() if w else None`。

`launch_app()` 中 `uvicorn.run(app, ...)` 会自动驱动 lifespan。

#### 4. `doclens/web_v2/api/status.py` — 响应增加 `watcher` 字段

`/api/status` 响应顶层追加：

```jsonc
"watcher": {
  "enabled": true,             // config.watch_enabled
  "running": true,
  "reindexing": false,
  "changed_count": 0,
  "last_reindex_at": 1752199200.0,
  "last_doc_count": 42,
  "last_success": true
}
```

`enabled` 取 config；其余字段由 `get_watcher()?.status() ?? None` 提供（watcher 未创建时 `watcher: null`）。

#### 5. 新增 `doclens/web_v2/api/watch.py` — 轻量轮询端点

```python
@router.get("/watch/status")
async def watch_status():
    w = get_watcher()
    return {
        "enabled": get_config().watch_enabled,
        "watcher": w.status() if w else None,
    }
```

挂载到 `/api` 前缀 → `GET /api/watch/status`。只读内存字段，不遍历文档，零 stat 开销。

### 前端

#### 1. 新增 `frontend/src/api/status.ts`

```typescript
export interface WatcherStatus {
  enabled: boolean;
  running: boolean;
  reindexing: boolean;
  changed_count: number;
  last_reindex_at: number | null;
  last_doc_count: number | null;
  last_success: boolean | null;
}
export interface WatchStatusResponse { enabled: boolean; watcher: WatcherStatus | null; }
export interface StatusInfo { indexed_docs: number; index_path: string; total_size_bytes: number; file_types: Record<string, number>; watcher: WatcherStatus | null; }
export async function getWatchStatus(): Promise<WatchStatusResponse> { … }
export async function getStatus(): Promise<StatusInfo> { … }
```

#### 2. `state/types.ts` — 扩展类型

新增 `WatcherStatus`；`StatusInfo` 增加 `watcher` 字段（与后端 `/api/status` 对齐）。

#### 3. `state/store.ts` — status 切片

store 增加 `status: { watcher: WatcherStatus | null; lastSeenDocCount: number | null }`，轮询写入触发订阅刷新。

#### 4. `app.ts` — 轮询调度

`<cortex-app>` 的 `connectedCallback` 启动 `setInterval(getWatchStatus, 5000)`，结果不可变更新到 store；`disconnectedCallback` 清理定时器。首次连接立即拉一次。

#### 5. `components/app-bar.ts` — 常驻角标

顶栏右侧 `right_cluster` 加一个轻量角标，依据 `store.status.watcher` 渲染：

| 状态 | 文案 |
|------|------|
| `running && reindexing` | `📁 {n} ⟳更新中…` |
| `running && changed_count>0` | `📁 {n} ·待更新 {c}` |
| `running` | `📁 {n} ●监控` |
| 未启用/未运行 | `📁 {n} ○监控关` |

`{n}` 取 `last_doc_count`（为空时省略数字）。

#### 6. 复用 `components/toast-stack.ts`

store 检测 `last_reindex_at` 变化且 `last_doc_count` 与上次不同时，派发 toast「索引已更新：N 文档」。

## 数据流（端到端：外部改了 a.md）

```
VSCode 存 a.md
 → Observer.on_modified → _ChangeHandler 过滤(.md ✓, 非 .cortex ✓)
 → _on_change: changed_count += 1, 重置 5s 防抖 Timer
 → 5s 内无新事件 → _do_reindex: reindexing=true, changed_count 清零
 → trigger_background_reindex(_reindex_lock 下增量重建)
 → on_complete(success, doc_count): reindexing=false, last_reindex_at=now, last_doc_count=N+1
 → 前端 ≤5s 轮询 getWatchStatus → store → app-bar ⟳→● + toast
```

## 错误处理

| 情况 | 处理 |
|------|------|
| watchdog 未安装 | `start()` 返回 False（已有逻辑）→ 不 set_watcher，角标显示 `○监控关`，不崩 |
| lifespan startup watcher 异常 | try/except 记日志，不阻断 uvicorn（索引照常可用，仅无监控） |
| reindex 失败 | `on_complete(success=False)` → `last_success=false`，角标 `⚠️` |
| 轮询网络失败 | 前端静默忽略（toast 仅用于正面通知） |
| shutdown | `watcher.stop()` 已有 `join(timeout=2)`，安全 |

## 测试策略

### 后端（pytest）

- `FileWatcher.status()` 字段正确性：mock `IndexManager`，验证 `start` 后 `running=true`；模拟 `_on_change` 后 `changed_count` 递增；`on_reindex_start` 清零；`on_complete` 更新 `last_*`；并发读 `status()` 不抛错（锁保护）
- `GET /api/watch/status`：watcher 未创建时 `watcher:null`；已创建时结构正确
- `GET /api/status`：响应含 `watcher` 字段
- lifespan 启停：`watch_enabled=False` 不创建 watcher；`True` 创建并 `running`；shutdown 后 watcher 停止

### 前端（vitest）

- `api/status.ts`：`getWatchStatus` / `getStatus` 正确解析（含 watcher 为 null）
- store：用 fake timers 验证轮询触发后 `status.watcher` 不可变更新

### E2E（playwright-cli skill，可选）

启动后端，在 `test_work_dir` 修改一个 `.md`，断言顶栏角标在 ~10s 内经历 `●监控 → ⟳更新中 → ●监控 N+1`。因依赖文件系统事件时序，标记为可选。

## 配置

完全复用现有配置，**无新配置项**：

- `watch_enabled`（默认 True）：是否启用 GUI watchdog
- `watch_debounce`（默认 5.0）：防抖秒数

行为与 TUI/CLI 一致：改 `.env` 重启后端生效（不做运行期动态开关，遵循 YAGNI）。

## 已知限制

- **多 worker 部署**：`uvicorn --workers N` 会启动多个 watcher 重复 reindex。`launch_app` 固定单 worker，不处理此场景，文档注明。
- **文件系统可靠性**：网络盘 / 部分 FS 上 watchdog 事件可靠性依赖 watchdog 本身。
- **轮询延迟**：状态更新有 ≤5s 延迟，B（轮询）方案可接受；如未来需实时，可升级为 SSE。

## 改动文件清单

**后端**
- `doclens/file_watcher.py`（扩展状态字段 + `status()` + `_state_lock`）
- `doclens/web_v2/deps.py`（+ `_watcher` 单例 / `get_watcher` / `set_watcher` / `reset_singletons` 联动）
- `doclens/web_v2/app.py`（+ FastAPI lifespan）
- `doclens/web_v2/api/status.py`（响应 + `watcher` 字段）
- `doclens/web_v2/api/watch.py`（新增 `GET /api/watch/status` 轻量端点）

**前端**
- `frontend/src/api/status.ts`（新增）
- `frontend/src/state/types.ts`（+ `WatcherStatus`、扩展 `StatusInfo`）
- `frontend/src/state/store.ts`（+ status 切片）
- `frontend/src/app.ts`（+ 5s 轮询调度）
- `frontend/src/components/app-bar.ts`（+ 常驻角标）
- 复用 `frontend/src/components/toast-stack.ts`（reindex 完成通知）
