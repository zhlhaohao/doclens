# Settings Mobile Single-Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `cortex web_v2` static assets so the existing mobile `@media` CSS actually serves, and tighten mobile spacing so the Settings page is genuinely single-column on phones/tablets (`<1024px`) — fields stacked, scope-segment sticky, sections/info-boxes/tabs tighter.

**Architecture:** Frontend-only change. Two source-file edits (CSS + template), one E2E test addition, one unit test addition, one rebuild. No backend, store, or API changes. Mobile CSS via `@media (max-width: 1023px)` to match existing breakpoint convention.

**Tech Stack:** Lit 3 Web Components, Vite, vitest, Playwright, TypeScript

---

## Global Constraints

- Mobile breakpoint is `@media (max-width: 1023px)` — matches `breakpoints.css` comment (`<1024px` = mobile/tablet, `≥1024px` = desktop)
- CSS variables from `src/styles/tokens.css`: `--cortex-space-{1,2,3,4,6,8}`, `--cortex-fs-{xs,sm,base,md,lg}`, `--cortex-border`, `--cortex-primary`, `--cortex-primary-soft`, `--cortex-radius-{md,lg}`
- App-bar height: 56px (CSS var `--cortex-tab-bar-height`)
- Test runner from `package.json`: vitest `npm test`, Playwright `npm run test:e2e`
- Static assets are git-tracked under `cortex/web_v2/static/` — rebuild via `cd cortex/web_v2/frontend && npm run build`
- Commit messages follow repo convention: `feat(web):`, `test(web):`, `fix(web):`, `docs(spec):`, `chore(web):`
- Co-author line on every commit: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## File Structure

**Modified source files:**
- `cortex/web_v2/frontend/src/views/settings-view.ts` — template restructure (`render()`) + extended `@media (max-width: 1023px)` block
- `cortex/web_v2/frontend/src/components/settings-scope-segment.ts` — new `@media (max-width: 1023px)` block (`position: sticky`)

**Modified test files:**
- `cortex/web_v2/frontend/tests/settings-view.spec.ts` — add 1 unit test (DOM structure)
- `cortex/web_v2/frontend/tests/e2e/settings-mobile.spec.ts` — add 4 E2E tests (viewport coverage)

**Modified built artifacts (rebuilt via Vite):**
- `cortex/web_v2/static/index.html`
- `cortex/web_v2/static/assets/index.*.js`
- `cortex/web_v2/static/assets/index.*.css`
- `cortex/web_v2/static/sw.js` (if present)
- `cortex/web_v2/static/manifest.webmanifest` (if present)

**Responsibility per file:**
- `settings-view.ts` — owns the multi-tab settings form; template + styles
- `settings-scope-segment.ts` — owns the local/global pill switcher; styles only
- `settings-view.spec.ts` — unit tests for `<settings-view>` DOM and behavior
- `settings-mobile.spec.ts` — Playwright E2E at mobile/tablet viewports

---

## Task 1: Add unit test asserting template structure (TDD red)

**Files:**
- Modify: `cortex/web_v2/frontend/tests/settings-view.spec.ts` (append one test)

**Step 1.1:** Append this test to the end of `describe("<settings-view>", ...)` in `cortex/web_v2/frontend/tests/settings-view.spec.ts`, after the existing `it("clicking save calls putConfig with current values", ...)` block:

```ts
it("scope-segment and tab-strip live inside .scroll-area (template structure)", () => {
  const scrollArea = el.shadowRoot?.querySelector(".scroll-area");
  expect(scrollArea, ".scroll-area must exist").toBeTruthy();
  const scopeInScroll = scrollArea?.querySelector("settings-scope-segment");
  const tabsInScroll = scrollArea?.querySelector(".tab-strip");
  expect(
    scopeInScroll,
    "settings-scope-segment must be inside .scroll-area so position:sticky works"
  ).toBeTruthy();
  expect(
    tabsInScroll,
    ".tab-strip must be inside .scroll-area so it scrolls with the content"
  ).toBeTruthy();
});
```

**Step 1.2:** Run the test to verify it fails.

Run: `cd cortex/web_v2/frontend && npm test -- --run tests/settings-view.spec.ts`
Expected: FAIL — `expect(scopeInScroll).toBeTruthy()` fails because `settings-scope-segment` is currently a direct child of `:host`, not inside `.scroll-area`.

---

