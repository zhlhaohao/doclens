"""LLMProvider Protocol 结构性测试。"""
from typing import Any

import pytest

from planify.core.llm.provider import LLMProvider


class _FakeProvider:
    """满足 LLMProvider Protocol 的最小实现。"""

    def chat(
        self,
        messages: list[dict],
        system: str,
        tools: list,
        max_tokens: int = 8000,
    ) -> Any:
        return None

    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list,
        max_tokens: int = 8000,
    ):
        yield None

    def count_tokens(self, text: str) -> int:
        return len(text)


def test_fake_provider_satisfies_protocol():
    fake = _FakeProvider()
    # runtime_checkable Protocol
    assert isinstance(fake, LLMProvider)


def test_missing_method_breaks_protocol():
    class _Broken:
        def chat(self, *a, **kw):  # noqa: ARG002
            return None
        # missing stream and count_tokens

    assert not isinstance(_Broken(), LLMProvider)
