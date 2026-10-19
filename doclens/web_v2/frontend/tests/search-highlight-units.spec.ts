import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/file-card";
import type { FileGroup } from "../src/state/types";

import { normalizeHighlightKeyword } from "../src/components/preview-pane";
import { buildMatchLines } from "../src/components/md-viewer";

// ---------------------------------------------------------------------------
// 高亮输入条关键词归一化（preview-pane normalizeHighlightKeyword）
// ---------------------------------------------------------------------------
describe("normalizeHighlightKeyword", () => {
  it("CJK 输入去空格整串匹配", () => {
    expect(normalizeHighlightKeyword("松平 广忠")).toBe("松平广忠");
    expect(normalizeHighlightKeyword("麒麟 计划")).toBe("麒麟计划");
  });

  it("纯 ASCII 原样返回（保留多词语义）", () => {
    expect(normalizeHighlightKeyword("kirin scale")).toBe("kirin scale");
  });

  it("混合 CJK+ASCII 也按 CJK 整串处理", () => {
    expect(normalizeHighlightKeyword("麒麟 kirin")).toBe("麒麟kirin");
  });

  it("空串安全", () => {
    expect(normalizeHighlightKeyword("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 匹配导航源文本口径（buildMatchLines）
// ---------------------------------------------------------------------------
describe("buildMatchLines（源文本匹配索引）", () => {
  it("多词 OR：任一词命中的行都进索引", () => {
    const content = "kirin alpha\nno hit here\n麒麟 beta\nKirin UPPER\ntail";
    expect(buildMatchLines(content, "kirin 麒麟")).toEqual([1, 3, 4]);
  });

  it("正则元字符不炸（字面转义）", () => {
    const content = "f(a+b) called\nplain line";
    expect(buildMatchLines(content, "(a+b)")).toEqual([1]);
  });

  it("CJK 整串无空格命中", () => {
    const content = "前文\n麒麟计划总览\n后文";
    expect(buildMatchLines(content, "麒麟计划")).toEqual([2]);
  });

  it("空 keyword 返回空数组", () => {
    expect(buildMatchLines("any", "")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// file-card spans 渲染边界
// ---------------------------------------------------------------------------
const multiSpanGroup: FileGroup = {
  path: "语料/杂记.md",
  best_score: 0.5,
  total_matches: 1,
  kind: "content",
  truncated: false,
  matches: [
    { line: 12, text: "麒麟与 kirin 同现一行", spans: [[0, 2], [4, 9]] },
  ],
};

const likeGroup: FileGroup = {
  path: "语料/旧文.md",
  best_score: 0.5,
  total_matches: 1,
  kind: "content",
  truncated: false,
  matches: [
    { line: null, text: "LIKE 降级行无 spans 高亮", spans: [] },
  ],
};

describe("<file-card> 高亮边界", () => {
  it("一行多 span 渲染多个 mark", async () => {
    const el = await fixture(html`<file-card .group=${multiSpanGroup} expanded></file-card>`);
    await (el as any).updateComplete;
    const marks = el.shadowRoot!.querySelectorAll("mark");
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe("麒麟");
    expect(marks[1].textContent).toBe("kirin");
  });

  it("LIKE 行无 spans：纯文本无 mark、行号显示 —", async () => {
    const el = await fixture(html`<file-card .group=${likeGroup} expanded></file-card>`);
    await (el as any).updateComplete;
    expect(el.shadowRoot!.querySelectorAll("mark").length).toBe(0);
    expect(el.shadowRoot!.textContent).toContain("—");
  });

  it("点击 LIKE 行（无 spans）hit-select 不带 hl", async () => {
    const el = await fixture(html`<file-card .group=${likeGroup} expanded></file-card>`);
    await (el as any).updateComplete;
    let detail: any = null;
    el.addEventListener("hit-select", (e: Event) => {
      detail = (e as CustomEvent).detail;
    });
    const row = el.shadowRoot!.querySelector(".row") as HTMLElement;
    row.click();
    expect(detail.hit.hl).toBeUndefined();
    expect(detail.hit.line).toBeNull();
  });

  it("点击多 span 行：hl 为全部 span 字面拼接", async () => {
    const el = await fixture(html`<file-card .group=${multiSpanGroup} expanded></file-card>`);
    await (el as any).updateComplete;
    let detail: any = null;
    el.addEventListener("hit-select", (e: Event) => {
      detail = (e as CustomEvent).detail;
    });
    const row = el.shadowRoot!.querySelector(".row") as HTMLElement;
    row.click();
    expect(detail.hit.hl).toBe("麒麟 kirin");
  });
});
