import { describe, it, expect } from "vitest";
import {
  SETTINGS_FIELDS,
  SETTINGS_TABS,
  SETTINGS_TAB_LABELS,
} from "../src/views/settings-fields";

describe("SETTINGS_FIELDS", () => {
  it("has exactly 13 fields", () => {
    expect(SETTINGS_FIELDS).toHaveLength(13);
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

  it("2 tabs are exposed in SETTINGS_TABS in display order", () => {
    expect(SETTINGS_TABS).toEqual(["ai", "search"]);
  });

  it("AI tab has 5 fields all marked live (hot-reload after apply_config fix)", () => {
    const ai = SETTINGS_FIELDS.filter((f) => f.tab === "ai");
    expect(ai).toHaveLength(5);
    expect(ai.every((f) => f.effect === "live")).toBe(true);
  });

  it("password field is PLANIFY_API_KEY with mono", () => {
    const apiKey = SETTINGS_FIELDS.find((f) => f.envVar === "PLANIFY_API_KEY");
    expect(apiKey?.component).toBe("password");
    expect(apiKey?.mono).toBe(true);
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
