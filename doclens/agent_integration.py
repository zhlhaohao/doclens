"""Cortex Agent 集成模块

封装 Planify 核心功能，提供与 Cortex CLI 的集成。
"""

from dataclasses import dataclass, field
import asyncio
import logging
import sys
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from doclens.config import data_dirname, get_global_cortex_dir
from doclens.agent_prompt import (
    KB_SYSTEM_PROMPT_EXTRA,
    kb_root_guidance,
    tool_round_limit_kwargs,
)
from doclens.memory import memory_guidance

# 确保 planify 模块可导入
import os

sys.path.insert(0, str(Path(__file__).parent.parent))

# Planify 核心模块导入
from planify.core.runtime import AgentRuntime, RuntimeConfig
from planify.core.llm import LLMTracer, create_provider
from planify.streaming.runner import StreamingAgent
from planify.streaming.emitter import CLIEventEmitter
from planify.streaming.waiter import get_global_waiter
from planify.streaming.types import StreamingConfig
from planify.tools.registry import build_tool_registry
from planify.tools.basic import (
    make_basic_tools,
    run_bash,
    run_read,
    run_write,
    run_edit,
)
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


#: 子线程建库的等待上界（秒）。TreeSearch.index() 在事件循环运行时拒绝执行，
#: 初始化必须绕到子线程；但等待必须有上界——无 timeout 的 join 会把「索引构建
#: 卡住」放大成「首个 agent 请求永久挂起」（建库在 deps 的 `_agent_lock` 内，
#: 后续请求全部排队）。大语料首建较慢，用 CORTEX_INDEX_BUILD_TIMEOUT 上调。
INDEX_BUILD_TIMEOUT_SEC = 1800.0


def _index_build_timeout() -> float:
    """建库等待上界（秒）：`CORTEX_INDEX_BUILD_TIMEOUT` 覆盖，非法值回落默认。"""
    raw = os.getenv("CORTEX_INDEX_BUILD_TIMEOUT", "")
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return INDEX_BUILD_TIMEOUT_SEC
    return value if value > 0 else INDEX_BUILD_TIMEOUT_SEC


def _build_index_blocking(idx, timeout_sec: float | None = None) -> None:
    """在子线程完成 ``load_or_build_index``，等待有上界。

    GUI lifespan 内初始化 agent 时事件循环已运行，``TreeSearch.index()`` 会
    拒绝执行（见 deps.get_index_manager 同因），因此必须绕到子线程；但
    ``join`` 必须带超时（AP-51）——否则一次卡住的建库会让首个 agent 请求
    无限挂起。

    Raises:
        TimeoutError: 超过上界仍未完成（线程继续在后台跑，不中断建库）。
        原样抛出建库失败的首个异常。
    """
    budget = _index_build_timeout() if timeout_sec is None else timeout_sec
    errors: list = []

    def _build() -> None:
        try:
            idx.load_or_build_index()
        except Exception as e:  # noqa: BLE001 - 原样转交调用线程
            errors.append(e)

    thread = threading.Thread(
        target=_build, name="cortex-index-build", daemon=True
    )
    thread.start()
    thread.join(budget)
    if thread.is_alive():
        raise TimeoutError(
            f"索引构建超过 {int(budget)} 秒仍未完成（大语料首建较慢）。"
            "可先运行 `doclens index` 完成建库，或用环境变量 "
            "CORTEX_INDEX_BUILD_TIMEOUT 调大等待上界后重试。"
        )
    if errors:
        raise errors[0]


