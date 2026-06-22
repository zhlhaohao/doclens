import { test, expect } from "@playwright/test";

test.describe("files explorer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // 切换到 files tab
    const desktop = page.locator("activity-bar button[title='文件']");
    const mobile = page.locator("tab-bar button:has-text('文件')");
    if (await desktop.isVisible()) await desktop.click();
    else await mobile.click();
  });

  test("desktop renders three panes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator("file-tree")).toBeVisible();
    await expect(page.locator("file-list")).toBeVisible();
    await expect(page.locator("file-detail")).toBeVisible();
  });

  test("mobile renders single pane", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator(".mobile-layout")).toBeVisible();
  });

  test("mkdir creates folder and shows it in list", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator("file-list").locator('[data-action="mkdir"]').click();
    await page.locator("mkdir-dialog input").fill("e2e_test_folder");
    await page.locator("mkdir-dialog button.primary").click();
    await expect(page.locator("file-row").filter({ hasText: "e2e_test_folder" })).toBeVisible();
  });

  test("delete folder requires double confirm", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator("file-row").filter({ hasText: "e2e_test_folder" }).click();
    await page.locator("file-list").locator('[data-action="delete"]').click();
    const confirmBtn = page.locator("delete-dialog button.danger");
    await expect(confirmBtn).toBeDisabled();
    await page.locator("delete-dialog input[type=checkbox]").check();
    await confirmBtn.click();
    await expect(page.locator("file-row").filter({ hasText: "e2e_test_folder" })).toHaveCount(0);
  });

  test("dotfile paths are hidden in tree", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator("file-tree tree-node .label").filter({ hasText: ".cortex" })).toHaveCount(0);
  });
});
