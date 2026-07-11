# Web v2 文件监控 (watchdog) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 doclens Web UI（`doclens/web_v2`）补上 watchdog 文件监控，使外部文件变化自动触发增量 reindex，并通过轻量轮询在顶栏展示监控状态。

**Architecture:** 复用 `doclens/file_watcher.py` 的 `FileWatcher`（扩展可观测状态），FastAPI lifespan 驱动启停（委托给 `deps.start_watcher()/stop_watcher()` 便于测试），新增零开销 `GET /api/watch/status` 供前端 5s 轮询，`app-bar` 常驻角标 + 内嵌 toast-stack 反馈。

**Tech Stack:** Python 3 / FastAPI / pytest / httpx（后端）；TypeScript / Lit / vitest / @open-wc/testing（前端）。

## Global Constraints

- Python：PEP 8 + 类型注解；不可变更新；文件 <800 行；用 `logging` 不用 `print`（`file_watcher.py` 现有 `print` 保留不新增）。
- TypeScript：spread 不可变更新；禁止 `console.log`；`disconnectedCallback` 必须清理定时器/监听。
- 测试：后端 `pytest`（`tests/web_v2/`，已有 `temp_workdir` + `env_cortex_config` fixtures，索引初始化须在 `asyncio.to_thread` 子线程）；前端 `vitest` + `@open-wc/testing`（`frontend/tests/`）。
- **项目无 FastAPI lifespan 先例**：测试用 `ASGITransport` 不触发 lifespan，因此启停逻辑必须放在可独立调用的 `deps.start_watcher()/stop_watcher()` 中，lifespan 仅委托调用。
- `trigger_background_reindex(on_complete)` 的 `on_complete` **保证被调用**（`index_manager.py:337/341`，成功/异常两条路径），故 `reindexing` 在完成回调清零。
- 配置复用 `CORTEX_WATCH_ENABLED`（默认 true）/ `CORTEX_WATCH_DEBOUNCE`（默认 5.0），无新配置。
- 改前端代码后必须 `npm run build`（CLAUDE.md 要求，产物 `doclens/web_v2/static/`）。
- Commit message：中文 `<type>: <desc>`，**禁止** `Co-Authored-By`（用户 git 规则）。

## File Structure

**后端**
- `doclens/file_watcher.py`（改）：扩展可观测状态 + `status()`，加 `_state_lock`。
- `doclens/web_v2/deps.py`（改）：`_watcher` 单例 + `get_watcher/set_watcher/start_watcher/stop_watcher`，`reset_singletons` 联动。
- `doclens/web_v2/app.py`（改）：FastAPI `lifespan`（委托 deps），`create_app` 注入。
- `doclens/web_v2/api/status.py`（改）：响应加 `watcher` 字段。
- `doclens/web_v2/api/watch.py`（新）：`GET /api/watch/status` 轻量端点。
- `tests/doclens/test_file_watcher_status.py`（新）、`tests/web_v2/test_deps.py`（改）、`tests/web_v2/test_app_lifespan.py`（新）、`tests/web_v2/test_watch_api.py`（新）、`tests/web_v2/test_status_api.py`（改）。

**前端**
- `frontend/src/api/status.ts`（新）：`getWatchStatus()/getStatus()` + 类型。
- `frontend/src/state/types.ts`（改）：`WatcherStatus`，`AppState.watcher`。
- `frontend/src/state/store.ts`（改）：`watcher` 切片 + `setWatcherStatus` action。
- `frontend/src/watch-polling.ts`（新）：`startWatchPolling()/stopWatchPolling()`，独立可测。
- `frontend/src/app.ts`（改）：connected/disconnected 接线轮询。
- `frontend/src/components/app-bar.ts`（改）：常驻角标 + 内嵌 `<toast-stack>` + 监听 `cortex:watch-reindexed`。
- `frontend/tests/api-status.spec.ts`、`store-watcher.spec.ts`、`watch-polling.spec.ts`、`app-bar.spec.ts`（改）。

---

### Task 1: 扩展 FileWatcher 可观测状态

**Files:**
- Modify: `doclens/file_watcher.py`（全文重写，扩展状态）
- Test: `tests/doclens/test_file_watcher_status.py`（新建；`tests/doclens/` 目录已存在）

**Interfaces:**
- Produces: `FileWatcher.status() -> dict`（键：`running/reindexing/changed_count/last_reindex_at/last_doc_count/last_success`）。Task 2 的 `start_watcher` 依赖此方法。

- [ ] **Step 1: 写失败测试**

新建 `tests/doclens/test_file_watcher_status.py`：

