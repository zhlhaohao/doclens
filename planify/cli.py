#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Planify CLI - 单用户模式入口

单用户模式：当前工作目录直接作为会话目录，无 .sessions/ 子目录。
适合个人开发、本地使用场景。

使用方法:
    python cli.py
"""

import json
import logging
import os
import sys
import threading
import time

from pathlib import Path

# 确保父目录和当前目录在导入路径中（必须在任何其他导入之前）
# cli.py 直接运行时需要把 backend/app/ 加到 sys.path，这样 `from planify.xxx import yyy` 才能正确解析
planify_dir = Path(__file__).parent
backend_app_dir = planify_dir.parent
backend_dir = backend_app_dir.parent
project_root = backend_dir.parent

# 移除已存在的路径避免重复
for p in [str(project_root), str(backend_dir), str(backend_app_dir), str(planify_dir)]:
    if p in sys.path:
        sys.path.remove(p)

# 按正确顺序添加（后添加的优先级高）
# 顺序：planify_dir, backend_app_dir, backend, project_root
# 确保 local 模块（third_party/planify）优先于 E:\github\planify 被找到
for p in [str(planify_dir), str(backend_app_dir), str(backend_dir), str(project_root)]:
    if p:
        sys.path.append(p)

# 命令历史（自实现，不依赖 readline）
from planify.cli_history import CommandHistory, input_with_history

# 编码模块必须在其他任何导入之前导入
from planify.core import setup_encoding, apply_safe_stdio

# ============================================================================
# 全局中断事件
# ============================================================================
_interrupt_event = threading.Event()


class EscapeKeyWatcher:
    """ESC 键监听器，在后台线程中监听 ESC 键，设置全局中断事件"""

    def __init__(self, interrupt_event: threading.Event):
        self.interrupt_event = interrupt_event
        self._running = False
        self._thread = None

    def start(self):
        """启动监听线程"""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()

    def stop(self):
        """停止监听线程"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=0.5)

    def _listen_loop(self):
        """监听 ESC 键的循环（跨平台）"""
        if sys.platform == "win32":
            self._listen_windows()
        else:
            self._listen_unix()

    def _listen_windows(self):
        """Windows 平台监听"""
        import msvcrt

        while self._running:
            if msvcrt.kbhit():
                key = msvcrt.getch()
                # ESC 键的 ASCII 码是 27
                if key == b"\x1b":
                    print(
                        f"\n{Colors.ASSISTANT}[正在中断...]{Colors.RESET}", flush=True
                    )
                    self.interrupt_event.set()
                    break
            time.sleep(0.05)

    def _listen_unix(self):
        """Unix 平台监听"""
        import select
        import sys
        import termios
        import tty

        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setcbreak(fd)
            while self._running:
                if select.select([sys.stdin], [], [], 0.1)[0]:
                    key = sys.stdin.read(1)
                    if key == "\x1b":  # ESC
                        self.interrupt_event.set()
                        print(f"\n{Colors.ASSISTANT}[已中断]{Colors.RESET}")
                        break
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)


# ============================================================================
# ANSI 颜色代码
# ============================================================================
class Colors:
    """终端输出颜色"""

    USER = "\033[36m"  # 青色 - 用户输入
    TOOL_CALL = "\033[33m"  # 黄色 - 工具调用
    TOOL_RESULT = "\033[32m"  # 绿色 - 工具返回结果
    ASSISTANT = "\033[94m"  # 浅蓝色 - LLM 回答
    RESET = "\033[0m"  # 重置颜色
    BOLD = "\033[1m"  # 粗体


