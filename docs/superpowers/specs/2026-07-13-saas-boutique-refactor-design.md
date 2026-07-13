# SaaS Boutique 视觉重构设计 Spec

> **目标**：把 doclens web_v2 前端从「Bento Grid teal」整体重构为「SaaS Boutique（Electric Blue）」视觉风格。
>
> **范围（用户确认）**：完整 SaaS Boutique 改造（阶段 A tokens + 阶段 B 全部 32 组件 CSS）· 保留 shadow DOM 内联 · 纯视觉重构（不动 TS 逻辑）。
>
> **真相源**：[`frontend-spec/design-system/MASTER.md`](../../../frontend-spec/design-system/MASTER.md) 已是最终视觉规范；本 spec 只补 SaaS Boutique 落地的**具体执行清单与 token 替换矩阵**，不重复设计语言描述。

---

## 1. 当前状态与差距

### 1.1 当前视觉：Bento Grid（teal + Plus Jakarta Sans + 小圆角）
- `tokens.css` 主色 `#0D9488`（teal-600）
- 字体 `"Plus Jakarta Sans", ...`
- 圆角 `--cortex-radius-lg: 12px`（不大）
- 无双层阴影；无 glow；无渐变；`--cortex-primary-gradient` 已在 `shared-styles.ts` 局部使用但 tokens.css 未导出
- chat 气泡：`#D4F5E8`（薄荷绿）+ 深色文字

### 1.2 目标视觉：SaaS Boutique（Electric Blue + Inter + 16px 圆角 + 双层阴影）
- 主色 `#0052FF`（electric blue）+ `#4D7CFF` 渐变终点
- 字体 `"Inter", ...`（Inter 字间距紧，标题紧凑）
- 圆角 `--cortex-radius-lg: 16px`，新增 `--cortex-radius-xl: 20px`
- 双层阴影 `--cortex-shadow-md` + 主按钮 `--cortex-primary-glow`
- chat 气泡：用户蓝白、助手白底 hairline 边框
- 数据/路径用 `JetBrains Mono`

### 1.3 任务规模
- ~9000 行 TS / 30 组件 shadow DOM CSS + 4 view CSS + tokens + 字体加载
- 现有 vitest 单元测试（~50 文件）+ playwright E2E — **重构不应破坏任何测试**

---

## 2. 阶段 A · 全局 Token 替换

### 2.1 `doclens/web_v2/frontend/src/styles/tokens.css` — 完整替换

