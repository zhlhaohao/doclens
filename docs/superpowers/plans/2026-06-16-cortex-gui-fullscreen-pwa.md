# Cortex GUI 全屏沉浸式 PWA 改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Cortex GUI 从 Gradio 百分比宽度布局改造为沉浸式 PWA：纯 FastAPI 后端 + Lit/Shoelace SPA 前端 + Activity Bar 双状态布局，桌面/移动端同构，`cortex gui` 单命令启动前后端。

**Architecture:** 单进程 FastAPI（uvicorn）同时服务 `/api/*` REST 端点和 `/` SPA 静态文件；前端用 Lit 自定义业务组件 + Shoelace 基础组件 + Vite 构建；历史会话存 SQLite（`.cortex/sessions.db`）；PWA manifest + service worker 实现 installable + 静态离线。

**Tech Stack:** 后端 Python 3.10+ / FastAPI / Pydantic v2 / sse-starlette / ulid-py / SQLite；前端 TypeScript / Vite 5 / Lit 3 / Shoelace 2 / Vitest / Playwright。

**Spec:** `docs/superpowers/specs/2026-06-16-cortex-gui-fullscreen-pwa-design.md`

---

## 关键接口参考（现有代码）

```python
# cortex/index_manager.py:403
IndexManager.search(query: str, max_results: int = None, fts_expression=None)
    -> tuple[list[Node], list[Document]]

# cortex/agent_integration.py:288
CortexAgent(workdir: Path).initialize() -> CortexAgent  # 含 .session
CortexAgent.run_query(query: str, history: list[dict], emitter_callbacks=None) -> list[dict]
# session 属性：session_id / client / model / tools / tool_handlers / todo_mgr / bg_mgr / bus / skills / logger

# cortex/web/deps.py（旧）— 在 web_v2/deps.py 中复制此模式
get_config() / get_index_manager() / get_agent()

# cortex/cortex_cli.py:1127
def _cli_gui(args, config, idx):
    from cortex.web.app import launch_app     # ← 改为 from cortex.web_v2.app
    launch_app(port=args.port, host=args.host, share=args.share)
```

**关键事实：**
- `IndexManager.search()` 返回 `(nodes, documents)` 元组，不是字典列表 —— 需要在 API 层适配
- `CortexAgent` 流式：通过 `emitter_callbacks` 参数注入回调，或参考 `cortex/web/chat_tab.py:_run_agent_in_thread` 用独立线程跑 `StreamingAgent.run_stream()`
- 测试用 pytest，路径 `tests/`（已在 pyproject.toml 配置）

---

## Phase A：项目准备 + 后端基础

### Task 1: 更新依赖 + 创建 web_v2 包结构

**Files:**
- Modify: `pyproject.toml`
- Create: `cortex/web_v2/__init__.py`
- Create: `cortex/web_v2/api/__init__.py`
- Create: `cortex/web_v2/models/__init__.py`

- [ ] **Step 1: 修改 pyproject.toml 的 cortex 可选依赖**

把 `[project.optional-dependencies]` 下的 `cortex` 改为：

```toml
cortex = [
    "trafilatura>=2.0.0",
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.27.0",
    "sse-starlette>=2.0.0",
    "python-multipart>=0.0.9",
    "ulid-py>=1.1",
]
```

- [ ] **Step 2: 创建 web_v2 包文件**

`cortex/web_v2/__init__.py`（空文件，标记为 Python 包）

`cortex/web_v2/api/__init__.py`（空文件）

`cortex/web_v2/models/__init__.py`（空文件）

- [ ] **Step 3: 重新安装 cortex 可编辑包**

Run: `.venv/Scripts/python.exe -m pip install -e ".[cortex]" 2>&1 | tail -5`
Expected: `Successfully installed fastapi-... uvicorn-... sse-starlette-... ulid-py-...`

- [ ] **Step 4: 验证新依赖导入**

Run: `.venv/Scripts/python.exe -c "import fastapi, uvicorn, sse_starlette, ulid; print('OK')"`
Expected: `OK`

- [ ] **Step 5: 提交**

```bash
git add pyproject.toml cortex/web_v2/__init__.py cortex/web_v2/api/__init__.py cortex/web_v2/models/__init__.py
git commit -m "chore(web_v2): scaffold package and swap gradio for fastapi deps"
```

---

### Task 2: 实现 deps.py（依赖注入单例）

**Files:**
- Create: `cortex/web_v2/deps.py`
- Test: `tests/web_v2/__init__.py`
- Test: `tests/web_v2/conftest.py`
- Test: `tests/web_v2/test_deps.py`

- [ ] **Step 1: 创建测试包结构**

`tests/web_v2/__init__.py`（空文件）

`tests/web_v2/conftest.py`:

```python
"""pytest fixtures for web_v2 tests."""
import os
import sys
from pathlib import Path

import pytest


@pytest.fixture
def temp_workdir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """创建临时工作目录，含几个示例文档。"""
    (tmp_path / "doc1.md").write_text("# Doc 1\n\nHello world from doc1.", encoding="utf-8")
    (tmp_path / "doc2.py").write_text("def hello():\n    return 'world'\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    return tmp_path


@pytest.fixture
def env_cortex_config(temp_workdir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """配置 CORTEX_* 环境变量指向临时目录。"""
    monkeypatch.setenv("CORTEX_WORK_DIR", str(temp_workdir / ".cortex"))
    monkeypatch.setenv("CORTEX_INDEX_PATH", str(temp_workdir / ".cortex" / "index.db"))
```

- [ ] **Step 2: 写失败测试**

`tests/web_v2/test_deps.py`:

```python
"""deps.py 单例测试。"""
from cortex.web_v2 import deps


def test_get_config_returns_singleton(env_cortex_config):
    c1 = deps.get_config()
    c2 = deps.get_config()
    assert c1 is c2


def test_get_index_manager_returns_singleton(env_cortex_config):
    # 重置模块级单例
    deps._idx_manager = None
    m1 = deps.get_index_manager()
    m2 = deps.get_index_manager()
    assert m1 is m2
```

- [ ] **Step 3: 运行测试验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_deps.py -v`
Expected: FAIL with `ImportError` 或 `AttributeError: module 'cortex.web_v2.deps' has no attribute 'get_config'`

- [ ] **Step 4: 实现 deps.py**

`cortex/web_v2/deps.py`:

```python
"""web_v2 共享依赖管理 — IndexManager / CortexAgent 单例。

复制自 cortex/web/deps.py，去除 Gradio 依赖。
"""
import logging
import threading
from pathlib import Path
from typing import Optional

from cortex.config import CortexConfig
from cortex.index_manager import IndexManager

logger = logging.getLogger(__name__)

_idx_manager: Optional[IndexManager] = None
_agent: Optional[object] = None  # CortexAgent，延迟导入避免循环依赖
_lock = threading.RLock()


def get_config() -> CortexConfig:
    """加载 CortexConfig。"""
    return CortexConfig.load()


def get_index_manager() -> IndexManager:
    """获取 IndexManager 单例（懒加载 + 线程安全）。"""
    global _idx_manager
    if _idx_manager is None:
        with _lock:
            if _idx_manager is None:
                config = get_config()
                _idx_manager = IndexManager(config)
                _idx_manager.load_or_build_index()
                logger.info("IndexManager initialized: %d documents", len(_idx_manager.documents))
    return _idx_manager


def get_agent():
    """获取 CortexAgent 单例（懒加载 + 线程安全）。"""
    global _agent
    if _agent is None:
        with _lock:
            if _agent is None:
                from cortex.agent_integration import CortexAgent
                idx = get_index_manager()
                workdir = Path(idx.search_path)
                _agent = CortexAgent(workdir).initialize()
                logger.info("CortexAgent initialized")
    return _agent


def reset_singletons() -> None:
    """重置单例（仅供测试使用）。"""
    global _idx_manager, _agent
    with _lock:
        _idx_manager = None
        _agent = None
```

- [ ] **Step 5: 运行测试验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_deps.py -v`
Expected: 2 passed

- [ ] **Step 6: 提交**

```bash
git add cortex/web_v2/deps.py tests/web_v2/__init__.py tests/web_v2/conftest.py tests/web_v2/test_deps.py
git commit -m "feat(web_v2): add deps module with IndexManager and CortexAgent singletons"
```

---

### Task 3: 实现错误处理

**Files:**
- Create: `cortex/web_v2/api/errors.py`
- Test: `tests/web_v2/test_errors.py`

- [ ] **Step 1: 写失败测试**

`tests/web_v2/test_errors.py`:

```python
"""CortexAPIError 异常处理器测试。"""
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.api.errors import CortexAPIError, register_error_handlers


def _build_app() -> FastAPI:
    app = FastAPI()

    @app.get("/raise")
    async def _raise():
        raise CortexAPIError(status=404, code="TEST_NOT_FOUND", detail="thing missing")

    register_error_handlers(app)
    return app


@pytest.mark.asyncio
async def test_cortex_api_error_returns_json():
    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/raise")
    assert res.status_code == 404
    body = res.json()
    assert body["code"] == "TEST_NOT_FOUND"
    assert body["detail"] == "thing missing"
```

- [ ] **Step 2: 运行测试验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_errors.py -v`
Expected: FAIL with ImportError

- [ ] **Step 3: 实现 errors.py**

`cortex/web_v2/api/errors.py`:

```python
"""Cortex Web API 统一错误处理。

约定所有业务错误抛 CortexAPIError，由 FastAPI exception_handler 转换为
JSON 响应：{"code": "...", "detail": "..."}。
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class CortexAPIError(Exception):
    """业务级 API 错误，含 HTTP status、错误码、人类可读详情。"""

    def __init__(self, status: int, code: str, detail: str):
        self.status = status
        self.code = code
        self.detail = detail
        super().__init__(f"[{code}] {detail}")


def register_error_handlers(app: FastAPI) -> None:
    """在 FastAPI app 上注册统一错误处理器。"""

    @app.exception_handler(CortexAPIError)
    async def _handle_cortex_error(_: Request, exc: CortexAPIError):
        return JSONResponse(
            status_code=exc.status,
            content={"code": exc.code, "detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, exc: Exception):
        # 真实生产可在这里记 traceback_id 并写日志
        return JSONResponse(
            status_code=500,
            content={"code": "INTERNAL_ERROR", "detail": str(exc) or "内部错误"},
        )
```

- [ ] **Step 4: 运行测试验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_errors.py -v`
Expected: 1 passed

- [ ] **Step 5: 提交**

```bash
git add cortex/web_v2/api/errors.py tests/web_v2/test_errors.py
git commit -m "feat(web_v2): add CortexAPIError and unified error handlers"
```

---

### Task 4: 实现 FastAPI app.py 骨架 + health 端点

**Files:**
- Create: `cortex/web_v2/app.py`
- Test: `tests/web_v2/test_app_health.py`

- [ ] **Step 1: 写失败测试**

`tests/web_v2/test_app_health.py`:

```python
"""app.py /api/health 端点测试。"""
import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.app import create_app


@pytest.mark.asyncio
async def test_health_returns_ok():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert "version" in body
```

- [ ] **Step 2: 运行测试验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_app_health.py -v`
Expected: FAIL with ImportError

- [ ] **Step 3: 实现 app.py 骨架**

`cortex/web_v2/app.py`:

```python
"""Cortex Web v2 — FastAPI 应用入口。

`create_app()` 构造 FastAPI 实例；`launch_app()` 用 uvicorn 启动并同时
服务前端 SPA 静态文件（详见 Task 29）。
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse

from cortex import __version__ as CORTEX_VERSION
from cortex.web_v2.api.errors import register_error_handlers

STATIC_DIR = Path(__file__).parent / "static"


def create_app() -> FastAPI:
    """构造 FastAPI 应用（注册路由、错误处理器、静态文件）。"""
    app = FastAPI(title="Cortex", version=CORTEX_VERSION)

    # 错误处理
    register_error_handlers(app)

    # API 路由（后续任务逐步挂载）
    # app.include_router(search.router, prefix="/api")  # Task 6
    # app.include_router(preview.router, prefix="/api")  # Task 7
    # app.include_router(sessions.router, prefix="/api") # Task 8
    # app.include_router(status.router, prefix="/api")   # Task 9
    # app.include_router(chat.router, prefix="/api")     # Task 10

    @app.get("/api/health")
    async def health():
        return {"ok": True, "version": CORTEX_VERSION}

    # 前端 SPA 静态文件（仅当 static/ 存在时挂载；详见 Task 29）
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        from fastapi.staticfiles import StaticFiles
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        """SPA fallback：所有非 /api 路径都返回 index.html（若存在）。"""
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(index)
        return JSONResponse(
            status_code=404,
            content={"code": "FRONTEND_NOT_BUILT", "detail": "前端未构建，请先 vite build"},
        )

    return app


def launch_app(port: int = 7860, host: str = "127.0.0.1", share: bool = False) -> None:
    """启动 FastAPI + uvicorn，并自动打开浏览器。

    `share` 参数保留向后兼容，但 v2 不再支持公网分享。
    """
    if share:
        import warnings
        warnings.warn("`--share` 在 v2 中不再支持；请用 `--host 0.0.0.0` 暴露局域网。")

    import threading
    import webbrowser

    import uvicorn

    app = create_app()
    url = f"http://localhost:{port}" if host in ("127.0.0.1", "0.0.0.0") else f"http://{host}:{port}"
    # 延迟 1 秒打开浏览器，等 uvicorn 就绪
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=host, port=port)
```

- [ ] **Step 4: 确认 cortex.__version__ 存在**

Run: `.venv/Scripts/python.exe -c "from cortex import __version__; print(__version__)"`
Expected: 打印版本号。若 `ImportError`，在 `cortex/__init__.py` 添加 `__version__ = "1.1.0"`（与 pyproject.toml 保持一致）。

- [ ] **Step 5: 运行测试验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_app_health.py -v`
Expected: 1 passed

- [ ] **Step 6: 提交**

```bash
git add cortex/web_v2/app.py tests/web_v2/test_app_health.py
git commit -m "feat(web_v2): add FastAPI app skeleton with health endpoint and SPA fallback"
```

---

## Phase B：持久化层

### Task 5: 实现 sessions_store.py（SQLite CRUD）

**Files:**
- Create: `cortex/web_v2/sessions_store.py`
- Test: `tests/web_v2/test_sessions_store.py`

- [ ] **Step 1: 写失败测试**

`tests/web_v2/test_sessions_store.py`:

