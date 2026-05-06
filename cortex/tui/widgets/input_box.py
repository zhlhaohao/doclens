"""输入框组件 - 用户命令输入区"""

from textual.app import ComposeResult
from textual.message import Message
from textual.widget import Widget
from textual.widgets import Input


class InputBox(Widget):
    """底部输入框"""

    DEFAULT_CSS = """
    InputBox {
        dock: bottom;
        height: 3;
        background: #24283b;
        border-top: solid #3b3d57;
        padding: 0 1;
    }
    InputBox > Input {
        background: #1a1b26;
        border: round #3b3d57;
        color: #c0caf5;
        padding: 0 1;
    }
    InputBox > Input:focus {
        border: round #7aa2f7;
    }
    InputBox > Input.-invalid {
        border: round #f7768e;
    }
    """

    class Submitted(Message):
        """用户提交输入消息"""

        def __init__(self, value: str) -> None:
            self.value = value
            super().__init__()

    def compose(self) -> ComposeResult:
        yield Input(
            placeholder="输入搜索关键词或 / 命令...",
            id="cmd-input",
        )

    def on_mount(self) -> None:
        """挂载后自动聚焦输入框"""
        self.query_one("#cmd-input", Input).focus()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        """Enter 提交输入"""
        event.stop()
        value = event.value.strip()
        if not value:
            return
        event.input.value = ""
        self.post_message(self.Submitted(value))

    def focus_input(self) -> None:
        """重新聚焦输入框"""
        self.query_one("#cmd-input", Input).focus()
