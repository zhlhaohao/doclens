"""上下文压缩 (s06)

管理对话上下文的压缩，包含两种策略：

1. 微压缩
   - 在每次循环开始时自动执行
   - 清理旧的工具结果内容，只保留最近 3 个
   - 清理的内容被替换为 "[cleared]"

2. 自动压缩
   - 当估算的 token 数超过阈值时触发
   - 使用 LLM 生成对话摘要
   - 将原始对话保存到 .transcripts/ 目录
   - 用摘要替换整个对话历史

关键洞察："可以无限期继续 —— 只需要偶尔压缩上下文。"
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Dict, List

from ..core.llm.provider import LLMProvider


def estimate_tokens(messages: list) -> int:
    """
    估算消息列表的 token 数

    使用简单的启发式：字符数除以 4。
    实际 token 数可能会有所不同，但足以作为阈值判断。

    Args:
        messages: 消息列表

    Returns:
        估算的 token 数
    """
    return len(json.dumps(messages, default=str)) // 4


def microcompact(messages: list) -> None:
    """
    微压缩：清理旧的工具结果

    在每次循环开始时自动执行，清理旧的工具结果内容。
    只保留最近 3 个，超过的用 "[cleared]" 替换。

    Args:
        messages: 消息列表（会被原地修改）
    """
    indices = []
    for i, msg in enumerate(messages):
        if msg["role"] == "user" and isinstance(msg.get("content"), list):
            for part in msg["content"]:
                if isinstance(part, dict) and part.get("type") == "tool_result":
                    indices.append(part)
    if len(indices) <= 3:
        return
    # 清理所有 tool_result 内容，只保留最近 3 个
    for part in indices[:-3]:
        if isinstance(part.get("content"), str) and len(part["content"]) > 100:
            part["content"] = "[cleared]"


def auto_compact(
    messages: list,
    provider: LLMProvider,
    transcript_dir: Path,
) -> list:
    """
    自动压缩：使用 LLM 生成对话摘要

    当上下文超过阈值时，向 LLM 发送整个对话以生成摘要，
    然后用摘要替换整个对话历史。
    原始对话会保存到 .transcripts/ 目录。

    Args:
        messages: 原始消息列表
        provider: LLM Provider（自带模型信息）
        transcript_dir: 脚本目录

    Returns:
        新消息列表，包含摘要和确认消息
    """
    # 保存原始对话记录
    transcript_dir.mkdir(exist_ok=True)
    path = transcript_dir / f"transcript_{int(time.time())}.jsonl"
    with open(path, "w") as f:
        for msg in messages:
            f.write(json.dumps(msg, default=str) + "\n")

    # 生成摘要 - 通过 LLMProvider 调用（归一化接口）
    conv_text = json.dumps(messages, default=str)[:80000]
    summary_request_messages: List[Dict] = [
        {"role": "user", "content": f"Summarize for continuity:\n{conv_text}"}
    ]
    summary_system = (
        "You are a summarization assistant. Produce a concise continuity "
        "summary preserving decisions, open tasks, key file paths, and "
        "recent tool results."
    )

    response = provider.chat(
        messages=summary_request_messages,
        system=summary_system,
        tools=[],  # 压缩阶段不提供工具
        max_tokens=2000,
    )

    summary = "".join(b.text for b in response.content if hasattr(b, "text"))

    # 返回新的压缩后消息列表
    return [
        {"role": "user", "content": f"[Compressed. Transcript: {path}]\n{summary}"},
        {"role": "assistant", "content": "Understood. Continuing with summary context."},
    ]