```python
"""sessions_store.py SQLite CRUD 测试。"""
from datetime import datetime, timezone

import pytest

from cortex.web_v2.sessions_store import (
    SessionItem,
    SessionSummary,
    SessionType,
    SessionsStore,
)


@pytest.fixture
def store(tmp_path):
    return SessionsStore(tmp_path / "sessions.db")


def _make_summary(**over) -> SessionSummary:
    base = dict(
        id="01JTEST0000000000000000001",
        type=SessionType.CHAT,
        title="测试会话",
        preview="预览文本",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        message_count=0,
    )
    base.update(over)
    return SessionSummary(**base)


def test_create_and_get_session(store):
    s = _make_summary()
    store.create(s)
    got = store.get(s.id)
    assert got is not None
    assert got.title == "测试会话"
    assert got.type == SessionType.CHAT


def test_list_sessions_ordered_by_updated_desc(store):
    a = _make_summary(id="01JAAA", title="A", updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    b = _make_summary(id="01JBBB", title="B", updated_at=datetime(2026, 1, 2, tzinfo=timezone.utc))
    store.create(a)
    store.create(b)
    listed = store.list(SessionType.CHAT, limit=10)
    assert [x.id for x in listed] == ["01JBBB", "01JAAA"]


def test_list_sessions_filter_by_type(store):
    store.create(_make_summary(id="01JC", type=SessionType.CHAT))
    store.create(_make_summary(id="01JS", type=SessionType.SEARCH))
    chats = store.list(SessionType.CHAT, limit=10)
    assert [x.id for x in chats] == ["01JC"]


def test_append_items_and_get_detail(store):
    s = _make_summary()
    store.create(s)
    items = [
        SessionItem(session_id=s.id, seq=0, kind="message_user", payload='{"content":"hi"}'),
        SessionItem(session_id=s.id, seq=1, kind="message_ai", payload='{"content":"hello"}'),
    ]
    for it in items:
        store.append_item(it)
    store.update_count_and_time(s.id, message_count=2)
    detail = store.get_detail(s.id)
    assert detail is not None
    assert len(detail) == 2
    assert detail[0].kind == "message_user"


def test_delete_session_cascades_items(store):
    s = _make_summary()
    store.create(s)
    store.append_item(SessionItem(session_id=s.id, seq=0, kind="message_user", payload="{}"))
    store.delete(s.id)
    assert store.get(s.id) is None
    assert store.get_detail(s.id) == []
```

- [ ] **Step 2: 运行测试验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_sessions_store.py -v`
Expected: FAIL with ImportError

- [ ] **Step 3: 实现 sessions_store.py**

`cortex/web_v2/sessions_store.py`:

```python
"""SQLite 持久化历史会话存储。

Schema:
    sessions(id, type, title, preview, created_at, updated_at, message_count)
    session_items(id, session_id, seq, kind, payload, created_at)

WAL 模式；session_items 通过外键 ON DELETE CASCADE 跟随 sessions 删除。
"""
import json
import sqlite3
import threading
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import BaseModel


class SessionType(str, Enum):
    SEARCH = "search"
    CHAT = "chat"


class SessionSummary(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class SessionItem(BaseModel):
    session_id: str
    seq: int
    kind: str  # message_user / message_ai / result
    payload: str  # JSON 字符串
    created_at: Optional[datetime] = None


_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    type         TEXT NOT NULL,
    title        TEXT NOT NULL,
    preview      TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_type_updated
    ON sessions(type, updated_at DESC);

CREATE TABLE IF NOT EXISTS session_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,
    kind        TEXT NOT NULL,
    payload     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_session ON session_items(session_id, seq);
"""


class SessionsStore:
    """线程安全的 SQLite 历史会话存储。"""

    def __init__(self, db_path: Path | str):
        self._db_path = str(db_path)
        self._lock = threading.RLock()
        self._init_schema()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._lock:
            with self._conn() as conn:
                conn.executescript(_SCHEMA)

    # ---- 写入 ----

    def create(self, s: SessionSummary) -> None:
        with self._lock, self._conn() as conn:
            conn.execute(
                """INSERT INTO sessions
                   (id, type, title, preview, created_at, updated_at, message_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    s.id, s.type.value, s.title, s.preview,
                    s.created_at.isoformat(), s.updated_at.isoformat(), s.message_count,
                ),
            )

    def append_item(self, item: SessionItem) -> None:
        now = (item.created_at or datetime.utcnow()).isoformat()
        with self._lock, self._conn() as conn:
            conn.execute(
                """INSERT INTO session_items (session_id, seq, kind, payload, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (item.session_id, item.seq, item.kind, item.payload, now),
            )

    def update_count_and_time(self, session_id: str, message_count: int) -> None:
        with self._lock, self._conn() as conn:
            conn.execute(
                """UPDATE sessions
                   SET message_count = ?, updated_at = ?
                   WHERE id = ?""",
                (message_count, datetime.utcnow().isoformat(), session_id),
            )

    def delete(self, session_id: str) -> None:
        with self._lock, self._conn() as conn:
            conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

    # ---- 读取 ----

    def list(self, type_: SessionType, limit: int = 50, offset: int = 0) -> list[SessionSummary]:
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                """SELECT id, type, title, preview, created_at, updated_at, message_count
                   FROM sessions
                   WHERE type = ?
                   ORDER BY datetime(updated_at) DESC
                   LIMIT ? OFFSET ?""",
                (type_.value, limit, offset),
            ).fetchall()
        return [self._row_to_summary(r) for r in rows]

    def get(self, session_id: str) -> Optional[SessionSummary]:
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT id, type, title, preview, created_at, updated_at, message_count
                   FROM sessions WHERE id = ?""",
                (session_id,),
            ).fetchone()
        return self._row_to_summary(row) if row else None

    def get_detail(self, session_id: str) -> list[SessionItem]:
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                """SELECT session_id, seq, kind, payload, created_at
                   FROM session_items WHERE session_id = ?
                   ORDER BY seq ASC""",
                (session_id,),
            ).fetchall()
        return [
            SessionItem(
                session_id=r["session_id"], seq=r["seq"], kind=r["kind"],
                payload=r["payload"], created_at=datetime.fromisoformat(r["created_at"]),
            )
            for r in rows
        ]

    @staticmethod
    def _row_to_summary(row: sqlite3.Row) -> SessionSummary:
        return SessionSummary(
            id=row["id"],
            type=SessionType(row["type"]),
            title=row["title"],
            preview=row["preview"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            message_count=row["message_count"],
        )
```

- [ ] **Step 4: 运行测试验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_sessions_store.py -v`
Expected: 5 passed

- [ ] **Step 5: 提交**

```bash
git add cortex/web_v2/sessions_store.py tests/web_v2/test_sessions_store.py
git commit -m "feat(web_v2): add SQLite SessionsStore with WAL mode and cascade delete"
```

---

## Phase C：REST API

### Task 6: 实现 search API + 测试

**Files:**
- Create: `cortex/web_v2/models/search.py`
- Create: `cortex/web_v2/api/search.py`
- Modify: `cortex/web_v2/app.py`（挂载 router）
- Test: `tests/web_v2/test_search_api.py`

- [ ] **Step 1: 写失败测试**

`tests/web_v2/test_search_api.py`:

```python
"""POST /api/search 测试。"""
import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2 import deps
from cortex.web_v2.app import create_app


@pytest.fixture
def reset_deps():
    deps.reset_singletons()
    yield
    deps.reset_singletons()


@pytest.mark.asyncio
async def test_search_returns_results(env_cortex_config, reset_deps, temp_workdir):
    # 先建索引（让 IndexManager 能搜到文档）
    idx = deps.get_index_manager()
    idx.reindex(force=True)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": "hello"})

    assert res.status_code == 200
    body = res.json()
    assert "results" in body
    assert isinstance(body["results"], list)
    assert body["query"] == "hello"
    assert body["total"] == len(body["results"])
    assert body["elapsed_ms"] >= 0


@pytest.mark.asyncio
async def test_search_rejects_empty_query(env_cortex_config, reset_deps):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/search", json={"query": ""})
    assert res.status_code == 422  # Pydantic 校验失败
```

- [ ] **Step 2: 运行测试验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py -v`
Expected: FAIL（路由不存在）

- [ ] **Step 3: 实现 search 模型**

`cortex/web_v2/models/search.py`:

```python
"""搜索 API 请求/响应模型。"""
from typing import Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    mode: str = Field(default="keyword", pattern="^(keyword|phrase)$")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class SearchResult(BaseModel):
    path: str
    snippet: str
    score: float
    line: Optional[int] = None
    highlights: list[tuple[int, int]] = []


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str
    elapsed_ms: int
```

- [ ] **Step 4: 实现 search handler**

`cortex/web_v2/api/search.py`:

```python
"""POST /api/search —— 关键词搜索。

复用 IndexManager.search()；适配其 (nodes, documents) 返回结构为
SearchResult 列表。
"""
import time
from typing import Iterator

from fastapi import APIRouter, Depends

from cortex.index_manager import IndexManager
from cortex.web_v2.deps import get_index_manager
from cortex.web_v2.models.search import SearchRequest, SearchResponse, SearchResult

router = APIRouter()


def _format_results(nodes, documents) -> Iterator[SearchResult]:
    """把 (nodes, documents) 转成 SearchResult 列表。"""
    for node, doc in zip(nodes, documents):
        # doc 可能是 Document 对象（含 .text/.metadata），也可能是 dict
        meta = getattr(doc, "metadata", None) or {}
        text = getattr(doc, "text", "") or (doc.get("text", "") if isinstance(doc, dict) else "")
        path = meta.get("source_path", "") or meta.get("path", "") or getattr(node, "id", "")
        line_no = meta.get("start_line") or meta.get("line")
        snippet = (text or "")[:300]
        score = float(getattr(node, "score", 0.0) or 0.0)
        yield SearchResult(
            path=path,
            snippet=snippet,
            score=score,
            line=line_no,
            highlights=[],
        )


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, idx: IndexManager = Depends(get_index_manager)):
    start = time.perf_counter()
    nodes, documents = idx.search(req.query, max_results=req.limit)
    results = list(_format_results(nodes, documents))
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return SearchResponse(
        results=results,
        total=len(results),
        query=req.query,
        elapsed_ms=elapsed_ms,
    )
```

- [ ] **Step 5: 在 app.py 挂载 router**

修改 `cortex/web_v2/app.py`：

把 `# app.include_router(search.router, prefix="/api")  # Task 6` 这行替换为：

```python
    from cortex.web_v2.api import search
    app.include_router(search.router, prefix="/api")
```

- [ ] **Step 6: 运行测试验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_search_api.py -v`
Expected: 2 passed

- [ ] **Step 7: 提交**

```bash
git add cortex/web_v2/models/search.py cortex/web_v2/api/search.py cortex/web_v2/app.py tests/web_v2/test_search_api.py
git commit -m "feat(web_v2): add POST /api/search with IndexManager adapter"
```

---

### Task 7: 实现 preview API + 测试

**Files:**
- Create: `cortex/web_v2/models/preview.py`
- Create: `cortex/web_v2/api/preview.py`
- Modify: `cortex/web_v2/app.py`
- Test: `tests/web_v2/test_preview_api.py`

- [ ] **Step 1: 写失败测试**

`tests/web_v2/test_preview_api.py`:

```python
"""GET /api/preview 测试。"""
import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.app import create_app


@pytest.mark.asyncio
async def test_preview_returns_file_content(temp_workdir, env_cortex_config):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "doc1.md"})
    assert res.status_code == 200
    body = res.json()
    assert "Hello world" in body["content"]
    assert body["path"] == "doc1.md"


@pytest.mark.asyncio
async def test_preview_404_for_missing_file(temp_workdir, env_cortex_config):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/preview", params={"path": "nonexistent.md"})
    assert res.status_code == 404
    assert res.json()["code"] == "FILE_NOT_FOUND"
```

- [ ] **Step 2: 运行测试验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_api.py -v`
Expected: FAIL（路由不存在）

- [ ] **Step 3: 实现 preview 模型**

`cortex/web_v2/models/preview.py`:

```python
"""预览 API 响应模型。"""
from typing import Optional

from pydantic import BaseModel


class PreviewResponse(BaseModel):
    path: str
    language: str = "text"
    content: str
    line_range: Optional[tuple[int, int]] = None
    highlights: list[int] = []  # 高亮行号
```

- [ ] **Step 4: 实现 preview handler**

`cortex/web_v2/api/preview.py`:

```python
"""GET /api/preview —— 文件预览。

路径解析相对于 IndexManager.search_path，防止越权访问。
"""
import os
from pathlib import Path

from fastapi import APIRouter, Depends, Query

from cortex.index_manager import IndexManager
from cortex.web_v2.api.errors import CortexAPIError
from cortex.web_v2.deps import get_index_manager
from cortex.web_v2.models.preview import PreviewResponse

router = APIRouter()

_LANGUAGE_MAP = {
    ".py": "python", ".md": "markdown", ".txt": "text",
    ".js": "javascript", ".ts": "typescript", ".tsx": "tsx",
    ".html": "html", ".css": "css", ".json": "json",
    ".go": "go", ".rs": "rust", ".java": "java",
    ".c": "c", ".cpp": "cpp",
}


def _safe_resolve(base: Path, requested: str) -> Path:
    """安全解析路径，禁止 .. 越权。"""
    base_abs = base.resolve()
    candidate = (base_abs / requested).resolve()
    try:
        candidate.relative_to(base_abs)
    except ValueError:
        raise CortexAPIError(404, "FILE_NOT_FOUND", "路径越权")
    return candidate


@router.get("/preview", response_model=PreviewResponse)
async def preview(
    path: str = Query(..., description="相对路径"),
    start_line: int = Query(default=0, ge=0),
    end_line: int = Query(default=0, ge=0),
    idx: IndexManager = Depends(get_index_manager),
):
    base = Path(idx.search_path)
    full = _safe_resolve(base, path)
    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {path}")

    try:
        text = full.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        raise CortexAPIError(500, "INTERNAL_ERROR", f"读取失败: {e}") from e

    lines = text.split("\n")
    if start_line > 0 or end_line > 0:
        s = max(0, start_line - 1)
        e = end_line if end_line > 0 else len(lines)
        content = "\n".join(lines[s:e])
        line_range = (s + 1, e)
    else:
        content = text
        line_range = None

    return PreviewResponse(
        path=path,
        language=_LANGUAGE_MAP.get(full.suffix.lower(), "text"),
        content=content,
        line_range=line_range,
        highlights=[],
    )
```

- [ ] **Step 5: 在 app.py 挂载 router**

修改 `cortex/web_v2/app.py`：

把 `# app.include_router(preview.router, prefix="/api")  # Task 7` 替换为：

```python
    from cortex.web_v2.api import preview
    app.include_router(preview.router, prefix="/api")
```

- [ ] **Step 6: 运行测试验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_preview_api.py -v`
Expected: 2 passed

- [ ] **Step 7: 提交**

```bash
git add cortex/web_v2/models/preview.py cortex/web_v2/api/preview.py cortex/web_v2/app.py tests/web_v2/test_preview_api.py
git commit -m "feat(web_v2): add GET /api/preview with path traversal protection"
```

---

### Task 8: 实现 sessions API + 测试

**Files:**
- Create: `cortex/web_v2/models/session.py`
- Create: `cortex/web_v2/api/sessions.py`
- Modify: `cortex/web_v2/app.py`
- Test: `tests/web_v2/test_sessions_api.py`

- [ ] **Step 1: 写失败测试**

`tests/web_v2/test_sessions_api.py`:

```python
"""/api/sessions CRUD 测试。"""
from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.app import create_app
from cortex.web_v2.sessions_store import SessionType, SessionsStore


