"""团队协作层（ADR-0058 Bot 实体 + ADR-0059 DAG 派活，spike 版）。

模块边界：本包**只依赖** planify 内部（managers / messaging / skills / tools / core），
不 import doclens。宿主经 ``bootstrap_team()`` 装配，经 ``hub`` 访问。
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from .bot_registry import BotRegistry, BotRegistryError
from .hub import TeamHub, TeamScope
from .roles import Role, RoleLibrary, RoleError
from . import dag, acceptance

logger = logging.getLogger("planify.team")

__all__ = [
    "BotRegistry", "BotRegistryError", "TeamHub", "TeamScope", "Role", "RoleLibrary", "RoleError",
    "dag", "acceptance", "bootstrap_team", "get_hub",
]

_hub: Optional[TeamHub] = None


def get_hub() -> Optional[TeamHub]:
    return _hub


def bootstrap_team(
    workdir: Path,
    provider,
    tool_defs: list,
    tool_handlers: Dict[str, Callable[..., str]],
    lang: str = "zh",
    poll_interval: float = 2.0,
    idle_timeout: int = 60,
) -> TeamHub:
    """装配 TeamHub + BotRunner + Scheduler，并挂 lead 工具面。返回 hub。

    lead 工具面不在此注册（宿主在 build_tool_registry 后把它并入 handlers）；
    这里返回的 hub 已可用于 ``make_plan_tools(lambda: hub, workdir)``。
    """
    global _hub
    from .runner import BotRunner
    from .scheduler import Scheduler

    team_dir = Path(workdir) / ".planify" / "team"
    hub = TeamHub(team_dir, RoleLibrary(lang=lang))
    runner = BotRunner(hub, provider, Path(workdir), tool_defs, tool_handlers,
                       poll_interval=int(poll_interval), idle_timeout=idle_timeout)
    hub.attach_runner(runner)

    def spawner(scope: str, name: str, placeholder: str) -> None:
        runner.start(scope, name, placeholder)

    sched = Scheduler(hub, spawner=spawner, thread_alive=runner.is_alive, poll_interval=poll_interval)
    hub.attach_scheduler(sched)

    # 启动恢复：租约全清 + active DAG 的 in_progress → ready（有则起调度器）
    hub.registry.release_all_leases()
    # 注意：启动时 scopes 尚未注册（惰性），恢复逻辑由宿主在首个 scope 建立时触发
    _hub = hub
    logger.info("[team] bootstrapped at %s (roles: %s)", team_dir, ", ".join(hub.roles.ids()))
    return hub


def recover_scope_on_first_use(hub: TeamHub, scope_id: str) -> int:
    """宿主在 scope 首次建立时调用：该 scope 的 active DAG 恢复（in_progress → ready）。"""
    if hub.scheduler is None:
        return 0
    sc = hub.scope(scope_id)
    n = 0
    for d in dag.read_all_dags(sc.dags_dir):
        if d["status"] not in (dag.DAG_ACTIVE, dag.DAG_PAUSED):
            continue
        changed = False
        for st in d["steps"].values():
            if st["status"] in (dag.STEP_IN_PROGRESS, dag.STEP_VERIFYING):
                st["status"] = dag.STEP_READY
                changed = True
        if changed:
            dag.write_dag(sc.dags_dir, d)
        if d["status"] == dag.DAG_ACTIVE:
            n += 1
    if n:
        hub.scheduler.ensure_started()
        hub.scheduler.wake()
    return n
