"""文件监控模块 - 后台监控搜索目录变化，自动触发增量 reindex

⚠️ 双实现边界（AP-9）：本模块是 doclens 宿主特化 watcher（知道数据目录
.cortex/.doclens、影子 md、IndexManager.startup_audit_done 等宿主概念）。
引擎层另有通用 watch 实现 treesearch/watch.py（被 `treesearch watch` CLI
使用，不知道 doclens 概念，排除规则仅 DB sidecar）——两边不回合并：
treesearch 保持中性通用，doclens 承载宿主特化。

doclens 侧已修复的可靠性问题（atime 伪事件去重 / 回调异常防护 / reindex
撞锁补账 / on_moved 基线 / 防抖锁 / 大小写排除 / 启动基线跳过）treesearch
侧未同步——详见 antipatterns/file-watcher.md。
"""

import os
import time
import threading
import logging
from typing import ClassVar

logger = logging.getLogger(__name__)

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    _HAS_WATCHDOG = True
except ImportError:
    _HAS_WATCHDOG = False

from doclens.index_manager import SUPPORTED_FORMATS
from doclens.config import data_dirname
from treesearch.pathutil import is_gitignored


if _HAS_WATCHDOG:

    class _ChangeHandler(FileSystemEventHandler):
        """watchdog 事件处理器：丢弃索引范围外的文件事件（handler 层统一排除）。

        排除口径与索引器一致：数据目录（.cortex / .doclens）+ planify 运行时
    目录（.planify，llm_trace/tasks/team 等每次 LLM 调用都写——2026-10-27
    事故：llm_trace/*.md 触发 watcher 空跑 reindex 数十次，与 search_kb
    争 SQLite 锁把单次检索从 ~3s 拉到 15s+）子树、不支持扩展名、索引器
    生成的影子 Markdown（._*.md）、索引根 .gitignore 命中文件。递归 vs 监控树级排除的取舍见 FileWatcher.start()；
        watchdog 自身 per-event debug 由 logging 压制（自反馈风暴史）。

        on_modified 会做去重：watchdog 在 Windows 上对纯读访问也会报
        modified（典型为 atime 更新被 ReadDirectoryChangesW 当作修改），
        仅靠 mtime/size 对比即可过滤这种伪修改，避免 watch-badge 闪动。
        """

        def __init__(self, callback, search_path: str, init_baseline: bool = True):
            super().__init__()
            self._callback = callback
            # data_dirname() 每次调用做文件系统 resolve（~0.2ms，事件热路径
            # 上 × 每目录/每事件）——按字段缓存一次
            # .lower()：_should_handle 的排除检查把路径段统一转小写对比，
            # 配置值不 lower 时用户设 CORTEX_DATA_DIRNAME=MyData（首字母
            # 大写是最自然写法）会让排除静默失效——数据目录内容流入索引
            self._data_dir = data_dirname().lower()
            # 排除目录集合：数据目录 + planify 运行时目录。planify 每次 LLM
            # 调用写 .planify/llm_trace/*.md，若在知识库内会触发 watcher
            # 防抖 → 空跑 reindex → 与 search_kb 争 SQLite 锁（2026-10-27）。
            # planify 是框架固定目录名，任何形态下都不是知识库内容。
            self._excluded_dirs = {self._data_dir, ".planify"}
            self._extensions = set(SUPPORTED_FORMATS.keys())
            # .gitignore 过滤（与索引器同一规则源：索引根的 .gitignore，
            # treesearch.pathutil.load_gitignore_spec 公共化接口）。启动时
            # 快照——运行中编辑 .gitignore 重启生效。pathspec 未安装时降级
            # 为不过滤（与索引器 respect_gitignore 的可选依赖行为一致）。
            try:
                from treesearch.pathutil import load_gitignore_spec
                self._gitignore_spec, self._gitignore_base = load_gitignore_spec(search_path)
            except ImportError:
                self._gitignore_spec, self._gitignore_base = None, search_path
            # 误报去重快照：normcase 路径 → (mtime_ns, size)。
            # 启动时用各文件当前 mtime/size 建立基线（_init_baseline），使后续
            # on_modified 能用 prev==cur 去重 Windows 读访问触发的伪事件（仅 atime
            # 变、mtime/size 不变），同时保留对真修改的捕获——不丢事件。
            self._mod_snapshot: dict[str, tuple[int, int]] = {}
            if init_baseline:
                self._init_baseline(search_path)

        def _should_handle(self, path: str) -> bool:
            # 廉价且选择性最高的检查先行：扩展名白名单（.tmp/.log/二进制
            # 事件在此即死，不付后续路径处理）
            _, ext = os.path.splitext(path)
            if ext.lower() not in self._extensions:
                return False
            # 排除目录任意路径段命中即排除（数据目录 + .planify）
            if self._excluded_dirs & {
                p.lower() for p in os.path.normpath(path).split(os.sep)
            }:
                return False
            # 索引器生成的影子 Markdown（._x.md）——索引链路自身跳过
            # （pathutil walk 同规则），其事件同样丢弃
            basename = os.path.basename(path)
            if basename.startswith("._") and basename.endswith(".md"):
                return False
            # .gitignore（与索引器同一谓词，treesearch.pathutil.is_gitignored）
            if is_gitignored(self._gitignore_spec, self._gitignore_base, path):
                return False
            return True

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
            跳过排除目录（原地剪枝，walk 不下钻其子树——含 .planify，
            否则启动基线对每次 LLM trace 文件都 stat 一遍）；逐文件复用
            _should_handle 谓词（与事件过滤同一口径，不手抄第二份）；
            仅 stat 不读内容，开销很小。
            """
            for root, dirnames, files in os.walk(search_path):
                dirnames[:] = [
                    d for d in dirnames if d.lower() not in self._excluded_dirs
                ]
                for name in files:
                    path = os.path.join(root, name)
                    if self._should_handle(path):
                        self._record_baseline(path)

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
            except OSError as e:
                logger.debug("FileWatcher stat failed: %s (%s)", path, e)
                return False
            key = self._snapshot_key(path)
            cur = (st.st_mtime_ns, st.st_size)
            prev = self._mod_snapshot.get(key)
            if prev is None:
                # 竞态兜底：基线未覆盖（启动后新增文件 on_created 之前先到 on_modified），
                # 只记基线不触发，避免读访问的伪 on_modified 误触发 reindex
                logger.debug(
                    "FileWatcher BASELINE %s mtime_ns=%d size=%d "
                    "ctime_ns=%d atime_ns=%d",
                    path, cur[0], cur[1], st.st_ctime_ns, st.st_atime_ns,
                )
                self._mod_snapshot[key] = cur
                return False
            if prev == cur:
                # mtime/size 都未变 → atime-only 误报
                logger.debug(
                    "FileWatcher DEDUP %s mtime_ns=%d size=%d "
                    "ctime_ns=%d atime_ns=%d unchanged",
                    path, cur[0], cur[1], st.st_ctime_ns, st.st_atime_ns,
                )
                return False
            # mtime/size 真变 → 真修改，更新快照并触发
            logger.debug(
                "FileWatcher MOD %s prev=%s cur=%s ctime_ns=%d atime_ns=%d",
                path, prev, cur, st.st_ctime_ns, st.st_atime_ns,
            )
            self._mod_snapshot[key] = cur
            return True

        def on_modified(self, event):
            if event.is_directory or not self._should_handle(event.src_path):
                return
            if self._is_real_modification(event.src_path):
                self._invoke_callback(event.src_path)

        def on_created(self, event):
            if not event.is_directory and self._should_handle(event.src_path):
                # 新文件入快照，避免后续读访问的 on_modified 因 prev=None 被误判
                self._record_baseline(event.src_path)
                self._invoke_callback(event.src_path)

        def on_deleted(self, event):
            if not event.is_directory and self._should_handle(event.src_path):
                # 文件已删，清理快照避免下次 on_modified 误命中旧快照
                self._mod_snapshot.pop(self._snapshot_key(event.src_path), None)
                self._invoke_callback(event.src_path)

        def _invoke_callback(self, path: str) -> None:
            """事件回调的统一防护：handler 链任何异常不外溢。

            watchdog 的 EventDispatcher.run() 只捕获 queue.Empty——handler 抛出
            的任何其他异常都会终结唯一的派发线程，导致 watch 静默停摆（observer
            本体仍活着，status() 仍报 running=true，但事件再无人派发）。
            在此兜底：异常落日志，派发线程继续处理后续事件。
            """
            try:
                self._callback(path)
            except Exception:
                logger.exception("FileWatcher 回调异常（已吞没以保住派发线程）: %s", path)

        def on_moved(self, event):
            if not event.is_directory:
                if self._should_handle(event.src_path):
                    self._mod_snapshot.pop(self._snapshot_key(event.src_path), None)
                    self._invoke_callback(event.src_path)
                if self._should_handle(event.dest_path):
                    # dest 必须登记基线（对照 on_created）：否则紧随其后的首个
                    # on_modified 会因 prev is None 进入兜底分支被当伪事件吞掉。
                    # VSCode/JetBrains 原子保存 = 写临时文件 + rename 覆盖，
                    # 每次保存都走此路径——不登记基线则原子保存后第一次真实
                    # 修改（追加写 / 脚本 touch）必然丢失
                    self._record_baseline(event.dest_path)
                    self._invoke_callback(event.dest_path)


class FileWatcher:
    """后台文件监控器，检测变化后自动 reindex。

    内部维护可观测状态（status()），与外部回调（on_change_callback /
    on_reindex_start / on_reindex_done）是两条独立路径：调用方可不传任何
    回调，仅靠 status() 观测。
    """

    # status() 返回字典的默认值契约（watcher 未启动时由调用方引用）。
    # 单一真源：本字段 + status() 返回处相邻，加/删字段时两边同步即可；
    # 调用方（web_v2/api/status.py 等）不得手抄字面量兜底——引用本常量。
    DEFAULT_STATUS: ClassVar[dict] = {
        "running": False,
        "reindexing": False,
        "changed_count": 0,
        "last_reindex_at": None,
        "last_doc_count": None,
        "last_success": None,
    }

    def __init__(self, idx_manager, debounce_seconds: float | None = None,
                 on_change_callback=None, on_reindex_start=None, on_reindex_done=None):
        self._idx = idx_manager
        # debounce 默认 None → 回退到 CortexConfig().watch_debounce（单一真源），
        # 避免签名默认手抄字面量与 config.py 漂移（AP-8 子项②）
        if debounce_seconds is None:
            from doclens.config import CortexConfig
            debounce_seconds = CortexConfig().watch_debounce
        self._debounce = debounce_seconds
        self._timer = None
        self._observer = None
        self._on_change_callback = on_change_callback
        self._on_reindex_start = on_reindex_start
        self._on_reindex_done = on_reindex_done
        self._reindexing = False
        # reindex 进行中撞锁的事件记 pending，完成回调清位后重挂防抖补一轮
        self._pending_rerun = False
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
            logger.warning("文件监控不可用: pip install watchdog")
            return False

        # 启动审计已完成（load_or_build_index 的 has_changed_files 刚做完
        # 全语料 stat 审计）时跳过 _init_baseline——同一时点重复 stat 遍历
        # 在百万语料上是秒级浪费（AP-8 子项④）
        skip_baseline = getattr(self._idx, "startup_audit_done", False)
        handler = _ChangeHandler(self._on_change, self._idx.search_path,
                                 init_baseline=not skip_baseline)
        self._observer = Observer()
        # 递归 schedule：单 emitter 线程聚合整树（两平台统一）。数据目录
        # 排除在 handler 层（_should_handle）——监控树级排除需自管非递归
        # watch 树，但 watchdog 每次 schedule 建一个 emitter 线程，大语料
        # 下线程/fd 膨胀，得不偿失
        self._observer.schedule(handler, self._idx.search_path, recursive=True)
        self._observer.daemon = True
        self._observer.start()
        with self._state_lock:
            self._running = True
        # 启动增量扫描：watchdog 是事件驱动，无法捕获应用关闭期间的文件变化。
        # 启动时主动触发一次增量 reindex（fingerprint 默认 stat 模式，只比对
        # mtime/size 不读内容），补上离线期间新增/修改/删除的文件。防抖后执行，
        # 与文件变化事件共用 _do_reindex（无变化时 build_index 增量快速返回）。
        # 本进程已完成启动审计（load_or_build_index 的 has_changed_files 本就
        # 补离线变化）时跳过——重复扫描在百万语料上多耗一轮分钟级审计。
        if skip_baseline:
            logger.info("文件监控：启动审计已完成，跳过启动增量扫描 + 基线遍历")
            return True
        self._reset_debounce_timer()
        return True

    def stop(self):
        """停止文件监控"""
        # _timer 读改写与 _reset_debounce_timer 同锁，避免「stop 清 None 后
        # 新 Timer 又被创建」的竞态（停止后仍拉起一轮 reindex）
        with self._state_lock:
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
        """手动 reindex 协调口（CLI cmd_index / TUI /index 在用）。

        手动索引命令执行期间置 True 防止 watch 自动 reindex 并发触发，
        完成（含异常）后 finally 复位。语义 = 「外部正在占锁跑 reindex」。
        """
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

    def _reset_debounce_timer(self):
        """重置防抖定时器（启动扫描与每事件共用同一形状）。

        _timer 读改写必须持锁：调用方跨三线程（observer 派发线程的
        _on_change、启动线程的 start、停止线程的 stop），无锁时存在「stop
        清 None 后新 Timer 仍被创建并 start」「双线程同时通过 if 检查各建
        一个 Timer 互相覆盖泄漏一个仍在计时」两类竞态。
        """
        with self._state_lock:
            if self._timer:
                self._timer.cancel()
            timer = threading.Timer(self._debounce, self._do_reindex)
            timer.daemon = True
            self._timer = timer
            timer.start()

    def _on_change(self, file_path: str):
        """收到文件变化事件，累加计数 + 重置防抖定时器"""
        logger.debug("FileWatcher _on_change: %s", file_path)
        with self._state_lock:
            self._changed_count += 1
        self._reset_debounce_timer()
        if self._on_change_callback:
            logger.debug("FileWatcher calling callback for: %s", file_path)
            self._on_change_callback(file_path)

    def _do_reindex(self):
        """后台线程执行 reindex（reindexing 在完成回调中清零）。

        补账语义：reindex 进行中又有事件触发防抖到期时，不在此处早退丢弃——
        记 _pending_rerun=True，由 _on_reindex_complete 在清位后重挂防抖补
        一轮，避免「长 reindex + 持续编辑」下变化被静默吞掉且不可自愈。
        """
        logger.debug("_do_reindex called")
        with self._state_lock:
            if self._reindexing:
                logger.debug("_do_reindex: already reindexing, mark pending rerun")
                self._pending_rerun = True
                return
            self._reindexing = True
            self._changed_count = 0
        try:
            # _on_reindex_start 必须在 try 内：其抛异常时 except 分支会复位
            # _reindexing；在 try 外则 finally 永远走不到，_reindexing 永卡
            # True，后续所有 _do_reindex 都被幽灵锁早退，watch 瘫痪直至重启
            if self._on_reindex_start:
                self._on_reindex_start()
            self._idx.trigger_background_reindex(on_complete=self._on_reindex_complete)
            logger.info("后台 reindex 已触发")
        except Exception as e:
            logger.warning("后台 reindex 失败: %s", e)
            with self._state_lock:
                self._reindexing = False
                self._last_success = False
                self._last_reindex_at = time.time()

    def _on_reindex_complete(self, success: bool, doc_count: int, failed_count: int, indexed_files: int = 0):
        """trigger_background_reindex 完成回调：更新状态后转发给外部 on_reindex_done。

        若 reindex 期间有新事件撞锁（_pending_rerun），清位后重挂防抖补一轮——
        否则撞锁期间的变化被静默吞掉，索引持续滞后且无新事件则永不补。
        """
        with self._state_lock:
            self._reindexing = False
            self._changed_count = 0
            self._last_reindex_at = time.time()
            self._last_doc_count = doc_count
            self._last_success = success
            rerun = self._pending_rerun
            self._pending_rerun = False
        if self._on_reindex_done:
            self._on_reindex_done(success, doc_count, failed_count, indexed_files)
        if rerun:
            logger.info("FileWatcher 补跑：reindex 期间有新变化，重挂防抖")
            self._reset_debounce_timer()
