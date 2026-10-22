"""子代理运行器 (s04)

临时委派代理进行隔离探索或工作。

生命周期：
    spawn -> 执行 -> 返回摘要 -> 销毁

与队友 (s09) 的区别：
- 子代理：临时，任务完成后销毁，返回摘要
- 队友：持久化，空闲后可以继续工作直到显式关闭
"""

from __future__ import annotations

import json
import logging
from typing import Callable, Dict

logger = logging.getLogger("planify.subagent")

from ..core.llm.provider import LLMProvider
from ..core.llm.types import Tool, ToolUseBlock

# prompts 模块导入（支持直接运行 cli.py 和作为模块运行两种方式）
try:
    # 当作为模块运行时（python -m backend.app.planify.main）
    from ..prompts import build_system_prompt
except ImportError:
    # 当直接运行 cli.py 时，使用绝对导入
    from planify.prompts import build_system_prompt


# retryable 异常的退避重试参数
_RETRY_MAX_ATTEMPTS = 4    # 总尝试次数（含首次）
_RETRY_BASE_DELAY_S = 3.0  # 首次退避秒数，逐次 ×2
_RETRY_MAX_DELAY_S = 60.0  # 单次退避上限

# 轮次预算三机制（与 StreamingAgent 同哲学：先劝后断、断了留话）：
# 1) 同参死循环早警：连续 N 轮工具签名完全相同 → 注入提醒（不等软提醒）；
# 2) 软提醒：预算将尽（剩 1/6）时注入收尾提醒，给模型自我收编机会；
# 3) 截断标记：跑满轮数仍未收尾 → 摘要前缀显式标记（主代理可据此续派/接手）。
_IDENTICAL_ROUNDS_LIMIT = 3
# 软提醒阈值 = max(1, max_rounds - ceil(max_rounds / 6))：剩约 1/6 预算时提醒
_SOFT_REMIND_DIVISOR = 6
# 跑满轮数的截断标记前缀（与 check_background 的 [running] 前缀同思路：
# 字符串契约，主代理读到标记自行决策——续派子代理 / 自己接手 / 如实转述）
ROUND_LIMIT_PREFIX = "[round-limit-reached]"


def _round_signature(tool_calls) -> tuple:
    """轮次工具签名：(工具名, 参数 JSON 规范串) 序列——同签名 = 同参重复调用。

    与 StreamingAgent._round_signature 同构（复制而非 import：subagent 侧
    不依赖 streaming 层，保持模块单向依赖 streaming -> subagent 之外零耦合）。
    """
    import json as _json

    return tuple(
        (name, _json.dumps(inp, sort_keys=True, ensure_ascii=False))
        for name, inp in tool_calls
    )


def _soft_remind_round(max_rounds: int) -> int:
    """软提醒生效轮号：预算剩约 1/6 时（至少留 1 轮余量）。"""
    import math

    return max(1, max_rounds - math.ceil(max_rounds / _SOFT_REMIND_DIVISOR))


def _chat_with_retry(
    client: LLMProvider,
    messages: list,
    system: str,
    tools: list,
    max_tokens: int,
    tracer,
    *,
    agent_type: str,
    round_no: int,
):
    """client.chat 的退避重试包装。

    - retryable=True 的异常（LLMRateLimitError/LLMNetworkError，429/网络）：
      指数退避重试至多 _RETRY_MAX_ATTEMPTS 次；全部耗尽返回 None（调用方
      以失败收场）。多子代理并发下 429 是常态而非异常（2026-10-03 实测：
      21 并发 → 网关限流，SDK 内建 2 次重试耗尽后子代理整体报废）。
    - 不可重试（认证/上下文超限/未知异常）：立即失败——保留全栈日志供排查。
    """
    import time

    for attempt in range(1, _RETRY_MAX_ATTEMPTS + 1):
        try:
            return client.chat(
                messages=messages,
                system=system,
                tools=tools,
                max_tokens=max_tokens,
                tracer=tracer,
            )
        except Exception as e:
            retryable = bool(getattr(e, "retryable", False))
            if not retryable or attempt == _RETRY_MAX_ATTEMPTS:
                logger.exception(
                    "子代理 LLM 调用失败 (agent_type=%s, max_tokens=%d, "
                    "轮=%d, attempt=%d/%d, retryable=%s): %s",
                    agent_type, max_tokens, round_no, attempt,
                    _RETRY_MAX_ATTEMPTS, retryable, e,
                )
                return None
            delay = min(_RETRY_BASE_DELAY_S * (2 ** (attempt - 1)), _RETRY_MAX_DELAY_S)
            logger.warning(
                "[subagent] LLM 调用可重试失败，%.1fs 后重试 "
                "(agent_type=%s, 轮=%d, attempt=%d/%d): %s",
                delay, agent_type, round_no, attempt, _RETRY_MAX_ATTEMPTS, e,
            )
            time.sleep(delay)
    return None


