import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { MdViewer } from "../src/components/md-viewer";
import { MdViewer as MdViewerClass } from "../src/components/md-viewer";
import { iconWidthStyle, ICON_PX_THRESHOLD } from "../src/components/md-viewer";
import { resolveDocImageUrl } from "../src/components/md-viewer";
import "../src/components/md-viewer";

describe("<md-viewer>", () => {
  it("renders markdown content as HTML", async () => {
    const el = await fixture(html`
      <md-viewer content="# Title\n\nparagraph"></md-viewer>
    `) as MdViewer;
    // 等待首次 update 完成
    await el.updateComplete;

    const h1 = el.shadowRoot!.querySelector("h1");
    expect(h1).toBeTruthy();
    expect(h1!.textContent).toContain("Title");

    const p = el.shadowRoot!.querySelector("p");
    expect(p).toBeTruthy();
    expect(p!.textContent).toContain("paragraph");
  });

  it("renders empty state when content is empty", async () => {
    const el = await fixture(html`<md-viewer content=""></md-viewer>`) as MdViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".empty")).toBeTruthy();
  });

  it("adds data-source-line to block elements", async () => {
    const md = "# Title\n\nfirst paragraph\n\nsecond paragraph\n";
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;

    const h1 = el.shadowRoot!.querySelector("h1");
    expect(h1?.getAttribute("data-source-line")).toBe("1");

    const ps = el.shadowRoot!.querySelectorAll("p");
    expect(ps.length).toBe(2);
    expect(ps[0].getAttribute("data-source-line")).toBe("3");
    expect(ps[1].getAttribute("data-source-line")).toBe("5");
  });

  it("scrolls to and highlights block containing target line", async () => {
    const md = "# Heading 1\n\npara 1\n\n## Heading 2\n\npara 2\n";
    const el = await fixture(html`<md-viewer .content=${md} .line=${6}></md-viewer>`) as MdViewer;
    await el.updateComplete;

    // 找到 data-source-line ≤ 6 的最后一个块（应该是 "## Heading 2" 在第 5 行）
    const highlighted = el.shadowRoot!.querySelector(".highlight-flash");
    expect(highlighted).toBeTruthy();
    expect(highlighted!.getAttribute("data-source-line")).toBe("5");
  });

  it("locates the correct block when content is paginated (xlsx/pdf/pptx)", async () => {
    // 3 pages of 5 lines each: lines 1-5, 6-10, 11-15
    // Each page contains 3 paragraphs separated by blank lines.
    const md = [
      "p1-a", "", "p1-b", "", "p1-c",          // lines 1, 3, 5
      "p2-a", "", "p2-b", "", "p2-c",          // lines 6, 8, 10
      "p3-a", "", "p3-b", "", "p3-c",          // lines 11, 13, 15
    ].join("\n");
    const pages = [
      { label: "P1", line_start: 1 },
      { label: "P2", line_start: 6 },
      { label: "P3", line_start: 11 },
    ];
    // line=13 should land on p3-b (page 3, second paragraph, absolute line 13).
    // Without the fix, _locateAndHighlight uses per-chunk data-source-line numbers
    // (1..5 per page) and finds p3-c instead of p3-b.
    const el = await fixture(html`
      <md-viewer .content=${md} .line=${13} .pages=${pages}></md-viewer>
    `) as MdViewer;
    await el.updateComplete;

    const highlighted = el.shadowRoot!.querySelector(".highlight-flash");
    expect(highlighted).toBeTruthy();
    expect(highlighted!.getAttribute("data-source-line")).toBe("13");
    expect(highlighted!.textContent).toContain("p3-b");
  });

  it("scrolls to first keyword mark when line points to a heading that doesn't contain the keyword (xlsx coarse line)", async () => {
    // 真实场景：xlsx 合成 md —— search-hit 的 line_start 是 sheet 起始（行 1），
    // 而 keyword（如 "邓寅"）实际出现在 sheet 内部的表格单元格里。
    // _locateAndHighlight 用 line 找到的 target 只是 sheet 标题，文本里不含 keyword；
    // 此时应该退而求其次，滚到第一个 <mark class="keyword-hit"> 所在的元素，
    // 否则用户看不到任何滚动动作（heading 已在视口顶部，scrollTo target 不会有位移）。
    const md = [
      "# 通讯录 (3 rows)",
      "",
      "| Name | Dept |",
      "| --- | --- |",
      "| 邓寅_1 | dept1 |",
      "| person_2 | dept2 |",
      "| 邓寅_3 | dept3 |",
      "",
    ].join("\n");
    const el = await fixture(html`
      <md-viewer
        content=${md}
        .line=${1}
        .keyword=${"邓寅"}
        .pages=${[{ label: "工作表 1", line_start: 1 }]}>
      </md-viewer>
    `) as MdViewer;
    await el.updateComplete;

    // 验证：能找到 keyword 的 mark
    const marks = el.shadowRoot!.querySelectorAll("mark.keyword-hit");
    expect(marks.length).toBeGreaterThan(0);

    // 验证：line=1 命中的 heading 不含 keyword，flash/scroll 应该指向第一个 mark，
    // 而不是 data-source-line="1" 的 heading。
    const flash = el.shadowRoot!.querySelector(".highlight-flash");
    expect(flash).toBeTruthy();
    expect(flash!.tagName).toBe("MARK");
    expect(flash!.textContent).toContain("邓寅");
  });

  it("flashes the line-based target when target text contains the keyword (markdown normal case)", async () => {
    // 与上一个测试互补：md 普通场景下，line 精确指向包含 keyword 的块，
    // 应该闪那个块，而不是退到 firstMark（避免误指其它早期出现的 keyword）。
    const md = "# Title\n\nfoo\n\nbar 邓寅 baz\n\nqux\n";
    const el = await fixture(html`
      <md-viewer content=${md} .line=${5} .keyword=${"邓寅"}></md-viewer>
    `) as MdViewer;
    await el.updateComplete;

    const flash = el.shadowRoot!.querySelector(".highlight-flash");
    expect(flash).toBeTruthy();
    expect(flash!.getAttribute("data-source-line")).toBe("5");
    expect(flash!.textContent).toContain("邓寅");
  });

  it("scrollToFirstKeywordHit scrolls host to first mark and flashes its block", async () => {
    // preview-pane 高亮输入条的核心定位方法：无 line 属性，纯 keyword 场景。
    const md = "# Title\n\nfoo\n\nbar 邓寅 baz\n\nqux 邓寅 quux\n";
    const el = await fixture(html`
      <md-viewer content=${md} .keyword=${"邓寅"}></md-viewer>
    `) as MdViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("mark.keyword-hit").length).toBe(2);

    // jsdom 未实现 scrollTo / getBoundingClientRect 返回全 0 —— stub 后验证调用
    const scrollSpy = vi.fn();
    (el as any).scrollTo = scrollSpy;
    // hostRect.height > 0 才会滚动：stub getBoundingClientRect
    const origGetRect = el.getBoundingClientRect.bind(el);
    (el as any).getBoundingClientRect = () => ({ ...origGetRect(), height: 400, top: 0 });

    el.scrollToFirstKeywordHit();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    const arg = scrollSpy.mock.calls[0][0] as ScrollToOptions;
    expect(arg.top).toBeGreaterThanOrEqual(0);

    // 首个命中所在块带闪烁动画
    const flash = el.shadowRoot!.querySelector(".highlight-flash");
    expect(flash).toBeTruthy();
    expect(flash!.textContent).toContain("邓寅");
  });

  it("scrollToFirstKeywordHit is a no-op when no keyword hit", async () => {
    const el = await fixture(html`
      <md-viewer content=${"# T\n\nfoo\n"} .keyword=${"不存在词"}></md-viewer>
    `) as MdViewer;
    await el.updateComplete;
    const scrollSpy = vi.fn();
    (el as any).scrollTo = scrollSpy;
    el.scrollToFirstKeywordHit();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("copy button is icon-only with hover tooltip label (icon + btn-label)", async () => {
    // preview 右上角「复制全文」按钮图标化：默认只显示 copy 图标，
    // 文字「复制全文」藏在 .btn-label（CSS 默认 display:none，hover 浮现为 tooltip）。
    const el = await fixture(html`<md-viewer content="# T\n\nfoo"></md-viewer>`) as MdViewer;
    await el.updateComplete;

    const btn = el.shadowRoot!.querySelector("button.doc-copy") as HTMLButtonElement;
    expect(btn, "expected .doc-copy button in copy-bar-top").toBeTruthy();
    const icon = btn.querySelector("doclens-icon");
    expect(icon?.getAttribute("name")).toBe("copy");
    const label = btn.querySelector(".btn-label");
    expect(label?.textContent?.trim()).toBe("复制全文");
    // 按钮自身不再直接含文字（文字只在 .btn-label 里）
    expect(btn.textContent?.replace(label?.textContent ?? "", "").trim()).toBe("");
  });

  it("copy button shows ✓ 已复制 text while in copied state", async () => {
    // 复制成功后的即时反馈仍用文字（1.5s 后恢复 icon-only）。
    const el = await fixture(html`<md-viewer content="# T\n\nfoo"></md-viewer>`) as MdViewer;
    await el.updateComplete;
    (el as any)._copied = true;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector("button.doc-copy")!;
    expect(btn.textContent?.trim()).toBe("✓ 已复制");
    expect(btn.querySelector("doclens-icon")).toBeNull();
  });

  it("scopes the keyword mark fallback to the same page as the target (multi-sheet xlsx)", async () => {
    // 多 sheet xlsx：r.line 指向 sheet 2 起始（行 6），sheet 1 也有 邓寅。
    // 不应滚到 sheet 1 的 邓寅_1，而应滚到 sheet 2 内的第一个 邓寅_1。
    // 验证方法：flash 的祖先 page-card 的 header 应为「工作表 2」。
    const md = [
      "# Sheet 1 (2 rows)",
      "",
      "| Name |",
      "| --- |",
      "| 邓寅_sheet1 |",
      "| person_2 |",
      "",
      "# Sheet 2 (2 rows)",
      "",
      "| Name |",
      "| --- |",
      "| 邓寅_sheet2 |",
      "| person_2 |",
      "",
    ].join("\n");
    const pages = [
      { label: "工作表 1", line_start: 1 },
      { label: "工作表 2", line_start: 6 },
    ];
    const el = await fixture(html`
      <md-viewer
        content=${md}
        .line=${6}
        .keyword=${"邓寅"}
        .pages=${pages}>
      </md-viewer>
    `) as MdViewer;
    await el.updateComplete;

    const flash = el.shadowRoot!.querySelector(".highlight-flash");
    expect(flash).toBeTruthy();
    expect(flash!.tagName).toBe("MARK");
    // flash 所在 page-card 的 header.label 应该是 "工作表 2"（不是 "工作表 1"）
    const card = flash!.closest(".page-card") as HTMLElement;
    expect(card).toBeTruthy();
    const header = card.querySelector(".page-card-header") as HTMLElement;
    expect(header?.textContent?.trim()).toBe("工作表 2");
  });

  it("does not highlight when line is null", async () => {
    const el = await fixture(html`<md-viewer content="# x" .line=${null}></md-viewer>`) as MdViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".highlight-flash")).toBeNull();
  });

  it("renders md table with thead/th/td structure", async () => {
    const md = [
      "| name | age |",
      "| --- | --- |",
      "| Alice | 30 |",
      "| Bob | 25 |",
      "",
    ].join("\n");
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;

    const table = el.shadowRoot!.querySelector("table");
    expect(table).toBeTruthy();
    expect(el.shadowRoot!.querySelector("thead th:nth-child(1)")!.textContent)
      .toContain("name");
    const cells = el.shadowRoot!.querySelectorAll("tbody td");
    expect(cells.length).toBe(4);  // 2 rows × 2 cols
    expect(cells[0].textContent).toContain("Alice");
  });

  it("adds data-source-line to table and hr blocks (anchor coverage)", async () => {
    // 回归：table/hr 曾走 marked 默认 renderer 无 data-source-line，从锚点序列消失，
    // 导致 _blockSpan 把其行跨度并入前一锚块——高大表格下 topSourceLine 插值
    // 严重 overshoot（预览↔编辑切换首行漂移）。
    const md = [
      "intro para",      // line 1
      "",
      "| a | b |",       // line 3
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "after table",     // line 7
      "",
      "---",             // line 9
      "",
      "tail para",       // line 11
    ].join("\n");
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;

    const table = el.shadowRoot!.querySelector("table");
    expect(table?.getAttribute("data-source-line")).toBe("3");
    const hr = el.shadowRoot!.querySelector("hr");
    expect(hr?.getAttribute("data-source-line")).toBe("9");
    // 锚点序列完整且行号单调：1 (p) → 3 (table) → 7 (p) → 9 (hr) → 11 (p)
    const lines = Array.from(
      el.shadowRoot!.querySelectorAll("[data-source-line]"),
    ).map((n) => Number(n.getAttribute("data-source-line")));
    expect(lines).toEqual([1, 3, 7, 9, 11]);
  });

  it("styles table cells with visible borders (regression: separators missing)", async () => {
    // 用户报告：md 表格没有分隔线。根因是 CSS 没有 table 规则，浏览器默认无边框。
    // 本测试断言 md-viewer 的 scoped styles 包含 table/th/td 边框规则，
    // 防止未来再次回归。Lit CSSResult 的 cssText 是源 CSS 字符串。
    const cssText = (MdViewerClass as any).styles.cssText as string;

    // 至少一条规则同时提到 table/th/td 和 border
    const hasTableBorder = /(^|\})[\s]*[^{]*\b(table|th|td|thead|tbody)\b[^{]*\{[^}]*\bborder\b/.test(
      cssText,
    );
    expect(
      hasTableBorder,
      `expect md-viewer styles to include table/th/td border rule, got cssText:\n${cssText}`,
    ).toBe(true);
  });

  it("renders <img loading=lazy> for markdown image with /api/preview/asset src", async () => {
    // Task 6: md-viewer 必须把 ![alt](/api/preview/asset?...) 渲染成带 lazy 加载的 <img>。
    // marked 默认 image renderer 不加 loading="lazy"，需自定义 renderer。
    const md = "![图片 1](/api/preview/asset?path=a.docx&id=1)";
    const el = await fixture(html`<md-viewer .content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;

    const img = el.shadowRoot!.querySelector("img");
    expect(img, "expected an <img> element to be rendered").toBeTruthy();
    expect(img!.getAttribute("loading")).toBe("lazy");
    expect(img!.getAttribute("src")).toContain("/api/preview/asset");
    expect(img!.getAttribute("alt")).toBe("图片 1");
  });

  it("escapes the alt text and includes title attribute on image", async () => {
    // 安全回归：alt/title 来自 markdown 文本，必须经过 escapeHtml，避免 XSS。
    const md = '![alt"x](/api/preview/asset?path=b.pdf&id=2 "ti&tle")';
    const el = await fixture(html`<md-viewer .content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;

    const img = el.shadowRoot!.querySelector("img");
    expect(img).toBeTruthy();
    // alt 中的双引号必须被转义，不能破坏属性边界
    expect(img!.getAttribute("alt")).toBe('alt"x');
    expect(img!.getAttribute("title")).toBe("ti&tle");
    expect(img!.getAttribute("loading")).toBe("lazy");
  });

  it("styles images with max-width / border-radius rule (regression)", async () => {
    // 防止未来移除 :host img 自适应样式
    const cssText = (MdViewerClass as any).styles.cssText as string;
    const hasImgRule = /:host\s+img\s*\{[^}]*max-width[^}]*\}/.test(cssText);
    expect(
      hasImgRule,
      `expect md-viewer styles to include ":host img { max-width ... }" rule, got cssText:\n${cssText}`,
    ).toBe(true);
  });

  it("renders paper-like preview: gray host + white paper + transparent paged container (regression)", async () => {
    // 纸张效果：:host 灰底让白纸浮起；.md-body 单块白纸；.md-body-paged 透明覆盖
    // （让分页 page-card 当多张纸，而非一张大纸包多页）；.page-card 去 border 靠阴影。
    const cssText = (MdViewerClass as any).styles.cssText as string;

    // :host 灰底
    expect(
      /:host\s*\{[^}]*background:\s*var\(--cortex-bg\)/.test(cssText),
      `:host should set background: var(--cortex-bg)\n${cssText}`,
    ).toBe(true);

    // .md-body 单块 = 白纸 + max-width 居中
    expect(
      /\.md-body\s*\{[^}]*background:\s*var\(--cortex-surface\)/.test(cssText),
      `.md-body should be white paper (background: var(--cortex-surface))\n${cssText}`,
    ).toBe(true);
    expect(
      /\.md-body\s*\{[^}]*max-width:\s*820px/.test(cssText),
      `.md-body should have max-width: 820px\n${cssText}`,
    ).toBe(true);

    // .md-body-paged 透明覆盖（注意：必须出现在 .md-body 之后才能覆盖）
    expect(
      /\.md-body-paged\s*\{[^}]*background:\s*transparent/.test(cssText),
      `.md-body-paged must override .md-body to transparent\n${cssText}`,
    ).toBe(true);

    // .page-card 去 border，靠 box-shadow
    expect(
      /\.page-card\s*\{[^}]*border:\s*none/.test(cssText),
      `.page-card should drop border, rely on shadow\n${cssText}`,
    ).toBe(true);
  });
});

