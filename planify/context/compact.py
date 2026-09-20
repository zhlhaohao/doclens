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
from typing import TYPE_CHECKING, Dict, List, Optional, Tuple

from ..core.llm.provider import LLMProvider

if TYPE_CHECKING:
    from ..core.llm.trace import LLMTracer

# 非 ASCII 字符（CJK / 全角 / emoji 等）：真实 tokenizer 约 1 token/字符
# （中文实测 0.6~1.1），取 1 略偏高估——高估只是提前触发压缩（安全方向），
# 低估会撞上下文硬上限。计数用 encode("ascii", errors="ignore") 一步差值。


def _estimate_text_tokens(s: str) -> int:
    """单字符串 token 估算：ASCII ÷4、非 ASCII ≈1 token/字符（密度公式
    单一真相源——estimate_tokens 与摘要输入预算计量共用）。"""
    if s.isascii():
        return len(s) // 4
    # 非 ASCII 字符数一步可得（比逐段 finditer 求和快数倍，长 dump 常态）
    non_ascii = len(s) - len(s.encode("ascii", errors="ignore"))
    return (len(s) - non_ascii) // 4 + non_ascii


def estimate_tokens(messages: list) -> int:
    """
    估算消息列表的 token 数

    启发式：ASCII 部分 4 字符 ≈ 1 token；非 ASCII（中日韩等）≈ 1 token/字符。
    ensure_ascii=False 序列化——旧式默认转义把每个汉字变成 ``\\uXXXX`` 6 个
    ASCII 字符，÷4 后 ≈1.5 token/汉字，对中文对话系统性高估 ~50%。

    纯 ASCII 内容走 ``len // 4`` 快速路径，公式与历史版本完全一致（英文
    场景行为不变）。足以作为阈值判断；需要更高精度时用
    :func:`estimate_tokens_with_usage`（实测基线 + 本函数估增量）。

    Args:
        messages: 消息列表

    Returns:
        估算的 token 数
    """
    return _estimate_text_tokens(
        json.dumps(messages, default=str, ensure_ascii=False)
    )


def estimate_tokens_with_usage(
    messages: list,
    usage_total_input: Optional[int],
    usage_messages_len: Optional[int],
) -> int:
    """
    usage 实测基线 + 增量启发式估算（借鉴 Claude Code 的
    tokenCountWithEstimation——它标注为 autocompact 阈值判断的 canonical 口径）。

    上次 LLM 响应的 usage 总输入（input + cache_read + cache_creation，
    含 system prompt 与工具表，真实 tokenizer 计数）精确覆盖该次请求的全部
    输入；此后新增的消息（assistant 输出 / tool_result / 新 user）用
    estimate_tokens ÷4 启发式估增量——误差被限制在增量部分而非全历史，
    且补上了纯 ÷4 不含 system/工具表的盲区。

    基线失效（返回全量 ÷4 兜底）：未提供基线（首轮 / usage 缺失）；或
    ``len(messages) < usage_messages_len``（历史被压缩整体替换变短）。

    Args:
        messages: 当前消息列表
        usage_total_input: 基线实测总输入 tokens（None = 无基线）
        usage_messages_len: 基线对应的请求输入 messages 长度

    Returns:
        估算的 token 数
    """
    if (
        usage_total_input is not None
        and usage_messages_len is not None
        and usage_messages_len >= 0
        and len(messages) >= usage_messages_len
    ):
        return usage_total_input + estimate_tokens(messages[usage_messages_len:])
    return estimate_tokens(messages)


# === 摘要输入预处理（2026-09-17 摘要质量改进） ===
#
# 旧实现把 json.dumps(全量历史)[:80000] 直接喂给摘要模型，三个缺陷：
# 1. 头部截断——保住对话开头、丢掉最近内容（续接任务最需要的恰是尾部）；
# 2. 原始 JSON 噪音——转义符/tool_use id/消息结构占满窗口，有效密度极低；
# 3. 大头是 tool_result 里的文档原文，一字不漏地进窗口。
#
# 改进：历史先渲染成「瘦身转录」再进摘要（剥注入对、工具调用留名+入参
# 摘要、工具结果逐条截断），超长时头尾窗口兜底（头保任务目标、尾保最近
# 对话）。30 万字符量级的 JSON 实测可缩至一两万字符转录，窗口内全量可见。

_TOOL_RESULT_CHARS = 400   # 单条工具结果保留字符数（大头是文档原文）
_TOOL_INPUT_CHARS = 200    # 工具调用入参保留字符数

