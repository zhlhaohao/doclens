"""DAG 数据模型、Plan schema 与校验器（ADR-0059 §3/§4，spike 版）。

一个 DAG = lead 一次 ``group_plan`` 提交的全部步骤。每个步骤落一个 task 文件
（沿用 TaskManager 的 ``task_N.json``，字段扩展）；DAG 元数据落
``scopes/<sid>/dags/<dag_id>.json``。

校验只报**首个错** + 字段路径 + 合法示例（Pi Bot 教训：报一串模型会放弃）。
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

# DAG 文件写入锁（按路径）：调度器主循环与验收线程可能同时写同一 DAG，
# Windows 上 os.replace 在另一线程读的瞬间会 PermissionError。
_write_locks: Dict[str, threading.Lock] = {}
_write_locks_guard = threading.Lock()


def _lock_for(path: Path) -> threading.Lock:
    key = str(path)
    with _write_locks_guard:
        lk = _write_locks.get(key)
        if lk is None:
            lk = threading.Lock()
            _write_locks[key] = lk
        return lk

# ------------------------------------------------------------------ 状态常量

# DAG 状态
DAG_DRAFT = "draft"
DAG_ACTIVE = "active"
DAG_STALLED = "stalled"
DAG_PAUSED = "paused"
DAG_DONE = "done"
DAG_CANCELLED = "cancelled"

# 步骤（task）状态
STEP_PENDING = "pending"       # 有未完成依赖
STEP_READY = "ready"           # 可派
STEP_IN_PROGRESS = "in_progress"
STEP_VERIFYING = "verifying"   # Bot 报完成，验收中（调度器线程池跑）
STEP_DONE = "done"
STEP_FAILED = "failed"         # fix_rounds 超限
STEP_BLOCKED = "blocked"
STEP_SUPERSEDED = "superseded" # 被重规划替换

ACTIVE_STEP_STATES = {STEP_PENDING, STEP_READY, STEP_IN_PROGRESS, STEP_VERIFYING}

VALID_CHECKS = {"exists", "sections", "min_citations", "manual"}


# ------------------------------------------------------------------ 错误

@dataclass
class PlanIssue(Exception):
    code: str
    path: List[Any]
    message: str
    expected: Optional[str] = None

    def __post_init__(self):
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        d = {"code": self.code, "path": self.path, "message": self.message}
        if self.expected:
            d["expected"] = self.expected
        return d


# ------------------------------------------------------------------ 校验

_ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,40}$")


def _check_step_shape(step: Any, i: int) -> None:
    if not isinstance(step, dict):
        raise PlanIssue("step_not_object", ["steps", i], f"Step {i} must be an object")
    sid = step.get("step_id")
    if not isinstance(sid, str) or not _ID_RE.match(sid):
        raise PlanIssue(
            "step_id_invalid", ["steps", i, "step_id"],
            f"Step {i}: step_id must match {_ID_RE.pattern}",
            expected='"s1"',
        )
    for key in ("subject", "instructions", "role"):
        if not isinstance(step.get(key), str) or not step.get(key):
            raise PlanIssue(
                f"{key}_missing", ["steps", i, key],
                f"Step {sid}: '{key}' is required and must be a non-empty string",
                expected='"..."' if key != "role" else '"researcher"',
            )


# 模型常犯的字段名漂移（评测集实测）：确定性修复，不报错——报错会让模型反复猜
_FIELD_ALIASES = {
    "id": "step_id",            # 步骤 id 写成 id
    "task": "instructions",     # Pi Bot 的 task 字段名
    "dependsOn": "depends_on",  # camelCase
    "title": "subject",
}


def _repair_plan(plan: Any) -> tuple:
    """确定性修复字段名漂移与 step_id 非法字符。返回 (修复后 plan, 修复说明列表)。

    只改别名与字符归一化，不改语义。depends_on / inputs.step 里对被改名
    step_id 的引用同步替换。缺 subject 时从 instructions 首行派生（纯展示字段）。
    """
    notes: List[str] = []
    if not isinstance(plan, dict) or not isinstance(plan.get("steps"), list):
        return plan, notes

    # 1. 字段别名
    for s in plan["steps"]:
        if not isinstance(s, dict):
            continue
        for alias, canonical in _FIELD_ALIASES.items():
            if alias in s and canonical not in s:
                s[canonical] = s.pop(alias)
                notes.append(f"step {s.get('step_id', '?')}: '{alias}' → '{canonical}'")

    # 1b. subject 缺失 → 从 instructions 首行派生（截 60 字）
    for s in plan["steps"]:
        if not isinstance(s, dict):
            continue
        if not s.get("subject") and isinstance(s.get("instructions"), str):
            first = s["instructions"].strip().splitlines()[0][:60]
            s["subject"] = first or s.get("step_id", "step")
            notes.append(f"step {s.get('step_id', '?')}: subject derived from instructions")

    # 2. step_id 非法字符归一化（记录旧→新，稍后替换引用）
    idmap: Dict[str, str] = {}
    for s in plan["steps"]:
        if not isinstance(s, dict):
            continue
        sid = s.get("step_id")
        if isinstance(sid, str) and not _ID_RE.match(sid):
            fixed = re.sub(r"[^A-Za-z0-9_-]", "-", sid)
            fixed = re.sub(r"-+", "-", fixed).strip("-")[:41]
            if not fixed or not re.match(r"[A-Za-z]", fixed[0]):
                fixed = "s-" + fixed
            notes.append(f"step_id '{sid}' → '{fixed}'")
            s["step_id"] = fixed
            idmap[sid] = fixed

    # 3. 引用同步
    if idmap:
        for s in plan["steps"]:
            if not isinstance(s, dict):
                continue
            s["depends_on"] = [idmap.get(d, d) for d in s.get("depends_on", []) or []]
            for inp in s.get("inputs", []) or []:
                if isinstance(inp, dict) and inp.get("step") in idmap:
                    inp["step"] = idmap[inp["step"]]
    return plan, notes


def validate_plan(
    plan: Any,
    *,
    role_ids: List[str],
    bot_names: List[str],
    bot_roles: Dict[str, str],
) -> Dict[str, Any]:
    """校验 Plan。通过返回规范化 plan；不通过抛 PlanIssue（只报首错）。

    bot_roles: {bot_name: role_id}——assignee 存在且 role 匹配的依据。
    """
    if not isinstance(plan, dict):
        raise PlanIssue("plan_not_object", [], "Plan must be an object")
    plan, repairs = _repair_plan(plan)
    steps = plan.get("steps")
    if not isinstance(steps, list) or not steps:
        raise PlanIssue("steps_empty", ["steps"], "Plan needs at least one step", expected="[{...}]")
    if len(steps) > 20:
        raise PlanIssue("too_many_steps", ["steps"], "At most 20 steps per plan")

    for i, s in enumerate(steps):
        _check_step_shape(s, i)

    ids = [s["step_id"] for s in steps]
    if len(set(ids)) != len(ids):
        dup = next(x for x in ids if ids.count(x) > 1)
        raise PlanIssue("step_id_duplicate", ["steps"], f"step_id '{dup}' appears twice")

    idset = set(ids)
    # 依赖存在 + 无环
    for s in steps:
        for d in s.get("depends_on", []) or []:
            if d not in idset:
                raise PlanIssue(
                    "depends_on_unknown", ["steps", s["step_id"], "depends_on"],
                    f"Step {s['step_id']} depends on unknown step '{d}'",
                    expected=", ".join(sorted(idset - {s["step_id"]})),
                )
    _assert_acyclic(steps)

    # 交付物 id 唯一 + inputs 引用真实交付物
    deliverable_index: Dict[str, set] = {}
    for s in steps:
        dl = s.get("deliverables", []) or []
        dids = [d.get("id") for d in dl]
        if len(set(dids)) != len(dids):
            raise PlanIssue("deliverable_id_duplicate", ["steps", s["step_id"], "deliverables"],
                            f"Step {s['step_id']}: duplicate deliverable id")
        for d in dl:
            if not isinstance(d.get("path"), str) or not d.get("path"):
                raise PlanIssue("deliverable_path_missing", ["steps", s["step_id"], "deliverables"],
                                f"Step {s['step_id']}: each deliverable needs a 'path'")
        deliverable_index[s["step_id"]] = set(dids)

    for s in steps:
        deps = set(s.get("depends_on", []) or [])
        for inp in s.get("inputs", []) or []:
            up = inp.get("step")
            did = inp.get("deliverable_id")
            if up not in deps:
                raise PlanIssue(
                    "input_not_a_dependency", ["steps", s["step_id"], "inputs"],
                    f"Step {s['step_id']} reads deliverable of '{up}' but does not depend on it; "
                    f"add '{up}' to depends_on",
                    expected=json.dumps({"step": up, "deliverable_id": did}),
                )
            if did not in deliverable_index.get(up, set()):
                raise PlanIssue(
                    "input_deliverable_unknown", ["steps", s["step_id"], "inputs"],
                    f"Step {s['step_id']}: step '{up}' has no deliverable '{did}'",
                    expected=", ".join(sorted(deliverable_index.get(up, set()))),
                )

    # role 合法 + assignee 存在且 role 匹配
    for s in steps:
        if s["role"] not in role_ids:
            raise PlanIssue(
                "role_unknown", ["steps", s["step_id"], "role"],
                f"Step {s['step_id']}: role '{s['role']}' is not a built-in role",
                expected=", ".join(role_ids),
            )
        a = s.get("assignee")
        if a is not None:
            if a not in bot_names:
                raise PlanIssue(
                    "assignee_unknown", ["steps", s["step_id"], "assignee"],
                    f"Step {s['step_id']}: assignee '{a}' is not an existing Bot; "
                    f"spawn it first or omit assignee for open claim",
                    expected=", ".join(bot_names) or "(no Bots yet)",
                )
            if bot_roles.get(a) != s["role"]:
                raise PlanIssue(
                    "assignee_role_mismatch", ["steps", s["step_id"], "assignee"],
                    f"Step {s['step_id']}: Bot '{a}' has role '{bot_roles.get(a)}', "
                    f"step requires '{s['role']}'",
                    expected=f"assignee with role '{s['role']}'",
                )

    # acceptance check 类型合法
    for s in steps:
        for a in s.get("acceptance", []) or []:
            if a.get("check") not in VALID_CHECKS:
                raise PlanIssue(
                    "acceptance_check_unknown", ["steps", s["step_id"], "acceptance"],
                    f"Step {s['step_id']}: unknown check '{a.get('check')}'",
                    expected=", ".join(sorted(VALID_CHECKS)),
                )

    return {"name": str(plan.get("name") or "plan"), "steps": steps, "repairs": repairs}


def _assert_acyclic(steps: List[Dict[str, Any]]) -> None:
    graph = {s["step_id"]: list(s.get("depends_on", []) or []) for s in steps}
    state: Dict[str, int] = {}

    def dfs(n: str, stack: List[str]) -> None:
        state[n] = 1
        for m in graph.get(n, []):
            if state.get(m, 0) == 1:
                cyc = stack[stack.index(m):] + [m]
                raise PlanIssue("cycle", ["steps"], "Dependency cycle: " + " -> ".join(cyc))
            if state.get(m, 0) == 0:
                dfs(m, stack + [m])
        state[n] = 2

    for n in graph:
        if state.get(n, 0) == 0:
            dfs(n, [n])


# ------------------------------------------------------------------ DAG 文件

def _atomic_write(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    with _lock_for(path):
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        for attempt in range(5):
            try:
                os.replace(tmp, path)
                return
            except PermissionError:
                if attempt == 4:
                    raise
                time.sleep(0.02 * (attempt + 1))


def next_dag_id(dags_dir: Path) -> int:
    ids = [int(p.stem) for p in dags_dir.glob("*.json") if p.stem.isdigit()]
    return max(ids, default=0) + 1


def write_dag(dags_dir: Path, dag: Dict[str, Any]) -> None:
    _atomic_write(dags_dir / f"{dag['id']}.json", dag)


def read_dag(dags_dir: Path, dag_id: int) -> Optional[Dict[str, Any]]:
    p = dags_dir / f"{dag_id}.json"
    if not p.exists():
        return None
    try:
        with _lock_for(p):
            return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def read_all_dags(dags_dir: Path) -> List[Dict[str, Any]]:
    out = []
    for p in sorted(dags_dir.glob("*.json")):
        if not p.stem.isdigit():
            continue
        d = read_dag(dags_dir, int(p.stem))
        if d:
            out.append(d)
    return out


def new_dag(scope_id: str, dag_id: int, plan: Dict[str, Any], output_dir: Path) -> Dict[str, Any]:
    return {
        "id": dag_id,
        "scope": scope_id,
        "name": plan["name"],
        "repairs": plan.get("repairs", []),
        "status": DAG_DRAFT,
        "output_dir": str(output_dir),
        "plan": plan,
        "steps": {s["step_id"]: {"task_id": None, "status": STEP_PENDING, "fix_rounds": 0}
                  for s in plan["steps"]},
        "created_at": time.time(),
        "llm_calls": 0,
        "stall_reason": None,
        "failed_step": None,
    }
