# Mobile Preview Header Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在移动端浏览器预览 Markdown 时，移除 `preview-pane` 内部的路径 header（与 `focus-header` 重复），并把 "✏️ 编辑" 按钮移到 `focus-header` 最右侧新增的 "更多 ▾" 下拉菜单中，节省垂直空间。

**Architecture:** 给 `focus-header` 加一个可选的 `actions` 属性，渲染 "更多 ▾" 按钮 + 下拉面板（沿用 `app-bar` 的菜单样式）。给 `preview-pane` 加 `noHeader` 属性，从 DOM 真正移除内部 header。`search-view` 在移动端 detail-overlay 同时启用这两个 prop。

**Tech Stack:** Lit 3 Web Components, Vite, vitest, TypeScript

---

## 1. 背景与动机

### 1.1 当前移动端预览布局（垂直堆叠）

```
┌─────────────────────────────────────────┐
│ ← 返回   科技/doc.md           (空)     │  ← <focus-header> (focus-header.ts)
├─────────────────────────────────────────┤
│ 科技/doc.md              [✏️ 编辑]      │  ← <preview-pane> 内部 .header (preview-pane.ts:18-28)
├─────────────────────────────────────────┤
│                                         │
│   # Hello                               │
│                                         │
│   Markdown 内容正文...                  │  ← <md-viewer>
│                                         │
└─────────────────────────────────────────┘
```

**问题**：
- `focus-header` title 已显示完整路径（`detailTop.path`）
- `preview-pane` 内部 `.header` 又显示一次路径（重复）
- 在窄屏（< 1024px）下，`.header` 的 padding/border 多占约 40px 垂直空间
- "✏️ 编辑" 按钮放在 `.header` 上，绑定了整行的位置

### 1.2 目标布局

```
┌─────────────────────────────────────────┐
│ ← 返回   科技/doc.md       更多 ▾      │  ← <focus-header>（新增 "更多" 按钮）
├─────────────────────────────────────────┤
│                                         │
│   # Hello                               │
│                                         │
│   Markdown 内容正文...                  │  ← <md-viewer>（preview-pane 内部无 header）
│                                         │
└─────────────────────────────────────────┘
```

点击 "更多 ▾" 展开（按钮图标通过 CSS `transform: rotate(180deg)` 翻转）：

```
┌─────────────────────────────────────────┐
│ ← 返回   科技/doc.md       更多 ▾      │  ← focus-header（按钮 ▾ 旋转为 ▴）
├─────────────────────────────────────────┤
│  ┌──────────────────────────┐           │
│  │ ✏️  编辑                  │  ← 菜单项 │
│  └──────────────────────────┘           │
├─────────────────────────────────────────┤
│   # Hello                               │
│   ...                                   │
└─────────────────────────────────────────┘
```

### 1.3 桌面端不受影响

桌面端（≥ 1024px）布局：
- `focus-header` 显示搜索 query（不是文件路径）
- `preview-pane` 独立成列，**保留**自己的 `.header`（路径 + 编辑按钮）

本次改动**仅影响移动端** detail-overlay 路径。

---

## 2. 设计

### 2.1 focus-header 新增属性

```typescript
export interface FocusHeaderAction {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
}

@property({ attribute: false }) actions: FocusHeaderAction[] = [];
@state() private _menuOpen = false;
```

**渲染规则**：
- `actions.length === 0` → 不渲染 "更多" 按钮（focus 状态保持原样）
- `actions.length > 0` → 在 meta 之后渲染 `<button class="more-btn">更多 ▾</button>`

**下拉面板**：
- `position: absolute; top: 100%; right: 0`
- 复用 `app-bar` 的 `.user-menu` 样式（280px 宽，圆角，阴影）
- 每项 icon + label（无 description，与 app-bar 不同）
- 点击某项：调用 `onClick()` → 关闭菜单

**关闭行为**：
- 点击某项后关闭
- 点击组件外部关闭（`document.addEventListener("click", ...)`，沿用 `app-bar` 模式）
- `Escape` 键关闭（可选；v1 不实现，YAGNI）

**无障碍**：
- `<button aria-haspopup="true" aria-expanded=${this._menuOpen}>`
- 面板 `<div role="menu">`
- 菜单项 `<button role="menuitem">`

### 2.2 preview-pane 新增属性

```typescript
@property({ type: Boolean }) noHeader = false;
```

**渲染规则**：
- `noHeader === false` → 现有行为不变（保留 `.header` div）
- `noHeader === true` → **三个** render 分支（markdown-preview / markdown-edit / non-md）都不渲染 `.header` div

**关键点**：
- 从 DOM 真正移除（非 `display: none`），让屏幕阅读器和小屏布局都正确
- 不影响 `.body` 内的内容渲染

**新增 public 方法**：

```typescript
/** Public API: 让父组件（search-view / focus-header actions 回调）触发进入编辑模式。 */
enterEdit() {
  this._mode = "edit";
}
```

将现有的 `private _enterEdit` 重命名为 public `enterEdit()`。

### 2.3 search-view 接线

#### detail-overlay 区域（移动端）

