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
        overflow-y: auto;
        overflow-x: hidden;
    }
    """

    def __init__(self):
        super().__init__(
            highlight=True,
            markup=False,
            wrap=True,
            auto_scroll=False,
            id="content-area",
        )
        self._last_output: list[str] = []
        self._recording: bool = False
        self._streaming_buffer: str = ""
        self._streaming_active: bool = False
        self._tool_details: list[tuple[str, str]] = []

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
                console = Console(file=buf, force_terminal=True, width=200, markup=False, no_color=True)
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

    def write_streaming(self, text: str) -> None:
        """缓冲流式文本增量，不立即写入 RichLog（避免 in-place 修改问题）。"""
        self._streaming_active = True
        self._streaming_buffer += text

    def finish_streaming(self) -> None:
        """结束流式状态，将缓冲的文本一次性写入 RichLog。"""
        if self._streaming_active and self._streaming_buffer.strip():
            self.write(Text(self._streaming_buffer, style="#c0caf5"))
            self.write(Text(""))
            self.scroll_end(animate=False)
        self._streaming_buffer = ""
        self._streaming_active = False

    def write_tool_summary(self, name: str, input_str: str, text: str) -> None:
        """写入工具调用摘要（折叠显示），同时存储完整内容用于展开。"""
        # 存储完整内容（入参 + 结果）
        self._tool_details.append((name, input_str, text))
        # 截断入参到 80 字符
        input_summary = input_str.replace("\n", " ").strip()
        if len(input_summary) > 80:
            input_summary = input_summary[:80] + "..."
        # 截断结果到 60 字符
        result_summary = text.replace("\n", " ").strip()
        if len(result_summary) > 60:
            result_summary = result_summary[:60] + "..."
        line = f"\u2699 {name}({input_summary}) \u2192 {result_summary}"
        self.write(Text(line, style="#565f89"))
        self.scroll_end(animate=False)

    def clear_tool_details(self) -> None:
        """清空工具详情（新查询开始时调用）"""
        self._tool_details = []

    @property
    def tool_details(self) -> list[tuple[str, str, str]]:
        """获取存储的工具调用详情列表: [(name, input, result)]"""
        return self._tool_details
