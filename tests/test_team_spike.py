"""ADR-0058/0059 spike：团队作用域 + DAG 派活端到端最小闭环。

假 LLM provider 驱动 Bot 线程：按脚本依次返回 write_file / task_update / idle
工具调用，不触网。覆盖三轮评审指出的机制：
  - 租约：跨 scope 拒绝、同 scope 复用、idle 不起新线程
  - 校验器首错 + 示例；cycle / 角色不匹配 / inputs 非依赖
  - 验收：exists/sections/min_citations/manual；不过打回、超限 failed→stalled
  - 端到端：派单 → 执行 → 验收 → 下游推进 → dag_done 通知 lead
  - 停止 = 停全部：DAG 转暂停 + Bot 收 shutdown；resume 续跑
  - scope 隔离：两 scope 的 lead 收件箱互不可见
  - 重启恢复：in_progress → ready，派单时 shutdown 态 Bot 自动复活
  - contextvar 穿透：Bot 线程内 get_current_session_id() == scope
"""

from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

import pytest

from planify.team import acceptance, dag as D
from planify.team.bot_registry import BotRegistry, BotRegistryError
from planify.team.hub import TeamHub
from planify.team.plan_tools import make_plan_tools
from planify.team.roles import RoleLibrary
from planify.team.scheduler import Scheduler


# ----------------------------------------------------------------- 假 LLM

@dataclass
class _Block:
    type: str
    text: str = ""
    id: str = ""
    name: str = ""
    input: Dict[str, Any] = None


@dataclass
class _Resp:
    content: List[_Block]
    stop_reason: str = "end_turn"


class FakeProvider:
    """按 bot_name 脚本化响应。脚本项：可调用 (messages) -> _Resp，或 _Resp。"""

    def __init__(self):
        self.scripts: Dict[str, List] = {}
        self.calls: Dict[str, int] = {}

    def set(self, bot: str, turns: List):
        self.scripts[bot] = list(turns)

    def chat(self, messages, system=None, tools=None, **kw):
        # 从 messages 里无法直接知道 bot 名；runner 在 system prompt 首行写了 "You are '<name>'"
        name = system.split("'")[1] if system and system.startswith("You are '") else "?"
        self.calls[name] = self.calls.get(name, 0) + 1
        turns = self.scripts.get(name)
        if not turns:
            return _Resp([_Block("text", "nothing scripted")])
        t = turns.pop(0)
        return t(messages) if callable(t) else t


def _tool(id_, name, **inp):
    return _Resp([_Block("tool_use", id=id_, name=name, input=inp)], "tool_use")


def _text(t):
    return _Resp([_Block("text", t)])


def _write(rel, content, id_="w1"):
    return _tool(id_, "write_file", path=rel, content=content)


def _complete(id_="t1"):
    return _tool(id_, "task_update", task_id=None, status="completed")


def _idle(id_="i1"):
    return _tool(id_, "idle")


# ----------------------------------------------------------------- 装配

def _write_file(path, content, workdir, resolve=None):
    p = Path(path)
    if not p.is_absolute():
        p = Path(workdir) / p
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return f"Wrote {p}"


def _read_file(path, workdir, offset=None, limit=None):
    p = Path(path)
    if not p.is_absolute():
        p = Path(workdir) / p
    return p.read_text(encoding="utf-8") if p.exists() else "Error: not found"


def _build(tmp_path: Path, provider=None):
    provider = provider or FakeProvider()
    workdir = tmp_path / "kb"
    workdir.mkdir()
    tool_defs = [{"name": n, "description": n, "input_schema": {"type": "object"}} for n in ("read_file", "write_file")]
    handlers = {"read_file": lambda **kw: _read_file(kw["path"], workdir),
                "write_file": lambda **kw: _write_file(kw["path"], kw["content"], workdir)}
    hub = TeamHub(tmp_path / "kb" / ".planify" / "team", RoleLibrary())
    from planify.team.runner import BotRunner
    runner = BotRunner(hub, provider, workdir, tool_defs, handlers, poll_interval=0.01, idle_timeout=30)
    hub.attach_runner(runner)
    sched = Scheduler(hub, spawner=lambda s, n, p: runner.start(s, n, p), thread_alive=runner.is_alive, poll_interval=0.05)
    hub.attach_scheduler(sched)
    defs, H = make_plan_tools(lambda: hub, workdir)
    return hub, runner, sched, H, provider, workdir


