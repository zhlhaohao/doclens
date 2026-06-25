"""Cortex Agent 集成模块

封装 Planify 核心功能，提供与 Cortex CLI 的集成。
"""

import asyncio
import logging
import sys
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# 确保 planify 模块可导入
import os
sys.path.insert(0, str(Path(__file__).parent.parent))

# Planify 核心模块导入
from planify.core.session import Session, SessionConfig
from planify.core.client import init_anthropic_client
from planify.streaming.runner import StreamingAgent
from planify.streaming.emitter import CLIEventEmitter
from planify.streaming.waiter import get_global_waiter
from planify.streaming.types import StreamingConfig
from planify.tools.registry import build_tool_registry
from planify.tools.basic import make_basic_tools, run_bash, run_read, run_write, run_edit
from planify.tools import bind_user_interaction_handlers
from planify.context.compact import auto_compact
from planify.managers.teammate_manager import TeammateManager
from planify.managers.todo_manager import TodoManager
from planify.managers.task_manager import TaskManager
from planify.managers.background_manager import BackgroundManager
from planify.messaging.message_bus import MessageBus
from planify.skills.skill_loader import SkillLoader

# 中断事件
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
                if key == b"\x1b":
                    print(f"\n[正在中断...]", flush=True)
                    self.interrupt_event.set()
                    break
            threading.Event().wait(0.05)

    def _listen_unix(self):
        """Unix 平台监听"""
        import select
        import termios
        import tty

        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setcbreak(fd)
            while self._running:
                if select.select([sys.stdin], [], [], 0.1)[0]:
                    key = sys.stdin.read(1)
                    if key == "\x1b":
                        self.interrupt_event.set()
                        print(f"\n[已中断]")
                        break
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)


class Colors:
    """终端输出颜色"""
    USER = "\033[36m"
    TOOL_CALL = "\033[33m"
    TOOL_RESULT = "\033[32m"
    ASSISTANT = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