@dataclass
class _Assembly:
    """`initialize` 的阶段间载体（AP-51：拆 Long Method 用，不对外暴露）。

    字段按装配顺序填充；每个 `_stage_*` 只读前一阶段已填好的字段。
    """

    config: Dict[str, Any] = field(default_factory=dict)
    client: Any = None
    dirs: Dict[str, Path] = field(default_factory=dict)
    logger: Any = None
    todo_mgr: Any = None
    task_mgr: Any = None
    bg_mgr: Any = None
    bus: Any = None
    team: Any = None
    skills: Any = None
    skill_state: Any = None
    kb_config: Any = None
    max_tokens: int = 0
    kb_tools: List[Dict[str, Any]] = field(default_factory=list)
    kb_handlers: Dict[str, Any] = field(default_factory=dict)
    run_subagent: Any = None
    tools: List[Dict[str, Any]] = field(default_factory=list)
    tool_handlers: Dict[str, Any] = field(default_factory=dict)


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

    def __init__(self, workdir: Path, idx_manager=None):
        self.workdir = workdir
        self.loop = None
        self.runtime = None
        # 注入宿主已有的 IndexManager（GUI=deps 单例 / CLI/TUI=各自实例），
        # 避免自建第二实例重复跑启动审计（双轮审计 bug，2026-09-11）。
        self.idx = idx_manager
        self._injected_idx = idx_manager is not None
        self._escape_watcher = None
        # LLM 追踪（CLI/TUI 会话级，时间戳命名一次、跨输入追加同一文件；
        # 开关未开时保持 None，每次查询重试 create（开销仅两次 getenv））
        self._llm_tracer = None
        self._setup_dirs()
        # 长期记忆库就绪（建目录/索引；关停时不做任何事）——失败不阻断启动
        try:
            from doclens.memory import ensure_memory_store

            ensure_memory_store()
        except Exception as e:  # noqa: BLE001
            import logging

            logging.getLogger(__name__).warning(
                "memory store init failed: %s", e
            )

    def _setup_dirs(self):
        """创建数据目录子目录（开发 .cortex / 发行版 .doclens；skills 不再在工作目录下）"""
        subdirs = ["team/inbox", "tasks", "transcripts", "logs"]
        for subdir in subdirs:
            (self.workdir / f"{data_dirname()}/{subdir}").mkdir(
                parents=True, exist_ok=True
            )

    def initialize(self):
        """初始化 Agent 会话（装配根）。

        CortexAgent.initialize 是 doclens 的官方装配根——刻意不复用
        planify 的 RuntimeManager.initialize_runtime_components（该路径仅服务
        planify 自带 legacy REPL main.py，且缺少 gui_mode / skill_access_state /
        自定义 skills_dir 等 doclens 必需插槽）。代价：planify 装配逻辑演进时
        需人工同步此处（详见 web_v2/docs/ARCHITECTURE-planify-boundary.md）。

        装配按阶段拆分（AP-51）：环境/配置 → 目录 → 日志与运行时管理器 →
        技能 → 知识库工具 → 工具注册 → Runtime。阶段间只经 ``_Assembly``
        传递产物，任一阶段可单独阅读与测试。
        """
        asm = _Assembly()
        self._stage_env(asm)
        self._stage_dirs(asm)
        self._stage_runtime(asm)
        self._stage_skills(asm)
        self._stage_knowledge_base(asm)
        self._stage_tools(asm)
        self._stage_assemble(asm)
        return self

    # ---- 装配阶段（AP-51：initialize 拆解；每阶段只依赖前一阶段产物）----

    def _stage_env(self, asm: "_Assembly") -> None:
        """阶段 1：加载 .env、构造 planify 配置 dict、创建 LLM Provider。"""
        # 从 ~/<数据目录>/.env 和 {workdir}/<数据目录>/.env 加载配置——两处均
        # override=False：只填进程 env 缺失的键，启动时注入的环境变量优先于
        # .env 文件（与 CortexConfig 的 pydantic-settings 层序 env > dotenv、
        # CORTEX_WORKDIR 读取链同语义）。设置页热生效不受影响：那走
        # deps.reload_config() 的 override=True 刷新 + apply_config 推送。
        from dotenv import load_dotenv

        global_env = get_global_cortex_dir() / ".env"
        local_env = self.workdir / data_dirname() / ".env"
        if global_env.exists():
            load_dotenv(global_env, override=False)
        if local_env.exists():
            load_dotenv(local_env, override=False)

        # 从环境变量构建配置
        asm.config = {
            "protocol": os.getenv("PLANIFY_PROTOCOL", ""),
            "model_id": os.getenv("PLANIFY_MODEL_ID", ""),
            "base_url": os.getenv("PLANIFY_BASE_URL"),
            "api_key": os.getenv("PLANIFY_API_KEY"),
            "zhipu_api_key": os.getenv("ZHIPUAI_API_KEY"),
            "zhipu_model_id": os.getenv("ZHIPUAI_MODEL_ID", "glm-4"),
            "token_threshold": 100000,
            "poll_interval": 5,
            "idle_timeout": 60,
        }

        # 初始化 LLM Provider（通过 factory.create_provider）
        asm.client = create_provider(asm.config)

    def _stage_dirs(self, asm: "_Assembly") -> None:
        """阶段 2：解析并创建数据目录。"""
        data_dir = self.workdir / data_dirname()
        asm.dirs = {
            "data": data_dir,
            "team": data_dir / "team",
            "tasks": data_dir / "tasks",
            "transcripts": data_dir / "transcripts",
            "inbox": data_dir / "team" / "inbox",
            "skills": get_global_cortex_dir() / "skills",
            "logs": data_dir / "logs",
        }
        for path in asm.dirs.values():
            path.mkdir(parents=True, exist_ok=True)

    def _stage_runtime(self, asm: "_Assembly") -> None:
        """阶段 3：初始化日志与运行时管理器（todo/task/background/bus/team）。"""
        from planify.core.logging_config import setup_logging

        asm.logger = setup_logging(
            log_dir=asm.dirs["logs"],
            console_output=True,
            console_level=logging.WARNING,
        )

        asm.todo_mgr = TodoManager()
        asm.task_mgr = TaskManager(asm.dirs["tasks"])
        asm.bg_mgr = BackgroundManager(self.workdir)
        asm.bus = MessageBus(asm.dirs["inbox"])

        # 基础工具
        basic_tools = make_basic_tools(self.workdir)

        # 队友管理器
        asm.team = TeammateManager(
            bus=asm.bus,
            task_mgr=asm.task_mgr,
            team_dir=asm.dirs["team"],
            workdir=self.workdir,
            model=asm.config.get("model_id"),
            client=asm.client,
            poll_interval=asm.config.get("poll_interval", 5),
            idle_timeout=asm.config.get("idle_timeout", 60),
            run_bash=run_bash,
            run_read=run_read,
            run_write=run_write,
            run_edit=run_edit,
        )

    def _stage_skills(self, asm: "_Assembly") -> None:
        """阶段 4：部署内置技能并构造 SkillLoader + 技能访问状态。"""
        # 先部署内置技能再扫描（部署跳过 sidecar 标记 deleted 的技能；
        # 扫描须在部署之后，否则首启时 loader 看到的是空目录）
        from doclens.skills_deploy import deploy_builtin_skills
        from doclens import skills_config

        deploy_builtin_skills(asm.dirs["skills"])
        # 注入应用日志目录与数据目录（宿主数据，planify 不自行计算）——
        # 系统提示词的目录事实紧随技能根目录输出，供 agent 排障时直接定位
        # 当日日志与数据归属（数据目录名随运行形态 .cortex/.doclens 变化，
        # 不假设固定形态）。
        asm.skills = SkillLoader(
            asm.dirs["skills"], logs_dir=asm.dirs["logs"], data_dir=asm.dirs["data"]
        )
        # 停用名单 = sidecar 停用/已删除 + 深读技能整体（ADR-0041 D3：模型
        # 感知面隔断——descriptions() 清单剔除，书多不随 system prompt 膨胀）。
        # disabled 只做路由层隔断，load_skill 不受影响；深读技能经深读面板
        # 的斜杠 hint 注入照常加载（_chat_slash 对前缀豁免 disabled 门）。
        asm.skills.set_disabled(
            skills_config.disabled_names(asm.skills.skills.keys())
            | skills_config.book_skill_names(asm.skills.skills.keys())
        )

        # 技能加载状态（按 session_id 记录），供工具门禁 + load_skill 标记 + 跨轮 body 重注入使用
        from planify.skills.access_state import SkillAccessState

        asm.skill_state = SkillAccessState()

    def _stage_knowledge_base(self, asm: "_Assembly") -> None:
        """阶段 5：知识库索引 + KB/grep 工具注册 + 子代理包装。"""
        # --- 知识库工具注册 ---
        from doclens.index_manager import IndexManager
        from doclens.config import CortexConfig

        if self._injected_idx:
            # 宿主注入的 IndexManager 已完成启动审计（deps 单例 / CLI/TUI 实例
            # 都先于 agent 初始化），直接复用——自建第二实例会重复跑全量审计
            # （百万语料双轮审计 bug，2026-09-11）。
            asm.kb_config = CortexConfig.load()
        else:
            asm.kb_config = CortexConfig.load()
            self.idx = IndexManager(asm.kb_config)
            _build_index_blocking(self.idx)
        # 对话模型单次输出上限：主代理 StreamingConfig 与子代理共用
        asm.max_tokens = asm.kb_config.planify_max_tokens

        from doclens.kb_tools import build_kb_tools

        asm.kb_tools, asm.kb_handlers = build_kb_tools(
            self.idx, self.workdir, skill_state=asm.skill_state
        )

        from planify.tools.registry import register_external_tools

        register_external_tools(asm.kb_tools, asm.kb_handlers)

        # --- grep 工具注册 ---
        from doclens.grep_tools import build_grep_tools

        grep_tools, grep_handlers = build_grep_tools(
            self.idx, skill_state=asm.skill_state
        )
        register_external_tools(grep_tools, grep_handlers)

        asm.run_subagent = self._make_run_subagent(asm)

    def _make_run_subagent(self, asm: "_Assembly"):
        """构造子代理运行器包装（注入 KB 只读工具 + 轮次预算）。"""
        # 子代理运行器（KB 只读工具注入包装在下方 KB 工具注册之后）
        from planify.subagent.runner import run_subagent as _run_subagent

        # 子代理运行器包装：注入 KB 只读工具（read_document/file_info）。
        # 子代理默认只有 bash/read_file/write_file/edit_file，无法解析 PDF/DOCX
        # 等二进制格式；ask-files 等技能的并发子代理需要它们读知识库文档。
        _kb_readonly_names = ("read_document", "file_info")
        _kb_readonly_tools = [
            t for t in asm.kb_tools if t["name"] in _kb_readonly_names
        ]
        _kb_readonly_handlers = {
            n: asm.kb_handlers[n] for n in _kb_readonly_names if n in asm.kb_handlers
        }
        _max_tokens = asm.max_tokens

        def run_subagent(
            prompt,
            agent_type,
            workdir,
            client,
            model,
            run_bash,
            run_read,
            run_write,
            run_edit,
            extra_tools=None,
            extra_handlers=None,
        ):
            # 子代理轮次预算每次调用现读 os.environ（设置页保存 → reload_config
            # 的 load_dotenv(override=True) 已刷新进程 env → 立即生效，无需重启）。
            # 不能在 initialize 期捕获 kb_config 快照值——会停在启动值；
            # 与 guard/ask_mode 的 env 惰性读同模式（ADR-0021/0033 先例）。
            import os as _os

            try:
                _rounds = int(_os.environ.get("PLANIFY_MAX_SUBAGENT_ROUNDS", "30"))
            except ValueError:
                _rounds = 30  # 非法值回落默认（与 _normalize_bg_timeout 同哲学）
            if _rounds < 1:
                _rounds = 30
            # 合并注入：调用方（planify handle_task 透传 grep/glob/TodoWrite）
            # 与宿主 KB 只读工具（read_document/file_info）。名称冲突时宿主
            # KB 工具优先（doclens 场景子代理读知识库文档是硬需求）。
            if extra_tools:
                _extra_names = {t["name"] for t in extra_tools}
                _merged = list(extra_tools) + [
                    t for t in _kb_readonly_tools if t["name"] not in _extra_names
                ]
                _merged_handlers = dict(extra_handlers or {})
                _merged_handlers.update(_kb_readonly_handlers)
                return _run_subagent(
                    prompt,
                    agent_type,
                    workdir,
                    client,
                    model,
                    run_bash,
                    run_read,
                    run_write,
                    run_edit,
                    extra_tools=_merged,
                    extra_handlers=_merged_handlers,
                    max_tokens=_max_tokens,
                    max_rounds=_rounds,
                )
            return _run_subagent(
                prompt,
                agent_type,
                workdir,
                client,
                model,
                run_bash,
                run_read,
                run_write,
                run_edit,
                extra_tools=_kb_readonly_tools,
                extra_handlers=_kb_readonly_handlers,
                max_tokens=_max_tokens,
                max_rounds=_rounds,
            )

        return run_subagent

    def _stage_tools(self, asm: "_Assembly") -> None:
        """阶段 6：工具注册表 + GUI 专属过滤。"""
        # 内置技能部署已前移至 SkillLoader 构造之前（跳过 sidecar 标记 deleted
        # 的技能；发行版升级时内置技能自动覆盖更新，用户可变状态存 sidecar 不受影响）

        # 工具注册表（gui_mode=True：注册 ask_user_question，GUI 真实交互；
        # 旧 ask_user/user_confirm 在 GUI 下随即被过滤——emitter 不支持旧形态，
        # 模型若调用会悬置 300s 假死）
        tools, tool_handlers = build_tool_registry(
            workdir=self.workdir,
            zhipu_client=None,
            zhipu_model_id="glm-4",
            todo_mgr=asm.todo_mgr,
            task_mgr=asm.task_mgr,
            bg_mgr=asm.bg_mgr,
            bus=asm.bus,
            team_mgr=asm.team,
            skills_loader=asm.skills,
            skill_access_state=asm.skill_state,
            run_subagent=asm.run_subagent,
            model=asm.config.get("model_id"),
            client=asm.client,
            transcript_dir=asm.dirs["transcripts"],
            runtime=None,
            gui_mode=True,
            max_tokens=asm.max_tokens,
        )
        legacy_ask = {"ask_user", "user_confirm"}
        asm.tools = [t for t in tools if t["name"] not in legacy_ask]
        asm.tool_handlers = {
            k: v for k, v in tool_handlers.items() if k not in legacy_ask
        }

    def _stage_assemble(self, asm: "_Assembly") -> None:
        """阶段 7：组装 AgentRuntime 并挂到 self。"""
        # AgentRuntime（进程级组件容器；runtime_id 仅作兜底标识，
        # 对话身份由 doclens DB 会话承担并穿透传入）
        runtime_config = RuntimeConfig(
            workdir=self.workdir,
            model_id=asm.config.get("model_id", "claude-opus-4-6"),
            api_key=asm.config.get("api_key"),
            base_url=asm.config.get("base_url"),
            token_threshold=asm.config.get("token_threshold", 100000),
            planify_context_window=asm.kb_config.planify_context_window,
            planify_max_tokens=asm.max_tokens,
            planify_max_tool_rounds=asm.kb_config.planify_max_tool_rounds,
            planify_injection_ack=asm.kb_config.planify_injection_ack,
            poll_interval=asm.config.get("poll_interval", 5),
            idle_timeout=asm.config.get("idle_timeout", 60),
            # 压缩 transcript 落到 .cortex/transcripts（上面已 mkdir）：
            # .cortex 被索引器/FileWatcher 排除，杜绝落盘→watch→reindex 回路
            compact_transcript_dir=asm.dirs["transcripts"],
        )

        runtime = AgentRuntime(
            user_id="default",
            phone="",
            config=runtime_config,
            runtime_id=str(uuid.uuid4())[:8],
        )
        runtime.client = asm.client
        runtime.todo_mgr = asm.todo_mgr
        runtime.task_mgr = asm.task_mgr
        runtime.bg_mgr = asm.bg_mgr
        runtime.bus = asm.bus
        runtime.team = asm.team
        runtime.skills = asm.skills
        runtime.tools = asm.tools
        runtime.tool_handlers = asm.tool_handlers
        runtime.logger = asm.logger
        runtime.skill_access_state = asm.skill_state

        self.runtime = runtime

    # ---- 事件循环（AP-51：每轮新建但必须回收，否则每问泄漏一个 selector/fd）----

    def _run_blocking(self, coro):
        """在新事件循环上跑完协程，并保证循环被关闭。

        每轮新建循环是为了避免 ESC 中断后残留 running 状态；但循环必须回收
        ——无 ``close()`` 时 CLI/TUI 长会话每次提问泄漏一个 selector/fd。
        """
        loop = asyncio.new_event_loop()
        self.loop = loop
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro)
        finally:
            self._dispose_loop(loop)

    @staticmethod
    def _dispose_loop(loop: asyncio.AbstractEventLoop) -> None:
        """取消未完成任务、关异步生成器、关闭循环；清理失败只记日志。"""
        log = logging.getLogger(__name__)
        try:
            pending = [t for t in asyncio.all_tasks(loop) if not t.done()]
            for task in pending:
                task.cancel()
            if pending:
                loop.run_until_complete(
                    asyncio.gather(*pending, return_exceptions=True)
                )
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception as e:  # noqa: BLE001 - 清理失败不得掩盖主异常
            log.debug("event loop cleanup failed: %s", e)
        finally:
            loop.close()
            asyncio.set_event_loop(None)

    def apply_config(self, config) -> None:
        """Hot-reload AI config: 经 planify 官方热更新 API 更新 runtime。

        历史教训：不能改 self.runtime.model —— AgentRuntime.model 是只读
        @property（返回 self.config.model_id），赋值会抛 AttributeError 导致
        /api/config PUT 500。正确通路是 AgentRuntime.update_llm_config()，
        由 planify 自己负责重建 Provider 并更新 RuntimeConfig 字段。
        """
        if self.runtime is None:
            return
        self.runtime.update_llm_config(
            protocol=getattr(config, "planify_protocol", ""),
            api_key=config.planify_api_key,
            model_id=config.planify_model_id,
            base_url=config.planify_base_url,
            planify_context_window=getattr(config, "planify_context_window", None)
            or None,
            planify_max_tokens=getattr(config, "planify_max_tokens", None) or None,
            # 主循环轮数软上限热更新：chat 每请求从 runtime.config 现读
            # （tool_round_limit_kwargs），推到 RuntimeConfig 即对新回合生效。
            # 注意 0（不限）是合法值，不能用 or 短路吞掉。
            planify_max_tool_rounds=getattr(config, "planify_max_tool_rounds", None),
        )

    def _get_llm_tracer(self):
        """LLM 追踪器（CLI/TUI 会话级惰性单例；开关未开为 None）。
        workdir 显式传：trace 落 {workdir}/.planify/（gitignore 覆盖范围），
        不随进程 cwd 漂移。"""
        if self._llm_tracer is None:
            self._llm_tracer = LLMTracer.create(label="cli", workdir=self.workdir)
        return self._llm_tracer

    def run_query(
        self,
        query: str,
        history: List[Dict],
        emitter_callbacks: Optional[Dict[str, Any]] = None,
        images: Optional[List[Dict]] = None,
    ) -> List[Dict]:
        """运行流式查询

        Args:
            query: 用户查询
            history: 消息历史
            emitter_callbacks: TUI 回调函数字典，传入时使用 TUIEventEmitter，
                              不传时使用 CLIEventEmitter（CLI 模式）
            images: 本轮对话图片（可选，ADR-0034；[{"data": b64, "media_type": str}]）
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
            tool_handlers = self.runtime.tool_handlers
        else:
            emitter = CLIEventEmitter(
                colors=Colors,
                waiter=waiter,
                interrupt_event=_interrupt_event,
            )
            # handler 捕获本次查询的 emitter——绑在浅拷贝上，不改共享 runtime 字典
            tool_handlers = {**self.runtime.tool_handlers}
            bind_user_interaction_handlers(tool_handlers, emitter, waiter)

        agent = StreamingAgent(
            client=self.runtime.client,
            model=self.runtime.model,
            tools=self.runtime.tools,
            tool_handlers=tool_handlers,
            emitter=emitter,
            todo_manager=self.runtime.todo_mgr,
            bg_manager=self.runtime.bg_mgr,
            bus=self.runtime.bus,
            skills_loader=self.runtime.skills,
            config=StreamingConfig(
                compact_threshold=int(
                    round(self.runtime.config.planify_context_window * 0.8)
                ),
                max_tokens=self.runtime.config.planify_max_tokens,
                injection_ack=getattr(
                    self.runtime.config, "planify_injection_ack", False
                ),
                **tool_round_limit_kwargs(self.runtime.config),
            ),
            logger_instance=self.runtime.logger,
            runtime=self.runtime,
            interrupt_event=_interrupt_event,
            # 知识库根指导文件（CLAUDE.md/AGENTS.md）+ 长期记忆索引/纪律注入
            system_prompt_extra=KB_SYSTEM_PROMPT_EXTRA
            + kb_root_guidance(self.workdir)
            + memory_guidance(),
            tracer=self._get_llm_tracer(),
        )

        try:
            # 每次查询使用新的事件循环，避免 ESC 中断后残留 running 状态；
            # _run_blocking 保证循环用完即关（AP-51：否则每问泄漏一个 fd）
            return self._run_blocking(
                agent.run_stream(history, query, self.runtime.runtime_id, images=images)
            )
        except Exception:
            # ESC 中断：丢弃残留循环，下次 run_query 会创建新的
            if _interrupt_event.is_set():
                return history
            raise
        finally:
            self._escape_watcher.stop()

    def handle_slash_command(
        self, cmd: str, arg: str, history: List[Dict]
    ) -> Tuple[bool, List[Dict]]:
        """处理斜杠命令，返回 (should_exit, history)"""
        import json

        if cmd in ("compact",):
            if history:
                compacted = auto_compact(
                    history,
                    self.runtime.client,
                    self.workdir / data_dirname() / "transcripts",
                    tracer=self._get_llm_tracer(),
                )
                self.runtime.replace_messages_in_place(compacted)
                history[:] = compacted
            return False, history

        if cmd in ("tasks", "task"):
            print(self.runtime.task_mgr.list_all())
            return False, history

        if cmd in ("team",):
            print(self.runtime.team.list_all())
            return False, history

        if cmd in ("inbox",):
            inbox = self.runtime.bus.read_inbox("lead")
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
                    for path, (count, _, err) in sorted(
                        failed.items(), key=lambda x: -x[1][0]
                    ):
                        print(
                            f"  [{count}次] {path}  --- {err}"
                            if err
                            else f"  [{count}次] {path}"
                        )
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
                            print(
                                f"[索引完成] 成功: {doc_count} 文档, 失败: {failed_count} 文件",
                                file=sys.stderr,
                            )
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
            self.runtime.replace_messages_in_place([])
            # 同步清空技能加载状态，避免状态记忆与已清空的对话上下文错位
            skill_state = getattr(self.runtime, "skill_access_state", None)
            if skill_state is not None:
                skill_state.clear(self.runtime.runtime_id)
            return False, history

        return False, history
