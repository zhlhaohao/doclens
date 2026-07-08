import { test, expect } from "@playwright/test";

/**
 * E2E: AI 对话「工具调用过程」展示。
 *
 * 用 page.route 注入确定性 SSE（一个 search 工具调用 + 结果 + 回答文本），
 * 验证前端：思考过程块渲染 → 完成后自动折叠 → 点击展开看工具详情。
 *
 * 注：webServer（playwright.config.ts）复用 7860 端口；本 spec mock 了所有 /api/*，
 * 因此只需前端被服务（无需真实后端 / API key）。
 */

function shadowLocator(
  page: import("@playwright/test").Page,
  host: string,
  inner: string,
) {
  return page.locator(`${host} >> ${inner}`);
}

const SSE = [
  "event: tool_call\r\ndata: " + JSON.stringify({ tool_use_id: "t1", name: "search", input: { query: "python" }, is_complete: true }),
  "event: tool_result\r\ndata: " + JSON.stringify({ tool_use_id: "t1", name: "search", output: "line 1\nline 2", is_error: false, duration_ms: 80 }),
  "event: token\r\ndata: " + JSON.stringify({ text: "答案是 asyncio。" }),
  "event: done\r\ndata: {}",
].join("\r\n\r\n") + "\r\n\r\n";

test.describe("Chat tool trace", () => {
  test("renders tool trace, auto-collapses on completion, expands on click", async ({ page }) => {
    // ---- mock 后端 ----
    await page.route("**/api/status", (r) =>
      r.fulfill({ status: 200, json: { indexed_docs: 0, index_path: "", total_size_bytes: 0, file_types: {} } }),
    );
    await page.route("**/api/sessions**", async (r) => {
      const m = r.request().method();
      if (m === "POST") {
        await r.fulfill({ status: 200, json: { id: "s1", type: "chat", title: "t", preview: "p" } });
      } else if (m === "PATCH") {
        await r.fulfill({ status: 200, json: { ok: true, message_count: 2 } });
      } else if (m === "GET" && r.request().url().includes("?")) {
        await r.fulfill({ status: 200, json: { sessions: [], total: 0 } });
      } else {
        await r.fulfill({ status: 200, json: { items: [] } });
      }
    });
    await page.route("**/api/chat", (r) =>
      r.fulfill({ status: 200, contentType: "text/event-stream", body: SSE }),
    );

    // ---- 发起对话 ----
    await page.goto("/#/chat");
    await page.getByRole("textbox", { name: "问 Doclens 任何问题..." }).fill("python 异步");
    await shadowLocator(page, "input-box", "button").click();

    // ---- 完成后：思考过程块出现且自动折叠 ----
    const summary = shadowLocator(page, "chat-tool-trace", ".summary");
    await expect(summary).toContainText("思考过程");
    await expect(summary).toContainText("1 步");
    await expect(shadowLocator(page, "chat-tool-trace", ".steps")).toHaveCount(0);

    // 回答文本已渲染
    await expect(page.locator("chat-message").last()).toContainText("asyncio");

    // ---- 点击展开 → 工具详情可见 ----
    await summary.click();
    await expect(shadowLocator(page, "chat-tool-trace", ".steps")).toBeVisible();
    await expect(shadowLocator(page, "chat-tool-trace", ".name")).toContainText("search");
    await expect(shadowLocator(page, "chat-tool-trace", ".res")).toContainText("line 1");
  });
});
