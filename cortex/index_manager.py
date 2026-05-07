"""索引管理模块 - 封装 TreeSearch 生命周期"""

import logging
import os
import threading

logger = logging.getLogger(__name__)

from treesearch import TreeSearch, set_config, TreeSearchConfig
from cortex.config import CortexConfig

# 支持的文件类型和依赖
SUPPORTED_FORMATS = {
    # 内置支持
    '.md': ('Markdown', None),
    '.txt': ('纯文本', None),
    '.json': ('JSON', None),
    '.yaml': ('YAML', None),
    '.yml': ('YAML', None),
    '.toml': ('TOML', None),
    '.py': ('Python', None),
    '.js': ('JavaScript', None),
    '.ts': ('TypeScript', None),
    '.html': ('HTML', 'bs4'),
    '.xml': ('XML', None),
    # 需要额外依赖
    '.pdf': ('PDF', 'pymupdf'),
    '.docx': ('Word文档', 'docx'),
    '.xlsx': ('Excel表格', 'openpyxl'),
    '.xls': ('Excel表格', 'openpyxl'),
    '.pptx': ('PowerPoint', 'pptx'),
}


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
        self.cjk_tokenizer = config.cjk_tokenizer
        self.max_index_fail_count = config.max_index_fail_count

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

        # Ripgrep 降级搜索上下文
        self.rg_context_before = config.rg_context_before
        self.rg_context_after = config.rg_context_after

        self.scoring_weights = {
            "keyword_match_ratio": config.weight_keyword_match,
            "file_name_match": config.weight_file_name_match,
            "fts_score": config.weight_fts_score,
            "title_match": config.weight_title_match,
        }

        self._ts = None
        self._path_map = {}
        self._pending_swap = None  # (new_ts, new_path_map, doc_count)
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

    def _check_swap(self):
        """检查是否有待替换的新索引，有则原子替换（主线程调用）"""
        if self._pending_swap is None:
            return
        new_ts, new_path_map, doc_count = self._pending_swap
        self._pending_swap = None
        old_count = len(self._ts.documents) if self._ts else 0
        self._ts = new_ts
        self._path_map = new_path_map
        if doc_count != old_count:
            print(f"\n[索引已自动更新: {doc_count} 个文档]")

    def trigger_background_reindex(self, on_complete=None):
        """供 FileWatcher 调用的后台增量 reindex（使用自身的 _reindex_lock）

        Args:
            on_complete: 索引完成后的回调，签名为 (success: bool, doc_count: int, failed_count: int) -> None
        """
        logger.debug("trigger_background_reindex called")
        def _bg_work():
            try:
                print(f"[DEBUG] _bg_work started, search_path={self.search_path}", flush=True)
                logger.debug("_bg_work started")
                with self._reindex_lock:
                    logger.debug("_bg_work got lock")
                    # 创建临时 TreeSearch 实例完成索引构建
                    from treesearch import TreeSearch, set_config, TreeSearchConfig
                    import time as time_module

                    abs_path = os.path.abspath(self.index_path)
                    set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer, max_index_fail_count=self.max_index_fail_count))
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

                    def on_file_indexed(file_path: str):
                        """每索引完一个文件时调用"""
                        current_file[0] = file_path
                        indexed_count[0] += 1

                    def publish_progress():
                        """Timer 回调，发布当前索引进度"""
                        from cortex.event_bus import EventBus
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
                    print(f"[DEBUG] 开始执行 new_ts.index(), to_index 将在内部计算", flush=True)
                    failed_count = 0
                    try:
                        new_ts.index(self.search_path, progress_callback=on_file_indexed)
                        print(f"[DEBUG] new_ts.index() 执行完成", flush=True)
                    except FileNotFoundError:
                        new_ts.documents = []
                        print(f"[DEBUG] new_ts.index() 捕获 FileNotFoundError", flush=True)
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
                        print(f"[DEBUG] 索引完成，失败文件数: {failed_count}", flush=True)
                    except Exception as e:
                        print(f"[DEBUG] 获取失败文件统计失败: {e}", flush=True)
                        import traceback
                        traceback.print_exc()

                    new_ts.save_index()
                    new_path_map = {}
                    for doc in new_ts.documents:
                        if hasattr(doc, 'metadata') and doc.metadata:
                            path = doc.metadata.get('source_path', '')
                            if path:
                                new_path_map[doc.doc_id] = path
                                new_path_map[doc.doc_name] = path
                    doc_count = len(new_ts.documents)
                    self._pending_swap = (new_ts, new_path_map, doc_count)

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
        if self._ts is not None:
            return True

        # 设置 CJK 分词
        set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer, max_index_fail_count=self.max_index_fail_count))
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
                set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer, max_index_fail_count=self.max_index_fail_count))
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
            set_config(TreeSearchConfig(cjk_tokenizer=self.cjk_tokenizer, max_index_fail_count=self.max_index_fail_count))
            self._ts = TreeSearch(db_path=self.index_path)

        mode = "全量重建" if force else "增量更新"

        # 包装 index_document 方法来追踪进度
        original_index_doc = self._ts.index_document
        self._current_indexing_file = None
        self._indexed_count = 0

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
                from cortex.event_bus import EventBus
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
            self._ts.index_document = original_index_doc
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

    def search(self, query, max_results=None):
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
        )

        return result.get("flat_nodes", []), result.get("documents", [])