```typescript
${detailTop ? html`
  <div class="detail-overlay">
    <focus-header
      back-label="结果"
      title=${detailTop.path}
      .actions=${this.previewWritable
        ? [{ label: "✏️ 编辑", icon: "✏️", onClick: () => this._enterPreviewEdit() }]
        : []}
      @back=${this._popDetail}>
    </focus-header>
    ${this.previewError === "NOT_INDEXED"
      ? this._renderNotIndexedHint(false)
      : html`<preview-pane
          ?noHeader=${true}                              <!-- 移动端：移除内部 header -->
          path=${this.previewPath}
          language=${this.previewLanguage}
          content=${this.previewContent}
          .line=${this.previewLine}
          .keyword=${s.query}
          ?writable=${this.previewWritable}
          @dirty-change=${this._onPreviewDirty}
          @saved=${this._onPreviewSaved}
          @save-failed=${this._onPreviewSaveFailed}>
        </preview-pane>`}
  </div>` : null}
```

**新增私有方法**：

```typescript
private _enterPreviewEdit() {
  const pp = this.shadowRoot?.querySelector(".detail-overlay preview-pane") as any;
  pp?.enterEdit?.();
}
```

#### focus 状态

```typescript
<focus-header
  back-label="新搜索"
  title=${s.query}
  meta=${`${s.total} 条结果...`}
  @back=${this._backToInitial}>
</focus-header>
```

**不传 `actions`**，保持空数组默认值 → 不渲染 "更多" 按钮。

#### desktop-only preview-pane

完全不变（保留 `?writable`、保留 `preview-pane` 内部 `.header`）。仅 detail-overlay 的 preview-pane 加 `?noHeader=${true}`。

### 2.4 边界与异常

| 场景 | 行为 |
|------|------|
| 不可写文件（CSV / PDF / 权限） | `previewWritable=false` → `actions=[]` → "更多" 按钮不显示（与桌面端行为一致） |
| 桌面端 detail-overlay | `@media (min-width: 1024px) { .detail-overlay { display: none } }` 隐藏整个 overlay → 用户感知不到改动 |
| 桌面端 focus 状态 | focus-header 不传 actions → 不显示 "更多" → 桌面布局完全不变 |
| focus-header `_menuOpen` 状态泄漏 | 组件 `disconnectedCallback` 清理 document click listener（与 app-bar 一致） |
| 移动端编辑模式 | `focus-header` 仍显示路径（`detailTop.path`），`preview-pane` 无 header，进入编辑时由 `md-editor` 全屏接管 |

---

## 3. 文件清单

### 3.1 修改

| 文件 | 改动概要 |
|------|---------|
| `cortex/web_v2/frontend/src/components/focus-header.ts` | 加 `actions` 属性 + "更多 ▾" 按钮 + 下拉面板 + 状态管理 |
| `cortex/web_v2/frontend/src/components/preview-pane.ts` | 加 `noHeader` 属性 + 三个 render 分支条件渲染 + public `enterEdit()` |
| `cortex/web_v2/frontend/src/views/search-view.ts` | detail-overlay focus-header 传 actions；detail-overlay preview-pane 加 `?noHeader`；新增 `_enterPreviewEdit()` 私有方法 |

### 3.2 新增测试

| 文件 | 用例数 | 覆盖 |
|------|--------|------|
| `cortex/web_v2/frontend/tests/focus-header.spec.ts` | 5 | 空 actions 不渲染 / 有 actions 渲染 / 点击切换 / 点击菜单项触发 onClick + 关闭 / 点击外部关闭 |
| `cortex/web_v2/frontend/tests/preview-pane.spec.ts`（追加） | +2 | `noHeader=true` 时不渲染 `.header` / public `enterEdit()` 切换模式 |

### 3.3 构建产物

- `cd cortex/web_v2/frontend && npm run build`
- 提交 `cortex/web_v2/static/index.html` 和 `cortex/web_v2/static/assets/*` 的变更

---

## 4. 验收标准

### 4.1 移动端（< 1024px）

- [ ] detail-overlay 下，preview-pane 上方只有一层 focus-header（不再有内部重复的路径条）
- [ ] focus-header 右侧显示 "更多 ▾" 按钮
- [ ] 点击 "更多 ▾" 展开下拉，含 "✏️ 编辑" 一项
- [ ] 点击 "✏️ 编辑" 后菜单关闭，preview-pane 进入编辑模式（md-editor 全屏）
- [ ] 不可写文件：focus-header 右侧无 "更多" 按钮
- [ ] 编辑模式下 focus-header title 仍显示路径

### 4.2 桌面端（≥ 1024px）

- [ ] preview-pane 仍显示自己的 `.header`（路径 + "✏️ 编辑" 按钮）
- [ ] focus 状态 focus-header 右侧无 "更多" 按钮
- [ ] detail-overlay 在桌面端通过 CSS 隐藏

### 4.3 测试与质量门

- [ ] `npx vitest run` 全部通过（79 已有 + 7 新增 = 86 期望）
- [ ] `npx tsc --noEmit` 无错误
- [ ] `npm run build` 成功，输出到 `cortex/web_v2/static/`
- [ ] 手工 smoke：浏览器 devtools 切到 iPhone 视图，进入搜索→点结果→"更多 ▾" 出现→点编辑可进入编辑

---

## 5. 不在范围内

- 桌面端 preview-pane 内部 header 移除（保持现状）
- "更多" 菜单预置其他项（"复制路径"、"在新窗口打开"等；后续按需添加）
- "更多" 面板的 Escape 键关闭（v1 暂不实现）
- 编辑模式独立的保存/取消按钮（沿用现有 md-editor 的 UI）
- 自适应布局（`@container` queries）改造
