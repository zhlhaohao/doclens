"""索引管理模块 - 封装 TreeSearch 生命周期"""

import logging
import os
import threading

logger = logging.getLogger(__name__)

from treesearch import TreeSearch, set_config, TreeSearchConfig
from treesearch.parsers.registry import SOURCE_TYPE_MAP
from doclens.config import CortexConfig, data_dirname

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


class IndexManager:
    """TreeSearch 索引管理器"""

    def __init__(self, config: CortexConfig):
        self._config = config
        self.search_path = config.search_path
        self.index_path = config.index_path or os.path.join(self.search_path, data_dirname(), "index.db")
        self._ts = None
        self._path_map = {}
        self._pending_swap = None  # (new_ts, new_path_map, doc_count)
        self._needs_reload = False  # 后台 reindex 完成后标记，下次 load 时重新加载
        self._reindexing = False
        self._reindex_lock = threading.Lock()
        # 最近一次索引（启动同步或后台 reindex）失败的文件数；0 = 全部成功。
        # 供 /api/status 暴露给前端——启动同步索引不走 reindexed 广播，
        # 前端只能靠此字段看到失败数。
        self._last_failed_count = 0

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

    # --- Config-backed properties (hot-reloadable) ---

    @property
    def max_results(self) -> int:
        return self._config.max_results

    @property
    def max_nodes_per_doc(self) -> int:
        return self._config.max_nodes_per_doc

    @property
    def top_k_docs(self) -> int:
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
    def cjk_tokenizer(self) -> str:
        return self._config.cjk_tokenizer

    @property
    def max_index_fail_count(self) -> int:
        return self._config.max_index_fail_count

    @property
    def enable_shadow_md(self) -> bool:
        return self._config.treesearch_enable_shadow_md

    @property
    def xlsx_max_rows_per_sheet(self) -> int:
        return self._config.treesearch_xlsx_max_rows_per_sheet

    @property
    def xlsx_max_consecutive_empty_rows(self) -> int:
        return self._config.treesearch_xlsx_max_consecutive_empty_rows

    @property
    def allowed_source_types(self) -> list:
        return self._config.allowed_source_types

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
    def rg_context_before(self) -> int:
        return self._config.rg_context_before

    @property
    def rg_context_after(self) -> int:
        return self._config.rg_context_after

    @property
    def grep_score_threshold(self) -> float:
        return self._config.grep_score_threshold

    @property
    def grep_max_results(self) -> int:
        return self._config.grep_max_results

    @property
    def max_dir_files(self) -> int:
        """单目录遍历文件数上限（0 = 不设限；防误扫巨型目录）。"""
        return self._config.treesearch_max_dir_files

    @property
    def index_chunk_size(self) -> int:
        """分块索引块大小（文件数；0 = 不分块，旧行为。ADR-0018）。"""
        return self._config.treesearch_index_chunk_size

    def _ts_config(self):
        """构造 treesearch 配置（集中一处，避免 4 处 set_config 漂移）。"""
        return TreeSearchConfig(
            cjk_tokenizer=self.cjk_tokenizer,
            max_index_fail_count=self.max_index_fail_count,
            enable_shadow_md=self.enable_shadow_md,
            xlsx_max_rows_per_sheet=self.xlsx_max_rows_per_sheet,
            xlsx_max_consecutive_empty_rows=self.xlsx_max_consecutive_empty_rows,
            allowed_source_types=self.allowed_source_types,
            max_dir_files=self.max_dir_files,
            index_chunk_size=self.index_chunk_size,
        )

    def indexed_doc_count(self) -> int:
        """索引文档总数（DB COUNT，不物化 documents——ADR-0018）。"""
        try:
            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=self.index_path)
            try:
                return int(fts.get_stats().get("document_count", 0))
            finally:
                fts.close()
        except Exception as e:  # noqa: BLE001
            logger.debug("indexed_doc_count failed: %s", e)
            return 0

    def indexed_source_paths(self) -> list[str]:
        """已索引文档的 source_path 列表（DB 轻量查询，不物化树结构）。

        ⚠️ 全表返回（O(库内文档数)）——50 万级语料上单次调用秒级、每次
        请求调用会拖垮 API。目录页/单文件场景请用 indexed_paths_under()。
        仅保留给 /files/documents（自身就是全量语义）与低频管理场景。
        """
        try:
            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=self.index_path)
            try:
                return sorted(set(fts.load_doc_id_source_paths().values()))
            finally:
                fts.close()
        except Exception as e:  # noqa: BLE001
            logger.debug("indexed_source_paths failed: %s", e)
            return []

    def indexed_paths_under(self, dir_abs_path: str) -> set[str]:
        """某目录（含子目录）下已索引文档的绝对路径集合（索引化前缀查询）。

        LIKE 'dir%' 走 idx_documents_source_path 索引：50 万文档库上
        DB 查询 ~0.4s，但返回集合仍达全子树规模——目录页请改用
        is_path_indexed()（逐条目常数时间探测，不在 Python 侧物化集合）。
        """
        try:
            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=self.index_path)
            try:
                return fts.search_source_paths_under(dir_abs_path)
            finally:
                fts.close()
        except Exception as e:  # noqa: BLE001
            logger.debug("indexed_paths_under failed: %s", e)
            return set()

    def is_path_indexed(self, abs_path: str, is_dir: bool = False) -> bool:
        """单个路径是否已索引（索引化探测）。

        目录：前缀 EXISTS（子树里有任一文档即 True）；文件：精确匹配。
        ⚠️ 每次调用开关一个 DB 连接 + 一次索引范围扫（9.4GB 库上目录前缀
        ~0.1s）——目录页批量判定请用 indexed_children_of（单查合并）。
        """
        try:
            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=self.index_path)
            try:
                return fts.has_docs_under(abs_path) if is_dir else fts.has_doc_at(abs_path)
            finally:
                fts.close()
        except Exception as e:  # noqa: BLE001
            logger.debug("is_path_indexed(%s) failed: %s", abs_path, e)
            return False

    def indexed_children_of(self, dir_abs_path: str) -> set[str]:
        """目录的直接子项中含已索引文档的子项名集合（单次前缀查询）。

        目录页一次调用替代逐条目探测：81 条目 27s → 0.3s（50 万文档库）。
        子项名不含路径；文件 = 直接子文件已索引，子目录 = 其子树含文档。
        """
        try:
            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=self.index_path)
            try:
                return fts.indexed_children_of(dir_abs_path)
            finally:
                fts.close()
        except Exception as e:  # noqa: BLE001
            logger.debug("indexed_children_of(%s) failed: %s", dir_abs_path, e)
            return set()

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
        给工具/AI，引用就是无意义的字符串（真实案例：日记 doc_id "2025_53285d70"
        被当作路径输出，AI 无法引用真实来源 日记/2025.md）。
        仍解析不到则返回 doc_id 本身（保持旧行为）。
        """
        path = self._path_map.get(doc_id)
        if path:
            return path
        try:
            from treesearch.fts import get_fts_index

            doc = get_fts_index(db_path=self.index_path).load_document(doc_id)
            if doc is not None:
                return (doc.metadata or {}).get("source_path", "") or doc_id
        except Exception as e:  # noqa: BLE001
            logger.warning("resolve_doc_path(%s) failed: %s", doc_id, e)
        return doc_id

    @property
    def documents(self):
        """已物化的文档列表（搜索后缓存）；计数场景请用 indexed_doc_count()。

        ADR-0018：启动/索引路径不再预加载全量 documents——本属性在搜索
        首次触发 _ensure_search_documents() 前可能为空。
        """
        return self._ts.documents if self._ts else []

    def has_changed_files(self) -> bool:
        """快速检查是否有文件变化，用于启动同步前置判断。

        检测三类变化：已索引文件内容修改、已索引文件被删除、新增文件。
        排除数据目录（开发 .cortex / 发行版 .doclens）内的文件（索引元数据）和之前索引失败的文件。
        """
        try:
            from treesearch.fts import FTS5Index
            from treesearch.indexer import file_hash_with_salts

            fts = FTS5Index(db_path=self.index_path)
            stored_meta = fts.get_all_index_meta()
            failed_files = fts.get_all_failed_files()
            fts.close()

            cortex_dir = os.path.abspath(os.path.join(self.search_path, data_dirname()))
            supported_exts = set(SUPPORTED_FORMATS.keys())

            # Apply allowed_source_types filter to extension check
            if self.allowed_source_types:
                from treesearch.pathutil import get_allowed_extensions_for_source_types
                type_exts = get_allowed_extensions_for_source_types(self.allowed_source_types)
                if type_exts is not None:
                    supported_exts = supported_exts & type_exts

            # 1. 检查已索引文件是否被修改或删除
            for abs_fp, stored_hash in stored_meta.items():
                if abs_fp.startswith(cortex_dir):
                    continue
                if not os.path.isfile(abs_fp):
                    logger.debug("File deleted: %s", abs_fp)
                    return True
                current_hash = file_hash_with_salts(abs_fp)
                if current_hash != stored_hash:
                    logger.debug("File changed: %s", abs_fp)
                    return True

            # 2. 检查是否有新增文件（在 supported_exts 中、不在 stored_meta、不在 failed_files）
            # 复用 treesearch 的目录遍历：与索引链路保持同一套忽略规则
            # （DEFAULT_IGNORE_DIRS + .gitignore + 扩展名白名单 + 跳过 ._*md 影子文件），
            # 避免 gitignore 内的文件被误判为"新增"而空转 reindex。
            from treesearch.pathutil import resolve_paths
            disk_files = set(resolve_paths(
                [self.search_path],
                allowed_extensions=supported_exts,
                max_files=self.max_dir_files,
            ))

            known = set(stored_meta.keys()) | set(failed_files.keys())
            new_files = disk_files - known
            if new_files:
                logger.debug("New files detected: %d", len(new_files))
                return True

            return False
        except Exception as e:
            logger.debug("has_changed_files exception: %s", e)
            return True

    def _check_swap(self):
        """兼容保留，实际 reload 由 _needs_reload 机制处理"""
        self._pending_swap = None

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
                        # 标记需要重新加载，下次搜索/查询时会从磁盘重新加载索引
                        self._needs_reload = True
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
        DB，return_documents=False）。搜索时才按需从 DB 加载。
        """
        self._sync_image_version_expectation()
        if self._ts is not None and not self._needs_reload:
            return True
        self._needs_reload = False

        set_config(self._ts_config())
        self._ts = TreeSearch(db_path=self.index_path)
        abs_path = os.path.abspath(self.index_path)

        if os.path.exists(abs_path):
            # 索引库已存在：无变化则不物化、不全量 load（ADR-0018）
            if not self.has_changed_files():
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
            self._ts.documents = []
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
        """构建路径映射（从 DB 轻量加载 doc_id/source_path，不物化树结构）。"""
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
        # doc_name → path 兜底映射（旧文件名查找路径仍可用）
        for doc in (self._ts.documents if self._ts else []):
            if hasattr(doc, 'metadata') and doc.metadata:
                path = doc.metadata.get('source_path', '')
                if path:
                    self._path_map[doc.doc_name] = path

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
            self._ts = TreeSearch(db_path=self.index_path)

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
            self._ts.documents = []
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

    def _ensure_search_documents(self):
        """搜索前的按需加载：_ts.documents 为空且库里有文档时才全量 load。

        ADR-0018 的分期边界：启动/索引路径已去物化，搜索路径仍需完整
        documents（treesearch search 路由吃全量列表）；全惰性化（FTS 路由
        先查 DB 只载 top-k）排下期。这里按需加载一次后缓存复用。
        """
        if self._ts is not None and not self._ts.documents and self.indexed_doc_count() > 0:
            try:
                self._ts.load_index(os.path.abspath(self.index_path))
            except Exception as e:  # noqa: BLE001
                logger.warning("search-time document load failed: %s", e)

    def search(self, query, max_results=None, fts_expression=None):
        """执行搜索，返回 (flat_nodes, documents)"""
        if max_results is None:
            max_results = self.max_results

        self._check_swap()
        self.load_or_build_index()
        self._ensure_search_documents()

        if not self._ts.documents:
            return [], []

        result = self._ts.search(
            query=query,
            max_results=max_results,
            max_nodes_per_doc=self.max_nodes_per_doc,
            top_k_docs=self.top_k_docs,
            fts_expression=fts_expression,
        )

        return result.get("flat_nodes", []), result.get("documents", [])

    def like_search(self, query, max_results=None, use_regex=False):
        """SQLite LIKE/REGEXP 降级搜索，对原文做子串或正则匹配。

        当 FTS5 分词导致查询词被错误拆分时使用。
        返回格式与 search() 的 flat_nodes 兼容。
        """
        if max_results is None:
            max_results = self.max_results

        self.load_or_build_index()

        # 直接查 DB（ADR-0018）：documents 不物化，空库以 DB 计数判定
        if self.indexed_doc_count() == 0:
            return []

        from treesearch.fts import FTS5Index

        fts = FTS5Index(db_path=self.index_path)
        try:
            return fts.like_search(query, top_k=max_results, use_regex=use_regex)
        finally:
            fts.close()
