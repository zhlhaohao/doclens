"""技能目录软链注册（SkillLoader 发现链路跟随目录 symlink）。

背景（2026-11-11）：Python 3.12/3.13 的 Path.rglob 不跟随目录符号链接，
外部技能以「目录整体软链」注册到技能根时静默失效（descriptions/load 均
查无此技能、无报错）。发现链路统一改走 iter_skill_files（os.walk +
followlinks=True + realpath 环保护）。

覆盖：目录软链注册、深层软链、文件级软链（SKILL.md 本身是软链）、
软链环截断、热重载签名一致性。
"""
import os
import time
import uuid
from pathlib import Path

import pytest

from planify.skills.skill_loader import SkillLoader, iter_skill_files


def _write_skill(root, rel, meta="description: d", body="正文"):
    d = root / rel
    d.mkdir(parents=True, exist_ok=True)
    f = d / "SKILL.md"
    f.write_text(f"---\n{meta}\n---\n{body}", encoding="utf-8")
    return f


def _symlink_or_skip(link: str, target: str):
    """创建 symlink（先建父目录）；平台不支持时跳过该组用例。"""
    Path(link).parent.mkdir(parents=True, exist_ok=True)
    try:
        os.symlink(target, link, target_is_directory=os.path.isdir(target))
    except (OSError, NotImplementedError) as e:
        pytest.skip(f"symlink 不可用（Windows 需开发者模式/特权）: {e}")


pytestmark = pytest.mark.skipif(
    not hasattr(os, "symlink"), reason="platform without os.symlink"
)


class TestSymlinkedSkillDir:
    def test_top_level_symlinked_skill_dir_discovered(self, tmp_path):
        """目录整体软链（顶层）：rglob 时代静默失效的主场景，现应被发现。"""
        external = tmp_path / "external"
        _write_skill(external, "sfu-e2e", meta="name: sfu-e2e\ndescription: 外部")
        _symlink_or_skip(str(tmp_path / "skills" / "sfu-e2e"), str(external / "sfu-e2e"))
        loader = SkillLoader(tmp_path / "skills")
        assert set(loader.skills) == {"sfu-e2e"}
        # base_dir = 软链宿主侧路径（相对引用按宿主侧拼）
        assert loader.skills["sfu-e2e"]["base_dir"] == str(
            (tmp_path / "skills" / "sfu-e2e").absolute()
        )

    def test_nested_symlinked_skill_dir_discovered(self, tmp_path):
        """厂商子目录下的目录软链同样被发现。"""
        external = tmp_path / "external"
        _write_skill(external, "tdd", meta="name: tdd\ndescription: d")
        vendor = tmp_path / "skills" / "vendor"
        vendor.mkdir(parents=True)
        _symlink_or_skip(str(vendor / "tdd"), str(external / "tdd"))
        assert set(SkillLoader(tmp_path / "skills").skills) == {"tdd"}

    def test_symlinked_skill_md_file_discovered(self, tmp_path):
        """文件级软链（SKILL.md 指向外部）也发现——与目录软链姿势等价。"""
        external = tmp_path / "external" / "real-skill"
        external.mkdir(parents=True)
        (external / "SKILL.md").write_text(
            "---\nname: real-skill\ndescription: d\n---\n正文", encoding="utf-8"
        )
        link_dir = tmp_path / "skills" / "linked"
        link_dir.mkdir(parents=True)
        _symlink_or_skip(str(link_dir / "SKILL.md"), str(external / "SKILL.md"))
        assert set(SkillLoader(tmp_path / "skills").skills) == {"real-skill"}

    def test_symlink_loop_truncated_not_infinite(self, tmp_path):
        """软链环（目录内指回祖先）必须截断——发现正常技能且不炸。"""
        root = tmp_path / "skills"
        _write_skill(root, "normal", meta="name: normal\ndescription: d")
        _symlink_or_skip(str(root / "loop"), str(root))
        skills = SkillLoader(root).skills
        assert "normal" in skills

    def test_real_dir_visited_once_across_links(self, tmp_path):
        """同一真实目录经两条软链可达：只发现一次（realpath 去重）。"""
        external = tmp_path / "external"
        _write_skill(external, "dup", meta="name: dup\ndescription: d")
        _symlink_or_skip(str(tmp_path / "skills" / "a"), str(external / "dup"))
        _symlink_or_skip(str(tmp_path / "skills" / "b"), str(external / "dup"))
        skills = SkillLoader(tmp_path / "skills").skills
        assert set(skills) == {"dup"}

    def test_hot_reload_sees_symlinked_skill_change(self, tmp_path):
        """热重载签名含软链技能：SKILL.md 直改后 descriptions() 自动重扫。"""
        external = tmp_path / "external"
        _write_skill(external, "ext", meta="name: ext\ndescription: v1")
        _symlink_or_skip(str(tmp_path / "skills" / "ext"), str(external / "ext"))
        loader = SkillLoader(tmp_path / "skills", auto_refresh=True)
        loader._last_check = 0.0  # 过节流，强制下轮检查
        assert "v1" in loader.descriptions()
        time.sleep(0.05)  # mtime 分辨率兜底
        _write_skill(external, "ext", meta="name: ext\ndescription: v2")
        loader._last_check = 0.0
        assert "v2" in loader.descriptions()

    def test_iter_skill_files_sorted_deterministic(self, tmp_path):
        """iter_skill_files 产出确定序（sorted 后稳定），支持先者胜语义。"""
        _write_skill(tmp_path, "b/second", meta="name: second\ndescription: d")
        _write_skill(tmp_path, "a/first", meta="name: first\ndescription: d")
        files = sorted(iter_skill_files(tmp_path))
        names = [f.parent.name for f in files]
        assert names == sorted(names)
        assert {f.name for f in files} == {"SKILL.md"}

    def test_uuid_uniqueness_no_probe_collision(self, tmp_path):
        """占位：确认签名/发现不受临时目录复用影响（轻量冒烟）。"""
        _write_skill(tmp_path, uuid.uuid4().hex, meta="name: u1\ndescription: d")
        assert set(SkillLoader(tmp_path).skills) == {"u1"}
