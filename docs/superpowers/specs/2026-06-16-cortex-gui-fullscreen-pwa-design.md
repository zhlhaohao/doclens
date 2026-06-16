# Cortex GUI 全屏沉浸式 PWA 改造设计

**日期**：2026-06-16
**状态**：已确认（待用户审查）
**作者**：brainstorming session
**关联文档**：
- `specs/search_page_spec.md`（Bento Grid 设计规范）
- `docs/superpowers/specs/2026-06-06-gradio-web-ui-design.md`（初始 Gradio Web UI 设计，本设计替代）

---

## 1. 目标与范围

### 目标
将 Cortex GUI 从基于 Gradio 的百分比宽度布局改造为**沉浸式 PWA / Web App 全屏体验**，同时**适配桌面端和移动端**，并通过 `cortex gui` 一条命令同时启动前后端。

### 范围
- **新增**：FastAPI 后端 + Lit/Shoelace SPA 前端 + PWA 配置
- **替换**：现有 `cortex/web/`（Gradio 实现）整体移除
- **保留**：现有业务逻辑层（`IndexManager` / `CortexAgent` / `FileWatcher` / `EventBus`）原样复用
- **不包含**：TUI 界面改动、CLI 其它子命令改动、索引引擎改动

### 非目标
- 多用户鉴权 / 远程部署（仍为本地单用户）
- 离线 AI 对话（API 必须在线）
- 离线索引（仍依赖本地索引文件）
- 公网分享（`--share` 不再支持）

---

## 2. 决策汇总

| 维度 | 决策 |
|------|------|
| 全屏模式 | 沉浸式 PWA / Web App（`display: standalone`） |
| 技术路线 | 去掉 Gradio，纯 FastAPI + SPA |
| 后端 | FastAPI + REST API（不挂载 Gradio Blocks） |
| 前端框架 | Vanilla JS + Vite + TypeScript |
| UI 组件 | Lit（自定义业务组件）+ Shoelace（80+ 基础组件） |
| 布局范式 | Activity Bar 模式（VS Code 风格）+ 双状态 |
| 初始状态 | 纵向三段：欢迎 / 历史会话 / 输入框，填满整宽 |
| 专注状态 | 隐藏欢迎与历史；搜索输入框下置；对话流 + 底部输入 |
| 移动端 | 底部 Tab Bar + 同构双状态 + 详情整页推入 |
| 输入框 | 全局内嵌右边缘按钮样式 |
| 响应式断点 | 移动 <640px；平板 640–1023px（同移动行为）；桌面 ≥1024px（双栏，含 Activity Bar） |
| 后端通信 | REST + SSE（流式对话） |
| 历史会话存储 | 后端 SQLite（`.cortex/sessions.db`） |
| 会话 ID | ULID（有序 + 唯一） |
| PWA 能力 | installable、静态资源离线、SSE 流式、自动打开浏览器 |
| CLI 入口 | `cortex gui` 单命令启动（uvicorn 跑 FastAPI 同时服务 SPA） |

---

## 3. 架构总览

### 3.1 进程模型

```
用户终端：cortex gui
    └─ cortex.web_v2.app.launch_app(port, host)
          └─ uvicorn.run(fastapi_app)
                │
                ├─ /api/search    ─┐
                ├─ /api/chat      ─┤  复用现有
                ├─ /api/preview   ─┤  IndexManager
                ├─ /api/sessions  ─┤  CortexAgent
                ├─ /api/index     ─┤  FileWatcher
                ├─ /api/status    ─┘
                │
                ├─ /              ─┐  前端 SPA
                └─ /assets/*      ─┘  构建产物
```

**单进程、单端口（默认 7860）、单命令。** 前后端在同一次 `uvicorn.run()` 中启动，用户运行 `cortex gui` 后无需任何额外步骤。

### 3.2 模块分层

```
┌─────────────────────────────────────────┐
│  前端 SPA（浏览器）                       │
│  Lit 组件 + Shoelace + Vite 构建          │
│  通过 fetch / EventSource 调 /api/*      │
└─────────────────────────────────────────┘
                  ↕  HTTP / SSE
┌─────────────────────────────────────────┐
│  Web API 层（cortex/web_v2/api/）        │
│  FastAPI 路由 + Pydantic 模型            │
└─────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────┐
│  业务逻辑层（cortex/ 现有）               │
│  IndexManager / CortexAgent / FileWatcher│
└─────────────────────────────────────────┘
```

