"""文件分组响应（GroupedSearchResponse）的单元测试。

覆盖 _grouping 的四个职责：命中行提取（关键词/正则/LIKE 退化）、
行截断坐标系、文件分组排序与分页、grep path 命中独立成组。
"""

import pytest

from doclens.web_v2.api._grouping import (
    MATCHES_PER_FILE_CAP,
    MATCH_ROW_MAX_CHARS,
    build_regex_matchers,
    build_substring_matchers,
    extract_like_rows,
    extract_match_rows,
    group_and_paginate,
)
from doclens.web_v2.models.search import FileGroup, MatchItem


class TestExtractMatchRows:
    def test_line_numbers_offset_by_line_start(self):
        m = build_substring_matchers(["深度学习"])
        rows = extract_match_rows("第1行\n深度学习在医疗\n第3行\n基于深度学习\n", 10, m)
        assert [r.line for r in rows] == [11, 13]
        assert rows[0].spans == [(0, 4)]

    def test_no_line_start_gives_none(self):
        m = build_substring_matchers(["kw"])
        rows = extract_match_rows("kw here\nkw there", None, m)
        assert all(r.line is None for r in rows)
        assert len(rows) == 2

    def test_multi_word_multi_span_merged(self):
        m = build_substring_matchers(["foo", "bar"])
        rows = extract_match_rows("foo bar baz", 1, m)
        assert rows[0].spans == [(0, 3), (4, 7)]  # 相邻不重叠则不合并

    def test_overlapping_spans_merged(self):
        m = build_substring_matchers(["ab", "bc"])
        rows = extract_match_rows("abc", 1, m)
        assert rows[0].spans == [(0, 3)]  # ab(0,2)+bc(1,3) 重叠合并

    def test_long_line_truncated_hit_visible(self):
        m = build_substring_matchers(["命中"])
        line = "a" * 300 + "命中" + "b" * 300
        rows = extract_match_rows(line, 1, m)
        assert len(rows) == 1
        r = rows[0]
        assert len(r.text) <= MATCH_ROW_MAX_CHARS + 2
        s, e = r.spans[0]
        assert r.text[s:e] == "命中"

    def test_regex_matcher(self):
        m = build_regex_matchers(["tcp.*timeout"])
        rows = extract_match_rows("const tcpRetryTimeout = 3\ncfg.tcp.socket.timeout = 5", 1, m)
        # 逐行匹配：两行各命中一次（'.' 不跨 \n，finditer 逐行跑）
        assert [r.line for r in rows] == [1, 2]
        assert rows[0].spans == [(6, 21)]
        assert rows[1].spans == [(4, 22)]

    def test_regex_invalid_falls_back_substring(self):
        m = build_regex_matchers(["a[b"])  # 非法正则
        rows = extract_match_rows("xa[byz", 1, m)
        assert len(rows) == 1

    def test_cjk_case_insensitive_ascii(self):
        m = build_substring_matchers(["Error"])
        rows = extract_match_rows("runtime error occurred", 1, m)
        assert rows[0].spans == [(8, 13)]


class TestLikeRows:
    def test_single_row_no_line(self):
        m = build_substring_matchers(["量子"])
        rows = extract_like_rows("前置行\n量子计算导论\n后置行", m)
        assert len(rows) == 1
        assert rows[0].line is None
        assert "量子" in rows[0].text

    def test_no_hit_falls_back_first_nonempty(self):
        m = build_substring_matchers(["zzz"])
        rows = extract_like_rows("\n  \nfirst line\nsecond", m)
        assert len(rows) == 1
        assert rows[0].text == "first line"
        assert rows[0].spans == []


class TestGroupAndPaginate:
    def test_merge_same_file_line_sorted(self):
        items = [
            ("a.md", 0.9, [MatchItem(line=5, text="x"), MatchItem(line=2, text="y")]),
            ("a.md", 0.5, [MatchItem(line=9, text="z")]),
            ("b.md", 0.7, [MatchItem(line=1, text="w")]),
        ]
        page, tf, tm, _ = group_and_paginate(items, 0, 20)
        assert tf == 2 and tm == 4
        a = page[0]
        assert a.path == "a.md"
        assert a.best_score == 0.9
        assert [m.line for m in a.matches] == [2, 5, 9]
        assert a.total_matches == 3

    def test_pagination_unit_is_files(self):
        items = [(f"f{i}.md", 1.0 - i * 0.01, [MatchItem(line=1, text="x")]) for i in range(45)]
        page, tf, _, so = group_and_paginate(items, offset=40, limit=20)
        assert tf == 45
        assert len(page) == 5
        assert so == 40

    def test_matches_cap_and_truncated_flag(self):
        big = [("big.md", 1.0, [MatchItem(line=i, text="x") for i in range(80)])]
        page, _, _, _ = group_and_paginate(big, 0, 20)
        g = page[0]
        assert len(g.matches) == MATCHES_PER_FILE_CAP
        assert g.total_matches == 80
        assert g.truncated

    def test_path_groups_appended_after_content(self):
        items = [("c.md", 0.9, [MatchItem(line=1, text="t")])]
        paths = [
            ("d.md", 0.0, [MatchItem(line=None, text="路径匹配: d.md")]),
            ("c.md", 0.0, [MatchItem(line=None, text="路径匹配: c.md")]),
        ]
        page, tf, tm, _ = group_and_paginate(items, 0, 20, path_items=paths)
        assert tf == 2  # c.md 不重复成组
        assert [g.path for g in page] == ["c.md", "d.md"]
        assert page[0].kind == "content"
        assert page[1].kind == "path"

    def test_empty(self):
        page, tf, tm, so = group_and_paginate([], 0, 20)
        assert page == [] and tf == 0 and tm == 0 and so == 0

    def test_offset_overflow_returns_empty_page(self):
        """BUG-F7 已修：越界返回空页（不再 clamp 回显末页）。"""
        items = [(f"f{i}.md", 0.9, [MatchItem(line=1, text="x")]) for i in range(5)]
        page, _, _, off = group_and_paginate(items, offset=99, limit=20)
        assert off == 99
        assert page == []

    def test_dict_rows_normalized(self):
        """grep path 命中曾以裸 dict 传行（回归：'dict' object has no attribute 'line'）。"""
        items = [("c.md", 0.9, [MatchItem(line=1, text="t")])]
        paths = [("d.md", 0.0, [{"line": None, "text": "路径匹配: d.md", "spans": []}])]
        page, tf, _, _ = group_and_paginate(items, 0, 20, path_items=paths)
        assert tf == 2
        assert page[1].matches[0].line is None
        assert page[1].matches[0].text == "路径匹配: d.md"


class TestModels:
    def test_file_group_defaults(self):
        g = FileGroup(path="a.md")
        assert g.kind == "content"
        assert g.total_matches == 0
        assert g.matches == []

    def test_grouped_response_shape(self):
        from doclens.web_v2.models.search import GroupedSearchResponse

        r = GroupedSearchResponse(groups=[], total=0, total_matches=0, query="q", elapsed_ms=1)
        assert r.source == "fts"
        assert r.error is None
