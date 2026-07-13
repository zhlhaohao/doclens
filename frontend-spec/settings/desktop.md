# 设置页（settings-view）桌面端 Spec（≥1024px）

> 配套总规范：[`../README.md`](../README.md)（应用总览 + 共享组件 + 响应式断点）。
> 本文件**只描述桌面端（≥1024px）**结构 / 布局 / 交互 / 状态，**不含视觉样式**（颜色、字体、字号、间距、渐变、阴影、圆角、像素值）。

---

## 1. 路由与入口

| 项 | 值 |
|---|---|
| 路由 hash | `#/settings` |
| 进入方式 | **仅** `<app-bar>` 头像下拉菜单 →「🌍 全局配置」菜单项 |
| 不可从 activity-bar 进入 | activity-bar 只有 search / chat / files 三个图标按钮，不含 settings |
| URL 真相源 | hash 是 view 唯一真相源；scope **不进 URL**，通过 store 同步 |
| 默认 landing tab | `ai`（AI 配置） |

### `<app-bar>` 在本页的角色（共享组件，不重复定义）

- **保存按钮**：当 `store.settings.dirty === true` 时，顶栏右侧出现「💾 保存」按钮；点击派发全局事件 `cortex:save-settings`。
- **头像下拉菜单**：dirty 时额外渲染「↩ 放弃修改」菜单项；点击派发 `cortex:revert-settings`。
- 桌面端**不显示**圆形刷新按钮（仅移动端显示）。

> 桌面端 settings 的保存/放弃有**两个入口**：页内 footer-bar 按钮 + app-bar 顶栏按钮/菜单项。两者均通过同一组全局事件触发同一逻辑。

---

## 2. 状态机

settings-view 无 focus/initial 二态——始终渲染完整布局。内嵌以下互斥状态：

| 状态 | 触发条件 | 表现 |
|---|---|---|
| **loading** | `connectedCallback` → `_load()` 进行中 / scope 切换重载 | 字段未填充；`_error` 清空 |
| **loaded-clean** | `_load()` 完成，`_values === _original` | footer-bar 显示「所有字段与 .env 一致」 |
| **dirty** | 任意字段 `_values` 与 `_original` 不一致 | footer-bar dirty-dot +「有 **N** 个字段已修改」；app-bar 显示保存按钮 + 放弃菜单项 |
| **saving** | `_save()` 进行中（`_saving === true`） | 保存/放弃按钮均 disabled；保存按钮文字变「保存中…」 |
| **saved** | `putConfig` 成功返回 | `_original` 更新为当前 `_values`；footer-bar 显示绿色成功消息（按 `needs_restart` 区分文案） |
| **error** | `_load()` 或 `_save()` 失败 | footer-bar dirty-status 区显示红色错误消息；字段级错误不渲染（桌面端只用 footer 红字） |

### 状态转换

```
loading ──(getConfig 成功)──→ loaded-clean
loading ──(getConfig 失败)──→ error

loaded-clean ──(编辑字段)──→ dirty
dirty ──(编辑字段回到原值)──→ loaded-clean
dirty ──(放弃修改)──→ loaded-clean
dirty ──(保存)──→ saving ──(成功)──→ saved ──(瞬态)──→ loaded-clean
                           ──(失败)──→ error（仍 dirty）

任意状态 ──(scope 切换)──→ loading（重载）
```

### 关键内部字段

| 字段 | 类型 | 用途 |
|---|---|---|
| `_values` | `Record<envVar, string>` | 当前编辑中的值（用户输入实时更新） |
| `_original` | `Record<envVar, string>` | 加载/上次保存时的快照，dirty 比对基准 |
| `_exists` | `boolean` | 目标 .env 是否已存在（不存在时保存按钮文案加「（新建）」） |
| `_saving` | `boolean` | 保存进行中标记 |
| `_error` | `string \| null` | 页级错误消息（footer 红字） |
| `_toast` | `string \| null` | 成功消息（footer 绿字，桌面端专用，移动端走 toast-stack） |
| `_userEditedBaseUrl` | `boolean` | 用户是否手动改过 PLANIFY_BASE_URL（阻止 provider 预设覆盖） |
| `_fieldErrors` | `Record<envVar, string>` | 字段级错误（桌面端**不渲染**，仅移动端用） |
| `_loadGen` | `number` | 代际计数器，invalidate stale load（scope 切换/disconnect 时自增） |
| `_activeTab` | `SettingsTab` | 当前激活 tab（ai/search/scoring/terminal） |
| `_scope` | `SettingsScope` | 当前作用域（仅"global"，local 已禁用） |

