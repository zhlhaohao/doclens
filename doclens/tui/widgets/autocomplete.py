"""自动补全下拉菜单 - 显示在输入框上方，支持所有斜杠命令补全"""

from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.message import Message
from textual.widgets import Static

from doclens.tui.command_registry import Command

# 最大显示条目数
_MAX_VISIBLE = 8


class _CompletionItem(Static):
    """单条补全项"""

    DEFAULT_CSS = """
    _CompletionItem {
        height: 1;
        padding: 0 1;
        color: $text;
    }
    _CompletionItem.highlighted {
        background: $boost;
        color: $text;
    }
    """

    class Selected(Message):
        """用户选中该项"""

        def __init__(self, command: Command) -> None:
            self.command = command
            super().__init__()

    def __init__(self, command: Command, **kwargs) -> None:
        self.command = command
        alias_str = f" [{', '.join(command.aliases)}]" if command.aliases else ""
        label = f"/{command.name}{alias_str}  —  {command.description}"
        super().__init__(label, **kwargs)
        self._highlighted = False

    @property
    def highlighted(self) -> bool:
        return self._highlighted

    @highlighted.setter
    def highlighted(self, value: bool) -> None:
        self._highlighted = value
        if value:
            self.add_class("highlighted")
        else:
            self.remove_class("highlighted")


class AutoComplete(Vertical):
    """浮动的下拉补全菜单，显示在 InputBox 上方"""

    DEFAULT_CSS = """
    AutoComplete {
        layer: overlay;
        display: none;
        dock: bottom;
        offset: 0 -6;
        height: auto;
        max-height: 16;
        min-width: 50;
        background: $surface;
        border: tall $primary;
        padding: 0;
        overflow-y: auto;
    }
    AutoComplete.visible {
        display: block;
    }
    """

    def __init__(self, **kwargs) -> None:
        self._commands: list[Command] = []
        self._selected_index: int = 0
        super().__init__(**kwargs)

    def update_matches(self, commands: list[Command]) -> None:
        """更新匹配列表并显示"""
        self._commands = commands[:_MAX_VISIBLE]
        self._selected_index = 0

        # 清空旧内容
        for child in self.children:
            child.remove()

        # 创建新条目
        for cmd in self._commands:
            self.mount(_CompletionItem(cmd))

        if self._commands:
            self._highlight(0)
            self.add_class("visible")
        else:
            self.hide()

    def hide(self) -> None:
        """隐藏补全菜单"""
        self.remove_class("visible")

    @property
    def visible(self) -> bool:
        return self.has_class("visible")

    def select_next(self) -> None:
        """向下选择"""
        if not self._commands:
            return
        self._highlight((self._selected_index + 1) % len(self._commands))

    def select_prev(self) -> None:
        """向上选择"""
        if not self._commands:
            return
        self._highlight((self._selected_index - 1) % len(self._commands))

    def confirm(self) -> Command | None:
        """确认当前选择，返回选中的 Command"""
        if not self._commands:
            return None
        cmd = self._commands[self._selected_index]
        self.hide()
        return cmd

    def _highlight(self, index: int) -> None:
        """高亮指定索引项"""
        items = self.query(_CompletionItem)
        for i, item in enumerate(items):
            item.highlighted = i == index
        self._selected_index = index

        # 滚动到可见区域
        if 0 <= index < len(items):
            items[index].scroll_visible(animate=False)
