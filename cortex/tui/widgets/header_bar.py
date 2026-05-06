"""标题栏组件 - 显示版本号、工作目录、当前模式"""

from textual.widgets import Static
from textual.containers import Horizontal


class HeaderBar(Horizontal):
    """顶部标题栏"""

    DEFAULT_CSS = """
    HeaderBar {
        height: 1;
        background: #24283b;
        color: #7aa2f7;
        padding: 0 1;
    }
    HeaderBar > #header-left {
        width: 1fr;
    }
    HeaderBar > #header-right {
        width: auto;
        color: #9ece6a;
    }
    """

    def __init__(self, version: str = "v1.1.0", workdir: str = ""):
        super().__init__()
        self.version = version
        self.workdir = workdir
        self._mode = "就绪"

    def compose(self):
        yield Static(
            f"cortex {self.version} ─ {self.workdir}",
            id="header-left",
        )
        yield Static("", id="header-right")

    def set_mode(self, mode: str) -> None:
        """更新当前模式显示"""
        self._mode = mode
        right = self.query_one("#header-right", Static)
        right.update(f"● {mode}")

    def set_workdir(self, workdir: str) -> None:
        """更新工作目录显示"""
        self.workdir = workdir
        left = self.query_one("#header-left", Static)
        left.update(f"cortex {self.version} ─ {workdir}")