---

## 3. 构件树

```
<settings-view>                              :host flex-column, flex:1
├── .copy-banner                             桌面 display:none（信息已在 sidebar 呈现，避免冗余）
├── .layout                                  flex-row, flex:1
│   ├── aside.sidebar                        固定宽, flex-shrink:0, flex-column, overflow-y:auto
│   │   ├── <settings-scope-segment>         作用域切换器（仅"🌍 全局"pill 可用）
│   │   └── nav.tab-strip                    flex-column, role="tablist"
│   │       └── button × 4                   tab 按钮（AI配置/搜索调优/评分/终端）
│   └── main.main                            flex:1, flex-column, min-width:0
│       ├── .scroll-area                     flex:1, overflow-y:auto（内部滚动区域）
│       │   └── .tab-panel × 4              display 切换（.active 可见，其余 display:none）
│       │       ├── .info-box               tab 级说明（每个 tab 一个，内容不同）
│       │       └── .section × N            分组卡片
│       │           ├── h2                  分组标题
│       │           └── .field × N          字段行（grid: label-col + control-col 并排）
│       │               ├── .field-label
│       │               │   ├── .name       字段名 + effect badge（●即时 / 🔁需重启）
│       │               │   └── .env        环境变量名（等宽字体）+ 范围信息
│       │               └── .field-control
│       │                   ├── .row        控件行（input/select/slider-row/password-wrap）
│       │                   └── .hint       字段提示文本
│       └── .footer-bar                      flex-shrink:0, 固定底部, 居中限宽容器
│           ├── .dirty-status               左：dirty 状态 / 成功消息 / 错误消息
│           └── .buttons                    右：放弃修改 + 保存（按钮组）
└── <toast-stack>                            全局通知（桌面端本页基本不用，保存消息走 footer）
```

### 构件说明

- **所有 4 个 tab-panel 同时存在于 DOM**，仅通过 `.tab-panel.active` 的 `display` 切换可见性（不销毁/重建），保证字段编辑状态在 tab 切换时不丢失。
- **`.scroll-area` 是唯一的内部滚动容器**：sidebar 和 footer-bar 不随内容滚动。
- **`.footer-bar` 居中限宽**：与 `.tab-panel` 对齐（同一 max-width 容器，居中），非通栏。

---

## 4. 布局（桌面端专用）

### 4.1 顶层 `.layout` — flex-row 二栏

```
┌─────────────┬──────────────────────────────────┐
│  .sidebar   │  .main                            │
│  (固定宽)    │  (flex:1)                         │
│             │  ┌──────────────────────────────┐ │
│ scope-seg   │  │  .scroll-area (overflow-y)   │ │
│             │  │  ┌────────────────────┐      │ │
│ ───────────  │  │  │ .tab-panel (限宽)  │      │ │
│ tab-strip   │  │  │  居中              │      │ │
│ (垂直列)     │  │  └────────────────────┘      │ │
│  • AI配置   │  └──────────────────────────────┘ │
│  • 搜索调优  │  ┌──────────────────────────────┐ │
│  • 评分     │  │  .footer-bar (限宽居中)       │ │
│  • 终端     │  │  dirty-status    [放弃] [保存]│ │
│             │  └──────────────────────────────┘ │
└─────────────┴──────────────────────────────────┘
```

