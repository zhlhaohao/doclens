import { test, expect } from "@playwright/test";

/**
 * 全库搜索 → 预览滚动定位高亮 E2E（e2e-search-test-plan §3.3）。
 *
 * 语料：tests/fixtures/e2e_search（≥10 页/章/表多页样本，命中分布中后部）。
 * 运行：npm run test:e2e:search（自动复制语料 + 自起独立后端 7890）。
 */

function shadow(
  page: import("@playwright/test").Page,
  host: string,
  inner: string,
) {
  return page.locator(`${host} >> ${inner}`);
}

async function submitSearch(page: import("@playwright/test").Page, q: string) {
  await page.goto("/");
  await page.waitForTimeout(1200);
  await shadow(page, "input-box", "input").fill(q);
  await shadow(page, "input-box", "button.primary").click();
  await page.locator("file-card").first().waitFor({ timeout: 45_000 });
}

/** 展开第一个匹配 path 后缀的 file-card，返回其 locator。
 *  结果按分数排序分页（20/页），目标文件可能不在第一页（并列分数下
 *  顺序有波动）——翻页查找，最多翻 6 页。 */
async function cardByPath(page: import("@playwright/test").Page, suffix: string) {
  for (let p = 0; p < 6; p++) {
    const cards = page.locator("file-card");
    const n = await cards.count();
    for (let i = 0; i < n; i++) {
      const c = cards.nth(i);
      const text = await c.locator(".header").innerText();
      if (text.includes(suffix)) {
        const collapsed = (await c.locator(".rows").count()) === 0;
        if (collapsed) await c.locator(".header").click();
        return c;
      }
    }
    const next = page.locator("pagination-bar >> button[aria-label='下一页']");
    if (!(await next.count()) || !(await next.isEnabled())) return null;
    await next.click();
    await page.waitForTimeout(1200);
  }
  return null;
}

/** 检查 md-viewer 内 mark 是否在组件视口内。
 *  slackPx：视口顶方向容差（分页懒渲染的收敛误差，默认 8px）。 */
async function markInView(
  page: import("@playwright/test").Page,
  text: string,
  slackPx?: number,
) {
  return page.evaluate(({ text, slackPx }) => {
    const find = (root: ShadowRoot | Document): Element | null => {
      const direct = root.querySelector?.("md-viewer");
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll?.("*") ?? [])) {
        if ((el as HTMLElement).shadowRoot) {
          const hit = find((el as HTMLElement).shadowRoot!);
          if (hit) return hit;
        }
      }
      return null;
    };
    const mdv = find(document) as HTMLElement | null;
    if (!mdv) return { ok: false, reason: "no md-viewer" };
    const hostRect = mdv.getBoundingClientRect();
    const marks = Array.from(
      mdv.shadowRoot!.querySelectorAll("mark.keyword-hit"),
    ) as HTMLElement[];
    if (!marks.length) return { ok: false, reason: "no keyword-hit marks" };
    const target = marks.find((m) => m.textContent?.includes(text));
    if (!target) {
      return {
        ok: false,
        reason: `no mark containing "${text}"; marks=${marks.map((m) => m.textContent).slice(0, 5)}`,
      };
    }
    const r = target.getBoundingClientRect();
    const slack = slackPx ?? 8;
    const ok = r.top >= hostRect.top - slack && r.bottom <= hostRect.bottom + 8;
    return { ok, reason: ok ? "" : `mark [${r.top},${r.bottom}] vs host [${hostRect.top},${hostRect.bottom}]` };
  }, { text, slackPx });
}

