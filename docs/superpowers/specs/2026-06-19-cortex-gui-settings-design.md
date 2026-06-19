# Cortex GUI · 设置页 Design Spec

**Date:** 2026-06-19
**Status:** Approved (mockup reviewed)
**Mockup:** [`specs/settings-page-mockup.html`](../../../specs/settings-page-mockup.html)（repo 根目录下，浏览器直接打开）

---

## 1. Overview

为 `cortex gui` 新增设置页，让用户在浏览器里直接编辑 `.env` 配置，免去手动改文件 + 重启的流程。

支持两种 scope：
- **本地配置**：`{cwd}/.cortex/.env`，只影响当前工作目录
- **全局配置**：`~/.cortex/.env`，影响所有使用全局配置的项目

加载优先级不变（全局先加载，本地覆盖），由现有 `CortexConfig.load()` 处理；本特性只负责**编辑/写入单个 scope 的 .env 文件**。

## 2. Goals

- 在 Web UI 内暴露 18 个常用 `.env` 参数，按功能域分 4 个 tab
- 提供本地/全局两个独立入口，互不混淆
- 每个字段带中文说明 + 生效条件标记（即时生效 / 需重启 cortex gui）
- 显式保存模型，写入前用户能审查改动（页脚脏指示）

## 3. Non-goals

- **不暴露**以下参数（用户已确认不需要 GUI 编辑）：
  - 文件监控（`CORTEX_WATCH_ENABLED`、`CORTEX_WATCH_DEBOUNCE`）
  - 日志目录（`CORTEX_LOG_DIR`）
  - FTS5 路由文档数（`CORTEX_TOP_K_DOCS`）
  - KB 工具字符限制（`CORTEX_MAX_CONTEXT_CHARS_PER_RESULT` / `MAX_TOTAL_CHARS` / `MAX_READ_CHARS`）
  - 文件类型（`CORTEX_ALLOWED_SOURCE_TYPES`）
  - 解析选项（`TREESEARCH_ENABLE_SHADOW_MD`、`CORTEX_MAX_INDEX_FAIL_COUNT`、`TREESEARCH_XLSX_*`）
  - Ripgrep 降级 & Grep（`CORTEX_RG_CONTEXT_*`、`CORTEX_GREP_*`、`CORTEX_CJK_TOKENIZER`）
  - 终端显示宽度（`CORTEX_TITLE_WIDTH`、`CORTEX_LINE_WIDTH`）
  - 索引位置（`CORTEX_SEARCH_PATH`、`CORTEX_INDEX_PATH` —— 由工作目录决定）
- 不做自动保存（autosave / hot-reload）
- 不做参数导入/导出
- 不做用户登录系统（AppBar 头像仅为占位，下拉里只有 scope 切换）
- 不在设置页显示文件路径

## 4. Information Architecture

### 4.1 新增顶部 AppBar

现有布局：`activity-bar`（左）+ `main`（右）+ `tab-bar`（移动端底）。

新增 `<app-bar>` 放在最顶层（横跨左右），结构：

```
┌─────────────────────────────────────────────────┐
│ 🧠 Cortex                  [ L Liang ▾ ]        │  ← AppBar
│                            ┌──────────────┐     │
│                            │ Liang        │     │
│                            │ liang@…      │     │
│                            │ ─────────    │     │
│                            │ 📁 本地配置✓ │     │
│                            │ 🌍 全局配置  │     │
│                            └──────────────┘     │
├──┬─────────────────────────────────────────────┤
│🔍│  (main: 现有视图或设置页)                    │
...
```

- 左侧：`🧠 Cortex` 品牌（logo + 名称）
- 右侧：圆形头像按钮 + chevron，点击展开下拉
- 下拉内容：用户信息（mockup 占位）+ 两个 scope 入口
- 下拉是 **scope 切换的唯一入口**，不在页面其它地方重复

**为什么不放在 activity-bar / tab-bar：**
- activity-bar 已有 搜索/对话/历史 3 项，再加 2 项会拥挤
- tab-bar 在移动端宽度紧张，配置项不应占用宝贵的导航资源
- AppBar 在顶部永远可见，桌面/移动端一致

### 4.2 设置页布局

进入设置页后，主区域结构（无 page-header，直接进 tab）：

```
[ AI 配置 ] [ 搜索调优 ] [ 评分 ] [ 终端 ]   ← tab strip
─────────────────────────────────────
（滚动内容区，每个 tab 一个 panel）
─────────────────────────────────────
● 3 字段已修改     [放弃] [💾 保存本地配置]   ← 粘性页脚
```

