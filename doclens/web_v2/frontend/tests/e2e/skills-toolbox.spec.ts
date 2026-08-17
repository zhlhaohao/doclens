import { test, expect } from "@playwright/test";

/**
 * E2E: 技能工具箱全链路（mock 后端）。
 *
 * 验证：files 多选 → 工具箱按钮 → 技能网格（桌面 3 列 / 移动列表）→
 * 确认对话框（文件清单 + 补充 prompt）→ 跳 chat → 自动新建会话发送 →
 * 发出的消息体含技能标记 / 文件路径 / 补充 prompt。
 *
 * 注：webServer（playwright.config.ts）复用 7860 端口；本 spec mock 了
 * 所有 /api/*，因此只需前端被服务（无需真实 LLM 后端 / API key）。
 */

function shadowLocator(
  page: import("@playwright/test").Page,
  host: string,
  inner: string,
) {
  return page.locator(`${host} >> ${inner}`);
}

const SKILLS_RESPONSE = {
  skills: [
    {
      name: "summarize-files",
      description: "总结用户指定文件的重点内容，逐个读取后输出结构化总结。",
      icon: "brain",
    },
    {
      // 第二个技能：移动端列表断言需要非末行（末行无分隔线）
      // accept_dirs: 目录可入选进清单（目录范围问答）
      name: "knowledge-base",
      description: "基于知识库内容回答问题。",
      icon: "search",
      accept_dirs: true,
    },
  ],
};

/** mock files 列表：/api/files/list 返回（根目录：医疗/；子目录：两个文件 + 一个目录）。 */
function mockFilesApi(page: import("@playwright/test").Page) {
  const entry = (name: string, path: string, is_dir: boolean) => ({
    name, path, is_dir,
    size: is_dir ? 0 : 1024,
    modified_at: "2026-08-01T00:00:00",
    indexed: !is_dir,
    writable: true,
    has_child_dirs: false,
  });
  return page.route(/\/api\/files\/list/, (r) => {
    const url = new URL(r.request().url());
    const dir = decodeURIComponent(url.searchParams.get("path") || "").replace(/\/+$/, "");
    if (dir === "") {
      return r.fulfill({
        status: 200,
        json: { path: "", entries: [entry("医疗", "医疗", true)], total: 1 },
      });
    }
    return r.fulfill({
      status: 200,
      json: {
        path: dir,
        entries: [
          entry("癌症治疗.md", "医疗/癌症治疗.md", false),
          entry("体检报告.pdf", "医疗/体检报告.pdf", false),
          entry("子目录", "医疗/子目录", true),
        ],
        total: 3,
      },
    });
  });
}

