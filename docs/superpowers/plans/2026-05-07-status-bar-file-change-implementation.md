# 文件变化状态栏通知 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当 FileWatcher 检测到文件变化时，通过全局 EventBus 通知 StatusBar 显示变化信息（文件名 + 数量）。

**Architecture:** 使用单例 EventBus 提供全局发布/订阅能力，FileWatcher 在检测到变化时调用回调发布事件，StatusBar 订阅事件并更新显示。

**Tech Stack:** Python, Textual, Watchdog

---

## 文件结构

```
cortex/
├── event_bus.py           # 新增: EventBus 单例实现
├── events.py              # 新增: 事件类型定义
├── file_watcher.py         # 修改: 添加 on_change_callback
└── tui/
    ├── widgets/
    │   └── status_bar.py  # 修改: 订阅 status 事件
    └── app.py             # 修改: 传入回调
tests/
└── test_event_bus.py      # 新增: EventBus 测试
```

---

## Task 1: 创建 EventBus

**Files:**
- Create: `cortex/event_bus.py`

- [ ] **Step 1: 编写 EventBus 实现**

```python
"""全局事件总线 - 提供事件发布/订阅能力"""
from typing import Callable


class EventBus:
    """单例事件总线"""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._subscribers = {}
        return cls._instance

    def publish(self, event_type: str, payload: dict) -> None:
        """发布事件到所有订阅者"""
        if event_type not in self._subscribers:
            return
        for callback in self._subscribers[event_type]:
            callback(payload)

    def subscribe(self, event_type: str, callback: Callable[[dict], None]) -> Callable:
        """订阅事件，返回取消订阅函数"""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

        def unsubscribe():
            self._subscribers[event_type].remove(callback)

        return unsubscribe
```

- [ ] **Step 2: 提交**

```bash
git add cortex/event_bus.py
git commit -m "feat: add EventBus singleton for publish/subscribe"
```

---

## Task 2: 创建事件类型定义

**Files:**
- Create: `cortex/events.py`

- [ ] **Step 1: 编写事件类型定义**

```python
"""事件类型定义"""
from typing import TypedDict, Literal

StatusEventType = Literal["info", "success", "warning", "error", "file_change"]


class StatusPayload(TypedDict):
    event_type: StatusEventType
    message: str
    files: list[str] | None
    count: int | None
    timestamp: float
```

- [ ] **Step 2: 提交**

```bash
git add cortex/events.py
git commit -m "feat: define StatusPayload TypedDict for status events"
```

---

## Task 3: 为 EventBus 编写测试

**Files:**
- Create: `tests/test_event_bus.py`

- [ ] **Step 1: 编写 EventBus 测试**

```python
"""EventBus 测试"""
import pytest
from cortex.event_bus import EventBus


def test_singleton():
    """测试 EventBus 是单例"""
    bus1 = EventBus.get_instance()
    bus2 = EventBus.get_instance()
    assert bus1 is bus2


def test_publish_subscribe():
    """测试发布/订阅基本功能"""
    bus = EventBus.get_instance()
    bus._subscribers = {}  # 清空订阅者

    received = []

    def handler(payload):
        received.append(payload)

    unsubscribe = bus.subscribe("test_event", handler)
    bus.publish("test_event", {"data": "hello"})

    assert len(received) == 1
    assert received[0] == {"data": "hello"}


def test_unsubscribe():
    """测试取消订阅"""
    bus = EventBus.get_instance()
    bus._subscribers = {}  # 清空订阅者

    received = []

    def handler(payload):
        received.append(payload)

    unsubscribe = bus.subscribe("test_event", handler)
    unsubscribe()  # 取消订阅
    bus.publish("test_event", {"data": "hello"})

    assert len(received) == 0


def test_multiple_subscribers():
    """测试多个订阅者"""
    bus = EventBus.get_instance()
    bus._subscribers = {}  # 清空订阅者

    received1 = []
    received2 = []

    def handler1(payload):
        received1.append(payload)

    def handler2(payload):
        received2.append(payload)

    bus.subscribe("test_event", handler1)
    bus.subscribe("test_event", handler2)
    bus.publish("test_event", {"data": "hello"})

    assert len(received1) == 1
    assert len(received2) == 1


def test_no_subscribers_for_event():
    """测试发布到没有订阅者的事件"""
    bus = EventBus.get_instance()
    bus._subscribers = {}  # 清空订阅者

    # 不应抛出异常
    bus.publish("nonexistent_event", {"data": "hello"})
```

