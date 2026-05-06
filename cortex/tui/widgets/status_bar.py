"""状态栏组件 - 最底部固定显示"""

import re
from textual.app import ComposeResult
from textual.containers import Horizontal
from textual.widgets import Static


class StatusBar(Horizontal):
    """最底部状态栏"""

    DEFAULT_CSS = """
    StatusBar {
        dock: bottom;
        height: 1;
        background: #24283b;
        color: #565f89;
        border-top: solid #3b3d57;
        padding: 0 1;
    }
    StatusBar > #status-left {
        width: 1fr;
    }
    StatusBar > #status-right {
        width: auto;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("F1 帮助 · Tab 补全 · ↑↓ 历史", id="status-left")
        yield Static("就绪", id="status-right")

    def set_index_stats(self, doc_count: int) -> None:
        """更新索引统计"""
        right = self.query_one("#status-right", Static)
        right.update(f"索引: {doc_count} 文档")

    def set_watcher_status(self, status: str) -> None:
        """更新监控状态"""
        right = self.query_one("#status-right", Static)
        current = str(right.renderable) if right.renderable else ""
        if "监控" not in current:
            right.update(f"{current} · 监控: {status}")
        else:
            updated = re.sub(r"监控: \w+", f"监控: {status}", current)
            right.update(updated)

    def set_agent_status(self, status: str) -> None:
        """更新 Agent 状态"""
        right = self.query_one("#status-right", Static)
        current = str(right.renderable) if right.renderable else ""
        if "Agent" not in current:
            right.update(f"{current} · Agent: {status}")
        else:
            updated = re.sub(r"Agent: \w+", f"Agent: {status}", current)
            right.update(updated)
