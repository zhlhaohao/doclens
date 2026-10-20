import { describe, it, expect } from "vitest";
import "../src/components/code-viewer";

/** <code-viewer> 行号视图组件（P1-1 从 preview-pane 拆出）：
 *  行渲染 / 分词着色对齐防御 / 行选择区间合并 / Shift 区间 / 选区事件 /
 *  content 变化自清 / 主题三态表面切换。 */
async function fixture(props: Partial<import("../src/components/code-viewer").CodeViewer> = {}) {
  const el = document.createElement("code-viewer") as import("../src/components/code-viewer").CodeViewer;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function lineEls(el: import("../src/components/code-viewer").CodeViewer) {
  return [...el.shadowRoot!.querySelectorAll(".line")] as HTMLElement[];
}

function lineNo(el: import("../src/components/code-viewer").CodeViewer, n: number) {
  return lineEls(el)[n - 1]?.querySelector(".line-no") as HTMLElement;
}

describe("<code-viewer> 行渲染", () => {
  it("renders every line with 1-indexed line numbers", async () => {
    const el = await fixture({ content: "alpha\nbeta\ngamma" });
    const lines = lineEls(el);
    expect(lines.length).toBe(3);
    expect(lineNo(el, 1).textContent).toBe("1");
    expect(lines[2].textContent).toContain("gamma");
  });

  it("renders empty content as a single empty line (empty-file guard)", async () => {
    const el = await fixture({ content: "" });
    expect(lineEls(el).length).toBe(1);
  });
});

describe("<code-viewer> 分词着色（ADR-0032）", () => {
  it("colors runs per kind when tokens align with content lines", async () => {
    const el = await fixture({
      content: "def f():\n    pass",
      tokens: [
        [["k", "def"], ["", " "], ["f", "f"], ["p", "():"]],
        [["", "    "], ["k", "pass"]],
      ],
    });
    const tk = [...el.shadowRoot!.querySelectorAll('[class^="tk-"]')];
    // 5 run 中 2 个空 kind（正文色）不渲染 span → 4 个着色 span
    expect(tk.length).toBe(4);
    expect(tk[0].className).toBe("tk-k");
    expect(tk[0].textContent).toBe("def");
    expect(tk[1].className).toBe("tk-f");
  });

  it("falls back to plain text when token line count mismatches (defensive)", async () => {
    const el = await fixture({
      content: "a\nb",
      tokens: [[["k", "a"]]], // 1 行 tokens vs 2 行 content → 失配
    });
    expect(el.shadowRoot!.querySelectorAll('[class^="tk-"]').length).toBe(0);
    expect(lineEls(el)[0].textContent).toContain("a");
  });

  it("renders plain text when tokens is null", async () => {
    const el = await fixture({ content: "x\ny", tokens: null });
    expect(el.shadowRoot!.querySelectorAll('[class^="tk-"]').length).toBe(0);
  });
});

describe("<code-viewer> 行选择（2026-10-05 决议）", () => {
  it("toggles selection on line-no click and emits selection-change", async () => {
    const el = await fixture({ content: "a\nb\nc\nd" });
    const events: string[] = [];
    el.addEventListener("selection-change", (e: Event) =>
      events.push((e as CustomEvent<{ ranges: string }>).detail.ranges));
    lineNo(el, 2).click();
    await el.updateComplete;
    expect(el.lineRanges()).toBe("2");
    expect(events.at(-1)).toBe("2");
    expect(lineEls(el)[1].classList.contains("line-selected")).toBe(true);
    // 再点反选
    lineNo(el, 2).click();
    await el.updateComplete;
    expect(el.lineRanges()).toBe("");
    expect(events.at(-1)).toBe("");
  });

  it("shift+click selects the range from anchor and merges into 'a-b' string", async () => {
    const el = await fixture({ content: Array.from({ length: 10 }, (_, i) => `l${i + 1}`).join("\n") });
    lineNo(el, 2).click();
    await el.updateComplete;
    lineNo(el, 5).dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    await el.updateComplete;
    expect(el.lineRanges()).toBe("2-5");
    // 多段合并：再选 8、9 → "2-5,8-9"
    lineNo(el, 8).click();
    await el.updateComplete;
    lineNo(el, 9).dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    await el.updateComplete;
    expect(el.lineRanges()).toBe("2-5,8-9");
  });

  it("clearSelection() clears and emits; shows/hides the clear button", async () => {
    const el = await fixture({ content: "a\nb" });
    lineNo(el, 1).click();
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector(".line-clear-btn") as HTMLElement;
    expect(btn?.textContent).toContain("清除选中（1）");
    el.clearSelection();
    await el.updateComplete;
    expect(el.lineRanges()).toBe("");
    expect(el.shadowRoot!.querySelector(".line-clear-btn")).toBeNull();
  });

  it("auto-clears selection when content changes (stale line numbers)", async () => {
    const el = await fixture({ content: "a\nb\nc" });
    lineNo(el, 3).click();
    await el.updateComplete;
    expect(el.lineRanges()).toBe("3");
    el.content = "new";
    await el.updateComplete;
    expect(el.lineRanges()).toBe("");
  });
});

describe("<code-viewer> 主题三态（ADR-0036/0043）", () => {
  it("light/dark themes toggle .body.dark surface class", async () => {
    const el = await fixture({ content: "x", theme: "dark" });
    const body = el.shadowRoot!.querySelector(".body") as HTMLElement;
    expect(body.classList.contains("dark")).toBe(true);
    el.theme = "light";
    await el.updateComplete;
    expect(body.classList.contains("dark")).toBe(false);
  });
});
