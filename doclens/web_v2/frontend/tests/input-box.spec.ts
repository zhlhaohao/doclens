import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/input-box";
import { InputBox } from "../src/components/input-box";
import type { SearchMode } from "../src/state/types";

describe("<input-box>", () => {
  it("renders placeholder and emits submit on button click", async () => {
    const el = await fixture(html`<input-box placeholder="hi" button-label="go"></input-box>`);
    const input = el.shadowRoot!.querySelector("input")!;
    input.value = "hello";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    let submitted = "";
    el.addEventListener("submit", (e: any) => (submitted = e.detail.value));

    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    btn.click();

    expect(submitted).toBe("hello");
  });

  it("disables button when value is empty", async () => {
    const el = await fixture(html`<input-box placeholder="hi" button-label="go"></input-box>`);
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
    expect(btn.disabled).toBe(true);
  });

  it("submits on Ctrl/Cmd+Enter", async () => {
    const el = await fixture(html`<input-box placeholder="hi" button-label="go"></input-box>`);
    const input = el.shadowRoot!.querySelector("input")!;
    input.value = "x";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    let submitted = "";
    el.addEventListener("submit", (e: any) => (submitted = e.detail.value));

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
    expect(submitted).toBe("x");
  });
});

const MODES: Record<SearchMode, { label: string; icon: string }> = {
  keyword: { label: "关键词", icon: "🔍" },
  grep: { label: "Grep", icon: "</>" },
};

describe("<input-box> mode split-button", () => {
  it("renders split caret only when modes provided", async () => {
    const el = await fixture(html`<input-box .mode=${"keyword" as SearchMode} .modes=${MODES}></input-box>`) as InputBox;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".caret")).toBeTruthy();
  });

  it("does not render caret when modes omitted (legacy)", async () => {
    const el = await fixture(html`<input-box button-label="go"></input-box>`) as InputBox;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".caret")).toBeNull();
    // 主体按钮仍存在
    expect(el.shadowRoot!.querySelector("button")).toBeTruthy();
  });

  it("clicking caret opens menu; selecting grep emits mode-change", async () => {
    const el = await fixture(html`<input-box .mode=${"keyword" as SearchMode} .modes=${MODES}></input-box>`) as InputBox;
    await el.updateComplete;
    const caret = el.shadowRoot!.querySelector<HTMLButtonElement>(".caret")!;
    caret.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu")).toBeTruthy();

    let emitted: string | null = null;
    el.addEventListener("mode-change", (e: any) => (emitted = e.detail.mode));

    const items = el.shadowRoot!.querySelectorAll<HTMLElement>(".menu-item");
    items[1].click();
    await el.updateComplete;
    expect(emitted).toBe("grep");
    expect(el.shadowRoot!.querySelector(".menu")).toBeNull();
  });

  it("clicking primary body still emits submit", async () => {
    const el = await fixture(html`<input-box .mode=${"keyword" as SearchMode} .modes=${MODES}></input-box>`) as InputBox;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("input")!;
    input.value = "x";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    let submitted = "";
    el.addEventListener("submit", (e: any) => (submitted = e.detail.value));
    el.shadowRoot!.querySelector<HTMLButtonElement>("button.primary")!.click();
    expect(submitted).toBe("x");
  });
});
