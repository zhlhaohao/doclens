# Hash Routing — Design Spec

**Date:** 2026-06-22
**Topic:** cortex GUI 前端为每个视图（tab）分配独立 hash 子路径，URL 随视图切换变化
**Status:** Approved (user instructed to skip spec-review gate and proceed to implementation)

## 1. 背景与动机

cortex GUI 的前端（Lit PWA）当前有 4 个视图 `search / chat / files / settings`，但视图切换完全基于内存 store：

- 导航组件（`activity-bar` / `tab-bar` / `app-bar`）dispatch `navigate` 事件
- `<cortex-app>._navigate()` 调 `actions.setView()`，更新 `store.view`
- **URL 全程不变**：刷新丢失视图、无法分享深度链接、浏览器后退键失效

后端 `cortex/web_v2/app.py:64-73` 已有 SPA fallback `GET /{full_path:path}` → `index.html`，但前端从未使用过路径。

本次目标：让每个视图拥有可分享、可前进/后退的 URL。

## 2. 需求总结（用户决策）

| 维度 | 决策 |
|------|------|
| 路由范围 | 仅 tab 子路径，**不含**视图内部状态（chat session、search query、settings scope、files path 等仍在内存中） |
| URL 风格 | Hash 路由（`#/search`、`#/chat`、`#/files`、`#/settings`） |
| URL 覆盖范围 | 4 个视图全部都有 URL（包含非 tab 的 `settings`） |
| 根路径 `/`（无 hash） | `router.init()` 用 `history.replaceState` 修正到 `#/search`，渲染 search |
| 未知 hash（如 `#/foobar`） | fallback 到 `search`：`replaceState` 修正 URL + 渲染 search |
| 后退/前进 | 自然由 `hashchange` 驱动，每次 `navigate` 写入新 hash → 新历史条目 |
| 实现方案 | 方案 A：手写极简路由模块，零依赖 |

## 3. 架构总览

新增独立的 Router 模块，作为 URL ↔ Store 之间的**单向桥梁**。URL 成为 `view` 字段的唯一真相源，store 不再允许绕过 router 直接被外部代码写入 `view`（`router.init()` 内部仍调 `actions.setView` 完成同步）。

```
用户点 tab ──▶ router.navigate(view)
                    │  window.location.hash = "#/chat"
                    ▼
              hashchange 事件
                    │
                    ▼
          router.onHashChange() ──▶ actions.setView(view)
                                         │
                                         ▼
                                    store 通知
                                         │
                                         ▼
                                <cortex-app>.requestUpdate()
                                         │
                                         ▼
                                   渲染对应 view
```

**关键不变量**：
- URL 是 `view` 的唯一真相源
- `actions.setView()` 只由 router 的 `onHashChange` 监听器调用，业务代码不再直接调用
- 后端、Service Worker、Vite 配置**都不需要改动**（FastAPI SPA fallback 已支持深度链接；hash 变化不会发新请求）

## 4. 文件布局

```
cortex/web_v2/frontend/src/
└── router/
    ├── route-map.ts          ⭐ ViewId ↔ hash 的映射常量 + parseHash
    └── router.ts             ⭐ init / navigate / current 公开 API

cortex/web_v2/frontend/tests/
└── router.spec.ts            ⭐ vitest 单元测试

cortex/web_v2/frontend/src/
└── app.ts                    （改：connectedCallback 调 router.init；_navigate 调 router.navigate）
```

## 5. 公开接口

### 5.1 `route-map.ts`

```ts
import type { ViewId } from "../state/types";

export const VIEW_TO_HASH: Record<ViewId, string> = {
  search:   "#/search",
  chat:     "#/chat",
  files:    "#/files",
  settings: "#/settings",
};

export const HASH_TO_VIEW: Record<string, ViewId> = /* 反向映射 */;

export const DEFAULT_VIEW: ViewId = "search";

/** 解析 location.hash 字符串为 ViewId；非法或空返回 null。
 *  容忍未来的 query 串：仅取 `?` 之前的首段匹配。 */
export function parseHash(raw: string): ViewId | null;
```

### 5.2 `router.ts`

```ts
export const router = {
  /** 应用启动时调用一次：规范化 hash + 订阅 hashchange + 同步 store */
  init(): void;
  /** 切换视图：写入 hash，由 hashchange 监听器完成 store 更新 */
  navigate(view: ViewId): void;
  /** 读当前视图（基于 hash 解析，非法/空回退 DEFAULT_VIEW） */
  current(): ViewId;
  /** 测试专用：移除监听 + 清 initialized 标志 */
  _reset(): void;
};
```

## 6. 核心数据流

| 场景 | 流程 |
|------|------|
| 用户点 tab | 导航组件 dispatch `navigate` → `_navigate` → `router.navigate(view)` → `location.hash` 改变 → `hashchange` → `onHashChange` → `actions.setView(view)` → 重渲染 |
| 用户改地址栏 hash | `hashchange` → `onHashChange` → 规范化 + `actions.setView` → 重渲染 |
| 浏览器后退/前进 | `hashchange` → 同上 |
| 初次加载（无 hash） | `connectedCallback` → `router.init()` → `replaceState` 到 `#/search` → `actions.setView("search")` → 渲染 |
| 刷新深度链接 `#/chat` | 同上，hash 合法直接用 |

