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
