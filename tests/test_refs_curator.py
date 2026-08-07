"""refs_curator 单元测试（合成用例，tmp_path 模拟 workdir）。"""
from pathlib import Path

import pytest

from doclens.web_v2.refs_curator import MAX_FALLBACK_REFS, curate_references


@pytest.fixture()
def workdir(tmp_path: Path) -> Path:
    for rel in ("a/x.md", "a/y.md", "a/z.md", "b/p.md", "b/q.md"):
        f = tmp_path / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text("doc", encoding="utf-8")
    return tmp_path


def _search_tc(*paths: str) -> dict:
    output = "".join(f"<path>{p}</path>\n" for p in paths)
    return {"name": "search_kb", "output": output}


def _read_tc(path: str) -> dict:
    return {"name": "read_document", "output": f"文档: {path}\n正文内容..."}


class TestNoRetrieval:
    def test_passthrough(self, workdir: Path):
        text = "流程性回复：索引已重建完成。"
        result = curate_references(text, [{"name": "manage_kb", "output": "ok"}], workdir)
        assert result.text == text
        assert result.fallback is False
        assert result.paths == []

    def test_error_tool_not_counted(self, workdir: Path):
        text = "检索失败了。"
        tc = {"name": "search_kb", "output": "<path>a/x.md</path>", "is_error": True}
        result = curate_references(text, [tc], workdir)
        assert result.text == text
        assert result.fallback is False


class TestCompliantPath:
    def test_all_cited_unchanged(self, workdir: Path):
        text = "甲 [1]，乙 [2]。\n\n## 参考资料\n1. a/x.md\n2. a/y.md\n"
        result = curate_references(text, [_search_tc("a/x.md", "a/y.md")], workdir)
        assert result.fallback is False
        assert result.paths == ["a/x.md", "a/y.md"]
        assert "[1]" in result.text and "[2]" in result.text

    def test_uncited_entry_dropped_and_renumbered(self, workdir: Path):
        """列表第 2 项未被引用 → 剔除，原 [3] 重编号为 [2]。"""
        text = "甲 [1]，丙 [3]。\n\n## 参考资料\n1. a/x.md\n2. a/y.md\n3. a/z.md\n"
        result = curate_references(text, [_search_tc("a/x.md")], workdir)
        assert result.fallback is False
        assert result.paths == ["a/x.md", "a/z.md"]
        assert "[2]" in result.text and "[3]" not in result.text
        assert "a/y.md" not in result.text

    def test_dangling_mark_stripped(self, workdir: Path):
        """[3] 超出列表长度 → 剥掉；第 2 条未被引用 → 一并剔除。"""
        text = "甲 [1]，乙 [3]。\n\n## 参考资料\n1. a/x.md\n2. a/y.md\n"
        result = curate_references(text, [_search_tc("a/x.md", "a/y.md")], workdir)
        assert result.fallback is False
        assert result.paths == ["a/x.md"]
        assert "[3]" not in result.text
        assert "[1]" in result.text

    def test_nonexistent_path_dropped(self, workdir: Path):
        text = "甲 [1]，乙 [2]。\n\n## 参考资料\n1. a/x.md\n2. a/ghost.md\n"
        result = curate_references(text, [_search_tc("a/x.md")], workdir)
        assert result.fallback is False
        assert result.paths == ["a/x.md"]

    def test_all_paths_hallucinated_falls_back(self, workdir: Path):
        """AI 列表全是幻觉路径 → 降级兜底，取 read_document 的 path。"""
        text = "甲 [1]。\n\n## 参考资料\n1. a/ghost.md\n"
        tcs = [_search_tc("a/x.md", "a/y.md"), _read_tc("a/y.md")]
        result = curate_references(text, tcs, workdir)
        assert result.fallback is True
        assert result.paths[0] == "a/y.md"

    def test_no_marks_keeps_ai_list(self, workdir: Path):
        """正文无 [N] 且工具无任何佐证信号 → 保底保留 AI 原列表。"""
        text = "甲和乙。\n\n## 参考资料\n1. a/x.md\n2. a/y.md\n"
        tc = {"name": "search_kb", "output": "Found 0 results"}
        result = curate_references(text, [tc], workdir)
        assert result.fallback is False
        assert result.paths == ["a/x.md", "a/y.md"]


def _grep_tc(*path_snippet: tuple[str, str]) -> dict:
    """构造 grep output: (path, content) 对。"""
    entries = "".join(
        f'<result index="{i}" score="50%" matches="1/1">\n'
        f"  <path>{p}</path>\n  <content>{s}</content>\n</result>\n"
        for i, (p, s) in enumerate(path_snippet, 1)
    )
    return {"name": "grep", "output": f"Found {len(path_snippet)} results:\n{entries}"}


