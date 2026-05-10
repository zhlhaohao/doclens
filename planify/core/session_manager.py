#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SessionManager - 会话管理器

管理所有活跃会话，提供会话创建、查询和关闭功能。
支持多用户多会话架构。
"""

import os
import shutil
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from anthropic import Anthropic

from .config import get_settings
from .client import init_anthropic_client
from .logging_config import setup_logging
from .session import Session, SessionConfig


def _get_default_assets_dir() -> Path:
    """获取默认的 assets 目录路径

    优先级：ASSETS_DIR 环境变量 > backend/app/assets
    """
    assets_dir_env = os.getenv("ASSETS_DIR", "")
    if assets_dir_env:
        # 支持绝对路径或相对于当前工作目录的路径
        if assets_dir_env.startswith("/"):
            return Path(assets_dir_env)
        else:
            return Path.cwd() / assets_dir_env
    # 默认值：backend/app/assets
    return Path(__file__).parent.parent.parent / "assets"


class SessionManager:
    """
    会话管理器

    使用单例模式，管理所有活跃会话。
    提供线程安全的会话操作。

    Anthropic 客户端作为全局共享资源，所有会话共用同一个实例。
    """

    _instance: Optional["SessionManager"] = None
    _lock = threading.Lock()
    _base_workdir: Optional[Path] = None  # 用于 get_config()

    # 全局共享的 Anthropic 客户端（所有会话共用）
    _anthropic_client: Optional[Any] = None
    _anthropic_model_id: str = "claude-opus-4-6"
    _anthropic_base_url: Optional[str] = None

    def __init__(self, base_workdir: Path):
        """
        初始化会话管理器。

        Args:
            base_workdir: 基础工作目录
        """
        self.base_workdir = base_workdir
        self._sessions_lock = threading.RLock()
        self._sessions: Dict[str, Session] = {}  # {user_id: Session}

    @classmethod
    def _get_config(cls) -> dict:
        """获取配置，确保 _base_workdir 已初始化"""
        if cls._base_workdir is None:
            cls._base_workdir = Path.cwd()
        return get_config(workdir=cls._base_workdir)

    @classmethod
    def _init_anthropic_client(cls, base_url: Optional[str] = None) -> Optional[Any]:
        """初始化全局共享的 Anthropic 客户端"""
        # 使用 get_settings() 统一读取配置（支持 FastAPI settings 或环境变量兜底）
        s = get_settings()
        anthropic_api_key = s.PLANIFY_API_KEY
        if anthropic_api_key:
            cls._anthropic_model_id = s.PLANIFY_MODEL_ID
            cls._anthropic_base_url = base_url or s.PLANIFY_BASE_URL
            try:
                masked = anthropic_api_key[:8] + "..." + anthropic_api_key[-4:]
                print(f"初始化全局 Anthropic 客户端: api_key={masked}, model_id={cls._anthropic_model_id}, base_url={cls._anthropic_base_url}")
                cls._anthropic_client = init_anthropic_client(cls._anthropic_base_url, anthropic_api_key)
            except Exception as e:
                print(f"警告: 无法初始化 Anthropic 客户端: {e}")
                cls._anthropic_client = None
        else:
            print("未配置 PLANIFY_API_KEY")
            cls._anthropic_client = None

    @classmethod
    def get_anthropic_client(cls) -> tuple[Optional[Any], str]:
        """
        获取全局共享的 Anthropic 客户端。

        Returns:
            (anthropic_client, anthropic_model_id) 元组
        """
        if cls._anthropic_client is None:
            cls._init_anthropic_client()
        return cls._anthropic_client, cls._anthropic_model_id

    @classmethod
    def get_instance(cls, base_workdir: Optional[Path] = None) -> "SessionManager":
        """
        获取 SessionManager 单例实例。

        Args:
            base_workdir: 基础工作目录（仅在首次创建时需要）

        Returns:
            SessionManager 实例
        """
        with cls._lock:
            if cls._instance is None:
                if base_workdir is None:
                    base_workdir = Path.cwd()
                cls._base_workdir = base_workdir
                cls._instance = cls(base_workdir)
            return cls._instance

    @classmethod
    def reset(cls) -> None:
        """重置单例（主要用于测试）"""
        with cls._lock:
            cls._instance = None

    def _get_user_workdir(self, user_id: str) -> Path:
        """获取用户的工作目录"""
        return self.base_workdir / user_id

    def get_or_create_session(
        self,
        user_id: str,
        user_config: Dict,
        **overrides
    ) -> Session:
        """
        获取或创建用户的默认会话。

        每个用户只有一个默认会话，如果不存在则自动创建。

        Args:
            user_id: 用户 ID
            user_config: 用户配置字典，包含 model_id, anthropic_api_key 等
            **overrides: 覆盖配置的额外参数

        Returns:
            用户的 Session 实例
        """
        with self._sessions_lock:
            # 检查是否已存在用户的会话
            if user_id in self._sessions:
                session = self._sessions[user_id]
                # 更新配置（如果有覆盖）
                if overrides:
                    # 默认 assets 目录
                    default_assets_dir = _get_default_assets_dir()
                    config_dict = {
                        "workdir": self.base_workdir,
                        "model_id": overrides.get("model_id", user_config.get("model_id", session.config.model_id)),
                        "anthropic_api_key": overrides.get("anthropic_api_key", user_config.get("anthropic_api_key", session.config.anthropic_api_key)),
                        "anthropic_base_url": overrides.get("anthropic_base_url", user_config.get("anthropic_base_url", session.config.anthropic_base_url)),
                        "token_threshold": overrides.get("token_threshold", user_config.get("token_threshold", session.config.token_threshold)),
                        "poll_interval": overrides.get("poll_interval", user_config.get("poll_interval", session.config.poll_interval)),
                        "idle_timeout": overrides.get("idle_timeout", user_config.get("idle_timeout", session.config.idle_timeout)),
                        "assets_dir": overrides.get("assets_dir", user_config.get("assets_dir", default_assets_dir)),
                    }
                    session.config = SessionConfig(**config_dict)
                return session

            # 创建新会话
            # 合并配置：overrides > user_config > 默认值
            # 默认 assets 目录
            default_assets_dir = _get_default_assets_dir()
            config = SessionConfig(
                workdir=self.base_workdir,
                model_id=overrides.get("model_id", user_config.get("model_id")),
                anthropic_api_key=overrides.get("anthropic_api_key", user_config.get("anthropic_api_key")),
                anthropic_base_url=overrides.get("anthropic_base_url", user_config.get("anthropic_base_url")),
                token_threshold=overrides.get("token_threshold", user_config.get("token_threshold", 100000)),
                poll_interval=overrides.get("poll_interval", user_config.get("poll_interval", 5)),
                idle_timeout=overrides.get("idle_timeout", user_config.get("idle_timeout", 60)),
                assets_dir=overrides.get("assets_dir", user_config.get("assets_dir", default_assets_dir)),
            )

            session = Session(user_id=user_id, phone=user_config.get("phone", ""), config=config)
            self._sessions[user_id] = session
            return session

    def get_session_simple(self, user_id: str) -> Optional[Session]:
        """
        获取用户的默认会话。

        Args:
            user_id: 用户 ID

        Returns:
            Session 实例，如果不存在则返回 None
        """
        with self._sessions_lock:
            return self._sessions.get(user_id)

    def close_session(self, user_id: str) -> bool:
        """
        关闭并移除用户的默认会话。

        Args:
            user_id: 用户 ID

        Returns:
            是否成功关闭
        """
        with self._sessions_lock:
            if user_id in self._sessions:
                session = self._sessions[user_id]
                session.status = "closed"
                del self._sessions[user_id]
                return True
            return False

    def list_user_sessions(self, user_id: str) -> List[Session]:
        """
        列出用户的会话。

        Args:
            user_id: 用户 ID

        Returns:
            该用户的会话列表（最多一个）
        """
        with self._sessions_lock:
            session = self._sessions.get(user_id)
            return [session] if session else []

    def list_all_sessions(self) -> List[Session]:
        """
        列出所有会话。

        Returns:
            所有活跃会话列表
        """
        with self._sessions_lock:
            return list(self._sessions.values())

    def initialize_session_components(self, session: Session) -> None:
        """
        初始化会话的所有组件。

        Args:
            session: 要初始化的 Session 实例
        """
        # 确保目录存在
        session.ensure_dirs()

        # 初始化日志
        session.logger = setup_logging(
            log_dir=session.config.logs_dir,
            console_output=False
        )

        # 获取全局共享的 Anthropic 客户端
        anthropic_client, _ = self.get_anthropic_client()
        session.client = anthropic_client

        # 导入管理器（延迟导入避免循环依赖）
        from ..managers import TodoManager, TaskManager, BackgroundManager, TeammateManager
        from ..messaging import MessageBus
        from ..skills import SkillLoader
        from ..tools import build_tool_registry
        from ..tools.basic import make_basic_tools, run_bash, run_read, run_write, run_edit

        # 初始化管理器
        session.todo_mgr = TodoManager()
        session.task_mgr = TaskManager(session.config.tasks_dir)
        # 使用用户级别的工作目录（简化：每个用户只有一个会话）
        user_workdir = self._get_user_workdir(session.user_id)
        session.bg_mgr = BackgroundManager(user_workdir)
        session.bus = MessageBus(session.config.inbox_dir)
        session.skills = SkillLoader(session.config.skills_dir)

        # 初始化队友管理器
        # 使用用户级别的工作目录
        basic_tools = make_basic_tools(user_workdir)
        session.team = TeammateManager(
            bus=session.bus,
            task_mgr=session.task_mgr,
            team_dir=session.config.team_dir,
            # 使用用户级别的工作目录（简化）
            workdir=user_workdir,
            model=session.model,
            client=session.client,
            poll_interval=session.poll_interval,
            idle_timeout=session.idle_timeout,
            run_bash=run_bash,
            run_read=run_read,
            run_write=run_write,
            run_edit=run_edit,
        )

        # 构建工具注册表
        session.tools, session.tool_handlers = build_tool_registry(
            workdir=user_workdir,
            todo_mgr=session.todo_mgr,
            task_mgr=session.task_mgr,
            bg_mgr=session.bg_mgr,
            bus=session.bus,
            team_mgr=session.team,
            skills_loader=session.skills,
            run_subagent=None,  # 稍后设置
            model=session.model,
            client=session.client,
            transcript_dir=session.config.transcript_dir,
            session=session,
        )

    def __len__(self) -> int:
        """返回活跃会话数量"""
        with self._sessions_lock:
            return len(self._sessions)

    def __repr__(self) -> str:
        """返回管理器表示"""
        with self._sessions_lock:
            return f"SessionManager(users={len(self._sessions)}, base_workdir={self.base_workdir})"

    def migrate_user_sessions(self, user_id: str) -> bool:
        """
        迁移用户的多个会话到单一默认会话。

        Args:
            user_id: 用户 ID

        Returns:
            是否成功迁移
        """
        import json

        user_sessions_dir = self.base_workdir / f".sessions/{user_id}"
        if not user_sessions_dir.exists():
            return True  # 没有数据需要迁移

        # 创建备份目录
        backup_dir = self.base_workdir / f".sessions_backup/{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        backup_dir.mkdir(parents=True, exist_ok=True)

        try:
            # 查找所有会话目录
            sessions_dir = user_sessions_dir / ".transcripts"
            if sessions_dir.exists():
                sessions = [d for d in sessions_dir.iterdir() if d.is_dir()]
                if len(sessions) <= 1:
                    # 只有一个或没有会话，无需迁移
                    return True

                print(f"发现用户 {user_id} 有 {len(sessions)} 个会话，开始迁移...")

                # 找到最后修改时间最晚的会话
                latest_session = max(sessions, key=lambda x: x.stat().st_mtime)
                print(f"选择会话: {latest_session.name}")

                # 备份旧数据
                backup_target = backup_dir / "old_sessions"
                shutil.copytree(user_sessions_dir, backup_target)
                print(f"备份数据到: {backup_target}")

                # 创建新的简化目录结构（直接在 user_id 下）
                new_user_dir = self.base_workdir / user_id
                new_user_dir.mkdir(parents=True, exist_ok=True)

                # 移动 .team 和 .tasks 目录到 .planify/
                for dir_name in [".team", ".tasks"]:
                    src = user_sessions_dir / dir_name
                    if src.exists():
                        dst = new_user_dir / ".planify" / dir_name.lstrip(".")
                        if dst.exists():
                            shutil.rmtree(dst)
                        dst.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(src), str(dst))

                # 处理转录文件
                transcript_files = []
                for session in sessions:
                    transcript_file = session / "transcript.json"
                    if transcript_file.exists():
                        transcript_files.append(transcript_file)

                if transcript_files:
                    # 合并所有转录文件
                    merged_messages = []
                    for transcript_file in sorted(transcript_files,
                                                key=lambda x: x.stat().st_mtime):
                        with open(transcript_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            if isinstance(data, list):
                                merged_messages.extend(data)

                    # 保存合并后的转录文件到 .planify/
                    new_user_dir / ".planify" / "transcript.json"
                    merged_transcript = new_user_dir / ".planify" / "transcript.json"
                    merged_transcript.parent.mkdir(parents=True, exist_ok=True)
                    with open(merged_transcript, 'w', encoding='utf-8') as f:
                        json.dump(merged_messages, f, ensure_ascii=False, indent=2)
                    print(f"合并 {len(transcript_files)} 个转录文件到: {merged_transcript}")

                # 清理旧目录
                shutil.rmtree(user_sessions_dir)
                print(f"清理旧目录: {user_sessions_dir}")

                return True

        except Exception as e:
            print(f"迁移失败: {e}")
            # 如果迁移失败，恢复备份
            if backup_dir.exists():
                shutil.rmtree(user_sessions_dir, ignore_errors=True)
                if (self.base_workdir / ".sessions").exists():
                    shutil.move(str(backup_dir / "old_sessions"), str(user_sessions_dir))
                print(f"已恢复备份数据")
            return False

    def check_and_migrate_all_users(self) -> Dict[str, bool]:
        """
        检查并迁移所有用户的数据。

        Returns:
            用户 ID 到迁移结果的映射
        """
        results = {}
        sessions_dir = self.base_workdir / ".sessions"

        if not sessions_dir.exists():
            return results

        for user_dir in sessions_dir.iterdir():
            if user_dir.is_dir() and not user_dir.name.startswith('.'):
                user_id = user_dir.name
                print(f"检查用户: {user_id}")
                results[user_id] = self.migrate_user_sessions(user_id)

        return results
