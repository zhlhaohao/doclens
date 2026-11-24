"""单 DAG LLM 调用上限（ADR-0059 §12 成本兜底）。"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass

from planify.team import dag as D
from planify.team.hub import TeamHub
from planify.team.plan_tools import make_plan_tools
from planify.team.roles import RoleLibrary
from planify.team.runner import BotRunner
from planify.team.scheduler import Scheduler
from planify.core.llm.types import ToolUseBlock
from planify.skills.access_state import set_current_session_id, reset_current_session_id


@dataclass
class _Resp:
    content: list
    stop_reason: str = "end_turn"


class _IdleForever:
    """每次都调 read_inbox（不 idle、不完成）——WORK 循环持续跑，每轮消耗一次 LLM 调用。"""
    def __init__(self):
        self.calls = 0

    def chat(self, **kw):
        self.calls += 1
        return _Resp([ToolUseBlock(id=f"r{self.calls}", name="read_inbox", input={})], "tool_use")


def _build(tmp_path, limit):
    hub = TeamHub(tmp_path / "team", RoleLibrary())
    prov = _IdleForever()
    runner = BotRunner(hub, prov, tmp_path, [], {}, poll_interval=0, idle_timeout=60)
    hub.attach_runner(runner)
    sched = Scheduler(hub, spawner=lambda s, n, p: runner.start(s, n, p), thread_alive=runner.is_alive,
                      poll_interval=0.05, max_llm_calls_per_dag=limit)
    hub.attach_scheduler(sched)
    _, H = make_plan_tools(lambda: hub, tmp_path)
    return hub, runner, sched, H, prov


def _wait(pred, timeout=5.0, msg="cond"):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"timeout: {msg}")


PLAN = {"steps": [{"step_id": "s1", "subject": "a", "instructions": "x", "role": "researcher",
                   "assignee": "remy", "acceptance": [{"check": "exists", "path": "a.md"}]}]}


def test_budget_exceeded_pauses(tmp_path):
    hub, runner, sched, H, prov = _build(tmp_path, limit=3)
    hub.registry.spawn("remy", "researcher", "S1")
    tok = set_current_session_id("S1")
    try:
        r = json.loads(H["group_plan"](PLAN))
        H["group_plan_start"](r["dag_id"])
        sc = hub.scope("S1")
        _wait(lambda: D.read_dag(sc.dags_dir, r["dag_id"])["status"] == D.DAG_PAUSED, msg="paused by budget")
        d = D.read_dag(sc.dags_dir, r["dag_id"])
        assert d["stall_reason"] == "llm_budget_exceeded"
        assert d["failed_step"] is None
        assert d["llm_calls"] > 3
        assert d["steps"]["s1"]["status"] == D.STEP_READY  # 可续跑，不是 failed
        msgs = [json.loads(m["content"]) for m in sc.bus.read_inbox("lead") if m["type"] == "dag_stalled"]
        assert any(m["reason"] == "llm_budget_exceeded" for m in msgs)
        # Bot 被停
        _wait(lambda: not runner.is_alive("S1", "remy"), msg="bot stopped")
    finally:
        sched.stop()
        reset_current_session_id(tok)


def test_resume_resets_budget(tmp_path):
    hub, runner, sched, H, prov = _build(tmp_path, limit=3)
    hub.registry.spawn("remy", "researcher", "S1")
    tok = set_current_session_id("S1")
    try:
        r = json.loads(H["group_plan"](PLAN))
        H["group_plan_start"](r["dag_id"])
        sc = hub.scope("S1")
        _wait(lambda: D.read_dag(sc.dags_dir, r["dag_id"])["status"] == D.DAG_PAUSED, msg="paused")
        _wait(lambda: not runner.is_alive("S1", "remy"), msg="bot stopped")
        assert sched._llm_calls.get(("S1", r["dag_id"]), 0) > 3
        assert json.loads(H["group_plan_resume"](r["dag_id"]))["ok"]
        assert sched._llm_calls.get(("S1", r["dag_id"]), 0) == 0  # resume 重置
        assert D.read_dag(sc.dags_dir, r["dag_id"])["status"] == D.DAG_ACTIVE
    finally:
        sched.stop()
        reset_current_session_id(tok)