test.describe("Skills toolbox (mock)", () => {
  // PWA Service Worker 会接管 fetch，导致 page.route mock 失效（请求绕过
  // 路由拦截直达真实后端）——本 spec 全程 mock，禁用 SW。
  test.use({ serviceWorkers: "block" });

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/status", (r) =>
      r.fulfill({ status: 200, json: { indexed_docs: 0, index_path: "", total_size_bytes: 0, file_types: {} } }),
    );
    await page.route("**/api/documents**", (r) =>
      r.fulfill({ status: 200, json: { documents: [] } }),
    );
    await page.route("**/api/skills", (r) =>
      r.fulfill({ status: 200, json: SKILLS_RESPONSE }),
    );
    await mockFilesApi(page);
  });

  test("desktop: select files → toolbox grid → confirm → chat sends composed message", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "desktop 用例仅跑 desktop-chrome project");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#/files");

    // 进入 医疗 目录（tree 或 list 中点击）
    await page.locator("file-row").filter({ hasText: "医疗" }).first().click();
    // 等列表加载完成（mock 返回 3 项）
    await expect(page.locator("file-row")).toHaveCount(3);

    // 勾选两个文件（点 checkbox；file-row 内部 input）
    const rows = page.locator("file-row");
    await rows.nth(0).locator("input[type=checkbox]").click();
    await rows.nth(1).locator("input[type=checkbox]").click();

    // 工具箱按钮可用并点击
    const toolboxBtn = page.locator("file-list").locator('[data-action="skill-toolbox"]');
    await expect(toolboxBtn).toBeEnabled();
    await toolboxBtn.click();

    // 技能网格：桌面 3 列浮起卡片（grid-template-columns repeat(3, 1fr)）
    const grid = shadowLocator(page, "skill-toolbox-dialog", ".grid");
    await expect(grid).toBeVisible();
    // 对话框必须是模态（top layer）：非模态 <dialog open> 会被列表内
    // 带 z-index 的元素（表头列分隔线）穿透
    const isModal = await page
      .locator("skill-toolbox-dialog")
      .evaluate((el) => el.closest("dialog")?.matches(":modal") ?? false);
    expect(isModal).toBe(true);
    // 对话框占页面宽度 50%（2026-08-17 决议）；取 computed width（content-box，
    // 不含 dialog > * 注入的 padding）
    const hostWidth = await page
      .locator("skill-toolbox-dialog")
      .evaluate((el) => parseFloat(getComputedStyle(el).width));
    expect(hostWidth).toBe(1280 * 0.5);
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(cols.split(" ").length).toBe(3);
    // 卡片浮起效果：大圆角（radius-xl 24px）
    const cardRadius = await shadowLocator(page, "skill-toolbox-dialog", "button.skill")
      .first()
      .evaluate((el) => getComputedStyle(el).borderRadius);
    expect(cardRadius).toBe("24px");

    // 点选技能 → 确认对话框
    await shadowLocator(page, "skill-toolbox-dialog", "button.skill").first().click();
    const runDialog = page.locator("skill-run-dialog");
    await expect(runDialog).toBeVisible();

    // 文件清单只含两个文件（目录被过滤）
    await expect(shadowLocator(page, "skill-run-dialog", ".files li")).toHaveCount(2);
    await expect(shadowLocator(page, "skill-run-dialog", ".files")).toContainText("癌症治疗.md");
    await expect(shadowLocator(page, "skill-run-dialog", ".files")).not.toContainText("子目录");

    // 填补充 prompt → 开始对话
    await shadowLocator(page, "skill-run-dialog", "textarea").fill("重点提取数据结论");

    // mock 会话与 SSE
    await page.route("**/api/sessions**", async (r) => {
      const m = r.request().method();
      if (m === "POST") {
        await r.fulfill({ status: 200, json: { id: "skill-1", type: "chat", title: "t", preview: "p" } });
      } else if (m === "PATCH") {
        await r.fulfill({ status: 200, json: { ok: true, message_count: 2 } });
      } else if (m === "GET" && r.request().url().includes("?")) {
        await r.fulfill({ status: 200, json: { sessions: [], total: 0 } });
      } else {
        await r.fulfill({ status: 200, json: { items: [] } });
      }
    });
    let sentBody: any = null;
    await page.route("**/api/chat", async (r) => {
      sentBody = r.request().postDataJSON();
      await r.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          "event: token\r\ndata: " + JSON.stringify({ text: "总结完成。" }),
          "event: done\r\ndata: {}",
        ].join("\r\n\r\n") + "\r\n\r\n",
      });
    });

    await shadowLocator(page, "skill-run-dialog", "button.primary").click();

    // 跳到 chat 视图，用户气泡含完整消息
    await expect(page.locator("chat-view")).toBeVisible();
    await expect(page.locator("chat-message").first()).toBeVisible();
    expect(sentBody).not.toBeNull();
    expect(sentBody.message).toContain("[调用技能: summarize-files]");
    expect(sentBody.message).toContain("医疗/癌症治疗.md");
    expect(sentBody.message).toContain("医疗/体检报告.pdf");
    expect(sentBody.message).toContain("重点提取数据结论");
    // AI 回答渲染
    await expect(page.locator("chat-message").last()).toContainText("总结完成。");
  });

  test("mobile: toolbox entries render as single-column list", async ({ page, browserName }) => {
    test.skip(browserName !== "webkit", "mobile 用例仅跑 mobile-iphone (webkit) project");
    await page.goto("/#/files");

    // 移动端：tree 面板进目录 → list 面板勾选一个文件 → more 菜单 → 技能工具箱
    await page.locator("tree-node").getByText("医疗", { exact: true }).click();
    // mobile 切到 list 面板（进目录自动切；兜底等待 file-row）
    await page.locator("file-row").first().waitFor({ state: "visible", timeout: 5000 });
    await page.locator("file-row").nth(0).locator("input[type=checkbox]").click();

    await shadowLocator(page, "file-list", ".mobile-more").click();
    await shadowLocator(page, "file-list", '[data-action="skill-toolbox"]').click();

    // 移动端对话框占满屏幕宽度（2026-08-17 决议）
    const dlgWidth = await page
      .locator("skill-toolbox-dialog")
      .evaluate((el) => el.closest("dialog")!.getBoundingClientRect().width);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(dlgWidth).toBe(viewportWidth);
    // 移动端必须是 list item 语义列表（ul/li），不能是 grid + button（2026-08-17 决议）
    const list = shadowLocator(page, "skill-toolbox-dialog", "ul.list");
    await expect(list).toBeVisible();
    await expect(shadowLocator(page, "skill-toolbox-dialog", "button.skill")).toHaveCount(0);
    await expect(shadowLocator(page, "skill-toolbox-dialog", ".grid")).toHaveCount(0);
    const items = shadowLocator(page, "skill-toolbox-dialog", "li.item");
    await expect(items).toHaveCount(2);
    // 通栏行 + 分隔线：纵向堆叠（图标+名称一行、描述整行折返）
    const itemStyle = await items.first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { flexDir: cs.flexDirection, borderBottom: cs.borderBottomWidth };
    });
    expect(itemStyle.flexDir).toBe("column");
    expect(itemStyle.borderBottom).toBe("1px");
    // 描述文字必须折返不超出屏幕（scrollWidth 不超过可视宽度）
    const descOverflow = await shadowLocator(page, "skill-toolbox-dialog", "li.item .desc")
      .first()
      .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(descOverflow).toBe(false);
    // 对话框自身不得出现横向滚动条（host 100% + 注入 padding 需 border-box 抵消）
    const dlgHScroll = await page
      .locator("skill-toolbox-dialog")
      .evaluate((el) => {
        const dlg = el.closest("dialog")!;
        return dlg.scrollWidth > dlg.clientWidth + 1;
      });
    expect(dlgHScroll).toBe(false);
    // list item 可点选（键盘可达：role=button + tabindex）
    await expect(items.first()).toHaveAttribute("role", "button");
    await expect(items.first()).toHaveAttribute("tabindex", "0");
  });

  test("accept_dirs skill keeps directories in the run list", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "desktop 用例仅跑 desktop-chrome project");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#/files");

    await page.locator("file-row").filter({ hasText: "医疗" }).first().click();
    await expect(page.locator("file-row")).toHaveCount(3);

    // 只勾选一个目录（无文件）——accept_dirs 技能下工具箱可用
    await page.locator("file-row").nth(2).locator("input[type=checkbox]").click();

    const toolboxBtn = page.locator("file-list").locator('[data-action="skill-toolbox"]');
    await expect(toolboxBtn).toBeEnabled();
    await toolboxBtn.click();

    // 点选 knowledge-base（第二个技能，accept_dirs: true）
    await shadowLocator(page, "skill-toolbox-dialog", "button.skill").nth(1).click();
    const runDialog = page.locator("skill-run-dialog");
    await expect(runDialog).toBeVisible();

    // 目录保留在清单里（对比 summarize-files 用例：目录被过滤）
    await expect(shadowLocator(page, "skill-run-dialog", ".files li")).toHaveCount(1);
    await expect(shadowLocator(page, "skill-run-dialog", ".files")).toContainText("医疗/子目录");

    // mock 会话与 SSE，提交后断言消息含目录路径
    await page.route("**/api/sessions**", async (r) => {
      const m = r.request().method();
      if (m === "POST") {
        await r.fulfill({ status: 200, json: { id: "skill-2", type: "chat", title: "t", preview: "p" } });
      } else if (m === "PATCH") {
        await r.fulfill({ status: 200, json: { ok: true, message_count: 2 } });
      } else if (m === "GET" && r.request().url().includes("?")) {
        await r.fulfill({ status: 200, json: { sessions: [], total: 0 } });
      } else {
        await r.fulfill({ status: 200, json: { items: [] } });
      }
    });
    let sentBody: any = null;
    await page.route("**/api/chat", async (r) => {
      sentBody = r.request().postDataJSON();
      await r.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          "event: token\r\ndata: " + JSON.stringify({ text: "回答。" }),
          "event: done\r\ndata: {}",
        ].join("\r\n\r\n") + "\r\n\r\n",
      });
    });

    await shadowLocator(page, "skill-run-dialog", "button.primary").click();

    await expect(page.locator("chat-view")).toBeVisible();
    expect(sentBody).not.toBeNull();
    expect(sentBody.message).toContain("[调用技能: knowledge-base]");
    expect(sentBody.message).toContain("医疗/子目录");
  });

  test("toolbox button disabled with no selection", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "desktop 用例仅跑 desktop-chrome project");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#/files");
    await page.locator("file-row").filter({ hasText: "医疗" }).first().click();
    await expect(page.locator("file-row")).toHaveCount(3);

    const toolboxBtn = page.locator("file-list").locator('[data-action="skill-toolbox"]');
    await expect(toolboxBtn).toBeDisabled();
  });
});
