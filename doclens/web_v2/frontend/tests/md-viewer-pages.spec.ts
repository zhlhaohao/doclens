import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/md-viewer";
import type { MdViewer } from "../src/components/md-viewer";

describe("<md-viewer> pages rendering", () => {
  it("renders single .md-body when pages is null (regression)", async () => {
    const el = await fixture(html`<md-viewer content="# T"></md-viewer>`) as MdViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".md-body")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".md-body-paged")).toBeNull();
    expect(el.shadowRoot!.querySelectorAll(".page-card").length).toBe(0);
  });

  it("renders .md-body-paged and one .page-card when pages has 1 item", async () => {
    const el = await fixture(html`
      <md-viewer
        content="body"
        .pages=${[{ label: "第 1 页", line_start: 1 }]}>
      </md-viewer>
    `) as MdViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".md-body-paged")).toBeTruthy();
    const cards = el.shadowRoot!.querySelectorAll(".page-card");
    expect(cards.length).toBe(1);
    const header = cards[0].querySelector(".page-card-header");
    expect(header).toBeTruthy();
    expect(header!.textContent).toContain("第 1 页");
  });

  it("renders N .page-cards in order with correct labels", async () => {
    const content = "page1\npage2\npage3";
    const pages = [
      { label: "第 1 页", line_start: 1 },
      { label: "第 2 页", line_start: 2 },
      { label: "第 3 页", line_start: 3 },
    ];
    const el = await fixture(html`
      <md-viewer .content=${content} .pages=${pages}></md-viewer>
    `) as MdViewer;
    await el.updateComplete;
    const cards = el.shadowRoot!.querySelectorAll(".page-card");
    expect(cards.length).toBe(3);
    const labels = Array.from(cards).map(
      (c) => c.querySelector(".page-card-header")!.textContent!.trim(),
    );
    expect(labels).toEqual(["第 1 页", "第 2 页", "第 3 页"]);
  });

  it("empty pages array falls back to single .md-body", async () => {
    const el = await fixture(html`
      <md-viewer content="# T" .pages=${[]}></md-viewer>
    `) as MdViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".md-body")).toBeTruthy();
    expect(el.shadowRoot!.querySelectorAll(".page-card").length).toBe(0);
  });

  it("splits content by line_start correctly", async () => {
    // 5 行内容，3 页：page1 = lines 1-2，page2 = lines 3-4，page3 = line 5
    const content = "L1\nL2\nL3\nL4\nL5";
    const pages = [
      { label: "第 1 页", line_start: 1 },
      { label: "第 2 页", line_start: 3 },
      { label: "第 3 页", line_start: 5 },
    ];
    const el = await fixture(html`
      <md-viewer .content=${content} .pages=${pages}></md-viewer>
    `) as MdViewer;
    await el.updateComplete;
    const cards = el.shadowRoot!.querySelectorAll(".page-card");
    expect(cards.length).toBe(3);
    // page 1 的 body 应含 L1 L2
    const p1 = cards[0].textContent ?? "";
    expect(p1).toContain("L1");
    expect(p1).toContain("L2");
    expect(p1).not.toContain("L3");
    // page 2 含 L3 L4
    const p2 = cards[1].textContent ?? "";
    expect(p2).toContain("L3");
    expect(p2).toContain("L4");
    expect(p2).not.toContain("L2");
    // page 3 含 L5
    const p3 = cards[2].textContent ?? "";
    expect(p3).toContain("L5");
  });

  it("resets line offset when switching from paged to single-block (regression)", async () => {
    // 回归：模拟「先点 PDF（分页）再点 docx/md（单块）」。
    // 分页模式会把模块级 currentOffset 设成最后一个 chunk 的起始偏移，
    // 单块分支必须重置为 0，否则 lineOf 把单块文档每个 data-source-line
    // 都加上残留偏移 → _locateAndHighlight 用正确 line 找不到目标块
    // → 表现为 PDF 之后再点 docx 预览定位失效。
    const pagedContent = "L1\nL2\nL3\nL4\nL5";
    const pages = [
      { label: "第 1 页", line_start: 1 },
      { label: "第 2 页", line_start: 3 },
      { label: "第 3 页", line_start: 5 },
    ];
    const el = await fixture(html`
      <md-viewer .content=${pagedContent} .pages=${pages}></md-viewer>
    `) as MdViewer;
    await el.updateComplete;

    // 切换到单块渲染（pages 置空 + docx/md 风格 content）
    el.pages = null;
    el.content = "# Heading\n\nparagraph";
    await el.updateComplete;

    const blocks = el.shadowRoot!.querySelectorAll("[data-source-line]");
    expect(blocks.length).toBeGreaterThan(0);
    // # Heading 在第 1 行 → data-source-line 必须是 1，未被分页偏移污染
    const firstDsl = Number(blocks[0].getAttribute("data-source-line"));
    expect(firstDsl).toBe(1);
  });
});
