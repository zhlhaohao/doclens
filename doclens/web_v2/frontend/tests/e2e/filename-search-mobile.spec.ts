import { test, expect } from "@playwright/test";

const FILES_VIEW_HASH = "#/files";

async function gotoFilesViewMobile(page: import("@playwright/test").Page) {
  await page.goto(FILES_VIEW_HASH);
  await page.waitForSelector("file-search-box input", { state: "visible" });
}

test.describe("mobile filename search", () => {
  test.skip(
    ({ browserName }) => browserName !== "webkit",
    "Mobile only",
  );

  test.beforeEach(async ({ page }) => {
    await gotoFilesViewMobile(page);
  });

  test("MFILENAME-001: search box visible in mobile tree pane", async ({ page }) => {
    await expect(page.locator("file-search-box input")).toBeVisible();
    await expect(page.locator("file-tree")).toBeVisible();
  });

  test("MFILENAME-002: typing shows results, file-tree hidden", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    await expect(page.locator("file-search-results")).toBeVisible();
    await expect(page.locator("file-tree")).toHaveCount(0);
    await expect(page.locator("file-search-results .row").first()).toBeVisible();
  });

  test("MFILENAME-003: tapping a row navigates to preview pane", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    const firstRow = page.locator("file-search-results .row").first();
    await firstRow.click();
    await expect(page.locator("preview-pane")).toBeVisible();
  });

  test("MFILENAME-004: back from preview returns to search results", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    await page.locator("file-search-results .row").first().click();
    await expect(page.locator("preview-pane")).toBeVisible();
    await page.locator(".back-btn").click();
    // 返回 tree 面板，搜索结果仍在
    await expect(page.locator("file-search-results")).toBeVisible();
  });

  test("MFILENAME-005: clearing search restores file-tree", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    await expect(page.locator("file-search-results")).toBeVisible();
    await page.locator("file-search-box input").fill("");
    await expect(page.locator("file-tree")).toBeVisible();
    await expect(page.locator("file-search-results")).toHaveCount(0);
  });
});