"""深读技能与前缀约定路由测试（ADR-0041，grilling 会话共识 2026-10-12）。

契约：
- `_bookskill_` 前缀即身份：从四个用户调用面全隐（工具箱 / 管理列表 /
  PATCH 拒识）+ 不进 system prompt 清单（宿主注入 disabled 名单实现
  模型感知面隔断）；
- 唯一用户入口 = 深读面板（GET /api/skills/books）：前缀过滤 + 去前缀
  书名 + 摘要 + 目录 mtime 倒序；不做 enabled 过滤（面板无停用语义）；
- 斜杠注入权威对前缀豁免 disabled 门（面板点书跳 chat 复用斜杠链路），
  user-invocable 硬门不豁免；
- CJK 技能名放行（`_NAME_RE` / `_SLASH_SKILL_RE` 对中日韩开放）。

测试约定沿 test_skill_user_invocable：端点直调 + monkeypatch 桩，
全局 sidecar 绝不真写。
"""
import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens import skills_config
from doclens.web_v2.api import skills as skills_api
from doclens.web_v2.api._chat_slash import legal_slash_skill
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.models.skill import SkillPatchRequest
from planify.skills.skill_loader import SkillLoader


def _write_skill(
    root: Path, dirname: str, extra: str = "", body: str = "正文", desc: str = "d"
) -> Path:
    d = root / dirname
    d.mkdir(parents=True, exist_ok=True)
    f = d / "SKILL.md"
    f.write_text(
        f"---\nname: {dirname}\ndescription: {desc}\n{extra}\n---\n{body}",
        encoding="utf-8",
    )
    return f


def _seed(tmp_path: Path) -> Path:
    """普通技能 + 深读技能（CJK 名）+ 深读技能（ASCII 名）。"""
    _write_skill(tmp_path, "normal")
    _write_skill(tmp_path, "_bookskill_麦当劳准则", desc="来自《麦当劳准则》。雷·克洛克的经营哲学。")
    _write_skill(tmp_path, "_bookskill_The-McKinsey-Way", desc="From The McKinsey Way. Frameworks.")
    return tmp_path


def _stub_state(name: str) -> dict:
    return {
        "enabled": True,
        "context_menu": True,
        "accept_dirs": False,
        "deleted": False,
        "source_url": None,
    }


# ---------------------------------------------------------------- 前缀判定


class TestPrefix:
    def test_is_book_skill(self):
        assert skills_config.is_book_skill("_bookskill_麦当劳准则") is True
        assert skills_config.is_book_skill("_bookskill_x") is True
        assert skills_config.is_book_skill("book-to-skill") is False
        assert skills_config.is_book_skill("_bookskill") is False  # 前缀须带尾下划线
        assert skills_config.is_book_skill("") is False

    def test_book_skill_names(self):
        names = {"_bookskill_a", "normal", "_bookskill_麦", "_bookskill"}
        assert skills_config.book_skill_names(names) == {"_bookskill_a", "_bookskill_麦"}

    def test_book_skill_names_union_with_disabled(self, tmp_path, monkeypatch):
        """两名单独立：disabled_names 只看 sidecar；模型感知面隔断 = 注入方
        并集（disabled ∪ book_skill_names）——深读技能不进 disabled_names。"""
        monkeypatch.setattr(
            skills_config, "_load_raw", lambda: {"skills": {"_bookskill_a": {"enabled": False}}}
        )
        # disabled_names 语义不变：sidecar 停用照进名单（用户显式停用普通面）
        assert skills_config.disabled_names({"_bookskill_a", "normal"}) == {"_bookskill_a"}
        # 注入方并集（agent_integration / tui / _hot_apply 的实际口径）：
        assert (
            skills_config.disabled_names({"_bookskill_a", "_bookskill_b", "normal"})
            | skills_config.book_skill_names({"_bookskill_a", "_bookskill_b", "normal"})
        ) == {"_bookskill_a", "_bookskill_b"}


# ---------------------------------------------------------------- 四隐藏面


class TestHiddenSurfaces:
    def test_toolbox_excludes_book_skills(self, tmp_path, monkeypatch):
        """/api/skills（工具箱）：context_menu 全开也不出现深读技能。"""
        root = _seed(tmp_path)
        fake_agent = SimpleNamespace(
            runtime=SimpleNamespace(skills=SkillLoader(root))
        )
        monkeypatch.setattr(skills_api.deps, "get_agent", lambda: fake_agent)
        monkeypatch.setattr(skills_api.skills_config, "effective_state", _stub_state)
        result = asyncio.run(skills_api.list_skills())
        assert [s["name"] for s in result["skills"]] == ["normal"]

    def test_manage_excludes_book_skills(self, tmp_path, monkeypatch):
        """/api/skills/manage（设置页 + 对话技能候选源）：排除深读技能。"""
        root = _seed(tmp_path)
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: SkillLoader(root))
        monkeypatch.setattr(skills_api.skills_config, "builtin_skill_names", lambda: set())
        monkeypatch.setattr(skills_api.skills_config, "deleted_names", lambda: set())
        monkeypatch.setattr(
            skills_api.skills_config, "builtin_model_only_names", lambda: set()
        )
        result = asyncio.run(skills_api.list_skills_manage())
        assert [s.name for s in result.skills] == ["normal"]

    def test_patch_book_skill_404(self, tmp_path, monkeypatch):
        """PATCH 深读技能 = 404 拒识（设置页不可达，ADR-0041）。"""
        root = _seed(tmp_path)
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: SkillLoader(root))
        monkeypatch.setattr(skills_api.skills_config, "builtin_skill_names", lambda: set())
        monkeypatch.setattr(
            skills_api.skills_config,
            "update_skill",
            lambda *a, **k: pytest.fail("深读技能 patch 不得触达 sidecar 写入"),
        )
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(
                skills_api.patch_skill("_bookskill_麦当劳准则", SkillPatchRequest())
            )
        assert ei.value.status == 404


