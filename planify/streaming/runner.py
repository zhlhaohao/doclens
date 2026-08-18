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
from typing import Any, Dict, List, Optional

from ..core.llm.types import Tool
from ..core.logging_config import _data_dirname
from .emitter import EventEmitter, SSEEmitter
from .types import StreamEvent, StreamEventType, StreamingConfig, ToolCallState
from .waiter import GlobalResponseWaiter, get_global_waiter
from ..skills.access_state import (
    reset_current_session_id,
    set_current_session_id,
)

logger = logging.getLogger(__name__)


_CONTEXT_MARKER = "The following skills are available for use with the Skill tool"


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
    使用 provider.stream() 实现流式输出（归一化事件）。
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
        session: Optional[Any] = None,
        interrupt_event: Optional[threading.Event] = None,
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
            session: Session 实例
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
        self.session = session
        self._interrupt_event = interrupt_event

        # 工具调用状态追踪
        self._tool_call_states: Dict[int, ToolCallState] = {}

        # 延迟导入压缩模块和提示词构建器（必需组件，导入失败应直接报错）
        from ..context import estimate_tokens, microcompact, auto_compact
        from ..prompts import SystemPromptBuilder

        self._estimate_tokens = estimate_tokens
        self._microcompact = microcompact
        self._auto_compact = auto_compact
        self._prompt_builder = SystemPromptBuilder()

    def get_system_prompt(self) -> str:
        """
        获取系统提示词。

        Returns:
            系统提示词字符串
        """
        workdir = "."
        if self.session:
            workdir = str(self.session.config.workdir)
        elif self.config:
            workdir = getattr(self.config, "workdir", ".")

        # logger.info("System prompt start generate:\n")

        prompt = self._prompt_builder.get(workdir, agent_type="streaming")
        # logger.info(f"System prompt:\n{prompt}")
        return prompt

    async def run_stream(
        self,
        messages: List[Dict],
        user_message: str,
        session_id: str,
    ) -> List[Dict]:
        """
        流式运行代理循环。

        Args:
            messages: 消息历史列表
            user_message: 用户输入消息
            session_id: 会话 ID

        Returns:
            清理后的消息历史（只保留 user 和 assistant 消息，过滤 tool 链）
        """
        # 设置当前 session_id（供工具门禁/load_skill 标记使用）
        ctx_token = set_current_session_id(session_id)

        # 每轮重建 skill-context（descriptions + 已加载 skill body）+ agent.md
        context_parts: List[str] = []

        # 1. skills descriptions + 已加载 skill body
        if self.skills:
            skills_lines: List[str] = []
            desc_text = self.skills.descriptions()
            if desc_text and desc_text != "(no skills)":
                skills_lines.append(
                    "The following skills are available for use with the Skill tool:\n\n"
                    f"{desc_text}"
                )
            skill_state = getattr(self.session, "skill_access_state", None) if self.session else None
            if skill_state is not None and session_id:
                for name in sorted(skill_state.loaded_names(session_id)):
                    body = self.skills.load(name)
                    if body and not body.startswith("Error:"):
                        skills_lines.append(body)
            if skills_lines:
                context_parts.append(
                    "<system-reminder>\n" + "\n\n".join(skills_lines) + "\n</system-reminder>"
                )

        # 2. agent.md 内容
        agent_md_content = ""
        if self.session and self.session.config.assets_dir:
            agent_md_path = self.session.config.assets_dir / "agent.md"
            if agent_md_path.exists():
                agent_md_content = agent_md_path.read_text(encoding="utf-8")
        else:
            global_agent_md = Path.home() / _data_dirname() / "agent.md"
            workdir = "."
            if self.config:
                workdir = getattr(self.config, "workdir", ".")
            local_agent_md = Path(workdir) / _data_dirname() / "agent.md"
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
        # 临时脚本写到 <数据目录>/tmp/<session_id>/，该目录已被索引器/watcher 排除，
        # 由 web 层在应用启动 / 会话删除时清理（doclens/web_v2/tmp_workspace.py）
        if session_id:
            tmp_rel = f"{_data_dirname()}/tmp/{session_id}"
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
            _refresh_or_insert_context(
                messages, _CONTEXT_MARKER, "\n\n".join(context_parts)
            )

        # 添加用户 query（纯文本，不含 skills/agent.md）
        messages.append({"role": "user", "content": user_message})

        system = self.get_system_prompt()
        loop_count = 0
        full_text_output = ""

        try:
            while True:
                loop_count += 1
                self.logger.info(f"[StreamingAgent] 开始循环 #{loop_count}")

                # === 压缩管道 ===
                self._microcompact(messages)
                if self._estimate_tokens(messages) > self.config.compact_threshold:
                    if self._auto_compact and self.session:
                        transcript_dir = str(self.session.config.transcript_dir)
                        compacted = self._auto_compact(
                            messages, self.provider, transcript_dir
                        )
                        if self.session:
                            self.session.replace_messages_in_place(compacted)
                        else:
                            messages[:] = compacted

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

                # 等待队列中的事件被处理（修复事件时序问题）
                await asyncio.sleep(0.1)

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
                await self._execute_tools(messages)

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
        - assistant 消息：content 是字符串（纯文本回复）保留，列表中有 tool_use block 则跳过

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
                    # 列表类型：检查是否包含 tool_use block
                    # 注意：block 可能是 Pydantic 模型，不是 dict
                    has_tool_use = any(
                        getattr(block, "type", None) == "tool_use"
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
    ) -> str:
        """
        执行流式 LLM 调用。

        使用 LLMProvider.stream() 归一化事件接口。

        Args:
            messages: 消息历史
            system: 系统提示词

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

        self.logger.debug(f"[StreamingAgent] 开始流式调用, 消息数: {len(messages)}")

        # 记录完整的请求内容（确保 JSON 合法且完整）
        self._log_request_payload(messages, system)

        # 把工具定义转换为 Tool dataclass
        tool_defs = [
            Tool(
                name=t["name"],
                description=t.get("description", ""),
                input_schema=t.get("input_schema", {"type": "object"}),
            )
            for t in self.tools
        ]

        try:
            # 通过 LLMProvider.stream() 归一化事件流
            for event in self.provider.stream(
                messages=messages,
                system=system,
                tools=tool_defs,
                max_tokens=self.config.max_tokens,
            ):
                # 检查中断
                if self._interrupt_event and self._interrupt_event.is_set():
                    self.logger.info("[StreamingAgent] 流式调用被中断")
                    break

                event_type = event.type

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
                        # 发射工具调用开始事件
                        asyncio.create_task(
                            self.emitter.emit_tool_call(
                                tool_use_id=event.tool_use_id or "",
                                name=event.tool_name or "",
                                input_data={},
                                is_complete=False,
                            )
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
                        asyncio.create_task(
                            self.emitter.emit_text(text, is_end=False)
                        )
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
                        asyncio.create_task(
                            self.emitter.emit_tool_call(
                                tool_use_id=state.tool_use_id,
                                name=state.name,
                                input_data=complete_input,
                                is_complete=True,
                            )
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

        # 发射文本结束事件（如果有文本）
        if current_text:
            asyncio.create_task(self.emitter.emit_text("", is_end=True))

        self.logger.info(f"[StreamingAgent] LLM 调用完成: stop_reason={stop_reason}")
        return stop_reason

    async def _execute_tools(self, messages: List[Dict]) -> None:
        """
        执行待处理的工具调用。

        Args:
            messages: 消息历史
        """
        # 获取最后一条助手消息中的工具调用
        if not messages or messages[-1].get("role") != "assistant":
            return

        assistant_content = messages[-1].get("content", [])
        results = []
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
                output = await _run_handler(name, input_data)

            # 不截断：LLM 上下文与前端 SSE 都需要工具的完整输出
            output_str = str(output)

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
