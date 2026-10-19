import { test, expect } from "@playwright/test";

function shadow(page: import("@playwright/test").Page, host: string, inner: string) {
  return page.locator(`${host} >> ${inner}`);
}

/** 断言 md-viewer 视口内可见「完整命中短语」（block=52 的双 mark） */
async function viewportCheck(page: import("@playwright/test").Page, expectBlock: number) {
  return page.evaluate(({ expectBlock }) => {
    const findMdv = (root: ShadowRoot | Document): Element | null => {
      const direct = root.querySelector?.("md-viewer");
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll?.("*") ?? [])) {
        if (el.shadowRoot) {
          const hit = findMdv(el.shadowRoot);
          if (hit) return hit;
        }
      }
      return null;
    };
    const mdv: any = findMdv(document);
    if (!mdv) return { ok: false, reason: "no mdv" };
    const root = mdv.shadowRoot!;
    const hostRect = mdv.getBoundingClientRect();
    const marks = Array.from(root.querySelectorAll("mark")) as HTMLElement[];
    const hit = marks.filter((m) => {
      let h: any = m;
      while (h && !h.hasAttribute?.("data-source-line")) h = h.parentElement;
      return Number(h?.getAttribute("data-source-line")) === expectBlock;
    });
    if (!hit.length) return { ok: false, reason: `no mark in block ${expectBlock}` };
    const top = hit[0].getBoundingClientRect().top;
    const bottom = hit[hit.length - 1].getBoundingClientRect().bottom;
    const ok = top >= hostRect.top - 4 && bottom <= hostRect.bottom + 4;
    return { ok, reason: ok ? "" : `marks [${top},${bottom}] vs host [${hostRect.top},${hostRect.bottom}]` };
  }, { expectBlock });
}

test.describe("grep hit → preview locate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);
    const input = shadow(page, "input-box", "input");
    await input.fill("T-cell.*proliferation");
    await shadow(page, "input-box", ".caret").click();
    await shadow(page, "input-box", ".menu-item:nth-child(2)").click();
    await shadow(page, "input-box", "button.primary").click();
    await page.locator("file-card").first().waitFor({ timeout: 30000 });
  });

  test("first click lands hit at viewport top", async ({ page }) => {
    const card = page.locator("file-card").first();
    await card.locator(".header").click();
    await card.locator(".row").first().click();
    await page.waitForTimeout(2000);
    const r = await viewportCheck(page, 52);
    expect(r.ok, (r as any).reason).toBe(true);
  });

  test("click again after scrolling away re-locates", async ({ page }) => {
    const card = page.locator("file-card").first();
    await card.locator(".header").click();
    await card.locator(".row").first().click();
    await page.waitForTimeout(2000);
    // 用户手动滚走（模拟阅读后回列表再点同一命中）
    await page.evaluate(() => {
      const find = (root: ShadowRoot | Document): any => {
        const d = root.querySelector?.("md-viewer");
        if (d) return d;
        for (const el of Array.from(root.querySelectorAll?.("*") ?? [])) {
          if (el.shadowRoot) { const h = find(el.shadowRoot); if (h) return h; }
        }
        return null;
      };
      const mdv = find(document);
      mdv.scrollTo({ top: 0 });
    });
    await page.waitForTimeout(800);
    // 再次点击同一命中行（path+line 未变 → previewLine 赋同值，updated 不触发？）
    await card.locator(".row").first().click();
    await page.waitForTimeout(2000);
    const r = await viewportCheck(page, 52);
    expect(r.ok, `二次点击后未回到命中处：${(r as any).reason}`).toBe(true);
  });
});