class TestEvidenceCuration:
    """A3:正文无 [N] 时的内容佐证校验(眼镜度数真实案例复现)。"""

    def test_wrong_citations_replaced_by_true_source(self, workdir: Path):
        """AI 列了 3 个无关命中,真实来源在 grep 结果里但未列出 → 纠正。"""
        body = "您的眼镜度数:左眼 -1.0,右眼 -2.75,瞳距 64mm。\n"
        text = body + "\n## 参考资料\n1. a/x.md\n2. a/y.md\n3. a/z.md\n"
        tcs = [_grep_tc(
            ("a/x.md", "RAG 系统优化方法讨论,与问题无关的内容"),
            ("a/y.md", "完全不同的文档片段,谈论其他主题"),
            ("a/z.md", "再一个无关片段,讲数据库调度"),
            ("b/p.md", "眼镜度数: 左眼:-1.0 右眼:-2.75 瞳距: 64"),
        )]
        result = curate_references(text, tcs, workdir)
        assert result.fallback is False
        assert result.paths == ["b/p.md"]  # 只留真实来源
        assert "## 参考资料\n1. b/p.md" in result.text

    def test_mixed_keep_evidenced_and_add(self, workdir: Path):
        """已列条目中有佐证的保留,无佐证的剔除;未列强佐证补入。"""
        body = "固态电池能量密度达 500Wh/kg,宁德时代计划 2028 年量产。\n"
        text = body + "\n## 参考资料\n1. a/x.md\n2. a/y.md\n"
        tcs = [_grep_tc(
            ("a/x.md", "宁德时代计划 2028 年量产硫化物全固态电池"),
            ("a/y.md", "太阳能与风能技术详解,和电池无关"),
            ("b/q.md", "固态电池能量密度达 500Wh/kg 的技术分析"),
        )]
        result = curate_references(text, tcs, workdir)
        assert result.fallback is False
        assert "a/x.md" in result.paths
        assert "b/q.md" in result.paths
        assert "a/y.md" not in result.paths

    def test_read_document_full_text_evidence(self, workdir: Path):
        """read_document 整篇文档作为证据时,正文覆盖度指标生效。"""
        body = "报告核心结论:量子纠错阈值已突破 99.5% 表面码 fidelity。\n"
        text = body + "\n## 参考资料\n1. a/x.md\n2. a/y.md\n"
        doc = "长文档……" * 50 + "量子纠错阈值已突破 99.5%,表面码 fidelity 达标。" + "……" * 50
        tcs = [
            _grep_tc(("a/y.md", "完全无关的片段内容,谈论别的主题")),
            _read_tc("a/x.md") | {"output": f"文档: a/x.md\n{doc}"},
        ]
        result = curate_references(text, tcs, workdir)
        assert result.fallback is False
        assert "a/x.md" in result.paths
        assert "a/y.md" not in result.paths


class TestFallbackPath:
    def test_missing_section_read_doc_first(self, workdir: Path):
        text = "甲。\n"
        tcs = [_search_tc("a/x.md", "b/p.md"), _read_tc("b/q.md")]
        result = curate_references(text, tcs, workdir)
        assert result.fallback is True
        assert result.paths[0] == "b/q.md"  # read_document 优先
        assert "## 参考资料" in result.text

    def test_fallback_strips_body_marks(self, workdir: Path):
        """兜底列表序号与原标注无对应关系 → [N] 剥掉，避免错位。"""
        text = "甲 [1]，乙 [2]。\n"
        result = curate_references(text, [_read_tc("a/x.md")], workdir)
        assert result.fallback is True
        assert "[1]" not in result.text and "[2]" not in result.text

    def test_fallback_capped(self, workdir: Path):
        paths = [f"a/{c}.md" for c in "xyzpqr"]
        for p in paths:
            (workdir / p).write_text("doc", encoding="utf-8")
        result = curate_references("甲。\n", [_search_tc(*paths)], workdir)
        assert len(result.paths) == MAX_FALLBACK_REFS

    def test_fallback_empty_keeps_text(self, workdir: Path):
        """工具 output 无可提取 path → 原文返回 + fallback 标记（toast）。"""
        tc = {"name": "search_kb", "output": "没有找到相关文档"}
        result = curate_references("甲。\n", [tc], workdir)
        assert result.text == "甲。\n"
        assert result.fallback is True
        assert result.paths == []

    def test_fallback_prefers_paths_mentioned_in_text(self, workdir: Path):
        """章节坏了但正文提到过的工具 path 优先于未提到的 search 命中。"""
        text = "参考 a/z.md 可知甲。\n## 参考\n- a/z.md\n"  # 章节名不合规
        tcs = [_search_tc("a/x.md", "a/z.md")]
        result = curate_references(text, tcs, workdir)
        assert result.fallback is True
        assert result.paths[0] == "a/z.md"
