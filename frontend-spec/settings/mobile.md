# 设置页（settings-view）移动端 Spec（<1024px）

> 配套总规范：[`../README.md`](../README.md)（应用总览 + 共享组件 + 响应式断点）。
> 本文件**只描述移动端（<1024px）**结构 / 布局 / 交互 / 状态，**不含视觉样式**（颜色、字体、字号、间距、渐变、阴影、圆角、像素值）。

---

## 1. 路由与入口

| 项 | 值 |
|---|---|
| 路由 hash | `#/settings` |
| 进入方式 | **仅** `<app-bar>` 头像下拉菜单 →「🌍 全局配置」菜单项 |
| 不可从 tab-bar 进入 | tab-bar 只有 search / chat / files 三个 tab，不含 settings |
| URL 真相源 | hash 是 view 唯一真相源；scope **不进 URL**，通过 store 同步 |
| 默认 landing tab | `ai`（AI 配置） |

### `<app-bar>` 在本页的角色（共享组件，不重复定义）

- **保存按钮**：当 `store.settings.dirty === true` 时，顶栏右侧出现「💾 保存」按钮；点击派发全局事件 `cortex:save-settings`。
- **头像下拉菜单**：dirty 时额外渲染「↩ 放弃修改」菜单项；点击派发 `cortex:revert-settings`。
- **圆形刷新按钮**：移动端**显示**（桌面端隐藏），点击触发 `location.reload()` 硬刷新（带旋转动画）。

> 移动端 settings 的保存/放弃**唯一入口**是 app-bar：顶栏 💾 保存按钮 + 头像菜单放弃项。页内无 footer-bar（见 4.4）。

---

## 2. 状态机

settings-view 无 focus/initial 二态——始终渲染完整布局。内嵌以下互斥状态：

| 状态 | 触发条件 | 表现 |
|---|---|---|
| **loading** | `connectedCallback` → `_load()` 进行中 / scope 切换重载 | 字段未填充；`_error` 清空 |
| **loaded-clean** | `_load()` 完成，`_values === _original` | 无额外提示（footer-bar 隐藏，无 clean 文案显示） |
| **dirty** | 任意字段 `_values` 与 `_original` 不一致 | app-bar 显示「💾 保存」按钮 + 头像菜单显示「放弃修改」项 |
| **saving** | `_save()` 进行中（`_saving === true`） | app-bar 保存按钮点击无效（逻辑守卫）；按钮无 disabled 视觉（仍可点但不触发） |
| **saved** | `putConfig` 成功返回 | `<toast-stack>` 推送 success toast（按 `needs_restart` 区分文案），自动消失 |
| **error** | `_load()` 或 `_save()` 失败 | `<toast-stack>` 推送 error toast + 字段级红字（`_fieldErrors` 渲染到对应字段下方） |

### 状态转换

```
loading ──(getConfig 成功)──→ loaded-clean
loading ──(getConfig 失败)──→ error（toast）

loaded-clean ──(编辑字段)──→ dirty
dirty ──(编辑字段回到原值)──→ loaded-clean
dirty ──(放弃修改)──→ loaded-clean
dirty ──(保存)──→ saving ──(成功)──→ saved（toast）──(瞬态)──→ loaded-clean
                           ──(失败)──→ error（toast + 字段红字，仍 dirty）

任意状态 ──(scope 切换)──→ loading（重载）
```

### 关键内部字段

| 字段 | 类型 | 用途 |
|---|---|---|
| `_values` | `Record<envVar, string>` | 当前编辑中的值（用户输入实时更新） |
| `_original` | `Record<envVar, string>` | 加载/上次保存时的快照，dirty 比对基准 |
| `_exists` | `boolean` | 目标 .env 是否已存在（不影响移动端文案——footer 隐藏） |
| `_saving` | `boolean` | 保存进行中标记（逻辑守卫，不触发重复保存） |
| `_error` | `string \| null` | 页级错误消息（移动端**不渲染**到 footer，仅走 toast） |
| `_toast` | `string \| null` | 成功消息（移动端**不使用**此字段，直接调 `_pushToast`） |
| `_userEditedBaseUrl` | `boolean` | 用户是否手动改过 PLANIFY_BASE_URL（阻止 provider 预设覆盖） |
| `_fieldErrors` | `Record<envVar, string>` | 字段级错误（移动端**渲染**到对应字段 `.field-error` 红字） |
| `_loadGen` | `number` | 代际计数器，invalidate stale load |
| `_activeTab` | `SettingsTab` | 当前激活 tab |
| `_scope` | `SettingsScope` | 当前作用域（仅"global"） |

