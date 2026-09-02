"""web_v2 共享依赖管理 — IndexManager / CortexAgent 单例。

复制自 cortex/web/deps.py，去除 Gradio 依赖。
"""
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any, Optional

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager
from doclens.web_v2.sessions_store import SessionsStore
from doclens.web_v2.watch_broker import get_watch_broker

logger = logging.getLogger(__name__)

_config: Optional[CortexConfig] = None
_idx_manager: Optional[IndexManager] = None
_sessions_store: Optional[SessionsStore] = None
_agent: Optional[object] = None  # CortexAgent，延迟导入避免循环依赖
_watcher: Optional["object"] = None  # FileWatcher，懒加载避免 import 循环
_vision_worker: Optional["object"] = None  # VisionWorker，懒加载避免 import 循环
_diary_worker: Optional["object"] = None  # DiaryWorker，懒加载避免 import 循环
_git_sync: Optional["object"] = None  # GitSync，懒加载避免 import 循环
_mcp_handle: Optional["object"] = None  # McpServerHandle，懒加载避免 import 循环
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

    sessions.db 与 index.db 同在数据目录（开发 .cortex / 发行版 .doclens），跟随工作目录隔离。
    路径由 config 直接推导（与 IndexManager.index_path 同一公式），**故意不经
    IndexManager**——登录闸门（auth_sessions 表）必须在索引构建完成前就可用。
    """
    global _sessions_store
    if _sessions_store is None:
        with _lock:
            if _sessions_store is None:
                from doclens.config import data_dirname

                config = get_config()
                index_path = config.index_path or os.path.join(
                    config.search_path, data_dirname(), "index.db"
                )
                db_path = Path(index_path).parent / "sessions.db"
                db_path.parent.mkdir(parents=True, exist_ok=True)
                _sessions_store = SessionsStore(db_path)
    return _sessions_store


def reset_singletons() -> None:
    """重置单例（仅供测试使用）。"""
    global _config, _idx_manager, _sessions_store, _agent, _watcher, _mcp_handle, _vision_worker, _diary_worker, _git_sync
    # 停止可能存在的 watcher / worker / 同步循环 / MCP server，释放后台线程
    stop_watcher()
    stop_vision_worker()
    stop_diary_worker()
    stop_git_sync()
    stop_mcp_server()
    with _lock:
        _config = None
        _idx_manager = None
        _sessions_store = None
        _agent = None
        _watcher = None
        _mcp_handle = None
        _vision_worker = None
        _diary_worker = None
        _git_sync = None


def reload_config() -> CortexConfig:
    """重建 CortexConfig 并推送到已存在的单例。

    先用 load_dotenv(override=True) 刷新 os.environ，确保 pydantic-settings
    读到的环境变量与最新 .env 一致（而非 CortexAgent.initialize() 早期
    load_dotenv 写入的过期值）。
    """
    global _config
    with _lock:
        from dotenv import load_dotenv
        from doclens.config import data_dirname, get_global_cortex_dir

        global_env = get_global_cortex_dir() / ".env"
        local_env = Path(os.getcwd()) / data_dirname() / ".env"
        if global_env.exists():
            load_dotenv(global_env, override=True)
        if local_env.exists():
            load_dotenv(local_env, override=True)

        _config = CortexConfig.load()
        if _idx_manager:
            _idx_manager.apply_config(_config)
        if _agent:
            _agent.apply_config(_config)
    # planify 侧的 provider 热更新由 CortexAgent.apply_config →
    # Session.update_llm_config 完成；SessionManager 装配线仅服务 planify
    # 自带 legacy REPL（main.py），与 doclens 的会话无关。
    return _config


def get_watcher():
    """获取已注册的 FileWatcher 单例（可能为 None）。"""
    return _watcher


def set_watcher(watcher) -> None:
    """注册/覆盖 watcher 单例（供 lifespan 与测试使用）。"""
    global _watcher
    with _lock:
        _watcher = watcher


def watch_snapshot() -> dict[str, Any]:
    """当前 watch 状态快照（SSE 首推 / GET /api/watch/status / 回调广播共用）。

    结构与 GET /api/watch/status 返回一致：{enabled, watcher, recent_changes, sync}。
    sync 为 GitSync 快照（未注册时为 None），随 status 事件同通道下发。
    """
    w = get_watcher()
    return {
        "enabled": get_config().watch_enabled,
        "watcher": w.status() if w is not None else None,
        "recent_changes": get_watch_broker().recent_changes(),
        "sync": sync_snapshot(),
    }


def start_watcher() -> bool:
    """根据 config.watch_enabled 创建并启动 FileWatcher，并接线上报回调。

    三个回调把 watch 状态变化经 WatchBroker fan-out 给所有 SSE 客户端：
    - on_change: 记录近期变化 + 广播 status 快照（changed_count 已更新）。
    - on_reindex_start: 广播 status（reindexing=true）。
    - on_reindex_done: 广播 status（终态）+ reindexed（触发前端 toast）。

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
        broker = get_watch_broker()
        search_path = idx.search_path

        def _on_change(file_path: str) -> None:
            try:
                rel = os.path.relpath(file_path, search_path)
            except ValueError:
                # Windows 跨盘符 relpath 会抛 ValueError：退回原路径
                rel = file_path
            broker.record_change(rel, os.path.basename(rel), time.time())
            broker.broadcast("status", watch_snapshot())

        def _on_reindex_start() -> None:
            broker.broadcast("status", watch_snapshot())

        def _on_reindex_done(success: bool, doc_count: int, failed_count: int, indexed_files: int = 0) -> None:
            broker.broadcast("status", watch_snapshot())
            # 只在本次实际有变化（新索引文件或失败）时广播 reindexed，
            # 避免启动增量扫描无变化时每次都弹 toast 打扰用户。
            if indexed_files > 0 or failed_count > 0:
                broker.broadcast("reindexed", {
                    "success": success,
                    "doc_count": doc_count,
                    "failed_count": failed_count,
                })

        watcher = FileWatcher(
            idx,
            debounce_seconds=config.watch_debounce,
            on_change_callback=_on_change,
            on_reindex_start=_on_reindex_start,
            on_reindex_done=_on_reindex_done,
        )
        # 先注册单例，保证回调触发时 get_watcher()（watch_snapshot 内）可见
        set_watcher(watcher)
        if not watcher.start():
            set_watcher(None)
            logger.warning("FileWatcher.start() returned False (watchdog unavailable?)")
            return False
        logger.info("FileWatcher started for %s", search_path)
        # 广播一次初值，让已连接的 SSE 客户端立刻拿到当前态
        broker.broadcast("status", watch_snapshot())
        return True
    except Exception as exc:  # noqa: BLE001
        set_watcher(None)
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


