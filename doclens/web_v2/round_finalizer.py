"""回合收尾的纯持久化段——SSE 对话路径与后台派活路径共用。

从 ``api/chat.py`` 的 ``_run_and_finalize`` 抽出（ADR-0062 数字员工需要
离线跑一轮）。只做「把这一轮发生的事落进会话库」，不碰 SSE 消费端：
不推送事件、不管断开续跑、不管中断注销。

**落库顺序 load-bearing**（与抽出处逐条对应，勿调换）：

1. ``upsert_skill_contexts`` —— 新条目要插到本轮 message_user 之前，复现
   内存中的注入位置；必须在 compacted 之前（upsert 的插入位置是当前
   MAX(seq) 条目之前，compacted 先落会把新 skill 条目插进已被截断投影
   丢弃的死前缀）。
2. ``append_compacted`` / ``append_microcompact`` —— 必须在 raw_messages
   之前（回放顺序 compacted → 本轮 raw_messages）。
3. ``append_raw_messages`` —— 轮起点用 runner 的 ``round_start_index``。
4. ``append_chat_turn_raw`` —— tool_trace + 模型原始输出。
5. ``append_usages`` —— 每次 LLM 调用一条。
6. ``append_message_ai`` + ``update_count_and_time`` —— 展示层。

每段独立 try/except：单段失败只记日志，不阻断后续段（与抽出处一致）。
"""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:  # 仅类型，运行时不 import（避免循环依赖）
    from doclens.web_v2.sessions_store import SessionsStore

logger = logging.getLogger(__name__)

__all__ = [
    "RoundOutcome",
    "display_tool_calls",
    "extract_injected_skill_contexts",
    "persist_round",
]


def display_tool_calls(tool_calls: list[dict]) -> list[dict]:
    """展示层/落库用的工具调用列表——只含已完成（有 output）的调用对。"""
    return [
        {
            "tool_use_id": tc.get("tool_use_id", ""),
            "name": tc.get("name", ""),
            "input": tc.get("input", {}),
            "output": tc.get("output", ""),
            "is_error": tc.get("is_error", False),
            "duration_ms": tc.get("duration_ms"),
        }
        for tc in tool_calls
        if "output" in tc
    ]


def extract_injected_skill_contexts(
    history: list[dict], loaded_skill_marker: str
) -> list[tuple[str, str]]:
    """从 run_stream 原地修改后的 history 提取注入的技能上下文（按出现顺序去重）。

    覆盖两类注入消息对（回放均经 upsert_skill_contexts 原样重建）：
    - skill body（<loaded-skill>，runner 重注入）→ 去重键 = 技能名；
    - 斜杠调用 hint（<slash-skill-hint>，chat.py 发送前注入）→ 去重键 =
      ``slash:<技能名>``，与 body 条目隔离（同技能两种条目并存不互斥）。

    ``loaded_skill_marker`` 由调用方传入（标记常量的单一真相源在
    ``api/_chat_markers``，本模块不反向 import api 包）。

    Returns:
        [(去重键, 完整消息内容), ...]，与注入顺序一致。
    """
    from doclens.web_v2.api._chat_slash import SLASH_HINT_RE

    loaded_re = re.compile(re.escape(loaded_skill_marker) + r'([^"]+)">')
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for m in history:
        content = m.get("content")
        if m.get("role") != "user" or not isinstance(content, str):
            continue
        hint = SLASH_HINT_RE.search(content)
        loaded = loaded_re.search(content)
        key: Optional[str] = None
        if hint:
            key = f"slash:{hint.group(1)}"
        elif loaded:
            key = loaded.group(1)
        if key and key not in seen:
            seen.add(key)
            out.append((key, content))
    return out


class RoundOutcome:
    """一轮的结果摘要（persist_round 的返回值；供派活循环判定用）。"""

    __slots__ = ("text", "error", "tool_calls", "interrupted")

    def __init__(
        self,
        text: str,
        error: Optional[str],
        tool_calls: list[dict],
        interrupted: bool,
    ):
        self.text = text
        self.error = error
        self.tool_calls = tool_calls
        self.interrupted = interrupted

    @property
    def ok(self) -> bool:
        return self.error is None and not self.interrupted


