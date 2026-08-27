import { describe, it, expect, beforeEach } from "vitest";
import {
  readFontScalePct,
  writeFontScalePct,
  clampFontScalePct,
  fontScaleFromPct,
  FONT_SCALE_MIN_PCT,
  FONT_SCALE_MAX_PCT,
} from "../src/utils/font-scale";

const KEY = "cortex.files.mdFontScalePct";

describe("font-scale", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("readFontScalePct returns 100 by default", () => {
    expect(readFontScalePct()).toBe(100);
  });

  it("writeFontScalePct → readFontScalePct roundtrip", () => {
    writeFontScalePct(130);
    expect(readFontScalePct()).toBe(130);
    writeFontScalePct(70);
    expect(readFontScalePct()).toBe(70);
  });

  it("readFontScalePct falls back to 100 for garbage values", () => {
    localStorage.setItem(KEY, "abc");
    expect(readFontScalePct()).toBe(100);
    localStorage.setItem(KEY, "");
    expect(readFontScalePct()).toBe(100);
  });

  it("writeFontScalePct clamps out-of-range values to bounds", () => {
    writeFontScalePct(500);
    expect(readFontScalePct()).toBe(FONT_SCALE_MAX_PCT);
    writeFontScalePct(10);
    expect(readFontScalePct()).toBe(FONT_SCALE_MIN_PCT);
  });

  it("clampFontScalePct clamps to bounds without snapping (档位由 stepper 保证)", () => {
    expect(clampFontScalePct(133)).toBe(133);
    expect(clampFontScalePct(200)).toBe(200);
    expect(clampFontScalePct(60)).toBe(60);
    expect(clampFontScalePct(30)).toBe(60);
    expect(clampFontScalePct(250)).toBe(200);
  });

  it("fontScaleFromPct converts pct to multiplier", () => {
    expect(fontScaleFromPct(100)).toBe(1);
    expect(fontScaleFromPct(130)).toBe(1.3);
    expect(fontScaleFromPct(60)).toBe(0.6);
    expect(fontScaleFromPct(200)).toBe(2);
  });

  it("writeFontScalePct ignores non-finite input without throwing", () => {
    expect(() => writeFontScalePct(NaN)).not.toThrow();
    expect(() => writeFontScalePct(Infinity)).not.toThrow();
    // 非有限数被忽略：既有值（如有）不变；无值保持默认
    expect(readFontScalePct()).toBe(100);
  });
});
