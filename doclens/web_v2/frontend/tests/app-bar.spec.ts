import { describe, it, expect, beforeEach } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/components/app-bar";
import type { AppBar } from "../src/components/app-bar";
import { actions } from "../src/state/store";

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

describe("<app-bar> save button + revert", () => {
  it("does NOT show save button when not in settings view", async () => {
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".save-btn")).toBeNull();
  });

  it("does NOT show save button when in settings view but not dirty", async () => {
    actions.setView("settings");
    actions.loadSettings({}, true);
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"settings"}></app-bar>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".save-btn")).toBeNull();
  });

  it("shows save button when in settings view AND dirty", async () => {
    actions.setView("settings");
    actions.updateSetting("FOO", "bar");
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"settings"}></app-bar>`);
    await elementUpdated(el);
    const btn = el.shadowRoot?.querySelector(".save-btn") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain("保存");
  });

  it("clicking save button dispatches cortex:save-settings on window", async () => {
    actions.setView("settings");
    actions.updateSetting("FOO", "bar");
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"settings"}></app-bar>`);
    await elementUpdated(el);

    let captured = false;
    const handler = () => { captured = true; };
    window.addEventListener("cortex:save-settings", handler);
    (el.shadowRoot?.querySelector(".save-btn") as HTMLButtonElement).click();
    await elementUpdated(el);
    window.removeEventListener("cortex:save-settings", handler);

    expect(captured).toBe(true);
  });

  it("shows revert menu item when in settings view AND dirty", async () => {
    actions.setView("settings");
    actions.updateSetting("FOO", "bar");
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"settings"}></app-bar>`);
    await elementUpdated(el);

    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);

    const items = el.shadowRoot?.querySelectorAll(".menu-item");
    const labels = Array.from(items ?? []).map((i) => i.textContent ?? "");
    expect(labels.some((l) => l.includes("放弃修改"))).toBe(true);
  });

  it("clicking revert menu item dispatches cortex:revert-settings on window", async () => {
    actions.setView("settings");
    actions.updateSetting("FOO", "bar");
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"settings"}></app-bar>`);
    await elementUpdated(el);

    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);

    const revertBtn = Array.from(el.shadowRoot?.querySelectorAll(".menu-item") ?? [])
      .find((b) => (b.textContent ?? "").includes("放弃修改")) as HTMLButtonElement;
    expect(revertBtn).toBeTruthy();

    let captured = false;
    const handler = () => { captured = true; };
    window.addEventListener("cortex:revert-settings", handler);
    revertBtn.click();
    await elementUpdated(el);
    window.removeEventListener("cortex:revert-settings", handler);

    expect(captured).toBe(true);
  });
});
