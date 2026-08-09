import { describe, it, expect } from "vitest";
import {
  SETTINGS_FIELDS,
  SETTINGS_TABS,
  SETTINGS_TAB_LABELS,
} from "../src/views/settings-fields";

describe("SETTINGS_FIELDS", () => {
  it("has exactly 14 fields (AI 模型字段已移除，由预设区块接管)", () => {
    expect(SETTINGS_FIELDS).toHaveLength(14);
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

  it("3 tabs are exposed in SETTINGS_TABS in display order", () => {
    expect(SETTINGS_TABS).toEqual(["ai", "search", "network"]);
  });

  it("AI tab has no SETTINGS_FIELDS (模型配置由 <model-presets-section> 接管)", () => {
    const ai = SETTINGS_FIELDS.filter((f) => f.tab === "ai");
    expect(ai).toHaveLength(0);
  });

  it("search tab 所有字段都有 hint（常驻描述行数据来源）", () => {
    const search = SETTINGS_FIELDS.filter((f) => f.tab === "search");
    expect(search).toHaveLength(8);
    expect(search.every((f) => f.hint && f.hint.length > 0)).toBe(true);
  });

  it("SETTINGS_TAB_LABELS maps each tab to a Chinese label", () => {
    expect(SETTINGS_TAB_LABELS.ai).toBe("AI 配置");
    expect(SETTINGS_TAB_LABELS.search).toBe("搜索调优");
  });
});
