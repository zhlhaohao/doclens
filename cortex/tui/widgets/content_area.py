"""主内容区组件 - 可滚动的输出区域"""

from io import StringIO

from textual.widgets import RichLog
from rich.console import Console
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
        self._last_output: list[str] = []
        self._recording: bool = False

    def start_recording(self) -> None:
        """开始记录输出（命令执行前调用）"""
        self._last_output = []
        self._recording = True

    def stop_recording(self) -> None:
        """停止记录输出"""
        self._recording = False

    def get_last_output(self) -> str:
        """获取上次命令的输出文本"""
        return "\n".join(self._last_output)

    def write(self, content, **kwargs):
        """重写 write，同时记录纯文本"""
        if self._recording:
            plain = self._extract_plain(content)
            if plain:
                self._last_output.append(plain)
        return super().write(content, **kwargs)

    @staticmethod
    def _extract_plain(content) -> str:
        """从 Rich 可渲染对象中提取纯文本"""
        if isinstance(content, str):
            return content
        if isinstance(content, Text):
            return content.plain
        # 使用 Rich Console 将 Renderable 对象渲染为纯文本
        try:
            from rich.protocol import is_renderable
            if is_renderable(content):
                buf = StringIO()
                console = Console(file=buf, force_terminal=False, width=200, markup=False)
                console.print(content)
                return buf.getvalue()
        except Exception:
            pass
        if hasattr(content, '__str__'):
            return str(content)
        return ""

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