| 区域 | 弹性策略 | 滚动行为 |
|---|---|---|
| `.sidebar` | 固定宽，`flex-shrink:0` | 自身 `overflow-y:auto`（tab 多时可滚，当前 4 个不会触发） |
| `.main` | `flex:1`，占满剩余宽 | 不滚动（由子区域分别处理） |
| `.scroll-area` | `flex:1`（占 main 高度减 footer） | `overflow-y:auto`（**唯一的内容滚动区**） |
| `.footer-bar` | `flex-shrink:0`，固定钉在 main 底部 | 不滚动 |
| `.tab-panel` | 居中限宽容器（max-width 约束） | 跟随 scroll-area 滚动 |

### 4.2 `.sidebar` — flex-column 垂直布局

- 从上到下依次：`<settings-scope-segment>` → `.tab-strip`
- `.tab-strip` 是 `flex-column`，4 个 tab 按钮垂直排列
- **active 指示**：active tab 按钮有**左边框指示条**（`border-left` 着色）
- sidebar 右侧有 `border-right` 与 main 分隔

### 4.3 `.field` — grid 二列（label + control 并排）

```
.field grid-template-columns: minmax(固定最小, 固定最大) 1fr
┌──────────────────┬──────────────────────────────┐
│  .field-label    │  .field-control              │
│  字段名 + badge   │  控件行 (.row)               │
│  envVar · 范围    │  提示文本 (.hint)             │
│                  │  [字段错误 — 桌面端不渲染]     │
└──────────────────┴──────────────────────────────┘
```

- label 列固定宽范围（min-max 约束），control 列弹性占满剩余
- 字段间有顶部分隔线（首字段无）

### 4.4 `.footer-bar` — flex-row 两端对齐

```
┌─────────────────────────────────────────────────┐
│  [●] 有 N 个字段已修改    [放弃修改] [💾 保存…]  │
│   (dirty-status)                 (buttons)      │
└─────────────────────────────────────────────────┘
```

- `justify-content: space-between`：左侧 dirty-status，右侧按钮组
- 居中限宽（与 tab-panel 同一 max-width，居中对齐）
- `flex-shrink:0` 钉在 main 底部

### 4.5 控件布局

| 控件类型 | 桌面端布局 |
|---|---|
| **text** | 单行 `<input type="text">`，可带 `<datalist>` 自动补全；等宽变体（`.mono`） |
| **password** | `.password-wrap`（相对定位容器）内含 input +「显示」按钮；按钮**绝对定位在 input 右内侧** |
| **number** | `<input type="number">` + 可选 unit 后缀文本 |
| **select** | `<select>` 下拉 |
| **slider** | `.slider-row`（flex-row）：number input（固定窄宽）+ range 滑块**并排**；`.value-chip` **隐藏**（`display:none`） |

---

## 5. 元素清单

### 5.1 `.sidebar` 区

#### `<settings-scope-segment>` — 作用域切换器
- 当前仅渲染 1 个 pill：「🌍 全局」（active 状态）
- local 作用域已禁用（不渲染或不可点）
- `@scope-change` 事件 → `actions.setSettingsScope` → store 更新 → view 检测 scope 变化 → `_load()` 重载
- `exists` 属性：目标 .env 不存在时影响保存按钮文案

#### `.tab-strip` — 垂直 tab 列
- 4 个按钮，按固定顺序：AI 配置 / 搜索调优 / 评分 / 终端
- 点击切换 `_activeTab`，仅切 display，不销毁 DOM
- active 按钮有左边框指示条

### 5.2 `.info-box` — tab 级说明（每 tab 一个）

| tab | info-box 内容 |
|---|---|
| **ai** | 「本 tab 的所有参数修改后需**重启 doclens gui** 才能生效。」 |
| **search** | 「本 tab 的参数保存后下次查询即时生效，**无需重启**。」 |
| **scoring** | 评分原理白话说明：最终得分 = 5 个信号按权重加权平均；列出 5 个信号含义；权重越大影响越大，设 0 = 忽略该信号 |
| **terminal** | **警告样式**（warn 变体）：「⚠️ 这些参数仅影响 doclens CLI/TUI 的**终端输出格式**，对 Web UI 没有可见效果。在此处提供编辑仅为了免去手动改 .env 的麻烦。」 |

### 5.3 字段清单（4 tab × 共 20 字段）

#### Tab: ai（AI 配置）— 5 字段，section「🤖 AI 模型与 API」

