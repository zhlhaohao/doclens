import { test, expect } from "@playwright/test";

test.describe("settings mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 13
    await page.goto("/");
  });

  test("full edit flow via avatar menu on mobile", async ({ page }) => {
    // 1. Open avatar menu and click 本地配置
    await page.locator("app-bar .avatar-btn").tap();
    await page.locator("app-bar button.menu-item:has-text('本地配置')").tap();

    // 2. settings view visible, scope segment visible
    await expect(page.locator("settings-view")).toBeVisible();
    await expect(page.locator("settings-scope-segment")).toBeVisible();

    // 3. First field is stacked (single-column grid)
    const firstField = page.locator(".field").first();
    const gridCols = await firstField.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    // Single column → single value, no space-separated second track
    expect(gridCols.split(" ").length).toBe(1);

    // 4. Switch to 搜索调优 tab (contains first number input)
    await page.locator(".tab-strip button:has-text('搜索调优')").tap();

    // 5. Edit a number field in the active tab
    const numInput = page.locator(".tab-panel.active input[type=number]").first();
    await numInput.fill("99");

    // 6. Save button appears in app-bar
    await expect(page.locator("app-bar .save-btn")).toBeVisible();

    // 7. Switch scope → dirty state clears (loadSettings fires on scope change)
    await page.locator("settings-scope-segment button:has-text('全局')").tap();
    await expect(page.locator("app-bar .save-btn")).toBeHidden();

    // 8. Switch back to local
    await page.locator("settings-scope-segment button:has-text('本地')").tap();
  });

  test("slider value chip updates on drag", async ({ page }) => {
    await page.locator("app-bar .avatar-btn").tap();
    await page.locator("app-bar button.menu-item:has-text('本地配置')").tap();

    // Switch to 评分 tab
    await page.locator(".tab-strip button:has-text('评分')").tap();

    // First slider — locate range input inside .slider-row
    const range = page.locator(".slider-row input[type=range]").first();
    await range.evaluate((el: HTMLInputElement) => {
      el.value = "3.5";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // value-chip should reflect "3.5"
    await expect(page.locator(".slider-row .value-chip").first()).toHaveText("3.5");
  });

  test("save dispatches window event and shows toast", async ({ page }) => {
    await page.locator("app-bar .avatar-btn").tap();
    await page.locator("app-bar button.menu-item:has-text('全局配置')").tap();

    // Switch to 搜索调优 tab so the number input is in the active panel
    await page.locator(".tab-strip button:has-text('搜索调优')").tap();

    const numInput = page.locator(".tab-panel.active input[type=number]").first();
    await numInput.fill("77");

    await page.locator("app-bar .save-btn").tap();

    // toast appears
    await expect(page.locator("toast-stack .toast").first()).toBeVisible({ timeout: 5000 });
  });

  test("revert via avatar menu discards dirty edits", async ({ page }) => {
    await page.locator("app-bar .avatar-btn").tap();
    await page.locator("app-bar button.menu-item:has-text('本地配置')").tap();

    // Switch to 搜索调优 tab so the number input is in the active panel
    await page.locator(".tab-strip button:has-text('搜索调优')").tap();

    const numInput = page.locator(".tab-panel.active input[type=number]").first();
    const original = await numInput.inputValue();
    await numInput.fill("999");

    // Open avatar menu → revert
    await page.locator("app-bar .avatar-btn").tap();
    await page.locator("app-bar button.menu-item:has-text('放弃修改')").tap();

    // Save button gone
    await expect(page.locator("app-bar .save-btn")).toBeHidden();

    // Original value restored
    await expect(numInput).toHaveValue(original);
  });
});
