"""estimate_tokens + microcompact 单元测试。"""
import pytest

from planify.context.compact import estimate_tokens, microcompact


# ─── estimate_tokens ───

def test_estimate_tokens_empty():
    assert estimate_tokens([]) == 0


def test_estimate_tokens_single_user_string():
    # JSON 序列化后约 49 字符 / 4 ≈ 12 tokens
    msgs = [{"role": "user", "content": "abcdefghijklmnop"}]
    assert estimate_tokens(msgs) == 12


def test_estimate_tokens_mixed_messages():
    msgs = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": [{"type": "text", "text": "hello"}]},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "t1", "content": "world"}
        ]},
    ]
    assert estimate_tokens(msgs) > 0
    json_chars = len(str(msgs))
    assert estimate_tokens(msgs) == json_chars // 4


# ─── microcompact ───

def test_microcompact_no_tool_results_unchanged():
    msgs = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]
    snapshot = [dict(m) for m in msgs]
    microcompact(msgs)
    assert msgs == snapshot


def test_microcompact_exactly_three_preserved():
    msgs = [
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": f"t{i}", "content": "x" * 200}
            for i in range(3)
        ]}
    ]
    microcompact(msgs)
    contents = [p["content"] for p in msgs[0]["content"]]
    assert all(c == "x" * 200 for c in contents)


def test_microcompact_four_clears_oldest():
    msgs = [
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": f"t{i}", "content": "x" * 200}
            for i in range(4)
        ]}
    ]
    microcompact(msgs)
    contents = [p["content"] for p in msgs[0]["content"]]
    assert contents[0] == "[cleared]"
    assert contents[1] == "x" * 200
    assert contents[2] == "x" * 200
    assert contents[3] == "x" * 200


def test_microcompact_ten_clears_first_seven():
    msgs = [
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": f"t{i}", "content": "x" * 200}
            for i in range(10)
        ]}
    ]
    microcompact(msgs)
    contents = [p["content"] for p in msgs[0]["content"]]
    assert sum(1 for c in contents if c == "[cleared]") == 7
    assert sum(1 for c in contents if c == "x" * 200) == 3


def test_microcompact_short_content_not_cleared():
    # content 长度 ≤ 100 不清
    msgs = [
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": f"t{i}", "content": "short"}
            for i in range(4)
        ]}
    ]
    microcompact(msgs)
    contents = [p["content"] for p in msgs[0]["content"]]
    assert contents[0] == "short"


def test_microcompact_long_content_cleared_to_marker():
    # 单个 tool_result（≤3 个）保留；加到 4 个后清最老
    msgs = [
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "t1", "content": "x" * 500}
        ]}
    ]
    microcompact(msgs)
    assert msgs[0]["content"][0]["content"] == "x" * 500
    # 加 3 个 → 共 4 个
    for i in range(2, 5):
        msgs[0]["content"].append(
            {"type": "tool_result", "tool_use_id": f"t{i}", "content": "x" * 500}
        )
    microcompact(msgs)
    contents = [p["content"] for p in msgs[0]["content"]]
    assert contents[0] == "[cleared]"
    assert contents[1:] == ["x" * 500, "x" * 500, "x" * 500]


def test_microcompact_non_tool_result_messages_untouched():
    msgs = [
        {"role": "user", "content": "raw text"},
        {"role": "assistant", "content": "raw reply"},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "t1", "content": "x" * 500}
        ]},
    ]
    snapshot = [dict(m) for m in msgs]
    microcompact(msgs)
    assert msgs[0] == snapshot[0]
    assert msgs[1] == snapshot[1]
    assert msgs[2]["content"][0]["content"] == "x" * 500
