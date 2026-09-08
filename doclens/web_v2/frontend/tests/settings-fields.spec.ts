import { describe, it, expect } from "vitest";
import {
  SETTINGS_FIELDS,
  SETTINGS_TABS,
  SETTINGS_TAB_LABELS,
} from "../src/views/settings-fields";

describe("SETTINGS_FIELDS", () => {
  it("has exactly 8 fields (network + MCP + 百度天气 AK + 图像自动旋转；模型/搜索参数由预设区块接管)", () => {
    expect(SETTINGS_FIELDS).toHaveLength(8);
  });

  it("every field has a unique envVar", () => {
    const envVars = SETTINGS_FIELDS.map((f) => f.envVar);
    expect(new Set(envVars).size).toBe(envVars.length);
  });

  it("every field has tab/envVar/label/component", () => {
    for (const f of SETTINGS_FIELDS) {
      expect(f.tab).toBeTruthy();
      expect(f.envVar).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(f.label).toBeTruthy();
      expect(["text", "number", "select", "password", "slider", "switch", "toggle"]).toContain(f.component);
    }
  });

  it("select fields have at least 2 options", () => {
    for (const f of SETTINGS_FIELDS) {
      if (f.component === "select") {
        expect(f.options?.length ?? 0).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("number/slider fields have min < max", () => {
    for (const f of SETTINGS_FIELDS) {
      if (f.component === "number" || f.component === "slider") {
        expect(typeof f.min).toBe("number");
        expect(typeof f.max).toBe("number");
        expect(f.min!).toBeLessThan(f.max!);
      }
    }
  });

  it("5 tabs are exposed in SETTINGS_TABS in display order", () => {
    expect(SETTINGS_TABS).toEqual(["ai", "search", "network", "mcp", "skills"]);
  });

  it("AI tab has 百度天气 AK + 图像自动旋转字段 (模型配置由 <model-presets-section> 接管)", () => {
    const ai = SETTINGS_FIELDS.filter((f) => f.tab === "ai");
    expect(ai.map((f) => f.envVar)).toEqual(["BAIDU_WEATHER_AK", "VISION_AUTO_ROTATE"]);
  });

  it("search tab has no SETTINGS_FIELDS (由 <search-presets-section> 接管)", () => {
    const search = SETTINGS_FIELDS.filter((f) => f.tab === "search");
    expect(search).toHaveLength(0);
  });

  it("SETTINGS_TAB_LABELS maps each tab to a Chinese label", () => {
    expect(SETTINGS_TAB_LABELS.ai).toBe("模型");
    expect(SETTINGS_TAB_LABELS.search).toBe("搜索");
  });
});
