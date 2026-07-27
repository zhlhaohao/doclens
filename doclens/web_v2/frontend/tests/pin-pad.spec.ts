import { describe, it, expect } from "vitest";
import { fixture, html, elementUpdated, oneEvent } from "@open-wc/testing";

import "../src/components/pin-pad";
import type { PinPad } from "../src/components/pin-pad";

async function mount(): Promise<PinPad> {
  const el = await fixture<PinPad>(html`<pin-pad></pin-pad>`);
  await elementUpdated(el);
  return el;
}

function key(el: PinPad, k: string): HTMLButtonElement {
  const btn = el.shadowRoot?.querySelector(`button[data-key="${k}"]`);
  if (!btn) throw new Error(`key ${k} not found`);
  return btn as HTMLButtonElement;
}

describe("<pin-pad>", () => {
  it("renders 12 keys: 0-9 + backspace + submit", async () => {
    const el = await mount();
    const keys = el.shadowRoot?.querySelectorAll("button");
    expect(keys?.length).toBe(12);
  });

  it("emits digit events with the pressed key", async () => {
    const el = await mount();
    const got: string[] = [];
    el.addEventListener("digit", (e) => got.push((e as CustomEvent<string>).detail));
    key(el, "1").click();
    key(el, "9").click();
    key(el, "0").click();
    expect(got).toEqual(["1", "9", "0"]);
  });

  it("emits backspace event", async () => {
    const el = await mount();
    setTimeout(() => key(el, "backspace").click());
    const ev = await oneEvent(el, "backspace");
    expect(ev).toBeTruthy();
  });

  it("emits submit event", async () => {
    const el = await mount();
    setTimeout(() => key(el, "submit").click());
    const ev = await oneEvent(el, "submit");
    expect(ev).toBeTruthy();
  });
});