def _wait(pred, timeout=5.0, msg="condition"):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"timeout waiting for {msg}")


def _with_scope(sid, fn, *a, **kw):
    from planify.skills.access_state import set_current_session_id, reset_current_session_id
    tok = set_current_session_id(sid)
    try:
        return fn(*a, **kw)
    finally:
        reset_current_session_id(tok)


# ====================================================================== 注册表

class TestRegistry:
    def test_create_and_revive(self, tmp_path):
        reg = BotRegistry(tmp_path, ["researcher"])
        b = reg.spawn("alice", "researcher", "S1")
        assert b["_spawned"] is True and b["leased_by"] == "S1" and b["status"] == "working"
        reg.set_status("alice", "shutdown", "S1")
        reg.release("alice", "S1")
        b2 = reg.spawn("alice", "researcher", "S1")
        assert b2["_spawned"] is True  # shutdown → 复活

    def test_role_bound(self, tmp_path):
        reg = BotRegistry(tmp_path, ["researcher", "default"])
        reg.spawn("alice", "researcher", "S1")
        with pytest.raises(BotRegistryError, match="bound to role"):
            reg.spawn("alice", "default", "S1")

    def test_lease_exclusive(self, tmp_path):
        reg = BotRegistry(tmp_path, ["researcher"])
        reg.spawn("alice", "researcher", "S1")
        with pytest.raises(BotRegistryError, match="another session"):
            reg.spawn("alice", "researcher", "S2")
        # 释放后另一 scope 可租
        reg.release("alice", "S1")
        assert reg.spawn("alice", "researcher", "S2")["leased_by"] == "S2"

    def test_unknown_role(self, tmp_path):
        reg = BotRegistry(tmp_path, ["researcher"])
        with pytest.raises(BotRegistryError, match="Unknown role"):
            reg.spawn("x", "nope", "S1")

    def test_release_all_on_restart(self, tmp_path):
        reg = BotRegistry(tmp_path, ["researcher"])
        reg.spawn("a", "researcher", "S1")
        reg.spawn("b", "researcher", "S1")
        assert reg.release_all_leases() == 2
        assert all(b["leased_by"] is None and b["status"] == "shutdown" for b in reg.list_all())

    def test_delete_only_by_holder(self, tmp_path):
        reg = BotRegistry(tmp_path, ["researcher"])
        reg.spawn("a", "researcher", "S1")
        assert reg.delete("a", "S2") is False
        assert reg.delete("a", "S1") is True
        assert not reg.exists("a")


# ====================================================================== 校验器

class TestValidate:
    R = ["researcher", "default"]
    BOTS = {"alice": "researcher"}

    def _v(self, plan):
        return D.validate_plan(plan, role_ids=self.R, bot_names=list(self.BOTS), bot_roles=self.BOTS)

    def test_ok(self):
        p = {"steps": [
            {"step_id": "s1", "subject": "a", "instructions": "x", "role": "researcher", "assignee": "alice",
             "deliverables": [{"id": "d1", "path": "r.md"}]},
            {"step_id": "s2", "subject": "b", "instructions": "y", "role": "researcher",
             "depends_on": ["s1"], "inputs": [{"step": "s1", "deliverable_id": "d1"}]},
        ]}
        assert len(self._v(p)["steps"]) == 2

    def test_first_error_only_with_example(self):
        p = {"steps": [{"step_id": "s1", "subject": "a", "instructions": "x", "role": "nope"}]}
        with pytest.raises(D.PlanIssue) as ei:
            self._v(p)
        assert ei.value.code == "role_unknown" and "researcher" in ei.value.expected

    def test_cycle(self):
        p = {"steps": [
            {"step_id": "s1", "subject": "a", "instructions": "x", "role": "researcher", "depends_on": ["s2"]},
            {"step_id": "s2", "subject": "b", "instructions": "y", "role": "researcher", "depends_on": ["s1"]},
        ]}
        with pytest.raises(D.PlanIssue) as ei:
            self._v(p)
        assert ei.value.code == "cycle"

    def test_input_must_be_dependency(self):
        p = {"steps": [
            {"step_id": "s1", "subject": "a", "instructions": "x", "role": "researcher", "deliverables": [{"id": "d1", "path": "r.md"}]},
            {"step_id": "s2", "subject": "b", "instructions": "y", "role": "researcher",
             "inputs": [{"step": "s1", "deliverable_id": "d1"}]},
        ]}
        with pytest.raises(D.PlanIssue) as ei:
            self._v(p)
        assert ei.value.code == "input_not_a_dependency"

    def test_assignee_role_mismatch(self):
        self.BOTS = {"alice": "default"}
        try:
            p = {"steps": [{"step_id": "s1", "subject": "a", "instructions": "x", "role": "researcher", "assignee": "alice"}]}
            with pytest.raises(D.PlanIssue) as ei:
                self._v(p)
            assert ei.value.code == "assignee_role_mismatch"
        finally:
            self.BOTS = {"alice": "researcher"}