| envVar | label | 控件 | effect | 特性 |
|---|---|---|---|---|
| `PLANIFY_PROVIDER` | LLM 提供商 | select | ●即时 | 6 选项：Anthropic(默认) / OpenRouter / 阿里通义千问 / DeepSeek / 智谱 GLM / 自定义；切换触发预设联动 |
| `PLANIFY_PROTOCOL` | API 协议 | select | ●即时 | 2 选项：Anthropic 协议 / OpenAI 兼容 |
| `PLANIFY_BASE_URL` | API Base URL | text | 🔁需重启 | 等宽；手动编辑后标记 `_userEditedBaseUrl`，provider 切换不再覆盖 |
| `PLANIFY_API_KEY` | API Key | password | 🔁需重启 | 等宽；保存时写入 .env，不回传其他视图 |
| `PLANIFY_MODEL_ID` | 模型 ID | text | 🔁需重启 | 等宽；带 `<datalist>` 自动补全常见模型 |

#### Tab: search（搜索调优）— 7 字段，2 section

**Section「📊 结果数量」：**

| envVar | label | 控件 | effect | 范围 |
|---|---|---|---|---|
| `CORTEX_MAX_RESULTS` | 最大结果数（跨文档） | number | ●即时 | 1~200 |
| `CORTEX_MAX_NODES_PER_DOC` | 每文档最大节点数 | number | ●即时 | 1~20 |

**Section「🎯 关键词匹配」：**

| envVar | label | 控件 | effect | 范围/选项 |
|---|---|---|---|---|
| `CORTEX_MAX_SPAN` | 关键词最大跨度 | number | ●即时 | 1~100 |
| `CORTEX_MIN_KEYWORD_MATCH` | 最少关键词匹配数 | number | ●即时 | 0~10 |
| `CORTEX_MIN_PROXIMITY_SCORE` | 最低邻近度阈值 | select | ●即时 | 3 选项：0-不限制 / 1-部分紧邻 / 2-全部紧邻 |
| `CORTEX_MIN_KEYWORDS_PER_LINE` | 行级关键词阈值 | number | ●即时 | 1~10 |
| `CORTEX_MIN_SCORE_THRESHOLD` | 综合评分阈值 | number | ●即时 | 0~1，step 0.05 |

#### Tab: scoring（评分）— 5 字段，section「⚖️ 权重配置」

| envVar | label | 控件 | effect | 范围 |
|---|---|---|---|---|
| `CORTEX_WEIGHT_KEYWORD_MATCH` | 关键词匹配权重 | slider | ●即时 | 0~10, step 0.1 |
| `CORTEX_WEIGHT_FILE_NAME_MATCH` | 文件名匹配权重 | slider | ●即时 | 0~10, step 0.1 |
| `CORTEX_WEIGHT_FTS_SCORE` | FTS 原始分权重 | slider | ●即时 | 0~10, step 0.1 |
| `CORTEX_WEIGHT_TITLE_MATCH` | 标题匹配权重 | slider | ●即时 | 0~10, step 0.1 |
| `CORTEX_WEIGHT_PROXIMITY_MATCH` | 邻近度权重 | slider | ●即时 | 0~10, step 0.1 |

#### Tab: terminal（终端）— 3 字段，section「🖥️ 终端结果显示」

| envVar | label | 控件 | effect | 范围 | unit |
|---|---|---|---|---|---|
| `CORTEX_MAX_CONTEXT_LINES` | 上下文行数上限 | number | 无 badge | 0~100 | 行 |
| `CORTEX_MAX_ANCHOR_LINES` | 锚点行数上限 | number | 无 badge | 1~50 | 行 |
| `CORTEX_CONTEXT_EXPAND_RANGE` | 锚点上下文扩展范围 | number | 无 badge | 0~100 | 行 |

> terminal 字段无 effect 标记（不显示 badge）——它们仅影响 CLI/TUI 输出，对 Web UI 不可见。

### 5.4 `.footer-bar` 元素

