# -*- coding: utf-8 -*-
"""服务端语法分词测试（ADR-0032）。

覆盖：
- 8 类 kind 归一化（关键字/函数/类型/字符串/数字/注释/操作符/标点/正文空串）；
- 行口径不变量：len(tokens) == len(content.split("\\n"))（含各种结尾形态）；
- 多行字符串/块注释跨行词法正确；
- 跳过面：txt（TextLexer）/markdown/html/未知后缀/空文件/超 1MB → None；
- 端点级：整文件与范围切片（start_line/end_line）的 tokens 与 content 行对齐。
"""
import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from doclens.web_v2.syntax_tokens import tokenize_code  # noqa: E402


def _flat(lines):
    """行数组 → 拼回全文（run 文本顺序拼接，行间 \\n）。"""
    return "\n".join("".join(text for _kind, text in runs) for runs in lines)


# --- 归一化 ----------------------------------------------------------------

def test_kind_normalization():
    code = (
        "import os\n"                      # k
        "def hi(n: int) -> int:\n"        # k f (p p t o t p
        "    # note\n"                     # c
        "    s = 'abc'\n"                  # o s
        "    x = 42\n"                     # n
        "    return hi(n) + 1.5\n"         # k f p o n
    )
    lines = tokenize_code(code, "demo.py")
    assert lines is not None
    flat = ["".join(t for _k, t in ln) for ln in lines]
    assert flat == code.split("\n")  # 含尾换行产生的末尾空行

    kinds_by_line = [{k for k, _t in ln} for ln in lines]
    assert "k" in kinds_by_line[0]           # import
    assert "f" in kinds_by_line[1]           # hi(
    assert "t" in kinds_by_line[1]           # int
    assert "c" in kinds_by_line[2]           # # note
    assert "s" in kinds_by_line[3]           # 'abc'
    assert "n" in kinds_by_line[4]           # 42
    assert "n" in kinds_by_line[5]           # 1.5


def test_unclassified_runs_use_empty_kind():
    lines = tokenize_code("name = 1\n", "a.py")
    # 'name ' 是 Name（未设规则）→ 空串 kind
    plain = [t for k, t in lines[0] if k == ""]
    assert any("name" in t for t in plain)


def test_multiline_string_spans_lines():
    code = 's = """line1\nline2\n"""\nx = 1\n'
    lines = tokenize_code(code, "a.py")
    assert lines is not None
    # 第 2 行整行都在字符串里（kind=s），跨行词法未被行切断
    assert runs_of_string_kind(lines[1]), lines[1]
    assert len(lines) == len(code.split("\n")) == 5


def runs_of_string_kind(line_runs):
    return all(k in ("s",) for k, _t in line_runs) and bool(line_runs)


# --- 行口径不变量 ----------------------------------------------------------

@pytest.mark.parametrize("text", [
    "a\nb\n", "a\nb", "a", "\n", "\n\n", "x\n\ny", "# c\n\ndef f():\n    pass\n",
])
def test_line_count_invariant(text):
    lines = tokenize_code(text, "a.py")
    assert lines is not None
    assert len(lines) == len(text.split("\n"))
    assert _flat(lines) == text


# --- 跳过面 ----------------------------------------------------------------

@pytest.mark.parametrize("filename", ["a.txt", "a.log", "a.md", "a.html", "a.zzz", "data.csv"])
def test_skipped_filenames_return_none(filename):
    assert tokenize_code("hello = 1", filename) is None


def test_empty_content_returns_none():
    assert tokenize_code("", "a.py") is None


def test_oversize_content_returns_none():
    assert tokenize_code("x" * (1024 * 1024 + 1), "a.py") is None


def test_language_coverage_smoke():
    # 文件名解析全开：主流语言都能拿到非 None
    for fn, snippet in [
        ("a.ts", "const x: number = 1;"),
        ("a.js", "let y = 2;"),
        ("a.go", "func main() {}"),
        ("a.rs", "fn main() {}"),
        ("a.java", "class A {}"),
        ("a.yaml", "a: 1"),
        ("a.toml", "a = 1"),
        ("a.sql", "SELECT 1;"),
        ("a.sh", "echo hi"),
        ("a.json", '{"k": 1}'),
    ]:
        assert tokenize_code(snippet, fn) is not None, fn


# --- 端点级 ----------------------------------------------------------------

def _fake_idx(tmp_path):
    return SimpleNamespace(search_path=str(tmp_path), path_map={})


def test_endpoint_full_and_slice_alignment(tmp_path):
    from doclens.web_v2.api import preview as preview_api

    code = "def hi(n: int) -> int:\n    # note\n    return n * 2\n"
    (tmp_path / "demo.py").write_text(code, encoding="utf-8")

    r = asyncio.run(preview_api.preview(
        path="demo.py", start_line=0, end_line=0, idx=_fake_idx(tmp_path)))
    assert r.language == "python"
    assert r.tokens is not None
    assert len(r.tokens) == len(r.content.split("\n"))
    assert _flat(r.tokens) == r.content

    # 范围切片：tokens 行与 content 切片一一对齐，行号语义不漂移
    r2 = asyncio.run(preview_api.preview(
        path="demo.py", start_line=2, end_line=3, idx=_fake_idx(tmp_path)))
    assert r2.line_range == (2, 3)
    assert r2.tokens is not None
    assert len(r2.tokens) == 2
    assert _flat(r2.tokens) == r2.content
    # 第 2 行是注释行 → kind=c
    assert "c" in {k for k, _t in r2.tokens[0]}


def test_endpoint_txt_has_no_tokens(tmp_path):
    from doclens.web_v2.api import preview as preview_api

    (tmp_path / "note.txt").write_text("plain text", encoding="utf-8")
    r = asyncio.run(preview_api.preview(
        path="note.txt", start_line=0, end_line=0, idx=_fake_idx(tmp_path)))
    assert r.tokens is None
