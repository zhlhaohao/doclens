import { test, expect, type Page } from "@playwright/test";

/**
 * 移动端下拉刷新（pull-to-refresh）E2E。
 *
 * Playwright 的 touchscreen API 只有 tap 没有 move，无法直接模拟拖拽；
 * 这里在页面上下文内合成触摸事件序列（touchstart → touchmove… →
 * touchend）。三个 WebKit 仿真限制及对策：
 * - 合成事件（非 trusted）从嵌套 shadow root 内 dispatch 时不会跨
 *   shadow boundary 冒泡到 document → 改为 dispatch 到 document，并在
 *   事件对象上定义 composedPath() 返回真实扁平祖先链（与真实触摸事件
 *   的 composedPath 内容等价）。
 * - Touch 构造器是 Illegal constructor（TouchEvent 本身可用）→ 用
 *   Object.defineProperty 往 Event 实例上补 touches。
 * - iPhone 13 仿真不改变 (pointer: coarse) 媒体查询（返回 false）→
 *   addInitScript stub matchMedia 对 pointer 查询返回 coarse=true。
 */

/** 在页面内合成一次下拉手势。travel 为下拉总位移（px）。
 *  返回手势是否成立（可见 view + 找到 scroller）。 */
async function pullToRefresh(page: Page, travel = 100, from = 300): Promise<boolean> {
  return page.evaluate(
    ([startY, dist]) => {
      const app = document.querySelector("cortex-app");
      const root = app?.shadowRoot;
      if (!root) return false;
      const view = ["files-view", "chat-view", "search-view", "diary-view"]
        .map((t) => root.querySelector(t))
        .find((el) => el && !el.hasAttribute("hidden"));
      if (!view) return false;

      // BFS 找 view 内第一个 overflow-y: auto|scroll 元素（真实 scroller）。
      // host 自身也参与判定（diary-view 的滚动体就是 view :host 自己）。
      function findScroller(host: Element): HTMLElement | null {
        const queue: Element[] = [host];
        for (let i = 0; i < queue.length && i < 40; i++) {
          const el = queue[i];
          if (el instanceof HTMLElement) {
            const oy = getComputedStyle(el).overflowY;
            if (oy === "auto" || oy === "scroll") return el;
          }
          queue.push(
            ...(el.shadowRoot
              ? [...el.shadowRoot.children]
              : [...el.children]),
          );
        }
        return null;
      }
      const scroller = findScroller(view);
      // scroller 是 host 自身（如 history-list :host）时内容在 shadow 里；
      // leaf 取 shadow 内首元素，保证 path 含 scroller 之下的层级
      const leaf =
        (scroller?.shadowRoot
          ? scroller.shadowRoot.firstElementChild
          : scroller?.firstElementChild) ?? scroller ?? view;

      // 完整扁平祖先链（穿透 shadow root），等价于真实事件的 composedPath
      function buildPath(start: Element): EventTarget[] {
        const path: EventTarget[] = [];
        let node: EventTarget | null = start;
        while (node) {
          path.push(node);
          if (node instanceof Element) {
            const rn = node.getRootNode();
            node =
              node.parentElement ??
              (rn instanceof ShadowRoot ? rn.host : null);
          } else {
            node = null;
          }
        }
        if (path[path.length - 1] === document.documentElement) {
          path.push(document, window);
        }
        return path;
      }
      const full = buildPath(leaf);

      const mkEvent = (type: string, y: number) => {
        const ev = new Event(type, { cancelable: true, bubbles: true });
        Object.defineProperty(ev, "touches", {
          get: () => [{ identifier: 1, clientX: 200, clientY: y }],
        });
        Object.defineProperty(ev, "composedPath", { value: () => full });
        return ev;
      };
      document.dispatchEvent(mkEvent("touchstart", startY));
      for (let d = 10; d <= dist; d += 10) {
        document.dispatchEvent(mkEvent("touchmove", startY + d));
      }
      document.dispatchEvent(mkEvent("touchend", startY + dist));
      return true;
    },
    [from, travel],
  );
}