| Token | 旧值（Bento） | 新值（SaaS Boutique） | 说明 |
|---|---|---|---|
| `--cortex-primary` | `#0D9488` | `#0052FF` | 主色 teal→electric blue |
| `--cortex-primary-hover` | `#0F766E` | `#003ECC` | hover 加深 |
| `--cortex-primary-soft` | `#F0FDFA` | `#EFF4FF` | soft 高亮底 |
| `--cortex-primary-2` | （未定义） | `#4D7CFF` | **新增**· 渐变终点 |
| `--cortex-primary-gradient` | （未定义） | `linear-gradient(135deg, #0052FF 0%, #4D7CFF 100%)` | **新增** |
| `--cortex-primary-glow` | （未定义） | `0 4px 14px rgba(0,82,255,0.25)` | **新增** |
| `--cortex-bg` | `#F5F5F7` | `#FAFAFA` | 暖白 |
| `--cortex-surface` | `#FFFFFF` | `#FFFFFF` | 不变 |
| `--cortex-surface-muted` | `#FAFAFA` | `#F8FAFC` | slate-50 |
| `--cortex-border` | `#E4E4E7`（zinc） | `#E2E8F0`（slate） | 更冷的 hairline |
| `--cortex-border-muted` | `#F1F5F9` | `#F1F5F9` | 不变 |
| `--cortex-text` | `#0F172A` | `#0F172A` | 不变 |
| `--cortex-text-muted` | `#64748B` | `#64748B` | 不变 |
| `--cortex-text-subtle` | `#94A3B8` | `#94A3B8` | 不变 |
| `--cortex-warning` | `#F59E0B` | `#F59E0B` | 不变 |
| `--cortex-danger` | `#DC2626` | `#DC2626` | 不变 |
| `--cortex-success` | `#10B981` | `#10B981` | 不变 |
| `--cortex-chat-bg` | `#F0F2F9` | `#F8FAFC` | chat 页底色 |
| `--cortex-chat-bubble-user` | `#D4F5E8` | `#0052FF` | 用户气泡蓝 |
| `--cortex-chat-bubble-user-border` | `#B8EBD2` | `#003ECC` | 用户气泡边 |
| `--cortex-chat-bubble-user-text` | `#0F172A` | `#FFFFFF` | 用户气泡白字 |
| `--cortex-chat-bubble-ai` | `#FFFFFF` | `#FFFFFF` | 不变 |
| `--cortex-chat-bubble-ai-border` | `#ECEEF3` | `#E2E8F0` | 统一 hairline |
| `--cortex-chat-section` | `#0D9488` | `#0052FF` | 结构化小节标题色 |
| `--cortex-chat-input-bg` | `#E8F7F2` | `#FFFFFF` | 输入框白底 |
| `--cortex-chat-input-border` | `#9FE0BF` | `#E2E8F0` | 输入框 hairline |
| `--cortex-chat-footer` | `#9CA3AF` | `#94A3B8` | slate-400 |
| `--cortex-font` | `"Plus Jakarta Sans"...` | `"Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif` | 改字体 |
| `--cortex-font-mono` | `"JetBrains Mono"...` | `"JetBrains Mono", "Cascadia Code", Consolas, monospace` | 不变 |
| `--cortex-radius-sm` | `4px` | `6px` | 略增 |
| `--cortex-radius-md` | `8px` | `10px` | 略增 |
| `--cortex-radius-lg` | `12px` | `16px` | 加大· 卡片/面板/主按钮 |
| `--cortex-radius-xl` | （未定义） | `20px` | **新增**· 大卡/dialog |
| `--cortex-shadow-sm` | （未定义） | `0 1px 3px rgba(0,0,0,0.04)` | **新增** |
| `--cortex-shadow-md` | （未定义） | `0 4px 12px rgba(15,23,42,0.08), 0 1px 3px rgba(0,0,0,0.04)` | **新增**· 卡片/面板 |
| `--cortex-shadow-lg` | （未定义） | `0 8px 24px rgba(15,23,42,0.12), 0 2px 6px rgba(0,0,0,0.04)` | **新增**· 浮层/dialog |
| `--cortex-focus-ring` | （未定义） | `0 0 0 3px rgba(0,82,255,0.18)` | **新增**· 输入框 focus |
| `--cortex-focus-ring-danger` | （未定义） | `0 0 0 3px rgba(220,38,38,0.18)` | **新增** |
| `--cortex-space-1..8` | `4/8/12/16/24/32` | 不变 | 4px 基线 |
| `--cortex-fs-xs..xl` | `12/13/14/15/17/30` | 不变（断点内已微调） | |
| `--cortex-activity-bar-width` | `48px` | `48px` | 不变 |
| `--cortex-tab-bar-height` | `44px` | `44px` | 不变 |
| `--cortex-touch-target` | `44px` | `44px` | 不变 |

### 2.2 字体加载

`doclens/web_v2/frontend/index.html` 加 Google Fonts preconnect + Inter / JetBrains Mono link：

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

- 离线（PWA standalone）时降级 `system-ui`（已在 font stack 里）
- `index.html` 在 `doclens/web_v2/frontend/index.html` 还是 `doclens/web_v2/static/index.html`？需实施时确认（vite 输出目标 `../static/`）

### 2.3 `shared-styles.ts` — 已对齐

已使用 `--cortex-primary-gradient` / `--cortex-primary-glow` / `--cortex-radius-lg`，**只需确保 token 已定义**（阶段 A 完成后即生效）。`dialogControlStyles.button.primary` 和 `input:focus` 已用 `--cortex-focus-ring`，阶段 A 加 token 即可。

