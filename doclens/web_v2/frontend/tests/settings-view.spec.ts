import { describe, it, expect, beforeEach, vi } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/views/settings-view";
import type { SettingsView } from "../src/views/settings-view";

// Mock the API client so tests don't hit network
vi.mock("../src/api/config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    scope: "global",
    values: { CORTEX_MAX_RESULTS: "42" },
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
      PLANIFY_PROVIDER: "minimax",
      PLANIFY_PROTOCOL: "openai_compat",
      PLANIFY_BASE_URL: "",
      PLANIFY_API_KEY: "",
      PLANIFY_MODEL_ID: "",
      CORTEX_MAX_RESULTS: "50",
      CORTEX_MIN_SCORE_THRESHOLD: "0.3",
      CORTEX_MAX_SPAN: "50",
      CORTEX_WEIGHT_KEYWORD_MATCH: "4.0",
      CORTEX_WEIGHT_FILE_NAME_MATCH: "2.0",
      CORTEX_WEIGHT_FTS_SCORE: "1.0",
      CORTEX_WEIGHT_TITLE_MATCH: "2.0",
      CORTEX_WEIGHT_PROXIMITY_MATCH: "1.0",
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

  it("renders 2 tab buttons in order: AI / 搜索调优", () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    expect(tabs?.length).toBe(2);
    expect(tabs?.[0].textContent?.trim()).toBe("AI 配置");
    expect(tabs?.[1].textContent?.trim()).toBe("搜索调优");
  });

  it("AI tab is active by default", () => {
    const active = el.shadowRoot?.querySelector(".tab-strip button.active");
    expect(active?.textContent?.trim()).toBe("AI 配置");
  });

  it("clicking 搜索调优 tab switches active panel", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[1] as HTMLButtonElement).click();
    await elementUpdated(el);
    const activePanel = el.shadowRoot?.querySelector(".tab-panel.active");
    expect(activePanel?.getAttribute("data-panel")).toBe("search");
  });

  it("renders all 5 fields for AI tab", () => {
    const aiPanel = el.shadowRoot?.querySelector('.tab-panel[data-panel="ai"]');
    const fields = aiPanel?.querySelectorAll(".field");
    expect(fields?.length).toBe(5);
  });

  it("renders all 8 fields for search tab (含并入的评分权重)", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[1] as HTMLButtonElement).click();
    await elementUpdated(el);
    const panel = el.shadowRoot?.querySelector('.tab-panel[data-panel="search"]');
    expect(panel?.querySelectorAll(".field").length).toBe(3);
    expect(panel?.querySelectorAll(".weights-grid .w-item").length).toBe(5);
  });

  it("权重区渲染为 weights-grid 网格", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[1] as HTMLButtonElement).click();
    await elementUpdated(el);
    const grid = el.shadowRoot?.querySelector(".weights-grid");
    expect(grid).toBeTruthy();
    expect(grid?.querySelectorAll(".w-item").length).toBe(5);
    expect(grid?.querySelectorAll('input[type="range"]').length).toBe(5);
  });

  it("search tab 字段渲染常驻描述行（含取值范围）", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[1] as HTMLButtonElement).click();
    await elementUpdated(el);
    const panel = el.shadowRoot?.querySelector('.tab-panel[data-panel="search"]');
    const descs = Array.from(panel?.querySelectorAll(".desc") ?? []);
    expect(descs.length).toBe(8);  // 3 普通过滤字段 + 5 权重
    expect(descs[0].textContent).toContain("· 1–200");
    expect(panel?.querySelector(".w-item .desc")?.textContent).toContain("· 0–10");
  });

  it("footer 恢复默认调 reset-default 端点，字段刷成模板默认值（直接持久化、不标 dirty）", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[1] as HTMLButtonElement).click();
    await elementUpdated(el);
    const btn = el.shadowRoot?.querySelector(".footer-bar .reset-all") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    // mock 里 CORTEX_MAX_RESULTS=42 非默认 → 按钮可用
    expect(btn.disabled).toBe(false);

    btn.click();
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0)); // 等 async resetConfigDefault 完成
    // 重置为模板默认值（显式 50，非空串；后端已写盘，前端只是回显）
    const numInput = el.shadowRoot?.querySelector(
      'input[data-env="CORTEX_MAX_RESULTS"]'
    ) as HTMLInputElement;
    expect(numInput.value).toBe("50");
    // 全部回到默认 → 按钮禁用（_allAtDefault=true）
    expect(btn.disabled).toBe(true);
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

  it("footer save button text reflects scope (全局)", () => {
    const saveBtn = el.shadowRoot?.querySelector(".footer-bar .btn.primary") as HTMLButtonElement;
    expect(saveBtn.textContent).toContain("保存全局配置");
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
