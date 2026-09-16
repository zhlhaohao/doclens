# -*- coding: utf-8 -*-
"""glob 工具测试（planify/tools/glob_tool.py，ADR-0023）。

纯单测不依赖 rg（execute_rg 可 monkeypatch 替换）；文件尾部的集成测试
用 pytest.mark.skipif 条件执行，验证真实 rg --files 链路。
"""

import os

import pytest

from planify.tools import glob_tool as glob_mod
from planify.tools.grep import RgRunResult, rg_available
from planify.tools.glob_tool import (
    MAX_RESULTS,
    build_glob_args,
    extract_glob_base_directory,
    run_glob,
)


# ==================== 基目录拆分 ====================


class TestExtractGlobBaseDirectory:
    def test_no_glob_chars_is_literal_path(self):
        """无 glob 字符 = 字面路径：拆为（目录, 文件名）。"""
        assert extract_glob_base_directory("a/b.txt") == ("a", "b.txt")

    def test_glob_at_start_no_base(self):
        assert extract_glob_base_directory("**/*.py") == ("", "**/*.py")
        assert extract_glob_base_directory("*.py") == ("", "*.py")

    def test_static_dir_prefix(self):
        assert extract_glob_base_directory("src/**/*.py") == ("src", "**/*.py")

    def test_deep_static_prefix(self):
        base, rel = extract_glob_base_directory("src/main/java/**/*Test.java")
        assert base == f"src/main/java"
        assert rel == "**/*Test.java"

    @pytest.mark.skipif(os.name != "nt", reason="Windows 盘符语义")
    def test_windows_drive_root(self):
        """'C:' 是「C 盘当前目录」（相对），补分隔符才是盘符根。"""
        base, rel = extract_glob_base_directory("C:/*.txt")
        assert base == "C:" + os.sep
        assert rel == "*.txt"

    def test_absolute_with_glob(self):
        base, rel = extract_glob_base_directory("/data/logs/*.log")
        assert base == "/data/logs"
        assert rel == "*.log"


# ==================== rg 参数构造 ====================


class TestBuildGlobArgs:
    def test_core_flags(self):
        args = build_glob_args("**/*.py")
        assert args[:2] == ["--files", "--glob"]
        assert "**/*.py" in args
        # newest-first（对 CC oldest-first 的修正）
        assert "--sortr=modified" in args
        # 恒定开启：whitelist --glob 恒传时 gitignore/hidden 过滤本就被
        # 覆盖，env 开关无观测效果，故不提供（见 ADR-0023）
        assert "--no-ignore" in args
        assert "--hidden" in args

    def test_vcs_excluded(self):
        args = build_glob_args("**/*")
        globs = [args[i + 1] for i, a in enumerate(args) if a == "--glob"]
        for d in (".git", ".svn", ".hg", ".bzr", ".jj", ".sl"):
            assert f"!{d}" in globs


# ==================== run_glob 主流程（mock execute_rg） ====================


@pytest.fixture
def mock_rg(monkeypatch):
    """替换 execute_rg，返回预设行并捕获调用参数。"""

    calls = {}

    def _set(lines, error=None, timed_out=False):
        def fake(args, target):
            calls["args"] = args
            calls["target"] = target
            return RgRunResult(tuple(lines), error=error, timed_out=timed_out)

        monkeypatch.setattr(glob_mod, "execute_rg", fake)
        return calls

    return _set


class TestRunGlob:
    def test_basic_relative_display(self, tmp_path, mock_rg):
        mock_rg([f"{tmp_path}{os.sep}a.py", f"{tmp_path}{os.sep}sub{os.sep}b.py"])
        out = run_glob("**/*.py", tmp_path)
        assert out == f"a.py\nsub{os.sep}b.py"  # workdir 相对显示

    def test_empty(self, tmp_path, mock_rg):
        mock_rg([])
        assert run_glob("**/*.zzz", tmp_path) == "未找到匹配文件"

    def test_truncation_note(self, tmp_path, mock_rg):
        lines = [f"{tmp_path}{os.sep}f{i}.py" for i in range(MAX_RESULTS + 20)]
        mock_rg(lines)
        out = run_glob("**/*.py", tmp_path)
        assert out.count(".py") == MAX_RESULTS
        assert "结果已截断" in out and f"共匹配 {MAX_RESULTS + 20} 个" in out

    def test_no_truncation_no_note(self, tmp_path, mock_rg):
        mock_rg([f"{tmp_path}{os.sep}a.py"])
        out = run_glob("**/*.py", tmp_path)
        assert "截断" not in out

    def test_timed_out_partial_note(self, tmp_path, mock_rg):
        mock_rg([f"{tmp_path}{os.sep}a.py"], timed_out=True)
        out = run_glob("**/*.py", tmp_path)
        assert "超时" in out and "部分结果" in out

    def test_error_passthrough(self, tmp_path, mock_rg):
        mock_rg([], error="Error: 搜索超时（20s）。……")
        assert run_glob("**/*", tmp_path).startswith("Error: 搜索超时")

    def test_path_param_searches_subdirectory(self, tmp_path, mock_rg):
        sub = tmp_path / "sub"
        sub.mkdir()
        calls = mock_rg([])
        run_glob("**/*.py", tmp_path, path="sub")
        assert calls["target"] == sub.resolve()


