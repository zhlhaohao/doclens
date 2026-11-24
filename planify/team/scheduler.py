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
        # 预算（ADR-0059 §12）：per (scope, dag) LLM 调用计数，内存态
        self._budget_lock = threading.Lock()
        self._llm_calls: Dict[tuple, int] = {}

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

    def _advance_dag(self, sc, dag_meta: Dict[str, Any]) -> None:
        """推进一个 active DAG。**全部 DAG 变更在 update_dag 的 mutator 内做**——
        调度器主循环 / 验收线程池 / Bot 线程并发写同一个 DAG，各自 read→改→write 会
        丢失更新（表现为「step 卡在 in_progress」「DAG 状态不更新」）。"""
        dag_id = dag_meta["id"]
        output_dir = Path(dag_meta["output_dir"])
        plan_steps = {s["step_id"]: s for s in dag_meta["plan"]["steps"]}
        to_verify: List[str] = []

        def _mut(dag: Dict[str, Any]) -> Dict[str, Any]:
            nonlocal to_verify
            steps = dag["steps"]
            # 1. 拓扑：pending → ready
            for sid, st in steps.items():
                if st["status"] != D.STEP_PENDING:
                    continue
                deps = plan_steps[sid].get("depends_on", []) or []
                if all(steps.get(d, {}).get("status") == D.STEP_DONE for d in deps):
                    st["status"] = D.STEP_READY
            # 2. ready → 派单
            for sid, st in list(steps.items()):
                if st["status"] != D.STEP_READY:
                    continue
                if st.get("task_id") is not None:
                    # 已有 task（派过单）——不重复建；step 回到 ready 是重派场景，
                    # 复用原 task 记录（更新 assignee 即可）
                    existing = sc.tasks.get_raw(st["task_id"])
                    if existing is not None:
                        st["status"] = D.STEP_IN_PROGRESS
                        self._dispatch(sc, existing.get("assignee") or "", existing)
                        continue
                step = plan_steps[sid]
                broken = self._upstream_deliverables_intact(dag, plan_steps, sid, output_dir)
                if broken:
                    self._stall(sc, dag, sid, "upstream_deliverable_changed", broken)
                    return dag
                assignee = self._pick_assignee(sc, dag, step)
                if assignee is None:
                    continue  # 无可用 Bot，等 lead spawn
                task = self._create_task(sc, dag, step, assignee)
                st["task_id"] = task["id"]
                st["status"] = D.STEP_IN_PROGRESS
                st["assignee"] = assignee
                self._dispatch(sc, assignee, task)
            # 3. verifying → 线程池验收（收集，mutator 外提交——线程池在锁内提交会死锁）
            for sid, st in steps.items():
                if st["status"] == D.STEP_VERIFYING:
                    to_verify.append(sid)
            # 4. 失败 → stalled
            for sid, st in steps.items():
                if st["status"] == D.STEP_FAILED:
                    self._stall(sc, dag, sid, "step_failed", f"step '{sid}' exceeded max_fix_rounds")
                    return dag
            # 5. 全部 done → DAG done
            if steps and all(st["status"] == D.STEP_DONE for st in steps.values()):
                dag["status"] = D.DAG_DONE
                sc.bus.send("system", "lead", json.dumps({"type": "dag_done", "dag_id": dag_id, "name": dag["name"]}), msg_type="dag_done")
            return dag

        updated = D.update_dag(sc.dags_dir, dag_id, _mut)
        if updated is None:
            return
        # 提交验收（锁外）
        for sid in to_verify:
            key = (sc.scope_id, dag_id, sid)
            with self._lock:
                if key in self._pending_verifies:
                    continue
                self._pending_verifies.add(key)
            self._pool.submit(self._verify_task, sc.scope_id, dag_id, sid, output_dir)

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
        """派单 = 写收件箱 + 确保线程活着。

        **顺序：先写消息再确保线程**——新线程起来后读收件箱能读到已存在的 assignment；
        反过来（先起线程再写）会让新线程的第一轮读空收件箱，白耗一轮模型调用，
        还会让脚本/上下文错位。
        """
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
            # 复活：实体已在（租约在），只起线程——不重 spawn（避免覆盖租约/记忆）
            self.spawner(sc.scope_id, bot_name, "You have a new assignment; check your inbox.")
            logger.info("[scheduler] revived bot %s for scope %s", bot_name, sc.scope_id)
        logger.info("[scheduler] dispatched task #%s step=%s to %s", task["id"], task["step_id"], bot_name)

    # ------------------------------------------------------------ 预算

    def bump_llm_calls(self, scope_id: str, dag_id: int) -> Optional[int]:
        """Bot 每次 LLM 调用后递增 DAG 计数。超过 max_llm_calls 时把 DAG 转 stalled 并
        返回当前计数（调用方据此通知 Bot 停下）；未超返回 None。内存计数，不落盘。"""
        with self._budget_lock:
            n = self._llm_calls.get((scope_id, dag_id), 0) + 1
            self._llm_calls[(scope_id, dag_id)] = n
        if n > self.max_llm_calls:
            sc = self.hub.try_scope(scope_id)
            if sc is not None:
                dag = D.read_dag(sc.dags_dir, dag_id)
                if dag and dag["status"] == D.DAG_ACTIVE:
                    # 预算超限 = 刹车不是失败：转 paused（可直接 group_plan_resume 续跑，
                    # resume 重置预算），failed_step 留空，在跑步骤回 ready
                    dag["status"] = D.DAG_PAUSED
                    dag["stall_reason"] = "llm_budget_exceeded"
                    dag["failed_step"] = None
                    for st in dag["steps"].values():
                        if st["status"] in (D.STEP_IN_PROGRESS, D.STEP_VERIFYING):
                            st["status"] = D.STEP_READY  # 可 retry/replan 续跑
                    dag["llm_calls"] = n
                    D.write_dag(sc.dags_dir, dag)
                    sc.bus.send("system", "lead", json.dumps({
                        "type": "dag_stalled", "dag_id": dag_id, "failed_step": None,
                        "reason": "llm_budget_exceeded",
                        "detail": f"DAG used {n} LLM calls (limit {self.max_llm_calls}); replan or retry to continue",
                    }), msg_type="dag_stalled")
                    # 在跑 Bot 停下
                    for bot in self.hub.registry.leased_by_scope(scope_id):
                        if self.thread_alive(scope_id, bot["name"]):
                            sc.bus.send("system", bot["name"], "", msg_type="shutdown_request")
            return n
        return None

    def reset_budget(self, scope_id: str, dag_id: int) -> None:
        """retry / replan 续跑时重置计数（否则一续跑立刻又超限）。"""
        with self._budget_lock:
            self._llm_calls.pop((scope_id, dag_id), None)

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
                snap = {p: (output_dir / p).stat().st_mtime for p in self._deliverable_paths(task) if (output_dir / p).exists()}
                def _mut_ok(d):
                    s = d["steps"].get(sid)
                    if s:
                        s["status"] = D.STEP_DONE
                        s["done_at"] = time.time()
                        # 交付物 mtime 快照：供下游派单前的「被并行步骤覆盖」检测比对
                        s["deliverable_mtimes"] = snap
                D.update_dag(sc.dags_dir, dag_id, _mut_ok)
                sc.tasks.update_raw(task["id"], status="completed", manual_items=manuals)
                sc.bus.send("system", "lead", json.dumps({"type": "step_done", "dag_id": dag_id, "step_id": sid}), msg_type="step_done")
            else:
                cur = sc.tasks.get_raw(task["id"]) or task
                rounds = int(cur.get("fix_rounds", 0)) + 1
                if rounds > int(cur.get("max_fix_rounds", 1)):
                    def _mut_fail(d):
                        s = d["steps"].get(sid)
                        if s:
                            s["status"] = D.STEP_FAILED
                    D.update_dag(sc.dags_dir, dag_id, _mut_fail)
                    sc.tasks.update_raw(task["id"], status="failed", fix_rounds=rounds)
                else:
                    # 打回：task 与 step 都回 in_progress（Bot 继续修），并把未达标项发回给 Bot
                    def _mut_back(d):
                        s = d["steps"].get(sid)
                        if s and s.get("status") == D.STEP_VERIFYING:
                            s["status"] = D.STEP_IN_PROGRESS
                    D.update_dag(sc.dags_dir, dag_id, _mut_back)
                    sc.tasks.update_raw(task["id"], status="in_progress", fix_rounds=rounds)
                    sc.bus.send("system", task["assignee"], json.dumps({
                        "type": "fix_required", "task_id": task["id"], "failures": failures,
                    }, ensure_ascii=False), msg_type="fix_required")
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
        dag["stall_reason"] = None
        D.write_dag(sc.dags_dir, dag)
        self.reset_budget(scope_id, dag_id)  # 续跑给新一轮预算
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
        目标 Bot 为 shutdown 态会自动复活）。**先重新上租约**——重启清了租约，
        不恢复的话调度器找不到可复活的 Bot（§11e）。
        返回恢复的 active DAG 数。
        """
        sc = self.hub.try_scope(scope_id)
        if sc is None:
            return 0
        self.hub.registry.reclaim_for_scope(scope_id)
        n = 0
        for dag in D.read_all_dags(sc.dags_dir):
            if dag["status"] not in (D.DAG_ACTIVE, D.DAG_PAUSED):
                continue
            changed = False
            plan_steps = {s["step_id"]: s for s in dag["plan"]["steps"]}
            for sid, st in dag["steps"].items():
                if st["status"] in (D.STEP_IN_PROGRESS, D.STEP_VERIFYING):
                    st["status"] = D.STEP_READY
                    changed = True
                # **重投递 assignment**：旧 Bot 线程退出时已把 assignment 读走
                # （read_inbox 是读清空），新 Bot 复活后不知道任务是什么——任务信息
                # 在 DAG/task 里，不在收件箱。凡「已派单但未完成」的步骤都重发一条，
                # 等复活后的 Bot 读（否则它起来不知道干什么）。
                if st["status"] in (D.STEP_READY, D.STEP_IN_PROGRESS) and st.get("task_id"):
                    task = self._task_of_step(sc, dag, sid)
                    if task and task.get("status") not in ("completed", "failed"):
                        self._dispatch(sc, task.get("assignee") or "", task)
            if changed:
                D.write_dag(sc.dags_dir, dag)
            if dag["status"] == D.DAG_ACTIVE:
                n += 1
        if n:
            self.wake()
        return n

    @staticmethod
    def _task_of_step(sc, dag: Dict[str, Any], sid: str) -> Optional[Dict[str, Any]]:
        st = dag["steps"].get(sid) or {}
        tid = st.get("task_id")
        if tid is None:
            return None
        return sc.tasks.get_raw(tid)

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
