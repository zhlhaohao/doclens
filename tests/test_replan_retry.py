"""replan / retry（ADR-0059 §5c/§6）。"""

from __future__ import annotations

import json

import pytest

from planify.team import dag as D
from planify.team.roles import RoleLibrary
from planify.skills.access_state import set_current_session_id, reset_current_session_id


@pytest.fixture
def env(tmp_path):
    from planify.team.hub import TeamHub
    from planify.team.plan_tools import make_plan_tools, MAX_REPLANS
    from planify.team.runner import BotRunner
    from planify.team.scheduler import Scheduler
    from dataclasses import dataclass, field
    from typing import List

    @dataclass
    class _Resp:
        content: list
        stop_reason: str = "end_turn"

    hub = TeamHub(tmp_path / "team", RoleLibrary())
    hub.registry.spawn("remy", "researcher", "S1")
    hub.registry.spawn("kit", "researcher", "S1")

    class _Silent:
        """永远 idle 的 Bot——任务派下去但不会完成，便于测试操作 stalled 状态。"""
        def chat(self, **kw):
            from planify.core.llm.types import ToolUseBlock
            return _Resp([ToolUseBlock(id="i", name="idle", input={})], "tool_use")

    runner = BotRunner(hub, _Silent(), tmp_path, [], {}, poll_interval=0, idle_timeout=60)
    hub.attach_runner(runner)
    sched = Scheduler(hub, spawner=lambda s, n, p: runner.start(s, n, p), thread_alive=runner.is_alive, poll_interval=0.05)
    hub.attach_scheduler(sched)
    _, H = make_plan_tools(lambda: hub, tmp_path)
    tok = set_current_session_id("S1")
    yield hub, H, MAX_REPLANS
    sched.stop()
    reset_current_session_id(tok)


def _J(s):
    """handler 返回 JSON 或 'Error: ...' 字串——统一解析。"""
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return {"ok": False, "error": s}


PLAN = {"steps": [
    {"step_id": "s1", "subject": "a", "instructions": "x", "role": "researcher", "assignee": "remy",
     "acceptance": [{"check": "exists", "path": "a.md"}]},
    {"step_id": "s2", "subject": "b", "instructions": "y", "role": "researcher", "assignee": "kit",
     "depends_on": ["s1"], "deliverables": [{"id": "d2", "path": "b.md"}]},
]}


def _make_stalled(hub, H, failed="s1", done=()):
    """造一个 stalled DAG：等调度器派单（task_id 落地）后，done 标 done、failed 标 failed。"""
    r = _J(H["group_plan"](PLAN))
    dag_id = r["dag_id"]
    _J(H["group_plan_start"](dag_id))
    sc = hub.scope("S1")
    import time
    for _ in range(100):
        dag = D.read_dag(sc.dags_dir, dag_id)
        if dag["steps"][failed or "s1"]["task_id"] is not None:
            break
        time.sleep(0.02)
    dag = D.read_dag(sc.dags_dir, dag_id)
    dag["status"] = D.DAG_STALLED
    dag["failed_step"] = failed
    for sid in done:
        dag["steps"][sid]["status"] = D.STEP_DONE
    if failed:
        dag["steps"][failed]["status"] = D.STEP_FAILED
    D.write_dag(sc.dags_dir, dag)
    return dag_id


