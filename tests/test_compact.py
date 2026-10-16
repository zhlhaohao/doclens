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

    def test_image_blocks_estimated_by_pixel_not_base64(self):
        """ADR-0034：image block 按像素估（~2.8K/张），不数 base64——
        80 万字符 base64 若被当文本估算会得 ~20 万 tokens。"""
        from planify.context.compact import estimate_tokens

        b64 = "A" * 800_000
        msgs = [{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                {"type": "text", "text": "看这张图"},
            ],
        }]
        est = estimate_tokens(msgs)
        assert 2780 <= est <= 2900, est
        # 两张图 = 两份像素 token
        msgs2 = [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64}},
                {"type": "image", "source": {"type": "base64", "data": b64}},
                {"type": "text", "text": "对比"},
            ],
        }]
        assert estimate_tokens(msgs2) > est + 2700

    def test_render_message_replaces_image_with_placeholder(self):
        """ADR-0034：压缩转录把 image block 换 [图片] 占位，base64 不进摘要输入。"""
        from planify.context.compact import _render_message

        msg = {
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "data": "A" * 1000}},
                {"type": "text", "text": "正文文字"},
            ],
        }
        r = _render_message(msg)
        assert "[图片]" in r and "正文文字" in r and "AAAA" not in r


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


class TestVerbatimSkeleton:
    """逐字骨架（ADR-0040）：摘要对 + 骨架对（全问答轮逐字交错）、
    20K 兜底旧截新保、多轮压缩累积。"""

    def test_skeleton_pair_appended(self, tmp_path):
        """压缩产物 = 摘要对（2 条）+ 骨架对（2 条）；全部问答轮
        逐字交错（问1/答1/问2/答2）。"""
        from planify.context.compact import SKELETON_MARKER, auto_compact

        msgs = [
            {"role": "user", "content": "查一下鲁迅的《朝花夕拾》出版年份"},
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "t1", "name": "search", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "t1", "content": "命中"},
            ]},
            {"role": "assistant", "content": [
                {"type": "text", "text": "《朝花夕拾》1928 年由未名社出版。"},
            ]},
            {"role": "user", "content": "作者原名叫什么？"},
            {"role": "assistant", "content": [
                {"type": "text", "text": "周树人，1881 年生。"},
            ]},
        ]
        out = auto_compact(msgs, _FakeProvider(), tmp_path / "t")
        assert len(out) == 4
        assert "对话摘要" in out[0]["content"]          # 摘要对
        assert out[1]["role"] == "assistant"
        assert out[2]["role"] == "user"
        skel = out[2]["content"]
        assert skel.startswith(SKELETON_MARKER)
        # 围栏式渲染（2026-10-16 修订）：## 单节 header + 【问】/【答】
        # 标签行 + 围栏包原文，标签与原文分行
        assert "## 历史问答原文" in skel
        # 往返一致：骨架能完整解析回问答轮，原文逐字（问1/答1/问2/答2 交错）
        from planify.context.compact import _parse_skeleton_turns
        turns = _parse_skeleton_turns(skel)
        assert turns == [
            ("查一下鲁迅的《朝花夕拾》出版年份", "《朝花夕拾》1928 年由未名社出版。"),
            ("作者原名叫什么？", "周树人，1881 年生。"),
        ]
        assert out[3]["role"] == "assistant"

    def test_turn_without_text_answer_marked_empty(self, tmp_path):
        """轮末处于工具循环中途（无纯 text 收尾）→ 该轮【答】为空标记；
        混合块插话（text+tool_use）不算回答。"""
        from planify.context.compact import SKELETON_MARKER, auto_compact

        msgs = [
            {"role": "user", "content": "问题一"},
            {"role": "assistant", "content": [
                {"type": "text", "text": "我查一下"},
                {"type": "tool_use", "id": "t1", "name": "search", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "t1", "content": "结果"},
            ]},
        ]
        out = auto_compact(msgs, _FakeProvider(), tmp_path / "t")
        assert len(out) == 4
        skel = out[2]["content"]
        assert skel.startswith(SKELETON_MARKER)
        assert "问题一" in skel
        assert "我查一下" not in skel          # 混合块插话不保
        # 空答 = 裸【答】标签行、无围栏（该轮收于工具操作）
        assert "【答】" in skel
        from planify.context.compact import _parse_skeleton_turns
        assert _parse_skeleton_turns(skel) == [("问题一", "")]

    def test_tool_flow_within_turn_answer_kept(self, tmp_path):
        """同轮问答之间的工具序列不破坏轮切分（回归 1：相邻判定会让
        标准工具轮次 user 问 → tool_use → tool_result → assistant 答
        永远取不到回答，骨架只剩问题）。"""
        from planify.context.compact import auto_compact

        msgs = [
            {"role": "user", "content": "deep research 有哪些 benchmark"},
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "t1", "name": "search", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "t1", "content": "命中"},
            ]},
            {"role": "assistant", "content": [
                {"type": "text", "text": "DSBench 与 GMAI-MMBench 是其中两个。"},
            ]},
        ]
        out = auto_compact(msgs, _FakeProvider(), tmp_path / "t")
        skel = out[2]["content"]
        assert "deep research 有哪些 benchmark" in skel
        assert "DSBench 与 GMAI-MMBench 是其中两个。" in skel

    def test_multi_assistant_text_last_wins(self, tmp_path):
        """同轮多条纯 text assistant（先部分表态后最终答）→ 轮内最后
        一条为答（收尾表态语义）。"""
        from planify.context.compact import auto_compact

        msgs = [
            {"role": "user", "content": "问题"},
            {"role": "assistant", "content": [{"type": "text", "text": "先说一半"}]},
            {"role": "assistant", "content": [{"type": "text", "text": "完整回答"}]},
        ]
        out = auto_compact(msgs, _FakeProvider(), tmp_path / "t")
        skel = out[2]["content"]
        assert "完整回答" in skel
        assert "先说一半" not in skel

    def test_injected_pairs_excluded_from_skeleton(self, tmp_path):
        """<system-reminder> 注入对的问题不进骨架（与摘要输入同口径）。"""
        from planify.context.compact import auto_compact

        msgs = [
            {"role": "user", "content": "<system-reminder>\nskills 清单\n</system-reminder>"},
            {"role": "assistant", "content": "Noted."},
            {"role": "user", "content": "真问题"},
            {"role": "assistant", "content": [{"type": "text", "text": "真回答"}]},
        ]
        out = auto_compact(msgs, _FakeProvider(), tmp_path / "t")
        skel = out[2]["content"]
        assert "真问题" in skel
        assert "<system-reminder>" not in skel
        assert "skills 清单" not in skel

    def test_summary_pair_not_leaked_into_skeleton(self, tmp_path):
        """旧压缩产物（摘要对 + 骨架对）再压缩时：摘要文本不进骨架
        （回归 2：早期版本会把 [Compressed. …] 摘要当「用户问题」收进
        新骨架，摘要泄漏 + 骨架膨胀）。"""
        from planify.context.compact import auto_compact

        msgs = [
            {"role": "user", "content": "问题A"},
            {"role": "assistant", "content": [{"type": "text", "text": "回答A"}]},
        ]
        out1 = auto_compact(msgs, _FakeProvider(), tmp_path / "t1")
        second = [
            *out1,
            {"role": "user", "content": "问题B"},
            {"role": "assistant", "content": [{"type": "text", "text": "回答B"}]},
        ]
        out2 = auto_compact(second, _FakeProvider(), tmp_path / "t2")
        skel2 = out2[2]["content"]
        assert "[Compressed." not in skel2       # 摘要文本不泄漏
        assert "对话摘要" not in skel2
        assert "Understood." not in skel2

    def test_budget_drops_oldest_turns(self, tmp_path):
        """超 20K 预算 → 最旧轮被整轮丢（旧截新保、轮为原子不拆散）。"""
        from planify.context.compact import _render_skeleton

        # 构造：旧轮超长（每轮 ~16K tokens ASCII）×2 + 新轮短
        old_t1 = ("a" * 64_000, "a答")
        old_t2 = ("b" * 64_000, "b答")
        new_t = ("新问题", "新回答")
        out = _render_skeleton([old_t1, old_t2, new_t])
        content = out[0]["content"]
        assert "新问题" in content               # 最新保住
        assert "b" * 100 in content              # old_t2（较新）保住
        assert "a" * 100 not in content          # old_t1（最旧）整轮被丢
        assert "a答" not in content              # 轮原子：答随问丢
        assert "最早" in content and "轮问答超预算被省略" in content

    def test_skeleton_accumulates_across_compactions(self, tmp_path):
        """二次压缩：旧骨架的问答轮原文被搬运累积，不随压缩递减。"""
        from planify.context.compact import auto_compact

        first = [
            {"role": "user", "content": "早期问题：项目代号是什么？"},
            {"role": "assistant", "content": [{"type": "text", "text": "代号 Aurora。"}]},
        ]
        out1 = auto_compact(first, _FakeProvider(), tmp_path / "t1")
        assert len(out1) == 4

        # 第二次压缩：历史 = 骨架对₁ + 新对话
        second = [
            *out1,
            {"role": "user", "content": "后续问题：上线日期？"},
            {"role": "assistant", "content": [{"type": "text", "text": "2027-03。"}]},
        ]
        out2 = auto_compact(second, _FakeProvider(), tmp_path / "t2")
        skel2 = out2[2]["content"]
        # 早期问答轮原文仍在（跨边界累积，问与答都在）+ 新问答轮也在
        assert "早期问题：项目代号是什么？" in skel2
        assert "代号 Aurora。" in skel2
        assert "后续问题：上线日期？" in skel2
        assert "2027-03。" in skel2
        # 骨架对只出现一次（旧骨架被吸收为新骨架，不嵌套）
        assert out2[2]["content"].count("[Verbatim Q&A skeleton]") == 1

    def test_empty_skeleton_degrades_to_summary_pair(self, tmp_path):
        """无问题无回答（纯注入对历史）→ 骨架对省略，行为同旧版。"""
        from planify.context.compact import auto_compact

        msgs = [
            {"role": "user", "content": "<system-reminder>\nx\n</system-reminder>"},
            {"role": "assistant", "content": "Noted."},
        ]
        out = auto_compact(msgs, _FakeProvider(), tmp_path / "t")
        assert len(out) == 2                   # 纯摘要对
        assert "对话摘要" in out[0]["content"]

    def test_verbatim_md_content_fenced_roundtrip(self, tmp_path):
        """回归（2026-10-16 修订）：问答原文本身是 md——含 ## 标题、
        - 列表、``` 代码块、乃至伪装的【问】前缀行——必须完整逐字
        保真，且不与骨架结构混淆。"""
        from planify.context.compact import SKELETON_MARKER, _parse_skeleton_turns, auto_compact

        q = (
            "帮我看这段：\n\n## 配置\n\n- 项一\n- 项二\n\n"
            "```python\nprint('hi')\n```"
        )
        a = (
            "结论：\n\n【问】这是回答里伪装的问题行\n\n"
            "```\ninner fence\n```\n\n末尾。"
        )
        msgs = [
            {"role": "user", "content": q},
            {"role": "assistant", "content": [{"type": "text", "text": a}]},
        ]
        out = auto_compact(msgs, _FakeProvider(), tmp_path / "t")
        skel = out[2]["content"]
        assert skel.startswith(SKELETON_MARKER)
        assert "## 历史问答原文" in skel
        # 往返逐字保真（含内部的 ``` 三反引号与伪装【问】行）
        assert _parse_skeleton_turns(skel) == [(q, a)]

    def test_fence_adapts_to_longer_inner_fence(self, tmp_path):
        """原文含 ≥4 反引号围栏时外层围栏自适应加长（内容最长 + 1）。"""
        from planify.context.compact import _render_skeleton

        q = "问题"
        a = "````\n四反引号围栏内容\n````"
        out = _render_skeleton([(q, a)])
        content = out[0]["content"]
        assert "`````" in content             # 五反引号外栏（4+1）
        # 问侧默认 4 反引号
        q_block = content.split("【问】")[1]
        assert q_block.strip().startswith("````\n问题\n````")

    def test_legacy_skeleton_formats_still_parse(self):
        """落库历史兼容：v2 行前缀式与 v1 清单式旧骨架二次压缩时
        照常解析搬运（自动升级为新渲染格式）。"""
        from planify.context.compact import _parse_skeleton_turns

        v2 = (
            "[Verbatim Q&A skeleton]（…）\n"
            "历史问答原文（逐字，无转写）：\n"
            "【问】问题甲\n"
            "【答】回答甲\n"
            "【问】问题乙\n"
            "【答】"
        )
        assert _parse_skeleton_turns(v2) == [("问题甲", "回答甲"), ("问题乙", "")]
        v1 = (
            "[Verbatim Q&A skeleton]（…）\n"
            "- 早期问题一\n"
            "- 早期问题二\n"
        )
        assert _parse_skeleton_turns(v1) == [("早期问题一", ""), ("早期问题二", "")]

    def test_skeleton_keeps_edit_diffs_verbatim(self, tmp_path):
        """ADR-0040 §2a（2026-10-16）：edit_file 调用逐字进骨架——
        path + old→new 全文，自适应围栏，时间序。diff 是精确事实，
        LLM 转写必丢精度。"""
        from planify.context.compact import auto_compact

        msgs = [
            {"role": "user", "content": "改一下配置"},
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "e1", "name": "edit_file",
                 "input": {"path": "app.py", "old_text": "debug = True",
                           "new_text": "debug = False"}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "e1", "content": "已替换"},
            ]},
            {"role": "assistant", "content": [{"type": "text", "text": "已改为关闭调试。"}]},
        ]
        out = auto_compact(msgs, _FakeProvider(), tmp_path / "t")
        skel = out[2]["content"]
        assert "## 文件编辑记录（edit_file 逐字，时间序）" in skel
        assert "【编辑】app.py" in skel
        assert "debug = True" in skel and "debug = False" in skel
        assert "→" in skel                              # old → new 结构

    def test_skeleton_edit_fences_adapt_and_multiple_edits_ordered(self, tmp_path):
        """edit 原文含 ``` 围栏时外栏自适应；多次 edit 按时间序全量保。"""
        from planify.context.compact import _render_skeleton

        e1 = {"path": "a.md", "old": "```\ncode\n```", "new": "````\nmore\n````",
              "replace_all": False}
        e2 = {"path": "b.py", "old": "x=1", "new": "x=2", "replace_all": True}
        out = _render_skeleton([], [e1, e2], [])
        content = out[0]["content"]
        assert "`````" in content                      # 自适应五反引号
        assert content.index("a.md") < content.index("b.py")   # 时间序
        assert "【编辑】b.py（全部替换）" in content     # replace_all 标注

    def test_skeleton_reads_dedup_across_tools(self, tmp_path):
        """已读/已写清单分组（2026-10-16b）：read 与 write 路径各归各节、
        各自首现去重、时间序；offset 分块重读同文件只记一次。"""
        from planify.context.compact import auto_compact

        def _tu(i, name, **inp):
            return {"type": "tool_use", "id": i, "name": name, "input": inp}

        msgs = [
            {"role": "user", "content": "看下代码"},
            {"role": "assistant", "content": [
                _tu("r1", "read_file", path="src/app.py"),
                _tu("r2", "read_file", path="src/app.py", offset=100, limit=50),
                _tu("w1", "write_file", path="src/new.py", content="print()"),
                _tu("r3", "read_file", path="src/app.py"),
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "r1", "content": "…"},
                {"type": "tool_result", "tool_use_id": "r2", "content": "…"},
                {"type": "tool_result", "tool_use_id": "w1", "content": "已写入"},
                {"type": "tool_result", "tool_use_id": "r3", "content": "…"},
            ]},
            {"role": "assistant", "content": [{"type": "text", "text": "看完了。"}]},
        ]
        out = auto_compact(msgs, _FakeProvider(), tmp_path / "t")
        skel = out[2]["content"]
        # 分组两节：read 与 write 各归各，不混排
        assert "## 已读文件（read_file 路径，去重）" in skel
        assert "## 已写文件（write_file 路径，去重）" in skel
        assert skel.count("src/app.py") == 1            # 去重（3 次 read 1 行）
        assert "- src/app.py" in skel and "- src/new.py" in skel
        # 各节内部时间序；read 节在 write 节之前（渲染序）
        assert skel.index("## 已读文件") < skel.index("## 已写文件")
        # write_file 全文不逐字（磁盘即真相）
        assert "print()" not in skel

    def test_skeleton_reads_budget_drops_oldest(self):
        """读/写清单合计 2K 独立预算：超出各自丢最旧（不挤占问答轮预算）。"""
        from planify.context.compact import _render_skeleton, READLIST_TOKEN_BUDGET

        # 每路径 ~200 tokens（800 字符 ASCII），11 个 ≈ 2200 tokens > 2K
        paths = [f"dir{'x' * 780}/{i:03d}.py" for i in range(11)]
        out = _render_skeleton([("问", "答")], [], paths)
        content = out[0]["content"]
        assert paths[0] not in content                  # 最旧被丢
        assert paths[-1] in content                     # 最新保住
        assert "文件路径超预算被省略" in content
        assert READLIST_TOKEN_BUDGET == 2_000