## Task 2: Restructure settings-view.ts template (TDD green)

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/settings-view.ts:615-686` (the `render()` method)

**Step 2.1:** Read the current `render()` method to confirm structure (it ends at line 686). The current order is:

```ts
return html`
  ${copy-banner if needed}
  <settings-scope-segment .../>
  <nav class="tab-strip" role="tablist">...</nav>
  <div class="scroll-area">
    ${TAB_ORDER.map(tab => html`<div class="tab-panel">...</div>`)}
    <div class="footer-bar">...</div>
  </div>
  <toast-stack></toast-stack>
`;
```

**Step 2.2:** Move the `<settings-scope-segment>` and `<nav class="tab-strip">` blocks so they become the **first two children** of `<div class="scroll-area">`. The new structure:

```ts
return html`
  ${this._scope === "local" && !this._exists
    ? html`<div class="copy-banner">…</div>`
    : nothing}
  <div class="scroll-area">
    <settings-scope-segment
      .scope=${this._scope}
      .exists=${this._exists}
      @scope-change=${(e: CustomEvent<{ scope: SettingsScope }>) => {
        actions.setSettingsScope(e.detail.scope);
      }}
    ></settings-scope-segment>
    <nav class="tab-strip" role="tablist">
      ${TAB_ORDER.map((tab) => html`
        <button
          class=${this._activeTab === tab ? "active" : ""}
          @click=${() => { this._activeTab = tab; }}
        >${SETTINGS_TAB_LABELS[tab]}</button>
      `)}
    </nav>

    ${TAB_ORDER.map((tab) => {
      const fields = SETTINGS_FIELDS.filter((f) => f.tab === tab);
      const sections: { title: string; desc?: string; fields: SettingsField[] }[] = [];
      for (const f of fields) {
        let s = sections.find((x) => x.title === f.section);
        if (!s) { s = { title: f.section, fields: [] }; sections.push(s); }
        s.fields.push(f);
      }
      return html`
        <div class="tab-panel ${this._activeTab === tab ? "active" : ""}" data-panel=${tab}>
          ${this._renderInfoBox(tab)}
          ${sections.map((s) => html`
            <div class="section">
              <h2>${s.title}</h2>
              ${s.fields.map((f) => this._renderField(f))}
            </div>
          `)}
        </div>
      `;
    })}

    <div class="footer-bar">
      <!-- unchanged: dirty-status + 放弃修改 / 保存按钮 -->
    </div>
  </div>
  <toast-stack></toast-stack>
`;
```

Keep the `<toast-stack>` outside `.scroll-area` (it uses `position: fixed`-style absolute positioning via its own component).

**Step 2.3:** Run unit test to verify green.

Run: `cd cortex/web_v2/frontend && npm test -- --run tests/settings-view.spec.ts`
Expected: PASS — all 8 tests pass (7 original + 1 new).

**Step 2.4:** Commit.

```bash
cd cortex/web_v2/frontend
git add ../src/views/settings-view.ts tests/settings-view.spec.ts
git commit -m "$(cat <<'EOF'
fix(web): move settings scope-segment and tab-strip into scroll-area

Required for position:sticky on the scope-segment at mobile widths.
Without a scroll container, sticky does not engage.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add E2E test for sticky scope-segment on mobile (TDD red)

**Files:**
- Modify: `cortex/web_v2/frontend/tests/e2e/settings-mobile.spec.ts`

**Step 3.1:** Append this test to the existing `test.describe("settings mobile", ...)` block (after the last `test(...)` block):

```ts
test("scope segment stays sticky at top of scroll-area when scrolling deep", async ({ page }) => {
  // Open settings
  await page.locator("app-bar .avatar-btn").tap();
  await page.locator("app-bar button.menu-item:has-text('本地配置')").tap();
  // Switch to 评分 (longest tab: 5 sliders)
  await page.locator(".tab-strip button:has-text('评分')").tap();
  // Scroll .scroll-area to its bottom
  await page.locator(".scroll-area").evaluate((el) => el.scrollTo(0, 9999));
  // The scope-segment must still be at the top of the visible scroll-area
  const box = await page.locator("settings-scope-segment")
    .evaluate((el) => el.getBoundingClientRect());
  const scrollAreaBox = await page.locator(".scroll-area")
    .evaluate((el) => el.getBoundingClientRect());
  expect(box.top).toBe(scrollAreaBox.top);
});
```

**Step 3.2:** Run the new test to verify it fails.

Run: `cd cortex/web_v2/frontend && npx playwright test tests/e2e/settings-mobile.spec.ts -g "sticky at top" --project=chromium`
Expected: FAIL — `box.top` will be far below `scrollAreaBox.top` because no sticky CSS exists yet.

---

