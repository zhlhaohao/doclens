# 图片 icon 尺寸自适应 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 MD 预览中小尺寸 icon 按原始像素显示（不被 `max-width:100%` 拉伸到容器全宽），大图维持现有铺满行为。

**Architecture:** 纯前端方案。`md-viewer` 渲染后 `querySelectorAll('img')` 读 `naturalWidth`（底层像素），≤500px 的设 `style.width = naturalWidthpx`（绕开 `max-width:100%`），大图不动（继续铺满）。不改后端、不重新索引。

**Tech Stack:** TypeScript, Lit 3, marked 18, Vitest 2, @open-wc/testing, jsdom

**Spec:** `docs/superpowers/specs/2026-07-13-image-icon-sizing-design.md`

## Global Constraints

- **Git 规则（用户硬性要求）**：未经用户明确允许，**禁止 commit / push**。每个 Task 末尾的 commit 步骤必须等待用户授权后才执行；commit message 格式 `<type>: <desc>`，**禁止 `Co-Authored-By:`**。
- **测试命令**：`cd doclens/web_v2/frontend && npx vitest run tests/md-viewer.spec.ts`（单文件）；`npm test` 跑全部（= `vitest run`）。环境为 **jsdom**。
- **前端构建**：`cd doclens/web_v2/frontend && npm run build`（= `tsc --noEmit && vite build`，输出到 `doclens/web_v2/static/`，已 git 跟踪）。
- **jsdom 图片局限**：jsdom 不加载图片，`img.naturalWidth` 恒 0、`img.complete` 恒 false → 测试用 `Object.defineProperty` mock `naturalWidth`，并手动 `img.dispatchEvent(new Event("load"))` 触发回调。
- **YAGNI 边界**：不改后端 parser、不改 `_meta.json`、不重新索引、不做 lightbox、不处理高分辨率设计 icon / SVG 矢量图。

## File Structure

- **Modify** `doclens/web_v2/frontend/src/components/md-viewer.ts`
  - 新增模块级 `export const ICON_PX_THRESHOLD = 500`（带依据注释）
  - 新增模块级 `export function iconWidthStyle(naturalWidth): string | null`
  - 新增 `MdViewer` 私有方法 `_applyIconSizing()`
  - `updated()` 加一个 `if` 块接入
  - **CSS 不改**（现有 `:host img { max-width:100%; height:auto }` 配合 `style.width` 即可）
- **Modify** `doclens/web_v2/frontend/tests/md-viewer.spec.ts`
  - 新增 `iconWidthStyle` 纯函数测试块
  - 新增 `_applyIconSizing` 组件测试块

---