#### `.dirty-status`（左侧）
- **clean**：「所有字段与 .env 一致」
- **dirty**：dirty-dot（小圆点）+「有 **N** 个字段已修改」（N = `_dirtyFields.length`）
- **error 叠加**：dirty-status 后追加红色错误文本
- **saved 叠加**：dirty-status 后追加绿色成功文本（`_toast`）

#### `.buttons`（右侧，按钮组）
- **放弃修改**（`.btn`）：`disabled` 当 `!dirty || saving`；点击 → `_revert()`
- **保存**（`.btn.primary`）：`disabled` 当 `!dirty || saving`；
  - 默认文案：「💾 保存全局配置」
  - 新建时（`!_exists`）：「💾 保存全局配置（新建）」
  - 保存中：「保存中…」

### 5.5 effect badge

| effect 值 | badge 文本 | 含义 |
|---|---|---|
| `live` | ● 即时 | 保存后下次查询立即生效 |
| `restart` | 🔁 需重启 | 需重启 doclens gui 才生效 |
| 无（terminal 字段） | 不显示 | 仅影响 CLI/TUI |

---

## 6. 交互逻辑

### 6.1 加载流程

```
connectedCallback
  → 读取 store.settings.scope 初始化 _scope
  → 订阅 store 变化
  → 注册全局事件监听：cortex:save-settings / cortex:revert-settings
  → _load()
      → _loadGen++（invalidate 之前的 stale load）
      → getConfig(scope)
      → 校验 gen 未过期 && isConnected
      → 填充 _values / _original（同值快照）
      → _userEditedBaseUrl = false
      → _exists = resp.exists
      → _fieldErrors = {}
      → actions.loadSettings(values, exists) → store 更新 dirty=false
```

### 6.2 编辑流程（字段输入）

所有控件统一通过 `@input`（text/password/number/slider）或 `@change`（select）触发 `_onInput(envVar, value)`：

```
_onInput(envVar, value)
  ├── envVar === "PLANIFY_PROVIDER" → _onProviderChange(value)
  ├── envVar === "PLANIFY_BASE_URL" → _onBaseUrlChange(value)
  └── 其他 → _updateValues({ [envVar]: value })
```

#### PLANIFY_PROVIDER 预设联动（`_onProviderChange`）

| 新 provider | `_userEditedBaseUrl` | 联动行为 |
|---|---|---|
| `custom` | 任意 | 仅更新 provider；若 protocol 为空则默认设 `openai_compat`；**不覆盖** base_url |
| 已知预设（anthropic/openrouter/qwen/deepseek/glm） | `false` | 联动填入 provider + 预设 base_url + 预设 protocol |
| 已知预设 | `true` | 仅更新 provider + protocol；**保留用户手填的 base_url** |

#### PLANIFY_BASE_URL 手动编辑（`_onBaseUrlChange`）

- 标记 `_userEditedBaseUrl = true`
- 更新 `_values["PLANIFY_BASE_URL"]`
- 之后切换 provider 不再覆盖 base_url（除非重新加载页面）

#### `_updateValues`

- 不可变更新：`this._values = { ...this._values, ...updates }`
- 同步 `actions.updateSetting(envVar, value)` → store 更新 dirty 状态 → app-bar 感知 dirty 显示保存按钮

### 6.3 保存流程

```
触发：footer-bar 保存按钮 点击 / app-bar 💾 按钮 → cortex:save-settings → _onSaveRequest
  → _save()
      → 前置守卫：!dirty || saving → 直接返回
      → _saving = true, _error = null, _fieldErrors = {}
      → putConfig(scope, _values)
      ├── 成功：
      │     → _original = { ..._values }（更新快照）
      │     → _userEditedBaseUrl = false
      │     → actions.loadSettings(_values, true)
      │     → 按 result.needs_restart 区分消息：
      │         true  → "已保存。重启 doclens gui 后 AI 配置生效。"
      │         false → "已保存。下次查询立即生效。"
      │     → 桌面端：_toast = msg（footer-bar 绿字显示）
      └── 失败：
            → 区分错误类型：
                ConfigApiError → 提取 fields 名 → "保存失败（field1, field2）" 或 "保存失败 (HTTP {status})"
                其他 Error → "保存失败: {message}"
            → 桌面端：_error = msg（footer-bar 红字显示）
      → finally: _saving = false
```

