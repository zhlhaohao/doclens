"""Provider 异常类测试。"""
import pytest

from planify.core.llm.errors import (
    LLMAuthError,
    LLMContextLengthError,
    LLMError,
    LLMNetworkError,
    LLMRateLimitError,
)


def test_all_inherit_from_llm_error():
    for cls in [LLMAuthError, LLMRateLimitError, LLMContextLengthError, LLMNetworkError]:
        assert issubclass(cls, LLMError)


def test_catch_llm_error_catches_subclasses():
    try:
        raise LLMAuthError("bad key")
    except LLMError as e:
        assert "bad key" in str(e)


def test_status_code_attribute():
    err = LLMRateLimitError("slow down", status_code=429)
    assert err.status_code == 429


def test_retryable_flag():
    assert LLMRateLimitError("x").retryable is True
    assert LLMAuthError("x").retryable is False
    assert LLMContextLengthError("x").retryable is False
    assert LLMNetworkError("x").retryable is True
