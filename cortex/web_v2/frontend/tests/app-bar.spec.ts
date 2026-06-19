import { describe, it, expect, beforeEach } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/components/app-bar";
import type { AppBar } from "../src/components/app-bar";

describe("<app-bar>", () => {
  let el: AppBar;
  beforeEach(async () => {
    el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
  });

  it("renders brand logo and name", () => {
    expect(el.shadowRoot?.textContent).toContain("Cortex");
  });

  it("dropdown is closed initially", () => {
    const menu = el.shadowRoot?.querySelector(".user-menu");
    expect(menu?.classList.contains("open")).toBe(false);
  });

  it("clicking avatar toggles dropdown open", async () => {
    const btn = el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);
    const menu = el.shadowRoot?.querySelector(".user-menu");
    expect(menu?.classList.contains("open")).toBe(true);
  });

  it("clicking 本地配置 menu item dispatches navigate event with settings+local", async () => {
    const btn = el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);

    const events: CustomEvent[] = [];
    el.addEventListener("navigate", (e: Event) => events.push(e as CustomEvent));

    const items = el.shadowRoot?.querySelectorAll(".menu-item");
    // First item is 本地配置
    (items?.[0] as HTMLButtonElement).click();
    await elementUpdated(el);

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ view: "settings", scope: "local" });
  });

  it("clicking 全局配置 menu item dispatches navigate with settings+global", async () => {
    const btn = el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);

    const events: CustomEvent[] = [];
    el.addEventListener("navigate", (e: Event) => events.push(e as CustomEvent));

    const items = el.shadowRoot?.querySelectorAll(".menu-item");
    (items?.[1] as HTMLButtonElement).click();
    await elementUpdated(el);

    expect(events[0].detail).toEqual({ view: "settings", scope: "global" });
  });

  it("clicking outside closes the dropdown", async () => {
    const btn = el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".user-menu")?.classList.contains("open")).toBe(true);

    document.body.click();
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".user-menu")?.classList.contains("open")).toBe(false);
  });
});
