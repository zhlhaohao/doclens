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


class TestSummaryInputBudget:
    """窗口声明 → 摘要输入 token 预算推导。"""

    def test_none_falls_back_to_conservative_constant(self):
        """未声明窗口 → 100K 兜底（对齐最保守 128K 端点）。"""
        from planify.context.compact import (
            _SUMMARY_INPUT_TOKEN_BUDGET, summary_input_budget,
        )

        assert summary_input_budget(None) == _SUMMARY_INPUT_TOKEN_BUDGET

    def test_declared_window_scales_budget(self):
        """声明窗口 → (窗口 − 预留) × 0.85；128K 声明 ≈ 兜底值（口径连续）。"""
        from planify.context.compact import summary_input_budget

        assert summary_input_budget(200_000) == int((200_000 - 12_000) * 0.85)  # 159800
        # 128K 声明 ≈ 98.6K，与 100K 兜底同量级——声明与否口径平滑衔接
        assert abs(summary_input_budget(128_000) - 100_000) < 5_000

    def test_budget_shrinks_with_large_output_config(self):
        """输出预留随输出上限联动：窗口是输入+输出共享的物理约束，
        大输出配置（131072）挤占输入预算，防 输入+输出 撞窗。"""
        from planify.context.compact import summary_input_budget

        # 200K 窗口 / 默认输出（reserve = 10000+2000）
        assert summary_input_budget(200_000, None) == 159_800
        # 200K 窗口 / 131072 输出（reserve = 131072+2000）→ 预算收缩
        assert summary_input_budget(200_000, 131_072) == int(
            (200_000 - 131_072 - 2_000) * 0.85
        )
        # 病态配置（窗口 ≤ 输出预留）→ 兜底常量（配置本身矛盾，让服务端暴露）
        assert summary_input_budget(128_000, 131_072) == 100_000

    def test_invalid_window_falls_back(self):
        """非法声明（≤ 预留值）→ 兜底。"""
        from planify.context.compact import _SUMMARY_INPUT_TOKEN_BUDGET, summary_input_budget

        assert summary_input_budget(0) == _SUMMARY_INPUT_TOKEN_BUDGET
        assert summary_input_budget(12_000) == _SUMMARY_INPUT_TOKEN_BUDGET

    def test_budget_expands_summary_window(self):
        """大预算下超长转录不再触发兜底截断（_render_for_summary 透传生效）。"""
        from planify.context.compact import _SUMMARY_INPUT_TOKEN_BUDGET, _render_for_summary

        msgs = [{"role": "user", "content": "填充行" * 40_000}]  # 12 万汉字 ≈ 12 万 token
        # 兜底预算（100K）→ 触发截断
        assert "中段省略" in _render_for_summary(msgs)
        # 200K 窗口预算（159.8K）→ 全量可见
        assert "中段省略" not in _render_for_summary(
            msgs, input_budget=159_800
        )
        assert _SUMMARY_INPUT_TOKEN_BUDGET == 100_000  # 兜底口径前提


class TestEstimateTokens:
    """token 估算公式：ASCII ÷4 快速路径 + 非 ASCII ≈1 token/字符。"""

    def test_ascii_fast_path_matches_legacy_formula(self):
        """纯 ASCII 内容与旧式 len(json)//4 完全一致（英文场景行为不变）。"""
        from planify.context.compact import estimate_tokens

        msgs = [
            {"role": "user", "content": "hello world " * 100},
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "t1", "name": "bash", "input": {"cmd": "ls"}}
            ]},
        ]
        legacy = len(__import__("json").dumps(msgs, default=str)) // 4
        assert estimate_tokens(msgs) == legacy

    def test_cjk_counts_one_token_per_char(self):
        """非 ASCII 字符 ≈1 token/字符：介于旧式高估（6字符÷4=1.5）与
        纯 ÷4 低估（0.25）之间，且单调。"""
        from planify.context.compact import estimate_tokens

        msgs = [{"role": "user", "content": "中" * 100}]  # 恰 100 个汉字
        est = estimate_tokens(msgs)
        # 主体是 100 个汉字（JSON 结构开销是少量 ASCII）：应显著大于
        # 纯 ÷4（~25+）而小于旧式转义（~150+）
        assert 100 <= est <= 130
        # 纯 ASCII 同长度对照走快速路径
        ascii_est = estimate_tokens([{"role": "user", "content": "a" * 100}])
        assert est > ascii_est


class TestEstimateTokensWithUsage:
    """usage 实测基线 + 增量 ÷4（借鉴 Claude Code tokenCountWithEstimation）。"""

    def _msgs(self, n):
        return [{"role": "user", "content": f"msg {i} " + "x" * 40} for i in range(n)]

    def test_baseline_plus_increment(self):
        """基线覆盖前 N 条，增量只算其后新增——不重复计费全历史。"""
        from planify.context.compact import estimate_tokens, estimate_tokens_with_usage

        msgs = self._msgs(10)
        baseline_total = 50_000  # 实测总输入（含 system/工具表）
        baseline_len = 6
        est = estimate_tokens_with_usage(msgs, baseline_total, baseline_len)
        assert est == baseline_total + estimate_tokens(msgs[baseline_len:])

    def test_no_increment_returns_baseline(self):
        """messages 长度恰等基线锚点 → 纯基线值。"""
        from planify.context.compact import estimate_tokens_with_usage

        msgs = self._msgs(6)
        assert estimate_tokens_with_usage(msgs, 50_000, 6) == 50_000

    def test_no_baseline_falls_back_to_full_estimate(self):
        """无基线（None / 负锚点）→ 全量 ÷4 兜底。"""
        from planify.context.compact import estimate_tokens, estimate_tokens_with_usage

        msgs = self._msgs(10)
        assert estimate_tokens_with_usage(msgs, None, None) == estimate_tokens(msgs)
        assert estimate_tokens_with_usage(msgs, 50_000, None) == estimate_tokens(msgs)
        assert estimate_tokens_with_usage(msgs, None, 6) == estimate_tokens(msgs)

    def test_history_shrunk_falls_back(self):
        """历史被压缩替换变短（len < 锚点）→ 基线失效，全量兜底。"""
        from planify.context.compact import estimate_tokens, estimate_tokens_with_usage

        compacted = [
            {"role": "user", "content": "[Compressed. Transcript: t]\n摘要"},
            {"role": "assistant", "content": "Understood."},
        ]
        assert estimate_tokens_with_usage(compacted, 50_000, 6) == estimate_tokens(compacted)


