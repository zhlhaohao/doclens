"""配置管理

提供集中配置，支持环境变量和用户配置参数。

配置优先级（最高在前）：
1. user_config 参数传入
2. 环境变量
3. {workdir}/.planify/.env
4. {workdir}/.env.local（dotenv 自动优先加载）
5. {workdir}/.env
6. 默认值

注意：.planify/.env 用于项目级配置，.env.local 用于本地开发配置，不应提交到版本控制。
"""

import os
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv


# =============================================================================
# Planify 配置注册表（支持主应用注入）
# =============================================================================
# 配置优先级：已注册配置 > 环境变量 > 默认值

_registered_config: dict = {}


def register_config(config: dict) -> None:
    """
    注册 Planify 配置（由主应用注入）。

    Args:
        config: 配置字典，包含 zhipuai_api_key, planify_api_key 等字段
    """
    global _registered_config
    _registered_config = config


def _get_env_or_default(key: str, default: str = "") -> str:
    """从已注册配置或环境变量获取值"""
    if key in _registered_config and _registered_config[key]:
        return _registered_config[key]
    return os.getenv(key, default)


class _PlanifySettings:
    """Planify 配置类，兼容 settings 接口"""

    def __init__(self, config: dict):
        self._config = config

    def _get(self, key: str, default: str = "") -> str:
        val = self._config.get(key) if self._config else None
        if val is not None and val != "":
            return val
        # 回退到环境变量
        env_key = key.upper()
        return os.getenv(env_key, default)

    @property
    def ZHIPUAI_API_KEY(self) -> str:
        return self._get("zhipuai_api_key", "")

    @property
    def ZHIPUAI_MODEL_ID(self) -> str:
        return self._get("zhipuai_model_id", "glm-4")

    @property
    def ZHIPUAI_BASE_URL(self) -> str:
        return self._get("zhipuai_base_url", "")

    @property
    def PLANIFY_API_KEY(self) -> str:
        return self._get("planify_api_key", "")

    @property
    def PLANIFY_MODEL_ID(self) -> str:
        return self._get("planify_model_id", "claude-opus-4-6")

    @property
    def PLANIFY_BASE_URL(self) -> str:
        return self._get("planify_base_url", "")

    @property
    def BAIDU_WEATHER_API_URL(self) -> str:
        return self._get(
            "baidu_weather_api_url",
            "https://api.map.com.com/weather/v2/"
        )

    @property
    def BAIDU_WEATHER_AK(self) -> str:
        return self._get("baidu_weather_ak", "")

    @property
    def BAIDU_WEATHER_DATA_TYPE(self) -> str:
        return self._get("baidu_weather_data_type", "fc")


_settings: _PlanifySettings | None = None


def get_settings():
    """
    获取 Planify settings。

    优先级：
    1. 已注册配置（通过 register_config）
    2. 环境变量

    Returns:
        _PlanifySettings 实例
    """
    global _settings
    if _settings is None:
        _settings = _PlanifySettings(_registered_config)
    return _settings


