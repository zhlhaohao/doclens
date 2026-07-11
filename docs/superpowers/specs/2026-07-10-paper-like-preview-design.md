# Paper-like Preview — Design Spec

**Date:** 2026-07-10
**Topic:** 预览面板改"灰底白纸"纸张效果（md-viewer CSS-only）
**Status:** Approved (pending user spec review)

## 1. 背景与动机

doclens 预览面板对 pdf/pptx/excel（分页 `.page-card`）和 docx/md（单块 `.md-body`）的渲染，**纸张卡片与内容区背景都是白色**（`--cortex-surface #FFFFFF`），白-on-白 → 虽有 border + 浅阴影但无对比，纸张感弱。用户希望"一页一页纸"的视觉。

**根因**：
- `preview-pane` 背景 = `--cortex-surface`（白）— `preview-pane.ts:16`
- `.page-card` 背景 = `--cortex-surface`（白）— `md-viewer.ts:201`
- `md-viewer :host` 无显式背景（继承白）
- → 白纸浮白底，无层次

## 2. 决策（用户已确认）

| 维度 | 决策 |
|------|------|
| 方案 | **B**：分页 + 单块统一"灰底白纸"（所有文档预览一致） |
| 内容区背景 | `:host` → `--cortex-bg` (#F5F5F7 灰) |
| 纸张 | `.md-body`（单块）/ `.page-card`（分页）→ `--cortex-surface` (#FFF 白) + 圆角 8px + 两层阴影 |
| 纸张最大宽度 | `820px`，居中（`max-width` + `margin: 0 auto`），宽屏不撑满 |
| 纸张色 | 纯白 `--cortex-surface`（不做暖白） |
| 分页容器 | `.md-body-paged` 透明 + 无阴影 + 无 padding（覆盖 `.md-body` 的白纸样式），仅居中 —— 确保分页是"多张纸"而非"一张大纸包多页" |
| 响应式 | 移动端 padding/圆角收紧（`@media max-width:768px`） |

## 3. 设计（CSS 改动 — `md-viewer.ts` 的 `static styles`）

```css
/* ① 内容区改灰底（白纸浮起的基础）*/
:host {
  background: var(--cortex-bg);     /* #F5F5F7 灰（原无显式背景）*/
  padding: 20px 16px;                /* 纸张四周灰边（原 12px 16px）*/
}

/* ② 单块预览（docx / md）→ 一张白纸 */
.md-body {
  background: var(--cortex-surface);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,.10), 0 4px 12px rgba(0,0,0,.05);
  padding: 28px 36px;
  max-width: 820px;
  margin: 0 auto;
}

/* ③ 分页容器（pdf/pptx/excel）→ 透明居中（覆盖 ②，让子 page-card 当纸）*/
.md-body-paged {
  background: transparent;
  box-shadow: none;
  padding: 0;
  border-radius: 0;
  max-width: 820px;
  margin: 0 auto;
}

/* ④ 分页卡片 → 白纸增强（去 border 靠阴影；加大内边距与间距）*/
.page-card {
  background: var(--cortex-surface);
  border: none;                       /* 原 1px solid --cortex-border */
  border-radius: 8px;                 /* 原 6px */
  box-shadow: 0 1px 3px rgba(0,0,0,.10), 0 4px 12px rgba(0,0,0,.05);  /* 原 0 1px 3px + 0 1px 2px */
  margin: 0 0 20px;                   /* 原 16px 8px */
  padding: 28px 36px;                 /* 原 14px 20px */
}

/* ⑤ 移动端：纸张边距收紧 */
@media (max-width: 768px) {
  :host { padding: 12px 8px; }
  .md-body, .page-card { padding: 18px 16px; border-radius: 6px; }
}
```

> `.page-card-header`（分页卡片内的 header 标签）样式不变，仍由 `padding-bottom + border-bottom` 提供分隔，在新 padding 下视觉自然。

## 4. 改动范围

**仅** `doclens/web_v2/frontend/src/components/md-viewer.ts` 的 `static styles` CSS。不改动：
- `preview-pane.ts`（外壳保持 `--cortex-surface`）
- `tokens.css`（不新增/改 token）
- 任何后端 / preview 逻辑 / 图片功能
- `render()` 结构（`.md-body` / `.md-body-paged` / `.page-card` class 不变）

改完须 `cd doclens/web_v2/frontend && npm run build` 重建 `static/`。

## 5. 测试

- **vitest**（`md-viewer.spec.ts`）：CSS 在 Lit 是 `static styles`（CSSResult），jsdom 不计算布局，但可断言关键规则存在于已采用样式表（`el.shadowRoot.adoptedStyleSheets` 或渲染后的 `<style>` 文本含 `--cortex-bg` / `max-width: 820px` / `.md-body-paged` 的 `transparent`）。加 1 个回归测试防止样式被误删。
- **视觉确认**（GUI 已启动 @ :7860）：打开 pdf（公众产品赋能平台.pdf）/ docx（绿盟用户手册.docx）/ pptx（无线网络优化.pptx）预览，确认灰底白纸、纸张居中、分页多张纸。

## 6. 边界

- 只改预览内容区视觉，**不影响功能**（图片预览、行定位 `_locateAndHighlight`、分页 `pages` 逻辑、`data-source-line` 全部不变）。
- 不引入新组件/新依赖（YAGNI）。
