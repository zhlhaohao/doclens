"""user-invocable frontmatter 契约测试（对齐 Claude Code 的用户调用面硬门）。

语义（grilling 会话共识，2026-09-18）：
- false = 用户调用面全隐（TUI 斜杠 / Web 工具箱 / 管理页），仅模型可调；
  模型面不受影响（descriptions() 清单保留、load() 不受限）；
- 宽松 fail-open：仅 false/0/no/off（忽略大小写）→ False，其余（含缺省、
  杂值）→ True；
- 管理 API：列表排除 + PATCH/restore 404 拒识；DELETE 放行（清理出口）。

测试约定：沿 test_manual_compact_api 模式——端点直调 + monkeypatch 桩，
不起 TestClient。全局 sidecar（~/.cortex/skills_config.json）绝不真写：
守卫路径在写入前 raise，happy path 桩掉 update_skill/remove_entry。
"""
import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens.skills_config import builtin_model_only_names
from doclens.web_v2.api import skills as skills_api
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.models.skill import SkillPatchRequest
from planify.skills.skill_loader import SkillLoader


def _write_skill(
    root: Path, dirname: str, extra: str = "", body: str = "正文"
) -> Path:
    d = root / dirname
    d.mkdir(parents=True, exist_ok=True)
    f = d / "SKILL.md"
    f.write_text(
        f"---\nname: {dirname}\ndescription: d\n{extra}\n---\n{body}",
        encoding="utf-8",
    )
    return f


def _seed(tmp_path: Path) -> Path:
    """普通技能 + model-only 技能（user-invocable: false）。"""
    _write_skill(tmp_path, "normal")
    _write_skill(tmp_path, "model-only", extra="user-invocable: false")
    return tmp_path


def _seed_cortex_home(tmp_path: Path) -> Path:
    """TUI 桩专用：技能落在 <home>/skills/ 下（对齐 get_global_cortex_dir 布局）。"""
    home = tmp_path / "home"
    _seed(home / "skills")
    return home


# ---------------------------------------------------------------- loader


class TestLoaderParse:
    @pytest.mark.parametrize("raw", ["false", "False", "FALSE", "0", "no", "off", "OFF ", " no "])
    def test_false_family(self, tmp_path, raw):
        _write_skill(tmp_path, "a", extra=f"user-invocable: {raw}")
        assert SkillLoader(tmp_path).skills["a"]["user_invocable"] is False

    @pytest.mark.parametrize("raw", ["true", "True", "yes", "1", "开启", "typo"])
    def test_fail_open_values(self, tmp_path, raw):
        """杂值/拼写错误一律 true——false 是强隐藏后果，错向可见更安全。"""
        _write_skill(tmp_path, "a", extra=f"user-invocable: {raw}")
        assert SkillLoader(tmp_path).skills["a"]["user_invocable"] is True

    def test_default_true(self, tmp_path):
        _write_skill(tmp_path, "a")
        assert SkillLoader(tmp_path).skills["a"]["user_invocable"] is True

    def test_model_surface_unaffected(self, tmp_path):
        """模型面不受限：清单保留 + load() 可用（与 disabled 路由隔断同哲学）。"""
        root = _seed(tmp_path)
        loader = SkillLoader(root)
        desc = loader.descriptions()
        assert '"model-only"' in desc
        assert "<skill" in loader.load("model-only")

    def test_builtin_defaults_all_user_invocable(self):
        """存量回归：发行包内置技能无人声明 false。"""
        assert builtin_model_only_names() == set()


# ---------------------------------------------------------------- web API


def _stub_state(name: str) -> dict:
    """effective_state 桩：context_menu 全开，隔离全局 sidecar 读取。"""
    return {
        "enabled": True,
        "context_menu": True,
        "accept_dirs": False,
        "deleted": False,
        "source_url": None,
    }


class TestListSkills:
    def test_toolbox_excludes_model_only(self, tmp_path, monkeypatch):
        """/api/skills（工具箱/下拉数据源）过滤 model-only。"""
        root = _seed(tmp_path)
        fake_agent = SimpleNamespace(
            runtime=SimpleNamespace(skills=SkillLoader(root))
        )
        monkeypatch.setattr(skills_api.deps, "get_agent", lambda: fake_agent)
        monkeypatch.setattr(skills_api.skills_config, "effective_state", _stub_state)
        result = asyncio.run(skills_api.list_skills())
        names = [s["name"] for s in result["skills"]]
        assert names == ["normal"]


class TestListSkillsManage:
    def test_manage_excludes_live_and_gray_model_only(self, tmp_path, monkeypatch):
        """管理列表：磁盘 model-only 条目与已删内置灰置条目均不出现。"""
        root = _seed(tmp_path)
        loader = SkillLoader(root)
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: loader)
        monkeypatch.setattr(
            skills_api.skills_config,
            "builtin_skill_names",
            lambda: {"normal", "model-only", "ghost"},
        )
        monkeypatch.setattr(
            skills_api.skills_config, "deleted_names", lambda: {"ghost"}
        )
        monkeypatch.setattr(
            skills_api.skills_config,
            "builtin_model_only_names",
            lambda: {"model-only", "ghost"},
        )
        result = asyncio.run(skills_api.list_skills_manage())
        names = [s.name for s in result.skills]
        assert names == ["normal"]