def get_config(
    workdir: Optional[Path] = None,
    user_config: Optional[Dict[str, Any]] = None,
    load_env: bool = True
) -> Dict[str, Any]:
    """
    加载并返回应用配置。

    配置优先级（最高在前）：
    1. user_config 参数
    2. 环境变量
    3. .env 文件中的值
    4. 默认值

    Args:
        workdir: 工作目录（默认为当前目录）
        user_config: 用户配置字典，覆盖其他来源
        load_env: 是否加载 .env 文件（默认 True）

    Returns:
        包含所有设置的配置字典
    """
    if workdir is None:
        workdir = Path.cwd()

    # 加载 .env 文件（仅在 load_env=True 时）
    # 优先级：.planify/.env > .env.local > .env
    if load_env:
        planify_env = workdir / ".planify" / ".env"
        if planify_env.exists():
            load_dotenv(planify_env, override=True)
        else:
            load_dotenv(override=True)

    # 处理自定义 API 端点 - 移除默认的 auth token 以避免冲突
    if os.getenv("PLANIFY_BASE_URL"):
        os.environ.pop("ANTHROPIC_AUTH_TOKEN", None)

    # 目录路径
    team_dir = workdir / ".planify" / "team"
    inbox_dir = team_dir / "inbox"
    tasks_dir = workdir / ".planify" / "tasks"
    skills_dir = workdir / "skills"
    transcript_dir = workdir / ".planify" / "transcript.json"

    # Assets 目录（支持绝对路径或相对于 workdir 的路径）
    assets_dir_env = os.getenv("ASSETS_DIR", "")
    if assets_dir_env:
        assets_dir = Path(assets_dir_env) if assets_dir_env.startswith("/") else workdir / assets_dir_env
    else:
        assets_dir = workdir / "app" / "assets"

    # 阈值和超时设置
    token_threshold = 100000  # 超过此阈值时触发自动压缩
    poll_interval = 5  # 空闲轮询间隔（秒）
    idle_timeout = 60  # 空闲超时时间（秒）

    # 有效的消息类型集合（s09/s10）
    valid_msg_types = {
        "message",               # 普通消息
        "broadcast",             # 广播消息
        "shutdown_request",      # 关闭请求
        "shutdown_response",     # 关闭响应
        "plan_approval_response" # 计划审批响应
    }

    # 基础配置
    config = {
        # API 配置
        "model_id": os.getenv("PLANIFY_MODEL_ID"),
        "anthropic_base_url": os.getenv("PLANIFY_BASE_URL"),
        "anthropic_api_key": os.getenv("PLANIFY_API_KEY"),
        "zhipu_api_key": os.getenv("ZHIPUAI_API_KEY"),
        "zhipu_model_id": os.getenv("ZHIPUAI_MODEL_ID", "glm-4"),

        # 路径配置
        "workdir": workdir,
        "team_dir": team_dir,
        "inbox_dir": inbox_dir,
        "tasks_dir": tasks_dir,
        "skills_dir": skills_dir,
        "transcript_dir": transcript_dir,
        "assets_dir": assets_dir,

        # 阈值和超时配置
        "token_threshold": token_threshold,
        "poll_interval": poll_interval,
        "idle_timeout": idle_timeout,

        # 消息类型
        "valid_msg_types": valid_msg_types,
    }

    # 应用 user_config 覆盖
    if user_config:
        config.update(user_config)

    return config


def get_user_config_dict(
    model_id: Optional[str] = None,
    anthropic_api_key: Optional[str] = None,
    anthropic_base_url: Optional[str] = None,
    token_threshold: Optional[int] = None,
    poll_interval: Optional[int] = None,
    idle_timeout: Optional[int] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    构建用户配置字典。

    Args:
        model_id: 模型 ID
        anthropic_api_key: Anthropic API 密钥
        anthropic_base_url: 自定义 API 端点
        token_threshold: token 压缩阈值
        poll_interval: 轮询间隔
        idle_timeout: 空闲超时
        **kwargs: 其他配置项

    Returns:
        用户配置字典
    """
    config = {}

    if model_id is not None:
        config["model_id"] = model_id
    if anthropic_api_key is not None:
        config["anthropic_api_key"] = anthropic_api_key
    if anthropic_base_url is not None:
        config["anthropic_base_url"] = anthropic_base_url
    if token_threshold is not None:
        config["token_threshold"] = token_threshold
    if poll_interval is not None:
        config["poll_interval"] = poll_interval
    if idle_timeout is not None:
        config["idle_timeout"] = idle_timeout

    config.update(kwargs)
    return config


def validate_config(config: Dict[str, Any]) -> bool:
    """
    验证必需的配置值。

    Args:
        config: 配置字典

    Returns:
        配置有效时返回 True

    Raises:
        ValueError: 如果缺少必需的配置
    """
    if not config.get("model_id"):
        raise ValueError("PLANIFY_MODEL_ID is required. Set it in .env file or environment.")
    if not config.get("anthropic_api_key"):
        raise ValueError("PLANIFY_API_KEY is required. Set it in .env file or environment.")
    return True
