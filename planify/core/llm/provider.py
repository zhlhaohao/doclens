"""LLMProvider 协议定义。"""
from typing import Any, Iterator, Protocol, runtime_checkable

from .types import LLMResponse, StreamEvent, Tool


@runtime_checkable
class LLMProvider(Protocol):
    """归一化 LLM Provider 接口。

    所有 Provider（Anthropic 原生、OpenAI 兼容）必须对外呈现此接口，
    调用方只认此接口，不依赖具体 SDK 类型。
    """

    def chat(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> LLMResponse:
        """单次非流式调用。"""
        ...

    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> Iterator[StreamEvent]:
        """流式调用，yield 归一化 StreamEvent。"""
        ...

    def count_tokens(self, text: str) -> int:
        """粗估 token 数。"""
        ...