# ============================================================================
# ESC 键中断监听器
# ============================================================================
class EscapeInterruptWatcher:
    """ESC 键中断监听器（跨平台）"""

    def __init__(self):
        self._interrupted = threading.Event()
        self._running = False
        self._thread = None

    def start(self):
        """启动监听"""
        self._interrupted.clear()
        self._running = True
        self._thread = threading.Thread(target=self._watch_keyboard, daemon=True)
        self._thread.start()

    def stop(self):
        """停止监听"""
        self._running = False
        self._interrupted.set()

    def is_interrupted(self) -> bool:
        """检查是否被中断"""
        return self._interrupted.is_set()

    def _watch_keyboard(self):
        """键盘监听线程"""
        try:
            if sys.platform == "win32":
                self._watch_windows()
            else:
                self._watch_unix()
        except Exception:
            pass  # 忽略监听错误

    def _watch_windows(self):
        """Windows 平台监听"""
        import msvcrt

        while self._running:
            if msvcrt.kbhit():
                ch = msvcrt.getch()
                # ESC 键码为 27
                if ch == b"\x1b":
                    print(
                        f"\n{Colors.ASSISTANT}[正在中断...]{Colors.RESET}", flush=True
                    )
                    self._interrupted.set()
                    break
            time.sleep(0.05)

    def _watch_unix(self):
        """Unix 平台监听"""
        import select
        import termios
        import tty

        # 保存原始终端设置
        old_settings = termios.tcgetattr(sys.stdin)
        try:
            tty.setcbreak(sys.stdin.fileno())
            while self._running:
                if select.select([sys.stdin], [], [], 0.05)[0]:
                    ch = sys.stdin.read(1)
                    if ch == "\x1b":  # ESC
                        self._interrupted.set()
                        print(f"\n{Colors.ASSISTANT}[已中断]{Colors.RESET}")
                        break
        finally:
            termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)


# 全局中断监听器
_escape_watcher = EscapeInterruptWatcher()


# 应用编码设置
setup_encoding()
apply_safe_stdio()

# 重新配置日志（使用统一的 setup_logging）
from planify.core.logging_config import setup_logging
from pathlib import Path
setup_logging(log_dir=Path(".cortex") / "logs", console_output=False, log_level=logging.WARNING)

# 禁用 SQLAlchemy SQL 日志输出到控制台
# 使用 propagate=False 彻底阻止 SQL 输出到任何 handler
_sql_logger = logging.getLogger("sqlalchemy.engine.Engine")
_sql_logger.setLevel(logging.WARNING)
_sql_logger.propagate = False
# 清除所有已存在的 handlers（防止 echo=True 添加的 handler 仍然输出）
for _h in _sql_logger.handlers[:]:
    _sql_logger.removeHandler(_h)
_sql_logger.addHandler(logging.NullHandler())

# 应用导入（需要在 sys.path 配置后）
from planify.core import (
    get_config,
    setup_logging,
    SessionConfig,
    Session,
    init_zhipu_client,
)  # noqa: E402
from planify.managers import (
    TodoManager,
    TaskManager,
    BackgroundManager,
    TeammateManager,
)  # noqa: E402
from planify.messaging import MessageBus  # noqa: E402
from planify.skills import SkillLoader  # noqa: E402
from planify.tools import build_tool_registry, bind_user_interaction_handlers  # noqa: E402
from planify.tools.basic import (
    make_basic_tools,
    run_bash,
    run_read,
    run_write,
    run_edit,
)  # noqa: E402
from planify.context import auto_compact  # noqa: E402

# 流式模块导入
from planify.streaming import (
    CLIEventEmitter,
    StreamingAgent,
    StreamingConfig,
    get_global_waiter,
)  # noqa: E402


