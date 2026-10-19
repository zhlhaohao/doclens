import { test, expect } from "@playwright/test";

function shadow(page: import("@playwright/test").Page, host: string, inner: string) {
  return page.locator(`${host} >> ${inner}`);
}

test.describe("Search tab grep mode", () => {
  test("switch to grep via caret and submit", async ({ page }) => {
    await page.goto("/");

    // 输入并切到 Grep
    const input = shadow(page, "input-box", "input");
    await input.fill("kirin");
    await shadow(page, "input-box", ".caret").click();
    // 菜单第二项：Grep
    await shadow(page, "input-box", ".menu-item:nth-child(2)").click();

    // 提交
    await shadow(page, "input-box", "button.primary").click();

    // 进入 focus 状态；source 标记为 GREP。
    // 冷启动首个 grep 慢（rg 全库首扫 + REGEXP 子集建临时表 ~10s），
    // meta 先显示「搜索中」——轮询等 loading 结束再断言。
    await expect(page.locator("focus-header")).toBeVisible();
    const meta = shadow(page, "focus-header", ".meta");
    for (let i = 0; i < 30; i++) {
      const t = (await meta.innerText().catch(() => "")).trim();
      if (t && !t.includes("搜索中")) break;
      await page.waitForTimeout(1000);
    }
    await expect(meta).toContainText("GREP", { timeout: 5_000 });
  });

  test("grep entry appears in history with marker", async ({ page, request }) => {
    // 清掉残留的 search 历史（sessions.db 跨运行持久化），确保计数确定
    await request.delete("/api/sessions?type=search");
    await page.goto("/");
    // 切 Grep 并提交（产生一条 grep 历史）
    await shadow(page, "input-box", "input").fill("kirin_scale");
    await shadow(page, "input-box", ".caret").click();
    await shadow(page, "input-box", ".menu-item:nth-child(2)").click();
    await shadow(page, "input-box", "button.primary").click();
    // 冷启动首个 grep 慢（rg 首扫 + REGEXP 子集）：会话历史在 grep 结果
    // 返回后才落库——先等 loading 结束，再断言 GREP，两者都过再 back。
    await expect(page.locator("focus-header")).toBeVisible();
    const meta = shadow(page, "focus-header", ".meta");
    for (let i = 0; i < 30; i++) {
      const t = (await meta.innerText().catch(() => "")).trim();
      if (t && !t.includes("搜索中")) break;
      await page.waitForTimeout(1000);
    }
    await expect(meta).toContainText("GREP", { timeout: 5_000 });
    await page.waitForTimeout(800); // findOrCreateSession 后台写入余量

    // 回到新搜索
    await shadow(page, "focus-header", ".back").click();
    // 刚提交的 grep 条目是最新的（history-list 按 updated_at DESC），其首项应带 grep 标记。
    // 用 .first() 而非精确计数，避免持久化 sessions.db 的残留干扰。
    const modeTags = shadow(page, "history-list", "history-item .mode-tag");
    await expect(modeTags.first()).toBeVisible({ timeout: 15_000 });
  });
});
