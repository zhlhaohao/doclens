"""skills_config（sidecar 存储，ADR-0015）+ SkillLoader disabled + 部署跳过 deleted 单元测试。

get_global_cortex_dir 指向 ~/.cortex——测试统一 monkeypatch 到 tmp_path 隔离。
"""
import json
from pathlib import Path

import pytest

from doclens import skills_config, skills_deploy
from planify.skills.skill_loader import SkillLoader


@pytest.fixture()
def config_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """把 sidecar 落盘位置隔离到 tmp_path。"""
    d = tmp_path / "global"
    d.mkdir()
    monkeypatch.setattr(skills_config, "get_global_cortex_dir", lambda: d)
    return d


def _write_skill(root: Path, dirname: str, name: str, desc: str = "d") -> Path:
    d = root / dirname
    d.mkdir(parents=True, exist_ok=True)
    (d / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: {desc}\n---\nbody", encoding="utf-8"
    )
    return d


class TestEffectiveState:
    def test_defaults_for_unknown_skill(self, config_dir):
        st = skills_config.effective_state("some-ext")
        assert st == {
            "enabled": True,
            "context_menu": False,
            "accept_dirs": False,
            "deleted": False,
            "source_url": None,
        }

    def test_builtin_defaults_apply(self, config_dir):
        st = skills_config.effective_state("knowledge-base")
        assert st["context_menu"] is True and st["accept_dirs"] is True
        st2 = skills_config.effective_state("summarize-files")
        assert st2["context_menu"] is True and st2["accept_dirs"] is False

    def test_override_beats_builtin_default(self, config_dir):
        skills_config.update_skill("knowledge-base", {"context_menu": False})
        assert skills_config.effective_state("knowledge-base")["context_menu"] is False

    def test_corrupt_file_falls_back_to_empty(self, config_dir):
        (config_dir / "skills_config.json").write_text("{bad json", encoding="utf-8")
        assert skills_config.effective_state("x")["enabled"] is True


class TestUpdateSkill:
    def test_sparse_update_and_clear(self, config_dir):
        skills_config.update_skill("a", {"enabled": False, "source_url": "u"})
        ov = skills_config.get_override("a")
        assert ov == {"enabled": False, "source_url": "u"}
        # None = 移除键，回落默认
        skills_config.update_skill("a", {"enabled": None})
        assert skills_config.get_override("a") == {"source_url": "u"}
        assert skills_config.effective_state("a")["enabled"] is True

    def test_empty_entry_removed(self, config_dir):
        skills_config.update_skill("a", {"enabled": False})
        skills_config.update_skill("a", {"enabled": None})
        assert "a" not in skills_config.get_all_overrides()

    def test_unknown_field_rejected(self, config_dir):
        with pytest.raises(skills_config.SkillsConfigError):
            skills_config.update_skill("a", {"bogus": 1})

    def test_remove_entry(self, config_dir):
        skills_config.update_skill("a", {"deleted": True})
        skills_config.remove_entry("a")
        assert skills_config.get_all_overrides() == {}


class TestDisabledAndDeleted:
    def test_disabled_names(self, config_dir):
        skills_config.update_skill("b", {"enabled": False})
        skills_config.update_skill("c", {"deleted": True})
        assert skills_config.disabled_names(["a", "b", "c"]) == {"b", "c"}

    def test_deleted_names(self, config_dir):
        skills_config.update_skill("c", {"deleted": True})
        assert skills_config.deleted_names() == {"c"}


class TestBuiltinNames:
    def test_meta_name_not_dirname(self):
        """目录 knowledge_base / 技能名 knowledge-base——以 meta name 为准。"""
        names = skills_config.builtin_skill_names()
        assert "knowledge-base" in names
        assert "knowledge_base" not in names


class TestSkillLoaderDisabled:
    def test_descriptions_filter_and_load_unaffected(self, tmp_path):
        _write_skill(tmp_path, "a", "a")
        _write_skill(tmp_path, "b", "b")
        loader = SkillLoader(tmp_path, disabled=["b"])
        desc = loader.descriptions()
        assert '"a"' in desc and '"b"' not in desc
        # 路由层隔断：load 不受停用影响
        assert '<skill name="b">' in loader.load("b")
        assert loader.is_disabled("b") is True
        assert loader.is_disabled("a") is False

    def test_rescan_and_set_disabled_in_place(self, tmp_path):
        _write_skill(tmp_path, "a", "a")
        loader = SkillLoader(tmp_path)
        assert set(loader.skills) == {"a"}
        _write_skill(tmp_path, "b", "b")
        loader.rescan()
        assert set(loader.skills) == {"a", "b"}
        loader.set_disabled(["a"])
        assert '"a"' not in loader.descriptions()

    def test_all_disabled_shows_no_skills(self, tmp_path):
        _write_skill(tmp_path, "a", "a")
        loader = SkillLoader(tmp_path, disabled=["a"])
        assert loader.descriptions() == "(no skills)"


class TestDeploySkipDeleted:
    def test_deleted_builtin_skipped(
        self, tmp_path, config_dir, monkeypatch: pytest.MonkeyPatch
    ):
        # 伪造发行包结构 <fake>/skills/<name>/SKILL.md（deploy 用 Path(__file__).parent/skills）
        fake_mod = tmp_path / "fake"
        skills_root = fake_mod / "skills"
        _write_skill(skills_root, "keep", "keep")
        _write_skill(skills_root, "gone", "gone")
        monkeypatch.setattr(skills_deploy, "__file__", str(fake_mod / "skills_deploy.py"))
        skills_config.update_skill("gone", {"deleted": True})

        target = tmp_path / "global" / "skills"
        deployed = skills_deploy.deploy_builtin_skills(target)
        assert deployed == ["keep"]
        assert (target / "keep" / "SKILL.md").exists()
        assert not (target / "gone").exists()


class TestInstallerUrlParsing:
    def test_repo_root(self):
        from doclens.skills_installer import parse_github_url

        r = parse_github_url("https://github.com/o/r")
        assert (r.owner, r.repo, r.branch, r.subdir) == ("o", "r", None, "")

    def test_tree_subdir(self):
        from doclens.skills_installer import parse_github_url

        r = parse_github_url("https://github.com/o/r/tree/main/skills/foo/")
        assert (r.branch, r.subdir) == ("main", "skills/foo")
        assert r.source_url.endswith("/tree/main/skills/foo")

    def test_trailing_dot_git(self):
        from doclens.skills_installer import parse_github_url

        assert parse_github_url("https://github.com/o/r.git").repo == "r"

    def test_non_github_rejected(self):
        from doclens.skills_installer import SkillInstallError, parse_github_url

        with pytest.raises(SkillInstallError):
            parse_github_url("https://gitlab.com/o/r")

    def test_parse_skill_name(self):
        from doclens.skills_installer import _parse_skill_name

        name, desc = _parse_skill_name(
            "---\nname: foo\ndescription: bar\n---\nbody", "fallback"
        )
        assert (name, desc) == ("foo", "bar")
        assert _parse_skill_name("no frontmatter", "fb") == ("fb", "")
