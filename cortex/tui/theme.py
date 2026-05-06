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

# 全局 App CSS (使用硬编码颜色值，Textual 不支持自定义 CSS 变量)
APP_CSS = """
Screen {
    layout: vertical;
    background: #000000;
    overflow: hidden;
    padding: 1 2;
}

HeaderBar {
    height: 1;
    background: #24283b;
    color: #7aa2f7;
    padding: 0 1;
}

ContentArea {
    height: 1fr;
    background: #000000;
    border: none;
    padding: 0 1;
    scrollbar-size: 1 1;
}

InputBox {
    height: 3;
    background: #000000;
    border-top: solid #3b3d57;
    border-bottom: solid #3b3d57;
    padding: 0 1;
}

StatusBar {
    height: 1;
    background: #24283b;
    color: #565f89;
    padding: 0 1;
}
"""
