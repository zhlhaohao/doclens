"""grep 正则搜索的片段呈现测试（统一窗口模型）。

回归背景：pattern 如 ``第29题[\\s\\S]{0,300}`` 曾被当作字面量子串做行锚点
匹配（永远选不中）。统一窗口模型后：片段 = 锚点前 before 字符 + 命中体
（≤match_max）+ 锚点后 after 字符，grep 与 search 同口径。
"""
from pathlib import Path
from types import SimpleNamespace

from treesearch.fts import (
    SNIPPET_BASE_CHARS,
    SNIPPET_MATCH_MAX_CHARS,
    _extract_match_snippet,
)

PAT = r"第29题[\s\S]{0,300}"
TEXT = (
    "全性\n\nD、 画像全面\n\n参考答案：A\n\n"
    "第28题, 上一题内容\n\n"
    "第29题, 联通大数据产品中，线上广告可投放的行业？\n\n"
    "A、 医疗\n\nB、 房产\n\n参考答案：A\n\n"
    "第30题, 下一题内容"
)
# 统一窗口默认（与 CortexConfig 出厂一致）
BEFORE, AFTER = 200, 600


# ---------------------------------------------------------------------------
# treesearch.fts._extract_match_snippet
# ---------------------------------------------------------------------------

class TestExtractMatchSnippetRegex:
    def test_snippet_led_by_match_body(self):
        text = "X" * 400 + "第29题" + "A" * 300 + "Y" * 400
        s = _extract_match_snippet(text, PAT, use_regex=True, size=300)
        assert s.startswith("第29题")
        assert len(s) >= 300  # {0,300} 跨度完整可见

    def test_greedy_match_capped(self):
        # 贪婪正则 [\s\S]* 匹配体被截到 SNIPPET_MATCH_MAX_CHARS，另加尾随上下文 size
        text = "第29题" + "A" * 5000
        s = _extract_match_snippet(text, r"第29题[\s\S]*", use_regex=True, size=300)
        assert s.startswith("第29题")
        assert len(s) <= SNIPPET_MATCH_MAX_CHARS + 300

    def test_trailing_context_appended(self):
        # 短匹配体之后还应有 size 预算的尾随上下文
        text = "第29题" + "B" * 1000
        s = _extract_match_snippet(text, r"第29题", use_regex=True, size=300)
        assert s.startswith("第29题")
        assert len(s) == len("第29题") + 300

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

    def test_regex_led_snippet_unified_window(self):
        from doclens.grep_tools import _regex_led_snippet

        led = _regex_led_snippet(TEXT, [PAT], before=BEFORE, after=AFTER)
        assert led is not None
        assert "第29题" in led
        assert "医疗" in led  # 选项内容在跨度内
        assert "第28题, 上一题内容" in led  # 锚点前 200 字符可见前文

    def test_regex_led_snippet_before_window(self):
        # 长前文场景：锚点前恰好 before 字符
        from doclens.grep_tools import _regex_led_snippet

        text = "前" * 1000 + "NEEDLE" + "后" * 1000
        led = _regex_led_snippet(text, ["NEEDLE"], before=100, after=200)
        assert led is not None
        assert led.startswith("前" * 100)
        assert led.endswith("后" * 200)
        assert "NEEDLE" in led

    def test_regex_led_snippet_none_on_invalid(self):
        from doclens.grep_tools import _regex_led_snippet

        assert _regex_led_snippet(TEXT, ["["]) is None

    def test_regex_led_snippet_none_on_no_hit(self):
        from doclens.grep_tools import _regex_led_snippet

        assert _regex_led_snippet(TEXT, ["不存在的词"]) is None

    def test_regex_led_snippet_greedy_capped(self):
        from doclens.grep_tools import _regex_led_snippet
        from doclens.word_window import WORD_CHAR_CEILING

        text = "第29题" + "A" * 5000
        led = _regex_led_snippet(text, [r"第29题[\s\S]*"], before=BEFORE, after=AFTER)
        assert led is not None and led.startswith("第29题")
        # 词口径：命中体 cap 字符 + 前后词窗的字符保险丝上限。A*5000 是
        # 一个无空白「词」，在 after 词数预算内吃满剩余是词定义的正确语义
        assert len(led) <= SNIPPET_MATCH_MAX_CHARS + (BEFORE + AFTER) * WORD_CHAR_CEILING

    def test_regex_led_snippet_word_unit_english(self):
        """词单位：英文场景下窗口按词数计量（旧字符口径仅约 1/6 词量）。"""
        from doclens.grep_tools import _regex_led_snippet

        words = [f"w{i}" for i in range(200)]
        text = " ".join(words[:100]) + " NEEDLE " + " ".join(words[100:])
        led = _regex_led_snippet(text, ["NEEDLE"], before=5, after=8)
        assert led is not None
        assert led.split()[-1] == "w107"  # 锚点后 8 词（NEEDLE 后第一个词是 w100）
        assert led.split()[0] == "w95"  # 锚点前 5 词（w95..w99）

    def test_regex_led_snippet_cjk_word_equals_char(self):
        """CJK 每字一词：词窗口宽度与旧字符口径一致（回归保护）。"""
        from doclens.grep_tools import _regex_led_snippet

        text = "前" * 1000 + "NEEDLE" + "后" * 1000
        led = _regex_led_snippet(text, ["NEEDLE"], before=100, after=200)
        assert led == "前" * 100 + "NEEDLE" + "后" * 200

    def test_word_window_fuse_on_runaway_word(self):
        """超长无空白段（一个词）触发字符保险丝，窗口不被炸穿。"""
        from doclens.grep_tools import _regex_led_snippet

        text = "NEEDLE" + "A" * 30000
        led = _regex_led_snippet(text, ["NEEDLE"], before=0, after=10)
        assert led is not None
        assert len(led) <= len("NEEDLE") + 10 * 8  # 10 词 × WORD_CHAR_CEILING

    def test_format_agent_output_contains_match_span(self):
        from doclens.grep_tools import _format_agent_output

        node = {"title": "单选题", "text": TEXT, "line_start": 1}
        out = _format_agent_output(
            content_results=[("d1", node, 1, 0, 0.0)],
            path_results=[],
            path_map={"d1": "kb/a.docx"},
            total_terms=1,
            query_words=[PAT],
            context_before=BEFORE,
            context_after=AFTER,
        )
        assert "第29题" in out
        assert "医疗" in out
        assert "第28题" in out  # 前文在统一窗口内


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
# 统一窗口模型：grep 与 search 同口径
# ---------------------------------------------------------------------------

