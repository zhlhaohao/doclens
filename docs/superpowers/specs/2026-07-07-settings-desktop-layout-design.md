# 桌面端全局配置页面布局改造（F1）

日期：2026-07-07
范围：`doclens/web_v2/frontend/src/views/settings-view.ts`（仅桌面端 ≥1024px）
关联：2026-06-19-cortex-gui-settings-design.md（原 settings 设计）、2026-06-22-settings-mobile-single-column-design.md（移动端单列，本次不动）

## 背景

桌面端全局配置页面（`<settings-view>`）当前布局自上而下：

1. `.copy-banner`（"正在编辑全局配置"）
2. `.scroll-area` 内：`<settings-scope-segment>`（🌍全局/本地）+ `.tab-strip`（AI/搜索调优/评分/终端，**水平顶部**）+ 4 个 `.tab-panel`
3. `.footer-bar`（dirty 状态 + 保存按钮，**通栏底部**）

`.tab-panel` 已 `max-width: 880px; margin: 0 auto`。

问题：tab 在顶部、超宽屏下 tab 与正文距离远；footer 通栏视觉过重；"正在编辑全局配置" banner 与 scope-segment 的"🌍全局"信息重复。

## 目标

桌面端（≥1024px）改为 **F1 布局**：

- 左侧 **sidebar**（全高、固定 180px）：放 `scope-segment` + 垂直 `tab-strip`
- 右侧 **main**：`.tab-panel` 与 `.footer-bar` 都 `max-width: 880px`、共同居中对齐
- **去掉 `.copy-banner`**（scope 已在 sidebar 显示，banner 冗余）
- `.footer-bar` 不再通栏，宽度与 panel 对齐

## 不改动（显式）

- **移动端（<1024px）视觉完全不变**：保留 `.copy-banner` + 顶部 `scope-segment` + 水平 `.tab-strip` + `.tab-panel` + `.footer-bar { display: none }`。
- **不改任何 TS/JS 逻辑**：`_save` / `_load` / `_dirty` / `_onInput` / `store` 订阅等一律不动。
- 不改 `settings-fields.ts`（字段定义）、`settings-scope-segment`（scope 组件）、`api/config.ts`。

## 设计

### DOM 重构（render）

当前 DOM：
```
<settings-view>
  <div class="copy-banner">…
  <div class="scroll-area">
    <settings-scope-segment>
    <nav class="tab-strip">…</nav>
    <div class="tab-panel">…</div> ×4
  </div>
  <div class="footer-bar">…
  <toast-stack>
</settings-view>
```

新 DOM（桌面/移动共用，CSS 控制差异）：
```
<settings-view>
  <div class="copy-banner">…            // 移动保留；桌面 display:none
  <div class="layout">                   // 桌面 flex-row；移动 flex-column
    <aside class="sidebar">              // 桌面 width 180 全高；移动 = 顶部条
      <settings-scope-segment>
      <nav class="tab-strip">…</nav>     // 桌面垂直；移动水平
    </aside>
    <main class="main">                  // 桌面 flex 1；移动 = 下方主体
      <div class="scroll-area">
        <div class="tab-panel">…</div> ×4   // max-width 880 居中
      </div>
      <div class="footer-bar">…             // max-width 880 居中
    </main>
  </div>
  <toast-stack>
</settings-view>
```

要点：
- 新增 `.layout`（包 sidebar + main）、`.sidebar`、`.main` 三个容器；`.scroll-area` 从"装 scope+tab+panel"收敛为"只装 panel"。
- `scope-segment` 与 `tab-strip` 一起移入 `.sidebar`（桌面左侧；移动端随 `.sidebar` 退化为顶部条，视觉等价于现状）。
- `.footer-bar` 移入 `.main`（与 panel 同列），桌面下天然只在 sidebar 右侧、不再通栏。

### CSS —— 桌面（默认规则，即 ≥1024px 行为）

- `.copy-banner { display: none }`（桌面隐藏；移动 @media 复位为显示）
- `.layout { display: flex; flex-direction: row; flex: 1; min-height: 0 }`
- `.sidebar { width: 180px; flex-shrink: 0; display: flex; flex-direction: column; gap: var(--cortex-space-4); padding: var(--cortex-space-6) var(--cortex-space-4); border-right: 1px solid var(--cortex-border); background: var(--cortex-surface) }`
- `.tab-strip { flex-direction: column; gap: var(--cortex-space-1); overflow-x: visible }`（覆盖现有水平 `flex` + `overflow-x: auto`）
- `.tab-strip button { text-align: left; border-bottom: none; border-left: 3px solid transparent }`
- `.tab-strip button.active { border-left-color: var(--cortex-primary); background: var(--cortex-primary-soft) }`
- `.main { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0 }`
- `.scroll-area { flex: 1; overflow-y: auto; padding: var(--cortex-space-6) var(--cortex-space-8) }`
- `.tab-panel { max-width: 880px; margin: 0 auto }`（沿用）
- `.footer-bar { max-width: 880px; margin: 0 auto; width: 100% }`（居中、与 panel 对齐；内部 `dirty-status` + 按钮组保持 `justify-content: space-between`）

### CSS —— 移动端（`@media (max-width: 1023px)`）

新增/调整以适配新 DOM，**视觉等价于现状**：

- `.layout { flex-direction: column }`
- `.copy-banner { display: flex }`（复位显示；保留现有 column/padding 规则）
- `.sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--cortex-border); padding: var(--cortex-space-3) var(--cortex-space-4); flex-direction: column }`
- `.tab-strip { flex-direction: row; overflow-x: auto }`（恢复水平；保留现有 padding/gap/button 规则）
- `.main { flex: 1 }`
- `.footer-bar { display: none }`（沿用现状）
- `.scroll-area` padding 保留现有移动端规则

### 数值

| 项 | 值 | 说明 |
|----|-----|------|
| sidebar 宽度 | `180px` | 容下"搜索调优"4 字 + scope + 左侧 3px 选中条 |
| tab-panel / footer-bar max-width | `880px` | 沿用现有 panel 宽度 |

## 验收

1. **桌面（≥1024px）**：sidebar 在左、180px、贯穿全高，含 `scope-segment` + 垂直 tab；右侧 panel 与 footer 居中、宽度 880 对齐；无 `.copy-banner`。
2. **移动（<1024px）**：与改造前逐像素等价（banner + 顶部 scope + 水平 tab + panel + 无 footer）。
3. 切 tab、切 scope（全局↔本地）、改字段→保存、放弃修改，功能正常。
4. 暗色主题下视觉正常（全部用 CSS 变量，无硬编码色）。
5. 现有 `tests/web_v2` 前端测试（settings 相关）通过；必要时更新因 DOM 类名变动受影响的快照/选择器。

## 风险与边界

- **DOM 重构** 会改变 `settings-view` 内部结构；现有移动端 `@media` 规则引用的类名（`.copy-banner`/`.tab-strip`/`.scroll-area`/`.footer-bar`）大部分保留，但 `.scroll-area` 的语义变化（不再含 scope/tab）需复核移动端 padding 是否仍合理。
- **前端测试**：若 `tests/` 里有直接断言 `tab-strip` 在 `scroll-area` 内、或 `.copy-banner` 显示状态的选择器，需同步更新。实现阶段跑 `npx vitest run tests/settings*.spec.ts tests/md-viewer*.spec.ts` 确认。
- **scope-segment 组件本身不动**，只是换父容器。
- 不涉及后端、不改 `.env` 读写逻辑。