def get_vision_worker():
    """获取已注册的 VisionWorker 单例（可能为 None）。"""
    return _vision_worker


def start_vision_worker() -> bool:
    """创建并启动 VisionWorker（视觉解析队列的常驻消费者，ADR-0001）。

    无论是否已配置 VISION_API_KEY 都启动：worker 内部在未配置时空转，
    设置页补上 key 后下一轮循环自动开始消费（配置热生效）。
    """
    global _vision_worker
    idx = get_index_manager()
    try:
        from doclens.vision_worker import VisionWorker

        worker = VisionWorker(idx, get_config)
        worker.start()
        with _lock:
            _vision_worker = worker
        logger.info("VisionWorker started for %s", idx.search_path)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.exception("start_vision_worker failed: %s", exc)
        return False


def stop_vision_worker() -> None:
    """停止并注销 VisionWorker 单例（幂等）。"""
    global _vision_worker
    with _lock:
        worker = _vision_worker
        _vision_worker = None
    if worker is not None:
        try:
            worker.stop()
        except Exception as exc:  # noqa: BLE001
            logger.warning("stop_vision_worker: %s", exc)


def get_diary_worker():
    """获取已注册的 DiaryWorker 单例（可能为 None）。"""
    return _diary_worker


def start_diary_worker() -> bool:
    """创建并启动 DiaryWorker（日记片段态小节的常驻总结者，ADR-0007）。

    无论是否已配置 PLANIFY_API_KEY 都启动：worker 内部在未配置时空转，
    设置页补上 key 后下一轮循环自动开始总结（配置热生效）。
    """
    global _diary_worker
    idx = get_index_manager()
    try:
        from doclens.diary_worker import DiaryWorker

        worker = DiaryWorker(idx, get_config)
        worker.start()
        with _lock:
            _diary_worker = worker
        logger.info("DiaryWorker started for %s", idx.search_path)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.exception("start_diary_worker failed: %s", exc)
        return False


