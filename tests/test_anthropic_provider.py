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
