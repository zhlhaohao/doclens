"""工具注册中心

从所有模块构建完整的工具定义和处理器。
支持多用户多会话架构，使用 Session 上下文。
"""

from typing import Any, Dict, List, Tuple, Optional

from .basic import make_basic_tools
from .web import make_web_tools
from .file_tasks import get_file_task_definitions, get_file_task_handlers
from .team_tools import get_team_tools_definitions, get_team_tools_handlers
from .protocols import get_protocol_definitions, get_protocol_handlers
from .user_interaction import get_user_interaction_tools
from .weather_tool import make_baidu_weather_tools


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


def build_tool_registry(
    workdir,
    zhipu_client,
    zhipu_model_id="glm-4",
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
    session=None,
) -> Tuple[List[Dict], Dict[str, Any]]:
    """
    从所有模块构建完整的工具注册表

    Args:
        workdir: 工作目录
        zhipu_client: ZhipuAI 客户端
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
        session: Session 实例（可选，用于会话上下文）

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

    # 基础文件和命令工具
    basic_tools = [
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
            "description": "读取文件内容",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "limit": {"type": "integer"},
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
            "description": "替换文件中的文本",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "old_text": {"type": "string"},
                    "new_text": {"type": "string"},
                },
                "required": ["path", "old_text", "new_text"],
            },
        },
    ]
    tools.extend(basic_tools)
    handlers.update(make_basic_tools(workdir))

    # 网络工具
    web_tools, web_handlers = make_web_tools(zhipu_client, zhipu_model_id)
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
            "description": "生成子代理进行隔离探索或工作",
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

    # 创建带 Session 支持的工具处理器
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
                session,
            ),
            "load_skill": lambda **kw: skills_loader.load(kw["name"]),
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
    # 注意：处理器需要在运行时通过 bind_user_interaction_handlers 绑定
    user_tools = get_user_interaction_tools()
    tools.extend(user_tools)

    # 外部工具（由主应用注册）
    external_tools, external_handlers = get_external_tools()
    tools.extend(external_tools)
    handlers.update(external_handlers)

    # 百度天气工具
    baidu_weather_tools, baidu_weather_handlers = make_baidu_weather_tools()
    tools.extend(baidu_weather_tools)
    handlers.update(baidu_weather_handlers)

    return tools, handlers


def handle_task(
    prompt: str,
    agent_type: str,
    workdir,
    client,
    model,
    handlers: Dict[str, Any],
    run_subagent,
    session: Optional[Any] = None,
) -> str:
    """
    处理 task 工具调用（带 Session 支持）

    Args:
        prompt: 子代理提示
        agent_type: 代理类型
        workdir: 工作目录
        client: Anthropic 客户端
        model: 模型 ID
        handlers: 工具处理器字典
        run_subagent: 子代理运行器函数
        session: Session 实例（可选）

    Returns:
        执行结果
    """
    # 如果提供了 session，传递子代理的 workdir 配置
    subagent_workdir = workdir
    if session is not None:
        # 子代理可以在会话的隔离目录中工作
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