describe("iconWidthStyle", () => {
  it("returns null for naturalWidth=0 (broken/unloaded image)", () => {
    expect(iconWidthStyle(0)).toBeNull();
  });

  it("returns '{w}px' for small images within threshold", () => {
    expect(iconWidthStyle(1)).toBe("1px");
    expect(iconWidthStyle(100)).toBe("100px");
  });

  it("includes the threshold boundary (<= threshold)", () => {
    expect(iconWidthStyle(ICON_PX_THRESHOLD)).toBe(`${ICON_PX_THRESHOLD}px`);
  });

  it("returns null just above threshold", () => {
    expect(iconWidthStyle(ICON_PX_THRESHOLD + 1)).toBeNull();
  });

  it("returns null for large images", () => {
    expect(iconWidthStyle(1000)).toBeNull();
  });
});

describe("resolveDocImageUrl", () => {
  const doc = "日记/2026.md";

  it("rewrites relative src against the doc directory", () => {
    expect(resolveDocImageUrl(doc, "images/2026-08-01/x.webp")).toBe(
      `/api/preview/raw?path=${encodeURIComponent("日记")}/images/2026-08-01/x.webp`,
    );
  });

  it("handles ./ prefix and .. segments", () => {
    expect(resolveDocImageUrl(doc, "./images/x.png")).toBe(
      `/api/preview/raw?path=${encodeURIComponent("日记")}/images/x.png`,
    );
    expect(resolveDocImageUrl("a/b/c.md", "../shared/x.png")).toBe(
      "/api/preview/raw?path=a/shared/x.png",
    );
  });

  it("encodes each path segment but keeps slashes", () => {
    const url = resolveDocImageUrl(doc, "我的 图片/x y.png")!;
    expect(url).toContain("/api/preview/raw?path=");
    expect(url).toContain(encodeURIComponent("我的 图片"));
    expect(url).not.toContain(" ");
  });

  it("keeps query string / fragment on the rewritten URL", () => {
    expect(resolveDocImageUrl(doc, "images/x.png?dw=100")).toBe(
      `/api/preview/raw?path=${encodeURIComponent("日记")}/images/x.png?dw=100`,
    );
  });

  it("returns null for absolute / scheme / anchor / escaping-root src", () => {
    expect(resolveDocImageUrl(doc, "/api/preview/asset?path=a&id=1")).toBeNull();
    expect(resolveDocImageUrl(doc, "https://example.com/x.png")).toBeNull();
    expect(resolveDocImageUrl(doc, "data:image/png;base64,xx")).toBeNull();
    expect(resolveDocImageUrl(doc, "#frag")).toBeNull();
    expect(resolveDocImageUrl("c.md", "../x.png")).toBeNull();
    expect(resolveDocImageUrl("", "images/x.png")).toBeNull();
  });
});

