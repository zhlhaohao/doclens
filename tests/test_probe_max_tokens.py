"""probe_max_tokens 二分探测逻辑测试（mock provider，无网络）。"""
import pytest

import planify.core.llm as llm_module
from doclens.web_v2.probe_max_tokens import ProbeError, probe_max_tokens


class _FakeClient:
    """模拟服务端：max_tokens > limit 时抛"超限"错误，否则成功。"""

    def __init__(self, limit: int):
        self.limit = limit
        self.calls: list[int] = []

    def chat(self, messages, system, tools, max_tokens=8000):
        self.calls.append(max_tokens)
        if max_tokens > self.limit:
            raise Exception(f"invalid request: max_tokens {max_tokens} exceeds limit {self.limit}")
        return object()


@pytest.fixture
def patch_provider(monkeypatch):
    """替换 create_provider，返回指定上限的假客户端。返回客户端以便断言调用。"""
    holder = {}

    def _factory(config):
        return holder["client"]

    monkeypatch.setattr(llm_module, "create_provider", _factory)

    def _install(client):
        holder["client"] = client
        return client

    return _install


class TestProbeMaxTokens:
    def test_finds_exact_limit(self, patch_provider):
        client = patch_provider(_FakeClient(limit=8192))
        answer, attempts = probe_max_tokens("anthropic", "", "m", "k")
        assert answer == 8192
        # 预检 1 次 + 二分约 log2(262144)=18 次
        assert 18 <= attempts <= 20
        assert client.calls[0] == 1  # 先用最小值验证链路

    def test_limit_at_high_boundary(self, patch_provider):
        patch_provider(_FakeClient(limit=262144))
        answer, _ = probe_max_tokens("anthropic", "", "m", "k")
        assert answer == 262144

    def test_limit_one(self, patch_provider):
        patch_provider(_FakeClient(limit=1))
        answer, _ = probe_max_tokens("anthropic", "", "m", "k")
        assert answer == 1

    def test_aborts_when_min_request_fails(self, patch_provider):
        patch_provider(_FakeClient(limit=0))  # max_tokens=1 都被拒
        with pytest.raises(ProbeError, match="最小请求即失败"):
            probe_max_tokens("anthropic", "", "m", "k")

    def test_aborts_on_non_max_tokens_error(self, patch_provider):
        class _FlakyClient(_FakeClient):
            def chat(self, messages, system, tools, max_tokens=8000):
                if max_tokens == 131072:
                    raise Exception("connection reset by peer")  # 非超限错误
                return super().chat(messages, system, tools, max_tokens)

        patch_provider(_FlakyClient(limit=262144))
        with pytest.raises(ProbeError, match="非超限错误"):
            probe_max_tokens("anthropic", "", "m", "k")
