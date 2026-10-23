# -*- coding: utf-8 -*-
"""LLM HTTP 客户端超时测试（planify.core.llm.timeouts）。

红判据背景（2026-10-23 事故）：插话汇报调用 200 OK 之后静默 11.6 分钟，
整轮对话被单个 LLM 调用钉死；SDK 默认 read=600s 且按「字节间隔」计，
端点持续挂着不关连接时永不触发。
"""
import httpx
import pytest

from planify.core.llm import timeouts


class TestResolve:
    def test_defaults(self, monkeypatch):
        for env in (
            "PLANIFY_LLM_TIMEOUT_CONNECT",
            "PLANIFY_LLM_TIMEOUT_READ",
            "PLANIFY_LLM_TIMEOUT_WRITE",
            "PLANIFY_LLM_TIMEOUT_POOL",
        ):
            monkeypatch.delenv(env, raising=False)
        t = timeouts.resolve_http_timeout()
        assert t == {
            "connect": timeouts.DEFAULT_CONNECT_TIMEOUT,
            "read": timeouts.DEFAULT_READ_TIMEOUT,
            "write": timeouts.DEFAULT_WRITE_TIMEOUT,
            "pool": timeouts.DEFAULT_POOL_TIMEOUT,
        }
        # read 必须显著小于 SDK 默认 600s——否则静默挂起仍是 10 分钟量级
        assert t["read"] < 600

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv("PLANIFY_LLM_TIMEOUT_READ", "45")
        assert timeouts.resolve_http_timeout()["read"] == 45.0

    @pytest.mark.parametrize("bad", ["abc", "0", "-3"])
    def test_invalid_falls_back_to_default(self, monkeypatch, bad):
        monkeypatch.setenv("PLANIFY_LLM_TIMEOUT_READ", bad)
        assert timeouts.resolve_http_timeout()["read"] == timeouts.DEFAULT_READ_TIMEOUT


class TestBuild:
    def test_builds_httpx_timeout(self, monkeypatch):
        monkeypatch.delenv("PLANIFY_LLM_TIMEOUT_READ", raising=False)
        t = timeouts.build_httpx_timeout(httpx)
        assert isinstance(t, httpx.Timeout)
        assert t.read == timeouts.DEFAULT_READ_TIMEOUT

    def test_module_without_timeout_returns_none(self):
        class NoTimeoutModule:
            pass

        assert timeouts.build_httpx_timeout(NoTimeoutModule()) is None


class TestProviderWiring:
    def test_anthropic_async_client_has_timeout(self):
        """provider 的 async 客户端必须带显式超时（不能吃 SDK 默认 600s）。"""
        from planify.core.llm.anthropic_provider import AnthropicProvider

        provider = AnthropicProvider(
            api_key="k", base_url="https://example.invalid", model="m"
        )
        client = provider._ensure_async_client()
        timeout = client.timeout
        assert timeout.read == timeouts.resolve_http_timeout()["read"]
        assert timeout.read < 600

    def test_openai_compat_async_client_has_timeout(self):
        from planify.core.llm.openai_compat_provider import OpenAICompatProvider

        provider = OpenAICompatProvider(
            api_key="k", base_url="https://example.invalid/v1", model="m"
        )
        client = provider._ensure_async_client()
        assert client.timeout.read == timeouts.resolve_http_timeout()["read"]
