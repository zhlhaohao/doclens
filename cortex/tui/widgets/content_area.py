"""主内容区组件 - 可滚动的输出区域"""

from textual.widgets import RichLog
from rich.text import Text


class ContentArea(RichLog):
    """主内容显示区域，基于 RichLog"""

    DEFAULT_CSS = """
    ContentArea {
        height: 1fr;
        background: #000000;
        border: none;
        padding: 0 1;
        scrollbar-size: 1 1;
        scrollbar-background: #24283b;
        scrollbar-color: #3b3d57;
    }
    """

    def __init__(self):
        super().__init__(
            highlight=True,
            markup=False,
            wrap=True,
            auto_scroll=True,
            id="content-area",
        )

    def write_system(self, text: str) -> None:
        """写入系统消息（灰色）"""
        self.write(Text(text, style="#565f89"))

    def write_error(self, text: str) -> None:
        """写入错误消息（红色）"""
        self.write(Text(text, style="#f7768e"))

    def write_success(self, text: str) -> None:
        """写入成功消息（绿色）"""
        self.write(Text(text, style="#9ece6a"))

    def write_prompt(self, query: str) -> None:
        """写入用户输入提示"""
        self.write(Text(f"> {query}", style="#9ece6a bold"))
