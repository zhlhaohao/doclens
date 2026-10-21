# -*- coding: utf-8 -*-
"""git 子进程编码口径（AP-42）。

旧实现部分调用 `subprocess.run(text=True)` 不带 encoding：Windows 下按
locale（cp936）解码 git 输出的 UTF-8 路径 → `--show-toplevel` 乱码 →
normcase 比较失败 → 中文路径知识库被判「不是 git 根」，GitSync 整体停摆、
`/api/git/*` 一律 400。

本环境 Python 默认编码是 UTF-8，缺陷不会自然复现——测试用「模拟 locale 解码」
的假 subprocess 来固定契约。
"""
import os
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens import git_command


class _FakeRun:
    """模拟 Windows 默认解码：未指定 encoding 时按 gbk 解（必然乱码）。"""

    def __init__(self, stdout: str, returncode: int = 0):
        self.calls: list[dict] = []
        self._stdout = stdout
        self._rc = returncode

    def __call__(self, cmd, **kwargs):
        self.calls.append({"cmd": cmd, **kwargs})
        raw = self._stdout.encode("utf-8")
        enc = kwargs.get("encoding")
        text = raw.decode(enc or "gbk", errors=kwargs.get("errors") or "strict")
        return subprocess.CompletedProcess(
            cmd, self._rc, stdout=text if kwargs.get("text") or enc else raw,
            stderr="",
        )


class TestEncodingContract:
    def test_run_git_pins_utf8(self, monkeypatch):
        fake = _FakeRun("x")
        monkeypatch.setattr(git_command.subprocess, "run", fake)
        git_command.run_git("root", "status")
        assert fake.calls[0]["encoding"] == "utf-8"
        assert fake.calls[0]["errors"] == "replace"
        assert fake.calls[0]["text"] is True

    def test_is_git_root_survives_non_ascii_path(self, monkeypatch, tmp_path):
        """中文目录：解码正确才能 normcase 比对通过（旧实现在此判 False）。"""
        root = tmp_path / "中文知识库"
        root.mkdir()
        fake = _FakeRun(str(root))
        monkeypatch.setattr(git_command.subprocess, "run", fake)
        assert git_command.is_git_root(root) is True

    def test_is_git_root_false_for_subdir(self, monkeypatch, tmp_path):
        root = tmp_path / "kb"
        (root / "sub").mkdir(parents=True)
        monkeypatch.setattr(git_command.subprocess, "run", _FakeRun(str(root)))
        assert git_command.is_git_root(root) is True
        assert git_command.is_git_root(root / "sub") is False

    def test_is_git_root_false_when_git_missing(self, monkeypatch):
        def boom(*_a, **_k):
            raise FileNotFoundError("git")

        monkeypatch.setattr(git_command.subprocess, "run", boom)
        assert git_command.is_git_root("whatever") is False

    def test_run_git_returns_none_on_timeout(self, monkeypatch):
        def boom(*_a, **_k):
            raise subprocess.TimeoutExpired(cmd="git", timeout=1)

        monkeypatch.setattr(git_command.subprocess, "run", boom)
        assert git_command.run_git("root", "push") is None


class TestSingleSource:
    """两份实现（GitSync._git / api._run_git）必须共用同一原语与同一判据。"""

    def test_gitsync_delegates(self, monkeypatch):
        from doclens.git_sync import GitSync

        calls = []

        def fake_run_git(root, *args, timeout=30):
            calls.append((root, args, timeout))
            return SimpleNamespace(returncode=0, stdout="", stderr="")

        monkeypatch.setattr("doclens.git_sync.run_git", fake_run_git)
        sync = GitSync.__new__(GitSync)
        sync._path = "D:/kb"
        sync._git("status")
        assert calls == [("D:/kb", ("status",), 30)]

    def test_git_sync_is_git_root_delegates(self, monkeypatch):
        from doclens.git_sync import GitSync

        seen = []
        monkeypatch.setattr(
            "doclens.git_sync.is_git_root", lambda p: seen.append(p) or True
        )
        sync = GitSync.__new__(GitSync)
        sync._path = "D:/kb"
        assert sync._is_git_root() is True
        assert seen == ["D:/kb"]

    def test_api_is_git_root_delegates(self, monkeypatch):
        from doclens.web_v2.api import git as git_api

        seen = []
        monkeypatch.setattr(git_api, "is_git_root", lambda p: seen.append(p) or True)
        assert git_api._is_git_root(Path("D:/kb")) is True
        assert len(seen) == 1

    def test_api_run_git_pins_encoding(self, monkeypatch):
        from doclens.web_v2.api import git as git_api

        fake = _FakeRun("ok")
        monkeypatch.setattr(git_command.subprocess, "run", fake)
        git_api._run_git("D:/kb", "status")
        assert fake.calls[0]["encoding"] == "utf-8"

    def test_no_bare_git_subprocess_left(self):
        """结构枪口：doclens 内不得再有裸 `subprocess.run(["git"` 调用。"""
        import re

        root = Path(git_command.__file__).parent
        offenders = []
        pattern = re.compile(r"subprocess\.run\(\s*\n?\s*\[\s*\"git\"")
        for py in root.rglob("*.py"):
            if "vendor_pdf2zh" in py.parts:
                continue
            text = py.read_text(encoding="utf-8", errors="replace")
            for i, line in enumerate(text.splitlines(), 1):
                if pattern.search(line):
                    offenders.append(f"{py.relative_to(root)}:{i}")
                elif "\"git\", \"-C\"" in line and "git_command" not in str(py):
                    offenders.append(f"{py.relative_to(root)}:{i}")
        assert offenders == [], f"仍有裸 git 子进程调用: {offenders}"
