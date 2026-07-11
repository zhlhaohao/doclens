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
from planify.core.session_manager import SessionManager

logger = logging.getLogger(__name__)

_config: Optional[CortexConfig] = None
_idx_manager: Optional[IndexManager] = None
_sessions_store: Optional[SessionsStore] = None
_agent: Optional[object] = None  # CortexAgent，延迟导入避免循环依赖
_watcher: Optional["object"] = None  # FileWatcher，懒加载避免 import 循环
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
    global _config, _idx_manager, _sessions_store, _agent, _watcher
    # 停止可能存在的 watcher，释放 Observer 线程
    stop_watcher()
    with _lock:
        _config = None
        _idx_manager = None
        _sessions_store = None
        _agent = None
        _watcher = None


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
    # 让 SessionManager 缓存的 provider 失效，下次 get_provider() 调用时重建
    SessionManager.invalidate_provider()
    return _config


def get_watcher():
    """获取已注册的 FileWatcher 单例（可能为 None）。"""
    return _watcher


def set_watcher(watcher) -> None:
    """注册/覆盖 watcher 单例（供 lifespan 与测试使用）。"""
    global _watcher
    with _lock:
        _watcher = watcher


def start_watcher() -> bool:
    """根据 config.watch_enabled 创建并启动 FileWatcher。

    Returns:
        True 表示已启动；False 表示因配置关闭或 watchdog 不可用而未启动。
    """
    global _watcher
    config = get_config()
    if not config.watch_enabled:
        logger.info("File watcher disabled by config (watch_enabled=False)")
        return False
    idx = get_index_manager()
    try:
        from doclens.file_watcher import FileWatcher
        watcher = FileWatcher(idx, debounce_seconds=config.watch_debounce)
        if not watcher.start():
            logger.warning("FileWatcher.start() returned False (watchdog unavailable?)")
            return False
        set_watcher(watcher)
        logger.info("FileWatcher started for %s", idx.search_path)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.exception("start_watcher failed: %s", exc)
        return False


def stop_watcher() -> None:
    """停止并注销 watcher 单例（幂等）。"""
    global _watcher
    with _lock:
        watcher = _watcher
        _watcher = None
    if watcher is not None:
        try:
            watcher.stop()
        except Exception as exc:  # noqa: BLE001
            logger.warning("stop_watcher: %s", exc)