def setup_single_user_session():
    """设置单用户会话"""
    # 获取当前工作目录（用户 cd 到的目录）
    workdir = Path.cwd()
    print(f"\n{'=' * 50}")
    print(f"工作目录: {workdir}")
    print(f"{'=' * 50}\n")

    # 获取配置（由 get_config 统一加载 .env 文件）
    config = get_config(load_env=True)

    # 初始化 ZhipuAI 客户端
    zhipu_client, zhipu_model_id = init_zhipu_client(
        config.get("zhipu_api_key"),
        config.get("zhipu_model_id", "glm-4"),
    )

    # 单用户模式：直接使用当前目录，创建所需子目录
    team_dir = workdir / ".planify/team"
    tasks_dir = workdir / ".planify/tasks"
    transcript_dir = workdir / ".planify/transcripts"
    inbox_dir = team_dir / "inbox"
    skills_dir = workdir / ".planify/skills"
    logs_dir = workdir / ".planify/logs"

    # 创建目录
    team_dir.mkdir(parents=True, exist_ok=True)
    tasks_dir.mkdir(parents=True, exist_ok=True)
    transcript_dir.mkdir(parents=True, exist_ok=True)
    inbox_dir.mkdir(parents=True, exist_ok=True)
    skills_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)

    # 初始化日志
    logger = setup_logging(
        log_dir=logs_dir,
        console_output=True,  # CLI 模式输出到控制台
        console_level=logging.WARNING,  # 控制台只显示 WARNING 及以上
    )
    logger.info("=" * 50 + " CLI Mode Started " + "=" * 50)

    # 初始化 Anthropic 客户端
    from planify.core import init_anthropic_client

    client = init_anthropic_client(
        config.get("anthropic_base_url"), config.get("anthropic_api_key")
    )

    # 初始化管理器
    todo_mgr = TodoManager()
    task_mgr = TaskManager(tasks_dir)
    bg_mgr = BackgroundManager(workdir)
    bus = MessageBus(inbox_dir)
    skills = SkillLoader(skills_dir)

    # 初始化队友管理器
    basic_tools = make_basic_tools(workdir)
    team = TeammateManager(
        bus=bus,
        task_mgr=task_mgr,
        team_dir=team_dir,
        workdir=workdir,
        model=config.get("model_id"),
        client=client,
        poll_interval=config.get("poll_interval", 5),
        idle_timeout=config.get("idle_timeout", 60),
        run_bash=run_bash,
        run_read=run_read,
        run_write=run_write,
        run_edit=run_edit,
    )

    # 构建工具注册表
    from planify.subagent.runner import run_subagent

    tools, tool_handlers = build_tool_registry(
        workdir=workdir,
        zhipu_client=zhipu_client,
        zhipu_model_id=zhipu_model_id,
        todo_mgr=todo_mgr,
        task_mgr=task_mgr,
        bg_mgr=bg_mgr,
        bus=bus,
        team_mgr=team,
        skills_loader=skills,
        run_subagent=run_subagent,
        model=config.get("model_id"),
        client=client,
        transcript_dir=transcript_dir,
        session=None,  # 单用户模式不需要 Session 对象
    )

    # 创建单用户 SessionConfig（用于 Session 类）
    session_config = SessionConfig(
        workdir=workdir,
        model_id=config.get("model_id"),
        anthropic_api_key=config.get("anthropic_api_key"),
        anthropic_base_url=config.get("anthropic_base_url"),
        token_threshold=config.get("token_threshold", 100000),
        poll_interval=config.get("poll_interval", 5),
        idle_timeout=config.get("idle_timeout", 60),
    )

    # 创建会话
    session = Session(user_id="default", phone="", config=session_config)
    session.session_id = "default"  # 单用户单会话模式
    session.client = client
    # zhipu_client 现在是全局共享的，从 SessionManager 获取
    session.todo_mgr = todo_mgr
    session.task_mgr = task_mgr
    session.bg_mgr = bg_mgr
    session.bus = bus
    session.team = team
    session.skills = skills
    session.logger = logger
    session.tools = tools
    session.tool_handlers = tool_handlers

    return session, logger