### 6.4 放弃流程

```
触发：footer-bar 放弃按钮 / app-bar 头像菜单"放弃修改" → cortex:revert-settings → _onRevertRequest
  → _revert()
      → _values = { ..._original }（不可变复位）
      → _userEditedBaseUrl = false
      → actions.revertSettings() → store dirty=false → app-bar 隐藏保存按钮
```

### 6.5 scope 切换流程

```
<settings-scope-segment> @scope-change
  → actions.setSettingsScope(newScope)
  → store 更新 settings.scope
  → _onStoreChange 检测 scope 变化
  → _scope = newScope
  → _load()（重载新 scope 的配置）
```

> 当前仅"global"可用，但架构支持 local。切换会触发完整重载（loading → loaded-clean）。

### 6.6 tab 切换流程

```
.tab-strip button @click
  → _activeTab = tab
  → 仅 CSS display 切换（.tab-panel.active）
  → 不销毁/重建 DOM → 所有 tab 的字段编辑状态保留
```

### 6.7 全局事件契约

| 事件名 | 派发方 | 接收方 | 触发动作 |
|---|---|---|---|
| `cortex:save-settings` | app-bar 保存按钮 / app-bar 头像菜单 | settings-view `_onSaveRequest` | `_save()` |
| `cortex:revert-settings` | app-bar 头像菜单"放弃修改" | settings-view `_onRevertRequest` | `_revert()` |

### 6.8 disconnect 清理

- `_loadGen++`：使进行中的 `_load()` resolve 时判定 stale，直接 return（防 stale state 写入）
- `_toastTimer` 清除：防 post-disconnect state 写入
- 移除全局事件监听
- store unsubscribe

---

## 7. 边界态

### 7.1 loading

- **触发**：首次 `connectedCallback` / scope 切换重载
- **表现**：字段区域为空或显示旧值（`_values` 未填充）；footer-bar 不显示 dirty（因 `_values` / `_original` 同步更新）
- **退出**：`getConfig` resolve → loaded-clean；reject → error

### 7.2 load error

- **触发**：`getConfig` 抛异常
- **表现**：`_error = "加载失败: {message}"`；footer-bar dirty-status 区显示红色错误文本
- **恢复**：scope 切换触发重载；或用户切换 tab（不自动重试）

### 7.3 save error（桌面端）

- **触发**：`putConfig` 抛异常
- **表现**：
  - 页级：footer-bar dirty-status 区追加红色错误消息（`_error`）
  - 字段级：桌面端**不渲染**字段级错误（`_fieldErrors` 保持空，即使 ConfigApiError 含 fields）
  - 保存/放弃按钮恢复 enabled（`_saving = false`，仍 dirty）
- **错误消息格式**：
  - `ConfigApiError`（含 fields）：「保存失败（field1, field2）」
  - `ConfigApiError`（无 fields）：「保存失败 (HTTP {status})」
  - 其他 Error：「保存失败: {message}」
- **恢复**：用户修改字段后重新保存

### 7.4 saved（成功反馈）

- **触发**：`putConfig` 成功
- **表现**：footer-bar dirty-status 区追加绿色成功消息（`_toast`）
  - `needs_restart === true`：「已保存。重启 doclens gui 后 AI 配置生效。」
  - `needs_restart === false`：「已保存。下次查询立即生效。」
- **`_original` 已更新**：此时 dirty=false，footer 主文案回到「所有字段与 .env 一致」

### 7.5 !exists（目标 .env 不存在）

- **表现**：保存按钮文案追加「（新建）」
- 不影响其他交互

### 7.6 stale load 防护

- **场景**：用户快速切换 scope，前一个 `_load()` 尚未 resolve
- **机制**：`_loadGen` 代际计数器——每次 `_load()` 开头 `++_loadGen`，resolve 后校验 `gen !== this._loadGen` 则直接 return
- 同样在 `disconnectedCallback` 中 `_loadGen++`，防组件卸载后 state 写入