class TestPatchGuard:
    def test_patch_model_only_404(self, tmp_path, monkeypatch):
        root = _seed(tmp_path)
        loader = SkillLoader(root)
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: loader)
        monkeypatch.setattr(skills_api.skills_config, "builtin_skill_names", lambda: set())
        # 守卫必须先于 sidecar 写入（update_skill 未被调用即 raise）
        monkeypatch.setattr(
            skills_api.skills_config,
            "update_skill",
            lambda *a, **k: pytest.fail("model-only patch 不得触达 sidecar 写入"),
        )
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(skills_api.patch_skill("model-only", SkillPatchRequest()))
        assert ei.value.status == 404

    def test_patch_deleted_builtin_model_only_404(self, tmp_path, monkeypatch):
        """已删内置的 model-only（不在磁盘）同样拒识。"""
        root = _seed(tmp_path)
        loader = SkillLoader(root)
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: loader)
        monkeypatch.setattr(
            skills_api.skills_config, "builtin_skill_names", lambda: {"ghost"}
        )
        monkeypatch.setattr(
            skills_api.skills_config, "deleted_names", lambda: {"ghost"}
        )
        monkeypatch.setattr(
            skills_api.skills_config, "builtin_model_only_names", lambda: {"ghost"}
        )
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(skills_api.patch_skill("ghost", SkillPatchRequest()))
        assert ei.value.status == 404

    def test_patch_normal_passes_guard(self, tmp_path, monkeypatch):
        """对照：普通技能越过守卫（写入桩化，不碰全局 sidecar）。"""
        root = _seed(tmp_path)
        loader = SkillLoader(root)
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: loader)
        monkeypatch.setattr(skills_api.skills_config, "builtin_skill_names", lambda: set())
        monkeypatch.setattr(skills_api.skills_config, "effective_state", _stub_state)
        monkeypatch.setattr(
            skills_api.skills_config, "update_skill", lambda name, fields: _stub_state(name)
        )
        monkeypatch.setattr(skills_api, "_hot_apply", lambda rescan=False: None)
        item = asyncio.run(
            skills_api.patch_skill("normal", SkillPatchRequest(enabled=True))
        )
        assert item.name == "normal"


class TestRestoreGuard:
    def test_restore_model_only_404(self, tmp_path, monkeypatch):
        """restore 对 model-only 内置拒识（404），早于 deleted 状态检查。"""
        monkeypatch.setattr(
            skills_api.skills_config, "builtin_skill_names", lambda: {"ghost"}
        )
        monkeypatch.setattr(
            skills_api.skills_config, "builtin_model_only_names", lambda: {"ghost"}
        )
        monkeypatch.setattr(
            skills_api.skills_config, "deleted_names", lambda: {"ghost"}
        )
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(skills_api.restore_skill("ghost"))
        assert ei.value.status == 404


class TestDeleteAllowed:
    def test_delete_model_only_external(self, tmp_path, monkeypatch):
        """DELETE 放行（唯一清理出口）：外部 model-only 技能可删。"""
        root = _seed(tmp_path)
        loader = SkillLoader(root)
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: loader)
        monkeypatch.setattr(skills_api, "_skills_dir", lambda: root)
        monkeypatch.setattr(skills_api.skills_config, "builtin_skill_names", lambda: set())
        monkeypatch.setattr(skills_api.skills_config, "remove_entry", lambda name: None)
        monkeypatch.setattr(skills_api, "_hot_apply", lambda rescan=False: None)
        result = asyncio.run(skills_api.delete_skill("model-only"))
        assert result == {"deleted": "model-only", "builtin": False}
        assert not (root / "model-only").exists()

    def test_delete_model_only_builtin(self, tmp_path, monkeypatch):
        """DELETE 放行：内置 model-only 技能删 = 标记 deleted + 撤目录。"""
        root = _seed(tmp_path)
        loader = SkillLoader(root)
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: loader)
        monkeypatch.setattr(skills_api, "_skills_dir", lambda: root)
        monkeypatch.setattr(
            skills_api.skills_config, "builtin_skill_names", lambda: {"model-only"}
        )
        recorded = {}

        def fake_update(name, fields):
            recorded[name] = fields
            return _stub_state(name)

        monkeypatch.setattr(skills_api.skills_config, "update_skill", fake_update)
        monkeypatch.setattr(skills_api.skills_config, "effective_state", _stub_state)
        monkeypatch.setattr(skills_api, "_hot_apply", lambda rescan=False: None)
        result = asyncio.run(skills_api.delete_skill("model-only"))
        assert result == {"deleted": "model-only", "builtin": True}
        assert recorded["model-only"] == {"deleted": True}
        assert not (root / "model-only").exists()


# ---------------------------------------------------------------- TUI


class _RegistryRecorder:
    def __init__(self):
        self.names = []

    def register(self, cmd):
        self.names.append(cmd.name)


class _AppStub:
    """_register_skill_commands 的最小 self（不构造 Textual App/IndexManager）。"""

    def __init__(self):
        self._cmd_registry = _RegistryRecorder()


class TestTuiRegistration:
    def test_model_only_not_registered_as_slash(self, tmp_path, monkeypatch):
        """TUI 斜杠注册期跳过 model-only（未注册即分发不可达）。"""
        home = _seed_cortex_home(tmp_path)
        from doclens.tui import app as tui_app

        monkeypatch.setattr(tui_app, "get_global_cortex_dir", lambda: home)
        stub = _AppStub()
        tui_app.CortexApp._register_skill_commands(stub)
        assert stub._cmd_registry.names == ["normal"]