- [ ] **Step 2: 运行测试验证**

Run: `pytest tests/test_event_bus.py -v`
Expected: 5 tests PASS

- [ ] **Step 3: 提交**

```bash
git add tests/test_event_bus.py
git commit -m "test: add EventBus unit tests"
```

---

## Task 4: 修改 FileWatcher 添加回调支持

**Files:**
- Modify: `cortex/file_watcher.py`

- [ ] **Step 1: 修改 FileWatcher `__init__` 方法，添加 `on_change_callback` 参数**

找到 `cortex/file_watcher.py` 第 62-71 行：
```python
class FileWatcher:
    """后台文件监控器，检测变化后自动 reindex"""

    def __init__(self, idx_manager, debounce_seconds: float = 5.0):
        self._idx = idx_manager
        self._debounce = debounce_seconds
        self._timer = None
        self._observer = None
        self._reindexing = False
```

修改为：
```python
class FileWatcher:
    """后台文件监控器，检测变化后自动 reindex"""

    def __init__(self, idx_manager, debounce_seconds: float = 5.0, on_change_callback=None):
        self._idx = idx_manager
        self._debounce = debounce_seconds
        self._timer = None
        self._observer = None
        self._reindexing = False
        self._on_change_callback = on_change_callback
```

- [ ] **Step 2: 修改 `_on_change` 方法，在检测到变化时调用回调**

找到 `cortex/file_watcher.py` 第 103-109 行：
```python
    def _on_change(self, file_path: str):
        """收到文件变化事件，重置防抖定时器"""
        if self._timer:
            self._timer.cancel()
        self._timer = threading.Timer(self._debounce, self._do_reindex)
        self._timer.daemon = True
        self._timer.start()
```

修改为：
```python
    def _on_change(self, file_path: str):
        """收到文件变化事件，重置防抖定时器"""
        if self._timer:
            self._timer.cancel()
        self._timer = threading.Timer(self._debounce, self._do_reindex)
        self._timer.daemon = True
        self._timer.start()

        # 发布文件变化事件
        if self._on_change_callback:
            self._on_change_callback(file_path)
```

- [ ] **Step 3: 提交**

```bash
git add cortex/file_watcher.py
git commit -m "feat(file_watcher): add on_change_callback for file change notifications"
```

---

## Task 5: 修改 StatusBar 订阅事件

**Files:**
- Modify: `cortex/tui/widgets/status_bar.py`

- [ ] **Step 1: 修改 `__init__` 方法，添加 `_unsubscribe` 属性**

找到 `cortex/tui/widgets/status_bar.py` 第 27-29 行：
```python
    def __init__(self):
        super().__init__()
        self._right_text = "就绪"
```

修改为：
```python
    def __init__(self):
        super().__init__()
        self._right_text = "就绪"
        self._unsubscribe = None
```

- [ ] **Step 2: 添加 `on_mount` 方法订阅事件总线**

在 `compose` 方法后添加：
```python
    def on_mount(self) -> None:
        """订阅事件总线"""
        from cortex.event_bus import EventBus
        bus = EventBus.get_instance()
        self._unsubscribe = bus.subscribe("status", self._on_status_event)
```

- [ ] **Step 3: 添加 `on_unmount` 方法取消订阅**

在 `on_mount` 后添加：
```python
    def on_unmount(self) -> None:
        """取消订阅"""
        if self._unsubscribe:
            self._unsubscribe()
```

- [ ] **Step 4: 添加 `_on_status_event` 方法处理状态事件**

在 `on_unmount` 后添加：
```python
    def _on_status_event(self, payload: dict) -> None:
        """处理状态事件"""
        event_type = payload.get("event_type")
        message = payload.get("message", "")

        if event_type == "file_change":
            count = payload.get("count", 0)
            files = payload.get("files", [])
            if count > 0:
                # 显示文件名和数量
                file_list = ", ".join(files[:3])
                if count > 3:
                    file_list += f" (+{count - 3} more)"
                self._right_text = f"文件变化: {file_list}"
            else:
                self._right_text = message
        else:
            self._right_text = message

        self._refresh_right()
```