# ====================================================================== 验收

class TestAcceptance:
    def test_exists_sections_citations(self, tmp_path):
        (tmp_path / "r.md").write_text("# 报告\n\n## 摘要\nxx [1]\n\n## 来源\n[1] a.md:3\n", encoding="utf-8")
        ok, fails, manual = acceptance.run_acceptance(tmp_path, [
            {"check": "exists", "path": "r.md"},
            {"check": "sections", "path": "r.md", "names": ["摘要", "来源"]},
            {"check": "min_citations", "path": "r.md", "min": 2},
            {"check": "manual", "note": "user review"},
        ])
        assert ok and not fails and len(manual) == 1

    def test_failures(self, tmp_path):
        ok, fails, _ = acceptance.run_acceptance(tmp_path, [{"check": "exists", "path": "nope.md"}])
        assert not ok and "not found" in fails[0]


# ====================================================================== 端到端

TWO_STEP = {
    "name": "report",
    "steps": [
        {"step_id": "s1", "subject": "research", "instructions": "Write r.md with 摘要 and 来源",
         "role": "researcher", "assignee": "alice",
         "deliverables": [{"id": "d1", "path": "r.md"}],
         "acceptance": [{"check": "exists", "path": "r.md"}, {"check": "sections", "path": "r.md", "names": ["摘要", "来源"]}]},
        {"step_id": "s2", "subject": "summary", "instructions": "Read r.md and write s.md",
         "role": "researcher", "assignee": "alice", "depends_on": ["s1"],
         "inputs": [{"step": "s1", "deliverable_id": "d1"}],
         "deliverables": [{"id": "d2", "path": "s.md"}],
         "acceptance": [{"check": "exists", "path": "s.md"}]},
    ],
}


