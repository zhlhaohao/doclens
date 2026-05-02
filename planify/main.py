#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Planify - REPL 交互式命令行（简化版）

提供交互式命令行界面，与代理系统进行对话。
支持多用户和会话管理，会话自动创建。

支持的命令：
- 正常对话输入
- /user [id] - 切换用户，自动获取/创建默认会话
- /compact - 手动压缩
- /tasks - 列出任务
- /team - 列出队友
- /inbox - 读取收件箱
- /exit - 退出
"""

import json
import logging
import os
import sys

from pathlib import Path

# 确保父目录在导入路径中（必须在任何其他导入之前）
# backend/app/planify/ -> backend/app/ -> backend/ -> 项目根目录
# 这样无论从根目录还是 backend 目录运行，都能正确导入 app 模块
backend_dir = Path(__file__).parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# 编码模块必须在其他任何导入之前导入
from .core import setup_encoding, apply_safe_stdio

# ============================================================================
# ANSI 颜色代码
# ============================================================================
class Colors:
    """终端输出颜色"""
    USER = '\033[36m'      # 青色 - 用户输入
    TOOL_CALL = '\033[33m' # 黄色 - 工具调用
    TOOL_RESULT = '\033[32m'  # 绿色 - 工具返回结果
    ASSISTANT = '\033[94m'    # 浅蓝色 - LLM 回答
    RESET = '\033[0m'     # 重置颜色
    BOLD = '\033[1m'      # 粗体

# 应用编码设置
setup_encoding()
apply_safe_stdio()

# 重新配置日志
logging.basicConfig(
    level=logging.WARNING,  # 只显示 WARNING 及以上级别的日志
    format='%(asctime)s | %(levelname)s | %(message)s',
    handlers=[]
)

# 应用导入
from .bootstrap import (
    initialize,
    get_manager,
    get_or_create_session,
    get_session_simple,
    init_legacy_session,
)
from .agent import run_agent_loop
from .context import auto_compact
from .cli_history import CommandHistory, input_with_history


# ============================================================================
# REPL 状态管理
# ============================================================================

class REPLState:
    """REPL 状态管理"""

    def __init__(self):
        self.current_user_id: str = "default"
        self.history: list = []
        self.cmd_history = CommandHistory(
            Path.home() / ".planify" / "cmd_history.json"
        )

    @property
    def key(self) -> str:
        """返回当前用户键"""
        return self.current_user_id


# ============================================================================
# REPL 命令处理器
# ============================================================================

class REPLCommands:
    """REPL 命令处理器"""

    def __init__(self, state: REPLState):
        self.state = state

    def handle_user(self, args: list) -> str:
        """切换用户"""
        if not args:
            manager = get_manager()
            sessions = manager.list_all_sessions()
            users = set(s.user_id for s in sessions)
            return f"当前用户: {self.state.current_user_id}\n所有用户: {', '.join(sorted(users)) or '(无)'}"

        user_id = args[0]
        self.state.current_user_id = user_id

        # 自动创建或获取用户的默认会话
        session = get_session_simple(user_id)
        if session:
            # 获取现有会话
            session_id = session.session_id
        else:
            # 创建新的默认会话
            from .core import get_config
            app_config = get_config()
            user_config = {
                "model_id": app_config.get("model_id"),
                "anthropic_api_key": app_config.get("anthropic_api_key"),
                "anthropic_base_url": app_config.get("anthropic_base_url"),
                "token_threshold": app_config.get("token_threshold", 100000),
                "poll_interval": app_config.get("poll_interval", 5),
                "idle_timeout": app_config.get("idle_timeout", 60),
            }
            session = get_or_create_session(user_id, user_config)
            session_id = session.session_id

        return f"切换到用户: {user_id}, 使用会话: {session_id}"

    def handle_compact(self, args: list, session) -> str:
        """手动压缩"""
        if not session:
            return "错误: 无活跃会话"

        if not self.state.history:
            return "无消息历史可压缩"

        compacted = auto_compact(
            self.state.history, session.client, session.model, session.config.transcript_dir
        )
        session.replace_messages_in_place(compacted)
        return f"压缩完成: {len(self.state.history)} 条消息"

    def handle_tasks(self, args: list, session) -> str:
        """列出任务"""
        if not session:
            return "错误: 无活跃会话"
        return session.task_mgr.list_all()

    def handle_team(self, args: list, session) -> str:
        """列出队友"""
        if not session:
            return "错误: 无活跃会话"
        return session.team.list_all()

    def handle_inbox(self, args: list, session) -> str:
        """读取收件箱"""
        if not session:
            return "错误: 无活跃会话"
        inbox = session.bus.read_inbox("lead")
        return json.dumps(inbox, indent=2, ensure_ascii=False)


# ============================================================================
# REPL 主循环
# ============================================================================

def repl() -> None:
    """
    运行交互式命令行界面 (REPL)。
    """
    # 初始化状态
    state = REPLState()
    commands = REPLCommands(state)

    # 显示欢迎信息
    print("=" * 50)
    print("Planify REPL - 简化版")
    print("=" * 50)
    print("可用命令:")
    print("  /user [id]        - 切换用户，自动创建/获取会话")
    print("  /compact         - 手动压缩")
    print("  /tasks           - 列出任务")
    print("  /team            - 列出队友")
    print("  /inbox           - 读取收件箱")
    print("  /exit            - 退出")
    print("=" * 50)

    while True:
        try:
            prompt = f"\033[36m{state.key}\033[0m >> "
            query = input_with_history(prompt, state.cmd_history)
        except (EOFError, KeyboardInterrupt):
            break

        query = query.strip()

        # 退出命令
        if query == "/exit":
            break

        # 解析命令
        parts = query.split(maxsplit=1)
        cmd = parts[0] if parts else ""
        args = parts[1].split() if len(parts) > 1 else []

        # 获取当前用户的默认会话
        session = get_session_simple(state.current_user_id)

        # 处理命令
        result = None
        if cmd == "/user":
            result = commands.handle_user(args)
        elif cmd == "/compact":
            result = commands.handle_compact(args, session)
        elif cmd == "/tasks":
            result = commands.handle_tasks(args, session)
        elif cmd == "/team":
            result = commands.handle_team(args, session)
        elif cmd == "/inbox":
            result = commands.handle_inbox(args, session)
        elif cmd.startswith("/"):
            print(f"未知命令: {cmd}")
            continue

        # 显示命令结果
        if result:
            print(result)
            continue

        # 正常对话
        # 显示用户输入
        print(f"\n{Colors.USER}{Colors.BOLD}You:{Colors.RESET} {Colors.USER}{query}{Colors.RESET}\n")

        if not session:
            # 尝试创建默认会话
            try:
                session = init_legacy_session(state.current_user_id, "default")
                print(f"自动创建会话: default")
            except Exception as e:
                print(f"无法创建会话: {e}")
                continue

        state.history.append({"role": "user", "content": query})
        session.append_message({"role": "user", "content": query})

        def on_tool_call(name: str, args: dict) -> None:
            args_str = json.dumps(args, ensure_ascii=False, indent=2)
            # 在 JSON 格式化后，将转义的换行符替换为真实换行，让代码更易读
            args_str = args_str.replace('\\n', '\n')
            lines = args_str.split('\n')
            if len(lines) > 10:
                args_str = '\n'.join(lines[:10]) + '\n  ...'
            print(f"{Colors.TOOL_CALL}{Colors.BOLD}Tool:{Colors.RESET} {Colors.TOOL_CALL}{name}({args_str}){Colors.RESET}\n")

        def on_tool_result(name: str, result: str) -> None:
            result_str = result
            lines = result_str.split('\n')
            if len(lines) > 10:
                result_str = '\n'.join(lines[:10]) + '\n  ...'
            print(f"{Colors.TOOL_RESULT}{result_str}{Colors.RESET}\n")

        run_agent_loop(
            messages=state.history,
            client=session.client,
            model=session.model,
            tools=session.tools,
            tool_handlers=session.tool_handlers,
            todo_manager=session.todo_mgr,
            bg_manager=session.bg_mgr,
            bus=session.bus,
            skills_loader=session.skills,
            config=session.config.__dict__,
            logger=session.logger,
            session=session,
            tool_callback=on_tool_call,
            tool_result_callback=on_tool_result,
        )

        # 同步消息历史
        session.set_messages(state.history)

        # 打印最终回答（只打印自然语言，跳过 tool_use）
        if state.history and len(state.history) >= 2:
            last_msg = state.history[-1]
            if last_msg.get("role") == "assistant":
                content = last_msg.get("content")
                if isinstance(content, list):
                    text_parts = []
                    for block in content:
                        if hasattr(block, "text") and block.text:
                            text_parts.append(block.text)
                    if text_parts:
                        full_text = ''.join(text_parts)
                        lines = full_text.split('\n')
                        if len(lines) > 10:
                            full_text = '\n'.join(lines[:10]) + '\n  ...'
                        print(f"{Colors.ASSISTANT}{Colors.BOLD}Assistant:{Colors.RESET}")
                        print(f"{Colors.ASSISTANT}{full_text}{Colors.RESET}")
                elif isinstance(content, str) and content:
                    lines = content.split('\n')
                    if len(lines) > 10:
                        content = '\n'.join(lines[:10]) + '\n  ...'
                    print(f"{Colors.ASSISTANT}{Colors.BOLD}Assistant:{Colors.RESET}")
                    print(f"{Colors.ASSISTANT}{content}{Colors.RESET}")
        print()


# ============================================================================
# 主入口
# ============================================================================

if __name__ == "__main__":
    try:
        # 初始化应用
        manager = initialize()

        # 显示管理器信息
        print(f"SessionManager 初始化完成: {manager}")

        # 运行 REPL
        repl()

    except KeyboardInterrupt:
        print("\nInterrupted. Exiting...")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        raise
