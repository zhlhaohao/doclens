# 启动后增量索引同步

**日期**: 2026-05-07
**状态**: Draft

## 问题

Cortex TUI 启动时，`load_or_build_index()` 如果发现已有索引文件（`.cortex/index.db`），会直接加载而不检查磁盘文件是否已变化。在 cortex 关闭期间，监控目录中的文件可能已被修改、新增或删除，导致用户搜索到过时的结果。

虽然 `FileWatcher` 会在启动后监控文件变化，但它只能捕获运行时发生的变更，无法弥补关闭期间的变更。

## 方案

在 `_on_index_loaded()` 完成索引加载后，延迟 3 秒触发一次后台增量索引检查，复用现有的 `trigger_background_reindex()` 机制。

### 架构流程

```
启动 → on_mount() → _do_init_index() (后台线程)
                                |
                    _on_index_loaded() (主线程)
                         |              |
                   _start_watcher()   Timer(3s)
                                        |
                               _startup_sync_check()
                                        |
                              idx.trigger_background_reindex()
                              (增量：仅处理变化的文件)
                                        |
                               _on_startup_sync_done()
                              (仅在有更新时显示状态)
```

### 改动范围

仅修改 `cortex/tui/app.py`。

### 实现细节

#### 1. `_on_index_loaded()` 新增 Timer

在 `_on_index_loaded()` 方法末尾，启动一个 3 秒延迟的定时器：

```python
import threading

# 在 _on_index_loaded() 末尾添加
self._sync_timer = threading.Timer(3.0, self._startup_sync_check)
self._sync_timer.daemon = True
self._sync_timer.start()
```

Timer 设为 daemon 线程，确保不会阻止程序退出。

#### 2. 新增 `_startup_sync_check()` 方法

```python
def _startup_sync_check(self) -> None:
    """启动后延迟检查索引是否需要增量更新。"""
    try:
        self.idx.trigger_background_reindex(
            on_complete=self._on_startup_sync_done
        )
    except Exception:
        pass  # 静默失败，不影响正常使用
```

#### 3. 新增 `_on_startup_sync_done()` 回调

```python
def _on_startup_sync_done(self, success: bool, doc_count: int, failed_count: int) -> None:
    """启动同步完成后，仅在更新了文件时显示状态。"""
    self.call_from_thread(self._show_startup_sync_result, success, doc_count, failed_count)

def _show_startup_sync_result(self, success: bool, doc_count: int, failed_count: int) -> None:
    """主线程中显示同步结果。"""
    if success and doc_count > 0:
        EventBus().publish({
            "event_type": "indexing",
            "status": f"启动同步完成，已更新 {doc_count} 个文件",
        })
```

### 用户体验

- 启动后 3 秒内：UI 正常渲染，用户可立即使用旧索引搜索
- 3 秒后：后台静默检查文件变化
- 如果无变化：用户完全无感知
- 如果有变化：StatusBar 短暂显示 "启动同步完成，已更新 N 个文件"
- 搜索时自动使用最新索引（通过 `_check_swap()` 原子替换）

### 边界情况

| 场景 | 行为 |
|------|------|
| 3 秒内 FileWatcher 已触发 reindex | `trigger_background_reindex` 有 `reindexing` 标志防止并发，不会重复执行 |
| 启动时无索引文件 | `load_or_build_index` 会全量构建，Timer 仍触发但 reindex 检测无变化，静默跳过 |
| 程序在 3 秒内退出 | Timer 是 daemon 线程，自动随主线程退出 |
| 索引文件损坏 | `load_or_build_index` 已处理（删除重建），Timer 触发时索引已是最新 |

### 测试计划

1. 正常启动，验证 3 秒后后台增量检查执行
2. 启动前修改文件，验证增量索引捕获变更并在 StatusBar 显示
3. 启动前无文件变化，验证无任何状态提示
4. 验证与 FileWatcher 并行工作正常
5. 验证退出时 Timer 不阻塞程序