def run_subagent(
    prompt: str,
    agent_type: str,
    workdir,
    client: LLMProvider,
    model: str,
    run_bash: Callable,
    run_read: Callable,
    run_write: Callable,
    run_edit: Callable,
    extra_tools: list | None = None,
    extra_handlers: Dict[str, Callable] | None = None,
    disabled_tools: list | None = None,
    max_tokens: int = 8000,
    max_rounds: int = 30,
) -> str:
    """
    启动子代理执行隔离任务

    创建临时代理循环，执行任务后返回摘要，然后销毁。

    Args:
        prompt: 任务提示
        agent_type: 代理类型
            - "Explore": 只读工具（bash, read_file, grep, glob, TodoWrite），用于探索代码库
            - "general-purpose": 读写工具（bash, read_file, write_file, edit_file, grep, glob, TodoWrite），用于修改文件
        workdir: 工作目录
        client: LLM Provider 实例
        model: 模型 ID
        run_bash: Bash 执行函数
        run_read: 文件读取函数
        run_write: 文件写入函数
        run_edit: 文件编辑函数
        extra_tools: 追加的工具定义（如宿主应用注入的 read_document/file_info；
            检索链路注入的 grep/glob 也走此路——见 tools/registry.py handle_task）
        extra_handlers: extra_tools 对应的处理器
        disabled_tools: 需从子代理工具面剔除的工具名（黑名单 PLANIFY_DISABLED_TOOLS
            与主注册表里缺失的基础工具）——子代理工具表是固定构造的，不跟随
            主注册表过滤，必须显式剔除才能与主代理保持一致
        max_tokens: 子代理每轮 LLM 调用的最大输出 tokens（由宿主应用按对话模型参数传入；
            过小会截断子代理的最终摘要，表现为"只总结了前几章"）
        max_rounds: 轮次预算上限（默认 30；宿主可配置，如 doclens 的
            PLANIFY_MAX_SUBAGENT_ROUNDS）。预算三机制：连续同参调用注入
            死循环提醒、预算将尽注入收尾提醒、跑满仍未收尾则摘要带
            ROUND_LIMIT_PREFIX 截断标记（主代理可据此续派/接手）。

    Returns:
        任务执行摘要；跑满 max_rounds 仍未收尾时，摘要带
        "[round-limit-reached]" 前缀（任务未完成信号，主代理可据此
        续派子代理 / 自己接手 / 如实转述部分结果）。
    """
    # 根据代理类型配置可用工具
    sub_tools = [
        {
            "name": "bash",
            "description": "运行 shell 命令",
            "input_schema": {
                "type": "object",
                "properties": {"command": {"type": "string"}},
                "required": ["command"],
            },
        },
        {
            "name": "read_file",
            "description": (
                "读取文件内容（纯文本），输出带行号前缀（行号<TAB>内容，1-based）。"
                "大文件用 offset/limit 按行分块读取；不传时从头读，"
                "超输出预算按行截断并提示续读位置。"
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "offset": {
                        "type": "integer",
                        "description": "起始行号（可选，1-based，默认 1）。文件过大分批读时用它续读。",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "读取行数（可选）。不传则读到输出预算上限。",
                    },
                },
                "required": ["path"],
            },
        },
    ]

    # 非 Explore 类型代理可以写入文件
    if agent_type != "Explore":
        sub_tools.extend(
            [
                {
                    "name": "write_file",
                    "description": "写入文件内容",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "content": {"type": "string"},
                        },
                        "required": ["path", "content"],
                    },
                },
                {
                    "name": "edit_file",
                    "description": (
                        "替换文件中的文本。old_text 必须在文件中唯一（出现多次会报错："
                        "补充更多上下文使其唯一，或传 replace_all=true 全部替换）。"
                        "old_text/new_text 均不得包含 read_file 输出的行号前缀"
                        "（行号<TAB>部分），只取前缀之后的实际内容。"
                    ),
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "old_text": {"type": "string"},
                            "new_text": {"type": "string"},
                            "replace_all": {
                                "type": "boolean",
                                "description": "替换全部出现位置（默认 false，仅允许唯一匹配）。",
                            },
                        },
                        "required": ["path", "old_text", "new_text"],
                    },
                },
            ]
        )

    # 工具处理器 - 直接使用传入的处理器函数
    sub_handlers = {
        "bash": run_bash,
        "read_file": run_read,
        "write_file": run_write,
        "edit_file": run_edit,
    }

    # 宿主应用注入的额外工具（如 doclens 的 read_document/file_info——
    # 子代理读 PDF/DOCX 等二进制格式的唯一途径）
    if extra_tools:
        sub_tools.extend(extra_tools)
    if extra_handlers:
        sub_handlers.update(extra_handlers)

    # 黑名单 / 主注册表缺失的工具：从子代理工具面剔除（schema + handler 同步，
    # 避免模型看到 schema 却调用到空 handler）
    if disabled_tools:
        blocked = set(disabled_tools)
        sub_tools = [t for t in sub_tools if t.get("name") not in blocked]
        sub_handlers = {k: v for k, v in sub_handlers.items() if k not in blocked}

    # 子代理消息循环
    workdir_str = str(workdir)
    system_prompt = build_system_prompt(workdir=workdir_str, agent_type="subagent")
    sub_msgs = [{"role": "user", "content": prompt}]

    # LLM 追踪（调试/缓存命中率观测）：子代理独立文件（时间戳命名）
    from ..core.llm.trace import LLMTracer

    tracer = LLMTracer.create(label=f"subagent-{agent_type}", workdir=workdir)

    # 把工具定义转换为 Tool dataclass
    tool_defs = [
        Tool(
            name=t["name"],
            description=t.get("description", ""),
            input_schema=t.get("input_schema", {"type": "object"}),
        )
        for t in sub_tools
    ]

    # 子代理主循环（预算三机制：同参早警 → 软提醒 → 截断标记，见模块头注释）
    resp = None
    assistant_blocks: list[dict] = []
    last_round_signature: tuple | None = None
    identical_rounds = 0
    soft_remind_from = _soft_remind_round(max_rounds)
    limit_hit = False  # 跑满轮数仍未收尾（返回值带截断标记）
    for round_no in range(1, max_rounds + 1):
        # 运行可见性：每轮一行 INFO（无此日志时子代理静默运行，挂死与
        # 正常读码在日志/终端上无法区分——2026-10-03 五组直派挂死实测）
        logger.info(
            "[subagent] 轮 %d/%d (agent_type=%s, messages=%d)",
            round_no, max_rounds, agent_type, len(sub_msgs),
        )
        # LLM 调用（通过 LLMProvider 抽象接口）。
        # retryable 异常（429 限流 / 网络抖动）指数退避重试——多子代理并发
        # 场景 429 是常态而非异常（2026-10-03 实测：21 并发 → 网关限流，
        # SDK 内建 2 次重试耗尽后子代理整体报废）；不可重试错误照旧立即失败。
        resp = _chat_with_retry(
            client, sub_msgs, system_prompt, tool_defs, max_tokens, tracer,
            agent_type=agent_type, round_no=round_no,
        )
        if resp is None:
            return f"(subagent failed after retries: round={round_no})"

        # 把响应内容块序列化为 dict（兼容后续 _execute_tools 风格）
        assistant_blocks = []
        for b in resp.content:
            if isinstance(b, dict):
                assistant_blocks.append(b)
                continue
            block_type = getattr(b, "type", None)
            if block_type == "text":
                assistant_blocks.append({"type": "text", "text": getattr(b, "text", "")})
            elif block_type == "tool_use":
                assistant_blocks.append({
                    "type": "tool_use",
                    "id": b.id,
                    "name": b.name,
                    "input": dict(b.input),
                })
            else:
                # 未知类型：降级为 dict 形式
                assistant_blocks.append({"type": block_type or "unknown", "raw": str(b)})
        sub_msgs.append({"role": "assistant", "content": assistant_blocks})

        if resp.stop_reason != "tool_use":
            break

        # ---- 预算机制 ①：同参死循环早警 ----
        # 本轮全部工具调用签名与上一轮完全相同且连续达到阈值 → 真死循环
        # 形态（同工具同参反复调用），立即注入针对性提醒，不等软提醒。
        # 检测放在工具执行前：提醒属于「下一轮 LLM 输入」，注入后模型
        # 在下一次调用时读到。
        round_tool_calls = [
            (b.get("name", ""), b.get("input", {}))
            for b in assistant_blocks
            if b.get("type") == "tool_use"
        ]
        signature = _round_signature(round_tool_calls)
        if signature == last_round_signature:
            identical_rounds += 1
        else:
            identical_rounds = 1
            last_round_signature = signature
        if round_tool_calls and identical_rounds >= _IDENTICAL_ROUNDS_LIMIT:
            logger.warning(
                "[subagent] 连续 %d 轮同参调用，注入死循环提醒 "
                "(agent_type=%s, 轮 %d/%d)",
                identical_rounds, agent_type, round_no, max_rounds,
            )
            sub_msgs.append({
                "role": "user",
                "content": (
                    "<system-reminder>\n你已连续多轮用完全相同的参数调用同一工具，"
                    "这通常意味着没有进展。请改变策略、换参数，或停止调用工具"
                    "并基于已有信息输出总结。\n</system-reminder>"
                ),
            })
            sub_msgs.append({"role": "assistant", "content": "收到，我会调整策略或总结。"})
            continue

        # ---- 预算机制 ②：软提醒（预算将尽，先劝后断）----
        # 剩约 1/6 预算时注入一次收尾提醒，给模型自我收编机会——
        # 跑满上限的静默截断（机制③）是不可恢复的最后手段。
        if round_no == soft_remind_from:
            logger.info(
                "[subagent] 轮次预算将尽，注入收尾提醒 (轮 %d/%d)",
                round_no, max_rounds,
            )
            sub_msgs.append({
                "role": "user",
                "content": (
                    "<system-reminder>\n轮次预算即将用尽"
                    f"（当前第 {round_no} 轮 / 上限 {max_rounds} 轮）。"
                    "请停止发起不必要的工具调用，立即基于已有发现汇总输出。"
                    "\n</system-reminder>"
                ),
            })
            sub_msgs.append({"role": "assistant", "content": "明白，我现在开始汇总。"})

        # 执行工具调用
        tool_names = [
            b.get("name", "?") for b in assistant_blocks if b.get("type") == "tool_use"
        ]
        if tool_names:
            logger.info(
                "[subagent] 执行工具: %s (agent_type=%s)", ", ".join(tool_names), agent_type
            )
        results = []
        for b in assistant_blocks:
            if b.get("type") != "tool_use":
                continue
            block_name = b.get("name", "")
            block_id = b.get("id", "")
            block_input = b.get("input", {})
            h = sub_handlers.get(block_name, lambda **kw: "Unknown tool")
            output = h(**block_input) if h else f"Unknown tool: {block_name}"
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block_id,
                    "content": str(output)[:50000],
                }
            )

        sub_msgs.append({"role": "user", "content": results})

    else:
        # for 循环未 break（跑满 max_rounds 仍要工具）→ 截断标记
        limit_hit = True
        logger.warning(
            "[subagent] 轮次预算耗尽（%d 轮），返回带截断标记的部分摘要 "
            "(agent_type=%s)",
            max_rounds, agent_type,
        )

    # 返回摘要（循环正常结束 = 最后一轮无工具调用的 assistant 文本；
    # 跑满轮数仍要工具时，返回最后一轮文本 + 截断标记，主代理可据此
    # 分辨「未完成」与「已完成」——旧版静默返回部分摘要，主代理会把
    # 半截摘要当全量结论用）
    if resp:
        summary = "".join(
            b.get("text", "") for b in assistant_blocks if b.get("type") == "text"
        )
        if limit_hit:
            return (
                f"{ROUND_LIMIT_PREFIX} 子代理在 {max_rounds} 轮预算内未能完成任务，"
                f"以下为部分结果（可能不完整；如需继续，可派新子代理从断点续做"
                f"或由主代理接手）：\n{summary}"
            )
        return summary
    return "(subagent failed)"
