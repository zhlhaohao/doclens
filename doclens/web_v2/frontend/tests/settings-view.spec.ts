import { describe, it, expect, beforeEach, vi } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/views/settings-view";
import type { SettingsView } from "../src/views/settings-view";

// Mock the API client so tests don't hit network
vi.mock("../src/api/config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    scope: "local",
    values: { CORTEX_MAX_RESULTS: "42" },
    exists: true,
  }),
  putConfig: vi.fn().mockResolvedValue({
    ok: true,
    saved_path: "/tmp/.env",
    needs_restart: false,
    restart_fields: [],
  }),
}));

describe("<settings-view>", () => {
  let el: SettingsView;
  beforeEach(async () => {
    el = await fixture<SettingsView>(html`<settings-view></settings-view>`);
    // Wait for connectedCallback + initial API call
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0));
  });

  it("renders 4 tab buttons in order: AI / 搜索调优 / 评分 / 终端", () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    expect(tabs?.length).toBe(4);
    expect(tabs?.[0].textContent?.trim()).toBe("AI 配置");
    expect(tabs?.[1].textContent?.trim()).toBe("搜索调优");
    expect(tabs?.[2].textContent?.trim()).toBe("评分");
    expect(tabs?.[3].textContent?.trim()).toBe("终端");
  });

  it("AI tab is active by default", () => {
    const active = el.shadowRoot?.querySelector(".tab-strip button.active");
    expect(active?.textContent?.trim()).toBe("AI 配置");
  });

  it("clicking 评分 tab switches active panel", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[2] as HTMLButtonElement).click();
    await elementUpdated(el);
    const activePanel = el.shadowRoot?.querySelector(".tab-panel.active");
    expect(activePanel?.getAttribute("data-panel")).toBe("scoring");
  });

  it("renders all 3 fields for AI tab", () => {
    const aiPanel = el.shadowRoot?.querySelector('.tab-panel[data-panel="ai"]');
    const fields = aiPanel?.querySelectorAll(".field");
    expect(fields?.length).toBe(3);
  });

  it("renders all 7 fields for search tab", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[1] as HTMLButtonElement).click();
    await elementUpdated(el);
    const panel = el.shadowRoot?.querySelector('.tab-panel[data-panel="search"]');
    expect(panel?.querySelectorAll(".field").length).toBe(7);
  });

  it("updates a field value via input event and marks dirty", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[1] as HTMLButtonElement).click();  // search tab
    await elementUpdated(el);
    const input = el.shadowRoot?.querySelector(
      'input[data-env="CORTEX_MAX_RESULTS"]'
    ) as HTMLInputElement;
    input.value = "99";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await elementUpdated(el);

    const dirty = el.shadowRoot?.querySelector(".dirty-status");
    expect(dirty?.textContent).toContain("已修改");
  });

  it("footer save button text reflects scope (本地)", () => {
    const saveBtn = el.shadowRoot?.querySelector(".footer-bar .btn.primary") as HTMLButtonElement;
    expect(saveBtn.textContent).toContain("保存本地配置");
  });

  it("clicking save calls putConfig with current values", async () => {
    const { putConfig } = await import("../src/api/config");
    // Make a field dirty so the save button is enabled and _save() proceeds
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[1] as HTMLButtonElement).click(); // search tab
    await elementUpdated(el);
    const input = el.shadowRoot?.querySelector(
      'input[data-env="CORTEX_MAX_RESULTS"]'
    ) as HTMLInputElement;
    input.value = "99";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await elementUpdated(el);

    const saveBtn = el.shadowRoot?.querySelector(".footer-bar .btn.primary") as HTMLButtonElement;
    saveBtn.click();
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0));
    expect(putConfig).toHaveBeenCalled();
  });

  it("scope-segment and tab-strip live inside .scroll-area (template structure)", () => {
    const scrollArea = el.shadowRoot?.querySelector(".scroll-area");
    expect(scrollArea, ".scroll-area must exist").toBeTruthy();
    const scopeInScroll = scrollArea?.querySelector("settings-scope-segment");
    const tabsInScroll = scrollArea?.querySelector(".tab-strip");
    expect(
      scopeInScroll,
      "settings-scope-segment must be inside .scroll-area so position:sticky works"
    ).toBeTruthy();
    expect(
      tabsInScroll,
      ".tab-strip must be inside .scroll-area so it scrolls with the content"
    ).toBeTruthy();
  });
});