```python
"""FileWatcher.status() 可观测状态测试。"""
import time

from doclens.file_watcher import FileWatcher


class FakeIdx:
    """假 IndexManager：trigger_background_reindex 同步调用 on_complete，便于测试。"""
    search_path = "/tmp/__doclens_test__"

    def __init__(self, result=(True, 5, 0)):
        self._result = result

    def trigger_background_reindex(self, on_complete=None):
        success, doc_count, failed = self._result
        if on_complete:
            on_complete(success, doc_count, failed)


def test_status_initial_values():
    w = FileWatcher(FakeIdx())
    st = w.status()
    assert st == {
        "running": False,
        "reindexing": False,
        "changed_count": 0,
        "last_reindex_at": None,
        "last_doc_count": None,
        "last_success": None,
    }
    w.stop()


def test_on_change_increments_changed_count():
    w = FileWatcher(FakeIdx())
    w._on_change("/tmp/a.md")
    w._on_change("/tmp/b.md")
    assert w.status()["changed_count"] == 2
    w.stop()


def test_do_reindex_clears_count_and_updates_last():
    w = FileWatcher(FakeIdx())
    w._on_change("/tmp/a.md")
    assert w.status()["changed_count"] == 1
    before = time.time()
    w._do_reindex()  # FakeIdx 同步完成 → _on_reindex_complete 立即触发
    st = w.status()
    assert st["changed_count"] == 0
    assert st["reindexing"] is False
    assert st["last_doc_count"] == 5
    assert st["last_success"] is True
    assert st["last_reindex_at"] is not None
    assert st["last_reindex_at"] >= before
    w.stop()


def test_do_reindex_skips_when_already_reindexing():
    w = FileWatcher(FakeIdx())
    # 手动置 reindexing 模拟进行中
    w.reindexing = True
    w._do_reindex()  # 应直接 return，不更新 last_*
    assert w.status()["last_doc_count"] is None
    w.stop()


def test_do_reindex_failure_marks_last_success_false():
    w = FileWatcher(FakeIdx(result=(False, 0, 0)))
    w._do_reindex()
    st = w.status()
    assert st["last_success"] is False
    assert st["last_doc_count"] == 0
    assert st["reindexing"] is False
    w.stop()
```

- [ ] **Step 2: 运行测试验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_file_watcher_status.py -v`
Expected: FAIL（`FileWatcher` 无 `status()` 方法 → `AttributeError`）

- [ ] **Step 3: 重写 `doclens/file_watcher.py`**

```python
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


if _HAS_WATCHDOG:

    class _ChangeHandler(FileSystemEventHandler):
        """watchdog 事件处理器，过滤支持的文件扩展名"""

        def __init__(self, callback, search_path: str):
            super().__init__()
            self._callback = callback
            self._search_path = os.path.normpath(search_path).lower()
            self._extensions = set(SUPPORTED_FORMATS.keys())

        def _should_handle(self, path: str) -> bool:
            norm = os.path.normpath(path)
            parts = norm.split(os.sep)
            if '.cortex' in (p.lower() for p in parts):
                return False
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
            self._last_reindex_at = time.time()
            self._last_doc_count = doc_count
            self._last_success = success
        if self._on_reindex_done:
            self._on_reindex_done(success, doc_count, failed_count)
```

- [ ] **Step 4: 运行测试验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_file_watcher_status.py -v`
Expected: 5 passed

- [ ] **Step 5: 回归 TUI 不受影响**

Run: `.venv/Scripts/python.exe -m pytest tests/ -k "file_watcher or watch" -v`
Expected: 新测试通过，无回归报错（TUI 不传 status 相关，但 on_reindex_done 仍按原签名转发）。

- [ ] **Step 6: Commit**

```bash
git add doclens/file_watcher.py tests/doclens/test_file_watcher_status.py
git commit -m "feat(file_watcher): 新增 status() 可观测状态与线程安全字段"
```

---

### Task 2: deps.py watcher 单例 + start/stop

**Files:**
- Modify: `doclens/web_v2/deps.py`（加 `_watcher` + 4 个函数 + `reset_singletons` 联动）
- Test: `tests/web_v2/test_deps.py`（追加测试）

**Interfaces:**
- Consumes: `FileWatcher`（Task 1）、`get_config()`/`get_index_manager()`（已有）。
- Produces: `deps.get_watcher() -> FileWatcher | None`、`deps.set_watcher(w)`、`deps.start_watcher() -> bool`、`deps.stop_watcher() -> None`。Task 3 lifespan 与 Task 4/5 API 依赖这些。

- [ ] **Step 1: 追加失败测试**

在 `tests/web_v2/test_deps.py` 末尾追加：

```python
def test_watcher_singletons_and_lifecycle(env_cortex_config, reset_deps, temp_workdir):
    """start_watcher 创建并注册 watcher；stop_watcher 清理；reset 清空单例。"""
    import asyncio
    from doclens.web_v2 import deps

    async def _init():
        await asyncio.to_thread(lambda: deps.get_index_manager().reindex(force=True))
    asyncio.run(_init())

    assert deps.get_watcher() is None
    started = deps.start_watcher()
    assert started is True
    w = deps.get_watcher()
    assert w is not None
    assert w.status()["running"] is True

    deps.stop_watcher()
    assert deps.get_watcher() is None  # stop_watcher 注销单例

    # reset_singletons 也应清空 _watcher
    deps.set_watcher(object())
    deps.reset_singletons()
    assert deps.get_watcher() is None


def test_start_watcher_respects_watch_disabled(env_cortex_config, reset_deps, monkeypatch):
    """watch_enabled=False 时 start_watcher 不创建 watcher，返回 False。"""
    import asyncio
    from doclens.web_v2 import deps

    async def _init():
        await asyncio.to_thread(deps.get_index_manager)
    asyncio.run(_init())

    monkeypatch.setattr(deps.get_config(), "watch_enabled", False)
    started = deps.start_watcher()
    assert started is False
    assert deps.get_watcher() is None
```

