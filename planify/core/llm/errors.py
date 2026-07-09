"""LLM Provider 异常类层级。"""


class LLMError(Exception):
    """Provider 层异常基类。"""

    retryable: bool = False

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class LLMAuthError(LLMError):
    """401/403：认证或权限错误，不重试。"""

    retryable = False


class LLMRateLimitError(LLMError):
    """429：限流，可重试。"""

    retryable = True


class LLMContextLengthError(LLMError):
    """413/400 with context_length_exceeded：上下文超限，不重试。"""

    retryable = False


class LLMNetworkError(LLMError):
    """网络层错误（连接超时、DNS 等），可重试。"""

    retryable = True
