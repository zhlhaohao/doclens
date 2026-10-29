"""slides-gen 渲染与验收引擎：中间格式 md → 单文件 HTML 演示稿 + 视觉验收。"""

from .html_renderer import Renderer  # noqa: F401
from .parser import Block, Deck, Slide, parse_markdown  # noqa: F401
from .qa import qa_deck  # noqa: F401

__all__ = ["Renderer", "Deck", "Slide", "Block", "parse_markdown", "qa_deck"]
