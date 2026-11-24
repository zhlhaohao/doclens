"""调度器（ADR-0059 §2/§5/§6/§11d/§11e，spike 版）。

进程单例常驻 daemon。惰性启动（首个 scope 建团队时；或启动恢复发现 active DAG）。
``Event.wait(timeout)`` 轮询兜底 + ``wake()`` 即时唤醒。每轮扫全部 scope 各推各的
DAG：

  ready     → 派单：写 Bot 收件箱 assignment + 确保目标 Bot 线程活着（shutdown 态
              由 spawner 复活，prompt 传占位）；task → in_progress
  verifying → 提交线程池跑验收（主循环不等）；done / failed（fix_rounds 超限）
  done      → 下游依赖清空者 pending → ready（拓扑推进）
  failed    → DAG stalled，写 lead 收件箱 dag_stalled；下游链停，其他分支继续

退出条件：全部 scope 无 ready|in_progress|verifying 任务且无活 Bot。stalled /
paused 的 pending 不计（等人不等调度器）。

异常隔离：单 scope 扫描抛错只记日志，不崩线程（否则全进程 DAG 停摆）。
"""

from __future__ import annotations

import json
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from ..skills.access_state import set_current_session_id
from . import dag as D
from .acceptance import run_acceptance

logger = logging.getLogger("planify.team.scheduler")