@pytest.fixture
def patched_store(monkeypatch, tmp_path):
    """用临时 db 替换全局 store。"""
    store = SessionsStore(tmp_path / "sessions.db")
    import cortex.web_v2.api.sessions as mod
    monkeypatch.setattr(mod, "_get_store", lambda: store)
    return store


@pytest.mark.asyncio
async def test_create_session_returns_id(patched_store):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/sessions", json={
            "type": "chat",
            "title": "test chat",
            "preview": "hello",
        })
    assert res.status_code == 200
    body = res.json()
    assert "id" in body
    assert body["title"] == "test chat"


@pytest.mark.asyncio
async def test_list_sessions_filter_by_type(patched_store):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/sessions", json={"type": "chat", "title": "c1", "preview": "p"})
        await client.post("/api/sessions", json={"type": "search", "title": "s1", "preview": "p"})
        res = await client.get("/api/sessions", params={"type": "chat"})
    assert res.status_code == 200
    body = res.json()
    assert len(body["sessions"]) == 1
    assert body["sessions"][0]["title"] == "c1"


@pytest.mark.asyncio
async def test_delete_session(patched_store):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_res = await client.post("/api/sessions", json={
            "type": "chat", "title": "to-delete", "preview": "p",
        })
        sid = create_res.json()["id"]
        del_res = await client.delete(f"/api/sessions/{sid}")
    assert del_res.status_code == 200
    assert del_res.json()["ok"] is True
```

- [ ] **Step 2: 运行测试验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_sessions_api.py -v`
Expected: FAIL（路由不存在）

- [ ] **Step 3: 实现 session 模型**

`cortex/web_v2/models/session.py`:

```python
"""Sessions API 模型。"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from cortex.web_v2.sessions_store import SessionType


class SessionCreateRequest(BaseModel):
    type: SessionType
    title: str = Field(min_length=1, max_length=200)
    preview: str = Field(default="", max_length=200)


class SessionAppendRequest(BaseModel):
    """追加 items 到指定会话。"""
    items: list[dict[str, Any]]  # [{kind, payload}]
    message_count: Optional[int] = None


class SessionCreatedResponse(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str


class SessionListItem(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class SessionListResponse(BaseModel):
    sessions: list[SessionListItem]
    total: int


class SessionDetailResponse(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str
    created_at: datetime
    updated_at: datetime
    message_count: int
    items: list[dict[str, Any]]
```

- [ ] **Step 4: 实现 sessions handler**

`cortex/web_v2/api/sessions.py`:

```python
"""GET/POST/PATCH/DELETE /api/sessions。"""
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query
from ulid import ULID

from cortex.config import CortexConfig
from cortex.web_v2.api.errors import CortexAPIError
from cortex.web_v2.models.session import (
    SessionAppendRequest,
    SessionCreateRequest,
    SessionCreatedResponse,
    SessionDetailResponse,
    SessionListResponse,
)
from cortex.web_v2.sessions_store import SessionItem, SessionType, SessionsStore

router = APIRouter()

_store: Optional[SessionsStore] = None
_store_lock = threading.RLock()


def _get_store() -> SessionsStore:
    """全局单例 SessionsStore（路径来自 CortexConfig.work_dir）。"""
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                cfg = CortexConfig.load()
                db_path = Path(cfg.work_dir) / "sessions.db"
                db_path.parent.mkdir(parents=True, exist_ok=True)
                _store = SessionsStore(db_path)
    return _store


@router.post("/sessions", response_model=SessionCreatedResponse)
async def create_session(req: SessionCreateRequest):
    from cortex.web_v2.models.session import SessionListItem  # 局部导入避免循环
    store = _get_store()
    now = datetime.now(timezone.utc)
    sid = str(ULID())
    from cortex.web_v2.sessions_store import SessionSummary
    summary = SessionSummary(
        id=sid, type=req.type, title=req.title, preview=req.preview,
        created_at=now, updated_at=now, message_count=0,
    )
    store.create(summary)
    return SessionCreatedResponse(id=sid, type=req.type, title=req.title, preview=req.preview)


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    type: Optional[SessionType] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    store = _get_store()
    # 若未指定 type，分别查询两类并合并按 updated_at 排序
    if type is None:
        from itertools import chain
        items = list(chain(store.list(SessionType.SEARCH, limit, offset),
                          store.list(SessionType.CHAT, limit, offset)))
        items.sort(key=lambda s: s.updated_at, reverse=True)
        items = items[offset:offset + limit]
    else:
        items = store.list(type, limit, offset)
    return SessionListResponse(
        sessions=[s.model_dump(mode="json") for s in items],
        total=len(items),
    )


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(session_id: str):
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    items = store.get_detail(session_id)
    return SessionDetailResponse(
        **summary.model_dump(mode="json"),
        items=[{"kind": i.kind, "payload": i.payload, "seq": i.seq} for i in items],
    )


@router.patch("/sessions/{session_id}")
async def append_session(session_id: str, req: SessionAppendRequest):
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    existing = store.get_detail(session_id)
    next_seq = (existing[-1].seq + 1) if existing else 0
    for idx, item in enumerate(req.items):
        store.append_item(SessionItem(
            session_id=session_id,
            seq=next_seq + idx,
            kind=item["kind"],
            payload=item.get("payload", "{}"),
        ))
    new_count = req.message_count if req.message_count is not None else (summary.message_count + len(req.items))
    store.update_count_and_time(session_id, new_count)
    return {"ok": True, "id": session_id, "message_count": new_count}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    store = _get_store()
    summary = store.get(session_id)
    if summary is None:
        raise CortexAPIError(404, "SESSION_NOT_FOUND", f"会话不存在: {session_id}")
    store.delete(session_id)
    return {"ok": True}
```

- [ ] **Step 5: 在 app.py 挂载 router**

把 `# app.include_router(sessions.router, prefix="/api") # Task 8` 替换为：

```python
    from cortex.web_v2.api import sessions
    app.include_router(sessions.router, prefix="/api")
```

- [ ] **Step 6: 运行测试验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_sessions_api.py -v`
Expected: 3 passed

- [ ] **Step 7: 提交**

```bash
git add cortex/web_v2/models/session.py cortex/web_v2/api/sessions.py cortex/web_v2/app.py tests/web_v2/test_sessions_api.py
git commit -m "feat(web_v2): add /api/sessions CRUD with ULID and type filter"
```

---

### Task 9: 实现 status API + 测试

**Files:**
- Create: `cortex/web_v2/api/status.py`
- Modify: `cortex/web_v2/app.py`
- Test: `tests/web_v2/test_status_api.py`

- [ ] **Step 1: 写失败测试**

`tests/web_v2/test_status_api.py`:

```python
"""GET /api/status 测试。"""
import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.app import create_app


@pytest.mark.asyncio
async def test_status_returns_index_info(env_cortex_config, temp_workdir):
    from cortex.web_v2 import deps
    deps.reset_singletons()
    idx = deps.get_index_manager()
    idx.reindex(force=True)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/status")
    assert res.status_code == 200
    body = res.json()
    assert body["indexed_docs"] >= 0
    assert "index_path" in body
    deps.reset_singletons()
```

- [ ] **Step 2: 运行测试验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_status_api.py -v`
Expected: FAIL（路由不存在）

- [ ] **Step 3: 实现 status handler**

`cortex/web_v2/api/status.py`:

```python
"""GET /api/status —— 系统状态。"""
import os

from fastapi import APIRouter, Depends

from cortex.index_manager import IndexManager
from cortex.web_v2.deps import get_index_manager

router = APIRouter()


@router.get("/status")
async def status(idx: IndexManager = Depends(get_index_manager)):
    docs = idx.documents or []
    total_size = 0
    type_counts: dict[str, int] = {}
    for doc in docs:
        meta = getattr(doc, "metadata", None) or {}
        size = meta.get("file_size", 0) or 0
        total_size += size
        src = meta.get("source_path", "")
        ext = os.path.splitext(src)[1].lower() if src else ""
        if ext:
            type_counts[ext] = type_counts.get(ext, 0) + 1
    return {
        "indexed_docs": len(docs),
        "index_path": str(idx.index_path),
        "total_size_bytes": total_size,
        "file_types": type_counts,
    }
```

- [ ] **Step 4: 在 app.py 挂载 router**

把 `# app.include_router(status.router, prefix="/api")   # Task 9` 替换为：

```python
    from cortex.web_v2.api import status
    app.include_router(status.router, prefix="/api")
```

- [ ] **Step 5: 运行测试验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_status_api.py -v`
Expected: 1 passed

- [ ] **Step 6: 提交**

```bash
git add cortex/web_v2/api/status.py cortex/web_v2/app.py tests/web_v2/test_status_api.py
git commit -m "feat(web_v2): add GET /api/status with index statistics"
```

---

### Task 10: 实现 chat API（SSE 流）+ 测试

**Files:**
- Create: `cortex/web_v2/models/chat.py`
- Create: `cortex/web_v2/api/chat.py`
- Modify: `cortex/web_v2/app.py`
- Test: `tests/web_v2/test_chat_api.py`

- [ ] **Step 1: 写失败测试**

`tests/web_v2/test_chat_api.py`:

```python
"""POST /api/chat (SSE) 测试。"""
import json

import pytest
from httpx import ASGITransport, AsyncClient

from cortex.web_v2.app import create_app


@pytest.mark.asyncio
async def test_chat_returns_sse_stream(env_cortex_config, temp_workdir, monkeypatch):
    """用 mock agent 验证 SSE 格式（不真实调用 LLM）。"""
    from cortex.web_v2 import deps

    class _FakeAgent:
        def __init__(self):
            self.session = type("S", (), {"session_id": "test"})()

    async def _fake_stream(message, session_id):
        for chunk in ["Hello", " ", "world"]:
            yield chunk

    monkeypatch.setattr(deps, "get_agent", lambda: _FakeAgent())
    import cortex.web_v2.api.chat as chat_mod
    monkeypatch.setattr(chat_mod, "_stream_agent_response", _fake_stream)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/chat",
            json={"message": "hi", "session_id": "test"},
        )
    assert res.status_code == 200
    # 解析 SSE：data: {...}
    lines = [l for l in res.text.split("\n") if l.startswith("data:")]
    assert len(lines) >= 2  # 至少 2 个 chunk + done
    payloads = [json.loads(l[5:].strip()) for l in lines]
    assert "text" in payloads[0]
```

- [ ] **Step 2: 运行测试验证失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_chat_api.py -v`
Expected: FAIL（路由不存在）

- [ ] **Step 3: 实现 chat 模型**

`cortex/web_v2/models/chat.py`:

```python
"""Chat API 模型。"""
from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    session_id: Optional[str] = None
    history: list[dict] = Field(default_factory=list)  # [{role, content}]
```

- [ ] **Step 4: 实现 chat handler（SSE）**

`cortex/web_v2/api/chat.py`:

```python
"""POST /api/chat —— AI 对话（SSE 流）。

设计：
1. 复用 CortexAgent.session（含 tools / tool_handlers）
2. 在独立线程运行 StreamingAgent.run_stream，emitter 写入 asyncio.Queue
3. FastAPI handler 把 queue 转成 SSE 流
"""
import asyncio
import json
import logging
import threading
from typing import AsyncIterator, Optional

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from cortex.web_v2.deps import get_agent
from cortex.web_v2.models.chat import ChatRequest

logger = logging.getLogger(__name__)
router = APIRouter()


async def _stream_agent_response(message: str, session_id: Optional[str]) -> AsyncIterator[str]:
    """默认实现：用 CortexAgent 流式产生文本块。

    设计要点：
    - 在独立线程运行同步 StreamingAgent
    - 用 GradioEventEmitter 改造的轻量 emitter 把 text 写入 asyncio.Queue
    - 主协程从 queue yield，做到 SSE 增量输出
    """
    agent = get_agent()
    session = agent.session

    # 复用旧 emitter 的 buffer 思路，但直接接 asyncio.Queue
    queue: asyncio.Queue = asyncio.Queue()
    done_event = threading.Event()

    # 复用旧 chat_tab 的线程模式
    def _run_in_thread():
        try:
            from cortex.web.emitter import GradioEventEmitter  # 复用旧实现
            from planify.streaming.runner import StreamingAgent
            from planify.streaming.types import StreamingConfig
            from planify.streaming.waiter import get_global_waiter
            from planify.tools import bind_user_interaction_handlers

            emitter = GradioEventEmitter()
            interrupt = threading.Event()

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            async def _feed():
                # 把 emitter 的 text_parts 增量投递到 queue
                last_seen = 0
                while not done_event.is_set() or last_seen < len(emitter.text_parts):
                    cur = emitter.get_full_text()
                    if len(cur) > last_seen:
                        await queue.put(cur[last_seen:])
                        last_seen = len(cur)
                    await asyncio.sleep(0.05)
                    if emitter.done:
                        break
                await queue.put(None)  # sentinel

            sa = StreamingAgent(
                client=session.client,
                model=session.model,
                tools=session.tools,
                tool_handlers=session.tool_handlers,
                emitter=emitter,
                config=StreamingConfig(),
                waiter=get_global_waiter(),
                todo_manager=session.todo_mgr,
                bg_manager=session.bg_mgr,
                bus=session.bus,
                skills_loader=session.skills,
                logger_instance=session.logger,
                session=session,
                interrupt_event=interrupt,
            )
            bind_user_interaction_handlers(session.tool_handlers, emitter, get_global_waiter())

            # 跑两件事：agent.run_stream + _feed
            loop.run_until_complete(asyncio.gather(
                sa.run_stream([], message, session.session_id),
                _feed(),
            ))
        except Exception as e:
            logger.exception("chat thread error: %s", e)
            asyncio.run(queue.put(f"\n\n**错误:** {e}"))
            asyncio.run(queue.put(None))
        finally:
            done_event.set()

    t = threading.Thread(target=_run_in_thread, daemon=True)
    t.start()

    while True:
        chunk = await queue.get()
        if chunk is None:
            break
        yield chunk


@router.post("/chat")
async def chat(req: ChatRequest):
    async def event_stream() -> AsyncIterator[dict]:
        try:
            async for chunk in _stream_agent_response(req.message, req.session_id):
                yield {"event": "token", "data": json.dumps({"text": chunk})}
            yield {"event": "done", "data": "{}"}
        except Exception as e:
            logger.exception("chat stream error: %s", e)
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(event_stream())
```

- [ ] **Step 5: 在 app.py 挂载 router**

把 `# app.include_router(chat.router, prefix="/api")     # Task 10` 替换为：

```python
    from cortex.web_v2.api import chat
    app.include_router(chat.router, prefix="/api")
```

