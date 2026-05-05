# FileWatcher 自动索引更新设计

## 目标

Cortex CLI 启动后，后台监控搜索目录的文件变化，自动触发增量 reindex，确保搜索结果始终反映最新文件状态，且 reindex 期间搜索不受阻塞。

## 方案：后台线程 + 双缓冲切换

watchdog 守护线程监控文件变化，防抖后在后台线程创建新 TreeSearch 实例做增量索引。reindex 完成后将新实例存入 `_pending_swap`，主线程搜索前原子替换旧实例。搜索始终使用完整可用的索引，无阻塞。

## 架构

```
┌─────────────────────────────────────────────┐
│  Main Thread (REPL)                          │
│                                              │
│  IndexManager._ts ─── search() 读旧索引      │
│       │                                      │
│       └── _check_swap() ── 原子替换          │
│                                              │
├─────────────────────────────────────────────┤
│  FileWatcher (守护线程)                       │
│                                              │
│  watchdog Observer → _ChangeHandler          │
│       │                                      │
│       └── 5s 防抖 → _do_reindex()            │
│                                              │
│       └── 新 TreeSearch + path_map           │
│          → IndexManager._pending_swap        │
└─────────────────────────────────────────────┘
```

### 关键设计

- `_pending_swap` 是 `None | tuple(new_ts, new_path_map, doc_count)`，Python 赋值为原子操作
- 主线程检查和替换在同一线程，无需加锁
- watchdog observer 设为 daemon 线程，主线程退出时自动终止

## 组件设计

### 新增：`cortex/file_watcher.py`

#### `FileWatcher`

```python
class FileWatcher:
    def __init__(self, idx_manager: IndexManager, debounce_seconds: float = 5.0)
    def start(self)        # 启动 watchdog 监控
    def stop(self)         # 停止监控
    def _on_change(file_path)   # 文件变化回调，重置防抖定时器
    def _do_reindex()      # 后台线程执行 reindex，完成后设置 pending swap
```

- `start()`：创建 watchdog `Observer`，注册 `_ChangeHandler`，递归监控 `search_path`
- `stop()`：取消防抖定时器，停止并 join observer（timeout=2s）
- `_on_change()`：收到变化事件，取消旧定时器，启动新的防抖定时器
- `_do_reindex()`：
  1. 检查 `_reindexing` 标志，为 True 则跳过
  2. 创建新 `TreeSearch` 实例，执行增量索引
  3. 构建 path_map
  4. 将 `(new_ts, new_path_map, doc_count)` 存入 `idx_manager._pending_swap`
  5. 异常时静默忽略，不影响旧索引

#### `_ChangeHandler`（watchdog 事件处理器）

- 监听 `Modified`、`Created`、`Deleted`、`Moved` 事件
- 按扩展名过滤（`SUPPORTED_FORMATS` 中的扩展名）
- 忽略 `.cortex/` 目录下的变化
- 调用 `FileWatcher._on_change(file_path)`

### 修改：`cortex/index_manager.py`

- `__init__` 新增 `_pending_swap = None`
- 新增 `_check_swap()`：若 `_pending_swap` 不为 None，替换 `_ts` 和 `_path_map`，打印 `[索引已自动更新: N 个文档]`，清空 `_pending_swap`
- `search()` 开头调用 `_check_swap()`

### 修改：`cortex/config.py`

新增配置项：

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| `watch_enabled` | `CORTEX_WATCH_ENABLED` | `True` | 是否启用文件监控 |
| `watch_debounce` | `CORTEX_WATCH_DEBOUNCE` | `5.0` | 防抖秒数 |

### 修改：`cortex/cortex_cli.py`

- `run()` 中索引加载成功后启动 FileWatcher
- 退出时（`/quit`、Ctrl+C）调用 `cleanup()` 停止 watcher
- `/index` 命令执行前设置 `_reindexing = True` 防冲突

### 修改：`cortex/.env.example`

新增监控相关配置示例。

## REPL 集成

### 启动

```
索引加载完成后：
1. self.watcher = FileWatcher(self.idx)
2. self.watcher.start()
3. print("[已启动文件监控，变化将自动更新索引]")
```

### 停止

REPL 退出时调用 `cleanup()`，取消定时器、停止 observer。

### 用户感知

- 启动时：`[已启动文件监控，变化将自动更新索引]`
- 索引更新时：搜索前显示 `[索引已自动更新: N 个文档]`
- 不打断用户输入，通知在搜索输出前显示

### 手动 `/index` 兼容

手动 `/index` 和自动 reindex 通过 `_reindexing` 标志互斥，后到的跳过。

## 边界情况

| 场景 | 处理 |
|------|------|
| 启动时无索引 | FileWatcher 不启动，等 `/index` 后再启动 |
| reindex 冲突 | `_reindexing` 互斥标志，后到的跳过 |
| search_path 被删除 | watchdog 报错停止，不影响主线程 |
| watchdog 未安装 | `import` 失败时打印提示，其余功能正常 |
| 后台 reindex 异常 | `try/except` 捕获，静默忽略 |
| `.cortex/` 变化 | handler 中过滤，避免循环 reindex |

## 依赖

- 新增 Python 依赖：`watchdog`（可选，未安装时不影响其他功能）
