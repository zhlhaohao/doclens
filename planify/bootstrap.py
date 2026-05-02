#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
应用初始化模块（多用户多会话架构）

负责初始化 SessionManager 并提供会话管理接口。
不再使用全局单例模式，支持多用户并发访问。
"""

from pathlib import Path
from typing import Any, Dict, Optional

from .core import SessionManager, get_config, get_user_config_dict
from .subagent.runner import run_subagent


# SessionManager 单例（通过 get_instance() 访问）
_manager: Optional[SessionManager] = None

# Planify 配置注册表（由主应用注入）
_registered_config: Dict[str, Any] = {}


# ============================================================================
# 主应用依赖注册
# ============================================================================

def register_app_dependencies(
    external_tools=None,
    external_handlers=None,
) -> None:
    """
    注册主应用（FastAPI backend）提供的外部工具。

    当 third_party.planify 作为独立模块被主应用集成时，
    主应用通过此函数注册其提供的工具。

    Args:
        external_tools: 外部工具定义列表
        external_handlers: 外部工具处理器字典
    """
    if external_tools or external_handlers:
        from .tools.registry import register_external_tools
        register_external_tools(
            tools=external_tools or [],
            handlers=external_handlers or {},
        )
        print("已注册外部工具")


def register_planify_config(
    zhipuai_api_key: str = "",
    zhipuai_model_id: str = "glm-4",
    zhipuai_base_url: str = "",
    planify_api_key: str = "",
    planify_model_id: str = "claude-opus-4-6",
    planify_base_url: str = "",
    baidu_weather_api_url: str = "https://api.map.com.com/weather/v2/",
    baidu_weather_ak: str = "",
    baidu_weather_data_type: str = "fc",
    **extra: Any,
) -> None:
    """
    注册 Planify 配置（由主应用在启动时调用）。

    配置优先级：
    1. 通过此函数注册的配置（最高）
    2. 环境变量
    3. 默认值

    Args:
        zhipuai_api_key: 智谱AI API Key
        zhipuai_model_id: 智谱AI 模型 ID
        zhipuai_base_url: 智谱AI API 端点
        planify_api_key: Anthropic API Key
        planify_model_id: Anthropic 模型 ID
        planify_base_url: Anthropic API 端点
        baidu_weather_api_url: 百度天气 API URL
        baidu_weather_ak: 百度天气 AK
        baidu_weather_data_type: 百度天气数据类型
        **extra: 其他额外配置项
    """
    global _registered_config
    _registered_config = {
        "zhipuai_api_key": zhipuai_api_key,
        "zhipuai_model_id": zhipuai_model_id,
        "zhipuai_base_url": zhipuai_base_url,
        "planify_api_key": planify_api_key,
        "planify_model_id": planify_model_id,
        "planify_base_url": planify_base_url,
        "baidu_weather_api_url": baidu_weather_api_url,
        "baidu_weather_ak": baidu_weather_ak,
        "baidu_weather_data_type": baidu_weather_data_type,
        **extra,
    }

    # 将配置同步到 core/config.py，使其对 SessionManager 可见
    from .core.config import register_config
    register_config(_registered_config)

    print("已注册 Planify 配置")


def get_registered_config() -> Dict[str, Any]:
    """获取已注册的 Planify 配置"""
    return _registered_config


def get_manager() -> SessionManager:
    """
    获取 SessionManager 单例实例。

    Returns:
        SessionManager 实例

    Raises:
        RuntimeError: 如果应用尚未初始化
    """
    global _manager
    if _manager is None:
        raise RuntimeError("应用尚未初始化。请先调用 initialize()。")
    return _manager


def initialize(base_workdir: Optional[Path] = None) -> SessionManager:
    """
    初始化应用并返回 SessionManager 单例。

    此函数创建 SessionManager 单例，用于管理所有用户会话。
    在初始化时自动检查并迁移旧的多会话数据。

    Args:
        base_workdir: 基础工作目录（默认为当前目录）

    Returns:
        SessionManager 实例
    """
    global _manager

    if _manager is not None:
        return _manager

    if base_workdir is None:
        base_workdir = Path.cwd()

    _manager = SessionManager(base_workdir)

    # 自动检查并迁移数据
    print("检查并迁移用户数据...")
    migration_results = _manager.check_and_migrate_all_users()
    successful_migrations = sum(1 for result in migration_results.values() if result)
    if successful_migrations > 0:
        print(f"成功迁移 {successful_migrations} 个用户的数据")
    else:
        print("没有需要迁移的数据")

    return _manager


def reset():
    """
    重置应用状态（主要用于测试）。

    清除 SessionManager 单例，允许重新初始化。
    """
    global _manager
    _manager = None
    SessionManager.reset()


# ============================================================================
# 简化的会话管理 API
# ============================================================================

def get_or_create_session(user_id: str, user_config: dict, **overrides):
    """
    获取或创建用户的默认会话。

    每个用户只有一个默认会话，如果不存在则自动创建。

    Args:
        user_id: 用户 ID
        user_config: 用户配置字典
        **overrides: 覆盖配置的额外参数

    Returns:
        Session 实例
    """
    manager = get_manager()
    session = manager.get_or_create_session(user_id, user_config, **overrides)
    manager.initialize_session_components(session)

    # 设置子代理处理器（使用会话隔离的工作目录）
    from .tools import handle_task
    session.tool_handlers["task"] = lambda **kw: handle_task(
        kw["prompt"],
        kw.get("agent_type", "Explore"),
        session.config.session_workdir,
        session.client,
        session.model,
        session.tool_handlers,
        run_subagent=session,
        session=session
    )

    return session


def list_all_sessions():
    """
    列出所有会话。

    Returns:
        所有活跃会话列表
    """
    manager = get_manager()
    return manager.list_all_sessions()


# ============================================================================
# 简化的会话管理 API（别名）
# ============================================================================

def get_session_simple(user_id: str):
    """
    获取用户的默认会话。

    Args:
        user_id: 用户 ID

    Returns:
        Session 实例，如果不存在则返回 None
    """
    manager = get_manager()
    return manager.get_session_simple(user_id)


def close_session_simple(user_id: str) -> bool:
    """
    关闭并移除用户的默认会话。

    Args:
        user_id: 用户 ID

    Returns:
        是否成功关闭
    """
    manager = get_manager()
    return manager.close_session(user_id)


# ============================================================================
# 向后兼容：旧的 API 接口（单用户模式）
# ============================================================================

# 这些全局变量仅用于向后兼容，不推荐在新代码中使用
config = None
logger = None
client = None
zhipu_client = None
todo_mgr = None
task_mgr = None
bg_mgr = None
bus = None
team = None
skills = None
tools = None
tool_handlers = None
workdir = None
model = None
token_threshold = None


def init_legacy_session(user_id: str = "default", session_id: str = "default"):
    """
    初始化旧版单用户模式的会话（向后兼容）。

    此函数创建一个会话并将其状态同步到全局变量。

    现在使用新的简化 API 自动创建用户的默认会话。

    Args:
        user_id: 用户 ID
        session_id: 会话 ID（已废弃，保留参数以兼容）
    """
    global config, logger, client, zhipu_client
    global todo_mgr, task_mgr, bg_mgr, bus, team, skills
    global tools, tool_handlers, workdir, model, token_threshold

    # 使用新的简化 API 创建默认会话
    app_config = get_config()
    session = get_or_create_session(
        user_id,
        user_config=get_user_config_dict(
            model_id=app_config.get("model_id"),
            anthropic_api_key=app_config.get("anthropic_api_key"),
            anthropic_base_url=app_config.get("anthropic_base_url"),
            token_threshold=app_config.get("token_threshold"),
            poll_interval=app_config.get("poll_interval"),
            idle_timeout=app_config.get("idle_timeout"),
        )
    )

    # 同步到全局变量
    config = session.config
    logger = session.logger
    client = session.client
    # zhipu_client 现在是全局共享的，从 SessionManager 获取
    zhipu_client, _ = SessionManager.get_zhipu_client()
    todo_mgr = session.todo_mgr
    task_mgr = session.task_mgr
    bg_mgr = session.bg_mgr
    bus = session.bus
    team = session.team
    skills = session.skills
    tools = session.tools
    tool_handlers = session.tool_handlers
    workdir = session.config.workdir
    model = session.model
    token_threshold = session.token_threshold

    return session