class TestMicrocompactEstimatedTokensParam:
    """microcompact 的 estimated_tokens 复用参数（避免重复全量估算）。"""

    def _twelve_results(self):
        msgs = []
        for i in range(12):
            msgs.append(_assistant_tool_use(f"r{i}", "read_document"))
            msgs.append(_user_tool_result(f"r{i}", _LONG))
        return msgs

    def test_caller_estimate_used_for_gate(self):
        """传入调用方估算值：门控用它判断，不重算——伪造极大值即视为
        "已达门控"（实际内部估算远达不到 10**9，证明确实没重算）。"""
        msgs = self._twelve_results()
        cleared = microcompact(msgs, min_estimated_tokens=10**9, estimated_tokens=10**9)
        assert cleared == ["r0", "r1"]  # 门控通过，正常清理

    def test_caller_estimate_blocks_gate(self):
        """传入极小估算值：低于门控下限，完全不动历史（即使实际很大）。"""
        msgs = self._twelve_results()
        cleared = microcompact(msgs, min_estimated_tokens=10**9, estimated_tokens=1)
        assert cleared == []
        assert all(v == _LONG for v in _collect(msgs).values())

    def test_none_falls_back_to_internal_estimate(self):
        """不传（None）→ 内部自行估算，行为与历史版本一致。"""
        msgs = self._twelve_results()
        assert microcompact(msgs, min_estimated_tokens=10**9) == []
        assert microcompact(msgs, min_estimated_tokens=1) == ["r0", "r1"]


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
        """转录超 token 预算时头尾拼接（头保任务目标、尾保最近对话），中段省略。"""
        from planify.context.compact import (
            _SUMMARY_INPUT_TOKEN_BUDGET, _estimate_text_tokens, _render_for_summary,
        )

        filler = {"role": "user", "content": "填充行" * 100}  # ~300 字符/条
        msgs = [{"role": "user", "content": "任务目标在最开头"}]
        msgs += [filler] * 400               # ~12 万汉字 ≈ 12 万 token，超预算
        msgs += [{"role": "user", "content": "最近的对话在最后"}]
        text = _render_for_summary(msgs)
        # 输出估算控制在预算内（省略标记 + 标签是少量 ASCII 开销）
        assert _estimate_text_tokens(text) <= _SUMMARY_INPUT_TOKEN_BUDGET + 500
        assert "任务目标在最开头" in text      # 头保留
        assert "最近的对话在最后" in text      # 尾保留
        assert "中段省略" in text

    def test_english_transcript_far_larger_than_legacy_char_window(self):
        """token 预算制：英文转录（÷4 密度）吃到 ~4 倍旧字符窗口仍全量可见。"""
        from planify.context.compact import _render_for_summary

        # 320K ASCII 字符 ≈ 80K token ≤ 100K 预算 → 不触发兜底；
        # 旧口径（80K 字符窗口）会截掉四分之三
        msgs = [
            {"role": "user", "content": "keep the head " * 1},
            {"role": "user", "content": "filler line aaaa " * 20_000},  # ~320K 字符
            {"role": "user", "content": "keep the tail"},
        ]
        text = _render_for_summary(msgs)
        assert "中段省略" not in text         # 全量进摘要
        assert "keep the head" in text
        assert "keep the tail" in text


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
        from planify.context.compact import _SUMMARY_MAX_TOKENS_FLOOR, auto_compact

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
        # 无工具 + 不传配置时输出上限 = 下限兜底
        assert req["tools"] == []
        assert req["max_tokens"] == _SUMMARY_MAX_TOKENS_FLOOR

    def test_summary_max_tokens_follows_config_with_floor(self, tmp_path):
        """摘要输出上限 = max(下限 10000, 配置值)——大输出模型跟随
        PLANIFY_MAX_TOKENS 放开，小配置不跌破 thinking 安全下限。"""
        from planify.context.compact import _SUMMARY_MAX_TOKENS_FLOOR, auto_compact

        provider = _FakeProvider()
        msgs = [{"role": "user", "content": "问题"}]

        # 大配置（131072）→ 跟随放开
        auto_compact(
            msgs, provider, tmp_path / "t1", summary_max_tokens=131_072
        )
        assert provider.captured["max_tokens"] == 131_072

        # 小配置（4000，会被 thinking 耗尽）→ 下限兜底
        auto_compact(
            msgs, provider, tmp_path / "t2", summary_max_tokens=4_000
        )
        assert provider.captured["max_tokens"] == _SUMMARY_MAX_TOKENS_FLOOR

        # None → 下限兜底
        auto_compact(msgs, provider, tmp_path / "t3")
        assert provider.captured["max_tokens"] == _SUMMARY_MAX_TOKENS_FLOOR
