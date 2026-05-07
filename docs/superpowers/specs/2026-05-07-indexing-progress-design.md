# 索引进度通知 - 设计文档

## 概述

在索引过程中，通过 EventBus 定期发布当前正在索引的文件名，让状态栏显示进度。

## 架构设计

### 核心思路

在 `IndexManager` 调用 `ts.index()` 之前，临时包装 `ts.index_document` 方法来追踪当前正在处理的文件，然后通过 Timer 线程每 N 秒通过 EventBus 发布进度事件。

### 事件格式

```python
{
    "event_type": "indexing",
    "current_file": "foo.py",
    "indexed_count": 5,
    "timestamp": time.time()
}
```

### 文件结构

```
cortex/
├── index_manager.py        # 修改: 添加索引进度追踪
└── tui/
    └── widgets/
        └── status_bar.py   # 修改: 处理 indexing 事件
```

## 实现细节

### 1. IndexManager 修改 (`cortex/index_manager.py`)

在 `_reindex_internal` 方法中：

```python
def _reindex_internal(self, force=False):
    """内部 reindex（已持有锁）"""
    # ... 现有代码 ...

    # 包装 index_document 方法来追踪进度
    original_index_doc = self._ts.index_document
    self._current_indexing_file = None
    self._indexed_count = 0

    def wrapped_index_doc(doc, **kwargs):
        self._current_indexing_file = doc.doc_name if hasattr(doc, 'doc_name') else '未知'
        self._indexed_count += 1
        return original_index_doc(doc, **kwargs)

    self._ts.index_document = wrapped_index_doc

    # 启动进度发布 Timer
    import threading
    import time as time_module

    def publish_progress():
        if self._current_indexing_file:
            bus = EventBus.get_instance()
            bus.publish("status", {
                "event_type": "indexing",
                "current_file": os.path.basename(self._current_indexing_file),
                "indexed_count": self._indexed_count,
                "timestamp": time_module.time(),
            })

    progress_timer = threading.Timer(1.0, publish_progress)
    progress_timer.daemon = True
    progress_timer.start()

    try:
        self._ts.index(self.search_path, force=force)
    finally:
        self._ts.index_document = original_index_doc
        progress_timer.cancel()
```

### 2. StatusBar 修改 (`cortex/tui/widgets/status_bar.py`)

在 `_on_status_event` 中添加对 `indexing` 事件的处理：

```python
def _on_status_event(self, payload: dict) -> None:
    """处理状态事件"""
    event_type = payload.get("event_type")
    message = payload.get("message", "")

    # 取消之前的自动重置定时器
    if self._auto_reset_timer:
        self._auto_reset_timer.cancel()
        self._auto_reset_timer = None

    if event_type == "file_change":
        # ... 现有 file_change 处理 ...

    elif event_type == "indexing":
        current_file = payload.get("current_file", "")
        indexed_count = payload.get("indexed_count", 0)
        self._right_text = f"索引中: {current_file} ({indexed_count})"
        # 5 秒后自动恢复（防止卡住）
        import threading
        self._auto_reset_timer = threading.Timer(5.0, self._do_restore)
        self._auto_reset_timer.daemon = True
        self._auto_reset_timer.start()

    else:
        self._right_text = message

    self._refresh_right()
```

## 设计决策

### 1. 为什么用 Timer 而不是直接 hook？

TreeSearch 的 `index()` 是异步的，直接在里面调用同步的 EventBus.publish() 会阻塞事件循环。Timer 线程是独立的，不影响主流程。

### 2. 为什么恢复原方法用 try/finally？

确保即使 `index()` 抛出异常，也能恢复原方法，避免影响后续使用。

### 3. 为什么索引完成后不自动消失？

索引完成时会有 `_on_reindex_done` 回调更新状态栏，不需要依赖定时器。

## 改动文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `cortex/index_manager.py` | 修改 | 包装 index_document，启动进度 Timer |
| `cortex/tui/widgets/status_bar.py` | 修改 | 处理 indexing 事件并显示 |