> **移动端判定**：`_isMobile()` 通过 `window.matchMedia("(max-width: 1023px)").matches` 检测，决定保存成功/失败走 toast 还是 footer 文本。

---

## 3. 构件树

```
<settings-view>                              :host flex-column, flex:1, overflow-y:auto（整体滚动）
├── .copy-banner                             display:flex（移动端显示），flex-column 堆叠
│   ├── ℹ️ 图标
│   ├── "正在编辑全局配置" 文本
│   └── .grow 占位（移动端 display:none，banner 堆叠）
├── .layout                                  flex-column, flex:1, overflow:visible
│   ├── aside.sidebar                        width:100%, flex-shrink:0, flex-column, overflow:visible
│   │   ├── <settings-scope-segment>         作用域切换器（sticky top）
│   │   └── nav.tab-strip                    flex-row + overflow-x:auto, nowrap
│   │       └── button × 4                   水平 tab 按钮（nowrap）
│   └── main.main                            flex:1, overflow:visible
│       └── .scroll-area                     overflow:visible（不独立滚动，跟随页面滚动）
│           └── .tab-panel × 4              display 切换（.active 可见）
│               ├── .info-box               tab 级说明
│               └── .section × N            分组卡片
│                   ├── h2                  分组标题
│                   └── .field × N          字段行（grid 单列：label 上 + control 下堆叠）
│                       ├── .field-label
│                       │   ├── .name       字段名 + effect badge
│                       │   └── .env        环境变量名 + 范围
│                       └── .field-control
│                           ├── .row        控件行
│                           ├── .hint       字段提示文本
│                           └── .field-error 字段级错误红字（移动端渲染）
└── <toast-stack>                            全局通知（底部上移避开 tab-bar）
```

### 构件说明

- **所有 4 个 tab-panel 同时存在于 DOM**，仅通过 `.tab-panel.active` 的 `display` 切换可见性。
- **移动端无内部滚动区**——`:host` 自身 `overflow-y:auto`，整页统一滚动；`.scroll-area` 的 `overflow` 设为 `visible`。
- **无 footer-bar**——`display:none`，保存/放弃完全由 app-bar 承担。
- **`.copy-banner` 显示**——顶部固定提示「正在编辑全局配置」，弥补 sidebar 变水平后 scope 信息不够显眼。

---

## 4. 布局（移动端专用）

### 4.1 顶层 `.layout` — flex-column 单列

```
┌──────────────────────────────────┐
│  .copy-banner                    │  ← "正在编辑全局配置"（堆叠布局）
├──────────────────────────────────┤
│  .sidebar (width:100%)           │
│  ┌────────────────────────────┐  │
│  │ <settings-scope-segment>   │  │  ← sticky top
│  ├────────────────────────────┤  │
│  │ .tab-strip (水平滚动)       │  │
│  │ [AI配置][搜索调优][评分][终│  │  ← overflow-x:auto, nowrap
│  │ 端]                        │  │
│  └────────────────────────────┘  │
├──────────────────────────────────┤
│  .main                           │
│  ┌────────────────────────────┐  │
│  │  .scroll-area              │  │  ← overflow:visible
│  │  ┌──────────────────────┐  │  │
│  │  │ .tab-panel (全宽)     │  │  │
│  │  │  .info-box            │  │  │
│  │  │  .section             │  │  │
│  │  │    .field (单列堆叠)   │  │  │
│  │  │    .field ...         │  │  │
│  │  └──────────────────────┘  │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
            ↓ 整页滚动（:host overflow-y:auto）
```

