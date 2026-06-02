"""输入框组件 - 模仿 Claude Code 风格：> 提示符 + 简洁输入 + 历史导航 + 斜杠命令自动补全"""

from __future__ import annotations

from pathlib import Path

from textual.app import ComposeResult
from textual.containers import Horizontal
from textual.message import Message
from textual.widgets import Input, Static

from planify.cli_history import CommandHistory

from cortex.tui.command_registry import Command, CommandRegistry


class InputBox(Horizontal):
    """底部输入框 - Claude Code 风格，支持上下箭头历史导航和斜杠命令自动补全"""

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

    def __init__(self, registry: CommandRegistry, **kwargs):
        super().__init__(**kwargs)
        self._registry = registry
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

    def _get_autocomplete(self):
        """获取 App 级别的 AutoComplete 组件"""
        from cortex.tui.widgets.autocomplete import AutoComplete
        return self.screen.query_one("#app-autocomplete", AutoComplete)

    def on_key(self, event) -> None:
        """拦截按键：自动补全优先，然后历史导航"""
        ac = self._get_autocomplete()

        # 自动补全菜单可见时的按键处理
        if ac.visible:
            if event.key == "up":
                event.stop()
                event.prevent_default()
                ac.select_prev()
                return
            elif event.key == "down":
                event.stop()
                event.prevent_default()
                ac.select_next()
                return
            elif event.key == "tab":
                event.stop()
                event.prevent_default()
                cmd = ac.confirm()
                if cmd:
                    self._apply_completion(cmd)
                return
            elif event.key == "enter":
                # Enter 直接提交命令，关闭补全菜单
                ac.hide()
                # 不拦截，让 Enter 继续传播到 Input.Submitted
                return
            elif event.key == "escape":
                event.stop()
                event.prevent_default()
                ac.hide()
                return

        # 上下箭头历史导航（鼠标关闭时让 App 级别的滚动绑定生效）
        if event.key in ("up", "down"):
            if not getattr(self.app, "_mouse_enabled", True):
                return

            event.stop()
            event.prevent_default()

            input_widget = self.query_one("#cmd-input", Input)

            if event.key == "up":
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
            return

    def on_input_changed(self, event: Input.Changed) -> None:
        """输入内容变化时更新自动补全"""
        value = event.value
        ac = self._get_autocomplete()

        if not value or not value.startswith("/"):
            ac.hide()
            return

        # 中文顿号转斜杠
        prefix_text = value
        if prefix_text.startswith("\u3001"):
            prefix_text = "/" + prefix_text[1:]

        if not prefix_text.startswith("/"):
            ac.hide()
            return

        # 提取命令前缀（/ 后面的部分，不含空格后的参数）
        parts = prefix_text[1:].split(maxsplit=1)
        cmd_part = parts[0].lower() if parts else ""

        # 已有空格（正在输入参数），关闭补全
        if len(parts) > 1:
            ac.hide()
            return

        if not cmd_part:
            # 只输入了 /，显示所有命令
            matches = self._registry.all_commands()
        else:
            matches = self._registry.match(cmd_part)

        ac.update_matches(matches)

    def on_input_submitted(self, event: Input.Submitted) -> None:
        """Enter 提交输入"""
        event.stop()
        value = event.value.strip()
        if not value:
            return

        # 关闭自动补全
        self._get_autocomplete().hide()

        self._history.add(value)
        self._saved_input = ""
        event.input.value = ""
        self.post_message(self.Submitted(value))

    def focus_input(self) -> None:
        """重新聚焦输入框"""
        self.query_one("#cmd-input", Input).focus()

    def _apply_completion(self, cmd: Command) -> None:
        """将选中的命令应用到输入框"""
        input_widget = self.query_one("#cmd-input", Input)
        input_widget.value = f"/{cmd.name} "
        input_widget.cursor_position = len(input_widget.value)
