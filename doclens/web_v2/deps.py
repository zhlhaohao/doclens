"""web_v2 共享依赖管理 — IndexManager / CortexAgent 单例。

复制自 cortex/web/deps.py，去除 Gradio 依赖。
"""
import contextlib
import logging
from dataclasses import dataclass
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
_rewind_tracker: Optional["object"] = None  # RewindTracker（ADR-0027），懒加载
# 延迟导入说明（AP-28 审计结论，2026-10-20）：这些注释声称的 "import 循环"
# 在当前代码下不存在——file_watcher/vision_worker/diary_worker/git_sync/
# mcp_server/agent_integration 均无 web_v2 模块级依赖（grep 验证）。保留
# 函数体内延迟的真实理由是启动开销与装配顺序（agent_integration 的
# import 顺序有注册依赖，见其内部注释）。若未来确需上提，先重验环判定。
_agent: Optional[object] = None  # CortexAgent，延迟导入（启动开销，非防环——见上注）
_watcher: Optional["object"] = None  # FileWatcher，懒加载（同上）
_vision_worker: Optional["object"] = None  # VisionWorker，懒加载（同上）
_diary_worker: Optional["object"] = None  # DiaryWorker，懒加载（同上）
_git_sync: Optional["object"] = None  # GitSync，懒加载（同上）
_mcp_handle: Optional["object"] = None  # McpServerHandle，懒加载（同上）
_mcp_client: Optional["object"] = None  # McpClientManager（client 侧，ADR-0014）

