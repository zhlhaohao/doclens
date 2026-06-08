"""共享依赖管理 — IndexManager 和 CortexAgent 单例"""

import logging
import threading
from pathlib import Path
from typing import Optional

from cortex.config import CortexConfig
from cortex.index_manager import IndexManager

logger = logging.getLogger(__name__)

_idx_manager: Optional[IndexManager] = None
_agent: Optional[object] = None  # CortexAgent，延迟导入避免循环依赖
_lock = threading.RLock()


def get_config() -> CortexConfig:
    """加载 CortexConfig"""
    return CortexConfig.load()


def get_index_manager() -> IndexManager:
    """获取 IndexManager 单例（懒加载 + 线程安全）"""
    global _idx_manager
    if _idx_manager is None:
        with _lock:
            if _idx_manager is None:
                config = get_config()
                _idx_manager = IndexManager(config)
                _idx_manager.load_or_build_index()
                logger.info("IndexManager initialized: %d documents", len(_idx_manager.documents))
    return _idx_manager


def get_agent():
    """获取 CortexAgent 单例（懒加载 + 线程安全）"""
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
