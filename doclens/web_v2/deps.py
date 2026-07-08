"""web_v2 共享依赖管理 — IndexManager / CortexAgent 单例。

复制自 cortex/web/deps.py，去除 Gradio 依赖。
"""
import logging
import os
import threading
from pathlib import Path
from typing import Optional

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager
from doclens.web_v2.sessions_store import SessionsStore

logger = logging.getLogger(__name__)

_config: Optional[CortexConfig] = None
_idx_manager: Optional[IndexManager] = None
_sessions_store: Optional[SessionsStore] = None
_agent: Optional[object] = None  # CortexAgent，延迟导入避免循环依赖
_lock = threading.RLock()


def get_config() -> CortexConfig:
    """获取 CortexConfig 单例（懒加载 + 线程安全）。"""
    global _config
    if _config is None:
        with _lock:
            if _config is None:
                _config = CortexConfig.load()
                logger.info("CortexConfig loaded")
    return _config


def get_index_manager() -> IndexManager:
    """获取 IndexManager 单例（懒加载 + 线程安全）。

    `load_or_build_index()` 最终会调用 `TreeSearch.index()`，后者在事件循环
    已运行时会拒绝执行（见 treesearch.py 的 `asyncio.get_running_loop()` 检查）。
    因此在子线程中完成初始化，既绕过事件循环检查，也兼容 sync / async 调用方。
    """
    global _idx_manager
    if _idx_manager is None:
        with _lock:
            if _idx_manager is None:
                config = get_config()
                mgr = IndexManager(config)
                err: list = []

                def _build():
                    try:
                        mgr.load_or_build_index()
                    except Exception as e:  # noqa: BLE001
                        err.append(e)

                t = threading.Thread(target=_build, daemon=True)
                t.start()
                t.join()
                if err:
                    raise err[0]
                # 构建成功后再发布单例，避免半初始化实例泄漏到后续调用
                _idx_manager = mgr
                logger.info("IndexManager initialized: %d documents", len(mgr.documents))
    return _idx_manager


def get_agent():
    """获取 CortexAgent 单例（懒加载 + 线程安全）。"""
    global _agent
    if _agent is None:
        with _lock:
            if _agent is None:
                from doclens.agent_integration import CortexAgent
                idx = get_index_manager()
                workdir = Path(idx.search_path)
                _agent = CortexAgent(workdir).initialize()
                logger.info("CortexAgent initialized")
    return _agent


def get_sessions_store() -> SessionsStore:
    """获取 SessionsStore 单例（懒加载 + 线程安全）。

    sessions.db 与 index.db 同在 .cortex/ 目录，跟随工作目录隔离。
    """
    global _sessions_store
    if _sessions_store is None:
        with _lock:
            if _sessions_store is None:
                idx = get_index_manager()
                db_path = Path(idx.index_path).parent / "sessions.db"
                db_path.parent.mkdir(parents=True, exist_ok=True)
                _sessions_store = SessionsStore(db_path)
    return _sessions_store


def reset_singletons() -> None:
    """重置单例（仅供测试使用）。"""
    global _config, _idx_manager, _sessions_store, _agent
    with _lock:
        _config = None
        _idx_manager = None
        _sessions_store = None
        _agent = None


def reload_config() -> CortexConfig:
    """重建 CortexConfig 并推送到已存在的单例。

    先用 load_dotenv(override=True) 刷新 os.environ，确保 pydantic-settings
    读到的环境变量与最新 .env 一致（而非 CortexAgent.initialize() 早期
    load_dotenv 写入的过期值）。
    """
    global _config
    with _lock:
        from dotenv import load_dotenv
        from doclens.config import get_global_cortex_dir

        global_env = get_global_cortex_dir() / ".env"
        local_env = Path(os.getcwd()) / ".cortex" / ".env"
        if global_env.exists():
            load_dotenv(global_env, override=True)
        if local_env.exists():
            load_dotenv(local_env, override=True)

        _config = CortexConfig.load()
        if _idx_manager:
            _idx_manager.apply_config(_config)
        if _agent:
            _agent.apply_config(_config)
    return _config