注意：`reset_deps` fixture 尚不存在于 `test_deps.py`，但 `test_status_api.py` 已定义同名 fixture。在 `test_deps.py` 顶部加：

```python
import pytest


@pytest.fixture
def reset_deps():
    from doclens.web_v2 import deps
    deps.reset_singletons()
    yield
    deps.reset_singletons()
```

- [ ] **Step 2: 运行验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_deps.py -v`
Expected: FAIL（`get_watcher` 不存在 → `AttributeError`）

- [ ] **Step 3: 改 `doclens/web_v2/deps.py`**

在文件顶部 import 区加：

```python
from typing import Optional
```
（若已有则跳过；当前文件已 `from typing import Optional`，无需改动。）

在模块级单例区（`_agent` 之后）加：

```python
_watcher: Optional["object"] = None  # FileWatcher，懒加载避免 import 循环
```

在 `reset_singletons()` 函数体加一行清空：

```python
def reset_singletons() -> None:
    """重置单例（仅供测试使用）。"""
    global _config, _idx_manager, _sessions_store, _agent, _watcher
    # 停止可能存在的 watcher，释放 Observer 线程
    stop_watcher()
    with _lock:
        _config = None
        _idx_manager = None
        _sessions_store = None
        _agent = None
        _watcher = None
```

在文件末尾追加 4 个函数：

```python
def get_watcher():
    """获取已注册的 FileWatcher 单例（可能为 None）。"""
    return _watcher


def set_watcher(watcher) -> None:
    """注册/覆盖 watcher 单例（供 lifespan 与测试使用）。"""
    global _watcher
    with _lock:
        _watcher = watcher


def start_watcher() -> bool:
    """根据 config.watch_enabled 创建并启动 FileWatcher。

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
        watcher = FileWatcher(idx, debounce_seconds=config.watch_debounce)
        if not watcher.start():
            logger.warning("FileWatcher.start() returned False (watchdog unavailable?)")
            return False
        set_watcher(watcher)
        logger.info("FileWatcher started for %s", idx.search_path)
        return True
    except Exception as exc:  # noqa: BLE001
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
```

- [ ] **Step 4: 运行验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_deps.py -v`
Expected: 全部 passed（含原有 4 个 + 新增 2 个）

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/deps.py tests/web_v2/test_deps.py
git commit -m "feat(web_v2): deps 新增 watcher 单例与 start/stop 生命周期"
```

---

### Task 3: app.py FastAPI lifespan

**Files:**
- Modify: `doclens/web_v2/app.py`（`create_app` 注入 lifespan）
- Test: `tests/web_v2/test_app_lifespan.py`（新建）

**Interfaces:**
- Consumes: `deps.start_watcher()/stop_watcher()`（Task 2）。
- Produces: `create_app()` 返回的 `FastAPI` 带 `lifespan`（生产启动路径；启停逻辑已被 Task 2 单测覆盖）。

> 说明：项目测试用 `ASGITransport`，不触发 lifespan，故本任务只验证 `create_app()` 能构造带 lifespan 的 app 且不抛异常；真正的启停行为在 Task 2 已覆盖。

- [ ] **Step 1: 写失败测试**

新建 `tests/web_v2/test_app_lifespan.py`：

```python
"""create_app() lifespan 注入测试。"""
import pytest
from fastapi import FastAPI

from doclens.web_v2.app import create_app


def test_create_app_returns_fastapi_with_lifespan():
    app = create_app()
    assert isinstance(app, FastAPI)
    # FastAPI 把 lifespan 存到 router.lifespan_context
    assert app.router.lifespan_context is not None


def test_create_app_does_not_use_deprecated_on_event():
    """确保用新 lifespan API 而非 deprecated on_event。"""
    import inspect
    from doclens.web_v2 import app as app_module
    src = inspect.getsource(app_module)
    assert "on_event" not in src
    assert "lifespan" in src
```

- [ ] **Step 2: 运行验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_app_lifespan.py -v`
Expected: FAIL（`app.router.lifespan_context` 默认是 Starlette 的 `null_context`，断言通过？—— 实际当前 `create_app()` 未传 lifespan，`lifespan_context` 非我们注入的，第二条 `"lifespan" in src` 会 FAIL）

- [ ] **Step 3: 改 `doclens/web_v2/app.py`**

在文件 import 区加：

```python
from contextlib import asynccontextmanager
```

新增 lifespan 函数（放在 `create_app` 之前）：

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动文件监控，退出时停止。"""
    from doclens.web_v2 import deps
    deps.start_watcher()
    try:
        yield
    finally:
        deps.stop_watcher()
```

修改 `create_app()` 第一行，把 `FastAPI(title=...)` 改为传入 `lifespan`：

```python
def create_app() -> FastAPI:
    """构造 FastAPI 应用（注册路由、错误处理器、静态文件）。"""
    app = FastAPI(title="Cortex", version=CORTEX_VERSION, lifespan=lifespan)
```

- [ ] **Step 4: 运行验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_app_lifespan.py -v`
Expected: 2 passed