### 3.3 单命令启动原理

去掉 Gradio 不影响单命令启动。FastAPI 本身能同时服务静态文件 + REST API。Gradio 本质就是"包装了 FastAPI + 静态文件服务"的小框架，去掉这层包装后结构更清晰。

```python
# cortex/web_v2/app.py
def create_app() -> FastAPI:
    app = FastAPI()
    # 后端 API
    app.include_router(search.router, prefix="/api")
    app.include_router(chat.router, prefix="/api")
    app.include_router(preview.router, prefix="/api")
    app.include_router(sessions.router, prefix="/api")
    app.include_router(index.router, prefix="/api")
    app.include_router(status.router, prefix="/api")
    # 前端静态文件（构建产物）
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"))
    # SPA fallback（所有非 /api 路径返回 index.html）
    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        return FileResponse(STATIC_DIR / "index.html")
    return app

def launch_app(port: int = 7860, host: str = "127.0.0.1", share: bool = False):
    app = create_app()
    url = f"http://localhost:{port}" if host in ("127.0.0.1", "0.0.0.0") else f"http://{host}:{port}"
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=host, port=port)
```

### 3.4 前端构建产物打包

| 时机 | 执行者 | 产物位置 |
|------|------|------|
| 开发期 | 开发者改完前端后 `cd cortex/web_v2/frontend && npm run build` | 输出到 `cortex/web_v2/static/` |
| 提交 | 构建产物 + 源码都提交到 git | 用户 clone/pip install 后直接拿到 |
| 用户运行 | `cortex gui` | FastAPI 直接服务 static/，**无需 Node.js** |

此模式与 Streamlit / Jupyter / Gradio 自身的打包方式一致。

---

## 4. 目录结构

```
cortex/
├── cortex_cli.py             # 改：_cli_gui 内 import 从 web → web_v2
├── web/                      # 删除整个目录
└── web_v2/                   # 新增：整个新实现
    ├── __init__.py
    ├── app.py                # FastAPI create_app() + launch_app()
    ├── deps.py               # 全局单例（IndexManager / CortexAgent）
    ├── api/
    │   ├── __init__.py
    │   ├── search.py
    │   ├── chat.py
    │   ├── preview.py
    │   ├── sessions.py
    │   ├── index.py
    │   ├── status.py
    │   └── errors.py
    ├── models/
    │   ├── __init__.py
    │   ├── search.py
    │   ├── chat.py
    │   ├── preview.py
    │   └── session.py
    ├── sessions_store.py     # SQLite 持久化
    ├── static/               # 前端构建产物（提交到 git）
    │   ├── index.html
    │   ├── manifest.webmanifest
    │   ├── sw.js
    │   ├── icon-192.png
    │   ├── icon-512.png
    │   └── assets/
    │       ├── main.[hash].js
    │       ├── main.[hash].css
    │       └── vendor.[hash].js
    └── frontend/             # 前端源码（提交到 git）
        ├── package.json
        ├── vite.config.ts
        ├── tsconfig.json
        ├── index.html
        ├── src/
        │   ├── main.ts
        │   ├── app.ts                    # <cortex-app>
        │   ├── styles/
        │   │   ├── tokens.css            # CSS Variables
        │   │   ├── breakpoints.css       # @media 断点
        │   │   └── global.css
        │   ├── api/
        │   │   ├── client.ts             # fetch 封装 + ApiError
        │   │   ├── search.ts
        │   │   ├── chat.ts               # SSE 流读取
        │   │   └── sessions.ts
        │   ├── state/
        │   │   ├── store.ts              # 自定义 store（订阅模式）
        │   │   └── types.ts
        │   ├── components/
        │   │   ├── activity-bar.ts
        │   │   ├── tab-bar.ts
        │   │   ├── welcome-pane.ts
        │   │   ├── history-list.ts
        │   │   ├── history-item.ts
        │   │   ├── input-box.ts          # 内嵌按钮输入框（核心）
        │   │   ├── search-results.ts
        │   │   ├── result-card.ts
        │   │   ├── preview-pane.ts
        │   │   ├── chat-stream.ts
        │   │   ├── chat-message.ts
        │   │   └── focus-header.ts
        │   └── views/
        │       ├── search-view.ts        # 初始 + 专注切换
        │       ├── chat-view.ts
        │       └── history-view.ts
        └── tests/
            ├── search.spec.ts
            ├── chat.spec.ts
            └── e2e/                       # Playwright
                └── full-flow.spec.ts
```

