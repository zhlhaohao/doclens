"""ensure_claude_code_skill 交互分支测试（monkeypatch stdin/tty/源/目标）。"""
import io
import sys
from pathlib import Path

import pytest

from doclens import claude_code_skill as ccs


class _FakeStdin(io.StringIO):
    def __init__(self, text: str, tty: bool = True):
        super().__init__(text)
        self._tty = tty

    def isatty(self) -> bool:
        return self._tty


@pytest.fixture
def skill_dirs(tmp_path: Path, monkeypatch):
    """把源/目标都指向 tmp_path。"""
    src = tmp_path / "src" / "skill.md"
    src.parent.mkdir()
    src.write_text("# kb-ask\n\n源内容 v1\n", encoding="utf-8")
    tgt = tmp_path / "tgt" / "skill.md"
    monkeypatch.setattr(ccs, "_source_skill_file", lambda: src)
    monkeypatch.setattr(ccs, "_target_skill_file", lambda: tgt)
    return src, tgt


def test_ensure_installs_when_missing_with_consent(skill_dirs, monkeypatch):
    _src, tgt = skill_dirs
    monkeypatch.setattr(sys, "stdin", _FakeStdin("y\n"))
    installed = ccs.ensure_claude_code_skill()
    assert installed is True
    assert tgt.read_text(encoding="utf-8").startswith("# kb-ask")


def test_ensure_skips_when_declined(skill_dirs, monkeypatch):
    _src, tgt = skill_dirs
    monkeypatch.setattr(sys, "stdin", _FakeStdin("n\n"))
    installed = ccs.ensure_claude_code_skill()
    assert installed is False
    assert not tgt.exists()


def test_ensure_silent_when_ok(skill_dirs, monkeypatch):
    _src, tgt = skill_dirs
    tgt.parent.mkdir()
    tgt.write_text("# kb-ask\n\n源内容 v1\n", encoding="utf-8")  # 与源一致
    # 即使 stdin 为空（无输入可读）也不应提示/读输入
    monkeypatch.setattr(sys, "stdin", _FakeStdin(""))
    installed = ccs.ensure_claude_code_skill()
    assert installed is False


def test_ensure_overwrites_when_outdated_with_consent(skill_dirs, monkeypatch):
    _src, tgt = skill_dirs
    tgt.parent.mkdir()
    tgt.write_text("旧内容\n", encoding="utf-8")
    monkeypatch.setattr(sys, "stdin", _FakeStdin("y\n"))
    installed = ccs.ensure_claude_code_skill()
    assert installed is True
    assert tgt.read_text(encoding="utf-8").startswith("# kb-ask")


def test_ensure_skips_in_non_interactive_terminal(skill_dirs, monkeypatch):
    _src, tgt = skill_dirs
    monkeypatch.setattr(sys, "stdin", _FakeStdin("", tty=False))  # 非 tty
    installed = ccs.ensure_claude_code_skill()
    assert installed is False
    assert not tgt.exists()