- [ ] **Step 5: 回归现有 status/health 测试**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_status_api.py tests/web_v2/test_app_health.py -v`
Expected: 通过（lifespan 注入不影响 ASGITransport 测试）

- [ ] **Step 6: Commit**

```bash
git add doclens/web_v2/app.py tests/web_v2/test_app_lifespan.py
git commit -m "feat(web_v2): create_app 注入 FastAPI lifespan 驱动 watcher 启停"
```

---

### Task 4: GET /api/watch/status 轻量端点

**Files:**
- Create: `doclens/web_v2/api/watch.py`
- Modify: `doclens/web_v2/app.py`（挂载 router）
- Test: `tests/web_v2/test_watch_api.py`（新建）

**Interfaces:**
- Consumes: `deps.get_watcher()`（Task 2）、`deps.get_config()`。
- Produces: `GET /api/watch/status` → `{enabled: bool, watcher: {...}|null}`。

- [ ] **Step 1: 写失败测试**

新建 `tests/web_v2/test_watch_api.py`：

```python
"""GET /api/watch/status 测试。"""
import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from doclens.web_v2 import deps
from doclens.web_v2.app import create_app


def _init():
    idx = deps.get_index_manager()
    idx.reindex(force=True)
    return idx


@pytest.mark.asyncio
async def test_watch_status_no_watcher(env_cortex_config, reset_deps, temp_workdir):
    """watcher 未启动时返回 watcher:null。"""
    await asyncio.to_thread(_init)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/watch/status")
    assert res.status_code == 200
    body = res.json()
    assert body["enabled"] is True
    assert body["watcher"] is None


@pytest.mark.asyncio
async def test_watch_status_with_watcher_running(env_cortex_config, reset_deps, temp_workdir):
    """start_watcher 后返回 watcher 快照，running=true。"""
    await asyncio.to_thread(_init)
    deps.start_watcher()
    try:
        app = create_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/watch/status")
        body = res.json()
        assert body["watcher"] is not None
        assert body["watcher"]["running"] is True
        assert "changed_count" in body["watcher"]
        assert "last_reindex_at" in body["watcher"]
    finally:
        deps.stop_watcher()
```

- [ ] **Step 2: 运行验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_watch_api.py -v`
Expected: FAIL（404，路由不存在）

- [ ] **Step 3: 新建 `doclens/web_v2/api/watch.py`**

```python
"""GET /api/watch/status -- 轻量文件监控状态（零文档遍历开销，供前端轮询）。"""
from fastapi import APIRouter

from doclens.web_v2.deps import get_config, get_watcher

router = APIRouter()


@router.get("/watch/status")
async def watch_status():
    enabled = get_config().watch_enabled
    watcher = get_watcher()
    return {
        "enabled": enabled,
        "watcher": watcher.status() if watcher is not None else None,
    }
```

- [ ] **Step 4: 在 `app.py` 挂载 router**

在 `create_app()` 路由注册区（`grep.router` 之后）加：

```python
    from doclens.web_v2.api import watch
    app.include_router(watch.router, prefix="/api")
```

- [ ] **Step 5: 运行验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_watch_api.py -v`
Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add doclens/web_v2/api/watch.py doclens/web_v2/app.py tests/web_v2/test_watch_api.py
git commit -m "feat(web_v2): 新增 GET /api/watch/status 轻量监控状态端点"
```

---

### Task 5: /api/status 响应增加 watcher 字段

**Files:**
- Modify: `doclens/web_v2/api/status.py`
- Test: `tests/web_v2/test_status_api.py`（追加）

**Interfaces:**
- Consumes: `deps.get_watcher()`/`get_config()`。
- Produces: `/api/status` 响应顶层加 `watcher: {...}|null`。

- [ ] **Step 1: 追加失败测试**

在 `tests/web_v2/test_status_api.py` 末尾追加：

```python
@pytest.mark.asyncio
async def test_status_includes_watcher_field(env_cortex_config, reset_deps, temp_workdir):
    await asyncio.to_thread(_init_and_reindex)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/status")
    body = res.json()
    assert "watcher" in body
    # 未启动 watcher 时为 None
    assert body["watcher"] is None
```

- [ ] **Step 2: 运行验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_status_api.py::test_status_includes_watcher_field -v`
Expected: FAIL（`"watcher" in body` 为 False）

- [ ] **Step 3: 改 `doclens/web_v2/api/status.py`**

把 import 与 return 改为：

```python
"""GET /api/status -- 系统状态。"""
import os

from fastapi import APIRouter, Depends

from doclens.index_manager import IndexManager
from doclens.web_v2.deps import get_config, get_index_manager, get_watcher

router = APIRouter()


@router.get("/status")
async def status(idx: IndexManager = Depends(get_index_manager)):
    docs = idx.documents or []
    total_size = 0
    type_counts: dict[str, int] = {}
    for doc in docs:
        meta = getattr(doc, "metadata", None) or {}
        src = meta.get("source_path", "")
        try:
            size = os.path.getsize(src) if src else 0
        except OSError:
            size = 0
        total_size += size
        ext = os.path.splitext(src)[1].lower() if src else ""
        if ext:
            type_counts[ext] = type_counts.get(ext, 0) + 1
    watcher_obj = get_watcher()
    return {
        "indexed_docs": len(docs),
        "index_path": str(idx.index_path),
        "total_size_bytes": total_size,
        "file_types": type_counts,
        "watcher": {
            "enabled": get_config().watch_enabled,
            **(watcher_obj.status() if watcher_obj is not None else {
                "running": False,
                "reindexing": False,
                "changed_count": 0,
                "last_reindex_at": None,
                "last_doc_count": None,
                "last_success": None,
            }),
        },
    }
