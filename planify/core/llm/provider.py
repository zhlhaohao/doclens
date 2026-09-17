"""LLMProvider 协议定义。"""
from typing import TYPE_CHECKING, AsyncIterator, Iterator, Optional, Protocol, runtime_checkable

from .types import LLMResponse, StreamEvent, Tool

if TYPE_CHECKING:
    from .trace import LLMTracer


@runtime_checkable
class LLMProvider(Protocol):
    """归一化 LLM Provider 接口。

    所有 Provider（Anthropic 原生、OpenAI 兼容）必须对外呈现此接口，
    调用方只认此接口，不依赖具体 SDK 类型。

    同步方法（chat/stream）服务旧 REPL、teammate、subagent 等同步路径；
    异步方法（achat/astream）服务事件循环内调用方（StreamingAgent 在
    ASGI 主 loop 上直跑），async 客户端在具体实现中惰性初始化。

    tracer（可选）：LLM 追踪落盘（调试 / 缓存命中率观测），None 即不记录。
    由调用方按会话创建、逐调用传入（provider 实例跨会话共享，不能挂实例上）。
    """

    def chat(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
        tracer: Optional["LLMTracer"] = None,
    ) -> LLMResponse:
        """单次非流式调用。"""
        ...

    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
        tracer: Optional["LLMTracer"] = None,
    ) -> Iterator[StreamEvent]:
        """流式调用，yield 归一化 StreamEvent。"""
        ...

    async def achat(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
        tracer: Optional["LLMTracer"] = None,
    ) -> LLMResponse:
        """单次非流式调用（async 客户端，不阻塞事件循环）。"""
        ...

    def astream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
        tracer: Optional["LLMTracer"] = None,
    ) -> AsyncIterator[StreamEvent]:
        """流式调用（async 客户端），async for 消费归一化 StreamEvent。"""
        ...

    def count_tokens(self, text: str) -> int:
        """粗估 token 数。"""
        ...
