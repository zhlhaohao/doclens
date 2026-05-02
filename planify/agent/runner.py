#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
代理运行器 - 核心代理循环 (s01)

提供代理主循环和系统提示词生成。
持续调用 LLM 并执行工具，直到模型停止调用工具。
支持多用户多会话架构。
"""

import asyncio
import json
from typing import Any, Dict, List, Optional


class Agent:
    """
    代理类 - 管理代理状态和执行循环。

    代理循环包含：
    1. 微压缩 (s06) - 清理旧的 tool_result
    2. 自动压缩检查 (s06) - 超过阈值时压缩上下文
    3. 后台通知处理 (s08) - 获取已完成的后台任务
    4. 收件箱检查 (s09) - 读取队友消息
    5. LLM 调用
    6. 工具执行
    7. Todo 提醒检查 (s03) - 3 轮未更新后提醒

    关键洞察："整个秘密就是一个模式：while stop_reason == 'tool_use'"
    """

    def __init__(
        self,
        client: Any,
        model: str,
        tools: List[Dict],
        tool_handlers: Dict[str, Any],
        todo_manager: Any,
        bg_manager: Any,
        bus: Any,
        skills_loader: Any,
        config: Dict[str, Any],
        logger: Any,
        session: Optional[Any] = None,
        tool_callback: Optional[callable] = None,
        tool_result_callback: Optional[callable] = None,
    ):
        """
        初始化代理。

        Args:
            client: Anthropic API 客户端
            model: 模型名称
            tools: 工具定义列表
            tool_handlers: 工具处理器字典
            todo_manager: Todo 管理器
            bg_manager: 后台管理器
            bus: 消息总线
            skills_loader: 技能加载器
            config: 配置字典
            logger: 日志记录器
            session: Session 实例（可选）
            tool_callback: 工具调用回调函数 (name, args) -> None
            tool_result_callback: 工具结果回调函数 (name, result) -> None
        """
        self.client = client
        self.model = model
        self.tools = tools
        self.tool_handlers = tool_handlers
        self.todo_mgr = todo_manager
        self.bg_manager = bg_manager
        self.bus = bus
        self.skills = skills_loader
        self.config = config
        self.logger = logger
        self.session = session
        self.tool_callback = tool_callback
        self.tool_result_callback = tool_result_callback

        # 延迟导入以避免循环依赖（使用相对导入）
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
        workdir = self.config.get("workdir", ".")
        return self._prompt_builder.get(workdir, agent_type="agent")

    def run(self, messages: List[Dict]) -> None:
        """
        运行代理循环。

        Args:
            messages: 消息历史列表（将被就地修改）
        """
        system = self.get_system_prompt()
        rounds_without_todo = 0
        loop_count = 0

        while True:
            loop_count += 1

            # === 日志记录 ===
            try:
                msg_json = json.dumps(messages[-3:], ensure_ascii=False, default=str)
                self.logger.info(f"[LLM Call #{loop_count}] Input messages: {msg_json}")
            except Exception:
                self.logger.info(f"[LLM Call #{loop_count}] Input messages: (encoding error)")

            # === s06: 压缩管道 ===
            self._microcompact(messages)
            if self._estimate_tokens(messages) > self.config["token_threshold"]:
                transcript_dir = self.config.get("transcript_dir", ".transcripts")
                compacted = self._auto_compact(messages, self.client, self.model, transcript_dir)

                # 如果有 session，使用线程安全的替换
                if self.session:
                    self.session.replace_messages_in_place(compacted)
                else:
                    messages[:] = compacted

            # === s08: 后台通知 ===
            notifs = self.bg_manager.drain()
            if notifs:
                txt = "\n".join(
                    f"[bg:{n['task_id']}] {n['status']}: {n['result']}"
                    for n in notifs
                )
                messages.append({
                    "role": "user",
                    "content": f"<background-results>\n{txt}\n</background-results>"
                })
                messages.append({
                    "role": "assistant",
                    "content": "Noted background results."
                })

            # === s09: 检查 lead 收件箱 ===
            inbox = self.bus.read_inbox("lead")
            if inbox:
                messages.append({
                    "role": "user",
                    "content": f"<inbox>{json.dumps(inbox, indent=2)}</inbox>"
                })
                messages.append({
                    "role": "assistant",
                    "content": "Noted inbox messages."
                })

            # === LLM 调用 ===
            response = self.client.messages.create(
                model=self.model, system=system, messages=messages,
                tools=self.tools, max_tokens=8000,
            )

            # === 记录响应 ===
            self.logger.info(f"[LLM Call #{loop_count}] Stop reason: {response.stop_reason}")
            try:
                resp_json = json.dumps(
                    [b.model_dump() if hasattr(b, 'model_dump') else str(b) for b in response.content],
                    ensure_ascii=False
                )
                self.logger.debug(f"[LLM Call #{loop_count}] Response: {resp_json[:2000]}")
            except Exception:
                self.logger.debug(f"[LLM Call #{loop_count}] Response: (encoding error)")

            messages.append({"role": "assistant", "content": response.content})
            if response.stop_reason != "tool_use":
                return

            # === 工具执行 ===
            results = []
            used_todo = False
            manual_compress = False

            for block in response.content:
                if block.type == "tool_use":
                    # 触发工具调用回调（用于 CLI 输出）
                    if self.tool_callback:
                        try:
                            self.tool_callback(block.name, block.input)
                        except Exception as e:
                            self.logger.debug(f"tool_callback 失败: {block.name}, {e}")

                    # 记录工具调用
                    try:
                        input_json = json.dumps(block.input, ensure_ascii=False)
                        self.logger.info(f"[Tool Call] {block.name} | Input: {input_json}")
                    except Exception:
                        self.logger.info(f"[Tool Call] {block.name} | Input: (encoding error)")

                    # 检测手动压缩请求
                    if block.name == "compress":
                        manual_compress = True

                    # 执行工具
                    handler = self.tool_handlers.get(block.name)
                    try:
                        if handler:
                            if asyncio.iscoroutinefunction(handler):
                                output = asyncio.run(handler(**block.input))
                            else:
                                output = handler(**block.input)
                        else:
                            output = f"Unknown tool: {block.name}"
                    except Exception as e:
                        output = f"Error: {e}"

                    # 记录工具结果
                    try:
                        output_str = str(output)
                        self.logger.info(f"[Tool Result] {block.name} | Output: {output_str[:500]}")
                    except Exception:
                        self.logger.info(f"[Tool Result] {block.name} | Output: (encoding error)")

                    # 触发工具结果回调
                    if self.tool_result_callback:
                        try:
                            self.tool_result_callback(block.name, str(output))
                        except Exception as e:
                            self.logger.debug(f"tool_result_callback 失败: {block.name}, {e}")

                    results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(output)
                    })

                    if block.name == "TodoWrite":
                        used_todo = True

            # === s03: Todo 提醒 ===
            rounds_without_todo = 0 if used_todo else rounds_without_todo + 1
            if self.todo_mgr.has_open_items() and rounds_without_todo >= 3:
                results.insert(0, {"type": "text", "text": "<reminder>Update your todos.</reminder>"})

            messages.append({"role": "user", "content": results})

            # === s06: 手动压缩 ===
            if manual_compress:
                transcript_dir = self.config.get("transcript_dir", ".transcripts")
                compacted = self._auto_compact(messages, self.client, self.model, transcript_dir)

                # 如果有 session，使用线程安全的替换
                if self.session:
                    self.session.replace_messages_in_place(compacted)
                else:
                    messages[:] = compacted

    @property
    def has_session(self) -> bool:
        """是否绑定了 Session"""
        return self.session is not None


def run_agent_loop(
    messages: List[Dict],
    client: Any,
    model: str,
    tools: List[Dict],
    tool_handlers: Dict[str, Any],
    todo_manager: Any,
    bg_manager: Any,
    bus: Any,
    skills_loader: Any,
    config: Dict[str, Any],
    logger: Any,
    session: Optional[Any] = None,
    tool_callback: Optional[callable] = None,
    tool_result_callback: Optional[callable] = None,
) -> None:
    """
    运行代理循环（函数式接口）。

    此函数持续调用 LLM 并执行工具，直到模型停止调用工具。

    Args:
        messages: 消息历史列表（将被就地修改）
        client: Anthropic API 客户端
        model: 模型名称
        tools: 工具定义列表
        tool_handlers: 工具处理器字典
        todo_manager: Todo 管理器
        bg_manager: 后台管理器
        bus: 消息总线
        skills_loader: 技能加载器
        config: 配置字典
        logger: 日志记录器
        session: Session 实例（可选）
        tool_callback: 工具调用回调函数 (name, args) -> None
        tool_result_callback: 工具结果回调函数 (name, result) -> None
    """
    agent = Agent(
        client=client,
        model=model,
        tools=tools,
        tool_handlers=tool_handlers,
        todo_manager=todo_manager,
        bg_manager=bg_manager,
        bus=bus,
        skills_loader=skills_loader,
        config=config,
        logger=logger,
        session=session,
        tool_callback=tool_callback,
        tool_result_callback=tool_result_callback,
    )
    agent.run(messages)