| 区域 | 弹性策略 | 滚动行为 |
|---|---|---|
| `.copy-banner` | `flex-shrink:0`，顶部固定 | 跟随页面滚动 |
| `.sidebar` | `width:100%`，`flex-shrink:0` | `overflow:visible`（tab-strip 内部 `overflow-x:auto`） |
| `.main` | `flex:1` | `overflow:visible` |
| `.scroll-area` | 跟随 main | `overflow:visible`（不独立滚动） |
| `.tab-panel` | 全宽（无 max-width 约束） | 跟随页面滚动 |
| `:host` | — | `overflow-y:auto`（**整页唯一滚动**） |

### 4.2 `.copy-banner` — flex-column 堆叠

```
┌──────────────────────────────────┐
│  ℹ️  正在编辑全局配置              │
└──────────────────────────────────┘
```

- 移动端从桌面端的 `display:none` 切换为 `display:flex`
- 采用 `flex-column` + `align-items:stretch`（堆叠布局，非水平展开）
- `.grow` 占位元素 `display:none`（桌面端用来推开按钮，移动端不需要）
- 底部 `border-bottom` 与 sidebar 分隔

### 4.3 `.sidebar` — 水平布局

- `width:100%`，`flex-column`（scope 和 tab-strip 上下排列）
- **无 `border-right`**（桌面端有），改为底部 `border-bottom` 分隔
- `overflow:visible`

#### `<settings-scope-segment>`
- 移动端 `position:sticky, top:0, z-index:5`——滚动时吸顶
- 内部 pill 的 `min-height` 满足触控目标尺寸

#### `.tab-strip` — flex-row 水平滚动

```
[AI配置] [搜索调优] [评分] [终端]  →→→  (overflow-x:auto, nowrap)
```

- `flex-direction:row` + `overflow-x:auto` + `white-space:nowrap`
- tab 按钮水平排列，超出宽度时水平滚动
- **active 指示**：active tab 按钮有**底部边框指示条**（`border-bottom` 着色），与桌面端的左边框指示条不同
- tab 按钮文本居中（`text-align:center`）

### 4.4 无 footer-bar

- `.footer-bar` `display:none`——移动端不渲染页内保存/放弃栏
- 保存/放弃完全由 **app-bar** 承担：
  - 顶栏「💾 保存」按钮（dirty 时出现）
  - 头像菜单「放弃修改」项（dirty 时出现）

### 4.5 `.field` — grid 单列（label + control 上下堆叠）

```
.field grid-template-columns: 1fr
┌──────────────────────────────┐
│  .field-label                 │  ← 上
│  字段名 + badge               │
│  envVar · 范围                │
├──────────────────────────────┤
│  .field-control               │  ← 下
│  控件行 (.row)                │
│  提示文本 (.hint)             │
│  字段错误红字 (.field-error)  │  ← 移动端渲染
└──────────────────────────────┘
```

- label 和 control **上下堆叠**（非桌面端的左右并排）
- 字段间有顶部分隔线

### 4.6 控件布局（移动端差异）

| 控件类型 | 移动端布局 | 与桌面端差异 |
|---|---|---|
| **text** | 单行 `<input type="text">`，全宽（`max-width:100%`） | 桌面端限宽，移动端全宽 |
| **password** | `.password-wrap`（`position:static`）内含 input +「显示」按钮；按钮**独立一行**（`position:static`，`margin-top`，`align-self:flex-end`） | 桌面端按钮绝对定位在 input 右内侧，移动端按钮独立行 |
| **number** | `<input type="number">` + 可选 unit 后缀；全宽 | 同结构，宽度不同 |
| **select** | `<select>` 下拉；全宽 | 同结构 |
| **slider** | `.slider-row`（flex-column）：**number input 隐藏**（`display:none`）+ range 滑块全宽 + `.value-chip` **显示**（数值标签） | 桌面端 number+range 并排且 value-chip 隐藏；移动端只 range+value-chip |

#### slider 移动端结构

```
.slider-row (flex-column)
├── input[type="number"]  ← display:none（隐藏）
├── input[type="range"]   ← 全宽，flex:1
└── .value-chip           ← display:inline-block（显示当前值）
```

- `.value-chip` 显示当前滑块值，`align-self:flex-start`（左对齐）
- 等宽数字（`font-variant-numeric: tabular-nums`）

### 4.7 `<toast-stack>` 位置

