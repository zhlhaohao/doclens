"""工具详情弹窗 - 展开显示工具调用的完整内容"""

from textual.app import ComposeResult
from textual.containers import VerticalScroll
from textual.screen import ModalScreen
from textual.widgets import Static
from rich.text import Text


class ToolDetailScreen(ModalScreen[None]):
    """弹出窗口，展示工具调用的完整入参和结果。按 ESC 关闭。"""

    BINDINGS = [("escape", "close", "关闭")]

    DEFAULT_CSS = """
    ToolDetailScreen {
        align: center middle;
    }
    ToolDetailScreen > VerticalScroll {
        width: 90%;
        height: 80%;
        background: #1a1b26;
        border: solid #565f89;
        padding: 1 2;
    }
    ToolDetailScreen > VerticalScroll > Static {
        color: #c0caf5;
    }
    ToolDetailScreen > .detail-title {
        color: #ff9e64;
        text-style: bold;
        margin-bottom: 1;
    }
    """

    def __init__(self, details: list[tuple[str, str, str]]):
        super().__init__()
        self._details = details

    def compose(self) -> ComposeResult:
        with VerticalScroll():
            yield Static(
                "工具调用详情 (ESC 关闭)",
                classes="detail-title",
            )
            for name, input_str, result in self._details:
                yield Static(Text(f"\n--- {name} ---", style="#ff9e64 bold"))
                yield Static(Text(f"入参: {input_str}", style="#7aa2f7"))
                yield Static(Text(f"结果: {result}", style="#a9b1d6"))

    def action_close(self) -> None:
        self.dismiss(None)
