import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/file-card";
import type { FileGroup } from "../src/state/types";

const contentGroup: FileGroup = {
  path: "科技/AI/report.md",
  best_score: 0.9,
  total_matches: 2,
  kind: "content",
  truncated: false,
  matches: [
    { line: 11, text: "深度学习在医疗领域", spans: [[0, 4]] },
    { line: 42, text: "基于深度学习的影像识别", spans: [[2, 6]] },
  ],
};

describe("<file-card>", () => {
  it("header shows file name + count, not expanded by default", async () => {
    const el = await fixture(html`<file-card .group=${contentGroup}></file-card>`);
    await (el as any).updateComplete;
    const text = el.shadowRoot!.textContent!;
    expect(text).toContain("report.md");
    expect(text).toContain("2");
    expect(text).not.toContain("处命中");  // 极简徽标：纯数字
    // collapsed: rows hidden
    expect(el.shadowRoot!.querySelector(".rows")).toBeNull();
  });

  it("expands on header click, shows match rows with line numbers", async () => {
    const el = await fixture(html`<file-card .group=${contentGroup}></file-card>`);
    const header = el.shadowRoot!.querySelector(".header") as HTMLElement;
    header.click();
    await (el as any).updateComplete;
    const rows = el.shadowRoot!.querySelectorAll(".row");
    expect(rows.length).toBe(2);
    expect(el.shadowRoot!.textContent).toContain("11");
    expect(el.shadowRoot!.textContent).toContain("42");
  });

  it("marks hit spans inside row text", async () => {
    const el = await fixture(html`<file-card .group=${contentGroup} expanded></file-card>`);
    await (el as any).updateComplete;
    const marks = el.shadowRoot!.querySelectorAll("mark");
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe("深度学习");
  });

  it("emits hit-select with path+line on row click", async () => {
    const el = await fixture(html`<file-card .group=${contentGroup} expanded></file-card>`);
    await (el as any).updateComplete;
    let detail: any = null;
    el.addEventListener("hit-select", (e: Event) => {
      detail = (e as CustomEvent).detail;
    });
    const row = el.shadowRoot!.querySelectorAll(".row")[1] as HTMLElement;
    row.click();
    expect(detail).toEqual({ hit: { path: "科技/AI/report.md", line: 42, hl: "深度学习" } });
  });

  it("emits hit-select without hl when row has no spans", async () => {
    const g: FileGroup = {
      ...contentGroup,
      matches: [{ line: 7, text: "no span row", spans: [] }],
    };
    const el = await fixture(html`<file-card .group=${g} expanded></file-card>`);
    await (el as any).updateComplete;
    let detail: any = null;
    el.addEventListener("hit-select", (e: Event) => { detail = (e as CustomEvent).detail; });
    (el.shadowRoot!.querySelector(".row") as HTMLElement).click();
    expect(detail.hit.hl).toBeUndefined();
  });

  it("path group: shows 路径 prefix, no count badge", async () => {
    const g: FileGroup = {
      path: "notes/todo.txt", best_score: 0, total_matches: 0, kind: "path",
      matches: [], truncated: false,
    };
    const el = await fixture(html`<file-card .group=${g} expanded></file-card>`);
    await (el as any).updateComplete;
    expect(el.shadowRoot!.querySelector(".name")!.textContent).toContain("路径");
    expect(el.shadowRoot!.querySelector(".badge")).toBeNull();
  });

  it("LIKE row (line=null) shows — in line-no column", async () => {
    const g: FileGroup = {
      path: "a.md", best_score: 0.5, total_matches: 1, kind: "content", truncated: false,
      matches: [{ line: null, text: "命中词...", spans: [] }],
    };
    const el = await fixture(html`<file-card .group=${g} expanded></file-card>`);
    await (el as any).updateComplete;
    expect(el.shadowRoot!.querySelector(".line-no")!.textContent).toBe("—");
  });

  it("expanded shows ALL matches (no fold)", async () => {
    const many: FileGroup = {
      path: "big.md", best_score: 1, total_matches: 8, kind: "content", truncated: false,
      matches: Array.from({ length: 8 }, (_, i) => ({ line: i + 1, text: `row ${i}`, spans: [] })),
    };
    const el = await fixture(html`<file-card .group=${many} expanded></file-card>`);
    await (el as any).updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".row").length).toBe(8);
    expect(el.shadowRoot!.textContent).not.toContain("更多命中");
  });

  it("truncated group notes the cap", async () => {
    const g: FileGroup = { ...contentGroup, truncated: true, total_matches: 99 };
    const el = await fixture(html`<file-card .group=${g} expanded></file-card>`);
    await (el as any).updateComplete;
    expect(el.shadowRoot!.querySelector(".cap-note")).toBeTruthy();
  });

  it("windows backslash path shows bare file name (dir in tooltip)", async () => {
    const g: FileGroup = { ...contentGroup, path: "C:\\Users\\me\\docs\\report.md" };
    const el = await fixture(html`<file-card .group=${g}></file-card>`);
    await (el as any).updateComplete;
    expect(el.shadowRoot!.querySelector(".name")!.textContent!.trim()).toBe("report.md");
    expect((el.shadowRoot!.querySelector(".header") as HTMLElement).getAttribute("title"))
      .toBe("C:\\Users\\me\\docs\\report.md");
  });
});
