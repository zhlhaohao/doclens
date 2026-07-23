"""claude_code_skill 同步帮手：status / install 纯逻辑测试。"""
from pathlib import Path

from doclens import claude_code_skill as ccs


def test_status_missing(tmp_path: Path):
    src = tmp_path / "s" / "skill.md"
    src.parent.mkdir()
    src.write_text("X", encoding="utf-8")
    tgt = tmp_path / "t" / "skill.md"  # 不存在
    assert ccs.skill_status(src, tgt) == "missing"


def test_status_ok(tmp_path: Path):
    content = "# skill\n\nbody\n"
    src = tmp_path / "s" / "skill.md"
    src.parent.mkdir()
    src.write_text(content, encoding="utf-8")
    tgt = tmp_path / "t" / "skill.md"
    tgt.parent.mkdir()
    tgt.write_text(content, encoding="utf-8")
    assert ccs.skill_status(src, tgt) == "ok"


def test_status_outdated(tmp_path: Path):
    src = tmp_path / "s" / "skill.md"
    src.parent.mkdir()
    src.write_text("NEW", encoding="utf-8")
    tgt = tmp_path / "t" / "skill.md"
    tgt.parent.mkdir()
    tgt.write_text("OLD", encoding="utf-8")
    assert ccs.skill_status(src, tgt) == "outdated"


def test_install_copies_and_creates_parents(tmp_path: Path):
    src = tmp_path / "s" / "skill.md"
    src.parent.mkdir()
    src.write_text("BODY", encoding="utf-8")
    tgt = tmp_path / "deep" / "nested" / "t" / "skill.md"  # 父目录不存在
    ccs.install_skill(src, tgt)
    assert tgt.read_text(encoding="utf-8") == "BODY"
