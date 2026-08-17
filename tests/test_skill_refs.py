"""skill_refs（提取式引文）单元测试：tmp_path 模拟 workdir。"""
from pathlib import Path

import pytest

from doclens.web_v2.skill_refs import (
    curate_skill_references,
    extract_skill_paths,
    is_skill_message,
)


@pytest.fixture()
def workdir(tmp_path: Path) -> Path:
    for rel in (
        "医疗/癌症治疗.md",
        "医疗/体检报告.pdf",
        "科技/量子计算.docx",
        "notes.md",
    ):
        f = tmp_path / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text("doc", encoding="utf-8")
    return tmp_path


class TestIsSkillMessage:
    def test_marked(self):
        assert is_skill_message('[调用技能: summarize-files]\n文件：...') is True

    def test_colon_fullwidth(self):
        assert is_skill_message('[调用技能：summarize-files] 正文') is True

    def test_mark_must_be_prefix(self):
        assert is_skill_message('总结一下\n[调用技能: x]') is False

    def test_plain(self):
        assert is_skill_message("普通问题") is False

    def test_empty(self):
        assert is_skill_message("") is False


class TestExtractPaths:
    def test_extract_existing(self, workdir):
        text = "根据 医疗/癌症治疗.md 和 科技/量子计算.docx 的内容……"
        assert extract_skill_paths(text, workdir) == [
            "医疗/癌症治疗.md",
            "科技/量子计算.docx",
        ]

    def test_root_level_file(self, workdir):
        assert extract_skill_paths("见 notes.md", workdir) == ["notes.md"]

    def test_nonexistent_dropped(self, workdir):
        text = "引用了 幻觉/不存在.md 与 医疗/癌症治疗.md"
        assert extract_skill_paths(text, workdir) == ["医疗/癌症治疗.md"]

    def test_dedup_keep_order(self, workdir):
        text = "先看 医疗/癌症治疗.md，再说 医疗/体检报告.pdf，回到 医疗/癌症治疗.md"
        assert extract_skill_paths(text, workdir) == [
            "医疗/癌症治疗.md",
            "医疗/体检报告.pdf",
        ]

    def test_no_extension_word_ignored(self, workdir):
        """无扩展名的普通词不提取。"""
        assert extract_skill_paths("这是一个 folder/name 串", workdir) == []

    def test_url_not_matched(self, workdir):
        """URL 中的路径片段（如 https://a.b/x.md）不提取（左边界挡住）。"""
        assert extract_skill_paths("参见 https://example.com/x.md", workdir) == []

    def test_backslash_normalized(self, workdir):
        """反斜杠分隔符归一为正斜杠。"""
        assert extract_skill_paths("见 医疗\\癌症治疗.md", workdir) == ["医疗/癌症治疗.md"]

    def test_traversal_rejected(self, workdir):
        assert extract_skill_paths("../医疗/癌症治疗.md", workdir) == []

    def test_absolute_rejected(self, workdir):
        assert extract_skill_paths("/医疗/癌症治疗.md", workdir) == []


class TestCurate:
    def test_append_section(self, workdir):
        text = "核心论点来自 医疗/癌症治疗.md：早筛有效。"
        result = curate_skill_references(text, workdir)
        assert result.startswith(text.rstrip())
        assert "## 参考资料\n1. 医疗/癌症治疗.md" in result

    def test_multiple_paths_numbered(self, workdir):
        text = "甲见 医疗/癌症治疗.md，乙见 科技/量子计算.docx。"
        result = curate_skill_references(text, workdir)
        assert "1. 医疗/癌症治疗.md" in result
        assert "2. 科技/量子计算.docx" in result

    def test_ai_written_section_stripped_and_rebuilt(self, workdir):
        """AI 自写参考资料章节先剥掉，再用正文提取结果重建。"""
        text = (
            "结论见 医疗/癌症治疗.md。\n\n"
            "## 参考资料\n1. 幻觉/不存在.md\n"
        )
        result = curate_skill_references(text, workdir)
        assert "幻觉/不存在.md" not in result
        assert "1. 医疗/癌症治疗.md" in result

    def test_no_paths_no_append(self, workdir):
        text = "这个文件没有提到任何路径。"
        assert curate_skill_references(text, workdir) == text

    def test_no_paths_ai_section_still_stripped(self, workdir):
        """没提取到路径时，AI 自写章节仍被剥除（不保留幻觉引文）。"""
        text = "结论成立。\n\n## 参考资料\n1. 幻觉/不存在.md\n"
        result = curate_skill_references(text, workdir)
        assert "## 参考资料" not in result
        assert "幻觉/不存在.md" not in result