class TestEndToEnd:
    def test_full_chain(self, tmp_path):
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        prov.set("alice", [
            _idle(),  # 起线程的 prompt：先 idle 等任务
            # s1：读 assignment 后写 r.md，报完成，idle
            _write("r.md", "# r\n## 摘要\nx [1]\n## 来源\n[1] a\n"),
            _complete(), _idle(),
            # s2：收 assignment 后写 s.md 报完成
            _write("s.md", "# s\n"), _complete(), _idle(),
        ])
        out = _with_scope("S1", H["spawn_teammate"], "alice", "researcher", "start")
        assert '"ok": true' in out, out
        _wait(lambda: runner.is_alive("S1", "alice"), msg="bot thread alive")
        r = json.loads(_with_scope("S1", H["group_plan"], TWO_STEP))
        assert r["ok"], r
        dag_id = r["dag_id"]
        # 草稿态：无任务、无租约外的副作用；start 后才 active
        sc = hub.scope("S1")
        assert D.read_dag(sc.dags_dir, dag_id)["status"] == D.DAG_DRAFT
        assert json.loads(_with_scope("S1", H["group_plan_start"], dag_id))["ok"]
        _wait(lambda: D.read_dag(sc.dags_dir, dag_id)["status"] == D.DAG_DONE, timeout=8, msg="dag done")
        dag = D.read_dag(sc.dags_dir, dag_id)
        out_dir = Path(dag["output_dir"])
        assert (out_dir / "r.md").exists() and (out_dir / "s.md").exists()
        msgs = sc.bus.read_inbox("lead")
        assert any(m["type"] == "dag_done" for m in msgs), msgs
        # 验收真实跑过：s1 的 task 记录为 completed
        assert all(s["status"] == D.STEP_DONE for s in dag["steps"].values())

    def test_fix_rounds_then_stalled(self, tmp_path):
        """Bot 交付不达标 → 打回一次 → 再不达标 → failed → DAG stalled，lead 收通知。"""
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        prov.set("alice", [
            _idle(),
            _write("r.md", "# r\n"),  # 缺 摘要/来源 → 打回
            _complete(), _idle(),
            _write("r.md", "# still bad\n"),  # 再缺 → 超限
            _complete(), _idle(),
            _text("done"), _text("done"),
        ])
        _with_scope("S1", H["spawn_teammate"], "alice", "researcher", "go")
        plan = {"name": "x", "steps": [{"step_id": "s1", "subject": "a", "instructions": "x", "role": "researcher",
                                         "assignee": "alice", "deliverables": [{"id": "d1", "path": "r.md"}],
                                         "acceptance": [{"check": "sections", "path": "r.md", "names": ["摘要"]}],
                                         "max_fix_rounds": 1}]}
        r = json.loads(_with_scope("S1", H["group_plan"], plan))
        _with_scope("S1", H["group_plan_start"], r["dag_id"])
        sc = hub.scope("S1")
        _wait(lambda: D.read_dag(sc.dags_dir, r["dag_id"])["status"] == D.DAG_STALLED, timeout=8, msg="stalled")
        d = D.read_dag(sc.dags_dir, r["dag_id"])
        assert d["steps"]["s1"]["status"] == D.STEP_FAILED and d["failed_step"] == "s1"
        msgs = [json.loads(m["content"]) for m in sc.bus.read_inbox("lead") if m["type"] == "dag_stalled"]
        assert any(m["failed_step"] == "s1" for m in msgs), msgs

    def test_thread_death_marks_failed(self, tmp_path):
        """Bot 线程异常退出（LLM 抛错）持有任务 → task failed + step failed（§11b）。"""
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        class Boom(FakeProvider):
            def chat(self, messages, system=None, tools=None, **kw):
                raise RuntimeError("llm down")
        boom = Boom()
        (tmp_path / "b").mkdir()
        hub2, runner2, sched2, H2, _, wd2 = _build(tmp_path / "b", boom)
        _with_scope("S1", H2["spawn_teammate"], "alice", "researcher", "go")
        plan = {"name": "x", "steps": [{"step_id": "s1", "subject": "a", "instructions": "x", "role": "researcher",
                                         "assignee": "alice", "acceptance": [{"check": "exists", "path": "r.md"}]}]}
        r = json.loads(_with_scope("S1", H2["group_plan"], plan))
        _with_scope("S1", H2["group_plan_start"], r["dag_id"])
        sc = hub2.scope("S1")
        _wait(lambda: D.read_dag(sc.dags_dir, r["dag_id"])["status"] == D.DAG_STALLED, timeout=8, msg="stalled after thread death")

    def test_scope_isolation(self, tmp_path):
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        _with_scope("S1", H["spawn_teammate"], "alice", "researcher", "go")
        # S2 看不到 alice（被 S1 租），且 S2 的 inbox 独立
        out = _with_scope("S2", H["list_teammates"])
        assert "leased by another session" in out
        hub.scope("S1").bus.send("system", "lead", json.dumps({"type": "x"}))
        assert _with_scope("S2", H["read_inbox"]) == "[]"
        assert "x" in _with_scope("S1", H["read_inbox"])


# ====================================================================== 停止 / 重启

