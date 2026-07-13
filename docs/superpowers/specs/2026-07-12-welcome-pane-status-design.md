# Welcome Pane 统一状态区 设计

## 目标

在 `welcome-pane`（搜索/对话 tab 初始页共享组件）新增"系统状态区"，统一展示当前工作目录、索引文档数、监控状态、索引大小、上次重建时间、文件类型分布共 6 项信息；移除 app-bar 的 `watch-badge`，消除信息重复；激活闲置的 `/api/status` 数据流；后端补齐 `search_path` 字段。

## 背景

- 搜索 tab 与对话 tab 的初始页**已共用** `<welcome-pane>` 组件（`search-view.ts:538` / `chat-view.ts:565`），仅 `heading/subheading/suffix` props 不同；两 tab 初始页整体结构一致（`welcome-pane` + `history-list` + `input-row` 包在 `.initial-stack`）。
- app-bar 右上角有 `watch-badge` 显示 `📁 N ●监控`（`app-bar.ts:300-309` `_renderWatchBadge`），与状态区规划的"索引文档数 / 监控状态"重复。
- 前端 store 有 `status: SystemStatus | null` 字段（`store.ts:59`），但**从未被加载**——`/api/status` 端点闲置，前端只轮询了 `/api/watch/status`（`watch-polling.ts`）。
- `SystemStatus` 类型只有 `index_path`（索引库 db 路径，如 `.cortex/index.db`），**没有工作目录** `search_path`——工作目录前后端均未暴露给 UI。

## 方案

- 后端 `/api/status` 增返回 `search_path`。
- 前端激活 `getStatus()`：启动时加载 + reindex 完成时刷新，写入 `store.status`。
- `welcome-pane` 订阅 `store.status + store.watcher`，在副标题下方渲染"状态区"（分组列表，4 行覆盖 6 项）。
- app-bar 移除 `watch-badge`；保留 reindex 完成的 toast 反馈。
- 两个 tab 的 `heading/subheading/suffix` 保留各自特色（不强行统一文案）；**统一的是状态区**（两 tab 显示相同系统状态）。

## 架构

### 数据流（端到端）

```
cortex-app 启动
  → startWatchPolling()
    → refreshStatus(): getStatus() → store.status              ← 启动加载
    → tick()（每 5s）: getWatchStatus() → store.watcher
        └─ 检测 last_reindex_at 变化（reindex 完成）
              ├─ dispatch cortex:watch-reindexed → app-bar 弹 toast
              └─ refreshStatus(): getStatus() → store.status   ← 完成后刷新
  → <welcome-pane> 订阅 store.status + store.watcher
        → 渲染状态区（6 项，4 行）

用户触发强制重建索引（reindex-dialog）
  → 后台 reindex 完成 → /api/watch/status 的 last_reindex_at 变化
  → watch-polling tick 检测 → 派发事件 + 刷新 store.status
  → welcome-pane 自动重渲染（若当前在初始页）
```

### 改动文件清单

**后端**
- `doclens/web_v2/api/status.py`（改：返回 dict 加 `search_path`）

**前端**
- `frontend/src/state/types.ts`（改：`SystemStatus` 加 `search_path`）
- `frontend/src/api/status.ts`（改：`getStatus` 返回类型含 `search_path`）
- `frontend/src/state/store.ts`（改：加 `setStatus` action）
- `frontend/src/watch-polling.ts`（改：加 `refreshStatus`，启动 + reindex 完成时调）
- `frontend/src/utils/format.ts`（新：`formatBytes` / `formatRelative` / `truncatePathMiddle` / `summarizeFileTypes` 纯函数）
- `frontend/src/components/welcome-pane.ts`（改：加状态区，订阅 store，引用 `utils/format`）
- `frontend/src/components/app-bar.ts`（改：移除 `watch-badge`）

## 组件设计

### 后端 · `/api/status` 加 `search_path`

`doclens/web_v2/api/status.py` 的 `status()` 返回 dict 加一项：

```python
return {
    "search_path": str(idx.search_path),   # 新增：工作目录
    "indexed_docs": len(docs),
    "index_path": str(idx.index_path),
    "total_size_bytes": total_size,
    "file_types": type_counts,
    "watcher": { ... },
}
```

### 前端 1 · 类型 + API client

`state/types.ts`：

```typescript
export interface SystemStatus {
  search_path: string;            // 新增
  indexed_docs: number;
  index_path: string;
  total_size_bytes: number;
  file_types: Record<string, number>;
  watcher?: WatcherStatus | null;
}
```

`api/status.ts`：`getStatus()` 返回类型已是 `SystemStatus`，`search_path` 字段随 fetch JSON 自然带入，无需改解析逻辑（仅类型声明跟进）。