class TestUnifiedWindowModel:
    def test_keyword_window_before_after_params(self):
        from doclens.kb_tools import _extract_keyword_window

        text = "前" * 1000 + "NEEDLE" + "后" * 1000
        win = _extract_keyword_window(text, ["needle"], before=100, after=200)
        assert "NEEDLE" in win
        i = win.find("NEEDLE")
        after_len = len(win) - i - len("NEEDLE") - len("\n…（后文略）")
        assert 190 <= after_len <= 200  # 锚点后 ≈ after（rstrip 余量）
        # 窗口还补带文档开头 head（≤before）——表头可读性设计

    def test_grep_and_search_same_anchor_same_window(self):
        """同一文档同锚点：grep（纯字面词项）与 search 窗口口径一致。"""
        from doclens.grep_tools import _regex_led_snippet
        from doclens.kb_tools import _extract_keyword_window

        text = "前" * 1000 + "NEEDLE" + "后" * 1000
        g = _regex_led_snippet(text, ["NEEDLE"], before=100, after=200)
        k = _extract_keyword_window(text, ["needle"], before=100, after=200)
        # 两窗口都覆盖锚点前后核心区（尾部余量允许省略标记/rstrip 差异）
        assert g is not None and "NEEDLE" in g and "NEEDLE" in k
        assert g.startswith("前" * 100)
        assert g.endswith("后" * 200)
        assert "NEEDLE" + "后" * 100 in k  # 锚点后至少 100 字符
        assert "前" * 50 + "NEEDLE" in k  # 锚点前至少 50 字符

    def test_window_from_config_properties(self, tmp_path: Path, monkeypatch):
        """配置字段 → IndexManager property 透传（默认 200/600/2000）。"""
        from doclens.config import CortexConfig
        from doclens.index_manager import IndexManager

        (tmp_path / "a.md").write_text("# t\n\n内容\n", encoding="utf-8")
        monkeypatch.chdir(tmp_path)
        idx = IndexManager(CortexConfig())
        assert idx.search_context_before == 200
        assert idx.search_context_after == 600
        assert idx.grep_match_max_chars == 2000

    def test_match_max_env_override(self, tmp_path: Path, monkeypatch):
        """CORTEX_GREP_MATCH_MAX_CHARS env 覆盖防贪婪上限（不进界面/预设）。"""
        import os

        monkeypatch.setenv("CORTEX_GREP_MATCH_MAX_CHARS", "500")
        from doclens.config import CortexConfig
        from doclens.index_manager import IndexManager

        (tmp_path / "a.md").write_text("# t\n\n内容\n", encoding="utf-8")
        monkeypatch.chdir(tmp_path)
        idx = IndexManager(CortexConfig())
        assert idx.grep_match_max_chars == 500

    def test_match_max_flows_into_snippet(self, tmp_path: Path):
        """match_max 从 _format_agent_output 注入 _regex_led_snippet。"""
        from doclens.grep_tools import _format_agent_output

        text = "前" * 100 + "第29题" + "A" * 5000
        node = {"title": "t", "text": text}
        out = _format_agent_output(
            content_results=[("d1", node, 1, 0, 0.0)],
            path_results=[],
            path_map={"d1": "kb/a.md"},
            total_terms=1,
            query_words=[r"第29题[\s\S]*"],
            context_before=0,
            context_after=0,
            match_max=300,
        )
        content = out.split("<content>")[1].split("</content>")[0]
        assert content.startswith("第29题")
        assert len(content) == 300  # 贪婪匹配体被 env 上限截到 300


