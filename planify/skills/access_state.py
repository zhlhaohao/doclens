"""技能加载状态：按 session_id 记录已加载的 skill，供工具门禁使用。

并发安全（web 多请求多线程共享同一 AgentRuntime 上的实例）。内存态——进程重启
后丢失，每个会话首次 KB 提问会重新加载一次 skill，可接受。
"""
from __future__ import annotations

import contextvars
import threading
from typing import Optional, Set


# 当前请求的 session_id。run_stream 开始时 set，工具 handler 通过 get 读取。
# ContextVar 按 asyncio 任务 / 线程上下文隔离，web 并发安全。
_current_session_id: "contextvars.ContextVar[str]" = contextvars.ContextVar(
    "current_session_id", default=""
)


def set_current_session_id(session_id: str) -> "contextvars.Token[str]":
    """设置当前请求的 session_id，返回 token 用于 reset。"""
    return _current_session_id.set(session_id)


def get_current_session_id() -> str:
    """读取当前请求的 session_id（未设置时返回 ""）。"""
    return _current_session_id.get()


def reset_current_session_id(token: "contextvars.Token[str]") -> None:
    """用 set 返回的 token 复位 ContextVar。"""
    _current_session_id.reset(token)


class SkillAccessState:
    """按 session_id 记录已加载的 skill 集合。线程安全。"""

    def __init__(self) -> None:
        self._loaded: dict[str, Set[str]] = {}
        self._lock = threading.Lock()

    def mark_loaded(self, session_id: str, name: str) -> None:
        """标记某 session 已加载某 skill。"""
        if not session_id or not name:
            return
        with self._lock:
            self._loaded.setdefault(session_id, set()).add(name)

    def is_loaded(self, session_id: str, name: str) -> bool:
        """判断某 session 是否已加载某 skill。"""
        if not session_id or not name:
            return False
        with self._lock:
            return name in self._loaded.get(session_id, set())

    def loaded_names(self, session_id: str) -> Set[str]:
        """返回某 session 已加载 skill 名集合（副本）。"""
        if not session_id:
            return set()
        with self._lock:
            return set(self._loaded.get(session_id, set()))

    def clear(self, session_id: str) -> None:
        """清空某 session 的加载记录（/clear 时调用）。"""
        if not session_id:
            return
        with self._lock:
            self._loaded.pop(session_id, None)


def mark_loaded_if_known(
    skill_state: Optional[SkillAccessState],
    session_id: str,
    name: str,
    body: str,
) -> None:
    """load_skill 返回 body 后调用：body 非空且非 Error 时标记已加载。

    用于 load_skill handler 成功路径。session_id/name 缺失或 skill_state 为
    None 时静默跳过（兼容非会话上下文，如单元测试直调）。
    """
    if skill_state is None or not session_id or not name:
        return
    if body and not body.startswith("Error:"):
        skill_state.mark_loaded(session_id, name)