class TestStopAndRecover:
    def test_busy_bot_rejects_second_assignment(self, tmp_path):
        """已持有未完成任务的 Bot 拒绝第二条 assignment：被拒 task + step 一起回
        ready，held_task 不被覆盖（ADR-0060 §4）。"""
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        prov.set("alice", [_text("thinking...")] * 50)
        _with_scope("S1", H["spawn_teammate"], "alice", "researcher", "go")
        # 两个 DAG 都派 alice
        d1 = json.loads(_with_scope("S1", H["group_plan"], {"name": "p1", "steps": [{"step_id": "s1", "subject": "a", "instructions": "x", "role": "researcher", "assignee": "alice"}]}))["dag_id"]
        _with_scope("S1", H["group_plan_start"], d1)
        sc = hub.scope("S1")
        _wait(lambda: any(s["status"] == D.STEP_IN_PROGRESS for s in D.read_dag(sc.dags_dir, d1)["steps"].values()))
        task1 = D.read_dag(sc.dags_dir, d1)["steps"]["s1"]["task_id"]
        # 手工塞第二条 assignment（模拟 recover 的双派窗口）
        raw = sc.tasks.get_raw(task1)
        other = sc.tasks.create("other", "other instructions")
        other_id = json.loads(other)["id"]
        sc.bus.send("system", "alice", json.dumps({"type": "assignment", "task_id": other_id,
                                                   "instructions": "second", "output_dir": raw["output_dir"]}),
                    msg_type="assignment")
        # Bot 读到后应拒绝第二条：task 回 pending，held_task 保持第一条
        _wait(lambda: sc.tasks.get_raw(other_id)["status"] == "pending", msg="rejected task back to pending")
        assert sc.tasks.get_raw(task1)["status"] == "in_progress"
        assert sc.tasks.get_raw(other_id)["status"] == "pending"

    def test_stop_pauses_and_resume(self, tmp_path):
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        # Bot 永远沉默（不写文件不完成）——任务卡 in_progress
        prov.set("alice", [_text("thinking...")] * 50)
        _with_scope("S1", H["spawn_teammate"], "alice", "researcher", "go")
        r = json.loads(_with_scope("S1", H["group_plan"], TWO_STEP))
        _with_scope("S1", H["group_plan_start"], r["dag_id"])
        sc = hub.scope("S1")
        _wait(lambda: any(s["status"] == D.STEP_IN_PROGRESS for s in D.read_dag(sc.dags_dir, r["dag_id"])["steps"].values()))
        n = sched.pause_scope("S1")
        assert n == 1
        d = D.read_dag(sc.dags_dir, r["dag_id"])
        assert d["status"] == D.DAG_PAUSED
        assert all(s["status"] in (D.STEP_PENDING, D.STEP_READY) for s in d["steps"].values())
        assert sched.resume_dag("S1", r["dag_id"])
        assert D.read_dag(sc.dags_dir, r["dag_id"])["status"] == D.DAG_ACTIVE

    def test_recover_paused_not_redispatched(self, tmp_path):
        """paused DAG 重启后不得复活（ADR-0060 §4）：状态归位但不重投递 assignment、
        不复活 Bot。active DAG 的重投递保持。"""
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        prov.set("alice", [_text("thinking...")] * 50)
        _with_scope("S1", H["spawn_teammate"], "alice", "researcher", "go")
        r = json.loads(_with_scope("S1", H["group_plan"], TWO_STEP))
        _with_scope("S1", H["group_plan_start"], r["dag_id"])
        sc = hub.scope("S1")
        _wait(lambda: any(s["status"] == D.STEP_IN_PROGRESS for s in D.read_dag(sc.dags_dir, r["dag_id"])["steps"].values()))
        sched.pause_scope("S1")
        # 模拟进程重启
        sched.stop()
        runner.shutdown_bot("S1", "alice")
        _wait(lambda: not runner.is_alive("S1", "alice"), msg="bot gone")
        hub.registry.release_all_leases()
        sc.bus.clear_inbox("alice")  # 清掉旧 shutdown_request，避免干扰断言

        dispatched = []
        hub2 = TeamHub(tmp_path / "kb" / ".planify" / "team", RoleLibrary())
        from planify.team.runner import BotRunner
        runner2 = BotRunner(hub2, FakeProvider(), wd, runner.all_tool_defs, runner.all_tool_handlers, poll_interval=0.01, idle_timeout=30)
        hub2.attach_runner(runner2)
        sched2 = Scheduler(hub2, spawner=lambda s, n, p: dispatched.append(n) or runner2.start(s, n, p),
                           thread_alive=runner2.is_alive, poll_interval=0.05)
        hub2.attach_scheduler(sched2)
        n = sched2.recover_scope("S1")
        d = D.read_dag(hub2.scope("S1").dags_dir, r["dag_id"])
        # paused：归位 ready，但 0 派单、0 线程、返回 0
        assert d["status"] == D.DAG_PAUSED
        assert all(s["status"] in (D.STEP_READY, D.STEP_PENDING) for s in d["steps"].values())
        assert n == 0 and dispatched == [], dispatched
        assert not runner2.is_alive("S1", "alice")
        assert hub2.scope("S1").bus.read_inbox("alice") == []

    def test_recover_active_redispatches(self, tmp_path):
        """active DAG 的重投递不受 paused 修复影响：恢复后 ready 步骤重新派单。"""
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        prov.set("alice", [_text("thinking...")] * 50)
        _with_scope("S1", H["spawn_teammate"], "alice", "researcher", "go")
        r = json.loads(_with_scope("S1", H["group_plan"], TWO_STEP))
        _with_scope("S1", H["group_plan_start"], r["dag_id"])
        sc = hub.scope("S1")
        _wait(lambda: any(s["status"] == D.STEP_IN_PROGRESS for s in D.read_dag(sc.dags_dir, r["dag_id"])["steps"].values()))
        sched.stop()
        runner.shutdown_bot("S1", "alice")
        _wait(lambda: not runner.is_alive("S1", "alice"), msg="bot gone")
        hub.registry.release_all_leases()
        sc.bus.clear_inbox("alice")

        hub2 = TeamHub(tmp_path / "kb" / ".planify" / "team", RoleLibrary())
        from planify.team.runner import BotRunner
        runner2 = BotRunner(hub2, FakeProvider(), wd, runner.all_tool_defs, runner.all_tool_handlers, poll_interval=0.01, idle_timeout=30)
        hub2.attach_runner(runner2)
        sched2 = Scheduler(hub2, spawner=lambda s, n, p: runner2.start(s, n, p),
                           thread_alive=runner2.is_alive, poll_interval=0.05)
        hub2.attach_scheduler(sched2)
        hub2.scope("S1")  # 注册 scope（recover_scope 用 try_scope 查注册表）
        n = sched2.recover_scope("S1")
        assert n == 1
        _wait(lambda: len(hub2.scope("S1").bus.read_inbox("alice")) > 0, msg="assignment redelivered")

    def test_pause_one_dag_does_not_stop_other_bots(self, tmp_path):
        """per-DAG 暂停（Bot 会话页「暂停」）：只停目标 DAG 的 Bot，其他 Bot 不收 shutdown。"""
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        prov.set("alice", [_text("thinking...")] * 50)
        prov.set("bob", [_text("thinking...")] * 50)
        _with_scope("S1", H["spawn_teammate"], "alice", "researcher", "go")
        _with_scope("S1", H["spawn_teammate"], "bob", "researcher", "go")
        plan1 = {"name": "p1", "steps": [{"step_id": "s1", "subject": "a", "instructions": "x", "role": "researcher", "assignee": "alice"}]}
        plan2 = {"name": "p2", "steps": [{"step_id": "s1", "subject": "b", "instructions": "x", "role": "researcher", "assignee": "bob"}]}
        d1 = json.loads(_with_scope("S1", H["group_plan"], plan1))["dag_id"]
        d2 = json.loads(_with_scope("S1", H["group_plan"], plan2))["dag_id"]
        _with_scope("S1", H["group_plan_start"], d1)
        _with_scope("S1", H["group_plan_start"], d2)
        sc = hub.scope("S1")
        _wait(lambda: any(s["status"] == D.STEP_IN_PROGRESS for s in D.read_dag(sc.dags_dir, d1)["steps"].values()))
        _wait(lambda: any(s["status"] == D.STEP_IN_PROGRESS for s in D.read_dag(sc.dags_dir, d2)["steps"].values()))
        sc.bus.clear_inbox("alice")
        sc.bus.clear_inbox("bob")
        n = sched.pause_scope("S1", dag_ids=[d1])
        assert n == 1
        assert D.read_dag(sc.dags_dir, d1)["status"] == D.DAG_PAUSED
        assert D.read_dag(sc.dags_dir, d2)["status"] == D.DAG_ACTIVE
        assert any(m["type"] == "shutdown_request" for m in sc.bus.read_inbox("alice"))
        assert sc.bus.read_inbox("bob") == []  # bob 不被误停
        # 全量暂停（/chat/stop）覆盖全部
        n2 = sched.pause_scope("S1", dag_ids=None)
        assert n2 == 1
        assert any(m["type"] == "shutdown_request" for m in sc.bus.read_inbox("bob"))

    def test_verify_result_dropped_when_paused(self, tmp_path):
        """验收结果在 DAG 暂停后整体丢弃：step 不被标 done、task 不被标 completed、
        不发打回消息（ADR-0060 §4）。"""
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        sc = hub.scope("S1")
        # 手工构造一个 verifying 的 active DAG（不经 Bot 线程——本用例只测验收写回）
        plan = {"name": "x", "steps": [{"step_id": "s1", "subject": "a", "instructions": "x",
                                        "role": "researcher", "assignee": "alice",
                                        "deliverables": [{"id": "d1", "path": "r.md"}],
                                        "acceptance": [{"check": "exists", "path": "r.md"}]}]}
        _with_scope("S1", H["spawn_teammate"], "alice", "researcher", "go")
        r = json.loads(_with_scope("S1", H["group_plan"], plan))
        dag_id = r["dag_id"]
        _with_scope("S1", H["group_plan_start"], dag_id)
        _wait(lambda: any(s["status"] == D.STEP_IN_PROGRESS for s in D.read_dag(sc.dags_dir, dag_id)["steps"].values()))
        runner.shutdown_bot("S1", "alice")  # 不再让 Bot 推进，只留 verifying 状态
        _wait(lambda: not runner.is_alive("S1", "alice"))
        dag = D.read_dag(sc.dags_dir, dag_id)
        st = dag["steps"]["s1"]
        tid = st["task_id"]
        sc.tasks.update_raw(tid, status="verifying")
        def _to_verifying(d):
            d["steps"]["s1"]["status"] = D.STEP_VERIFYING
        D.update_dag(sc.dags_dir, dag_id, _to_verifying)
        # 验收时 DAG 已被暂停 → 写回必须丢弃
        sched.pause_scope("S1", dag_ids=[dag_id])
        out_dir = Path(dag["output_dir"])
        sched._verify_task("S1", dag_id, "s1", out_dir)
        d2 = D.read_dag(sc.dags_dir, dag_id)
        assert d2["status"] == D.DAG_PAUSED
        assert d2["steps"]["s1"]["status"] == D.STEP_READY
        assert sc.tasks.get_raw(tid)["status"] == "verifying"  # 过期结果未写回（非 completed/failed）
        assert not any(m["type"] == "fix_required" for m in sc.bus.read_inbox("alice"))  # 过期打回未发送

    @pytest.mark.xfail(reason=(
        "重启后 Bot 拿不到任务上下文：旧 Bot 退出时已把 assignment 读走（read_inbox 读清空），"
        "复活的新 Bot 读不到任何 assignment——需在恢复时把 assignment 持久化到 task 记录并在"
        "复活后重投递（已部分实现：recover_scope 会重投递，但 task 状态与 Bot 上下文的重建"
        "仍不完整）。ADR-0059 §11e 后续项：Bot 的工作上下文需跨重启可恢复。"
    ), strict=False)
    def test_restart_recovery_revives_bot(self, tmp_path):
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        prov.set("alice", [_text("working...")] * 100)
        _with_scope("S1", H["spawn_teammate"], "alice", "researcher", "go")
        r = json.loads(_with_scope("S1", H["group_plan"], TWO_STEP))
        _with_scope("S1", H["group_plan_start"], r["dag_id"])
        sc = hub.scope("S1")
        _wait(lambda: any(s["status"] == D.STEP_IN_PROGRESS for s in D.read_dag(sc.dags_dir, r["dag_id"])["steps"].values()))
        # 模拟进程重启：停调度器、等 Bot 线程真正退出、清租约、丢弃 hub 内存态（磁盘保留）
        sched.stop()
        runner.shutdown_bot("S1", "alice")
        _wait(lambda: not runner.is_alive("S1", "alice"), msg="old bot thread gone")
        hub.registry.release_all_leases()
        # 新进程：新 hub 读同一目录；首个 scope 建立时恢复
        hub2 = TeamHub(tmp_path / "kb" / ".planify" / "team", RoleLibrary())
        from planify.team.runner import BotRunner
        prov2 = FakeProvider()
        prov2.set("alice", [_write("r.md", "# r\n## 摘要\nx\n## 来源\ny\n"), _complete(), _idle(),
                            _write("s.md", "# s\n"), _complete(), _idle()])
        runner2 = BotRunner(hub2, prov2, wd, runner.all_tool_defs, runner.all_tool_handlers, poll_interval=0.01, idle_timeout=30)
        hub2.attach_runner(runner2)
        sched2 = Scheduler(hub2, spawner=lambda s, n, p: runner2.start(s, n, p), thread_alive=runner2.is_alive, poll_interval=0.05)
        hub2.attach_scheduler(sched2)
        hub2.scope("S1")  # 触发 recover_scope
        d = D.read_dag(hub2.scope("S1").dags_dir, r["dag_id"])
        assert all(s["status"] in (D.STEP_READY, D.STEP_PENDING) for s in d["steps"].values())
        # 重新租 alice（重启后租约已清，需 lead 或恢复逻辑重新 spawn——spike 由派单复活；但复活前须有租约）
        hub2.registry.spawn("alice", "researcher", "S1")
        _wait(lambda: D.read_dag(hub2.scope("S1").dags_dir, r["dag_id"])["status"] == D.DAG_DONE, timeout=8, msg="recovered dag done")


