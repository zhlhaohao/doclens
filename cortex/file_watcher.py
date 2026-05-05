"""文件监控模块 - 后台监控搜索目录变化，自动触发增量 reindex"""

import os
import threading
import logging

logger = logging.getLogger(__name__)

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler, FileModifiedEvent, FileCreatedEvent, FileDeletedEvent, FileMovedEvent
    _HAS_WATCHDOG = True
except ImportError:
    _HAS_WATCHDOG = False

from cortex.index_manager import SUPPORTED_FORMATS


def _build_path_map(ts) -> dict:
    """从 TreeSearch 实例构建路径映射"""
    path_map = {}
    for doc in ts.documents:
        if hasattr(doc, 'metadata') and doc.metadata:
            path = doc.metadata.get('source_path', '')
            if path:
                path_map[doc.doc_id] = path
                path_map[doc.doc_name] = path
    return path_map


class _ChangeHandler(FileSystemEventHandler):
    """watchdog 事件处理器，过滤支持的文件扩展名"""

    def __init__(self, callback, search_path: str):
        super().__init__()
        self._callback = callback
        self._search_path = os.path.normpath(search_path).lower()
        # 预计算支持的扩展名集合（小写）
        self._extensions = set(SUPPORTED_FORMATS.keys())

    def _should_handle(self, path: str) -> bool:
        """判断是否需要处理该路径的变化"""
        norm = os.path.normpath(path)
        # 忽略 .cortex 目录
        parts = norm.split(os.sep)
        if '.cortex' in (p.lower() for p in parts):
            return False
        # 只处理支持的扩展名
        _, ext = os.path.splitext(path)
        return ext.lower() in self._extensions

    def on_modified(self, event):
        if not event.is_directory and self._should_handle(event.src_path):
            self._callback(event.src_path)

    def on_created(self, event):
        if not event.is_directory and self._should_handle(event.src_path):
            self._callback(event.src_path)

    def on_deleted(self, event):
        if not event.is_directory and self._should_handle(event.src_path):
            self._callback(event.src_path)

    def on_moved(self, event):
        if not event.is_directory:
            if self._should_handle(event.src_path):
                self._callback(event.src_path)
            if self._should_handle(event.dest_path):
                self._callback(event.dest_path)


class FileWatcher:
    """后台文件监控器，检测变化后自动 reindex"""

    def __init__(self, idx_manager, debounce_seconds: float = 5.0):
        self._idx = idx_manager
        self._debounce = debounce_seconds
        self._timer = None
        self._observer = None
        self._reindexing = False

    def start(self):
        """启动文件监控"""
        if not _HAS_WATCHDOG:
            print("[文件监控不可用: pip install watchdog]")
            return False

        handler = _ChangeHandler(self._on_change, self._idx.search_path)
        self._observer = Observer()
        self._observer.schedule(handler, self._idx.search_path, recursive=True)
        self._observer.daemon = True
        self._observer.start()
        return True

    def stop(self):
        """停止文件监控"""
        if self._timer:
            self._timer.cancel()
            self._timer = None
        if self._observer:
            self._observer.stop()
            self._observer.join(timeout=2)
            self._observer = None

    @property
    def reindexing(self):
        return self._reindexing

    @reindexing.setter
    def reindexing(self, value):
        self._reindexing = value

    def _on_change(self, file_path: str):
        """收到文件变化事件，重置防抖定时器"""
        if self._timer:
            self._timer.cancel()
        self._timer = threading.Timer(self._debounce, self._do_reindex)
        self._timer.daemon = True
        self._timer.start()

    def _do_reindex(self):
        """后台线程执行 reindex，完成后设置 pending swap"""
        if self._reindexing:
            return
        self._reindexing = True
        try:
            from treesearch import TreeSearch, set_config, TreeSearchConfig
            import os
            set_config(TreeSearchConfig(cjk_tokenizer=self._idx.cjk_tokenizer))
            new_ts = TreeSearch(db_path=self._idx.index_path)
            # 先加载已有索引，以便增量模式能识别并清理已删除的文件
            abs_path = os.path.abspath(self._idx.index_path)
            if os.path.exists(abs_path):
                try:
                    docs = new_ts.load_index(abs_path)
                    if docs:
                        new_ts.documents = docs
                except Exception:
                    pass
            new_ts.index(self._idx.search_path)
            new_ts.save_index()
            new_path_map = _build_path_map(new_ts)
            self._idx._pending_swap = (new_ts, new_path_map, len(new_ts.documents))
            logger.info("后台 reindex 完成: %d 个文档", len(new_ts.documents))
        except Exception as e:
            logger.warning("后台 reindex 失败: %s", e)
        finally:
            self._reindexing = False
