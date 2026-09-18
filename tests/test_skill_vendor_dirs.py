"""厂商子目录组织（grilling 共识，2026-09-18）：

- 递归发现：skills/<厂商>/<技能名>/SKILL.md；层级不参与技能名（身份 =
  meta name，缺省回退叶子目录名）——厂商目录纯文件系统组织；
- 同名冲突先者胜（sorted 路径序）+ warning；
- 安装器按 repo 分组落盘（<repo>/<技能名>/），同源重装撤除旧平铺目录，
  跨 repo 同名不覆盖；
- 内置部署递归化（相对结构保持）；
- 嵌套技能删除可定位（_find_skill_dir rglob），空厂商目录保留。
"""
import logging
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens.skills_deploy import deploy_builtin_skills
from planify.skills.skill_loader import SkillLoader


def _write_skill(
    root: Path, rel: str, meta: str = "description: d", body: str = "正文"
) -> Path:
    """rel 相对 root 的技能目录路径（可含厂商层级），如 vendor/x。"""
    d = root / rel
    d.mkdir(parents=True, exist_ok=True)
    f = d / "SKILL.md"
    f.write_text(f"---\n{meta}\n---\n{body}", encoding="utf-8")
    return f


# ---------------------------------------------------------------- loader


class TestVendorDiscovery:
    def test_nested_skill_found_identity_is_meta_name(self, tmp_path):
        """厂商/技能两层嵌套：发现 ✓，名字 = meta name（厂商不进名）。"""
        _write_skill(tmp_path, "mattpocock/tdd", meta="name: tdd\ndescription: d")
        loader = SkillLoader(tmp_path)
        assert set(loader.skills) == {"tdd"}
        assert loader.skills["tdd"]["base_dir"] == str(
            (tmp_path / "mattpocock" / "tdd").absolute()
        )

    def test_name_fallback_is_leaf_dir_not_vendor(self, tmp_path):
        """无 meta name：回退**叶子目录名**（技能目录），厂商目录不参与。"""
        _write_skill(tmp_path, "anthropic/pdf")
        loader = SkillLoader(tmp_path)
        assert set(loader.skills) == {"pdf"}

    def test_flat_and_nested_coexist(self, tmp_path):
        _write_skill(tmp_path, "flat-skill", meta="name: flat-skill\ndescription: d")
        _write_skill(tmp_path, "vendor/nested-skill", meta="name: nested-skill\ndescription: d")
        loader = SkillLoader(tmp_path)
        assert set(loader.skills) == {"flat-skill", "nested-skill"}

    def test_conflict_first_wins_with_warning(self, tmp_path, caplog):
        """同名冲突：sorted 路径序先者胜，丢弃者有 warning（含双方路径）。"""
        _write_skill(tmp_path, "a-vendor/dup", meta="name: dup\ndescription: A")
        _write_skill(tmp_path, "b-vendor/dup", meta="name: dup\ndescription: B")
        with caplog.at_level(logging.WARNING, logger="planify.skills.skill_loader"):
            loader = SkillLoader(tmp_path)
        assert set(loader.skills) == {"dup"}
        assert loader.skills["dup"]["meta"]["description"] == "A"  # a-vendor 先
        assert "b-vendor" in caplog.text and "a-vendor" in caplog.text

    def test_losing_file_not_in_signature(self, tmp_path):
        """被丢弃者不记签名——否则下轮 diff 出「消失」触发无意义重扫。"""
        _write_skill(tmp_path, "a-vendor/dup", meta="name: dup\ndescription: A")
        losing = _write_skill(tmp_path, "b-vendor/dup", meta="name: dup\ndescription: B")
        loader = SkillLoader(tmp_path)
        assert losing not in loader._signature
        assert losing in loader._stat_signature()  # 磁盘仍在（stat 全量）

    def test_hot_reload_covers_nested(self, tmp_path):
        """嵌套 SKILL.md 直改 → 下一轮 descriptions() 自动重扫生效。"""
        import os

        f = _write_skill(tmp_path, "vendor/x", meta="name: x\ndescription: d",
                         body="body-v1")
        os.utime(f, (1.0, 1.0))
        loader = SkillLoader(tmp_path)
        assert "body-v1" in loader.load("x")
        f.write_text("---\nname: x\ndescription: d\n---\nbody-v2", encoding="utf-8")
        os.utime(f, (2.0, 2.0))  # 强制 (mtime,size) 签名变化（同 tick 写入不可靠）
        loader._last_check = 0.0  # 绕过节流（模拟下一轮）
        loader.descriptions()
        assert "body-v2" in loader.load("x")


