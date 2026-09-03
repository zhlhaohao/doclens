"""本轮原始消息提取（raw_messages 落库用）。

独立于 chat.py 便于单测（chat.py 模块级依赖 FastAPI/deps 重链）。

动机（prompt 前缀缓存）：tool_trace 拆对回放与 runner 轮内真实累积结构不等价
（单条 assistant 含全部 text/tool_use block、单条 user 含全部 tool_result），
多工具/文本交错轮从该轮首条 assistant 起前缀即分叉。按原始消息结构落库后，
回放与真实请求逐字节一致。
"""

from planify.streaming.runner import CONTEXT_MARKER


def extract_round_raw_messages(
    history: list[dict], start: int, user_message: str
) -> list[dict]:
    """提取本轮新增的原始消息（run_stream 原地修改后的 history[start:]）。

    跳过（各有独立落库/重建通道）：
    - head-context 消息对（CONTEXT_MARKER + 紧随的 "Noted."，每轮重建注入）；
    - skill body 消息对（<loaded-skill>，已由 upsert_skill_contexts 单独落库）；
    - 本轮 user 消息（前端已落库 message_user）；
    - 中断残留的空 assistant（content=[]，回放无意义且可能触发 400）。

    截断：尾部未配对 tool_use（中断残留）连同其后消息整条丢弃，
    避免孤儿 tool_use 进入下轮历史触发 Anthropic 400。

    Args:
        history: run_stream 原地修改后的完整消息列表
        start: 本轮开始前 history 的长度（pop 本轮 user 消息后）
        user_message: 本轮用户输入（用于识别并跳过本轮 user 消息）

    Returns:
        可直接落库的原始消息列表（assistant / user(tool_result) / 通知消息对）
    """
    out: list[dict] = []
    msgs = history[start:]
    i = 0
    while i < len(msgs):
        m = msgs[i]
        content = m.get("content")
        role = m.get("role")
        if isinstance(content, str) and role == "user":
            if CONTEXT_MARKER in content or '<loaded-skill name="' in content:
                # 注入消息 + 紧随的 assistant "Noted."（有则一并跳过）
                nxt = msgs[i + 1] if i + 1 < len(msgs) else None
                if (
                    nxt
                    and nxt.get("role") == "assistant"
                    and isinstance(nxt.get("content"), str)
                    and nxt["content"].startswith("Noted")
                ):
                    i += 2
                else:
                    i += 1
                continue
            if content == user_message:
                i += 1
                continue
        if role == "assistant" and isinstance(content, list) and not content:
            i += 1
            continue
        out.append(m)
        i += 1
    return _truncate_to_closed_tool_chain(out)


def _truncate_to_closed_tool_chain(msgs: list[dict]) -> list[dict]:
    """截断到「所有 tool_use 均有配对 tool_result」的最长前缀。"""
    pending: set[str] = set()
    closed_len = 0
    for i, m in enumerate(msgs):
        content = m.get("content")
        if not isinstance(content, list):
            if not pending:
                closed_len = i + 1
            continue
        if m.get("role") == "assistant":
            for b in content:
                if isinstance(b, dict) and b.get("type") == "tool_use":
                    pending.add(b.get("id", ""))
        elif m.get("role") == "user":
            for b in content:
                if isinstance(b, dict) and b.get("type") == "tool_result":
                    pending.discard(b.get("tool_use_id", ""))
        if not pending:
            closed_len = i + 1
    return msgs[:closed_len]
