"""lead 的 DAG 工具面 + Bot 创建工具（ADR-0059 §8/§4/§11f，spike 版）。

全部 handler **运行期**经 ``get_current_session_id()`` 取 scope——不在装配期绑定
（旧 team_tools 装配期绑死一个 bus，是跨 scope 串线的根因）。

草稿态/确认：``group_plan`` 建 draft DAG 并写 ``pending_confirmation`` 到 scope
状态文件；``group_plan_start`` 把 draft → active、授予 output_dir 写授权、唤醒调度
器。对话式 ask 模式下 lead 下一轮靠 ``group_plan_status`` 读到 pending 提示，不靠
读对话历史推断。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from ..skills.access_state import get_current_session_id
from . import dag as D
from .dag import PlanIssue, merge_skill_contracts, validate_plan

logger = logging.getLogger("planify.team.plan_tools")


class PlanToolError(Exception):
    pass


MAX_REPLANS = 2  # ADR-0059 §5c：一个 DAG 全程最多重规划次数


def _deliverables_of(dag: dict, step_id: str) -> list:
    for s in dag["plan"]["steps"]:
        if s["step_id"] == step_id:
            return s.get("deliverables", [])
    return []


def _hub():
    from .hub import TeamHub  # noqa: F401
    raise NotImplementedError


def make_plan_tools(hub_getter: Callable[[], Any], workdir: Path) -> tuple:
    """返回 (tool_defs, handlers)。hub_getter 延迟取 TeamHub（避免装配期循环）。"""

    def _scope() -> str:
        sid = get_current_session_id()
        if not sid:
            raise PlanToolError("No active session; team tools are unavailable outside a chat session")
        return sid

    def _hub_():
        h = hub_getter()
        if h is None:
            raise PlanToolError("Team features are not enabled")
        return h

    def _card(dag: Dict[str, Any]) -> str:
        lines = [f"Plan #{dag['id']} '{dag['name']}' [{dag['status']}]  output: {dag['output_dir']}"]
        for s in dag["plan"]["steps"]:
            st = dag["steps"][s["step_id"]]
            deps = ",".join(s.get("depends_on", []) or []) or "-"
            a = s.get("assignee") or f"(open: {s['role']})"
            lines.append(f"  {s['step_id']} [{st['status']}] {s['subject']}  owner={a}  after={deps}")
        return "\n".join(lines)

    # -------------------------------------------------------------- Bot

    def spawn_teammate(name: str, role: str, prompt: str) -> str:
        try:
            sc_id = _scope()
            hub = _hub_()
            bot = hub.registry.spawn(name, role, sc_id)
            runner = hub.runner
            started = runner.start(sc_id, name, prompt)
            hub.scope(sc_id)
            return json.dumps({"ok": True, "bot": bot["name"], "role": bot["role"],
                               "thread": "started" if started else "already-running"})
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    def list_teammates() -> str:
        try:
            sc_id = _scope()
            hub = _hub_()
            bots = hub.registry.list_all()
            if not bots:
                return "No Bots."
            lines = []
            for b in bots:
                mine = b.get("leased_by") == sc_id
                lines.append(f"- {b['name']} ({b['role']}) status={b['status']} "
                             f"{'[this session]' if mine else '[leased by another session]' if b.get('leased_by') else '[free]'}")
            return "\n".join(lines)
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    def send_message(to: str, content: str) -> str:
        try:
            hub = _hub_()
            sc = hub.scope(_scope())
            return sc.bus.send("lead", to, content)
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    def read_inbox() -> str:
        try:
            hub = _hub_()
            sc = hub.scope(_scope())
            return json.dumps(sc.bus.read_inbox("lead"), ensure_ascii=False, indent=2)
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    def shutdown_teammate(name: str, delete: bool = False) -> str:
        try:
            sc_id = _scope()
            hub = _hub_()
            hub.runner.shutdown_bot(sc_id, name)
            if delete:
                ok = hub.registry.delete(name, sc_id)
                return f"Deleted Bot '{name}'" if ok else f"Error: cannot delete '{name}' (not held by this session)"
            hub.registry.release(name, sc_id)
            return f"Shutdown '{name}'"
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    # -------------------------------------------------------------- Plan

    def group_plan(plan: dict) -> str:
        try:
            sc_id = _scope()
            hub = _hub_()
            sc = hub.scope(sc_id)
            bots = hub.registry.leased_by_scope(sc_id)
            bot_roles = {b["name"]: b["role"] for b in bots}
            norm = validate_plan(plan, role_ids=hub.roles.ids(), bot_names=list(bot_roles), bot_roles=bot_roles)
            # skill 字段：须存在于 owner 角色 skills（ADR-0059 §5）
            for s in norm["steps"]:
                sk = s.get("skill")
                if sk and sk not in hub.roles.get(s["role"]).skills:
                    raise PlanIssue("skill_unknown", ["steps", s["step_id"], "skill"],
                                    f"Step {s['step_id']}: role '{s['role']}' has no skill '{sk}'",
                                    expected=", ".join(hub.roles.get(s["role"]).skills) or "(none)")
            # 契约合并（lead 显式写的优先，验收只能收紧）
            merged = merge_skill_contracts(norm["steps"], hub.roles.get)
            if merged:
                norm.setdefault("repairs", []).extend(merged)
            dag_id = D.next_dag_id(sc.dags_dir)
            slug = "".join(c if c.isalnum() or c in "-_" else "-" for c in norm["name"])[:40].strip("-") or "plan"
            out = Path(workdir) / "输出" / f"{dag_id}-{slug}"
            dag = D.new_dag(sc_id, dag_id, norm, out)
            D.write_dag(sc.dags_dir, dag)
            _set_pending(sc, dag_id, "confirm")
            return json.dumps({"ok": True, "dag_id": dag_id, "card": _card(dag),
                               "repairs": norm.get("repairs", []),
                               "next": "Show the card to the user; on approval call group_plan_start."}, ensure_ascii=False)
        except PlanIssue as e:
            return json.dumps({"ok": False, "issue": e.to_dict()}, ensure_ascii=False)
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    def group_plan_revise(dag_id: int, plan: dict) -> str:
        try:
            sc_id = _scope()
            hub = _hub_()
            sc = hub.scope(sc_id)
            dag = D.read_dag(sc.dags_dir, dag_id)
            if not dag:
                return f"Error: dag #{dag_id} not found"
            if dag["status"] != D.DAG_DRAFT:
                return f"Error: dag #{dag_id} is {dag['status']}, not draft; use group_plan_replan for active DAGs"
            bots = hub.registry.leased_by_scope(sc_id)
            bot_roles = {b["name"]: b["role"] for b in bots}
            norm = validate_plan(plan, role_ids=hub.roles.ids(), bot_names=list(bot_roles), bot_roles=bot_roles)
            for s in norm["steps"]:
                sk = s.get("skill")
                if sk and sk not in hub.roles.get(s["role"]).skills:
                    raise PlanIssue("skill_unknown", ["steps", s["step_id"], "skill"],
                                    f"Step {s['step_id']}: role '{s['role']}' has no skill '{sk}'")
            merge_skill_contracts(norm["steps"], hub.roles.get)
            dag["plan"] = norm
            dag["steps"] = {s["step_id"]: {"task_id": None, "status": D.STEP_PENDING, "fix_rounds": 0} for s in norm["steps"]}
            D.write_dag(sc.dags_dir, dag)
            return json.dumps({"ok": True, "dag_id": dag_id, "card": _card(dag)}, ensure_ascii=False)
        except PlanIssue as e:
            return json.dumps({"ok": False, "issue": e.to_dict()}, ensure_ascii=False)
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    def group_plan_start(dag_id: int) -> str:
        try:
            sc_id = _scope()
            hub = _hub_()
            sc = hub.scope(sc_id)
            dag = D.read_dag(sc.dags_dir, dag_id)
            if not dag:
                return f"Error: dag #{dag_id} not found"
            if dag["status"] != D.DAG_DRAFT:
                return f"Error: dag #{dag_id} is {dag['status']}, not draft"
            dag["status"] = D.DAG_ACTIVE
            D.write_dag(sc.dags_dir, dag)
            Path(dag["output_dir"]).mkdir(parents=True, exist_ok=True)
            # DAG 级写授权：用户确认计划卡即视为对 output_dir 的写授权（§11a）
            _grant_output_dir(sc_id, Path(dag["output_dir"]))
            _clear_pending(sc, dag_id)
            if hub.scheduler is not None:
                # start 既可能是新 DAG 也可能是 replan 后的续跑——统一重置预算
                hub.scheduler.reset_budget(sc_id, dag_id)
                hub.scheduler.ensure_started()
                hub.scheduler.wake()
            return json.dumps({"ok": True, "dag_id": dag_id, "status": "active"})
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    def group_plan_status(dag_id: Optional[int] = None) -> str:
        try:
            sc_id = _scope()
            hub = _hub_()
            sc = hub.scope(sc_id)
            pend = _read_pending(sc)
            hint = ""
            if pend and pend.get("kind") == "confirm":
                hint = (f"NOTE: DAG #{pend['dag_id']} is a draft awaiting user confirmation. "
                        f"The user's latest message may be approval or a change request. ")
            dags = [D.read_dag(sc.dags_dir, dag_id)] if dag_id else D.read_all_dags(sc.dags_dir)
            dags = [d for d in dags if d]
            if not dags:
                return hint + "No DAGs."
            return hint + "\n\n".join(_card(d) for d in dags)
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    def group_plan_cancel(dag_id: int) -> str:
        try:
            hub = _hub_()
            ok = hub.scheduler.cancel_dag(_scope(), dag_id)
            return json.dumps({"ok": ok, "dag_id": dag_id, "status": "cancelled" if ok else "not-cancellable"})
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    def group_plan_resume(dag_id: int) -> str:
        try:
            hub = _hub_()
            ok = hub.scheduler.resume_dag(_scope(), dag_id)
            return json.dumps({"ok": ok, "dag_id": dag_id, "status": "active" if ok else "not-paused"})
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    def group_plan_replan(dag_id: int, plan: dict) -> str:
        """stalled DAG 的重规划：新计划只含新增与未完成步骤；保留已 done 步骤；需用户再确认。

        规则（ADR-0059 §5c）：
        - 只对 stalled DAG
        - 新计划不得含已 done 的 step_id（发现了就拒绝）
        - 可依赖已 done 步骤（它们的 deliverables 还在 output_dir）
        - 被替换的 failed/pending/ready 步骤标 superseded
        - 结果为草稿态——用户确认后 group_plan_start
        - 全程最多 MAX_REPLANS 次
        """
        try:
            sc_id = _scope()
            hub = _hub_()
            sc = hub.scope(sc_id)
            dag = D.read_dag(sc.dags_dir, dag_id)
            if not dag:
                return f"Error: dag #{dag_id} not found"
            if dag["status"] != D.DAG_STALLED:
                return f"Error: dag #{dag_id} is {dag['status']}, not stalled; replan applies to stalled DAGs"
            if int(dag.get("replans", 0)) >= MAX_REPLANS:
                return f"Error: dag #{dag_id} already replanned {MAX_REPLANS} times; cancel and start a new DAG"
            done = {sid for sid, st in dag["steps"].items() if st["status"] == D.STEP_DONE}
            # 新计划步骤集
            new_steps = plan.get("steps") if isinstance(plan, dict) else None
            if not isinstance(new_steps, list) or not new_steps:
                raise PlanIssue("steps_empty", ["steps"], "Replan needs at least one step")
            new_ids = [s.get("step_id") or s.get("id") for s in new_steps if isinstance(s, dict)]
            dup_done = [i for i in new_ids if i in done]
            if dup_done:
                raise PlanIssue("replan_resubmits_done", ["steps"],
                                f"Completed steps cannot be resubmitted: {', '.join(map(str, dup_done))}; "
                                "keep only new or unfinished steps (they may depend on completed ones)")
            # 校验：把已 done 步骤当作「虚拟存在」的依赖目标注入校验上下文
            bots = hub.registry.leased_by_scope(sc_id)
            bot_roles = {b["name"]: b["role"] for b in bots}
            plan_ctx = {"name": plan.get("name") or dag["name"], "steps": list(new_steps)}
            for sid in done:
                plan_ctx["steps"].append({"step_id": sid, "subject": sid, "instructions": "(done)", "role": "default",
                                          "deliverables": _deliverables_of(dag, sid)})
            norm = validate_plan(plan_ctx, role_ids=hub.roles.ids(), bot_names=list(bot_roles), bot_roles=bot_roles)
            new_only = [s for s in norm["steps"] if s["step_id"] not in done]
            for s in new_only:
                sk = s.get("skill")
                if sk and sk not in hub.roles.get(s["role"]).skills:
                    raise PlanIssue("skill_unknown", ["steps", s["step_id"], "skill"],
                                    f"Step {s['step_id']}: role '{s['role']}' has no skill '{sk}'")
            merge_skill_contracts(new_only, hub.roles.get)
            # 应用替换
            for sid, st in dag["steps"].items():
                if st["status"] in (D.STEP_PENDING, D.STEP_READY, D.STEP_IN_PROGRESS, D.STEP_VERIFYING, D.STEP_FAILED, D.STEP_BLOCKED):
                    st["status"] = D.STEP_SUPERSEDED
            dag["plan"]["steps"] = [s for s in dag["plan"]["steps"] if dag["steps"].get(s["step_id"], {}).get("status") == D.STEP_DONE] + new_only
            for s in new_only:
                dag["steps"][s["step_id"]] = {"task_id": None, "status": D.STEP_PENDING, "fix_rounds": 0}
            dag["status"] = D.DAG_DRAFT
            dag["replans"] = int(dag.get("replans", 0)) + 1
            dag["stall_reason"] = None
            dag["failed_step"] = None
            D.write_dag(sc.dags_dir, dag)
            _set_pending(sc, dag_id, "confirm")
            return json.dumps({"ok": True, "dag_id": dag_id, "status": "draft", "card": _card(dag),
                               "next": "Show the card; on approval call group_plan_start."}, ensure_ascii=False)
        except PlanIssue as e:
            return json.dumps({"ok": False, "issue": e.to_dict()}, ensure_ascii=False)
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    def group_plan_retry(dag_id: int, step_id: str, reset_fix_rounds: bool = True) -> str:
        """failed 步骤原样重试（偶发失败）。DAG 回 active，步骤回 ready，fix_rounds 清零。"""
        try:
            sc_id = _scope()
            hub = _hub_()
            sc = hub.scope(sc_id)
            dag = D.read_dag(sc.dags_dir, dag_id)
            if not dag:
                return f"Error: dag #{dag_id} not found"
            if dag["status"] != D.DAG_STALLED:
                return f"Error: dag #{dag_id} is {dag['status']}, not stalled"
            st = dag["steps"].get(step_id)
            if not st or st["status"] != D.STEP_FAILED:
                return f"Error: step '{step_id}' is {st['status'] if st else 'unknown'}, not failed"
            if st.get("task_id") is not None:
                t = sc.tasks.get_raw(st["task_id"])
                if t:
                    if reset_fix_rounds:
                        t["fix_rounds"] = 0
                    t["status"] = "pending"
                    sc.tasks.save_raw(t)
            st["status"] = D.STEP_READY
            dag["status"] = D.DAG_ACTIVE
            dag["stall_reason"] = None
            dag["failed_step"] = None
            D.write_dag(sc.dags_dir, dag)
            if hub.scheduler is not None:
                hub.scheduler.reset_budget(sc_id, dag_id)
                hub.scheduler.ensure_started()
                hub.scheduler.wake()
            return json.dumps({"ok": True, "dag_id": dag_id, "step_id": step_id, "status": "active"})
        except Exception as e:  # noqa: BLE001
            return f"Error: {e}"

    # -------------------------------------------------------------- pending 状态

    def _pending_path(sc) -> Path:
        return sc.root / "pending.json"

    def _set_pending(sc, dag_id: int, kind: str) -> None:
        _pending_path(sc).write_text(json.dumps({"kind": kind, "dag_id": dag_id}), encoding="utf-8")

    def _read_pending(sc) -> Optional[dict]:
        p = _pending_path(sc)
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                return None
        return None

    def _clear_pending(sc, dag_id: int) -> None:
        pend = _read_pending(sc)
        if pend and pend.get("dag_id") == dag_id:
            _pending_path(sc).unlink(missing_ok=True)

    def _grant_output_dir(sc_id: str, out: Path) -> None:
        try:
            from ..tools.guard import record_grant
            record_grant(sc_id, [out], "write")
        except Exception:  # noqa: BLE001
            logger.warning("[plan-tools] record_grant failed (guard module unavailable?)", exc_info=True)

    # -------------------------------------------------------------- 定义

    defs = [
        {"name": "spawn_teammate",
         "description": "Create or revive a Bot with a built-in role. Identity comes from role; 'prompt' is the initial task only.",
         "input_schema": {"type": "object", "properties": {
             "name": {"type": "string"}, "role": {"type": "string", "description": "Built-in role id"},
             "prompt": {"type": "string"}}, "required": ["name", "role", "prompt"]}},
        {"name": "list_teammates", "description": "List all Bots with role, status and lease.",
         "input_schema": {"type": "object", "properties": {}}},
        {"name": "send_message", "description": "Send a message to a Bot.",
         "input_schema": {"type": "object", "properties": {"to": {"type": "string"}, "content": {"type": "string"}},
                          "required": ["to", "content"]}},
        {"name": "read_inbox", "description": "Read and clear lead's inbox (Bot reports, dag_stalled, dag_done).",
         "input_schema": {"type": "object", "properties": {}}},
        {"name": "shutdown_teammate",
         "description": "Stop a Bot's thread (lease released). delete=true removes the entity, memory and sessions.",
         "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "delete": {"type": "boolean"}},
                          "required": ["name"]}},
        {"name": "group_plan",
         "description": (
             "Submit a DAG of steps for user confirmation. "
             "plan = {name, steps:[{step_id, subject, instructions, role, assignee?, depends_on?, inputs?, "
             "deliverables?, acceptance?, skill?}]}. Example step: "
             '{"step_id":"s1","subject":"Research","instructions":"Write notes.md with 摘要 and 来源",'
             '"role":"researcher","assignee":"remy","deliverables":[{"id":"d1","path":"notes.md"}],'
             '"acceptance":[{"check":"exists","path":"notes.md"},{"check":"sections","path":"notes.md","names":["摘要","来源"]}]}; '
             'a dependent step adds "depends_on":["s1"],"inputs":[{"step":"s1","deliverable_id":"d1"}]. '
             "Validation reports the first issue only with an example; field aliases (id/task/dependsOn) are auto-repaired and listed in 'repairs'. "
             "Returns a plan card to show the user."),
         "input_schema": {"type": "object", "properties": {"plan": {"type": "object"}}, "required": ["plan"]}},
        {"name": "group_plan_revise", "description": "Replace a draft DAG's plan (full replacement, not patch).",
         "input_schema": {"type": "object", "properties": {"dag_id": {"type": "integer"}, "plan": {"type": "object"}},
                          "required": ["dag_id", "plan"]}},
        {"name": "group_plan_start", "description": "Activate a draft DAG after the user approved the plan card.",
         "input_schema": {"type": "object", "properties": {"dag_id": {"type": "integer"}}, "required": ["dag_id"]}},
        {"name": "group_plan_status", "description": "Show DAG(s) status; also reports drafts awaiting confirmation.",
         "input_schema": {"type": "object", "properties": {"dag_id": {"type": "integer"}}}},
        {"name": "group_plan_cancel", "description": "Cancel a DAG; unfinished steps become superseded.",
         "input_schema": {"type": "object", "properties": {"dag_id": {"type": "integer"}}, "required": ["dag_id"]}},
        {"name": "group_plan_replan",
         "description": ("Replace the unfinished part of a STALLED DAG. Submit only new or unfinished steps; completed "
                         "steps cannot be resubmitted but may be depended on. Returns a draft card—call group_plan_start "
                         "after the user approves. Max 2 replans per DAG."),
         "input_schema": {"type": "object", "properties": {"dag_id": {"type": "integer"}, "plan": {"type": "object"}},
                          "required": ["dag_id", "plan"]}},
        {"name": "group_plan_retry",
         "description": "Retry a FAILED step of a stalled DAG as-is (for transient failures). Resets fix_rounds.",
         "input_schema": {"type": "object", "properties": {"dag_id": {"type": "integer"}, "step_id": {"type": "string"}},
                          "required": ["dag_id", "step_id"]}},
        {"name": "group_plan_resume", "description": "Resume a paused DAG (after user pressed Stop).",
         "input_schema": {"type": "object", "properties": {"dag_id": {"type": "integer"}}, "required": ["dag_id"]}},
    ]
    handlers = {
        "spawn_teammate": spawn_teammate, "list_teammates": list_teammates,
        "send_message": send_message, "read_inbox": read_inbox, "shutdown_teammate": shutdown_teammate,
        "group_plan": group_plan, "group_plan_revise": group_plan_revise, "group_plan_start": group_plan_start,
        "group_plan_status": group_plan_status, "group_plan_cancel": group_plan_cancel, "group_plan_resume": group_plan_resume,
        "group_plan_replan": group_plan_replan, "group_plan_retry": group_plan_retry,
    }
    return defs, handlers