```

- [ ] **Step 4: 运行验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_status_api.py -v`
Expected: 全部 passed

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/api/status.py tests/web_v2/test_status_api.py
git commit -m "feat(web_v2): /api/status 响应增加 watcher 状态字段"
```

---

### Task 6: 前端 api/status.ts + types

**Files:**
- Create: `frontend/src/api/status.ts`
- Modify: `frontend/src/state/types.ts`（加 `WatcherStatus`、`AppState.watcher`、`SystemStatus.watcher?`）
- Test: `frontend/tests/api-status.spec.ts`（新建）

**Interfaces:**
- Produces: `getWatchStatus(): Promise<WatchStatusResponse>`、`getStatus(): Promise<SystemStatus>`、`WatcherStatus` 类型。Task 7/8/9 依赖。

- [ ] **Step 1: 写失败测试**

新建 `frontend/tests/api-status.spec.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getWatchStatus, getStatus } from "../src/api/status";

describe("api/status", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getWatchStatus parses enabled + watcher snapshot", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        enabled: true,
        watcher: {
          running: true, reindexing: false, changed_count: 2,
          last_reindex_at: 1234.5, last_doc_count: 42, last_success: true,
        },
      }),
    });
    const res = await getWatchStatus();
    expect(res.enabled).toBe(true);
    expect(res.watcher?.running).toBe(true);
    expect(res.watcher?.changed_count).toBe(2);
  });

  it("getWatchStatus handles watcher:null", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, watcher: null }),
    });
    const res = await getWatchStatus();
    expect(res.watcher).toBeNull();
    expect(res.enabled).toBe(false);
  });

  it("getWatchStatus throws on non-ok", async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: false, statusText: "err" });
    await expect(getWatchStatus()).rejects.toThrow();
  });

  it("getStatus parses full status incl watcher", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        indexed_docs: 3, index_path: "/x", total_size_bytes: 10,
        file_types: { ".md": 3 },
        watcher: { enabled: true, running: false, reindexing: false,
          changed_count: 0, last_reindex_at: null, last_doc_count: null, last_success: null },
      }),
    });
    const res = await getStatus();
    expect(res.indexed_docs).toBe(3);
    expect(res.watcher?.enabled).toBe(true);
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/api-status.spec.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 改 `frontend/src/state/types.ts`**

在 `SystemStatus` 接口里加可选字段（紧接 `file_types` 之后）：

```typescript
export interface WatcherStatus {
  enabled?: boolean;            // 仅 /api/status 返回；/api/watch/status 顶层才有
  running: boolean;
  reindexing: boolean;
  changed_count: number;
  last_reindex_at: number | null;
  last_doc_count: number | null;
  last_success: boolean | null;
}

export interface SystemStatus {
  indexed_docs: number;
  index_path: string;
  total_size_bytes: number;
  file_types: Record<string, number>;
  watcher?: WatcherStatus | null;
}
```

（原 `SystemStatus` 体保留，仅在其后追加 `watcher?` 字段，并在其上方新增 `WatcherStatus`。）

在 `AppState` 接口加一个独立 watcher 切片（轮询写入，与 `status` 解耦）：

```typescript
export interface AppState {
  view: ViewId;
  search: SearchViewState;
  chat: ChatViewState;
  detailStack: SearchResult[];
  pendingSession: Session | null;
  status: SystemStatus | null;
  watcher: WatcherStatus | null;   // 来自 /api/watch/status 的轮询
  error: string | null;
  settings: SettingsViewState;
  files: FileExplorerViewState;
}
```

- [ ] **Step 4: 新建 `frontend/src/api/status.ts`**

```typescript
// Status API client for /api/status 与 /api/watch/status
import type { SystemStatus, WatcherStatus } from "../state/types";

export interface WatchStatusResponse {
  enabled: boolean;
  watcher: WatcherStatus | null;
}

export async function getWatchStatus(): Promise<WatchStatusResponse> {
  const resp = await fetch("/api/watch/status", { method: "GET" });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(`watch/status HTTP ${resp.status}`);
  }
  return body as WatchStatusResponse;
}

export async function getStatus(): Promise<SystemStatus> {
  const resp = await fetch("/api/status", { method: "GET" });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(`status HTTP ${resp.status}`);
  }
  return body as SystemStatus;
}
```

- [ ] **Step 5: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/api-status.spec.ts`
Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add doclens/web_v2/frontend/src/api/status.ts doclens/web_v2/frontend/src/state/types.ts doclens/web_v2/frontend/tests/api-status.spec.ts
git commit -m "feat(web): 新增 status API client 与 WatcherStatus 类型"
```

---

### Task 7: 前端 store watcher 切片

**Files:**
- Modify: `frontend/src/state/store.ts`（`INITIAL_STATE.watcher` + `actions.setWatcherStatus`）
- Test: `frontend/tests/store-watcher.spec.ts`（新建）

**Interfaces:**
- Consumes: `WatcherStatus`（Task 6）。
- Produces: `actions.setWatcherStatus(w: WatcherStatus | null)`、`AppState.watcher`。Task 9 轮询写入；Task 8 app-bar 订阅渲染。

