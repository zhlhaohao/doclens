"""技能契约消费（ADR-0059 §5 / ADR-0058 §4）：skill 字段 → contract 合并 + Bot load_skill。"""

from __future__ import annotations

import json

import pytest

from planify.team import dag as D
from planify.team.roles import RoleLibrary


@pytest.fixture
def rl():
    return RoleLibrary()


class TestRoleSkillAccess:
    def test_contract_parsed(self, rl):
        c = rl.get("researcher").skill_contract("research-report")
        assert c and c["deliverables"][0]["id"] == "report"
        assert c["maxFixRounds"] == 2

    def test_contract_none_for_skill_without(self, rl):
        assert rl.get("code-reviewer").skill_contract("code-review-checklist") is None

    def test_skill_not_in_role(self, rl):
        assert rl.get("researcher").skill_contract("deck-polish") is None
        assert "has no skill" in rl.get("researcher").load_skill("deck-polish")

    def test_load_skill_returns_body_without_frontmatter(self, rl):
        out = rl.get("researcher").load_skill("research-report")
        assert out.startswith("Base directory for this skill:")
        assert "<skill" in out and "pibot-contract" not in out and "运行环境说明" in out

    def test_system_prompt_lists_skills(self, rl):
        from pathlib import Path
        sp = rl.get("researcher").system_prompt("remy", Path("."))
        assert "research-report" in sp and "load_skill" in sp


class TestMergeContract:
    def _step(self, **kw):
        base = {"step_id": "s1", "subject": "x", "instructions": "y", "role": "researcher", "skill": "research-report"}
        base.update(kw)
        return base

    def test_bare_step_gets_full_contract(self, rl):
        s = self._step()
        notes = D.merge_skill_contracts([s], rl.get)
        assert s["deliverables"] == [{"id": "report", "path": "报告.md", "kind": "md"}]
        checks = {a["check"]: a for a in s["acceptance"]}
        assert set(checks) == {"exists", "sections", "min_citations"}  # sectionsSourced dropped
        assert checks["sections"]["names"] == sorted(["结论摘要", "子问题", "来源"])
        assert checks["min_citations"]["min"] == 3
        assert s["max_fix_rounds"] == 2
        assert any("unsupported" in n for n in notes)

    def test_lead_tightens_min(self, rl):
        s = self._step(deliverables=[{"id": "report", "path": "报告.md"}],
                       acceptance=[{"check": "min_citations", "path": "报告.md", "min": 10}])
        D.merge_skill_contracts([s], rl.get)
        checks = [a for a in s["acceptance"] if a["check"] == "min_citations"]
        assert len(checks) == 1 and checks[0]["min"] == 10

    def test_lead_cannot_loosen(self, rl):
        s = self._step(deliverables=[{"id": "report", "path": "报告.md"}],
                       acceptance=[{"check": "min_citations", "path": "报告.md", "min": 1}])
        D.merge_skill_contracts([s], rl.get)
        checks = [a for a in s["acceptance"] if a["check"] == "min_citations"]
        assert checks[0]["min"] == 3  # 契约更严，取严

    def test_contract_path_is_authoritative(self, rl):
        """lead 写同名 deliverable 但改 path → 以契约为准（契约定义产物形态）。"""
        s = self._step(deliverables=[{"id": "report", "path": "my.md"}])
        D.merge_skill_contracts([s], rl.get)
        assert s["deliverables"][0]["path"] == "报告.md"

    def test_no_skill_no_merge(self, rl):
        s = {"step_id": "s1", "subject": "x", "instructions": "y", "role": "researcher"}
        assert D.merge_skill_contracts([s], rl.get) == []
        assert "deliverables" not in s

    def test_skill_without_contract(self, rl):
        s = {"step_id": "s1", "subject": "x", "instructions": "y", "role": "code-reviewer", "skill": "code-review-checklist"}
        notes = D.merge_skill_contracts([s], rl.get)
        assert any("no contract" in n for n in notes)
        assert "deliverables" not in s


class TestGroupPlanSkill:
    """经 plan_tools 全链路：skill 校验 + 合并进 DAG。"""

    def _hub(self, tmp_path):
        from planify.team.hub import TeamHub
        from planify.team.plan_tools import make_plan_tools
        hub = TeamHub(tmp_path / "team", RoleLibrary())
        defs, H = make_plan_tools(lambda: hub, tmp_path)
        return hub, H

    def test_skill_unknown_rejected(self, tmp_path):
        from planify.skills.access_state import set_current_session_id, reset_current_session_id
        hub, H = self._hub(tmp_path)
        hub.registry.spawn("remy", "researcher", "S1")
        tok = set_current_session_id("S1")
        try:
            plan = {"steps": [{"step_id": "s", "subject": "x", "instructions": "y", "role": "researcher",
                               "assignee": "remy", "skill": "deck-polish"}]}
            out = json.loads(H["group_plan"](plan))
        finally:
            reset_current_session_id(tok)
        assert not out["ok"] and out["issue"]["code"] == "skill_unknown"

    def test_skill_merged_into_dag(self, tmp_path):
        from planify.skills.access_state import set_current_session_id, reset_current_session_id
        hub, H = self._hub(tmp_path)
        hub.registry.spawn("remy", "researcher", "S1")
        tok = set_current_session_id("S1")
        try:
            plan = {"steps": [{"step_id": "s", "subject": "x", "instructions": "y", "role": "researcher",
                               "assignee": "remy", "skill": "research-report"}]}
            out = json.loads(H["group_plan"](plan))
        finally:
            reset_current_session_id(tok)
        assert out["ok"], out
        assert any("merged contract" in r for r in out["repairs"])
        dag = D.read_dag(hub.scope("S1").dags_dir, out["dag_id"])
        step = dag["plan"]["steps"][0]
        assert step["deliverables"][0]["path"] == "报告.md"
        assert {a["check"] for a in step["acceptance"]} == {"exists", "sections", "min_citations"}
