"""grep 正则搜索的片段呈现测试。

回归背景：pattern 如 ``第29题[\\s\\S]{0,300}`` 曾被当作字面量子串做行锚点
匹配（永远选不中），且 regex 模式片段以匹配点"居中"开窗（前半是上文、
后文被截半）。本文件锁定"片段以正则命中体为先导"的行为。
"""
from pathlib import Path
from types import SimpleNamespace

from treesearch.fts import _extract_match_snippet

PAT = r"第29题[\s\S]{0,300}"
TEXT = (
    "全性\n\nD、 画像全面\n\n参考答案：A\n\n"
    "第28题, 上一题内容\n\n"
    "第29题, 联通大数据产品中，线上广告可投放的行业？\n\n"
    "A、 医疗\n\nB、 房产\n\n参考答案：A\n\n"
    "第30题, 下一题内容"
)


# ---------------------------------------------------------------------------
# treesearch.fts._extract_match_snippet
# ---------------------------------------------------------------------------

class TestExtractMatchSnippetRegex:
    def test_snippet_led_by_match_body(self):
        text = "X" * 400 + "第29题" + "A" * 300 + "Y" * 400
        s = _extract_match_snippet(text, PAT, use_regex=True, size=300)
        assert s.startswith("第29题")
        assert len(s) >= 300  # {0,300} 跨度完整可见

    def test_short_text_returned_as_is(self):
        assert _extract_match_snippet("第29题短文", PAT, use_regex=True) == "第29题短文"

    def test_no_match_falls_back_to_head(self):
        text = "Z" * 500
        s = _extract_match_snippet(text, PAT, use_regex=True, size=300)
        assert s == text[:300]

    def test_literal_mode_still_centers(self):
        text = "A" * 400 + "needle" + "B" * 400
        s = _extract_match_snippet(text, "needle", use_regex=False, size=300)
        assert "needle" in s
        assert s.startswith("A")  # 居中窗口，前有上文


# ---------------------------------------------------------------------------
# doclens.grep_tools 片段选取
# ---------------------------------------------------------------------------

class TestGrepSnippetSelection:
    def test_select_keyword_lines_regex_anchor(self):
        from doclens.grep_tools import _select_keyword_lines

        out = _select_keyword_lines(TEXT, [PAT])
        assert "第29题" in out  # 正则词项能选中锚点行，不再落回开头兜底

    def test_select_keyword_lines_invalid_regex_falls_back_literal(self):
        from doclens.grep_tools import _select_keyword_lines

        # 非法正则 "第29题[" 退字面量子串（带 [），文本无此串 → 落回开头兜底不抛异常
        out = _select_keyword_lines(TEXT, ["第29题["])
        assert isinstance(out, str) and out

        # 字面可命中的非法正则（如 "（" 这类未闭合括号）退字面匹配
        out2 = _select_keyword_lines(TEXT, ["参考答案（A"])
        assert "参考答案" in out2

    def test_regex_led_snippet_led_by_match(self):
        from doclens.grep_tools import _regex_led_snippet

        led = _regex_led_snippet(TEXT, [PAT])
        assert led is not None
        assert led.startswith("第29题")
        assert "医疗" in led  # 选项内容在跨度内

    def test_regex_led_snippet_none_on_invalid(self):
        from doclens.grep_tools import _regex_led_snippet

        assert _regex_led_snippet(TEXT, ["["]) is None

    def test_regex_led_snippet_none_on_no_hit(self):
        from doclens.grep_tools import _regex_led_snippet

        assert _regex_led_snippet(TEXT, ["不存在的词"]) is None

    def test_format_agent_output_contains_match_span(self):
        from doclens.grep_tools import _format_agent_output

        node = {"title": "单选题", "text": TEXT, "line_start": 1}
        out = _format_agent_output(
            content_results=[("d1", node, 1, 0, 0.0)],
            path_results=[],
            path_map={"d1": "kb/a.docx"},
            total_terms=1,
            query_words=[PAT],
        )
        assert "第29题" in out
        assert "医疗" in out
        assert "第28题, 上一题内容" not in out.split("<content>")[1].split("</content>")[0][:20]


# ---------------------------------------------------------------------------
# TUI 渲染（is_ripgrep 路径的行锚点正则感知）
# ---------------------------------------------------------------------------

class TestTuiRenderRegexAnchor:
    def test_ripgrep_render_snippet_contains_match(self):
        from doclens.tui.renderers.search import render_search_result

        node = {"title": "单选题", "text": TEXT}
        t = render_search_result(
            1, "d1", node, 1, 1, path="kb/a.docx",
            is_ripgrep=True, query_words=[PAT],
        )
        assert "第29题" in t.plain

    def test_fts_literal_render_unchanged(self):
        from doclens.tui.renderers.search import render_search_result

        node = {"title": "t", "text": "量子 计算 内容"}
        t = render_search_result(1, "d1", node, 2, 2, query_words=["量子", "计算"])
        assert "量子" in t.plain and "计算" in t.plain


# ---------------------------------------------------------------------------
# handler 端到端（真实 like_search → REGEXP → 片段）
# ---------------------------------------------------------------------------

def _real_idx(kb: Path):
    """真实 IndexManager：构建小型索引库（含超长节点，触发摘要截断路径）。"""
    import os

    from doclens.config import CortexConfig
    from doclens.index_manager import IndexManager

    long_text = (
        "开头填充。" * 20
        + "第28题, 上一题\n\n"
        + "第29题, 联通大数据产品中，线上广告可投放的行业，不包括以下哪个？\n\n"
        + "A、 医疗\n\nB、 房产\n\nC、 母婴\n\nD、 教育\n\n参考答案：A\n\n"
        + "第30题, 下一题\n\n" + "结尾填充。" * 20
    )
    (kb / "题库.md").write_text(f"# 单选题\n\n{long_text}\n", encoding="utf-8")

    os.chdir(kb)
    cfg = CortexConfig()
    idx = IndexManager(cfg)
    idx.reindex(force=True)
    return idx


class TestHandleGrepEndToEnd:
    def test_output_contains_match_body(self, tmp_path: Path):
        from doclens.grep_tools import _handle_grep

        idx = _real_idx(tmp_path)
        out = _handle_grep(idx, pattern=PAT)

        assert "第29题" in out, f"输出未含匹配体:\n{out[:400]}"
        assert "医疗" in out, f"输出未含跨度后文:\n{out[:400]}"