- [ ] **Step 6: 运行测试验证通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_chat_api.py -v`
Expected: 1 passed

> **说明：** 真实 LLM 调用在测试中被 `monkeypatch.setattr(chat_mod, "_stream_agent_response", _fake_stream)` 拦截，避免依赖网络。端到端真实对话由 Task 31 的 Playwright E2E 覆盖。

- [ ] **Step 7: 提交**

```bash
git add cortex/web_v2/models/chat.py cortex/web_v2/api/chat.py cortex/web_v2/app.py tests/web_v2/test_chat_api.py
git commit -m "feat(web_v2): add POST /api/chat with SSE streaming via thread-bridge queue"
```

---

## Phase D：CLI 集成 + 端到端启动

### Task 11: 切换 cortex_cli.py + 验证 launch_app

**Files:**
- Modify: `cortex/cortex_cli.py:1127-1133`
- Modify: `cortex/cortex_cli.py:882-897`（help 文案）
- Test: manual run

- [ ] **Step 1: 修改 cortex_cli.py 的 import**

把 `cortex/cortex_cli.py:1132` 这一行：

```python
    from cortex.web.app import launch_app
```

改为：

```python
    from cortex.web_v2.app import launch_app
```

- [ ] **Step 2: 修改 gui_parser 的 help 文案**

把 `cortex/cortex_cli.py:883` 这一行：

```python
        "gui", help="Launch Gradio Web UI"
```

改为：

```python
        "gui", help="Launch Cortex Web UI (PWA)"
```

把 `cortex/cortex_cli.py:894-896`：

```python
    gui_parser.add_argument(
        "--share", action="store_true",
        help="Create a public Gradio share link",
    )
```

改为：

```python
    gui_parser.add_argument(
        "--share", action="store_true",
        help="(Deprecated in v2) Use --host 0.0.0.0 to expose on LAN",
    )
```

- [ ] **Step 3: 验证 import 切换无误**

Run: `.venv/Scripts/python.exe -c "from cortex.cortex_cli import _cli_gui; print('OK')"`
Expected: `OK`

- [ ] **Step 4: 端到端冒烟测试（手动）**

Run（在 test_work_dir 下）:
```bash
cd test_work_dir
../.venv/Scripts/python.exe -m cortex gui --port 7861
```

Expected：
- 终端打印 uvicorn 启动日志 `Uvicorn running on http://127.0.0.1:7861`
- 浏览器自动打开 `http://localhost:7861`
- 浏览器看到 `"FRONTEND_NOT_BUILT"` 错误（前端尚未构建，Task 27-29 后会消失）

测试 API：
```bash
curl http://localhost:7861/api/health
# 期望：{"ok": true, "version": "1.1.0"}

curl -X POST http://localhost:7861/api/search -H "Content-Type: application/json" -d '{"query":"test"}'
# 期望：返回 JSON 结果（视索引内容）
```

按 Ctrl+C 停止。

- [ ] **Step 5: 跑全部 web_v2 测试**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/ -v`
Expected: 全部 passed

- [ ] **Step 6: 提交**

```bash
git add cortex/cortex_cli.py
git commit -m "feat(cli): switch cortex gui to web_v2 (FastAPI + SPA)"
```

---

## Phase E：前端基础工程

> **说明：** Phase E-F 假设在 `cortex/web_v2/frontend/` 目录下用 npm/yarn 管理 Node 依赖。开发者机器需安装 Node.js 18+。最终用户运行时只需 Python（前端构建产物已提交到 `cortex/web_v2/static/`，详见 Task 29）。

### Task 12: 创建 frontend 工程结构

**Files:**
- Create: `cortex/web_v2/frontend/package.json`
- Create: `cortex/web_v2/frontend/tsconfig.json`
- Create: `cortex/web_v2/frontend/vite.config.ts`
- Create: `cortex/web_v2/frontend/index.html`
- Create: `cortex/web_v2/frontend/src/main.ts`
- Create: `cortex/web_v2/frontend/src/app.ts`（占位，Task 26 完成）

- [ ] **Step 1: 写 package.json**

`cortex/web_v2/frontend/package.json`:

```json
{
  "name": "cortex-web-v2-frontend",
  "private": true,
  "version": "1.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "lit": "^3.2.0",
    "@shoelace-style/shoelace": "^2.15.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "@open-wc/testing": "^4.0.0",
    "@playwright/test": "^1.47.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: 写 tsconfig.json**

`cortex/web_v2/frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

> **重要：** `useDefineForClassFields: false` + `experimentalDecorators: true` 是 Lit 装饰器模式必需。

- [ ] **Step 3: 写 vite.config.ts**

`cortex/web_v2/frontend/vite.config.ts`:

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "/",
  build: {
    // 输出到 web_v2/static/，供 FastAPI StaticFiles 服务
    outDir: "../static",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
      },
    },
  },
  server: {
    port: 5173,
    // 开发期把 /api 代理到后端 FastAPI
    proxy: {
      "/api": "http://localhost:7860",
    },
  },
});
```

- [ ] **Step 4: 写 index.html**

`cortex/web_v2/frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0D9488" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="icon" href="/assets/icon-192.png" />
  <title>Cortex</title>
</head>
<body>
  <cortex-app></cortex-app>
  <script type="module" src="/src/main.ts"></script>
  <script>
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          /* 静默降级 */
        });
      });
    }
  </script>
</body>
</html>
```

- [ ] **Step 5: 写占位 main.ts 和 app.ts**

`cortex/web_v2/frontend/src/main.ts`:

```typescript
import "@shoelace-style/shoelace/dist/themes/light.css";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/input/input.js";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import "@shoelace-style/shoelace/dist/components/tab/tab.js";
import "@shoelace-style/shoelace/dist/components/tab-group/tab-group.js";
import "@shoelace-style/shoelace/dist/components/drawer/drawer.js";
import "@shoelace-style/shoelace/dist/components/banner/banner.js";

import "./app";
import "./styles/global.css";
import "./styles/tokens.css";
import "./styles/breakpoints.css";
```

`cortex/web_v2/frontend/src/app.ts`（占位，Task 26 完善）:

```typescript
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("cortex-app")
export class CortexApp extends LitElement {
  static styles = css`:host { display: block; padding: 16px; }`;

  render() {
    return html`<div>Cortex Web v2 — 脚手架就绪</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cortex-app": CortexApp;
  }
}
```

- [ ] **Step 6: 安装依赖并验证构建**

Run:
```bash
cd cortex/web_v2/frontend
npm install
npm run build
```

Expected：构建成功，输出到 `cortex/web_v2/static/`（含 `index.html` 和 `assets/main.[hash].js`）

- [ ] **Step 7: 提交**

```bash
# 注意：node_modules 不提交
git add cortex/web_v2/frontend/package.json cortex/web_v2/frontend/tsconfig.json cortex/web_v2/frontend/vite.config.ts cortex/web_v2/frontend/index.html cortex/web_v2/frontend/src/main.ts cortex/web_v2/frontend/src/app.ts
git commit -m "feat(frontend): scaffold Vite + TypeScript + Lit + Shoelace project"
```

---

### Task 13: 更新 .gitignore（前端 node_modules / dist）

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 在 .gitignore 中追加**

在文件末尾追加：

```gitignore

# Frontend (web_v2)
cortex/web_v2/frontend/node_modules/
cortex/web_v2/frontend/dist/
cortex/web_v2/frontend/.vitest/
cortex/web_v2/frontend/test-results/
cortex/web_v2/frontend/playwright-report/
cortex/web_v2/frontend/.vite/
```

> **注意：** `cortex/web_v2/static/` **不** 加入 .gitignore —— 构建产物需要提交到仓库，让用户 pip install 时即可使用。

- [ ] **Step 2: 提交**

```bash
git add .gitignore
git commit -m "chore: gitignore frontend node_modules and build intermediates"
```

---

### Task 14: 实现 styles（tokens / breakpoints / global）

**Files:**
- Create: `cortex/web_v2/frontend/src/styles/tokens.css`
- Create: `cortex/web_v2/frontend/src/styles/breakpoints.css`
- Create: `cortex/web_v2/frontend/src/styles/global.css`

- [ ] **Step 1: 写 tokens.css**

`cortex/web_v2/frontend/src/styles/tokens.css`:

```css
/* Cortex 设计 tokens（与 specs/search_page_spec.md Bento Grid 风格对齐） */
:root {
  /* 主色 */
  --cortex-primary: #0D9488;        /* teal-600 */
  --cortex-primary-hover: #0F766E;
  --cortex-primary-soft: #F0FDFA;

  /* 中性色 */
  --cortex-bg: #F5F5F7;
  --cortex-surface: #FFFFFF;
  --cortex-surface-muted: #FAFAFA;
  --cortex-border: #E4E4E7;
  --cortex-border-muted: #F1F5F9;

  /* 文字 */
  --cortex-text: #0F172A;
  --cortex-text-muted: #64748B;
  --cortex-text-subtle: #94A3B8;

  /* 状态 */
  --cortex-warning: #F59E0B;
  --cortex-danger: #DC2626;
  --cortex-success: #10B981;

  /* 间距（4px 基线） */
  --cortex-space-1: 4px;
  --cortex-space-2: 8px;
  --cortex-space-3: 12px;
  --cortex-space-4: 16px;
  --cortex-space-6: 24px;
  --cortex-space-8: 32px;

  /* 圆角 */
  --cortex-radius-sm: 4px;
  --cortex-radius-md: 8px;
  --cortex-radius-lg: 12px;

  /* 字体 */
  --cortex-font: "Plus Jakarta Sans", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --cortex-font-mono: "JetBrains Mono", "Cascadia Code", Consolas, monospace;

  /* Activity Bar 宽度 */
  --cortex-activity-bar-width: 48px;
  /* Tab Bar 高度（移动） */
  --cortex-tab-bar-height: 56px;
  /* 触控目标 */
  --cortex-touch-target: 44px;
}
```

- [ ] **Step 2: 写 breakpoints.css**

`cortex/web_v2/frontend/src/styles/breakpoints.css`:

```css
/* Cortex 响应式断点。
 * 用法：@media (--mobile) { ... }
 *       @media (--desktop) { ... }
 *
 * 注意：CSS 原生不支持 @media (--var)，所以这里直接写像素值。
 *       断点定义参考：
 *         <640px    : 移动（手机）
 *         640-1023  : 平板（与移动同行为）
 *         ≥1024px   : 桌面（含 Activity Bar + 双栏）
 */

/* 移动/平板（<1024px）：单栏 + 底部 Tab Bar */
@media (max-width: 1023px) {
  :root {
    --cortex-show-activity-bar: none;
    --cortex-show-tab-bar: flex;
  }
}

/* 桌面（≥1024px）：Activity Bar + 双栏 */
@media (min-width: 1024px) {
  :root {
    --cortex-show-activity-bar: flex;
    --cortex-show-tab-bar: none;
  }
}
```

- [ ] **Step 3: 写 global.css**

`cortex/web_v2/frontend/src/styles/global.css`:

```css
/* Cortex 全局样式（沉浸式 PWA） */
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  height: 100vh;
  height: 100dvh;             /* 移动动态视口高度 */
  overflow: hidden;
  overscroll-behavior: none;   /* 禁下拉刷新 */
  -webkit-tap-highlight-color: transparent;
  font-family: var(--cortex-font);
  color: var(--cortex-text);
  background: var(--cortex-bg);
}

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* PWA standalone 模式优化 */
@media (display-mode: standalone) {
  body {
    user-select: none;
    /* iOS 安全区适配 */
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}

/* 全局滚动条样式（webkit） */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb {
  background: var(--cortex-border);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover { background: var(--cortex-text-subtle); }
```

- [ ] **Step 4: 构建并提交**

Run:
```bash
cd cortex/web_v2/frontend && npm run build
```

Expected：构建成功

```bash
git add cortex/web_v2/frontend/src/styles/tokens.css cortex/web_v2/frontend/src/styles/breakpoints.css cortex/web_v2/frontend/src/styles/global.css cortex/web_v2/static/
git commit -m "feat(frontend): add design tokens, responsive breakpoints, immersive global styles"
```

---

### Task 15: 实现 store（轻量订阅模式）

**Files:**
- Create: `cortex/web_v2/frontend/src/state/store.ts`
- Create: `cortex/web_v2/frontend/src/state/types.ts`

- [ ] **Step 1: 写 types.ts**

`cortex/web_v2/frontend/src/state/types.ts`:

```typescript
/** 前端全局状态类型定义。 */

export type ViewId = "search" | "chat" | "history";
export type FocusState = "initial" | "focus";

export interface SearchResult {
  path: string;
  snippet: string;
  score: number;
  line: number | null;
  highlights: [number, number][];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Session {
  id: string;
  type: "search" | "chat";
  title: string;
  preview: string;
  updated_at: string;
  message_count: number;
}

export interface SearchViewState {
  state: FocusState;
  currentSession: Session | null;
  query: string;
  results: SearchResult[];
  total: number;
}

export interface ChatViewState {
  state: FocusState;
  currentSession: Session | null;
  messages: ChatMessage[];
  streaming: boolean;
}

export interface HistoryEntry {
  session: Session;
}

export interface SystemStatus {
  indexed_docs: number;
  index_path: string;
  total_size_bytes: number;
  file_types: Record<string, number>;
}

export interface AppState {
  view: ViewId;
  search: SearchViewState;
  chat: ChatViewState;
  /** 详情推入栈（移动端整页推入） */
  detailStack: SearchResult[];
  status: SystemStatus | null;
  error: string | null;
}
```

- [ ] **Step 2: 写 store.ts**

`cortex/web_v2/frontend/src/state/store.ts`:

```typescript
/** 轻量全局 store —— 基于 EventTarget + 订阅模式。
 *
 * 不引入 Redux/Zustand。组件通过 `store.subscribe(selector, cb)`
 * 订阅特定切片，状态变化时自动回调。
 */
import type { AppState } from "./types";

const INITIAL_STATE: AppState = {
  view: "search",
  search: {
    state: "initial",
    currentSession: null,
    query: "",
    results: [],
    total: 0,
  },
  chat: {
    state: "initial",
    currentSession: null,
    messages: [],
    streaming: false,
  },
  detailStack: [],
  status: null,
  error: null,
};

type Listener = (state: AppState) => void;
type Selector<T> = (state: AppState) => T;

class CortexStore {
  private state: AppState = INITIAL_STATE;
  private listeners = new Set<Listener>();

  getState(): AppState {
    return this.state;
  }

  setState(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((cb) => cb(this.state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 选择器订阅 —— 仅当 selector 返回值变化时回调 */
  subscribeSelector<T>(selector: Selector<T>, cb: (slice: T) => void): () => void {
    let last = selector(this.state);
    return this.subscribe((state) => {
      const next = selector(state);
      if (next !== last) {
        last = next;
        cb(next);
      }
    });
  }
}

export const store = new CortexStore();

// 便捷 action 工厂
export const actions = {
  setView(view: AppState["view"]) {
    store.setState({ view });
  },

  setSearchState(s: Partial<AppState["search"]>) {
    const cur = store.getState().search;
    store.setState({ search: { ...cur, ...s } });
  },

  setChatState(s: Partial<AppState["chat"]>) {
    const cur = store.getState().chat;
    store.setState({ chat: { ...cur, ...s } });
  },

  pushDetail(result: AppState["detailStack"][number]) {
    const cur = store.getState().detailStack;
    store.setState({ detailStack: [...cur, result] });
  },

  popDetail() {
    const cur = store.getState().detailStack;
    if (cur.length === 0) return;
    store.setState({ detailStack: cur.slice(0, -1) });
  },

  setError(error: string | null) {
    store.setState({ error });
  },
};
```

- [ ] **Step 3: 类型检查并提交**

Run:
```bash
cd cortex/web_v2/frontend && npm run typecheck
```

Expected: 无错误

```bash
git add cortex/web_v2/frontend/src/state/store.ts cortex/web_v2/frontend/src/state/types.ts
git commit -m "feat(frontend): add lightweight store with selector subscriptions"
```

---

### Task 16: 实现 API client（fetch + SSE）

**Files:**
- Create: `cortex/web_v2/frontend/src/api/client.ts`
- Create: `cortex/web_v2/frontend/src/api/search.ts`
- Create: `cortex/web_v2/frontend/src/api/chat.ts`
- Create: `cortex/web_v2/frontend/src/api/sessions.ts`
- Test: `cortex/web_v2/frontend/tests/api.spec.ts`

- [ ] **Step 1: 写失败测试**

`cortex/web_v2/frontend/tests/api.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchApi } from "../src/api/search";

describe("searchApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("builds POST /api/search request and parses response", async () => {
    const mockResponse = {
      results: [{ path: "a.py", snippet: "x", score: 0.5, line: 1, highlights: [] }],
      total: 1,
      query: "x",
      elapsed_ms: 5,
    };
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await searchApi({ query: "x" });
    expect(result.total).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/search",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws ApiError on non-ok response", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ code: "VALIDATION_ERROR", detail: "bad" }),
    });
    await expect(searchApi({ query: "" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd cortex/web_v2/frontend && npm test`
Expected: FAIL（找不到模块）

- [ ] **Step 3: 实现 client.ts**

`cortex/web_v2/frontend/src/api/client.ts`:

```typescript
/** 统一 fetch 封装 + ApiError 类型。 */

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions extends RequestInit {
  json?: unknown;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = { ...options };
  if (options.json !== undefined) {
    init.headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    init.body = JSON.stringify(options.json);
  }
  const res = await fetch(path, init);
  if (!res.ok) {
    let body: any;
    try {
      body = await res.json();
    } catch {
      body = { code: "unknown", detail: res.statusText };
    }
    throw new ApiError(res.status, body.code ?? "unknown", body.detail ?? "请求失败");
  }
  return res.json() as Promise<T>;
}

/** SSE 流读取：从 POST 请求读 text/event-stream，按 event/data 解析。 */
export async function* streamSSE(
  path: string,
  body: unknown,
): AsyncGenerator<{ event: string; data: string }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, "stream_failed", "流式请求失败");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      let data = "";
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      yield { event, data };
    }
  }
}
```

- [ ] **Step 4: 实现 search.ts**

`cortex/web_v2/frontend/src/api/search.ts`:

```typescript
import { request } from "./client";
import type { SearchResult } from "../state/types";

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  elapsed_ms: number;
}