- [ ] **Step 1: 写失败测试**

新建 `frontend/tests/store-watcher.spec.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import type { WatcherStatus } from "../src/state/types";

const W: WatcherStatus = {
  running: true, reindexing: false, changed_count: 0,
  last_reindex_at: null, last_doc_count: 5, last_success: true,
};

describe("watcher store slice", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE, watcher: INITIAL_STATE.watcher });
  });

  it("initial watcher is null", () => {
    expect(store.getState().watcher).toBeNull();
  });

  it("setWatcherStatus immutably updates watcher", () => {
    actions.setWatcherStatus(W);
    expect(store.getState().watcher).toEqual(W);
  });

  it("setWatcherStatus(null) clears", () => {
    actions.setWatcherStatus(W);
    actions.setWatcherStatus(null);
    expect(store.getState().watcher).toBeNull();
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/store-watcher.spec.ts`
Expected: FAIL（`INITIAL_STATE` 无 `watcher` / `setWatcherStatus` 不存在）

- [ ] **Step 3: 改 `frontend/src/state/store.ts`**

在 `INITIAL_STATE` 里 `status: null,` 之后加：

```typescript
  status: null,
  watcher: null,
  error: null,
```

在 `actions` 对象里（`setPendingSession` 之后）加：

```typescript
  setWatcherStatus(w: AppState["watcher"]) {
    store.setState({ watcher: w });
  },
```

- [ ] **Step 4: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/store-watcher.spec.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/frontend/src/state/store.ts doclens/web_v2/frontend/tests/store-watcher.spec.ts
git commit -m "feat(web): store 新增 watcher 切片与 setWatcherStatus action"
```

---

### Task 8: app-bar 常驻角标 + toast-stack

**Files:**
- Modify: `frontend/src/components/app-bar.ts`（角标 + 内嵌 `<toast-stack>` + 监听 `cortex:watch-reindexed`）
- Test: `frontend/tests/app-bar.spec.ts`（追加）

**Interfaces:**
- Consumes: `store.getState().watcher`（Task 7）、window 事件 `cortex:watch-reindexed`（Task 9 派发）。
- Produces：顶栏右侧角标 + reindex 完成 toast。

- [ ] **Step 1: 追加失败测试**

在 `frontend/tests/app-bar.spec.ts` 末尾追加：

```typescript
describe("<app-bar> watcher badge", () => {
  it("shows ○监控关 when watcher is null", async () => {
    actions.setWatcherStatus(null);
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".watch-badge")?.textContent).toContain("监控关");
  });

  it("shows ●监控 when running and idle", async () => {
    actions.setWatcherStatus({
      enabled: true, running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 123, last_doc_count: 42, last_success: true,
    });
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    await elementUpdated(el);
    const badge = el.shadowRoot?.querySelector(".watch-badge");
    expect(badge?.textContent).toContain("●");
    expect(badge?.textContent).toContain("监控");
  });

  it("shows ⟳更新中 when reindexing", async () => {
    actions.setWatcherStatus({
      enabled: true, running: true, reindexing: true, changed_count: 0,
      last_reindex_at: 123, last_doc_count: 42, last_success: true,
    });
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".watch-badge")?.textContent).toContain("更新中");
  });

  it("dispatching cortex:watch-reindexed pushes a toast", async () => {
    actions.setWatcherStatus({
      enabled: true, running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 123, last_doc_count: 42, last_success: true,
    });
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    await elementUpdated(el);
    const stack = el.shadowRoot?.querySelector("toast-stack") as any;
    const before = stack._toasts.length;
    window.dispatchEvent(new CustomEvent("cortex:watch-reindexed", { detail: { doc_count: 42 } }));
    await elementUpdated(el);
    expect(stack._toasts.length).toBe(before + 1);
    expect(stack._toasts[stack._toasts.length - 1].message).toContain("42");
  });
});
```

测试文件顶部已有的 `actions` import 足够；若未 import `elementUpdated`/`fixture`/`html`，确认已存在（第 2 行已 import）。

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/app-bar.spec.ts`
Expected: FAIL（无 `.watch-badge` 元素 / 无内嵌 `toast-stack`）

- [ ] **Step 3: 改 `frontend/src/components/app-bar.ts`**

(a) import 区加：

```typescript
import "../components/toast-stack";
import type { WatcherStatus } from "../state/types";
```

(b) 在 `static styles` 的 `.right-cluster { ... }` 之后追加角标样式：

```css
    .watch-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
      padding: 4px 10px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      border-radius: 999px;
      background: var(--cortex-surface-muted);
      white-space: nowrap;
    }
    .watch-badge.dot { color: #10b981; }
    .watch-badge.busy { color: var(--cortex-primary); }
    .watch-badge.warn { color: #d97706; }
```

(c) 加一个计算角标文案的私有方法与渲染函数（放在 `_syncFromStore` 之后、`render` 之前）：

