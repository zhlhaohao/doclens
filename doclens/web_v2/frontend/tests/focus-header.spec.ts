import { describe, it, expect, vi, afterEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { FocusHeader, FocusHeaderAction } from "../src/components/focus-header";
import "../src/components/focus-header";

describe("<focus-header> actions prop", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not render .more-btn when actions is empty", async () => {
    const el = await fixture(html`<focus-header title="t"></focus-header>`) as FocusHeader;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".more-btn")).toBeNull();
  });

  const makeActions = (): FocusHeaderAction[] => [{ label: "A", onClick: () => {} }];

  it("renders .more-btn when actions is non-empty", async () => {
    const el = await fixture(html`
      <focus-header title="t" .actions=${makeActions()}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".more-btn")).toBeTruthy();
  });

  it("clicking .more-btn toggles the dropdown", async () => {
    const el = await fixture(html`
      <focus-header title="t" .actions=${makeActions()}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement;
    btn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeTruthy();
    btn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeNull();
  });

  it("clicking a menu item calls onClick and closes the dropdown", async () => {
    const onClick = vi.fn();
    const el = await fixture(html`
      <focus-header title="t" .actions=${[{ label: "A", icon: "🔧", onClick }]}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement).click();
    await el.updateComplete;
    const item = el.shadowRoot!.querySelector(".menu-item") as HTMLButtonElement;
    item.click();
    await el.updateComplete;
    expect(onClick).toHaveBeenCalledOnce();
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeNull();
  });

  it("clicking outside closes the dropdown", async () => {
    const el = await fixture(html`
      <focus-header title="t" .actions=${makeActions()}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeTruthy();
    // 模拟点击 body 上的其它元素
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeNull();
  });
});
