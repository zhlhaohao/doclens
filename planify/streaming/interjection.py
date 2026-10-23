#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
插话槽位（User Interjection Slot）

生成中途的旁路询问（ADR-0048，术语见宿主 CONTEXT.md）：宿主经 HTTP 端点
提交用户插话，agent 主循环在下一次 LLM 调用前的检查点消费——工具表置空
产出纯文字汇报，随后恢复工具循环、回合不结束。

会话级单槽位语义（ADR-0048 决策 3）：
- 每会话同时至多 1 条待处理插话；占用时再提交返回 False（宿主 toast 拒绝）；
- 不排队、不持久化——进程内内存，回合结束未被消费即由宿主丢弃 + toast；
- 跨线程安全（HTTP handler 与 agent loop 同为 ASGI 协程时无锁开销极小，
  但 CLI/TUI 线程形态下提交方可能是任意线程，统一 threading.Lock 保护）。

框架中性：本模块不感知宿主 UI / 存储协议，消费方是 StreamingAgent 主循环
（runner.py 循环顶检查点）。子代理 / teammate 不接入（ADR-0048 决策 9）。
"""

import threading

__all__ = [
    "INTERJECTION_TAG",
    "interjection_message",
    "InterjectionSlot",
    "get_interjection_slot",
]

#: 注入消息的包裹标签（与 background-results / inbox 注入惯例一致）
INTERJECTION_TAG = "user-interjection"


def interjection_message(question: str) -> str:
    """构造注入给模型的 user 消息正文（ADR-0048 决策 6 的模板）。

    明示「旁路询问」身份，防止模型把插话当成新任务指令；模板三要求
    （只做文字汇报 / 不调工具 / 汇报后恢复任务）由机制兜底（suppress_tools
    调用 + 循环继续），文字仅提供语境。
    """
    return (
        f"<{INTERJECTION_TAG}>\n"
        "请暂停所有工具调用，用户在生成中途插话询问："
        f"{question}\n"
        "本次回复只做文字汇报，不要调用任何工具。汇报完成之后，"
        "请立刻恢复我们原本的任务，继续使用工具推进目标，不要结束任务。\n"
        f"</{INTERJECTION_TAG}>"
    )


class InterjectionSlot:
    """会话级单槽位：submit（宿主 HTTP 端点）与 take（agent 循环顶检查点）。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._pending: str | None = None

    def submit(self, text: str) -> bool:
        """写入插话；槽位已占用返回 False（不排队，ADR-0048）。"""
        with self._lock:
            if self._pending is not None:
                return False
            self._pending = text
            return True

    def has_pending(self) -> bool:
        """是否有待处理插话（agent 退避等待的可唤醒判定用）。"""
        with self._lock:
            return self._pending is not None

    def take(self) -> str | None:
        """取走并清空槽位；无待处理返回 None。"""
        with self._lock:
            text = self._pending
            self._pending = None
            return text

    def discard(self) -> str | None:
        """丢弃槽位内容（回合结束收尾用，语义同 take——取走不再消费）。"""
        return self.take()


# 会话级槽位注册表（全局单例；key 由宿主传入——通常是 chat session id）
_registry_lock = threading.Lock()
_registry: dict[str, InterjectionSlot] = {}


def has_interjection_slot(session_id: str) -> bool:
    """该会话是否已登记槽位（非惰性探测——agent 退避等待用它决定是否
    分段等待：无登记的宿主形态（CLI/TUI/测试）保持整段 sleep，行为与
    旧路径逐字节一致）。"""
    with _registry_lock:
        return session_id in _registry


def get_interjection_slot(session_id: str) -> InterjectionSlot:
    """获取（惰性创建）会话的插话槽位。"""
    with _registry_lock:
        slot = _registry.get(session_id)
        if slot is None:
            slot = InterjectionSlot()
            _registry[session_id] = slot
        return slot


def drop_interjection_slot(session_id: str) -> str | None:
    """移除会话槽位并返回残留插话（回合收尾：丢弃 + 宿主 toast 依据）。"""
    with _registry_lock:
        slot = _registry.pop(session_id, None)
    return slot.discard() if slot is not None else None