- 顶部 AppBar 始终可见（含下拉入口）
- tab strip 4 个 tab，水平排布
- 滚动区按 tab 切换 panel
- 粘性页脚：脏指示 + 放弃 + 单保存按钮（按当前 scope 显示文案）

### 4.3 Scope 切换交互

- 点击 AppBar 头像 → 下拉展开
- 下拉里两个 menu-item：📁 本地配置 / 🌍 全局配置
- 当前 scope 的 item 带 active 高亮
- 点击任一项 → 关闭下拉 + 加载对应 .env + 主区域切换为该 scope 的编辑界面
- 页脚保存按钮文案动态变化：`💾 保存本地配置` 或 `💾 保存全局配置`
- **不在设置页其它位置重复显示 scope 入口或文件路径**

## 5. Field Reference（18 字段）

### Tab 1: AI 配置（3 字段，全部 🔁 需重启）

| Label | env var | 组件 | 代码默认 | 验证 |
|---|---|---|---|---|
| API Base URL | `PLANIFY_BASE_URL` | text (mono) | `None`（必填） | url 格式 |
| API Key | `PLANIFY_API_KEY` | password + 显示/隐藏按钮 | `None`（必填） | 非空 |
| 模型 ID | `PLANIFY_MODEL_ID` | text (mono) + datalist 常见模型 | `claude-opus-4-6` | 非空 |

> UI 加载时显示**当前生效值**（由 `CortexConfig.load()` 合并全局+本地后得到的值）。保存时把表单值写入目标 scope 的 .env。

### Tab 2: 搜索调优（7 字段，全部 ● 即时生效）

| Label | env var | 组件 | 默认 | 范围 |
|---|---|---|---|---|
| 最大结果数（跨文档） | `CORTEX_MAX_RESULTS` | number | 20 | 1-200 |
| 每文档最大节点数 | `CORTEX_MAX_NODES_PER_DOC` | number | 5 | 1-20 |
| 关键词最大跨度 | `CORTEX_MAX_SPAN` | number | 20 | 1-100 |
| 最少关键词匹配数 | `CORTEX_MIN_KEYWORD_MATCH` | number | 2 | 0-10 |
| 最低邻近度阈值 | `CORTEX_MIN_PROXIMITY_SCORE` | select | 1 | enum {0,1,2} |
| 行级关键词阈值 | `CORTEX_MIN_KEYWORDS_PER_LINE` | number | 2 | 1-10 |
| 综合评分阈值 | `CORTEX_MIN_SCORE_THRESHOLD` | number (step 0.05) | 0.0 | 0-1 |

### Tab 3: 评分（5 字段，全部 ● 即时生效）

tab 顶部有"评分原理（白话版）"info-box：

> 最终得分（0~1）= 把下面 5 个信号按权重做加权平均（每个信号名对应下方一个"XX 权重"字段）：
> - **关键词匹配** —— 文档里命中的关键词数 ÷ 你查询的总词数
> - **文件名匹配** —— 文件名里命中的关键词数 ÷ 总词数
> - **FTS 原始分** —— FTS5 全文检索给的相关度（0~1 之间）
> - **标题匹配** —— 段落标题里命中的关键词数 ÷ 总词数
> - **邻近度** —— 0 / 0.5 / 1 三档（多词紧挨着分数更高）
>
> 权重越大 → 影响越大；设为 `0` = 完全忽略该信号。推荐区间 `0~10`。

| Label | env var | 组件 | 默认 | 范围 |
|---|---|---|---|---|
| 关键词匹配权重 | `CORTEX_WEIGHT_KEYWORD_MATCH` | number + range slider | 3.0 | 0-10 |
| 文件名匹配权重 | `CORTEX_WEIGHT_FILE_NAME_MATCH` | number + range slider | 2.0 | 0-10 |
| FTS 原始分权重 | `CORTEX_WEIGHT_FTS_SCORE` | number + range slider | 2.0 | 0-10 |
| 标题匹配权重 | `CORTEX_WEIGHT_TITLE_MATCH` | number + range slider | 1.5 | 0-10 |
| 邻近度权重 | `CORTEX_WEIGHT_PROXIMITY_MATCH` | number + range slider | 1.0 | 0-10 |

### Tab 4: 终端（3 字段，仅影响 CLI/TUI 终端输出）

tab 顶部 info-box（warn 样式）提示：这些参数仅影响 `cortex` CLI/TUI 的终端输出，对 Web UI 无效。

| Label | env var | 组件 | 默认 |
|---|---|---|---|
| 上下文行数上限 | `CORTEX_MAX_CONTEXT_LINES` | number + "行" 后缀 | 5 |
| 锚点行数上限 | `CORTEX_MAX_ANCHOR_LINES` | number + "行" 后缀 | 3 |
| 锚点上下文扩展范围 | `CORTEX_CONTEXT_EXPAND_RANGE` | number + "行" 后缀 | 5 |