class TestShutdownTeam:
    def test_shutdown_stops_scheduler_and_clears_hub(self, tmp_path):
        """shutdown_team（ADR-0060 §6）：Scheduler 停、Bot 线程退、hub 清空；
        bootstrap_team 替换前自动调用。"""
        from planify.team import get_hub, shutdown_team
        hub, runner, sched, H, prov, wd = _build(tmp_path)
        _with_scope("S1", H["spawn_teammate"], "alice", "researcher", "go")
        prov.set("alice", [_text("thinking...")] * 50)
        hub.scope("S1")
        sched.ensure_started()
        assert sched._thread is not None and sched._thread.is_alive()
        shutdown_team(timeout=3.0, hub=hub)
        _wait(lambda: not sched._thread.is_alive(), msg="scheduler stopped")
        assert not runner.is_alive("S1", "alice")
        assert get_hub() is None
        # 再次调用幂等（hub 已 None）
        shutdown_team()

    def test_bootstrap_replaces_old_hub(self, tmp_path):
        from planify.team import bootstrap_team, get_hub
        hub1 = bootstrap_team(tmp_path, FakeProvider(), [], {}, lang="zh", poll_interval=0.05)
        hub1.scope("S1")
        assert get_hub() is hub1
        sched1 = hub1.scheduler
        sched1.ensure_started()
        hub2 = bootstrap_team(tmp_path, FakeProvider(), [], {}, lang="zh", poll_interval=0.05)
        assert get_hub() is hub2 and hub2 is not hub1
        _wait(lambda: sched1._thread is None or not sched1._thread.is_alive(), msg="old scheduler stopped on re-bootstrap")
        from planify.team import shutdown_team
        shutdown_team()


# ====================================================================== contextvar 穿透

class TestContextvar:
    def test_bot_thread_sees_scope(self, tmp_path):
        from planify.skills.access_state import get_current_session_id
        seen = {}
        prov = FakeProvider()
        def _capture(messages):
            seen["sid"] = get_current_session_id()
            return _idle()
        prov.set("alice", [_capture])
        hub, runner, sched, H, prov2, wd = _build(tmp_path, prov)
        _with_scope("S7", H["spawn_teammate"], "alice", "researcher", "hello")
        _wait(lambda: "sid" in seen, msg="bot captured scope")
        assert seen["sid"] == "S7"
