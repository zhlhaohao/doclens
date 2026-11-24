"""内置角色库（ADR-0058 §3/§5）不变量。

锁定：12 个角色（11 移植 Pi Bot + default）、每个 role.json 字段完整、skills 清单与磁盘
一致、权限裁剪符合设计意图（reviewer 不改代码、researcher 不跑命令）、SKILL.md
frontmatter 已改名（无 pibot-contract 残留）、NOTICE 与许可证副本在位。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from planify.team.roles import FORCED_BOT_TOOLS, ROLES_DIR, RoleLibrary

ALL = ["read_file", "grep", "glob", "write_file", "edit_file", "bash", "send_message", "idle", "task_update"]
PIBOT_ROLES = ["code-reviewer", "copywriter", "data-analyst", "fullstack-dev", "general-assistant",
               "personal-assistant", "plugin-builder", "presentation-designer", "qa-engineer",
               "researcher", "social-media"]


class TestRoleLibrary:
    def test_twelve_roles(self):
        rl = RoleLibrary()
        assert rl.ids() == sorted(PIBOT_ROLES + ["default"])

    @pytest.mark.parametrize("rid", PIBOT_ROLES + ["default"])
    def test_role_json_complete(self, rid):
        rl = RoleLibrary()
        r = rl.get(rid)
        for key in ("id", "version", "name", "description", "persona", "norms"):
            assert getattr(r, key) is not None, f"{rid}.{key} missing"
        assert r.id == rid
        assert isinstance(r.version, int) and r.version >= 1
        # 双语字段至少一种语言非空
        assert r.text(r.persona) and r.text(r.description)
        # 权限：白名单与黑名单不相交
        assert not (set(r.tools) & set(r.forbid)), f"{rid}: tools/forbid overlap"

    def test_skills_on_disk(self):
        rl = RoleLibrary()
        for rid in rl.ids():
            r = rl.get(rid)
            for sk in r.skills:
                for lang in ("zh", "en"):
                    p = ROLES_DIR / rid / "skills" / sk / lang / "SKILL.md"
                    assert p.exists(), f"missing {p}"

    def test_skill_frontmatter_renamed(self):
        for p in ROLES_DIR.glob("*/skills/*/*/SKILL.md"):
            text = p.read_text(encoding="utf-8")
            assert "pibot-contract" not in text, f"{p}: pibot-contract residue"
            assert "pibot-params" not in text, f"{p}: pibot-params residue"

    # ---------------------------------------------------------- 权限意图

    def test_reviewer_cannot_edit_code(self):
        r = RoleLibrary().get("code-reviewer")
        tools = set(r.allowed_tools(ALL))
        assert "bash" in tools                      # run_command: always
        assert "write_file" in r.forbid and "edit_file" in r.forbid
        # FORCED 注入的 write_file 是限路径版（runner._role_explicit_write 不含它）——
        # 这里只验 role.tools 不显式含 write_file
        assert "write_file" not in r.tools

    def test_researcher_no_shell(self):
        r = RoleLibrary().get("researcher")
        tools = set(r.allowed_tools(ALL))
        assert "bash" not in tools and "bash" in r.forbid
        assert "write_file" in tools                 # 写交付物

    @pytest.mark.parametrize("rid", ["copywriter", "social-media"])
    def test_no_shell_roles(self, rid):
        assert "bash" in RoleLibrary().get(rid).forbid

    def test_forced_tools_always_present(self):
        rl = RoleLibrary()
        for rid in rl.ids():
            tools = set(rl.get(rid).allowed_tools(ALL))
            assert FORCED_BOT_TOOLS & set(ALL) <= tools, f"{rid}: forced tools missing"

    def test_default_is_least_privilege(self):
        r = RoleLibrary().get("default")
        tools = set(r.allowed_tools(ALL))
        assert "bash" not in tools and "edit_file" not in tools
        assert "write_file" in r.forbid  # 只靠 FORCED 拿到限路径 write_file

    # ---------------------------------------------------------- 许可

    def test_notice_and_license_present(self):
        assert (ROLES_DIR / "NOTICE").exists()
        assert (ROLES_DIR / "LICENSE-PiBot").exists()
        notice = (ROLES_DIR / "NOTICE").read_text(encoding="utf-8")
        assert "w01fb0ss/PiBot" in notice and "Apache" in notice

    def test_pibot_roles_declare_source(self):
        for rid in PIBOT_ROLES:
            raw = json.loads((ROLES_DIR / rid / "role.json").read_text(encoding="utf-8"))
            assert "Pi Bot" in raw.get("source", ""), f"{rid}: source missing"