export async function searchApi(req: { query: string; mode?: string; limit?: number; offset?: number }): Promise<SearchResponse> {
  return request<SearchResponse>("/api/search", { method: "POST", json: req });
}
```

- [ ] **Step 5: 实现 chat.ts**

`cortex/web_v2/frontend/src/api/chat.ts`:

```typescript
import { streamSSE } from "./client";

export async function* chatStream(req: { message: string; session_id?: string; history?: Array<{ role: string; content: string }> }) {
  for await (const ev of streamSSE("/api/chat", req)) {
    if (ev.event === "token") {
      try {
        yield { type: "token" as const, text: JSON.parse(ev.data).text };
      } catch {
        /* 跳过无法解析的 chunk */
      }
    } else if (ev.event === "done") {
      yield { type: "done" as const };
    } else if (ev.event === "error") {
      try {
        yield { type: "error" as const, detail: JSON.parse(ev.data).detail };
      } catch {
        yield { type: "error" as const, detail: "未知错误" };
      }
    }
  }
}
```

- [ ] **Step 6: 实现 sessions.ts**

`cortex/web_v2/frontend/src/api/sessions.ts`:

```typescript
import { request } from "./client";
import type { Session } from "../state/types";

export interface CreateSessionResponse extends Pick<Session, "id" | "type" | "title" | "preview"> {}

export async function createSession(req: { type: "search" | "chat"; title: string; preview?: string }): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/api/sessions", { method: "POST", json: req });
}

export async function listSessions(params: { type?: "search" | "chat"; limit?: number; offset?: number }): Promise<{ sessions: Session[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));
  return request(`/api/sessions?${sp}`, { method: "GET" });
}

export async function appendSession(sessionId: string, items: Array<{ kind: string; payload: any }>, messageCount?: number): Promise<{ ok: boolean; message_count: number }> {
  return request(`/api/sessions/${sessionId}`, { method: "PATCH", json: { items, message_count: messageCount } });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request(`/api/sessions/${sessionId}`, { method: "DELETE" });
}
```

- [ ] **Step 7: 运行测试验证通过**

Run: `cd cortex/web_v2/frontend && npm test`
Expected: 2 passed

- [ ] **Step 8: 提交**

```bash
git add cortex/web_v2/frontend/src/api/ cortex/web_v2/frontend/tests/api.spec.ts
git commit -m "feat(frontend): add API client with fetch wrapper and SSE stream reader"
```

---

## Phase F：前端组件

### Task 17: 实现 `<input-box>`（内嵌右边缘按钮）

**Files:**
- Create: `cortex/web_v2/frontend/src/components/input-box.ts`
- Test: `cortex/web_v2/frontend/tests/input-box.spec.ts`

- [ ] **Step 1: 写失败测试**

`cortex/web_v2/frontend/tests/input-box.spec.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { fixture, assert, elementUpdated } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/input-box";

