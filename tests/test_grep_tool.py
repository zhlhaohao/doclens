# -*- coding: utf-8 -*-
"""grep 工具测试（planify/tools/grep.py，ADR-0022）。

纯单测不依赖 rg（execute_rg 可 monkeypatch 替换）；文件尾部的集成测试
用 pytest.mark.skipif 条件执行，验证真实 rg 调用链路。
"""

import os
import subprocess
from pathlib import Path

import pytest

from planify.tools import grep as grep_mod
from planify.tools.grep import (
    RgRunResult,
    apply_head_limit,
    build_rg_args,
    coerce_bool,
    coerce_int,
    rg_available,
    run_grep,
    split_glob_patterns,
)


# ==================== 输入纠偏 ====================


class TestCoercion:
    def test_coerce_int_passthrough(self):
        assert coerce_int(30) == 30
        assert coerce_int(None) is None

    def test_coerce_int_numeric_string(self):
        """模型偶发把数字传成字符串：合法整数字面量纠偏。"""
        assert coerce_int("30") == 30
        assert coerce_int(" -5 ") == -5

    def test_coerce_int_rejects_garbage(self):
        """非数字字面量不吞掉（对齐 semanticNumber：不掩盖错误输入）。"""
        assert coerce_int("") is None
        assert coerce_int("abc") is None
        assert coerce_int("3.14") is None
        assert coerce_int(True) is None  # bool 是 int 子类，必须显式排除

    def test_coerce_bool(self):
        assert coerce_bool(None, True) is True
        assert coerce_bool(False, True) is False
        assert coerce_bool("true", False) is True
        assert coerce_bool("false", True) is False


# ==================== glob 拆分 ====================


class TestSplitGlobPatterns:
    def test_whitespace_split(self):
        assert split_glob_patterns("*.py *.md") == ["*.py", "*.md"]

    def test_comma_split(self):
        assert split_glob_patterns("*.py,*.md") == ["*.py", "*.md"]

    def test_brace_protection(self):
        """含 {} 的片段不按逗号拆（保护 *.{ts,tsx} 花括号展开）。"""
        assert split_glob_patterns("*.{ts,tsx}") == ["*.{ts,tsx}"]
        assert split_glob_patterns("*.{ts,tsx} *.py") == ["*.{ts,tsx}", "*.py"]

    def test_empty_fragments_dropped(self):
        assert split_glob_patterns("*.py,, *.md") == ["*.py", "*.md"]


# ==================== rg 参数构造 ====================


class TestBuildRgArgs:
    def test_defaults_files_mode(self):
        args = build_rg_args("foo", output_mode="files_with_matches")
        assert "--hidden" in args
        # VCS 目录恒排除
        for d in (".git", ".svn", ".hg", ".bzr", ".jj", ".sl"):
            assert f"!{d}" in args
        assert "--max-columns" in args
        assert "-l" in args
        assert "-n" not in args  # 行号仅 content 模式
        assert args[-1] == "foo"

    def test_count_mode(self):
        args = build_rg_args("foo", output_mode="count")
        assert "-c" in args
        assert "-l" not in args

    def test_dash_pattern_uses_e_flag(self):
        """pattern 以 - 开头必须用 -e 传递，防 rg 误解析为命令行选项。"""
        args = build_rg_args("-foo", output_mode="content")
        i = args.index("-e")
        assert args[i + 1] == "-foo"

    def test_context_precedence(self):
        """context > -C > (-B + -A)。"""
        args = build_rg_args(
            "x", output_mode="content", context=2, context_c=9,
            context_before=1, context_after=1,
        )
        assert args[args.index("-C") + 1] == "2"
        assert "-B" not in args and "-A" not in args

        args = build_rg_args("x", output_mode="content", context_c=3,
                             context_before=1, context_after=1)
        assert args[args.index("-C") + 1] == "3"
        assert "-B" not in args

        args = build_rg_args("x", output_mode="content",
                             context_before=1, context_after=4)
        assert args[args.index("-B") + 1] == "1"
        assert args[args.index("-A") + 1] == "4"

    def test_context_ignored_in_files_mode(self):
        args = build_rg_args("x", output_mode="files_with_matches", context=2)
        assert "-C" not in args

    def test_line_numbers_off(self):
        args = build_rg_args("x", output_mode="content", show_line_numbers=False)
        assert "-n" not in args

    def test_optional_flags(self):
        args = build_rg_args(
            "x", output_mode="content", case_insensitive=True,
            file_type="py", glob="*.py *.md", multiline=True,
        )
        assert "-i" in args
        assert args[args.index("--type") + 1] == "py"
        assert "-U" in args and "--multiline-dotall" in args
        globs = [args[i + 1] for i, a in enumerate(args) if a == "--glob"]
        assert "*.py" in globs and "*.md" in globs


