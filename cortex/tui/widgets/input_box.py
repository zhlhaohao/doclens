"""输入框组件 - 模仿 Claude Code 风格：> 提示符 + 简洁输入"""

from textual.app import ComposeResult
from textual.containers import Horizontal
from textual.message import Message
from textual.widgets import Input, Static


class InputBox(Horizontal):
    """底部输入框 - Claude Code 风格"""

    DEFAULT_CSS = """
    InputBox {
        height: 3;
        background: #000000;
        border-top: solid #3b3d57;
        border-bottom: solid #3b3d57;
        padding: 0 1;
    }
    InputBox > #prompt {
        width: 2;
        color: #9ece6a;
        background: #000000;
    }
    InputBox > Input {
        background: #000000;
        border: none;
        color: #c0caf5;
        padding: 0;
        height: 1;
    }
    InputBox > Input:focus {
        border: none;
    }
    InputBox > Input.-invalid {
        border: none;
    }
    """

    class Submitted(Message):
        """用户提交输入消息"""

        def __init__(self, value: str) -> None:
            self.value = value
            super().__init__()

    def compose(self) -> ComposeResult:
        yield Static(">", id="prompt")
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