---

## 3. 阶段 B · 组件级 CSS 改造

### 3.1 改造规则（适用于所有 30 组件 + 4 view）

| Pattern | 旧做法 | 新做法 |
|---|---|---|
| 卡片/面板 | `background: var(--cortex-surface); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md)` | + `box-shadow: var(--cortex-shadow-md); border-radius: var(--cortex-radius-lg)` |
| 主按钮 | `background: var(--cortex-primary); color:#fff` | `background: var(--cortex-primary-gradient); box-shadow: var(--cortex-primary-glow); border:none; border-radius: var(--cortex-radius-lg); color:#fff` |
| hover 主按钮 | `opacity: 0.9` 或 `background: var(--cortex-primary-hover)` | `filter: brightness(1.05)` 或保持 hover token |
| 次按钮 | 同旧 | `background: var(--cortex-surface); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md)` |
| 输入框 focus | `border-color: var(--cortex-primary); outline:none` | + `box-shadow: var(--cortex-focus-ring)` |
| 路径/数字/meta | `font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted)` | + `font-family: var(--cortex-font-mono)` |
| active nav/tab | `color: var(--cortex-primary); background: var(--cortex-primary-soft)` | 不变（已对齐 SaaS Boutique） |
| dialog | 旧无 shadow | + `box-shadow: var(--cortex-shadow-lg); border-radius: var(--cortex-radius-xl)` |
| 圆角统一 | 组件内硬编码 `border-radius: 4px` | 替换为 `var(--cortex-radius-sm/md/lg)` |
| hover 反馈 | 多数为 `:hover` background 变化 | 不变；保持 `:hover`（桌面）/ `:active`（移动） 既有策略 |

### 3.2 逐组件改造清单

> **策略**：每个组件做**最小破坏性修改**——只调整 CSS（`static styles` / `:host`），**不改模板 / 事件 / state / 属性**。组件内可能存在硬编码颜色（如 `app-bar.ts:59` 的 `#10b981`），需 grep 后替换。

#### 3.2.1 核心导航（先做 · 影响最大）

**`app-bar.ts`**（376 行）
- 第 59 行：`watch-badge.dot { color: #10b981; }` → `var(--cortex-success)`
- 第 84-85 行：refresh-btn hover → 加 `color: var(--cortex-primary)`（已有）
- brand logo: `background: var(--cortex-primary)` → 渐变 `var(--cortex-primary-gradient)`
- avatar 按钮：保持，hover 改用 `var(--cortex-primary-soft)`
- watch-badge：hairline 风格保留

**`activity-bar.ts`**（68 行）
- `:host` 加 `border-right: 1px solid var(--cortex-border)`
- nav 按钮 active：背景 `var(--cortex-primary-soft)`、色 `var(--cortex-primary)`（对齐 SaaS Boutique）
- hover：背景 `var(--cortex-surface-muted)`

**`tab-bar.ts`**（68 行）
- 同上，活动 tab 用 `var(--cortex-primary)` + soft 底
- 移动端底部 hairline

#### 3.2.2 表单 / 输入

**`input-box.ts`**（312 行）
- input focus：`box-shadow: var(--cortex-focus-ring)` + `border-color: var(--cortex-primary)`
- 提交按钮（`.submit`）：`background: var(--cortex-primary-gradient); box-shadow: var(--cortex-primary-glow); border-radius: var(--cortex-radius-lg)`
- 模式切换按钮（分裂按钮）：`border-radius: var(--cortex-radius-md)`
- multiline textarea 滚动条样式沿用 global

**`settings-scope-segment.ts`**（66 行）
- pill：active = `background: var(--cortex-primary-soft); color: var(--cortex-primary); border-color: var(--cortex-primary)`
- inactive：`background: var(--cortex-surface); color: var(--cortex-text-muted); border: 1px solid var(--cortex-border); border-radius: 999px`

#### 3.2.3 初始态 / 欢迎

