import { describe, it, expect } from "vitest";
import {
  SETTINGS_FIELDS,
  SETTINGS_TABS,
  SETTINGS_TAB_LABELS,
} from "../src/views/settings-fields";

describe("SETTINGS_FIELDS", () => {
  it("has exactly 18 fields", () => {
    expect(SETTINGS_FIELDS).toHaveLength(18);
  });

  it("every field has a unique envVar", () => {
    const envVars = SETTINGS_FIELDS.map((f) => f.envVar);
    expect(new Set(envVars).size).toBe(envVars.length);
  });

  it("every field has tab/section/envVar/label/component", () => {
    for (const f of SETTINGS_FIELDS) {
      expect(f.tab).toBeTruthy();
      expect(f.section).toBeTruthy();
      expect(f.envVar).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(f.label).toBeTruthy();
      expect(["text", "number", "select", "password", "slider"]).toContain(f.component);
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

  it("4 tabs are exposed in SETTINGS_TABS in display order", () => {
    expect(SETTINGS_TABS).toEqual(["ai", "search", "scoring", "terminal"]);
  });

  it("AI tab has 3 fields all marked restart", () => {
    const ai = SETTINGS_FIELDS.filter((f) => f.tab === "ai");
    expect(ai).toHaveLength(3);
    expect(ai.every((f) => f.effect === "restart")).toBe(true);
  });

  it("password field is PLANIFY_API_KEY with mono", () => {
    const apiKey = SETTINGS_FIELDS.find((f) => f.envVar === "PLANIFY_API_KEY");
    expect(apiKey?.component).toBe("password");
    expect(apiKey?.mono).toBe(true);
  });

  it("SETTINGS_TAB_LABELS maps each tab to a Chinese label", () => {
    expect(SETTINGS_TAB_LABELS.ai).toBe("AI 配置");
    expect(SETTINGS_TAB_LABELS.search).toBe("搜索调优");
    expect(SETTINGS_TAB_LABELS.scoring).toBe("评分");
    expect(SETTINGS_TAB_LABELS.terminal).toBe("终端");
  });
});
