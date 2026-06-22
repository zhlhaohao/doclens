# Settings Mobile Single-Column Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在移动端浏览器（<1024px）真正以单列模式呈现 `cortex gui` 的 Settings 界面：字段垂直堆叠、scope 段在滚动时保持可见、各 section / info-box / tab-strip 的间距在手机宽度下更紧凑。同时重建静态资源以确保现有 mobile CSS 真正生效。

**Architecture:** 仅在前端 `cortex/web_v2/frontend/` 内做移动端 CSS 增补 + 静态资源重建。沿用现有 `<settings-view>` 的 `@media (max-width: 1023px)` 模式，给 `settings-scope-segment` 增加同样的媒体查询使其在移动端 sticky。不引入新组件、不改 store / API / 后端。

**Tech Stack:** Lit 3 Web Components, Vite, vitest, Playwright, TypeScript

---

## 1. 背景与动机

### 1.1 现状（来自用户截图）

用户在手机浏览器（≈720px viewport）打开 Settings 后观察到：

```
┌─────────────────────────────────────────┐
│ 🧠 Cortex                  L Liang ▾    │  ← <app-bar> (56px)
├─────────────────────────────────────────┤
│                                         │
│   AI 配置   搜索调优   评分   终端        │  ← 4 个 tab 横排（未触发移动样式？）
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 本 tab 的所有参数修改后需重启...      │ │  ← info-box
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🤖 AI 模型与 API                    │ │
│ │                                     │ │
│ │ API Base URL   🔁需重启    ┌──────┐ │ │  ← label + control 并排
│ │ PLANIFY_BASE_URL          │https://│ │
│ │                           │ open..│ │
│ │                           └──────┘ │
│ │                                     │ │
│ │ API Key       🔁需重启    ┌──────┐ │ │
│ │ PLANIFY_API_KEY          │•••••│ │ │
│ │                           └──────┘ │
│ │                                     │ │
│ │ 模型 ID        🔁需重启   ┌──────┐ │ │
│ │ PLANIFY_MODEL_ID         │claude│ │ │
│ │                           └──────┘ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 所有字段与 .env 一致  [放弃修改][💾保存] │  ← footer-bar（应隐藏）
├─────────────────────────────────────────┤
│  🔍 搜索       💬 对话       📁 文件      │  ← 底部 mobile tab-bar
└─────────────────────────────────────────┘
```

**问题**：
- 字段是 **label + control 并排的双列**（应是垂直堆叠的单列）
- footer-bar 的 `放弃修改` / `保存全局配置` 按钮仍然显示（移动端应隐藏，走 app-bar / 头像菜单）
- `settings-scope-segment`（📁本地 / 🌍全局）在视口顶部不可见（应在最顶部 sticky 显示）

### 1.2 根因分析

源码 `settings-view.ts` 已经在 `@media (max-width: 1023px)` 块中定义了所有正确的移动端样式（提交 `20a96e5`、`38c2025`），但 **静态资源未重建**：

```
$ grep "1023" cortex/web_v2/static/assets/index.CzEh6gvE.js
（无匹配）

$ grep "grid-template-columns" cortex/web_v2/static/assets/index.CzEh6gvE.js
（无匹配）
```

最新构建时间：`index.CzEh6gvE.js` = 2026-06-22 20:17（不含 mobile CSS）
源码 `settings-view.ts` 含 mobile CSS（提交于 2026-06-22）

构建产物 `static/assets/` 是 git 跟踪的，必须随源码一起重建并提交。

### 1.3 目标

1. 重建静态资源，让现有 mobile CSS 真正生效
2. 在 mobile CSS 中补齐一些源码遗漏的细节（section / info-box padding、scope-segment sticky、tab-strip 在窄屏的 padding）
3. 在多 viewport（360 / 390 / 768）下补 E2E 测试覆盖

---

## 2. 设计

### 2.1 文件改动清单

| 文件 | 改动 |
|------|------|
| `cortex/web_v2/frontend/src/views/settings-view.ts` | 扩展 `@media (max-width: 1023px)` 块：减小 `.section`/`.info-box`/`.tab-strip` padding |
| `cortex/web_v2/frontend/src/components/settings-scope-segment.ts` | 新增 `@media (max-width: 1023px)` 块：`position: sticky; top: 0; z-index: 5` |
| `cortex/web_v2/frontend/tests/e2e/settings-mobile.spec.ts` | 新增 4 个 viewport-coverage 测试（360 / 390 / 768 sticky / 768 single-column） |
| `cortex/web_v2/static/assets/index.*.js` + `.css` | `npm run build` 重建并提交 |

### 2.2 settings-view.ts 移动端 CSS 增补

在现有 `@media (max-width: 1023px)` 块内追加：