def persist_round(
    store: "SessionsStore",
    session_id: str,
    *,
    history: list[dict],
    message: str,
    agent: Any,
    emitter: Any,
    round_start: int,
    loaded_skill_marker: str,
    display_text: Optional[str] = None,
    interrupt_event: Optional[Any] = None,
) -> RoundOutcome:
    """把一轮 agent 的产物落进会话库（纯持久化，无 SSE）。

    Args:
        store: 会话库
        session_id: 会话 id
        history: run_stream 就地修改后的消息历史
        message: 本轮用户消息原文（raw_messages 切片的对齐锚点）
        agent: StreamingAgent（取 round_start_index / last_compaction /
            round_cleared_tool_use_ids）
        emitter: ChatEventEmitter（取 tool_calls / usages / full_text / error）
        round_start: run_stream 之前的 history 长度（agent 无 round_start_index 时的兜底）
        loaded_skill_marker: 技能体注入标记常量
        display_text: 展示层文本（已策展）；None = 原文
        interrupt_event: 本轮的中断事件（可选）；已置位即视为被中断

    Returns:
        RoundOutcome：落库的展示文本、错误、工具调用、是否被中断。
    """
    from doclens.web_v2.api._chat_raw import extract_round_raw_messages

    # 1. 技能体注入（必须在 compacted 之前）
    try:
        injected = extract_injected_skill_contexts(history, loaded_skill_marker)
        if injected:
            store.upsert_skill_contexts(session_id, injected)
    except Exception as e:  # noqa: BLE001
        logger.warning("persist skill contexts failed for %s: %s", session_id, e)

    # 2. 压缩事件（必须在 raw_messages 之前）
    try:
        compaction = getattr(agent, "last_compaction", None)
        if compaction:
            store.append_compacted(
                session_id,
                compaction["messages"],
                compaction.get("pre_tokens", 0),
            )
        cleared_ids = getattr(agent, "round_cleared_tool_use_ids", None)
        if cleared_ids:
            store.append_microcompact(session_id, cleared_ids)
    except Exception as e:  # noqa: BLE001
        logger.warning("persist compaction failed for %s: %s", session_id, e)

    # 3. 本轮原始消息序列
    try:
        raw_start = (
            agent.round_start_index
            if getattr(agent, "round_start_index", None) is not None
            else round_start
        )
        raw_msgs = extract_round_raw_messages(history, raw_start, message)
        if raw_msgs:
            store.append_raw_messages(session_id, raw_msgs)
    except Exception as e:  # noqa: BLE001
        logger.warning("persist raw messages failed for %s: %s", session_id, e)

    # 4. 工具链 + 模型原始输出
    try:
        traces = [
            {
                "tool_use_id": tc.get("tool_use_id", ""),
                "name": tc.get("name", ""),
                "input": tc.get("input", {}),
                "output": tc.get("output", ""),
                "is_error": tc.get("is_error", False),
            }
            for tc in emitter.tool_calls
            if "output" in tc
        ]
        store.append_chat_turn_raw(session_id, traces, emitter.get_full_text())
    except Exception as e:  # noqa: BLE001
        logger.warning("persist raw chat turn failed for %s: %s", session_id, e)

    # 5. 用量
    if emitter.usages:
        try:
            store.append_usages(session_id, emitter.usages)
        except Exception as e:  # noqa: BLE001
            logger.warning("persist usage failed for %s: %s", session_id, e)

    # 落库的展示文本：策展优先，无则原文；错误并入
    text = display_text if display_text is not None else emitter.get_full_text()
    if emitter.error:
        text = f"{text}\n\n⚠️ {emitter.error}" if text else f"⚠️ {emitter.error}"

    # 6. 展示层 message_ai + 计数
    if text:
        try:
            store.append_message_ai(session_id, text, display_tool_calls(emitter.tool_calls))
            store.update_count_and_time(session_id, store.count_live_messages(session_id))
        except Exception as e:  # noqa: BLE001
            logger.warning("persist display ai failed for %s: %s", session_id, e)

    interrupted = bool(interrupt_event is not None and interrupt_event.is_set())
    return RoundOutcome(
        text=text,
        error=emitter.error,
        tool_calls=list(emitter.tool_calls),
        interrupted=interrupted,
    )