### 前端 2 · store

`state/store.ts` actions 加：

```typescript
setStatus(s: SystemStatus) {
  store.setState({ status: s });
},
```

不可变更新（`setState` 已是替换语义，`status` 字段整体替换）。

### 前端 3 · 加载时机（`watch-polling.ts`）

扩展为"系统状态数据总入口"，在现有轮询基础上加 `getStatus` 加载：

```typescript
import { getWatchStatus, getStatus } from "./api/status";
import { actions } from "./state/store";

async function refreshStatus(): Promise<void> {
  try {
    const s = await getStatus();
    actions.setStatus(s);
  } catch {
    // 静默：welcome 状态区自行显示"获取失败"
  }
}

export function startWatchPolling(): void {
  if (timer !== null) return;
  lastReindexAt = undefined;
  void refreshStatus();                 // 启动加载
  void tick();
  timer = window.setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
}

// tick() 内，检测到 last_reindex_at 变化（reindex 完成）时：
//   window.dispatchEvent(new CustomEvent("cortex:watch-reindexed", ...))
//   void refreshStatus();              // 刷新文档数 / 大小 / 类型
```

`getStatus` 仅在"启动"与"reindex 完成"时调用，**不进入 5s 轮询**（这些字段变化慢，轮询浪费）。

### 前端 4 · `welcome-pane` 状态区

从"纯展示组件"扩展为"展示 + 订阅 store"。现有 `heading/subheading/suffix` props 不变。

```typescript
import { store } from "../state/store";
import type { SystemStatus, WatcherStatus } from "../state/types";

@customElement("welcome-pane")
export class WelcomePane extends LitElement {
  @property() heading = "Doclens";
  @property() subheading = "";
  @property() suffix = "";

  private _unsub?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = store.subscribe(() => this.requestUpdate());
  }
  disconnectedCallback() {
    this._unsub?.();
    super.disconnectedCallback();
  }

  render() {
    const { status, watcher } = store.getState();
    return html`
      <h1 class="title">…现有标题…</h1>
      ${this.subheading ? html`<p class="subtitle">${this.subheading}</p>` : null}
      ${this._renderStatus(status, watcher)}
    `;
  }

  private _renderStatus(status: SystemStatus | null, watcher: WatcherStatus | null) {
    // 4 行分组列表，见下"状态区布局"
  }
}
```

状态区作为 welcome-pane **内部 `_renderStatus` 模板**（不单独注册自定义元素——YAGNI，只在 welcome 用；若将来 settings 等页要复用，再抽 `<status-panel>`）。

格式化工具为纯函数，集中放 `frontend/src/utils/format.ts`（独立于组件，便于单测，不触发 Lit 组件注册）：
- `formatBytes(b: number): string`
- `formatRelative(ts: number): string` — `ts` 单位以 `file_watcher.status()` 返回为准（实现时核对秒/毫秒，函数内统一为秒级 diff 计算）
- `truncatePathMiddle(p: string, keepSegments = 2): { text: string; title: string }`
- `summarizeFileTypes(ft: Record<string, number>, top = 3): string`

### 状态区布局（4 行覆盖 6 项）

```
─────────────────────────────────────────
📁 工作目录   …/cortex/test_work_dir
📄 索引       69 个文档 · 💾 12 MB
👁 监控       ●监控中 · 🕒 3 分钟前更新
🗂 类型       .md 30 · .pdf 12 · .docx 8 · +3
```

#### 字段映射与格式化

| 行 | 字段 | 数据源 | 格式化规则 |
|---|---|---|---|
| 工作目录 | `search_path` | `store.status` | `truncatePathMiddle`：保留最后 2 段，前缀以 `…` 代；`title` 属性显示完整路径；`null`/`""` → `—` |
| 索引 | 文档数 + 大小 | `store.status` | `{indexed_docs} 个文档 · 💾 {formatBytes(total_size_bytes)}`；`status==null` → `—` |
| 监控 | watcher | `store.watcher` | 见下表；`watcher==null` → `—` |
| 类型 | `file_types` | `store.status` | `summarizeFileTypes`：按 value 降序，前 3 `{ext} {n}` 用 ` · ` 连接，剩余类型数 `>0` 追加 ` · +{N}`；空 → `—` |

`formatBytes(b)`：`<1024 → "{n} B"` / `<1048576 → KB` / `<1073741824 → MB` / else `GB`；`<10` 保留 1 位小数，否则整数。

监控状态映射：

| 条件 | 显示 |
|---|---|
| `watcher == null` | `—` |
| `watcher.reindexing` | `⟳ 更新中` |
| `watcher.running && watcher.changed_count > 0` | `● 监控 · 待更新 {changed_count}` |
| `watcher.running` | `● 监控中` |
| `!watcher.running` | `○ 未启用` |

