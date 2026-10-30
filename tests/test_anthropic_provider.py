"""planify AnthropicProvider 响应块转换测试（离线，仅静态转换函数）。"""
from types import SimpleNamespace

from planify.core.llm.anthropic_provider import AnthropicProvider
from planify.core.llm.types import TextBlock, ToolUseBlock


class TestBlockFromAnthropic:
    def test_text_block(self):
        block = SimpleNamespace(type="text", text="正文")
        out = AnthropicProvider._block_from_anthropic(block)
        assert isinstance(out, TextBlock) and out.text == "正文"

    def test_thinking_block_dropped(self):
        """思考块必须丢弃，否则 str(block) 的 repr 会泄漏进正文。"""
        block = SimpleNamespace(type="thinking", signature="sig", thinking="推理过程")
        assert AnthropicProvider._block_from_anthropic(block) is None

    def test_redacted_thinking_block_dropped(self):
        block = SimpleNamespace(type="redacted_thinking", data="xxx")
        assert AnthropicProvider._block_from_anthropic(block) is None

    def test_tool_use_block(self):
        block = SimpleNamespace(type="tool_use", id="t1", name="search", input={"q": "x"})
        out = AnthropicProvider._block_from_anthropic(block)
        assert isinstance(out, ToolUseBlock) and out.name == "search"

    def test_unknown_block_falls_back_to_text(self):
        block = SimpleNamespace(type="some_future_type")
        out = AnthropicProvider._block_from_anthropic(block)
        assert isinstance(out, TextBlock)


class TestResponseToLLM:
    def test_content_none_tolerated(self):
        """MiniMax /anthropic 在零内容块时回 "content": null（官方回 []），
        SDK 解析为 None——_response_to_llm 必须兜底为空列表而非迭代崩溃。"""
        resp = SimpleNamespace(
            content=None, stop_reason="max_tokens", model="MiniMax-M3.1-Flash",
            usage=SimpleNamespace(
                input_tokens=6, output_tokens=1,
                cache_creation_input_tokens=0, cache_read_input_tokens=0,
            ),
        )
        out = AnthropicProvider._response_to_llm(resp)
        assert out.content == []
        assert out.stop_reason == "max_tokens"

    def test_content_blocks_mapped(self):
        resp = SimpleNamespace(
            content=[SimpleNamespace(type="text", text="hi")],
            stop_reason="end_turn", model="m",
            usage=SimpleNamespace(
                input_tokens=1, output_tokens=1,
                cache_creation_input_tokens=0, cache_read_input_tokens=0,
            ),
        )
        out = AnthropicProvider._response_to_llm(resp)
        assert len(out.content) == 1 and isinstance(out.content[0], TextBlock)


class TestPromptCaching:
    """cache_control 断点：system / tools 末位 / 最后一条 user 消息。"""

    def test_system_blocks_ephemeral(self):
        blocks = AnthropicProvider._system_blocks("sys prompt")
        assert blocks == [{
            "type": "text",
            "text": "sys prompt",
            "cache_control": {"type": "ephemeral"},
        }]

    def test_system_blocks_empty(self):
        assert AnthropicProvider._system_blocks("") == []

    def test_tools_breakpoint_on_last_only(self):
        tools = [
            SimpleNamespace(name=f"t{i}", description="d", input_schema={"type": "object"})
            for i in range(3)
        ]
        payload = AnthropicProvider._tools_with_cache_breakpoint(tools)
        assert "cache_control" not in payload[0]
        assert "cache_control" not in payload[1]
        assert payload[2]["cache_control"] == {"type": "ephemeral"}
        assert AnthropicProvider._tools_with_cache_breakpoint([]) == []

    def test_server_tools_appended_verbatim_breakpoint_moved(self):
        """服务端工具（如 web_search_20250305）原样附加，cache 断点移到最后。"""
        client_tool = SimpleNamespace(name="t", description="d", input_schema={"type": "object"})
        server_tool = {"type": "web_search_20250305", "name": "web_search_20250305", "max_uses": 8}
        payload = AnthropicProvider._tools_with_cache_breakpoint(
            [client_tool], [server_tool]
        )
        assert len(payload) == 2
        # 服务端字段完整保留（不经 Tool dataclass 转换）
        assert payload[1]["type"] == "web_search_20250305"
        assert payload[1]["max_uses"] == 8
        # 断点在整体最后一个（客户端工具不再带）
        assert "cache_control" not in payload[0]
        assert payload[1]["cache_control"] == {"type": "ephemeral"}
        # 不污染调用方 dict（浅拷贝）
        assert "cache_control" not in server_tool

    def test_mark_cache_tail_string_content(self):
        msgs = [
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "a1"},
            {"role": "user", "content": "q2"},
        ]
        out = AnthropicProvider._mark_cache_tail(msgs)
        # 最后一条 user 转 block 形式并打断点
        assert out[2]["content"] == [{
            "type": "text", "text": "q2", "cache_control": {"type": "ephemeral"},
        }]
        # 前面的消息原样
        assert out[0]["content"] == "q1"
        assert out[1]["content"] == "a1"
        # 不修改传入的历史（断点不随历史回传，每轮重打）
        assert msgs[2]["content"] == "q2"

    def test_mark_cache_tail_tool_result_content(self):
        msgs = [
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "x", "content": "big output"},
            ]},
        ]
        out = AnthropicProvider._mark_cache_tail(msgs)
        last_block = out[0]["content"][-1]
        assert last_block["cache_control"] == {"type": "ephemeral"}
        assert last_block["tool_use_id"] == "x"
        assert "cache_control" not in msgs[0]["content"][-1]

    def test_mark_cache_tail_no_user_message(self):
        msgs = [{"role": "assistant", "content": "a"}]
        out = AnthropicProvider._mark_cache_tail(msgs)
        assert out == msgs


