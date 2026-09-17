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

    def test_returns_cleared_tool_use_ids(self):
        """返回值 = 实际被清理的 tool_use_id（ADR-0026 微压缩落库重放）。"""
        msgs = []
        for i in range(12):
            msgs.append(_assistant_tool_use(f"r{i}", "read_document"))
            msgs.append(_user_tool_result(f"r{i}", _LONG))
        cleared = microcompact(msgs)
        assert cleared == ["r0", "r1"]
        assert _collect(msgs)["r0"] == "[cleared]"

    def test_returns_empty_when_nothing_cleared(self):
        """门控不触发 / 豁免（task）/ 短内容 / 未超保留数 → 一律空列表。"""
        # 未超保留数
        msgs = [_assistant_tool_use("r0", "bash"), _user_tool_result("r0", _LONG)]
        assert microcompact(msgs) == []
        # 门控不触发
        msgs = []
        for i in range(12):
            msgs.append(_assistant_tool_use(f"r{i}", "read_document"))
            msgs.append(_user_tool_result(f"r{i}", _LONG))
        assert microcompact(msgs, min_estimated_tokens=10**9) == []
        # 豁免工具（task）+ 短内容不进清理清单
        msgs = [
            _assistant_tool_use("t0", "task"),
            _user_tool_result("t0", _LONG),
            _assistant_tool_use("s0", "bash"),
            _user_tool_result("s0", "ok"),
        ]
        for i in range(12):  # 普通长内容凑数触发清理（> 默认 keep 10）
            msgs.append(_assistant_tool_use(f"r{i}", "read_document"))
            msgs.append(_user_tool_result(f"r{i}", _LONG))
        assert microcompact(msgs) == ["r0", "r1"]
        assert _collect(msgs)["t0"] == _LONG
        assert _collect(msgs)["s0"] == "ok"


class _FakeProvider:
    """auto_compact 摘要调用的最小桩（捕获请求供断言）。"""

    model = "fake"

    def __init__(self):
        self.captured = {}

    def chat(self, messages, system, tools, max_tokens=8000, tracer=None):
        from planify.core.llm.types import LLMResponse, TextBlock

        self.captured = {
            "messages": messages, "system": system,
            "tools": tools, "max_tokens": max_tokens,
        }
        return LLMResponse(
            content=[TextBlock(text="对话摘要")],
            stop_reason="end_turn",
            model="fake",
            usage={},
        )


class TestRenderForSummary:
    """摘要输入预处理（2026-09-17 摘要质量改进）：瘦身转录。"""

    def _injected_pair(self, body):
        return [
            {"role": "user", "content": f"<system-reminder>\n{body}\n</system-reminder>"},
            {"role": "assistant", "content": "Noted."},
        ]

    def test_injected_pairs_skipped(self):
        """head-context / skill body 注入对不进转录（压缩后重注入）。"""
        from planify.context.compact import _render_for_summary

        msgs = [
            *self._injected_pair("skills 清单…"),
            {"role": "user", "content": "移植 jsbridge"},
            {"role": "assistant", "content": "开始分析"},
            *self._injected_pair('<loaded-skill name="x">\n正文\n</loaded-skill>'),
            {"role": "user", "content": "继续"},
        ]
        text = _render_for_summary(msgs)
        assert "<system-reminder>" not in text
        assert "loaded-skill" not in text
        assert "用户: 移植 jsbridge" in text
        assert "助手: 开始分析" in text
        assert "用户: 继续" in text

    def test_tool_use_and_result_rendered_and_clipped(self):
        """tool_use 留名+入参摘要；tool_result 逐条截断（大头是文档原文）。"""
        from planify.context.compact import (
            _TOOL_RESULT_CHARS, _render_for_summary,
        )

        msgs = [
            {"role": "user", "content": "搜一下"},
            {"role": "assistant", "content": [
                {"type": "thinking", "thinking": "内部推理不该进摘要"},
                {"type": "tool_use", "id": "t1", "name": "search_kb",
                 "input": {"query": "jsbridge", "extra": "x" * 500}},
                {"type": "text", "text": "检索中"},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "t1",
                 "content": "文档原文" * 500},
            ]},
        ]
        text = _render_for_summary(msgs)
        assert "[调用 search_kb(" in text
        assert "检索中" in text
        assert "内部推理" not in text          # thinking 跳过
        assert "[结果] " in text
        assert f"原 {len('文档原文' * 500)} 字符" in text  # 截断标记带原长
        # 保留 400 字符 = 恰 100 个词；第 101 个连续出现即说明未截断
        assert "文档原文" * 101 not in text
        assert len(text) < _TOOL_RESULT_CHARS + 500

    def test_window_fallback_head_tail(self):
        """转录超窗口时头尾拼接（头保任务目标、尾保最近对话），中段省略。"""
        from planify.context.compact import (
            _SUMMARY_WINDOW_CHARS, _render_for_summary,
        )

        filler = {"role": "user", "content": "填充行" * 100}  # ~300 字符/条
        msgs = [{"role": "user", "content": "任务目标在最开头"}]
        msgs += [filler] * 400               # ~12 万字符，超窗口
        msgs += [{"role": "user", "content": "最近的对话在最后"}]
        text = _render_for_summary(msgs)
        assert len(text) <= _SUMMARY_WINDOW_CHARS + 200  # 窗口 + 标记余量
        assert "任务目标在最开头" in text      # 头保留
        assert "最近的对话在最后" in text      # 尾保留
        assert "中段省略" in text


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

    def test_summary_request_uses_transcript_and_structured_prompt(self, tmp_path):
        """摘要请求 = 瘦身转录 + 结构化分节 system（2026-09-17 质量改进）。"""
        from planify.context.compact import _SUMMARY_MAX_TOKENS, auto_compact

        provider = _FakeProvider()
        msgs = [
            {"role": "user", "content": "<system-reminder>\nskills 清单\n</system-reminder>"},
            {"role": "assistant", "content": "Noted."},
            {"role": "user", "content": "移植 jsbridge"},
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "t1", "name": "search_kb",
                 "input": {"query": "js"}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "t1", "content": "命中 3 篇"},
            ]},
        ]
        auto_compact(msgs, provider, tmp_path / ".transcripts")
        req = provider.captured
        content = req["messages"][0]["content"]
        assert content.startswith("对话转录如下")
        assert "<system-reminder>" not in content   # 注入对被剥
        assert "[调用 search_kb(" in content        # 工具调用转录
        # 结构化分节 system prompt
        assert "任务目标" in req["system"]
        assert "最近工作详情" in req["system"]
        # 无工具 + 摘要输出上限提高
        assert req["tools"] == []
        assert req["max_tokens"] == _SUMMARY_MAX_TOKENS