## Task 4: Add sticky CSS to settings-scope-segment.ts (TDD green)

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/settings-scope-segment.ts:11-46` (the `static styles` block)

**Step 4.1:** Append this `@media` block at the **end** of the existing `static styles = css\`...\`` literal, just before the closing backtick:

```css
@media (max-width: 1023px) {
  :host {
    position: sticky;
    top: 0;
    z-index: 5;
    box-shadow: 0 1px 0 var(--cortex-border);
  }
}
```

The final `static styles` literal becomes the original rules (`:host`, `.pill`, `.pill:hover`, `.pill.active`, `.new-tag`) plus the new `@media` block at the end.

**Step 4.2:** Run the new E2E test to verify it passes.

Run: `cd cortex/web_v2/frontend && npx playwright test tests/e2e/settings-mobile.spec.ts -g "sticky at top" --project=chromium`
Expected: PASS.

**Step 4.3:** Run the full mobile E2E suite to verify no regression.

Run: `cd cortex/web_v2/frontend && npx playwright test tests/e2e/settings-mobile.spec.ts --project=chromium`
Expected: PASS — all 5 tests (4 original + 1 new) pass.

**Step 4.4:** Commit.

```bash
cd cortex/web_v2/frontend
git add ../src/components/settings-scope-segment.ts tests/e2e/settings-mobile.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): make settings-scope-segment sticky on mobile (<1024px)

Stays visible at top of scroll-area while editing long field lists
(e.g. 评分 tab with 5 sliders).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add E2E tests for mobile padding, overflow, and 768 single-column (TDD red)

**Files:**
- Modify: `cortex/web_v2/frontend/tests/e2e/settings-mobile.spec.ts`

**Step 5.1:** Append these three tests to `test.describe("settings mobile", ...)`:

```ts
test("section padding is 16px at 390px (tightened from 24px)", async ({ page }) => {
  await page.locator("app-bar .avatar-btn").tap();
  await page.locator("app-bar button.menu-item:has-text('本地配置')").tap();
  const padding = await page.locator(".section").first()
    .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
  expect(padding).toBe(16);  // var(--cortex-space-4) = 16px
});

test("tab strip fits without horizontal overflow at 390px", async ({ page }) => {
  await page.locator("app-bar .avatar-btn").tap();
  await page.locator("app-bar button.menu-item:has-text('本地配置')").tap();
  const overflow = await page.locator(".tab-strip")
    .evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflow).toBe(false);
});

test("fields are single-column at tablet width 768px", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.locator("app-bar .avatar-btn").tap();
  await page.locator("app-bar button.menu-item:has-text('本地配置')").tap();
  const gridCols = await page.locator(".field").first()
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  expect(gridCols.split(" ").length).toBe(1);
});
```

**Step 5.2:** Run the three new tests.

Run: `cd cortex/web_v2/frontend && npx playwright test tests/e2e/settings-mobile.spec.ts -g "section padding|tab strip fits|single-column at tablet" --project=chromium`
Expected:
- `section padding` — FAIL (currently 24px, expected 16px)
- `tab strip fits` — FAIL (currently 32px horizontal padding; tabs overflow at 390px)
- `single-column at tablet` — PASS (existing `@media` block already handles 768px; this test verifies the existing behavior)

---

## Task 6: Add mobile CSS padding rules to settings-view.ts (TDD green)

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/settings-view.ts:215-289` (the existing `@media (max-width: 1023px)` block)

**Step 6.1:** Append these new rules **inside** the existing `@media (max-width: 1023px) { ... }` block, after the existing `.field-error { ... }` rule and before the closing brace:

```css
        /* ===== Mobile polish: tightened spacing ===== */
        .section {
          padding: var(--cortex-space-4);
          margin-bottom: var(--cortex-space-3);
        }
        .info-box {
          padding: var(--cortex-space-2) var(--cortex-space-3);
          line-height: 1.55;
          font-size: var(--cortex-fs-xs);
        }
        .info-box br + br { display: none; }
        .tab-strip {
          padding: 0 var(--cortex-space-3);
          gap: var(--cortex-space-1);
        }
        .tab-strip button {
          padding: var(--cortex-space-3) var(--cortex-space-2);
          font-size: var(--cortex-fs-sm);
        }
        .copy-banner {
          padding: var(--cortex-space-3);
          font-size: var(--cortex-fs-xs);
        }
```

**Step 6.2:** Run the three new E2E tests to verify green.

Run: `cd cortex/web_v2/frontend && npx playwright test tests/e2e/settings-mobile.spec.ts -g "section padding|tab strip fits|single-column at tablet" --project=chromium`
Expected: PASS — all three new tests pass.

