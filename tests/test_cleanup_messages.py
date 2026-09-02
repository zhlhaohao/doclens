"""_cleanup_messages 的协议合法性回归测试（SSE 审查 #7）。

实测发现的 bug：tool_use 检测只查 getattr(block, "type")，对 runner 自己
append 的 dict block 永远漏检 → 孤儿 tool_use（配对 tool_result 被跳过）
进入 cleaned history，CLI/TUI 下轮回放触发 Anthropic 400。
另：中断残留的 content=[] 空 assistant 消息必须剔除。
"""

from planify.streaming.runner import StreamingAgent


def _cleanup(messages):
    # _cleanup_messages 不触碰实例状态，绕过 __init__ 直接调
    return StreamingAgent._cleanup_messages(None, messages)


class _FakeBlock:
    """模拟 Pydantic 模型 block（属性访问 .type）"""

    def __init__(self, type_: str):
        self.type = type_


def test_dict_tool_use_filtered_with_orphan_result():
    """dict 形态的 tool_use assistant 必须被过滤（原 bug：漏检导致孤儿 tool_use）"""
    messages = [
        {"role": "user", "content": "问题"},
        {
            "role": "assistant",
            "content": [{"type": "tool_use", "id": "tu_1", "name": "t", "input": {}}],
        },
        {
            "role": "user",
            "content": [{"type": "tool_result", "tool_use_id": "tu_1", "content": "ok"}],
        },
        {"role": "assistant", "content": "最终回答"},
    ]
    cleaned = _cleanup(messages)
    assert cleaned == [
        {"role": "user", "content": "问题"},
        {"role": "assistant", "content": "最终回答"},
    ]


def test_pydantic_tool_use_still_filtered():
    """Pydantic 模型形态的 tool_use 保持过滤（原有行为不回归）"""
    messages = [
        {"role": "user", "content": "问题"},
        {"role": "assistant", "content": [_FakeBlock("tool_use")]},
        {"role": "assistant", "content": "回答"},
    ]
    cleaned = _cleanup(messages)
    assert all(
        not (isinstance(m["content"], list)) for m in cleaned
    )
    assert cleaned[-1]["content"] == "回答"


def test_empty_content_assistant_dropped():
    """中断残留的 content=[] 空 assistant 消息必须剔除"""
    messages = [
        {"role": "user", "content": "问题"},
        {"role": "assistant", "content": []},
    ]
    assert _cleanup(messages) == [{"role": "user", "content": "问题"}]


def test_non_tool_list_assistant_kept():
    """不含 tool_use 的非空 list assistant（如纯 text block）保留"""
    messages = [
        {"role": "user", "content": "问题"},
        {"role": "assistant", "content": [{"type": "text", "text": "hi"}]},
    ]
    cleaned = _cleanup(messages)
    assert len(cleaned) == 2