class Scheduler:
    def __init__(
        self,
        hub,
        spawner: Callable[[str, str, str], Any],
        thread_alive: Callable[[str, str], bool],
        poll_interval: float = 2.0,
        max_llm_calls_per_dag: int = 500,
    ):
        """
        hub:          TeamHub（取 scopes / registry）
        spawner:      (scope, bot_name, placeholder_prompt) → 复活/起线程
        thread_alive: (scope, bot_name) → 该 scope 下该 Bot 线程是否活着
        """
        self.hub = hub
        self.spawner = spawner
        self.thread_alive = thread_alive
        self.poll_interval = poll_interval
        self.max_llm_calls = max_llm_calls_per_dag
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="dag-verify")
        self._lock = threading.RLock()
        self._pending_verifies: set = set()  # (scope, dag_id, step_id) in flight

    # ------------------------------------------------------------ 生命周期

    def ensure_started(self) -> None:
        with self._lock:
            if self._thread is None or not self._thread.is_alive():
                self._stop.clear()
                self._thread = threading.Thread(target=self._loop, name="dag-scheduler", daemon=True)
                self._thread.start()
                logger.info("[scheduler] started")

    def wake(self) -> None:
        self._wake.set()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()

    def on_scope_dropped(self, scope_id: str) -> None:
        """会话删除：由 hub 调用，唤醒以重算退出条件。"""
        self.wake()

    # ------------------------------------------------------------ 主循环

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._tick()
            except Exception:  # noqa: BLE001
                logger.exception("[scheduler] tick failed (isolated)")
            if self._should_exit():
                logger.info("[scheduler] idle, exiting")
                with self._lock:
                    self._thread = None
                return
            self._wake.wait(timeout=self.poll_interval)
            self._wake.clear()

    def _should_exit(self) -> bool:
        for sc in self.hub.all_scopes():
            for t in sc.tasks.list_all_raw():
                if t.get("status") in (D.STEP_READY, D.STEP_IN_PROGRESS, D.STEP_VERIFYING):
                    return False
            for bot in self.hub.registry.leased_by_scope(sc.scope_id):
                if self.thread_alive(sc.scope_id, bot["name"]):
                    return False
        return True

    def _tick(self) -> None:
        for sc in self.hub.all_scopes():
            try:
                self._tick_scope(sc)
            except Exception:  # noqa: BLE001
                logger.exception("[scheduler] scope %s tick failed", sc.scope_id)
        with self._lock:
            if self._pending_verifies:
                self.wake()

    # ------------------------------------------------------------ 单 scope

    def _tick_scope(self, sc) -> None:
        for dag_meta in D.read_all_dags(sc.dags_dir):
            if dag_meta["status"] != D.DAG_ACTIVE:
                continue
            self._advance_dag(sc, dag_meta)

    def _advance_dag(self, sc, dag: Dict[str, Any]) -> None:
        output_dir = Path(dag["output_dir"])
        plan_steps = {s["step_id"]: s for s in dag["plan"]["steps"]}
        dirty = False

        # 1. 拓扑：pending → ready
        for sid, st in dag["steps"].items():
            if st["status"] != D.STEP_PENDING:
                continue
            deps = plan_steps[sid].get("depends_on", []) or []
            if all(dag["steps"][d]["status"] == D.STEP_DONE for d in deps):
                st["status"] = D.STEP_READY
                dirty = True

        # 2. ready → 派单
        for sid, st in dag["steps"].items():
            if st["status"] != D.STEP_READY:
                continue
            step = plan_steps[sid]
            # 交付物被改检测：上游 deliverable 须仍存在且不早于上游 done
            broken = self._upstream_deliverables_intact(dag, plan_steps, sid, output_dir)
            if broken:
                self._stall(sc, dag, sid, "upstream_deliverable_changed", broken)
                return
            assignee = self._pick_assignee(sc, dag, step)
            if assignee is None:
                continue  # 无可用 Bot，等 lead spawn
            task = self._create_task(sc, dag, step, assignee)
            st["task_id"] = task["id"]
            st["status"] = D.STEP_IN_PROGRESS
            st["assignee"] = assignee
            self._dispatch(sc, assignee, task)
            dirty = True

        # 3. verifying → 线程池验收
        for sid, st in dag["steps"].items():
            if st["status"] != D.STEP_VERIFYING:
                continue
            key = (sc.scope_id, dag["id"], sid)
            with self._lock:
                if key in self._pending_verifies:
                    continue
                self._pending_verifies.add(key)
            self._pool.submit(self._verify_task, sc.scope_id, dag["id"], sid, output_dir)

        # 4. 失败 → stalled（由 _verify_task 置 failed 后此处转 stalled）
        for sid, st in dag["steps"].items():
            if st["status"] == D.STEP_FAILED:
                self._stall(sc, dag, sid, "step_failed", f"step '{sid}' exceeded max_fix_rounds")
                return

        # 5. 全部 done → DAG done
        if all(st["status"] == D.STEP_DONE for st in dag["steps"].values()):
            dag["status"] = D.DAG_DONE
            sc.bus.send("system", "lead", json.dumps({"type": "dag_done", "dag_id": dag["id"], "name": dag["name"]}), msg_type="dag_done")
            dirty = True

        if dirty:
            D.write_dag(sc.dags_dir, dag)

    # ------------------------------------------------------------ 动作

    def _upstream_deliverables_intact(self, dag, plan_steps, sid, output_dir) -> Optional[str]:
        for inp in plan_steps[sid].get("inputs", []) or []:
            up = inp["step"]
            for d in plan_steps[up].get("deliverables", []) or []:
                if d.get("id") != inp.get("deliverable_id"):
                    continue
                p = output_dir / d["path"]
                if not p.exists():
                    return f"deliverable '{d['path']}' of step '{up}' no longer exists"
                # 上游 done 时快照的 mtime（_verify_task 记录）；派下游前比对——
                # 不能拿 done_at 比：文件写入时刻必然早于验收通过时刻，恒误判
                snap = dag["steps"][up].get("deliverable_mtimes", {}).get(d["path"])
                if snap is not None and abs(p.stat().st_mtime - snap) > 1e-6:
                    return f"deliverable '{d['path']}' of step '{up}' was modified after it completed"
        return None

    def _pick_assignee(self, sc, dag, step) -> Optional[str]:
        wanted = step.get("assignee")
        for bot in self.hub.registry.leased_by_scope(sc.scope_id):
            if bot["role"] != step["role"]:
                continue
            if wanted and bot["name"] != wanted:
                continue
            # 同一 Bot 同时只做一个任务
            busy = any(
                st.get("assignee") == bot["name"] and st["status"] in (D.STEP_IN_PROGRESS, D.STEP_VERIFYING)
                for d in D.read_all_dags(sc.dags_dir) if d["status"] == D.DAG_ACTIVE
                for st in d["steps"].values()
            )
            if not busy:
                return bot["name"]
        return None

    def _create_task(self, sc, dag, step, assignee: str) -> Dict[str, Any]:
        raw = sc.tasks.create(step["subject"], step["instructions"])
        t = json.loads(raw)
        t.update({
            "scope": sc.scope_id,
            "dag_id": dag["id"],
            "step_id": step["step_id"],
            "assignee": assignee,
            "role": step["role"],
            "instructions": step["instructions"],  # description 的别名，派单消息用
            "deliverables": step.get("deliverables", []),
            "acceptance": step.get("acceptance", []),
            "max_fix_rounds": int(step.get("max_fix_rounds", 1)),
            "fix_rounds": 0,
            "status": "in_progress",
            "output_dir": dag["output_dir"],
        })
        sc.tasks._save(t)
        return t

    def _dispatch(self, sc, bot_name: str, task: Dict[str, Any]) -> None:
        """派单 = 写收件箱 + 确保线程活着。"""
        sc.bus.send("system", bot_name, json.dumps({
            "type": "assignment",
            "task_id": task["id"],
            "step_id": task["step_id"],
            "dag_id": task["dag_id"],
            "subject": task["subject"],
            "instructions": task["instructions"],
            "deliverables": task["deliverables"],
            "acceptance": task["acceptance"],
            "output_dir": task["output_dir"],
        }, ensure_ascii=False), msg_type="assignment")
        if not self.thread_alive(sc.scope_id, bot_name):
            self.spawner(sc.scope_id, bot_name, "You have a new assignment; check your inbox.")
            logger.info("[scheduler] revived bot %s for scope %s", bot_name, sc.scope_id)

    # ------------------------------------------------------------ 验收

    @staticmethod
    def _deliverable_paths(task: Dict[str, Any]) -> List[str]:
        return [d["path"] for d in task.get("deliverables", []) or [] if d.get("path")]

    def _verify_task(self, scope_id: str, dag_id: int, sid: str, output_dir: Path) -> None:
        key = (scope_id, scope_id and dag_id, sid)
        try:
            sc = self.hub.try_scope(scope_id)
            if sc is None:
                return
            set_current_session_id(scope_id)  # shell 登记可寻址（tests_pass）
            dag = D.read_dag(sc.dags_dir, dag_id)
            if not dag:
                return
            st = dag["steps"].get(sid)
            if not st or st.get("task_id") is None:
                return
            task = json.loads(sc.tasks.get(st["task_id"]))
            ok, failures, manuals = run_acceptance(Path(output_dir), task.get("acceptance", []))
            if ok:
                st["status"] = D.STEP_DONE
                st["done_at"] = time.time()
                # 交付物 mtime 快照：供下游派单前的「被并行步骤覆盖」检测比对
                snap = {p: (output_dir / p).stat().st_mtime for p in self._deliverable_paths(task) if (output_dir / p).exists()}
                st["deliverable_mtimes"] = snap
                task["status"] = "completed"
                task["manual_items"] = manuals
                sc.tasks._save(task)
                sc.bus.send("system", "lead", json.dumps({"type": "step_done", "dag_id": dag_id, "step_id": sid}), msg_type="step_done")
            else:
                task["fix_rounds"] = int(task.get("fix_rounds", 0)) + 1
                if task["fix_rounds"] > int(task.get("max_fix_rounds", 1)):
                    st["status"] = D.STEP_FAILED
                    task["status"] = "failed"
                    sc.tasks._save(task)
                else:
                    # 打回：task 回 in_progress，Bot 收件箱收到未达标项
                    task["status"] = "in_progress"
                    sc.tasks._save(task)
                    sc.bus.send("system", task["assignee"], json.dumps({
                        "type": "fix_required", "task_id": task["id"], "failures": failures,
                    }, ensure_ascii=False), msg_type="fix_required")
            D.write_dag(sc.dags_dir, dag)
        except Exception:  # noqa: BLE001
            logger.exception("[scheduler] verify failed dag=%s step=%s", dag_id, sid)
        finally:
            with self._lock:
                self._pending_verifies.discard((scope_id, dag_id, sid))
            self.wake()

    # ------------------------------------------------------------ 停滞/暂停/恢复

    def _stall(self, sc, dag: Dict[str, Any], step_id: Optional[str], reason: str, detail: str) -> None:
        dag["status"] = D.DAG_STALLED
        dag["stall_reason"] = reason
        dag["failed_step"] = step_id
        D.write_dag(sc.dags_dir, dag)
        sc.bus.send("system", "lead", json.dumps({
            "type": "dag_stalled", "dag_id": dag["id"], "failed_step": step_id,
            "reason": reason, "detail": detail,
        }, ensure_ascii=False), msg_type="dag_stalled")

    def pause_scope(self, scope_id: str) -> int:
        """停止 = 停全部：scope 内全部 active DAG → paused，在跑任务 → ready。"""
        sc = self.hub.try_scope(scope_id)
        if sc is None:
            return 0
        n = 0
        for dag in D.read_all_dags(sc.dags_dir):
            if dag["status"] != D.DAG_ACTIVE:
                continue
            dag["status"] = D.DAG_PAUSED
            for st in dag["steps"].values():
                if st["status"] in (D.STEP_IN_PROGRESS, D.STEP_VERIFYING):
                    st["status"] = D.STEP_READY
                    st["interrupted"] = True
            D.write_dag(sc.dags_dir, dag)
            n += 1
        for bot in self.hub.registry.leased_by_scope(scope_id):
            sc.bus.send("system", bot["name"], "", msg_type="shutdown_request")
        self.wake()
        return n

    def resume_dag(self, scope_id: str, dag_id: int) -> bool:
        sc = self.hub.try_scope(scope_id)
        if sc is None:
            return False
        dag = D.read_dag(sc.dags_dir, dag_id)
        if not dag or dag["status"] != D.DAG_PAUSED:
            return False
        dag["status"] = D.DAG_ACTIVE
        D.write_dag(sc.dags_dir, dag)
        self.ensure_started()
        self.wake()
        return True

    def cancel_dag(self, scope_id: str, dag_id: int) -> bool:
        sc = self.hub.try_scope(scope_id)
        if sc is None:
            return False
        dag = D.read_dag(sc.dags_dir, dag_id)
        if not dag or dag["status"] in (D.DAG_DONE, D.DAG_CANCELLED):
            return False
        dag["status"] = D.DAG_CANCELLED
        for st in dag["steps"].values():
            if st["status"] in ACTIVE_STEP_STATES:
                st["status"] = D.STEP_SUPERSEDED
        D.write_dag(sc.dags_dir, dag)
        self.wake()
        return True

    # ------------------------------------------------------------ 重启恢复

    def recover_scope(self, scope_id: str) -> int:
        """scope 首次建立时调用：该 scope 的 active DAG 中 in_progress/verifying → ready。

        进程重启后 Bot 线程全灭，这些任务无人持有；回 ready 由调度器重派（派单时
        目标 Bot 为 shutdown 态会自动复活）。返回恢复的 active DAG 数。
        """
        sc = self.hub.try_scope(scope_id)
        if sc is None:
            return 0
        n = 0
        for dag in D.read_all_dags(sc.dags_dir):
            if dag["status"] not in (D.DAG_ACTIVE, D.DAG_PAUSED):
                continue
            changed = False
            for st in dag["steps"].values():
                if st["status"] in (D.STEP_IN_PROGRESS, D.STEP_VERIFYING):
                    st["status"] = D.STEP_READY
                    changed = True
            if changed:
                D.write_dag(sc.dags_dir, dag)
            if dag["status"] == D.DAG_ACTIVE:
                n += 1
        if n:
            self.wake()
        return n

    def recover_on_startup(self) -> int:
        """启动时：active DAG 的 in_progress/verifying → ready；有 active DAG 则起线程。"""
        n = 0
        for sc in self.hub.all_scopes():
            for dag in D.read_all_dags(sc.dags_dir):
                if dag["status"] not in (D.DAG_ACTIVE, D.DAG_PAUSED):
                    continue
                changed = False
                for st in dag["steps"].values():
                    if st["status"] in (D.STEP_IN_PROGRESS, D.STEP_VERIFYING):
                        st["status"] = D.STEP_READY
                        changed = True
                if changed:
                    D.write_dag(sc.dags_dir, dag)
                if dag["status"] == D.DAG_ACTIVE:
                    n += 1
        if n:
            self.ensure_started()
            self.wake()
        return n
