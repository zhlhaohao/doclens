"""microcompact 微压缩测试：task（子代理）结果豁免清理。"""
from planify.context.compact import microcompact

_LONG = "x" * 500  # >100 字符才会被清理


def _assistant_tool_use(call_id: str, name: str) -> dict:
    return {
        "role": "assistant",
        "content": [{"type": "tool_use", "id": call_id, "name": name, "input": {}}],
    }


def _user_tool_result(call_id: str, content: str) -> dict:
    return {
        "role": "user",
        "content": [{"type": "tool_result", "tool_use_id": call_id, "content": content}],
    }


def _collect(messages):
    """返回 {tool_use_id: content} 便于断言。"""
    out = {}
    for msg in messages:
        if msg["role"] == "user" and isinstance(msg.get("content"), list):
            for part in msg["content"]:
                out[part["tool_use_id"]] = part["content"]
    return out


class TestMicrocompact:
    def test_keeps_only_last_3_normal_results(self):
        msgs = []
        for i in range(5):
            msgs.append(_assistant_tool_use(f"r{i}", "read_document"))
            msgs.append(_user_tool_result(f"r{i}", _LONG))
        microcompact(msgs, keep=3)
        results = _collect(msgs)
        assert results["r0"] == "[cleared]"
        assert results["r1"] == "[cleared]"
        assert results["r2"] == _LONG  # 最近 3 个保留
        assert results["r4"] == _LONG

    def test_task_results_are_exempt(self):
        """并发子代理场景：6 个 task 结果 + 后续普通工具结果，task 全部保留。"""
        msgs = []
        # 一轮 6 个并发 task（summarize-files 章节并发模式）
        msgs.append({
            "role": "assistant",
            "content": [
                {"type": "tool_use", "id": f"t{i}", "name": "task", "input": {}}
                for i in range(6)
            ],
        })
        msgs.append({
            "role": "user",
            "content": [
                {"type": "tool_result", "tool_use_id": f"t{i}", "content": _LONG}
                for i in range(6)
            ],
        })
        # 主代理随后自己又调了 4 个普通工具（超过保留数，触发清理）
        for i in range(4):
            msgs.append(_assistant_tool_use(f"r{i}", "read_document"))
            msgs.append(_user_tool_result(f"r{i}", _LONG))

        microcompact(msgs, keep=3)
        results = _collect(msgs)
        # 全部 6 个 task 结果原样保留
        for i in range(6):
            assert results[f"t{i}"] == _LONG
        # 普通工具结果只留最近 3 个
        assert results["r0"] == "[cleared]"
        assert results["r3"] == _LONG

    def test_short_content_not_cleared(self):
        msgs = []
        for i in range(5):
            msgs.append(_assistant_tool_use(f"r{i}", "bash"))
            msgs.append(_user_tool_result(f"r{i}", "ok"))  # ≤100 字符不清
        microcompact(msgs, keep=3)
        results = _collect(msgs)
        assert results["r0"] == "ok"

    def test_default_keep_10(self):
        """默认保留 10 个（缓存友好）：5 个结果全留；12 个结果只清最老 2 个。"""
        msgs = []
        for i in range(5):
            msgs.append(_assistant_tool_use(f"r{i}", "read_document"))
            msgs.append(_user_tool_result(f"r{i}", _LONG))
        microcompact(msgs)
        assert all(v == _LONG for v in _collect(msgs).values())

        msgs = []
        for i in range(12):
            msgs.append(_assistant_tool_use(f"r{i}", "read_document"))
            msgs.append(_user_tool_result(f"r{i}", _LONG))
        microcompact(msgs)
        results = _collect(msgs)
        assert results["r0"] == "[cleared]"
        assert results["r1"] == "[cleared]"
        assert results["r2"] == _LONG
        assert results["r11"] == _LONG

    def test_min_estimated_tokens_gate(self):
        """低于 token 下限完全不动历史（小上下文保持前缀绝对稳定）。"""
        msgs = []
        for i in range(12):
            msgs.append(_assistant_tool_use(f"r{i}", "read_document"))
            msgs.append(_user_tool_result(f"r{i}", _LONG))

        gated = [dict(m) for m in msgs]
        microcompact(gated, min_estimated_tokens=10**9)  # 永远达不到
        assert all(v == _LONG for v in _collect(gated).values())

        microcompact(msgs, min_estimated_tokens=1)  # 立即触发
        assert _collect(msgs)["r0"] == "[cleared]"


class _FakeProvider:
    """auto_compact 摘要调用的最小桩。"""

    model = "fake"

    def chat(self, messages, system, tools, max_tokens=8000):
        from planify.core.llm.types import LLMResponse, TextBlock

        return LLMResponse(
            content=[TextBlock(text="对话摘要")],
            stop_reason="end_turn",
            model="fake",
            usage={},
        )


class TestAutoCompact:
    def test_accepts_str_transcript_dir(self, tmp_path):
        """transcript_dir 传 str（历史调用方行为）也能正常建目录写 transcript。"""
        from planify.context.compact import auto_compact

        msgs = [
            {"role": "user", "content": "问题"},
            {"role": "assistant", "content": "回答"},
        ]
        out = auto_compact(msgs, _FakeProvider(), str(tmp_path / ".transcripts"))
        transcripts = list((tmp_path / ".transcripts").glob("transcript_*.jsonl"))
        assert len(transcripts) == 1
        assert "对话摘要" in out[0]["content"]
        assert out[1]["role"] == "assistant"
