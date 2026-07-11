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