test.describe("search → preview locate（desktop）", () => {
  test("S1 md：点击命中行 → 预览滚动到命中块 + keyword mark 可见", async ({ page }) => {
    await submitSearch(page, "麒麟");
    const card = await cardByPath(page, "杂记.md");
    expect(card).not.toBeNull();
    await card!.locator(".row").first().click();
    await page.waitForTimeout(2000);
    const r = await markInView(page, "麒麟");
    expect(r.ok, (r as any).reason).toBe(true);
  });

  test("S2 md 远距离：命中 L96 → 滚动收敛到命中块", async ({ page }) => {
    await submitSearch(page, "远距离命中");
    const card = await cardByPath(page, "远处.md");
    expect(card).not.toBeNull();
    await card!.locator(".row").first().click();
    await page.waitForTimeout(2500);
    const r = await markInView(page, "远距离命中");
    expect(r.ok, (r as any).reason).toBe(true);
  });

  test("S3 pdf：命中页 7 → pdf-viewer 跳页 + findController 高亮", async ({ page }) => {
    test.skip(
      (test.info().project.name === "mobile-iphone"),
      "移动端 pdf 延时较长，跳页断言时序不稳（desktop 已覆盖跳页正确性）",
    );
    await submitSearch(page, "kirin jump");
    const card = await cardByPath(page, "report.pdf");
    expect(card).not.toBeNull();
    await card!.locator(".row").nth(1).click();  // line 20 = 第 7 页
    await page.waitForTimeout(4500);
    const top = await page.evaluate(() => {
      const find = (root: ShadowRoot | Document): any => {
        const direct = root.querySelector?.("pdf-viewer");
        if (direct) return direct;
        for (const el of Array.from(root.querySelectorAll?.("*") ?? [])) {
          if ((el as HTMLElement).shadowRoot) {
            const hit = find((el as HTMLElement).shadowRoot!);
            if (hit) return hit;
          }
        }
        return null;
      };
      const pv = find(document);
      if (!pv) return { ok: false, page: 0 };
      return { ok: true, page: pv.topPage() };
    });
    expect(top.ok).toBe(true);
    expect(Math.abs((top as any).page - 7) <= 1, `expect page ~7, got ${(top as any).page}`).toBe(true);
  });

  test("S4 docx：命中行 → 合成 md 定位（前驱近似）", async ({ page }) => {
    await submitSearch(page, "章节跳转测试");
    const card = await cardByPath(page, "纪要.docx");
    expect(card).not.toBeNull();
    await card!.locator(".row").first().click();
    await page.waitForTimeout(2000);
    // keyword = hl（spans 字面「章节/跳转/测试」），不含行内容 Kirin——
    // 断言定位行为（滚动到命中区，scrollTop > 0）+ mark 存在。
    // 贴顶语义：命中块首对齐视口顶，mark 可在视口顶上方一行高内
    let r: any = { ok: false };
    for (let i = 0; i < 10 && !r.ok; i++) {
      await page.waitForTimeout(400);
      r = await markInView(page, "章节跳转测试", 80);
    }
    expect(r.ok, (r as any).reason).toBe(true);
  });

  test("S5 epub：命中章 → 定位 + mark", async ({ page }) => {
    await submitSearch(page, "麒麟起源");
    const card = await cardByPath(page, "书.epub");
    expect(card).not.toBeNull();
    await card!.locator(".row").first().click();
    // epub 分页懒渲染：跳转后途经页陆续展开导致估高塌变，收敛循环持续
    // 校准——轮询等待 mark 进入视口（上限 8s），容差 60px（一行高）
    let r: any = { ok: false };
    for (let i = 0; i < 16 && !r.ok; i++) {
      await page.waitForTimeout(500);
      r = await markInView(page, "麒麟起源", 60);
    }
    expect(r.ok, r.reason).toBe(true);
  });

  test("S6 xlsx：第 3 表命中 → 定位 + mark", async ({ page }) => {
    await submitSearch(page, "sheet three");
    const card = await cardByPath(page, "报表.xlsx");
    expect(card).not.toBeNull();
    await card!.locator(".row").first().click();
    await page.waitForTimeout(2000);
    // keyword = hl（spans 字面「sheet」「three」），不含 kirin——
    // 断言 sheet 命中区被定位（xlsx 分页表切换 + mark 在视口内）。
    // xlsx 分页表切换：跳转后收敛循环持续校准，轮询等待
    let r: any = { ok: false };
    for (let i = 0; i < 16 && !r.ok; i++) {
      await page.waitForTimeout(500);
      r = await markInView(page, "sheet", 80);
    }
    expect(r.ok, (r as any).reason).toBe(true);
  });

  test("S7 pptx：第 5 页命中 → 定位 + mark", async ({ page }) => {
    await submitSearch(page, "第五页含");
    const card = await cardByPath(page, "幻灯.pptx");
    expect(card).not.toBeNull();
    await card!.locator(".row").first().click();
    // keyword = hl（spans 字面「第五页含」整串），不含 kirin。
    // 分页幻灯切换收敛循环持续校准，轮询等待。
    let r: any = { ok: false };
    for (let i = 0; i < 16 && !r.ok; i++) {
      await page.waitForTimeout(500);
      r = await markInView(page, "第五页含", 80);
    }
    expect(r.ok, (r as any).reason).toBe(true);
  });

  test("S8 代码 .py（grep 模式）：命中行窗口打开", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1200);
    await shadow(page, "input-box", "input").fill("kirin_scale");
    await shadow(page, "input-box", ".caret").click();
    await shadow(page, "input-box", ".menu-item:nth-child(2)").click();
    await shadow(page, "input-box", "button.primary").click();
    await page.locator("file-card").first().waitFor({ timeout: 45_000 });
    const card = await cardByPath(page, "kirin_util.py");
    expect(card).not.toBeNull();
    await card!.locator(".row").first().click();
    await page.waitForTimeout(1500);
    const lineView = await page.evaluate(() => {
      const find = (root: ShadowRoot | Document): Element | null => {
        const direct = root.querySelector?.("preview-pane");
        if (direct) return direct;
        for (const el of Array.from(root.querySelectorAll?.("*") ?? [])) {
          if ((el as HTMLElement).shadowRoot) {
            const hit = find((el as HTMLElement).shadowRoot!);
            if (hit) return hit;
          }
        }
        return null;
      };
      const pp: any = find(document);
      if (!pp) return null;
      return pp.shadowRoot?.querySelector(".body .line-no")?.textContent ?? null;
    });
    // BUG-G1 已修：grep 相对路径 → 行号视图正常打开
    expect(lineView).toBeTruthy();
  });

  test("S8b 代码不进全文索引：search 不命中 .py", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1200);
    await shadow(page, "input-box", "input").fill("kirin_scale");
    await shadow(page, "input-box", "button.primary").click();
    await page.locator("focus-header").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    const count = await page.locator("file-card").count();
    expect(count).toBe(0);
  });

  test("P1 分页：麒麟 34 文件 → 翻页 + 新搜索重置", async ({ page }) => {
    await submitSearch(page, "麒麟");
    await expect(shadow(page, "pagination-bar", ".pages")).toBeVisible({ timeout: 10_000 });
    await shadow(page, "pagination-bar", ".pages button[aria-label='下一页']").click();
    await page.waitForTimeout(1200);
    await shadow(page, "focus-header", ".back").click();
    await page.waitForTimeout(600);
    await shadow(page, "input-box", "input").fill("麒麟");
    await shadow(page, "input-box", "button.primary").click();
    await page.locator("file-card").first().waitFor({ timeout: 45_000 });
    await expect(shadow(page, "pagination-bar", ".pages")).toBeVisible({ timeout: 10_000 });
    const current = await shadow(page, "pagination-bar", "button.current").innerText();
    expect(current.trim()).toBe("1");
  });

  test("P3 组头：文件名 + 命中数徽标，无评分展示", async ({ page }) => {
    await submitSearch(page, "麒麟");
    const header = await page.locator("file-card").first().locator(".header").innerText();
    expect(header).toMatch(/\.md|\.epub|\.pptx|\.xlsx|\.docx|\.txt|\.html/);
    expect(header).not.toMatch(/0\.\d+/);
  });
});