# ---------------------------------------------------------------------------
# 引擎一致性：SQLite REGEXP 与 rg --ignore-case 大小写口径对齐
# ---------------------------------------------------------------------------

class TestRegexpCaseAlignment:
    def test_sqlite_regexp_case_insensitive(self):
        from treesearch.fts import _sqlite_regexp

        assert _sqlite_regexp("needle", "Foo NEEDLE bar") is True
        assert _sqlite_regexp("NEEDLE", "foo needle bar") is True

    def test_sqlite_regexp_invalid_pattern_false(self):
        from treesearch.fts import _sqlite_regexp

        assert _sqlite_regexp("[", "any") is False
        assert _sqlite_regexp(None, "any") is False
        assert _sqlite_regexp("a", None) is False

    def test_like_search_regex_case_insensitive(self, tmp_path: Path):
        """DB 引擎对小写 pattern 命中大写内容——与 rg --ignore-case 同覆盖。"""
        from treesearch.fts import FTS5Index

        fts = FTS5Index(db_path=str(tmp_path / "t.db"))
        try:
            from treesearch.tree import Document

            doc = Document(
                doc_id="d1",
                doc_name="case.md",
                structure=[{
                    "node_id": "n1", "title": "NEEDLE Title",
                    "summary": "Foo NEEDLE bar", "depth": 0,
                }],
            )
            fts.index_document(doc)
            hits = fts.like_search("needle", top_k=10, use_regex=True)
            assert len(hits) == 1
            assert hits[0]["doc_id"] == "d1"
        finally:
            fts.close()

    def test_like_search_phase2_json_escape_rescan(self, tmp_path: Path):
        """Phase 2 转义兜底：JSON 源码预筛 miss（\n 转义打断 \s）时 loads 后精筛。

        构造：长节点中段藏 "alpha\nneedle"（真换行）——Phase 1 的 summary
        是头尾截断窗口（不含中段）；Phase 2 预筛在 structure_json 源码上
        跑，换行被序列化成字面 "\\n" 两字符，`alpha\sneedle` 匹配不上；
        慢路径反序列化后对节点原文精筛才能命中。
        """
        from treesearch.fts import FTS5Index
        from treesearch.tree import Document, assign_node_ids

        text = "前填充。" * 200 + "alpha\nneedle\n" + "后填充。" * 200
        structure = [{"title": "t", "text": text}]
        assign_node_ids(structure)
        fts = FTS5Index(db_path=str(tmp_path / "t.db"))
        try:
            fts.index_document(
                Document(doc_id="d1", doc_name="esc.md", structure=structure)
            )
            hits = fts.like_search(r"alpha\sneedle", top_k=10, use_regex=True)
            assert len(hits) == 1, "转义边界文本未被 Phase 2 慢路径兜底命中"
            assert hits[0]["doc_id"] == "d1"
        finally:
            fts.close()


# ---------------------------------------------------------------------------
# handler 端到端（真实 like_search → REGEXP → 片段）
# ---------------------------------------------------------------------------

def _real_idx(kb: Path, monkeypatch):
    """真实 IndexManager：构建小型索引库（含超长节点，触发摘要截断路径）。"""
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

    monkeypatch.chdir(kb)
    cfg = CortexConfig()
    idx = IndexManager(cfg)
    idx.reindex(force=True)
    return idx


