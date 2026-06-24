"""索引管理模块 - 封装 TreeSearch 生命周期"""

import logging
import os
import threading

logger = logging.getLogger(__name__)

from treesearch import TreeSearch, set_config, TreeSearchConfig
from treesearch.parsers.registry import SOURCE_TYPE_MAP
from doclens.config import CortexConfig

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
        self.search_path = config.search_path
        self.index_path = config.index_path or os.path.join(self.search_path, ".cortex", "index.db")
        self.max_results = config.max_results
        self.max_nodes_per_doc = config.max_nodes_per_doc
        self.top_k_docs = config.top_k_docs
        self.max_span = config.max_span
        self.min_keyword_match = config.min_keyword_match
        self.min_proximity_score = config.min_proximity_score
        self.min_keywords_per_line = config.min_keywords_per_line
        self.min_score_threshold = config.min_score_threshold
        self.cjk_tokenizer = config.cjk_tokenizer
        self.max_index_fail_count = config.max_index_fail_count
        self.enable_shadow_md = config.treesearch_enable_shadow_md
        self.xlsx_max_rows_per_sheet = config.treesearch_xlsx_max_rows_per_sheet
        self.xlsx_max_consecutive_empty_rows = config.treesearch_xlsx_max_consecutive_empty_rows
        self.allowed_source_types = config.allowed_source_types

        # 终端显示参数
        self.title_width = config.title_width
        self.line_width = config.line_width
        self.max_context_lines = config.max_context_lines
        self.max_anchor_lines = config.max_anchor_lines
        self.context_expand_range = config.context_expand_range

        # KB 工具字符限制
        self.max_context_chars_per_result = config.max_context_chars_per_result
        self.max_total_chars = config.max_total_chars
        self.max_read_chars = config.max_read_chars
        self.read_doc_show_toc = config.read_doc_show_toc

        # Ripgrep 降级搜索上下文
        self.rg_context_before = config.rg_context_before
        self.rg_context_after = config.rg_context_after

        # Grep 工具配置
        self.grep_score_threshold = config.grep_score_threshold
        self.grep_max_results = config.grep_max_results

        self.scoring_weights = {
            "keyword_match_ratio": config.weight_keyword_match,
            "file_name_match": config.weight_file_name_match,
            "fts_score": config.weight_fts_score,
            "title_match": config.weight_title_match,
            "proximity_match": config.weight_proximity_match,
        }

        self._ts = None
        self._path_map = {}
        self._pending_swap = None  # (new_ts, new_path_map, doc_count)
        self._needs_reload = False  # 后台 reindex 完成后标记，下次 load 时重新加载
        self._reindexing = False
        self._reindex_lock = threading.Lock()

    @property
    def ts(self):
        return self._ts

    @property
    def path_map(self):
        return self._path_map

    @property
    def documents(self):
        return self._ts.documents if self._ts else []

    def has_changed_files(self) -> bool:
        """快速检查是否有文件变化，用于启动同步前置判断。

        检测三类变化：已索引文件内容修改、已索引文件被删除、新增文件。
        排除 .cortex 目录内的文件（索引元数据）和之前索引失败的文件。
        """
        try:
            from treesearch.fts import FTS5Index
            from treesearch.indexer import _file_hash

            fts = FTS5Index(db_path=self.index_path)
            stored_meta = fts.get_all_index_meta()
            failed_files = fts.get_all_failed_files()
            fts.close()

            cortex_dir = os.path.abspath(os.path.join(self.search_path, ".cortex"))
            supported_exts = set(SUPPORTED_FORMATS.keys())

            # Apply allowed_source_types filter to extension check
            if self.allowed_source_types:
                from treesearch.pathutil import get_allowed_extensions_for_source_types
                type_exts = get_allowed_extensions_for_source_types(self.allowed_source_types)
                if type_exts is not None:
                    supported_exts = supported_exts & type_exts
            ignore_dirs = {".cortex", ".git", "__pycache__", "node_modules", ".venv"}

            # 1. 检查已索引文件是否被修改或删除
            for abs_fp, stored_hash in stored_meta.items():
                if abs_fp.startswith(cortex_dir):
                    continue
                if not os.path.isfile(abs_fp):
                    logger.debug("File deleted: %s", abs_fp)
                    return True
                current_hash = _file_hash(abs_fp)
                if current_hash != stored_hash:
                    logger.debug("File changed: %s", abs_fp)
                    return True

            # 2. 检查是否有新增文件（在 supported_exts 中、不在 stored_meta、不在 failed_files）
            disk_files = set()
            for root, dirs, files in os.walk(self.search_path):
                dirs[:] = [d for d in dirs if d not in ignore_dirs]
                for fname in files:
                    ext = os.path.splitext(fname)[1].lower()
                    if ext not in supported_exts:
                        continue
                    disk_files.add(os.path.abspath(os.path.join(root, fname)))

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

    def trigger_background_reindex(self, on_complete=None):
        """供 FileWatcher 调用的后台增量 reindex（使用自身的 _reindex_lock）

        Args:
            on_complete: 索引完成后的回调，签名为 (success: bool, doc_count: int, failed_count: int) -> None
        """
        logger.debug("trigger_background_reindex called")
        def _bg_work():
            try:
                logger.debug("_bg_work started, search_path=%s", self.search_path)
                with self._reindex_lock:
                    logger.debug("_bg_work got lock")
                    # 创建临时 TreeSearch 实例完成索引构建
                    from treesearch import TreeSearch, set_config, TreeSearchConfig
                    import time as time_module

                    abs_path = os.path.abspath(self.index_path)
                    set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer, max_index_fail_count=self.max_index_fail_count, enable_shadow_md=self.enable_shadow_md, xlsx_max_rows_per_sheet=self.xlsx_max_rows_per_sheet, xlsx_max_consecutive_empty_rows=self.xlsx_max_consecutive_empty_rows, allowed_source_types=self.allowed_source_types))
                    new_ts = TreeSearch(db_path=self.index_path)
                    if os.path.exists(abs_path):
                        try:
                            docs = new_ts.load_index(abs_path)
                            if docs:
                                new_ts.documents = docs
                        except Exception:
                            pass

                    # 线程安全的共享状态用于追踪进度
                    current_file = [None]  # 使用列表存储，模拟可变引用
                    indexed_count = [0]

                    def on_file_indexed(file_path: str, processed: int = 0, total: int = 0):
                        """每索引完一个文件时调用"""
                        current_file[0] = file_path
                        indexed_count[0] += 1

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
                    failed_count = 0
                    try:
                        new_ts.index(self.search_path, progress_callback=on_file_indexed)
                        logger.debug("new_ts.index() completed")
                    except FileNotFoundError:
                        new_ts.documents = []
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

                    new_ts.save_index()
                    doc_count = len(new_ts.documents)
                    logger.info("Background reindex completed: %d documents", doc_count)
                    # 标记需要重新加载，下次搜索/查询时会从磁盘重新加载索引
                    self._needs_reload = True

                    # 调用完成回调
                    if on_complete:
                        on_complete(True, doc_count, failed_count)
            except Exception as e:
                logger.exception("_bg_work exception: %s", e)
                if on_complete:
                    on_complete(False, 0, 0)
        t = threading.Thread(target=_bg_work, daemon=True)
        t.start()
        return t

    def load_or_build_index(self):
        """加载或构建索引"""
        if self._ts is not None and not self._needs_reload:
            return True
        self._needs_reload = False

        # 设置 CJK 分词
        set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer, max_index_fail_count=self.max_index_fail_count, enable_shadow_md=self.enable_shadow_md, xlsx_max_rows_per_sheet=self.xlsx_max_rows_per_sheet, xlsx_max_consecutive_empty_rows=self.xlsx_max_consecutive_empty_rows, allowed_source_types=self.allowed_source_types))
        self._ts = TreeSearch(db_path=self.index_path)
        abs_path = os.path.abspath(self.index_path)

        if os.path.exists(abs_path):
            try:
                docs = self._ts.load_index(abs_path)
                if docs:
                    self._ts.documents = docs
                    self.build_path_map()
                    return True
            except Exception:
                # 索引文件损坏，删除并重建 TreeSearch 实例
                print("[警告] 索引文件损坏，正在重建...")
                self._ts = None  # 释放旧实例引用，帮助 GC 回收 SQLite 连接
                import gc
                gc.collect()
                # 删除损坏的索引文件及 WAL/SHM 文件
                for suffix in ("", "-wal", "-shm"):
                    p = abs_path + suffix
                    for _ in range(3):
                        try:
                            if os.path.exists(p):
                                os.remove(p)
                            break
                        except PermissionError:
                            import time
                            time.sleep(0.2)
                            gc.collect()
                set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer, max_index_fail_count=self.max_index_fail_count, enable_shadow_md=self.enable_shadow_md, xlsx_max_rows_per_sheet=self.xlsx_max_rows_per_sheet, xlsx_max_consecutive_empty_rows=self.xlsx_max_consecutive_empty_rows, allowed_source_types=self.allowed_source_types))
                self._ts = TreeSearch(db_path=self.index_path)

        # 构建新索引
        print(f"[正在构建索引: {self.search_path}]")
        try:
            self._ts.index(self.search_path)
        except FileNotFoundError:
            print(f"[警告] 路径不存在或为空: {self.search_path}")
            self._ts.documents = []
            self._path_map = {}
            return True
        os.makedirs(os.path.dirname(os.path.abspath(self.index_path)), exist_ok=True)
        self._ts.save_index()
        self.build_path_map()
        print(f"[索引完成: {len(self._ts.documents)} 个文档]")
        return True

    def build_path_map(self):
        """构建路径映射"""
        self._path_map = {}
        for doc in self._ts.documents:
            if hasattr(doc, 'metadata') and doc.metadata:
                path = doc.metadata.get('source_path', '')
                if path:
                    self._path_map[doc.doc_id] = path
                    self._path_map[doc.doc_name] = path

    def reindex(self, force=False):
        """增量更新索引（force=True 时全量重建）"""
        with self._reindex_lock:
            return self._reindex_internal(force)

    def _reindex_internal(self, force=False):
        """内部 reindex（已持有锁）"""
        if self._ts is None:
            set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer, max_index_fail_count=self.max_index_fail_count, enable_shadow_md=self.enable_shadow_md, xlsx_max_rows_per_sheet=self.xlsx_max_rows_per_sheet, xlsx_max_consecutive_empty_rows=self.xlsx_max_consecutive_empty_rows, allowed_source_types=self.allowed_source_types))
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
            self._ts.index(self.search_path, force=force)
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

        # 展示增量统计
        stats = self._ts.get_index_stats()
        if stats:
            excluded_info = f", {stats.excluded_files} 个失败跳过" if stats.excluded_files else ""
            print(f"[{mode}完成: "
                  f"{stats.indexed_files} 个文件已索引, "
                  f"{stats.skipped_files} 个未变更, "
                  f"{len(stats.pruned_paths)} 个已清理{excluded_info} | "
                  f"共 {len(self._ts.documents)} 个文档, "
                  f"{stats.total_time_s:.2f}s]")
        else:
            print(f"[索引已更新: {len(self._ts.documents)} 个文档]")

    def search(self, query, max_results=None, fts_expression=None):
        """执行搜索，返回 (flat_nodes, documents)"""
        if max_results is None:
            max_results = self.max_results

        self._check_swap()
        self.load_or_build_index()

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

        if not self._ts.documents:
            return []

        from treesearch.fts import FTS5Index

        fts = FTS5Index(db_path=self.index_path)
        try:
            return fts.like_search(query, top_k=max_results, use_regex=use_regex)
        finally:
            fts.close()