class TestThinkingDepthRequestKwargs:
    """思考深度档位 → anthropic 请求参数注入（离线，_request_kwargs 纯函数）。"""

    @staticmethod
    def _kwargs(depth: str, max_tokens: int = 8000, override: str | None = None):
        from unittest.mock import patch

        with patch("planify.core.llm.anthropic_provider.Anthropic"), \
             patch("planify.core.llm.anthropic_provider.AsyncAnthropic"):
            p = AnthropicProvider(
                api_key="k", base_url=None, model="m", thinking_depth=depth,
            )
        return p._request_kwargs([], "sys", [], max_tokens, None, override)

    def test_auto_sends_nothing(self):
        kw = self._kwargs("auto")
        assert "thinking" not in kw and "output_config" not in kw
        assert kw["max_tokens"] == 8000

    def test_off_sends_disabled(self):
        kw = self._kwargs("off")
        assert kw["thinking"] == {"type": "disabled"}
        assert "output_config" not in kw and kw["max_tokens"] == 8000

    def test_low_dual_send_budget_plus_effort(self):
        kw = self._kwargs("low")
        assert kw["thinking"] == {"type": "enabled", "budget_tokens": 2048}
        assert kw["output_config"] == {"effort": "low"}
        # budget 叠加进 max_tokens，可见输出不缩水
        assert kw["max_tokens"] == 8000 + 2048

    def test_high_budget_16384(self):
        assert self._kwargs("high")["thinking"]["budget_tokens"] == 16384

    def test_budget_clamped_to_ceiling(self):
        """budget 叠加超公共上限时钳制：GLM 端硬限 131072，叠加 16384 会 400。"""
        kw = self._kwargs("high", max_tokens=131072)
        assert kw["max_tokens"] == 131072
        assert kw["thinking"]["budget_tokens"] == 16384

    def test_budget_no_clamp_below_ceiling(self):
        kw = self._kwargs("low", max_tokens=8000)
        assert kw["max_tokens"] == 8000 + 2048

    def test_per_call_override_to_auto(self):
        """每调用级覆盖：构造 low、调用时显式 auto → 不发思考参数。"""
        kw = self._kwargs("low", override="auto")
        assert "thinking" not in kw and "output_config" not in kw
        assert kw["max_tokens"] == 8000

    def test_invalid_depth_normalizes_to_auto(self):
        kw = self._kwargs("bogus")
        assert "thinking" not in kw and "output_config" not in kw

    def test_empty_depth_normalizes_to_auto(self):
        kw = self._kwargs("")
        assert "thinking" not in kw and "output_config" not in kw


class TestThinkingDepthOpenAICompat:
    """思考深度档位 → openai_compat 请求参数注入（离线，_request_kwargs 纯函数）。"""

    @staticmethod
    def _kwargs(depth: str, override: str | None = None):
        from unittest.mock import patch

        from planify.core.llm.openai_compat_provider import OpenAICompatProvider

        with patch("planify.core.llm.openai_compat_provider.OpenAI"), \
             patch("planify.core.llm.openai_compat_provider.AsyncOpenAI"):
            p = OpenAICompatProvider(
                api_key="k", base_url=None, model="m", thinking_depth=depth,
            )
        return p._request_kwargs([], "sys", [], 8000, False, None, override)

    def test_auto_sends_nothing(self):
        assert "reasoning_effort" not in self._kwargs("auto")

    def test_off_maps_to_none(self):
        assert self._kwargs("off")["reasoning_effort"] == "none"

    def test_levels_pass_through(self):
        for lv in ("low", "medium", "high"):
            assert self._kwargs(lv)["reasoning_effort"] == lv

    def test_per_call_override(self):
        assert "reasoning_effort" not in self._kwargs("high", override="auto")
        assert self._kwargs("auto", override="high")["reasoning_effort"] == "high"


class TestThinkingDepthRuntimeHotUpdate:
    """update_llm_config 热更新：thinking_depth 落 RuntimeConfig 并进新 Provider。"""

    def test_update_rebuilds_provider_with_depth(self):
        from unittest.mock import patch

        from planify.core.llm.factory import create_provider
        from planify.core.runtime import AgentRuntime, RuntimeConfig

        captured = {}

        def fake_create(config):
            captured.update(config)
            return object()

        with patch("planify.core.llm.create_provider", fake_create), \
             patch("planify.core.llm.factory.create_provider", fake_create):
            rt = AgentRuntime(
                user_id="u",
                config=RuntimeConfig(workdir=".", model_id="m", api_key="k"),
            )
            rt.update_llm_config(
                protocol="openai_compat",
                model_id="m2",
                planify_thinking_depth="high",
            )
        assert captured["thinking_depth"] == "high"
        assert rt.config.planify_thinking_depth == "high"

    def test_update_empty_depth_falls_back_auto(self):
        from unittest.mock import patch

        from planify.core.runtime import AgentRuntime, RuntimeConfig

        captured = {}

        def fake_create(config):
            captured.update(config)
            return object()

        with patch("planify.core.llm.create_provider", fake_create), \
             patch("planify.core.llm.factory.create_provider", fake_create):
            rt = AgentRuntime(
                user_id="u",
                config=RuntimeConfig(workdir=".", model_id="m", api_key="k"),
            )
            rt.update_llm_config(planify_thinking_depth="")
        assert captured["thinking_depth"] == "auto"
        assert rt.config.planify_thinking_depth == "auto"
