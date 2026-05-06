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

    def compose(self) -> ComposeResult:
        yield Static("Shift + 鼠标拖选 复制文字", id="status-left")
        yield Static(self._right_text, id="status-right")

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
