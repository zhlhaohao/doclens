"""索引管理模块 - 封装 TreeSearch 生命周期"""

import logging
import os
import threading
import time

logger = logging.getLogger(__name__)

# 首次建库后台化的构建者身份（ADR-0043）：begin_background_build 的调用线程
# 记为 owner，load_or_build_index 的等待循环对 owner 豁免（防自我死锁）。
_build_tls = threading.local()
_build_tls.owner = None

from treesearch import TreeSearch, set_config, TreeSearchConfig
from treesearch.parsers.registry import SOURCE_TYPE_MAP
from doclens.config import CortexConfig, data_dirname
from doclens import index_probe

# 支持的文件类型：直接从 treesearch parser registry 获取，保持单一数据源
SUPPORTED_FORMATS = {ext: (source_type, None) for ext, source_type in SOURCE_TYPE_MAP.items()}


def check_dependencies():
    """检查依赖是否安装，返回未安装的依赖列表"""
    missing = []
    for ext, (name, dep) in SUPPORTED_FORMATS.items():
        if dep and not _check_module(dep):
            missing.append((name, dep))
    return missing


def _check_module(module_name):
    """检查模块是否已安装"""
    try:
        __import__(module_name)
        return True
    except ImportError:
        return False


class IndexUnavailable(RuntimeError):
    """索引库不可读（DB 损坏 / 被锁 / 权限）——**区别于「空库」**（AP-45）。

    原先这类故障在检索链路上被 `has_indexed_docs()` 吞成 False，表现为
    「库里没有这段内容」：用户与 AI 都会据此得出「未收录」的错误结论。
    """


