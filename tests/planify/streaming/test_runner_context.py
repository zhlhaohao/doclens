"""验证 _refresh_or_insert_context：刷新或插入 skill-context 消息。"""
from planify.streaming.runner import _refresh_or_insert_context


def test_inserts_when_marker_absent():
    messages = [{"role": "user", "content": "hi"}]
    _refresh_or_insert_context(messages, "MARKER", "ctx-MARKER-body")
    assert messages[0]["content"] == "ctx-MARKER-body"
    assert messages[0]["role"] == "user"
    assert messages[1] == {"role": "assistant", "content": "Noted."}
    assert messages[2]["content"] == "hi"  # 原消息后移


def test_replaces_when_marker_present():
    messages = [
        {"role": "user", "content": "old-MARKER-old"},
        {"role": "assistant", "content": "Noted."},
        {"role": "user", "content": "hi"},
    ]
    _refresh_or_insert_context(messages, "MARKER", "new-MARKER-new")
    assert messages[0]["content"] == "new-MARKER-new"
    assert messages[1] == {"role": "assistant", "content": "Noted."}
    assert messages[2]["content"] == "hi"
    assert len(messages) == 3  # 不新增


def test_replaces_in_first_six_slots_only():
    messages = [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": "a2"},
        {"role": "user", "content": "q3"},
        {"role": "assistant", "content": "a3"},
        {"role": "user", "content": "deep-MARKER-old"},  # 超出前 6，忽略
    ]
    _refresh_or_insert_context(messages, "MARKER", "fresh-MARKER")
    assert messages[0]["content"] == "fresh-MARKER"
    assert messages[-1]["content"] == "deep-MARKER-old"  # 未被替换