def run_streaming_query(loop, session, query: str, history: list) -> list:
    """
    使用流式代理运行查询。

    Args:
        loop: 持久的事件循环
        session: 会话对象
        query: 用户输入
        history: 消息历史

    Returns:
        清理后的消息历史
    """
    import asyncio

    # 重置中断事件
    _interrupt_event.clear()

    # 创建 ESC 键监听器
    escape_watcher = EscapeKeyWatcher(_interrupt_event)
    escape_watcher.start()

    # 创建 CLI 事件发射器
    waiter = get_global_waiter()
    emitter = CLIEventEmitter(
        colors=Colors, waiter=waiter, interrupt_event=_interrupt_event
    )

    # 绑定用户交互工具处理器到已存在的工具处理器
    bind_user_interaction_handlers(session.tool_handlers, emitter, waiter)

    # 创建流式代理
    agent = StreamingAgent(
        client=session.client,
        model=session.model,
        tools=session.tools,
        tool_handlers=session.tool_handlers,
        emitter=emitter,
        todo_manager=session.todo_mgr,
        bg_manager=session.bg_mgr,
        bus=session.bus,
        skills_loader=session.skills,
        config=StreamingConfig(),
        logger_instance=session.logger,
        session=session,
        interrupt_event=_interrupt_event,
    )

    try:
        # 运行流式代理（使用持久的事件循环），接收返回的清理后消息
        return loop.run_until_complete(
            agent.run_stream(history, query, session.session_id)
        )
    finally:
        escape_watcher.stop()


def main():
    """主函数"""
    import asyncio

    # 创建持久的事件循环（避免每次 asyncio.run() 创建新循环导致的问题）
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # 设置单用户会话
    session, logger = setup_single_user_session()

    # 显示欢迎信息
    print(f"\n{'=' * 50}")
    print("Planify CLI - 单用户模式")
    print(f"{'=' * 50}")
    print("\n可用命令:")
    print("  /compact         - 手动压缩")
    print("  /tasks           - 列出任务")
    print("  /team            - 列出队友")
    print("  /inbox           - 读取收件箱")
    print("  /clear           - 清空对话历史")
    print("  /exit            - 退出")
    print(f"{'=' * 50}\n")

    # 初始化命令历史（持久化到磁盘）
    cmd_history = CommandHistory(Path.cwd() / ".planify" / "cmd_history.json")

    # REPL 主循环
    history = []

    try:
        while True:
            try:
                query = input_with_history("planify >> ", cmd_history)
            except (EOFError, KeyboardInterrupt):
                print("\n退出...")
                break

            query = query.strip()

            # 退出命令
            if query == "/exit":
                break

            # /compact - 手动压缩
            if query == "/compact":
                if history:
                    history[:] = auto_compact(
                        history,
                        session.client,
                        session.model,
                        session.config.transcript_dir,
                    )
                    logger.info("手动压缩完成")
                    print("压缩完成")
                else:
                    print("无消息历史可压缩")
                continue

            # /tasks - 列出任务
            if query == "/tasks":
                print(session.task_mgr.list_all())
                continue

            # /team - 列出队友
            if query == "/team":
                print(session.team.list_all())
                continue

            # /inbox - 读取收件箱
            if query == "/inbox":
                inbox = session.bus.read_inbox("lead")
                print(json.dumps(inbox, indent=2, ensure_ascii=False))
                continue

            # /clear - 清空对话历史
            if query == "/clear":
                history.clear()
                session.replace_messages_in_place([])
                logger.info("对话历史已清空")
                print("对话历史已清空")
                continue

            # 跳过空输入
            if not query:
                continue

            # 使用流式代理运行查询（传入持久的事件循环）
            # run_stream 内部会处理消息的添加和清理
            history = run_streaming_query(loop, session, query, history)
            print()  # 结束后换行

    except Exception as e:
        print(f"\n错误: {e}")
        import traceback

        traceback.print_exc()
        return 1
    finally:
        # 关闭事件循环
        loop.close()

    logger.info("=" * 50 + " Session Ended " + "=" * 50)
    return 0


if __name__ == "__main__":
    sys.exit(main())