**`welcome-pane.ts`**（68 行）
- 标题：`font-size: var(--cortex-fs-xl); font-weight: 700; letter-spacing: -0.02em`
- 副标题：`color: var(--cortex-text-muted)`
- 状态区 2 行：路径/数字用 `var(--cortex-font-mono)` + `font-size: var(--cortex-fs-xs)` + `color: var(--cortex-text-muted)`

**`history-list.ts`** / **`history-item.ts`**（99 / 77 行）
- 列表容器：标题色 `var(--cortex-text-muted)`，hairline `var(--cortex-border-muted)`
- history-item hover：`background: var(--cortex-surface-muted)`（移动用 `:active`）
- grep mode-tag：`background: var(--cortex-primary-soft); color: var(--cortex-primary); border-radius: var(--cortex-radius-sm); font-family: var(--cortex-font-mono)`

#### 3.2.4 搜索结果 / 分页

**`search-results.ts`**（92 行）
- 容器无视觉改，仅校准 padding/gap

**`result-card.ts`**（168 行）
- `:host` padding: `12px 16px`（加大），`border-radius: var(--cortex-radius-lg)`
- `:host` 加 `box-shadow: var(--cortex-shadow-sm)`
- `:host([active])`：`background: var(--cortex-primary-soft); border-color: var(--cortex-primary)`
- hover：`border-color: var(--cortex-primary)`（已有）
- `.path`：`font-family: var(--cortex-font-mono)`（已有）
- `.badge`：圆角 `var(--cortex-radius-sm)`、色用 primary

**`pagination-bar.ts`**（148 行）
- 按钮：`border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md)`
- active 页码：`background: var(--cortex-primary); color:#fff; border-color: var(--cortex-primary)`
- hover：`background: var(--cortex-surface-muted)`

#### 3.2.5 对话

**`focus-header.ts`**（208 行）
- 圆形返回按钮 hover：`background: var(--cortex-primary-soft); color: var(--cortex-primary)`
- meta 文本：`color: var(--cortex-text-muted); font-family: var(--cortex-font-mono)`

**`chat-stream.ts`**（57 行）
- 容器 `background: var(--cortex-chat-bg)`（token 已改）
- 空态文字色 `var(--cortex-text-muted)`

**`chat-message.ts`**（269 行）
- user 气泡：`background: var(--cortex-chat-bubble-user); color: var(--cortex-chat-bubble-user-text); border: 1px solid var(--cortex-chat-bubble-user-border); border-radius: var(--cortex-radius-lg)`（token 已自动变蓝）
- assistant 气泡：`background: var(--cortex-chat-bubble-ai); border: 1px solid var(--cortex-chat-bubble-ai-border); border-radius: var(--cortex-radius-lg); box-shadow: var(--cortex-shadow-sm)`
- 参考资料 ref-link：`color: var(--cortex-primary); font-weight: 500`
- "思考中..."占位：`color: var(--cortex-text-subtle); font-style: italic`

**`chat-tool-trace.ts`**（214 行）
- summary 行：`background: var(--cortex-surface-muted); border-radius: var(--cortex-radius-md)`
- step done：✓ 用 `var(--cortex-success)`；error：✗ 用 `var(--cortex-danger)`；running 旋转 + `var(--cortex-primary)`
- 复制按钮 hover：`background: var(--cortex-primary-soft); color: var(--cortex-primary)`

#### 3.2.6 文件浏览器

**`file-tree.ts`** / **`tree-node.ts`**（99 / 99 行）
- tree-node 行：hover `background: var(--cortex-surface-muted)`；选中 `background: var(--cortex-primary-soft); color: var(--cortex-primary)`
- 目录名 `font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm)`

**`file-list.ts`**（529 行）
- toolbar 按钮：`border: 1px solid var(--cortex-border); background: var(--cortex-surface); border-radius: var(--cortex-radius-md)`
- 主按钮（mkdir 等如有）：渐变 + glow
- 表头：hairline + `color: var(--cortex-text-muted); font-weight: 500`
- 移动 header：底部 hairline