- 移动端位置**上移避开 tab-bar**：`bottom` 抬高到 tab-bar 上方
- `left:12px, right:12px`（接近全宽）
- toast 内部 `max-width:100%`

---

## 5. 元素清单

### 5.1 `.copy-banner`

- 图标「ℹ️」+ 文本「正在编辑全局配置」
- flex-column 堆叠布局
- 底部分隔线

### 5.2 `.sidebar` 区

#### `<settings-scope-segment>` — 作用域切换器
- 移动端 `position:sticky, top:0`（滚动吸顶）
- 当前仅渲染 1 个 pill：「🌍 全局」
- `@scope-change` → `actions.setSettingsScope` → store 更新 → `_load()` 重载

#### `.tab-strip` — 水平 tab 条
- 4 个按钮水平排列：AI 配置 / 搜索调优 / 评分 / 终端
- `overflow-x:auto`，超出可水平滑动
- active 按钮有**底部边框指示条**

### 5.3 `.info-box` — tab 级说明（每 tab 一个）

| tab | info-box 内容 | 移动端差异 |
|---|---|---|
| **ai** | 「本 tab 的所有参数修改后需**重启 doclens gui** 才能生效。」 | 紧凑行高 |
| **search** | 「本 tab 的参数保存后下次查询即时生效，**无需重启**。」 | 紧凑行高 |
| **scoring** | 评分原理白话说明：5 个信号加权平均 | 多个 `<br>` 折叠（`br + br { display:none }`），紧凑显示 |
| **terminal** | **警告样式**（warn 变体）：「⚠️ 这些参数仅影响 doclens CLI/TUI 的**终端输出格式**，对 Web UI 没有可见效果。」 | 紧凑行高 |

### 5.4 字段清单（4 tab × 共 20 字段）

#### Tab: ai（AI 配置）— 5 字段，section「🤖 AI 模型与 API」

| envVar | label | 控件 | effect | 特性 |
|---|---|---|---|---|
| `PLANIFY_PROVIDER` | LLM 提供商 | select | ●即时 | 6 选项：Anthropic(默认) / OpenRouter / 阿里通义千问 / DeepSeek / 智谱 GLM / 自定义；切换触发预设联动 |
| `PLANIFY_PROTOCOL` | API 协议 | select | ●即时 | 2 选项：Anthropic 协议 / OpenAI 兼容 |
| `PLANIFY_BASE_URL` | API Base URL | text | 🔁需重启 | 等宽；全宽；手动编辑标记 `_userEditedBaseUrl` |
| `PLANIFY_API_KEY` | API Key | password | 🔁需重启 | 等宽；全宽；「显示」按钮独立一行 |
| `PLANIFY_MODEL_ID` | 模型 ID | text | 🔁需重启 | 等宽；全宽；带 `<datalist>` 自动补全 |

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
| `CORTEX_MIN_SCORE_THRESHOLD` | 综合评分阈值 | number | ●即时 | 0~1, step 0.05 |

#### Tab: scoring（评分）— 5 字段，section「⚖️ 权重配置」

| envVar | label | 控件 | effect | 范围 | 移动端控件 |
|---|---|---|---|---|---|
| `CORTEX_WEIGHT_KEYWORD_MATCH` | 关键词匹配权重 | slider | ●即时 | 0~10, step 0.1 | range 全宽 + value-chip（number 隐藏） |
| `CORTEX_WEIGHT_FILE_NAME_MATCH` | 文件名匹配权重 | slider | ●即时 | 0~10, step 0.1 | range 全宽 + value-chip |
| `CORTEX_WEIGHT_FTS_SCORE` | FTS 原始分权重 | slider | ●即时 | 0~10, step 0.1 | range 全宽 + value-chip |
| `CORTEX_WEIGHT_TITLE_MATCH` | 标题匹配权重 | slider | ●即时 | 0~10, step 0.1 | range 全宽 + value-chip |
| `CORTEX_WEIGHT_PROXIMITY_MATCH` | 邻近度权重 | slider | ●即时 | 0~10, step 0.1 | range 全宽 + value-chip |

#### Tab: terminal（终端）— 3 字段，section「🖥️ 终端结果显示」