# ---------------------------------------------------------------- installer


def _patch_installer(monkeypatch, tmp_path, repo: str, found: dict):
    """桩掉网络与全局 sidecar 写入；返回 fake ref。"""
    from doclens import skills_installer as inst

    fake_ref = SimpleNamespace(repo=repo, source_url=f"https://github.com/o/{repo}")
    monkeypatch.setattr(inst, "parse_github_url", lambda url: fake_ref)
    monkeypatch.setattr(inst, "_download_skills", lambda ref: found)
    monkeypatch.setattr(inst.skills_config, "builtin_skill_names", lambda: set())
    monkeypatch.setattr(
        inst.skills_config, "update_skill",
        lambda name, fields: {"source_url": fake_ref.source_url},
    )
    overrides: dict[str, dict] = {}
    monkeypatch.setattr(
        inst.skills_config, "get_override",
        lambda name: overrides.get(name, {}),
    )
    return fake_ref, overrides


class TestInstallerGrouping:
    def test_installs_into_repo_group_dir(self, tmp_path, monkeypatch):
        from doclens import skills_installer as inst

        _patch_installer(monkeypatch, tmp_path, "my-repo", {
            "tdd": {"description": "d", "files": {"SKILL.md": b"---\nname: tdd\n---\nbody"}},
        })
        installed = inst.install_from_github("https://github.com/o/my-repo", tmp_path)
        assert installed == ["tdd"]
        assert (tmp_path / "my-repo" / "tdd" / "SKILL.md").exists()

    def test_same_repo_reinstall_overwrites(self, tmp_path, monkeypatch):
        from doclens import skills_installer as inst

        found = {"tdd": {"description": "d",
                         "files": {"SKILL.md": b"---\nname: tdd\n---\nv1"}}}
        _patch_installer(monkeypatch, tmp_path, "my-repo", found)
        inst.install_from_github("u", tmp_path)
        found["tdd"]["files"]["SKILL.md"] = b"---\nname: tdd\n---\nv2"
        inst.install_from_github("u", tmp_path)
        skill_md = tmp_path / "my-repo" / "tdd" / "SKILL.md"
        assert skill_md.read_bytes().endswith(b"v2")
        # 组内无重复目录
        assert [p.name for p in (tmp_path / "my-repo").iterdir()] == ["tdd"]

    def test_cross_repo_same_name_coexists(self, tmp_path, monkeypatch):
        """跨 repo 同名不覆盖：两目录并存（loader 先者胜规则接管）。"""
        from doclens import skills_installer as inst

        files = {"SKILL.md": b"---\nname: dup\n---\nbody"}
        _patch_installer(monkeypatch, tmp_path, "repo-a", {"dup": {"description": "d", "files": files}})
        inst.install_from_github("u", tmp_path)
        _patch_installer(monkeypatch, tmp_path, "repo-b", {"dup": {"description": "d", "files": files}})
        inst.install_from_github("u", tmp_path)
        assert (tmp_path / "repo-a" / "dup" / "SKILL.md").exists()
        assert (tmp_path / "repo-b" / "dup" / "SKILL.md").exists()

    def test_same_source_reinstall_removes_legacy_flat_dir(self, tmp_path, monkeypatch):
        """同源（source_url 相同）重装撤除旧平铺目录，防递归下同名双份。"""
        from doclens import skills_installer as inst

        _, overrides = _patch_installer(monkeypatch, tmp_path, "my-repo", {
            "tdd": {"description": "d", "files": {"SKILL.md": b"---\nname: tdd\n---\nv2"}},
        })
        legacy = tmp_path / "tdd"  # 旧平铺布局（同源）
        legacy.mkdir(parents=True)
        (legacy / "SKILL.md").write_bytes(b"---\nname: tdd\n---\nv1")
        overrides["tdd"] = {"source_url": "https://github.com/o/my-repo"}
        inst.install_from_github("u", tmp_path)
        assert not legacy.exists()  # 旧平铺被撤除
        assert (tmp_path / "my-repo" / "tdd" / "SKILL.md").exists()

    def test_foreign_flat_dir_untouched(self, tmp_path, monkeypatch):
        """非同源平铺目录（手放的）不受安装影响——用户组织不被自动拆。"""
        from doclens import skills_installer as inst

        _, overrides = _patch_installer(monkeypatch, tmp_path, "my-repo", {
            "tdd": {"description": "d", "files": {"SKILL.md": b"---\nname: tdd\n---\nx"}},
        })
        foreign = tmp_path / "tdd"
        foreign.mkdir(parents=True)
        (foreign / "SKILL.md").write_bytes(b"manual")  # 无 source_url = 非同源
        inst.install_from_github("u", tmp_path)
        assert foreign.exists()


