import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "../src/components/file-search-box";

describe("file-search-box", () => {
  let el: any;

  beforeEach(async () => {
    el = document.createElement("file-search-box");
    document.body.appendChild(el);
    await el.updateComplete;
  });
  afterEach(() => {
    document.body.removeChild(el);
  });

  it("renders an input with placeholder", () => {
    const input = el.shadowRoot.querySelector("input");
    expect(input).toBeTruthy();
    expect(input.placeholder).toContain("文件名");
  });

  it("emits 'search' after debounce when typing", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    el.addEventListener("search", (e: CustomEvent) => events.push(e.detail.query));
    const input = el.shadowRoot.querySelector("input");
    input.value = "read";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    // 还没触发（防抖中）
    expect(events).toEqual([]);
    vi.advanceTimersByTime(80);
    expect(events).toEqual(["read"]);
    vi.useRealTimers();
  });

  it("does not emit during IME composition", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    el.addEventListener("search", (e: CustomEvent) => events.push(e.detail.query));
    const input = el.shadowRoot.querySelector("input");
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    input.value = "zhong";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(80);
    expect(events).toEqual([]);
    // compositionend 后再触发一次
    input.dispatchEvent(new CompositionEvent("compositionend"));
    vi.advanceTimersByTime(80);
    expect(events.length).toBeGreaterThanOrEqual(1);
    vi.useRealTimers();
  });

  it("emits 'clear' on Esc keydown and empties input", async () => {
    let cleared = false;
    el.addEventListener("clear", () => { cleared = true; });
    const input = el.shadowRoot.querySelector("input");
    input.value = "abc";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await el.updateComplete;
    expect(cleared).toBe(true);
    expect(input.value).toBe("");
  });

  it("emits 'clear' on × button click", async () => {
    let cleared = false;
    el.addEventListener("clear", () => { cleared = true; });
    const input = el.shadowRoot.querySelector("input");
    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    const btn = el.shadowRoot.querySelector("button.clear") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    await el.updateComplete;
    expect(cleared).toBe(true);
    expect(input.value).toBe("");
  });

  it("does not show × when input empty", () => {
    const btn = el.shadowRoot.querySelector("button.clear");
    expect(btn).toBeNull();
  });

  it("disabled=true makes input.disabled true", async () => {
    el.disabled = true;
    await el.updateComplete;
    const input = el.shadowRoot.querySelector("input");
    expect(input.disabled).toBe(true);
  });

  it("accepts custom placeholder", async () => {
    el.placeholder = "文档列表加载失败";
    await el.updateComplete;
    const input = el.shadowRoot.querySelector("input");
    expect(input.placeholder).toBe("文档列表加载失败");
  });
});
