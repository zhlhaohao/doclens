"""状态栏组件 - 最底部固定显示"""

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

    def compose(self) -> ComposeResult:
        yield Static("", id="status-left")
        yield Static(self._right_text, id="status-right")

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

    def _refresh_right(self) -> None:
        """刷新右侧状态文本"""
        right = self.query_one("#status-right", Static)
        right.update(self._right_text)

    def set_index_stats(self, doc_count: int) -> None:
        """更新索引统计"""
        self._right_text = f"索引: {doc_count} 文档"
        self._refresh_right()

    def set_watcher_status(self, status: str) -> None:
        """更新监控状态"""
        if "监控" not in self._right_text:
            self._right_text = f"{self._right_text} · 监控: {status}"
        else:
            self._right_text = re.sub(
                r"监控: \w+", f"监控: {status}", self._right_text
            )
        self._refresh_right()

    def set_agent_status(self, status: str) -> None:
        """更新 Agent 状态"""
        if "Agent" not in self._right_text:
            self._right_text = f"{self._right_text} · Agent: {status}"
        else:
            self._right_text = re.sub(
                r"Agent: \w+", f"Agent: {status}", self._right_text
            )
        self._refresh_right()