test.describe("search → preview locate（mobile）", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("P4 移动端：搜索 → 点命中 → 整页预览 + mark 可见；单次返回回列表", async ({ page }) => {
    await submitSearch(page, "麒麟");
    const card = await cardByPath(page, "杂记.md");
    expect(card).not.toBeNull();
    await card!.locator(".row").first().click();
    await page.waitForTimeout(2000);
    const r = await markInView(page, "麒麟");
    expect(r.ok, (r as any).reason).toBe(true);

    // 单次返回即回结果列表（2026-10-19 修复回归：hit-select 双压
    // detailStack 深度 2 需按两次返回）
    await page.locator("preview-pane[mobile] >> button[aria-label='返回']").click();
    await page.waitForTimeout(800);
    const overlayGone = await page.evaluate(() => {
      const find = (root: ShadowRoot | Document, tag: string): HTMLElement | null => {
        const d = root.querySelector?.(tag);
        if (d) return d as HTMLElement;
        for (const el of Array.from(root.querySelectorAll?.("*") ?? [])) {
          if ((el as HTMLElement).shadowRoot) {
            const h = find((el as HTMLElement).shadowRoot!, tag);
            if (h) return h;
          }
        }
        return null;
      };
      const sv = find(document, "search-view");
      return sv?.shadowRoot?.querySelector(".detail-overlay") == null;
    });
    expect(overlayGone, "单次返回后 detail-overlay 应消失").toBe(true);
  });
});
