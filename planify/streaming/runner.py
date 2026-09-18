#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
流式代理运行器

基于 LLMProvider 流式接口的代理运行器，支持实时输出推理过程。
"""

from __future__ import annotations

import asyncio
import enum
import json
import logging
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..core.llm.trace import LLMTracer
from ..core.llm.types import Tool
from ..core.logging_config import data_dirname
from .emitter import EventEmitter, SSEEmitter
from .types import StreamEvent, StreamEventType, StreamingConfig, ToolCallState
from .waiter import GlobalResponseWaiter, get_global_waiter
from ..skills.access_state import (
    get_current_session_id,
    reset_current_session_id,
    set_current_session_id,
)
from ..tools.guard import (
    ACTION_CONFIRM,
    GUARD_TIMEOUT_SECONDS,
    classify_tool_call,
    denied_message,
    make_guard_question,
    parse_grant_response,
    record_grant,
)

logger = logging.getLogger(__name__)


# head-context 注入消息的标记（公共常量：宿主落库/回放时靠它识别注入消息对）
CONTEXT_MARKER = "The following skills are available for use with the Skill tool"

# === 工具轮次预算（防死循环熔断）常量与纯函数（2026-09-18）===
# 轮询等待工具：返回 "[running] …" = 后台任务未完成。等待 ≠ 检索不收敛，
# 纯轮询轮不计入轮次预算——否则长构建期间正常轮询会误触熔断，模型被
# 「如实作答」提醒逼成「未找到/失败」的错误收场。
_POLL_TOOL_NAME = "check_background"
# 连续同参调用轮数达到该值 → 真死循环形态，立即注入针对性提醒（不等软阈值）
_IDENTICAL_ROUNDS_LIMIT = 3


def _is_pure_poll_round(calls: List[Tuple[str, dict, str]]) -> bool:
    """本轮是否为纯轮询等待：全部调用为 check_background 且均处 running 态。"""
    return bool(calls) and all(
        name == _POLL_TOOL_NAME and output.startswith("[running]")
        for name, _input, output in calls
    )


def _round_signature(calls: List[Tuple[str, dict, str]]) -> tuple:
    """轮次工具签名：(工具名, 规范化参数 JSON) 序列——同签名 = 同参重复调用。"""
    return tuple(
        (
            name,
            json.dumps(
                input_data, sort_keys=True, ensure_ascii=False, default=str
            ),
        )
        for name, input_data, _output in calls
    )


def _refresh_or_insert_context(
    messages: List[Dict], marker: str, new_content: str
) -> None:
    """刷新 messages 开头的 skill-context 消息。

    在前 6 条里找带 marker 的 user 消息则原地替换（新建 dict，不改原对象）；
    否则 insert 到开头并补一条 assistant 'Noted.'。
    """
    for i, msg in enumerate(messages[:6]):
        content = msg.get("content")
        if (
            msg.get("role") == "user"
            and isinstance(content, str)
            and marker in content
        ):
            messages[i] = {**msg, "content": new_content}
            return
    messages.insert(0, {"role": "user", "content": new_content})
    messages.insert(1, {"role": "assistant", "content": "Noted."})


class StreamingAgent:
    """
    流式代理类

    管理流式代理状态和执行循环。
    使用 provider.astream() 实现流式输出（归一化事件，async 客户端不阻塞事件循环）。
    """

    def __init__(
        self,
        client: Any,
        model: str,
        tools: List[Dict],
        tool_handlers: Dict[str, Any],
        emitter: EventEmitter,
        config: Optional[StreamingConfig] = None,
        waiter: Optional[GlobalResponseWaiter] = None,
        todo_manager: Optional[Any] = None,
        bg_manager: Optional[Any] = None,
        bus: Optional[Any] = None,
        skills_loader: Optional[Any] = None,
        logger_instance: Optional[logging.Logger] = None,
        runtime: Optional[Any] = None,
        interrupt_event: Optional[threading.Event] = None,
        system_prompt_extra: Optional[str] = None,
        tracer: Optional[LLMTracer] = None,
    ):
        """
        初始化流式代理。

        Args:
            client: LLM Provider 实例（实际类型为 LLMProvider）
            model: 模型名称
            tools: 工具定义列表
            tool_handlers: 工具处理器字典
            emitter: 事件发射器
            config: 流式配置
            waiter: 用户响应等待器
            todo_manager: Todo 管理器
            bg_manager: 后台管理器
            bus: 消息总线
            skills_loader: 技能加载器
            logger_instance: 日志记录器
            runtime: AgentRuntime 实例
            system_prompt_extra: 宿主应用注入的额外 system prompt 段（可选，
                领域策略如知识库优先由宿主经此注入，planify 自身保持通用）
            tracer: LLM 追踪器（可选，按会话创建；None 即不落盘）
        """
        self.client = client
        # provider 是 client 的别名（LLMProvider 抽象接口），
        # 所有调用点已迁移到 provider.*。self.client 保留作为兼容字段。
        self.provider = client
        self.model = model
        self.tools = tools
        self.tool_handlers = tool_handlers
        self.emitter = emitter
        self.config = config or StreamingConfig()
        self.waiter = waiter or get_global_waiter()
        self.todo_mgr = todo_manager
        self.bg_manager = bg_manager
        self.bus = bus
        self.skills = skills_loader
        self.logger = logger_instance or logger
        self.runtime = runtime
        self._interrupt_event = interrupt_event
        self._system_prompt_extra = system_prompt_extra
        # LLM 追踪（调试/缓存命中率观测）：由调用方按会话创建，None 即不落盘
        self.tracer = tracer

        # 本轮消息起点下标（run_stream 内全部头部/尾部注入完成、追加 user
        # query 之后记录）：web 链路落库 raw_messages 时以此切片。
        # 不能用调用方在 run_stream 前捕获的 len(messages)——头部注入
        # （_refresh_or_insert_context 无 marker 时 insert 消息对）会把
        # 既有消息整体后移，旧下标切片会漏进上一轮末尾的消息（孤儿
        # tool_result → OpenAI 兼容后端 400）。
        self.round_start_index: Optional[int] = None

        # 压缩事件打标（宿主轮末读取持久化，planify 不感知存储）：
        # - last_compaction：本轮最后一次 auto compact 的结果，形状
        #   {"messages": [压缩后消息序列], "pre_tokens": 压缩前估算 token}；
        #   同轮多次压缩自然覆盖（前一次已被后一次摘要）。
        # - round_cleared_tool_use_ids：本轮 microcompact 实际清理的
        #   tool_use_id 累积（循环每转幂等，"[cleared]" 长度<100 不重复清理）。
        # 均在 run_stream 开头重置（CLI/TUI 复用实例时防串轮）。
        self.last_compaction: Optional[Dict[str, Any]] = None
        self.round_cleared_tool_use_ids: List[str] = []

        # 工具调用状态追踪
        self._tool_call_states: Dict[int, ToolCallState] = {}

        # 延迟导入压缩模块和提示词构建器（必需组件，导入失败应直接报错）
        from ..context import (
            estimate_tokens,
            estimate_tokens_with_usage,
            microcompact,
            auto_compact,
            aauto_compact,
        )
        from ..context.compact import MICROCOMPACT_GATE_RATIO, summary_input_budget
        from ..prompts import SystemPromptBuilder

        self._estimate_tokens = estimate_tokens
        self._estimate_tokens_with_usage = estimate_tokens_with_usage
        self._summary_input_budget = summary_input_budget
        self._microcompact = microcompact
        self._auto_compact = auto_compact
        # 事件循环上直跑必须用异步压缩（同步 chat 会阻塞整个 loop 数秒~数十秒）
        self._aauto_compact = aauto_compact
        self._microcompact_gate_ratio = MICROCOMPACT_GATE_RATIO
        self._prompt_builder = SystemPromptBuilder()

        # usage-based token 估算基线（借鉴 Claude Code 的
        # tokenCountWithEstimation——其注释标注为 autocompact 阈值判断的
        # canonical 口径）：(total_input, request_messages_len) = 最近一次
        # LLM 调用的实测总输入（input + cache_read + cache_creation，含
        # system prompt 与工具表，真实 tokenizer 计数）及该次请求的
        # messages 长度。此后新增消息按 ÷4 估增量——误差限增量部分而非
        # 全历史，且补上纯 ÷4 不含 system/工具表的盲区。
        # 失效条件：auto_compact 整体替换历史（见压缩分支）；suppress_tools
        # 的终答调用不更新（tools 置空会使 total_input 偏小）。
        self._usage_baseline: Optional[Tuple[int, int]] = None

    def get_system_prompt(self) -> str:
        """
        获取系统提示词。

        Returns:
            系统提示词字符串
        """
        workdir = "."
        if self.runtime:
            workdir = str(self.runtime.config.workdir)
        elif self.config:
            workdir = getattr(self.config, "workdir", ".")

        # logger.info("System prompt start generate:\n")

        prompt = self._prompt_builder.get(
            workdir, agent_type="streaming", extra_prompt=self._system_prompt_extra
        )
        # logger.info(f"System prompt:\n{prompt}")
        return prompt

    def _inject_head_context(self, messages: List[Dict], session_id: str) -> None:
        """重建/刷新头部 skill-context 消息对（可重入）。

        每轮 run_stream 开头调用；auto compact 把历史整体替换后也重新
        调用（压缩吃掉头部注入，本轮后续循环需要 KB 指导在场）。
        内容三部分（均稳定部分）：skills 描述清单 + agent.md + 临时文件
        工作区指引——已加载 skill body 不放这里（见
        _inject_loaded_skill_bodies）。
        """
        context_parts: List[str] = []

        # 1. skills descriptions（稳定：仅安装/卸载技能时变化；含技能根目录事实，
        #    恒非空——空清单也注入目录，防对话安装时装错地方）
        if self.skills:
            desc_text = self.skills.descriptions()
            if desc_text:
                context_parts.append(
                    "<system-reminder>\n"
                    "The following skills are available for use with the Skill tool:\n\n"
                    f"{desc_text}\n"
                    "</system-reminder>"
                )

        # 2. agent.md 内容
        agent_md_content = ""
        if self.runtime and self.runtime.config.assets_dir:
            agent_md_path = self.runtime.config.assets_dir / "agent.md"
            if agent_md_path.exists():
                agent_md_content = agent_md_path.read_text(encoding="utf-8")
        else:
            global_agent_md = Path.home() / data_dirname() / "agent.md"
            workdir = "."
            if self.config:
                workdir = getattr(self.config, "workdir", ".")
            local_agent_md = Path(workdir) / data_dirname() / "agent.md"
            md_parts = []
            if global_agent_md.exists():
                md_parts.append(global_agent_md.read_text(encoding="utf-8"))
            if local_agent_md.exists():
                md_parts.append(local_agent_md.read_text(encoding="utf-8"))
            if md_parts:
                agent_md_content = "\n\n".join(md_parts)

        if agent_md_content:
            context_parts.append(
                "<system-reminder>\n"
                "As you answer the user's questions, you can use the following context:\n"
                f"{agent_md_content}\n"
                "</system-reminder>"
            )

        # 3. 临时文件工作区指引（仅 prompt 软引导，工具层不做硬重定向）：
        # 临时脚本写到 <数据目录>/tmp/<session_id>/，该目录由宿主应用负责
        # 从索引/监控中排除并定期清理。
        if session_id:
            tmp_rel = f"{data_dirname()}/tmp/{session_id}"
            context_parts.append(
                "<system-reminder>\n"
                "# Temporary Files\n\n"
                f"为完成任务而临时生成并运行的代码/脚本文件，必须写入 `{tmp_rel}/` 目录"
                "（相对工作目录，不存在时用 write_file 直接写入即可，父目录会自动创建），"
                "并在该目录内运行；禁止把临时脚本写到知识库根目录或其他文档目录；"
                "运行产生的中间输出（日志、临时数据等）也放在该目录。\n"
                "只有用户明确要求保存的成果文件（文档、报告等）才可写入知识库的正常位置。\n"
                "</system-reminder>"
            )

        if context_parts:
            combined = "\n\n".join(context_parts)
            if CONTEXT_MARKER not in combined:
                # 保证 marker 存在：否则 _refresh_or_insert_context 找不到旧消息，
                # 会每轮重复 insert 导致历史无限增长
                combined = f"{CONTEXT_MARKER}:\n\n(no skills)\n\n" + combined
            _refresh_or_insert_context(messages, CONTEXT_MARKER, combined)

    def _inject_loaded_skill_bodies(self, messages: List[Dict], session_id: str) -> None:
        """已加载 skill body → 尾部消息对注入（可重入）。

        每轮 run_stream 开头调用；auto compact 替换历史后也重新调用
        （压缩吃掉已注入的 skill body）。按 <loaded-skill name="...">
        marker 去重：web 层每轮从 DB 重建历史（不含注入消息），故每轮
        重注；若调用方复用返回的历史（含注入消息），marker 已在则跳过。
        """
        if self.skills and session_id and self.runtime:
            skill_state = getattr(self.runtime, "skill_access_state", None)
            if skill_state is not None:
                for name in sorted(skill_state.loaded_names(session_id)):
                    skill_marker = f'<loaded-skill name="{name}">'
                    already = any(
                        m.get("role") == "user"
                        and isinstance(m.get("content"), str)
                        and skill_marker in m["content"]
                        for m in messages
                    )
                    if already:
                        continue
                    body = self.skills.load(name)
                    if body and not body.startswith("Error:"):
                        messages.append({
                            "role": "user",
                            "content": (
                                "<system-reminder>\n"
                                f"{skill_marker}\n{body}\n</loaded-skill>\n"
                                "</system-reminder>"
                            ),
                        })
                        messages.append({"role": "assistant", "content": "Noted."})

    async def run_stream(
        self,
        messages: List[Dict],
        user_message: str,
        session_id: str,
    ) -> List[Dict]:
        """
        流式运行代理循环。

        Args:
            messages: 消息历史列表。**注意：就地 mutate**（追加注入消息 /
                user query / assistant 响应 / tool_result），调用方若要保留
                入参原样需自行拷贝。
            user_message: 用户输入消息
            session_id: 会话 ID

        Returns:
            清理后的消息历史（只保留 user/assistant 文本消息，过滤 tool 链）。
            两种消费语义：
            - CLI/TUI 路径以返回值为下一轮输入（doclens run_query / planify cli.py）；
            - Web 路径（doclens chat.py）**丢弃返回值**——历史真相在宿主 SQLite，
              每轮从 DB 重建（tool_trace + message_ai_raw 成对回放）。
        """
        # 设置当前 session_id（供工具门禁/load_skill 标记使用）
        ctx_token = set_current_session_id(session_id)

        # 本轮压缩打标重置：last_compaction / 清理 id 累积按轮隔离
        # （chat.py 每请求新建实例天然隔离；CLI/TUI 复用 agent 时防串轮）
        self.last_compaction = None
        self.round_cleared_tool_use_ids = []

        # 每轮重建 skill-context（头部稳定部分 + 尾部已加载 skill body，
        # 两个注入方法均可重入——压缩管道替换历史后同样调用，见压缩分支）
        self._inject_head_context(messages, session_id)
        self._inject_loaded_skill_bodies(messages, session_id)

        # 添加用户 query（纯文本，不含 skills/agent.md）
        messages.append({"role": "user", "content": user_message})
        # 全部注入（头部 context / 尾部 skill body）已完成，此后追加的才是
        # 本轮消息；记录起点供宿主落库切片（见 __init__ 注释）。
        self.round_start_index = len(messages) - 1

        system = self.get_system_prompt()
        loop_count = 0
        # 工具轮次预算状态（防死循环熔断，见循环内三机制注释）
        tool_rounds = 0  # 计数轮（纯轮询轮不计入）
        self._last_round_signature: Optional[tuple] = None
        self._identical_rounds = 0
        self._saw_pending_bg = False
        full_text_output = ""

        try:
            while True:
                loop_count += 1
                self.logger.info(f"[StreamingAgent] 开始循环 #{loop_count}")

                # === 压缩管道 ===
                # token 估算（usage-based：实测基线 + 增量 ÷4）算一次两用——
                # microcompact 门控与 auto_compact 阈值共用，避免重复全量估算
                baseline = self._usage_baseline
                estimated = self._estimate_tokens_with_usage(
                    messages,
                    baseline[0] if baseline else None,
                    baseline[1] if baseline else None,
                )
                # 缓存友好：清理推迟到逼近 auto_compact 阈值（默认 80%）才触发，
                # 避免历史中段单点突变打废整体前缀缓存（国产端点双倍代价）
                cleared = self._microcompact(
                    messages,
                    min_estimated_tokens=int(
                        self.config.compact_threshold * self._microcompact_gate_ratio
                    ),
                    estimated_tokens=estimated,
                )
                if cleared:
                    self.round_cleared_tool_use_ids.extend(cleared)
                if estimated > self.config.compact_threshold:
                    if self._aauto_compact and self.runtime:
                        # 压缩 transcript 目录：宿主注入优先（doclens 注入
                        # .cortex/transcripts，避免落盘触发 FileWatcher 回路）；
                        # 未注入时退回 <workdir>/.transcripts/
                        # （runtime.config.transcript_dir 是 .planify/transcript.json
                        # 文件路径，语义不符，勿用）
                        transcript_dir = (
                            getattr(self.runtime.config, "compact_transcript_dir", None)
                            or Path(self.runtime.config.workdir) / ".transcripts"
                        )
                        compacted = await self._aauto_compact(
                            messages, self.provider, transcript_dir,
                            tracer=self.tracer,
                            summary_input_budget=self._summary_input_budget(
                                self.config.context_window,
                                self.config.max_tokens,
                            ),
                            # 大输出模型跟随 PLANIFY_MAX_TOKENS 放开摘要上限
                            #（下限 10000 由 summary_output_cap 兜底）
                            summary_max_tokens=self.config.max_tokens,
                        )
                        # 必须就地替换本地循环列表，否则本轮后续循环仍用
                        # 未压缩历史（每轮重复触发压缩、transcript 越写越大）
                        messages[:] = compacted
                        if self.runtime:
                            self.runtime.replace_messages_in_place(compacted)
                        # usage 基线随历史整体替换失效（其 request_len 指向
                        # 的旧前缀已不存在）；下次 LLM 响应重新建立基线
                        self._usage_baseline = None
                        # 打标供宿主轮末持久化（压缩即事实：摘要落库一次
                        # 冻结，回放侧从边界投影，不再每轮重压缩）
                        self.last_compaction = {
                            "messages": compacted,
                            "pre_tokens": estimated,
                        }
                        # 压缩吃掉了头部 context 与已加载 skill body——立即
                        # 重注入（本轮后续工具循环需要 KB 指导在场）。
                        self._inject_head_context(messages, session_id)
                        self._inject_loaded_skill_bodies(messages, session_id)
                        # 压缩是用户可感知的上下文跳变（模型此后基于摘要续接），
                        # 发中性通知——Web 宿主转 toast（ADR-0026 决议 7 的
                        # 补充：对话流仍不插分隔条）
                        await self.emitter.emit_notice(
                            f"上下文已达约 {estimated // 1000}K tokens，"
                            "已自动压缩会话历史（早期对话由摘要替代）"
                        )
                        # 全部重注入完成后重置本轮起点：此后追加的才是本轮
                        # 新消息（摘要对在起点之前，不会漏进 raw_messages；
                        # 若在注入前重置，_inject_head_context 的头部 insert
                        # 会把摘要对推进切片区间，与 compacted 条目重复落库）
                        self.round_start_index = len(messages)

                # === 后台通知 ===
                if self.bg_manager:
                    notifs = self.bg_manager.drain()
                    if notifs:
                        txt = "\n".join(
                            f"[bg:{n['task_id']}] {n['status']}: {n['result']}"
                            for n in notifs
                        )
                        messages.append(
                            {
                                "role": "user",
                                "content": f"<background-results>\n{txt}\n</background-results>",
                            }
                        )
                        messages.append(
                            {
                                "role": "assistant",
                                "content": "Noted background results.",
                            }
                        )

                # === 收件箱检查 ===
                if self.bus:
                    inbox = self.bus.read_inbox("lead")
                    if inbox:
                        messages.append(
                            {
                                "role": "user",
                                "content": f"<inbox>{json.dumps(inbox, indent=2)}</inbox>",
                            }
                        )
                        messages.append(
                            {"role": "assistant", "content": "Noted inbox messages."}
                        )

                # === LLM 流式调用 ===
                stop_reason = await self._stream_llm_call(messages, system)

                # 检查停止原因
                if stop_reason != "tool_use":
                    # 发射完成事件
                    summary = full_text_output[:500] if full_text_output else None
                    await self.emitter.emit_done(session_id, summary)
                    self.logger.info(
                        f"[StreamingAgent] 循环结束: stop_reason={stop_reason}"
                    )
                    return self._cleanup_messages(messages)

                # === 工具执行 ===
                round_calls = await self._execute_tools(messages)

                # === 工具轮次兜底（防死循环熔断；宿主经 StreamingConfig 注入阈值）===
                # 与 interrupt_event 完全独立：不 set event、不 break。三机制：
                # 1) 纯轮询不计入预算：本轮全部调用为 check_background 且均处
                #    [running] 态——等待后台任务 ≠ 检索不收敛（长构建期间正常
                #    轮询不得误触熔断）；仅记 _saw_pending_bg 供软阈值文案分化；
                # 2) 同参死循环早警：连续 3 轮工具签名完全相同（真死循环形态
                #    ——同工具同参数反复调用）→ 立即注入针对性提醒，不等软阈值；
                # 3) 软/硬阈值照旧：软阈值每轮注入收尾提醒（文案感知「后台仍在
                #    跑」，防模型把等待误报成失败）；硬阈值以 tools=[] 强制终答。
                if round_calls:
                    pure_poll = _is_pure_poll_round(round_calls)
                    reminder: Optional[str] = None
                    if pure_poll:
                        self._saw_pending_bg = True
                    else:
                        tool_rounds += 1
                        # 硬阈值：强制终答（计数轮达限；轮询不消耗预算）
                        if (
                            self.config.force_answer_rounds
                            and tool_rounds >= self.config.force_answer_rounds
                        ):
                            self.logger.warning(
                                f"[StreamingAgent] 工具轮数达硬阈值 "
                                f"{self.config.force_answer_rounds}，强制终答"
                            )
                            await self._stream_llm_call(
                                messages, system, suppress_tools=True
                            )
                            summary = (
                                full_text_output[:500] if full_text_output else None
                            )
                            await self.emitter.emit_done(session_id, summary)
                            return self._cleanup_messages(messages)
                        # 同参签名追踪（纯轮询轮不参与——等待合法，见上）
                        signature = _round_signature(round_calls)
                        if signature == self._last_round_signature:
                            self._identical_rounds += 1
                        else:
                            self._identical_rounds = 1
                            self._last_round_signature = signature
                        if self._identical_rounds >= _IDENTICAL_ROUNDS_LIMIT:
                            self.logger.warning(
                                "[StreamingAgent] 连续 %d 轮同参工具调用，"
                                "注入死循环提醒",
                                self._identical_rounds,
                            )
                            reminder = (
                                "You have called the exact same tools with "
                                "identical arguments "
                                f"{self._identical_rounds} times in a row with "
                                "no progress. This is a loop: do NOT repeat the "
                                "identical call. Change your approach (different "
                                "tool, query, or parameters) or stop calling "
                                "tools and give your best final answer with what "
                                "you have."
                            )
                        elif (
                            self.config.max_tool_rounds
                            and tool_rounds > self.config.max_tool_rounds
                        ):
                            reminder = (
                                self.config.tool_round_limit_reminder
                                or "You have made many tool calls without converging. "
                                "Stop calling tools now and give your best final answer "
                                "based on what you have; if the information was not found, "
                                "say so honestly."
                            )
                            if self._saw_pending_bg:
                                # 本轮曾轮询后台任务：等待未完成 ≠ 失败——
                                # 防模型被「如实作答」逼成「构建出错」式误报
                                reminder += (
                                    " Note: a background task may still be "
                                    "running; if your answer depends on it, "
                                    "tell the user it is still running and can "
                                    "be checked later with check_background — "
                                    "do not claim it failed."
                                )
                    if reminder:
                        # 追加在消息尾部，不破坏前缀缓存（与 bg/inbox 注入同理）
                        messages.append(
                            {
                                "role": "user",
                                "content": (
                                    "<system-reminder>\n"
                                    f"{reminder}\n"
                                    "</system-reminder>"
                                ),
                            }
                        )
                        messages.append(
                            {
                                "role": "assistant",
                                "content": "Understood. I will stop calling tools and answer now.",
                            }
                        )

        except Exception as e:
            self.logger.exception(f"[StreamingAgent] 运行异常: {e}")
            await self.emitter.emit_error(str(e), code="AGENT_ERROR")
            return self._cleanup_messages(messages)
        finally:
            reset_current_session_id(ctx_token)

    def _cleanup_messages(self, messages: List[Dict]) -> List[Dict]:
        """
        清理消息历史，只保留 user 和 assistant 消息，过滤 tool 链。

        规则：
        - user 消息：content 是字符串（系统注入的 skills/agent.md）保留，列表（tool_result）跳过
        - assistant 消息：content 是字符串（纯文本回复）保留；
          列表为空（中断残留）跳过；列表中有 tool_use block 则跳过

        tool_use 检测必须同时兼容 dict（本 runner 自己 append 的形态）与
        Pydantic 模型（属性访问）——只查 getattr 会让 dict block 永远漏检，
        孤儿 tool_use（无配对 tool_result）进入下轮历史，触发 Anthropic 400。

        Args:
            messages: 完整消息历史

        Returns:
            清理后的消息历史
        """
        cleaned = []
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content")

            if role == "user":
                # user 消息：content 是字符串（系统注入的 skills/agent.md）保留
                if isinstance(content, str):
                    cleaned.append(msg)
                # 列表类型（tool_result）跳过
            elif role == "assistant":
                if isinstance(content, str):
                    # 纯文本回复保留
                    cleaned.append(msg)
                elif isinstance(content, list):
                    if not content:
                        # 中断残留的空 assistant（content=[]）：回放无意义，
                        # 且空 content 数组可能触发 API 400
                        continue
                    # 列表类型：检查是否包含 tool_use block
                    # 注意：block 可能是 dict（本 runner append 的）或 Pydantic 模型
                    has_tool_use = any(
                        (isinstance(block, dict) and block.get("type") == "tool_use")
                        or getattr(block, "type", None) == "tool_use"
                        for block in content
                    )
                    if not has_tool_use:
                        # 没有 tool_use 的 assistant 消息（纯文本/错误等）保留
                        cleaned.append(msg)
                    # 包含 tool_use 的 assistant 消息跳过

        return cleaned

    def _log_request_payload(self, messages: List[Dict], system: str) -> None:
        """
        记录完整的请求负载为合法 JSON（用于调试和分析）。

        确保：
        - JSON 格式合法，可被 json.loads() 解析
        - 内容完整，不截断
        - 包含完整 messages、system、tools 等字段
        """
        try:
            # 序列化前清理 messages，将 Pydantic 模型等转换为 dict
            serializable_messages = [self._make_serializable(msg) for msg in messages]
            payload = {
                "model": self.model,
                "max_tokens": self.config.max_tokens,
                "system": system,
                "messages": serializable_messages,
                "tools": self._make_serializable(self.tools),
            }
            # 使用 ensure_ascii=False 支持中文
            json_str = json.dumps(payload, ensure_ascii=False, indent=None)
            self.logger.debug(f"[StreamingAgent] 请求负载(JSON): {json_str}")
        except Exception as e:
            self.logger.warning(f"[StreamingAgent] 请求负载记录失败: {e}")

    def _make_serializable(self, obj: Any) -> Any:
        """
        将对象转换为 JSON 可序列化的格式。

        处理 Pydantic 模型、枚举、mappingproxy 等类型。
        """
        if isinstance(obj, dict):
            return {k: self._make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [self._make_serializable(item) for item in obj]
        elif hasattr(obj, "model_dump"):
            # Pydantic v2 模型
            return self._make_serializable(obj.model_dump())
        elif hasattr(obj, "dict"):
            # Pydantic v1 模型
            return self._make_serializable(obj.dict())
        elif isinstance(obj, type):
            # 类对象本身，转为字符串避免 mappingproxy 序列化问题
            return str(obj)
        elif hasattr(obj, "__dict__"):
            # 普通对象，转 dict（可能返回 mappingproxy，用 dict() 转换）
            return self._make_serializable(dict(obj.__dict__))
        elif isinstance(obj, enum.Enum):
            return obj.value
        else:
            return obj

    async def _stream_llm_call(
        self,
        messages: List[Dict],
        system: str,
        suppress_tools: bool = False,
    ) -> str:
        """
        执行流式 LLM 调用。

        使用 LLMProvider.astream() 归一化事件接口（async 迭代）。

        Args:
            messages: 消息历史
            system: 系统提示词
            suppress_tools: True 时置空工具定义（强制文本作答，硬阈值终答用）

        Returns:
            停止原因
        """
        # 重置工具调用状态
        self._tool_call_states.clear()

        # 用于收集完整响应
        assistant_content: List[Any] = []
        current_text = ""
        stop_reason = "end_turn"

        # 累积每个 block 的状态（按 block_index）
        block_text_parts: Dict[int, List[str]] = {}
        block_tool_states: Dict[int, ToolCallState] = {}
        text_started_index: Optional[int] = None
        # token 用量（缓存命中率观测）：message_start 带输入/缓存字段，
        # message_delta 带 output_tokens；同键取最大（字段单调不减，避免
        # message_delta 的 0 值覆盖 message_start 的缓存计数）
        call_usage: Dict[str, int] = {}

        self.logger.debug(f"[StreamingAgent] 开始流式调用, 消息数: {len(messages)}")

        # 记录完整的请求内容（确保 JSON 合法且完整）
        self._log_request_payload(messages, system)

        # 把工具定义转换为 Tool dataclass（suppress_tools 时置空强制文本作答）
        tool_defs = [] if suppress_tools else [
            Tool(
                name=t["name"],
                description=t.get("description", ""),
                input_schema=t.get("input_schema", {"type": "object"}),
            )
            for t in self.tools
        ]

        # 本次请求的输入 messages 长度（usage 基线锚点）：astream 拿到的
        # 输入就是此刻的 messages 全量，usage 的 input 类字段精确覆盖它
        request_len = len(messages)

        try:
            # 通过 LLMProvider.astream() 归一化事件流（async 客户端，不阻塞事件循环）
            async for event in self.provider.astream(
                messages=messages,
                system=system,
                tools=tool_defs,
                max_tokens=self.config.max_tokens,
                tracer=self.tracer,
            ):
                # 检查中断
                if self._interrupt_event and self._interrupt_event.is_set():
                    self.logger.info("[StreamingAgent] 流式调用被中断")
                    break

                event_type = event.type

                if event.usage:
                    for k, v in event.usage.items():
                        if v and v > call_usage.get(k, 0):
                            call_usage[k] = v

                if event_type == "content_block_start":
                    index = event.block_index
                    if index is None:
                        continue
                    block_type = event.block_type
                    if block_type == "text":
                        text_started_index = index
                        block_text_parts.setdefault(index, [])
                    elif block_type == "tool_use":
                        # 工具调用开始
                        self._tool_call_states[index] = ToolCallState(
                            tool_use_id=event.tool_use_id or "",
                            name=event.tool_name or "",
                        )
                        block_tool_states[index] = self._tool_call_states[index]
                        # 发射工具调用开始事件（直接 await：emit 是轻操作且天然保序）
                        await self.emitter.emit_tool_call(
                            tool_use_id=event.tool_use_id or "",
                            name=event.tool_name or "",
                            input_data={},
                            is_complete=False,
                        )

                elif event_type == "content_block_delta":
                    index = event.block_index
                    if index is None:
                        continue
                    if event.text_delta:
                        text = event.text_delta
                        current_text += text
                        block_text_parts.setdefault(index, []).append(text)
                        # 发射文本事件
                        await self.emitter.emit_text(text, is_end=False)
                    elif event.input_json_delta:
                        # 工具参数增量
                        if index in self._tool_call_states:
                            state = self._tool_call_states[index]
                            state.append_chunk(event.input_json_delta)

                elif event_type == "content_block_stop":
                    index = event.block_index
                    if index is None:
                        continue
                    if index in block_tool_states:
                        # 工具调用完成
                        state = block_tool_states[index]
                        complete_input = state.get_complete_input()

                        # 发射工具调用完成事件
                        await self.emitter.emit_tool_call(
                            tool_use_id=state.tool_use_id,
                            name=state.name,
                            input_data=complete_input,
                            is_complete=True,
                        )
                        assistant_content.append({
                            "type": "tool_use",
                            "id": state.tool_use_id,
                            "name": state.name,
                            "input": complete_input,
                        })
                    elif index in block_text_parts:
                        # 文本块完成
                        text = "".join(block_text_parts[index])
                        if text:
                            assistant_content.append({
                                "type": "text",
                                "text": text,
                            })

                elif event_type == "message_delta":
                    # 消息级别更新
                    if event.stop_reason:
                        stop_reason = event.stop_reason

                elif event_type == "message_stop":
                    # 消息结束
                    break

        except Exception as e:
            self.logger.exception(f"[StreamingAgent] LLM 调用异常: {e}")
            raise

        # 添加助手响应到消息历史
        messages.append({"role": "assistant", "content": assistant_content})

        # token 用量日志：前缀缓存命中率观测（cache_read / 总输入）
        if call_usage:
            cache_read = call_usage.get("cache_read_input_tokens", 0)
            total_in = (
                call_usage.get("input_tokens", 0)
                + cache_read
                + call_usage.get("cache_creation_input_tokens", 0)
            )
            hit_pct = cache_read * 100 // total_in if total_in else 0
            self.logger.info(
                f"[StreamingAgent] usage: input={call_usage.get('input_tokens', 0)} "
                f"cache_read={cache_read} "
                f"cache_creation={call_usage.get('cache_creation_input_tokens', 0)} "
                f"output={call_usage.get('output_tokens', 0)} "
                f"(前缀命中率 {hit_pct}%)"
            )
            # usage-based 压缩估算基线（见 __init__ 注释）：实测总输入覆盖
            # 本次请求全部输入（含 system prompt 与工具表），后续新增消息
            # 只需 ÷4 估增量。suppress_tools 的终答调用不更新——tools 置空
            # 会使 total_in 偏小，污染正常调用的基线
            if not suppress_tools and total_in > 0:
                self._usage_baseline = (total_in, request_len)
            # 透传给宿主（2026-09-17：GUI 会话信息弹窗展示上下文占用）；
            # 一轮工具链多次调用各发一次，最后一次即该轮峰值占用
            await self.emitter.emit_usage(call_usage)

        # 发射文本结束事件（如果有文本）
        if current_text:
            await self.emitter.emit_text("", is_end=True)

        self.logger.info(f"[StreamingAgent] LLM 调用完成: stop_reason={stop_reason}")
        return stop_reason

    async def _execute_tools(
        self, messages: List[Dict]
    ) -> Optional[List[Tuple[str, dict, str]]]:
        """
        执行待处理的工具调用。

        Args:
            messages: 消息历史

        Returns:
            本轮调用明细 [(工具名, input, 输出文本), ...]——供主循环做
            轮次预算判定（纯轮询识别 / 同参签名）；无工具调用时 None。
        """
        # 获取最后一条助手消息中的工具调用
        if not messages or messages[-1].get("role") != "assistant":
            return None

        assistant_content = messages[-1].get("content", [])
        results = []
        round_calls: List[Tuple[str, dict, str]] = []
        used_todo = False

        # 先解析本轮全部工具调用（保持块顺序）
        pending: List[tuple] = []  # (tool_use_id, name, input_data)
        for block in assistant_content:
            if not isinstance(block, dict):
                # 可能是 Pydantic 模型或其他类型
                if hasattr(block, "type") and block.type == "tool_use":
                    pending.append((
                        block.id, block.name,
                        block.input if hasattr(block, "input") else {},
                    ))
                continue
            elif block.get("type") != "tool_use":
                continue
            else:
                pending.append((
                    block.get("id", ""),
                    block.get("name", ""),
                    block.get("input", {}),
                ))

        async def _run_handler(name: str, input_data: dict):
            handler = self.tool_handlers.get(name)
            if not handler:
                return f"Unknown tool: {name}"
            try:
                # 检查是否是异步处理器
                if asyncio.iscoroutinefunction(handler):
                    return await handler(**input_data)
                # 同步处理器在线程池中执行
                # 使用 asyncio.to_thread 以传播 contextvars.ContextVar
                # （门禁依赖 get_current_session_id()，默认 ThreadPoolExecutor
                # 不会跨线程复制上下文，会导致门禁静默失效）
                return await asyncio.to_thread(handler, **input_data)
            except Exception as e:
                self.logger.exception(f"[StreamingAgent] 工具执行异常: {name}")
                return f"Error: {e}"

        # ---- 外部访问门禁（ADR-0021）：confirm 判定走交互确认 ----
        # deny/allow/未授权-无渠道等场景由各 handler 内的判定兜底（注册层
        # 包装），此处只负责「有渠道时把 confirm 变成用户决策」。

        def _guard_workdir() -> Path:
            if self.runtime:
                return Path(self.runtime.config.workdir)
            if self.config:
                return Path(getattr(self.config, "workdir", "."))
            return Path(".")

        async def _guard_confirm(verdict) -> bool:
            """经 emitter/waiter 弹门禁确认；通过则记账。

            无 emit_ask_questions 渠道、超时、中断、未选允许——一律
            False（fail-closed，与子代理无渠道行为对齐）。
            """
            emit_questions = getattr(self.emitter, "emit_ask_questions", None)
            if emit_questions is None or self.waiter is None:
                self.logger.warning(
                    "[StreamingAgent] 门禁确认无交互渠道（emitter 未实现 "
                    "emit_ask_questions），fail-closed 拒绝: %s", verdict.tool
                )
                return False
            request_id = f"guard_{uuid.uuid4().hex[:8]}"
            sid = get_current_session_id()
            await self.waiter.create_request(request_id, session_id=sid)
            await emit_questions(
                request_id=request_id, questions=[make_guard_question(verdict)]
            )
            self.logger.info(
                "[StreamingAgent] 门禁确认等待用户响应: %s (%s, %s)",
                request_id, verdict.tool, verdict.mode,
            )
            try:
                response = await self.waiter.wait_for_response(
                    request_id, timeout=GUARD_TIMEOUT_SECONDS
                )
            except TimeoutError:
                self.logger.warning("[StreamingAgent] 门禁确认超时: %s", request_id)
                return False
            except Exception as e:  # noqa: BLE001
                self.logger.exception("[StreamingAgent] 门禁确认异常: %s", e)
                return False
            if response.get("interrupted"):
                self.logger.info("[StreamingAgent] 门禁确认被中断: %s", request_id)
                return False
            if parse_grant_response(response):
                record_grant(sid, list(verdict.targets), verdict.mode)
                self.logger.info(
                    "[StreamingAgent] 门禁确认通过: %s -> %s",
                    request_id, [str(t) for t in verdict.targets],
                )
                return True
            self.logger.info("[StreamingAgent] 门禁确认被拒绝: %s", request_id)
            return False

        async def _run_guarded(name: str, input_data: dict):
            workdir = _guard_workdir()
            verdict = classify_tool_call(name, input_data, workdir)
            if verdict.action == ACTION_CONFIRM:
                if not await _guard_confirm(verdict):
                    return denied_message(verdict)
            return await _run_handler(name, input_data)

        # task（子代理）并发：一轮消息中 ≥2 个 task 调用时 gather 并发执行
        # （summarize-files 等技能按文件并发派子代理）；其余工具保持顺序执行
        # （TodoWrite / ask_user_question 等依赖顺序与阻塞语义）。
        precomputed: Dict[str, Any] = {}
        task_calls = [p for p in pending if p[1] == "task"]
        if len(task_calls) >= 2:
            self.logger.info(f"[StreamingAgent] 并发执行 {len(task_calls)} 个 task 子代理")
            outputs = await asyncio.gather(
                *[_run_handler(name, inp) for _tid, name, inp in task_calls]
            )
            for (tid, _name, _inp), out in zip(task_calls, outputs):
                precomputed[tid] = out

        for tool_use_id, name, input_data in pending:
            self.logger.info(f"[StreamingAgent] 执行工具: {name}")

            if tool_use_id in precomputed:
                output = precomputed[tool_use_id]
            else:
                output = await _run_guarded(name, input_data)

            # 不截断：LLM 上下文与前端 SSE 都需要工具的完整输出
            output_str = str(output)

            round_calls.append((name, input_data, output_str))

            # 发射工具结果事件
            is_error = output_str.startswith("Error:")
            await self.emitter.emit_tool_result(
                tool_use_id=tool_use_id,
                name=name,
                output=output_str,
                is_error=is_error,
            )

            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": output_str,
                    # is_error 与 web 端 DB 回放块（sessions_store.get_chat_history）
                    # 同形同序：跨轮请求逐字节一致，prompt 前缀缓存不被回放差异打断
                    "is_error": is_error,
                }
            )

            if name == "TodoWrite":
                used_todo = True

        # === Todo 提醒 ===
        if self.todo_mgr:
            # 这里简化处理，不追踪 rounds_without_todo
            pass

        # 添加工具结果到消息历史
        if results:
            messages.append({"role": "user", "content": results})
        return round_calls or None
