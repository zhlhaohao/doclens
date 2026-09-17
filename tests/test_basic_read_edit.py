"""read_file / edit_file 工具行为测试（ADR-0024）。

覆盖：
- read_file：行号前缀格式（行号<TAB>内容，1-based）、offset/limit 按行分块、
  空文件、offset 越界、字符预算截断与续读提示
- edit_file：唯一匹配替换、非唯一报错、replace_all 全替换、文本不存在报错
"""

from pathlib import Path

import pytest

from planify.tools import basic
from planify.tools.basic import run_edit, run_read


@pytest.fixture
def workdir(tmp_path) -> Path:
    return tmp_path


@pytest.fixture
def sample(workdir) -> Path:
    p = workdir / "a.txt"
    p.write_text("第一行\nsecond line\n第三行\n", encoding="utf-8")
    return p


# -------------------- read_file --------------------


def test_read_full_with_line_numbers(workdir, sample):
    out = run_read("a.txt", workdir)
    assert out == "1\t第一行\n2\tsecond line\n3\t第三行"


def test_read_offset_limit(workdir, sample):
    out = run_read("a.txt", workdir, offset=2, limit=1)
    assert out == "2\tsecond line"


def test_read_offset_to_eof(workdir, sample):
    out = run_read("a.txt", workdir, offset=3)
    assert out == "3\t第三行"


def test_read_limit_clamps_at_eof(workdir, sample):
    out = run_read("a.txt", workdir, offset=2, limit=99)
    assert out == "2\tsecond line\n3\t第三行"


def test_read_offset_beyond_eof(workdir, sample):
    out = run_read("a.txt", workdir, offset=10)
    assert "超出文件范围" in out
    assert "共 3 行" in out


def test_read_empty_file(workdir):
    (workdir / "empty.txt").write_text("", encoding="utf-8")
    out = run_read("empty.txt", workdir)
    assert "文件为空" in out


def test_read_truncation_with_resume_hint(workdir, monkeypatch):
    monkeypatch.setattr(basic, "READ_FILE_MAX_CHARS", 30)
    lines = [f"line-{i:03d}-abcdefghij" for i in range(1, 21)]
    (workdir / "big.txt").write_text("\n".join(lines), encoding="utf-8")

    out = run_read("big.txt", workdir)
    assert "内容已截断" in out
    assert "共 20 行" in out
    assert "使用 offset=" in out

    # 续读提示的 offset 正好接续已显示行
    import re

    m = re.search(r"已显示第 1-(\d+) 行.*使用 offset=(\d+)", out)
    assert m is not None
    shown_end, next_offset = int(m.group(1)), int(m.group(2))
    assert next_offset == shown_end + 1

    # 续读能拿到下一行
    out2 = run_read("big.txt", workdir, offset=next_offset, limit=1)
    assert out2.startswith(f"{next_offset}\tline-")


def test_read_explicit_limit_no_hint(workdir):
    """显式 limit 是调用方自己开的窗，不附截断提示（对齐 Claude Code）。"""
    (workdir / "b.txt").write_text("a\nb\nc\nd\n", encoding="utf-8")
    out = run_read("b.txt", workdir, limit=2)
    assert out == "1\ta\n2\tb"


def test_read_no_truncation_marker_when_complete(workdir, sample):
    out = run_read("a.txt", workdir)
    assert "内容已截断" not in out


# -------------------- edit_file --------------------


def test_edit_unique_match(workdir, sample):
    out = run_edit("a.txt", "second line", "2nd line", workdir)
    assert out == "Edited a.txt"
    assert sample.read_text(encoding="utf-8") == "第一行\n2nd line\n第三行\n"


def test_edit_non_unique_rejected(workdir):
    (workdir / "dup.txt").write_text("foo\nbar\nfoo\n", encoding="utf-8")
    out = run_edit("dup.txt", "foo", "baz", workdir)
    assert out.startswith("Error:")
    assert "不唯一" in out
    assert "replace_all" in out
    # 文件未被改动
    assert (workdir / "dup.txt").read_text(encoding="utf-8") == "foo\nbar\nfoo\n"


def test_edit_replace_all(workdir):
    p = workdir / "dup.txt"
    p.write_text("foo\nbar\nfoo\n", encoding="utf-8")
    out = run_edit("dup.txt", "foo", "baz", workdir, replace_all=True)
    assert "替换 2 处" in out
    assert p.read_text(encoding="utf-8") == "baz\nbar\nbaz\n"


def test_edit_text_not_found(workdir, sample):
    out = run_edit("a.txt", "不存在的内容", "x", workdir)
    assert out.startswith("Error:")
    assert "not found" in out


def test_edit_line_number_prefix_not_required(workdir, sample):
    """old_text 用 read_file 输出剥掉行号前缀后的内容即可匹配。"""
    read_out = run_read("a.txt", workdir, offset=2, limit=1)
    content_after_prefix = read_out.split("\t", 1)[1]
    out = run_edit("a.txt", content_after_prefix, "replaced", workdir)
    assert out == "Edited a.txt"