**关键约定：**
- `frontend/` 源码 + `static/` 构建产物都提交到 git（用户偏好）
- `frontend/dist/`（vite 默认输出）在 `.gitignore` 中
- `vite.config.ts` 配置 `build.outDir: '../static'` 直接输出到 static/

---

## 5. 后端 API 设计

### 5.1 端点清单

| 方法 | 路径 | 用途 |
|------|------|------|
| `POST` | `/api/search` | 关键词搜索 |
| `POST` | `/api/chat` | AI 对话（SSE 流） |
| `POST` | `/api/chat/cancel` | 取消进行中的对话 |
| `GET`  | `/api/preview` | 文件预览 |
| `GET`  | `/api/sessions?type=search\|chat` | 列出历史会话 |
| `GET`  | `/api/sessions/{id}` | 会话详情 |
| `POST` | `/api/sessions` | 创建/保存会话 |
| `PATCH`| `/api/sessions/{id}` | 更新会话 |
| `DELETE`| `/api/sessions/{id}` | 删除会话 |
| `POST` | `/api/index` | 触发索引（增量/全量，SSE 流） |
| `GET`  | `/api/status` | 系统状态 |
| `GET`  | `/api/health` | 健康检查（PWA SW 用） |

### 5.2 Pydantic 模型

```python
# cortex/web_v2/models/search.py
class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    mode: Literal["keyword", "phrase"] = "keyword"
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

class SearchResult(BaseModel):
    path: str
    snippet: str
    score: float
    line: int | None = None
    highlights: list[tuple[int, int]] = []

class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str
    elapsed_ms: int
```

```python
# cortex/web_v2/models/session.py
class SessionType(str, Enum):
    SEARCH = "search"
    CHAT = "chat"

class SessionSummary(BaseModel):
    id: str
    type: SessionType
    title: str
    preview: str          # ≤200 字符
    created_at: datetime
    updated_at: datetime
    message_count: int    # 对话：消息数；搜索：结果数
```

### 5.3 Handler 示例

```python
# cortex/web_v2/api/search.py
@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, idx: IndexManager = Depends(get_index_manager)):
    raw = idx.search(req.query, limit=req.limit, offset=req.offset)
    results = [SearchResult(**r) for r in raw]
    return SearchResponse(results=results, total=len(results), query=req.query, elapsed_ms=...)
```

```python
# cortex/web_v2/api/chat.py
@router.post("/chat")
async def chat(req: ChatRequest, agent: CortexAgent = Depends(get_agent)):
    async def event_stream():
        async for chunk in agent.run_query_stream(req.message, req.session_id):
            yield {"event": "token", "data": json.dumps({"text": chunk})}
        yield {"event": "done", "data": "{}"}
    return EventSourceResponse(event_stream())
```

---

## 6. 持久化设计

### 6.1 SQLite Schema

存储位置：`.cortex/sessions.db`

```sql
CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,        -- ULID
    type        TEXT NOT NULL,           -- 'search' | 'chat'
    title       TEXT NOT NULL,
    preview     TEXT NOT NULL,           -- ≤200 字符
    created_at  TEXT NOT NULL,           -- ISO8601
    updated_at  TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sessions_type_updated ON sessions(type, updated_at DESC);

CREATE TABLE session_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,
    kind        TEXT NOT NULL,           -- 'message_user' | 'message_ai' | 'result'
    payload     TEXT NOT NULL,           -- JSON
    created_at  TEXT NOT NULL
);
CREATE INDEX idx_items_session ON session_items(session_id, seq);
```

### 6.2 写入策略

- 用户提交首条消息 / 首次搜索时：`INSERT sessions`
- 后续追加：`INSERT session_items`，并 `UPDATE sessions SET updated_at, message_count`
- 流式对话完成时：在 `done` 事件前持久化 user_message + ai_message

### 6.3 查询模式

- 历史列表：`SELECT FROM sessions WHERE type=? ORDER BY updated_at DESC LIMIT ? OFFSET ?`
- 会话详情：先 `SELECT FROM sessions WHERE id=?`，再 `SELECT FROM session_items WHERE session_id=? ORDER BY seq`

---

## 7. 前端组件设计

### 7.1 自定义 Lit 组件树

