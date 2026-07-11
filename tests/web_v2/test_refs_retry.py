"""evaluate_round 单测：参考资料合规判定（A 方案，不重试）。"""
from doclens.web_v2.refs_retry import evaluate_round, RoundResult


def _round(text, tool_calls):
    return RoundResult(text=text, tool_calls=tool_calls)


def test_exempt_when_no_retrieval_tool(tmp_path):
    """没调检索工具 → 豁免（compliant，无 refs）。"""
    result = _round("已为你重建索引。", [{"name": "manage_kb", "output": "ok"}])
    compliant, diagnostics, refs = evaluate_round(result, tmp_path)
    assert compliant is True
    assert diagnostics == []
    assert refs == []


def test_compliant_with_valid_section_and_paths(tmp_path):
    """正文有合规章节 + 路径存在 → compliant，refs=parsed.paths。"""
    (tmp_path / "a").mkdir()
    (tmp_path / "a" / "b.md").write_text("x", encoding="utf-8")
    md = "回答 [1]。\n\n## 参考资料\n1. a/b.md\n"
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    compliant, diagnostics, refs = evaluate_round(_round(md, tc), tmp_path)
    assert compliant is True
    assert diagnostics == []
    assert refs == [{"path": "a/b.md"}]


def test_not_compliant_missing_section(tmp_path):
    """用了检索工具但无 ## 参考资料 → 不合规。"""
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    compliant, diagnostics, refs = evaluate_round(_round("回答 [1]。", tc), tmp_path)
    assert compliant is False
    assert diagnostics  # 有诊断
    assert refs == []


def test_not_compliant_path_not_exist(tmp_path):
    """格式合规但路径不存在 → 不合规。"""
    md = "回答 [1]。\n\n## 参考资料\n1. 不存在.md\n"
    tc = [{"name": "search_kb", "output": "<path>不存在.md</path>", "is_error": False}]
    compliant, diagnostics, refs = evaluate_round(_round(md, tc), tmp_path)
    assert compliant is False
    assert any("路径不存在" in d for d in diagnostics)
    assert refs == []