# ==================== 分页 ====================


class TestApplyHeadLimit:
    def test_default_limit_250(self):
        items = [str(i) for i in range(300)]
        kept, applied = apply_head_limit(items, None)
        assert len(kept) == 250
        assert applied == 250

    def test_no_truncation_no_applied_limit(self):
        """未真截断时不回传 applied_limit（不误导模型翻页）。"""
        kept, applied = apply_head_limit(["a", "b"], None)
        assert kept == ["a", "b"]
        assert applied is None

    def test_zero_is_unlimited(self):
        items = [str(i) for i in range(300)]
        kept, applied = apply_head_limit(items, 0)
        assert len(kept) == 300
        assert applied is None

    def test_offset(self):
        items = [str(i) for i in range(10)]
        kept, applied = apply_head_limit(items, 3, offset=8)
        assert kept == ["8", "9"]
        assert applied is None  # offset 后不足 limit，不算截断

    def test_offset_with_truncation(self):
        items = [str(i) for i in range(10)]
        kept, applied = apply_head_limit(items, 3, offset=2)
        assert kept == ["2", "3", "4"]
        assert applied == 3


# ==================== 路径化简 ====================


class TestStripTargetPrefix:
    def test_dir_target(self, tmp_path):
        target = tmp_path / "sub"
        line = str(target) + os.sep + "a" + os.sep + "f.txt:12:content"
        assert grep_mod._strip_target_prefix(line, target) == f"a{os.sep}f.txt:12:content"

    def test_single_file_content_line(self, tmp_path):
        f = tmp_path / "f.txt"
        assert grep_mod._strip_target_prefix(f"{f}:12:content", f) == "12:content"

    def test_single_file_files_mode(self, tmp_path):
        f = tmp_path / "f.txt"
        assert grep_mod._strip_target_prefix(str(f), f) == "f.txt"

    def test_no_prefix_passthrough(self, tmp_path):
        """防御：不假设 rg 输出形态，未命中前缀原样返回。"""
        assert grep_mod._strip_target_prefix("weird", tmp_path) == "weird"


# ==================== mtime 排序 ====================


class TestSortFilesByMtime:
    def test_mtime_desc(self, tmp_path):
        old = tmp_path / "old.txt"
        new = tmp_path / "new.txt"
        old.write_text("x")
        new.write_text("x")
        os.utime(old, (1_000_000, 1_000_000))
        os.utime(new, (2_000_000, 2_000_000))
        result = grep_mod._sort_files_by_mtime([str(old), str(new)])
        assert result == [str(new), str(old)]

    def test_stat_failure_sorts_last(self, tmp_path):
        """rg 扫描与 stat 之间文件被删：按 mtime=0 排末尾，不拖垮整批。"""
        alive = tmp_path / "alive.txt"
        alive.write_text("x")
        ghost = str(tmp_path / "deleted.txt")
        result = grep_mod._sort_files_by_mtime([ghost, str(alive)])
        assert result == [str(alive), ghost]

    def test_equal_mtime_tiebreak_by_name(self, tmp_path):
        """mtime 相同按路径字典序，保证排序稳定。"""
        b = tmp_path / "b.txt"
        a = tmp_path / "a.txt"
        for f in (a, b):
            f.write_text("x")
            os.utime(f, (1_000_000, 1_000_000))
        result = grep_mod._sort_files_by_mtime([str(b), str(a)])
        assert result == [str(a), str(b)]