**Step 6.3:** Run the full mobile E2E suite to verify no regression.

Run: `cd cortex/web_v2/frontend && npx playwright test tests/e2e/settings-mobile.spec.ts --project=chromium`
Expected: PASS — all 8 tests (4 original + 4 new) pass.

**Step 4.4:** Commit.

```bash
cd cortex/web_v2/frontend
git add ../src/views/settings-view.ts tests/e2e/settings-mobile.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): tighten mobile spacing in settings-view

Section padding 24→16px, info-box padding/font tightened, tab-strip
padding 32→12px with smaller buttons, copy-banner padding/font tightened.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Rebuild static assets and verify mobile CSS is in bundle

**Files:**
- Modify: `cortex/web_v2/static/index.html` (new hash references)
- Modify: `cortex/web_v2/static/assets/index.*.js` (rebuilt)
- Modify: `cortex/web_v2/static/assets/index.*.css` (rebuilt)
- Possibly: `cortex/web_v2/static/sw.js`, `manifest.webmanifest`

**Step 7.1:** Rebuild.

Run: `cd cortex/web_v2/frontend && npm run build`
Expected: Build completes successfully; new `index.[hash].js` and `index.[hash].css` files written to `cortex/web_v2/static/assets/`; `index.html` updated with new hash references.

**Step 7.2:** Verify mobile CSS made it into the JS bundle (Lit inlines component styles into JS for shadow DOM).

Run: `grep -l "1023px" cortex/web_v2/static/assets/index.*.js`
Expected: at least one matching file.

Run: `grep -l "sticky" cortex/web_v2/static/assets/index.*.js`
Expected: at least one matching file.

Run: `grep -l "grid-template-columns" cortex/web_v2/static/assets/index.*.js`
Expected: at least one matching file.

If any check returns no match, the build did not include the changes — re-check the source edits and rebuild.

**Step 7.3:** Stage and commit the static assets.

Run:
```bash
cd D:/github/cortex
git add cortex/web_v2/static/
git status
```

Expected: `cortex/web_v2/static/index.html` and `cortex/web_v2/static/assets/index.*.{js,css}` listed as modified (new hashes); no other files.

```bash
git commit -m "$(cat <<'EOF'
chore(web): rebuild static assets for settings mobile single-column

Includes mobile @media CSS for fields, scope-segment sticky positioning,
and tightened spacing.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Full verification

**Step 8.1:** Run the entire vitest suite.

Run: `cd cortex/web_v2/frontend && npm test -- --run`
Expected: PASS — all unit tests pass (8 in settings-view.spec.ts, plus existing settings-scope-segment, api, store, etc.).

**Step 8.2:** Run the entire Playwright E2E suite.

Run: `cd cortex/web_v2/frontend && npx playwright test --project=chromium`
Expected: PASS — all E2E tests pass, including the 8 mobile settings tests (4 original + 4 new).

**Step 8.3:** Run typecheck.

Run: `cd cortex/web_v2/frontend && npm run typecheck`
Expected: PASS — no TypeScript errors.

**Step 8.4:** Manually verify desktop layout at 1280px is unchanged.

Open `http://localhost:7860` (or wherever the dev server is running) at a 1280×800 viewport. Confirm:
- Fields render as 2-column (label left, control right)
- `.footer-bar` is visible with 放弃修改 / 保存按钮
- `.tab-strip` has 32px horizontal padding
- `.section` has 24px padding

If any desktop behavior changed, inspect the `@media` block boundaries and revert any rule that leaked outside the `@media (max-width: 1023px)` selector.

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Rebuild static assets → Task 7
  - Move scope-segment into scroll-area → Task 2
  - Sticky scope-segment at mobile → Tasks 3–4
  - Tighter section padding → Tasks 5–6
  - Tighter info-box padding → Tasks 5–6
  - Tighter tab-strip padding → Tasks 5–6
  - Tighter copy-banner padding → Tasks 5–6
  - E2E at 360/390/768 viewports → Tasks 3, 5
  - All existing tests still pass → Tasks 2.3, 4.3, 6.3, 8.1, 8.2
- [x] **Placeholder scan:** No TBD/TODO; every code step has full code; no "similar to Task N" references
- [x] **Type consistency:** `settings-scope-segment`, `settings-view`, `.scroll-area`, `.tab-strip`, `.section`, `.info-box`, `.copy-banner` — all class/element names match between tasks and source
- [x] **No scope creep:** Only frontend; only settings; only mobile polish
