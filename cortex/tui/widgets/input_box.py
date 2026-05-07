"""输入框组件 - 模仿 Claude Code 风格：> 提示符 + 简洁输入 + 历史导航"""

import sys
from pathlib import Path

from textual.app import ComposeResult
from textual.containers import Horizontal
from textual.events import Key, MouseDown
from textual.message import Message
from textual.widgets import Input, Static

from planify.cli_history import CommandHistory, _get_clipboard_text


class InputBox(Horizontal):
    """底部输入框 - Claude Code 风格，支持上下箭头历史导航"""

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

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        history_path = Path.home() / ".cortex" / "cli_history" / "history.json"
        self._history = CommandHistory(history_path)
        self._saved_input = ""

    def compose(self) -> ComposeResult:
        yield Static(">", id="prompt")
        yield Input(
            placeholder="输入搜索关键词或 / 命令...",
            id="cmd-input",
        )

    def on_mount(self) -> None:
        """挂载后自动聚焦输入框"""
        self.query_one("#cmd-input", Input).focus()

    def on_key(self, event: Key) -> None:
        """拦截上下箭头键实现历史导航"""
        if event.key not in ("up", "down"):
            return

        event.stop()
        event.prevent_default()

        input_widget = self.query_one("#cmd-input", Input)

        if event.key == "up":
            # 首次按上箭头时，保存当前未提交的输入
            if self._history._history_index == len(self._history._entries):
                self._saved_input = input_widget.value
            entry = self._history.up()
            if entry is not None:
                input_widget.value = entry
                input_widget.cursor_position = len(entry)

        elif event.key == "down":
            entry = self._history.down()
            if entry is not None:
                input_widget.value = entry
                input_widget.cursor_position = len(entry)
            else:
                input_widget.value = self._saved_input
                input_widget.cursor_position = len(self._saved_input)

    def on_input_submitted(self, event: Input.Submitted) -> None:
        """Enter 提交输入"""
        event.stop()
        value = event.value.strip()
        if not value:
            return
        self._history.add(value)
        self._saved_input = ""
        event.input.value = ""
        self.post_message(self.Submitted(value))

    def focus_input(self) -> None:
        """重新聚焦输入框"""
        self.query_one("#cmd-input", Input).focus()

    def on_mouse_down(self, event: MouseDown) -> None:
        """右键粘贴剪贴板内容"""
        if event.button != 2 or sys.platform != "win32":
            return

        event.stop()
        clipboard_text = _get_clipboard_text()
        if not clipboard_text:
            return

        input_widget = self.query_one("#cmd-input", Input)
        pos = input_widget.cursor_position
        input_widget.value = input_widget.value[:pos] + clipboard_text + input_widget.value[pos:]
        input_widget.cursor_position = pos + len(clipboard_text)
