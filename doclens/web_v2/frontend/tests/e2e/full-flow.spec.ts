import { test, expect } from "@playwright/test";

/**
 * Helper: locate an element inside a Lit component's open Shadow DOM.
 * Playwright's CSS engine does NOT automatically pierce shadow boundaries,
 * so we use the `>>` piercing selector to reach inner elements.
 *
 * Usage:
 *   shadowLocator(page, "welcome-pane", ".title")
 *   shadowLocator(page, "input-box", "input")
 */
function shadowLocator(
  page: import("@playwright/test").Page,
  host: string,
  inner: string,
) {
  return page.locator(`${host} >> ${inner}`);
}

test.describe("Cortex Full Flow", () => {
  test("desktop: initial state shows welcome + history + input", async ({ page }) => {
    await page.goto("/");

    // Welcome pane heading
    const title = shadowLocator(page, "welcome-pane", ".title");
    await expect(title).toHaveText("Cortex");

    // Input with inline button
    const input = shadowLocator(page, "input-box", "input");
    await expect(input).toBeVisible();

    // Activity bar visible on desktop (display: flex via CSS var)
    await expect(page.locator("activity-bar")).toBeVisible();
  });

  test("search transitions to focus state", async ({ page }) => {
    await page.goto("/");

    // Type into the initial search input
    const input = shadowLocator(page, "input-box", "input");
    await input.fill("test");

    // Submit by clicking the inline button
    const btn = shadowLocator(page, "input-box", "button");
    await btn.click();

    // Should transition to focus state — focus-header appears
    await expect(page.locator("focus-header")).toBeVisible();

    // search-results should be rendered (may be empty but component exists)
    await expect(page.locator("search-results")).toBeVisible();
  });

  test("mobile: tab bar visible, activity bar hidden", async ({ browser }) => {
    // Explicitly create a narrow mobile viewport
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();

    await page.goto("/");

    // Tab bar should be visible on mobile
    await expect(page.locator("tab-bar")).toBeVisible();

    // Activity bar uses CSS var (--cortex-show-activity-bar: none) on mobile
    const abDisplay = await page.locator("activity-bar").evaluate(
      (el) => getComputedStyle(el).display,
    );
    expect(abDisplay).toBe("none");

    await ctx.close();
  });

  test("switching between search and chat", async ({ page }) => {
    await page.goto("/");

    // Click "对话" (chat) activity-bar button
    const chatBtn = shadowLocator(page, "activity-bar", `button[title="对话"]`);
    await chatBtn.click();

    // Should now show chat-view
    await expect(page.locator("chat-view")).toBeVisible();

    // Click "搜索" (search) activity-bar button to go back
    const searchBtn = shadowLocator(page, "activity-bar", `button[title="搜索"]`);
    await searchBtn.click();

    // Should now show search-view again
    await expect(page.locator("search-view")).toBeVisible();
  });
});
