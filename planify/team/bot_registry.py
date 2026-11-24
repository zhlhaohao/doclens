"""Bot 实体注册表（ADR-0058 §3/§6/§9，spike 版）。

Bot 实体 = ``{workdir}/.planify/team/bots/<name>.json``，工作目录级持久；
线程只是 Bot 的一次「上班」——实体不随线程消亡（shutdown 后同名同角色 spawn
即复活）。一个 Bot 绑定一个角色不可更换。租约（``leased_by``）是运行态：同一
时刻只属一个 scope，进程重启时全部清空。

spike 范围：实体 CRUD、租约、生命周期三态；角色校验只认内置 id（本文件不加载
persona——那是 TeammateManager 组 prompt 时的事）。

线程安全：实例级 RLock 保护全部读写；文件写入先写临时文件再 rename（防半写）。
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("planify.team.registry")

#: Bot 生命周期三态
BOT_WORKING = "working"
BOT_IDLE = "idle"
BOT_SHUTDOWN = "shutdown"

_VALID_STATUS = {BOT_WORKING, BOT_IDLE, BOT_SHUTDOWN}


class BotRegistryError(Exception):
    """注册表操作的预期错误（信息可直接给 lead 看）。"""


def _atomic_write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


class BotRegistry:
    """Bot 实体注册表。"""

    def __init__(self, bots_dir: Path, valid_roles: List[str]):
        self.bots_dir = Path(bots_dir)
        self.bots_dir.mkdir(parents=True, exist_ok=True)
        self.valid_roles = set(valid_roles)
        self._lock = threading.RLock()

    # ------------------------------------------------------------------ 内部

    def _path(self, name: str) -> Path:
        return self.bots_dir / f"{name}.json"

    def _load(self, name: str) -> Optional[Dict[str, Any]]:
        p = self._path(name)
        if not p.exists():
            return None
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            logger.warning("[bot-registry] 实体文件损坏 name=%s: %s", name, e)
            return None

    def _save(self, bot: Dict[str, Any]) -> None:
        _atomic_write_json(self._path(bot["name"]), bot)

    # ------------------------------------------------------------------ 查询

    def get(self, name: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._load(name)

    def list_all(self) -> List[Dict[str, Any]]:
        """全部 Bot 实体（含被租借的，带 ``leased_by``——lead 要知道有哪些可租）。"""
        with self._lock:
            out: List[Dict[str, Any]] = []
            for p in sorted(self.bots_dir.glob("*.json")):
                bot = self._load(p.stem)
                if bot:
                    out.append(bot)
            return out

    def exists(self, name: str) -> bool:
        with self._lock:
            return self._path(name).exists()

    # ------------------------------------------------------------------ 创建/复活

    def spawn(self, name: str, role: str, scope: str) -> Dict[str, Any]:
        """创建或复活 Bot，并授予本 scope 租约。

        返回实体副本。拒绝情形：
        - role 不是内置角色 id
        - 实体存在但 role 不同（一 Bot 一角色不可换）
        - 实体被其他 scope 租借（资源占用）

        状态处理：
        - 不存在 → 创建，status=working
        - shutdown → 复活，status=working
        - idle/working（本 scope 租借）→ 不改 status（调用方决定喂消息还是拒绝）

        调用方据 ``spawned``（True=新线程 / False=线程可能已在）决定起不起线程。
        """
        if role not in self.valid_roles:
            raise BotRegistryError(
                f"Unknown role '{role}'. Valid: {', '.join(sorted(self.valid_roles))}"
            )
        with self._lock:
            bot = self._load(name)
            if bot is None:
                bot = {
                    "name": name,
                    "role": role,
                    "status": BOT_SHUTDOWN,
                    "created_at": time.time(),
                    "created_by": scope,
                    "leased_by": None,
                }
                self._save(bot)
            elif bot["role"] != role:
                raise BotRegistryError(
                    f"Bot '{name}' is bound to role '{bot['role']}'; "
                    f"use a new name for role '{role}'"
                )
            # 租约：被其他 scope 持有 → 拒绝
            holder = bot.get("leased_by")
            if holder and holder != scope:
                raise BotRegistryError(
                    f"Bot '{name}' is in use by another session"
                )
            bot["leased_by"] = scope
            was_shutdown = bot["status"] == BOT_SHUTDOWN
            bot["status"] = BOT_WORKING
            self._save(bot)
            return {**bot, "_spawned": was_shutdown}

    def release(self, name: str, scope: str) -> bool:
        """释放租约（仅持有者可释放）。status 不在此改——由 ``set_status`` 管。"""
        with self._lock:
            bot = self._load(name)
            if not bot or bot.get("leased_by") != scope:
                return False
            bot["leased_by"] = None
            self._save(bot)
            return True

    def set_status(self, name: str, status: str, scope: Optional[str] = None) -> None:
        """更新生命周期状态。scope 给定时校验持有者（防止跨 scope 改状态）。"""
        if status not in _VALID_STATUS:
            raise BotRegistryError(f"Invalid status '{status}'")
        with self._lock:
            bot = self._load(name)
            if not bot:
                return
            if scope is not None and bot.get("leased_by") != scope:
                return
            bot["status"] = status
            self._save(bot)

    def leased_by_scope(self, scope: str) -> List[Dict[str, Any]]:
        """某 scope 当前租借的全部 Bot。"""
        with self._lock:
            return [b for b in self.list_all() if b.get("leased_by") == scope]

    # ------------------------------------------------------------------ 删除

    def delete(self, name: str, scope: str) -> bool:
        """显式删除（含记忆与会话目录）。仅持有者可删。"""
        with self._lock:
            bot = self._load(name)
            if not bot or bot.get("leased_by") != scope:
                return False
            self._path(name).unlink(missing_ok=True)
            home = self.bots_dir / name
            if home.exists():
                for p in sorted(home.rglob("*"), reverse=True):
                    if p.is_file():
                        p.unlink()
                    else:
                        p.rmdir()
                home.rmdir()
            return True

    # ------------------------------------------------------------------ 启动恢复

    def release_all_leases(self) -> int:
        """进程启动时调用：租约是运行态，全部清空；status 归 shutdown。

        但**保留 created_by**——它是「这个 Bot 属于哪个 scope」的持久依据，重启恢复
        要靠它重新上租约（§11e：重启后 Bot 线程全灭，调度器派单时自动复活它）。
        """
        with self._lock:
            n = 0
            for bot in self.list_all():
                if bot.get("leased_by") or bot.get("status") != BOT_SHUTDOWN:
                    bot["leased_by"] = None
                    bot["status"] = BOT_SHUTDOWN
                    self._save(bot)
                    n += 1
            return n

    def reclaim_for_scope(self, scope: str) -> List[Dict[str, Any]]:
        """重启恢复：把 created_by == scope 的 Bot 重新租给该 scope。

        租约是运行态（重启清空），但「Bot 属于哪个 scope」是持久事实（created_by）——
        靠它恢复，否则调度器派单时找不到可复活的 Bot（§11e）。
        """
        with self._lock:
            out = []
            for bot in self.list_all():
                if bot.get("created_by") == scope and not bot.get("leased_by"):
                    bot["leased_by"] = scope
                    bot["status"] = BOT_SHUTDOWN
                    self._save(bot)
                    out.append(bot)
            return out

    # ------------------------------------------------------------------ 记忆

    def memory_path(self, name: str) -> Path:
        return self.bots_dir / name / "memory.md"

    def read_memory(self, name: str) -> str:
        p = self.memory_path(name)
        return p.read_text(encoding="utf-8") if p.exists() else ""

    def sessions_dir(self, name: str) -> Path:
        d = self.bots_dir / name / "sessions"
        d.mkdir(parents=True, exist_ok=True)
        return d