# 注册表锁：**只**保护引用的检查/赋值（毫秒级）。禁止在持锁期间做长耗时
# 构造——曾经 get_index_manager 在锁内等完整建库/全库审计（分钟级），
# 同一把锁让登录闸门（get_sessions_store）与配置读取一起排队（AP-6）。
_lock = threading.RLock()
# 单例构造锁：每个重量级单例各自一把，构造期只互斥同类构造。
# 冷启动建库不再阻塞鉴权/会话/配置路径。
_idx_lock = threading.Lock()       # IndexManager 构造（含分钟级建库 + 全库审计）
_agent_lock = threading.Lock()     # CortexAgent 构造（技能部署 / MCP 装配）
_sessions_lock = threading.Lock()  # SessionsStore 构造（含建库建表）
_rewind_lock = threading.Lock()    # RewindTracker 构造（依赖 sessions_store）


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

    构造期持 `_idx_lock`（不持注册表 `_lock`）——建库/审计可能分钟级，
    期间会话库、配置、登录闸门不受影响（AP-6）。
    """
    global _idx_manager
    if _idx_manager is not None:
        return _idx_manager
    with _idx_lock:
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
            logger.info("IndexManager initialized: %d documents (DB count)",
                        mgr.indexed_doc_count())
    return _idx_manager


def get_agent():
    """获取 CortexAgent 单例（懒加载 + 线程安全）。

    构造（技能部署 / MCP 装配）持 `_agent_lock`，不占注册表锁。内部会先取
    IndexManager（`_idx_lock`）——获取顺序 agent → idx，与 `_singleton_guards()`
    的固定顺序一致，无环。
    """
    global _agent
    if _agent is not None:
        return _agent
    with _agent_lock:
        if _agent is None:
            from doclens.agent_integration import CortexAgent
            idx = get_index_manager()
            workdir = Path(idx.search_path)
            _agent = CortexAgent(workdir, idx_manager=idx).initialize()
            logger.info("CortexAgent initialized")
    return _agent


def get_agent_if_ready():
    """已装配则返回 CortexAgent 单例，否则 None（不触发初始化）。

    供技能管理等「agent 未启动时跳过热生效、下次启动自然生效」的场景。
    """
    return _agent


def get_sessions_store() -> SessionsStore:
    """获取 SessionsStore 单例（懒加载 + 线程安全）。

    sessions.db 与 index.db 同在数据目录（开发 .cortex / 发行版 .doclens），跟随工作目录隔离。
    路径由 config 直接推导（与 IndexManager.index_path 同一公式），**故意不经
    IndexManager**——登录闸门（auth_sessions 表）必须在索引构建完成前就可用。
    构造持独立的 `_sessions_lock`，不占注册表锁，也不等 `_idx_lock`（AP-6）。
    """
    global _sessions_store
    if _sessions_store is not None:
        return _sessions_store
    with _sessions_lock:
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


def get_rewind_tracker():
    """获取 RewindTracker 单例（懒加载 + 线程安全，ADR-0027）。

    备份目录与 sessions.db 同数据目录（开发 .cortex / 发行版 .doclens）：
    ``{数据目录}/rewind/{session_id}/``——天然被索引器排除、被 GitSync
    自动 gitignore。仅 GUI/web 链路装配使用（TUI/CLI 不接线，不产生孤儿备份）。

    构造持 `_rewind_lock`，内部取 `get_sessions_store()`（`_sessions_lock`）——
    顺序 rewind → sessions，与 `_singleton_guards()` 一致。
    """
    global _rewind_tracker
    if _rewind_tracker is not None:
        return _rewind_tracker
    with _rewind_lock:
        if _rewind_tracker is None:
            from doclens.web_v2.rewind_tracker import RewindTracker

            store = get_sessions_store()
            # 与 get_sessions_store 同一公式取数据目录
            from doclens.config import data_dirname

            config = get_config()
            index_path = config.index_path or os.path.join(
                config.search_path, data_dirname(), "index.db"
            )
            base_dir = Path(index_path).parent / "rewind"
            base_dir.mkdir(parents=True, exist_ok=True)
            _rewind_tracker = RewindTracker(store, base_dir)
    return _rewind_tracker


@contextlib.contextmanager
def _singleton_guards():
    """按固定顺序持有全部单例构造锁（供 reset / 工作目录切换）。

    顺序依据单例构造时的嵌套依赖，取"外层先、内层后"以杜绝环形等待：
        agent → idx   （get_agent 内部取 IndexManager）
        rewind → sessions（get_rewind_tracker 内部取 SessionsStore）
    代价：reset/切换会等同构建完成——它们本就要求"没有构造在进行中"，
    与拆锁前的语义一致（AP-6 只解开了**请求路径**的耦合）。
    """
    for lk in (_agent_lock, _idx_lock, _rewind_lock, _sessions_lock):
        lk.acquire()
    try:
        yield
    finally:
        for lk in (_sessions_lock, _rewind_lock, _idx_lock, _agent_lock):
            lk.release()


def _reset_translate_service() -> None:
    """丢弃翻译服务单例（AP-17：它构造时冻结 workdir，切换目录必须重建）。

    延迟 import：translate_service 在 get_translation_service 里反向取
    deps.get_config，模块级 import 会成环。失败只告警——切换主流程不该
    因翻译服务停不掉而失败。
    """
    try:
        from doclens.translate_service import reset_translation_service

        reset_translation_service()
    except Exception as exc:  # noqa: BLE001
        logger.warning("translate service reset failed: %s", exc)


def reset_singletons() -> None:
    """重置单例（仅供测试使用 / 工作目录切换复用）。

    ⚠️ global 列表必须与下方赋值行**逐名对齐**——AP-23 教训：曾漏
    `_mcp_client`，`:220` 的赋值静默落为局部变量，正确性全靠
    `stop_mcp_client()` 内部的重置兜底（顺序巧合而非结构保证）。
    新增单例时同步改三处：模块级变量、本 global 列表、赋值行。
    """
    global _config, _idx_manager, _sessions_store, _rewind_tracker, _agent, _watcher, _mcp_handle, _mcp_client, _vision_worker, _diary_worker, _git_sync
    # 停止可能存在的 watcher / worker / 同步循环 / MCP server，释放后台线程
    stop_watcher()
    stop_vision_worker()
    stop_diary_worker()
    stop_git_sync()
    stop_mcp_server()
    stop_mcp_client()
    _reset_translate_service()
    # 持全部构造锁再置 None：防"构造进行中 → 置空 → 构造者随后发布旧实例"
    with _singleton_guards(), _lock:
        _config = None
        _idx_manager = None
        _sessions_store = None
        _rewind_tracker = None
        _agent = None
        _watcher = None
        _mcp_handle = None
        _mcp_client = None
        _vision_worker = None
        _diary_worker = None
        _git_sync = None


# ---------------------------------------------------------------------------
# 工作目录热切换（ADR-0043）
# ---------------------------------------------------------------------------

_swap_lock = threading.Lock()


@dataclass(frozen=True)
class _SwapState:
    """切换状态（AP-24：不可变值，整体替换——单引用赋值原子，读方要么
    全旧值要么全新值，`swapping=True 而 target=None` 的中间态结构上不可能）。"""
    swapping: bool = False
    target: Optional[str] = None


_swap_state = _SwapState()


def swap_status() -> dict:
    """当前切换状态快照（供 /api/status 与 503 响应体；无锁读，见 _SwapState）。"""
    return {"swapping": _swap_state.swapping, "target": _swap_state.target}


def is_swapping() -> bool:
    return _swap_state.swapping


def swap_workdir(target: str) -> dict:
    """工作目录热切换（ADR-0043）：先建后换 + 全局切换锁。

    流程：切前校验 → 停全部后台组件 → 丢单例 → chdir → 按新目录重建
    （索引经 load_or_build_index 审计）→ 重启组件。任一步失败抛异常，
    由 API 层映射为 4xx/5xx；重建失败时尽力回滚旧目录单例。

    Args:
        target: 目标工作目录（未规范化，函数内规范化）。

    Returns:
        {"workdir": <新目录>, "doc_count": <索引文档数>}

    Raises:
        ValueError: 目录不存在/不可读（切前校验，不进入窗口）。
        RuntimeError: 已有切换进行中（409）或重建/回滚失败。
    """
    from doclens.web_v2.workdir_store import normalize_workdir, same_workdir

    global _config, _idx_manager, _sessions_store, _rewind_tracker, _agent, _swap_state

    target = normalize_workdir(target)
    # 切前廉价校验（不进入切换窗口）：存在 + 可读（ADR-0043「存在/可读」）
    if not os.path.isdir(target):
        raise ValueError(f"目录不存在: {target}")
    if not os.access(target, os.R_OK):
        raise ValueError(f"目录不可读: {target}")

    # 切换锁互斥（409 语义由 API 层映射）
    if not _swap_lock.acquire(blocking=False):
        raise RuntimeError("切换进行中，请稍候")
    _swap_state = _SwapState(swapping=True, target=target)

    old_cwd = os.getcwd()
    old_workdir = _idx_manager.search_path if _idx_manager is not None else old_cwd
    swapped = False
    try:
        if same_workdir(target, old_workdir):
            return {"workdir": old_workdir, "doc_count": (
                _idx_manager.indexed_doc_count() if _idx_manager is not None else 0
            ), "changed": False}

        logger.info("workdir swap: %s -> %s", old_workdir, target)
        try:
            # 停全部后台组件（幂等）；在途生成/孤儿任务由强引用保活跑完
            stop_mcp_client()
            stop_mcp_server()
            stop_git_sync()
            stop_diary_worker()
            stop_vision_worker()
            stop_watcher()
            # AP-17：翻译单例冻结了 workdir，不重置则切换后仍读写旧目录
            _reset_translate_service()
            # 持全部构造锁置空（防构造进行中发布旧实例），与注册表锁分开获取
            with _singleton_guards(), _lock:
                _config = None
                _idx_manager = None
                _sessions_store = None
                _rewind_tracker = None
                _agent = None

            os.chdir(target)
            swapped = True
            # 按新目录重建全套单例。
            # 首次建库（index.db 不存在）与已有库分途（2026-10-14 热切换边界修复）：
            # 首次全量索引可能分钟级，同步等待会让 POST 挂到 HTTP 超时、前端
            # 误报「切换失败」——故首次建库只建空单例就放行，索引交后台线程
            # （trigger_background_reindex，与 watcher 同模式），前端 reload 后
            # 走常规「索引中」状态展示；已有库走 load_or_build_index 快路径
            # （无变化秒回，增量审计有变化才耗时——启动期同款干等先例）。
            from doclens.config import data_dirname as _data_dirname
            _cfg = get_config()
            _index_path = _cfg.index_path or os.path.join(
                _cfg.search_path, _data_dirname(), "index.db"
            )
            _first_build = not os.path.exists(_index_path)

            if _first_build:
                from doclens.index_manager import IndexManager
                # 发布空实例：与 get_index_manager 的构造路径共用 _idx_lock，
                # 避免两边同时装配出两个 IndexManager
                with _idx_lock:
                    mgr = IndexManager(_cfg)
                    _idx_manager = mgr
                doc_count = 0

                def _first_build_work() -> None:
                    if not mgr.begin_background_build():
                        return  # 已有构建在进行（理论不可达，防御）
                    try:
                        mgr.load_or_build_index()  # index.db 不存在 → 全量构建
                        dc = mgr.indexed_doc_count()
                        try:
                            from doclens.web_v2.watch_broker import get_watch_broker
                            # 首次构建完成是状态机边沿，immediate
                            get_watch_broker().broadcast("status", watch_snapshot(), immediate=True)
                            get_watch_broker().broadcast("reindexed", {
                                "success": True, "doc_count": dc,
                                "failed_count": mgr.last_failed_count,
                            }, immediate=True)
                        except Exception as e:  # noqa: BLE001
                            logger.debug("first-build broadcast failed: %s", e)
                    except Exception as e:  # noqa: BLE001
                        logger.exception("first-time index build failed for %s: %s", target, e)
                        try:
                            from doclens.web_v2.watch_broker import get_watch_broker
                            # 首建失败同样是终态，必须 immediate
                            get_watch_broker().broadcast("reindexed", {
                                "success": False, "doc_count": 0, "failed_count": 0,
                            }, immediate=True)
                        except Exception:  # noqa: BLE001
                            pass
                    finally:
                        mgr.finish_background_build()

                threading.Thread(target=_first_build_work, daemon=True).start()
                logger.info("workdir swap: first-time index build started in background for %s", target)
            else:
                get_index_manager()  # 索引审计失败（如损坏）在此抛错
                doc_count = get_index_manager().indexed_doc_count()
            get_sessions_store()
            get_agent()
            # 重启后台组件（按新 config 的开关自行决定是否启动）
            start_watcher()
            start_vision_worker()
            start_diary_worker()
            start_git_sync()
            start_mcp_client()

            from doclens.web_v2.workdir_store import record_workdir
            record_workdir(target)
            logger.info("workdir swap done: %s (%d docs)", target, doc_count)
            # SSE 广播切换完成（ADR-0043 切换即重载）：前端收到后整页 reload。
            # 复用 watch status 通道（swap 状态已并入 /api/status，此处广播
            # 专用 workdir_swapped 事件——status 快照此时仍带 swapping=True，
            # 前端不能靠它判定终态）。
            try:
                from doclens.web_v2.watch_broker import get_watch_broker
                get_watch_broker().broadcast("workdir_swapped", {
                    "workdir": target, "doc_count": doc_count,
                })
            except Exception as e:  # noqa: BLE001
                logger.debug("broadcast workdir_swapped failed: %s", e)
            return {"workdir": target, "doc_count": doc_count, "changed": True}
        except Exception as exc:
            logger.exception("workdir swap failed, rolling back to %s: %s", old_workdir, exc)
            # 回滚：重建旧目录单例（尽力而为——回滚也失败则系统留在切换态，
            # 前端遮罩提示用户重启）
            try:
                if swapped and os.path.normcase(os.getcwd()) != os.path.normcase(old_cwd):
                    os.chdir(old_cwd)
                reset_singletons()
                get_index_manager()
                get_sessions_store()
                get_agent()
                start_watcher()
                start_vision_worker()
                start_diary_worker()
                start_git_sync()
                start_mcp_client()
                logger.info("workdir swap rollback ok: %s", old_workdir)
                try:
                    from doclens.web_v2.watch_broker import get_watch_broker
                    get_watch_broker().broadcast("workdir_swap_failed", {
                        "workdir": old_workdir, "error": str(exc),
                    })
                except Exception as e:  # noqa: BLE001
                    logger.debug("broadcast workdir_swap_failed failed: %s", e)
            except Exception as rb_exc:  # noqa: BLE001
                logger.exception("workdir swap rollback failed: %s", rb_exc)
                raise RuntimeError(
                    f"切换到 {target} 失败且回滚到 {old_workdir} 也失败，请重启应用: {exc}"
                ) from exc
            raise RuntimeError(f"切换到 {target} 失败（已回滚到原目录）: {exc}") from exc
    finally:
        _swap_state = _SwapState()
        _swap_lock.release()


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
    # AgentRuntime.update_llm_config 完成；RuntimeManager 装配线仅服务 planify
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
            # 状态机边沿（reindexing: False→True）必须 immediate，不能被节流吞掉
            broker.broadcast("status", watch_snapshot(), immediate=True)

        def _on_reindex_done(success: bool, doc_count: int, failed_count: int, indexed_files: int = 0) -> None:
            # 状态机边沿（reindexing: True→False）必须 immediate
            broker.broadcast("status", watch_snapshot(), immediate=True)
            # 只在本次实际有变化（新索引文件或失败）时广播 reindexed，
            # 避免启动增量扫描无变化时每次都弹 toast 打扰用户。
            if indexed_files > 0 or failed_count > 0:
                broker.broadcast("reindexed", {
                    "success": success,
                    "doc_count": doc_count,
                    "failed_count": failed_count,
                }, immediate=True)

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
        # 广播一次初值，让已连接的 SSE 客户端立刻拿到当前态（启动边沿，immediate）
        broker.broadcast("status", watch_snapshot(), immediate=True)
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
            # sync 快照已并入 watch_snapshot()，广播 status 即可让前端拿到最新态。
            # git sync 完成是状态机边沿（sync 进行中→空闲），必须 immediate
            broker.broadcast("status", watch_snapshot(), immediate=True)

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
        # 广播一次初值，让已连接的 SSE 客户端立刻拿到当前态（启动边沿，immediate）
        broker.broadcast("status", watch_snapshot(), immediate=True)
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


def start_mcp_client() -> bool:
    """启动 MCP client 管理器（消费外部 MCP 服务器工具，ADR-0014）。

    拉起专属后台线程 + event loop，拉起 CortexAgent 单例并把工具注入目标
    绑到其 runtime——首个启用的 server 连接成功后 ``runtime.tools`` 原位
    更新（chat 每请求现读，下一轮对话即生效）。配置为空时同样启动（线程
    空转对账，配置出现即自动连接）。仅 GUI 进程调用（lifespan）。
    """
    global _mcp_client
    agent = get_agent()  # 确保 CortexAgent/runtime 已装配
    try:
        from doclens.mcp_client import get_mcp_client_manager

        manager = get_mcp_client_manager()
        manager.start(runtime=agent.runtime)
        with _lock:
            _mcp_client = manager
        logger.info("MCP client manager started")
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("start_mcp_client failed: %s", exc)
        return False


def stop_mcp_client() -> None:
    """停止 MCP client 管理器（收割全部外部会话，幂等）。"""
    global _mcp_client
    with _lock:
        manager = _mcp_client
        _mcp_client = None
    if manager is not None:
        try:
            manager.stop()
        except Exception as exc:  # noqa: BLE001
            logger.warning("stop_mcp_client: %s", exc)