# ---------------------------------------------------------------- deploy


class TestDeployRecursion:
    def _pkg(self, tmp_path, monkeypatch):
        """构造嵌套发行包：平铺 1 个 + 厂商子目录 1 个。"""
        from doclens import skills_deploy

        pkg = tmp_path / "pkg-skills"
        _write_skill(pkg, "flat-one", meta="name: flat-one\ndescription: d")
        _write_skill(pkg, "vendor/v-one", meta="name: v-one\ndescription: d")
        monkeypatch.setattr(skills_deploy, "_BUILTIN_SKILLS_SRC", pkg)
        monkeypatch.setattr(skills_deploy.skills_config, "deleted_names", lambda: set())
        return skills_deploy

    def test_recursive_deploy_preserves_structure(self, tmp_path, monkeypatch):
        mod = self._pkg(tmp_path, monkeypatch)
        dst = tmp_path / "dst"
        deployed = mod.deploy_builtin_skills(dst)
        assert sorted(deployed) == ["flat-one", "v-one"]
        assert (dst / "flat-one" / "SKILL.md").exists()  # 平铺：行为不变
        assert (dst / "vendor" / "v-one" / "SKILL.md").exists()  # 嵌套：相对结构保持

    def test_deleted_builtin_skipped(self, tmp_path, monkeypatch):
        mod = self._pkg(tmp_path, monkeypatch)
        monkeypatch.setattr(
            mod.skills_config, "deleted_names", lambda: {"v-one"}
        )
        deployed = mod.deploy_builtin_skills(tmp_path / "dst")
        assert deployed == ["flat-one"]
        assert not (tmp_path / "dst" / "vendor").exists()

    def test_real_package_regression(self, tmp_path, monkeypatch):
        """存量回归：真实发行包（平铺 3 技能）递归部署行为与旧版一致。"""
        from doclens import skills_deploy

        monkeypatch.setattr(skills_deploy.skills_config, "deleted_names", lambda: set())
        deployed = skills_deploy.deploy_builtin_skills(tmp_path / "dst")
        assert sorted(deployed) == ["ignore-rules", "knowledge-base", "summarize-files"]
        assert (tmp_path / "dst" / "knowledge_base" / "SKILL.md").exists()


# ---------------------------------------------------------------- delete


class TestNestedDelete:
    def test_find_skill_dir_locates_nested(self, tmp_path, monkeypatch):
        from doclens.web_v2.api import skills as skills_api

        monkeypatch.setattr(skills_api, "_skills_dir", lambda: tmp_path)
        _write_skill(tmp_path, "vendor/x", meta="name: x\ndescription: d")
        found = skills_api._find_skill_dir("x")
        assert found == tmp_path / "vendor" / "x"

    def test_empty_vendor_dir_kept_after_skill_delete(self, tmp_path):
        """删除技能后空厂商目录保留（用户/安装器的组织结构不由删除拆）。"""
        import shutil

        _write_skill(tmp_path, "vendor/x", meta="name: x\ndescription: d")
        shutil.rmtree(tmp_path / "vendor" / "x")
        assert (tmp_path / "vendor").is_dir()  # 空壳保留，rglob 无 SKILL.md 即忽略
        assert set(SkillLoader(tmp_path).skills) == set()
