"""验收闸门的竞争条件（真机验证发现）：DAG stalled 后其他分支的验收不应被丢弃。

场景（截图复现）：releases 步骤验收超限 → DAG stalled；ecosystem 步骤的验收
线程稍后完成。旧代码 `_current()` 要求 DAG_ACTIVE → 丢弃结果 → ecosystem 永远
verifying，页面显示「进行中」而 Bot 已空闲。

正确：stalled = 某分支失败，其他分支验收照常标 done/failed，只是不再推进下游。
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from planify.team import dag as D
from planify.team.hub import TeamHub
from planify.team.roles import RoleLibrary
from planify.team.scheduler import Scheduler


def _hub(tmp_path):
    hub = TeamHub(tmp_path / "team", RoleLibrary())
    hub.registry.spawn("kit", "researcher", "S1")
    hub.registry.spawn("remy", "researcher", "S1")
    return hub


def _seed_dag(hub, tmp_path):
    """两步无依赖的 DAG；两步都建好 task，step 均 verifying。"""
    sc = hub.scope("S1")
    plan = {"name": "p", "steps": [
        {"step_id": "releases", "subject": "a", "instructions": "x", "role": "researcher",
         "assignee": "remy", "acceptance": [{"check": "sections", "path": "a.md", "names": ["摘要"]}], "max_fix_rounds": 0},
        {"step_id": "ecosystem", "subject": "b", "instructions": "y", "role": "researcher",
         "assignee": "kit", "acceptance": [{"check": "exists", "path": "b.md"}]},
    ]}
    dag = D.new_dag("S1", 1, plan, tmp_path / "out")
    dag["status"] = D.DAG_ACTIVE
    for sid, assignee in (("releases", "remy"), ("ecosystem", "kit")):
        t = json.loads(sc.tasks.create(sid, "x"))
        t.update({"dag_id": 1, "step_id": sid, "assignee": assignee, "status": "verifying",
                  "acceptance": plan["steps"][0 if sid == "releases" else 1]["acceptance"],
                  "max_fix_rounds": plan["steps"][0 if sid == "releases" else 1].get("max_fix_rounds", 1),
                  "fix_rounds": 0, "output_dir": str(tmp_path / "out")})
        sc.tasks.save_raw(t)
        dag["steps"][sid] = {"task_id": t["id"], "status": D.STEP_VERIFYING, "fix_rounds": 0}
    D.write_dag(sc.dags_dir, dag)
    (tmp_path / "out").mkdir(exist_ok=True)
    (tmp_path / "out" / "b.md").write_text("# b\n", encoding="utf-8")
    (tmp_path / "out" / "a.md").write_text("# a\n", encoding="utf-8")  # 缺「摘要」→ releases 会失败
    return sc, dag


class TestStalledAcceptance:
    def test_other_branch_acceptance_not_dropped_when_stalled(self, tmp_path):
        """releases 失败使 DAG stalled 后，ecosystem 的验收仍应标 done（不被丢弃）。"""
        hub = _hub(tmp_path)
        sc, dag = _seed_dag(hub, tmp_path)
        sched = Scheduler(hub, spawner=lambda *a: None, thread_alive=lambda *a: False, poll_interval=0.01)
        hub.attach_scheduler(sched)

        # 1. releases 验收失败 → step failed（max_fix_rounds=0 → 立即超限）
        sched._verify_task("S1", 1, "releases", Path(dag["output_dir"]))
        time.sleep(0.05)
        # 2. 调度器推进：releases failed → DAG stalled
        sched._advance_dag(sc, D.read_dag(sc.dags_dir, 1))
        assert D.read_dag(sc.dags_dir, 1)["status"] == D.DAG_STALLED

        # 3. ecosystem 验收完成（b.md 存在）——**必须**标 done，即使 DAG 已 stalled
        sched._verify_task("S1", 1, "ecosystem", Path(dag["output_dir"]))
        time.sleep(0.05)
        d = D.read_dag(sc.dags_dir, 1)
        assert d["steps"]["ecosystem"]["status"] == D.STEP_DONE, (
            f"ecosystem 验收被丢弃（stalled 闸门过严）: {d['steps']['ecosystem']['status']}"
        )
        task2 = [t for t in sc.tasks.list_all_raw() if t["step_id"] == "ecosystem"][0]
        assert task2["status"] == "completed"

    def test_paused_dag_drops_acceptance(self, tmp_path):
        """对照：DAG paused 时验收结果**必须**丢弃。"""
        hub = _hub(tmp_path)
        sc, dag = _seed_dag(hub, tmp_path)
        sched = Scheduler(hub, spawner=lambda *a: None, thread_alive=lambda *a: False, poll_interval=0.01)
        hub.attach_scheduler(sched)
        d = D.read_dag(sc.dags_dir, 1)
        d["status"] = D.DAG_PAUSED
        D.write_dag(sc.dags_dir, d)
        sched._verify_task("S1", 1, "ecosystem", Path(dag["output_dir"]))
        time.sleep(0.05)
        d = D.read_dag(sc.dags_dir, 1)
        assert d["steps"]["ecosystem"]["status"] == D.STEP_VERIFYING  # 没变