```
<cortex-app>                       顶层：路由 + 状态切换
├── <activity-bar>                 桌面：左侧 32px 竖条；移动：不渲染
├── <tab-bar>                      移动：底部 tab；桌面：不渲染
└── <main-region>
    ├── [view=search]
    │   ├── <search-view state="initial">
    │   │   ├── <welcome-pane>
    │   │   ├── <history-list type="search">
    │   │   └── <input-box button="🔍">
    │   └── <search-view state="focus">
    │       ├── <focus-header>
    │       ├── <search-results>
    │       ├── <preview-pane>
    │       └── <input-box button="🔍">  ← 下置
    ├── [view=chat]
    │   ├── <chat-view state="initial">（同构）
    │   └── <chat-view state="focus">
    │       ├── <focus-header>
    │       ├── <chat-stream>
    │       └── <input-box button="→">
    └── [view=history]
        └── <history-list type="all" mode="full">
```

### 7.2 核心组件契约

**`<input-box>`** —— 内嵌右边缘按钮

```typescript
@property() value = ""
@property() placeholder = ""
@property() buttonIcon = "🔍"
@property() buttonLabel = "搜索"
@property() disabled = false        // value.trim() === "" 时为 true
@property() multiline = false       // 对话模式可设 true

@event("submit") { value: string } // 点按钮 或 Ctrl/Cmd+Enter
@event("input")  { value: string }
```

UI 实现：基于 `<sl-input>` + `suffix` slot 放 `<sl-button>`。桌面 `min-height: 48px`，移动 `min-height: 44px`（触控目标 ≥44px）。

**`<search-view>` / `<chat-view>`** —— 状态切换

```typescript
@property() state: "initial" | "focus" = "initial"
@property() currentSession: Session | null = null

// initial → focus：用户点 history-item 加载 session / 用户 submit 创建空 session
// focus → initial：用户点 focus-header 的返回按钮（session 仍保留在历史）
```

**`<search-results>`** —— 桌面/移动自适应

```css
/* ≥1024px：双栏（结果列表 + 预览面板） */
/* <1024px：单栏列表，点卡片触发详情整页推入（detailStack） */
@media (max-width: 1023px) {
  :host { /* 单栏 */ }
  .preview-pane { display: none; }   /* 详情用整页推入 */
}
```

### 7.3 全局状态（轻量 store）

```typescript
interface AppState {
  view: "search" | "chat" | "history"
  search: { state: "initial"|"focus"; currentSession: Session|null }
  chat:   { state: "initial"|"focus"; currentSession: Session|null }
  detailStack: SearchResult[]        // 移动端详情推入栈
  status: SystemStatus | null
}

class CortexStore implements ReactiveController {
  // 基于 Lit ReactiveController + 订阅模式
  // 不引入 Redux/Zustand
}
```

每个 Lit 组件通过 `consume(ctx)` 装饰器订阅 store 的特定切片。

---

## 8. 数据流

### 8.1 搜索（初始 → 专注）

```
用户输入 "python 异步" → <input-box>.submit
    ↓
search-view 收到 submit
    ↓
store.setState({ search: { state: "focus", currentSession: null } })
    ↓
POST /api/search  → IndexManager.search()
    ↓
{ results, total }
    ↓
POST /api/sessions  → 创建 session（type=search, title=query）
    ↓
{ id: "01J..." }
    ↓
store.setState({ search.currentSession: { id, results, ... } })
    ↓
<search-results> 渲染卡片
```

### 8.2 AI 对话（流式）

```
用户输入 "FTS5 和 BM25 区别" → <input-box>.submit
    ↓
chat-view 收到 submit
    ↓
store.setState({ chat: { state: "focus", currentSession: newSession } })
    ↓
POST /api/chat (SSE)  → CortexAgent.run_query_stream()
    ↓
for await (chunk of sseStream) {
    chat-view.appendAIMessage(chunk.delta)
}
    ↓
[流结束]
POST /api/sessions/{id}  → 追加 user_message + ai_message
```

### 8.3 移动端详情推入

```
用户点 <result-card path="async/utils.py:42">
    ↓
detailStack.push({ path, line: 42 })
    ↓
移动端：<preview-pane> 渲染为全屏覆盖层
桌面端：<preview-pane> 渲染为右栏（detailStack 仅取栈顶）
    ↓
GET /api/preview?path=async/utils.py&start_line=...
    ↓
用户点"← 结果"  → detailStack.pop()
```