| envVar | label | 控件 | effect | 范围 | unit |
|---|---|---|---|---|---|
| `CORTEX_MAX_CONTEXT_LINES` | 上下文行数上限 | number | 无 badge | 0~100 | 行 |
| `CORTEX_MAX_ANCHOR_LINES` | 锚点行数上限 | number | 无 badge | 1~50 | 行 |
| `CORTEX_CONTEXT_EXPAND_RANGE` | 锚点上下文扩展范围 | number | 无 badge | 0~100 | 行 |

### 5.5 `.field-error` — 字段级错误红字（移动端专用）

- 渲染位置：`.field-control` 内，`.hint` 下方
- 仅当 `_fieldErrors[envVar]` 有值时渲染
- 桌面端不渲染此元素（CSS 未定义 / `_fieldErrors` 不在桌面端填充）

### 5.6 effect badge

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
      → _loadGen++（invalidate stale load）
      → getConfig(scope)
      → 校验 gen 未过期 && isConnected
      → 填充 _values / _original
      → _userEditedBaseUrl = false
      → _exists = resp.exists
      → _fieldErrors = {}
      → actions.loadSettings(values, exists)
```

### 6.2 编辑流程（字段输入）

所有控件统一通过 `@input`（text/password/number/slider range）或 `@change`（select）触发 `_onInput(envVar, value)`：

```
_onInput(envVar, value)
  ├── envVar === "PLANIFY_PROVIDER" → _onProviderChange(value)
  ├── envVar === "PLANIFY_BASE_URL" → _onBaseUrlChange(value)
  └── 其他 → _updateValues({ [envVar]: value })
```

#### PLANIFY_PROVIDER 预设联动（`_onProviderChange`）

| 新 provider | `_userEditedBaseUrl` | 联动行为 |
|---|---|---|
| `custom` | 任意 | 仅更新 provider；若 protocol 为空则默认 `openai_compat`；**不覆盖** base_url |
| 已知预设 | `false` | 联动填入 provider + 预设 base_url + 预设 protocol |
| 已知预设 | `true` | 仅更新 provider + protocol；**保留用户手填的 base_url** |

#### PLANIFY_BASE_URL 手动编辑

- 标记 `_userEditedBaseUrl = true`
- 更新 `_values["PLANIFY_BASE_URL"]`

#### slider 移动端编辑

- 用户拖动 range 滑块 → `@input` 触发 → `_onInput` → `_values` 更新
- number input 隐藏但 DOM 仍存在，range 的 input 事件直接更新 envVar 对应值
- `.value-chip` 通过 Lit 响应式渲染自动更新显示值

#### `_updateValues`

- 不可变更新：`this._values = { ...this._values, ...updates }`
- 同步 `actions.updateSetting(envVar, value)` → store dirty → app-bar 显示保存按钮

### 6.3 保存流程（移动端走 toast）

```
触发：app-bar 💾 保存按钮 → cortex:save-settings → _onSaveRequest
  → _save()
      → 前置守卫：!dirty || saving → 直接返回
      → _saving = true, _error = null, _fieldErrors = {}
      → putConfig(scope, _values)
      ├── 成功：
      │     → _original = { ..._values }
      │     → _userEditedBaseUrl = false
      │     → actions.loadSettings(_values, true)
      │     → 按 result.needs_restart 区分消息：
      │         true  → "已保存。重启 doclens gui 后 AI 配置生效。"
      │         false → "已保存。下次查询立即生效。"
      │     → 移动端：_pushToast(msg, "success", 4000)（4 秒自动消失）
      └── 失败：
            → 区分错误类型（同桌面端）
            → 移动端：
                _pushToast(msg, "error", 5000)（5 秒自动消失）
                _fieldErrors = _extractFieldErrors(e)（渲染字段级红字）
      → finally: _saving = false
```

> **移动端与桌面端保存反馈差异**：
> - 成功：移动端 toast（4s），桌面端 footer 绿字
> - 失败：移动端 toast（5s）+ 字段级红字，桌面端仅 footer 红字

### 6.4 放弃流程

```
触发：app-bar 头像菜单"放弃修改" → cortex:revert-settings → _onRevertRequest
  → _revert()
      → _values = { ..._original }
      → _userEditedBaseUrl = false
      → actions.revertSettings() → store dirty=false → app-bar 隐藏保存按钮