## 7. 边界与错误处理

| 情况 | 行为 |
|------|------|
| 初次访问 `/`（无 hash） | `router.init()` 用 `history.replaceState` 设 `#/search`（**不污染 history 栈**），渲染 search |
| 访问 `#/foobar`（非法 hash） | `parseHash` → `null` → `normalize` 回退 `search` → `replaceState` 修正 URL → 渲染 search |
| 点击当前已激活的 tab | `navigate` 检测 hash 未变 → 直接 return（天然 no-op，浏览器也不触发 `hashchange`） |
| `router.init()` 被多次调用 | 内部 `initialized` 标志保护，监听器只挂载一次 |
| `hashchange` 中 hash 非法 | `replaceState` 修正 URL（**不会**再次触发 `hashchange`，无递归） |
| `setSettingsScope` 等子状态 | 不进 URL，仅 store 内部维护（用户已确认"仅 tab 子路径"） |

### 7.1 关键不变量防御

- `actions.setView` 的唯一调用者应为 `router.onHashChange` 和 `router.init`。其他业务代码必须通过 `router.navigate` 间接切换视图
- `_navigate(app.ts)` 内对 `settings` 的 `scope` 子参数仍直接调 `actions.setSettingsScope`（因为 scope 不进 URL）

## 8. `app.ts` 改动（最小侵入）

```ts
// before
private _navigate(e: CustomEvent<{ view: ViewId; scope?: "local" | "global" }>) {
  actions.setView(e.detail.view);
  if (e.detail.view === "settings" && e.detail.scope) {
    actions.setSettingsScope(e.detail.scope);
  }
}

connectedCallback() {
  super.connectedCallback();
  this._unsubscribe = store.subscribe(() => this.requestUpdate());
}

// after
private _navigate(e: CustomEvent<{ view: ViewId; scope?: "local" | "global" }>) {
  router.navigate(e.detail.view);
  if (e.detail.view === "settings" && e.detail.scope) {
    actions.setSettingsScope(e.detail.scope);  // scope 仍走 store（不进 URL）
  }
}

connectedCallback() {
  super.connectedCallback();
  router.init();   // 新增：URL ↔ store 双向同步
  this._unsubscribe = store.subscribe(() => this.requestUpdate());
}
```

3 个导航组件（`activity-bar`、`tab-bar`、`app-bar`）**零改动**：仍 dispatch `navigate` 事件，由 `_navigate` 接住。

## 9. 测试策略

### 9.1 单元测试（`tests/router.spec.ts`，vitest + jsdom）

`parseHash` 纯函数：
- `parseHash("#/chat")` → `"chat"`
- `parseHash("")` → `null`
- `parseHash("#/foobar")` → `null`
- `parseHash("#/search?foo=bar")` → `"search"`（容忍未来 query）

`router.current()`：
- mock `location.hash = "#/files"` → 返回 `"files"`
- mock `location.hash = ""` → 返回 `"search"`（DEFAULT_VIEW 回退）

`router.init()`：
- 空 hash → `location.hash` 被设为 `#/search`（用 `replaceState`），`store.view === "search"`
- 合法 hash `#/chat` → `store.view === "chat"`，hash 不变
- 非法 hash `#/foobar` → hash 被修正为 `#/search`，`store.view === "search"`
- 重复调用 → 监听器只挂载一次（mock `addEventListener`）

`router.navigate(view)`：
- 当前在 `#/search`，navigate("chat") → hash 变 `#/chat`，`store.view === "chat"`
- 当前在 `#/chat`，navigate("chat") → 无变化、store 无通知（no-op）

`hashchange` 事件流：
- 手动触发 `window.dispatchEvent(new HashChangeEvent("hashchange"))` 在设置 hash 后 → `store.view` 同步

每个 `it` 前置 `beforeEach`：`router._reset()` + 重置 `location.hash` + 重置 store。

### 9.2 E2E（Playwright，可选追加）

本次实现完成后，可追加一条 E2E：从 `/` 进入 → URL 自动变 `#/search` → 点 chat → URL 变 `#/chat` → 浏览器后退 → URL 回 `#/search` 且 search 视图激活。

E2E 走 `playwright-cli` skill，不在本次必做范围。

### 9.3 回归

- 现有 vitest 套件（`npm run test`）全跑一遍
- `npm run build`（含 `tsc --noEmit`）确认类型干净
- 手测：根路径重定向、tab 切换、后退按钮、深度链接 `#/files`

## 10. 落地步骤

1. 新建 `src/router/route-map.ts`、`src/router/router.ts`
2. 新建 `tests/router.spec.ts`
3. 改 `src/app.ts`（2 处，~3 行）
4. `npm run test`：跑 vitest，绿
5. `npm run build`：typecheck + vite build 产物到 `../static/`
6. 手测：dev server 或 gui 启动后，URL 行为符合预期

## 11. 不在本次范围

- chat session id 进 URL（`#/chat/:id`）
- search query 进 query string（`#/search?q=...`）
- settings scope 进 URL（`#/settings/local`）
- files 当前目录进 URL（`#/files?path=...`）

以上属于"完整可分享状态"方案，本次明确为 YAGNI。Router 模块已为未来扩展预留 —— `parseHash` 取 `?` 前首段的写法允许后续添加 query 解析而不会破坏现有路由。