describe("<md-viewer> icon sizing (_applyIconSizing)", () => {
  // jsdom 不加载图片：naturalWidth 恒 0、complete 恒 false。
  // _applyIconSizing 因此走 addEventListener("load") 分支；
  // 测试用 Object.defineProperty mock naturalWidth 后手动 dispatch load 触发回调。

  function setNaturalWidth(img: HTMLImageElement, w: number): void {
    Object.defineProperty(img, "naturalWidth", { configurable: true, value: w });
  }

  async function mountWithImage(md?: string): Promise<MdViewer> {
    const content = md ?? "![图片 1](/api/preview/asset?path=a.docx&id=1)";
    const el = await fixture(html`<md-viewer .content=${content}></md-viewer>`) as MdViewer;
    await el.updateComplete; // updated() 已跑，_applyIconSizing 已为 img 绑 load
    return el;
  }

  it("small image (<=threshold) sets style.width = naturalWidth px", async () => {
    const el = await mountWithImage();
    const img = el.shadowRoot!.querySelector("img")!;
    setNaturalWidth(img, 80);
    img.dispatchEvent(new Event("load"));
    await el.updateComplete;
    expect(img.style.width).toBe("80px");
  });

  it("large image (>threshold) leaves style.width unset (max-width:100% keeps filling)", async () => {
    const el = await mountWithImage();
    const img = el.shadowRoot!.querySelector("img")!;
    setNaturalWidth(img, 1200);
    img.dispatchEvent(new Event("load"));
    await el.updateComplete;
    expect(img.style.width).toBe("");
  });

  it("broken image (naturalWidth=0) leaves style.width unset", async () => {
    const el = await mountWithImage();
    const img = el.shadowRoot!.querySelector("img")!;
    // jsdom naturalWidth 默认 0，无需 setNaturalWidth
    img.dispatchEvent(new Event("load"));
    await el.updateComplete;
    expect(img.style.width).toBe("");
  });

  it("方案 B: src 含 &dw (<=threshold) 立即设 width=dw，无需等 load", async () => {
    const el = await mountWithImage("![图片 1](/api/preview/asset?path=a.docx&id=1&dw=80)");
    const img = el.shadowRoot!.querySelector("img")!;
    // dw=80 → updated() 内立即设 width，不依赖 load 事件（消除 lazy 闪烁）
    expect(img.style.width).toBe("80px");
  });

  it("方案 B: src &dw > threshold 不设 width（大图继续铺满）", async () => {
    const el = await mountWithImage("![图片 1](/api/preview/asset?path=a.docx&id=1&dw=800)");
    const img = el.shadowRoot!.querySelector("img")!;
    expect(img.style.width).toBe("");
  });

  it("方案 B: src dw 优先于 naturalWidth（高分辨率 icon 按 dw 显示）", async () => {
    // PPTX 真实场景：底层 1024px 但文档显示 38px → 有 dw=38 时按 38px 显示
    const el = await mountWithImage("![图片 1](/api/preview/asset?path=a.pptx&id=1&dw=38)");
    const img = el.shadowRoot!.querySelector("img")!;
    setNaturalWidth(img, 1024);            // 底层高分辨率
    img.dispatchEvent(new Event("load"));  // 即使 load 触发，dw 仍优先
    await el.updateComplete;
    expect(img.style.width).toBe("38px");  // 用 dw=38，忽略 naturalWidth=1024
  });
});