# ---------------------------------------------------------------- books 端点


class TestListBooks:
    def test_books_only_prefix_sorted_by_mtime_desc(self, tmp_path, monkeypatch):
        """只有深读技能入列；mtime 倒序（新生成在前）。"""
        root = _seed(tmp_path)
        # 显式双向 utime（Windows 下同秒创建的文件 mtime 精度可能并列，
        # 单向 +100 仍可能被并列值压制；双向拉开保证顺序确定）
        q = root / "_bookskill_The-McKinsey-Way" / "SKILL.md"
        p = root / "_bookskill_麦当劳准则" / "SKILL.md"
        import os

        os.utime(q, (1_000_000_000, 1_000_000_000))
        os.utime(p, (1_000_010_000, 1_000_010_000))
        loader = SkillLoader(root)
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: loader)
        monkeypatch.setattr(skills_api, "_skills_dir", lambda: root)
        result = asyncio.run(skills_api.list_books())
        books = result["books"]
        assert [b["name"] for b in books] == [
            "_bookskill_麦当劳准则",
            "_bookskill_The-McKinsey-Way",
        ]
        by_name = {b["name"]: b for b in books}
        assert by_name["_bookskill_麦当劳准则"]["title"] == "麦当劳准则"
        assert by_name["_bookskill_The-McKinsey-Way"]["title"] == "The-McKinsey-Way"

    def test_books_description_first_sentence(self, tmp_path, monkeypatch):
        """摘要 = description 首句截断（中文句号）。"""
        root = _seed(tmp_path)
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: SkillLoader(root))
        monkeypatch.setattr(skills_api, "_skills_dir", lambda: root)
        result = asyncio.run(skills_api.list_books())
        book = next(
            b for b in result["books"] if b["name"] == "_bookskill_麦当劳准则"
        )
        assert book["description"] == "来自《麦当劳准则》。"

    def test_books_not_filtered_by_enabled(self, tmp_path, monkeypatch):
        """enabled=false 的深读技能不消失（面板无停用语义）。"""
        root = _seed(tmp_path)
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: SkillLoader(root))
        monkeypatch.setattr(skills_api, "_skills_dir", lambda: root)
        result = asyncio.run(skills_api.list_books())
        assert len(result["books"]) == 2

    def test_books_empty_when_none(self, tmp_path, monkeypatch):
        _write_skill(tmp_path, "normal")
        monkeypatch.setattr(skills_api, "_scan_loader", lambda: SkillLoader(tmp_path))
        monkeypatch.setattr(skills_api, "_skills_dir", lambda: tmp_path)
        result = asyncio.run(skills_api.list_books())
        assert result["books"] == []


# ---------------------------------------------------------------- 斜杠链路


class TestSlashExemption:
    def test_cjk_name_matches_slash_re(self, tmp_path):
        """CJK 技能名可斜杠命中（ADR-0041 D4，存量缺陷修复）。"""
        root = _seed(tmp_path)
        loader = SkillLoader(root)
        assert (
            legal_slash_skill("/_bookskill_麦当劳准则 这本书讲了什么", loader)
            == "_bookskill_麦当劳准则"
        )

    def test_book_skill_exempt_from_disabled(self, tmp_path):
        """深读技能被宿主注入 disabled 名单（模型感知面隔断）后，
        面板链路的斜杠消息仍放行——豁免 disabled 门（ADR-0041 D2）。"""
        root = _seed(tmp_path)
        loader = SkillLoader(root)
        loader.set_disabled(list(loader.skills.keys()))
        assert (
            legal_slash_skill("/_bookskill_麦当劳准则 问题", loader)
            == "_bookskill_麦当劳准则"
        )

    def test_normal_disabled_still_rejected(self, tmp_path):
        """豁免只对前缀：普通技能 disabled 照旧拒绝。"""
        root = _seed(tmp_path)
        loader = SkillLoader(root)
        loader.set_disabled(["normal"])
        assert legal_slash_skill("/normal 问题", loader) is None

    def test_book_skill_user_invocable_gate_unchanged(self, tmp_path):
        """user-invocable 硬门不豁免：深读技能若声明 false 仍不可斜杠。"""
        _write_skill(
            tmp_path, "_bookskill_hidden", extra="user-invocable: false"
        )
        loader = SkillLoader(tmp_path)
        assert legal_slash_skill("/_bookskill_hidden 问题", loader) is None


# ---------------------------------------------------------------- 名称校验


class TestNameRe:
    @pytest.mark.parametrize(
        "name",
        [
            "_bookskill_麦当劳准则",
            "_bookskill_The-McKinsey-Way",
            "_bookskill_日本語の本",
            "normal-skill.v2",
        ],
    )
    def test_cjk_and_ascii_names_valid(self, name):
        assert skills_api._validate_name(name) == name

    @pytest.mark.parametrize("name", ["has space", "a/b", "a\\b", "a:b", ""])
    def test_invalid_names_rejected(self, name):
        with pytest.raises(CortexAPIError) as ei:
            skills_api._validate_name(name)
        assert ei.value.status == 400