class IndexManager:
    """TreeSearch 索引管理器"""

    def __init__(self, config: CortexConfig):
        self._config = config
        self.search_path = config.search_path
        self.index_path = config.index_path or os.path.join(self.search_path, data_dirname(), "index.db")
        self._ts = None
        self._path_map = {}
        self._needs_reload = False  # 需重建 TreeSearch 句柄（reindex 完成 / 外部直写 DB），不代表磁盘需审计
        self._reindexing = False
        self._reindex_lock = threading.Lock()
        # 最近一次索引（启动同步或后台 reindex）失败的文件数；0 = 全部成功。
        # 供 /api/status 暴露给前端——启动同步索引不走 reindexed 广播，
        # 前端只能靠此字段看到失败数。
        self._last_failed_count = 0
        # 本进程是否已跑过启动审计（load_or_build_index）——watcher 启动扫描
        # 据此跳过重复一轮（双轮审计 bug，2026-09-11）
        self._startup_audit_done = False
        # /api/status 的 (总字节, 扩展名分布) 缓存：(doc_count, value)
        self._file_stats_cache: tuple[int, tuple[int, dict[str, int]]] | None = None
        # 首次建库后台化（ADR-0043 热切换）：后台线程正在跑 load_or_build_index
        # 时为 True——此时其他线程的 load_or_build_index/search 必须等待而非
        # 重复构建（撞库）。配 _build_cond 等待/唤醒。
        self._building = False
        self._build_cond = threading.Condition()

    @property
    def last_failed_count(self) -> int:
        """最近一次索引失败的文件数（0 = 全部成功）。"""
        return self._last_failed_count

    def apply_config(self, config: CortexConfig) -> None:
        """Hot-reload config values. Does NOT touch index or search_path."""
        self._config = config

    def mark_index_dirty(self) -> None:
        """标记内存中的 documents 已过时，下次 load/search 时从磁盘重新加载。

        供 VisionWorker 等外部写入者在直接更新 FTS 后调用。
        """
        self._needs_reload = True

    def begin_background_build(self) -> bool:
        """声明本线程将独占执行首次建库（load_or_build_index 全量分支）。

        返回 False 表示已有构建在进行（调用方应改走等待路径，不重复构建）。
        与 finish_background_build 配对；期间其他线程的 load_or_build_index
        在 _build_cond 上等待，本线程（owner）豁免（ADR-0043 热切换首次建库后台化）。
        """
        with self._build_cond:
            if self._building:
                return False
            self._building = True
            _build_tls.owner = threading.current_thread()
            return True

    def finish_background_build(self) -> None:
        """结束独占构建并唤醒等待者（与 begin_background_build 配对）。"""
        with self._build_cond:
            self._building = False
            _build_tls.owner = None
            self._build_cond.notify_all()

    @property
    def building(self) -> bool:
        """首次建库是否正在后台进行（供 /api/status 展示「索引中」）。"""
        return self._building

    @property
    def startup_audit_done(self) -> bool:
        """本进程是否已完成启动审计（load_or_build_index 跑过至少一次）。

        FileWatcher 的启动增量扫描用它判断是否可以跳过：启动审计
        （has_changed_files）本身就会补离线变化，刚审计完就再扫一遍是
        纯重复（百万语料多耗一轮分钟级审计，双轮审计 bug 根因）。
        """
        return self._startup_audit_done

    # --- Config-backed properties (hot-reloadable) ---
    # 消费矩阵见 AP-9 修复记录：仅保留有外部消费方的转发；_ts_config 专用
    # 的 7 个（无外部消费）已删，改为方法内直读 self._config.<name>。
    # grep_score_threshold / grep_max_results 经 ripgrep.py 的 getattr(idx, ...)
    # 动态消费（模块属性扫描不显式），必须保留。

    @property
    def max_results(self) -> int:
        return self._config.max_results

    @property
    def max_nodes_per_doc(self) -> int:
        return self._config.max_nodes_per_doc

    @property
    def top_k_docs(self) -> int:
        """搜索候选池大小（路由阶段选多少个文档）。

        这是 `search()` 唯一真实的量级旋钮（AP-47）：命中该池之外的文档
        不可见，任何 `total` 口径都以它为界。
        """
        return self._config.top_k_docs

    @property
    def max_span(self) -> int:
        return self._config.max_span

    @property
    def min_keywords_per_line(self) -> int:
        return self._config.min_keywords_per_line

    @property
    def min_score_threshold(self) -> float:
        return self._config.min_score_threshold

    @property
    def title_width(self) -> int:
        return self._config.title_width

    @property
    def line_width(self) -> int:
        return self._config.line_width

    @property
    def max_context_lines(self) -> int:
        return self._config.max_context_lines

    @property
    def max_anchor_lines(self) -> int:
        return self._config.max_anchor_lines

    @property
    def context_expand_range(self) -> int:
        return self._config.context_expand_range

    @property
    def max_context_chars_per_result(self) -> int:
        return self._config.max_context_chars_per_result

    @property
    def search_context_before(self) -> int:
        return self._config.search_context_before

    @property
    def search_context_after(self) -> int:
        return self._config.search_context_after

    @property
    def grep_match_max_chars(self) -> int:
        return self._config.grep_match_max_chars

    @property
    def max_total_chars(self) -> int:
        return self._config.max_total_chars

    @property
    def max_read_words(self) -> int:
        return self._config.max_read_words

    @property
    def read_doc_show_toc(self) -> bool:
        return self._config.read_doc_show_toc

    @property
    def grep_score_threshold(self) -> float:
        return self._config.grep_score_threshold

    @property
    def grep_max_results(self) -> int:
        return self._config.grep_max_results

    @property
    def rg_context_before(self) -> int:
        return self._config.rg_context_before

    @property
    def rg_context_after(self) -> int:
        return self._config.rg_context_after

    @property
    def max_dir_files(self) -> int:
        """单目录遍历文件数上限（0 = 不设限；防误扫巨型目录）。"""
        return self._config.treesearch_max_dir_files

    @property
    def index_chunk_size(self) -> int:
        """分块索引块大小（文件数；0 = 不分块，旧行为。ADR-0018）。"""
        return self._config.treesearch_index_chunk_size

    def _ts_config(self):
        """构造 treesearch 配置（集中一处，避免 4 处 set_config 漂移）。

        搜索参数（max_nodes_per_doc/top_k_docs）也在此注入——宿主值成为
        引擎侧唯一真相，调用点不再逐次直传（消除同名参数双通道：
        2026-10-19 前这三者经 search() 调用参数传入，与 _ts_config 白名单
        并存，读者无法判断哪边生效）。
        """
        c = self._config
        return TreeSearchConfig(
            cjk_tokenizer=c.cjk_tokenizer,
            max_index_fail_count=c.max_index_fail_count,
            enable_shadow_md=c.treesearch_enable_shadow_md,
            xlsx_max_rows_per_sheet=c.treesearch_xlsx_max_rows_per_sheet,
            xlsx_max_consecutive_empty_rows=c.treesearch_xlsx_max_consecutive_empty_rows,
            allowed_source_types=c.allowed_source_types,
            max_dir_files=c.treesearch_max_dir_files,
            index_chunk_size=c.treesearch_index_chunk_size,
            max_nodes_per_doc=c.max_nodes_per_doc,
            top_k_docs=c.top_k_docs,
        )

    def indexed_doc_count(self) -> int:
        """索引文档总数（DB COUNT，转发 index_probe——AP-9 拆出）。"""
        return index_probe.indexed_doc_count(self.index_path)

    def file_stats(self) -> tuple[int, dict[str, int]]:
        """(总字节数, 扩展名分布)——供 /api/status，实例级缓存。

        50 万语料全量 stat 要 90s+；缓存键 = DB 文档计数（COUNT，毫秒级），
        计数变化（索引增删）才重算。同数替换（改内容不改文件数）下显示值
        可能略滞后，status 展示可接受。统计本体在 index_probe（AP-9）。
        """
        n = self.indexed_doc_count()
        if self._file_stats_cache and self._file_stats_cache[0] == n:
            return self._file_stats_cache[1]
        (total, ext_counts), _ = index_probe.file_stats(self.index_path)
        self._file_stats_cache = (n, (total, ext_counts))
        return total, ext_counts

    def indexed_source_paths(self) -> list[str]:
        """已索引文档的 source_path 列表（转发 index_probe，成本口径见该模块）。"""
        return index_probe.indexed_source_paths(self.index_path)

    def indexed_paths_under(self, dir_abs_path: str) -> set[str]:
        """某目录（含子目录）下已索引文档的绝对路径集合（转发 index_probe）。"""
        return index_probe.indexed_paths_under(self.index_path, dir_abs_path)

    def is_path_indexed(self, abs_path: str, is_dir: bool = False) -> bool:
        """单个路径是否已索引（转发 index_probe；目录页批量请用 indexed_children_of）。"""
        return index_probe.is_path_indexed(self.index_path, abs_path, is_dir)

    def indexed_children_of(self, dir_abs_path: str) -> set[str]:
        """目录直接子项中含已索引文档的子项名集合（转发 index_probe）。"""
        return index_probe.indexed_children_of(self.index_path, dir_abs_path)

    def ghost_children_of(self, dir_abs_path: str) -> set[str]:
        """目录直接子项中「仅登记」ghost 行的子项名集合（转发 index_probe）。"""
        return index_probe.ghost_children_of(self.index_path, dir_abs_path)

    def is_path_registered(self, abs_path: str) -> bool:
        """单个文件路径是否为「仅登记」ghost 行（转发 index_probe）。"""
        return index_probe.is_path_registered(self.index_path, abs_path)

    def registered_doc_count(self) -> int:
        """「仅登记」ghost 行总数（转发 index_probe）。"""
        return index_probe.registered_doc_count(self.index_path)

    @property
    def scoring_weights(self) -> dict:
        c = self._config
        return {
            "keyword_match_ratio": c.weight_keyword_match,
            "file_name_match": c.weight_file_name_match,
            "fts_score": c.weight_fts_score,
            "title_match": c.weight_title_match,
            "proximity_match": c.weight_proximity_match,
        }

    @property
    def ts(self):
        return self._ts

    @property
    def path_map(self):
        return self._path_map

    def resolve_doc_path(self, doc_id: str) -> str:
        """doc_id → 源文件路径。内存 path_map 优先；未命中时查索引库兜底。

        内存 path_map 可能滞后：diary worker 等后台重索引会改变 doc_id（哈希
        后缀），新 doc_id 不在旧 path_map 中。若此时把 doc_id 本身当 path 输出
        给工具/AI，引用就是无意义的字符串（真实案例：日记 doc_id "2025_53285a70"
        被当作路径输出，AI 无法引用真实来源 日记/2025.md）。
        仍解析不到则返回 doc_id 本身（保持旧行为）。

        兜底查询走 index_probe（请求级连接，AP-10）——不再用 get_fts_index
        全局单例：那个入口在 db_path 变化时会 close 当前单例再重建，若此处
        持有旧连接即被凭空关闭（treesearch-core 台账 AP-2 同源问题），且单例
        被谁重建过不可推理。doclens 侧三套连接生命周期由此收敛为两套
        （请求级读 + TreeSearch 写路径）。
        """
        path = self._path_map.get(doc_id)
        if path:
            return path
        try:
            doc = index_probe.load_document_source_path(self.index_path, doc_id)
            if doc is not None:
                return doc
        except Exception as e:  # noqa: BLE001
            logger.warning("resolve_doc_path(%s) failed: %s", doc_id, e)
        return doc_id

    @property
    def documents(self):
        """已废弃：搜索链路已全惰性化（ADR-0019），不再物化全量 documents。

        计数用 indexed_doc_count() / has_indexed_docs()；结果文档树结构用
        load_doc_structures()。故意不留返回空列表的兼容形态——漏改的
        消费方应在此 AttributeError 响亮报错，而非静默拿到空列表误判
        「索引未就绪」。
        """
        raise AttributeError(
            "IndexManager.documents 已删除（ADR-0019 搜索全惰性化）："
            "计数用 indexed_doc_count()/has_indexed_docs()，"
            "结果文档树结构用 load_doc_structures(doc_ids)"
        )

    def has_indexed_docs(self) -> bool:
        """索引库是否有文档（EXISTS 探测，常数时间——ADR-0019 搜索空库守卫）。

        **fail-soft**：DB 故障返回 False。这个语义只适合「目录页/状态页不能
        因瞬时锁 500」的场景；检索链路必须改用 `index_availability()` 区分
        「空库」与「不可读」（AP-45）。
        """
        try:
            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=self.index_path)
            try:
                return fts.has_documents()
            finally:
                fts.close()
        except Exception as e:  # noqa: BLE001
            logger.debug("has_indexed_docs failed: %s", e)
            return False

    def index_availability(self) -> str:
        """索引库可用性（AP-45）：``"ok"`` / ``"empty"`` / ``"unavailable"``。

        与 `has_indexed_docs()` 的区别只在失败分支：这里**不**把 DB 故障
        伪装成「没有文档」，调用方据此能给出「索引库不可用」而非「未收录」。
        """
        try:
            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=self.index_path)
            try:
                return "ok" if fts.has_documents() else "empty"
            finally:
                fts.close()
        except Exception as e:  # noqa: BLE001
            logger.warning("index unavailable (%s): %s", self.index_path, e)
            return "unavailable"

    def load_doc_structures(self, doc_ids: list) -> dict:
        """按 doc_id 批量加载文档树结构（仅结果文档，不物化全量——ADR-0019）。

        Returns:
            {doc_id: structure}，加载失败的 doc_id 不出现在结果里。
        """
        out: dict = {}
        if not doc_ids:
            return out
        try:
            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=self.index_path)
            try:
                for did in doc_ids:
                    doc = fts.load_document(did)
                    if doc is not None:
                        out[did] = doc.structure or []
            finally:
                fts.close()
        except Exception as e:  # noqa: BLE001
            logger.debug("load_doc_structures failed: %s", e)
        return out

    def has_changed_files(self) -> bool:
        """快速检查是否有文件变化，用于启动同步前置判断。

        检测三类变化：已索引文件内容修改、已索引文件被删除、新增文件。
        排除数据目录（开发 .cortex / 发行版 .doclens）内的文件（索引元数据）和之前索引失败的文件。

        流式化（ADR-0020）：键集分页读 index_meta + 生成器目录遍历 + 批量
        PK 探测，全程 O(batch) 内存——百万语料上不再物化四份全量路径集合
        （旧实现 ~1GB 峰值 / 1.35GB 进程驻留）。早退语义与旧实现逐点一致。
        """
        try:
            from treesearch.fts import FTS5Index
            from treesearch.indexer import file_hash_with_salts
            from treesearch.pathutil import iter_resolve_paths

            fts = FTS5Index(db_path=self.index_path)
            try:
                failed_files = fts.get_all_failed_files()  # 小表，驻内存
                cortex_dir = os.path.abspath(os.path.join(self.search_path, data_dirname()))
                supported_exts = set(SUPPORTED_FORMATS.keys())

                # Apply allowed_source_types filter to extension check
                if self._config.allowed_source_types:
                    from treesearch.pathutil import get_allowed_extensions_for_source_types
                    type_exts = get_allowed_extensions_for_source_types(self._config.allowed_source_types)
                    if type_exts is not None:
                        supported_exts = supported_exts & type_exts

                # 1. 已索引文件是否被修改或删除：键集分页流式读，命中即早退
                for abs_fp, stored_hash in fts.iter_index_meta():
                    if abs_fp.startswith(cortex_dir):
                        continue
                    if not os.path.isfile(abs_fp):
                        logger.debug("File deleted: %s", abs_fp)
                        return True
                    if file_hash_with_salts(abs_fp) != stored_hash:
                        logger.debug("File changed: %s", abs_fp)
                        return True

                # 2. 是否有新增文件（supported_exts 中、index_meta/failed 均未收录）：
                # 生成器 walk（与索引链路同一套忽略规则——DEFAULT_IGNORE_DIRS +
                # .gitignore + 扩展名白名单 + 跳过 ._*md 影子文件）攒批 PK 探测，
                # 批内出现未知路径即早退。
                probe_batch: list[str] = []

                def _batch_has_unknown(paths: list[str]) -> bool:
                    known = fts.filter_known_source_paths(paths)
                    return any(
                        p not in known and p not in failed_files
                        for p in paths
                    )

                for fp in iter_resolve_paths(
                    [self.search_path],
                    allowed_extensions=supported_exts,
                    max_files=self.max_dir_files,
                ):
                    probe_batch.append(fp)
                    if len(probe_batch) >= 500:
                        if _batch_has_unknown(probe_batch):
                            logger.debug("New files detected (probe batch)")
                            return True
                        probe_batch = []
                if probe_batch and _batch_has_unknown(probe_batch):
                    logger.debug("New files detected (probe tail)")
                    return True

                return False
            finally:
                fts.close()
        except Exception as e:
            logger.debug("has_changed_files exception: %s", e)
            return True

    def trigger_background_reindex(self, force: bool = False, on_progress=None, on_complete=None, on_sub_progress=None):
        """供 FileWatcher / 手动触发的后台 reindex（使用自身的 _reindex_lock）

        Args:
            force: True 时全量重建（清空旧索引重扫）；False 增量更新。
            on_progress: 每个文件索引完调用，签名 (file_path: str, indexed_count: int) -> None。
            on_complete: 索引完成回调，签名 (success: bool, doc_count: int, failed_count: int, indexed_files: int) -> None。
            on_sub_progress: 流式 parser（如 PST）解析期间上报子进度，
                签名 (file_path: str, parsed_count: int, indexed_count: int) -> None。
        """
        logger.debug("trigger_background_reindex called")
        def _bg_work():
            try:
                logger.debug("_bg_work started, search_path=%s", self.search_path)
                with self._reindex_lock:
                    logger.debug("_bg_work got lock")
                    # 创建临时 TreeSearch 实例完成索引构建。
                    # 不预热 load_index、不物化 documents（百万级语料 OOM 根因，
                    # ADR-0018）：build_index 直写 DB，计数走 IndexStats / DB COUNT。
                    from treesearch import TreeSearch, set_config
                    import time as time_module

                    set_config(self._ts_config())
                    new_ts = TreeSearch(db_path=self.index_path)

                    # 线程安全的共享状态用于追踪进度
                    current_file = [None]  # 使用列表存储，模拟可变引用
                    indexed_count = [0]

                    def on_file_indexed(file_path: str, processed: int = 0, total: int = 0):
                        """每索引完一个文件时调用"""
                        current_file[0] = file_path
                        indexed_count[0] += 1
                        if on_progress:
                            try:
                                on_progress(file_path, indexed_count[0])
                            except Exception as e:  # noqa: BLE001
                                logger.debug("on_progress callback error: %s", e)

                    def on_sub_progress_cb(file_path: str, parsed_count: int):
                        """流式 parser（如 PST）解析期间上报子进度（已解析邮件数）"""
                        if on_sub_progress:
                            try:
                                on_sub_progress(file_path, parsed_count, indexed_count[0])
                            except Exception as e:  # noqa: BLE001
                                logger.debug("on_sub_progress callback error: %s", e)

                    def publish_progress():
                        """Timer 回调，发布当前索引进度"""
                        from doclens.event_bus import EventBus
                        bus = EventBus.get_instance()
                        file_name = os.path.basename(current_file[0]) if current_file[0] else "正在索引..."
                        bus.publish("status", {
                            "event_type": "indexing",
                            "current_file": file_name,
                            "indexed_count": indexed_count[0],
                            "timestamp": time_module.time(),
                        })
                        logger.debug("indexing event published: %s (%d)", file_name, indexed_count[0])

                    progress_timer = threading.Timer(1.0, publish_progress)
                    progress_timer.daemon = True
                    progress_timer.start()
                    logger.debug("progress_timer started")

                    # 立即发布一次初始状态（如果索引快速完成，Timer 不会触发）
                    publish_progress()

                    logger.debug("about to call new_ts.index(), search_path=%s", self.search_path)
                    try:
                        new_ts.index(self.search_path, force=force, return_documents=False, progress_callback=on_file_indexed, sub_progress_callback=on_sub_progress_cb)
                        logger.debug("new_ts.index() completed")
                    except FileNotFoundError:
                        logger.debug("new_ts.index() caught FileNotFoundError")
                    finally:
                        progress_timer.cancel()
                        logger.debug("progress_timer cancelled")

                    # 获取失败文件统计
                    failed_count = 0
                    try:
                        from treesearch.fts import FTS5Index
                        fts = FTS5Index(db_path=self.index_path)
                        failed = fts.get_all_failed_files()
                        failed_count = len(failed) if failed else 0
                        logger.debug("index completed, failed files: %d", failed_count)
                    except Exception as e:
                        logger.debug("failed to get failed file stats: %s", e)

                    # 索引后判定：documents 不再物化（ADR-0018），改读 IndexStats +
                    # DB COUNT。锁冲突（build_index 被跳过返回 []）以 IndexStats 缺失
                    # + 全零为特征——保留旧索引，本次视为跳过，下次文件变化重新触发。
                    prev_count = self.indexed_doc_count()
                    _stats = new_ts.get_index_stats() if new_ts else None
                    doc_count = self.indexed_doc_count()
                    if (_stats is not None and _stats.total_files > 0) or prev_count == 0:
                        logger.info("Background reindex completed: %d documents", doc_count)
                        # 刷新内存 path_map（轻量：仅 doc_id→path 映射，不载树结构）；
                        # _ts.documents 保持不物化——files/status 计数已走 DB 查询。
                        self.refresh_path_map_from_db()
                        # 标记需要重新加载，下次搜索/查询时会从磁盘重新加载索引。
                        # 仅在索引实际发生变化时标记（indexed>0 或 prune>0）——
                        # 零变化的空转 reindex 不标记，否则触发又一轮全量审计
                        # （启动双轮审计 bug：watcher 启动扫描空转 → 无条件
                        # _needs_reload → 下个请求重跑 50 万文件审计）。
                        _index_touched = (
                            _stats is not None
                            and (_stats.indexed_files > 0 or len(_stats.pruned_paths) > 0)
                        )
                        if _index_touched:
                            self._needs_reload = True
                        else:
                            logger.debug("Background reindex touched nothing; skip reload mark")
                    else:
                        # 无 IndexStats 且现有索引非空 —— 几乎都是 db 锁冲突导致
                        # build_index 被跳过（返回 []）。保留旧索引，下次重试。
                        logger.warning(
                            "Background reindex produced no stats (likely db lock conflict); "
                            "keeping existing %d documents.", prev_count,
                        )
                        doc_count = prev_count

                    # 调用完成回调（先记失败数，供 /api/status）
                    self._last_failed_count = failed_count
                    _indexed = _stats.indexed_files if _stats else 0
                    if on_complete:
                        on_complete(True, doc_count, failed_count, _indexed)
            except Exception as e:
                logger.exception("_bg_work exception: %s", e)
                if on_complete:
                    on_complete(False, 0, 0, 0)
        t = threading.Thread(target=_bg_work, daemon=True)
        t.start()
        return t

    def _sync_image_version_expectation(self):
        """把当前 vision 版本同步给 image_metadata（工单 08：read_back 版本校验，
        payload 版本不符则当无解读 → 占位入队重解读）。失败静默（不影响索引）。"""
        try:
            from doclens.vision_worker import PROMPT_VERSION, vision_model_tag
            from treesearch.parsers.image_metadata import set_expected_version
            set_expected_version(vision_model_tag(self.config), str(PROMPT_VERSION))
        except Exception:
            pass

    def vision_status(self) -> dict:
        """vision 处理状态：队列计数（待解析/已写回/失败）+ write_back 失败计数。工单 09。"""
        from treesearch.parsers import image_metadata
        counts: dict = {}
        try:
            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=self.index_path)
            try:
                counts = fts.vision_counts()
            finally:
                close = getattr(fts, "close", None)
                if callable(close):
                    close()
        except Exception:
            pass
        return {
            "queue": counts,
            "writeback_failures": image_metadata.writeback_failure_count(),
        }

    def load_or_build_index(self):
        """加载或构建索引。

        ADR-0018：不再把全量 documents 物化进内存（百万级语料 OOM 根因）。
        启动时只做「存在性 + 变更检测」：索引库已存在且无变化 → 只建轻量
        path_map 即返回；有变化/不存在 → 增量/全量索引（build_index 直写
        DB，return_documents=False）。搜索走 DB 路由惰性路径（ADR-0019），
        全程不物化 documents。

        磁盘审计（has_changed_files，全库逐文件 hash）**只在进程首次装配
        索引时做**——那是唯一"磁盘可能在本进程不知情下变化"的时点（离线
        期间改动）。此后 `_needs_reload` 的两类来源都不需要审计：
        `trigger_background_reindex` 刚把磁盘与 DB 对账完，重扫的结论恒为
        "无变化"；`mark_index_dirty` 是外部写入者直接改 DB（磁盘未动）。
        此前每次 reindex 后的首个搜索都白扫一遍全库（AP-11）。
        审计之后才发生的改动由 FileWatcher 防抖 reindex 兜底。
        """
        self._sync_image_version_expectation()
        # 另一线程正在后台构建（首次建库后台化，ADR-0043）——等待其完成，
        # 不重复构建。构建线程自身（begin_background_build 的调用线程）经
        # thread-local 豁免等待，否则自我死锁。
        with self._build_cond:
            while self._building and _build_tls.owner is not threading.current_thread():
                self._build_cond.wait()
        if self._ts is not None and not self._needs_reload:
            return True
        # 本进程是否首次装配：必须在重建 _ts 之前判定（重建后即非 None）
        needs_audit = self._ts is None
        self._needs_reload = False

        set_config(self._ts_config())
        self._ts = TreeSearch(db_path=self.index_path, lazy_search=True)
        abs_path = os.path.abspath(self.index_path)
        self._startup_audit_done = True

        if os.path.exists(abs_path):
            if not needs_audit:
                # DB 已是权威（后台 reindex 刚对账 / 外部写入者原地更新）：
                # 只重建句柄 + 刷新 path_map，跳过全库 hash 审计（AP-11）。
                self.build_path_map()
                logger.debug("Index reloaded without disk audit (%d docs)",
                             len(self._path_map))
                return True
            # 索引库已存在：无变化则不物化、不全量 load（ADR-0018）
            print(f"[变更检测中: {self.search_path}]（百万级语料可能需要数分钟）", flush=True)
            _t_audit = time.time()
            _changed = self.has_changed_files()
            print(f"[变更检测完成: {'有变化' if _changed else '无变化'}，用时 {time.time() - _t_audit:.1f}s]", flush=True)
            if not _changed:
                self.build_path_map()
                logger.debug("Index unchanged, loaded path_map only (%d docs)",
                             len(self._path_map))
                return True
            # 有变化：走增量索引（不清空 _ts，build_index 直写 DB）
            print(f"[增量索引: {self.search_path}]")
            try:
                self._ts.index(self.search_path, return_documents=False)
            except FileNotFoundError:
                print(f"[警告] 路径不存在或为空: {self.search_path}")
                self._path_map = {}
                return True
            stats = self._ts.get_index_stats()
            self._last_failed_count = stats.failed_files if stats else 0
            self.build_path_map()
            doc_count = self.indexed_doc_count()
            fail_hint = f"，{self._last_failed_count} 个文件失败" if self._last_failed_count else ""
            print(f"[索引完成: {doc_count} 个文档{fail_hint}]")
            return True

        # 构建新索引（首次）
        print(f"[正在构建索引: {self.search_path}]")
        try:
            self._ts.index(self.search_path, return_documents=False)
        except FileNotFoundError:
            print(f"[警告] 路径不存在或为空: {self.search_path}")
            self._path_map = {}
            return True
        # 读本次索引的 IndexStats（失败文件数），暴露给 /api/status；启动同步索引
        # 不走 reindexed 广播，前端只能靠此字段看到失败数。
        stats = self._ts.get_index_stats()
        self._last_failed_count = stats.failed_files if stats else 0
        self.build_path_map()
        doc_count = self.indexed_doc_count()
        fail_hint = f"，{self._last_failed_count} 个文件失败" if self._last_failed_count else ""
        print(f"[索引完成: {doc_count} 个文档{fail_hint}]")
        return True

    def build_path_map(self):
        """构建路径映射（从 DB 轻量加载 doc_id/source_path，不物化树结构）。

        顺带失效 ripgrep 的二进制文档画像缓存（AP-12：doc_id 集合随索引重建
        变化，不失效会让 REGEXP 子集按旧 id 扫描 → 静默漏结果）。选择挂在这里
        而非每个 reindex 分支：所有索引变更路径（首次构建 / 增量 / 后台
        reindex / 目录切换）最终都会刷新 path_map。
        """
        try:
            from doclens.ripgrep import invalidate_binary_doc_profile

            invalidate_binary_doc_profile(self.index_path)
        except Exception as e:  # noqa: BLE001
            logger.debug("invalidate binary doc profile failed: %s", e)
        try:
            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=self.index_path)
            try:
                pairs = fts.load_doc_id_source_paths()
            finally:
                fts.close()
        except Exception as e:  # noqa: BLE001
            logger.debug("build_path_map DB load failed: %s", e)
            pairs = {}
        self._path_map = dict(pairs)

    def refresh_path_map_from_db(self):
        """后台 reindex 完成后刷新 path_map（build_path_map 的别名入口）。"""
        self.build_path_map()

    def reindex(self, force=False):
        """增量更新索引（force=True 时全量重建）"""
        with self._reindex_lock:
            return self._reindex_internal(force)

    def _reindex_internal(self, force=False):
        """内部 reindex（已持有锁）"""
        self._sync_image_version_expectation()
        if self._ts is None:
            set_config(self._ts_config())
            self._ts = TreeSearch(db_path=self.index_path, lazy_search=True)

        mode = "全量重建" if force else "增量更新"

        # 包装 index_document 方法来追踪进度（仅在 TUI 模式下可用）
        original_index_doc = getattr(self._ts, 'index_document', None)
        self._current_indexing_file = None
        self._indexed_count = 0

        progress_timer = None

        if original_index_doc is not None:
            def wrapped_index_doc(doc, **kwargs):
                self._current_indexing_file = doc.doc_name if hasattr(doc, 'doc_name') else '未知'
                self._indexed_count += 1
                return original_index_doc(doc, **kwargs)

            self._ts.index_document = wrapped_index_doc

            # 启动进度发布 Timer
            import threading
            import time as time_module

            def publish_progress():
                if self._current_indexing_file:
                    from doclens.event_bus import EventBus
                    bus = EventBus.get_instance()
                    bus.publish("status", {
                        "event_type": "indexing",
                        "current_file": os.path.basename(self._current_indexing_file),
                        "indexed_count": self._indexed_count,
                        "timestamp": time_module.time(),
                    })

            progress_timer = threading.Timer(1.0, publish_progress)
            progress_timer.daemon = True
            progress_timer.start()

        print(f"[正在{mode}: {self.search_path}]")
        try:
            self._ts.index(self.search_path, force=force, return_documents=False)
        except FileNotFoundError:
            print(f"[警告] 路径不存在或为空: {self.search_path}")
            self._path_map = {}
            return
        finally:
            if original_index_doc is not None:
                self._ts.index_document = original_index_doc
            if progress_timer is not None:
                progress_timer.cancel()
        self.build_path_map()

        # 展示增量统计（文档计数走 DB COUNT，ADR-0018）
        stats = self._ts.get_index_stats()
        doc_count = self.indexed_doc_count()
        if stats:
            excluded_info = f", {stats.excluded_files} 个失败跳过" if stats.excluded_files else ""
            print(f"[{mode}完成: "
                  f"{stats.indexed_files} 个文件已索引, "
                  f"{stats.skipped_files} 个未变更, "
                  f"{len(stats.pruned_paths)} 个已清理{excluded_info} | "
                  f"共 {doc_count} 个文档, "
                  f"{stats.total_time_s:.2f}s]")
        else:
            print(f"[索引已更新: {doc_count} 个文档]")

    def search(self, query, top_k_docs=None, fts_expression=None, allowed_doc_ids=None):
        """执行搜索，返回 (flat_nodes, documents)。

        ADR-0019：全惰性——DB 路由出 top-k、只载 top-k 树结构，全程不物化
        全量 documents（百万语料 OOM 根因清除）。

        top_k_docs：**候选池大小**——路由阶段最多选多少个文档参与打分，
        `None` 取配置值（`self.top_k_docs`）。命中该池之外的文档不进结果，
        任何「总数」都以此为界（AP-47：旧形参 `max_results` 从未被引擎消费，
        被 `search(**kwargs)` 静默吞掉，调用方以为能改行为）。
        展示层面的裁剪（显示前 N 条）由调用方自己做，与本参数无关。

        max_nodes_per_doc 经 _ts_config() → set_config() 注入引擎。

        allowed_doc_ids: 可选 doc_id 集合，路由阶段 SQL 内生效（search_kb
        的 paths 范围限定走此路——范围外文档不进候选池）。
        """
        self.load_or_build_index()

        availability = self.index_availability()
        if availability == "unavailable":
            # AP-45：DB 故障不得伪装成「空库」——上抛让检索入口给出明确信号
            raise IndexUnavailable(f"索引库不可用: {self.index_path}")
        if availability == "empty" or not self._ts:
            return [], []

        kwargs = {
            "fts_expression": fts_expression,
            "allowed_doc_ids": allowed_doc_ids,
        }
        if top_k_docs is not None:
            kwargs["top_k_docs"] = max(1, int(top_k_docs))

        result = self._ts.search(query=query, **kwargs)

        return result.get("flat_nodes", []), result.get("documents", [])

    def like_search(self, query, max_results=None, use_regex=False):
        """SQLite LIKE/REGEXP 降级搜索，对原文做子串或正则匹配。

        当 FTS5 分词导致查询词被错误拆分时使用。
        返回格式与 search() 的 flat_nodes 兼容。
        """
        if max_results is None:
            max_results = self.max_results

        self.load_or_build_index()

        # 直接查 DB（ADR-0018）：documents 不物化，空库以可用性判定。
        # AP-45：`indexed_doc_count() == 0` 会把「计数失败」也算成空库——
        # 这里改用 index_availability 区分「空库」与「不可读」。
        availability = self.index_availability()
        if availability == "unavailable":
            raise IndexUnavailable(f"索引库不可用: {self.index_path}")
        if availability == "empty":
            return []

        from treesearch.fts import FTS5Index

        fts = FTS5Index(db_path=self.index_path)
        try:
            return fts.like_search(query, top_k=max_results, use_regex=use_regex)
        finally:
            fts.close()