- [ ] **Step 5: 提交**

```bash
git add cortex/tui/widgets/status_bar.py
git commit -m "feat(status_bar): subscribe to status events and display file changes"
```

---

## Task 6: 修改 app.py 集成回调

**Files:**
- Modify: `cortex/tui/app.py`

- [ ] **Step 1: 修改 `_start_watcher` 方法，传入回调函数**

找到 `cortex/tui/app.py` 第 125-140 行：
```python
    def _start_watcher(self) -> None:
        """启动文件监控"""
        if not self.config.watch_enabled:
            return
        try:
            from cortex.file_watcher import FileWatcher
            self.watcher = FileWatcher(self.idx, debounce_seconds=self.config.watch_debounce)
            if self.watcher.start():
                content = self.query_one(ContentArea)
                content.write_system("已启动文件监控")
                status = self.query_one(StatusBar)
                status.set_watcher_status("运行中")
        except Exception as exc:
            content = self.query_one(ContentArea)
            content.write_error(f"文件监控启动失败: {exc}")
            self.watcher = None
```

修改为：
```python
    def _start_watcher(self) -> None:
        """启动文件监控"""
        if not self.config.watch_enabled:
            return
        try:
            from cortex.file_watcher import FileWatcher
            from cortex.event_bus import EventBus

            # 创建文件变化回调
            changed_files = []
            changed_count = 0

            def on_file_change(file_path: str):
                nonlocal changed_files, changed_count
                changed_files.append(file_path)
                changed_count += 1

                # 发布事件
                bus = EventBus.get_instance()
                bus.publish("status", {
                    "event_type": "file_change",
                    "message": f"检测到 {changed_count} 个文件变化，正在更新索引...",
                    "files": changed_files,
                    "count": changed_count,
                    "timestamp": time.time(),
                })

            self.watcher = FileWatcher(
                self.idx,
                debounce_seconds=self.config.watch_debounce,
                on_change_callback=on_file_change
            )
            if self.watcher.start():
                content = self.query_one(ContentArea)
                content.write_system("已启动文件监控")
                status = self.query_one(StatusBar)
                status.set_watcher_status("运行中")
        except Exception as exc:
            content = self.query_one(ContentArea)
            content.write_error(f"文件监控启动失败: {exc}")
            self.watcher = None
```

- [ ] **Step 2: 确保 `time` 模块已导入**

找到 `cortex/tui/app.py` 第 1-7 行：
```python
import io
import os
import sys
from pathlib import Path
from typing import Optional
```

修改为：
```python
import io
import os
import sys
import time
from pathlib import Path
from typing import Optional
```

- [ ] **Step 3: 提交**

```bash
git add cortex/tui/app.py
git commit -m "feat(app): wire file change callback to EventBus"
```

---

## Task 7: 集成测试

**Files:**
- Modify: `tests/test_event_bus.py` (添加 file_change 事件测试)

- [ ] **Step 1: 添加 file_change 事件测试用例**

在 `test_no_subscribers_for_event` 后添加：
```python
def test_file_change_event_format():
    """测试 file_change 事件格式"""
    bus = EventBus.get_instance()
    bus._subscribers = {}  # 清空订阅者

    received = []

    def handler(payload):
        received.append(payload)

    bus.subscribe("status", handler)

    # 发布 file_change 事件
    import time
    bus.publish("status", {
        "event_type": "file_change",
        "message": "检测到 3 个文件变化，正在更新索引...",
        "files": ["foo.py", "bar.py", "baz.py"],
        "count": 3,
        "timestamp": time.time(),
    })

    assert len(received) == 1
    payload = received[0]
    assert payload["event_type"] == "file_change"
    assert payload["count"] == 3
    assert len(payload["files"]) == 3
```

- [ ] **Step 2: 运行所有测试**

Run: `pytest tests/test_event_bus.py -v`
Expected: 6 tests PASS

- [ ] **Step 3: 提交**

```bash
git add tests/test_event_bus.py
git commit -m "test: add file_change event format test"
```

---

## 总结

完成后，实现以下功能：
1. EventBus 单例提供全局事件发布/订阅
2. FileWatcher 检测到文件变化时调用回调
3. StatusBar 订阅 status 事件并显示变化文件信息

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-07-status-bar-file-change-implementation.md`**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
