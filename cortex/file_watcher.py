"""文件监控模块 - 后台监控搜索目录变化，自动触发增量 reindex"""

import os
import threading
import logging

logger = logging.getLogger(__name__)

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    _HAS_WATCHDOG = True
except ImportError:
    _HAS_WATCHDOG = False

from cortex.index_manager import SUPPORTED_FORMATS


if _HAS_WATCHDOG:

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

    def __init__(self, idx_manager, debounce_seconds: float = 5.0, on_change_callback=None, on_reindex_start=None):
        self._idx = idx_manager
        self._debounce = debounce_seconds
        self._timer = None
        self._observer = None
        self._reindexing = False
        self._on_change_callback = on_change_callback
        self._on_reindex_start = on_reindex_start

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
        logger.debug("FileWatcher _on_change: %s", file_path)
        if self._timer:
            self._timer.cancel()
        self._timer = threading.Timer(self._debounce, self._do_reindex)
        self._timer.daemon = True
        self._timer.start()

        # 发布文件变化事件
        if self._on_change_callback:
            logger.debug("FileWatcher calling callback for: %s", file_path)
            self._on_change_callback(file_path)

    def _do_reindex(self):
        """后台线程执行 reindex，完成后设置 pending swap"""
        logger.debug("_do_reindex called")
        if self._reindexing:
            logger.debug("_do_reindex: already reindexing, returning")
            return
        self._reindexing = True
        # 通知调用方开始 reindex（用于清零文件变化计数）
        if self._on_reindex_start:
            self._on_reindex_start()
        try:
            self._idx.trigger_background_reindex()
            logger.info("后台 reindex 已触发")
        except Exception as e:
            logger.warning("后台 reindex 失败: %s", e)
        finally:
            self._reindexing = False