```css
@media (max-width: 1023px) {
  /* 现有规则保持不变 */
  .field { grid-template-columns: 1fr; gap: var(--cortex-space-3); padding: var(--cortex-space-4) 0; }
  .field-label .name { font-size: var(--cortex-fs-md); }
  .scroll-area { padding: var(--cortex-space-3) var(--cortex-space-4) var(--cortex-space-6); }
  .footer-bar { display: none; }
  .input, .select { max-width: 100%; }
  /* slider 单控件 + 数值 chip */
  .slider-row { display: flex; flex-direction: column; gap: var(--cortex-space-2); }
  .slider-row input[type="number"] { display: none; }
  .slider-row input[type="range"] { max-width: 100%; width: 100%; flex: 1; }
  .value-chip { display: inline-block; align-self: flex-start; ... }
  /* Password "显示" 按钮 */
  .password-wrap { max-width: 100% !important; position: static !important; }
  .password-toggle { position: static !important; transform: none !important; ... }
  /* 复制 banner 堆叠 */
  .copy-banner { flex-direction: column; align-items: stretch; padding: var(--cortex-space-3) var(--cortex-space-4); }
  .copy-banner .grow { display: none; }
  .copy-banner button { align-self: flex-end; }
  /* Toast-stack 避开移动 tab-bar */
  toast-stack { bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 12px); ... }
  /* 字段错误红字 */
  .field-error { font-size: var(--cortex-fs-xs); ... }

  /* ===== 新增规则 ===== */
  .section {
    padding: var(--cortex-space-4);   /* 原为 var(--cortex-space-6) = 24px */
    margin-bottom: var(--cortex-space-3);
  }
  .info-box {
    padding: var(--cortex-space-2) var(--cortex-space-3);
    line-height: 1.55;
    font-size: var(--cortex-fs-xs);
  }
  .info-box br + br { display: none; }   /* 折叠长说明的多余空行 */
  .tab-strip {
    padding: 0 var(--cortex-space-3);     /* 原为 0 var(--cortex-space-8) = 32px */
    gap: var(--cortex-space-1);
  }
  .tab-strip button {
    padding: var(--cortex-space-3) var(--cortex-space-2);
    font-size: var(--cortex-fs-sm);
  }
  .copy-banner {
    padding: var(--cortex-space-3);       /* 原为 var(--cortex-space-3) var(--cortex-space-8) */
    font-size: var(--cortex-fs-xs);
  }
}
```

### 2.3 settings-scope-segment.ts 新增媒体查询

```css
@media (max-width: 1023px) {
  :host {
    position: sticky;
    top: 0;
    z-index: 5;
    box-shadow: 0 1px 0 var(--cortex-border);   /* 滚动时显示底边线 */
  }
}
```

### 2.4 视觉差异

| 元素 | 桌面 (≥1024px) | 移动 (<1024px, 当前) | 移动 (<1024px, 目标) |
|------|----------------|---------------------|---------------------|
| `.field` | 2 列 (label 220–280px + control 1fr) | 2 列（CSS 未生效） | **1 列**（label 上 / control 下） |
| `.section` padding | 24px | 24px（CSS 未生效） | **16px** |
| `.info-box` padding | 12px / 16px | 12px / 16px（CSS 未生效） | **8px / 12px**，字号缩到 xs |
| `.tab-strip` 水平 padding | 32px | 32px（CSS 未生效） | **12px**，按钮间距收紧 |
| `.copy-banner` padding | 12px / 32px | 12px / 32px（CSS 未生效） | **12px**，字号缩到 xs |
| `settings-scope-segment` | 默认静态 | 默认静态 | **sticky top:0** |
| footer-bar | 显示 | 显示（CSS 未生效） | **隐藏**（save 走 app-bar，revert 走头像菜单） |

### 2.5 数据流（不变）

```
User input → input element @input event
   → settings-view._onInput(envVar, value)
   → actions.updateSetting(envVar, value)   (store)
   → this._values = { ... }                  (local state)

Save → app-bar save button click
   → window.dispatchEvent("cortex:save-settings")
   → settings-view._onSaveRequest
   → putConfig(this._scope, this._values)
   → actions.loadSettings(values, exists)
   → toast on mobile, inline message on desktop

Revert → avatar menu click
   → window.dispatchEvent("cortex:revert-settings")
   → settings-view._onRevertRequest
   → this._values = { ...this._original }
   → actions.revertSettings()
```

无新增事件、无新增状态、无新增 API 调用。

### 2.6 错误处理（不变）

- Save 失败（移动端）→ toast + `fieldErrors` 内联显示（已实现）
- Copy-from-global 失败（移动端）→ toast（已实现）
- Load 失败（移动端）→ `.scroll-area` 内联错误（已实现）

新增的 sticky scope-segment 不引入新失败模式：若 load 失败，错误信息按自然阅读顺序（scope 之下、字段之上）展示。

### 2.7 生命周期（不变）

现有 I1（生成计数器使过期 load 失效）和 I2（disconnect 时清理 toast 定时器）保留。无新增 async 操作、无新增定时器。

---