附 ` · 🕒 {formatRelative(last_reindex_at)}` 段（仅 `last_reindex_at != null` 时追加）。

`formatRelative(ts)`：`diff = Date.now()/1000 - ts`；`<60 → "刚刚"` / `<3600 → "{n} 分钟前"` / `<86400 → "{n} 小时前"` / `<604800 → "{n} 天前"` / else `YYYY/M/D`。

`truncatePathMiddle(p, keepSegments=2)`：按 `/` 与 `\` 切分段，保留最后 2 段；若总段数 `>2` 前缀返回 `…/{last2}`（用 `/` 连接保持视觉一致），否则原样；`.title = p`。

#### 视觉

- 副标题下方加 `border-top` 分隔线 + 状态区容器
- 容器 `max-width: 520px; margin: 24px auto 0`（宽屏不过宽，与标题对齐居中）
- 标签列 `width: 5em` 左对齐固定，值列 flex 剩余；路径/数字 `font-family: var(--cortex-font-mono)`、`font-size: var(--cortex-fs-xs)`
- 加载中（`status == null` 且无错误）：各值显 `—`
- 获取失败（refreshStatus catch）：状态区底部小字 `状态获取失败`（不阻塞标题与欢迎语）
- 移动端（`max-width: 1023px`）：标签列窄（`4em`），值列剩余；路径行依赖 `text-overflow: ellipsis` 二次兜底；整体天然垂直，无需断点适配

### 前端 5 · `app-bar` 移除 `watch-badge`

- 删 `_renderWatchBadge(w)` 方法（`app-bar.ts:300-309`）
- 删 `render()` 中 `${this._renderWatchBadge(store.getState().watcher)}`（`app-bar.ts:318`）
- 删 `.watch-badge` / `.watch-badge.dot|busy|warn` CSS 规则
- **保留** `_onWatchReindexed`（监听 `cortex:watch-reindexed` → toast `索引已更新：N 文档`）——reindex 完成反馈仍由 app-bar 弹
- 保留头像、刷新按钮、保存/放弃（settings 态）

移除后 `.right-cluster` 自然由头像/刷新/保存占据，无需额外布局调整。

## 错误处理

| 情况 | 处理 |
|---|---|
| `getStatus()` 失败 | `refreshStatus` catch 静默；welcome 状态区底部显示 `状态获取失败` 小字；下次 reindex 完成或重启重试 |
| `search_path` 为空 | 工作目录行 `—` |
| `file_types` 为空 | 类型行 `—` |
| `watcher == null` | 监控行 `—`（不附时间段） |
| `last_reindex_at == null` | 监控行不追加 `· 🕒 X前` 段 |
| `total_size_bytes == 0` | 索引行显示 `0 B`（不隐藏） |

## 测试策略

### 后端（pytest）
- `tests/web_v2/test_status_api.py` 追加：`GET /api/status` 响应含 `search_path`，值等于 `idx.search_path`

### 前端（vitest）
- `store` 单测：`setStatus(s)` 更新 `store.status`
- `welcome-pane` 单测：
  - 状态区渲染 6 项（给定 status + watcher mock）
  - 监控状态 4 分支（reindexing / running+changed / running / !running）
  - `watcher==null` → 监控行 `—`
  - `status==null` → 各行 `—`
  - 路径截断：长路径 → `…/last2segments`，`title` 含完整
  - 类型分布：前 3 + `+N`
  - 获取失败态显示 `状态获取失败`
- 格式化工具单测（`formatBytes` / `formatRelative` / `truncatePathMiddle` / `summarizeFileTypes`）：边界值
- `app-bar` 单测：不再渲染 `.watch-badge`；`cortex:watch-reindexed` 仍触发 toast

### E2E（可选）
启动后端，进搜索/对话初始页，观察状态区 4 行显示正确；触发强制重建索引，完成后状态区文档数刷新。

## 已知限制

- **状态区仅初始页可见**：`welcome-pane` 只在 `viewState.state === "initial"` 渲染。搜索结果页 / 对话进行中 / settings / files 不显示状态（用户已确认接受，作为"不重复"的代价）。
- **`search_path` 截断为最后 2 段**：极深路径前缀信息丢失，靠 `title` hover 补全。
- **`getStatus` 不高频轮询**：仅启动 + reindex 完成加载。若外部直接改了索引文件而不经 reindex，状态区文档数不会自动更新——靠现有 watch-polling 的 reindex 流程间接触发刷新。
- **类型分布只显前 3**：更多类型折叠为 `+N`。
- **状态区不单独抽组件**：内嵌于 welcome-pane；将来若 settings 等页要复用，再抽 `<status-panel>`（YAGNI）。