每个字段带中文 hint（详细解释见 mockup）。

## 6. Save Model（显式保存）

### 6.1 Footer 行为

- 滚动时粘性固定在底部
- 左：脏指示 `● N 字段已修改（field1、field2、…）`，无修改时显示 `所有字段与 .env 一致`
- 右：【放弃修改】（ghost 按钮，仅在 dirty 时启用）+【💾 保存XX配置】（primary 按钮）

### 6.2 保存语义

- 点击【💾 保存本地配置】→ `PUT /api/config?scope=local`，body 包含 18 个字段当前值
- 点击【💾 保存全局配置】→ `PUT /api/config?scope=global`
- 后端使用 `python-dotenv` 读取已有 .env（若有）、**只更新 18 个已知 key**、保留其它无关 key（如用户手写的注释或本 GUI 不暴露的字段）、写回
- **空字符串语义**：若某字段在表单中被清空（特别是 `PLANIFY_*`），后端调用 `dotenv.unset_key()` 删除该 key，而非写空字符串（避免 pydantic 把 "" 当成有效值）
- 文件不存在时自动创建（包含本地 `.cortex/` 目录）
- 保存成功后 toast 提示生效条件：
  - 若改了任何 🔁 需重启 字段 → "已保存。重启 cortex gui 后 AI 配置生效。"
  - 若只改了 ● 即时 字段 → "已保存。下次查询立即生效。"

### 6.3 放弃修改

- 点【放弃修改】→ 表单回滚到最近一次加载的值（内存中的 original snapshot）
- dirty 状态清零

## 7. Empty State（本地 .env 不存在）

打开本地配置时，若 `{cwd}/.cortex/.env` 不存在：

- 顶部显示蓝色 banner：`当前工作目录尚未创建 .cortex/.env，将使用全局配置。 [📋 从全局复制并编辑]`
- 点击【📋 从全局复制并编辑】→ 后端先 `cp ~/.cortex/.env {cwd}/.cortex/.env`，再加载到表单
- 用户也可忽略 banner 直接编辑（保存时会自动创建文件，但字段值为空/默认）

**边界情况：**
- 全局 `~/.cortex/.env` 也不存在 → banner 文案改为 `尚未创建任何 .env，编辑后保存将创建新文件`，不显示"从全局复制"按钮
- 全局配置首次运行引导由现有 `_init_first_run()` 处理（首次启动已下载 `.env.example`），通常 `~/.cortex/.env` 都存在

## 8. Technical Design

### 8.1 后端（FastAPI）

新增路由模块 `cortex/web_v2/api/config.py`：

```
GET  /api/config?scope=local|global
  → 200 ConfigResponse{ values: {FIELD: VALUE, ...}, exists: bool }
  → 404 if scope=local 且文件不存在（前端据此显示 empty banner）

PUT  /api/config?scope=local|global
  body: ConfigUpdateRequest{ values: {FIELD: VALUE, ...} }
  → 200 { ok: true, saved_path: str, needs_restart: bool, restart_fields: [str] }
  → 400 ValidationError{ fields: [{field, error}, ...] }
  → 403 if scope=global 且无写权限
```

实现要点：
- 用 `python-dotenv` 的 `dotenv_values()` + `set_key()` 做原地更新
- 验证用 `CortexConfig` Pydantic 模型（构造时 raise → 收集 validation errors）
- `needs_restart` 由本次改动的字段是否包含 🔁 标记决定（PLANIFY_*）
- 路径解析：
  - local → `Path(os.getcwd()) / ".cortex" / ".env"`
  - global → `Path.home() / ".cortex" / ".env"`
- 单元测试：round-trip（write → read 应一致）、保留未列出 key、validation 错误路径

`app.py` 注册新路由：`app.include_router(config.router, prefix="/api")`

### 8.2 前端（Lit + Vite）

**新增文件：**
- `src/components/app-bar.ts` — `<app-bar>` 组件（品牌 + 头像 + 下拉）
- `src/views/settings-view.ts` — `<settings-view>` 组件（4 tab + 表单 + footer）
- `src/api/config.ts` — `getConfig(scope)` / `putConfig(scope, values)` API client

**修改文件：**
- `src/state/types.ts`
  - 扩展 `ViewId`：`"search" | "chat" | "history" | "settings"`
  - 新增 `SettingsScope = "local" | "global"`
  - 新增 `SettingsViewState { scope, values, original, dirty, saving, error }`
