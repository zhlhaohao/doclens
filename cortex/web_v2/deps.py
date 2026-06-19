"""web_v2 共享依赖管理 — IndexManager / CortexAgent 单例。

复制自 cortex/web/deps.py，去除 Gradio 依赖。
"""
import logging
import threading
from pathlib import Path
from typing import Optional

from cortex.config import CortexConfig
from cortex.index_manager import IndexManager

logger = logging.getLogger(__name__)

_config: Optional[CortexConfig] = None
_idx_manager: Optional[IndexManager] = None
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
                from cortex.agent_integration import CortexAgent
                idx = get_index_manager()
                workdir = Path(idx.search_path)
                _agent = CortexAgent(workdir).initialize()
                logger.info("CortexAgent initialized")
    return _agent


def reset_singletons() -> None:
    """重置单例（仅供测试使用）。"""
    global _config, _idx_manager, _agent
    with _lock:
        _config = None
        _idx_manager = None
        _agent = None
