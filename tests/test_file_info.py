"""file_info 工具测试：_handle_file_info 概况输出。

覆盖：多级标题 md（章节清单 + 顶层词数）、词数与 read_document 词序号一致性、
无标题纯文本、索引分支（不重解析）、未索引回退、不存在路径、目录完整列出（不截断）。
"""
import re
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens.kb_tools import (
    _handle_file_info,
    _handle_read_document,
)


@pytest.fixture()
def kb(tmp_path: Path) -> Path:
    """知识库目录：structured.md（多级标题）、plain.txt（无标题）、big.md（65 节）。"""
    (tmp_path / "structured.md").write_text(
        "# 第一章 概述\n\n量子 计算 基础 知识\n\n"
        "## 1.1 背景\n\n背景 内容 若干\n\n"
        "# 第二章 实验\n\n实验 数据 分析 结果 展示\n",
        encoding="utf-8",
    )
    (tmp_path / "plain.txt").write_text("只是 一段 普通 文本 没有 标题\n", encoding="utf-8")
    big = "\n\n".join(f"# 第{i}节\n\n内容{i}" for i in range(1, 66))
    (tmp_path / "big.md").write_text(big, encoding="utf-8")
    return tmp_path


def _fake_idx(**over):
    """最小 IndexManager 替身：path_map 空、ts=None（不查索引）、documents 空。"""
    base = dict(
        path_map={},
        ts=None,
        documents=[],
        max_read_words=4000,
        read_doc_show_toc=False,
    )
    base.update(over)
    return SimpleNamespace(**base)


class TestStructuredMd:
    def test_info_fields(self, kb: Path):
        out = _handle_file_info(_fake_idx(), kb, path="structured.md")
        assert "文档: structured.md" in out
        assert "格式: .md" in out
        assert re.search(r"修改时间: \d{4}-\d{2}-\d{2} \d{2}:\d{2}", out)
        assert "已索引: 否" in out
        assert re.search(r"总词数: \d+", out)
        assert "章节数: 3" in out

    def test_toc_listing(self, kb: Path):
        out = _handle_file_info(_fake_idx(), kb, path="structured.md")
        assert "## 目录结构" in out
        assert "- 第一章 概述" in out
        assert "  - 1.1 背景" in out  # 子节缩进
        assert "- 第二章 实验" in out
        # 顶层章节带词数估算
        assert re.search(r"- 第一章 概述（约 \d+ 词）", out)

    def test_word_count_matches_read_document(self, kb: Path):
        """file_info 的总词数必须与 read_document 的"共 N 词"一致（词序号语义）。"""
        idx = _fake_idx()
        info = _handle_file_info(idx, kb, path="structured.md")
        total = int(re.search(r"总词数: (\d+)", info).group(1))

        read = _handle_read_document(idx, kb, path="structured.md", start_word=1, end_word=5)
        m = re.search(r"共 (\d+) 词", read)
        assert m, read
        assert int(m.group(1)) == total


class TestPlainText:
    def test_no_sections(self, kb: Path):
        out = _handle_file_info(_fake_idx(), kb, path="plain.txt")
        assert "章节数: 0" in out
        assert "## 目录结构" not in out
        assert int(re.search(r"总词数: (\d+)", out).group(1)) > 0


class TestIndexedBranch:
    def test_uses_index_structure_without_parsing(self, kb: Path):
        """已索引文件走索引 structure（.fakeext 无 parser，若重解析只会得到 0 节）。"""
        f = kb / "a.fakeext"
        f.write_text("garbage", encoding="utf-8")
        doc = SimpleNamespace(
            doc_name="a",
            metadata={"source_path": str(f)},
            structure=[
                {"title": "索引章一", "text": "甲 乙 丙", "summary": "甲 乙 丙", "nodes": []},
                {"title": "索引章二", "text": "丁 戊", "summary": "丁 戊", "nodes": []},
            ],
        )
        idx = _fake_idx(ts=object(), documents=[doc])
        out = _handle_file_info(idx, kb, path="a.fakeext")
        assert "已索引: 是" in out
        assert "章节数: 2" in out
        assert "- 索引章一" in out and "- 索引章二" in out


class TestErrors:
    def test_missing_file(self, kb: Path):
        out = _handle_file_info(_fake_idx(), kb, path="不存在.md")
        assert "文档不存在" in out


class TestTocListing:
    def test_all_sections_listed(self, kb: Path):
        """目录清单不做条数截断：65 节全部列出，无「仅显示前 N 节」提示。"""
        out = _handle_file_info(_fake_idx(), kb, path="big.md")
        assert "章节数: 65" in out
        assert "仅显示前" not in out
        toc = out.split("## 目录结构", 1)[1]
        entry_lines = [l for l in toc.splitlines() if l.startswith("- ")]
        assert len(entry_lines) == 65