# 摘要输入 token 预算（2026-09-18 从 80K 字符窗口升级）：
# - 预算按「摘要模型上下文安全值」计：调用方声明了上下文窗口时按
#   summary_input_budget() 动态推（见该函数），未声明时对齐最保守的
#   128K 端点兜底：128K − 输出上限 10K − system/包装 ≈ 117K，取整
#   100K 留呼吸空间；
# - 以估算 token（ASCII ÷4、非 ASCII ≈1/字符，与 estimate_tokens 同密度）
#   计量而非字符数——英文转录有效窗口从旧口径 80K 字符放大到 ~400K 字符
#   （÷4 密度），中文 ~100K 字，长对话中段不再轻易被丢；
# - 头尾比例维持 1:3（头保任务目标、尾保最近工作——摘要第 6 节依赖尾部）。
_SUMMARY_INPUT_TOKEN_BUDGET = 100_000

# 动态预算推导常量：输出预留 = 摘要输出上限（随配置）+ system/消息包装；
# ×0.85 吸收 ÷4 启发式的估算误差（真实 tokenizer 可能高于估算 ~15%）
_BUDGET_WRAPPER_RESERVE = 2_000
_BUDGET_ESTIMATE_SAFETY = 0.85


def summary_output_cap(summary_max_tokens: Optional[int]) -> int:
    """摘要输出上限：max(实测下限, 配置值)——thinking 型模型需要下限兜底，
    大输出模型（配置 131072 等）跟随配置放开。"""
    return max(_SUMMARY_MAX_TOKENS_FLOOR, summary_max_tokens or 0)


def summary_input_budget(
    context_window: Optional[int],
    summary_max_tokens: Optional[int] = None,
) -> int:
    """上下文窗口声明 + 摘要输出上限 → 摘要输入 token 预算。

    摘要调用与主对话同 provider/模型，窗口声明可信时按声明推预算：
    (窗口 − 输出预留 − 包装) × 0.85 估算安全系数。输出预留随
    PLANIFY_MAX_TOKENS 配置联动（大输出配置挤占输入预算——窗口是
    输入+输出共享的物理约束）。200K 窗口/默认输出 ≈ 160K、128K ≈ 99K；
    200K 窗口/131072 输出 ≈ 57K。声明缺失 / 非法（≤ 预留）→ 100K 兜底
    （对齐最保守的 128K 端点）。

    Args:
        context_window: 声明的上下文窗口 tokens（None = 未声明）
        summary_max_tokens: 摘要输出上限配置（None = 用下限兜底）
    """
    output_reserve = summary_output_cap(summary_max_tokens) + _BUDGET_WRAPPER_RESERVE
    if context_window is None or context_window <= output_reserve:
        return _SUMMARY_INPUT_TOKEN_BUDGET
    return int((context_window - output_reserve) * _BUDGET_ESTIMATE_SAFETY)

# 结构化摘要 system prompt（借鉴 Claude Code compact 的分节式）：接收方
# 只有这份摘要、看不到原文，分节强制覆盖任务状态的关键面；第 6 节
# （最近工作详情）最重要——下一轮对话直接接着这里继续。
_SUMMARY_SYSTEM = (
    "你是对话摘要助手。把对话转录整理为「续接摘要」，供同一会话的下一"
    "阶段直接继续工作——接收方只有这份摘要、看不到原文。用 Markdown "
    "小节输出以下结构（无内容的小节写「无」）：\n"
    "1. 任务目标：用户要做什么、当前进行到哪一步\n"
    "2. 关键决策与结论：已确定的技术方案/事实\n"
    "3. 关键文件与路径：涉及/创建/修改的文件\n"
    "4. 重要约束：用户明确要求遵守的规则\n"
    "5. 未完成事项：待办/待验证/遗留问题\n"
    "6. 最近工作详情：转录**末尾**若干轮的逐轮记录（做了什么、看到了"
    "什么结果、下一步是什么）——本节最重要，宁长勿短"
)

# 摘要输出上限下限（2026-09-18 起随配置放大：实际取
# max(此下限, 调用方传入的 max_tokens 配置)）。注意 thinking 型模型
# （glm-5.3 等服务端默认开思考）的 thinking 块共享输出预算——实测 4000
# 会被思考全文耗尽、正文 0 输出（stop_reason=max_tokens），10000 是
# 实测安全下限；大输出模型（PLANIFY_MAX_TOKENS 配 131072 等）跟随配置
# 放开，摘要正文可写得更长。
_SUMMARY_MAX_TOKENS_FLOOR = 10_000


def _clip(s: str, limit: int) -> str:
    """超长文本截断，带原长度标记。"""
    return s if len(s) <= limit else s[:limit] + f"…[截断，原 {len(s)} 字符]"