```typescript
  private _renderWatchBadge(w: WatcherStatus | null) {
    const n = w?.last_doc_count;
    const nStr = n != null ? ` ${n}` : "";
    if (!w || !w.running) return html`<span class="watch-badge">📁${nStr} ○监控关</span>`;
    if (w.reindexing) return html`<span class="watch-badge busy">📁${nStr} ⟳更新中…</span>`;
    if (w.changed_count > 0)
      return html`<span class="watch-badge warn">📁${nStr} ·待更新 ${w.changed_count}</span>`;
    const warn = w.last_success === false;
    return html`<span class="watch-badge ${warn ? "warn" : "dot"}">📁${nStr} ●监控</span>`;
  }
```

(d) 在 `_onDocClick` 之前加 toast 事件处理：

```typescript
  private _onWatchReindexed: (e: Event) => void = (e: Event) => {
    const detail = (e as CustomEvent).detail as { doc_count?: number | null };
    const stack = this.shadowRoot?.querySelector("toast-stack") as
      (HTMLElement & { pushToast?: (m: string, l?: string, d?: number) => void }) | null;
    const n = detail?.doc_count;
    stack?.pushToast?.(n != null ? `索引已更新：${n} 文档` : "索引已更新", "success", 3000);
  };
```

(e) `connectedCallback` 末尾加监听；`disconnectedCallback` 移除：

```typescript
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._onDocClick);
    window.addEventListener("cortex:watch-reindexed", this._onWatchReindexed as EventListener);
    this._syncFromStore();
    this._unsubStore = store.subscribe(() => this._syncFromStore());
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocClick);
    window.removeEventListener("cortex:watch-reindexed", this._onWatchReindexed as EventListener);
    this._unsubStore?.();
    super.disconnectedCallback();
  }
```

(f) 在 `render()` 的 `<div class="right-cluster">` 内、`_showSaveAndRevert` 保存按钮之前插入角标 + 内嵌 toast-stack：

```typescript
      <div class="right-cluster">
        ${this._renderWatchBadge(store.getState().watcher)}
        ${this._showSaveAndRevert ? html`
          <button class="save-btn" type="button" @click=${this._onSaveClick}>💾 保存</button>
        ` : nothing}
        ...
      </div>
      <toast-stack></toast-stack>
```

（`<toast-stack></toast-stack>` 放在 `render()` 最外层 return 的末尾、`</div>` 闭合之后，确保它在 shadowRoot 内。）

- [ ] **Step 4: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/app-bar.spec.ts`
Expected: 全部 passed（原有 + 新增 4）

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/frontend/src/components/app-bar.ts doclens/web_v2/frontend/tests/app-bar.spec.ts
git commit -m "feat(web): app-bar 新增文件监控角标与 reindex toast"
```

---

### Task 9: watch-polling 模块 + app.ts 接线

**Files:**
- Create: `frontend/src/watch-polling.ts`
- Modify: `frontend/src/app.ts`（connected/disconnected 接线）
- Test: `frontend/tests/watch-polling.spec.ts`（新建）

**Interfaces:**
- Consumes: `getWatchStatus()`（Task 6）、`actions.setWatcherStatus`（Task 7）。
- Produces: `startWatchPolling()/stopWatchPolling()`；首次拉取不弹 toast，后续 `last_reindex_at` 变化时派发 `cortex:watch-reindexed`。

- [ ] **Step 1: 写失败测试**

新建 `frontend/tests/watch-polling.spec.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import { startWatchPolling, stopWatchPolling } from "../src/watch-polling";

function mockWatch(resp: any) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => resp,
  }));
}

describe("watch-polling", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE });
    vi.useFakeTimers();
  });
  afterEach(() => {
    stopWatchPolling();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("first tick writes watcher without dispatching toast event", async () => {
    mockWatch({ enabled: true, watcher: {
      running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 100, last_doc_count: 5, last_success: true } });
    const handler = vi.fn();
    window.addEventListener("cortex:watch-reindexed", handler);

    startWatchPolling();
    await vi.advanceTimersByTimeAsync(0); // 首次立即 tick

    expect(store.getState().watcher?.last_doc_count).toBe(5);
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener("cortex:watch-reindexed", handler);
  });

  it("changed last_reindex_at dispatches reindexed event", async () => {
    mockWatch({ enabled: true, watcher: {
      running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 200, last_doc_count: 6, last_success: true } });
    const handler = vi.fn();
    window.addEventListener("cortex:watch-reindexed", handler);

    startWatchPolling();
    await vi.advanceTimersByTimeAsync(0); // 首次（100→记录，不弹）
    // 切换 mock 为新 last_reindex_at
    mockWatch({ enabled: true, watcher: {
      running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 300, last_doc_count: 7, last_success: true } });
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, watcher: {
        running: true, reindexing: false, changed_count: 0,
        last_reindex_at: 300, last_doc_count: 7, last_success: true } }),
    });

    await vi.advanceTimersByTimeAsync(5000); // 第二次 tick → 弹

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail.doc_count).toBe(7);
    window.removeEventListener("cortex:watch-reindexed", handler);
  });

  it("swallows fetch errors silently", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    startWatchPolling();
    await vi.advanceTimersByTimeAsync(0);
    // 不抛错即通过；watcher 保持 null
    expect(store.getState().watcher).toBeNull();
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/watch-polling.spec.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 新建 `frontend/src/watch-polling.ts`**

```typescript
/** 轻量轮询 /api/watch/status，写入 store.watcher；reindex 完成时派发 toast 事件。 */
import { getWatchStatus } from "./api/status";
import { actions } from "./state/store";
import type { WatcherStatus } from "./state/types";

