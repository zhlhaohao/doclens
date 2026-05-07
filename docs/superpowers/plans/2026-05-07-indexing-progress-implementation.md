# 索引进度通知 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在索引过程中，通过 EventBus 每秒发布当前正在索引的文件名，状态栏显示进度。

**Architecture:** 包装 `ts.index_document` 方法追踪当前文件，通过 Timer 线程每秒发布事件到 EventBus，StatusBar 订阅并显示。

**Tech Stack:** Python, threading, EventBus

---

## 文件结构

```
cortex/
├── index_manager.py               # 修改: 包装 index_document，添加进度 Timer
└── tui/
    └── widgets/
        └── status_bar.py         # 修改: 处理 indexing 事件
```

---

## Task 1: 修改 IndexManager 添加索引进度追踪

**Files:**
- Modify: `cortex/index_manager.py`

**需要修改的位置：**
- `_reindex_internal` 方法（约第 220-248 行）

- [ ] **Step 1: 读取当前 `_reindex_internal` 方法**

找到 `cortex/index_manager.py` 中 `_reindex_internal` 方法的完整内容（第 220-248 行左右）。

- [ ] **Step 2: 修改 `_reindex_internal` 方法**

将现有方法中 `self._ts.index(self.search_path, force=force)` 调用前后添加包装逻辑：

在调用 `self._ts.index()` 之前添加：
```python
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
            from cortex.event_bus import EventBus
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
```

在 `self._ts.index()` 调用后添加（finally 块中）：
```python
    finally:
        self._ts.index_document = original_index_doc
        progress_timer.cancel()
```

- [ ] **Step 3: 提交**

```bash
git add cortex/index_manager.py
git commit -m "feat(index_manager): add indexing progress tracking via EventBus"
```

---

## Task 2: 修改 StatusBar 处理 indexing 事件

**Files:**
- Modify: `cortex/tui/widgets/status_bar.py`

- [ ] **Step 1: 修改 `_on_status_event` 方法**

在 `cortex/tui/widgets/status_bar.py` 的 `_on_status_event` 方法中，在 `elif event_type == "file_change":` 分支后添加 `elif event_type == "indexing":` 分支：

```python
    elif event_type == "indexing":
        current_file = payload.get("current_file", "")
        indexed_count = payload.get("indexed_count", 0)
        self._right_text = f"索引中: {current_file} ({indexed_count})"
        # 5 秒后自动恢复（防止卡住）
        import threading
        self._auto_reset_timer = threading.Timer(5.0, self._do_restore)
        self._auto_reset_timer.daemon = True
        self._auto_reset_timer.start()
```

**注意：** 放在 `else: self._right_text = message` 之前。

- [ ] **Step 2: 提交**

```bash
git add cortex/tui/widgets/status_bar.py
git commit -m "feat(status_bar): handle indexing event and show progress"
```

---

## Task 3: 验证和测试

**Files:**
- 无新增文件

- [ ] **Step 1: 运行现有测试确保没有破坏功能**

```bash
pytest tests/test_event_bus.py -v
```

预期: 6 tests PASS

- [ ] **Step 2: 提交**

```bash
git commit -m "test: verify indexing progress feature doesn't break existing tests"
```

---

## 总结

完成 Task 1-2 后，实现以下功能：
1. IndexManager 在索引时包装 `index_document` 方法，每秒通过 EventBus 发布进度
2. StatusBar 接收 `indexing` 事件并显示 "索引中: foo.py (5)"
3. 5 秒无更新自动恢复状态
