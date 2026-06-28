import { test, expect } from "@playwright/test";

function shadow(page: import("@playwright/test").Page, host: string, inner: string) {
  return page.locator(`${host} >> ${inner}`);
}

test.describe("Search tab grep mode", () => {
  test("switch to grep via caret and submit", async ({ page }) => {
    await page.goto("/");

    // 输入并切到 Grep
    const input = shadow(page, "input-box", "input");
    await input.fill("hello");
    await shadow(page, "input-box", ".caret").click();
    // 菜单第二项：Grep
    await shadow(page, "input-box", ".menu-item:nth-child(2)").click();

    // 提交
    await shadow(page, "input-box", "button.primary").click();

    // 进入 focus 状态；source 标记为 GREP
    await expect(page.locator("focus-header")).toBeVisible();
    await expect(shadow(page, "focus-header", ".meta")).toContainText("GREP");
  });

  test("grep entry appears in history with marker", async ({ page, request }) => {
    // 清掉残留的 search 历史（test_work_dir 的 sessions.db 跨运行持久化），确保计数确定
    await request.delete("/api/sessions?type=search");
    await page.goto("/");
    // 切 Grep 并提交（产生一条 grep 历史）
    await shadow(page, "input-box", "input").fill("world");
    await shadow(page, "input-box", ".caret").click();
    await shadow(page, "input-box", ".menu-item:nth-child(2)").click();
    await shadow(page, "input-box", "button.primary").click();
    await expect(page.locator("focus-header")).toBeVisible();

    // 回到新搜索
    await shadow(page, "focus-header", ".back").click();
    // 刚提交的 grep 条目是最新的（history-list 按 updated_at DESC），其首项应带 grep 标记。
    // 用 .first() 而非精确计数，避免 test_work_dir 持久化 sessions.db 的残留干扰。
    const modeTags = shadow(page, "history-list", "history-item .mode-tag");
    await expect(modeTags.first()).toBeVisible();
  });
});
