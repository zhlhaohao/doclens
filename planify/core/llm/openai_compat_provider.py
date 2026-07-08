"""OpenAI 兼容 Provider（Task 10 完整实现）。"""
from typing import Any


class OpenAICompatProvider:  # noqa: D401 - 临时占位
    """占位实现，Task 10 替换。"""

    def __init__(self, *, api_key: str, base_url: str | None, model: str) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    def chat(self, *args: Any, **kwargs: Any) -> Any: ...
    def stream(self, *args: Any, **kwargs: Any) -> Any: ...
    def count_tokens(self, text: str) -> int: ...