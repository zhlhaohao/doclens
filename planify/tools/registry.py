"""工具注册中心

从所有模块构建完整的工具定义和处理器。
组件经 AgentRuntime（运行时容器）装配注入。
"""

from typing import Any, Callable, Dict, List, Tuple, Optional

import logging
import os
import platform

from .basic import make_basic_tools
from .glob_tool import make_glob_tools
from .grep import make_grep_tools, rg_available
from .web import make_web_tools
from .file_tasks import get_file_task_definitions, get_file_task_handlers
from .team_tools import get_team_tools_definitions, get_team_tools_handlers
from .protocols import get_protocol_definitions, get_protocol_handlers
from .user_interaction import get_ask_user_question_tool, get_user_interaction_tools
from .weather_tool import make_baidu_weather_tools
from .webfetch import make_webfetch_tools

logger = logging.getLogger(__name__)


# ==================== 外部工具注册表 ====================
# 由主应用通过 register_external_tools() 注册
_external_tools: List[Dict] = []
_external_handlers: Dict[str, Any] = {}


def register_external_tools(tools: List[Dict], handlers: Dict[str, Any]) -> None:
    """
    注册外部工具（由主应用提供）。

    Args:
        tools: 工具定义列表
        handlers: 工具处理器字典
    """
    global _external_tools, _external_handlers
    _external_tools.extend(tools)
    _external_handlers.update(handlers)


def get_external_tools() -> Tuple[List[Dict], Dict[str, Any]]:
    """获取已注册的外部工具"""
    return _external_tools, _external_handlers


def _build_load_skill_handler(
    skills_loader: "SkillLoader | None",
    skill_access_state: "SkillAccessState | None",
) -> "Callable[[str], str]":
    """构建 load_skill handler：返回 body，成功时标记已加载。

    抽成独立函数便于单元测试（隔离重型 build_tool_registry）。
    """
    from ..skills.access_state import get_current_session_id, mark_loaded_if_known

    def _handle_load_skill(name: str) -> str:
        body = skills_loader.load(name) if skills_loader else "Error: no skills_loader"
        mark_loaded_if_known(skill_access_state, get_current_session_id(), name, body)
        return body

    return _handle_load_skill