class TestHandleGrepEndToEnd:
    def test_tool_registered_as_kb_grep(self):
        """doclens 的 grep 工具对外名是 kb_grep（与 planify 内置 grep 区分：
        撞名会导致 tools 列表同名冲突 + handler 静默覆盖）。"""
        from doclens.grep_tools import build_grep_tools

        tools, handlers = build_grep_tools(idx=None)  # handler 惰性闭包，构建不触 idx
        assert [t["name"] for t in tools] == ["kb_grep"]
        assert set(handlers) == {"kb_grep"}

    def test_output_contains_match_body(self, tmp_path: Path, monkeypatch):
        from doclens.grep_tools import _handle_grep

        idx = _real_idx(tmp_path, monkeypatch)
        out = _handle_grep(idx, pattern=PAT)

        assert "第29题" in out, f"输出未含匹配体:\n{out[:400]}"
        assert "医疗" in out, f"输出未含跨度后文:\n{out[:400]}"

    def test_db_hit_backfills_fulltext_with_leading_context(
        self, tmp_path: Path, monkeypatch
    ):
        """DB（like_search）命中路径：node text 回填全文，锚点前文可见。"""
        from doclens.config import CortexConfig
        from doclens.index_manager import IndexManager

        long_text = "前置填充。" * 80 + "第29题, 题干内容\n\nA、 医疗\n\n参考答案：A\n"
        (tmp_path / "full.md").write_text(f"# 节\n\n{long_text}\n", encoding="utf-8")
        monkeypatch.chdir(tmp_path)
        idx = IndexManager(CortexConfig())
        idx.reindex(force=True)

        from doclens.grep_tools import _handle_grep

        out = _handle_grep(idx, pattern=r"第29题")
        content = out.split("<content>")[1].split("</content>")[0]
        i = content.find("第29题")
        assert i >= 100, f"锚点前文未回填（前 {i} 字符）:\n{content[:200]}"


class TestGrepUnindexedFiles:
    """rg 兜底应覆盖磁盘上未索引的文件（与 grep 工具描述一致）。"""

    def _make_idx(self, kb: Path, monkeypatch):
        from doclens.config import CortexConfig
        from doclens.index_manager import IndexManager

        (kb / "indexed.md").write_text("# 已索引\n\nNEEDLE_INDEXED 内容\n", encoding="utf-8")
        monkeypatch.chdir(kb)
        idx = IndexManager(CortexConfig())
        idx.reindex(force=True)
        return idx

    def test_unindexed_file_found_by_rg_fallback(self, tmp_path: Path, monkeypatch):
        idx = self._make_idx(tmp_path, monkeypatch)
        # 索引后新增文件 → 未索引状态
        (tmp_path / "untracked.md").write_text(
            "# 新增\n\nNEEDLE_UNINDEXED 新文件内容\n", encoding="utf-8"
        )

        from doclens.grep_tools import _handle_grep

        out = _handle_grep(idx, pattern="NEEDLE_UNINDEXED")
        assert "untracked.md" in out, f"未索引文件未被搜到:\n{out[:300]}"
        assert "新文件内容" in out

    def test_gitignored_file_excluded(self, tmp_path: Path, monkeypatch):
        idx = self._make_idx(tmp_path, monkeypatch)
        (tmp_path / "ignored.md").write_text("NEEDLE_IGNORED 不应被搜到\n", encoding="utf-8")
        (tmp_path / ".gitignore").write_text("ignored.md\n", encoding="utf-8")

        from doclens.grep_tools import _handle_grep

        out = _handle_grep(idx, pattern="NEEDLE_IGNORED")
        assert "未找到" in out or "ignored.md" not in out

    def test_indexed_file_still_uses_db(self, tmp_path: Path, monkeypatch):
        import doclens.ripgrep as rgmod
        from doclens.ripgrep import execute_grep_search

        idx = self._make_idx(tmp_path, monkeypatch)
        called = {"n": 0}
        orig = rgmod.rg_fallback_search
        rgmod.rg_fallback_search = lambda *a, **kw: (called.__setitem__("n", called["n"] + 1), orig(*a, **kw))[1]
        try:
            r = execute_grep_search(idx, "NEEDLE_INDEXED")
        finally:
            rgmod.rg_fallback_search = orig
        assert len(r.content_results) == 1
        assert called["n"] == 0  # DB 命中，rg 不触发

    def test_synthetic_node_carries_source_path(self, tmp_path: Path, monkeypatch):
        idx = self._make_idx(tmp_path, monkeypatch)
        (tmp_path / "untracked2.md").write_text("NEEDLE_SYN_2 内容\n", encoding="utf-8")

        from doclens.ripgrep import execute_grep_search

        r = execute_grep_search(idx, "NEEDLE_SYN_2")
        assert len(r.content_results) == 1
        node = r.content_results[0][1]
        assert node.get("source_path", "").endswith("untracked2.md")
