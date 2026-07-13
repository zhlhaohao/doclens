"""refs_parser 单测：从 AI 正文解析「## 参考资料」章节 + 格式诊断。"""
from doclens.web_v2.refs_parser import parse_references_section, rewrite_references_section


def test_compliant_section_extracts_paths():
    md = (
        "量子计算利用量子比特 [1]。\n\n"
        "## 参考资料\n"
        "1. 量子计算/第一章.md\n"
        "2. 量子计算/第二章.md\n"
    )
    r = parse_references_section(md)
    assert r.has_section is True
    assert r.paths == ["量子计算/第一章.md", "量子计算/第二章.md"]
    assert r.diagnostics == []
    assert r.is_compliant() is True


def test_missing_section():
    r = parse_references_section("纯回答，没有参考资料章节。")
    assert r.has_section is False
    assert r.paths == []
    assert any("参考资料" in d for d in r.diagnostics)
    assert r.is_compliant() is False


def test_empty_section_no_list_items():
    r = parse_references_section("回答。\n\n## 参考资料\n\n下一段。")
    assert r.has_section is True
    assert r.paths == []
    assert any("列表" in d for d in r.diagnostics)
    assert r.is_compliant() is False


def test_bracket_prefix_rejected():
    r = parse_references_section("## 参考资料\n[1] a/b.md\n")
    assert r.is_compliant() is False
    assert any("[N]" in d for d in r.diagnostics)


def test_markdown_link_rejected():
    r = parse_references_section("## 参考资料\n1. [文本](a/b.md)\n")
    assert r.is_compliant() is False
    assert any("markdown" in d for d in r.diagnostics)


def test_file_scheme_rejected():
    r = parse_references_section("## 参考资料\n1. file://a/b.md\n")
    assert r.is_compliant() is False
    assert any("file://" in d for d in r.diagnostics)


def test_line_number_suffix_rejected():
    r = parse_references_section("## 参考资料\n1. a/b.md:42\n")
    assert r.is_compliant() is False
    assert any("行号" in d for d in r.diagnostics)


def test_angle_bracket_rejected():
    r = parse_references_section("## 参考资料\n1. <a/b.md>\n")
    assert r.is_compliant() is False
    assert any("<" in d for d in r.diagnostics)


def test_section_scoped_until_next_heading():
    md = "## 参考资料\n1. a/b.md\n## 其它\n不应被解析\n"
    r = parse_references_section(md)
    assert r.paths == ["a/b.md"]


def test_rewrite_replaces_section_with_tool_paths():
    content = "回答 [1]。\n\n## 参考资料\n1. 幻觉路径.md\n"
    out = rewrite_references_section(content, ["正确/a.md", "正确/b.md"])
    assert "幻觉路径" not in out
    assert "## 参考资料\n1. 正确/a.md\n2. 正确/b.md\n" in out


def test_rewrite_appends_when_section_missing():
    out = rewrite_references_section("回答 [1]。", ["a.md"])
    assert out.endswith("## 参考资料\n1. a.md\n")


def test_rewrite_empty_paths_returns_unchanged():
    content = "回答。\n\n## 参考资料\n1. x.md\n"
    assert rewrite_references_section(content, []) == content