def stop_diary_worker() -> None:
    """停止并注销 DiaryWorker 单例（幂等）。"""
    global _diary_worker
    with _lock:
        worker = _diary_worker
        _diary_worker = None
    if worker is not None:
        try:
            worker.stop()
        except Exception as exc:  # noqa: BLE001
            logger.warning("stop_diary_worker: %s", exc)


def get_git_sync():
    """获取已注册的 GitSync 单例（可能为 None）。"""
    return _git_sync


def sync_snapshot() -> Optional[dict]:
    """Git 同步状态快照；同步循环未注册（非 git 根/无 remote/配置关闭）时为 None。"""
    gs = get_git_sync()
    return gs.status() if gs is not None else None


def start_git_sync() -> bool:
    """根据 config.sync_enabled 创建并启动 GitSync 同步循环（仅 GUI 调用）。

    每轮结束（成功/失败/跳过）经 on_cycle_done 回调把 sync 快照
    经 WatchBroker 广播给所有 SSE 客户端（复用 status 事件通道）。

    Returns:
        True 表示已启动；False 表示配置关闭、非 git 根或无 remote（整体停摆）。
    """
    global _git_sync
    config = get_config()
    if not config.sync_enabled:
        logger.info("Git sync disabled by config (sync_enabled=False)")
        return False
    try:
        from doclens.config import data_dirname
        from doclens.git_sync import GitSync

        broker = get_watch_broker()

        def _on_cycle_done(_status: dict) -> None:
            # sync 快照已并入 watch_snapshot()，广播 status 即可让前端拿到最新态
            broker.broadcast("status", watch_snapshot())

        gs = GitSync(
            config.search_path,
            interval_seconds=config.sync_interval_minutes * 60.0,
            data_dir=data_dirname(),
            on_cycle_done=_on_cycle_done,
        )
        started = gs.start()
        # 无论是否启动都注册单例：未启动时 status() 带 reason（not_git_root/no_remote），
        # 供 /api/status 向前端说明同步为何停摆
        with _lock:
            _git_sync = gs
        if not started:
            logger.info("GitSync 整体停摆: %s", gs.status()["reason"])
            return False
        logger.info("GitSync started for %s", config.search_path)
        # 广播一次初值，让已连接的 SSE 客户端立刻拿到当前态
        broker.broadcast("status", watch_snapshot())
        return True
    except Exception as exc:  # noqa: BLE001
        logger.exception("start_git_sync failed: %s", exc)
        return False


def stop_git_sync() -> None:
    """停止并注销 GitSync 单例（幂等）。"""
    global _git_sync
    with _lock:
        gs = _git_sync
        _git_sync = None
    if gs is not None:
        try:
            gs.stop()
        except Exception as exc:  # noqa: BLE001
            logger.warning("stop_git_sync: %s", exc)


async def start_mcp_server() -> bool:
    """根据 config.mcp_enabled 在后台启动 MCP HTTP server。

    复用 IndexManager 单例（与 web API、watcher 共享同一份索引）。同步的
    start_mcp_server（内部有就绪轮询）丢进 to_thread 执行，避免阻塞事件循环。
    成功则把 URL 打印到 stdout；失败仅记日志。返回是否已启动。
    """
    import asyncio

    from doclens.mcp_server import mcp_startup_message, start_mcp_server as _start

    config = get_config()
    if not config.mcp_enabled:
        logger.info("MCP server disabled by config (mcp_enabled=False)")
        return False

    idx = get_index_manager()
    handle = await asyncio.to_thread(_start, idx, Path(idx.search_path), config)
    if handle is None:
        logger.warning("MCP server 未启动（端口占用或鉴权配置问题）")
        return False

    global _mcp_handle
    with _lock:
        _mcp_handle = handle
    # 显著打印 URL（uvicorn 的 MCP 实例 log_level=warning，自身不打访问日志）。
    # flush=True 保证输出重定向（非 tty）时也即时可见。
    print(mcp_startup_message(handle, config), flush=True)
    return True


def stop_mcp_server() -> None:
    """停止并注销 MCP server 单例（幂等）。"""
    global _mcp_handle
    with _lock:
        handle = _mcp_handle
        _mcp_handle = None
    if handle is not None:
        try:
            handle.stop()
        except Exception as exc:  # noqa: BLE001
            logger.warning("stop_mcp_server: %s", exc)