# ==================== run_grep 后处理（mock execute_rg） ====================


@pytest.fixture
def mock_rg(monkeypatch):
    """替换 execute_rg，返回预设行。返回 setter 函数。"""

    def _set(lines, error=None, timed_out=False):
        monkeypatch.setattr(
            grep_mod, "execute_rg",
            lambda args, target: RgRunResult(tuple(lines), error=error, timed_out=timed_out),
        )

    return _set


class TestRunGrepModes:
    def test_files_mode(self, tmp_path, mock_rg):
        f = tmp_path / "a.txt"
        f.write_text("hello")
        mock_rg([str(f)])
        out = run_grep("hello", tmp_path)
        assert out.startswith("共 1 个文件匹配")
        assert "a.txt" in out  # 相对化

    def test_files_mode_empty(self, tmp_path, mock_rg):
        mock_rg([])
        assert run_grep("nothing", tmp_path) == "未找到匹配文件"

    def test_content_mode(self, tmp_path, mock_rg):
        mock_rg([f"{tmp_path}{os.sep}a.txt:3:hit"])
        out = run_grep("hit", tmp_path, output_mode="content")
        assert out == f"a.txt:3:hit"

    def test_content_mode_pagination_note(self, tmp_path, mock_rg):
        """真截断时附分页提示（模型可据此 offset 翻页）。"""
        mock_rg([f"{tmp_path}{os.sep}a.txt:{i}:hit" for i in range(10)])
        out = run_grep("hit", tmp_path, output_mode="content", head_limit=3)
        assert out.count("hit") == 3
        assert "limit=3" in out and "offset" in out

    def test_content_mode_no_note_when_not_truncated(self, tmp_path, mock_rg):
        mock_rg([f"{tmp_path}{os.sep}a.txt:1:hit"])
        out = run_grep("hit", tmp_path, output_mode="content")
        assert "分页" not in out

    def test_count_mode(self, tmp_path, mock_rg):
        mock_rg([f"{tmp_path}{os.sep}a.txt:3", f"{tmp_path}{os.sep}b.txt:2"])
        out = run_grep("x", tmp_path, output_mode="count")
        assert f"a.txt:3" in out
        assert "共 5 处匹配，分布在 2 个文件" in out

    def test_timed_out_partial_note(self, tmp_path, mock_rg):
        """超时但有部分结果：结果可用但必须显式标注不完整。"""
        mock_rg([f"{tmp_path}{os.sep}a.txt:1:hit"], timed_out=True)
        out = run_grep("hit", tmp_path, output_mode="content")
        assert "超时" in out and "部分结果" in out

    def test_error_passthrough(self, tmp_path, mock_rg):
        mock_rg([], error="Error: 搜索超时（20s）。……")
        assert run_grep("x", tmp_path).startswith("Error: 搜索超时")


class TestRunGrepValidation:
    def test_empty_pattern(self, tmp_path):
        assert run_grep("", tmp_path).startswith("Error")

    def test_bad_output_mode(self, tmp_path):
        assert "output_mode" in run_grep("x", tmp_path, output_mode="bogus")

    def test_path_escape_rejected(self, tmp_path):
        """path 逃逸工作目录：safe_path 硬拒绝（与 read_file 同一通路）。"""
        out = run_grep("x", tmp_path, path="../../outside")
        assert "escapes workspace" in out

    def test_path_not_exists(self, tmp_path):
        out = run_grep("x", tmp_path, path="no_such_dir")
        assert "路径不存在" in out

    def test_guard_resolve_injected(self, tmp_path):
        """门禁链路：resolve 注入时由 resolve 决定放行/拒绝。"""
        calls = []

        def fake_resolve(raw, workdir, write):
            calls.append((raw, write))
            return None, "Error: 未获用户授权"

        out = run_grep("x", tmp_path, path="sub", resolve=fake_resolve)
        assert out == "Error: 未获用户授权"
        assert calls == [("sub", False)]  # grep 是读语义


