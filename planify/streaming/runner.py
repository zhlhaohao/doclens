#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
流式代理运行器

基于 Claude API 流式响应的代理运行器，支持实时输出推理过程。
"""

import asyncio
import enum
import json
import logging
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from anthropic import Anthropic

from .emitter import EventEmitter, SSEEmitter
from .types import StreamEvent, StreamEventType, StreamingConfig, ToolCallState
from .waiter import GlobalResponseWaiter, get_global_waiter

logger = logging.getLogger(__name__)


class StreamingAgent:
    """
    流式代理类

    管理流式代理状态和执行循环。
    使用 client.messages.stream() 实现流式输出。
    """

    def __init__(
        self,
        client: Anthropic,
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
            client: Anthropic API 客户端
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
        # 在 messages 头部注入 skills 和 agent.md（仅一次）
        _SKILLS_MARKER = "The following skills are available for use with the Skill tool"
        has_context = (
            len(messages) >= 2
            and isinstance(messages[0].get("content"), str)
            and _SKILLS_MARKER in messages[0]["content"]
        )

        if not has_context:
            context_parts = []

            # 1. skills description
            if self.skills:
                skills_text = self.skills.descriptions()
                if skills_text:
                    context_parts.append(
                        f"<system-reminder>\n"
                        f"The following skills are available for use with the Skill tool:\n\n"
                        f"{skills_text}\n"
                        f"</system-reminder>"
                    )

            # 2. agent.md 内容
            agent_md_content = ""
            if self.session and self.session.config.assets_dir:
                # Web 模式：从 assets_dir 读取
                agent_md_path = self.session.config.assets_dir / "agent.md"
                if agent_md_path.exists():
                    agent_md_content = agent_md_path.read_text(encoding="utf-8")
            else:
                # CLI 模式：合并全局 + 项目级 agent.md
                from pathlib import Path as _Path
                import os as _os
                global_agent_md = _Path.home() / ".cortex" / "agent.md"
                workdir = "."
                if self.config:
                    workdir = getattr(self.config, "workdir", ".")
                local_agent_md = _Path(workdir) / ".cortex" / "agent.md"
                parts = []
                if global_agent_md.exists():
                    parts.append(global_agent_md.read_text(encoding="utf-8"))
                if local_agent_md.exists():
                    parts.append(local_agent_md.read_text(encoding="utf-8"))
                if parts:
                    agent_md_content = "\n\n".join(parts)

            if agent_md_content:
                context_parts.append(
                    f"<system-reminder>\n"
                    f"As you answer the user's questions, you can use the following context:\n"
                    f"{agent_md_content}\n"
                    f"</system-reminder>"
                )

            if context_parts:
                messages.insert(0, {
                    "role": "user",
                    "content": "\n\n".join(context_parts),
                })
                messages.insert(1, {
                    "role": "assistant",
                    "content": "Noted.",
                })

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
                if self._estimate_tokens(messages) > self.config.token_threshold:
                    if self._auto_compact and self.session:
                        transcript_dir = str(self.session.config.transcript_dir)
                        compacted = self._auto_compact(
                            messages, self.client, self.model, transcript_dir
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
            self.logger.info(f"[StreamingAgent] 请求负载(JSON): {json_str}")
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

        self.logger.debug(f"[StreamingAgent] 开始流式调用, 消息数: {len(messages)}")

        # 记录完整的请求内容（确保 JSON 合法且完整）
        self._log_request_payload(messages, system)

        try:
            # 使用同步客户端的流式 API
            with self.client.messages.stream(
                model=self.model,
                system=system,
                messages=messages,
                tools=self.tools,
                max_tokens=self.config.max_tokens,
            ) as stream:
                for event in stream:
                    # self.logger.debug(f"[StreamingAgent] 收到流事件: type={event.type}")
                    # 检查中断
                    if self._interrupt_event and self._interrupt_event.is_set():
                        self.logger.info("[StreamingAgent] 流式调用被中断")
                        break

                    event_type = event.type

                    if event_type == "content_block_start":
                        block = event.content_block
                        self.logger.debug(
                            f"[StreamingAgent] content_block_start: block={block}"
                        )
                        if hasattr(block, "type"):
                            if block.type == "text":
                                current_text = ""
                            elif block.type == "tool_use":
                                # 工具调用开始
                                index = event.index
                                self._tool_call_states[index] = ToolCallState(
                                    tool_use_id=block.id,
                                    name=block.name,
                                )
                                # 发射工具调用开始事件
                                asyncio.create_task(
                                    self.emitter.emit_tool_call(
                                        tool_use_id=block.id,
                                        name=block.name,
                                        input_data={},
                                        is_complete=False,
                                    )
                                )

                    elif event_type == "content_block_delta":
                        delta = event.delta
                        index = event.index
                        # self.logger.debug(f"[StreamingAgent] content_block_delta: delta={delta}, index={index}")

                        if hasattr(delta, "type"):
                            if delta.type == "text_delta":
                                # 文本增量
                                text = delta.text
                                current_text += text
                                # 发射文本事件
                                asyncio.create_task(
                                    self.emitter.emit_text(text, is_end=False)
                                )

                            elif delta.type == "input_json_delta":
                                # 工具参数增量
                                if index in self._tool_call_states:
                                    state = self._tool_call_states[index]
                                    state.append_chunk(delta.partial_json)

                    elif event_type == "content_block_stop":
                        index = event.index

                        if index in self._tool_call_states:
                            # 工具调用完成
                            state = self._tool_call_states[index]
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

                    elif event_type == "message_delta":
                        # 消息级别更新
                        if hasattr(event, "delta"):
                            if hasattr(event.delta, "stop_reason"):
                                stop_reason = event.delta.stop_reason or "end_turn"

                    elif event_type == "message_stop":
                        # 消息结束
                        break

                # 获取完整消息
                final_message = stream.get_final_message()
                self.logger.debug(
                    f"[StreamingAgent] 完整消息: content={final_message.content}, stop_reason={final_message.stop_reason}"
                )
                assistant_content = list(final_message.content)
                stop_reason = final_message.stop_reason or "end_turn"

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

        for block in assistant_content:
            if not isinstance(block, dict):
                # 可能是 Pydantic 模型或其他类型
                if hasattr(block, "type") and block.type == "tool_use":
                    tool_use_id = block.id
                    name = block.name
                    input_data = block.input if hasattr(block, "input") else {}
                else:
                    continue
            elif block.get("type") != "tool_use":
                continue
            else:
                tool_use_id = block.get("id", "")
                name = block.get("name", "")
                input_data = block.get("input", {})

            self.logger.info(f"[StreamingAgent] 执行工具: {name}")

            # 执行工具
            try:
                handler = self.tool_handlers.get(name)
                if handler:
                    # 检查是否是异步处理器
                    if asyncio.iscoroutinefunction(handler):
                        output = await handler(**input_data)
                    else:
                        # 同步处理器在线程池中执行
                        output = await asyncio.get_event_loop().run_in_executor(
                            None, lambda h=handler, i=input_data: h(**i)
                        )
                else:
                    output = f"Unknown tool: {name}"
            except Exception as e:
                output = f"Error: {e}"
                self.logger.exception(f"[StreamingAgent] 工具执行异常: {name}")

            # 截断过长的输出
            output_str = str(output)
            if len(output_str) > self.config.truncate_tool_output:
                output_str = (
                    output_str[: self.config.truncate_tool_output]
                    + f"\n... (truncated, total {len(output_str)} chars)"
                )

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
