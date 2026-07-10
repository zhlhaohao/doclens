# Paper-like Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让预览面板（pdf/pptx/excel 分页 + docx/md 单块）变成"灰底白纸"的纸张效果。

**Architecture:** 纯 CSS 改动 —— `md-viewer` 的 `:host` 内容区改灰底（`--cortex-bg`），内容（`.md-body` 单块 / `.page-card` 分页）保持白纸（`--cortex-surface` + 圆角 + 两层阴影 + max-width 居中）。`.md-body-paged` 用 `transparent` 覆盖 `.md-body` 白纸样式，确保分页是"多张纸"。不改 render 结构、不改 preview-pane/后端/逻辑。

**Tech Stack:** Lit (`static styles`)、vitest + @open-wc、Vite (`npm run build`)。

## Global Constraints

- **方案 B**：分页 + 单块统一"灰底白纸"
- `:host` background → `--cortex-bg`（#F5F5F7）；`padding` → `20px 16px`
- `.md-body`（单块）/ `.page-card`（分页）→ `--cortex-surface`（#FFF）+ `border-radius: 8px` + 两层阴影 `0 1px 3px rgba(0,0,0,.10), 0 4px 12px rgba(0,0,0,.05)` + `padding: 28px 36px`
- `max-width: 820px` + `margin: 0 auto`（纸张居中，宽屏不撑满）
- `.md-body-paged` 必须在 `.md-body` **之后**定义，用 `background: transparent; box-shadow: none; padding: 0; border-radius: 0;` 覆盖（保留 max-width + margin auto）
- `.page-card` 去掉 `border`（靠阴影），`margin: 0 0 20px`（卡片间距）
- 移动端 `@media (max-width: 768px)`：`:host` padding `12px 8px`；`.md-body, .page-card` padding `18px 16px`、`border-radius: 6px`
- **改动范围**：仅 `doclens/web_v2/frontend/src/components/md-viewer.ts` 的 `static styles` + `tests/md-viewer.spec.ts` 加 1 个 CSS 回归测试。不改 `preview-pane.ts` / `tokens.css` / 后端 / `render()` 结构
- 改完必须 `cd doclens/web_v2/frontend && npm run build`
- Git：已授权连续执行；message `<type>: <desc>`；禁止 Co-Authored-By

## File Structure

| 文件 | 动作 | 职责 |
|------|------|------|
| `doclens/web_v2/frontend/src/components/md-viewer.ts` | ✏️ 改 | `static styles`：`:host` 加灰底；新增 `.md-body`/`.md-body-paged`；`.page-card` 增强；加 `@media` |
| `doclens/web_v2/frontend/tests/md-viewer.spec.ts` | ✏️ 改 | 加 1 个 CSS 回归测试（断言灰底/白纸/透明覆盖/去 border） |
| `doclens/web_v2/static/` | ✏️ 重建 | `npm run build` 产物 |

---

### Task 1: 纸张效果 CSS（灰底白纸）

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/md-viewer.ts`（`static styles`）
- Modify: `doclens/web_v2/frontend/tests/md-viewer.spec.ts`
- Build: `doclens/web_v2/static/`

**Interfaces:**
- Consumes: `--cortex-bg`(#F5F5F7)、`--cortex-surface`(#FFF) —— `tokens.css` 现有，不改
- Produces: md-viewer 视觉从"白-on-白"变为"灰底白纸"；`.md-body`/`.md-body-paged`/`.page-card` 的 class 名不变（render 结构不动）

- [ ] **Step 1: 写 CSS 回归测试（先红）**

在 `tests/md-viewer.spec.ts` 的最后一个 `it(...)` 之后、顶层 `describe` 闭合 `});` 之前，追加：

```typescript
  it("renders paper-like preview: gray host + white paper + transparent paged container (regression)", async () => {
    // 纸张效果：:host 灰底让白纸浮起；.md-body 单块白纸；.md-body-paged 透明覆盖
    // （让分页 page-card 当多张纸，而非一张大纸包多页）；.page-card 去 border 靠阴影。
    const cssText = (MdViewerClass as any).styles.cssText as string;

    // :host 灰底
    expect(
      /:host\s*\{[^}]*background:\s*var\(--cortex-bg\)/.test(cssText),
      `:host should set background: var(--cortex-bg)\n${cssText}`,
    ).toBe(true);

    // .md-body 单块 = 白纸 + max-width 居中
    expect(
      /\.md-body\s*\{[^}]*background:\s*var\(--cortex-surface\)/.test(cssText),
      `.md-body should be white paper (background: var(--cortex-surface))\n${cssText}`,
    ).toBe(true);
    expect(
      /\.md-body\s*\{[^}]*max-width:\s*820px/.test(cssText),
      `.md-body should have max-width: 820px\n${cssText}`,
    ).toBe(true);

    // .md-body-paged 透明覆盖（注意：必须出现在 .md-body 之后才能覆盖）
    expect(
      /\.md-body-paged\s*\{[^}]*background:\s*transparent/.test(cssText),
      `.md-body-paged must override .md-body to transparent\n${cssText}`,
    ).toBe(true);

    // .page-card 去 border，靠 box-shadow
    expect(
      /\.page-card\s*\{[^}]*border:\s*none/.test(cssText),
      `.page-card should drop border, rely on shadow\n${cssText}`,
    ).toBe(true);
  });