def _is_injected_pair(messages: list, i: int) -> bool:
    """识别框架注入消息对（<system-reminder> 包裹的 user + 紧随 "Noted."
    assistant）——head-context 与 skill body 均为此形态，压缩后会重注入，
    无需进摘要（转录跳过它们可再省数千字符）。"""
    m = messages[i]
    c = m.get("content")
    if m.get("role") != "user" or not isinstance(c, str):
        return False
    if not (c.lstrip().startswith("<system-reminder>") and "</system-reminder>" in c):
        return False
    nxt = messages[i + 1] if i + 1 < len(messages) else None
    return bool(
        nxt
        and nxt.get("role") == "assistant"
        and isinstance(nxt.get("content"), str)
        and nxt["content"].startswith("Noted")
    )


def _render_message(msg: dict) -> str:
    """单条消息 → 转录正文（不含角色前缀，由调用方拼接）。

    - text 块原样；thinking 块跳过（内部推理，非对话事实）
    - tool_use → ``[调用 name(入参摘要)]``
    - tool_result → ``[结果] 前 N 字符``
    """
    c = msg.get("content")
    if isinstance(c, str):
        return c
    parts: List[str] = []
    for b in c or []:
        if not isinstance(b, dict):
            continue
        t = b.get("type")
        if t == "text":
            parts.append(b.get("text", ""))
        elif t == "thinking":
            continue
        elif t == "tool_use":
            input_s = json.dumps(
                b.get("input") or {}, ensure_ascii=False, default=str
            )
            parts.append(
                f"[调用 {b.get('name', '')}({_clip(input_s, _TOOL_INPUT_CHARS)})]"
            )
        elif t == "tool_result":
            content = b.get("content")
            if isinstance(content, list):
                content = " ".join(
                    x.get("text", "") if isinstance(x, dict) else str(x)
                    for x in content
                )
            parts.append(f"[结果] {_clip(str(content or ''), _TOOL_RESULT_CHARS)}")
    return "\n".join(p for p in parts if p)