def build_tool_registry(
    workdir,
    todo_mgr=None,
    task_mgr=None,
    bg_mgr=None,
    bus=None,
    team_mgr=None,
    skills_loader=None,
    run_subagent=None,
    model=None,
    client=None,
    transcript_dir=None,
    runtime=None,
    skill_access_state=None,
    max_tokens: int = 8000,
    **kwargs,
) -> Tuple[List[Dict], Dict[str, Any]]:
    """
    从所有模块构建完整的工具注册表

    Args:
        workdir: 工作目录
        todo_mgr: TodoManager 实例
        task_mgr: TaskManager 实例
        bg_mgr: BackgroundManager 实例
        bus: MessageBus 实例
        team_mgr: TeammateManager 实例
        skills_loader: SkillLoader 实例
        run_subagent: 子代理运行器函数
        model: 模型 ID
        client: Anthropic 客户端
        transcript_dir: 脚本目录
        runtime: AgentRuntime 实例（可选，用于运行时上下文）
        skill_access_state: SkillAccessState 实例（可选），用于 load_skill 标记已加载
        max_tokens: 对话模型单次输出上限（tokens），写入 task 工具描述，
            供主代理拆分子代理任务时按 max_tokens × 0.8 估算每组读取量
        **kwargs: 忽略额外的关键字参数（向后兼容）

    Returns:
        工具定义和处理器字典的元组
    """
    tools: List[Dict] = []
    handlers: Dict[str, Any] = {}

    # 有效的消息类型集合（用于团队通信）
    valid_msg_types = [
        "message",
        "broadcast",
        "shutdown_request",
        "shutdown_response",
        "plan_approval_response",
    ]

    # bash/powershell 的描述承担「工具路由」职责：模型在决策点读的是工具描述，
    # 仅靠系统提示词不足以纠正其 bash 习惯（训练语料里 grep/find 是默认动作）。
    # 路由规则按 rg 是否可用动态拼接（grep/glob 是条件注册，见下）
    shell_donts = (
        "不要用本工具读/改/写文件——读文件用 read_file、改文件用 edit_file、"
        "写文件用 write_file。"
    )
    if rg_available():
        shell_donts += (
            "不要用本工具跑 grep/rg/find/ls 做检索——"
            "搜索文件内容用 grep 工具、按文件名/模式找文件用 glob 工具。"
        )
    bash_description = (
        "运行 shell 命令（系统命令、脚本执行、构建、包管理等终端操作）。"
        + shell_donts
        + "仅当没有对应的专用工具时才用本工具。"
    )

    # 基础文件和命令工具
    basic_tools = [
        {
            "name": "bash",
            "description": bash_description,
            "input_schema": {
                "type": "object",
                "properties": {"command": {"type": "string"}},
                "required": ["command"],
            },
        },
        # Windows 原生 shell 工具（仅 Windows 注册，避免 Unix 下模型误用）
        *(
            [
                {
                    "name": "powershell",
                    "description": (
                        "运行 Windows 原生命令（优先 PowerShell 7，"
                        "回退 Windows PowerShell / cmd）。"
                        "仅适合注册表、服务、系统等 Windows 原生操作；"
                        + shell_donts
                    ),
                    "input_schema": {
                        "type": "object",
                        "properties": {"command": {"type": "string"}},
                        "required": ["command"],
                    },
                }
            ]
            if platform.system() == "Windows"
            else []
        ),
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
    tools.extend(basic_tools)
    # 外部访问门禁（ADR-0021）：gui_mode 链路启用——结构化工具路径逃逸
    # 从硬拒绝改为三态处置；shell 工具在白名单过滤后统一包装（见下）。
    # TUI/CLI 不传 gui_mode，行为不变。
    guard_on = bool(kwargs.get("gui_mode"))
    handlers.update(make_basic_tools(workdir, guard_enabled=guard_on))

    # grep/glob 工具：基于系统 rg 的结构化搜索（对齐 Claude Code GrepTool /
    # GlobTool，ADR-0022/0023）。条件注册：rg 缺失则不注册——模型自然降级
    # bash，避免注册必败工具浪费调用轮次
    if rg_available():
        grep_tools, grep_handlers = make_grep_tools(workdir, guard_enabled=guard_on)
        tools.extend(grep_tools)
        handlers.update(grep_handlers)
        glob_tools, glob_handlers = make_glob_tools(workdir, guard_enabled=guard_on)
        tools.extend(glob_tools)
        handlers.update(glob_handlers)

    # 网络工具
    web_tools, web_handlers = make_web_tools(client, model or "claude-opus-4-6")
    tools.extend(web_tools)
    handlers.update(web_handlers)

    # 待办和子代理工具
    todo_subagent_tools = [
        {
            "name": "TodoWrite",
            "description": "更新任务跟踪列表",
            "input_schema": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "content": {"type": "string"},
                                "status": {
                                    "type": "string",
                                    "enum": ["pending", "in_progress", "completed"],
                                },
                                "activeForm": {"type": "string"},
                            },
                        },
                    }
                },
                "required": ["items"],
            },
        },
        {
            "name": "task",
            "description": (
                "生成子代理进行隔离探索或工作。"
                f"当前对话模型单次输出上限 max_tokens={max_tokens} tokens；"
                "把读取/探索任务拆给多个并发子代理时，每个子代理分配的内容量"
                f"（按词数估算）建议 ≤ {int(max_tokens * 0.8)} 词"
                "（约 80%，为子代理的最终摘要输出留余量，超载会导致摘要被截断、章节缺失）"
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string"},
                    "agent_type": {
                        "type": "string",
                        "enum": ["Explore", "general-purpose"],
                    },
                },
                "required": ["prompt"],
            },
        },
        {
            "name": "load_skill",
            "description": "按名称加载专业化知识",
            "input_schema": {
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
            },
        },
    ]

    # 创建带运行时支持的工具处理器
    _load_skill_handler = _build_load_skill_handler(skills_loader, skill_access_state)

    handlers.update(
        {
            "TodoWrite": lambda **kw: todo_mgr.update(kw["items"]) if todo_mgr else None,
            "task": lambda **kw: _handle_task(
                kw["prompt"],
                kw.get("agent_type", "Explore"),
                workdir,
                client,
                model,
                handlers,
                run_subagent,
                runtime,
            ),
            "load_skill": lambda **kw: _load_skill_handler(kw["name"]),
        }
    )
    tools.extend(todo_subagent_tools)

    # 文件任务系统工具
    task_definitions = get_file_task_definitions()
    tools.extend(task_definitions)
    task_handlers = get_file_task_handlers(task_mgr)
    handlers.update(task_handlers)

    # 团队协作工具
    team_definitions = get_team_tools_definitions(valid_msg_types)
    tools.extend(team_definitions)
    team_handlers = get_team_tools_handlers(team_mgr, bus)
    handlers.update(team_handlers)

    # 协议工具
    protocol_definitions = get_protocol_definitions(valid_msg_types)
    tools.extend(protocol_definitions)
    protocol_handlers = get_protocol_handlers(bus)
    handlers.update(protocol_handlers)

    # 后台任务工具
    bg_tools = [
        {
            "name": "background_run",
            "description": "在后台线程中运行命令",
            "input_schema": {
                "type": "object",
                "properties": {
                    "command": {"type": "string"},
                    "timeout": {"type": "integer"},
                },
                "required": ["command"],
            },
        },
        {
            "name": "check_background",
            "description": "检查后台任务状态",
            "input_schema": {
                "type": "object",
                "properties": {"task_id": {"type": "string"}},
            },
        },
    ]
    tools.extend(bg_tools)
    handlers.update(
        {
            "background_run": lambda **kw: bg_mgr.run(
                kw["command"], kw.get("timeout", 120)
            ),
            "check_background": lambda **kw: bg_mgr.check(kw.get("task_id")),
        }
    )

    # 上下文压缩工具
    tools.extend(
        [
            {
                "name": "compress",
                "description": "手动压缩对话上下文",
                "input_schema": {"type": "object", "properties": {}},
            },
        ]
    )
    handlers.update({"compress": lambda **kw: "压缩中..."})

    # 用户交互工具
    # 注意：处理器需要在运行时通过 bind_user_interaction_handlers 绑定；
    # ask_user_question 为 GUI 结构化问答专用（include_ask_question=True 时注册）
    user_tools = get_user_interaction_tools()
    tools.extend(user_tools)
    if kwargs.get("gui_mode"):
        tools.append(get_ask_user_question_tool())

    # 外部工具（由主应用注册）。同名撞车防御：外部工具覆盖内置——handlers
    # 的 update 本就会覆盖，但 tools 列表若留两个同名定义，模型会看到两套
    # 矛盾 schema（且 API 侧工具名唯一性校验可能直接报错），此处同步去重并告警
    external_tools, external_handlers = get_external_tools()
    if external_tools:
        collided = {t["name"] for t in external_tools} & {t["name"] for t in tools}
        if collided:
            logger.warning(
                "[tools] 外部工具与内置工具同名，内置定义被外部覆盖: %s",
                sorted(collided),
            )
            tools = [t for t in tools if t["name"] not in collided]
        tools.extend(external_tools)
        handlers.update(external_handlers)

    # 百度天气工具
    baidu_weather_tools, baidu_weather_handlers = make_baidu_weather_tools()
    tools.extend(baidu_weather_tools)
    handlers.update(baidu_weather_handlers)

    # 网页内容抓取工具
    webfetch_tools, webfetch_handlers = make_webfetch_tools()
    tools.extend(webfetch_tools)
    handlers.update(webfetch_handlers)

    # 工具白名单：PLANIFY_ENABLED_TOOLS=bash,read_file,...（未设置/为空 = 全部注册）
    enabled_raw = os.getenv("PLANIFY_ENABLED_TOOLS", "").strip()
    if enabled_raw:
        enabled = {name.strip() for name in enabled_raw.split(",") if name.strip()}
        all_names = {t["name"] for t in tools}
        unknown = enabled - all_names
        if unknown:
            logger.warning("[tools] 白名单中的未知工具名将被忽略: %s", sorted(unknown))
        removed = all_names - enabled
        # gui_mode 下 ask_user_question 是 GUI 唯一的用户交互通道（旧 ask_user/
        # user_confirm 会被宿主会话层过滤），被白名单误删会导致模型要求提问时
        # 无工具可用、静默卡死——强制保留并告警
        if kwargs.get("gui_mode") and "ask_user_question" in removed:
            removed.discard("ask_user_question")
            logger.warning(
                "[tools] 白名单未包含 ask_user_question，GUI 模式下强制保留；"
                "如需彻底禁用请修改 PLANIFY_ENABLED_TOOLS 后使用 TUI"
            )
        tools = [t for t in tools if t["name"] in enabled or t["name"] not in removed]
        for name in removed:
            handlers.pop(name, None)
        logger.info(
            "[tools] 白名单生效：启用 %d 个，过滤 %d 个: %s",
            len(tools), len(removed), sorted(removed),
        )

    # 外部访问门禁：shell 工具包装（gui_mode 链路）。放在白名单过滤之后——
    # 被过滤掉的工具不包装。task 工具运行时按名取 handlers["bash"] 等，
    # 子代理因此拿到带门禁的函数（未授权外部访问在无交互上下文 fail-closed）。
    if guard_on:
        from .guard import wrap_shell_handler_fail_closed

        for shell_name in ("bash", "powershell", "background_run"):
            if shell_name in handlers:
                handlers[shell_name] = wrap_shell_handler_fail_closed(
                    handlers[shell_name], workdir, shell_name
                )
        logger.info("[tools] 外部访问门禁已启用（gui_mode）")

    return tools, handlers


def handle_task(
    prompt: str,
    agent_type: str,
    workdir,
    client,
    model,
    handlers: Dict[str, Any],
    run_subagent,
    runtime: Optional[Any] = None,
) -> str:
    """
    处理 task 工具调用（带运行时支持）

    Args:
        prompt: 子代理提示
        agent_type: 代理类型
        workdir: 工作目录
        client: Anthropic 客户端
        model: 模型 ID
        handlers: 工具处理器字典
        run_subagent: 子代理运行器函数
        runtime: AgentRuntime 实例（可选）

    Returns:
        执行结果
    """
    # 如果提供了 runtime，传递子代理的 workdir 配置
    subagent_workdir = workdir
    if runtime is not None:
        # 子代理可以在运行时的隔离目录中工作
        # 这里使用相同的工作目录，但可以配置为独立的临时目录
        pass

    return run_subagent(
        prompt,
        agent_type,
        subagent_workdir,
        client,
        model,
        run_bash=handlers["bash"],
        run_read=handlers["read_file"],
        run_write=handlers["write_file"],
        run_edit=handlers["edit_file"],
    )


# 保持向后兼容的内部函数
_handle_task = handle_task
