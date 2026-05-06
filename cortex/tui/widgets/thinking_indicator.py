"""思考中指示器组件 - 带旋转动画"""

from textual.widgets import Static
from textual.timer import Timer


class ThinkingIndicator(Static):
    """旋转动画的思考指示器"""

    DEFAULT_CSS = """
    ThinkingIndicator {
        height: 1;
        background: #000000;
        padding: 0 1;
    }
    ThinkingIndicator > .thinking-text {
        color: #7dcfff;
        text-style: italic;
    }
    """

    SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

    def __init__(self):
        super().__init__("", id="thinking-indicator")
        self._timer: Timer | None = None
        self._frame: int = 0
        self._message: str = "思考中"

    def on_mount(self) -> None:
        """初始隐藏"""
        self.display = False

    def start(self, message: str = "思考中") -> None:
        """开始思考动画"""
        self._message = message
        self._frame = 0
        self._update_text()
        self.display = True
        self._timer = self.set_interval(0.1, self._tick)

    def _tick(self) -> None:
        """Timer 回调 - 更新动画帧"""
        self._frame = (self._frame + 1) % len(self.SPINNER_FRAMES)
        self._update_text()

    def _update_text(self) -> None:
        """更新显示文本"""
        spinner = self.SPINNER_FRAMES[self._frame]
        self.update(f"{self._message}... {spinner}")

    def stop(self) -> None:
        """停止思考动画"""
        if self._timer:
            self._timer.stop()
            self._timer = None
        self.display = False