class CortexAgent:
    """Cortex Agent 会话"""

    def __init__(self, workdir: Path):
        self.workdir = workdir
        self.loop = None
        self.session = None
        self.idx = None
        self._escape_watcher = None
        self._setup_dirs()

    def _setup_dirs(self):
        """创建 .cortex/ 子目录（skills 不再在工作目录下）"""
        subdirs = ["team/inbox", "tasks", "transcripts", "logs"]
        for subdir in subdirs:
            (self.workdir / f".cortex/{subdir}").mkdir(parents=True, exist_ok=True)

    def initialize(self):
        """初始化 Agent 会话"""
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        # 从 ~/.cortex/.env 和 {workdir}/.cortex/.env 加载配置，项目级覆盖全局
        from doclens.config import get_global_cortex_dir
        from dotenv import load_dotenv
        global_env = get_global_cortex_dir() / ".env"
        local_env = self.workdir / ".cortex" / ".env"
        if global_env.exists():
            load_dotenv(global_env, override=True)
        if local_env.exists():
            load_dotenv(local_env, override=False)

        # 从环境变量构建配置
        config = {
            "model_id": os.getenv("PLANIFY_MODEL_ID", "claude-opus-4-6"),
            "anthropic_base_url": os.getenv("PLANIFY_BASE_URL"),
            "anthropic_api_key": os.getenv("PLANIFY_API_KEY"),
            "zhipu_api_key": os.getenv("ZHIPUAI_API_KEY"),
            "zhipu_model_id": os.getenv("ZHIPUAI_MODEL_ID", "glm-4"),
            "token_threshold": 100000,
            "poll_interval": 5,
            "idle_timeout": 60,
        }

        # 初始化 Anthropic 客户端
        client = init_anthropic_client(
            config.get("anthropic_base_url"),
            config.get("anthropic_api_key")
        )

        # 目录
        team_dir = self.workdir / ".cortex/team"
        tasks_dir = self.workdir / ".cortex/tasks"
        transcript_dir = self.workdir / ".cortex/transcripts"
        inbox_dir = team_dir / "inbox"
        skills_dir = get_global_cortex_dir() / "skills"
        logs_dir = self.workdir / ".cortex/logs"

        # 创建目录
        team_dir.mkdir(parents=True, exist_ok=True)
        tasks_dir.mkdir(parents=True, exist_ok=True)
        transcript_dir.mkdir(parents=True, exist_ok=True)
        inbox_dir.mkdir(parents=True, exist_ok=True)
        skills_dir.mkdir(parents=True, exist_ok=True)
        logs_dir.mkdir(parents=True, exist_ok=True)

        # 初始化日志
        from planify.core.logging_config import setup_logging
        logger = setup_logging(
            log_dir=logs_dir,
            console_output=True,
            console_level=logging.WARNING,
        )

        # 管理器
        todo_mgr = TodoManager()
        task_mgr = TaskManager(tasks_dir)
        bg_mgr = BackgroundManager(self.workdir)
        bus = MessageBus(inbox_dir)
        skills = SkillLoader(skills_dir)

        # 基础工具
        basic_tools = make_basic_tools(self.workdir)

        # 队友管理器
        team = TeammateManager(
            bus=bus,
            task_mgr=task_mgr,
            team_dir=team_dir,
            workdir=self.workdir,
            model=config.get("model_id"),
            client=client,
            poll_interval=config.get("poll_interval", 5),
            idle_timeout=config.get("idle_timeout", 60),
            run_bash=run_bash,
            run_read=run_read,
            run_write=run_write,
            run_edit=run_edit,
        )

        # 子代理运行器
        from planify.subagent.runner import run_subagent

        # --- 知识库工具注册 ---
        from doclens.index_manager import IndexManager
        from doclens.config import CortexConfig

        kb_config = CortexConfig.load()
        self.idx = IndexManager(kb_config)
        self.idx.load_or_build_index()

        from doclens.kb_tools import build_kb_tools
        kb_tools, kb_handlers = build_kb_tools(self.idx, self.workdir)

        from planify.tools.registry import register_external_tools
        register_external_tools(kb_tools, kb_handlers)

        # --- grep 工具注册 ---
        from doclens.grep_tools import build_grep_tools
        grep_tools, grep_handlers = build_grep_tools(self.idx)
        register_external_tools(grep_tools, grep_handlers)

        # 部署技能文件到 ~/.cortex/skills/
        import shutil
        skill_src_dir = Path(__file__).parent / "skills" / "knowledge_base"
        skill_dst_dir = skills_dir / "knowledge_base"
        if skill_src_dir.exists() and not (skill_dst_dir / "SKILL.md").exists():
            skill_dst_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(skill_src_dir / "SKILL.md", skill_dst_dir / "SKILL.md")

        # 工具注册表
        tools, tool_handlers = build_tool_registry(
            workdir=self.workdir,
            zhipu_client=None,
            zhipu_model_id="glm-4",
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
            session=None,
        )

        # Session
        session_config = SessionConfig(
            workdir=self.workdir,
            model_id=config.get("model_id", "claude-opus-4-6"),
            anthropic_api_key=config.get("anthropic_api_key"),
            anthropic_base_url=config.get("anthropic_base_url"),
            token_threshold=config.get("token_threshold", 100000),
            poll_interval=config.get("poll_interval", 5),
            idle_timeout=config.get("idle_timeout", 60),
        )

        session = Session(user_id="default", phone="", config=session_config)
        session.session_id = str(uuid.uuid4())[:8]
        session.client = client
        session.todo_mgr = todo_mgr
        session.task_mgr = task_mgr
        session.bg_mgr = bg_mgr
        session.bus = bus
        session.team = team
        session.skills = skills
        session.tools = tools
        session.tool_handlers = tool_handlers
        session.logger = logger

        self.session = session
        return self

    def run_query(
        self,
        query: str,
        history: List[Dict],
        emitter_callbacks: Optional[Dict[str, Any]] = None,
    ) -> List[Dict]:
        """运行流式查询

        Args:
            query: 用户查询
            history: 消息历史
            emitter_callbacks: TUI 回调函数字典，传入时使用 TUIEventEmitter，
                              不传时使用 CLIEventEmitter（CLI 模式）
        """
        global _interrupt_event
        _interrupt_event.clear()

        self._escape_watcher = EscapeKeyWatcher(_interrupt_event)
        self._escape_watcher.start()

        waiter = get_global_waiter()

        if emitter_callbacks is not None:
            from planify.streaming.emitter import TUIEventEmitter
            emitter = TUIEventEmitter(
                callbacks=emitter_callbacks,
                interrupt_event=_interrupt_event,
            )
        else:
            emitter = CLIEventEmitter(
                colors=Colors, waiter=waiter, interrupt_event=_interrupt_event,
            )
            bind_user_interaction_handlers(self.session.tool_handlers, emitter, waiter)

        agent = StreamingAgent(
            client=self.session.client,
            model=self.session.model,
            tools=self.session.tools,
            tool_handlers=self.session.tool_handlers,
            emitter=emitter,
            todo_manager=self.session.todo_mgr,
            bg_manager=self.session.bg_mgr,
            bus=self.session.bus,
            skills_loader=self.session.skills,
            config=StreamingConfig(),
            logger_instance=self.session.logger,
            session=self.session,
            interrupt_event=_interrupt_event,
        )

        try:
            # 每次查询使用新的事件循环，避免 ESC 中断后残留 running 状态
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            return self.loop.run_until_complete(
                agent.run_stream(history, query, self.session.session_id)
            )
        except Exception:
            # ESC 中断：丢弃残留循环，下次 run_query 会创建新的
            if _interrupt_event.is_set():
                return history
            raise
        finally:
            self._escape_watcher.stop()

    def handle_slash_command(self, cmd: str, arg: str, history: List[Dict]) -> Tuple[bool, List[Dict]]:
        """处理斜杠命令，返回 (should_exit, history)"""
        import json

        if cmd in ("compact",):
            if history:
                compacted = auto_compact(
                    history,
                    self.session.client,
                    self.session.model,
                    self.workdir / ".cortex/transcripts"
                )
                self.session.replace_messages_in_place(compacted)
                history[:] = compacted
            return False, history

        if cmd in ("tasks", "task"):
            print(self.session.task_mgr.list_all())
            return False, history

        if cmd in ("team",):
            print(self.session.team.list_all())
            return False, history

        if cmd in ("inbox",):
            inbox = self.session.bus.read_inbox("lead")
            print(json.dumps(inbox, indent=2, ensure_ascii=False))
            return False, history

        if cmd in ("failed",):
            # 列出解析失败的文件
            from treesearch.fts import FTS5Index
            db_path = self.idx.index_path
            try:
                fts = FTS5Index(db_path=db_path)
                failed = fts.get_all_failed_files()
                if not failed:
                    print("没有解析失败的文件")
                else:
                    print(f"共有 {len(failed)} 个解析失败的文件:")
                    for path, (count, _, err) in sorted(failed.items(), key=lambda x: -x[1][0]):
                        print(f"  [{count}次] {path}  --- {err}" if err else f"  [{count}次] {path}")
            except Exception as e:
                print(f"读取失败文件失败: {e}")
            return False, history

        if cmd in ("clearfailed",):
            # 清空解析失败的文件记录并重新索引
            from treesearch.fts import FTS5Index
            db_path = self.idx.index_path
            try:
                fts = FTS5Index(db_path=db_path)
                fts.clear_all_failed_files()
                print("已清空所有解析失败的文件记录，正在重新索引...")

                # 触发后台重新索引，带完成回调
                def on_reindex_complete(success, doc_count, failed_count):
                    import sys
                    if success:
                        if failed_count > 0:
                            print(f"[索引完成] 成功: {doc_count} 文档, 失败: {failed_count} 文件", file=sys.stderr)
                        else:
                            print(f"[索引完成] 共 {doc_count} 文档", file=sys.stderr)
                    else:
                        print("[索引失败] 请查看日志", file=sys.stderr)

                self.idx.trigger_background_reindex(on_complete=on_reindex_complete)
            except Exception as e:
                print(f"清空失败文件记录失败: {e}")
            return False, history

        if cmd in ("clear",):
            history.clear()
            self.session.replace_messages_in_place([])
            return False, history

        return False, history
