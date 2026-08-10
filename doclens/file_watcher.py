"""文件监控模块 - 后台监控搜索目录变化，自动触发增量 reindex"""

import os
import time
import threading
import logging

logger = logging.getLogger(__name__)

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    _HAS_WATCHDOG = True
except ImportError:
    _HAS_WATCHDOG = False

from doclens.index_manager import SUPPORTED_FORMATS
from doclens.config import data_dirname


if _HAS_WATCHDOG:

    class _ChangeHandler(FileSystemEventHandler):
        """watchdog 事件处理器，过滤支持的文件扩展名。

        on_modified 会做去重：watchdog 在 Windows 上对纯读访问也会报
        modified（典型为 atime 更新被 ReadDirectoryChangesW 当作修改），
        仅靠 mtime/size 对比即可过滤这种伪修改，避免 watch-badge 闪动。
        """

        def __init__(self, callback, search_path: str):
            super().__init__()
            self._callback = callback
            self._search_path = os.path.normpath(search_path).lower()
            self._extensions = set(SUPPORTED_FORMATS.keys())
            # 误报去重快照：normcase 路径 → (mtime_ns, size)。
            # 启动时用各文件当前 mtime/size 建立基线（_init_baseline），使后续
            # on_modified 能用 prev==cur 去重 Windows 读访问触发的伪事件（仅 atime
            # 变、mtime/size 不变），同时保留对真修改的捕获——不丢事件。
            self._mod_snapshot: dict[str, tuple[int, int]] = {}
            self._init_baseline(search_path)

        def _should_handle(self, path: str) -> bool:
            norm = os.path.normpath(path)
            parts = norm.split(os.sep)
            if data_dirname() in (p.lower() for p in parts):
                return False
            _, ext = os.path.splitext(path)
            return ext.lower() in self._extensions

        @staticmethod
        def _snapshot_key(path: str) -> str:
            return os.path.normcase(os.path.normpath(path))

        def _record_baseline(self, path: str) -> None:
            """stat 单个文件，记录 (mtime_ns, size) 基线快照（已存在则覆盖）。"""
            try:
                st = os.stat(path)
            except OSError:
                return
            self._mod_snapshot[self._snapshot_key(path)] = (st.st_mtime_ns, st.st_size)

        def _init_baseline(self, search_path: str) -> None:
            """启动时遍历 search_path，对所有支持文件 stat 建立基线快照。

            目的：让 on_modified 的去重（prev==cur）从 watcher 启动一开始就生效——
            Windows 读访问会触发伪 on_modified（仅 atime 变），有了基线即可直接过滤，
            不必等到文件"首次出现"才被动建档（那会吞掉启动后的首次真修改）。
            跳过数据目录（.cortex / .doclens）；仅 stat 不读内容，开销很小。
            """
            for root, _dirs, files in os.walk(search_path):
                if data_dirname() in (
                    p.lower() for p in os.path.normpath(root).split(os.sep)
                ):
                    continue
                for name in files:
                    _, ext = os.path.splitext(name)
                    if ext.lower() not in self._extensions:
                        continue
                    self._record_baseline(os.path.join(root, name))

        def _is_real_modification(self, path: str) -> bool:
            """stat 当前文件，与上次快照对比，过滤读访问触发的伪 on_modified。

            Windows 上读取文件会更新 atime，ReadDirectoryChangesW 会把它当成
            modified 报给 watchdog——表现为 mtime/size 不变但事件源源不断。
            用 (mtime_ns, size) 快照去重：

            - prev is None（竞态：on_created 未到先 on_modified，启动基线未覆盖）：
              建立基线快照，不触发。正常情况下 _init_baseline / on_created 已建档，
              此分支仅兜底，避免漏网的首次伪报误触发 reindex。
            - prev == cur（mtime/size 未变）：atime-only 误报，忽略。
            - 否则（mtime/size 真变）：真修改，更新快照并触发。

            文件刚被删（stat 失败）返回 False，依赖后续 on_deleted 单独处理。
            """
            try:
                st = os.stat(path)
            except OSError:
                return False
            key = self._snapshot_key(path)
            cur = (st.st_mtime_ns, st.st_size)
            prev = self._mod_snapshot.get(key)
            if prev is None:
                # 竞态兜底：基线未覆盖（启动后新增文件 on_created 之前先到 on_modified），
                # 只记基线不触发，避免读访问的伪 on_modified 误触发 reindex
                logger.debug(
                    "FileWatcher BASELINE %s mtime_ns=%d size=%d",
                    path, cur[0], cur[1],
                )
                self._mod_snapshot[key] = cur
                return False
            if prev == cur:
                # mtime/size 都未变 → atime-only 误报
                logger.debug(
                    "FileWatcher DEDUP %s mtime_ns=%d size=%d unchanged",
                    path, cur[0], cur[1],
                )
                return False
            # mtime/size 真变 → 真修改，更新快照并触发
            logger.debug(
                "FileWatcher MOD %s prev=%s cur=%s",
                path, prev, cur,
            )
            self._mod_snapshot[key] = cur
            return True

        def on_modified(self, event):
            if event.is_directory or not self._should_handle(event.src_path):
                return
            # 诊断：on_modified 入口打印原始事件 + stat 全字段
            try:
                st = os.stat(event.src_path)
                logger.debug(
                    "FileWatcher on_modified %s "
                    "mtime_ns=%d size=%d ctime_ns=%d atime_ns=%d",
                    event.src_path,
                    st.st_mtime_ns, st.st_size, st.st_ctime_ns, st.st_atime_ns,
                )
            except OSError as e:
                logger.debug("FileWatcher on_modified stat failed: %s (%s)", event.src_path, e)
            if self._is_real_modification(event.src_path):
                self._callback(event.src_path)

        def on_created(self, event):
            if not event.is_directory and self._should_handle(event.src_path):
                # 新文件入快照，避免后续读访问的 on_modified 因 prev=None 被误判
                self._record_baseline(event.src_path)
                self._callback(event.src_path)

        def on_deleted(self, event):
            if not event.is_directory and self._should_handle(event.src_path):
                # 文件已删，清理快照避免下次 on_modified 误命中旧快照
                self._mod_snapshot.pop(self._snapshot_key(event.src_path), None)
                self._callback(event.src_path)

        def on_moved(self, event):
            if not event.is_directory:
                if self._should_handle(event.src_path):
                    self._mod_snapshot.pop(self._snapshot_key(event.src_path), None)
                    self._callback(event.src_path)
                if self._should_handle(event.dest_path):
                    self._mod_snapshot.pop(self._snapshot_key(event.dest_path), None)
                    self._callback(event.dest_path)