**`file-row.ts`**（147 行）
- hover：`background: var(--cortex-surface-muted)`
- 选中：`background: var(--cortex-primary-soft)`（已有类似）
- checkbox / icon 列宽保留
- type badge：`border-radius: var(--cortex-radius-sm); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs)`

**`file-search-box.ts`** / **`file-search-results.ts`**（169 / 263 行）
- input focus：`box-shadow: var(--cortex-focus-ring)`
- 结果行 hover：`background: var(--cortex-surface-muted)`；高亮命中：`background: var(--cortex-primary-soft)`
- 元数据（目录/大小/时间）：`font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted)`

#### 3.2.7 预览 / Markdown

**`preview-pane.ts`**（442 行）
- :host 加 `background: var(--cortex-surface); border-radius: var(--cortex-radius-lg)` + 移动端无边
- header：`background: var(--cortex-surface); border-bottom: 1px solid var(--cortex-border-muted); border-radius: var(--cortex-radius-lg) var(--cortex-radius-lg) 0 0`
- "编辑/下载/上传"按钮：次按钮样式
- 移动 mobile-header：hairline 底部 + 返回按钮 hover primary-soft

**`md-viewer.ts`**（478 行）
- :host `padding: 20px 16px`，移动 `12px 8px`
- `.md-body` / `.page-card`：`background: var(--cortex-surface); border-radius: var(--cortex-radius-lg); box-shadow: var(--cortex-shadow-sm); padding: 28px 36px`
- 高亮关键词：`background: rgba(0,82,255,0.15); color: inherit; border-radius: 2px; padding: 0 2px`
- code / pre：`font-family: var(--cortex-font-mono); background: var(--cortex-surface-muted); border-radius: var(--cortex-radius-sm)`

**`md-editor.ts`**（219 行）
- toolbar：`background: var(--cortex-surface); border-bottom: 1px solid var(--cortex-border-muted); border-radius: var(--cortex-radius-lg) var(--cortex-radius-lg) 0 0`
- textarea：`font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm); background: var(--cortex-surface); border-radius: 0 0 var(--cortex-radius-lg) var(--cortex-radius-lg)`
- 行号列：`color: var(--cortex-text-subtle); background: var(--cortex-surface-muted)`
- 保存按钮：主按钮样式

#### 3.2.8 设置页（settings-view）

**`settings-view.ts`**（802 行）+ **`settings-fields.ts`**（317 行）
- `.tab-strip` 按钮 active：左边框（桌面）/ 底边框（移动）`var(--cortex-primary)`
- `.field` 网格：桌面 2 列、移动 1 列（已有）
- `.field-label .env`：`font-family: var(--cortex-font-mono); color: var(--cortex-text-muted)`
- effect badge：「● 即时」`var(--cortex-success)`；「🔁 需重启」`var(--cortex-warning)`
- `.info-box` 警告变体：`background: rgba(245,158,11,0.08); border-left: 3px solid var(--cortex-warning); border-radius: var(--cortex-radius-md)`
- slider `.value-chip`：`background: var(--cortex-primary-soft); color: var(--cortex-primary); font-family: var(--cortex-font-mono); border-radius: var(--cortex-radius-sm)`
- `.footer-bar`：桌面底部 hairline + 居中限宽

#### 3.2.9 Dialog（5 个）

**`mkdir-dialog.ts`** / **`rename-dialog.ts`** / **`move-dialog.ts`** / **`delete-dialog.ts`** / **`reindex-dialog.ts`**
- 对话框：`background: var(--cortex-surface); border-radius: var(--cortex-radius-xl); box-shadow: var(--cortex-shadow-lg)`
- 标题：`font-weight: 600; color: var(--cortex-text); letter-spacing: -0.01em`
- 主按钮（确认）：`var(--cortex-primary-gradient)` + glow（已由 `shared-styles.ts` 提供）
- 危险按钮（delete）：`background: var(--cortex-danger); color: #fff; border-radius: var(--cortex-radius-lg)`
- 警告样式（reindex progress）：`color: var(--cortex-warning)`
- 移动端按钮 column-reverse 全宽 + min-height 44px（已对齐）