## Task 1: iconWidthStyle 纯函数 + 阈值常量

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/md-viewer.ts`（在 `escapeHtml` 函数之后、`blockRenderer` 注释之前插入，约 line 41–43 之间）
- Test: `doclens/web_v2/frontend/tests/md-viewer.spec.ts`（import 区追加 + 文件末尾追加 describe）

**Interfaces:**
- Produces: `export const ICON_PX_THRESHOLD = 500`；`export function iconWidthStyle(naturalWidth: number): string | null` —— Task 2 的 `_applyIconSizing` 依赖此函数。

- [ ] **Step 1: 写失败测试（纯函数边界）**

在 `tests/md-viewer.spec.ts` 的 import 区（line 1–6）追加：

```ts
import { iconWidthStyle, ICON_PX_THRESHOLD } from "../src/components/md-viewer";
```

在文件末尾（现有 `describe("<md-viewer>", ...)` 的闭合 `});` 之后，line 293 之后）追加：

```ts
describe("iconWidthStyle", () => {
  it("returns null for naturalWidth=0 (broken/unloaded image)", () => {
    expect(iconWidthStyle(0)).toBeNull();
  });

  it("returns '{w}px' for small images within threshold", () => {
    expect(iconWidthStyle(1)).toBe("1px");
    expect(iconWidthStyle(100)).toBe("100px");
  });

  it("includes the threshold boundary (<= threshold)", () => {
    expect(iconWidthStyle(ICON_PX_THRESHOLD)).toBe(`${ICON_PX_THRESHOLD}px`);
  });

  it("returns null just above threshold", () => {
    expect(iconWidthStyle(ICON_PX_THRESHOLD + 1)).toBeNull();
  });

  it("returns null for large images", () => {
    expect(iconWidthStyle(1000)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run:
```bash
cd doclens/web_v2/frontend && npx vitest run tests/md-viewer.spec.ts
```
Expected: 5 个 `iconWidthStyle` 用例 FAIL（`iconWidthStyle is not a function` / 未导出）。其余既有用例仍 PASS。

- [ ] **Step 3: 写最小实现**

在 `src/components/md-viewer.ts` 的 `escapeHtml` 函数（line 37–41）之后、`// eslint-disable-next-line ... blockRenderer` 注释（line 43）之前，插入：

```ts
/** 底层像素 ≤ 此值的图片视为 icon，按原始尺寸显示（不放大）。
 *  依据：样本扫描（6 docx / 90 图）显示 icon 底层像素普遍 ≤400，
 *  大图通常 1000+，500 是干净断层。 */
export const ICON_PX_THRESHOLD = 500;

/** 根据图片 naturalWidth 返回应设置的 width 样式值；无需调整时返回 null。
 *  抽为纯函数便于单元测试。 */
export function iconWidthStyle(naturalWidth: number): string | null {
  if (naturalWidth > 0 && naturalWidth <= ICON_PX_THRESHOLD) {
    return `${naturalWidth}px`;
  }
  return null;
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run:
```bash
cd doclens/web_v2/frontend && npx vitest run tests/md-viewer.spec.ts
```
Expected: 全部 PASS（含 5 个新 `iconWidthStyle` 用例 + 既有用例）。

- [ ] **Step 5: 类型检查**

Run:
```bash
cd doclens/web_v2/frontend && npm run typecheck
```
Expected: 无错误（`tsc --noEmit` 通过）。

- [ ] **Step 6: Commit（⚠️ 需用户授权）**

```bash
git add doclens/web_v2/frontend/src/components/md-viewer.ts doclens/web_v2/frontend/tests/md-viewer.spec.ts
git commit -m "feat(web_v2): 新增 iconWidthStyle 纯函数判定 icon 尺寸阈值"
```

---

## Task 2: _applyIconSizing 方法 + updated() 接入

**Files:**
- Modify: `doclens/web_v2/frontend/src/components/md-viewer.ts`（`updated()` line 260–269 插入 if 块；`updated()` 之后、`_locateAndHighlight()` 之前插入新私有方法）
- Test: `doclens/web_v2/frontend/tests/md-viewer.spec.ts`（Task 1 的 describe 之后追加）

**Interfaces:**
- Consumes: `iconWidthStyle(naturalWidth)`（Task 1 产出）

- [ ] **Step 1: 写失败测试（组件，mock naturalWidth + dispatch load）**

在 `tests/md-viewer.spec.ts` 末尾（Task 1 追加的 `describe("iconWidthStyle", ...)` 之后）追加：

```ts
describe("<md-viewer> icon sizing (_applyIconSizing)", () => {
  // jsdom 不加载图片：naturalWidth 恒 0、complete 恒 false。
  // _applyIconSizing 因此走 addEventListener("load") 分支；
  // 测试用 Object.defineProperty mock naturalWidth 后手动 dispatch load 触发回调。

  function setNaturalWidth(img: HTMLImageElement, w: number): void {
    Object.defineProperty(img, "naturalWidth", { configurable: true, value: w });
  }

  async function mountWithImage(md?: string): Promise<MdViewer> {
    const content = md ?? "![图片 1](/api/preview/asset?path=a.docx&id=1)";
    const el = await fixture(html`<md-viewer .content=${content}></md-viewer>`) as MdViewer;
    await el.updateComplete; // updated() 已跑，_applyIconSizing 已为 img 绑 load
    return el;
  }

  it("small image (<=threshold) sets style.width = naturalWidth px", async () => {
    const el = await mountWithImage();
    const img = el.shadowRoot!.querySelector("img")!;
    setNaturalWidth(img, 80);
    img.dispatchEvent(new Event("load"));
    await el.updateComplete;
    expect(img.style.width).toBe("80px");
  });

  it("large image (>threshold) leaves style.width unset (max-width:100% keeps filling)", async () => {
    const el = await mountWithImage();
    const img = el.shadowRoot!.querySelector("img")!;
    setNaturalWidth(img, 1200);
    img.dispatchEvent(new Event("load"));
    await el.updateComplete;
    expect(img.style.width).toBe("");
  });

  it("broken image (naturalWidth=0) leaves style.width unset", async () => {
    const el = await mountWithImage();
    const img = el.shadowRoot!.querySelector("img")!;
    // jsdom naturalWidth 默认 0，无需 setNaturalWidth
    img.dispatchEvent(new Event("load"));
    await el.updateComplete;
    expect(img.style.width).toBe("");
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run:
```bash
cd doclens/web_v2/frontend && npx vitest run tests/md-viewer.spec.ts
```
Expected: 3 个新用例 FAIL（`_applyIconSizing` 还没接 `updated()`，dispatch load 后 `style.width` 仍为 `""`，第一个用例期望 `"80px"` 失败）。

- [ ] **Step 3: 实现 _applyIconSizing 私有方法**

在 `src/components/md-viewer.ts` 的 `updated()` 方法（line 260–269）之后、`_locateAndHighlight()`（line 271）之前，插入：

```ts
  /** 小尺寸 icon 按原始像素显示，不被 max-width:100% 拉伸。
   *
   *  marked 把 ![](url) 渲染成 <img>（见 blockRenderer.image），现有 CSS
   *  :host img { max-width:100% } 会让所有图铺满容器，导致 icon 被放大。
   *  本方法在 render 后遍历 <img>，读 naturalWidth（底层像素），≤阈值的设
   *  style.width 固定原尺寸（max-width 不再限制）；大图不设 width，继续铺满。
   *
   *  jsdom 不加载图片，naturalWidth 恒 0、complete 恒 false → 走 load 分支。
   *  真实浏览器对 innerHTML 插入的 img 异步触发 load（即使缓存），complete
   *  分支防御 onload 绑定前已加载完成的极端 race。 */
  private _applyIconSizing() {
    const imgs = this.shadowRoot!.querySelectorAll("img");
    imgs.forEach((img) => {
      const apply = () => {
        try {
          const style = iconWidthStyle(img.naturalWidth);
          if (style) img.style.width = style;
        } catch {
          // naturalWidth 读取异常（同源 /api/preview/asset 场景理论上不会触发）：兜底不设
        }
      };
      if (img.complete && img.naturalWidth > 0) apply();
      else img.addEventListener("load", apply, { once: true });
    });
  }
```

- [ ] **Step 4: 在 updated() 接入**

修改 `src/components/md-viewer.ts` 的 `updated()`（line 260–269）。在 `_highlightKeyword` 块之后、`_locateAndHighlight` 块之前，插入一个新 `if` 块。改后完整方法：

```ts
  updated(changedProps: Map<string, unknown>) {
    super.updated?.(changedProps);
    // content/keyword 变化都需重新高亮（render 会重建 .md-body，旧 <mark> 随之销毁）
    if (changedProps.has("content") || changedProps.has("keyword")) {
      this._highlightKeyword();
    }
    if (changedProps.has("content") || changedProps.has("pages")) {
      this._applyIconSizing();
    }
    if (changedProps.has("line") || changedProps.has("content")) {
      this._locateAndHighlight();
    }
  }
```

- [ ] **Step 5: 跑测试，确认通过**

Run:
```bash
cd doclens/web_v2/frontend && npx vitest run tests/md-viewer.spec.ts
```
Expected: 全部 PASS（含 3 个新组件用例 + Task 1 用例 + 既有用例）。

- [ ] **Step 6: 类型检查**

Run:
```bash
cd doclens/web_v2/frontend && npm run typecheck
```
Expected: 无错误。

- [ ] **Step 7: Commit（⚠️ 需用户授权）**

```bash
git add doclens/web_v2/frontend/src/components/md-viewer.ts doclens/web_v2/frontend/tests/md-viewer.spec.ts
git commit -m "feat(web_v2): md-viewer 小尺寸 icon 按 naturalWidth 原像素显示"
```

---

## Task 3: 构建前端 + 手动验证

**Files:** 无代码改动（构建产物 + 人工核对）。

> 本任务验证：① 小 icon 不再被拉伸；② 大图仍铺满；③ `complete` 分支的生产行为（jsdom 无法模拟图片缓存加载，在此手动覆盖）。

- [ ] **Step 1: 运行全部前端单测**

Run:
```bash
cd doclens/web_v2/frontend && npm test
```
Expected: 全部 PASS，无回归。

- [ ] **Step 2: 构建前端产物**

Run:
```bash
cd doclens/web_v2/frontend && npm run build
```
Expected: `tsc --noEmit` 通过 + `vite build` 成功，输出写入 `doclens/web_v2/static/`（含新的 `assets/index.<hash>.js`）。

- [ ] **Step 3: 重启后端**

> 必须重启后端，否则 FastAPI 仍服务旧的 `static/` 文件。使用 PowerShell 7。

```powershell
pwsh -File ./start-app.ps1 gui
```
Expected: 日志出现 `INFO: Uvicorn running on http://127.0.0.1:786x`（端口可能因冲突递增）。

- [ ] **Step 4: 手动验证 icon 不被拉伸**

浏览器打开 Web UI，预览 `test_work_dir/图片预览测试.docx`：
- Expected: 文档里的小尺寸图片按其原始像素显示（如 ~192px），不再被拉到容器全宽（~820px）。
- 同时确认：若该 docx 含大图，大图仍铺满容器宽度。

- [ ] **Step 5: 手动验证大图仍铺满 + complete 分支**

预览一个含大图的 PDF（如 commit `b995d1ed` 引入的样本，或 `test_work_dir` 下任意带照片/大示意图的 PDF）：
- Expected: 大图仍 `max-width:100%` 铺满；翻页/滚动后图片正常显示（覆盖 `complete` 缓存分支，无图标"永远不出现"的 race）。

- [ ] **Step 6: Commit 构建产物（⚠️ 需用户授权；`static/` 已 git 跟踪）**

```bash
git add doclens/web_v2/static/
git commit -m "chore(web_v2): 重新构建前端 static 产物（icon 尺寸自适应）"
```

---

## Self-Review

**1. Spec 覆盖：**
- 阈值常量 `ICON_PX_THRESHOLD` → Task 1 ✓
- 纯函数 `iconWidthStyle` → Task 1 ✓
- `_applyIconSizing` 方法（含 complete / load 双分支、try-catch）→ Task 2 ✓
- `updated()` 接入（`content || pages`）→ Task 2 ✓
- CSS 不改 → Global Constraints + Task 2 说明 ✓
- 纯函数测试（0 / 1 / 100 / 500 含 / 501 / 1000）→ Task 1 ✓
- 组件测试（小图设 / 大图不设 / broken 不设）→ Task 2 ✓
- 手动验证（docx icon + PDF 大图 + complete 分支）→ Task 3 ✓
- YAGNI 边界 → Global Constraints ✓

**2. 占位扫描：** 无 TBD/TODO；每个代码步骤含完整代码；命令含 expected 输出。✓

**3. 类型一致性：** `iconWidthStyle(naturalWidth: number): string | null` 在 Task 1 定义、Task 2 `_applyIconSizing` 调用一致；`ICON_PX_THRESHOLD` 导出名一致；`_applyIconSizing` 方法名在 Task 2 定义与测试一致。✓

**4. jsdom 局限已处理：** `complete` 分支无法在 jsdom 自动化测试（innerHTML 重建使 complete 状态无法跨 render 保持），由 Task 3 Step 5 手动覆盖并注明。
