"""extract_references 单测：从检索工具结果提取去重保序的引用 path。

数据源是 SSE tool_result 里的 output 文本，三种检索工具格式：
- search_kb: <path>rel/path</path>（在 <meta> 内，不带行号）
- grep:      <path>rel/path:行号</path>（可能带 :行号 后缀）
- read_document: 首行 "文档: rel/path"（错误输出如 "文档不存在:" 不应提取）
"""
from doclens.web_v2.references import extract_references


def _tc(name: str, output: str, is_error: bool = False) -> dict:
    return {"name": name, "output": output, "is_error": is_error}


class TestSearchKb:
    def test_extracts_paths_from_meta_xml(self):
        output = (
            "Found 2 results:\n"
            "Use read_document tool to read full content...\n"
            '<result index="1" score="100%">\n'
            "  <meta>\n"
            "    <doc>量子计算导论</doc>\n"
            "    <path>科技/第一章.md</path>\n"
            "  </meta>\n"
            "</result>\n"
            '<result index="2" score="80%">\n'
            "  <meta>\n"
            "    <path>科技/第二章.md</path>\n"
            "  </meta>\n"
            "</result>"
        )
        refs = extract_references([_tc("search_kb", output)])
        assert refs == [{"path": "科技/第一章.md"}, {"path": "科技/第二章.md"}]


class TestGrep:
    def test_extracts_path_and_strips_line_number_suffix(self):
        output = (
            "Found 1 results in 1 files:\n"
            '<result index="1" score="100%">\n'
            "  <path>科技/report.pdf:59</path>\n"
            "  <content>NSFC launched...</content>\n"
            "</result>"
        )
        refs = extract_references([_tc("grep", output)])
        assert refs == [{"path": "科技/report.pdf"}]

    def test_path_without_line_number_unchanged(self):
        output = '<result>\n  <path>科技/report.pdf</path>\n</result>'
        refs = extract_references([_tc("grep", output)])
        assert refs == [{"path": "科技/report.pdf"}]


class TestReadDocument:
    def test_extracts_header_path(self):
        output = "文档: 科技/notes.md\n格式: .md (1.2 KB)\n## 内容\n\n正文..."
        refs = extract_references([_tc("read_document", output)])
        assert refs == [{"path": "科技/notes.md"}]

    def test_not_found_output_skipped(self):
        refs = extract_references([_tc("read_document", "文档不存在: 科技/x.md")])
        assert refs == []

    def test_parse_failed_output_skipped(self):
        refs = extract_references([_tc("read_document", "文档解析失败: 缺少依赖")])
        assert refs == []

    def test_empty_parse_output_skipped(self):
        refs = extract_references([_tc("read_document", "文档解析结果为空: 科技/x.md")])
        assert refs == []


class TestDedupAndOrder:
    def test_dedup_keeps_first_occurrence_across_tools(self):
        # search_kb 给 a.md，grep 给 a.md:10（同文件不同行）→ 去重为一个
        refs = extract_references([
            _tc("search_kb", "<result><meta><path>a.md</path></meta></result>"),
            _tc("grep", "<result>\n  <path>a.md:10</path>\n</result>"),
        ])
        assert refs == [{"path": "a.md"}]

    def test_mixed_tools_preserve_first_seen_order(self):
        refs = extract_references([
            _tc("search_kb", "<path>a.md</path>"),
            _tc("read_document", "文档: b.md\n..."),
            _tc("grep", "<path>c.md:5</path>"),
        ])
        assert refs == [{"path": "a.md"}, {"path": "b.md"}, {"path": "c.md"}]


class TestFiltering:
    def test_skips_error_tool_results(self):
        refs = extract_references([_tc("search_kb", "<path>a.md</path>", is_error=True)])
        assert refs == []

    def test_skips_non_retrieval_tools(self):
        refs = extract_references([_tc("manage_kb", "知识库状态:\n  索引路径: /x/index.db")])
        assert refs == []

    def test_empty_input_returns_empty(self):
        assert extract_references([]) == []

    def test_output_without_path_returns_empty(self):
        assert extract_references([_tc("search_kb", "未找到包含 'x' 的结果。")]) == []


class TestValidatePaths:
    def test_all_exist(self, tmp_path):
        from doclens.web_v2.references import validate_paths
        (tmp_path / "a").mkdir()
        (tmp_path / "a" / "b.md").write_text("x", encoding="utf-8")
        assert validate_paths(["a/b.md"], tmp_path) == []

    def test_returns_missing(self, tmp_path):
        from doclens.web_v2.references import validate_paths
        assert validate_paths(["a/b.md", "c/d.md"], tmp_path) == ["a/b.md", "c/d.md"]

    def test_normalizes_leading_dot(self, tmp_path):
        from doclens.web_v2.references import validate_paths
        (tmp_path / "x.md").write_text("x", encoding="utf-8")
        assert validate_paths(["./x.md"], tmp_path) == []

    def test_dedup_preserves_order(self, tmp_path):
        from doclens.web_v2.references import validate_paths
        assert validate_paths(["p.md", "p.md", "q.md"], tmp_path) == ["p.md", "q.md"]


class TestToRelativePath:
    def test_absolute_to_relative_forward_slash(self, tmp_path):
        from doclens.web_v2.references import to_relative_path
        (tmp_path / "公司").mkdir()
        (tmp_path / "公司" / "a.docx").write_text("x", encoding="utf-8")
        abs_path = str(tmp_path / "公司" / "a.docx")
        assert to_relative_path(abs_path, tmp_path) == "公司/a.docx"

    def test_backslash_to_forward(self, tmp_path):
        from doclens.web_v2.references import to_relative_path
        assert to_relative_path("公司\\a.docx", tmp_path) == "公司/a.docx"

    def test_already_relative_forward_unchanged(self, tmp_path):
        from doclens.web_v2.references import to_relative_path
        assert to_relative_path("公司/a.docx", tmp_path) == "公司/a.docx"

    def test_absolute_outside_workdir_falls_back_to_forward_slash(self, tmp_path):
        from doclens.web_v2.references import to_relative_path
        # 绝对路径不在 workdir 下：relative_to 抛 ValueError，降级为仅替换斜杠
        assert to_relative_path("D:\\other\\x.md", tmp_path) == "D:/other/x.md"


class TestNormalizePaths:
    def test_dedup_same_file_abs_and_rel(self, tmp_path):
        from doclens.web_v2.references import normalize_paths
        (tmp_path / "公司").mkdir()
        (tmp_path / "公司" / "a.docx").write_text("x", encoding="utf-8")
        abs_path = str(tmp_path / "公司" / "a.docx")
        # 绝对 + 相对（反斜杠）指同一文件 → 去重为一条相对正斜杠
        assert normalize_paths([abs_path, "公司\\a.docx"], tmp_path) == ["公司/a.docx"]

    def test_preserves_first_seen_order(self, tmp_path):
        from doclens.web_v2.references import normalize_paths
        assert normalize_paths(["b.md", "a.md", "b.md"], tmp_path) == ["b.md", "a.md"]

    def test_filters_empty(self, tmp_path):
        from doclens.web_v2.references import normalize_paths
        assert normalize_paths(["", "a.md"], tmp_path) == ["a.md"]