const POLL_INTERVAL_MS = 5000;

let timer: number | null = null;
let lastReindexAt: number | null | undefined = undefined; // undefined = 未初始化

async function tick(): Promise<void> {
  try {
    const resp = await getWatchStatus();
    const w: WatcherStatus | null = resp.watcher;
    const at = w?.last_reindex_at ?? null;
    // 仅在已初始化且时间戳变化时通知（避免首次拉取误弹）
    if (lastReindexAt !== undefined && at !== null && at !== lastReindexAt) {
      window.dispatchEvent(new CustomEvent("cortex:watch-reindexed", {
        detail: { doc_count: w?.last_doc_count ?? null },
      }));
    }
    lastReindexAt = at;
    actions.setWatcherStatus(w);
  } catch {
    // 轮询失败静默忽略（toast 仅用于正面通知）
  }
}

export function startWatchPolling(): void {
  if (timer !== null) return;
  lastReindexAt = undefined;
  void tick();
  timer = window.setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
}

export function stopWatchPolling(): void {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}
```

- [ ] **Step 4: 改 `frontend/src/app.ts` 接线**

import 区加：

```typescript
import { startWatchPolling, stopWatchPolling } from "./watch-polling";
```

`connectedCallback` 末尾加启动；`disconnectedCallback` 加停止：

```typescript
  connectedCallback() {
    super.connectedCallback();
    router.init();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    startWatchPolling();
  }

  disconnectedCallback() {
    this._unsubscribe?.();
    stopWatchPolling();
    super.disconnectedCallback();
  }
```

- [ ] **Step 5: 运行验证通过**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/watch-polling.spec.ts`
Expected: 3 passed

- [ ] **Step 6: 全量前端测试回归**

Run: `cd doclens/web_v2/frontend && npx vitest run`
Expected: 全部 passed（含历史测试，确认 store/types 改动无回归）

- [ ] **Step 7: Commit**

```bash
git add doclens/web_v2/frontend/src/watch-polling.ts doclens/web_v2/frontend/src/app.ts doclens/web_v2/frontend/tests/watch-polling.spec.ts
git commit -m "feat(web): 新增 watch-polling 5s 轮询并接入 cortex-app 生命周期"
```

---

### Task 10: 重建前端静态产物 + 端到端冒烟

**Files:**
- 产物：`doclens/web_v2/static/`（`npm run build` 生成，已 git 跟踪）
- 无新源码。

> CLAUDE.md 要求：改前端后必须 `npm run build` 并重启后端才生效。

- [ ] **Step 1: 构建前端**

Run:
```bash
cd doclens/web_v2/frontend && npm install && npm run build
```
Expected: `dist/` 生成，Vite 输出到 `../static/`（见 `vite.config.ts`）。

- [ ] **Step 2: 确认产物更新**

Run: `git status --short doclens/web_v2/static/`
Expected: 至少 `index.html` 与若干 `assets/*.{js,css}` 被修改/新增。

- [ ] **Step 3: 后端全量测试**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/ tests/doclens/test_file_watcher_status.py -v`
Expected: 全部 passed。

- [ ] **Step 4: 手动冒烟（可选，需用户在终端执行）**

启动 GUI：
```
! pwsh -File ./start-app.ps1 gui
```
在浏览器打开后，于 `test_work_dir/` 用编辑器改一个 `.md`，观察顶栏角标在 ~10s 内：`●监控 → ·待更新 N → ⟳更新中… → ●监控 N+1`，并出现"索引已更新"toast。

- [ ] **Step 5: 提交产物**

```bash
git add doclens/web_v2/static
git commit -m "chore(web): 重建前端静态产物（web_v2 文件监控角标）"
```

---

## Self-Review 记录

**Spec 覆盖核对：**
- FileWatcher 扩展状态 + `status()` + `_state_lock` → Task 1 ✅
- deps watcher 单例 + `get/set/start/stop` + `reset_singletons` 联动 → Task 2 ✅
- FastAPI lifespan（startup start / shutdown stop）→ Task 3 ✅
- `/api/status` 加 `watcher` 字段 → Task 5 ✅
- `/api/watch/status` 轻量端点 → Task 4 ✅
- 前端 api/status.ts + types → Task 6 ✅
- store watcher 切片 → Task 7 ✅
- app.ts 5s 轮询 → Task 9 ✅
- app-bar 角标 + toast → Task 8 ✅
- 复用 toast-stack → Task 8 内嵌 ✅
- 配置复用 `watch_enabled/watch_debounce` → Task 2 读取 ✅（无新配置）
- `npm run build` → Task 10 ✅
- 已知限制（多 worker / FS 可靠性 / 轮询延迟）→ 记录在 spec，无需任务实现

**类型一致性：** `WatcherStatus` 字段名（`running/reindexing/changed_count/last_reindex_at/last_doc_count/last_success`）在 Task 1（后端 status()）、Task 5（status API）、Task 6（TS 类型）、Task 7/8/9（store/角标/轮询）全部一致。`setWatcherStatus` 名贯穿 Task 7→9。`cortex:watch-reindexed` 事件名贯穿 Task 8（监听）→9（派发）。

**Placeholder 扫描：** 无 TBD/TODO；每个步骤含可执行代码与命令。
