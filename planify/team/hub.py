"""团队作用域（ADR-0059 §1，spike 版）。

作用域 = 一个聊天会话（Web ``session_id``）。任务板 / 收件箱 / DAG 全在
``{workdir}/.planify/team/scopes/<sid>/`` 下，跨会话互不可见。Bot 实体在
``{workdir}/.planify/team/bots/``（工作目录级，跨会话共享）由 BotRegistry 管，
租借关系记在实体上。

TeamHub 是进程单例的装配点：持有 BotRegistry、RoleLibrary、Scheduler，按
scope_id 惰性创建 TeamScope。doclens 的 lead 工具 handler 运行期经
``get_current_session_id()`` 向 Hub 取当前 scope 的 bus / tasks（**不在装配期
绑定**——那是旧 team_tools 的串线根因）。
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Dict, Optional

from ..managers.task_manager import TaskManager
from ..messaging.message_bus import MessageBus
from .bot_registry import BotRegistry
from .roles import RoleLibrary

logger = logging.getLogger("planify.team.hub")


class TeamScope:
    """一个会话的团队协调状态。"""

    def __init__(self, scope_id: str, root: Path):
        self.scope_id = scope_id
        self.root = Path(root)
        self.tasks_dir = self.root / "tasks"
        self.inbox_dir = self.root / "inbox"
        self.dags_dir = self.root / "dags"
        for d in (self.tasks_dir, self.inbox_dir, self.dags_dir):
            d.mkdir(parents=True, exist_ok=True)
        self.tasks = TaskManager(self.tasks_dir)
        self.bus = MessageBus(self.inbox_dir)

    def destroy(self) -> None:
        """会话删除：整目录删。只删 scope 内协调状态，不碰 bots/ 与 输出/。"""
        import shutil
        shutil.rmtree(self.root, ignore_errors=True)


class TeamHub:
    """进程单例：scope 注册 + 共享组件。scheduler 由外部注入（避免循环依赖）。"""

    def __init__(self, team_dir: Path, roles: Optional[RoleLibrary] = None):
        self.team_dir = Path(team_dir)
        self.team_dir.mkdir(parents=True, exist_ok=True)
        self.scopes_root = self.team_dir / "scopes"
        self.scopes_root.mkdir(parents=True, exist_ok=True)
        self.roles = roles or RoleLibrary()
        self.registry = BotRegistry(self.team_dir / "bots", valid_roles=self.roles.ids())
        self._scopes: Dict[str, TeamScope] = {}
        self._lock = threading.RLock()
        self._scheduler = None  # 延迟注入（scheduler 模块 import hub 会循环）
        self._runner = None     # BotRunner，由 bootstrap_team 注入
        from .events import TeamEventBus
        self.events = TeamEventBus()  # Bot → SSE 事件总线（ADR-0060 §3）

    @property
    def runner(self):
        return self._runner

    def attach_runner(self, runner) -> None:
        self._runner = runner

    # ---------------------------------------------------------------- scope

    def scope(self, scope_id: str) -> TeamScope:
        if not scope_id:
            raise ValueError("scope_id is required (Web session_id)")
        with self._lock:
            sc = self._scopes.get(scope_id)
            if sc is None:
                sc = TeamScope(scope_id, self.scopes_root / scope_id)
                self._scopes[scope_id] = sc
                if self._scheduler is not None:
                    self._scheduler.ensure_started()
                    # 启动恢复（§11e）：该 scope 若有持久化的 active DAG（进程重启后），
                    # in_progress → ready 并唤醒调度器；无则 no-op
                    self._scheduler.recover_scope(scope_id)
            return sc

    def try_scope(self, scope_id: str) -> Optional[TeamScope]:
        with self._lock:
            return self._scopes.get(scope_id)

    def drop_scope(self, scope_id: str) -> None:
        """会话删除：释放租约、销毁目录、移出注册表。活 Bot 的 shutdown 由调度器做。"""
        with self._lock:
            sc = self._scopes.pop(scope_id, None)
            if sc is None:
                return
            for bot in self.registry.leased_by_scope(scope_id):
                self.registry.release(bot["name"], scope_id)
            if self._scheduler is not None:
                self._scheduler.on_scope_dropped(scope_id)
            sc.destroy()

    def all_scopes(self):
        with self._lock:
            return list(self._scopes.values())

    # ---------------------------------------------------------------- scheduler

    def attach_scheduler(self, scheduler) -> None:
        with self._lock:
            self._scheduler = scheduler

    @property
    def scheduler(self):
        return self._scheduler
