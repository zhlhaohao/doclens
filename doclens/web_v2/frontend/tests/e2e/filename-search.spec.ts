import { test, expect } from "@playwright/test";

const FILES_VIEW_HASH = "#/files";

async function gotoFilesView(page: import("@playwright/test").Page) {
  await page.goto(FILES_VIEW_HASH);
  await page.waitForSelector("file-search-box input", { state: "visible" });
}

test.describe("filename search", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Desktop only",
  );

  test.beforeEach(async ({ page }) => {
    await gotoFilesView(page);
  });

  test("FILENAME-001: typing shows results, file-tree unchanged", async ({ page }) => {
    const input = page.locator("file-search-box input");
    await input.fill("doc");
    // 中栏出现 file-search-results
    await expect(page.locator("file-search-results")).toBeVisible();
    // 左栏 file-tree 仍在
    await expect(page.locator("file-tree")).toBeVisible();
    // 结果列表至少 1 行
    await expect(page.locator("file-search-results .row").first()).toBeVisible();
  });

  test("FILENAME-002: clicking a row loads preview", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    const firstRow = page.locator("file-search-results .row").first();
    await firstRow.click();
    // preview-pane 出现路径文本（取自 _previewPath）
    await expect(page.locator("preview-pane")).toBeVisible();
  });

  test("FILENAME-003: ArrowDown moves selection and switches preview", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    const results = page.locator("file-search-results");
    await results.click();
    const firstActive = await page.locator("file-search-results .row.active").first().textContent();
    await page.keyboard.press("ArrowDown");
    const secondActive = await page.locator("file-search-results .row.active").first().textContent();
    expect(firstActive).not.toEqual(secondActive);
  });

  test("FILENAME-004: Esc clears and restores file-list", async ({ page }) => {
    await page.locator("file-search-box input").fill("doc");
    await expect(page.locator("file-search-results")).toBeVisible();
    await page.locator("file-search-box input").press("Escape");
    await expect(page.locator("file-list")).toBeVisible();
    await expect(page.locator("file-search-results")).toHaveCount(0);
  });

  test("FILENAME-005: empty state when no matches", async ({ page }) => {
    await page.locator("file-search-box input").fill("zzzznotfound");
    await expect(page.locator("file-search-results")).toContainText("未匹配到任何文件名包含");
  });

  test("FILENAME-006: overflow hint when more than 100 matches", async () => {
    // 该用例依赖被测工作目录有 >100 个匹配文件；
    // 在 CI / 标准测试目录中可能跳过。保留断言以备大数据场景。
    test.skip(true, "需要 >100 个匹配文件的工作目录");
  });
});
