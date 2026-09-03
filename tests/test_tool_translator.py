"""tool_translator.messages_anthropic_to_openai 的 user 消息翻译测试。

重点钉住：image block → OpenAI image_url 多模态数组（doclens.vision_client
经此翻译走统一 provider）、tool_result → role=tool 原行为不回归、纯文本
user 消息保持字符串形态（对话主链路）。
"""
from planify.core.llm.tool_translator import messages_anthropic_to_openai


def test_user_image_plus_text_becomes_multimodal_array():
    """image + text → 单条 user 消息，content 为 OpenAI 多模态数组。"""
    msgs = [{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/webp", "data": "QUJD"}},
            {"type": "text", "text": "描述这张图"},
        ],
    }]
    out = messages_anthropic_to_openai(msgs)
    assert len(out) == 1
    assert out[0]["role"] == "user"
    content = out[0]["content"]
    assert isinstance(content, list)
    assert content[0] == {
        "type": "image_url",
        "image_url": {"url": "data:image/webp;base64,QUJD"},
    }
    assert content[1] == {"type": "text", "text": "描述这张图"}


def test_user_non_base64_image_degrades_to_text():
    """非 base64 source（不支持的形态）降级为文本块，不产生非法 image_url。"""
    msgs = [{
        "role": "user",
        "content": [{"type": "image", "source": {"type": "url", "url": "https://x/1.png"}}],
    }]
    out = messages_anthropic_to_openai(msgs)
    # 单 text 块聚合为纯字符串（与主链路形态一致），不抛错、不丢消息
    assert len(out) == 1
    assert out[0]["role"] == "user"
    assert out[0]["content"] == str(msgs[0]["content"][0])
    assert "image_url" not in out[0]["content"]


def test_user_tool_result_unchanged():
    """tool_result → role=tool，id 原样回传（对话主链路回归保护）。"""
    msgs = [{
        "role": "user",
        "content": [{"type": "tool_result", "tool_use_id": "call_1", "content": "ok"}],
    }]
    out = messages_anthropic_to_openai(msgs)
    assert out == [{"role": "tool", "tool_call_id": "call_1", "content": "ok"}]


def test_user_plain_string_content_unchanged():
    """user 消息 content 为字符串时直接透传（对话主链路最常见形态）。"""
    msgs = [{"role": "user", "content": "你好"}]
    assert messages_anthropic_to_openai(msgs) == msgs


def test_user_tool_result_then_text_order_preserved():
    """混合块：tool 消息在前、聚合 user 消息在后（与历史顺序一致）。"""
    msgs = [{
        "role": "user",
        "content": [
            {"type": "tool_result", "tool_use_id": "call_1", "content": "ok"},
            {"type": "text", "text": "继续"},
        ],
    }]
    out = messages_anthropic_to_openai(msgs)
    assert out[0] == {"role": "tool", "tool_call_id": "call_1", "content": "ok"}
    assert out[1] == {"role": "user", "content": "继续"}