describe("<md-viewer> 行级锚点（预览↔编辑切换视野一致）", () => {
  /** stub 元素 rect：jsdom 无布局，getBoundingClientRect 全 0，需手工赋形。
   *  blocks: 每块 {line, top, height}（视口坐标系）；host: {top, height}。 */
  function stubLayout(el: MdViewer, host: { top: number; height: number }, blocks: { line: number; top: number; height: number }[]) {
    (el as any).getBoundingClientRect = () => ({ top: host.top, height: host.height, bottom: host.top + host.height, left: 0, right: 800, width: 800, x: 0, y: host.top, toJSON: () => ({}) });
    const nodes = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>("[data-source-line]"));
    // DOM 顺序对应 blocks 顺序（fixture 内容按此约定构造）
    blocks.forEach((b, i) => {
      const n = nodes[i];
      if (!n) return;
      (n as any).getBoundingClientRect = () => ({ top: b.top, height: b.height, bottom: b.top + b.height, left: 0, right: 800, width: 800, x: 0, y: b.top, toJSON: () => ({}) });
    });
    return nodes;
  }

  it("topSourceLine: 视口顶在块开头上方 → 返回块起始行", async () => {
    const md = "# A\n\nfoo\n\n# B\n\nbar\n";
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;
    // 布局：h1(line1) top=0 h=40；p(line3) top=60 h=80；h1(line5) top=180 h=40
    stubLayout(el, { top: 0, height: 400 }, [
      { line: 1, top: 0, height: 40 },
      { line: 3, top: 60, height: 80 },
      { line: 5, top: 180, height: 40 },
      { line: 7, top: 260, height: 40 },
    ]);
    expect(el.topSourceLine()).toBe(1);
  });

  it("topSourceLine: 视口顶侵入块内部 → 按像素比例行内插值", async () => {
    const md = "# A\n\nfoo\n\n# B\n\nbar\n";
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;
    // 视口顶 = 100：p(line3, top=60, h=80) 侵入 40px = 50% → line3 跨度=2（到 line5）
    // 50% * 2 = 偏移 1 → 返回 4
    stubLayout(el, { top: 100, height: 400 }, [
      { line: 1, top: 0, height: 40 },
      { line: 3, top: 60, height: 80 },
      { line: 5, top: 180, height: 40 },
      { line: 7, top: 260, height: 40 },
    ]);
    expect(el.topSourceLine()).toBe(4);
  });

  it("topSourceLine: 长代码块中部 → 大跨度插值（修复原块级精度的主场景）", async () => {
    // 20 行代码块：token.raw 吞掉围栏后的两个空行，下一块 P=26（实测 dump）。
    // pre 跨度 = 26 - 3 = 23；视口顶侵到块高 50% → 3 + round(0.5*23) = 15
    const code = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
    const md = `# A\n\n\`\`\`\n${code}\n\`\`\`\n\nafter\n`;
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;
    stubLayout(el, { top: 410, height: 400 }, [
      { line: 1, top: 0, height: 40 },        // h1
      { line: 3, top: 60, height: 700 },      // pre：line3 起，跨度 23（下一块 line 26）
      { line: 26, top: 800, height: 40 },     // p after（含代码块尾空行）
    ]);
    expect(el.topSourceLine()).toBe(15);
  });

  it("topSourceLine: 表格块参与锚点序列，文末插值不 overshoot（回归：table 缺锚点）", async () => {
    // 回归：table 曾走 marked 默认 renderer 无 data-source-line，其行跨度被并入
    // 前一锚块——表格又高又长时 topSourceLine 插值直接冲到文档末行，
    // 预览→编辑切换后首行漂移几十行。
    const md = [
      "# A", "",
      "p text", "",
      "| a | b |",
      "| --- | --- |",
      "| 1 | 2 |", "",
      "tail",
    ].join("\n");
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;
    // 布局：h1(1) / p(3) / table(5, 高 300) / p(9)；视口顶 410 侵入 table 290px
    stubLayout(el, { top: 410, height: 400 }, [
      { line: 1, top: 0, height: 40 },
      { line: 3, top: 60, height: 40 },
      { line: 5, top: 120, height: 300 },
      { line: 9, top: 440, height: 40 },
    ]);
    // span = 9-5 = 4；offset = round(290/300*4)=4 → 钳到 span-1=3 → line 5+3=8
    // 若无 table 锚点：p(3) 的 span 会被算成 9-3=6，同位置插值出更大行号
    expect(el.topSourceLine()).toBe(8);
  });

  it("scrollToSourceLine: 块起始行 → 滚到块顶（旧行为兼容）", async () => {
    const md = "# A\n\nfoo\n\n# B\n\nbar\n";
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;
    const scrollSpy = vi.fn();
    (el as any).scrollTo = scrollSpy;
    (el as any).scrollTop = 0;
    stubLayout(el, { top: 0, height: 400 }, [
      { line: 1, top: 0, height: 40 },
      { line: 3, top: 60, height: 80 },
      { line: 5, top: 180, height: 40 },
      { line: 7, top: 260, height: 40 },
    ]);
    el.scrollToSourceLine(3, "auto");
    expect(scrollSpy).toHaveBeenCalledWith({ top: 60, behavior: "auto" });
  });

  it("scrollToSourceLine: 块内行 → 块顶 + 跨度比例像素偏移（与 topSourceLine 插值互逆）", async () => {
    const md = "# A\n\nfoo\n\n# B\n\nbar\n";
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;
    const scrollSpy = vi.fn();
    (el as any).scrollTo = scrollSpy;
    (el as any).scrollTop = 0;
    stubLayout(el, { top: 0, height: 400 }, [
      { line: 1, top: 0, height: 40 },
      { line: 3, top: 60, height: 80 },
      { line: 5, top: 180, height: 40 },
      { line: 7, top: 260, height: 40 },
    ]);
    // line 4 = p(line3) 内偏移 1，跨度 2 → pxInto = 1/2 * 80 = 40 → top = 60+40 = 100
    el.scrollToSourceLine(4, "auto");
    expect(scrollSpy).toHaveBeenCalledWith({ top: 100, behavior: "auto" });
  });

  it("往返一致：topSourceLine 捕获 → scrollToSourceLine 恢复同位置", async () => {
    const md = "# A\n\nfoo\n\n# B\n\nbar\n";
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;
    // 捕获阶段：视口顶 = 100，p(line3, top=60, h=80) 侵入 40px = 50% → 偏移 1 → line 4
    const layout = [
      { line: 1, top: 0, height: 40 },
      { line: 3, top: 60, height: 80 },
      { line: 5, top: 180, height: 40 },
      { line: 7, top: 260, height: 40 },
      { line: 7, top: 260, height: 40 },
    ];
    stubLayout(el, { top: 100, height: 400 }, layout);
    const captured = el.topSourceLine();
    expect(captured).toBe(4);

    // 恢复阶段：重 stub 为「未滚动」状态（hostRect.top=0、块坐标同布局），
    // scrollToSourceLine(4) 应滚到 p 顶 + 1/2*80 = 100，让 line 4 贴住视口顶
    const scrollSpy = vi.fn();
    (el as any).scrollTo = scrollSpy;
    (el as any).scrollTop = 0;
    stubLayout(el, { top: 0, height: 400 }, layout);
    el.scrollToSourceLine(captured, "auto");
    const arg = scrollSpy.mock.calls[0][0] as ScrollToOptions;
    expect(arg.top).toBe(100);
  });

  it("行级锚点不破坏既有调用方：line property 定位仍贴块顶 + 闪烁", async () => {
    // search-view 命中行定位：块起始行定位应与旧行为一致（偏移 0）
    const md = "# T\n\nfoo\n\nbar\n";
    const el = await fixture(html`<md-viewer content=${md} .line=${3}></md-viewer>`) as MdViewer;
    await el.updateComplete;
    const scrollSpy = vi.fn();
    (el as any).scrollTo = scrollSpy;
    (el as any).scrollTop = 0;
    stubLayout(el, { top: 0, height: 400 }, [
      { line: 1, top: 0, height: 40 },
      { line: 3, top: 60, height: 80 },
      { line: 5, top: 180, height: 40 },
      { line: 7, top: 260, height: 40 },
    ]);
    el.scrollToSourceLine(3, "smooth");
    expect(scrollSpy).toHaveBeenCalledWith({ top: 60, behavior: "smooth" });
    // 闪烁类仍在目标块上
    const flash = el.shadowRoot!.querySelector(".highlight-flash");
    expect(flash?.getAttribute("data-source-line")).toBe("3");
  });
});