class FileWatcher:
    """后台文件监控器，检测变化后自动 reindex。

    内部维护可观测状态（status()），与外部回调（on_change_callback /
    on_reindex_start / on_reindex_done）是两条独立路径：调用方可不传任何
    回调，仅靠 status() 观测。
    """

    def __init__(self, idx_manager, debounce_seconds: float = 5.0,
                 on_change_callback=None, on_reindex_start=None, on_reindex_done=None):
        self._idx = idx_manager
        self._debounce = debounce_seconds
        self._timer = None
        self._observer = None
        self._on_change_callback = on_change_callback
        self._on_reindex_start = on_reindex_start
        self._on_reindex_done = on_reindex_done
        self._reindexing = False
        # 可观测状态（受 _state_lock 保护：Observer/reindex 线程写，API 线程读）
        self._state_lock = threading.Lock()
        self._running = False
        self._changed_count = 0
        self._last_reindex_at = None
        self._last_doc_count = None
        self._last_success = None

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
        with self._state_lock:
            self._running = True
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
        with self._state_lock:
            self._running = False

    @property
    def reindexing(self):
        with self._state_lock:
            return self._reindexing

    @reindexing.setter
    def reindexing(self, value):
        with self._state_lock:
            self._reindexing = value

    def status(self) -> dict:
        """返回 watcher 状态快照（线程安全）。"""
        with self._state_lock:
            return {
                "running": self._running,
                "reindexing": self._reindexing,
                "changed_count": self._changed_count,
                "last_reindex_at": self._last_reindex_at,
                "last_doc_count": self._last_doc_count,
                "last_success": self._last_success,
            }

    def _on_change(self, file_path: str):
        """收到文件变化事件，累加计数 + 重置防抖定时器"""
        logger.debug("FileWatcher _on_change: %s", file_path)
        with self._state_lock:
            self._changed_count += 1
        if self._timer:
            self._timer.cancel()
        self._timer = threading.Timer(self._debounce, self._do_reindex)
        self._timer.daemon = True
        self._timer.start()
        if self._on_change_callback:
            logger.debug("FileWatcher calling callback for: %s", file_path)
            self._on_change_callback(file_path)

    def _do_reindex(self):
        """后台线程执行 reindex（reindexing 在完成回调中清零）"""
        logger.debug("_do_reindex called")
        with self._state_lock:
            if self._reindexing:
                logger.debug("_do_reindex: already reindexing, returning")
                return
            self._reindexing = True
            self._changed_count = 0
        if self._on_reindex_start:
            self._on_reindex_start()
        try:
            self._idx.trigger_background_reindex(on_complete=self._on_reindex_complete)
            logger.info("后台 reindex 已触发")
        except Exception as e:
            logger.warning("后台 reindex 失败: %s", e)
            with self._state_lock:
                self._reindexing = False
                self._last_success = False
                self._last_reindex_at = time.time()

    def _on_reindex_complete(self, success: bool, doc_count: int, failed_count: int):
        """trigger_background_reindex 完成回调：更新状态后转发给外部 on_reindex_done"""
        with self._state_lock:
            self._reindexing = False
            self._changed_count = 0
            self._last_reindex_at = time.time()
            self._last_doc_count = doc_count
            self._last_success = success
        if self._on_reindex_done:
            self._on_reindex_done(success, doc_count, failed_count)
