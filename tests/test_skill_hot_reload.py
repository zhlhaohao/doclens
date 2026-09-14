"""SkillLoader 惰性热重载单元测试。

机制：descriptions() 入口 stat 签名 diff（mtime+size，节流 2s）→ 变化才
原位 rescan；坏文件沿用旧内容 + 不记签名（下轮自愈）；load() 纯内存读
（轮首快照）。测试统一 monkeypatch 节流间隔为 0 模拟「下一轮对话」。
"""
import os
import time
from pathlib import Path

import pytest

from planify.skills import skill_loader as skill_loader_mod
from planify.skills.skill_loader import SkillLoader


@pytest.fixture(autouse=True)
def _no_throttle(monkeypatch: pytest.MonkeyPatch):
    """节流归零——每次 descriptions() 都真检查，模拟对话间隔 > 2s。"""
    monkeypatch.setattr(skill_loader_mod, "STALE_CHECK_MIN_INTERVAL", 0.0)


def _write_skill(root: Path, dirname: str, body: str = "body-v1", mtime: float = 1.0) -> Path:
    d = root / dirname
    d.mkdir(parents=True, exist_ok=True)
    f = d / "SKILL.md"
    f.write_text(
        f"---\nname: {dirname}\ndescription: d\n---\n{body}", encoding="utf-8"
    )
    os.utime(f, (mtime, mtime))
    return f


class TestHotReload:
    def test_modified_file_takes_effect_next_turn(self, tmp_path):
        """磁盘直改 SKILL.md → 下一轮 descriptions() 自动重扫生效。"""
        f = _write_skill(tmp_path, "a", body="body-v1", mtime=1.0)
        loader = SkillLoader(tmp_path)
        assert "body-v1" in loader.load("a")

        f.write_text(
            "---\nname: a\ndescription: d2\n---\nbody-v2-longer", encoding="utf-8"
        )
        os.utime(f, (2.0, 2.0))
        loader.descriptions()  # 触发惰性检查 + rescan
        assert "body-v2-longer" in loader.load("a")

    def test_added_skill_appears(self, tmp_path):
        loader = SkillLoader(tmp_path)
        assert loader.descriptions() == "(no skills)"
        _write_skill(tmp_path, "new", mtime=1.0)
        loader.descriptions()
        assert "new" in loader.skills

    def test_deleted_skill_disappears(self, tmp_path):
        _write_skill(tmp_path, "a", mtime=1.0)
        loader = SkillLoader(tmp_path)
        assert "a" in loader.skills
        import shutil

        shutil.rmtree(tmp_path / "a")
        loader.descriptions()
        assert "a" not in loader.skills

    def test_corrupt_file_keeps_old_content(self, tmp_path):
        """编码坏的文件沿用旧内容（不闪没），不记入签名。"""
        f = _write_skill(tmp_path, "a", body="body-v1", mtime=1.0)
        loader = SkillLoader(tmp_path)
        f.write_bytes(b"\xff\xfe\x00 bad utf8")
        os.utime(f, (2.0, 2.0))
        loader.descriptions()  # 触发 rescan：read 失败 → 沿用旧内容
        assert "body-v1" in loader.load("a")
        assert f not in loader._signature  # 不记签名 → 自愈的钩子

    def test_corrupt_file_self_heals(self, tmp_path):
        """坏文件修好后，下轮 diff 出「新增」自动重读。"""
        f = _write_skill(tmp_path, "a", body="body-v1", mtime=1.0)
        loader = SkillLoader(tmp_path)
        f.write_bytes(b"\xff\xfe\x00 bad utf8")
        os.utime(f, (2.0, 2.0))
        loader.descriptions()  # 坏 → 沿用旧
        f.write_text(
            "---\nname: a\ndescription: d\n---\nbody-v2-healed", encoding="utf-8"
        )
        os.utime(f, (3.0, 3.0))
        loader.descriptions()  # 自愈 → 新内容
        assert "body-v2-healed" in loader.load("a")

    def test_load_is_pure_memory_no_check(self, tmp_path):
        """轮首快照：load() 不触发检查——descriptions 之后改盘，本轮 load 仍旧值。"""
        f = _write_skill(tmp_path, "a", body="body-v1", mtime=1.0)
        loader = SkillLoader(tmp_path)
        loader.descriptions()  # 本轮开始（快照点）
        f.write_text(
            "---\nname: a\ndescription: d\n---\nbody-v2", encoding="utf-8"
        )
        os.utime(f, (2.0, 2.0))
        assert "body-v1" in loader.load("a")  # 轮内仍是快照

    def test_throttle_skips_check(self, tmp_path, monkeypatch: pytest.MonkeyPatch):
        """节流期内（刚检查过）不再 stat——改动不生效，等下一窗口。"""
        monkeypatch.setattr(skill_loader_mod, "STALE_CHECK_MIN_INTERVAL", 5.0)
        f = _write_skill(tmp_path, "a", body="body-v1", mtime=1.0)
        loader = SkillLoader(tmp_path)
        loader._last_check = time.monotonic()  # 模拟刚检查完
        f.write_text(
            "---\nname: a\ndescription: d\n---\nbody-v2", encoding="utf-8"
        )
        os.utime(f, (2.0, 2.0))
        loader.descriptions()
        assert "body-v1" in loader.load("a")  # 节流跳过，未重扫

    def test_auto_refresh_off(self, tmp_path):
        f = _write_skill(tmp_path, "a", body="body-v1", mtime=1.0)
        loader = SkillLoader(tmp_path, auto_refresh=False)
        f.write_text(
            "---\nname: a\ndescription: d\n---\nbody-v2", encoding="utf-8"
        )
        os.utime(f, (2.0, 2.0))
        loader.descriptions()
        assert "body-v1" in loader.load("a")  # 关闭热重载：纯内存

    def test_disabled_survives_rescan(self, tmp_path):
        """热重载 rescan 不触碰 _disabled（停用名单跨重扫存活）。"""
        _write_skill(tmp_path, "a", mtime=1.0)
        _write_skill(tmp_path, "b", mtime=1.0)
        loader = SkillLoader(tmp_path, disabled=["b"])
        _write_skill(tmp_path, "c", mtime=2.0)  # 触发下轮 rescan
        desc = loader.descriptions()
        assert '"c"' in desc and '"b"' not in desc
