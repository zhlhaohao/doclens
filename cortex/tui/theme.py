"""Tokyo Night 主题配色 + 全局 CSS"""

# 颜色常量
COLORS = {
    "bg": "#1a1b26",
    "panel": "#24283b",
    "border": "#3b3d57",
    "primary": "#7aa2f7",
    "success": "#9ece6a",
    "warning": "#e0af68",
    "accent": "#bb9af7",
    "text": "#c0caf5",
    "dim": "#565f89",
    "error": "#f7768e",
}

# 全局 App CSS
APP_CSS = """
Screen {
    layout: vertical;
    background: $bg;
}

HeaderBar {
    dock: top;
    height: 1;
    background: $panel;
    color: $primary;
    padding: 0 1;
}

ContentArea {
    height: 1fr;
    background: $bg;
    border: none;
    padding: 0 1;
    scrollbar-size: 1 1;
}

InputBox {
    dock: bottom;
    height: 3;
    background: $panel;
    border-top: solid $border;
    padding: 0 1;
}

StatusBar {
    dock: bottom;
    height: 1;
    background: $panel;
    color: $dim;
    border-top: solid $border;
    padding: 0 1;
}
"""