#### 3.2.10 杂项

**`toast-stack.ts`**（91 行）
- toast：`background: var(--cortex-surface); border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md); box-shadow: var(--cortex-shadow-lg)`
- success：`border-left: 3px solid var(--cortex-success)`
- error：`border-left: 3px solid var(--cortex-danger)`
- info：`border-left: 3px solid var(--cortex-primary)`

**`drop-zone.ts`**（100 行）
- overlay：`background: rgba(0,82,255,0.05); border: 2px dashed var(--cortex-primary); border-radius: var(--cortex-radius-lg)`

#### 3.2.11 视图层（4 view）

**`search-view.ts`**（657 行）/ **`chat-view.ts`**（670 行）/ **`files-view.ts`**（818 行）/ **`settings-view.ts`**（802 行）
- `.initial-stack`：gap 用 `--cortex-space-6`，max-width 720/760px
- `.focus-body`：内部 gap 用 `--cortex-space-3`
- `.results-col` / `.preview-pane-wrap` / `.focus-main`：layout 调整沿用现有 inline width CSS var
- `.splitter`：hover/active `var(--cortex-primary)`
- `.not-indexed-hint`：`background: var(--cortex-surface-muted); border-radius: var(--cortex-radius-md); color: var(--cortex-text-muted)`
- `.empty`：`color: var(--cortex-text-subtle)`
- `.loading-spinner`：旋转 + `var(--cortex-primary)`

---

## 4. 实施顺序

按"基础 → 导航 → 表单 → 内容 → 设置 → 弹窗"分层：

1. **阶段 A**（30 分钟）
   - 改 `tokens.css`（一张表完整替换）
   - 改 `index.html` 加字体 link
   - 重启 dev server，肉眼验证全局色/字/圆角/阴影立即生效

2. **阶段 B-1 核心导航与壳**（30 分钟）
   - `app-bar` / `activity-bar` / `tab-bar` / `focus-header`
   - `shared-styles.ts` 核对

3. **阶段 B-2 表单**（30 分钟）
   - `input-box` / `settings-scope-segment` / `pagination-bar` / `toast-stack`
   - 各 dialog

4. **阶段 B-3 内容组件**（60 分钟）
   - `welcome-pane` / `history-list` / `history-item`
   - `search-results` / `result-card`
   - `chat-stream` / `chat-message` / `chat-tool-trace`
   - `file-tree` / `tree-node` / `file-list` / `file-row` / `file-search-box` / `file-search-results`

5. **阶段 B-4 预览与设置**（45 分钟）
   - `preview-pane` / `md-viewer` / `md-editor`
   - `settings-view` / `settings-fields`

6. **阶段 B-5 视图层与收尾**（30 分钟）
   - 4 个 view 的 shadow DOM CSS 微调（layout gap/empty/spinner）
   - `drop-zone` / 各 dialog

7. **验证**（30 分钟）
   - 跑 `npm run build`
   - 跑 vitest 单测（应全绿）
   - 启动 dev server `pwsh start-app.ps1 gui`，肉眼 review 桌面/移动两套样式
   - 必要时跑 playwright E2E（如果有相关测试）

---

## 5. 测试策略

### 5.1 不动的测试
- 所有 vitest 单元测试（~50 文件）：纯视觉重构，逻辑未改，**期望全绿**
- `scrollbar-style.test.ts` 可能受 token 变化影响 — 视内容而定（如其断言颜色/数值）

### 5.2 视觉验证
- 启动 `pwsh start-app.ps1 gui`，手动浏览 search/chat/files/settings 四个页面，桌面 + 移动断点（DevTools 切到 375px）
- 重点观察：
  - 蓝渐变主按钮 + glow
  - 卡片双层阴影
  - chat 用户气泡从薄荷绿变蓝白
  - 路径/数字是否用 mono 字体（树/文件列表/历史）
  - 移动端按钮触控目标 ≥44px

