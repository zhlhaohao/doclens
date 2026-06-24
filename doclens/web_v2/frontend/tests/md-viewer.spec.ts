import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { MdViewer } from "../src/components/md-viewer";
import { MdViewer as MdViewerClass } from "../src/components/md-viewer";
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
});