def _render_for_summary(
    messages: list, input_budget: Optional[int] = None
) -> str:
    """历史 → 瘦身转录（摘要输入）。

    跳过注入对；其余逐条渲染为「用户/助手: 正文」；估算 token 超出
    摘要输入预算时头尾拼接（头保任务目标、尾保最近对话），中段省略
    标记。切分按整体平均密度把 token 预算映射到字符位置（兜底保险丝，
    不追求逐块精确）。

    Args:
        messages: 历史消息列表
        input_budget: 输入 token 预算（None = 用保守兜底常量；由
            summary_input_budget(窗口声明) 推导），头部固定占 1/4
            （参数名避开同名模块级函数——遮蔽后体内一调即无限递归）
    """
    budget = input_budget or _SUMMARY_INPUT_TOKEN_BUDGET
    head_tokens = budget // 4  # 头尾维持 1:3（头保任务目标、尾保最近工作）
    lines: List[str] = []
    role_label = {"user": "用户", "assistant": "助手"}
    i = 0
    while i < len(messages):
        if _is_injected_pair(messages, i):
            i += 2
            continue
        m = messages[i]
        body = _render_message(m)
        if body:
            lines.append(f"{role_label.get(m.get('role'), str(m.get('role')))}: {body}")
        i += 1
    text = "\n\n".join(lines)
    total_est = _estimate_text_tokens(text)
    if total_est <= budget:
        return text
    density = total_est / len(text)  # token/字符（均匀假设下的平均密度）
    head_chars = int(head_tokens / density)
    tail_chars = int((budget - head_tokens) / density)
    head = text[:head_chars]
    tail = text[-tail_chars:] if tail_chars else ""
    return (
        head
        + "\n\n…[中段省略：转录超出摘要输入 token 预算，仅保留任务目标（开头）与最近对话（结尾）]…\n\n"
        + tail
    )


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
    *,
    estimated_tokens: Optional[int] = None,
) -> List[str]:
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
        estimated_tokens: 调用方已算好的估算值（usage-based 口径）——
            传入时门控复用该值，跳过内部全量估算；None 时内部自行
            estimate_tokens。与 min_estimated_tokens=0（无门控）互不影响

    Returns:
        本次实际清理的 tool_use_id 列表（未触发门控 / 无可清理项 / 豁免
        工具的结果均不包含；调用方可持久化以在回放侧重放同一清理）
    """
    if min_estimated_tokens > 0:
        effective = (
            estimated_tokens
            if estimated_tokens is not None
            else estimate_tokens(messages)
        )
        if effective < min_estimated_tokens:
            return []
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
        return []
    # 清理所有 tool_result 内容，只保留最近 keep 个
    cleared_ids: List[str] = []
    for part in cleanable[:-keep]:
        if isinstance(part.get("content"), str) and len(part["content"]) > 100:
            part["content"] = "[cleared]"
            cleared_ids.append(part.get("tool_use_id", ""))
    return cleared_ids


def _prepare_compaction(
    messages: list,
    transcript_dir: Path,
    summary_input_budget: Optional[int] = None,
) -> tuple[Path, List[Dict], str]:
    """压缩前准备（同步/异步版共用）：原始对话落盘 + 摘要请求组装。

    Returns:
        (transcript 路径, 摘要请求 messages, 摘要 system prompt)
    """
    transcript_dir = Path(transcript_dir)  # 防御：调用方可能传 str
    # 保存原始对话记录
    transcript_dir.mkdir(exist_ok=True)
    path = transcript_dir / f"transcript_{int(time.time())}.jsonl"
    with open(path, "w") as f:
        for msg in messages:
            f.write(json.dumps(msg, default=str) + "\n")

    # 摘要输入 = 瘦身转录（见 _render_for_summary：剥注入对/工具结果截断/
    # token 预算头尾兜底），不再直接 dump 原始 JSON
    conv_text = _render_for_summary(messages, summary_input_budget)
    summary_request_messages: List[Dict] = [
        {"role": "user", "content": f"对话转录如下，请生成续接摘要：\n{conv_text}"}
    ]
    return path, summary_request_messages, _SUMMARY_SYSTEM


def _compacted_messages(path: Path, summary: str) -> list:
    """摘要 → 压缩后的替换消息（同步/异步版共用）。"""
    return [
        {"role": "user", "content": f"[Compressed. Transcript: {path}]\n{summary}"},
        {"role": "assistant", "content": "Understood. Continuing with summary context."},
    ]


def auto_compact(
    messages: list,
    provider: LLMProvider,
    transcript_dir: Path,
    *,
    tracer: Optional["LLMTracer"] = None,
    summary_input_budget: Optional[int] = None,
    summary_max_tokens: Optional[int] = None,
) -> list:
    """
    自动压缩：使用 LLM 生成对话摘要（同步版，服务旧 Agent 循环与 /compact 命令）

    当上下文超过阈值时，向 LLM 发送整个对话以生成摘要，
    然后用摘要替换整个对话历史。
    原始对话会保存到 .transcripts/ 目录。

    Args:
        messages: 原始消息列表
        provider: LLM Provider（自带模型信息）
        transcript_dir: 脚本目录
        tracer: LLM 追踪器（可选）——摘要调用也落 trace
        summary_input_budget: 摘要输入 token 预算（None = 保守兜底；
            由 summary_input_budget(上下文窗口声明) 推导）
        summary_max_tokens: 摘要输出上限配置（None = 下限兜底 10000；
            大输出模型跟随 PLANIFY_MAX_TOKENS 放开，见 summary_output_cap）

    Returns:
        新消息列表，包含摘要和确认消息
    """
    path, summary_messages, summary_system = _prepare_compaction(
        messages, transcript_dir, summary_input_budget
    )

    response = provider.chat(
        messages=summary_messages,
        system=summary_system,
        tools=[],  # 压缩阶段不提供工具
        max_tokens=summary_output_cap(summary_max_tokens),
        tracer=tracer,
    )

    summary = _extract_summary(response)
    return _compacted_messages(path, summary)


async def aauto_compact(
    messages: list,
    provider: LLMProvider,
    transcript_dir: Path,
    *,
    tracer: Optional["LLMTracer"] = None,
    summary_input_budget: Optional[int] = None,
    summary_max_tokens: Optional[int] = None,
) -> list:
    """auto_compact 的异步版（StreamingAgent 在事件循环上直跑时使用，
    经 provider.achat 调摘要，不阻塞事件循环）。行为与同步版一致。

    summary_input_budget: 摘要输入 token 预算（None = 保守兜底；
    由 summary_input_budget(上下文窗口声明) 推导）。
    summary_max_tokens: 摘要输出上限配置（None = 下限兜底 10000）。"""
    path, summary_messages, summary_system = _prepare_compaction(
        messages, transcript_dir, summary_input_budget
    )

    response = await provider.achat(
        messages=summary_messages,
        system=summary_system,
        tools=[],  # 压缩阶段不提供工具
        max_tokens=summary_output_cap(summary_max_tokens),
        tracer=tracer,
    )

    summary = _extract_summary(response)
    return _compacted_messages(path, summary)


def _extract_summary(response) -> str:
    """从摘要响应提取正文（拼接全部 text 块），空摘要抛错。

    thinking 型模型输出预算可能被思考块耗尽（stop_reason=max_tokens、
    content 只有 thinking）——正文为空时**不得**静默落库空摘要（上下文
    会被空摘要替换丢失）；抛错让调用方整体失败：手动压缩转 502，
    自动压缩本轮不发生、下轮重试（历史原样保留，安全）。
    """
    summary = "".join(
        b.text for b in response.content if hasattr(b, "text")
    ).strip()
    if not summary:
        raise RuntimeError(
            "压缩摘要为空：LLM 响应无文本正文（可能输出预算被 thinking "
            "耗尽，stop_reason="
            f"{getattr(response, 'stop_reason', '?')}）——拒绝落库空摘要"
        )
    return summary