test.describe("mobile pull-to-refresh", () => {
  test.skip(
    ({ browserName }) => browserName !== "webkit",
    "Mobile only",
  );

  test.beforeEach(async ({ page }) => {
    // WebKit 仿真不模拟触摸指针：(pointer: coarse) 返回 false 会让手势
    // 闸门失效。addInitScript 在应用脚本前执行，保证 isCoarsePointer() 命中。
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string): MediaQueryList => {
        if (query.includes("pointer: coarse") || query.includes("hover: none")) {
          return { matches: true, media: query } as MediaQueryList;
        }
        return original(query);
      };
    });
  });

  test("PTR-001: files 列表下拉触发目录与文档刷新请求", async ({ page }) => {
    await page.goto("#/files");
    await expect(page.locator("file-list")).toBeVisible();
    // 等初始加载风暴结束（初始也会拉 list/documents，避免误匹配）
    await page.waitForTimeout(800);

    const listReq = page.waitForRequest(
      (r) => r.url().includes("/api/files/list"),
      { timeout: 10_000 },
    );
    const docsReq = page.waitForRequest(
      (r) => r.url().includes("/api/files/documents"),
      { timeout: 10_000 },
    );
    expect(await pullToRefresh(page)).toBe(true);
    await listReq;
    await docsReq;
  });

  test("PTR-002: 未达阈值（30px）不触发刷新请求", async ({ page }) => {
    await page.goto("#/files");
    await expect(page.locator("file-list")).toBeVisible();
    // 等初始加载风暴结束
    await page.waitForTimeout(800);

    let hit = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/files/list")) hit++;
    });
    await pullToRefresh(page, 30);
    await page.waitForTimeout(800);
    expect(hit).toBe(0);
  });

  test("PTR-003: chat initial 态下拉触发会话列表刷新", async ({ page }) => {
    await page.goto("#/chat");
    await expect(page.locator("chat-view")).toBeVisible();
    await page.waitForTimeout(800);

    const sessionsReq = page.waitForRequest(
      (r) => r.url().includes("/api/sessions"),
      { timeout: 10_000 },
    );
    expect(await pullToRefresh(page)).toBe(true);
    await sessionsReq;
  });

  test("PTR-004: diary 下拉触发今日记录刷新", async ({ page }) => {
    await page.goto("#/diary");
    await expect(page.locator("diary-view")).toBeVisible();
    await page.waitForTimeout(800);

    const todayReq = page.waitForRequest(
      (r) => r.url().includes("/api/diary/today"),
      { timeout: 10_000 },
    );
    expect(await pullToRefresh(page)).toBe(true);
    await todayReq;
  });

  test("PTR-005: files detail 层下拉不触发刷新（data-ptr-off）", async ({ page }) => {
    await page.goto("#/files");
    await expect(page.locator("file-list")).toBeVisible();
    // 点第一个「文件」行进入 detail 层（目录行点击是导航进目录，
    // 不弹 .mobile-preview；文件行的 size 列有内容，目录行为空）
    const fileRow = page.locator("file-row .size", { hasText: /.+/ }).first();
    await fileRow.click();
    await expect(page.locator(".mobile-preview")).toBeVisible();
    await page.waitForTimeout(800);

    let hit = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/files/documents")) hit++;
    });
    // detail 层的 BFS scroller 处于 data-ptr-off 容器内 → 黑名单拦截，手势不成立
    await pullToRefresh(page);
    await page.waitForTimeout(800);
    expect(hit).toBe(0);
  });

  test("PTR-006: 下拉过程中指示器可见且文案随阈值切换", async ({ page }) => {
    await page.goto("#/files");
    await expect(page.locator("file-list")).toBeVisible();

    // 手持 → 拉过阈值 → 松手：在单个 evaluate 内分段 dispatch 并在页面
    // 内部读指示器状态（跨 evaluate 挂 window 的闭包在 WebKit 下不可靠），
    // 各阶段间留 150ms 让 Lit 完成渲染。
    const stages = await page.evaluate(
      async ([startY, midY, endY]) => {
        const app = document.querySelector("cortex-app");
        const view = app?.shadowRoot?.querySelector("files-view");
        if (!view || view.hasAttribute("hidden")) {
          throw new Error("files-view not visible");
        }
        function findScroller(host: Element): HTMLElement | null {
          const queue: Element[] = [host];
          for (let i = 0; i < queue.length && i < 40; i++) {
            const el = queue[i];
            if (el instanceof HTMLElement) {
              const oy = getComputedStyle(el).overflowY;
              if (oy === "auto" || oy === "scroll") return el;
            }
            queue.push(
              ...(el.shadowRoot
                ? [...el.shadowRoot.children]
                : [...el.children]),
            );
          }
          return null;
        }
        const scroller = findScroller(view);
        const leaf =
          (scroller?.shadowRoot
            ? scroller.shadowRoot.firstElementChild
            : scroller?.firstElementChild) ?? scroller ?? view;
        const full = (() => {
          const path: EventTarget[] = [];
          let node: EventTarget | null = leaf;
          while (node) {
            path.push(node);
            if (node instanceof Element) {
              const rn = node.getRootNode();
              node =
                node.parentElement ??
                (rn instanceof ShadowRoot ? rn.host : null);
            } else node = null;
          }
          if (path[path.length - 1] === document.documentElement) {
            path.push(document, window);
          }
          return path;
        })();
        const mkEvent = (type: string, y: number) => {
          const ev = new Event(type, { cancelable: true, bubbles: true });
          Object.defineProperty(ev, "touches", {
            get: () => [{ identifier: 1, clientX: 200, clientY: y }],
          });
          Object.defineProperty(ev, "composedPath", { value: () => full });
          return ev;
        };
        const sleep = (ms: number) =>
          new Promise((r) => setTimeout(r, ms));
        const readLabel = () => {
          const ind = app?.shadowRoot?.querySelector("ptr-indicator");
          return (ind?.shadowRoot?.textContent ?? "").trim();
        };

        document.dispatchEvent(mkEvent("touchstart", startY));
        for (let y = startY + 10; y <= midY; y += 10) {
          document.dispatchEvent(mkEvent("touchmove", y));
        }
        await sleep(150);
        const midLabel = readLabel();
        for (let y = midY + 10; y <= endY; y += 10) {
          document.dispatchEvent(mkEvent("touchmove", y));
        }
        await sleep(150);
        const armedLabel = readLabel();
        document.dispatchEvent(mkEvent("touchend", endY));
        await sleep(150);
        const refreshingLabel = readLabel();
        return { midLabel, armedLabel, refreshingLabel };
      },
      [300, 360, 400],
    );
    // 未达 64px 阈值：「下拉刷新」
    expect(stages.midLabel).toContain("下拉刷新");
    // 拉过阈值（dy=100 ≥ 64）：「松开刷新」
    expect(stages.armedLabel).toContain("松开刷新");
    // 松手：进入「刷新中」
    expect(stages.refreshingLabel).toContain("刷新中");
  });
});
