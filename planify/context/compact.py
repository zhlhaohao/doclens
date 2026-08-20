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


# microcompact 豁免清单：这些工具的结果不受"只留最近 N 个"清理。
# task（子代理）结果是主代理汇总用的最终摘要——并发派出 N 个子代理后，
# 下一轮 microcompact 会把排在前面的 task 结果清成 "[cleared]"，
# 主代理便丢失大部分子代理产出（summarize-files 并发模式实测踩中）。
MICROCOMPACT_EXEMPT_TOOLS = frozenset({"task"})

# 默认保留最近 10 个工具结果（原 3 个）。保留越多，前缀变动越少，
# 对大模型 prompt 前缀缓存越友好；体积控制主要靠 auto_compact 兜底。
MICROCOMPACT_KEEP_DEFAULT = 10

# microcompact 触发门控占 compact 阈值的比例（调用方传
# min_estimated_tokens = threshold * 此值）。
# 整体前缀匹配的提供商（GLM / MiniMax 等国产兼容端点）上，历史中段任何
# 单点突变都会使突变点之后的全部内容缓存失效并按全价重算——双倍代价；
# 而保留旧 tool_result 的成本只是缓存命中价。因此清理推迟到逼近
# auto_compact（0.8）时才发生，小/中上下文保持前缀绝对稳定。
MICROCOMPACT_GATE_RATIO = 0.8


def microcompact(
    messages: list,
    keep: int = MICROCOMPACT_KEEP_DEFAULT,
    min_estimated_tokens: int = 0,
) -> None:
    """
    微压缩：清理旧的工具结果

    在每次循环开始时自动执行，清理旧的工具结果内容。
    只保留最近 keep 个，超过的用 "[cleared]" 替换。
    MICROCOMPACT_EXEMPT_TOOLS 中的工具结果（task 子代理摘要）永不清理。

    缓存友好性：历史任何位置的单点突变都会使该位置起的 prompt 前缀
    缓存全部失效，因此：
    - keep 默认 10，降低清理频率；
    - min_estimated_tokens > 0 时，上下文估算 token 未达该下限则完全不动
      历史（小上下文无需清理，保持前缀绝对稳定）。

    Args:
        messages: 消息列表（会被原地修改）
        keep: 保留的最近工具结果数
        min_estimated_tokens: 触发清理的估算 token 下限（0 = 总是检查）
    """
    if min_estimated_tokens > 0 and estimate_tokens(messages) < min_estimated_tokens:
        return
    # tool_use_id → 工具名（从 assistant 消息的 tool_use 块建立映射）
    tool_names: Dict[str, str] = {}
    for msg in messages:
        if msg.get("role") == "assistant" and isinstance(msg.get("content"), list):
            for part in msg["content"]:
                if isinstance(part, dict) and part.get("type") == "tool_use":
                    tool_names[part.get("id", "")] = part.get("name", "")

    indices = []
    for i, msg in enumerate(messages):
        if msg["role"] == "user" and isinstance(msg.get("content"), list):
            for part in msg["content"]:
                if isinstance(part, dict) and part.get("type") == "tool_result":
                    indices.append(part)
    # 豁免工具的结果不参与"最近 3 个"计数与清理
    cleanable = [
        p for p in indices
        if tool_names.get(p.get("tool_use_id", "")) not in MICROCOMPACT_EXEMPT_TOOLS
    ]
    if len(cleanable) <= keep:
        return
    # 清理所有 tool_result 内容，只保留最近 keep 个
    for part in cleanable[:-keep]:
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
