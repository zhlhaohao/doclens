"""converter 包：PPT 中间格式 md → PPTX。入口 `python -m ...converter deck.md -o deck.pptx`。"""

from .parser import Deck, Slide, Block, Run, Warnings, parse_markdown  # noqa: F401
from .renderer import Converter  # noqa: F401

__all__ = ["Deck", "Slide", "Block", "Run", "Warnings", "parse_markdown", "Converter"]
