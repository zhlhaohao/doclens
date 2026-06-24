import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/input-box";

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