```

> 注：`MdViewerClass` 与现有测试同（文件顶部已定义）。regex 用 `[^}]*` 容忍规则块内空白/其他属性。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd doclens/web_v2/frontend && npm test -- --run md-viewer`
Expected: FAIL — `:host should set background: var(--cortex-bg)`（当前 :host 无 background）

- [ ] **Step 3: 改 `:host`（加灰底 + padding）**

`md-viewer.ts` 的 `static styles` 里，把现有 `:host { ... }` 块（约 line 106-119）改为：

```css
    :host {
      display: block;
      padding: 20px 16px;
      background: var(--cortex-bg);   /* 灰底：让白纸浮起 */
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-base);
      line-height: 1.7;
      color: var(--cortex-text);
      overflow: auto;
      /* 作为 preview-pane (flex column) 的 flex item，必须用 flex 填充
         而非 height: 100%。height: 100% + overflow: auto 在 iOS Safari
         中会触发 flexbox 触摸滚动 bug，导致手指滑动无法滚动内容。 */
      flex: 1 1 0;
      min-height: 0;
    }
```

- [ ] **Step 4: 新增 `.md-body` / `.md-body-paged` 规则**

在 `static styles` 里、`:host img { ... }` 规则块**之后**、`.empty { ... }` 规则**之前**，插入：

```css
    /* 单块预览（docx/md）= 一张白纸；max-width 居中，宽屏不撑满 */
    .md-body {
      background: var(--cortex-surface);
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.10), 0 4px 12px rgba(0, 0, 0, 0.05);
      padding: 28px 36px;
      max-width: 820px;
      margin: 0 auto;
    }
    /* 分页容器（pdf/pptx/excel）：覆盖 .md-body 白纸为透明，
       仅保留居中 —— 让子 .page-card 当"多张纸"而非"一张大纸包多页"。
       必须在 .md-body 之后定义才能覆盖。 */
    .md-body-paged {
      background: transparent;
      box-shadow: none;
      padding: 0;
      border-radius: 0;
      max-width: 820px;
      margin: 0 auto;
    }
```

- [ ] **Step 5: 改 `.page-card`（去 border、增强阴影、加大 padding/间距）**

把现有 `.page-card { ... }` 块（约 line 200-207）改为：

```css
    /* 分页卡片：白纸，靠阴影区分（去 border） */
    .page-card {
      background: var(--cortex-surface);
      border: none;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.10), 0 4px 12px rgba(0, 0, 0, 0.05);
      margin: 0 0 20px;
      padding: 28px 36px;
    }
```

- [ ] **Step 6: 新增移动端 `@media`**

在 `static styles` 末尾、闭合的 `` ` `` （css template literal 结束）**之前**，追加：

```css
    /* 移动端：纸张边距收紧 */
    @media (max-width: 768px) {
      :host { padding: 12px 8px; }
      .md-body, .page-card {
        padding: 18px 16px;
        border-radius: 6px;
      }
    }
```

- [ ] **Step 7: 运行测试确认通过**

Run: `cd doclens/web_v2/frontend && npm test -- --run md-viewer`
Expected: PASS（含新纸张回归测试 + 原有测试；已知的 2 个 pre-existing `_locateAndHighlight` 失败与本改动无关，忽略）

- [ ] **Step 8: 构建静态产物**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 构建成功，`doclens/web_v2/static/index.html` 引用新的 `assets/index.*.js`（hash 变化）。

- [ ] **Step 9: Commit（已授权）**

```bash
git add doclens/web_v2/frontend/src/components/md-viewer.ts \
        doclens/web_v2/frontend/tests/md-viewer.spec.ts \
        doclens/web_v2/static
git commit -m "feat(web): 预览面板改灰底白纸纸张效果"
```

---

## Self-Review

**1. Spec 覆盖**（对照 `2026-07-10-paper-like-preview-design.md`）：
- §2 决策（方案 B / :host 灰 / 白纸 / max-width 820 / .md-body-paged 透明 / 移动端）→ Steps 3-6 ✅
- §3 CSS 5 段 → Steps 3(:host) / 4(.md-body+.md-body-paged) / 5(.page-card) / 6(@media) ✅
- §4 改动范围仅 md-viewer.ts styles + spec + static → ✅
- §5 测试（vitest 样式存在性）→ Step 1 ✅

**2. 占位符扫描**：无 TBD/TODO；每步含完整 CSS 或测试代码。✅

**3. 一致性**：
- `.md-body-paged` 必须在 `.md-body` 之后（CSS 同特异性后者覆盖）→ Step 4 明确"在 :host img 之后插入"，.md-body 先 .md-body-paged 后 ✅
- `.page-card` 去 border + 新阴影/margin/padding → Step 5 ✅
- 测试 regex 用 `[^}]*` 容忍属性顺序/空白，且 `\.md-body\s*\{` 不会误匹配 `.md-body-paged {`（后者 `.md-body` 后是 `-paged` 非空白/{ ）✅

无遗漏，计划完整。