### 5.3 构建验证
- `cd doclens/web_v2/frontend && npm run build` — 必须无 TS / Vite 报错
- 检查 `doclens/web_v2/static/assets/` 是否产出新 hash 的 JS/CSS（按需 git 跟踪）

---

## 6. 风险与回退

| 风险 | 缓解 |
|---|---|
| token 替换后某些组件颜色不一致（残留硬编码） | 阶段 B 实施时用 `grep -n '#[0-9a-fA-F]\{6\}' doclens/web_v2/frontend/src/` 全量扫描硬编码色，逐个替换 |
| Google Fonts 加载失败 / 离线 PWA | font stack 已含 `system-ui` 兜底；可观察视觉降级可接受 |
| 圆角加大后部分小元素视觉失衡（如 checkbox） | 阶段 B-1/2 完成后肉眼 review，按需微调 |
| 阴影叠加在深色背景上不明显 | SaaS Boutique 主色背景浅（`#FAFAFA`），阴影可视；如有问题回退到 `--cortex-shadow-sm` |
| 阶段 A 后忘了清理旧 token 引用 | 跑 `grep -rn 'var(--cortex-primary' src/` + `grep -rn '#0D9488\|#0F766E' src/`（旧 teal 值应 0 命中） |
| 重构过程引入回归 | 阶段 A/B-1 完成即跑一次 vitest，及早发现问题 |

**回退方案**：`git reset HEAD~1` 即可回到原状；阶段 A / 阶段 B-1/2/3/4/5 可分别 commit，便于逐层回退。

---

## 7. 提交策略（git）

按用户全局规则：
- **未经明确允许，禁止 commit** —— 本次重构完成后请用户确认
- **禁止 `Co-Authored-By:`**
- 提交格式：`<type>(scope): <description>` — type 用 `refactor` 或 `feat`，scope 用 `web_v2` 或 `frontend`
- **建议分段提交**（便于 review / 回退）：
  1. `refactor(web_v2): 替换 tokens.css 为 SaaS Boutique 设计语言`
  2. `refactor(web_v2): 阶段 B-1 核心导航与壳组件 CSS 重构`
  3. `refactor(web_v2): 阶段 B-2 表单组件 CSS 重构`
  4. `refactor(web_v2): 阶段 B-3 内容组件 CSS 重构`
  5. `refactor(web_v2): 阶段 B-4 预览与设置 CSS 重构`
  6. `refactor(web_v2): 阶段 B-5 视图层与收尾`
  7. `chore(web_v2): 重新构建前端静态资产`

---

## 8. 范围外（明确不做）

- 不改任何 `.ts` 逻辑 / props / events / state
- 不改测试代码
- 不改后端 API
- 不改路由结构
- 不引入新依赖
- 不改 `breakpoints.css` 断点（仅 token 数值微调已包含）
- 不重构 `shared-styles.ts` 接口（仅核对 token 是否齐备）
- 不做 a11y / i18n 改进（保持现状）

---

## 9. 验收清单

- [ ] `tokens.css` 完整对齐 SaaS Boutique 表
- [ ] `index.html` 含 Google Fonts preconnect + Inter/JetBrains Mono link
- [ ] 30 个组件的 shadow DOM CSS 按 3.2 改造清单执行完毕
- [ ] 4 个 view 的 shadow DOM CSS 微调完毕
- [ ] 5 个 dialog 的视觉对齐 SaaS Boutique
- [ ] `npm run build` 成功
- [ ] vitest 全绿（~50 文件）
- [ ] 桌面（≥1024）4 个页面肉眼 review 通过
- [ ] 移动（<1024）4 个页面肉眼 review 通过
- [ ] grep 验证：无旧 teal 硬编码残留（`#0D9488` / `#0F766E` 等）
- [ ] 已有用户修改的工作流（搜索/对话/上传/编辑/预览/设置）功能完全保留