## 3. 测试

### 3.1 必须保持通过的现有测试

- `tests/settings-view.spec.ts` — 7 个 vitest 单元测试
- `tests/settings-scope-segment.spec.ts` — scope-change 派发 + 同 scope guard
- `tests/e2e/settings-mobile.spec.ts` — 4 个 Playwright 测试（390px）

### 3.2 新增测试（追加到 `tests/e2e/settings-mobile.spec.ts`）

```ts
test.describe("settings mobile — viewport coverage", () => {
  test("fields are single-column at tablet width (768px)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await page.locator("app-bar .avatar-btn").tap();
    await page.locator("app-bar button.menu-item:has-text('本地配置')").tap();
    const gridCols = await page.locator(".field").first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(gridCols.split(" ").length).toBe(1);
  });

  test("scope segment is sticky-positioned at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator("app-bar .avatar-btn").tap();
    await page.locator("app-bar button.menu-item:has-text('本地配置')").tap();
    await page.locator(".tab-strip button:has-text('评分')").tap();
    // 滚到评分 tab 底部
    await page.evaluate(() => {
      const el = document.querySelector("settings-view")?.shadowRoot
        ?.querySelector(".scroll-area");
      el?.scrollTo(0, 9999);
    });
    // sticky 元素应仍在视口顶部
    const box = await page.locator("settings-scope-segment")
      .evaluate((el) => el.getBoundingClientRect());
    expect(box.top).toBeLessThan(56);  // 56 = app-bar 高度
  });

  test("section padding is reduced at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator("app-bar .avatar-btn").tap();
    await page.locator("app-bar button.menu-item:has-text('本地配置')").tap();
    const padding = await page.locator(".section").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(padding).toBe(16);  // var(--cortex-space-4) = 16px
  });

  test("tab strip fits without overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator("app-bar .avatar-btn").tap();
    await page.locator("app-bar button.menu-item:has-text('本地配置')").tap();
    const overflow = await page.locator(".tab-strip")
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflow).toBe(false);
  });
});
```

### 3.3 Viewport 覆盖矩阵

| Viewport | 设备类别 | 预期行为 |
|----------|----------|----------|
| 360×640 | 紧凑型手机 | 单列字段、sticky scope、tab 无溢出 |
| 390×844 | iPhone 13（已有） | 同上 + 现有 4 个 E2E 测试 |
| 768×1024 | iPad 竖屏 | 单列字段、sticky scope、tab 容纳 4 个 |
| 1024×768 | iPad 横屏 | **桌面布局**（2 列字段、footer 显示） |
| ≥1024 | 桌面 | 不变 |

### 3.4 构建验证

CSS 改动后：
1. `cd cortex/web_v2/frontend && npm run build`
2. `grep "1023" cortex/web_v2/static/assets/index.*.js` 必须有匹配（mobile @media 已在 bundle 中）
3. `grep "grid-template-columns" cortex/web_v2/static/assets/index.*.js` 必须有匹配
4. `git diff cortex/web_v2/static/` 应仅显示资源 hash 变化；HTML diff 仅引用文件名变化

### 3.5 合并前检查清单

- [ ] 所有 vitest 单元测试通过
- [ ] 所有 Playwright E2E 测试在 360 / 390 / 768 / 1024 宽度通过
- [ ] 静态资源已重建并提交
- [ ] 桌面端（≥1024px）无回归（人工核查）
- [ ] 移动浏览器 DevTools 无 console error

---

## 4. 不在范围内

- TUI / CLI / 后端改动
- 新组件、新 store、新 API
- 桌面端视觉变化
- 平板分屏（iPad Slide Over 等）特殊处理
- 横屏手机特殊处理（共享移动端样式即可）

---

## 5. 风险与回滚

- **风险 1**：sticky scope-segment 在某些 Android WebView 中兼容性差
  - 缓解：使用 `position: sticky`（广泛支持），不依赖新的 CSS feature；E2E 在 Chromium / WebKit 中覆盖
- **风险 2**：静态资源 hash 变化导致旧版浏览器缓存失效
  - 缓解：这是 Vite 已有的 cache busting 行为，用户首次刷新即可
- **回滚**：`git revert` 提交，恢复 `cortex/web_v2/frontend/src/views/settings-view.ts`、`settings-scope-segment.ts`、E2E 测试、静态资源即可

---

## 6. 实施步骤摘要

1. 修改 `settings-view.ts` 的 `@media (max-width: 1023px)` 块（追加新规则）
2. 修改 `settings-scope-segment.ts`，新增 `@media (max-width: 1023px)` 块
3. 在 `tests/e2e/settings-mobile.spec.ts` 追加 4 个 viewport 测试
4. `cd cortex/web_v2/frontend && npm run build`
5. 验证 `grep "1023" static/assets/index.*.js` 有匹配
6. `git add` 源码 + 静态资源并提交
7. 跑完整测试套件确认无回归
