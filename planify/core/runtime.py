#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Runtime 模块 - Agent 运行时组件容器和配置

AgentRuntime 是进程级组件容器（client/tools/managers/config），
不承担对话身份与历史（对话维度的 session_id 由宿主应用管理并穿透传入）。
"""

import copy
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from planify.skills.access_state import SkillAccessState




@dataclass
class RuntimeConfig:
    """
    运行时配置

    包含运行时的所有配置参数和目录路径。
    注意：user_id 和 phone 应存储在 AgentRuntime 对象上，而非此处。
    """

    workdir: Path
    model_id: str
    api_key: str
    base_url: Optional[str] = None
    protocol: str = "anthropic"
    token_threshold: int = 100000
    planify_context_window: int = 200000
    planify_max_tokens: int = 8000
    poll_interval: int = 5
    idle_timeout: int = 60
    assets_dir: Optional[Path] = None  # assets 目录路径
    # 压缩 transcript 输出目录（宿主注入；None 时 runner 退回 <workdir>/.transcripts/）。
    # 宿主（doclens）注入 <workdir>/.cortex/transcripts——.cortex 被索引器与
    # FileWatcher 排除，避免压缩落盘触发 watch 回路、transcript 混入检索结果。
    compact_transcript_dir: Optional[Path] = None

    # 隔离目录路径
    @property
    def planify_dir(self) -> Path:
        """获取 .planify 目录"""
        return self.workdir / ".planify"

    @property
    def team_dir(self) -> Path:
        """获取团队配置目录"""
        return self.planify_dir / "team"

    @property
    def tasks_dir(self) -> Path:
        """获取任务目录"""
        return self.planify_dir / "tasks"

    @property
    def transcript_dir(self) -> Path:
        """获取对话记录文件"""
        return self.planify_dir / "transcript.json"

    @property
    def inbox_dir(self) -> Path:
        """获取收件箱目录"""
        return self.team_dir / "inbox"

    @property
    def skills_dir(self) -> Path:
        """获取技能目录（共享）"""
        return self.workdir / "skills"

    @property
    def logs_dir(self) -> Path:
        """获取日志目录"""
        return self.planify_dir / "logs"

@dataclass
class AgentRuntime:
    """
    Agent 运行时组件容器

    封装一次进程运行所需的全部组件与配置（client/tools/managers），
    提供线程安全的消息历史管理。不承载对话身份——对话维度的
    session_id 由宿主应用（如 doclens 的 DB 会话）管理并穿透传入；
    runtime_id 仅作运行时兜底标识（CLI 单会话场景）。
    """

    user_id: str  # 用户 ID，直接存储在 AgentRuntime 上
    phone: str = ""  # 手机号，直接存储在 AgentRuntime 上
    config: RuntimeConfig = None  # 必须提供
    runtime_id: str = ""  # 运行时标识（兜底用；Web 模式对话身份用宿主的 session_id）

    # 核心组件
    client: Optional[Any] = None  # 实际类型为 LLMProvider
    provider: Optional[Any] = None  # 新增显式字段
    todo_mgr: Optional[Any] = None
    task_mgr: Optional[Any] = None
    bg_mgr: Optional[Any] = None
    bus: Optional[Any] = None
    team: Optional[Any] = None
    skills: Optional[Any] = None
    logger: Optional[Any] = None

    # 工具
    tools: List[Dict] = field(default_factory=list)
    tool_handlers: Dict[str, Any] = field(default_factory=dict)

    # 技能门禁状态（按对话 session_id 跟踪已加载 skill）。宿主装配时赋值，
    # streaming/runner 通过 getattr 读取以兼容历史 runtime 实例。
    skill_access_state: Optional["SkillAccessState"] = None

    # 线程安全的消息历史
    _messages_lock: threading.RLock = field(default_factory=threading.RLock)
    _messages: List[Dict] = field(default_factory=list)

    # 会话状态
    status: str = "active"
    created_at: float = field(default_factory=lambda: __import__("time").time())

    def append_message(self, message: Dict[str, Any]) -> None:
        """
        线程安全地追加消息到历史。

        Args:
            message: 消息字典
        """
        with self._messages_lock:
            self._messages.append(message)

    def get_messages(self) -> List[Dict[str, Any]]:
        """
        线程安全地获取消息历史（返回深层副本）。

        Returns:
            消息历史列表的深层副本
        """
        with self._messages_lock:
            return copy.deepcopy(self._messages)

    def set_messages(self, messages: List[Dict[str, Any]]) -> None:
        """
        线程安全地设置消息历史。

        Args:
            messages: 新的消息历史列表
        """
        with self._messages_lock:
            self._messages = list(messages)

    def replace_messages_in_place(self, messages: List[Dict[str, Any]]) -> None:
        """
        线程安全地就地替换消息历史（原地修改引用）。

        用于压缩后替换整个历史列表。

        Args:
            messages: 新的消息历史列表
        """
        with self._messages_lock:
            self._messages[:] = messages

    @property
    def llm_provider(self) -> Any:
        """统一访问 LLMProvider，优先用 provider，回退到 client。"""
        return self.provider or self.client

    def update_llm_config(
        self,
        *,
        protocol: str = "",
        api_key: Optional[str] = None,
        model_id: Optional[str] = None,
        base_url: Optional[str] = None,
        planify_context_window: Optional[int] = None,
        planify_max_tokens: Optional[int] = None,
    ) -> None:
        """热更新 LLM 配置：重建 Provider 并更新 RuntimeConfig 字段。

        planify 官方的配置热更新入口——宿主应用（如 doclens 的 /api/config
        PUT 与预设切换）应调用本方法，而非直接写 runtime.config 内部字段。
        新建的 Provider 与旧实例互不影响；已构造的 Agent 不受影响（它们在
        构造时捕获 client/model），下次构造时读到新值。

        Args:
            protocol: 协议类型（"anthropic" / "openai_compat"），空串表示沿用
                      create_provider 的默认判定
            api_key: 新 API Key；None 表示不更新
            model_id: 新模型 ID；None 表示不更新
            base_url: 新 API 端点；None 表示不更新
            planify_context_window: 上下文窗口；None 表示不更新
            planify_max_tokens: 单次输出上限；None 表示不更新
        """
        from .llm import create_provider

        client = create_provider(
            {
                "protocol": protocol,
                "api_key": api_key,
                "model_id": model_id,
                "base_url": base_url,
            }
        )
        # client 与 provider 双指同一实例（client 为历史兼容字段）
        self.client = client
        self.provider = client
        if model_id is not None:
            self.config.model_id = model_id
        if api_key is not None:
            self.config.api_key = api_key
        if base_url is not None:
            self.config.base_url = base_url
        if planify_context_window is not None:
            self.config.planify_context_window = planify_context_window
        if planify_max_tokens is not None:
            self.config.planify_max_tokens = planify_max_tokens

    @property
    def model(self) -> str:
        """获取模型 ID"""
        return self.config.model_id

    @property
    def token_threshold(self) -> int:
        """获取 token 阈值"""
        return self.config.token_threshold

    @property
    def poll_interval(self) -> int:
        """获取轮询间隔"""
        return self.config.poll_interval

    @property
    def idle_timeout(self) -> int:
        """获取空闲超时"""
        return self.config.idle_timeout

    def ensure_dirs(self) -> None:
        """
        确保所有必需的目录存在。
        """
        # 创建用户级别的工作目录和子目录
        self.config.workdir.mkdir(parents=True, exist_ok=True)
        self.config.team_dir.mkdir(parents=True, exist_ok=True)
        self.config.tasks_dir.mkdir(parents=True, exist_ok=True)
        self.config.inbox_dir.mkdir(parents=True, exist_ok=True)
        self.config.skills_dir.mkdir(parents=True, exist_ok=True)
        self.config.logs_dir.mkdir(parents=True, exist_ok=True)

        # 确保对话记录文件的父目录存在（transcript 现在是文件）
        self.config.transcript_dir.parent.mkdir(parents=True, exist_ok=True)

    def __str__(self) -> str:
        """返回运行时描述字符串"""
        return f"AgentRuntime(user={self.user_id}, status={self.status})"


