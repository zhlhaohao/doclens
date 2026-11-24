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
from .dag import PlanIssue, validate_plan

logger = logging.getLogger("planify.team.plan_tools")


class PlanToolError(Exception):
    pass


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
            dag_id = D.next_dag_id(sc.dags_dir)
            slug = "".join(c if c.isalnum() or c in "-_" else "-" for c in norm["name"])[:40].strip("-") or "plan"
            out = Path(workdir) / "输出" / f"{dag_id}-{slug}"
            dag = D.new_dag(sc_id, dag_id, norm, out)
            D.write_dag(sc.dags_dir, dag)
            _set_pending(sc, dag_id, "confirm")
            return json.dumps({"ok": True, "dag_id": dag_id, "card": _card(dag),
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
         "description": ("Submit a DAG of steps for user confirmation. Each step: step_id, subject, instructions, role "
                         "(built-in id), optional assignee (existing Bot with that role), depends_on (step_ids), inputs "
                         "([{step, deliverable_id}]), deliverables ([{id, path}]), acceptance ([{check, path, ...}]). "
                         "Validation reports the first issue only with an example. Returns a plan card to show the user."),
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
        {"name": "group_plan_resume", "description": "Resume a paused DAG (after user pressed Stop).",
         "input_schema": {"type": "object", "properties": {"dag_id": {"type": "integer"}}, "required": ["dag_id"]}},
    ]
    handlers = {
        "spawn_teammate": spawn_teammate, "list_teammates": list_teammates,
        "send_message": send_message, "read_inbox": read_inbox, "shutdown_teammate": shutdown_teammate,
        "group_plan": group_plan, "group_plan_revise": group_plan_revise, "group_plan_start": group_plan_start,
        "group_plan_status": group_plan_status, "group_plan_cancel": group_plan_cancel, "group_plan_resume": group_plan_resume,
    }
    return defs, handlers
