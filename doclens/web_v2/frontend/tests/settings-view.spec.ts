import { describe, it, expect, beforeEach, vi } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/views/settings-view";
import type { SettingsView } from "../src/views/settings-view";

// Mock the API client so tests don't hit network.
// 搜索/AI 字段已移除（由预设区块接管），设置页只剩 network 字段；mock 用 WEB_PORT
// 作为可调字段（非默认值让 reset 按钮启用）。
vi.mock("../src/api/config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    scope: "global",
    values: { CORTEX_WEB_PORT: "8888" },
    exists: true,
  }),
  putConfig: vi.fn().mockResolvedValue({
    ok: true,
    saved_path: "/tmp/.env",
    needs_restart: false,
    restart_fields: [],
  }),
  resetConfigDefault: vi.fn().mockResolvedValue({
    scope: "global",
    values: {
      CORTEX_WEB_HOST: "127.0.0.1",
      CORTEX_WEB_PORT: "7860",
      CORTEX_MCP_ENABLED: "false",
      CORTEX_MCP_HOST: "127.0.0.1",
      CORTEX_MCP_PORT: "7880",
      CORTEX_SYNC_ENABLED: "true",
    },
    exists: true,
  }),
  ConfigApiError: class ConfigApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      super(`Config API error ${status}`);
      this.status = status;
      this.body = body;
    }
  },
}));

describe("<settings-view>", () => {
  let el: SettingsView;
  beforeEach(async () => {
    el = await fixture<SettingsView>(html`<settings-view></settings-view>`);
    // Wait for connectedCallback + initial API call
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0));
  });

  it("renders 3 tab buttons in order: AI / 搜索调优 / 网络监听", () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    expect(tabs?.length).toBe(3);
    expect(tabs?.[0].textContent?.trim()).toBe("AI 配置");
    expect(tabs?.[1].textContent?.trim()).toBe("搜索调优");
    expect(tabs?.[2].textContent?.trim()).toBe("网络监听");
  });

  it("AI tab is active by default", () => {
    const active = el.shadowRoot?.querySelector(".tab-strip button.active");
    expect(active?.textContent?.trim()).toBe("AI 配置");
  });

  it("clicking 网络监听 tab switches active panel", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[2] as HTMLButtonElement).click();
    await elementUpdated(el);
    const activePanel = el.shadowRoot?.querySelector(".tab-panel.active");
    expect(activePanel?.getAttribute("data-panel")).toBe("network");
  });

  it("renders 0 .field for AI tab (模型配置由预设区块接管)", () => {
    const aiPanel = el.shadowRoot?.querySelector('.tab-panel[data-panel="ai"]');
    const fields = aiPanel?.querySelectorAll(".field");
    expect(fields?.length).toBe(0);
  });

  it("renders 0 .field for search tab (搜索参数由预设区块接管)", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[1] as HTMLButtonElement).click();
    await elementUpdated(el);
    const panel = el.shadowRoot?.querySelector('.tab-panel[data-panel="search"]');
    expect(panel?.querySelectorAll(".field").length).toBe(0);
  });

  it("footer 恢复默认调 reset-default，字段刷成默认值（network tab）", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[2] as HTMLButtonElement).click(); // network tab
    await elementUpdated(el);
    const btn = el.shadowRoot?.querySelector(".footer-bar .reset-all") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    // mock 里 CORTEX_WEB_PORT=8888 非默认 → 按钮可用
    expect(btn.disabled).toBe(false);

    btn.click();
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0)); // 等 async resetConfigDefault 完成
    const numInput = el.shadowRoot?.querySelector(
      'input[data-env="CORTEX_WEB_PORT"]'
    ) as HTMLInputElement;
    expect(numInput.value).toBe("7860");
    // 全部回到默认 → 按钮禁用（_allAtDefault=true）
    expect(btn.disabled).toBe(true);
  });

  it("updates a field value via input event and marks dirty", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[2] as HTMLButtonElement).click(); // network tab
    await elementUpdated(el);
    const input = el.shadowRoot?.querySelector(
      'input[data-env="CORTEX_WEB_PORT"]'
    ) as HTMLInputElement;
    input.value = "9999";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await elementUpdated(el);

    const dirty = el.shadowRoot?.querySelector(".dirty-status");
    expect(dirty?.textContent).toContain("已修改");
  });

  it("footer save button text reflects scope (全局)", () => {
    const saveBtn = el.shadowRoot?.querySelector(".footer-bar .btn.primary") as HTMLButtonElement;
    expect(saveBtn.textContent).toContain("保存全局配置");
  });

  it("clicking save calls putConfig with current values", async () => {
    const { putConfig } = await import("../src/api/config");
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[2] as HTMLButtonElement).click(); // network tab
    await elementUpdated(el);
    const input = el.shadowRoot?.querySelector(
      'input[data-env="CORTEX_WEB_PORT"]'
    ) as HTMLInputElement;
    input.value = "9999";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await elementUpdated(el);

    const saveBtn = el.shadowRoot?.querySelector(".footer-bar .btn.primary") as HTMLButtonElement;
    saveBtn.click();
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0));
    expect(putConfig).toHaveBeenCalled();
  });

  it("tab-strip lives inside .sidebar (F1 desktop layout structure)", () => {
    const sidebar = el.shadowRoot?.querySelector(".sidebar");
    expect(sidebar, ".sidebar must exist").toBeTruthy();
    expect(
      sidebar?.querySelector(".tab-strip"),
      ".tab-strip must be inside .sidebar (vertical tab list on desktop)"
    ).toBeTruthy();
  });

  it(".layout wraps .sidebar and .main; .footer-bar lives in .main", () => {
    const layout = el.shadowRoot?.querySelector(".layout");
    expect(layout, ".layout must exist").toBeTruthy();
    expect(layout?.querySelector(".sidebar")).toBeTruthy();
    const main = layout?.querySelector(".main");
    expect(main, ".main must exist").toBeTruthy();
    expect(
      main?.querySelector(".footer-bar"),
      ".footer-bar must be inside .main so it aligns with panel, not full-width"
    ).toBeTruthy();
    expect(main?.querySelector(".scroll-area .tab-panel")).toBeTruthy();
  });
});