class TestCharCap:
    def test_cap(self, tmp_path, mock_rg, monkeypatch):
        monkeypatch.setattr(grep_mod, "MAX_RESULT_CHARS", 100)
        mock_rg([f"{tmp_path}{os.sep}a.txt:{i}:{'x' * 40}" for i in range(10)])
        out = run_grep("x", tmp_path, output_mode="content", head_limit=0)
        assert "输出已截断" in out
        assert len(out) < 100 + 200  # 截断正文 + 提示尾巴


# ==================== 注册接线 ====================


class TestRegistration:
    def test_registered_when_rg_available(self, tmp_path, monkeypatch):
        from planify.tools.registry import build_tool_registry

        monkeypatch.delenv("PLANIFY_ENABLED_TOOLS", raising=False)
        monkeypatch.setattr("planify.tools.registry.rg_available", lambda: True)
        tools, handlers = build_tool_registry(workdir=tmp_path)
        names = {t["name"] for t in tools}
        assert "grep" in names
        assert "grep" in handlers

    def test_not_registered_when_rg_missing(self, tmp_path, monkeypatch):
        """条件注册：rg 缺失不注册，模型自然降级 bash。"""
        from planify.tools.registry import build_tool_registry

        monkeypatch.delenv("PLANIFY_ENABLED_TOOLS", raising=False)
        monkeypatch.setattr("planify.tools.registry.rg_available", lambda: False)
        tools, handlers = build_tool_registry(workdir=tmp_path)
        names = {t["name"] for t in tools}
        assert "grep" not in names
        assert "grep" not in handlers


# ==================== 真实 rg 集成测试（条件执行） ====================

requires_rg = pytest.mark.skipif(not rg_available(), reason="rg 未安装")


@requires_rg
class TestRealRipgrep:
    @pytest.fixture
    def corpus(self, tmp_path):
        (tmp_path / "a.py").write_text("def hello():\n    return 'world'\n")
        (tmp_path / "b.md").write_text("# Hello\nno match here\n")
        sub = tmp_path / "sub"
        sub.mkdir()
        (sub / "c.py").write_text("HELLO again\nhello twice\n")
        return tmp_path

    def test_files_mode(self, corpus):
        out = run_grep("hello", corpus)
        assert "a.py" in out
        assert "b.md" not in out

    def test_content_mode_line_numbers(self, corpus):
        out = run_grep("hello", corpus, output_mode="content")
        assert "a.py:1:def hello():" in out

    def test_case_insensitive(self, corpus):
        out = run_grep("hello", corpus, case_insensitive=True)
        assert "c.py" in out  # HELLO 也命中

    def test_glob_filter(self, corpus):
        out = run_grep("hello", corpus, glob="*.md")
        assert "未找到匹配文件" in out

    def test_count_mode(self, corpus):
        out = run_grep("hello", corpus, output_mode="count")
        assert "a.py:1" in out
        assert "处匹配" in out

    def test_head_limit_truncation_note(self, corpus):
        for i in range(10):
            (corpus / f"f{i}.txt").write_text("hit\n")
        out = run_grep("hit", corpus, output_mode="content", head_limit=3)
        assert "limit=3" in out

    def test_subdirectory_path(self, corpus):
        out = run_grep("hello", corpus, path="sub")
        assert "c.py" in out
        assert "a.py" not in out

    def test_no_matches_is_not_error(self, corpus):
        """exit 1 = 无匹配 ≠ 错误。"""
        out = run_grep("zzz_no_such_symbol", corpus)
        assert out == "未找到匹配文件"
