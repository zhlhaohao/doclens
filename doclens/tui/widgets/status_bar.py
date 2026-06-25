"""状态栏组件 - 最底部固定显示"""

import os
import re
from textual.app import ComposeResult
from textual.containers import Horizontal
from textual.widgets import Static


class StatusBar(Horizontal):
    """最底部状态栏"""

    DEFAULT_CSS = """
    StatusBar {
        height: 1;
        background: #24283b;
        color: #565f89;
        padding: 0 1;
    }
    StatusBar > #status-left {
        width: 1fr;
    }
    StatusBar > #status-right {
        width: auto;
    }
    """

    def __init__(self):
        super().__init__()
        self._right_text = "就绪"
        self._unsubscribe = None
        self._auto_reset_timer = None
        self._left_timer = None
        self._last_indexed_count = 0  # 记录最后索引的文件数

    def compose(self) -> ComposeResult:
        yield Static("", id="status-left")
        yield Static(self._right_text, id="status-right")

    def on_mount(self) -> None:
        """订阅事件总线"""
        from doclens.event_bus import EventBus
        bus = EventBus.get_instance()
        self._unsubscribe = bus.subscribe("status", self._on_status_event)

    def on_unmount(self) -> None:
        """取消订阅"""
        if self._auto_reset_timer:
            self._auto_reset_timer.cancel()
        if self._left_timer:
            self._left_timer.cancel()
        if self._unsubscribe:
            self._unsubscribe()

    def _on_status_event(self, payload: dict) -> None:
        """处理状态事件"""
        import logging
        logging.getLogger(__name__).debug("StatusBar received event: %s", payload)
        event_type = payload.get("event_type")
        message = payload.get("message", "")

        # 取消之前的自动重置定时器
        if self._auto_reset_timer:
            self._auto_reset_timer.cancel()
            self._auto_reset_timer = None

        if event_type == "file_change":
            count = payload.get("count", 0)
            files = payload.get("files", [])
            if count > 0:
                # 只显示文件名（basename）和数量
                file_names = [os.path.basename(f) for f in files]
                unique_names = list(dict.fromkeys(file_names))  # 去重保持顺序
                if len(unique_names) == 1:
                    self._right_text = f"文件变化: {unique_names[0]}"
                else:
                    self._right_text = f"文件变化: {count} 个文件"
            else:
                self._right_text = message
        elif event_type == "indexing":
            current_file = payload.get("current_file", "")
            indexed_count = payload.get("indexed_count", 0)
            self._last_indexed_count = indexed_count
            self._right_text = f"索引中: {current_file} ({indexed_count})"
            # 5 秒后自动恢复（防止卡住）
            import threading
            app = self.app
            widget = self

            def restore():
                app.call_from_thread(widget._do_restore)

            self._auto_reset_timer = threading.Timer(5.0, restore)
            self._auto_reset_timer.daemon = True
            self._auto_reset_timer.start()
        else:
            self._right_text = message

        self._refresh_right()

        # file_change 事件 3 秒后自动恢复
        if event_type == "file_change":
            import threading
            app = self.app
            widget = self

            def restore():
                app.call_from_thread(widget._do_restore)

            self._auto_reset_timer = threading.Timer(3.0, restore)
            self._auto_reset_timer.daemon = True
            self._auto_reset_timer.start()

    def _do_restore(self) -> None:
        """恢复状态（需在主线程调用）"""
        if self._last_indexed_count > 0:
            self._right_text = f"索引: {self._last_indexed_count} 文档"
        else:
            self._right_text = "就绪"
        self._refresh_right()

    def _refresh_right(self) -> None:
        """刷新右侧状态文本"""
        right = self.query_one("#status-right", Static)
        right.update(self._right_text)

    def set_index_stats(self, doc_count: int) -> None:
        """更新索引统计"""
        if self._auto_reset_timer:
            self._auto_reset_timer.cancel()
            self._auto_reset_timer = None
        self._right_text = f"索引: {doc_count} 文档"
        self._refresh_right()

    def set_watcher_status(self, status: str) -> None:
        """更新监控状态（已禁用）"""
        pass

    def set_agent_status(self, status: str) -> None:
        """更新 Agent 状态"""
        if "Agent" not in self._right_text:
            self._right_text = f"{self._right_text} · Agent: {status}"
        else:
            self._right_text = re.sub(
                r"Agent: \S+", f"Agent: {status}", self._right_text
            )
        self._refresh_right()

    def set_tool_status(self, tool_name: str) -> None:
        """更新 Agent 状态为正在调用工具"""
        status = f"调用 {tool_name}..."
        if "Agent" not in self._right_text:
            self._right_text = f"{self._right_text} · Agent: {status}"
        else:
            self._right_text = re.sub(
                r"Agent: \S+", f"Agent: {status}", self._right_text
            )
        self._refresh_right()

    def flash_message(self, message: str, duration: float = 10.0) -> None:
        """在状态栏右侧显示临时消息，duration 秒后自动恢复"""
        self._right_text = message
        self._refresh_right()

        if self._auto_reset_timer:
            self._auto_reset_timer.cancel()

        import threading
        app = self.app
        widget = self

        def restore():
            app.call_from_thread(widget._do_restore)

        self._auto_reset_timer = threading.Timer(duration, restore)
        self._auto_reset_timer.daemon = True
        self._auto_reset_timer.start()

    def show_f9_hint(self, duration: float = 10.0) -> None:
        """在状态栏左侧显示 F9 提示，duration 秒后清除"""
        left = self.query_one("#status-left", Static)
        left.update("F9: 切换鼠标模式")

        if self._left_timer:
            self._left_timer.cancel()

        import threading
        app = self.app
        widget = self

        def clear_left():
            app.call_from_thread(widget._clear_left)

        self._left_timer = threading.Timer(duration, clear_left)
        self._left_timer.daemon = True
        self._left_timer.start()

    def _clear_left(self) -> None:
        """清除左侧提示"""
        left = self.query_one("#status-left", Static)
        left.update("")