---

## 9. 响应式断点

```css
/* cortex/web_v2/frontend/src/styles/breakpoints.css */
:root {
  --bp-mobile:  640px;
  --bp-tablet: 1024px;
  --bp-desktop: 1280px;
}

/* Activity Bar 仅 ≥tablet 显示；<tablet 用底部 Tab Bar */
@media (max-width: 1023px) {
  activity-bar { display: none; }
  tab-bar { display: flex; }
}

/* 搜索专注双栏 ≥tablet；<tablet 用单栏 + 详情推入 */
@media (max-width: 1023px) {
  search-results:focus .preview-pane { display: none; }
}
```

| 断点 | 范围 | 行为 |
|------|------|------|
| 移动 | <640px | 单栏；底部 Tab Bar；详情整页推入 |
| 平板 | 640–1023px | 同移动 |
| 桌面 | ≥1024px | Activity Bar；搜索专注双栏（结果列表 + 预览） |

---

## 10. PWA 配置

### 10.1 manifest.webmanifest

```json
{
  "name": "Cortex",
  "short_name": "Cortex",
  "description": "结构感知文档检索",
  "start_url": "/",
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

### 10.2 Service Worker 策略

```javascript
// cortex/web_v2/static/sw.js
const CACHE_VERSION = "cortex-v1";

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return;           // 不拦截 API
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(cacheFirst(e.request));                  // 带 hash，永久缓存
  } else {
    e.respondWith(networkFirst(e.request));                // HTML 走 network-first
  }
});
```

- **installable**：✅ 可"添加到主屏幕"
- **离线**：静态资源离线可用；API 必须在线
- **SW 更新**：通过 `CACHE_VERSION` 升级触发自动更新

### 10.3 沉浸式 CSS

```css
/* global.css */
html, body {
  margin: 0; padding: 0;
  height: 100vh; height: 100dvh;        /* dvh：移动端动态视口高度 */
  overflow: hidden;                      /* 不滚动 body，组件内部滚 */
  overscroll-behavior: none;             /* 禁止下拉刷新 */
  -webkit-tap-highlight-color: transparent;
}

@media (display-mode: standalone) {
  body { user-select: none; }
}
```

```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
```

- `100dvh`：解决移动端地址栏伸缩导致的 layout shift
- `overscroll-behavior: none`：禁止浏览器下拉刷新干扰
- `viewport-fit=cover` + `env(safe-area-inset-*)`：iPhone 刘海屏支持

---

## 11. 错误处理

### 11.1 前端统一错误

```typescript
// api/client.ts
class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) {
    let body;
    try { body = await res.json(); } catch { body = { detail: res.statusText }; }
    throw new ApiError(res.status, body.code ?? "unknown", body.detail ?? "请求失败");
  }
  return res.json();
}
```

### 11.2 后端统一异常

```python
# cortex/web_v2/api/errors.py
class CortexAPIError(Exception):
    def __init__(self, status: int, code: str, detail: str):
        self.status, self.code, self.detail = status, code, detail

@app.exception_handler(CortexAPIError)
async def api_err_handler(_, exc: CortexAPIError):
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "detail": exc.detail},
    )