class TestAbsolutePattern:
    def test_absolute_pattern_splits_and_passes_guard(self, tmp_path, mock_rg):
        """绝对 pattern：拆出 baseDir 作为搜索目录，相对模式进 --glob。"""
        calls = mock_rg([])
        pattern = str(tmp_path) + "/**/*.txt"
        run_glob(pattern, tmp_path)
        assert calls["target"] == tmp_path.resolve()
        assert "**/*.txt" in calls["args"]

    def test_absolute_pattern_outside_workdir_rejected(self, tmp_path, mock_rg):
        """绝对 pattern 的 baseDir 过 safe_path——堵 CC 的权限旁路。"""
        calls = mock_rg([])
        out = run_glob("C:/Windows/**/*.dll", tmp_path)
        assert "escapes workspace" in out
        assert "args" not in calls  # rg 未被调用

    def test_absolute_pattern_wins_over_path(self, tmp_path, mock_rg):
        """绝对 pattern 与 path 同给时 pattern 优先（对齐 CC）。"""
        other = tmp_path / "other"
        other.mkdir()
        calls = mock_rg([])
        run_glob(str(tmp_path) + "/**/*.txt", tmp_path, path="other")
        assert calls["target"] == tmp_path.resolve()


class TestPathValidation:
    def test_path_escape_rejected(self, tmp_path):
        out = run_glob("**/*", tmp_path, path="../../outside")
        assert "escapes workspace" in out

    def test_path_not_exists(self, tmp_path):
        assert "路径不存在" in run_glob("**/*", tmp_path, path="no_such_dir")

    def test_path_must_be_directory(self, tmp_path):
        """glob 的 path 必须是目录（对齐 CC validateInput errorCode 2）。"""
        f = tmp_path / "a.txt"
        f.write_text("x")
        assert "路径不是目录" in run_glob("**/*", tmp_path, path="a.txt")

    def test_guard_resolve_injected(self, tmp_path):
        def fake_resolve(raw, workdir, write):
            return None, "Error: 未获用户授权"

        out = run_glob("**/*", tmp_path, path="sub", resolve=fake_resolve)
        assert out == "Error: 未获用户授权"

    def test_empty_pattern(self, tmp_path):
        assert run_glob("", tmp_path).startswith("Error")


# ==================== 注册接线 ====================


class TestRegistration:
    def test_registered_when_rg_available(self, tmp_path, monkeypatch):
        from planify.tools.registry import build_tool_registry

        monkeypatch.delenv("PLANIFY_ENABLED_TOOLS", raising=False)
        monkeypatch.setattr("planify.tools.registry.rg_available", lambda: True)
        tools, handlers = build_tool_registry(workdir=tmp_path)
        names = {t["name"] for t in tools}
        assert "glob" in names and "grep" in names
        assert "glob" in handlers

    def test_not_registered_when_rg_missing(self, tmp_path, monkeypatch):
        from planify.tools.registry import build_tool_registry

        monkeypatch.delenv("PLANIFY_ENABLED_TOOLS", raising=False)
        monkeypatch.setattr("planify.tools.registry.rg_available", lambda: False)
        tools, handlers = build_tool_registry(workdir=tmp_path)
        names = {t["name"] for t in tools}
        assert "glob" not in names
        assert "glob" not in handlers


# ==================== 真实 rg 集成测试（条件执行） ====================

requires_rg = pytest.mark.skipif(not rg_available(), reason="rg 未安装")


@requires_rg
class TestRealRipgrep:
    @pytest.fixture
    def corpus(self, tmp_path):
        (tmp_path / "a.py").write_text("x")
        (tmp_path / "b.md").write_text("x")
        sub = tmp_path / "sub"
        sub.mkdir()
        (sub / "c.py").write_text("x")
        return tmp_path

    def test_finds_by_pattern(self, corpus):
        out = run_glob("**/*.py", corpus)
        assert "a.py" in out and f"sub{os.sep}c.py" in out
        assert "b.md" not in out

    def test_newest_first(self, corpus):
        """排序修正：最新修改在前（CC 的 --sort=modified 为 oldest-first）。"""
        old = corpus / "old.py"
        new = corpus / "new.py"
        old.write_text("x")
        new.write_text("x")
        os.utime(old, (1_000_000, 1_000_000))
        os.utime(new, (2_000_000, 2_000_000))
        out = run_glob("*.py", corpus)
        assert out.index("new.py") < out.index("old.py")

    def test_hidden_included_by_default(self, corpus):
        (corpus / ".hidden.py").write_text("x")
        out = run_glob("**/*.py", corpus)
        assert ".hidden.py" in out

    def test_gitignored_included_by_default(self, corpus):
        """whitelist --glob 覆盖 gitignore：被排除的文件只要匹配即可找到。"""
        (corpus / ".git").mkdir()  # rg 仅在 git 仓库内才尊重 .gitignore
        (corpus / ".gitignore").write_text("ignored.py\n")
        (corpus / "ignored.py").write_text("x")
        out = run_glob("**/ignored.py", corpus)
        assert "ignored.py" in out

    def test_vcs_dir_excluded(self, corpus):
        """VCS 排除（对 CC GlobTool 的补漏）：.git 内部文件不混入。"""
        git = corpus / ".git"
        git.mkdir()
        (git / "config.py").write_text("x")
        out = run_glob("**/*.py", corpus)
        assert "config.py" not in out

    def test_path_subdirectory(self, corpus):
        out = run_glob("**/*.py", corpus, path="sub")
        assert "c.py" in out
        assert "a.py" not in out

    def test_no_matches(self, corpus):
        assert run_glob("**/*.zzz", corpus) == "未找到匹配文件"
