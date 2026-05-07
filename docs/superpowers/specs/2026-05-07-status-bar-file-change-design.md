# 文件变化状态栏通知 - 设计文档

## 概述

当 FileWatcher 检测到文件或目录变化时，通过全局事件总线通知状态栏显示变化信息。

## 架构设计

### 核心组件

#### 1. EventBus（事件总线）

单例模式，提供全局事件发布/订阅能力。

```python
class EventBus:
    _instance = None

    @classmethod
    def get_instance(cls) -> "EventBus":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def publish(self, event_type: str, payload: dict) -> None:
        """发布事件"""
        for callback in self._subscribers.get(event_type, []):
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

#### 2. 事件类型定义

```python
StatusEventType = Literal["info", "success", "warning", "error", "file_change"]

StatusPayload = TypedDict("StatusPayload", {
    "event_type": StatusEventType,
    "message": str,
    "files": list[str] | None,
    "count": int | None,
    "timestamp": float,
})
```

#### 3. 事件消息格式

所有状态栏事件使用统一 payload 结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| `event_type` | `StatusEventType` | 事件类型 |
| `message` | `str` | 显示给用户的文本消息 |
| `files` | `list[str] \| None` | file_change 事件专用，变化的文件列表 |
| `count` | `int \| None` | file_change 事件专用，变化文件数量 |
| `timestamp` | `float` | 事件发生时间戳 |

### 文件变化事件示例

```python
{
    "event_type": "file_change",
    "message": "检测到 3 个文件变化，正在更新索引...",
    "files": ["foo.py", "bar.py", "baz.py"],
    "count": 3,
    "timestamp": 1715092800.123
}
```

## 文件结构

```
cortex/
├── event_bus.py          # EventBus 单例实现
├── events.py             # 事件类型定义
├── file_watcher.py       # FileWatcher，发布 file_change 事件
└── tui/
    ├── widgets/
    │   └── status_bar.py # StatusBar，订阅 status 事件
    └── app.py            # CortexApp，初始化时连接事件总线
```

## 实现细节

### 1. EventBus 实现 (`cortex/event_bus.py`)

```python
"""全局事件总线 - 提供事件发布/订阅能力"""
import time
from typing import Callable, Any

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

### 2. 事件类型定义 (`cortex/events.py`)

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

### 3. FileWatcher 修改 (`cortex/file_watcher.py`)

- 新增 `on_change_callback` 可选参数
- 检测到变化时调用回调，回调内发布事件

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

### 4. StatusBar 修改 (`cortex/tui/widgets/status_bar.py`)

```python
def __init__(self):
    super().__init__()
    self._right_text = "就绪"
    self._unsubscribe = None

def on_mount(self) -> None:
    """订阅事件总线"""
    from cortex.event_bus import EventBus
    bus = EventBus.get_instance()
    self._unsubscribe = bus.subscribe("status", self._on_status_event)

def on_unmount(self) -> None:
    """取消订阅"""
    if self._unsubscribe:
        self._unsubscribe()

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

### 5. App 集成 (`cortex/tui/app.py`)

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
        ...
```

## 设计决策

### 1. 为什么用 TypedDict 而不是 dataclass？

TypedDict 更轻量，适合作为数据结构使用，不需要方法。将来如果需要更多行为可以升级为 dataclass。

### 2. 为什么事件 payload 包含 `timestamp`？

便于调试和日志记录，也能支持按时间排序或去重。

### 3. 为什么 file_change 事件包含 `files` 数组？

虽然当前 UI 只显示前几个文件名，但保留完整列表便于：
- 将来支持点击查看完整列表
- 日志记录完整变化
- 调试用途

### 4. 为什么不直接在 FileWatcher 内发布事件？

解耦考虑：
- FileWatcher 专注于监控逻辑
- 事件发布由调用方控制
- 便于测试时替换回调

## 扩展性

未来可订阅 `status` 事件的其他组件：
- `ContentArea` - 可选地在界面上显示通知
- `ThinkingIndicator` - 可触发特定动画
- 日志系统 - 记录状态变化历史

## 改动文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `cortex/event_bus.py` | 新增 | EventBus 单例实现 |
| `cortex/events.py` | 新增 | 事件类型定义 |
| `cortex/file_watcher.py` | 修改 | 添加 `on_change_callback` 参数 |
| `cortex/tui/widgets/status_bar.py` | 修改 | 订阅事件总线并处理通知 |
| `cortex/tui/app.py` | 修改 | 传入回调并初始化事件流 |