```

### 11.3 错误码规范

| status | code | 含义 |
|------|------|------|
| 400 | `INVALID_QUERY` | 搜索关键词为空或超长 |
| 404 | `SESSION_NOT_FOUND` | 会话 ID 不存在 |
| 404 | `FILE_NOT_FOUND` | 预览路径无效或越权 |
| 409 | `AGENT_BUSY` | 当前会话已有进行中的对话 |
| 422 | `VALIDATION_ERROR` | Pydantic 校验失败 |
| 500 | `INTERNAL_ERROR` | 未预期错误（含 traceback id） |
| 503 | `INDEX_UNAVAILABLE` | 索引未就绪 |

### 11.4 前端错误展示

- 网络错误 / 503：顶部全宽 `<sl-banner variant="danger">` + 自动重试按钮
- 流式中断：`<chat-message>` 末尾显示"⚠️ 已中断，点击重试"
- 输入校验：`<input-box>` 红框 + 错误提示

---

## 12. 测试策略

| 层 | 工具 | 范围 |
|------|------|------|
| **后端 API 单元** | pytest + httpx.AsyncClient | 所有 `/api/*` 端点；mock IndexManager / CortexAgent |
| **后端集成** | pytest + 真实 IndexManager（temp dir） | search → preview → session 闭环 |
| **持久化** | pytest + temp `.cortex/sessions.db` | CRUD、级联删除、分页 |
| **前端组件** | Vitest + @open-wc/testing | Lit 组件渲染、属性、事件 |
| **前端 E2E** | Playwright | 桌面/移动 viewport 下完整流程 |
| **PWA 验证** | Lighthouse CI | installable、SW、manifest 校验 |

---

## 13. CLI 入口改动

```python
# cortex/cortex_cli.py
def _cli_gui(args, config, idx):
    """Handle `cortex gui` — launch Web UI."""
    from planify.core.logging_config import setup_logging
    setup_logging()
    from cortex.web_v2.app import launch_app   # 改：web → web_v2
    launch_app(port=args.port, host=args.host, share=args.share)
```

**`--share` 参数**：原 Gradio 公网分享无法复用，改为不支持。如需公网访问，用 `--host 0.0.0.0` 暴露局域网，或后续增加 cloudflared 隧道支持（作为 enhancement）。

**自动打开浏览器**：去掉 Gradio 的 `inbrowser=True`，改为 `threading.Timer(1.0, lambda: webbrowser.open(url)).start()`。

---

## 14. 依赖管理

### 14.1 pyproject.toml 改动

```toml
[project.optional-dependencies]
# 移除：cortex = ["trafilatura>=2.0.0", "gradio>=4.0"]
# 新增：
cortex = [
    "trafilatura>=2.0.0",
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.27.0",
    "sse-starlette>=2.0.0",
    "python-multipart>=0.0.9",
    "ulid-py>=1.1",
]
```

去掉 Gradio 后净减少约 30 MB 依赖。

### 14.2 前端依赖（cortex/web_v2/frontend/package.json）

```json
{
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "lit": "^3.0.0",
    "@shoelace-style/shoelace": "^2.13.0",
    "vitest": "^1.0.0",
    "@open-wc/testing": "^4.0.0",
    "@playwright/test": "^1.40.0"
  }
}
```

---

## 15. 旧文件删除清单

| 路径 | 处置 |
|------|------|
| `cortex/web/__init__.py` | 删除 |
| `cortex/web/app.py` | 删除（逻辑迁到 `web_v2/app.py`） |
| `cortex/web/search_tab.py` | 删除（逻辑迁到 `web_v2/api/search.py`） |
| `cortex/web/chat_tab.py` | 删除（逻辑迁到 `web_v2/api/chat.py`） |
| `cortex/web/theme.py` | 删除（CSS 迁到 `frontend/src/styles/`） |
| `cortex/web/deps.py` | 删除（迁到 `web_v2/deps.py`） |
| `cortex/web/emitter.py` | 删除（SSE 在 `web_v2/api/chat.py` 直接实现） |
| `specs/search_page_spec.md` | 保留（参考） |
| `docs/superpowers/specs/2026-06-06-gradio-web-ui-design.md` | 保留（历史） |

`pyproject.toml`：
- 移除 `gradio>=4.0` 依赖
- 移除 `[tool.setuptools.packages.find]` 中 `cortex.web`（自动跟随目录变化）

---

## 16. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 前端构建产物与 Python 包同步 | 用户装到旧产物 | `pyproject.toml` 加 build hook；或 CI 校验 |
| `CortexAgent` 流式接口需改造 | 现有 `run_query` 可能不是原生 async generator | 实施前先调研，必要时加 `run_query_stream` 方法 |
| iOS Safari PWA 限制 | `100dvh` / SW 兼容性 | 用 `dvh` + fallback；SW 注册失败时静默降级 |
| 移除 Gradio 影响其它功能 | 是否有用 `gradio_client` 的测试 | 实施前 grep 确认无其它依赖 |
| `--share` 用户依赖 | 公网分享场景失效 | 文档说明；后续 cloudflared 隧道作为 enhancement |
| SQLite 写入并发 | 多 tab 同时写入 | 启用 WAL 模式；FastAPI 单进程所以实际无并发 |

---

## 17. 后续 enhancement（非本次范围）

- `--share` 公网分享（cloudflared 隧道）
- 会话标签 / pinning
- 导出会话为 Markdown
- 全文搜索历史会话本身
- 多用户 / 鉴权
- 离线 AI 对话（本地模型）
- iOS/Android 原生 shell（Capacitor / Tauri Mobile）
