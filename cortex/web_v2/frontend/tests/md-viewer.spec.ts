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