```

### 6.5 scope 切换流程

```
<settings-scope-segment> @scope-change
  → actions.setSettingsScope(newScope)
  → store 更新
  → _onStoreChange 检测 scope 变化
  → _scope = newScope
  → _load()（重载）
```

### 6.6 tab 切换流程

```
.tab-strip button @click
  → _activeTab = tab
  → CSS display 切换
  → 字段编辑状态保留（tab-panel 不销毁）
```

### 6.7 toast 通知（`_pushToast`）

```
_pushToast(message, level, duration)
  → 查询 shadowRoot 内 <toast-stack>
  → stack.pushToast(message, level, duration)
```

- 移动端 toast-stack 底部上移避开 tab-bar
- success toast：4 秒自动消失
- error toast：5 秒自动消失

### 6.8 全局事件契约

| 事件名 | 派发方 | 接收方 | 触发动作 |
|---|---|---|---|
| `cortex:save-settings` | app-bar 保存按钮 | settings-view `_onSaveRequest` | `_save()` |
| `cortex:revert-settings` | app-bar 头像菜单"放弃修改" | settings-view `_onRevertRequest` | `_revert()` |

### 6.9 disconnect 清理

- `_loadGen++`：invalidate stale load
- `_toastTimer` 清除
- 移除全局事件监听
- store unsubscribe

---

## 7. 边界态

### 7.1 loading

- **触发**：首次 `connectedCallback` / scope 切换重载
- **表现**：字段区域为空或显示旧值
- **退出**：`getConfig` resolve → loaded-clean；reject → error toast

### 7.2 load error

- **触发**：`getConfig` 抛异常
- **表现**：`<toast-stack>` 推送 error toast「加载失败: {message}」
- **恢复**：scope 切换触发重载

### 7.3 save error（移动端）

- **触发**：`putConfig` 抛异常
- **表现**：
  - 页级：`<toast-stack>` 推送 error toast（5 秒自动消失）
  - 字段级：`_fieldErrors` 渲染到对应字段 `.field-error` 红字（仅 `ConfigApiError` 含 fields 时）
  - saving 恢复 false（仍 dirty，app-bar 保存按钮仍在）
- **错误消息格式**：
  - `ConfigApiError`（含 fields）：「保存失败（field1, field2）」
  - `ConfigApiError`（无 fields）：「保存失败 (HTTP {status})」
  - 其他 Error：「保存失败: {message}」
- **恢复**：用户修改字段后重新保存；字段级红字在下次 `_save()` 开始时清空

### 7.4 saved（成功反馈）

- **触发**：`putConfig` 成功
- **表现**：`<toast-stack>` 推送 success toast（4 秒自动消失）
  - `needs_restart === true`：「已保存。重启 doclens gui 后 AI 配置生效。」
  - `needs_restart === false`：「已保存。下次查询立即生效。」
- **`_original` 已更新**：dirty=false，app-bar 保存按钮消失

### 7.5 字段级错误（移动端专用）

- **触发**：`putConfig` 返回 `ConfigApiError`，`body.fields` 非空
- **机制**：`_extractFieldErrors(e)` 提取 `{ field: error }` 映射到 `_fieldErrors`
- **渲染**：对应字段 `.field-control` 内 `.hint` 下方显示 `.field-error` 红字
- **清除**：下次 `_save()` 开始时 `_fieldErrors = {}`

### 7.6 stale load 防护

- **场景**：用户快速切换 scope，前一个 `_load()` 尚未 resolve
- **机制**：`_loadGen` 代际计数器——每次 `_load()` `++_loadGen`，resolve 后校验 `gen !== _loadGen` 则 return
- `disconnectedCallback` 中 `_loadGen++`，防组件卸载后 state 写入

### 7.7 dialog 响应式（全局规范）

> settings-view 自身不使用 dialog，但 app-bar 头像菜单触发的「强制重建索引」`<reindex-dialog>` 在移动端遵循全局规范：按钮垂直排列（`column-reverse`，全宽，min-height 满足触控目标）。