describe("<input-box>", () => {
  it("renders placeholder and emits submit on button click", async () => {
    const el = await fixture(html`<input-box placeholder="hi" button-label="go"></input-box>`);
    const input = el.shadowRoot!.querySelector("input")!;
    input.value = "hello";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    let submitted = "";
    el.addEventListener("submit", (e: any) => (submitted = e.detail.value));

    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    btn.click();

    expect(submitted).toBe("hello");
  });

  it("disables button when value is empty", async () => {
    const el = await fixture(html`<input-box placeholder="hi" button-label="go"></input-box>`);
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    expect(btn.disabled).toBe(true);
  });

  it("submits on Ctrl/Cmd+Enter", async () => {
    const el = await fixture(html`<input-box placeholder="hi" button-label="go"></input-box>`);
    const input = el.shadowRoot!.querySelector("input")!;
    input.value = "x";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    let submitted = "";
    el.addEventListener("submit", (e: any) => (submitted = e.detail.value));

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
    expect(submitted).toBe("x");
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd cortex/web_v2/frontend && npm test -- input-box`
Expected: FAIL（找不到模块）

- [ ] **Step 3: 实现 input-box.ts**

`cortex/web_v2/frontend/src/components/input-box.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";

@customElement("input-box")
export class InputBox extends LitElement {
  static styles = css`
    :host {
      display: block;
      --min-h: 48px;
    }
    .wrapper {
      position: relative;
      display: flex;
      align-items: center;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface-muted);
      min-height: var(--min-h);
      padding: 0 calc(var(--min-h) + 8px) 0 14px;
    }
    .wrapper:focus-within {
      border-color: var(--cortex-primary);
      box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.15);
    }
    input, textarea {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      font-family: var(--cortex-font);
      font-size: 14px;
      color: var(--cortex-text);
      resize: none;
      min-height: calc(var(--min-h) - 12px);
      line-height: 1.4;
    }
    input::placeholder, textarea::placeholder { color: var(--cortex-text-subtle); }
    button {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      background: var(--cortex-primary);
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-sm);
      min-width: var(--cortex-touch-target);
      height: calc(var(--min-h) - 8px);
      padding: 0 12px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button:hover:not(:disabled) { background: var(--cortex-primary-hover); }
    @media (max-width: 1023px) {
      :host { --min-h: 44px; }
    }
  `;

  @property() value = "";
  @property() placeholder = "";
  @property() buttonLabel = "搜索";
  @property() buttonIcon = "";
  @property({ type: Boolean }) multiline = false;
  @property({ type: Boolean }) disabled = false;

  @query("input, textarea") private inputEl!: HTMLInputElement | HTMLTextAreaElement;

  private get trimmed() {
    return this.value.trim();
  }

  private _onInput(e: Event) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    this.value = target.value;
    this.dispatchEvent(new CustomEvent("input-change", { detail: { value: this.value } }));
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this._submit();
    }
    if (e.key === "Enter" && !this.multiline && !e.shiftKey) {
      e.preventDefault();
      this._submit();
    }
  }

  private _submit() {
    if (!this.trimmed || this.disabled) return;
    this.dispatchEvent(new CustomEvent("submit", { detail: { value: this.trimmed } }));
  }

  render() {
    return html`
      <div class="wrapper">
        ${this.multiline
          ? html`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
              @input=${this._onInput} @keydown=${this._onKeydown}></textarea>`
          : html`<input type="text" .value=${this.value} placeholder=${this.placeholder}
              @input=${this._onInput} @keydown=${this._onKeydown} />}
      </div>
      <button @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
        ${this.buttonIcon ? html`<span>${this.buttonIcon}</span>` : null}
        <span>${this.buttonLabel}</span>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "input-box": InputBox;
  }
}
```

> **修正：** 上面 `render()` 中的 `<div class="wrapper">` 缺少闭合，且按钮应在 wrapper 内（右边缘）。完整正确版：

```typescript
  render() {
    const field = this.multiline
      ? html`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown}></textarea>`
      : html`<input type="text" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown} />`;
    return html`
      <div class="wrapper">
        ${field}
        <button @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
          ${this.buttonIcon ? html`<span aria-hidden="true">${this.buttonIcon}</span>` : null}
          <span>${this.buttonLabel}</span>
        </button>
      </div>
    `;
  }
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd cortex/web_v2/frontend && npm test -- input-box`
Expected: 3 passed

- [ ] **Step 5: 提交**

```bash
git add cortex/web_v2/frontend/src/components/input-box.ts cortex/web_v2/frontend/tests/input-box.spec.ts
git commit -m "feat(frontend): add <input-box> with inline right-edge button and keyboard shortcuts"
```

---

### Task 18: 实现 `<welcome-pane>` + `<focus-header>`

**Files:**
- Create: `cortex/web_v2/frontend/src/components/welcome-pane.ts`
- Create: `cortex/web_v2/frontend/src/components/focus-header.ts`

- [ ] **Step 1: 实现 welcome-pane.ts**

`cortex/web_v2/frontend/src/components/welcome-pane.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("welcome-pane")
export class WelcomePane extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--cortex-space-8) var(--cortex-space-6) var(--cortex-space-6);
      text-align: center;
      background: linear-gradient(180deg, var(--cortex-primary-soft) 0%, var(--cortex-surface) 100%);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .title {
      font-size: 28px;
      font-weight: 700;
      color: var(--cortex-primary);
      letter-spacing: -0.5px;
      margin: 0;
    }
    .subtitle {
      font-size: 13px;
      color: var(--cortex-text-muted);
      margin-top: var(--cortex-space-1);
    }
  `;

  @property() heading = "Cortex";
  @property() subheading = "";

  render() {
    return html`
      <h1 class="title">${this.heading}</h1>
      ${this.subheading ? html`<p class="subtitle">${this.subheading}</p>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "welcome-pane": WelcomePane;
  }
}
```

- [ ] **Step 2: 实现 focus-header.ts**

`cortex/web_v2/frontend/src/components/focus-header.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("focus-header")
export class FocusHeader extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      background: var(--cortex-surface-muted);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
    }
    .back {
      background: none;
      border: none;
      color: var(--cortex-primary);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .back:hover { background: var(--cortex-primary-soft); }
    .title {
      font-weight: 600;
      color: var(--cortex-text);
      font-size: 14px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta { color: var(--cortex-text-subtle); font-size: 12px; }
  `;

  @property() backLabel = "返回";
  @property() title = "";
  @property() meta = "";

  private _back() {
    this.dispatchEvent(new CustomEvent("back", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <button class="back" @click=${this._back}>← ${this.backLabel}</button>
      <div class="title">${this.title}</div>
      ${this.meta ? html`<div class="meta">${this.meta}</div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "focus-header": FocusHeader;
  }
}
```

- [ ] **Step 3: 类型检查并提交**

Run:
```bash
cd cortex/web_v2/frontend && npm run typecheck
git add cortex/web_v2/frontend/src/components/welcome-pane.ts cortex/web_v2/frontend/src/components/focus-header.ts
git commit -m "feat(frontend): add <welcome-pane> and <focus-header> components"
```

---

### Task 19: 实现 `<history-list>` + `<history-item>`

**Files:**
- Create: `cortex/web_v2/frontend/src/components/history-list.ts`
- Create: `cortex/web_v2/frontend/src/components/history-item.ts`

- [ ] **Step 1: 实现 history-item.ts**

`cortex/web_v2/frontend/src/components/history-item.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Session } from "../state/types";

@customElement("history-item")
export class HistoryItem extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--cortex-surface-muted);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: 10px 14px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    :host(:hover) { border-color: var(--cortex-primary); }
    .name { font-size: 14px; color: var(--cortex-text); font-weight: 500; }
    .meta { font-size: 11px; color: var(--cortex-text-subtle); }
  `;

  @property({ attribute: false }) session: Session | null = null;

  private _select() {
    if (!this.session) return;
    this.dispatchEvent(new CustomEvent("select", {
      detail: { session: this.session },
      bubbles: true, composed: true,
    }));
  }

  render() {
    if (!this.session) return null;
    return html`
      <div class="name">${this.session.title}</div>
      <div class="meta">${this.session.message_count} · ${new Date(this.session.updated_at).toLocaleDateString()}</div>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this._select);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._select);
    super.disconnectedCallback();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-item": HistoryItem;
  }
}
```

- [ ] **Step 2: 实现 history-list.ts**

`cortex/web_v2/frontend/src/components/history-list.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Session } from "../state/types";

@customElement("history-list")
export class HistoryList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-3) var(--cortex-space-6);
      flex: 1;
      overflow-y: auto;
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--cortex-text-subtle);
      margin: 0 0 var(--cortex-space-2) 0;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: 13px;
      text-align: center;
      padding: var(--cortex-space-6);
    }
  `;

  @property() title = "历史会话";
  @property({ attribute: false }) sessions: Session[] = [];

  private _onSelect(e: CustomEvent<{ session: Session }>) {
    this.dispatchEvent(new CustomEvent("select", {
      detail: e.detail,
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      <div class="title">${this.title}</div>
      ${this.sessions.length === 0
        ? html`<div class="empty">暂无历史会话</div>`
        : this.sessions.map((s) => html`<history-item .session=${s} @select=${this._onSelect}></history-item>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-list": HistoryList;
  }
}
```

- [ ] **Step 3: 类型检查并提交**

```bash
cd cortex/web_v2/frontend && npm run typecheck
git add cortex/web_v2/frontend/src/components/history-list.ts cortex/web_v2/frontend/src/components/history-item.ts
git commit -m "feat(frontend): add <history-list> and <history-item> with vertical layout"
```

---

### Task 20: 实现 `<result-card>` + `<search-results>` + `<preview-pane>`

**Files:**
- Create: `cortex/web_v2/frontend/src/components/result-card.ts`
- Create: `cortex/web_v2/frontend/src/components/search-results.ts`
- Create: `cortex/web_v2/frontend/src/components/preview-pane.ts`

- [ ] **Step 1: 实现 result-card.ts**

`cortex/web_v2/frontend/src/components/result-card.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { SearchResult } from "../state/types";

@customElement("result-card")
export class ResultCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    :host([active]) {
      border-color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
    }
    :host(:hover) { border-color: var(--cortex-primary); }
    .path { font-size: 11px; color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); }
    .snippet {
      font-size: 13px;
      color: var(--cortex-text);
      margin-top: 4px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    mark {
      background: #FEF3C7;
      color: inherit;
      padding: 0 2px;
      border-radius: 2px;
    }
  `;

  @property({ attribute: false }) result: SearchResult | null = null;
  @property({ type: Boolean, reflect: true }) active = false;

  private _select() {
    if (!this.result) return;
    this.dispatchEvent(new CustomEvent("select", {
      detail: { result: this.result },
      bubbles: true, composed: true,
    }));
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this._select);
  }
  disconnectedCallback() {
    this.removeEventListener("click", this._select);
    super.disconnectedCallback();
  }

  render() {
    if (!this.result) return null;
    return html`
      <div class="path">${this.result.path}${this.result.line ? `:${this.result.line}` : ""}</div>
      <div class="snippet">${this.result.snippet}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "result-card": ResultCard;
  }
}
```

- [ ] **Step 2: 实现 search-results.ts**

`cortex/web_v2/frontend/src/components/search-results.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { SearchResult } from "../state/types";

@customElement("search-results")
export class SearchResults extends LitElement {
  static styles = css`
    :host {
      display: flex;
      gap: var(--cortex-space-4);
      flex: 1;
      min-height: 0;
    }
    .list-pane {
      flex: 0 0 40%;
      min-width: 280px;
      max-width: 480px;
      background: var(--cortex-surface-muted);
      border-right: 1px solid var(--cortex-border);
      padding: var(--cortex-space-3);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: 13px;
      text-align: center;
      padding: var(--cortex-space-8);
    }
    /* 桌面：双栏，列表 + 预览；移动：单栏，点击触发 push */
    @media (max-width: 1023px) {
      :host { flex-direction: column; }
      .list-pane {
        flex: 1; max-width: none; min-width: 0;
        border-right: none; border-bottom: 1px solid var(--cortex-border);
      }
    }
  `;

  @property({ attribute: false }) results: SearchResult[] = [];
  @property({ attribute: false }) activePath: string | null = null;

  private _onSelect(e: CustomEvent<{ result: SearchResult }>) {
    this.dispatchEvent(new CustomEvent("select", {
      detail: e.detail,
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      <div class="list-pane">
        ${this.results.length === 0
          ? html`<div class="empty">无搜索结果</div>`
          : this.results.map((r) => html`
              <result-card
                .result=${r}
                ?active=${this.activePath === r.path}
                @select=${this._onSelect}>
              </result-card>`)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "search-results": SearchResults;
  }
}
```

> **说明：** `<preview-pane>` 在 `<search-results>` 外部由父视图（`<search-view>`）渲染，便于桌面双栏布局和移动端整页推入的统一管理。

- [ ] **Step 3: 实现 preview-pane.ts**

`cortex/web_v2/frontend/src/components/preview-pane.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("preview-pane")
export class PreviewPane extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      background: var(--cortex-surface);
      overflow: hidden;
    }
    .header {
      font-size: 13px;
      color: var(--cortex-text);
      padding: 10px 14px;
      border-bottom: 1px solid var(--cortex-border);
      font-family: var(--cortex-font-mono);
      flex-shrink: 0;
    }
    .body {
      flex: 1;
      overflow: auto;
      padding: 12px 14px;
      font-family: var(--cortex-font-mono);
      font-size: 12px;
      line-height: 1.7;
      color: var(--cortex-text);
      white-space: pre;
    }
    .highlight { background: #FEF3C7; padding: 0 2px; border-radius: 2px; }
    .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      font-size: 13px;
    }
  `;

  @property() path = "";
  @property() language = "text";
  @property() content = "";
  @property({ attribute: false }) highlights: number[] = [];
  @property({ type: Boolean }) loading = false;

  render() {
    if (this.loading) return html`<div class="empty">加载中...</div>`;
    if (!this.content) return html`<div class="empty">点击左侧结果查看预览</div>`;
    const lines = this.content.split("\n");
    return html`
      <div class="header">${this.path}</div>
      <div class="body">
        ${lines.map((line, i) => {
          const lineNo = i + 1;
          const cls = this.highlights.includes(lineNo) ? "highlight" : "";
          return html`<div class=${cls}><span style="color:var(--cortex-text-subtle;display:inline-block;width:40px;">${lineNo}</span>${line}</div>`;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "preview-pane": PreviewPane;
  }
}
```

- [ ] **Step 4: 类型检查并提交**

```bash
cd cortex/web_v2/frontend && npm run typecheck
git add cortex/web_v2/frontend/src/components/result-card.ts cortex/web_v2/frontend/src/components/search-results.ts cortex/web_v2/frontend/src/components/preview-pane.ts
git commit -m "feat(frontend): add <result-card>, <search-results>, <preview-pane>"
```

---

### Task 21: 实现 `<chat-message>` + `<chat-stream>`

**Files:**
- Create: `cortex/web_v2/frontend/src/components/chat-message.ts`
- Create: `cortex/web_v2/frontend/src/components/chat-stream.ts`

- [ ] **Step 1: 实现 chat-message.ts**

`cortex/web_v2/frontend/src/components/chat-message.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ChatMessage } from "../state/types";

@customElement("chat-message")
export class ChatMessageEl extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 75%;
    }
    :host([role="user"]) { align-self: flex-end; }
    :host([role="assistant"]) { align-self: flex-start; }
    .bubble {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    :host([role="user"]) .bubble {
      background: var(--cortex-primary);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    :host([role="assistant"]) .bubble {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border: 1px solid var(--cortex-border);
      border-bottom-left-radius: 4px;
    }
    .error {
      color: var(--cortex-danger);
      font-size: 12px;
      margin-top: 4px;
    }
  `;

  @property({ reflect: true }) role: "user" | "assistant" = "user";
  @property({ attribute: false }) message: ChatMessage | null = null;
  @property() error: string | null = null;

  render() {
    if (!this.message) return null;
    return html`
      <div class="bubble">${this.message.content}${this.message.content === "" ? html`<span style="opacity:0.6">思考中...</span>` : null}</div>
      ${this.error ? html`<div class="error">⚠️ ${this.error}</div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-message": ChatMessageEl;
  }
}
```

- [ ] **Step 2: 实现 chat-stream.ts**

`cortex/web_v2/frontend/src/components/chat-stream.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ChatMessage } from "../state/types";

@customElement("chat-stream")
export class ChatStream extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      flex: 1;
      padding: var(--cortex-space-4) var(--cortex-space-6);
      overflow-y: auto;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: 13px;
      text-align: center;
      margin-top: var(--cortex-space-8);
    }
  `;

  @property({ attribute: false }) messages: ChatMessage[] = [];

  updated() {
    // 自动滚动到底部
    this.scrollTop = this.scrollHeight;
  }

  render() {
    if (this.messages.length === 0) {
      return html`<div class="empty">开始与 Cortex 对话</div>`;
    }
    return html`
      ${this.messages.map((m) => html`<chat-message role=${m.role} .message=${m}></chat-message>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-stream": ChatStream;
  }
}
```

- [ ] **Step 3: 类型检查并提交**

```bash
cd cortex/web_v2/frontend && npm run typecheck
git add cortex/web_v2/frontend/src/components/chat-message.ts cortex/web_v2/frontend/src/components/chat-stream.ts
git commit -m "feat(frontend): add <chat-message> and <chat-stream> with auto-scroll"
```

---

### Task 22: 实现 `<activity-bar>` + `<tab-bar>`

**Files:**
- Create: `cortex/web_v2/frontend/src/components/activity-bar.ts`
- Create: `cortex/web_v2/frontend/src/components/tab-bar.ts`

- [ ] **Step 1: 实现 activity-bar.ts**

`cortex/web_v2/frontend/src/components/activity-bar.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ViewId } from "../state/types";

@customElement("activity-bar")
export class ActivityBar extends LitElement {
  static styles = css`
    :host {
      display: var(--cortex-show-activity-bar, none);
      flex-direction: column;
      align-items: center;
      width: var(--cortex-activity-bar-width);
      background: #0F172A;
      color: #94A3B8;
      padding: var(--cortex-space-4) 0;
      gap: var(--cortex-space-4);
      flex-shrink: 0;
    }
    button {
      width: 36px; height: 36px;
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: background 0.15s, color 0.15s;
    }
    button:hover { background: rgba(255,255,255,0.08); color: #fff; }
    button.active { background: var(--cortex-primary); color: #fff; }
  `;

  @property() active: ViewId = "search";

  private _items: Array<{ id: ViewId; icon: string; label: string }> = [
    { id: "search", icon: "🔍", label: "搜索" },
    { id: "chat", icon: "💬", label: "对话" },
    { id: "history", icon: "🕘", label: "历史" },
  ];

  private _select(id: ViewId) {
    this.dispatchEvent(new CustomEvent("navigate", {
      detail: { view: id },
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      ${this._items.map((it) => html`
        <button
          class=${this.active === it.id ? "active" : ""}
          title=${it.label}
          @click=${() => this._select(it.id)}>
          ${it.icon}
        </button>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "activity-bar": ActivityBar;
  }
}
```

- [ ] **Step 2: 实现 tab-bar.ts**

`cortex/web_v2/frontend/src/components/tab-bar.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ViewId } from "../state/types";

@customElement("tab-bar")
export class TabBar extends LitElement {
  static styles = css`
    :host {
      display: var(--cortex-show-tab-bar, none);
      flex-direction: row;
      height: var(--cortex-tab-bar-height);
      background: var(--cortex-surface);
      border-top: 1px solid var(--cortex-border);
      padding-bottom: env(safe-area-inset-bottom);
      flex-shrink: 0;
    }
    .tab {
      flex: 1;
      border: none;
      background: transparent;
      color: var(--cortex-text-subtle);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      font-size: 10px;
    }
    .tab.active { color: var(--cortex-primary); font-weight: 600; }
    .tab .icon { font-size: 18px; }
  `;

  @property() active: ViewId = "search";

  private _items: Array<{ id: ViewId; icon: string; label: string }> = [
    { id: "search", icon: "🔍", label: "搜索" },
    { id: "chat", icon: "💬", label: "对话" },
    { id: "history", icon: "🕘", label: "历史" },
  ];

  private _select(id: ViewId) {
    this.dispatchEvent(new CustomEvent("navigate", {
      detail: { view: id },
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      ${this._items.map((it) => html`
        <button
          class="tab ${this.active === it.id ? "active" : ""}"
          @click=${() => this._select(it.id)}>
          <span class="icon">${it.icon}</span>
          <span>${it.label}</span>
        </button>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tab-bar": TabBar;
  }
}
```

- [ ] **Step 3: 类型检查并提交**

```bash
cd cortex/web_v2/frontend && npm run typecheck
git add cortex/web_v2/frontend/src/components/activity-bar.ts cortex/web_v2/frontend/src/components/tab-bar.ts
git commit -m "feat(frontend): add <activity-bar> and <tab-bar> with display-mode switching"
```

---

## Phase G：前端视图（双状态切换）

### Task 23: 实现 `<search-view>`（双状态）

**Files:**
- Create: `cortex/web_v2/frontend/src/views/search-view.ts`

- [ ] **Step 1: 实现 search-view.ts**

`cortex/web_v2/frontend/src/views/search-view.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { AppState, SearchResult, Session } from "../state/types";
import { searchApi } from "../api/search";
import { createSession, appendSession, listSessions } from "../api/sessions";

@customElement("search-view")
export class SearchView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
    }
    .initial-stack {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .input-row {
      padding: var(--cortex-space-4) var(--cortex-space-6);
      flex-shrink: 0;
      background: var(--cortex-surface);
    }
    .focus-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .focus-main {
      display: flex;
      flex: 1;
      min-height: 0;
    }
    .focus-input-bar {
      padding: var(--cortex-space-3) var(--cortex-space-6);
      border-top: 1px solid var(--cortex-border-muted);
      background: var(--cortex-surface);
      flex-shrink: 0;
    }
    /* 移动端：详情整页推入覆盖 */
    .detail-overlay {
      position: absolute;
      inset: 0;
      background: var(--cortex-surface);
      display: flex;
      flex-direction: column;
      z-index: 10;
    }
    @media (min-width: 1024px) {
      .detail-overlay { display: none; }
    }
  `;

  @state() private localQuery = "";
  @state() private loading = false;
  @state() private previewContent = "";
  @state() private previewPath = "";
  @state() private previewLanguage = "text";
  @state() private historySessions: Session[] = [];

  connectedCallback() {
    super.connectedCallback();
    this._loadHistory();
  }

  private async _loadHistory() {
    try {
      const { sessions } = await listSessions({ type: "search", limit: 20 });
      this.historySessions = sessions;
    } catch (e) {
      console.warn("load history failed", e);
    }
  }

  private get viewState() {
    return store.getState().search;
  }

  private async _submit(e: CustomEvent<{ value: string }>) {
    const query = e.detail.value;
    this.localQuery = query;
    actions.setSearchState({ state: "focus", query, results: [], total: 0 });
    this.loading = true;
    try {
      const res = await searchApi({ query });
      const created = await createSession({ type: "search", title: query, preview: query.slice(0, 100) });
      actions.setSearchState({
        state: "focus",
        query,
        results: res.results,
        total: res.total,
        currentSession: {
          id: created.id, type: "search", title: query,
          preview: query.slice(0, 100), updated_at: new Date().toISOString(),
          message_count: res.total,
        },
      });
      await appendSession(created.id, res.results.map((r) => ({
        kind: "result",
        payload: JSON.stringify(r),
      })), res.total);
      this._loadHistory();
    } catch (err) {
      actions.setError(`搜索失败: ${(err as Error).message}`);
    } finally {
      this.loading = false;
    }
  }

  private _backToInitial() {
    actions.setSearchState({ state: "initial", currentSession: null, results: [], query: "" });
    this.localQuery = "";
    this._loadHistory();
  }

  private async _onResultSelect(e: CustomEvent<{ result: SearchResult }>) {
    const r = e.detail.result;
    actions.pushDetail(r);
    // 拉取预览
    try {
      const params = new URLSearchParams({ path: r.path });
      if (r.line) params.set("start_line", String(Math.max(1, r.line - 10)));
      if (r.line) params.set("end_line", String(r.line + 20));
      const res = await fetch(`/api/preview?${params}`);
      if (res.ok) {
        const body = await res.json();
        this.previewContent = body.content;
        this.previewPath = body.path;
        this.previewLanguage = body.language;
      }
    } catch (e) {
      console.warn("preview failed", e);
    }
  }

  private _popDetail() {
    actions.popDetail();
  }

  private async _onHistorySelect(e: CustomEvent<{ session: Session }>) {
    const s = e.detail.session;
    actions.setSearchState({
      state: "focus",
      currentSession: s,
      query: s.title,
    });
    // 从后端加载会话内容
    try {
      const res = await fetch(`/api/sessions/${s.id}`);
      if (res.ok) {
        const body = await res.json();
        const results = (body.items || [])
          .filter((i: any) => i.kind === "result")
          .map((i: any) => JSON.parse(i.payload));
        actions.setSearchState({ results, total: results.length });
      }
    } catch (e) {
      console.warn("load session failed", e);
    }
  }

  render() {
    const s = this.viewState;
    if (s.state === "initial") {
      return html`
        <div class="initial-stack">
          <welcome-pane heading="Cortex" subheading="结构感知文档检索"></welcome-pane>
          <history-list
            title="历史会话"
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}>
          </history-list>
          <div class="input-row">
            <input-box
              placeholder="输入搜索关键词..."
              button-label="搜索"
              button-icon="🔍"
              .value=${this.localQuery}
              @input-change=${(e: any) => (this.localQuery = e.detail.value)}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;
    }
    // focus 状态
    const detailTop = store.getState().detailStack[store.getState().detailStack.length - 1];
    return html`
      <div class="focus-body">
        <focus-header
          back-label="新搜索"
          title=${s.query}
          meta=${`${s.total} 条结果`}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main">
          <search-results
            .results=${s.results}
            .activePath=${detailTop?.path ?? null}
            @select=${this._onResultSelect}>
          </search-results>
          <preview-pane
            class="desktop-only"
            path=${this.previewPath}
            language=${this.previewLanguage}
            content=${this.previewContent}>
          </preview-pane>
        </div>
        <div class="focus-input-bar">
          <input-box
            placeholder="重新搜索..."
            button-label="🔍"
            .value=${this.localQuery}
            @input-change=${(e: any) => (this.localQuery = e.detail.value)}
            @submit=${this._submit}>
          </input-box>
        </div>
      </div>
      ${detailTop ? html`
        <div class="detail-overlay">
          <focus-header
            back-label="结果"
            title=${detailTop.path}
            @back=${this._popDetail}>
          </focus-header>
          <preview-pane
            path=${this.previewPath}
            language=${this.previewLanguage}
            content=${this.previewContent}>
          </preview-pane>
        </div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "search-view": SearchView;
  }
}
```

- [ ] **Step 2: 类型检查并提交**

```bash
cd cortex/web_v2/frontend && npm run typecheck
git add cortex/web_v2/frontend/src/views/search-view.ts
git commit -m "feat(frontend): add <search-view> with initial/focus dual-state"
```

---

### Task 24: 实现 `<chat-view>`（双状态）

**Files:**
- Create: `cortex/web_v2/frontend/src/views/chat-view.ts`

- [ ] **Step 1: 实现 chat-view.ts**

`cortex/web_v2/frontend/src/views/chat-view.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { Session } from "../state/types";
import { chatStream } from "../api/chat";
import { createSession, appendSession, listSessions } from "../api/sessions";

@customElement("chat-view")
export class ChatView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
    }
    .initial-stack {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .input-row {
      padding: var(--cortex-space-4) var(--cortex-space-6);
      flex-shrink: 0;
    }
    .focus-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .input-bar {
      padding: var(--cortex-space-3) var(--cortex-space-6);
      border-top: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
  `;

  @state() private draft = "";
  @state() private historySessions: Session[] = [];

  connectedCallback() {
    super.connectedCallback();
    this._loadHistory();
  }

  private async _loadHistory() {
    try {
      const { sessions } = await listSessions({ type: "chat", limit: 20 });
      this.historySessions = sessions;
    } catch (e) {
      console.warn("load history failed", e);
    }
  }

  private get viewState() {
    return store.getState().chat;
  }

  private async _submit(e: CustomEvent<{ value: string }>) {
    const message = e.detail.value;
    this.draft = "";

    // 转入 focus 态
    if (this.viewState.state === "initial") {
      const created = await createSession({ type: "chat", title: message.slice(0, 60), preview: message.slice(0, 100) });
      actions.setChatState({
        state: "focus",
        currentSession: {
          id: created.id, type: "chat", title: message.slice(0, 60),
          preview: message.slice(0, 100), updated_at: new Date().toISOString(),
          message_count: 0,
        },
        messages: [{ role: "user", content: message }],
        streaming: true,
      });
    } else {
      actions.setChatState({
        messages: [...this.viewState.messages, { role: "user", content: message }],
        streaming: true,
      });
    }

    const sessionId = store.getState().chat.currentSession!.id;

    // 添加 assistant 占位
    actions.setChatState({
      messages: [...store.getState().chat.messages, { role: "assistant", content: "" }],
    });

    try {
      let aiText = "";
      for await (const ev of chatStream({ message, session_id: sessionId })) {
        if (ev.type === "token") {
          aiText += ev.text;
          const msgs = [...store.getState().chat.messages];
          msgs[msgs.length - 1] = { role: "assistant", content: aiText };
          actions.setChatState({ messages: msgs });
        } else if (ev.type === "error") {
          const msgs = [...store.getState().chat.messages];
          msgs[msgs.length - 1] = { role: "assistant", content: aiText + `\n\n⚠️ ${ev.detail}` };
          actions.setChatState({ messages: msgs });
        }
      }

      // 持久化
      await appendSession(sessionId, [
        { kind: "message_user", payload: JSON.stringify({ content: message }) },
        { kind: "message_ai", payload: JSON.stringify({ content: aiText }) },
      ], store.getState().chat.messages.length);
      this._loadHistory();
    } catch (err) {
      actions.setError(`对话失败: ${(err as Error).message}`);
    } finally {
      actions.setChatState({ streaming: false });
    }
  }

  private _backToInitial() {
    actions.setChatState({ state: "initial", currentSession: null, messages: [] });
    this._loadHistory();
  }

  private async _onHistorySelect(e: CustomEvent<{ session: Session }>) {
    const s = e.detail.session;
    actions.setChatState({
      state: "focus",
      currentSession: s,
      messages: [],
    });
    try {
      const res = await fetch(`/api/sessions/${s.id}`);
      if (res.ok) {
        const body = await res.json();
        const messages = (body.items || []).map((i: any) => {
          const payload = JSON.parse(i.payload);
          return { role: i.kind === "message_user" ? "user" : "assistant", content: payload.content };
        });
        actions.setChatState({ messages });
      }
    } catch (e) {
      console.warn("load session failed", e);
    }
  }

  render() {
    const s = this.viewState;
    if (s.state === "initial") {
      return html`
        <div class="initial-stack">
          <welcome-pane heading="Cortex" subheading="与你的知识库对话"></welcome-pane>
          <history-list
            title="历史会话"
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}>
          </history-list>
          <div class="input-row">
            <input-box
              placeholder="问 Cortex 任何问题..."
              button-label="→"
              multiline
              .value=${this.draft}
              @input-change=${(e: any) => (this.draft = e.detail.value)}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;
    }
    return html`
      <div class="focus-body">
        <focus-header
          back-label="新对话"
          title=${s.currentSession?.title ?? ""}
          meta=${`${s.messages.length} 条消息`}
          @back=${this._backToInitial}>
        </focus-header>
        <chat-stream .messages=${s.messages}></chat-stream>
        <div class="input-bar">
          <input-box
            placeholder="继续对话..."
            button-label="→"
            multiline
            ?disabled=${s.streaming}
            .value=${this.draft}
            @input-change=${(e: any) => (this.draft = e.detail.value)}
            @submit=${this._submit}>
          </input-box>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-view": ChatView;
  }
}
```

- [ ] **Step 2: 类型检查并提交**

```bash
cd cortex/web_v2/frontend && npm run typecheck
git add cortex/web_v2/frontend/src/views/chat-view.ts
git commit -m "feat(frontend): add <chat-view> with SSE streaming and persistence"
```

---

### Task 25: 实现 `<history-view>`

**Files:**
- Create: `cortex/web_v2/frontend/src/views/history-view.ts`

- [ ] **Step 1: 实现 history-view.ts**

`cortex/web_v2/frontend/src/views/history-view.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { listSessions } from "../api/sessions";
import { store, actions } from "../state/store";
import type { Session } from "../state/types";

@customElement("history-view")
export class HistoryView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
    }
  `;

  @state() private sessions: Session[] = [];
  @state() private loading = true;

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  private async _load() {
    this.loading = true;
    try {
      const { sessions } = await listSessions({ limit: 100 });
      this.sessions = sessions;
    } catch (e) {
      console.warn("load history failed", e);
    } finally {
      this.loading = false;
    }
  }

  private _onSelect(e: CustomEvent<{ session: Session }>) {
    const s = e.detail.session;
    if (s.type === "search") {
      actions.setView("search");
    } else {
      actions.setView("chat");
    }
    // 让对应的 view 处理加载（通过全局事件或 store 信号）
    window.dispatchEvent(new CustomEvent("cortex:open-session", { detail: { session: s } }));
  }

  render() {
    return html`
      <welcome-pane heading="历史会话" subheading="全部搜索与对话历史"></welcome-pane>
      <history-list
        title=${this.loading ? "加载中..." : "最近会话"}
        .sessions=${this.sessions}
        @select=${this._onSelect}>
      </history-list>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-view": HistoryView;
  }
}
```

- [ ] **Step 2: 类型检查并提交**

```bash
cd cortex/web_v2/frontend && npm run typecheck
git add cortex/web_v2/frontend/src/views/history-view.ts
git commit -m "feat(frontend): add <history-view> with full session listing"
```

---

### Task 26: 实现 `<cortex-app>`（顶层路由）

**Files:**
- Modify: `cortex/web_v2/frontend/src/app.ts`（替换 Task 12 的占位实现）

- [ ] **Step 1: 实现 cortex-app**

替换 `cortex/web_v2/frontend/src/app.ts` 的全部内容：

```typescript
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import { store, actions } from "./state/store";
import type { ViewId, Session } from "./state/types";

import "./components/activity-bar";
import "./components/tab-bar";
import "./components/welcome-pane";
import "./components/focus-header";
import "./components/history-list";
import "./components/history-item";
import "./components/input-box";
import "./components/result-card";
import "./components/search-results";
import "./components/preview-pane";
import "./components/chat-message";
import "./components/chat-stream";
import "./views/search-view";
import "./views/chat-view";
import "./views/history-view";

@customElement("cortex-app")
export class CortexApp extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      height: 100dvh;
      overflow: hidden;
      background: var(--cortex-bg);
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      position: relative;
    }
    /* 移动端：纵向布局（activity-bar 隐藏，tab-bar 在底部） */
    @media (max-width: 1023px) {
      :host { flex-direction: column; }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    // 监听跨 view 跳转（来自 history-view）
    window.addEventListener("cortex:open-session", this._onOpenSession as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener("cortex:open-session", this._onOpenSession as EventListener);
    super.disconnectedCallback();
  }

  private _onOpenSession = (e: Event) => {
    // 由对应 view 自行处理加载（search-view / chat-view 监听此事件）
    const detail = (e as CustomEvent<{ session: Session }>).detail;
    if (detail.session.type === "search") {
      actions.setView("search");
    } else {
      actions.setView("chat");
    }
    // 触发对应 view 加载（在 view 内部 connectedCallback 已加载；
    // 这里通过 store 切到 focus 态以便 view 自动处理）
    const ev = new CustomEvent("cortex:load-session", {
      detail: { session: detail.session },
      bubbles: true, composed: true,
    });
    setTimeout(() => this.dispatchEvent(ev), 0);
  };

  private _navigate(e: CustomEvent<{ view: ViewId }>) {
    actions.setView(e.detail.view);
  }

  private _renderView() {
    const view = store.getState().view;
    if (view === "search") return html`<search-view></search-view>`;
    if (view === "chat") return html`<chat-view></chat-view>`;
    return html`<history-view></history-view>`;
  }

  render() {
    const view = store.getState().view;
    return html`
      <activity-bar .active=${view} @navigate=${this._navigate}></activity-bar>
      <div class="main">
        ${this._renderView()}
      </div>
      <tab-bar .active=${view} @navigate=${this._navigate}></tab-bar>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cortex-app": CortexApp;
  }
}
```

- [ ] **Step 2: 构建 + 提交**

```bash
cd cortex/web_v2/frontend && npm run build
git add cortex/web_v2/frontend/src/app.ts cortex/web_v2/static/
git commit -m "feat(frontend): add <cortex-app> top-level router with Activity Bar and Tab Bar"
```

---

## Phase H：PWA + 构建集成

### Task 27: 添加 PWA manifest + icons

**Files:**
- Create: `cortex/web_v2/static/manifest.webmanifest`
- Create: `cortex/web_v2/static/icon-192.png`
- Create: `cortex/web_v2/static/icon-512.png`

- [ ] **Step 1: 写 manifest.webmanifest**

`cortex/web_v2/static/manifest.webmanifest`:

```json
{
  "name": "Cortex",
  "short_name": "Cortex",
  "description": "结构感知文档检索",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#F5F5F7",
  "theme_color": "#0D9488",
  "orientation": "any",
  "icons": [
    { "src": "/assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["productivity", "utilities"]
}
```

- [ ] **Step 2: 生成占位 icon**

用 Python PIL 生成 192px 和 512px 的 teal 色 icon：

```bash
.venv/Scripts/python.exe -c "
from PIL import Image, ImageDraw, ImageFont
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
    img = Image.new('RGBA', (size, size), (13, 148, 136, 255))
    draw = ImageDraw.Draw(img)
    # 简单画一个 'C' 字
    try:
        font = ImageFont.truetype('arial.ttf', int(size * 0.6))
    except:
        font = ImageFont.load_default()
    text = 'C'
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1]), text, fill='white', font=font)
    img.save('cortex/web_v2/static/' + name)
    print('saved', name)
"
```

- [ ] **Step 3: 验证 manifest 可被 FastAPI 访问**

修改 `cortex/web_v2/app.py`，在 `health` 端点后追加：

```python
    from fastapi.responses import FileResponse as _FR

    @app.get("/manifest.webmanifest")
    async def _manifest():
        m = STATIC_DIR / "manifest.webmanifest"
        if m.exists():
            return _FR(m, media_type="application/manifest+json")
        return JSONResponse(status_code=404, content={"code": "MANIFEST_MISSING"})
```

> **重要：** 此路由必须在 SPA fallback (`/{full_path:path}`) 之前注册，FastAPI 按顺序匹配。

Run: 手动启动 `cortex gui`，访问 `http://localhost:7860/manifest.webmanifest` 应返回 JSON。

- [ ] **Step 4: 提交**

```bash
git add cortex/web_v2/static/manifest.webmanifest cortex/web_v2/static/icon-192.png cortex/web_v2/static/icon-512.png cortex/web_v2/app.py
git commit -m "feat(pwa): add manifest.webmanifest and placeholder icons"
```

---

### Task 28: 实现 Service Worker

**Files:**
- Create: `cortex/web_v2/static/sw.js`

- [ ] **Step 1: 写 sw.js**

`cortex/web_v2/static/sw.js`:

```javascript
// Cortex Service Worker
// 策略：
//   - /assets/*（带 hash）：cache-first，永久缓存
//   - HTML：network-first，失败回退缓存
//   - /api/*：不拦截（永远走网络）
//   - manifest / sw 自身：network-first
const CACHE_VERSION = "cortex-v1";
const CACHE_NAME = `cortex-static-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(["/", "/manifest.webmanifest"])).catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 不拦截 API
  if (url.pathname.startsWith("/api/")) return;

  // /assets/* cache-first
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }

  // 其他（HTML）：network-first
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match("/"))),
  );
});
```

- [ ] **Step 2: 验证 SW 注册**

手动启动 `cortex gui`，浏览器 DevTools → Application → Service Workers，应看到 `sw.js` 已注册并激活。

- [ ] **Step 3: 提交**

```bash
git add cortex/web_v2/static/sw.js
git commit -m "feat(pwa): add service worker with cache-first assets and network-first HTML"
```

---

### Task 29: 验证 vite build → static/ 与 FastAPI StaticFiles 集成

**Files:**
- Modify: `cortex/web_v2/app.py`（确认 StaticFiles 挂载 + icon 路由）
- Test: manual end-to-end

- [ ] **Step 1: 重新构建前端**

Run:
```bash
cd cortex/web_v2/frontend
npm run build
ls ../static/
```

Expected:
```
index.html
manifest.webmanifest
sw.js
icon-192.png
icon-512.png
assets/
  main.[hash].js
  main.[hash].css
```

- [ ] **Step 2: 补充 FastAPI 对 icon 的路由**

修改 `cortex/web_v2/app.py`，在 manifest 路由后追加：

```python
    @app.get("/assets/icon-{size}.png")
    async def _icon(size: str):
        p = STATIC_DIR / f"icon-{size}.png"
        if p.exists():
            return _FR(p, media_type="image/png")
        return JSONResponse(status_code=404, content={"code": "ICON_MISSING"})
```

（注：assets 目录已通过 `StaticFiles` 挂载，但根目录的 `icon-192.png` 仍需单独路由，或把它们移到 `static/assets/` 子目录 —— 此处采用单独路由方式以保持 manifest.webmanifest 中路径不变。）

修正：把 `manifest.webmanifest` 和 `icon-*.png` 移到 `static/assets/`，并更新 `manifest.webmanifest` 中的 icon 路径。

实际采用更简洁的方案：在 app.py 挂载整个 static/ 目录到根：

```python
    from fastapi.staticfiles import StaticFiles

    # 优先挂载 API（已通过 include_router 完成）
    # 然后挂载 static/ 中的具体文件
    if STATIC_DIR.exists():
        # 关键文件直接挂载
        @app.get("/manifest.webmanifest")
        async def _manifest():
            return _FR(STATIC_DIR / "manifest.webmanifest", media_type="application/manifest+json")

        @app.get("/sw.js")
        async def _sw():
            return _FR(STATIC_DIR / "sw.js", media_type="application/javascript")

        # assets 目录
        assets_dir = STATIC_DIR / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        index = STATIC_DIR / "index.html"
        if index.exists():
            return _FR(index)
        return JSONResponse(
            status_code=404,
            content={"code": "FRONTEND_NOT_BUILT", "detail": "前端未构建，请先 vite build"},
        )
```

- [ ] **Step 3: 端到端冒烟测试**

启动 `cortex gui`（在 `test_work_dir/` 下）：
```bash
cd test_work_dir && ../.venv/Scripts/python.exe -m cortex gui --port 7862
```

浏览器访问 `http://localhost:7862`：
- 应看到完整的 Cortex 界面（不再是 "FRONTEND_NOT_BUILT" 错误）
- Activity Bar 在左（桌面）
- 输入框内嵌右边缘按钮
- 搜索 → 转入 focus 态
- 切换到 AI 对话 → 输入消息 → 看到流式响应（需配置 Anthropic API）

DevTools → Application → Manifest：应识别 PWA（installable）。
DevTools → Application → Service Workers：应看到 sw.js 已激活。

- [ ] **Step 4: 提交**

```bash
git add cortex/web_v2/app.py cortex/web_v2/static/
git commit -m "feat(web_v2): mount static files and wire up SPA fallback for production"
```

---

## Phase I：清理 + E2E + 文档

### Task 30: 删除旧 cortex/web/ + 清理代码

**Files:**
- Delete: `cortex/web/`（整个目录）
- Verify: `cortex/cortex_cli.py`、`pyproject.toml` 中无残留 gradio 引用

- [ ] **Step 1: 确认无其它代码引用 cortex.web**

Run:
```bash
grep -r "from cortex.web\b" cortex/ tests/ 2>&1 | grep -v "cortex/web_v2" | grep -v "cortex\.web\."
```

Expected: 应仅匹配 `cortex/web_v2/api/chat.py` 中的 `from cortex.web.emitter import GradioEventEmitter`（这是有意复用 emitter 的代码，删除 web/ 后需要改造）。

- [ ] **Step 2: 改造 chat.py 不依赖 cortex.web.emitter**

复制 `cortex/web/emitter.py` 的 `GradioEventEmitter` 类到 `cortex/web_v2/api/_chat_emitter.py`（或在 chat.py 内联）。

Create: `cortex/web_v2/api/_chat_emitter.py`（复制 cortex/web/emitter.py 的完整内容，无需修改）

修改 `cortex/web_v2/api/chat.py` 中的 import：

```python
# 从：
from cortex.web.emitter import GradioEventEmitter
# 改为：
from cortex.web_v2.api._chat_emitter import GradioEventEmitter
```

- [ ] **Step 3: 删除 cortex/web/ 目录**

Run:
```bash
rm -rf cortex/web
git status
```

Expected: 看到 `cortex/web/` 下所有文件被删除。

- [ ] **Step 4: 移除 pyproject.toml 中的 gradio 依赖**

Edit `pyproject.toml`：

把 `"gradio>=4.0"` 从 `[project.optional-dependencies] cortex = [...]` 列表移除（如果还残留）。

- [ ] **Step 5: 重新安装验证**

Run:
```bash
.venv/Scripts/python.exe -m pip uninstall -y gradio gradio-client 2>&1 | tail -3
.venv/Scripts/python.exe -m pip install -e ".[cortex]" 2>&1 | tail -3
.venv/Scripts/python.exe -c "import gradio" 2>&1
```

Expected: gradio 卸载成功；最后一条命令应 `ModuleNotFoundError: No module named 'gradio'`。

- [ ] **Step 6: 跑全部 web_v2 测试**

Run:
```bash
.venv/Scripts/python.exe -m pytest tests/web_v2/ -v
```

Expected: 全部 passed。

- [ ] **Step 7: 端到端冒烟测试**

```bash
cd test_work_dir && ../.venv/Scripts/python.exe -m cortex gui --port 7863
```

浏览器访问应正常工作（无 gradio 依赖也能完整运行）。

- [ ] **Step 8: 提交**

```bash
git add cortex/web_v2/api/_chat_emitter.py cortex/web_v2/api/chat.py
git rm -rf cortex/web
git add pyproject.toml
git commit -m "refactor(web_v2): remove legacy Gradio cortex/web/ and inline chat emitter"
```

---

### Task 31: Playwright E2E 测试

**Files:**
- Create: `cortex/web_v2/frontend/playwright.config.ts`
- Create: `cortex/web_v2/frontend/tests/e2e/full-flow.spec.ts`

- [ ] **Step 1: 写 playwright.config.ts**

`cortex/web_v2/frontend/playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:7860",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-iphone", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "cd ../../../test_work_dir && ../.venv/Scripts/python.exe -m cortex gui --port 7860",
    port: 7860,
    timeout: 30_000,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: 写 E2E 测试**

`cortex/web_v2/frontend/tests/e2e/full-flow.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Cortex Full Flow", () => {
  test("desktop: initial state shows welcome + history + input", async ({ page }) => {
    await page.goto("/");
    // Welcome
    await expect(page.locator("welcome-pane").shadowRoot!.locator(".title")).toHaveText("Cortex");
    // Input with inline button
    const input = page.locator("input-box").shadowRoot!.locator("input");
    await expect(input).toBeVisible();
    // Activity bar visible on desktop
    await expect(page.locator("activity-bar")).toBeVisible();
  });

  test("search transitions to focus state", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input-box").shadowRoot!.locator("input");
    await input.fill("test");
    await page.locator("input-box").shadowRoot!.locator("button").click();

    // Should see focus-header
    await expect(page.locator("focus-header")).toBeVisible();
    // Should see results or empty state
    await expect(page.locator("search-results")).toBeVisible();
  });

  test("mobile: tab bar visible, activity bar hidden", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator("tab-bar")).toBeVisible();
    // Activity bar uses CSS var to hide on mobile; verify by computed style
    const abDisplay = await page.locator("activity-bar").evaluate(
      (el) => getComputedStyle(el).display,
    );
    expect(abDisplay).toBe("none");
    await ctx.close();
  });

  test("switching between search and chat", async ({ page }) => {
    await page.goto("/");
    // Click chat activity
    await page.locator("activity-bar").shadowRoot!.locator("button[title='对话']").click();
    // Should see chat-view
    await expect(page.locator("chat-view")).toBeVisible();
    // Click back to search
    await page.locator("activity-bar").shadowRoot!.locator("button[title='搜索']").click();
    await expect(page.locator("search-view")).toBeVisible();
  });
});
```

- [ ] **Step 3: 安装 Playwright 浏览器**

Run:
```bash
cd cortex/web_v2/frontend
npx playwright install chromium
```

- [ ] **Step 4: 运行 E2E**

Run:
```bash
cd cortex/web_v2/frontend && npm run test:e2e
```

Expected: 4 passed（若搜索因索引数据不足而失败，确认 focus-header 至少出现即可）。

- [ ] **Step 5: 提交**

```bash
git add cortex/web_v2/frontend/playwright.config.ts cortex/web_v2/frontend/tests/e2e/full-flow.spec.ts
git commit -m "test(e2e): add Playwright flows for desktop and mobile viewports"
```

---

### Task 32: 更新 CLAUDE.md 文档

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 更新技术栈表**

在 `CLAUDE.md` 的"Cortex 技术栈 / 核心技术"表中，移除 `Textural` 一行（若有），新增：

```markdown
| 技术 | 用途 |
|------|------|
| FastAPI | Web API 框架（替代 Gradio） |
| Lit + Shoelace | 前端 SPA（Web Components） |
| Vite | 前端构建工具 |
| SQLite | 历史会话存储（.cortex/sessions.db） |
| uvicorn | ASGI 服务器 |
| SSE (sse-starlette) | AI 对话流式响应 |
```

- [ ] **Step 2: 更新项目结构**

把 `cortex/` 部分中的 `cortex/web/...` 替换为 `cortex/web_v2/...`（结构见 spec/plan）。

- [ ] **Step 3: 更新正常运行章节**

把：
```bash
.venv/Scripts/python.exe -m cortex
```

改为补充说明：

```markdown
### TUI 界面（交互式）

```bash
.venv/Scripts/python.exe -m cortex
```

### Web UI（PWA，桌面/移动）

```bash
.venv/Scripts/python.exe -m cortex gui
# 浏览器自动打开 http://localhost:7860
# 选项：--port PORT / --host HOST / --share (deprecated)
```

前端开发模式（需 Node.js 18+）：
```bash
cd cortex/web_v2/frontend && npm install && npm run dev
# Vite dev server on http://localhost:5173，自动代理 /api → 7860
```

前端构建（开发者改动后需重新构建）：
```bash
cd cortex/web_v2/frontend && npm run build
# 输出到 cortex/web_v2/static/（已 git 跟踪）
```
```

- [ ] **Step 4: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for FastAPI + Lit Web UI (web_v2)"
```

---

## 完成验收

执行完所有 32 个任务后，验证：

- [ ] `cortex gui` 单命令启动前后端（http://localhost:7860）
- [ ] 桌面端（≥1024px）：Activity Bar + 双状态切换正常
- [ ] 移动端（<1024px）：底部 Tab Bar + 详情整页推入正常
- [ ] 输入框内嵌按钮样式全局一致
- [ ] 搜索专注状态：双栏（结果 + 预览）+ 底部输入框
- [ ] AI 对话：SSE 流式响应
- [ ] 历史会话：后端 SQLite 持久化，跨会话保留
- [ ] PWA installable：Chrome 地址栏出现安装按钮
- [ ] Service Worker：离线可加载已缓存静态资源
- [ ] `pytest tests/web_v2/ -v` 全部通过
- [ ] `cd cortex/web_v2/frontend && npm test && npm run test:e2e` 全部通过
- [ ] Gradio 完全移除：`pip list | grep gradio` 无输出
- [ ] `cortex search`、`cortex ai`、`cortex index` 等 CLI 子命令不受影响

---

## 自审记录（plan 作者自查）

**Spec 覆盖检查：**
- spec §3（架构总览）→ Tasks 1-4, 11, 29 ✅
- spec §4（目录结构）→ 全部任务 ✅
- spec §5（REST API）→ Tasks 6-10 ✅
- spec §6（SQLite）→ Task 5, 8 ✅
- spec §7（前端组件）→ Tasks 17-22, 23-26 ✅
- spec §8（数据流）→ Tasks 23, 24 ✅
- spec §9（响应式断点）→ Task 14, 22, 26 ✅
- spec §10（PWA）→ Tasks 27-29 ✅
- spec §11（错误处理）→ Tasks 3, 16 ✅
- spec §12（测试策略）→ Tasks 2-10, 17, 31 ✅
- spec §13（CLI 改动）→ Task 11 ✅
- spec §14（依赖管理）→ Task 1, 30 ✅
- spec §15（删除清单）→ Task 30 ✅
- spec §16（风险缓解）→ Task 30 内联 emitter + grep 验证 ✅

**类型一致性检查：**
- `Session.id` / `Session.type` / `Session.title` 在前后端模型一致 ✅
- `SearchResult.path` / `.snippet` / `.score` / `.line` / `.highlights` 一致 ✅
- `ChatMessage.role` ("user" | "assistant") / `.content` 一致 ✅
- `SessionItem.kind` ("message_user" | "message_ai" | "result") 前后端一致 ✅
- `actions.setSearchState` / `actions.setChatState` / `actions.pushDetail` / `actions.popDetail` 命名一致 ✅