- `src/state/store.ts` — 加 `setSettingsScope` / `updateSetting` / `revertSettings` / `saveSettings` actions
- `src/app.ts` —
  - 在最外层包一层 `<app-bar>`
  - `_renderView()` 加 `if (view === "settings") return html\`<settings-view></settings-view>\``
- `src/components/activity-bar.ts` — 不动（保持 3 项）
- `src/components/tab-bar.ts` — 不动（移动端底部不出现 settings）

**AppBar 下拉交互：**
- 头像按钮 click → 切换 `.open` 状态
- 两个 menu-item click → dispatch `navigate` event with `view: "settings"` + `scope`，关闭下拉
- 点外部 → 关闭下拉

**Settings view 状态机：**
- 进入时（scope 改变）→ `getConfig(scope)` → 写入 `values` + snapshot 到 `original`
- 字段编辑 → 更新 `values[field]`，重算 `dirty`（与 `original` 比对）
- 放弃 → `values = clone(original)`
- 保存 → `putConfig(scope, values)` → 成功则 `original = clone(values)`，失败显示错误

**生效标记组件：**
- 每个字段元数据里有 `effect: "live" | "restart"` 属性
- 渲染时在 label 后加 `<span class="effect ${effect}">${label}</span>`
- AI tab 顶部 info-box 强调"本 tab 修改需重启"
- 终端 tab 顶部 info-box warn 提示"仅 CLI/TUI"

### 8.3 字段元数据集中管理

新增 `src/views/settings-fields.ts` 导出 `SETTINGS_FIELDS` 数组，每项：

```typescript
{
  tab: "ai" | "search" | "scoring" | "terminal",
  section: string,           // e.g. "🤖 AI 模型与 API"
  envVar: string,            // e.g. "PLANIFY_API_KEY"
  label: string,             // e.g. "API Key"
  component: "text" | "number" | "select" | "password" | "slider",
  effect: "live" | "restart",
  hint?: string,
  min?: number, max?: number, step?: number,
  options?: { value: string; label: string }[],  // for select
  unit?: string,            // e.g. "行" / "字符"
  mono?: boolean,           // use mono font
  datalist?: string[],      // for text with autocomplete
}
```

`<settings-view>` 根据 `SETTINGS_FIELDS` 渲染整个表单，避免硬编码 HTML。

## 9. Effect Badges

每个字段 label 后带 effect badge：

| 视觉 | 含义 |
|---|---|
| 🟢 `● 即时` | 保存后下次查询/对话立即生效，无需重启 |
| 🟠 `🔁 需重启` | 需要重启 `cortex gui` 才生效（PLANIFY_* 三个字段） |

字段分布：
- 即时：搜索调优 7 + 评分 5 = 12 字段
- 需重启：AI 配置 3 字段
- 终端 3 字段无 effect badge（保存即可，CLI 下次运行生效）

tab strip 顶部有 legend 解释两种 badge 含义。

## 10. Mockup 评审记录

本轮设计经过多轮迭代，关键决策点：

1. **字段范围**：从 ~30 个收敛到 18 个（隐藏文件监控、日志、KB 字符限制、文件类型、解析选项、Ripgrep、XLSX、终端宽度、索引位置）
2. **Tab 划分**：按功能域 4 tab（AI / 搜索 / 评分 / 终端），删除原计划的"通用"和"索引"tab
3. **保存模型**：显式保存（不自动保存），单按钮（按 scope 动态文案）
4. **Scope 入口**：AppBar 下拉菜单是唯一入口，不在页面其它位置重复，不显示文件路径
5. **AppBar 新增**：解决移动端 tab-bar 宽度紧张问题，配置入口上移到顶部
6. **评分公式**：白话版（不用 `Σ`/`sigmoid` 等学术符号），信号名与字段名一一对应
7. **权重范围**：0~10，slider + number 联动

## 11. Open Questions / Risks

- **R1: 头像信息来源**：mockup 占位为 "Liang / liang@example.com"。cortex 当前没有用户系统，头像可能改为通用图标（⚙️ 或 🧑），或显示工作目录名首字母。
- **R2: 全局配置写入权限**：Linux/Mac 上 `~/.cortex/.env` 一般可写；Windows 也通常可写。但仍可能遇到只读场景 → API 返回 403，前端显示错误。
- **R3: 并发写入**：两个浏览器窗口同时编辑同一 scope → 后写覆盖先写。可接受（个人工具场景），不做乐观锁。
- **R4: 索引相关参数已全部移除**：用户后续若想暴露 `CORTEX_ALLOWED_SOURCE_TYPES` 等，需另开 spec。

## 12. Implementation Plan Pointer

下一步：调用 `superpowers:writing-plans` skill 生成分阶段实现计划（前端组件 → 后端 API → 集成 → 测试）。