class TestReplan:
    def test_replan_replaces_unfinished_keeps_done(self, env):
        hub, H, _ = env
        dag_id = _make_stalled(hub, H, failed="s2", done=("s1",))
        new = {"steps": [{"step_id": "s2", "subject": "b2", "instructions": "y2", "role": "researcher", "assignee": "remy",
                          "depends_on": ["s1"], "deliverables": [{"id": "d2", "path": "b2.md"}]}]}
        out = _J(H["group_plan_replan"](dag_id, new))
        assert out["ok"] and out["status"] == "draft", out
        dag = D.read_dag(hub.scope("S1").dags_dir, dag_id)
        assert dag["steps"]["s1"]["status"] == D.STEP_DONE      # 保留
        assert dag["steps"]["s2"]["status"] == D.STEP_PENDING    # 新
        assert dag["replans"] == 1
        # 用户确认后 start → active
        assert _J(H["group_plan_start"](dag_id))["ok"]
        assert D.read_dag(hub.scope("S1").dags_dir, dag_id)["status"] == D.DAG_ACTIVE

    def test_replan_cannot_resubmit_done(self, env):
        hub, H, _ = env
        dag_id = _make_stalled(hub, H, failed="s2", done=("s1",))
        out = _J(H["group_plan_replan"](dag_id, PLAN))  # 含 s1（已 done）
        assert not out["ok"] and out["issue"]["code"] == "replan_resubmits_done"

    def test_replan_may_depend_on_done(self, env):
        hub, H, _ = env
        dag_id = _make_stalled(hub, H, failed="s2", done=("s1",))
        new = {"steps": [{"step_id": "s3", "subject": "c", "instructions": "z", "role": "researcher", "assignee": "kit",
                          "depends_on": ["s1"], "inputs": [{"step": "s1", "deliverable_id": "d2"}],
                          "deliverables": [{"id": "d3", "path": "c.md"}]}]}
        # s1 没有 d2（原计划 d2 在 s2）→ input_deliverable_unknown
        out = _J(H["group_plan_replan"](dag_id, new))
        assert not out["ok"] and out["issue"]["code"] == "input_deliverable_unknown"

    def test_replan_only_when_stalled(self, env):
        hub, H, _ = env
        r = json.loads(H["group_plan"](PLAN))
        out = _J(H["group_plan_replan"](r["dag_id"], PLAN))
        assert not out["ok"] and "not stalled" in out.get("issue", {}).get("message", "") or "Error" in str(out)

    def test_replan_max_twice(self, env):
        """纯状态机测试：不依赖调度器——手动 stall，避免与调度器派单竞争写 DAG 文件。"""
        hub, H, MAX = env
        r = _J(H["group_plan"](PLAN))
        dag_id = r["dag_id"]
        _J(H["group_plan_start"](dag_id))
        sc = hub.scope("S1")
        new = {"steps": [{"step_id": "s2", "subject": "b", "instructions": "y", "role": "researcher", "assignee": "kit"}]}
        for i in range(MAX):
            # 手动 stall（s1 已 done，s2 failed）
            dag = D.read_dag(sc.dags_dir, dag_id)
            dag["status"] = D.DAG_STALLED
            dag["steps"]["s1"]["status"] = D.STEP_DONE
            dag["steps"]["s2"]["status"] = D.STEP_FAILED
            D.write_dag(sc.dags_dir, dag)
            out = _J(H["group_plan_replan"](dag_id, new))
            assert out["ok"], (i, out)
            assert _J(H["group_plan_start"](dag_id))["ok"]
        dag = D.read_dag(sc.dags_dir, dag_id)
        dag["status"] = D.DAG_STALLED
        dag["steps"]["s2"]["status"] = D.STEP_FAILED
        D.write_dag(sc.dags_dir, dag)
        out = H["group_plan_replan"](dag_id, new)
        assert "already replanned" in out


class TestRetry:
    def test_retry_resets_and_resumes(self, env):
        hub, H, _ = env
        dag_id = _make_stalled(hub, H, failed="s1")
        sc = hub.scope("S1")
        t = sc.tasks.get_raw(D.read_dag(sc.dags_dir, dag_id)["steps"]["s1"]["task_id"])
        t["fix_rounds"] = 3
        sc.tasks.save_raw(t)
        out = _J(H["group_plan_retry"](dag_id, "s1"))
        assert out["ok"] and out["status"] == "active"
        dag = D.read_dag(sc.dags_dir, dag_id)
        assert dag["steps"]["s1"]["status"] == D.STEP_READY
        assert sc.tasks.get_raw(t["id"])["fix_rounds"] == 0

    def test_retry_only_failed(self, env):
        hub, H, _ = env
        dag_id = _make_stalled(hub, H, failed="s1")
        out = H["group_plan_retry"](dag_id, "s2")
        assert "not failed" in out
